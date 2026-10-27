function model_points_goods(db, SEQ) {
  return db.define('points_goods', {
    name: {
      type: SEQ.STRING(100),
      allowNull: false,
      comment: '积分商品名称'
    },
    image: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '商品图片'
    },
    description: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '商品简短描述'
    },
    detail: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '商品详细介绍'
    },
    redeemLimit: {
      type: SEQ.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '每人限兑数量，0 表示不限'
    },
    shippingNote: {
      type: SEQ.STRING(255),
      allowNull: true,
      comment: '配送说明'
    },
    rules: {
      type: SEQ.TEXT,
      allowNull: true,
      comment: '兑换规则'
    },
    points: {
      type: SEQ.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '兑换所需积分'
    },
    stock: {
      type: SEQ.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '库存'
    },
    status: {
      type: SEQ.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '是否上架'
    },
    sort: {
      type: SEQ.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '排序，越大越靠前'
    },
    createTime: {
      type: SEQ.DATE,
      defaultValue: SEQ.NOW
    }
  }, {
    tableName: 'tb_points_goods',
    freezeTableName: true,
    timestamps: false
  });
}
module.exports = model_points_goods;
