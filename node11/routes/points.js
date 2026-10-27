var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
const { Op } = require('sequelize');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function canAccess(req, userId) {
  return req.user && (req.user.role === 'admin' || String(req.user.id) === String(userId));
}

// 获取用户积分
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的积分' });
    }

    const user = await db.user.findByPk(req.params.userId, { attributes: ['id', 'points'] });
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    res.json({ code: 200, data: { points: user.points || 0 } });
  } catch (error) {
    res.json({ code: 500, message: '获取失败' });
  }
});

// 获取积分记录
router.get('/records/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的积分记录' });
    }

    const records = await db.pointsRecord.findAll({
      where: { userId: req.params.userId },
      order: [['createTime', 'DESC']],
      limit: 50
    });
    res.json({ code: 200, data: records });
  } catch (error) {
    res.json({ code: 500, message: '获取失败' });
  }
});

// ==================== 积分商城 ====================

// 积分商品列表：默认只看上架商品；查看下架商品仅限管理员
router.get('/shop', async (req, res) => {
  try {
    const status = req.query.status;
    const isAdmin = req.user && req.user.role === 'admin';
    const where = {};

    if (status === 'all') {
      if (!isAdmin) {
        return res.status(403).json({ code: 403, message: '需要管理员权限' });
      }
      // 管理端查看全部，不加条件
    } else if (status === 'false') {
      if (!isAdmin) {
        return res.status(403).json({ code: 403, message: '需要管理员权限' });
      }
      where.status = false;
    } else {
      where.status = true;
    }

    const list = await db.pointsGoods.findAll({
      where,
      order: [['sort', 'DESC'], ['id', 'ASC']]
    });

    res.json({ code: 200, data: list, message: '获取积分商品成功' });
  } catch (error) {
    console.error('获取积分商品失败:', error);
    res.json({ code: 500, message: '获取积分商品失败' });
  }
});

// 积分商品详情：返回完整介绍、规则、库存和当前用户剩余可兑数量
router.get('/shop/:id', async (req, res) => {
  try {
    const product = await db.pointsGoods.findByPk(req.params.id);
    if (!product || (!product.status && (!req.user || req.user.role !== 'admin'))) {
      return res.json({ code: 404, message: '积分商品不存在或已下架' });
    }

    const exchangedCount = Number(await db.pointsExchange.sum('quantity', {
      where: {
        pointsGoodsId: product.id,
        status: { [Op.ne]: '已取消' }
      }
    })) || 0;

    let userRedeemed = 0;
    if (req.user) {
      userRedeemed = Number(await db.pointsExchange.sum('quantity', {
        where: {
          userId: req.user.id,
          pointsGoodsId: product.id,
          status: { [Op.ne]: '已取消' }
        }
      })) || 0;
    }

    const redeemLimit = Number(product.redeemLimit) || 0;
    res.json({
      code: 200,
      data: {
        ...product.toJSON(),
        exchangedCount,
        userRedeemed,
        userRemaining: redeemLimit > 0
          ? Math.max(0, redeemLimit - userRedeemed)
          : -1
      },
      message: '获取积分商品详情成功'
    });
  } catch (error) {
    console.error('获取积分商品详情失败:', error);
    res.json({ code: 500, message: '获取积分商品详情失败' });
  }
});

// 新增积分商品（管理员）
router.post('/shop', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const points = Number(body.points);

    const redeemLimit = Number(body.redeemLimit) || 0;

    if (!name) return res.json({ code: 400, message: '商品名称不能为空' });
    if (!Number.isInteger(points) || points <= 0) {
      return res.json({ code: 400, message: '兑换积分必须为正整数' });
    }
    if (!Number.isInteger(redeemLimit) || redeemLimit < 0 || redeemLimit > 99) {
      return res.json({ code: 400, message: '每人限兑数量必须为 0-99 的整数，0 表示不限' });
    }

    const created = await db.pointsGoods.create({
      name: name.slice(0, 100),
      image: body.image || '',
      description: body.description || '',
      detail: body.detail || '',
      redeemLimit,
      shippingNote: String(body.shippingNote || '').slice(0, 255),
      rules: body.rules || '',
      points,
      stock: Math.max(0, Number(body.stock) || 0),
      status: body.status === undefined ? true : !!body.status,
      sort: Number(body.sort) || 0
    });

    res.json({ code: 200, data: created, message: '新增积分商品成功' });
  } catch (error) {
    console.error('新增积分商品失败:', error);
    res.json({ code: 500, message: '新增积分商品失败' });
  }
});

