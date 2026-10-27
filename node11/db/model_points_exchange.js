function model_points_exchange(db, SEQ) {
  return db.define('points_exchange', {
    userId: {
      type: SEQ.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    pointsGoodsId: {
      type: SEQ.INTEGER,
      allowNull: false,
      comment: '积分商品ID'
    },
    goodsName: {
      type: SEQ.STRING(100),
      allowNull: false,
      comment: '兑换时的商品名称快照'
    },
    goodsImage: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '兑换时的商品图片快照'
    },
    points: {
      type: SEQ.INTEGER,
      allowNull: false,
      comment: '本次消耗积分'
    },
    quantity: {
      type: SEQ.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '兑换数量'
    },
    status: {
      type: SEQ.ENUM('待发货', '已发货', '已完成', '已取消'),
      allowNull: false,
      defaultValue: '待发货',
      comment: '兑换单状态'
    },
    address: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '收货地址'
    },
    phone: {
      type: SEQ.STRING(30),
      allowNull: true,
      comment: '联系电话'
    },
    createTime: {
      type: SEQ.DATE,
      defaultValue: SEQ.NOW
    }
  }, {
    tableName: 'tb_points_exchange',
    freezeTableName: true,
    timestamps: false
  });
}
module.exports = model_points_exchange;
