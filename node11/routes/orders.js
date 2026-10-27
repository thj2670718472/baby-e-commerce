const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../db/mysqldb');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  isOwner,
  cancelPendingOrder,
  confirmReceipt,
  rollbackOrderBenefits,
  deductStock,
  resolveShipping
} = require('../utils/orderService');
const { isDiscountDay, applyDiscount, roundPrice } = require('../utils/discount');

// ==================== 工具函数 ====================

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

function forbidden(res, message) {
  return res.status(403).json({ code: 403, message: message || '无权操作该订单' });
}

// 订单号：全量毫秒时间戳 + 6 位加密随机数；万一仍撞唯一索引，create 的 catch 会给友好的冲突提示
function generateOrderNo() {
  return `ORD${Date.now()}${crypto.randomInt(0, 1000000).toString().padStart(6, '0')}`;
}

// 单个订单最多包含的商品行数：防止一次请求带几万条明细长时间占用行锁与连接池
const MAX_ORDER_ITEMS = Number(process.env.MAX_ORDER_ITEMS) || 20;

// 下单频控：按登录用户限流，避免脚本刷单锁库存
const createOrderLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.ORDER_CREATE_MAX) || 20,
  message: '下单过于频繁，请稍后再试',
  keyGenerator: (req) => `order-create:${req.user ? req.user.id : req.ip}`
});

// 管理端可手动流转的状态：取消与完成必须走带库存/权益回滚的专用流程，终态不可回退
const STATUS_TRANSITIONS = {
  '待付款': ['已付款'],
  '已付款': ['已发货', '退货中'],
  '已发货': ['退货中'],
  '已完成': ['退货中'],
  '退货中': [],
  '已取消': [],
  '已退货': []
};

