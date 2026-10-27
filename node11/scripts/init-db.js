/**
 * 一键初始化数据库：建库 → 同步表结构 → 灌入演示数据 → 创建管理员账号
 * 用法：npm run init-db（可重复执行，演示数据按名称去重，已有的不会重复插入）
 */
const mysql = require('mysql2/promise');
const config = require('../utils/config');
const tableComments = require('../db/tableComments');

async function createDatabase() {
  // 先不指定数据库连接，把库建出来，mysqldb 才能连上
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
  );
  await conn.end();
  console.log(`数据库 ${config.db.name} 已就绪`);
}

async function ensureAdmin() {
  const db = require('../db/mysqldb');
  const userDal = require('../db/userdal');
  const crypto = require('crypto');
  const username = config.admin.username;

  const existed = await db.user.findOne({ where: { username } });
  if (existed) {
    if (existed.role !== 'admin') {
      throw new Error(`管理员用户名 "${username}" 已被普通账号占用，请更换 ADMIN_USERNAME 后重试`);
    }
    console.log(`管理员账号 "${username}" 已存在，跳过创建`);
    return;
  }

  const configuredPassword = config.admin.initialPassword;
  if (configuredPassword && (configuredPassword.length < 12 || configuredPassword.length > 64)) {
    throw new Error('ADMIN_INITIAL_PASSWORD 长度需为 12-64 个字符');
  }
  const initialPassword = configuredPassword || crypto.randomBytes(12).toString('base64url');
  await userDal.addUser({ username, password: initialPassword, role: 'admin' });
  console.log(`已创建管理员账号 ${username}`);
  if (configuredPassword) {
    console.log('管理员初始密码已使用 ADMIN_INITIAL_PASSWORD，请登录后尽快修改');
  } else {
    console.log(`管理员初始密码（仅显示一次）：${initialPassword}`);
    console.log('请妥善保存并尽快登录修改');
  }
}

async function ensureColumn(db, { table, column, definition }) {
  const [rows] = await db.sequelize.query(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS ' +
    'WHERE table_schema = :schema AND table_name = :table AND column_name = :column',
    { replacements: { schema: config.db.name, table, column } }
  );
  if (rows[0].n) return false;
  await db.sequelize.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`
  );
  console.log(`已为 ${table} 补建 ${column} 列`);
  return true;
}

async function ensureUniqueIndex(db, { table, indexName, columns, notNullColumns = [] }) {
  const [indexRows] = await db.sequelize.query(
    'SELECT COUNT(*) AS n FROM information_schema.STATISTICS ' +
    'WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table AND INDEX_NAME = :indexName',
    { replacements: { schema: config.db.name, table, indexName } }
  );
  if (indexRows[0].n) return;

  const columnList = columns.map((column) => `\`${column}\``).join(', ');
  const notNullWhere = notNullColumns.length
    ? ' WHERE ' + notNullColumns.map((column) => `\`${column}\` IS NOT NULL`).join(' AND ')
    : '';
  const [duplicates] = await db.sequelize.query(
    `SELECT ${columnList}, COUNT(*) AS total FROM \`${table}\`${notNullWhere} ` +
    `GROUP BY ${columnList} HAVING COUNT(*) > 1 LIMIT 1`
  );
  if (duplicates.length) {
    throw new Error(`表 ${table} 存在重复数据，无法创建唯一索引 ${indexName}，请先清理重复记录`);
  }

  try {
    await db.sequelize.query(
      `ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${indexName}\` (${columnList})`
    );
    console.log(`已为 ${table} 创建唯一索引 ${indexName}`);
  } catch (error) {
    // sync 已提前创建同名索引时保持幂等
    const code = (error.original && error.original.code) ||
      (error.parent && error.parent.code) ||
      error.code;
    if (code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(error.message || '')) return;
    throw error;
  }
}

/**
 * sync 只建新表、不改已有表：模型后续新增/变更的列在这里按需迁移
 */
