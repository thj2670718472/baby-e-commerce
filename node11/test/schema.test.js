/**
 * 数据表注释：确保每个模型表都有表级注释，且新建数据库中真实生效
 */
const db = require('../db/mysqldb');
const tableComments = require('../db/tableComments');

beforeAll(async () => {
  await db.syncPromise;
  await db.sequelize.sync({ force: true });
});

afterAll(async () => {
  await db.sequelize.close();
});

test('所有模型数据表都有表级注释', async () => {
  const modelTables = [...new Set(
    Object.values(db.sequelize.models)
      .map((model) => model.getTableName())
      .filter((table) => typeof table === 'string')
  )];

  expect(modelTables.length).toBeGreaterThan(0);
  for (const table of modelTables) {
    if (!tableComments[table]) {
      throw new Error(`缺少 ${table} 的表注释配置`);
    }
  }

  const [rows] = await db.sequelize.query(
    'SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS tableComment ' +
    'FROM information_schema.TABLES ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (:tables)',
    { replacements: { tables: modelTables } }
  );
  const actual = new Map(rows.map((row) => [row.tableName, row.tableComment]));

  for (const table of modelTables) {
    expect(actual.get(table)).toBe(tableComments[table]);
  }
});
