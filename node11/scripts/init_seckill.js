/**
 * 初始化秒杀演示数据：没有进行中的场次就滚动建一个，并挂上 2-3 个商品（可重复执行）
 * 用法：node scripts/init_seckill.js
 */
const db = require('../db/mysqldb');
const { roundPrice } = require('../utils/discount');

function firstImage(images) {
  if (!images) return '';
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

async function run() {
  await db.sequelize.authenticate();
  await db.sequelize.sync();

  const now = Date.now();
  const sessions = await db.SeckillSession.findAll({ where: { status: true } });
  let session = sessions.find(
    (s) => now >= new Date(s.startTime).getTime() && now <= new Date(s.endTime).getTime()
  );

  if (!session) {
    session = await db.SeckillSession.create({
      name: '今日限时秒杀',
      startTime: new Date(now - 60 * 60 * 1000),
      endTime: new Date(now + 8 * 60 * 60 * 1000),
      status: true
    });
    console.log('已创建进行中的场次:', session.name);
  } else {
    console.log('已存在进行中的场次:', session.name);
  }

  const existing = await db.SeckillGoods.count({ where: { sessionId: session.id } });
  if (existing > 0) {
    console.log(`场次下已有 ${existing} 个秒杀商品，跳过挂载`);
    return;
  }

  const goodsList = await db.goods.findAll({ where: { status: true }, limit: 3 });
  if (goodsList.length === 0) {
    console.warn('商品表为空，请先执行 npm run init-db 灌入商品再跑本脚本');
    return;
  }

  for (const g of goodsList) {
    await db.SeckillGoods.create({
      sessionId: session.id,
      goodsId: g.id,
      goodsName: g.name,
      goodsImage: firstImage(g.images),
      seckillPrice: roundPrice(Number(g.price) * 0.7),
      originalPrice: Number(g.price),
      stock: 10,
      maxPerUser: 1,
      sort: 0
    });
  }
  console.log(`已为场次挂上 ${goodsList.length} 个秒杀商品（7 折、库存 10、每人限购 1）`);
}

// 支持直接运行，也被 init-db 复用
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化秒杀数据失败:', error.message);
      process.exit(1);
    });
}

module.exports = { run };
