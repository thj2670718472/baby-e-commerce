/**
 * 发货后保底自动确认收货
 */
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder } = require('./helpers');
const { autoConfirmShippedOrders, AUTO_CONFIRM_DAYS } = require('../utils/autoReceiveJob');

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

test('发货超过保底天数后自动确认收货，重复扫描不会重复加销量和积分', async () => {
  const { user } = await createUser({ points: 0 });
  const goods = await createGoods({ price: 100, quantity: 10, sales: 0 });
  const order = await createOrder(user.id, user.username, {
    status: '已发货',
    goodsId: goods.id,
    quantity: 2,
    price: 100
  });
  const shippedAt = new Date(Date.now() - (AUTO_CONFIRM_DAYS + 1) * 24 * 60 * 60 * 1000);
  await order.update({ shipTime: shippedAt });

  const first = await autoConfirmShippedOrders();
  expect(first.confirmed).toBeGreaterThanOrEqual(1);

  const refreshedOrder = await db.order.findByPk(order.id);
  expect(refreshedOrder.status).toBe('已完成');
  expect((await db.goods.findByPk(goods.id)).sales).toBe(2);
  expect((await db.user.findByPk(user.id)).points).toBe(30);
  expect(await db.pointsRecord.count({
    where: {
      userId: user.id,
      type: 'income',
      source: '下单',
      description: `订单${order.orderNo}`
    }
  })).toBe(1);

  const second = await autoConfirmShippedOrders();
  expect(second.confirmed).toBe(0);
  expect((await db.goods.findByPk(goods.id)).sales).toBe(2);
  expect((await db.user.findByPk(user.id)).points).toBe(30);
});

test('未到保底天数、退货中和未发货订单不会被自动完成', async () => {
  const { user } = await createUser();
  const goods = await createGoods({ quantity: 10, sales: 0 });

  const recent = await createOrder(user.id, user.username, {
    status: '已发货',
    goodsId: goods.id,
    quantity: 1
  });
  await recent.update({ shipTime: new Date(Date.now() - 24 * 60 * 60 * 1000) });

  const returning = await createOrder(user.id, user.username, {
    status: '退货中',
    goodsId: goods.id,
    quantity: 1
  });
  await returning.update({
    shipTime: new Date(Date.now() - (AUTO_CONFIRM_DAYS + 2) * 24 * 60 * 60 * 1000)
  });

  const unpaid = await createOrder(user.id, user.username, {
    status: '待付款',
    goodsId: goods.id,
    quantity: 1
  });

  await autoConfirmShippedOrders();

  expect((await db.order.findByPk(recent.id)).status).toBe('已发货');
  expect((await db.order.findByPk(returning.id)).status).toBe('退货中');
  expect((await db.order.findByPk(unpaid.id)).status).toBe('待付款');
  expect((await db.goods.findByPk(goods.id)).sales).toBe(0);
});