// 修改积分商品（管理员）
router.put('/shop/:id', requireAdmin, async (req, res) => {
  try {
    const product = await db.pointsGoods.findByPk(req.params.id);
    if (!product) return res.json({ code: 404, message: '积分商品不存在' });

    const body = req.body || {};
    const updateData = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim().slice(0, 100);
    if (body.image !== undefined) updateData.image = body.image;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.detail !== undefined) updateData.detail = body.detail;
    if (body.shippingNote !== undefined) {
      updateData.shippingNote = String(body.shippingNote || '').slice(0, 255);
    }
    if (body.rules !== undefined) updateData.rules = body.rules;
    if (body.redeemLimit !== undefined) {
      const redeemLimit = Number(body.redeemLimit);
      if (!Number.isInteger(redeemLimit) || redeemLimit < 0 || redeemLimit > 99) {
        return res.json({ code: 400, message: '每人限兑数量必须为 0-99 的整数，0 表示不限' });
      }
      updateData.redeemLimit = redeemLimit;
    }
    if (body.points !== undefined) {
      const points = Number(body.points);
      if (!Number.isInteger(points) || points <= 0) {
        return res.json({ code: 400, message: '兑换积分必须为正整数' });
      }
      updateData.points = points;
    }
    if (body.stock !== undefined) updateData.stock = Math.max(0, Number(body.stock) || 0);
    if (body.status !== undefined) updateData.status = !!body.status;
    if (body.sort !== undefined) updateData.sort = Number(body.sort) || 0;

    await product.update(updateData);
    res.json({ code: 200, data: product, message: '修改成功' });
  } catch (error) {
    console.error('修改积分商品失败:', error);
    res.json({ code: 500, message: '修改积分商品失败' });
  }
});

// 删除积分商品（管理员）
router.delete('/shop/:id', requireAdmin, async (req, res) => {
  try {
    const affected = await db.pointsGoods.destroy({ where: { id: req.params.id } });
    if (!affected) return res.json({ code: 404, message: '积分商品不存在' });
    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    console.error('删除积分商品失败:', error);
    res.json({ code: 500, message: '删除积分商品失败' });
  }
});

// ==================== 积分兑换 ====================

// 用积分兑换商品：扣积分、扣库存、写兑换单，全过程一个事务
router.post('/exchange', requireAuth, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const userId = req.user.id;
    const body = req.body || {};
    const pointsGoodsId = Number(body.pointsGoodsId || body.goodsId);
    const quantity = Number(body.quantity || 1);

    if (!Number.isInteger(pointsGoodsId) || pointsGoodsId <= 0) {
      await transaction.rollback();
      return res.json({ code: 400, message: '商品参数不合法' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
      await transaction.rollback();
      return res.json({ code: 400, message: '兑换数量必须为 1-99 的整数' });
    }

    const product = await db.pointsGoods.findByPk(pointsGoodsId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!product) {
      await transaction.rollback();
      return res.json({ code: 404, message: '积分商品不存在' });
    }
    if (!product.status) {
      await transaction.rollback();
      return res.json({ code: 400, message: '该商品已下架' });
    }
    if (Number(product.stock) < quantity) {
      await transaction.rollback();
      return res.json({ code: 400, message: '库存不足' });
    }

    const redeemLimit = Number(product.redeemLimit) || 0;
    if (redeemLimit > 0) {
      const redeemedRaw = await db.pointsExchange.sum('quantity', {
        where: {
          userId,
          pointsGoodsId,
          status: { [Op.ne]: '已取消' }
        },
        transaction
      });
      const redeemed = Number(redeemedRaw) || 0;
      if (redeemed + quantity > redeemLimit) {
        await transaction.rollback();
        return res.json({
          code: 400,
          message: `每人限兑 ${redeemLimit} 件，你已兑换 ${redeemed} 件`
        });
      }
    }

    const totalPoints = Number(product.points) * quantity;

    // 原子扣积分：并发下不会扣成负数
    const [pointsAffected] = await db.user.update(
      { points: db.sequelize.literal(`points - ${totalPoints}`) },
      { where: { id: userId, points: { [Op.gte]: totalPoints } }, transaction }
    );
    if (!pointsAffected) {
      await transaction.rollback();
      return res.json({ code: 400, message: '积分不足' });
    }

    // 原子扣库存
    const [stockAffected] = await db.pointsGoods.update(
      { stock: db.sequelize.literal(`stock - ${quantity}`) },
      { where: { id: pointsGoodsId, stock: { [Op.gte]: quantity } }, transaction }
    );
    if (!stockAffected) {
      await transaction.rollback();
      return res.json({ code: 400, message: '库存不足' });
    }

    // 收货信息：前端没传就用默认地址
    let address = String(body.address || '').trim();
    let phone = String(body.phone || '').trim();

    if (!address || !phone) {
      const defaultAddress =
        (await db.address.findOne({ where: { userId, isDefault: true }, transaction })) ||
        (await db.address.findOne({ where: { userId }, transaction }));

      if (defaultAddress) {
        if (!address) {
          address = `${defaultAddress.province || ''}${defaultAddress.city || ''}${defaultAddress.district || ''}${defaultAddress.detail || ''}`;
        }
        if (!phone) phone = defaultAddress.phone || '';
      }
    }

    if (!address || !phone) {
      await transaction.rollback();
      return res.json({ code: 400, message: '请先完善收货地址和联系电话' });
    }

    const record = await db.pointsExchange.create({
      userId,
      pointsGoodsId,
      goodsName: product.name,
      goodsImage: product.image || '',
      points: totalPoints,
      quantity,
      status: '待发货',
      address,
      phone
    }, { transaction });

    await db.pointsRecord.create({
      userId,
      type: 'expense',
      points: totalPoints,
      source: '积分兑换',
      description: `${product.name} × ${quantity}`
    }, { transaction });

    await transaction.commit();

    res.json({ code: 200, data: record, message: '兑换成功' });
  } catch (error) {
    await transaction.rollback();
    console.error('积分兑换失败:', error);
    res.json({ code: 500, message: '兑换失败' });
  }
});

