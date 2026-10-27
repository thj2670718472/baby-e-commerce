/**
 * 客服头像：会话快照应与用户最新资料同步，后台列表不能展示过期空头像
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, auth } = require('./helpers');

let user, token, adminToken;
const avatar = '/uploads/avatars/chat-test-avatar.png';

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ user, token } = await createUser());
  ({ token: adminToken } = await createUser({ username: 'chat_admin', role: 'admin' }));
  await user.update({ avatar });
});

afterAll(async () => {
  await db.sequelize.close();
});

test('打开客服会话时同步用户最新头像', async () => {
  const existing = await db.ChatSession.create({
    userId: user.id,
    userName: user.username,
    userAvatar: '',
    status: 1
  });

  const res = await request(app)
    .post('/chat/session/get')
    .set(auth(token))
    .send({});
  expect(res.body.code).toBe(200);
  expect(res.body.data.id).toBe(existing.id);
  expect(res.body.data.userAvatar).toBe(avatar);
  expect((await db.ChatSession.findByPk(existing.id)).userAvatar).toBe(avatar);
});

test('后台会话列表使用用户表最新头像覆盖空快照', async () => {
  await db.ChatSession.update(
    { userAvatar: '' },
    { where: { userId: user.id, status: 1 } }
  );

  const res = await request(app)
    .get('/chat/admin/sessions')
    .set(auth(adminToken));
  expect(res.body.code).toBe(200);

  const session = res.body.data.find((item) => item.userId === user.id);
  expect(session).toBeTruthy();
  expect(session.userAvatar).toBe(avatar);
  expect(session.userName).toBe(user.username);
});
