/**
 * 轻量内存限流 / 登录失败锁定
 * 单实例部署足够用；多实例部署需要换成 Redis
 */

/**
 * 创建限流中间件
 * @param {{ windowMs?: number, max?: number, message?: string, keyGenerator?: Function }} options
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 10;
  const message = options.message || '请求过于频繁，请稍后再试';
  const store = new Map();

  // 定期清理过期记录，避免内存持续增长
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store) {
      if (now > record.resetAt) store.delete(key);
    }
  }, windowMs);
  cleaner.unref();

  return function rateLimiter(req, res, next) {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.user ? `user:${req.user.id}` : `ip:${req.ip}`);

    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      store.set(key, record);
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        code: 429,
        message: `${message}（${retryAfter} 秒后可重试）`
      });
    }

    next();
  };
}

/**
 * 登录失败锁定
 * 同一账号连续失败 5 次，锁定 10 分钟
 */
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;
const loginStore = new Map();

const cleanLoginStore = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginStore) {
    if (record.lockedUntil && now > record.lockedUntil) loginStore.delete(key);
    else if (!record.lockedUntil && now - record.lastFailAt > LOCK_MS) loginStore.delete(key);
  }
}, 10 * 60 * 1000);
cleanLoginStore.unref();

function getLoginKey(username, ip) {
  return `${String(ip || 'unknown')}:${String(username || '').toLowerCase()}`;
}

function checkLoginLock(username, ip) {
  const key = getLoginKey(username, ip);
  const record = loginStore.get(key);
  if (!record || !record.lockedUntil) return { locked: false };

  const now = Date.now();
  if (now >= record.lockedUntil) {
    loginStore.delete(key);
    return { locked: false };
  }

  return { locked: true, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
}

function recordLoginFailure(username, ip) {
  const key = getLoginKey(username, ip);
  const now = Date.now();
  const record = loginStore.get(key) || { failures: 0, lastFailAt: now, lockedUntil: null };

  record.failures += 1;
  record.lastFailAt = now;

  if (record.failures >= MAX_FAILURES) {
    record.lockedUntil = now + LOCK_MS;
  }

  loginStore.set(key, record);
  return record.failures;
}

function clearLoginFailures(username, ip) {
  loginStore.delete(getLoginKey(username, ip));
}

module.exports = { createRateLimiter, checkLoginLock, recordLoginFailure, clearLoginFailures, MAX_FAILURES };
