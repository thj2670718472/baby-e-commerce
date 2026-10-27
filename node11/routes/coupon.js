var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { Op } = require('sequelize');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { expireUserCoupons } = require('../utils/couponJob');

function canAccess(req, userId) {
  return req.user && (req.user.role === 'admin' || String(req.user.id) === String(userId));
}

function forbidden(res, message) {
  return res.status(403).json({ code: 403, message: message || '无权操作该优惠券' });
}

const COUPON_STATUS_TEXT = {
  1: '未使用',
  2: '已使用',
  3: '已过期',
  4: '已作废'
};

function parseTemplateInput(body = {}, existing = {}) {
  const pick = (key, fallback) => body[key] !== undefined ? body[key] : fallback;
  const name = String(pick('name', existing.name) || '').trim().slice(0, 100);
  const threshold = Number(pick('threshold', existing.threshold));
  const amount = Number(pick('amount', existing.amount));
  const probability = Number(pick('probability', existing.probability));
  const totalCount = Number(pick('totalCount', existing.totalCount === undefined ? -1 : existing.totalCount));
  const validityDays = Number(pick('validityDays', existing.validityDays === undefined ? 3 : existing.validityDays));
  const perUserLimit = Number(pick('perUserLimit', existing.perUserLimit === undefined ? 1 : existing.perUserLimit));
  const description = String(pick('description', existing.description || '')).trim().slice(0, 255);
  const rawStatus = pick('status', existing.status === undefined ? 1 : existing.status);
  const status = rawStatus === false || rawStatus === 0 || rawStatus === '0' || rawStatus === 'false' ? 0 : 1;

  if (!name) throw new Error('优惠券名称不能为空');
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error('使用门槛必须大于等于 0');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('优惠金额必须大于 0');
  if (threshold > 0 && amount > threshold) throw new Error('优惠金额不能超过使用门槛');
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new Error('抽取概率必须大于 0 且不超过 1');
  }
  if (!Number.isInteger(totalCount) || totalCount < -1) {
    throw new Error('发放总量必须为 -1（不限）或大于等于 0 的整数');
  }
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) {
    throw new Error('有效天数必须为 1-365 的整数');
  }
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1 || perUserLimit > 100) {
    throw new Error('每人限领数量必须为 1-100 的整数');
  }

  return {
    name,
    threshold,
    amount,
    probability: Math.round(probability * 100) / 100,
    totalCount,
    validityDays,
    perUserLimit,
    description,
    status
  };
}

async function assertProbabilityBudget(db, probability, status, excludeId) {
  if (!status) return;
  const where = { status: 1 };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const activeTemplates = await db.CouponTemplate.findAll({
    where,
    attributes: ['probability']
  });
  const total = activeTemplates.reduce((sum, item) => sum + Number(item.probability || 0), Number(probability));
  if (total > 1.0001) {
    throw new Error('所有启用模板的抽取概率总和不能超过 1');
  }
}

function buildCouponExpireTime(validityDays) {
  const expireTime = new Date();
  expireTime.setDate(expireTime.getDate() + Number(validityDays || 3));
  expireTime.setHours(23, 59, 59, 999);
  return expireTime;
}

async function getTemplateStatsMap(templateIds) {
  const statsMap = new Map();
  for (const id of templateIds) {
    statsMap.set(Number(id), {
      issuedCount: 0,
      unusedCount: 0,
      redeemedCount: 0,
      expiredCount: 0,
      revokedCount: 0,
      discountAmount: 0
    });
  }
  if (!templateIds.length) return statsMap;

  const rows = await db.UserCoupon.findAll({
    where: { templateId: { [Op.in]: templateIds } },
    attributes: ['templateId', 'status', 'amount']
  });

  for (const row of rows) {
    const key = Number(row.templateId);
    const stats = statsMap.get(key);
    if (!stats) continue;
    stats.issuedCount += 1;
    if (Number(row.status) === 1) stats.unusedCount += 1;
    if (Number(row.status) === 2) {
      stats.redeemedCount += 1;
      stats.discountAmount += Number(row.amount) || 0;
    }
    if (Number(row.status) === 3) stats.expiredCount += 1;
    if (Number(row.status) === 4) stats.revokedCount += 1;
  }

  return statsMap;
}

