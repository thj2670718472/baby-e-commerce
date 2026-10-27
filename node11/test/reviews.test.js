/**
 * 评价：提交规则（必须关联真实订单）、审核流、积分奖励幂等
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder, auth } = require('./helpers');

let user, token, adminToken, goods, order;

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ user, token } = await createUser({ points: 100 }));
  ({ token: adminToken } = await createUser({ username: 'admin', role: 'admin' }));
  goods = await createGoods({ price: 50 });
  order = await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 1, price: 50, status: '已完成' });
});

afterAll(async () => {
  await db.sequelize.close();
});

test('未登录不能提交评价', async () => {
  const res = await request(app).post('/reviews/submit').send({ orderId: order.id, goodsId: goods.id, rating: 5 });
  expect(res.status).toBe(401);
});

test('评价必须关联真实订单', async () => {
  const res = await request(app).post('/reviews/submit').set(auth(token)).send({ goodsId: goods.id, rating: 5, content: '好' });
  expect(res.body.code).toBe(400);
});

test('只能评价订单里的商品', async () => {
  const otherGoods = await createGoods({ name: '没买过的商品' });
  const res = await request(app)
    .post('/reviews/submit')
    .set(auth(token))
    .send({ orderId: order.id, goodsId: otherGoods.id, rating: 5, content: '好' });
  expect(res.body.code).toBe(400);
});

test('评分必须在 1-5 之间', async () => {
  const res = await request(app)
    .post('/reviews/submit')
    .set(auth(token))
    .send({ orderId: order.id, goodsId: goods.id, rating: 6, content: '好' });
  expect(res.body.code).toBe(400);
});

test('正常提交进入待审核状态，未审核的评价不出现在商品评价列表', async () => {
  const res = await request(app)
    .post('/reviews/submit')
    .set(auth(token))
    .send({ orderId: order.id, goodsId: goods.id, rating: 5, content: '很好用' });
  expect(res.body.code).toBe(200);
  expect(res.body.data.status).toBe(0);

  const list = await request(app).get(`/reviews/goods/${goods.id}`);
  expect(Array.isArray(list.body.data)).toBe(true);
  expect(list.body.data).toHaveLength(0);
});

test('同一订单同一商品不能重复评价', async () => {
  const res = await request(app)
    .post('/reviews/submit')
    .set(auth(token))
    .send({ orderId: order.id, goodsId: goods.id, rating: 4, content: '再评一次' });
  expect(res.body.code).toBe(400);
});

test('审核通过奖励 5 积分且幂等，之后评价出现在列表中', async () => {
  const review = await db.review.findOne({ where: { orderId: order.id, goodsId: goods.id } });
  const pointsBefore = (await db.user.findByPk(user.id)).points;

  const pass = await request(app).put(`/reviews/audit/${review.id}`).set(auth(adminToken)).send({ status: 1 });
  expect(pass.body.code).toBe(200);

  const afterFirst = (await db.user.findByPk(user.id)).points;
  expect(afterFirst - pointsBefore).toBe(5);

  // 重复审核不应重复加分
  await request(app).put(`/reviews/audit/${review.id}`).set(auth(adminToken)).send({ status: 1 });
  expect((await db.user.findByPk(user.id)).points).toBe(afterFirst);

  // 审核通过后，商品评价列表里能看到这条
  const list = await request(app).get(`/reviews/goods/${goods.id}`);
  expect(list.body.data).toHaveLength(1);
  expect(list.body.data[0].content).toBe('很好用');

  // 积分流水有且只有一条
  const records = await db.pointsRecord.findAll({
    where: { userId: user.id, source: '评价', description: `评价ID:${review.id}` }
  });
  expect(records).toHaveLength(1);
});

test('并发审核同一评价只奖励一次积分', async () => {
  const { user: reviewer, token: reviewerToken } = await createUser({ points: 0 });
  const reviewGoods = await createGoods({ price: 50 });
  const reviewOrder = await createOrder(reviewer.id, reviewer.username, {
    goodsId: reviewGoods.id,
    quantity: 1,
    price: 50,
    status: '已完成'
  });
  const submitted = await request(app)
    .post('/reviews/submit')
    .set(auth(reviewerToken))
    .send({ orderId: reviewOrder.id, goodsId: reviewGoods.id, rating: 5, content: '并发审核测试' });
  expect(submitted.body.code).toBe(200);

  const results = await Promise.all([
    request(app).put(`/reviews/audit/${submitted.body.data.id}`).set(auth(adminToken)).send({ status: 1 }),
    request(app).put(`/reviews/audit/${submitted.body.data.id}`).set(auth(adminToken)).send({ status: 1 })
  ]);
  expect(results.map((item) => item.body.code)).toEqual([200, 200]);
  expect((await db.user.findByPk(reviewer.id)).points).toBe(5);
  expect(await db.pointsRecord.count({
    where: { userId: reviewer.id, source: '评价', description: `评价ID:${submitted.body.data.id}` }
  })).toBe(1);
});

test('普通用户不能审核评价', async () => {
  const res = await request(app).put('/reviews/audit/99999').set(auth(token)).send({ status: 1 });
  expect(res.status).toBe(403);
});