// 兑换记录列表（管理员）：分页 + 状态 + 商品名筛选，附带下单用户名
router.get('/exchange-list', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.keyword) {
      const escaped = String(req.query.keyword).replace(/[\\%_]/g, (char) => `\\${char}`);
      where.goodsName = { [Op.like]: `%${escaped}%` };
    }

    const { count, rows } = await db.pointsExchange.findAndCountAll({
      where,
      order: [['createTime', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    // 补上用户名，避免前端再逐个查
    const userIds = [...new Set(rows.map((item) => item.userId))];
    const users = userIds.length
      ? await db.user.findAll({ where: { id: userIds }, attributes: ['id', 'username'] })
      : [];
    const userMap = new Map(users.map((user) => [Number(user.id), user.username]));

    const list = rows.map((item) => ({
      ...item.toJSON(),
      username: userMap.get(Number(item.userId)) || `用户${item.userId}`
    }));

    res.json({
      code: 200,
      data: { list, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) },
      message: '获取兑换记录成功'
    });
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    res.json({ code: 500, message: '获取兑换记录失败' });
  }
});

// 兑换记录（当前用户 / 管理员查指定用户）
router.get('/exchange-records/:userId', requireAuth, async (req, res) => {
  try {
    if (!canAccess(req, req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的兑换记录' });
    }

    const records = await db.pointsExchange.findAll({
      where: { userId: req.params.userId },
      order: [['createTime', 'DESC']],
      limit: 50
    });

    res.json({ code: 200, data: records, message: '获取兑换记录成功' });
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    res.json({ code: 500, message: '获取兑换记录失败' });
  }
});

// 更新兑换单状态（管理员发货 / 完成）
router.put('/exchange/:id/status', requireAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const status = req.body.status;
    const transitions = {
      '待发货': ['已发货', '已取消'],
      '已发货': ['已完成', '已取消'],
      '已完成': [],
      '已取消': []
    };

    if (!Object.prototype.hasOwnProperty.call(transitions, status)) {
      await transaction.rollback();
      return res.json({ code: 400, message: '状态不合法' });
    }

    const record = await db.pointsExchange.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!record) {
      await transaction.rollback();
      return res.json({ code: 404, message: '兑换记录不存在' });
    }

    // 重复提交同一状态视为幂等成功；终态不能回退或再次取消
    if (record.status === status) {
      await transaction.commit();
      return res.json({ code: 200, data: record, message: '状态更新成功' });
    }
    if (!transitions[record.status].includes(status)) {
      await transaction.rollback();
      return res.json({ code: 400, message: `兑换单不能从“${record.status}”变更为“${status}”` });
    }

    if (status === '已取消') {
      await db.user.update(
        { points: db.sequelize.literal(`points + ${Number(record.points)}`) },
        { where: { id: record.userId }, transaction }
      );
      await db.pointsGoods.update(
        { stock: db.sequelize.literal(`stock + ${Number(record.quantity)}`) },
        { where: { id: record.pointsGoodsId }, transaction }
      );
      await db.pointsRecord.create({
        userId: record.userId,
        type: 'income',
        points: Number(record.points),
        source: '兑换取消退还',
        description: `兑换单${record.id}`
      }, { transaction });
    }

    await record.update({ status }, { transaction });
    await transaction.commit();
    res.json({ code: 200, data: record, message: '状态更新成功' });
  } catch (error) {
    await transaction.rollback();
    console.error('更新兑换单状态失败:', error);
    res.json({ code: 500, message: '状态更新失败' });
  }
});

module.exports = router;
