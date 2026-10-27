var express = require('express');
var router = express.Router();
const { goods, category, order, user, baby, order_goods, sequelize } = require('../db/mysqldb');
const { requireAdmin } = require('../middleware/auth');

// 获取仪表盘统计数据（仅管理员）
// 响应字段与 vue11 看板一一对应，增删字段需要同步改前端
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    // 一条 JOIN 聚合算出总销售额（已完成订单的明细 subtotal 之和），替代把全部明细拉到内存累加
    const salesRow = await order_goods.findOne({
      attributes: [[sequelize.fn('SUM', sequelize.col('order_goods.subtotal')), 'totalSales']],
      include: [{
        model: order,
        as: 'order',
        attributes: [],
        where: { status: '已完成' }
      }],
      raw: true
    });
    const totalSales = Math.round(Number(salesRow ? salesRow.totalSales : 0) * 100) / 100;

    const [totalProducts, productTypes, productCategories, totalOrders, completedOrders, totalUsers, babyCount] =
      await Promise.all([
        goods.count(),
        goods.count({ distinct: true, col: 'category' }),
        category.count(),
        order.count(),
        order.count({ where: { status: '已完成' } }),
        user.count(),
        baby.count()
      ]);

    // 历史契约：字段平铺返回（vue11 看板与 test/dashboard.test.js 均按此结构断言）
    res.json({
      totalSales,
      totalOrders,
      totalProducts,
      totalUsers,
      productTypes,
      productCategories,
      completedOrders,
      babyCount
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ code: 500, message: '获取统计数据失败' });
  }
});

module.exports = router;
