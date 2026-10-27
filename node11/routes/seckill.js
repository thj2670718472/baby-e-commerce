/**
 * 秒杀
 * - 场次按时间推导状态（未开始/进行中/已结束），不额外落库
 * - 抢购核心链路：限购校验 → 行锁串行 → 原子扣秒杀库存 → 原子扣商品库存 → 生成待付款订单
 * - 未支付取消/超时释放时秒杀库存回池（见 orderService.cancelPendingOrder）
 * - 已支付后退货不回补秒杀库存：防止活动结束后无限刷库存，商品库存正常回补
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../db/mysqldb');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { deductStock, resolveShipping } = require('../utils/orderService');
const { roundPrice } = require('../utils/discount');

// 抢购接口按用户限流：正常手速远达不到，脚本狂刷会被挡住
const seckillLimiter = createRateLimiter({
  windowMs: 10 * 1000,
  max: 5,
  message: '抢购过于频繁，请稍后再试'
});

// 场次状态按当前时间推导
function sessionStatus(session, now = Date.now()) {
  if (!session.status) return '已下线';
  if (now < new Date(session.startTime).getTime()) return '未开始';
  if (now > new Date(session.endTime).getTime()) return '已结束';
  return '进行中';
}

// 商品图片字段可能是 JSON 字符串或数组，统一取第一张
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

// ==================== 场次列表（公开） ====================
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await db.SeckillSession.findAll({
      where: { status: true },
      order: [['startTime', 'ASC']]
    });
    const allGoods = await db.SeckillGoods.findAll({ order: [['sort', 'ASC']] });

    const grouped = {};
    for (const g of allGoods) {
      (grouped[g.sessionId] = grouped[g.sessionId] || []).push(g.toJSON());
    }

    const now = Date.now();
    const data = sessions.map((s) => {
      const item = s.toJSON();
      item.status = sessionStatus(s, now);
      item.goods = grouped[s.id] || [];
      return item;
    });

    // serverTime 用于前端校准倒计时
    res.json({ code: 200, data, serverTime: now, message: '获取秒杀场次成功' });
  } catch (error) {
    console.error('获取秒杀场次失败:', error);
    res.json({ code: 500, message: '获取秒杀场次失败' });
  }
});

// ==================== 抢购 ====================
router.post('/buy', requireAuth, seckillLimiter, async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const userId = req.user.id;
    const seckillGoodsId = Number(req.body.seckillGoodsId);
    let quantity = Number(req.body.quantity) || 1;

    if (!Number.isInteger(seckillGoodsId) || seckillGoodsId <= 0) {
      await transaction.rollback();
      return res.send({ code: 400, message: '参数不合法' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      await transaction.rollback();
      return res.send({ code: 400, message: '购买数量必须为正整数' });
    }

    // 行锁串行化同一秒杀商品的并发抢购
    const seckillGoods = await db.SeckillGoods.findByPk(seckillGoodsId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!seckillGoods) {
      await transaction.rollback();
      return res.send({ code: 404, message: '秒杀商品不存在' });
    }

    const session = await db.SeckillSession.findByPk(seckillGoods.sessionId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!session || !session.status) {
      await transaction.rollback();
      return res.send({ code: 400, message: '活动不存在或已下线' });
    }
    const now = Date.now();
    if (now < new Date(session.startTime).getTime()) {
      await transaction.rollback();
      return res.send({ code: 400, message: '活动尚未开始' });
    }
    if (now > new Date(session.endTime).getTime()) {
      await transaction.rollback();
      return res.send({ code: 400, message: '活动已结束' });
    }

    // 每人限购按“已购商品件数”汇总；软删除订单仍保留限购资格
    const boughtRaw = await db.order_goods.sum('quantity', {
      include: [{
        model: db.order,
        required: true,
        attributes: [],
        where: {
          userId,
          seckillGoodsId,
          status: { [Op.ne]: '已取消' }
        }
      }],
      transaction
    });
    const bought = Number(boughtRaw) || 0;
    if (bought + quantity > Number(seckillGoods.maxPerUser)) {
      await transaction.rollback();
      return res.send({ code: 400, message: `每人限购 ${seckillGoods.maxPerUser} 件，你已购 ${bought} 件` });
    }

    // 商品可能在活动创建后被下架，结算时必须重新校验
    const product = await db.goods.findByPk(seckillGoods.goodsId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product || !product.status) {
      await transaction.rollback();
      return res.send({ code: 400, message: '商品已下架，无法参与秒杀' });
    }

    // 原子扣秒杀库存：防超卖核心
    const [affected] = await db.SeckillGoods.update(
      { stock: db.sequelize.literal(`stock - ${quantity}`) },
      { where: { id: seckillGoodsId, stock: { [Op.gte]: quantity } }, transaction }
    );
    if (!affected) {
      await transaction.rollback();
      return res.send({ code: 400, message: '手慢了，已被抢完' });
    }

    // 同步扣真实商品库存；不足则整体回滚（含秒杀库存）
    const stockOk = await deductStock(seckillGoods.goodsId, quantity, transaction);
    if (!stockOk) {
      await transaction.rollback();
      return res.send({ code: 400, message: '商品库存不足' });
    }

    const shipping = await resolveShipping(userId, req.body.address, req.body.phone, transaction);
    if (!shipping) {
      await transaction.rollback();
      return res.send({ code: 400, message: '请先添加收货地址' });
    }

    const user = await db.user.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.send({ code: 404, message: '用户不存在' });
    }

    const orderNo = `SEC${Date.now()}${crypto.randomInt(0, 1000000).toString().padStart(6, '0')}`;
    const totalAmount = roundPrice(Number(seckillGoods.seckillPrice) * quantity);

    const order = await db.order.create({
      orderNo,
      userId,
      userName: user.username,
      totalAmount,
      originalAmount: roundPrice(Number(seckillGoods.originalPrice) * quantity),
      status: '待付款',
      address: shipping.address,
      phone: shipping.phone,
      paymentMethod: '在线支付',
      orderTime: new Date(),
      seckillGoodsId
    }, { transaction });

    await db.order_goods.create({
      orderId: order.id,
      goodsId: seckillGoods.goodsId,
      goodsName: seckillGoods.goodsName,
      goodsImage: seckillGoods.goodsImage || '',
      price: seckillGoods.seckillPrice,
      quantity,
      subtotal: totalAmount
    }, { transaction });

    await transaction.commit();

    // 秒杀已省金额不落库，随订单回给前端展示
    const payload = order.toJSON();
    payload.discountAmount = roundPrice((Number(seckillGoods.originalPrice) - Number(seckillGoods.seckillPrice)) * quantity);
    res.send({ code: 200, data: payload, message: '抢购成功，请尽快支付' });
  } catch (error) {
    await transaction.rollback();
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return res.send({ code: 409, message: '下单冲突，请重试' });
    }
    console.error('秒杀下单失败:', error);
    res.send({ code: 500, message: '秒杀下单失败' });
  }
});

// ==================== 管理端：场次与商品全量列表 ====================
router.get('/admin/list', requireAdmin, async (req, res) => {
  try {
    const sessions = await db.SeckillSession.findAll({ order: [['startTime', 'DESC']] });
    const allGoods = await db.SeckillGoods.findAll({ order: [['sort', 'ASC']] });

    // 每个秒杀商品已售件数（未取消、未删除的订单明细求和）
    const soldRows = await db.order_goods.findAll({
      attributes: [
        'orderId',
        [db.sequelize.literal('`order`.`seckillGoodsId`'), 'seckillGoodsId'],
        [db.sequelize.fn('SUM', db.sequelize.col('order_goods.quantity')), 'sold']
      ],
      include: [{
        model: db.order,
        as: 'order',
        attributes: [],
        where: { status: { [Op.ne]: '已取消' }, isDeleted: false }
      }],
      group: ['order.seckillGoodsId', 'order_goods.orderId'],
      raw: true
    });

    // 同一秒杀商品可能对应多个订单行，再聚合一次
    const soldMap = {};
    for (const row of soldRows) {
      if (!row.seckillGoodsId) continue;
      soldMap[row.seckillGoodsId] = (soldMap[row.seckillGoodsId] || 0) + Number(row.sold);
    }

    const grouped = {};
    for (const g of allGoods) {
      const item = g.toJSON();
      item.sold = soldMap[g.id] || 0;
      (grouped[g.sessionId] = grouped[g.sessionId] || []).push(item);
    }

    const now = Date.now();
    const data = sessions.map((s) => {
      const item = s.toJSON();
      item.status = sessionStatus(s, now);
      item.goods = grouped[s.id] || [];
      return item;
    });

    res.send({ code: 200, data, message: '获取秒杀管理数据成功' });
  } catch (error) {
    console.error('获取秒杀管理数据失败:', error);
    res.send({ code: 500, message: '获取秒杀管理数据失败' });
  }
});

// ==================== 管理端：创建场次 ====================
router.post('/session', requireAdmin, async (req, res) => {
  try {
    const { name, startTime, endTime, status } = req.body;
    if (!name || !startTime || !endTime) {
      return res.send({ code: 400, message: '场次名称与起止时间不能为空' });
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.send({ code: 400, message: '结束时间必须晚于开始时间' });
    }

    const session = await db.SeckillSession.create({
      name: String(name).trim(),
      startTime: start,
      endTime: end,
      status: status !== false
    });
    res.send({ code: 200, data: session, message: '创建场次成功' });
  } catch (error) {
    console.error('创建秒杀场次失败:', error);
    res.send({ code: 500, message: '创建秒杀场次失败' });
  }
});

// ==================== 管理端：更新场次（名称/时间/启停） ====================
router.put('/session/:id', requireAdmin, async (req, res) => {
  try {
    const session = await db.SeckillSession.findByPk(req.params.id);
    if (!session) return res.send({ code: 404, message: '场次不存在' });

    const updates = {};
    if (req.body.name) updates.name = String(req.body.name).trim();
    if (req.body.startTime) {
      const start = new Date(req.body.startTime);
      if (isNaN(start.getTime())) return res.send({ code: 400, message: '开始时间不合法' });
      updates.startTime = start;
    }
    if (req.body.endTime) {
      const end = new Date(req.body.endTime);
      if (isNaN(end.getTime())) return res.send({ code: 400, message: '结束时间不合法' });
      updates.endTime = end;
    }
    if (updates.startTime && updates.endTime && updates.endTime <= updates.startTime) {
      return res.send({ code: 400, message: '结束时间必须晚于开始时间' });
    }
    if (typeof req.body.status === 'boolean') updates.status = req.body.status;

    await session.update(updates);
    res.send({ code: 200, data: session, message: '更新场次成功' });
  } catch (error) {
    console.error('更新秒杀场次失败:', error);
    res.send({ code: 500, message: '更新秒杀场次失败' });
  }
});

// ==================== 管理端：删除场次（连同其下秒杀商品） ====================
router.delete('/session/:id', requireAdmin, async (req, res) => {
  try {
    const session = await db.SeckillSession.findByPk(req.params.id);
    if (!session) return res.send({ code: 404, message: '场次不存在' });

    await db.SeckillGoods.destroy({ where: { sessionId: session.id } });
    await session.destroy();
    res.send({ code: 200, message: '删除场次成功' });
  } catch (error) {
    console.error('删除秒杀场次失败:', error);
    res.send({ code: 500, message: '删除秒杀场次失败' });
  }
});

// ==================== 管理端：场次下加秒杀商品 ====================
router.post('/goods', requireAdmin, async (req, res) => {
  try {
    const { sessionId, goodsId, seckillPrice, stock, maxPerUser = 1, sort = 0 } = req.body;

    const session = await db.SeckillSession.findByPk(sessionId);
    if (!session) return res.send({ code: 404, message: '场次不存在' });

    const product = await db.goods.findByPk(goodsId);
    if (!product || !product.status) return res.send({ code: 400, message: '商品不存在或已下架' });

    const price = Number(seckillPrice);
    if (!Number.isFinite(price) || price <= 0) return res.send({ code: 400, message: '秒杀价不合法' });
    if (price >= Number(product.price)) return res.send({ code: 400, message: '秒杀价必须低于商品原价' });

    const seckillStock = Number(stock);
    if (!Number.isInteger(seckillStock) || seckillStock <= 0) return res.send({ code: 400, message: '秒杀库存必须为正整数' });
    if (seckillStock > Number(product.quantity)) return res.send({ code: 400, message: '秒杀库存不能超过商品现有库存' });

    const limit = Number(maxPerUser);
    if (!Number.isInteger(limit) || limit <= 0) return res.send({ code: 400, message: '限购数量必须为正整数' });

    const item = await db.SeckillGoods.create({
      sessionId,
      goodsId,
      goodsName: product.name,
      goodsImage: firstImage(product.images),
      seckillPrice: price,
      originalPrice: Number(product.price),
      stock: seckillStock,
      maxPerUser: limit,
      sort: Number(sort) || 0
    });
    res.send({ code: 200, data: item, message: '添加秒杀商品成功' });
  } catch (error) {
    console.error('添加秒杀商品失败:', error);
    res.send({ code: 500, message: '添加秒杀商品失败' });
  }
});

// ==================== 管理端：更新秒杀商品（价格/库存/限购/排序） ====================
router.put('/goods/:id', requireAdmin, async (req, res) => {
  try {
    const item = await db.SeckillGoods.findByPk(req.params.id);
    if (!item) return res.send({ code: 404, message: '秒杀商品不存在' });

    const updates = {};
    if (req.body.seckillPrice !== undefined) {
      const price = Number(req.body.seckillPrice);
      if (!Number.isFinite(price) || price <= 0) return res.send({ code: 400, message: '秒杀价不合法' });
      if (price >= Number(item.originalPrice)) return res.send({ code: 400, message: '秒杀价必须低于原价' });
      updates.seckillPrice = price;
    }
    if (req.body.stock !== undefined) {
      const stock = Number(req.body.stock);
      if (!Number.isInteger(stock) || stock < 0) return res.send({ code: 400, message: '库存必须为非负整数' });
      updates.stock = stock;
    }
    if (req.body.maxPerUser !== undefined) {
      const limit = Number(req.body.maxPerUser);
      if (!Number.isInteger(limit) || limit <= 0) return res.send({ code: 400, message: '限购数量必须为正整数' });
      updates.maxPerUser = limit;
    }
    if (req.body.sort !== undefined) updates.sort = Number(req.body.sort) || 0;

    await item.update(updates);
    res.send({ code: 200, data: item, message: '更新秒杀商品成功' });
  } catch (error) {
    console.error('更新秒杀商品失败:', error);
    res.send({ code: 500, message: '更新秒杀商品失败' });
  }
});

// ==================== 管理端：下架秒杀商品（已售订单不受影响） ====================
router.delete('/goods/:id', requireAdmin, async (req, res) => {
  try {
    const item = await db.SeckillGoods.findByPk(req.params.id);
    if (!item) return res.send({ code: 404, message: '秒杀商品不存在' });

    await item.destroy();
    res.send({ code: 200, message: '下架秒杀商品成功' });
  } catch (error) {
    console.error('下架秒杀商品失败:', error);
    res.send({ code: 500, message: '下架秒杀商品失败' });
  }
});

module.exports = router;