// 获取当前周数
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// 检查用户本周是否已抽取
async function hasUserDrawnThisWeek(userId, transaction) {
  const now = new Date();
  const yearNumber = now.getFullYear();
  const weekNumber = getWeekNumber(now);

  const record = await db.UserDrawRecord.findOne({
    where: { userId, yearNumber, weekNumber },
    transaction
  });

  return !!record;
}

// 获取可用优惠券模板（抽取用，公开信息）
router.get('/templates', async (req, res) => {
  try {
    const templates = await db.CouponTemplate.findAll({
      where: { status: 1 },
      attributes: ['id', 'name', 'threshold', 'amount', 'probability']
    });
    res.json({ code: 200, data: templates });
  } catch (error) {
    console.error('获取优惠券模板失败:', error);
    res.json({ code: 500, message: '获取优惠券模板失败' });
  }
});

// 检查用户本周是否已抽取
router.get('/check/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const hasDrawn = await hasUserDrawnThisWeek(req.params.userId);
    res.json({ code: 200, data: { hasDrawn } });
  } catch (error) {
    console.error('检查抽取状态失败:', error);
    res.json({ code: 500, message: '检查失败' });
  }
});

// 抽取优惠券
router.post('/draw', requireAuth, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    // 归属用户只能来自登录态；锁用户行，避免抽奖与后台发放并发绕过限领
    const userId = req.user.id;
    await db.user.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const hasDrawn = await hasUserDrawnThisWeek(userId, transaction);
    if (hasDrawn) {
      await transaction.rollback();
      return res.json({ code: 400, message: '本周已经抽取过了，下周再来吧' });
    }

    const templates = await db.CouponTemplate.findAll({ where: { status: 1 }, transaction });
    if (templates.length === 0) {
      await transaction.rollback();
      return res.json({ code: 400, message: '暂无可用优惠券' });
    }

    // 根据概率抽取
    const random = Math.random();
    let selectedTemplate = null;
    let cumulativeProbability = 0;

    for (const template of templates) {
      cumulativeProbability += template.probability;
      if (random < cumulativeProbability) {
        selectedTemplate = template;
        break;
      }
    }
    if (!selectedTemplate) selectedTemplate = templates[0];

    // 原子扣减库存，避免并发超发
    const stockWhere = { id: selectedTemplate.id };
    if (Number(selectedTemplate.totalCount) !== -1) {
      stockWhere.usedCount = { [Op.lt]: selectedTemplate.totalCount };
    }

    const [affected] = await db.CouponTemplate.update(
      { usedCount: db.sequelize.literal('usedCount + 1') },
      { where: stockWhere, transaction }
    );

    if (!affected) {
      await transaction.rollback();
      return res.json({ code: 400, message: '优惠券已被抢光' });
    }

    // 有效期跟随模板配置
    const expireTime = buildCouponExpireTime(selectedTemplate.validityDays);

    const userCoupon = await db.UserCoupon.create({
      userId,
      templateId: selectedTemplate.id,
      name: selectedTemplate.name,
      threshold: selectedTemplate.threshold,
      amount: selectedTemplate.amount,
      status: 1,
      source: 'draw',
      expireTime
    }, { transaction });

    await db.CouponDrawRecord.create({
      userId,
      templateId: selectedTemplate.id,
      couponName: selectedTemplate.name,
      threshold: selectedTemplate.threshold,
      amount: selectedTemplate.amount,
      source: 'draw'
    }, { transaction });

    // 记录本周已抽取
    const now = new Date();
    await db.UserDrawRecord.create({
      userId,
      drawDate: now,
      yearNumber: now.getFullYear(),
      weekNumber: getWeekNumber(now)
    }, { transaction });

    await transaction.commit();

    res.json({
      code: 200,
      data: userCoupon,
      message: `恭喜你得到了${selectedTemplate.name}优惠券，有效期3天，赶紧去使用吧`
    });
  } catch (error) {
    await transaction.rollback();
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return res.json({ code: 400, message: '本周已经抽取过了，下周再来吧' });
    }
    console.error('抽取优惠券失败:', error);
    res.json({ code: 500, message: '抽取失败' });
  }
});

// 获取用户优惠券列表
router.get('/list/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const { userId } = req.params;
    const { status } = req.query;

    let where = { userId };
    if (status) where.status = parseInt(status);

    // 自动更新过期优惠券状态
    const now = new Date();
    await db.UserCoupon.update(
      { status: 3 },
      { where: { userId, status: 1, expireTime: { [Op.lt]: now } } }
    );

    const coupons = await db.UserCoupon.findAll({
      where,
      order: [['createTime', 'DESC']]
    });

    res.json({ code: 200, data: coupons });
  } catch (error) {
    console.error('获取优惠券列表失败:', error);
    res.json({ code: 500, message: '获取优惠券列表失败' });
  }
});

