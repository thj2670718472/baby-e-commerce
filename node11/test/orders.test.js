/**
 * 订单核心链路：下单扣库存 → 支付流转 → 发货 → 收货加积分 → 退货回滚
 * 覆盖超时自动取消与并发不超卖
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder, auth } = require('./helpers');
const { isDiscountDay, applyDiscount, roundPrice } = require('../utils/discount');

let user, token, adminToken;

const CREATE_BODY = (goodsId, quantity) => ({
  goods: [{ goodsId, quantity }],
  address: '测试地址',
  phone: '13800000000'
});

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ user, token } = await createUser({ points: 1000 }));
  ({ token: adminToken } = await createUser({ username: 'admin', role: 'admin' }));
});

afterAll(async () => {
  await db.sequelize.close();
});

test('未登录不能下单', async () => {
  const goods = await createGoods();
  const res = await request(app).post('/orders/create').send(CREATE_BODY(goods.id, 1));
  expect(res.status).toBe(401);
});

test('下单成功：状态待付款、按实付记账、扣减库存', async () => {
  const goods = await createGoods({ price: 100, quantity: 10 });
  const res = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 2));
  expect(res.body.code).toBe(200);
  expect(res.body.data.status).toBe('待付款');
  // 期望值跟随统一折扣规则，避免周一活动日导致日期相关失败
  const expectedTotal = roundPrice(applyDiscount(100, isDiscountDay()) * 2);
  expect(Number(res.body.data.totalAmount)).toBe(expectedTotal);
  expect(Number(res.body.data.originalAmount)).toBe(200);
  expect((await db.goods.findByPk(goods.id)).quantity).toBe(8);
});

test('库存不足时拒绝下单且库存不变', async () => {
  const goods = await createGoods({ quantity: 3 });
  const res = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 999));
  expect(res.body.code).toBe(400);
  expect((await db.goods.findByPk(goods.id)).quantity).toBe(3);
  // 失败的请求不应留下订单
  const count = await db.order.count({ where: { userId: user.id } });
  expect(count).toBe(1); // 只有上一个成功用例的订单
});

test('购买数量必须为正整数', async () => {
  const goods = await createGoods();
  for (const bad of [0, -1, 1.5, 'abc']) {
    const res = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, bad));
    expect(res.body.code).toBe(400);
  }
});

test('已下架商品不能购买', async () => {
  const goods = await createGoods({ quantity: 5 });
  await goods.update({ status: false });
  const res = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 1));
  expect(res.body.code).toBe(400);
});

test('支付：待付款→已付款，重复支付被拒', async () => {
  const goods = await createGoods({ quantity: 5 });
  const order = await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 1, price: 50 });
  const res = await request(app).post(`/orders/pay/${order.id}`).set(auth(token));
  expect(res.body.code).toBe(200);
  expect((await db.order.findByPk(order.id)).status).toBe('已付款');

  const again = await request(app).post(`/orders/pay/${order.id}`).set(auth(token));
  expect(again.body.code).toBe(400);
});

test('不能支付别人的订单', async () => {
  const other = await createUser();
  const goods = await createGoods({ quantity: 5 });
  const order = await createOrder(other.user.id, other.user.username, { goodsId: goods.id, quantity: 1, price: 50 });
  const res = await request(app).post(`/orders/pay/${order.id}`).set(auth(token));
  expect(res.status).toBe(403);
});

test('确认收货：状态流转、销量累加、按实付金额加积分', async () => {
  const goods = await createGoods({ price: 100, quantity: 10, sales: 0 });
  const order = await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 2, price: 100, status: '已发货' });
  const pointsBefore = (await db.user.findByPk(user.id)).points;

  const res = await request(app).post(`/orders/receive/${order.id}`).set(auth(token));
  expect(res.body.code).toBe(200);

  expect((await db.order.findByPk(order.id)).status).toBe('已完成');
  expect((await db.goods.findByPk(goods.id)).sales).toBe(2);
  // totalAmount = 200 ≥ 100 → 奖励 30 积分
  const pointsAfter = (await db.user.findByPk(user.id)).points;
  expect(pointsAfter - pointsBefore).toBe(30);
  // 积分流水已记录
  const record = await db.pointsRecord.findOne({ where: { userId: user.id, source: '下单', type: 'income' } });
  expect(record).not.toBeNull();
});

test('只有已发货的订单能确认收货', async () => {
  const order = await createOrder(user.id, user.username, { status: '待付款' });
  const res = await request(app).post(`/orders/receive/${order.id}`).set(auth(token));
  expect(res.body.code).toBe(400);
});

test('超时未付款订单自动取消并回滚库存', async () => {
  const goods = await createGoods({ quantity: 10 });
  const order = await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 3, price: 100 });
  // 模拟下单时已扣掉的库存（3 件 → 7）
  await db.goods.update({ quantity: 7 }, { where: { id: goods.id } });
  // 把下单时间拨到超时线之前
  await db.order.update({ orderTime: new Date(Date.now() - 20 * 60 * 1000) }, { where: { id: order.id } });

  const { releaseExpiredOrders } = require('../utils/orderJob');
  const released = await releaseExpiredOrders();
  expect(released).toBeGreaterThanOrEqual(1);

  expect((await db.order.findByPk(order.id)).status).toBe('已取消');
  expect((await db.goods.findByPk(goods.id)).quantity).toBe(10);
});

test('并发下单不超卖：库存 5 时 10 个并发只有 5 个成功', async () => {
  const goods = await createGoods({ quantity: 5 });
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 1))
    )
  );
  const success = results.filter((r) => r.body.code === 200).length;
  expect(success).toBe(5);
  expect((await db.goods.findByPk(goods.id)).quantity).toBe(0);
});

test('退货审核通过：库存恢复、销量回滚、奖励积分扣回', async () => {
  const goods = await createGoods({ price: 100, quantity: 10, sales: 0 });

  // 完整走一遍：下单 → 支付 → 发货 → 收货（销量+2、积分+30）→ 申请退货 → 审核通过
  const created = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 2));
  const orderId = created.body.data.id;
  await request(app).post(`/orders/pay/${orderId}`).set(auth(token));
  await request(app).post(`/orders/ship/${orderId}`).set(auth(adminToken)).send({ logisticsCompany: '测试快递', logisticsNo: 'SF001' });
  const pointsBefore = (await db.user.findByPk(user.id)).points;
  await request(app).post(`/orders/receive/${orderId}`).set(auth(token));
  await request(app).post(`/orders/return/${orderId}`).set(auth(token)).send({ reason: '不想要了' });

  const approved = await request(app).post(`/orders/approve-return/${orderId}`).set(auth(adminToken)).send({ approved: true });
  expect(approved.body.code).toBe(200);

  const g = await db.goods.findByPk(goods.id);
  expect(g.quantity).toBe(10);
  expect(g.sales).toBe(0);
  // 收货 +30、退货扣回 -30，用户积分净变化为 0
  const pointsAfter = (await db.user.findByPk(user.id)).points;
  expect(pointsAfter).toBe(pointsBefore);
  // 两笔积分流水都要存在，证明发和扣都真的发生过
  const income = await db.pointsRecord.findOne({ where: { userId: user.id, type: 'income', source: '下单', description: `订单${(await db.order.findByPk(orderId)).orderNo}` } });
  const expense = await db.pointsRecord.findOne({ where: { userId: user.id, type: 'expense', source: '退货扣回', description: `订单${(await db.order.findByPk(orderId)).orderNo}` } });
  expect(income).not.toBeNull();
  expect(expense).not.toBeNull();
  // 状态流转为已退货
  expect((await db.order.findByPk(orderId)).status).toBe('已退货');
});

test('订单列表：传 page 返回分页结构并支持状态过滤，不传保持数组', async () => {
  // 用独立用户，让订单数量可控
  const { user: u, token: t } = await createUser();
  for (let i = 0; i < 3; i++) {
    await createOrder(u.id, u.username, { status: '待付款', price: 10 + i });
  }
  await createOrder(u.id, u.username, { status: '已完成', price: 50 });

  const paged = await request(app).get('/orders/list?page=1&pageSize=2').set(auth(t));
  expect(paged.body.code).toBe(200);
  expect(paged.body.data.list).toHaveLength(2);
  expect(paged.body.data.total).toBe(4);
  expect(paged.body.data.totalPages).toBe(2);

  const filtered = await request(app).get('/orders/list?page=1&pageSize=10&status=待付款').set(auth(t));
  expect(filtered.body.data.total).toBe(3);
  filtered.body.data.list.forEach((o) => expect(o.status).toBe('待付款'));

  const legacy = await request(app).get('/orders/list').set(auth(t));
  expect(Array.isArray(legacy.body.data)).toBe(true);
  expect(legacy.body.data).toHaveLength(4);
});

test('管理员能按 userId 查指定用户的订单', async () => {
  const res = await request(app).get(`/orders/list?userId=${user.id}&page=1&pageSize=5`).set(auth(adminToken));
  expect(res.body.code).toBe(200);
  res.body.data.list.forEach((o) => expect(Number(o.userId)).toBe(Number(user.id)));
});

test('支持小数价格商品，DECIMAL 金额不被截断', async () => {
  const { isDiscountDay, applyDiscount, roundPrice } = require('../utils/discount');
  const goods = await createGoods({ price: 89.5, quantity: 10 });
  const res = await request(app).post('/orders/create').set(auth(token)).send(CREATE_BODY(goods.id, 2));
  expect(res.body.code).toBe(200);
  // 期望值用同一份折扣规则推导：非打折日 89.5×2=179；打折日按 0.7 折后两位小数
  const unit = applyDiscount(89.5, isDiscountDay());
  expect(Number(res.body.data.totalAmount)).toBe(roundPrice(unit * 2));
  expect(Number((await db.goods.findByPk(goods.id)).price)).toBe(89.5);
});

test('只能删除已取消、已完成或已退货的订单', async () => {
  const order = await createOrder(user.id, user.username, { status: '待付款' });
  const res = await request(app).delete(`/orders/${order.id}`).set(auth(token));
  expect(res.body.code).toBe(400);
  expect((await db.order.findByPk(order.id)).isDeleted).toBe(false);
});

test('删除是软删除：用户不可见，管理员 includeDeleted=1 可见', async () => {
  const order = await createOrder(user.id, user.username, { status: '已完成' });

  const del = await request(app).delete(`/orders/${order.id}`).set(auth(token));
  expect(del.body.code).toBe(200);

  // 用户的列表和详情里都不再出现
  const list = await request(app).get('/orders/list?page=1&pageSize=50').set(auth(token));
  expect(list.body.data.list.some((o) => o.id === order.id)).toBe(false);
  const detail = await request(app).get(`/orders/detail/${order.id}`).set(auth(token));
  expect(detail.body.code).toBe(404);

  // 管理员带 includeDeleted=1 仍能看到，记录保留在库里
  const adminView = await request(app).get('/orders/list?page=1&pageSize=50&includeDeleted=1').set(auth(adminToken));
  expect(adminView.body.data.list.some((o) => o.id === order.id)).toBe(true);
  expect((await db.order.findByPk(order.id)).isDeleted).toBe(true);
});
