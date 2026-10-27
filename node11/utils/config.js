/**
 * 统一配置入口
 * 所有敏感信息（数据库密码、JWT 密钥、AI Key）都从 .env 读取，不再写死在代码里。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envFile = path.join(__dirname, '..', '.env');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  // Node 20.12+ 原生支持读取 .env
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(file);
      return;
    } catch (e) {
      console.warn('[config] 使用 process.loadEnvFile 读取 .env 失败，改用内置解析:', e.message);
    }
  }

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(envFile);

const splitList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const toNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';

// 示例文件里的占位值等同于公开密钥，绝不能再拿来签 token
const INSECURE_JWT_SECRETS = new Set([
  'replace_with_a_random_secret',
  'your_jwt_secret',
  'your_secret',
  'jwt_secret',
  'changeme',
  'secret',
]);
const MIN_JWT_SECRET_LENGTH = 32;

function resolveJwtSecret() {
  const configured = String(process.env.JWT_SECRET || '').trim();
  const randomSecret = () => crypto.randomBytes(32).toString('hex');

  if (configured) {
    const isPlaceholder = INSECURE_JWT_SECRETS.has(configured.toLowerCase());
    const tooShort = configured.length < MIN_JWT_SECRET_LENGTH;
    if (!isPlaceholder && !tooShort) return configured;

    const reason = isPlaceholder ? '仍是 .env.example 里的占位值' : `长度不足 ${MIN_JWT_SECRET_LENGTH} 个字符`;
    if (nodeEnv === 'production') {
      throw new Error(
        `[config] JWT_SECRET ${reason}，拒绝启动。生成方式：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
      );
    }
    console.warn(`[config] JWT_SECRET ${reason}，已改用进程级随机密钥（重启后需重新登录）`);
    return randomSecret();
  }

  if (nodeEnv === 'production') {
    throw new Error('[config] 生产环境必须显式配置 JWT_SECRET');
  }
  console.warn('[config] 未配置 JWT_SECRET，已生成临时密钥（服务重启后需重新登录）');
  return randomSecret();
}

const jwtSecret = resolveJwtSecret();

const defaultCorsOrigins = [
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

const corsOrigins = Array.from(
  new Set([...defaultCorsOrigins, ...splitList(process.env.CORS_ORIGINS)])
);

module.exports = {
  nodeEnv,
  port: toNumber(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toNumber(process.env.DB_PORT, 3306),
    name: process.env.DB_NAME || 'dbbabycity',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
    pool: { max: 5, min: 0, idle: 10000 },
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    initialPassword: process.env.ADMIN_INITIAL_PASSWORD || '',
  },
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.AI_MODEL || 'deepseek-chat',
  },
  cors: {
    origins: corsOrigins,
  },
  // 部署在 Nginx / 负载均衡后面时配置（如 1 或 loopback），否则 req.ip 恒为代理地址
  trustProxy: process.env.TRUST_PROXY || '',
  rateLimit: {
    // 全局兜底限流：单 IP 每分钟请求数
    globalMax: toNumber(process.env.RATE_LIMIT_MAX, 300),
    // 登录接口单 IP 每 10 分钟尝试次数
    loginMax: toNumber(process.env.LOGIN_RATE_MAX, 20),
  },
};
