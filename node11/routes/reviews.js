var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { requireAdmin, requireAuth } = require('../middleware/auth');

// 提交评价
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { orderId, goodsId, rating, content, isAnonymous } = req.body;

    // 评价人身份来自登录态，不接受客户端指定
    const userId = req.user.id;
    const user = await db.user.findByPk(userId);
    if (!user) {
      return res.send({ code: 404, message: '用户不存在' });
    }

    if (!goodsId || !rating) {
      return res.send({ code: 400, message: '参数不完整' });
    }

    // 评价必须来自真实订单，避免空评价刷积分
    if (!orderId) {
      return res.send({ code: 400, message: '评价必须关联订单' });
    }

    const ratingValue = Number(rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.send({ code: 400, message: '评分需在 1-5 之间' });
    }

    const order = await db.order.findByPk(orderId);
    if (!order || String(order.userId) !== String(userId)) {
      return res.status(403).json({ code: 403, message: '无权评价该订单' });
    }
    if (!['已完成', '已付款', '已发货'].includes(order.status)) {
      return res.send({ code: 400, message: '当前订单状态不允许评价' });
    }

    // 商品必须在该订单明细中
    const orderItem = await db.order_goods.findOne({ where: { orderId, goodsId } });
    if (!orderItem) {
      return res.send({ code: 400, message: '该商品不在订单中' });
    }

    const existed = await db.review.findOne({ where: { orderId, goodsId, userId } });
    if (existed) {
      return res.send({ code: 400, message: '该商品已评价过了' });
    }

    const reviewData = {
      orderId: orderId || null,
      goodsId: goodsId,
      userId: userId,
      userName: isAnonymous ? '' : (user.username || ''),
      rating: ratingValue,
      content: content || '默认好评',
      images: JSON.stringify(req.body.images || []),
      status: 0,
      createTime: new Date(),
      updateTime: new Date()
    };

    const review = await db.review.create(reviewData);
    
    res.send({ 
      code: 200, 
      data: review, 
      message: '评价提交成功，等待管理员审核' 
    });
  } catch (error) {
    if (error && error.name === 'SequelizeUniqueConstraintError') {
      return res.send({ code: 400, message: '该商品已评价过了' });
    }
    console.error('提交评价失败:', error.message);
    res.send({ code: 500, message: '提交评价失败' });
  }
});

// 解析图片字段的辅助函数
function parseImages(data) {
  if (!data.images) {
    data.images = [];
    return data;
  }
  if (typeof data.images === 'string') {
    try { data.images = JSON.parse(data.images); } catch (e) { data.images = []; }
  }
  if (!Array.isArray(data.images)) data.images = [];
  return data;
}

// 获取所有评价（管理员）
router.get('/list', requireAdmin, async (req, res) => {
  try {
    const { status, goodsId, page = 1, limit = 10 } = req.query;
    
    let where = {};
    if (status !== undefined && status !== '') {
      where.status = parseInt(status);
    }
    if (goodsId) {
      where.goodsId = parseInt(goodsId);
    }
    
    const { count, rows } = await db.review.findAndCountAll({
      where: where,
      order: [['createTime', 'DESC']],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit)
    });
    
    const processedRows = rows.map(review => {
      let data = review.toJSON();
      if (!data.userName) data.userName = '匿名用户';
      data = parseImages(data);
      return data;
    });
    
    res.send({ 
      code: 200, 
      data: { list: processedRows, total: count, page: parseInt(page), limit: parseInt(limit) }, 
      message: '获取评价列表成功' 
    });
  } catch (error) {
    console.error('获取评价列表失败:', error);
    res.send({ code: 500, message: '获取评价列表失败' });
  }
});

// 评价脱敏 + 图片字段统一成数组
function formatReview(review) {
  let data = review.toJSON();
  if (!data.userName) data.userName = '匿名用户';
  return parseImages(data);
}

