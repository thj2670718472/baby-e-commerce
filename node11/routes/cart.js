var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { requireAuth } = require('../middleware/auth');

// 图片字段可能是 JSON 字符串或数组
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

// 获取购物车列表
router.get('/list/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的购物车' });
    }

    const cartList = await db.cart.findAll({
      where: { userId: req.params.userId },
      order: [['createTime', 'DESC']]
    });
    res.json({ code: 200, data: cartList, message: '获取购物车成功' });
  } catch (error) {
    console.error('获取购物车失败:', error);
    res.json({ code: 500, message: '获取购物车失败' });
  }
});

// 加入购物车（商品名称、图片、价格一律以数据库为准）
router.post('/add', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const goodsId = Number(req.body.goodsId);

    if (!Number.isInteger(goodsId) || goodsId <= 0) {
      return res.json({ code: 400, message: '商品参数不合法' });
    }

    const product = await db.goods.findByPk(goodsId);
    if (!product) {
      return res.json({ code: 404, message: '商品不存在' });
    }
    if (!product.status) {
      return res.json({ code: 400, message: '商品已下架，无法加入购物车' });
    }

    const existItem = await db.cart.findOne({ where: { userId, goodsId } });

    if (existItem) {
      const nextQuantity = Number(existItem.quantity) + 1;
      if (nextQuantity > Number(product.quantity)) {
        return res.json({ code: 400, message: '库存不足' });
      }
      await existItem.update({ quantity: nextQuantity });
      res.json({ code: 200, message: '购物车数量已更新' });
    } else {
      if (Number(product.quantity) < 1) {
        return res.json({ code: 400, message: '库存不足' });
      }
      await db.cart.create({
        userId,
        goodsId,
        goodsName: product.name,
        goodsImage: firstImage(product.images),
        price: product.price,
        quantity: 1
      });
      res.json({ code: 200, message: '已加入购物车' });
    }
  } catch (error) {
    console.error('加入购物车失败:', error);
    res.json({ code: 500, message: '加入购物车失败' });
  }
});

// 更新数量
router.put('/update/:id', requireAuth, async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.json({ code: 400, message: '数量必须为正整数' });
    }

    const cartItem = await db.cart.findByPk(req.params.id);
    if (!cartItem) {
      return res.json({ code: 404, message: '购物车商品不存在' });
    }
    if (!canAccess(req, cartItem.userId)) {
      return res.status(403).json({ code: 403, message: '无权修改该购物车商品' });
    }

    const product = await db.goods.findByPk(cartItem.goodsId);
    if (product && quantity > Number(product.quantity)) {
      return res.json({ code: 400, message: '库存不足' });
    }

    await cartItem.update({ quantity });
    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    console.error('更新购物车失败:', error);
    res.json({ code: 500, message: '更新失败' });
  }
});

// 删除
router.delete('/delete/:id', requireAuth, async (req, res) => {
  try {
    const cartItem = await db.cart.findByPk(req.params.id);
    if (!cartItem) {
      return res.json({ code: 404, message: '购物车商品不存在' });
    }
    if (!canAccess(req, cartItem.userId)) {
      return res.status(403).json({ code: 403, message: '无权删除该购物车商品' });
    }

    await cartItem.destroy();
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    console.error('删除购物车失败:', error);
    res.json({ code: 500, message: '删除失败' });
  }
});

// 清空购物车
router.delete('/clear/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权清空其他用户的购物车' });
    }

    await db.cart.destroy({ where: { userId: req.params.userId } });
    res.json({ code: 200, message: '已清空' });
  } catch (error) {
    console.error('清空购物车失败:', error);
    res.json({ code: 500, message: '清空失败' });
  }
});

module.exports = router;