// 获取用户可用优惠券（下单时使用）
router.get('/available/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const { userId } = req.params;
    const { amount } = req.query;

    const now = new Date();

    // 自动更新过期优惠券状态
    await db.UserCoupon.update(
      { status: 3 },
      { where: { userId, status: 1, expireTime: { [Op.lt]: now } } }
    );

    const coupons = await db.UserCoupon.findAll({
      where: {
        userId,
        status: 1,
        threshold: { [Op.lte]: amount || 0 },
        expireTime: { [Op.gt]: now }
      },
      include: [{
        model: db.CouponTemplate,
        attributes: ['status'],
        where: { status: 1 },
        required: true
      }],
      order: [['amount', 'DESC']]
    });

    res.json({ code: 200, data: coupons });
  } catch (error) {
    console.error('获取可用优惠券失败:', error);
    res.json({ code: 500, message: '获取可用优惠券失败' });
  }
});

// 获取抽取记录
router.get('/records/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const records = await db.CouponDrawRecord.findAll({
      where: { userId: req.params.userId },
      order: [['createTime', 'DESC']],
      limit: 20
    });
    res.json({ code: 200, data: records });
  } catch (error) {
    console.error('获取抽取记录失败:', error);
    res.json({ code: 500, message: '获取抽取记录失败' });
  }
});

// 使用优惠券（下单流程已自动核销，此处保留手动核销）
router.put('/use/:id', requireAuth, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { orderId } = req.body;
    const coupon = await db.UserCoupon.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
      include: [{
        model: db.CouponTemplate,
        where: { status: 1 },
        required: true
      }]
    });
    if (!coupon) {
      await transaction.rollback();
      return res.json({ code: 404, message: '优惠券不存在或已停用' });
    }
    if (!canAccess(req, coupon.userId)) {
      await transaction.rollback();
      return forbidden(res);
    }

    const now = new Date();
    if (coupon.status !== 1) {
      await transaction.rollback();
      return res.json({ code: 400, message: '优惠券不可用' });
    }
    if (coupon.expireTime && new Date(coupon.expireTime) <= now) {
      await coupon.update({ status: 3 }, { transaction });
      await transaction.commit();
      return res.json({ code: 400, message: '优惠券已过期' });
    }

    // 必须关联一笔本人真实订单：否则用户可凭空把券置为已使用，运营数据会失真
    const targetOrderId = Number(orderId);
    if (!Number.isInteger(targetOrderId) || targetOrderId <= 0) {
      await transaction.rollback();
      return res.json({ code: 400, message: '必须关联一笔有效订单才能核销' });
    }

    const order = await db.order.findByPk(targetOrderId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!order || String(order.userId) !== String(coupon.userId)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '订单信息不匹配' });
    }
    if (!['待付款', '已付款', '已发货', '已完成'].includes(order.status)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '当前订单状态不允许核销优惠券' });
    }
    if (order.couponId && Number(order.couponId) !== Number(coupon.id)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '该订单已使用其他优惠券' });
    }

    // 用「实付 + 券已抵扣」还原券前金额，与下单时的门槛口径保持一致
    const orderAmount = Number(order.totalAmount || 0) + Number(order.couponAmount || 0);
    if (orderAmount < Number(coupon.threshold || 0)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '订单金额不满足优惠券使用门槛' });
    }

    await coupon.update({ status: 2, usedTime: now, orderId: targetOrderId }, { transaction });
    await transaction.commit();
    res.json({ code: 200, message: '优惠券已使用' });
  } catch (error) {
    await transaction.rollback();
    console.error('使用优惠券失败:', error);
    res.json({ code: 500, message: '使用优惠券失败' });
  }
});

// 获取用户优惠券数量
router.get('/count/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const now = new Date();

    await db.UserCoupon.update(
      { status: 3 },
      { where: { userId: req.params.userId, status: 1, expireTime: { [Op.lt]: now } } }
    );

    const count = await db.UserCoupon.count({
      where: { userId: req.params.userId, status: 1, expireTime: { [Op.gt]: now } }
    });

    res.json({ code: 200, data: { count } });
  } catch (error) {
    console.error('获取优惠券数量失败:', error);
    res.json({ code: 500, message: '获取优惠券数量失败' });
  }
});

