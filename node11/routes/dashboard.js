var express = require('express');
var router = express.Router();
const { Op } = require('sequelize');
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

// 近 N 日趋势（仅管理员）
// 口径与 statistics 的 totalSales 一致：已完成订单的明细小计之和；
// 日期维度统一按「下单日期」聚合，保证销售额与订单数两条曲线可比。
router.get('/trend', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const rows = await order_goods.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('order.orderTime')), 'date'],
        [sequelize.fn('SUM', sequelize.col('order_goods.subtotal')), 'sales'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('order.id'))), 'orders']
      ],
      include: [{
        model: order,
        as: 'order',
        attributes: [],
        where: {
          status: '已完成',
          orderTime: { [Op.gte]: start }
        }
      }],
      group: [sequelize.fn('DATE', sequelize.col('order.orderTime'))],
      raw: true
    });

    const hit = new Map();
    rows.forEach((row) => {
      // mysql2 对 DATE() 可能返回字符串或 Date，统一取前 10 位
      hit.set(String(row.date).slice(0, 10), row);
    });

    const pad = (value) => String(value).padStart(2, '0');
    const list = [];

    // 没有订单的日期也要补 0，否则前端折线会断开
    for (let i = 0; i < days; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);

      const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      const row = hit.get(date);

      list.push({
        date,
        label: `${pad(day.getMonth() + 1)}-${pad(day.getDate())}`,
        sales: row ? Math.round(Number(row.sales) * 100) / 100 : 0,
        orders: row ? Number(row.orders) : 0
      });
    }

    const today = list[list.length - 1];

    res.json({
      code: 200,
      data: {
        days,
        list,
        today: { date: today.date, sales: today.sales, orders: today.orders }
      },
      message: '获取趋势数据成功'
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ code: 500, message: '获取趋势数据失败' });
  }
});

module.exports = router;
