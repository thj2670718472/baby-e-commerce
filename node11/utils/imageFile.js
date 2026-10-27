/**
 * 图片文件头校验
 * 扩展名与 Content-Type 都由客户端提供，可以随意伪造。
 * 落盘后按真实字节判断，避免把 HTML/脚本伪装成 .jpg 存进可公开访问的静态目录。
 */
const fs = require('fs');

const MIN_HEAD_BYTES = 12;
const DEFAULT_HEAD_LENGTH = 16;

const SIGNATURES = [
  {
    ext: '.jpg',
    test: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    ext: '.png',
    test: (buffer) => buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  },
  {
    ext: '.gif',
    test: (buffer) => buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF'
  },
  {
    ext: '.webp',
    test: (buffer) => buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  }
];

/**
 * 按文件头识别图片类型
 * @param {Buffer} buffer
 * @returns {string|null} 命中的扩展名，未命中返回 null
 */
function detectImageExt(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < MIN_HEAD_BYTES) return null;
  const matched = SIGNATURES.find((item) => item.test(buffer));
  return matched ? matched.ext : null;
}

function readFileHead(filePath, length = DEFAULT_HEAD_LENGTH) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytes = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.slice(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 校验已落盘的文件确实是图片；不是图片时直接删除并返回 null
 * @param {string} filePath
 * @returns {string|null}
 */
function verifyImageFile(filePath) {
  let head;
  try {
    head = readFileHead(filePath);
  } catch (error) {
    return null;
  }

  const ext = detectImageExt(head);
  if (!ext) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      // 删除失败不影响本次请求的拒绝结果
    }
    return null;
  }
  return ext;
}

module.exports = { detectImageExt, verifyImageFile };