// ==================== 订单列表 ====================
// 普通用户只能查自己的；管理员可通过 userId 查指定用户，不传则查全部
// 支持 status 精确过滤；传 page/pageSize 时返回分页结构，不传时仍返回数组（兼容旧前端）
router.get('/list', requireAuth, async (req, res) => {
  try {
    let whereCondition = {};

    if (req.user.role === 'admin') {
      if (req.query.userId) whereCondition.userId = req.query.userId;
    } else {
      whereCondition.userId = req.user.id;
    }

    if (req.query.status) whereCondition.status = req.query.status;

    // 软删除的订单对用户隐藏；管理员可带 includeDeleted=1 查看含已删的全部
    if (!(req.user.role === 'admin' && req.query.includeDeleted === '1')) {
      whereCondition.isDeleted = false;
    }

    const include = [{ model: db.order_goods, as: 'order_goods' }];
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize || 10);

    if (Number.isInteger(page) && page > 0) {
      const size = Math.min(Math.max(pageSize, 1), 50);
      const { count, rows } = await db.order.findAndCountAll({
        where: whereCondition,
        include,
        order: [['orderTime', 'DESC']],
        limit: size,
        offset: (page - 1) * size
      });

      return res.send({
        code: 200,
        data: {
          list: rows,
          total: count,
          page,
          pageSize: size,
          totalPages: Math.ceil(count / size)
        },
        message: '获取订单列表成功'
      });
    }

    const orders = await db.order.findAll({
      where: whereCondition,
      include,
      order: [['orderTime', 'DESC']]
    });

    res.send({
      code: 200,
      data: orders,
      message: '获取订单列表成功'
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.send({
      code: 500,
      message: '获取订单列表失败'
    });
  }
});

// ==================== 订单详情 ====================
router.get('/detail/:id', requireAuth, async (req, res) => {
  try {
    const order = await db.order.findByPk(req.params.id, {
      include: [{
        model: db.order_goods,
        as: 'order_goods'
      }]
    });

    if (!order) return res.send({ code: 404, message: '订单不存在' });
    // 已删除的订单对用户不可见，管理员仍可查看
    if (order.isDeleted && req.user.role !== 'admin') return res.send({ code: 404, message: '订单不存在' });
    if (!isOwner(order, req.user)) return forbidden(res);

    // 查已评价的商品ID
    const reviewed = await db.review.findAll({
      where: { orderId: order.id, userId: order.userId },
      attributes: ['goodsId']
    });
    const reviewedGoodsIds = reviewed.map(r => r.goodsId);

    const result = order.toJSON();
    result.reviewedGoodsIds = reviewedGoodsIds;

    res.send({ code: 200, data: result });
  } catch (error) {
    res.send({ code: 500, message: '获取订单详情失败' });
  }
});

// ==================== 创建订单 ====================
// 只信任 goodsId 与 quantity：价格、商品名、图片、订单状态、归属用户全部由服务端决定
router.post('/create', requireAuth, createOrderLimiter, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const orderData = req.body || {};
    const userId = req.user.id;

    const user = await db.user.findByPk(userId, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.send({ code: 404, message: '用户不存在' });
    }

    if (!Array.isArray(orderData.goods) || orderData.goods.length === 0) {
      await transaction.rollback();
      return res.send({ code: 400, message: '商品信息不能为空' });
    }
    if (orderData.goods.length > MAX_ORDER_ITEMS) {
      await transaction.rollback();
      return res.send({ code: 400, message: `单次最多购买 ${MAX_ORDER_ITEMS} 种商品` });
    }

    let cartIds = [];
    if (orderData.cartIds !== undefined) {
      if (!Array.isArray(orderData.cartIds)) {
        await transaction.rollback();
        return res.send({ code: 400, message: '购物车参数不合法' });
      }
      cartIds = [...new Set(orderData.cartIds.map(Number))];
      if (cartIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        await transaction.rollback();
        return res.send({ code: 400, message: '购物车参数不合法' });
      }
    }

    // ---------- 逐项校验，价格从数据库读取 ----------
    // 打折日：成交价按活动折扣计算；非打折日：成交价 = 原价
    const discountActive = isDiscountDay();
    const items = [];
    let originalTotal = 0;   // 原价合计
    let goodsTotal = 0;      // 折扣后商品金额合计（后续券、积分都基于它）

    for (const raw of orderData.goods) {
      const goodsId = Number(raw.goodsId);
      const quantity = Number(raw.quantity);

      if (!Number.isInteger(goodsId) || goodsId <= 0) {
        await transaction.rollback();
        return res.send({ code: 400, message: '商品参数不合法' });
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        await transaction.rollback();
        return res.send({ code: 400, message: '购买数量必须为正整数' });
      }
      if (quantity > 999) {
        await transaction.rollback();
        return res.send({ code: 400, message: '单次购买数量超出限制' });
      }

      const product = await db.goods.findByPk(goodsId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!product) {
        await transaction.rollback();
        return res.send({ code: 404, message: `商品 ${goodsId} 不存在` });
      }
      if (!product.status) {
        await transaction.rollback();
        return res.send({ code: 400, message: `商品 ${product.name} 已下架，无法购买` });
      }
      if (Number(product.quantity) < quantity) {
        await transaction.rollback();
        return res.send({ code: 400, message: `商品 ${product.name} 库存不足` });
      }

      const price = Number(product.price);
      // 每件商品单独折算再累加，和前端逐件展示的价格口径保持一致
      const unitPrice = applyDiscount(price, discountActive);

      originalTotal += price * quantity;
      goodsTotal += unitPrice * quantity;

      items.push({
        goodsId,
        goodsName: product.name,
        goodsImage: firstImage(product.images),
        price: unitPrice,
        quantity,
        subtotal: roundPrice(unitPrice * quantity)
      });
    }

    // ---------- 收货地址：优先用请求带的，否则回退用户默认/第一个地址 ----------
    const shipping = await resolveShipping(userId, orderData.address, orderData.phone, transaction);
    if (!shipping) {
      await transaction.rollback();
      return res.send({ code: 400, message: '请先添加收货地址' });
    }
    const { address, phone } = shipping;

    // ---------- 优惠券与积分：服务端强制互斥 ----------
    let requestedPoints = Number(orderData.usePoints) || 0;
    if (!Number.isInteger(requestedPoints) || requestedPoints < 0) requestedPoints = 0;
    if (orderData.couponId && requestedPoints > 0) {
      await transaction.rollback();
      return res.send({ code: 400, message: '优惠券与积分抵扣不能同时使用' });
    }

    // ---------- 优惠券：锁行、验归属、验有效期与模板状态 ----------
    let couponAmount = 0;
    let couponId = null;

    if (orderData.couponId) {
      const requestedCouponId = Number(orderData.couponId);
      if (!Number.isInteger(requestedCouponId) || requestedCouponId <= 0) {
        await transaction.rollback();
        return res.send({ code: 400, message: '优惠券无效或已使用' });
      }

      const coupon = await db.UserCoupon.findOne({
        where: {
          id: requestedCouponId,
          userId,
          status: 1,
          expireTime: { [Op.gt]: new Date() }
        },
        include: [{
          model: db.CouponTemplate,
          where: { status: 1 },
          required: true
        }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!coupon) {
        await transaction.rollback();
        return res.send({ code: 400, message: '优惠券无效、已过期或已使用' });
      }
      // 门槛按折扣后的商品金额判断，与用户实际看到的金额一致
      if (goodsTotal < Number(coupon.threshold || 0)) {
        await transaction.rollback();
        return res.send({ code: 400, message: '订单金额不满足优惠券使用门槛' });
      }

      couponAmount = Math.min(Number(coupon.amount) || 0, goodsTotal);
      couponId = coupon.id;

      await coupon.update({
        status: 2,
        usedTime: new Date(),
        orderId: null
      }, { transaction });
    }

    // ---------- 积分抵扣：不能超过余额，最多抵扣应付金额的 50% ----------
    let usePoints = requestedPoints;

    const availablePoints = Number(user.points) || 0;
    if (usePoints > availablePoints) {
      await transaction.rollback();
      return res.send({ code: 400, message: '积分不足' });
    }

    const payableBeforePoints = Math.max(0, goodsTotal - couponAmount);
    const maxUsePoints = Math.floor(payableBeforePoints * 0.5 * 10); // 10 积分 = 1 元，最多 50%
    if (usePoints > maxUsePoints) usePoints = maxUsePoints;

    if (usePoints > 0) {
      const [affected] = await db.user.update(
        { points: db.sequelize.literal(`points - ${usePoints}`) },
        { where: { id: userId, points: { [Op.gte]: usePoints } }, transaction }
      );
      if (!affected) {
        await transaction.rollback();
        return res.send({ code: 400, message: '积分不足' });
      }
    }

    const orderNo = generateOrderNo();
    let finalTotal = payableBeforePoints - usePoints / 10;
    finalTotal = Math.max(0, roundPrice(finalTotal));

    // ---------- 创建订单：状态固定由服务端给出 ----------
    const order = await db.order.create({
      orderNo,
      userId,
      userName: user.username,
      totalAmount: finalTotal,
      // 原价合计，优惠明细 = originalAmount - 折扣 - couponAmount - 积分抵扣
      originalAmount: roundPrice(originalTotal),
      couponId,
      couponAmount,
      status: '待付款',
      address,
      phone,
      paymentMethod: orderData.paymentMethod || '在线支付',
      orderTime: new Date()
    }, { transaction });

    if (couponId) {
      await db.UserCoupon.update({ orderId: order.id }, { where: { id: couponId }, transaction });
    }

    // ---------- 明细 + 原子扣库存 ----------
    for (const item of items) {
      await db.order_goods.create({
        orderId: order.id,
        goodsId: item.goodsId,
        goodsName: item.goodsName,
        goodsImage: item.goodsImage,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal
      }, { transaction });

      const ok = await deductStock(item.goodsId, item.quantity, transaction);
      if (!ok) {
        await transaction.rollback();
        return res.send({ code: 400, message: `商品 ${item.goodsName} 库存不足` });
      }
    }

    if (usePoints > 0) {
      await db.pointsRecord.create({
        userId,
        type: 'expense',
        points: usePoints,
        source: '下单抵扣',
        description: `订单${orderNo}`
      }, { transaction });
    }

    // 已结算购物车项与订单在同一事务中删除，失败则整体回滚
    if (cartIds.length > 0) {
      await db.cart.destroy({
        where: { id: cartIds, userId },
        transaction
      });
    }

    await transaction.commit();

    const result = await db.order.findByPk(order.id, {
      include: [{ model: db.order_goods, as: 'order_goods' }]
    });

    // discountAmount 不入库，仅回给前端展示"活动已省"
    const payload = result.toJSON();
    payload.discountAmount = roundPrice(originalTotal - goodsTotal);

    res.send({ code: 200, data: payload, message: '创建订单成功' });

  } catch (error) {
    await transaction.rollback();
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      console.error('订单号冲突:', error.message);
      return res.send({ code: 409, message: '下单冲突，请重试' });
    }
    console.error('创建订单失败:', error);
    res.send({ code: 500, message: '创建订单失败' });
  }
});

