/**
 * 优惠券后台：模板配置、手工发放、限领、记录、作废、统计和过期任务
 */
const request = require('supertest');
const app = require('../app');
const db = require('../db/mysqldb');
const { createUser, auth } = require('./helpers');
const { expireUserCoupons } = require('../utils/couponJob');

let admin, adminToken, user, userToken, template;

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
  ({ user: admin, token: adminToken } = await createUser({ username: 'coupon_admin', role: 'admin' }));
  ({ user, token: userToken } = await createUser({ username: 'coupon_user' }));
});

afterAll(async () => {
  await db.sequelize.close();
});

test('管理员可以创建、编辑优惠券模板，普通用户无权访问后台接口', async () => {
  const forbidden = await request(app)
    .get('/coupon/admin/templates')
    .set(auth(userToken));
  expect(forbidden.status).toBe(403);

  const created = await request(app)
    .post('/coupon/admin/templates')
    .set(auth(adminToken))
    .send({
      name: '后台测试券',
      threshold: 100,
      amount: 10,
      probability: 0.5,
      totalCount: 5,
      validityDays: 7,
      perUserLimit: 1,
      description: '后台创建测试',
      status: 1
    });

  expect(created.body.code).toBe(200);
  template = created.body.data;
  expect(Number(template.amount)).toBe(10);
  expect(template.validityDays).toBe(7);
  expect(template.perUserLimit).toBe(1);

  const updated = await request(app)
    .put(`/coupon/admin/templates/${template.id}`)
    .set(auth(adminToken))
    .send({ name: '后台测试券已编辑', amount: 20, threshold: 120, probability: 0.6 });
  expect(updated.body.code).toBe(200);
  expect(updated.body.data.name).toBe('后台测试券已编辑');
  expect(Number(updated.body.data.amount)).toBe(20);
});

test('管理员可以按用户发放优惠券，重复发放受每人限领约束', async () => {
  const first = await request(app)
    .post('/coupon/admin/issue')
    .set(auth(adminToken))
    .send({ templateId: template.id, userIds: [user.id] });

  expect(first.body.code).toBe(200);
  expect(first.body.data.issuedCount).toBe(1);
  expect(first.body.data.issued[0].userId).toBe(user.id);

  const coupon = await db.UserCoupon.findOne({ where: { userId: user.id, templateId: template.id } });
  expect(coupon.source).toBe('manual');
  expect(coupon.issuedBy).toBe(admin.id);
  expect(coupon.expireTime).toBeTruthy();

  const repeat = await request(app)
    .post('/coupon/admin/issue')
    .set(auth(adminToken))
    .send({ templateId: template.id, userIds: [user.id] });
  expect(repeat.body.code).toBe(200);
  expect(repeat.body.data.issuedCount).toBe(0);
  expect(repeat.body.data.skipped[0].reason).toContain('限领');
  expect(await db.UserCoupon.count({ where: { userId: user.id, templateId: template.id } })).toBe(1);
});

test('后台发放记录、统计和作废功能可用', async () => {
  const records = await request(app)
    .get('/coupon/admin/user-coupons')
    .query({ keyword: user.username })
    .set(auth(adminToken));
  expect(records.body.code).toBe(200);
  expect(records.body.data.total).toBe(1);
  expect(records.body.data.list[0].statusText).toBe('未使用');

  const stats = await request(app)
    .get('/coupon/admin/statistics')
    .set(auth(adminToken));
  expect(stats.body.code).toBe(200);
  expect(stats.body.data.summary.totalIssued).toBe(1);
  expect(stats.body.data.summary.unusedCount).toBe(1);

  const couponId = records.body.data.list[0].id;
  const revoked = await request(app)
    .put(`/coupon/admin/user-coupons/${couponId}/revoke`)
    .set(auth(adminToken))
    .send({ reason: '测试作废' });
  expect(revoked.body.code).toBe(200);
  expect(revoked.body.data.status).toBe(4);
  expect(revoked.body.data.revokedBy).toBe(admin.id);
});

test('过期任务会把未使用且超过有效期的优惠券置为已过期', async () => {
  const expiredCoupon = await db.UserCoupon.create({
    userId: user.id,
    templateId: template.id,
    name: '过期测试券',
    threshold: 0,
    amount: 5,
    status: 1,
    source: 'manual',
    expireTime: new Date(Date.now() - 60 * 1000)
  });

  const affected = await expireUserCoupons();
  expect(affected).toBeGreaterThanOrEqual(1);
  expect((await db.UserCoupon.findByPk(expiredCoupon.id)).status).toBe(3);
});
