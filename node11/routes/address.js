var express = require('express');
var router = express.Router();
var addressDal = require('../db/addressdal');
var responseHelper = require('../utils/responseHelper');
const { requireAuth } = require('../middleware/auth');

function canAccess(req, userId) {
  return req.user && (req.user.role === 'admin' || String(req.user.id) === String(userId));
}

function forbidden(res, message) {
  return res.status(403).json({ code: 403, message: message || '无权操作该地址' });
}

/* GET address listing by user id. */
router.get('/list/:userId', requireAuth, async function(req, res, next) {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res, '无权查看其他用户的地址');

    let result = await addressDal.getAddressByUserId(req.params.userId);
    responseHelper.success(res, result, "获取地址列表成功");
  } catch (error) {
    console.error('获取地址列表失败:', error);
    responseHelper.error(res, "获取地址列表失败");
  }
});

/* GET default address by user id. */
router.get('/default/:userId', requireAuth, async function(req, res, next) {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res, '无权查看其他用户的地址');

    let result = await addressDal.getDefaultAddressByUserId(req.params.userId);
    responseHelper.success(res, result, "获取默认地址成功");
  } catch (error) {
    console.error('获取默认地址失败:', error);
    responseHelper.error(res, "获取默认地址失败");
  }
});

/* GET address by id. */
router.get('/:id', requireAuth, async function(req, res, next) {
  try {
    let result = await addressDal.getAddressById(req.params.id);
    if (!result) {
      return responseHelper.error(res, "地址不存在");
    }
    if (!canAccess(req, result.userId)) return forbidden(res);

    responseHelper.success(res, result, "获取地址详情成功");
  } catch (error) {
    console.error('获取地址详情失败:', error);
    responseHelper.error(res, "获取地址详情失败");
  }
});

/* POST add address. */
router.post('/', requireAuth, async function(req, res, next) {
  try {
    const model = req.body;
    // 归属用户只能来自登录态
    model.userId = req.user.id;

    if (!model.name || !model.phone || !model.detail) {
      return responseHelper.error(res, "收货人、电话和详细地址不能为空");
    }

    let result = await addressDal.addAddress(model);
    responseHelper.success(res, result, "新增地址成功");
  } catch (error) {
    console.error('新增地址失败:', error);
    responseHelper.error(res, "新增地址失败");
  }
});

/* PUT update address. */
router.put('/:id', requireAuth, async function(req, res, next) {
  try {
    const existed = await addressDal.getAddressById(req.params.id);
    if (!existed) {
      return responseHelper.error(res, "地址不存在");
    }
    if (!canAccess(req, existed.userId)) return forbidden(res);

    const model = req.body;
    model.id = req.params.id;
    model.userId = existed.userId; // 保持原归属，不允许借更新转移地址

    let result = await addressDal.updateAddress(model);
    if (result[0] > 0) {
      responseHelper.success(res, result, "更新地址成功");
    } else {
      responseHelper.error(res, "更新地址失败");
    }
  } catch (error) {
    console.error('更新地址失败:', error);
    responseHelper.error(res, "更新地址失败");
  }
});

/* DELETE delete address. */
router.delete('/:id', requireAuth, async function(req, res, next) {
  try {
    const existed = await addressDal.getAddressById(req.params.id);
    if (!existed) {
      return responseHelper.error(res, "地址不存在");
    }
    if (!canAccess(req, existed.userId)) return forbidden(res);

    let result = await addressDal.deleteAddress(req.params.id);
    if (result > 0) {
      responseHelper.success(res, result, "删除地址成功");
    } else {
      responseHelper.error(res, "删除地址失败");
    }
  } catch (error) {
    console.error('删除地址失败:', error);
    responseHelper.error(res, "删除地址失败");
  }
});

module.exports = router;
