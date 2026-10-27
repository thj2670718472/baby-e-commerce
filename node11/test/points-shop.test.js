/**
 * 积分商城商品：管理员可调整名称、图片、积分、库存、排序和上下架状态
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, auth } = require('./helpers');

let adminToken, userToken;

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ token: adminToken } = await createUser({ username: 'points_admin', role: 'admin' }));
  ({ token: userToken } = await createUser());
});

afterAll(async () => {
  await db.sequelize.close();
});

test('管理员可以新增带图片的积分商品，普通用户不能新增', async () => {
  const forbidden = await request(app)
    .post('/points/shop')
    .set(auth(userToken))
    .send({ name: '越权商品', points: 100 });
  expect(forbidden.status).toBe(403);

  const created = await request(app)
    .post('/points/shop')
    .set(auth(adminToken))
    .send({
      name: '积分商品测试',
      image: '/uploads/points/test.jpg',
      description: '测试描述',
      detail: '完整商品详情',
      shippingNote: '48小时内发货',
      rules: '每人限兑，不支持无理由退换',
      redeemLimit: 2,
      points: 1000,
      stock: 12,
      sort: 66,
      status: true
    });
  expect(created.body.code).toBe(200);
  expect(created.body.data.image).toBe('/uploads/points/test.jpg');
  expect(created.body.data.detail).toBe('完整商品详情');
  expect(created.body.data.shippingNote).toBe('48小时内发货');
  expect(created.body.data.rules).toBe('每人限兑，不支持无理由退换');
  expect(created.body.data.redeemLimit).toBe(2);
  expect(created.body.data.points).toBe(1000);
  expect(created.body.data.stock).toBe(12);
  expect(created.body.data.sort).toBe(66);
});

test('管理员可以调整商品名称、图片、积分、库存和上下架状态', async () => {
  const product = await db.pointsGoods.findOne({ where: { name: '积分商品测试' } });
  const updated = await request(app)
    .put(`/points/shop/${product.id}`)
    .set(auth(adminToken))
    .send({
      name: '积分商品已调整',
      image: '/uploads/points/updated.jpg',
      detail: '调整后的详细介绍',
      shippingNote: '72小时内发货',
      rules: '调整后的兑换规则',
      redeemLimit: 1,
      points: 1800,
      stock: 7,
      sort: 88,
      status: false
    });

  expect(updated.body.code).toBe(200);
  const refreshed = await db.pointsGoods.findByPk(product.id);
  expect(refreshed.name).toBe('积分商品已调整');
  expect(refreshed.image).toBe('/uploads/points/updated.jpg');
  expect(refreshed.detail).toBe('调整后的详细介绍');
  expect(refreshed.shippingNote).toBe('72小时内发货');
  expect(refreshed.rules).toBe('调整后的兑换规则');
  expect(refreshed.redeemLimit).toBe(1);
  expect(refreshed.points).toBe(1800);
  expect(refreshed.stock).toBe(7);
  expect(refreshed.sort).toBe(88);
  expect(refreshed.status).toBe(false);
});

test('用户端只看到上架商品，管理端可看到全部', async () => {
  const publicList = await request(app).get('/points/shop');
  expect(publicList.body.code).toBe(200);
  expect(publicList.body.data.some((item) => item.name === '积分商品已调整')).toBe(false);

  const adminList = await request(app)
    .get('/points/shop?status=all')
    .set(auth(adminToken));
  expect(adminList.body.code).toBe(200);
  expect(adminList.body.data.some((item) => item.name === '积分商品已调整')).toBe(true);
});

test('商品详情接口返回完整介绍和规则，下架商品仅管理员可预览', async () => {
  const product = await db.pointsGoods.findOne({ where: { name: '积分商品已调整' } });

  const publicDetail = await request(app).get(`/points/shop/${product.id}`);
  expect(publicDetail.body.code).toBe(404);

  const adminDetail = await request(app)
    .get(`/points/shop/${product.id}`)
    .set(auth(adminToken));
  expect(adminDetail.body.code).toBe(200);
  expect(adminDetail.body.data.detail).toBe('调整后的详细介绍');
  expect(adminDetail.body.data.rules).toBe('调整后的兑换规则');
  expect(adminDetail.body.data.shippingNote).toBe('72小时内发货');
  expect(adminDetail.body.data.redeemLimit).toBe(1);
});

test('兑换接口强制执行每人限兑数量', async () => {
  const { user, token } = await createUser({ points: 2000 });
  const created = await request(app)
    .post('/points/shop')
    .set(auth(adminToken))
    .send({
      name: '限兑测试商品',
      points: 100,
      stock: 5,
      redeemLimit: 2,
      rules: '每人限兑 2 件',
      status: true
    });
  expect(created.body.code).toBe(200);
  const productId = created.body.data.id;

  await request(app)
    .post('/address')
    .set(auth(token))
    .send({
      name: '测试用户',
      phone: '13800000000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '测试路 1 号',
      isDefault: true
    });

  const overLimit = await request(app)
    .post('/points/exchange')
    .set(auth(token))
    .send({ pointsGoodsId: productId, quantity: 3 });
  expect(overLimit.body.code).toBe(400);
  expect(overLimit.body.message).toContain('限兑');

  const first = await request(app)
    .post('/points/exchange')
    .set(auth(token))
    .send({ pointsGoodsId: productId, quantity: 2 });
  expect(first.body.code).toBe(200);

  const second = await request(app)
    .post('/points/exchange')
    .set(auth(token))
    .send({ pointsGoodsId: productId, quantity: 1 });
  expect(second.body.code).toBe(400);
  expect(second.body.message).toContain('限兑');

  const detail = await request(app)
    .get(`/points/shop/${productId}`)
    .set(auth(token));
  expect(detail.body.code).toBe(200);
  expect(detail.body.data.userRedeemed).toBe(2);
  expect(detail.body.data.userRemaining).toBe(0);
  expect((await db.pointsGoods.findByPk(productId)).stock).toBe(3);
  expect((await db.user.findByPk(user.id)).points).toBe(1800);
});
