var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { Op } = require('sequelize');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// ==================== 记录搜索关键词 ====================
// 未登录也可搜索（记录为匿名），但归属用户只能来自登录态
router.post('/record', optionalAuth, async (req, res) => {
  try {
    const { keyword } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!keyword || !keyword.trim()) {
      return res.json({ code: 400, message: '关键词不能为空' });
    }

    await db.searchHistory.create({
      userId,
      keyword: keyword.trim().slice(0, 50),
      searchTime: new Date()
    });
    
    res.json({ code: 200, message: '记录成功' });
  } catch (error) {
    console.error('记录搜索关键词失败:', error);
    res.json({ code: 500, message: '记录失败' });
  }
});

// ==================== 获取热搜词（最近7天搜索最多的10个词） ====================
router.get('/hot', async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const hotKeywords = await db.searchHistory.findAll({
      attributes: [
        'keyword',
        [db.sequelize.fn('COUNT', db.sequelize.col('keyword')), 'count']
      ],
      where: {
        searchTime: { [Op.gte]: sevenDaysAgo }
      },
      group: ['keyword'],
      order: [[db.sequelize.literal('count'), 'DESC']],
      limit: 10
    });
    
    res.json({ code: 200, data: hotKeywords, message: '获取热搜词成功' });
  } catch (error) {
    console.error('获取热搜词失败:', error);
    res.json({ code: 500, message: '获取失败' });
  }
});

// ==================== 获取用户搜索历史（最近20条） ====================
router.get('/history/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (req.user.role !== 'admin' && String(userId) !== String(req.user.id)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的搜索历史' });
    }
    
    const history = await db.searchHistory.findAll({
      where: { userId: userId },
      attributes: ['keyword', 'searchTime'],
      order: [['searchTime', 'DESC']],
      limit: 20
    });
    
    // 去重
    const uniqueHistory = [];
    const seenKeywords = new Set();
    for (const item of history) {
      if (!seenKeywords.has(item.keyword)) {
        seenKeywords.add(item.keyword);
        uniqueHistory.push(item);
      }
    }
    
    res.json({ code: 200, data: uniqueHistory, message: '获取搜索历史成功' });
  } catch (error) {
    console.error('获取搜索历史失败:', error);
    res.json({ code: 500, message: '获取失败' });
  }
});

// ==================== 清除用户搜索历史 ====================
router.delete('/history/:userId', requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (req.user.role !== 'admin' && String(userId) !== String(req.user.id)) {
      return res.status(403).json({ code: 403, message: '无权清空其他用户的搜索历史' });
    }

    await db.searchHistory.destroy({ where: { userId: userId } });
    res.json({ code: 200, message: '清除成功' });
  } catch (error) {
    console.error('清除搜索历史失败:', error);
    res.json({ code: 500, message: '清除失败' });
  }
});

// ==================== 搜索建议（在售商品名 + 当前用户历史） ====================
router.get('/suggest', optionalAuth, async (req, res) => {
  try {
    const keyword = (req.query.keyword || '').trim();

    if (!keyword) {
      return res.json({ code: 200, data: [] });
    }

    const escaped = keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
    const like = `%${escaped}%`;

    const suggestions = [];
    const seen = new Set();
    const push = (value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      suggestions.push({ keyword: text });
    };

    // 1. 商品名联想：直接联想真实在售商品，未登录也能用
    const goodsList = await db.goods.findAll({
      attributes: ['name'],
      where: { status: true, name: { [Op.like]: like } },
      order: [['sales', 'DESC']],
      limit: 5
    });
    goodsList.forEach((item) => push(item.name));

    // 2. 用本人搜索历史补足，未登录不查历史，避免泄露他人搜索内容
    if (req.user && suggestions.length < 8) {
      const history = await db.searchHistory.findAll({
        attributes: ['keyword'],
        where: {
          userId: req.user.id,
          keyword: { [Op.like]: like }
        },
        group: ['keyword'],
        order: [[db.sequelize.fn('COUNT', db.sequelize.col('keyword')), 'DESC']],
        limit: 8 - suggestions.length
      });
      history.forEach((item) => push(item.keyword));
    }

    res.json({ code: 200, data: suggestions.slice(0, 8), message: '获取建议成功' });
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    res.json({ code: 500, message: '获取失败' });
  }
});

module.exports = router;