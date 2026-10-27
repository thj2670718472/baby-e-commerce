module.exports = function(sequelize, DataTypes) {
  return sequelize.define('review', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '订单ID'
    },
    goodsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '商品ID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    userName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '用户名'
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      },
      comment: '评分 1-5星'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '评价内容'
    },
    images: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '评价图片 JSON 数组'
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '状态：0-待审核，1-已通过，2-已拒绝'
    },
    createTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '创建时间'
    },
    updateTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: '更新时间'
    }
  }, {
    tableName: 'tb_review',
    timestamps: false,
    indexes: [{
      name: 'uq_review_order_goods_user',
      unique: true,
      fields: ['orderId', 'goodsId', 'userId']
    }]
  });
};