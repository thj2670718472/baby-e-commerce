var express = require('express');
var router = express.Router();
const { baby } = require('../db/mysqldb');
const { requireAuth } = require('../middleware/auth');

function canAccess(req, userId) {
  return req.user && (req.user.role === 'admin' || String(req.user.id) === String(userId));
}

// 获取用户的婴儿列表
router.get('/list', requireAuth, async (req, res) => {
  try {
    let userId = req.query.userId;

    if (!userId) {
      userId = req.user.id;
    }
    if (!canAccess(req, userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的宝宝档案' });
    }

    const babies = await baby.findAll({ where: { userId } });

    res.json({ code: 200, data: babies, message: '获取婴儿列表成功' });
  } catch (error) {
    console.error('获取婴儿列表失败:', error);
    res.json({ code: 500, message: '获取婴儿列表失败' });
  }
});

// 保存婴儿信息（整体覆盖自己的档案）
router.post('/save', requireAuth, async (req, res) => {
  const transaction = await baby.sequelize.transaction();

  try {
    const userId = req.user.id;
    const babies = req.body.babies;

    if (!Array.isArray(babies)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '参数错误' });
    }

    // 删除与重建必须在同一事务内，写入失败时保留原档案
    await baby.destroy({ where: { userId }, transaction });

    if (babies.length > 0) {
      const babyData = babies.map(babyItem => ({
        userId,
        name: babyItem.name,
        birthDate: babyItem.birthDate,
        gender: babyItem.gender,
        height: babyItem.height,
        weight: babyItem.weight
      }));

      await baby.bulkCreate(babyData, { transaction });
    }

    await transaction.commit();
    res.json({ code: 200, message: '保存婴儿信息成功' });
  } catch (error) {
    await transaction.rollback();
    console.error('保存婴儿信息失败:', error);
    res.json({ code: 500, message: '保存婴儿信息失败' });
  }
});

// 计算总婴儿数（首页展示用，公开统计值）
router.get('/count', async (req, res) => {
  try {
    const count = await baby.count();
    res.json({ code: 200, data: count, message: '获取婴儿数量成功' });
  } catch (error) {
    console.error('获取婴儿数量失败:', error);
    res.json({ code: 500, message: '获取婴儿数量失败' });
  }
});

module.exports = router;