// 获取用户本周是否已抽取
router.get('/week-status/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) return forbidden(res);

    const hasDrawn = await hasUserDrawnThisWeek(req.params.userId);
    res.json({ code: 200, data: { hasDrawn } });
  } catch (error) {
    console.error('获取周状态失败:', error);
    res.json({ code: 500, message: '获取失败' });
  }
});

// ==================== 管理员运营接口 ====================

// 模板列表：包含发放、核销、过期和作废统计
router.get('/admin/templates', requireAdmin, async (req, res) => {
  try {
    await expireUserCoupons();
    const templates = await db.CouponTemplate.findAll({
      order: [['status', 'DESC'], ['createTime', 'DESC'], ['id', 'DESC']]
    });
    const statsMap = await getTemplateStatsMap(templates.map((item) => item.id));

    const list = templates.map((template) => {
      const data = template.toJSON();
      const stats = statsMap.get(Number(template.id)) || {};
      const issuedCount = stats.issuedCount || 0;
      return {
        ...data,
        ...stats,
        issuedCount,
        remainingCount: Number(data.totalCount) === -1
          ? -1
          : Math.max(0, Number(data.totalCount) - issuedCount)
      };
    });

    res.json({ code: 200, data: list, message: '获取优惠券模板成功' });
  } catch (error) {
    console.error('获取优惠券模板失败:', error);
    res.json({ code: 500, message: '获取优惠券模板失败' });
  }
});

// 新增模板
router.post('/admin/templates', requireAdmin, async (req, res) => {
  try {
    const data = parseTemplateInput(req.body || {});
    const duplicated = await db.CouponTemplate.findOne({ where: { name: data.name } });
    if (duplicated) {
      return res.json({ code: 400, message: '已存在同名优惠券，请换一个名称' });
    }
    await assertProbabilityBudget(db, data.probability, data.status);

    const created = await db.CouponTemplate.create({
      ...data,
      usedCount: 0
    });
    res.json({ code: 200, data: created, message: '优惠券模板创建成功' });
  } catch (error) {
    if (error && error.message) {
      return res.json({ code: 400, message: error.message });
    }
    console.error('新增优惠券模板失败:', error);
    res.json({ code: 500, message: '新增优惠券模板失败' });
  }
});

// 编辑模板：不修改已发放数量，停用后已有券不可继续使用
router.put('/admin/templates/:id', requireAdmin, async (req, res) => {
  try {
    const template = await db.CouponTemplate.findByPk(req.params.id);
    if (!template) return res.json({ code: 404, message: '优惠券模板不存在' });

    const data = parseTemplateInput(req.body || {}, template.toJSON());
    if (data.totalCount !== -1 && data.totalCount < Number(template.usedCount || 0)) {
      return res.json({ code: 400, message: '发放总量不能小于已发放数量' });
    }

    const duplicated = await db.CouponTemplate.findOne({
      where: { name: data.name, id: { [Op.ne]: template.id } }
    });
    if (duplicated) {
      return res.json({ code: 400, message: '已存在同名优惠券，请换一个名称' });
    }
    await assertProbabilityBudget(db, data.probability, data.status, template.id);

    await template.update(data);
    res.json({ code: 200, data: template, message: '优惠券模板更新成功' });
  } catch (error) {
    if (error && error.message) {
      return res.json({ code: 400, message: error.message });
    }
    console.error('更新优惠券模板失败:', error);
    res.json({ code: 500, message: '更新优惠券模板失败' });
  }
});