// ==================== 支付订单（用户端） ====================
// 库存已在下单时扣减，这里只做状态流转
router.post('/pay/:id', requireAuth, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const order = await db.order.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return res.send({ code: 404, message: '订单不存在' });
    }
    if (!isOwner(order, req.user)) {
      await transaction.rollback();
      return forbidden(res);
    }
    if (order.status !== '待付款') {
      await transaction.rollback();
      return res.send({ code: 400, message: '当前订单状态无法支付' });
    }

    await order.update({ status: '已付款' }, { transaction });
    await transaction.commit();

    res.send({ code: 200, message: '支付成功' });
  } catch (error) {
    await transaction.rollback();
    console.error('支付订单失败:', error);
    res.send({ code: 500, message: '支付失败' });
  }
});

// ==================== 更新订单状态（管理员） ====================
// 只允许白名单内的流转；取消与完成复用专用流程，避免绕过库存/优惠券/积分回滚
router.put('/update-status/:id', requireAdmin, async (req, res) => {
  try {
    const order = await db.order.findByPk(req.params.id);
    if (!order) {
      return res.send({ code: 404, message: '订单不存在' });
    }

    const newStatus = req.body.status;
    const allowedStatus = Object.keys(STATUS_TRANSITIONS).concat(['已取消', '已完成', '已退货']);
    if (!allowedStatus.includes(newStatus)) {
      return res.send({ code: 400, message: '订单状态不合法' });
    }

    if (newStatus === order.status) {
      return res.send({ code: 200, message: '订单状态未变化' });
    }

    // 取消：交给 cancelPendingOrder 恢复库存、优惠券与抵扣积分
    if (newStatus === '已取消') {
      return res.send(await cancelPendingOrder(order.id));
    }

    // 完成：交给 confirmReceipt 累加销量并发放收货积分
    if (newStatus === '已完成') {
      return res.send(await confirmReceipt(order.id));
    }

    // 退货完成必须走审核流程，否则库存与销量会对不上
    if (newStatus === '已退货') {
      return res.send({ code: 400, message: '退货完成请使用退货审核接口' });
    }

    const reachable = STATUS_TRANSITIONS[order.status] || [];
    if (!reachable.includes(newStatus)) {
      return res.send({
        code: 400,
        message: `订单不能从「${order.status}」变更为「${newStatus}」`
      });
    }

    const updates = { status: newStatus };
    if (newStatus === '已发货' && !order.shipTime) {
      updates.shipTime = new Date();
    }
    if (newStatus === '退货中') {
      updates.returnTime = new Date();
      updates.returnPreviousStatus = order.status;
      updates.returnReason = String(req.body.reason || '管理端发起退货').slice(0, 500);
    }

    await order.update(updates);

    res.send({ code: 200, message: '更新订单状态成功' });
  } catch (error) {
    console.error('更新订单状态失败:', error);
    res.send({ code: 500, message: '更新订单状态失败' });
  }
});

