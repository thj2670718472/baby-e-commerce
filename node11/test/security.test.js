/**
 * 安全回归：角色不可由用户名推断、WS 会话隔离、改密后 WS 凭据失效、登录锁定按来源隔离
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, auth } = require('./helpers');
const { handleMessage } = require('../ws/chat');
const { hashPassword } = require('../utils/password');
const {
  recordLoginFailure,
  checkLoginLock,
  clearLoginFailures
} = require('../middleware/rateLimit');

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

function createSocket() {
  const ws = { readyState: 1, send: jest.fn() };
  return ws;
}

function sentMessages(ws) {
  return ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
}

test('公开注册配置中的管理员用户名不会自动获得管理员角色', async () => {
  const username = 'admin';
  const registered = await request(app)
    .post('/user/register')
    .send({ username, password: 'test123456' });

  expect(registered.body.code).toBe(200);
  expect(registered.body.data.role).toBe('user');

  const login = await request(app)
    .post('/user/login')
    .send({ username, password: 'test123456' });
  expect(login.body.code).toBe(200);
  expect(login.body.data.role).toBe('user');

  const forbidden = await request(app)
    .get('/reviews/list')
    .set(auth(login.body.token));
  expect(forbidden.status).toBe(403);
});

test('并发注册同一用户名只成功一次', async () => {
  const username = `u${Date.now().toString().slice(-12)}`;
  const results = await Promise.all([
    request(app).post('/user/register').send({ username, password: 'test123456' }),
    request(app).post('/user/register').send({ username, password: 'test123456' })
  ]);

  expect(results.map((item) => item.body.code).sort()).toEqual([200, 400]);
  expect(await db.user.count({ where: { username } })).toBe(1);
});

test('草稿文章不能通过公开详情接口读取，管理员仍可预览', async () => {
  const { token: adminToken } = await createUser({
    username: `draft_admin_${Date.now()}`,
    role: 'admin'
  });
  const draft = await db.baby_culture.create({
    title: '未发布草稿',
    summary: '草稿摘要',
    content: '草稿正文',
    status: 'draft'
  });

  const publicRead = await request(app).get(`/baby-culture/${draft.id}`);
  expect(publicRead.body.code).toBe(404);

  const adminRead = await request(app)
    .get(`/baby-culture/${draft.id}`)
    .set(auth(adminToken));
  expect(adminRead.body.code).toBe(200);
  expect(adminRead.body.data.title).toBe('未发布草稿');
});

test('普通用户不能向他人客服会话发消息或标记已读', async () => {
  const { user: sender } = await createUser();
  const { user: owner } = await createUser();
  const session = await db.ChatSession.create({
    userId: owner.id,
    userName: owner.username,
    status: 1
  });
  const client = { userId: sender.id, userName: sender.username, role: 'user' };

  const ws = createSocket();
  await handleMessage(
    ws,
    { type: 'send_message', sessionId: session.id, content: '越权消息' },
    () => client,
    () => {}
  );
  await handleMessage(
    ws,
    { type: 'read_messages', sessionId: session.id },
    () => client,
    () => {}
  );

  expect(sentMessages(ws).every((item) => item.type === 'error')).toBe(true);
  expect(await db.ChatMessage.count({ where: { sessionId: session.id } })).toBe(0);

  const refreshed = await db.ChatSession.findByPk(session.id);
  expect(refreshed.userUnreadCount).toBe(0);
});

test('改密后旧 token 不能重新认证 WebSocket', async () => {
  const { user, token } = await createUser();
  await user.update({ password: hashPassword('new-password-123') });

  let clientInfo = null;
  const ws = createSocket();
  await handleMessage(
    ws,
    { type: 'auth', userId: user.id, userName: user.username, role: 'user', token },
    () => clientInfo,
    (info) => { clientInfo = info; }
  );

  expect(clientInfo).toBeNull();
  expect(sentMessages(ws).some((item) => item.type === 'error')).toBe(true);
});

test('普通用户不能伪造管理员角色认证 WebSocket', async () => {
  const { user, token } = await createUser();

  let clientInfo = null;
  const ws = createSocket();
  await handleMessage(
    ws,
    { type: 'auth', userId: user.id, userName: user.username, role: 'admin', token },
    () => clientInfo,
    (info) => { clientInfo = info; }
  );

  expect(clientInfo).toBeNull();
  expect(sentMessages(ws).some((item) => item.type === 'error')).toBe(true);
});

test('登录锁定只影响触发失败的来源 IP', () => {
  const username = `locked_${Date.now()}`;
  const attackerIp = '203.0.113.10';
  const userIp = '203.0.113.11';

  for (let i = 0; i < 5; i += 1) {
    recordLoginFailure(username, attackerIp);
  }

  expect(checkLoginLock(username, attackerIp).locked).toBe(true);
  expect(checkLoginLock(username, userIp).locked).toBe(false);

  clearLoginFailures(username, attackerIp);
  clearLoginFailures(username, userIp);
});
