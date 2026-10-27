/**
 * 待付款订单超时释放
 * 下单即锁定库存，超过 15 分钟未支付则自动取消并回滚库存、优惠券、积分
 */
const { Op } = require('sequelize');
const db = require('../db/mysqldb');
const { cancelPendingOrder } = require('./orderService');

const TIMEOUT_MINUTES = Number(process.env.ORDER_TIMEOUT_MINUTES) || 15;
const SCAN_INTERVAL = 60 * 1000;

async function releaseExpiredOrders() {
  const deadline = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  const expired = await db.order.findAll({
    where: {
      status: '待付款',
      orderTime: { [Op.lt]: deadline }
    },
    attributes: ['id'],
    limit: 50,
    raw: true
  });

  for (const item of expired) {
    const result = await cancelPendingOrder(item.id);
    if (result.code === 200) {
      console.log(`[订单超时] 订单 ${item.id} 超过 ${TIMEOUT_MINUTES} 分钟未支付，已自动取消`);
    }
  }

  return expired.length;
}

function startOrderTimeoutJob() {
  // 启动时先执行一次，处理服务停止期间过期的订单
  releaseExpiredOrders().catch((error) => {
    console.error('[订单超时] 启动检查失败:', error.message);
  });

  const timer = setInterval(() => {
    releaseExpiredOrders().catch((error) => {
      console.error('[订单超时] 检查失败:', error.message);
    });
  }, SCAN_INTERVAL);

  // 不阻止进程退出
  timer.unref();
  return timer;
}

module.exports = { startOrderTimeoutJob, releaseExpiredOrders, TIMEOUT_MINUTES };
