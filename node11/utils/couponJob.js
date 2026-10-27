/**
 * 优惠券过期任务
 * 将已超过有效期但仍为“未使用”的券统一置为“已过期”，避免状态只在用户访问时更新。
 */
const { Op } = require('sequelize');
const db = require('../db/mysqldb');

const SCAN_INTERVAL = 60 * 60 * 1000;

async function expireUserCoupons() {
  const [affected] = await db.UserCoupon.update(
    { status: 3 },
    {
      where: {
        status: 1,
        expireTime: { [Op.lt]: new Date() }
      }
    }
  );
  return affected;
}

function startCouponExpiryJob() {
  expireUserCoupons().catch((error) => {
    console.error('[优惠券过期] 启动检查失败:', error.message);
  });

  const timer = setInterval(() => {
    expireUserCoupons().catch((error) => {
      console.error('[优惠券过期] 检查失败:', error.message);
    });
  }, SCAN_INTERVAL);

  timer.unref();
  return timer;
}

module.exports = { startCouponExpiryJob, expireUserCoupons };
