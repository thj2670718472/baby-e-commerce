/**
 * 秒杀：场次时间边界、限购、原子扣库存、并发不超卖、超时取消回补秒杀库存
 * 注意：抢购接口按用户限流（10 秒 5 次），所以每个用例用独立的新用户抢购，互不串配额
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, auth } = require('./helpers');

let adminToken;

const MIN = 60 * 1000;

/** 建一个场次：默认进行中（开始于 1 分钟前，1 小时后结束） */
async function createSession({ startOffset = -MIN, endOffset = 60 * MIN, status = true, name = '测试场次' } = {}) {
  const now = Date.now();
  return db.SeckillSession.create({
    name,
    startTime: new Date(now + startOffset),
    endTime: new Date(now + endOffset),
    status
  });
}

/** 场次下挂一个秒杀商品，同时建一个对应的上架商品 */
async function createSeckillGoods(sessionId, { price = 100, seckillPrice = 60, stock = 10, goodsStock = 50, maxPerUser = 1 } = {}) {
  const g = await createGoods({ price, quantity: goodsStock });
  return db.SeckillGoods.create({
    sessionId,
    goodsId: g.id,
    goodsName: g.name,
    goodsImage: '',
    seckillPrice,
    originalPrice: price,
    stock,
    maxPerUser,
    sort: 0
  });
}

const buy = (t, body) => request(app).post('/seckill/buy').set(auth(t)).send(body);
const BUY_BODY = { quantity: 1, address: '测试地址', phone: '13800000000' };

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ token: adminToken } = await createUser({ username: 'admin', role: 'admin' }));
});

afterAll(async () => {
  await db.sequelize.close();
});

test('未登录不能抢购', async () => {
  const res = await request(app).post('/seckill/buy').send({ seckillGoodsId: 1, quantity: 1 });
  expect(res.status).toBe(401);
});

test('未开始的场次不能抢', async () => {
  const { token } = await createUser();
  const session = await createSession({ startOffset: 60 * MIN, endOffset: 2 * 60 * MIN });
  const sg = await createSeckillGoods(session.id);
  const res = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(res.body.code).toBe(400);
  expect(res.body.message).toContain('尚未开始');
});

test('已结束的场次不能抢', async () => {
  const { token } = await createUser();
  const session = await createSession({ startOffset: -2 * 60 * MIN, endOffset: -MIN });
  const sg = await createSeckillGoods(session.id);
  const res = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(res.body.code).toBe(400);
  expect(res.body.message).toContain('已结束');
});

test('抢购成功：按秒杀价下单，秒杀库存与商品库存各扣一件', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { price: 100, seckillPrice: 60, stock: 10, goodsStock: 50 });

  const res = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(res.body.code).toBe(200);
  expect(res.body.data.status).toBe('待付款');
  expect(Number(res.body.data.totalAmount)).toBe(60);
  expect(res.body.data.seckillGoodsId).toBe(sg.id);
  expect(String(res.body.data.orderNo)).toMatch(/^SEC/);
  // 秒杀已省金额随订单返回
  expect(Number(res.body.data.discountAmount)).toBe(40);

  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(9);
  expect((await db.goods.findByPk(sg.goodsId)).quantity).toBe(49);
});

test('秒杀库存不足：提示抢完且库存不变', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 1, goodsStock: 50 });

  const first = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(first.body.code).toBe(200);

  const other = await createUser();
  const second = await buy(other.token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(second.body.code).toBe(400);
  expect(second.body.message).toContain('抢完');
  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(0);
  expect((await db.goods.findByPk(sg.goodsId)).quantity).toBe(49);
});

test('每人限购：同一用户超买被拒，其他用户不受影响', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 10, maxPerUser: 1 });

  const first = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(first.body.code).toBe(200);

  // 同一用户第二次抢，撞限购（这是该用户的第 2 次请求，还没触发频控）
  const again = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(again.body.code).toBe(400);
  expect(again.body.message).toContain('限购');

  const other = await createUser();
  const ok = await buy(other.token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(ok.body.code).toBe(200);
});

test('单次购买数量不能超过限购数', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 10, maxPerUser: 2 });
  const res = await buy(token, { seckillGoodsId: sg.id, quantity: 3, address: '测试地址', phone: '13800000000' });
  expect(res.body.code).toBe(400);
});

