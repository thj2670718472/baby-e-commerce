/**
 * 仅更新已有数据库的表注释，不插入演示数据、不修改业务记录。
 * 用法：npm run db:comments
 */
const config = require('../utils/config');
const db = require('../db/mysqldb');
const tableComments = require('../db/tableComments');

async function applyTableComments() {
  await db.syncPromise;

  const [existingRows] = await db.sequelize.query(
    'SELECT TABLE_NAME AS tableName FROM information_schema.TABLES ' +
    'WHERE TABLE_SCHEMA = :schema',
    { replacements: { schema: config.db.name } }
  );
  const existingTables = new Set(existingRows.map((row) => row.tableName));

  let updated = 0;
  const missing = [];
  for (const [table, comment] of Object.entries(tableComments)) {
    if (!existingTables.has(table)) {
      missing.push(table);
      continue;
    }
    const escaped = comment.replace(/\\/g, '\\\\').replace(/'/g, "''");
    await db.sequelize.query(`ALTER TABLE \`${table}\` COMMENT = '${escaped}'`);
    updated += 1;
  }

  const [verifyRows] = await db.sequelize.query(
    'SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS tableComment ' +
    'FROM information_schema.TABLES WHERE TABLE_SCHEMA = :schema',
    { replacements: { schema: config.db.name } }
  );
  const comments = new Map(verifyRows.map((row) => [row.tableName, row.tableComment]));

  console.log(`数据库：${config.db.name}`);
  console.log(`已更新表注释：${updated} 张`);
  if (missing.length) console.log(`数据库中不存在、已跳过：${missing.join(', ')}`);

  for (const table of Object.keys(tableComments)) {
    if (!existingTables.has(table)) continue;
    console.log(`${table}: ${comments.get(table) || '(空)'}`);
  }
}

applyTableComments()
  .then(async () => {
    await db.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('更新表注释失败:', error.message);
    try {
      await db.sequelize.close();
    } catch (closeError) {
      // 忽略关闭失败，保留原始错误
    }
    process.exit(1);
  });