// 手动向指定用户发放优惠券
router.post('/admin/issue', requireAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const templateId = Number(req.body.templateId);
    const userIds = [...new Set((Array.isArray(req.body.userIds) ? req.body.userIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0))];

    if (!Number.isInteger(templateId) || templateId <= 0) {
      await transaction.rollback();
      return res.json({ code: 400, message: '请选择优惠券模板' });
    }
    if (userIds.length === 0) {
      await transaction.rollback();
      return res.json({ code: 400, message: '请选择至少一个发放用户' });
    }
    if (userIds.length > 200) {
      await transaction.rollback();
      return res.json({ code: 400, message: '单次最多发放 200 个用户' });
    }

    const template = await db.CouponTemplate.findByPk(templateId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!template) {
      await transaction.rollback();
      return res.json({ code: 404, message: '优惠券模板不存在' });
    }
    if (Number(template.status) !== 1) {
      await transaction.rollback();
      return res.json({ code: 400, message: '优惠券模板已停用，不能发放' });
    }

    const users = await db.user.findAll({
      where: { id: userIds },
      attributes: ['id', 'username', 'isactive'],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const userMap = new Map(users.map((user) => [Number(user.id), user]));
    const skipped = [];
    const eligible = [];

    for (const userId of userIds) {
      const user = userMap.get(userId);
      if (!user) {
        skipped.push({ userId, reason: '用户不存在' });
        continue;
      }
      if (user.isactive === false || Number(user.isactive) === 0) {
        skipped.push({ userId, username: user.username, reason: '用户已停用' });
        continue;
      }

      const received = await db.UserCoupon.count({
        where: { userId, templateId },
        transaction
      });
      if (received >= Number(template.perUserLimit || 1)) {
        skipped.push({ userId, username: user.username, reason: '已达到每人限领数量' });
        continue;
      }
      eligible.push(user);
    }

    let issueCount = eligible.length;
    if (Number(template.totalCount) !== -1) {
      const remaining = Math.max(0, Number(template.totalCount) - Number(template.usedCount || 0));
      if (issueCount > remaining) {
        for (const user of eligible.slice(remaining)) {
          skipped.push({ userId: user.id, username: user.username, reason: '优惠券库存不足' });
        }
        issueCount = remaining;
        eligible.length = remaining;
      }
    }

    const expireTime = buildCouponExpireTime(template.validityDays);
    const issued = [];
    for (const user of eligible) {
      const coupon = await db.UserCoupon.create({
        userId: user.id,
        templateId: template.id,
        name: template.name,
        threshold: template.threshold,
        amount: template.amount,
        status: 1,
        source: 'manual',
        issuedBy: req.user.id,
        expireTime
      }, { transaction });

      await db.CouponDrawRecord.create({
        userId: user.id,
        templateId: template.id,
        couponName: template.name,
        threshold: template.threshold,
        amount: template.amount,
        source: 'manual',
        operatorId: req.user.id
      }, { transaction });

      issued.push({ id: coupon.id, userId: user.id, username: user.username });
    }

    if (issueCount > 0) {
      await template.update({
        usedCount: Number(template.usedCount || 0) + issueCount
      }, { transaction });
    }

    await transaction.commit();
    res.json({
      code: 200,
      data: { issuedCount: issued.length, issued, skipped },
      message: issued.length > 0 ? `成功发放 ${issued.length} 张优惠券` : '没有符合条件的发放对象'
    });
  } catch (error) {
    await transaction.rollback();
    console.error('手动发放优惠券失败:', error);
    res.json({ code: 500, message: '手动发放优惠券失败' });
  }
});

