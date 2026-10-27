/**
 * 初始化优惠券演示模板（可重复执行，按名称去重）
 * 用法：node scripts/init_coupons.js
 */
const db = require('../db/mysqldb');

const sampleTemplates = [
  {
    name: '新人满 99 减 10',
    threshold: 99,
    amount: 10,
    probability: 0.3,
    totalCount: 1000,
    validityDays: 7,
    perUserLimit: 1,
    description: '新用户抽奖券，满 99 元可用',
    status: 1
  },
  {
    name: '周末满 199 减 20',
    threshold: 199,
    amount: 20,
    probability: 0.2,
    totalCount: 500,
    validityDays: 7,
    perUserLimit: 1,
    description: '周末活动抽奖券，满 199 元可用',
    status: 1
  }
];

async function run() {
  await db.sequelize.authenticate();
  await db.sequelize.sync();

  let created = 0;
  for (const sample of sampleTemplates) {
    const existed = await db.CouponTemplate.findOne({ where: { name: sample.name } });
    if (existed) continue;
    await db.CouponTemplate.create({
      ...sample,
      usedCount: 0
    });
    created += 1;
  }

  const total = await db.CouponTemplate.count();
  console.log(`优惠券模板初始化完成，新增 ${created} 个，当前共 ${total} 个`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化优惠券模板失败:', error.message);
      process.exit(1);
    });
}

module.exports = { run, sampleTemplates };
