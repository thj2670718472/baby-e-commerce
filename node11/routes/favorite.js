var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { requireAuth } = require('../middleware/auth');

function firstImage(images) {
  if (!images) return '';
  if (Array.isArray(images)) return images[0] || '';
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed[0] || '' : images;
    } catch (error) {
      return images;
    }
  }
  return '';
}

function canAccess(req, userId) {
  return req.user && (req.user.role === 'admin' || String(req.user.id) === String(userId));
}

// 获取用户收藏列表
router.get('/list/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的收藏' });
    }

    const favorites = await db.favorite.findAll({
      where: { userId: req.params.userId },
      order: [['createTime', 'DESC']]
    });
    res.send({ code: 200, data: favorites, message: '获取收藏列表成功' });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.send({ code: 500, message: '获取收藏列表失败' });
  }
});

// 检查是否已收藏
router.get('/check/:userId/:goodsId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的收藏' });
    }

    const favorite = await db.favorite.findOne({
      where: {
        userId: req.params.userId,
        goodsId: req.params.goodsId
      }
    });
    res.send({ code: 200, data: { isFavorite: !!favorite } });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.send({ code: 500, message: '检查收藏状态失败' });
  }
});

// 添加收藏（商品信息以数据库为准）
router.post('/add', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const goodsId = Number(req.body.goodsId);

    if (!Number.isInteger(goodsId) || goodsId <= 0) {
      return res.send({ code: 400, message: '商品参数不合法' });
    }

    const product = await db.goods.findByPk(goodsId);
    if (!product) {
      return res.send({ code: 404, message: '商品不存在' });
    }

    const existing = await db.favorite.findOne({ where: { userId, goodsId } });
    if (existing) {
      return res.send({ code: 400, message: '已经收藏过了' });
    }

    const favorite = await db.favorite.create({
      userId,
      goodsId,
      goodsName: product.name,
      goodsImage: firstImage(product.images),
      goodsPrice: product.price,
      createTime: new Date()
    });

    res.send({ code: 200, data: favorite, message: '收藏成功' });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.send({ code: 500, message: '添加收藏失败' });
  }
});

// 取消收藏
router.delete('/remove/:userId/:goodsId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权操作其他用户的收藏' });
    }

    const result = await db.favorite.destroy({
      where: {
        userId: req.params.userId,
        goodsId: req.params.goodsId
      }
    });

    if (result > 0) {
      res.send({ code: 200, message: '取消收藏成功' });
    } else {
      res.send({ code: 404, message: '收藏不存在' });
    }
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.send({ code: 500, message: '取消收藏失败' });
  }
});

module.exports = router;
