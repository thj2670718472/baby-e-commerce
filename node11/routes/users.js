var express = require('express');
var router = express.Router();
var userDal = require('../db/userdal');

var responseHelper = require('../utils/responseHelper');
const { requireAuth, requireAdmin, signUserToken } = require('../middleware/auth');
const { isHashed } = require('../utils/password');
const config = require('../utils/config');
const {
  createRateLimiter,
  checkLoginLock,
  recordLoginFailure,
  clearLoginFailures,
  MAX_FAILURES
} = require('../middleware/rateLimit');

// 注册频率限制：同一 IP 每小时最多 10 个账号
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: '注册过于频繁，请稍后再试',
  keyGenerator: (req) => `register:${req.ip}`
});

// 登录尝试按来源 IP 限流：账号级锁定挡不住“换用户名撞库”和“多 IP 打同一账号”
const loginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: config.rateLimit.loginMax,
  message: '登录尝试过于频繁，请稍后再试',
  keyGenerator: (req) => `login-ip:${req.ip}`
});

// 去掉密码等敏感字段再返回给前端
function toSafeUser(userInfo) {
  if (!userInfo) return null;
  const data = userInfo.toJSON ? userInfo.toJSON() : { ...userInfo };
  delete data.password;
  return data;
}

// 历史账号若仍是明文密码，提示重新登录后会自动升级
function warnLegacyPassword(userInfo) {
  if (userInfo && !isHashed(userInfo.password)) {
    console.warn(`[安全提示] 用户 "${userInfo.username}" 的密码仍是明文，请在下次登录后确认已自动升级`);
  }
}

/* POST login. 使用 POST 提交，避免密码出现在 URL 与访问日志中 */
router.post('/login', loginLimiter, async function(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return responseHelper.error(res, "用户名和密码不能为空");
  }

  // 同一来源对同一账号连续失败才触发锁定，避免他人跨网络定向锁号
  const lock = checkLoginLock(username, req.ip);
  if (lock.locked) {
    return res.status(429).json({
      code: 429,
      message: `登录失败次数过多，请 ${Math.ceil(lock.retryAfter / 60)} 分钟后再试`
    });
  }

  try {
    let result = await userDal.login({ username, password });

    if (!result) {
      const failures = recordLoginFailure(username, req.ip);
      const remain = MAX_FAILURES - failures;
      return responseHelper.error(
        res,
        remain > 0 ? `用户名或密码错误，还可尝试 ${remain} 次` : '当前来源登录失败次数过多，请 10 分钟后再试',
        401
      );
    }

    clearLoginFailures(username, req.ip);
    warnLegacyPassword(result);

    const userData = toSafeUser(result);
    const { token, role } = signUserToken(result);
    res.json({
      code: 200,
      data: { ...userData, token, role },
      token,
      message: "登录成功"
    });
  } catch (error) {
    console.error('登录失败:', error);
    responseHelper.error(res, "登录失败，请稍后再试");
  }
});

/* POST user registration. */
router.post('/register', registerLimiter, async function(req, res, next) {
  const { username, password, phone, email } = req.body;

  if (!username || !password) {
    return responseHelper.error(res, "用户名和密码不能为空");
  }
  if (String(username).length < 3 || String(username).length > 20) {
    return responseHelper.error(res, "用户名长度需为 3-20 个字符");
  }
  if (String(password).length < 6 || String(password).length > 32) {
    return responseHelper.error(res, "密码长度需为 6-32 个字符");
  }

  try {
    const existed = await userDal.getUserByUsername(username);
    if (existed) {
      return responseHelper.error(res, "用户名已存在");
    }

    let result = await userDal.addUser({ username, password, phone, email });
    responseHelper.success(res, toSafeUser(result), "注册成功");
  } catch (error) {
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return responseHelper.error(res, "用户名已存在");
    }
    console.error('注册失败:', error);
    responseHelper.error(res, "注册失败");
  }
});

/* POST change password. */
router.post('/change-password', requireAuth, async function(req, res, next) {
  const { username, oldPassword, newPassword } = req.body;

  if (!username || !oldPassword || !newPassword) {
    return responseHelper.error(res, "参数不完整");
  }

  // 普通用户只能修改自己的密码
  if (req.user.role !== 'admin' && req.user.username !== username) {
    return res.status(403).json({ code: 403, message: "只能修改自己的密码" });
  }

  if (oldPassword === newPassword) {
    return responseHelper.error(res, "新密码不能与旧密码相同");
  }
  if (String(newPassword).length < 6 || String(newPassword).length > 32) {
    return responseHelper.error(res, "新密码长度需为 6-32 个字符");
  }

  let result = await userDal.changePassword({ username, oldPassword, newPassword });

  if (result && result.success) {
    responseHelper.success(res, null, "密码修改成功");
  } else {
    responseHelper.error(res, "旧密码错误");
  }
});

