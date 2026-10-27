/**
 * 密码哈希：使用 Node 原生 scrypt，格式 scrypt$N$r$p$salt$hash
 * 同时兼容历史明文密码（校验通过后可自动升级为哈希）。
 */
const crypto = require('crypto');

const PREFIX = 'scrypt';
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, KEY_LEN, { N, r: R, p: P });
  return [PREFIX, N, R, P, salt.toString('hex'), hash.toString('hex')].join('$');
}

function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * @returns {{ ok: boolean, needsUpgrade: boolean }}
 * needsUpgrade 为 true 表示库里存的是明文，需要替换为哈希
 */
function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, needsUpgrade: false };

  if (isHashed(stored)) {
    const parts = String(stored).split('$');
    if (parts.length !== 6) return { ok: false, needsUpgrade: false };

    const [, n, r, p, saltHex, hashHex] = parts;
    try {
      const expected = crypto.scryptSync(String(plain), Buffer.from(saltHex, 'hex'), hashHex.length / 2, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      });
      const ok = safeEqual(expected, Buffer.from(hashHex, 'hex'));
      return { ok, needsUpgrade: false };
    } catch (error) {
      return { ok: false, needsUpgrade: false };
    }
  }

  // 历史明文密码
  const ok = safeEqual(Buffer.from(String(plain)), Buffer.from(String(stored)));
  return { ok, needsUpgrade: ok };
}

/**
 * 密码指纹：用于 token 中标记签发时的密码版本。
 * 只要密码变更，指纹随之变化，旧 token 自动失效。
 */
function passwordTag(passwordHash) {
  return crypto
    .createHash('sha256')
    .update(String(passwordHash || ''))
    .digest('hex')
    .slice(0, 16);
}

module.exports = { hashPassword, verifyPassword, isHashed, passwordTag };
