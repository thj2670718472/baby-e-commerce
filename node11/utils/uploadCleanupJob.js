/**
 * 过期上传文件清理
 *
 * 只清理 uploads/chat（聊天图片）：头像与商品图共用 uploads/avatars，
 * 无法从文件名判断是否仍被商品/用户引用，贸然删除会破坏线上数据。
 */
const fs = require('fs');
const path = require('path');

const CHAT_DIR = path.join(__dirname, '../public/uploads/chat');
const RETENTION_DAYS = Math.max(1, Number(process.env.UPLOAD_RETENTION_DAYS) || 90);
const SCAN_INTERVAL = 6 * 60 * 60 * 1000;

function cleanupExpiredChatImages(now = Date.now()) {
  if (!fs.existsSync(CHAT_DIR)) return { scanned: 0, removed: 0 };

  const deadline = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let scanned = 0;
  let removed = 0;

  for (const name of fs.readdirSync(CHAT_DIR)) {
    const filePath = path.join(CHAT_DIR, name);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (error) {
      continue;
    }
    if (!stat.isFile()) continue;

    scanned += 1;
    if (stat.mtimeMs < deadline) {
      try {
        fs.unlinkSync(filePath);
        removed += 1;
      } catch (error) {
        console.error(`[上传清理] 删除失败 ${name}:`, error.message);
      }
    }
  }

  return { scanned, removed };
}

function startUploadCleanupJob() {
  const run = () => {
    try {
      const { removed } = cleanupExpiredChatImages();
      if (removed > 0) {
        console.log(`[上传清理] 已删除 ${removed} 个超过 ${RETENTION_DAYS} 天的聊天图片`);
      }
    } catch (error) {
      console.error('[上传清理] 检查失败:', error.message);
    }
  };

  run();
  const timer = setInterval(run, SCAN_INTERVAL);
  timer.unref();
  return timer;
}

module.exports = { startUploadCleanupJob, cleanupExpiredChatImages, RETENTION_DAYS };
