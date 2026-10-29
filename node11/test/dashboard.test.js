/**
 * 管理端统计：SQL 聚合结果正确、权限边界
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder, auth } = require('./helpers');

let user, token, adminToken;

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ user, token } = await createUser());
  ({ token: adminToken } = await createUser({ username: 'admin', role: 'admin' }));
});

afterAll(async () => {
  await db.sequelize.close();
});

test('普通用户访问统计接口返回 403', async () => {
  const res = await request(app).get('/dashboard/statistics').set(auth(token));
  expect(res.status).toBe(403);
});

test('销售额只统计已完成订单，各计数正确', async () => {
  const goods = await createGoods({ price: 100, quantity: 10 });
  await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 2, price: 100, status: '已完成' });
  await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 1, price: 100, status: '待付款' });

  const res = await request(app).get('/dashboard/statistics').set(auth(adminToken));
  expect(res.status).toBe(200);
  expect(res.body.totalSales).toBe(200);
  expect(res.body.totalOrders).toBe(2);
  expect(res.body.completedOrders).toBe(1);
  expect(res.body.totalUsers).toBe(2);
  expect(res.body.totalProducts).toBe(1);
  expect(res.body.productTypes).toBe(1);
});

test('小数金额正确累加', async () => {
  const goods = await createGoods({ price: 89.5, quantity: 10 });
  // 89.5 × 3 = 268.5，加上前一用例的 200，总额应带小数
  await createOrder(user.id, user.username, { goodsId: goods.id, quantity: 3, price: 89.5, status: '已完成' });

  const res = await request(app).get('/dashboard/statistics').set(auth(adminToken));
  expect(res.body.totalSales).toBe(468.5);
});

test('普通用户访问趋势接口返回 403', async () => {
  const res = await request(app).get('/dashboard/trend').set(auth(token));
  expect(res.status).toBe(403);
});

test('趋势接口返回近 7 天、按日期升序且无订单的日期补 0', async () => {
  const res = await request(app).get('/dashboard/trend').set(auth(adminToken));
  expect(res.status).toBe(200);
  expect(res.body.code).toBe(200);

  const { list, today } = res.body.data;
  expect(list).toHaveLength(7);

  const dates = list.map((item) => item.date);
  // 严格升序，且最后一天是今天
  expect([...dates].sort()).toEqual(dates);

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  expect(dates[6]).toBe(todayKey);
  expect(today.date).toBe(todayKey);

  list.forEach((item) => {
    expect(typeof item.sales).toBe('number');
    expect(typeof item.orders).toBe('number');
    expect(item.sales).toBeGreaterThanOrEqual(0);
    expect(item.label).toMatch(/^\d{2}-\d{2}$/);
  });

  // 本文件前面的用例已经产生已完成订单，今天的销售额与订单数应大于 0
  expect(today.sales).toBeGreaterThan(0);
  expect(today.orders).toBeGreaterThan(0);
});

test('趋势接口天数上限为 30 天', async () => {
  const res = await request(app).get('/dashboard/trend?days=999').set(auth(adminToken));
  expect(res.body.data.days).toBe(30);
  expect(res.body.data.list).toHaveLength(30);
});