test('限购按商品件数累计，软删除历史订单不能重置资格', async () => {
  const { user, token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 10, maxPerUser: 2 });

  const first = await buy(token, { seckillGoodsId: sg.id, quantity: 2, address: '测试地址', phone: '13800000000' });
  expect(first.body.code).toBe(200);

  const second = await buy(token, { seckillGoodsId: sg.id, quantity: 1, address: '测试地址', phone: '13800000000' });
  expect(second.body.code).toBe(400);
  expect(second.body.message).toContain('限购');

  await db.order.update(
    { status: '已完成', isDeleted: true },
    { where: { id: first.body.data.id, userId: user.id } }
  );

  const third = await buy(token, { seckillGoodsId: sg.id, quantity: 1, address: '测试地址', phone: '13800000000' });
  expect(third.body.code).toBe(400);
  expect(third.body.message).toContain('限购');
});

test('秒杀商品在活动期间下架后不能继续购买', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 10, goodsStock: 50 });
  await db.goods.update({ status: false }, { where: { id: sg.goodsId } });

  const res = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(res.body.code).toBe(400);
  expect(res.body.message).toContain('已下架');
  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(10);
});

test('未支付订单超时取消后，秒杀库存回池', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 10, goodsStock: 50 });

  const res = await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY });
  expect(res.body.code).toBe(200);
  const orderId = res.body.data.id;
  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(9);

  // 拨到超时线之前，手动触发释放任务
  await db.order.update({ orderTime: new Date(Date.now() - 20 * MIN) }, { where: { id: orderId } });
  const { releaseExpiredOrders } = require('../utils/orderJob');
  await releaseExpiredOrders();

  expect((await db.order.findByPk(orderId)).status).toBe('已取消');
  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(10);
  expect((await db.goods.findByPk(sg.goodsId)).quantity).toBe(50);
});

test('并发抢购不超卖：库存 5 时 20 人并发只有 5 人成功', async () => {
  // 20 个独立用户，各自只抢 1 次（不触频控、不触限购），专注测库存原子性
  const users = await Promise.all(Array.from({ length: 20 }, () => createUser()));
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 5, goodsStock: 100, maxPerUser: 20 });

  const results = await Promise.all(
    users.map((u) => buy(u.token, { seckillGoodsId: sg.id, ...BUY_BODY }))
  );
  const success = results.filter((r) => r.body.code === 200).length;
  expect(success).toBe(5);
  expect((await db.SeckillGoods.findByPk(sg.id)).stock).toBe(0);
  expect((await db.goods.findByPk(sg.goodsId)).quantity).toBe(95);
});

test('抢购接口有频控：同一用户 10 秒内第 6 次起返回 429', async () => {
  const { token } = await createUser();
  const session = await createSession();
  const sg = await createSeckillGoods(session.id, { stock: 100, goodsStock: 1000, maxPerUser: 100 });

  const results = [];
  for (let i = 0; i < 7; i++) {
    results.push(await buy(token, { seckillGoodsId: sg.id, ...BUY_BODY }));
  }
  expect(results.slice(0, 5).every((r) => r.body.code === 200)).toBe(true);
  expect(results[5].status).toBe(429);
  expect(results[6].status).toBe(429);
});

test('普通用户不能管理秒杀场次', async () => {
  const { token } = await createUser();
  const res = await request(app)
    .post('/seckill/session')
    .set(auth(token))
    .send({ name: 'x', startTime: new Date(), endTime: new Date(Date.now() + 60000) });
  expect(res.status).toBe(403);
});

test('管理端：秒杀价必须低于原价、库存不能超过商品库存', async () => {
  const session = await createSession();
  const goods = await createGoods({ price: 100, quantity: 20 });

  const badPrice = await request(app).post('/seckill/goods').set(auth(adminToken)).send({
    sessionId: session.id, goodsId: goods.id, seckillPrice: 100, stock: 5
  });
  expect(badPrice.body.code).toBe(400);

  const badStock = await request(app).post('/seckill/goods').set(auth(adminToken)).send({
    sessionId: session.id, goodsId: goods.id, seckillPrice: 60, stock: 21
  });
  expect(badStock.body.code).toBe(400);

  const ok = await request(app).post('/seckill/goods').set(auth(adminToken)).send({
    sessionId: session.id, goodsId: goods.id, seckillPrice: 60, stock: 5, maxPerUser: 1
  });
  expect(ok.body.code).toBe(200);
});

test('公开场次列表带状态与商品，进行中场次可见', async () => {
  const res = await request(app).get('/seckill/sessions');
  expect(res.body.code).toBe(200);
  const active = res.body.data.find((s) => s.status === '进行中');
  expect(active).toBeTruthy();
  expect(active.goods.length).toBeGreaterThan(0);
  expect(active.goods[0].seckillPrice).toBeDefined();
});
