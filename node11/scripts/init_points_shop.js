/**
 * 初始化积分商城商品（可重复执行，已有数据时跳过）
 * 用法：node scripts/init_points_shop.js
 */
const db = require('../db/mysqldb');

const sampleGoods = [
  {
    name: '婴儿手口湿巾 80 抽',
    description: '纯水配方，无香精无酒精，出门随手带',
    detail: '80 抽大容量装，采用纯水配方，不含酒精、香精和荧光剂。加厚珍珠纹无纺布，柔韧不易破，适合宝宝手口、餐具和玩具日常清洁。',
    image: '/uploads/points/wipes.jpg',
    points: 500,
    stock: 100,
    redeemLimit: 2,
    shippingNote: '兑换成功后 48 小时内发货，节假日顺延。',
    rules: '每人限兑 2 件；积分兑换商品不支持无理由退换，质量问题请联系客服。',
    status: true,
    sort: 100
  },
  {
    name: '宝宝纯棉口水巾 3 条装',
    description: 'A 类棉，柔软吸水，长牙期必备',
    detail: '三条装口水巾，精选 A 类纯棉面料，亲肤柔软、吸水快干。按扣式设计可调节松紧，适合长牙期和辅食期使用。',
    image: '/uploads/points/bibs.jpg',
    points: 800,
    stock: 50,
    redeemLimit: 2,
    shippingNote: '兑换成功后 48 小时内发货，节假日顺延。',
    rules: '每人限兑 2 件；颜色随机发货；积分兑换商品不支持无理由退换。',
    status: true,
    sort: 90
  },
  {
    name: '食品级硅胶软勺 2 支',
    description: '辅食期适用，不伤牙龈，可高温消毒',
    detail: '两支装食品级硅胶软勺，圆润勺头不伤宝宝牙龈，短柄设计方便抓握。可耐受高温消毒，适合辅食初期使用。',
    image: '/uploads/points/spoons.jpg',
    points: 1200,
    stock: 30,
    redeemLimit: 2,
    shippingNote: '兑换成功后 48 小时内发货，节假日顺延。',
    rules: '每人限兑 2 件；请在使用前清洁消毒；积分兑换商品不支持无理由退换。',
    status: true,
    sort: 80
  },
  {
    name: '婴儿洗护旅行装',
    description: '洗发沐浴二合一 + 润肤乳小样，出游便携',
    detail: '旅行装包含洗发沐浴二合一和润肤乳小样，搭配便携洗漱包。温和配方，适合宝宝日常清洁与保湿，出行携带方便。',
    image: '/uploads/points/wash-set.jpg',
    points: 2000,
    stock: 20,
    redeemLimit: 1,
    shippingNote: '兑换成功后 72 小时内发货，节假日顺延。',
    rules: '每人限兑 1 件；使用前请先做局部皮肤测试；积分兑换商品不支持无理由退换。',
    status: true,
    sort: 70
  },
  {
    name: '亲子启蒙绘本 1 本',
    description: '硬页撕不烂，适合 0-3 岁亲子共读',
    detail: '厚页圆角硬纸板书，画面色彩柔和，内容适合 0-3 岁宝宝认知启蒙。耐翻撕，适合亲子共读和宝宝自主翻阅。',
    image: '/uploads/points/picture-book.jpg',
    points: 1500,
    stock: 15,
    redeemLimit: 1,
    shippingNote: '兑换成功后 72 小时内发货，节假日顺延。',
    rules: '每人限兑 1 件；绘本主题随机发货；积分兑换商品不支持无理由退换。',
    status: true,
    sort: 60
  },
  {
    name: '儿童保温吸管杯',
    description: '316 不锈钢内胆，重力球吸管，防漏设计',
    detail: '316 不锈钢内胆保温吸管杯，配重力球吸管和双手柄，方便宝宝自主饮水。杯盖防漏设计，适合居家和外出使用。',
    image: '/uploads/points/straw-cup.jpg',
    points: 5000,
    stock: 10,
    redeemLimit: 1,
    shippingNote: '兑换成功后 72 小时内发货，节假日顺延。',
    rules: '每人限兑 1 件；颜色随机发货；使用前请检查杯体和吸管；积分兑换商品不支持无理由退换。',
    status: true,
    sort: 50
  }
];

async function run() {
  await db.sequelize.authenticate();
  // 新表需要先同步出来，否则下面查询会报表不存在
  await db.sequelize.sync();

  const count = await db.pointsGoods.count();
  if (count > 0) {
    // 已有商品不覆盖运营调整，只补齐历史数据缺失的图片和详情内容
    let filled = 0;
    for (const sample of sampleGoods) {
      const product = await db.pointsGoods.findOne({ where: { name: sample.name } });
      if (!product) continue;

      const updates = {};
      for (const field of ['image', 'detail', 'shippingNote', 'rules']) {
        if (!product[field] && sample[field]) updates[field] = sample[field];
      }
      if (Object.keys(updates).length > 0) {
        await product.update(updates);
        filled += 1;
      }
    }
    console.log(`积分商城中已有 ${count} 个商品，跳过新增；补齐详情/图片 ${filled} 个`);
    return;
  }

  const created = await db.pointsGoods.bulkCreate(sampleGoods);
  console.log(`初始化完成，新增 ${created.length} 个积分商品`);
}

// 支持直接运行，也被 init-db 复用
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化积分商城失败:', error.message);
      process.exit(1);
    });
}

module.exports = { run, sampleGoods };
