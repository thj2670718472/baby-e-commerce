function model_goods(db, SEQ) {
  const goods = db.define('goods', {
    name: {
      type: SEQ.STRING,
      allowNull: false
    },
    quantity: {
      type: SEQ.INTEGER,
      allowNull: false
    },
    category: {
      type: SEQ.STRING,
      allowNull: false
    },
    price: {
      type: SEQ.DECIMAL(10, 2),
      allowNull: false,
      comment: '商品单价，支持两位小数'
    },
    status: {
      type: SEQ.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    // 商品图片数组（JSON格式）
    images: {
      type: SEQ.TEXT('mediumtext'),
      allowNull: true,
      defaultValue: '[]',
      comment: '商品图片URL数组'
    },
    // 商品描述字段
    description: {
      type: SEQ.TEXT,
      allowNull: true,
      defaultValue: '',
      comment: '商品描述'
    },
    sales: { type: SEQ.INTEGER, 
             allowNull: true, 
             defaultValue: 0, 
             comment: '销量' 
    }  
  }, {
    tableName: 'tb_goods',
    forizeen: true
  });
  return goods;
}
module.exports = model_goods;
