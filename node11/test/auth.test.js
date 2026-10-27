/**
 * 认证与权限：401/403 边界、登录接口、改密码后旧 token 失效（ver 指纹机制）
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, auth } = require('./helpers');

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

test('无 token 访问受保护接口返回 401', async () => {
  const res = await request(app).get('/orders/list');
  expect(res.status).toBe(401);
});

test('伪造 token 返回 401', async () => {
  const res = await request(app).get('/orders/list').set(auth('not.a.real.token'));
  expect(res.status).toBe(401);
});

test('普通用户访问管理员接口返回 403', async () => {
  const res = await request(app).get('/reviews/list').set(auth(token));
  expect(res.status).toBe(403);
});

test('管理员访问管理员接口返回 200', async () => {
  const res = await request(app).get('/reviews/list').set(auth(adminToken));
  expect(res.status).toBe(200);
  expect(res.body.code).toBe(200);
});

test('登录成功返回 token，且不泄露密码字段', async () => {
  const res = await request(app).post('/user/login').send({ username: user.username, password: 'test123' });
  expect(res.body.code).toBe(200);
  expect(res.body.token).toBeTruthy();
  expect(res.body.data.username).toBe(user.username);
  expect(res.body.data.password).toBeUndefined();
});

test('密码错误返回 401 并提示剩余尝试次数', async () => {
  const res = await request(app).post('/user/login').send({ username: user.username, password: 'wrong!' });
  expect(res.body.code).toBe(401);
  expect(res.body.message).toContain('还可尝试');
});

test('不存在的用户登录返回 401', async () => {
  const res = await request(app).post('/user/login').send({ username: 'ghost_user', password: 'whatever' });
  expect(res.body.code).toBe(401);
});

test('改密码后旧 token 失效，新密码可登录', async () => {
  const { user: u, token: oldToken } = await createUser();

  const changed = await request(app)
    .post('/user/change-password')
    .set(auth(oldToken))
    .send({ username: u.username, oldPassword: 'test123', newPassword: 'newpass456' });
  expect(changed.body.code).toBe(200);

  // token 里的 ver 指纹与改后的密码对不上，旧 token 自动失效
  const stale = await request(app).get('/orders/list').set(auth(oldToken));
  expect(stale.status).toBe(401);

  // 新密码可登录，旧密码被拒绝
  const relogin = await request(app).post('/user/login').send({ username: u.username, password: 'newpass456' });
  expect(relogin.body.code).toBe(200);
  const oldLogin = await request(app).post('/user/login').send({ username: u.username, password: 'test123' });
  expect(oldLogin.body.code).toBe(401);
});
