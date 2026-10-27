/**
 * jest globalSetup：在所有测试加载前确保测试库存在
 * 正式库完全不受影响 —— 测试脚本通过 DB_NAME 环境变量把所有连接指向测试库
 */
const mysql = require('mysql2/promise');
const config = require('../utils/config');

// 防呆：测试只允许跑在 *_test 库上。直接 npx jest（没带 DB_NAME）会连到 .env 里的正式库，必须拒绝
if (!/_test$/.test(config.db.name)) {
  throw new Error(
    `拒绝执行测试：当前数据库是 "${config.db.name}"，测试只允许跑在 *_test 库上。\n` +
    '请使用 npm test（自动设置 DB_NAME=dbbabycity_test）；\n' +
    '跑单个文件用：npm test -- test/orders.test.js'
  );
}

module.exports = async () => {
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
  console.log(`测试库 ${config.db.name} 已就绪`);
};