// ==================== 确认收货 ====================
router.post('/receive/:id', requireAuth, async (req, res) => {
  const result = await confirmReceipt(req.params.id, { user: req.user });
  if (result.code === 403) return forbidden(res);
  res.send(result);
});

// ==================== 申请退货 ====================
router.post('/return/:id', requireAuth, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const order = await db.order.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!order) {
      await transaction.rollback();
      return res.send({ code: 404, message: '订单不存在' });
    }
    if (!isOwner(order, req.user)) {
      await transaction.rollback();
      return forbidden(res);
    }

    const allowStatus = ['已付款', '已发货', '已完成'];
    if (!allowStatus.includes(order.status)) {
      await transaction.rollback();
      return res.send({ code: 400, message: '当前订单状态不允许退货' });
    }

    await order.update({
      status: '退货中',
      returnPreviousStatus: order.status,
      returnReason: req.body.reason,
      returnTime: new Date()
    }, { transaction });

    await transaction.commit();
    res.send({ code: 200, message: '退货申请已提交，等待管理员审核' });
  } catch (error) {
    await transaction.rollback();
    console.error('申请退货失败:', error);
    res.send({ code: 500, message: '申请退货失败' });
  }
});

// ==================== 取消订单 ====================
router.post('/cancel/:id', requireAuth, async (req, res) => {
  const result = await cancelPendingOrder(req.params.id, { user: req.user });

  if (result.code === 403) {
    return res.status(403).json(result);
  }
  res.send(result);
});

