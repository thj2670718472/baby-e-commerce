/**
 * 上传配额（进程内按用户按天计数）
 * 单实例 demo 足够用；多实例部署需要换成 Redis，否则每个实例各算各的。
 * 目的是防止单个账号无限上传把服务器磁盘占满。
 */
const DEFAULT_DAILY_LIMIT = 30;

const counters = new Map();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function counterKey(userId) {
  return `${userId}:${todayKey()}`;
}

function getLimit() {
  const limit = Number(process.env.UPLOAD_DAILY_LIMIT);
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT;
}

function getUsed(userId) {
  if (!userId) return 0;
  return counters.get(counterKey(userId)) || 0;
}

/** 只读检查，不占用配额；上传成功后再调用 consumeUploadQuota */
function checkUploadQuota(userId) {
  const limit = getLimit();
  const used = getUsed(userId);
  return {
    allowed: used < limit,
    used,
    limit,
    remain: Math.max(0, limit - used)
  };
}

function consumeUploadQuota(userId) {
  if (!userId) return 0;

  // 顺手清掉往天的记录，避免 Map 无限增长
  const today = todayKey();
  for (const key of counters.keys()) {
    if (!key.endsWith(`:${today}`)) counters.delete(key);
  }

  const key = counterKey(userId);
  const next = (counters.get(key) || 0) + 1;
  counters.set(key, next);
  return next;
}

module.exports = { checkUploadQuota, consumeUploadQuota, getLimit };
