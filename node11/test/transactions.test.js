/**
 * 交易一致性回归：同券并发、积分上限、收货幂等、退货状态恢复、兑换取消终态
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder, auth } = require('./helpers');
const { isDiscountDay, applyDiscount, roundPrice } = require('../utils/discount');

let adminToken;

const CREATE_BODY = (goodsId, quantity, extra = {}) => ({
  goods: [{ goodsId, quantity }],
  address: '测试地址',
  phone: '13800000000',
  ...extra
});

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ token: adminToken } = await createUser({ username: 'test_admin', role: 'admin' }));
});

afterAll(async () => {
  await db.sequelize.close();
});

async function createCoupon(userId, { expired = false, templateStatus = 1 } = {}) {
  const template = await db.CouponTemplate.create({
    name: `测试券_${Date.now()}`,
    threshold: 0,
    amount: 10,
    probability: 1,
    totalCount: 10,
    usedCount: 0,
    status: templateStatus
  });
  const expireTime = new Date(Date.now() + (expired ? -60 * 1000 : 24 * 60 * 60 * 1000));
  const coupon = await db.UserCoupon.create({
    userId,
    templateId: template.id,
    name: template.name,
    threshold: 0,
    amount: 10,
    status: 1,
    expireTime
  });
  return { template, coupon };
}

test('购物车结算只删除本次已购项，并与订单同一事务提交', async () => {
  const { user, token } = await createUser();
  const goods = await createGoods({ price: 100, quantity: 10 });
  const purchased = await db.cart.create({
    userId: user.id,
    goodsId: goods.id,
    goodsName: goods.name,
    price: 100,
    quantity: 1
  });
  const untouched = await db.cart.create({
    userId: user.id,
    goodsId: goods.id,
    goodsName: goods.name,
    price: 100,
    quantity: 2
  });

  const res = await request(app).post('/orders/create').set(auth(token))
    .send(CREATE_BODY(goods.id, 1, { cartIds: [purchased.id] }));
  expect(res.body.code).toBe(200);
  expect(await db.cart.findByPk(purchased.id)).toBeNull();
  expect(await db.cart.findByPk(untouched.id)).not.toBeNull();
});

test('设为默认地址时保留用户归属并正确切换默认项', async () => {
  const { token } = await createUser();
  const first = await request(app).post('/address').set(auth(token)).send({
    name: '张三', phone: '13800000001', province: '浙江省', city: '杭州市',
    district: '西湖区', detail: '1号', isDefault: true
  });
  const second = await request(app).post('/address').set(auth(token)).send({
    name: '李四', phone: '13800000002', province: '浙江省', city: '杭州市',
    district: '西湖区', detail: '2号', isDefault: false
  });

  const changed = await request(app)
    .put(`/address/${second.body.data.id}`)
    .set(auth(token))
    .send({
      name: '李四', phone: '13800000002', province: '浙江省', city: '杭州市',
      district: '西湖区', detail: '2号', isDefault: true
    });

  expect(changed.body.code).toBe(200);
  expect((await db.address.findByPk(first.body.data.id)).isDefault).toBe(false);
  const updated = await db.address.findByPk(second.body.data.id);
  expect(updated.isDefault).toBe(true);
  expect(updated.userId).toBe(second.body.data.userId);
});

test('同一张优惠券并发只能核销一次', async () => {
  const { user, token } = await createUser();
  const { coupon } = await createCoupon(user.id);
  const goodsA = await createGoods({ price: 100, quantity: 5 });
  const goodsB = await createGoods({ price: 100, quantity: 5 });

  const results = await Promise.all([
    request(app).post('/orders/create').set(auth(token))
      .send(CREATE_BODY(goodsA.id, 1, { couponId: coupon.id })),
    request(app).post('/orders/create').set(auth(token))
      .send(CREATE_BODY(goodsB.id, 1, { couponId: coupon.id }))
  ]);

  expect(results.map((item) => item.body.code).sort()).toEqual([200, 400]);
  const refreshed = await db.UserCoupon.findByPk(coupon.id);
  expect(refreshed.status).toBe(2);
  expect(await db.order.count({ where: { couponId: coupon.id } })).toBe(1);
});

test('过期优惠券和停用模板券都不能使用', async () => {
  const { user, token } = await createUser();
  const goods = await createGoods({ quantity: 5 });
  const expired = await createCoupon(user.id, { expired: true });
  const disabled = await createCoupon(user.id, { templateStatus: 0 });

  const expiredRes = await request(app).post('/orders/create').set(auth(token))
    .send(CREATE_BODY(goods.id, 1, { couponId: expired.coupon.id }));
  const disabledRes = await request(app).post('/orders/create').set(auth(token))
    .send(CREATE_BODY(goods.id, 1, { couponId: disabled.coupon.id }));

  expect(expiredRes.body.code).toBe(400);
  expect(disabledRes.body.code).toBe(400);
});

test('积分最多抵扣应付金额的 50%，且不能与优惠券同用', async () => {
  const { user, token } = await createUser({ points: 1000 });
  const goods = await createGoods({ price: 100, quantity: 5 });
  const { coupon } = await createCoupon(user.id);

  const res = await request(app).post('/orders/create').set(auth(token))
    .send(CREATE_BODY(goods.id, 1, { usePoints: 1000 }));
  expect(res.body.code).toBe(200);

  const unitPrice = applyDiscount(100, isDiscountDay());
  const maxPoints = Math.floor(unitPrice * 0.5 * 10);
  expect(Number(res.body.data.totalAmount)).toBe(roundPrice(unitPrice - maxPoints / 10));
  expect((await db.user.findByPk(user.id)).points).toBe(1000 - maxPoints);

  const mixed = await request(app).post('/orders/create').set(auth(token))
    .send(CREATE_BODY(goods.id, 1, { couponId: coupon.id, usePoints: 1 }));
  expect(mixed.body.code).toBe(400);
});

test('并发确认收货只增加一次销量和积分', async () => {
  const { user, token } = await createUser();
  const goods = await createGoods({ price: 100, quantity: 10, sales: 0 });
  const order = await createOrder(user.id, user.username, {
    goodsId: goods.id,
    quantity: 2,
    price: 100,
    status: '已发货'
  });

  const results = await Promise.all([
    request(app).post(`/orders/receive/${order.id}`).set(auth(token)),
    request(app).post(`/orders/receive/${order.id}`).set(auth(token))
  ]);

  expect(results.map((item) => item.body.code).sort()).toEqual([200, 400]);
  expect((await db.goods.findByPk(goods.id)).sales).toBe(2);
  expect((await db.user.findByPk(user.id)).points).toBe(30);
  expect(await db.pointsRecord.count({
    where: { userId: user.id, source: '下单', description: `订单${order.orderNo}` }
  })).toBe(1);
});

test('已付款订单退货被拒后恢复“已付款”，退货通过不扣历史销量', async () => {
  const { user, token } = await createUser();
  const rejectGoods = await createGoods({ price: 100, quantity: 10, sales: 0 });
  const rejected = await createOrder(user.id, user.username, {
    goodsId: rejectGoods.id,
    quantity: 1,
    price: 100,
    status: '已付款'
  });

  await request(app).post(`/orders/return/${rejected.id}`).set(auth(token)).send({ reason: '测试' });
  await request(app).post(`/orders/approve-return/${rejected.id}`).set(auth(adminToken)).send({ approved: false });
  expect((await db.order.findByPk(rejected.id)).status).toBe('已付款');

  const approveGoods = await createGoods({ price: 100, quantity: 10, sales: 5 });
  const approved = await createOrder(user.id, user.username, {
    goodsId: approveGoods.id,
    quantity: 2,
    price: 100,
    status: '已付款'
  });

  await request(app).post(`/orders/return/${approved.id}`).set(auth(token)).send({ reason: '测试' });
  await request(app).post(`/orders/approve-return/${approved.id}`).set(auth(adminToken)).send({ approved: true });

  const goodsAfter = await db.goods.findByPk(approveGoods.id);
  expect(goodsAfter.sales).toBe(5);
  expect(goodsAfter.quantity).toBe(12);
});

test('同一用户同一周并发抽券只成功一次', async () => {
  const { user, token } = await createUser();
  await db.CouponTemplate.update({ status: 0 }, { where: { status: 1 } });
  const template = await db.CouponTemplate.create({
    name: `周抽奖_${Date.now()}`,
    threshold: 0,
    amount: 10,
    probability: 1,
    totalCount: 10,
    usedCount: 0,
    status: 1
  });

  const results = await Promise.all([
    request(app).post('/coupon/draw').set(auth(token)),
    request(app).post('/coupon/draw').set(auth(token))
  ]);
  expect(results.map((item) => item.body.code).sort()).toEqual([200, 400]);
  expect(await db.UserCoupon.count({ where: { userId: user.id } })).toBe(1);
  expect(await db.UserDrawRecord.count({ where: { userId: user.id } })).toBe(1);
  expect((await db.CouponTemplate.findByPk(template.id)).usedCount).toBe(1);
});

test('没有收货地址时积分兑换失败且不扣积分库存', async () => {
  const { user, token } = await createUser({ points: 500 });
  const product = await db.pointsGoods.create({
    name: '无地址测试商品',
    points: 100,
    stock: 3,
    status: true
  });

  const res = await request(app).post('/points/exchange').set(auth(token)).send({
    pointsGoodsId: product.id,
    quantity: 1
  });
  expect(res.body.code).toBe(400);
  expect((await db.user.findByPk(user.id)).points).toBe(500);
  expect((await db.pointsGoods.findByPk(product.id)).stock).toBe(3);
  expect(await db.pointsExchange.count({ where: { userId: user.id } })).toBe(0);
});

test('积分兑换取消是终态：并发取消只退款一次，不能再改回待发货', async () => {
  const { user, token } = await createUser({ points: 500 });
  const product = await db.pointsGoods.create({
    name: '积分测试商品',
    points: 100,
    stock: 5,
    status: true
  });

  const exchanged = await request(app).post('/points/exchange').set(auth(token)).send({
    pointsGoodsId: product.id,
    quantity: 1,
    address: '测试地址',
    phone: '13800000000'
  });
  expect(exchanged.body.code).toBe(200);
  const exchangeId = exchanged.body.data.id;

  const results = await Promise.all([
    request(app).put(`/points/exchange/${exchangeId}/status`).set(auth(adminToken)).send({ status: '已取消' }),
    request(app).put(`/points/exchange/${exchangeId}/status`).set(auth(adminToken)).send({ status: '已取消' })
  ]);
  expect(results.map((item) => item.body.code)).toEqual([200, 200]);

  const reopen = await request(app)
    .put(`/points/exchange/${exchangeId}/status`)
    .set(auth(adminToken))
    .send({ status: '待发货' });
  expect(reopen.body.code).toBe(400);

  expect((await db.user.findByPk(user.id)).points).toBe(500);
  expect((await db.pointsGoods.findByPk(product.id)).stock).toBe(5);
  expect(await db.pointsRecord.count({
    where: { userId: user.id, source: '兑换取消退还', description: `兑换单${exchangeId}` }
  })).toBe(1);
});