// ==================== 删除订单 ====================
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const order = await db.order.findByPk(req.params.id);
    if (!order) {
      return res.send({ code: 404, message: '订单不存在' });
    }
    if (!isOwner(order, req.user)) return forbidden(res);

    const allowDelete = ['已取消', '已完成', '已退货'];
    if (!allowDelete.includes(order.status)) {
      return res.send({ code: 400, message: '只能删除已取消、已完成或已退货的订单' });
    }

    // 软删除：用户端不可见，记录保留供后台统计与售后追溯
    await order.update({ isDeleted: true });

    res.send({ code: 200, message: '删除订单成功' });
  } catch (error) {
    console.error('删除订单失败:', error);
    res.send({ code: 500, message: '删除订单失败' });
  }
});

// ==================== 发货（管理员） ====================
router.post('/ship/:id', requireAdmin, async (req, res) => {
  try {
    const order = await db.order.findByPk(req.params.id);
    if (!order) {
      return res.send({ code: 404, message: '订单不存在' });
    }

    if (order.status !== '已付款') {
      return res.send({ code: 400, message: '只有已付款的订单才能发货' });
    }

    const { logisticsCompany, logisticsNo } = req.body;

    await order.update({
      status: '已发货',
      logisticsCompany: logisticsCompany || '',
      logisticsNo: logisticsNo || '',
      shipTime: new Date()
    });

    res.send({ code: 200, message: '发货成功' });
  } catch (error) {
    console.error('发货失败:', error);
    res.send({ code: 500, message: '发货失败' });
  }
});

// ==================== 审核退货（管理员） ====================
router.post('/approve-return/:id', requireAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const order = await db.order.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return res.send({ code: 404, message: '订单不存在' });
    }

    if (order.status !== '退货中') {
      await transaction.rollback();
      return res.send({ code: 400, message: '该订单不在退货审核状态' });
    }

    const { approved } = req.body;
    const previousStatus = order.returnPreviousStatus || '已完成';

    if (approved) {
      // 未确认收货的订单只恢复库存；已完成订单才回滚销量与收货奖励
      await rollbackOrderBenefits(order, transaction, previousStatus === '已完成');

      await order.update({ status: '已退货', returnPreviousStatus: null }, { transaction });
      await transaction.commit();

      return res.send({ code: 200, message: '退货申请已通过，库存与相关权益已回滚' });
    }

    await order.update({ status: previousStatus, returnPreviousStatus: null }, { transaction });
    await transaction.commit();

    res.send({ code: 200, message: '退货申请已拒绝' });
  } catch (error) {
    await transaction.rollback();
    console.error('审核退货失败:', error);
    res.send({ code: 500, message: '审核退货失败' });
  }
});