// 用户优惠券记录：支持状态、模板和用户搜索
router.get('/admin/user-coupons', requireAdmin, async (req, res) => {
  try {
    await expireUserCoupons();

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const where = {};

    if (req.query.status !== undefined && req.query.status !== '') {
      const status = Number(req.query.status);
      if (![1, 2, 3, 4].includes(status)) {
        return res.json({ code: 400, message: '优惠券状态不合法' });
      }
      where.status = status;
    }
    if (req.query.templateId) {
      where.templateId = Number(req.query.templateId);
    }
    if (req.query.keyword) {
      const escaped = String(req.query.keyword).replace(/[\\%_]/g, (char) => `\\${char}`);
      const users = await db.user.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.like]: `%${escaped}%` } },
            { phone: { [Op.like]: `%${escaped}%` } }
          ]
        },
        attributes: ['id'],
        limit: 500
      });
      if (users.length === 0) {
        return res.json({
          code: 200,
          data: { list: [], total: 0, page, pageSize, totalPages: 0 },
          message: '获取用户优惠券成功'
        });
      }
      where.userId = { [Op.in]: users.map((user) => user.id) };
    }

    const { count, rows } = await db.UserCoupon.findAndCountAll({
      where,
      order: [['createTime', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    const userIds = [...new Set(rows.map((item) => item.userId))];
    const templateIds = [...new Set(rows.map((item) => item.templateId))];
    const [users, templates] = await Promise.all([
      userIds.length
        ? db.user.findAll({ where: { id: userIds }, attributes: ['id', 'username', 'phone'] })
        : [],
      templateIds.length
        ? db.CouponTemplate.findAll({ where: { id: templateIds }, attributes: ['id', 'name'] })
        : []
    ]);
    const userMap = new Map(users.map((user) => [Number(user.id), user]));
    const templateMap = new Map(templates.map((item) => [Number(item.id), item.name]));

    const list = rows.map((coupon) => {
      const data = coupon.toJSON();
      const user = userMap.get(Number(coupon.userId));
      return {
        ...data,
        username: user ? user.username : `用户${coupon.userId}`,
        phone: user ? user.phone : '',
        templateName: templateMap.get(Number(coupon.templateId)) || data.name,
        statusText: COUPON_STATUS_TEXT[Number(coupon.status)] || '未知',
        sourceText: data.source === 'manual' ? '后台发放' : '抽奖获得'
      };
    });

    res.json({
      code: 200,
      data: {
        list,
        total: count,
        page,
        pageSize,
        totalPages: Math.ceil(count / pageSize)
      },
      message: '获取用户优惠券成功'
    });
  } catch (error) {
    console.error('获取用户优惠券失败:', error);
    res.json({ code: 500, message: '获取用户优惠券失败' });
  }
});

// 作废未使用的优惠券
router.put('/admin/user-coupons/:id/revoke', requireAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const coupon = await db.UserCoupon.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!coupon) {
      await transaction.rollback();
      return res.json({ code: 404, message: '优惠券不存在' });
    }
    if (Number(coupon.status) === 4) {
      await transaction.commit();
      return res.json({ code: 200, data: coupon, message: '优惠券已经作废' });
    }
    if (Number(coupon.status) === 2) {
      await transaction.rollback();
      return res.json({ code: 400, message: '已使用的优惠券不能作废' });
    }

    const now = new Date();
    if (Number(coupon.status) === 3 || (coupon.expireTime && new Date(coupon.expireTime) < now)) {
      await coupon.update({ status: 3 }, { transaction });
      await transaction.commit();
      return res.json({ code: 400, message: '优惠券已过期，不能作废' });
    }

    await coupon.update({
      status: 4,
      revokeTime: now,
      revokedBy: req.user.id,
      revokeRemark: String(req.body.reason || '后台作废').slice(0, 255)
    }, { transaction });

    await transaction.commit();
    res.json({ code: 200, data: coupon, message: '优惠券已作废' });
  } catch (error) {
    await transaction.rollback();
    console.error('作废优惠券失败:', error);
    res.json({ code: 500, message: '作废优惠券失败' });
  }
});

// 运营统计
router.get('/admin/statistics', requireAdmin, async (req, res) => {
  try {
    await expireUserCoupons();

    const [
      totalTemplates,
      activeTemplates,
      totalIssued,
      unusedCount,
      redeemedCount,
      expiredCount,
      revokedCount,
      discountAmount
    ] = await Promise.all([
      db.CouponTemplate.count(),
      db.CouponTemplate.count({ where: { status: 1 } }),
      db.UserCoupon.count(),
      db.UserCoupon.count({ where: { status: 1 } }),
      db.UserCoupon.count({ where: { status: 2 } }),
      db.UserCoupon.count({ where: { status: 3 } }),
      db.UserCoupon.count({ where: { status: 4 } }),
      db.UserCoupon.sum('amount', { where: { status: 2 } })
    ]);

    const templates = await db.CouponTemplate.findAll({
      order: [['status', 'DESC'], ['createTime', 'DESC'], ['id', 'DESC']]
    });
    const statsMap = await getTemplateStatsMap(templates.map((item) => item.id));

    const templateStats = templates.map((template) => {
      const stats = statsMap.get(Number(template.id)) || {};
      return {
        id: template.id,
        name: template.name,
        status: template.status,
        totalCount: template.totalCount,
        validityDays: template.validityDays,
        perUserLimit: template.perUserLimit,
        ...stats,
        redemptionRate: stats.issuedCount
          ? Math.round((stats.redeemedCount / stats.issuedCount) * 10000) / 100
          : 0
      };
    });

    res.json({
      code: 200,
      data: {
        summary: {
          totalTemplates,
          activeTemplates,
          totalIssued,
          unusedCount,
          redeemedCount,
          expiredCount,
          revokedCount,
          discountAmount: Number(discountAmount || 0),
          redemptionRate: totalIssued
            ? Math.round((redeemedCount / totalIssued) * 10000) / 100
            : 0
        },
        templates: templateStats
      },
      message: '获取优惠券统计成功'
    });
  } catch (error) {
    console.error('获取优惠券统计失败:', error);
    res.json({ code: 500, message: '获取优惠券统计失败' });
  }
});

module.exports = router;
