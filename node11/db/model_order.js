function model_order(db, SEQ) {
  const order = db.define('order', {
    orderNo: {
      type: SEQ.STRING,
      allowNull: false,
      unique: true,
      comment: '订单号'
    },
    userId: {
      type: SEQ.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    userName: {
      type: SEQ.STRING,
      allowNull: false,
      comment: '用户名'
    },
    totalAmount: {
      type: SEQ.DECIMAL(10, 2),
      allowNull: false,
      comment: '订单总金额（实付）'
    },
    originalAmount: {
      type: SEQ.DECIMAL(10, 2),
      defaultValue: 0,
      comment: '原价（优惠前）'
    },
    couponId: {
      type: SEQ.INTEGER,
      defaultValue: null,
      comment: '使用的优惠券ID'
    },
    couponAmount: {
      type: SEQ.DECIMAL(10, 2),
      defaultValue: 0,
      comment: '优惠券抵扣金额'
    },
    status: {
      type: SEQ.ENUM('待付款', '已付款', '已发货', '已完成', '已取消', '退货中', '已退货'),
      allowNull: false,
      defaultValue: '待付款',
      comment: '订单状态'
    },
    address: {
      type: SEQ.TEXT,
      allowNull: false,
      comment: '收货地址'
    },
    phone: {
      type: SEQ.STRING,
      allowNull: false,
      comment: '联系电话'
    },
    paymentMethod: {
      type: SEQ.STRING,
      allowNull: false,
      comment: '支付方式'
    },
    orderTime: {
      type: SEQ.DATE,
      allowNull: false,
      defaultValue: SEQ.NOW,
      comment: '下单时间'
    },
    returnReason: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '退货理由'
    },
    returnTime: {
      type: SEQ.DATE,
      allowNull: true,
      comment: '退货申请时间'
    },
    returnPreviousStatus: {
      type: SEQ.ENUM('已付款', '已发货', '已完成'),
      allowNull: true,
      comment: '申请退货前的订单状态，用于审核拒绝后恢复'
    },
    // ========== 软删除 ==========
    isDeleted: {
      type: SEQ.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '用户删除标记：用户端不可见，保留记录供后台统计与售后追溯'
    },
    // ========== 秒杀 ==========
    seckillGoodsId: {
      type: SEQ.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: '秒杀商品ID；为空表示普通订单。取消/超时释放时按它回补秒杀库存'
    },
    // ========== 新增物流字段 ==========
    logisticsCompany: {
      type: SEQ.STRING(100),
      allowNull: true,
      comment: '物流公司'
    },
    logisticsNo: {
      type: SEQ.STRING(100),
      allowNull: true,
      comment: '快递单号'
    },
    shipTime: {
      type: SEQ.DATE,
      allowNull: true,
      comment: '发货时间'
    }
  }, {
    tableName: 'tb_order',
    freezeTableName: true
  });
  return order;
}
module.exports = model_order;