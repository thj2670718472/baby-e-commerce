const express = require('express');
const router = express.Router();
const { baby_culture } = require('../db/mysqldb');
const { requireAdmin } = require('../middleware/auth');

// 只接受业务字段，避免客户端借更新接口改写 id / viewCount / 时间戳
const ARTICLE_WRITABLE_FIELDS = ['title', 'summary', 'content', 'author', 'status'];
const ARTICLE_STATUS = ['published', 'draft'];

function pickArticleFields(body) {
  const source = body || {};
  const data = {};
  for (const field of ARTICLE_WRITABLE_FIELDS) {
    if (source[field] !== undefined) data[field] = source[field];
  }
  return data;
}

// 获取所有文章列表
router.get('/', async (req, res) => {
  try {
    const articles = await baby_culture.findAll({
      where: { status: 'published' },
      order: [['createdAt', 'DESC']]
    });
    res.send({
      code: 200,
      message: '获取成功',
      data: articles
    });
  } catch (error) {
    res.send({
      code: 500,
      message: '获取文章列表失败'
    });
  }
});

// 根据月龄推荐文章
router.get('/recommend', async (req, res) => {
  try {
    const { months } = req.query;
    let keywords = [];
    
    if (months <= 6) keywords = ['新生儿', '母乳', '喂养', '护理', '睡眠'];
    else if (months <= 12) keywords = ['辅食', '爬行', '长牙', '断奶'];
    else if (months <= 36) keywords = ['早教', '说话', '走路', '绘本', '玩具'];
    else keywords = ['幼儿园', '习惯', '教育'];
    
    const articles = await baby_culture.findAll({
      where: { status: 'published' },
      order: [['createdAt', 'DESC']]
    });
    
    // 按关键词匹配推荐（summary 可能为空，直接 includes 会抛 TypeError）
    const recommended = articles.filter(a =>
      keywords.some(k => (a.title || '').includes(k) || (a.summary || '').includes(k))
    );
    const rest = articles.filter(a => !recommended.includes(a));
    
    res.json({ code: 200, data: { recommended, all: articles } });
  } catch (error) {
    res.json({ code: 500, message: '获取失败' });
  }
});

// 获取文章详情
router.get('/:id', async (req, res) => {
  try {
    const where = req.user && req.user.role === 'admin'
      ? { id: req.params.id }
      : { id: req.params.id, status: 'published' };
    const article = await baby_culture.findOne({ where });
    if (article) {
      // 增加浏览次数
      await article.update({ viewCount: article.viewCount + 1 });
      res.send({
        code: 200,
        message: '获取成功',
        data: article
      });
    } else {
      res.send({
        code: 404,
        message: '文章不存在'
      });
    }
  } catch (error) {
    res.send({
      code: 500,
      message: '获取文章详情失败'
    });
  }
});

// 创建新文章（管理员）
router.post('/', requireAdmin, async (req, res) => {
  try {
    const data = pickArticleFields(req.body);
    if (!data.title || !data.summary || !data.content) {
      return res.send({ code: 400, message: '标题、摘要和内容不能为空' });
    }
    if (data.status !== undefined && !ARTICLE_STATUS.includes(data.status)) {
      return res.send({ code: 400, message: '文章状态不合法' });
    }

    const article = await baby_culture.create(data);
    res.send({
      code: 200,
      message: '创建成功',
      data: article
    });
  } catch (error) {
    res.send({
      code: 500,
      message: '创建文章失败'
    });
  }
});

// 更新文章（管理员）
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const article = await baby_culture.findByPk(req.params.id);
    if (article) {
      const data = pickArticleFields(req.body);
      if (Object.keys(data).length === 0) {
        return res.send({ code: 400, message: '没有可更新的字段' });
      }
      if (data.status !== undefined && !ARTICLE_STATUS.includes(data.status)) {
        return res.send({ code: 400, message: '文章状态不合法' });
      }
      await article.update(data);
      res.send({
        code: 200,
        message: '更新成功',
        data: article
      });
    } else {
      res.send({
        code: 404,
        message: '文章不存在'
      });
    }
  } catch (error) {
    res.send({
      code: 500,
      message: '更新文章失败'
    });
  }
});

// 删除文章（管理员）
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const article = await baby_culture.findByPk(req.params.id);
    if (article) {
      await article.destroy();
      res.send({
        code: 200,
        message: '删除成功'
      });
    } else {
      res.send({
        code: 404,
        message: '文章不存在'
      });
    }
  } catch (error) {
    res.send({
      code: 500,
      message: '删除文章失败'
    });
  }
});

module.exports = router;
