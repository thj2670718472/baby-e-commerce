module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // 所有测试开始前先创建测试库（库名由 npm test 里的 DB_NAME 指定）
  globalSetup: './test/global-setup.js',
  // 单个用例的超时上限，涉及真实 MySQL，放宽一些
  testTimeout: 15000
};