/* PUT update user profile. */
router.put('/profile', requireAuth, async function(req, res, next) {
  const { oldUsername, username, email, phone, avatar } = req.body;

  if (!oldUsername && !username) {
    return responseHelper.error(res, "缺少用户标识");
  }

  try {
    // 以 token 为准定位用户，避免通过改动 oldUsername 修改他人资料
    const userInfo = req.user.role === 'admin' && oldUsername
      ? await userDal.getUserByUsername(oldUsername)
      : await userDal.getUserById(req.user.id);

    if (!userInfo) {
      return responseHelper.error(res, "用户不存在");
    }

    const targetUsername = username || userInfo.username;

    if (targetUsername !== userInfo.username) {
      const existed = await userDal.getUserByUsername(targetUsername);
      if (existed && existed.id !== userInfo.id) {
        return responseHelper.error(res, "用户名已被占用");
      }
    }

    const updateData = {
      id: userInfo.id,
      username: targetUsername,
      email: email || userInfo.email,
      phone: phone || userInfo.phone,
      avatar: avatar !== undefined ? avatar : userInfo.avatar
    };

    let result = await userDal.updateUser(updateData);

    if (result[0] > 0) {
      const updatedUser = await userDal.getUserById(userInfo.id);
      const safeUser = toSafeUser(updatedUser);

      // 用户名变化时重新签发 token，避免旧 token 与用户名不一致
      if (targetUsername !== userInfo.username) {
        const { token, role } = signUserToken(updatedUser);
        return res.json({
          code: 200,
          data: { ...safeUser, token, role },
          token,
          message: "个人资料更新成功"
        });
      }

      responseHelper.success(res, safeUser, "个人资料更新成功");
    } else {
      responseHelper.error(res, "更新失败");
    }
  } catch (error) {
    console.error('更新用户资料失败:', error);
    responseHelper.error(res, "更新失败");
  }
});

/* GET 管理员公开信息（供用户端聊天页展示客服头像） */
router.get('/admin-info', async function(req, res) {
  try {
    const adminUser = await userDal.getAdminUser();
    if (!adminUser) {
      return responseHelper.success(res, { username: config.admin.username, avatar: '' }, "获取成功");
    }
    responseHelper.success(
      res,
      { id: adminUser.id, username: adminUser.username, avatar: adminUser.avatar || '' },
      "获取成功"
    );
  } catch (error) {
    console.error('获取管理员信息失败:', error);
    responseHelper.error(res, "获取管理员信息失败");
  }
});

/* GET user list.（仅管理员） */
router.get('/list', requireAdmin, async function(req, res, next) {
  try {
    let result = await userDal.getAllUser();
    responseHelper.success(res, result.map(toSafeUser), "获取用户列表成功");
  } catch (error) {
    console.error('获取用户列表失败:', error);
    responseHelper.error(res, "获取用户列表失败");
  }
});

/* DELETE user.（仅管理员） */
router.delete('/:id', requireAdmin, async function(req, res, next) {
  const { id } = req.params;

  try {
    const userInfo = await userDal.getUserById(id);
    if (!userInfo) {
      return responseHelper.error(res, "用户不存在");
    }

    if (userInfo.role === 'admin') {
      return responseHelper.error(res, "管理员用户不能删除");
    }

    if (userInfo.isactive === false || Number(userInfo.isactive) === 0) {
      return responseHelper.success(res, null, "该用户已处于停用状态");
    }

    // 订单/评价等表通过 userId 外键引用用户，物理删除会失败；
    // 改为停用账号，既能让用户立即无法登录，又保留历史交易与售后数据。
    const result = await userDal.disableUser(id);
    if (result[0] > 0) {
      responseHelper.success(res, null, "用户已停用，历史订单与评价保留");
    } else {
      responseHelper.error(res, "停用用户失败");
    }
  } catch (error) {
    console.error('删除用户失败:', error);
    responseHelper.error(res, "删除失败");
  }
});

module.exports = router;
