/**
 * 轻量 JWT（HS256）实现，避免引入额外依赖。
 * token 载荷：{ sub, username, role, iat, exp }
 */
const crypto = require('crypto');
const { jwt } = require('./config');

const ALG = 'HS256';

function parseExpiresIn(value) {
  if (typeof value === 'number' && value > 0) return value;
  const matched = /^(\d+)\s*([smhd])$/.exec(String(value || '').trim());
  if (!matched) return 7 * 24 * 60 * 60;
  const amount = Number(matched[1]);
  const unit = matched[2];
  const factors = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * factors[unit];
}

const ttlSeconds = parseExpiresIn(jwt.expiresIn);

function encodeSegment(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function sign(payload = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeSegment({ alg: ALG, typ: 'JWT' });
  const body = encodeSegment({ ...payload, iat: now, exp: now + ttlSeconds });
  const signature = crypto
    .createHmac('sha256', jwt.secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const expected = crypto
      .createHmac('sha256', jwt.secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');

    const a = Buffer.from(expected);
    const b = Buffer.from(parts[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (header.alg !== ALG) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (error) {
    return null;
  }
}

module.exports = { sign, verify, ttlSeconds };