// 获取商品评价列表 - 只返回已审核通过的
// 传 page/pageSize 时返回分页结构，不传时仍返回数组（兼容旧前端）
router.get('/goods/:goodsId', async (req, res) => {
  try {
    const where = { goodsId: req.params.goodsId, status: 1 };
    const page = Number(req.query.page);
    const pageSize = Number(req.query.pageSize || 10);

    if (Number.isInteger(page) && page > 0) {
      const size = Math.min(Math.max(pageSize, 1), 50);
      const { count, rows } = await db.review.findAndCountAll({
        where,
        order: [['createTime', 'DESC']],
        limit: size,
        offset: (page - 1) * size
      });

      return res.send({
        code: 200,
        data: {
          list: rows.map(formatReview),
          total: count,
          page,
          pageSize: size,
          totalPages: Math.ceil(count / size)
        },
        message: '获取评价列表成功'
      });
    }

    const reviews = await db.review.findAll({
      where,
      order: [['createTime', 'DESC']]
    });

    res.send({ code: 200, data: reviews.map(formatReview), message: '获取评价列表成功' });
  } catch (error) {
    console.error('获取评价列表失败:', error);
    res.send({ code: 500, message: '获取评价列表失败' });
  }
});

// 获取评价统计
router.get('/stats/:goodsId', async (req, res) => {
  try {
    const reviews = await db.review.findAll({
      where: { goodsId: req.params.goodsId, status: 1 }
    });
    
    const total = reviews.length;
    const avgRating = total > 0 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) 
      : 0;
    
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => { ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1; });
    
    res.send({ code: 200, data: { total, avgRating, ratingCounts }, message: '获取评价统计成功' });
  } catch (error) {
    console.error('获取评价统计失败:', error);
    res.send({ code: 500, message: '获取评价统计失败' });
  }
});

// 审核评价（管理员）
router.put('/audit/:id', requireAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const nextStatus = parseInt(req.body.status, 10);   //1通过  2拒绝
    if (![1, 2].includes(nextStatus)) {
      await transaction.rollback();
      return res.send({ code: 400, message: '审核状态不合法' });
    }

    const review = await db.review.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!review) {
      await transaction.rollback();
      return res.send({ code: 404, message: '评价不存在' });
    }

    // 同一状态重复审核按幂等成功处理；已审核评价不允许改判
    if (review.status === nextStatus) {
      await transaction.commit();
      return res.send({ code: 200, message: nextStatus === 1 ? '评价审核通过' : '评价已拒绝' });
    }
    if (review.status !== 0) {
      await transaction.rollback();
      return res.send({ code: 400, message: '该评价已经审核，不能重复改判' });
    }

    await review.update({ status: nextStatus, updateTime: new Date() }, { transaction });

    if (nextStatus === 1) {
      await db.user.update(
        { points: db.sequelize.literal('points + 5') },
        { where: { id: review.userId }, transaction }
      );
      await db.pointsRecord.create({
        userId: review.userId, type: 'income', points: 5,
        source: '评价', description: `评价ID:${review.id}`
      }, { transaction });
      console.log(`用户${review.userId}评价奖励+5积分`);
    }

    await transaction.commit();
    console.log('评价审核完成:', req.params.id, '状态:', nextStatus);
    res.send({ code: 200, message: nextStatus === 1 ? '评价审核通过' : '评价已拒绝' });
  } catch (error) {
    await transaction.rollback();
    console.error('审核评价失败:', error);
    res.send({ code: 500, message: '审核评价失败' });
  }
});

// 删除评价（管理员）
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const review = await db.review.findByPk(req.params.id);
    if (!review) return res.send({ code: 404, message: '评价不存在' });
    await review.destroy();
    res.send({ code: 200, message: '评价删除成功' });
  } catch (error) {
    console.error('删除评价失败:', error);
    res.send({ code: 500, message: '删除评价失败' });
  }
});

module.exports = router;