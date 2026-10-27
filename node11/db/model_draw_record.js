module.exports = function(sequelize, DataTypes) {
  const UserDrawRecord = sequelize.define('UserDrawRecord', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '用户ID'
    },
    drawDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '抽取日期'
    },
    weekNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '周数'
    },
    yearNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '年份'
    },
    createTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'tb_user_draw_record',
    timestamps: false,
    indexes: [{
      name: 'uq_user_week_draw',
      unique: true,
      fields: ['userId', 'yearNumber', 'weekNumber']
    }]
  });
  
  return { UserDrawRecord };
};