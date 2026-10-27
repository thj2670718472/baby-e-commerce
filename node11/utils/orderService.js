/**
 * 订单相关的公共业务逻辑
 * 取消订单、超时释放等操作集中在这里，避免路由与定时任务各写一份
 */
const { Op } = require('sequelize');
const db = require('../db/mysqldb');

function isOwner(order, user) {
  if (!order || !user) return false;
  if (user.role === 'admin') return true;
  return String(order.userId) === String(user.id);
}

// 原子扣减库存：库存不足时返回 false，不会出现负数（普通下单与秒杀共用）
async function deductStock(goodsId, quantity, transaction) {
  const qty = Number(quantity);
  const [affected] = await db.goods.update(
    { quantity: db.sequelize.literal(`quantity - ${qty}`) },
    { where: { id: goodsId, quantity: { [Op.gte]: qty } }, transaction }
  );
  return affected > 0;
}

/**
 * 收货信息：优先用请求里带的；否则回退默认地址 / 第一个地址。
 * 返回 null 表示用户没有可用收货地址。
 */
async function resolveShipping(userId, address, phone, transaction) {
  if (address && phone) return { address, phone };
  const defaultAddress = await db.address.findOne({ where: { userId, isDefault: true }, transaction });
  const first = defaultAddress || await db.address.findOne({ where: { userId }, transaction });
  if (!first) return null;
  return {
    address: `${first.province}${first.city}${first.district}${first.detail}`,
    phone: first.phone
  };
}

/**
 * 取消待付款订单：恢复库存、恢复优惠券、退还抵扣积分
 * @param {number|string} orderId
 * @param {{ user?: object, reason?: string }} options
 */
async function cancelPendingOrder(orderId, options = {}) {
  const transaction = await db.sequelize.transaction();

  try {
    const order = await db.order.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return { code: 404, message: '订单不存在' };
    }
    if (options.user && !isOwner(order, options.user)) {
      await transaction.rollback();
      return { code: 403, message: '无权操作该订单' };
    }
    if (order.status !== '待付款') {
      await transaction.rollback();
      return { code: 400, message: '只有待付款的订单才能取消' };
    }

    // 1. 恢复优惠券
    if (order.couponId) {
      await db.UserCoupon.update(
        { status: 1, usedTime: null, orderId: null },
        { where: { id: order.couponId }, transaction }
      );
    }

    // 2. 恢复库存
    const orderGoods = await db.order_goods.findAll({
      where: { orderId: order.id },
      transaction
    });
    let totalQuantity = 0;
    for (const item of orderGoods) {
      const quantity = Number(item.quantity) || 0;
      if (quantity > 0) {
        totalQuantity += quantity;
        await db.goods.update(
          { quantity: db.sequelize.literal(`quantity + ${quantity}`) },
          { where: { id: item.goodsId }, transaction }
        );
      }
    }

    // 2.5 秒杀订单：未支付取消，秒杀库存回池（活动可能还在进行，资格应还给其他人）
    if (order.seckillGoodsId && totalQuantity > 0) {
      await db.SeckillGoods.update(
        { stock: db.sequelize.literal(`stock + ${totalQuantity}`) },
        { where: { id: order.seckillGoodsId }, transaction }
      );
    }

    // 3. 退还下单时抵扣的积分（幂等：已有退还记录则跳过）
    const usedRecord = await db.pointsRecord.findOne({
      where: {
        userId: order.userId,
        type: 'expense',
        source: '下单抵扣',
        description: `订单${order.orderNo}`
      },
      transaction
    });

    if (usedRecord && Number(usedRecord.points) > 0) {
      const refunded = await db.pointsRecord.findOne({
        where: {
          userId: order.userId,
          type: 'income',
          source: '取消退还',
          description: `订单${order.orderNo}`
        },
        transaction
      });

      if (!refunded) {
        const points = Number(usedRecord.points);
        await db.user.update(
          { points: db.sequelize.literal(`points + ${points}`) },
          { where: { id: order.userId }, transaction }
        );
        await db.pointsRecord.create({
          userId: order.userId,
          type: 'income',
          points,
          source: '取消退还',
          description: `订单${order.orderNo}`
        }, { transaction });
      }
    }

    await order.update({ status: '已取消' }, { transaction });
    await transaction.commit();

    return { code: 200, message: '订单已取消' };
  } catch (error) {
    await transaction.rollback();
    console.error('取消订单失败:', error);
    return { code: 500, message: '取消订单失败' };
  }
}

