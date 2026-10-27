const { verify, sign } = require('../utils/token');
const db = require('../db/mysqldb');
const { passwordTag } = require('../utils/password');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const matched = /^Bearer\s+(.+)$/i.exec(header);
  if (matched) return matched[1].trim();
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

/**
 * 解析 token 并挂到 req.user，不拦截请求。
 * req.user = { id, username, role }
 * token 中的 ver 与当前密码指纹不一致时（改过密码），视为已失效
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  const payload = verify(token);
  if (!payload || !payload.ver) return next();

  db.user.findByPk(payload.sub, { attributes: ['id', 'username', 'password', 'role', 'isactive'] })
    .then((user) => {
      if (!user) return next();
      if (payload.ver !== passwordTag(user.password)) return next();
      // 被停用的账号即使还持有未过期的 token 也不再放行
      if (user.isactive === false || Number(user.isactive) === 0) return next();

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role === 'admin' ? 'admin' : 'user',
      };
      next();
    })
    .catch((error) => {
      console.error('校验登录态失败:', error.message);
      next();
    });
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限' });
  }
  next();
}

/** 仅允许操作自己的资源（管理员豁免）；userId 从 query/body/params 中取 */
function requireSelf(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }
  if (req.user.role === 'admin') return next();

  const targetUserId = req.params.userId || req.body.userId || req.query.userId;
  if (targetUserId === undefined || targetUserId === null) return next();
  if (String(targetUserId) !== String(req.user.id)) {
    return res.status(403).json({ code: 403, message: '无权访问其他用户的数据' });
  }
  next();
}

/** 根据用户信息签发 token */
function signUserToken(user) {
  const role = user.role === 'admin' ? 'admin' : 'user';
  return {
    token: sign({
      sub: user.id,
      username: user.username,
      role,
      ver: passwordTag(user.password),
    }),
    role,
  };
}

module.exports = { optionalAuth, requireAuth, requireAdmin, requireSelf, signUserToken };
