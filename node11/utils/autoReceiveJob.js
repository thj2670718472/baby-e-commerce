/**
 * 发货后保底自动确认收货
 * 超过 AUTO_CONFIRM_DAYS 天仍未手动确认的已发货订单，自动完成并发货奖励。
 */
const { Op } = require('sequelize');
const db = require('../db/mysqldb');
const { confirmReceipt } = require('./orderService');

const AUTO_CONFIRM_DAYS = Math.max(1, parseInt(process.env.AUTO_CONFIRM_DAYS, 10) || 7);
const SCAN_INTERVAL = 60 * 60 * 1000;
const BATCH_SIZE = 100;

async function autoConfirmShippedOrders() {
  const deadline = new Date(Date.now() - AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000);
  const orders = await db.order.findAll({
    where: {
      status: '已发货',
      shipTime: { [Op.lt]: deadline }
    },
    attributes: ['id'],
    order: [['shipTime', 'ASC']],
    limit: BATCH_SIZE,
    raw: true
  });

  let confirmed = 0;
  for (const item of orders) {
    const result = await confirmReceipt(item.id, { auto: true });
    if (result.code === 200) {
      confirmed += 1;
      console.log(`[自动收货] 订单 ${item.id} 发货已超过 ${AUTO_CONFIRM_DAYS} 天，已自动完成`);
    } else if (result.code >= 500) {
      console.error(`[自动收货] 订单 ${item.id} 自动确认失败: ${result.message}`);
    }
  }

  return { scanned: orders.length, confirmed };
}

function startAutoReceiveJob() {
  autoConfirmShippedOrders().catch((error) => {
    console.error('[自动收货] 启动检查失败:', error.message);
  });

  const timer = setInterval(() => {
    autoConfirmShippedOrders().catch((error) => {
      console.error('[自动收货] 检查失败:', error.message);
    });
  }, SCAN_INTERVAL);

  timer.unref();
  return timer;
}

module.exports = {
  startAutoReceiveJob,
  autoConfirmShippedOrders,
  AUTO_CONFIRM_DAYS
};