/**
 * 确认收货：用户手动确认与超时自动确认共用。
 * 事务内锁订单，重复调用只有第一次能成功，避免重复加销量和积分。
 * @param {number|string} orderId
 * @param {{ user?: object, auto?: boolean }} options
 */
async function confirmReceipt(orderId, options = {}) {
  const transaction = await db.sequelize.transaction();

  try {
    const order = await db.order.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return { code: 404, message: '订单不存在' };
    }
    if (options.user && !isOwner(order, options.user)) {
      await transaction.rollback();
      return { code: 403, message: '无权操作该订单' };
    }
    if (order.status !== '已发货') {
      await transaction.rollback();
      return { code: 400, message: '只有已发货的订单才能确认收货' };
    }

    await order.update({ status: '已完成' }, { transaction });

    // 累加销量（按购买件数）
    const orderGoods = await db.order_goods.findAll({
      where: { orderId: order.id },
      transaction
    });
    for (const item of orderGoods) {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) continue;
      await db.goods.update(
        { sales: db.sequelize.literal(`sales + ${quantity}`) },
        { where: { id: item.goodsId }, transaction }
      );
    }

    // 发放收货积分
    const totalAmount = Number(order.totalAmount);
    const points = totalAmount >= 100 ? 30 : 20;
    await db.user.update(
      { points: db.sequelize.literal(`points + ${points}`) },
      { where: { id: order.userId }, transaction }
    );
    await db.pointsRecord.create({
      userId: order.userId,
      type: 'income',
      points,
      source: '下单',
      description: `订单${order.orderNo}`
    }, { transaction });

    await transaction.commit();
    return {
      code: 200,
      message: options.auto
        ? `订单已自动确认收货，+${points}积分`
        : `确认收货成功，+${points}积分`,
      points
    };
  } catch (error) {
    await transaction.rollback();
    console.error('确认收货失败:', error);
    return { code: 500, message: '确认收货失败' };
  }
}

/**
 * 回滚订单产生的销量与奖励积分（退货通过时调用）
 */
async function rollbackOrderBenefits(order, transaction, rollbackReceivedBenefits = true) {
  const orderGoods = await db.order_goods.findAll({
    where: { orderId: order.id },
    transaction
  });

  for (const item of orderGoods) {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    // 恢复库存
    await db.goods.update(
      { quantity: db.sequelize.literal(`quantity + ${quantity}`) },
      { where: { id: item.goodsId }, transaction }
    );

    if (rollbackReceivedBenefits) {
      // 只有确认收货后才增加过销量，因此也只有这种情况需要回滚
      await db.goods.update(
        { sales: db.sequelize.literal(`GREATEST(sales - ${quantity}, 0)`) },
        { where: { id: item.goodsId }, transaction }
      );
    }
  }

  if (!rollbackReceivedBenefits) return;

  // 扣回确认收货时发放的积分
  const rewardRecord = await db.pointsRecord.findOne({
    where: {
      userId: order.userId,
      type: 'income',
      source: '下单',
      description: `订单${order.orderNo}`
    },
    transaction
  });

  if (rewardRecord && Number(rewardRecord.points) > 0) {
    const deducted = await db.pointsRecord.findOne({
      where: {
        userId: order.userId,
        type: 'expense',
        source: '退货扣回',
        description: `订单${order.orderNo}`
      },
      transaction
    });

    if (!deducted) {
      const points = Number(rewardRecord.points);
      await db.user.update(
        { points: db.sequelize.literal(`GREATEST(points - ${points}, 0)`) },
        { where: { id: order.userId }, transaction }
      );
      await db.pointsRecord.create({
        userId: order.userId,
        type: 'expense',
        points,
        source: '退货扣回',
        description: `订单${order.orderNo}`
      }, { transaction });
    }
  }
}

module.exports = {
  isOwner,
  cancelPendingOrder,
  confirmReceipt,
  rollbackOrderBenefits,
  deductStock,
  resolveShipping
};