// ==================== 用户各状态订单数量 ====================
router.get('/count/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (req.user.role !== 'admin' && String(userId) !== String(req.user.id)) {
      return forbidden(res, '无权查看其他用户的订单统计');
    }

    // 已删除的订单不计入各状态统计
    const counts = {
      all: await db.order.count({ where: { userId, isDeleted: false } }),
      pendingPayment: await db.order.count({ where: { userId, isDeleted: false, status: '待付款' } }),
      pendingShipment: await db.order.count({ where: { userId, isDeleted: false, status: '已付款' } }),
      shipped: await db.order.count({ where: { userId, isDeleted: false, status: '已发货' } }),
      completed: await db.order.count({ where: { userId, isDeleted: false, status: '已完成' } }),
      returning: await db.order.count({ where: { userId, isDeleted: false, status: '退货中' } })
    };

    res.send({ code: 200, data: counts, message: '获取订单数量成功' });
  } catch (error) {
    console.error('获取订单数量失败:', error);
    res.send({ code: 500, message: '获取订单数量失败' });
  }
});

// ==================== 查询物流信息 ====================
router.get('/logistics/:id', requireAuth, async (req, res) => {
  try {
    const order = await db.order.findByPk(req.params.id, {
      attributes: ['id', 'orderNo', 'status', 'logisticsCompany', 'logisticsNo', 'shipTime', 'userId']
    });

    if (!order) {
      return res.send({ code: 404, message: '订单不存在' });
    }
    if (!isOwner(order, req.user)) return forbidden(res);

    if (!order.logisticsNo) {
      return res.send({ code: 400, message: '暂无物流信息' });
    }

    // 模拟物流轨迹
    const shipTime = new Date(order.shipTime);
    const now = new Date();
    const hoursSinceShip = Math.floor((now - shipTime) / (1000 * 60 * 60));

    const mockTraces = [];

    if (hoursSinceShip >= 24) {
      mockTraces.push({
        time: formatDateTime(new Date(shipTime.getTime() + 24 * 60 * 60 * 1000)),
        status: '已签收',
        desc: '您的快递已签收，感谢使用'
      });
    }

    if (hoursSinceShip >= 6) {
      mockTraces.push({
        time: formatDateTime(new Date(shipTime.getTime() + 6 * 60 * 60 * 1000)),
        status: '派送中',
        desc: '快递员正在派送，请保持电话畅通'
      });
    }

    if (hoursSinceShip >= 3) {
      mockTraces.push({
        time: formatDateTime(new Date(shipTime.getTime() + 3 * 60 * 60 * 1000)),
        status: '运输中',
        desc: '快件已到达目的地转运中心'
      });
    }

    if (hoursSinceShip >= 1) {
      mockTraces.push({
        time: formatDateTime(new Date(shipTime.getTime() + 60 * 60 * 1000)),
        status: '运输中',
        desc: '快件已从快递转运中心发出'
      });
    }

    mockTraces.push({
      time: formatDateTime(shipTime),
      status: '已揽收',
      desc: '快递员已揽收快件'
    });

    res.send({
      code: 200,
      data: {
        orderNo: order.orderNo,
        company: order.logisticsCompany,
        no: order.logisticsNo,
        traces: mockTraces
      },
      message: '获取物流信息成功'
    });
  } catch (error) {
    console.error('获取物流信息失败:', error);
    res.send({ code: 500, message: '获取物流信息失败' });
  }
});

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

module.exports = router;
