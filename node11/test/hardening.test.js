/**
 * 加固回归：上传校验与配额、停用账号、下架商品权限、
 * 订单状态机与下单行数上限、优惠券核销约束、WebSocket 消息约束
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, createGoods, createOrder, auth } = require('./helpers');
const { handleMessage, createMessageLimiter, MAX_CONTENT_LENGTH } = require('../ws/chat');

// 只满足文件头识别的最小 PNG（校验只看前 12 字节）
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4]);
const UPLOAD_DIR = path.join(__dirname, '../public/uploads/avatars');

const createdFiles = [];
let adminToken;

function countUploadFiles() {
  return fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;
}

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ token: adminToken } = await createUser({ role: 'admin' }));
});

afterAll(async () => {
  for (const file of createdFiles) {
    try {
      fs.unlinkSync(file);
    } catch (error) {
      // 文件已被删除时忽略
    }
  }
  delete process.env.UPLOAD_DAILY_LIMIT;
  await db.sequelize.close();
});

test('伪装成 jpg 的 HTML 文件被拒绝且不落盘', async () => {
  const { token } = await createUser();
  const before = countUploadFiles();

  const res = await request(app)
    .post('/upload/image')
    .set(auth(token))
    .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
      filename: 'evil.jpg',
      contentType: 'image/jpeg'
    });

  expect(res.body.code).toBe(400);
  expect(res.body.message).toContain('不是有效图片');
  expect(countUploadFiles()).toBe(before);
});

test('同一用户超过每日上传配额后返回 429', async () => {
  process.env.UPLOAD_DAILY_LIMIT = '1';
  try {
    const { token } = await createUser();

    const first = await request(app)
      .post('/upload/image')
      .set(auth(token))
      .attach('file', PNG_BUFFER, { filename: 'ok.png', contentType: 'image/png' });
    expect(first.body.code).toBe(200);
    if (first.body.data && first.body.data.url) {
      createdFiles.push(path.join(__dirname, '..', 'public', first.body.data.url));
    }

    const second = await request(app)
      .post('/upload/image')
      .set(auth(token))
      .attach('file', PNG_BUFFER, { filename: 'again.png', contentType: 'image/png' });
    expect(second.body.code).toBe(429);
  } finally {
    delete process.env.UPLOAD_DAILY_LIMIT;
  }
});

test('删除用户改为停用：无法登录、旧 token 失效、列表不再展示', async () => {
  const { user, token } = await createUser();

  const removed = await request(app).delete(`/user/${user.id}`).set(auth(adminToken));
  expect(removed.body.code).toBe(200);

  const login = await request(app)
    .post('/user/login')
    .send({ username: user.username, password: 'test123' });
  expect(login.body.code).toBe(401);

  const stale = await request(app).get('/orders/list').set(auth(token));
  expect(stale.status).toBe(401);

  const list = await request(app).get('/user/list').set(auth(adminToken));
  expect(list.body.data.some((item) => item.id === user.id)).toBe(false);
});

test('下架商品只允许管理员查询', async () => {
  const { token } = await createUser();
  const hidden = await db.goods.create({
    name: '下架商品',
    price: 10,
    quantity: 1,
    category: '测试分类',
    status: false,
    images: '[]'
  });

  const anonymous = await request(app).get('/goods?status=false');
  expect(anonymous.status).toBe(403);

  const normal = await request(app).get('/goods?status=false').set(auth(token));
  expect(normal.status).toBe(403);

  const admin = await request(app).get('/goods?status=false').set(auth(adminToken));
  expect(admin.status).toBe(200);
  expect(admin.body.data.some((item) => item.id === hidden.id)).toBe(true);
});

test('管理端取消待付款订单会恢复库存，非法状态流转被拒绝', async () => {
  const { user } = await createUser();
  const goods = await createGoods({ quantity: 10 });
  // 模拟下单时已扣减库存
  await goods.update({ quantity: 8 });

  const order = await createOrder(user.id, user.username, {
    goodsId: goods.id,
    quantity: 2,
    status: '待付款'
  });

  const illegal = await request(app)
    .put(`/orders/update-status/${order.id}`)
    .set(auth(adminToken))
    .send({ status: '已完成' });
  expect(illegal.body.code).toBe(400);

  const cancelled = await request(app)
    .put(`/orders/update-status/${order.id}`)
    .set(auth(adminToken))
    .send({ status: '已取消' });
  expect(cancelled.body.code).toBe(200);

  const refreshedGoods = await db.goods.findByPk(goods.id);
  expect(Number(refreshedGoods.quantity)).toBe(10);

  const refreshedOrder = await db.order.findByPk(order.id);
  expect(refreshedOrder.status).toBe('已取消');

  const backToPending = await request(app)
    .put(`/orders/update-status/${order.id}`)
    .set(auth(adminToken))
    .send({ status: '待付款' });
  expect(backToPending.body.code).toBe(400);
});

test('单笔订单商品行数超过上限时拒绝', async () => {
  const { token } = await createUser();
  const goods = Array.from({ length: 21 }, (_, index) => ({ goodsId: index + 1, quantity: 1 }));

  const res = await request(app).post('/orders/create').set(auth(token)).send({ goods });

  expect(res.body.code).toBe(400);
  expect(res.body.message).toContain('20');
});

test('优惠券核销必须关联本人订单', async () => {
  const { user, token } = await createUser();
  const template = await db.CouponTemplate.create({
    name: `测试券_${Date.now()}`,
    threshold: 0,
    amount: 10,
    probability: 0.1,
    totalCount: -1,
    validityDays: 3,
    perUserLimit: 1,
    status: 1
  });
  const coupon = await db.UserCoupon.create({
    userId: user.id,
    templateId: template.id,
    name: template.name,
    threshold: 0,
    amount: 10,
    status: 1,
    expireTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const withoutOrder = await request(app)
    .put(`/coupon/use/${coupon.id}`)
    .set(auth(token))
    .send({});

  expect(withoutOrder.body.code).toBe(400);
  const refreshed = await db.UserCoupon.findByPk(coupon.id);
  expect(Number(refreshed.status)).toBe(1);
});

test('WebSocket 拒绝超长消息且不写库', async () => {
  const { user } = await createUser();
  const session = await db.ChatSession.create({
    userId: user.id,
    userName: user.username,
    status: 1
  });
  const client = { userId: user.id, userName: user.username, role: 'user' };
  const ws = { readyState: 1, send: jest.fn() };

  await handleMessage(
    ws,
    {
      type: 'send_message',
      sessionId: session.id,
      content: 'a'.repeat(MAX_CONTENT_LENGTH + 1)
    },
    () => client,
    () => {}
  );

  const sent = ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
  expect(sent.some((item) => item.type === 'error')).toBe(true);
  expect(await db.ChatMessage.count({ where: { sessionId: session.id } })).toBe(0);
});

test('WebSocket 单连接消息频率超限后被拒绝', () => {
  const allowMessage = createMessageLimiter({ windowMs: 1000, max: 2 });

  expect(allowMessage()).toBe(true);
  expect(allowMessage()).toBe(true);
  expect(allowMessage()).toBe(false);
});
