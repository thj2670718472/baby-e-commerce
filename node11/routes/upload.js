var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { verifyImageFile, detectImageExt } = require('../utils/imageFile');
const { checkUploadQuota, consumeUploadQuota } = require('../utils/uploadQuota');

// 只允许常见图片格式，扩展名由服务端决定
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const uploadDir = path.join(__dirname, '../public/uploads/avatars');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'avatar-' + uniqueSuffix + (ALLOWED_EXT.includes(ext) ? ext : '.png'));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImageMime = /^image\//.test(file.mimetype || '');
    if (!ALLOWED_EXT.includes(ext) || !isImageMime) {
      return cb(new Error('仅支持 jpg/png/gif/webp 图片'));
    }
    cb(null, true);
  }
});

// 上传图片
router.post('/image', requireAuth, function(req, res) {
  const quota = checkUploadQuota(req.user.id);
  if (!quota.allowed) {
    return res.json({
      code: 429,
      message: `今日上传已达上限（${quota.limit} 张），请明天再试`
    });
  }

  upload.single('file')(req, res, function(err) {
    if (err) {
      return res.json({ code: 400, message: err.message || '上传失败' });
    }
    if (!req.file) {
      return res.json({ code: 400, message: '请选择图片' });
    }

    // 扩展名与 mimetype 都是客户端可控的，落盘后再按文件头确认真实类型
    if (!verifyImageFile(req.file.path)) {
      return res.json({ code: 400, message: '文件内容不是有效图片' });
    }

    consumeUploadQuota(req.user.id);
    const url = '/uploads/avatars/' + req.file.filename;
    res.json({ code: 200, message: '上传成功', data: { url } });
  });
});

// 上传 base64 图片
router.post('/base64', requireAuth, function(req, res) {
  const quota = checkUploadQuota(req.user.id);
  if (!quota.allowed) {
    return res.json({
      code: 429,
      message: `今日上传已达上限（${quota.limit} 张），请明天再试`
    });
  }

  const base64Data = req.body.image;
  if (!base64Data) {
    return res.json({ code: 400, message: '请提供图片数据' });
  }

  const matches = /^data:image\/(\w+);base64,(.+)$/.exec(base64Data);
  if (!matches) {
    return res.json({ code: 400, message: '图片格式错误' });
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length === 0) {
    return res.json({ code: 400, message: '图片数据为空' });
  }
  if (buffer.length > MAX_SIZE) {
    return res.json({ code: 400, message: '图片不能超过 5MB' });
  }

  // 扩展名按真实内容决定，不信任 data URI 里声明的类型
  const ext = detectImageExt(buffer);
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return res.json({ code: 400, message: '文件内容不是有效图片' });
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = 'avatar-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  consumeUploadQuota(req.user.id);
  const url = '/uploads/avatars/' + filename;
  res.json({ code: 200, message: '上传成功', data: { url } });
});

module.exports = router;
