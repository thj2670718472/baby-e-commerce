var express = require('express');
var router = express.Router();
var axios = require('axios');
const db = require('../db/mysqldb');
const config = require('../utils/config');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

// AI 调用按用户限流，避免额度被刷
const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_MAX) || 10,
  message: 'AI 请求过于频繁，请稍后再试'
});

// 大模型配置统一从 .env 读取（AI_API_KEY / AI_API_URL / AI_MODEL）
const AI_CONFIG = config.ai;

const BASE_PROMPT = '你是一个专业的母婴育儿顾问，回答关于婴儿护理、喂养、早教等方面的问题，无关的不回答。回答简洁易懂。';

// 按出生日期算月龄，30.44 天 ≈ 一个月
function monthAgeText(birthDate) {
  const ms = Date.now() - new Date(birthDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const months = Math.floor(ms / (1000 * 60 * 60 * 24 * 30.44));
  return months < 1 ? '未满月' : `${months} 个月`;
}

// 把宝宝档案写进系统提示词，让回答贴合月龄；没有档案时用通用提示词
function buildSystemPrompt(babies) {
  if (!babies || babies.length === 0) return BASE_PROMPT;

  const profiles = babies.map((b) => {
    const parts = [b.name, b.gender ? `${b.gender}宝` : '', monthAgeText(b.birthDate)].filter(Boolean);
    if (b.height) parts.push(`身高 ${Number(b.height)}cm`);
    if (b.weight) parts.push(`体重 ${Number(b.weight)}kg`);
    return parts.join('，');
  }).join('；');

  return `${BASE_PROMPT} 用户家的宝宝信息：${profiles}。回答请结合宝宝的月龄给出针对性的喂养和护理建议。`;
}

// AI 对话接口
router.post('/chat', requireAuth, aiLimiter, async (req, res) => {
  try {
    if (!AI_CONFIG.apiKey) {
      return res.status(503).json({ code: 503, message: 'AI 服务未配置，请联系管理员' });
    }

    const { messages } = req.body;
    // messages = [{ role: 'user', content: '宝宝6个月能吃什么辅食？' }]
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ code: 400, message: '消息内容不能为空' });
    }

    // 只保留最近 20 条、每条截断，避免超长历史把 token 打爆
    const history = messages
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 2000)
      }))
      .filter((m) => m.content);

    if (history.length === 0) {
      return res.status(400).json({ code: 400, message: '消息内容不能为空' });
    }

    let babies = [];
    try {
      babies = await db.baby.findAll({ where: { userId: req.user.id } });
    } catch (e) {
      // 档案读取失败不影响对话，退化为通用回答
      console.error('读取宝宝档案失败:', e.message);
    }

    const systemPrompt = {
      role: 'system',
      content: buildSystemPrompt(babies)
    };
    //调用模型API
    const response = await axios.post(AI_CONFIG.apiUrl, {
      model: AI_CONFIG.model,
      messages: [systemPrompt, ...history],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      code: 200,
      data: {
        content: response.data.choices[0].message.content,
        role: 'assistant'
      }
    });
  } catch (error) {
    console.error('AI 调用失败:', error.message);
    res.json({ code: 500, message: 'AI 服务暂时不可用' });
  }
});

// 根据婴儿信息推荐食谱
router.post('/recommend-food', requireAuth, aiLimiter, async (req, res) => {
  try {
    if (!AI_CONFIG.apiKey) {
      return res.status(503).json({ code: 503, message: 'AI 服务未配置，请联系管理员' });
    }

    const { babyAge, allergy } = req.body;

    const prompt = `为一个${babyAge}个月的宝宝推荐3个适合的辅食食谱。${allergy ? '注意避开' + allergy + '过敏。' : ''}请用中文回答，格式简洁。`;

    const response = await axios.post(AI_CONFIG.apiUrl, {
      model: AI_CONFIG.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400
    }, {
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      code: 200,
      data: { content: response.data.choices[0].message.content }
    });
  } catch (error) {
    res.json({ code: 500, message: '推荐失败' });
  }
});

module.exports = router;