async function migrateExistingTables() {
  const db = require('../db/mysqldb');

  // tb_user.role：权限不再由用户名推断；仅首次补列时迁移旧管理员
  const [roleCols] = await db.sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS " +
    "WHERE table_schema = :schema AND table_name = 'tb_user' AND column_name = 'role'",
    { replacements: { schema: config.db.name } }
  );
  if (!roleCols[0].n) {
    await db.sequelize.query(
      "ALTER TABLE `tb_user` ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'user'"
    );
    await db.sequelize.query(
      'UPDATE `tb_user` SET `role` = :role WHERE `username` = :username',
      { replacements: { role: 'admin', username: config.admin.username } }
    );
    console.log('已为 tb_user 补建 role 列并迁移旧管理员');
  }

  // tb_goods.price：整数列 → DECIMAL(10,2)，MODIFY 幂等可重复执行
  await db.sequelize.query(
    "ALTER TABLE `tb_goods` MODIFY `price` DECIMAL(10,2) NOT NULL COMMENT '商品单价，支持两位小数'"
  );

  // tb_order.isDeleted：软删除标记，老库缺列时补上
  const [rows] = await db.sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS " +
    "WHERE table_schema = :schema AND table_name = 'tb_order' AND column_name = 'isDeleted'",
    { replacements: { schema: config.db.name } }
  );
  if (!rows[0].n) {
    await db.sequelize.query(
      "ALTER TABLE `tb_order` ADD COLUMN `isDeleted` TINYINT(1) NOT NULL DEFAULT 0 " +
      "COMMENT '用户删除标记：用户端不可见，保留记录供后台统计与售后追溯'"
    );
    console.log('已为 tb_order 补建 isDeleted 列');
  }

  // tb_order.seckillGoodsId：秒杀订单标记，老库缺列时补上
  const [sgCols] = await db.sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS " +
    "WHERE table_schema = :schema AND table_name = 'tb_order' AND column_name = 'seckillGoodsId'",
    { replacements: { schema: config.db.name } }
  );
  if (!sgCols[0].n) {
    await db.sequelize.query(
      "ALTER TABLE `tb_order` ADD COLUMN `seckillGoodsId` INT NULL DEFAULT NULL " +
      "COMMENT '秒杀商品ID；为空表示普通订单'"
    );
    console.log('已为 tb_order 补建 seckillGoodsId 列');
  }

  // tb_order.returnPreviousStatus：退货审核拒绝后恢复原状态
  const [returnStatusCols] = await db.sequelize.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS " +
    "WHERE table_schema = :schema AND table_name = 'tb_order' AND column_name = 'returnPreviousStatus'",
    { replacements: { schema: config.db.name } }
  );
  if (!returnStatusCols[0].n) {
    await db.sequelize.query(
      "ALTER TABLE `tb_order` ADD COLUMN `returnPreviousStatus` " +
      "ENUM('已付款','已发货','已完成') NULL DEFAULT NULL COMMENT '申请退货前的订单状态'"
    );
    console.log('已为 tb_order 补建 returnPreviousStatus 列');
  }

  // 优惠券模板运营字段
  await ensureColumn(db, {
    table: 'tb_coupon_template',
    column: 'validityDays',
    definition: "INT NOT NULL DEFAULT 3 COMMENT '领取后有效天数'"
  });
  await ensureColumn(db, {
    table: 'tb_coupon_template',
    column: 'perUserLimit',
    definition: "INT NOT NULL DEFAULT 1 COMMENT '单个用户最多可领取数量'"
  });
  await ensureColumn(db, {
    table: 'tb_coupon_template',
    column: 'description',
    definition: "VARCHAR(255) NULL COMMENT '优惠券说明'"
  });

  // 用户优惠券发放与作废审计字段
  await ensureColumn(db, {
    table: 'tb_user_coupon',
    column: 'source',
    definition: "VARCHAR(20) NOT NULL DEFAULT 'draw' COMMENT '发放来源：draw/manual'"
  });
  await ensureColumn(db, {
    table: 'tb_user_coupon',
    column: 'issuedBy',
    definition: "INT NULL COMMENT '手动发放操作人ID'"
  });
  await ensureColumn(db, {
    table: 'tb_user_coupon',
    column: 'revokeTime',
    definition: "DATETIME NULL COMMENT '作废时间'"
  });
  await ensureColumn(db, {
    table: 'tb_user_coupon',
    column: 'revokedBy',
    definition: "INT NULL COMMENT '作废操作人ID'"
  });
  await ensureColumn(db, {
    table: 'tb_user_coupon',
    column: 'revokeRemark',
    definition: "VARCHAR(255) NULL COMMENT '作废原因'"
  });

  // 发放记录来源，兼容自动抽奖和后台批量发放
  await ensureColumn(db, {
    table: 'tb_coupon_draw_record',
    column: 'source',
    definition: "VARCHAR(20) NOT NULL DEFAULT 'draw' COMMENT '发放来源：draw/manual'"
  });
  await ensureColumn(db, {
    table: 'tb_coupon_draw_record',
    column: 'operatorId',
    definition: "INT NULL COMMENT '操作人ID，自动抽奖为空'"
  });

  // 积分商品详情与兑换规则
  await ensureColumn(db, {
    table: 'tb_points_goods',
    column: 'detail',
    definition: "TEXT NULL COMMENT '商品详细介绍'"
  });
  const addedRedeemLimit = await ensureColumn(db, {
    table: 'tb_points_goods',
    column: 'redeemLimit',
    definition: "INT NOT NULL DEFAULT 0 COMMENT '每人限兑数量，0表示不限'"
  });
  if (addedRedeemLimit) {
    // 仅在首次补列时给示例商品写入限兑数量，后续不覆盖后台配置
    const { sampleGoods } = require('./init_points_shop');
    for (const sample of sampleGoods) {
      await db.pointsGoods.update(
        { redeemLimit: sample.redeemLimit },
        { where: { name: sample.name, redeemLimit: 0 } }
      );
    }
  }
  await ensureColumn(db, {
    table: 'tb_points_goods',
    column: 'shippingNote',
    definition: "VARCHAR(255) NULL COMMENT '配送说明'"
  });
  await ensureColumn(db, {
    table: 'tb_points_goods',
    column: 'rules',
    definition: "TEXT NULL COMMENT '兑换规则'"
  });

  await ensureUniqueIndex(db, {
    table: 'tb_user',
    indexName: 'uq_tb_user_username',
    columns: ['username']
  });
  await ensureUniqueIndex(db, {
    table: 'tb_user_draw_record',
    indexName: 'uq_user_week_draw',
    columns: ['userId', 'yearNumber', 'weekNumber']
  });
  await ensureUniqueIndex(db, {
    table: 'tb_review',
    indexName: 'uq_review_order_goods_user',
    columns: ['orderId', 'goodsId', 'userId'],
    notNullColumns: ['orderId']
  });

  // 表注释使用固定内部配置，转义后写入，已有库重复执行无副作用
  for (const [table, comment] of Object.entries(tableComments)) {
    const escaped = comment.replace(/\\/g, '\\\\').replace(/'/g, "''");
    await db.sequelize.query(`ALTER TABLE \`${table}\` COMMENT = '${escaped}'`);
  }
  console.log(`已更新 ${Object.keys(tableComments).length} 张数据表注释`);
}

(async () => {
  try {
    await createDatabase();

    const db = require('../db/mysqldb');
    await db.sequelize.authenticate();
    await db.sequelize.sync();
    console.log('表结构同步完成');
    await migrateExistingTables();

    await require('./seed_goods').run();
    await require('./init_baby_culture').run();
    await require('./init_points_shop').run();
    await require('./init_coupons').run();
    await require('./init_seckill').run();

    await ensureAdmin();

    console.log('数据库初始化完成');
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    process.exit(1);
  }
})();
