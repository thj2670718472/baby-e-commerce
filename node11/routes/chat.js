var express = require('express');
var router = express.Router();
var db = require('../db/mysqldb');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { verifyImageFile } = require('../utils/imageFile');
const { checkUploadQuota, consumeUploadQuota } = require('../utils/uploadQuota');

// 上传配置：只允许图片，且限制大小
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 扩展名只从白名单取，不使用用户提交的原始文件名
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'chat-' + uniqueSuffix + (ALLOWED_IMAGE_EXT.includes(ext) ? ext : '.png'));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImageMime = /^image\//.test(file.mimetype || '');
    if (!ALLOWED_IMAGE_EXT.includes(ext) || !isImageMime) {
      return cb(new Error('仅支持 jpg/png/gif/webp 图片'));
    }
    cb(null, true);
  }
});

// ==================== 图片上传 ====================

// 上传聊天图片
router.post('/upload', requireAuth, function(req, res) {
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

    // 按文件头确认是真实图片，避免伪造扩展名的文件进入公开静态目录
    if (!verifyImageFile(req.file.path)) {
      return res.json({ code: 400, message: '文件内容不是有效图片' });
    }

    consumeUploadQuota(req.user.id);
    const url = '/uploads/chat/' + req.file.filename;
    res.json({ code: 200, message: '上传成功', data: { url } });
  });
});

// ==================== 用户端接口 ====================

// 获取或创建用户会话（每个用户只有一个会话）
router.post('/session/get', requireAuth, async (req, res) => {
  try {
    // 归属用户只能来自登录态，名称与头像以数据库为准
    const userId = req.user.id;
    const user = await db.user.findByPk(userId);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }
    const userName = user.username;
    const userAvatar = user.avatar || '';

    // 查找现有会话
    let session = await db.ChatSession.findOne({
      where: { userId: userId, status: 1 }
    });

    if (!session) {
      // 创建新会话
      session = await db.ChatSession.create({
        userId: userId,
        userName: userName,
        userAvatar: userAvatar || '',
        lastMessage: '开始咨询',
        lastTime: new Date(),
        unreadCount: 0,
        userUnreadCount: 0,
        status: 1
      });
      
      // 自动发送欢迎消息
      await db.ChatMessage.create({
        sessionId: session.id,
        senderId: 1, // 管理员ID
        senderName: '客服',
        senderType: 'admin',
        receiverId: userId,
        messageType: 'text',
        content: '您好！请问有什么可以帮您的？',
        isRead: 0,
        createTime: new Date()
      });
    } else if (session.userName !== userName || session.userAvatar !== userAvatar) {
      // 用户可能修改过用户名或头像，会话快照需要同步为最新资料
      await session.update({ userName, userAvatar });
    }

    res.json({ code: 200, data: session, message: '获取会话成功' });
  } catch (error) {
    console.error('========== 获取会话失败 ==========');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('===================================');
    res.json({ code: 500, message: '获取会话失败' });
  }
});

// 获取用户会话信息
router.get('/session/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user.id) !== String(req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的会话' });
    }

    const session = await db.ChatSession.findOne({
      where: { userId: req.params.userId, status: 1 }
    });
    res.json({ code: 200, data: session });
  } catch (error) {
    console.error('获取会话失败:', error);
    res.json({ code: 500, message: '获取会话失败' });
  }
});

// 获取用户消息列表
router.get('/messages/:sessionId', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    const session = await db.ChatSession.findByPk(sessionId);
    if (!session) {
      return res.json({ code: 404, message: '会话不存在' });
    }
    if (req.user.role !== 'admin' && String(session.userId) !== String(req.user.id)) {
      return res.status(403).json({ code: 403, message: '无权查看该会话' });
    }

    const messages = await db.ChatMessage.findAll({
      where: { sessionId: sessionId },
      order: [['createTime', 'ASC']]
    });

    // 标记管理员消息为已读
    await db.ChatMessage.update(
      { isRead: 1 },
      { where: { sessionId: sessionId, senderType: 'admin', isRead: 0 } }
    );
    
    // 清空用户未读数
    await db.ChatSession.update(
      { userUnreadCount: 0 },
      { where: { id: sessionId } }
    );
    
    res.json({ code: 200, data: messages, message: '获取消息成功' });
  } catch (error) {
    console.error('获取消息失败:', error);
    res.json({ code: 500, message: '获取消息失败' });
  }
});

// 用户发送消息
router.post('/message/send', requireAuth, async (req, res) => {
  try {
    const { sessionId, messageType, content } = req.body;

    if (!sessionId || !content) {
      return res.json({ code: 400, message: '参数不完整' });
    }

    const session = await db.ChatSession.findByPk(sessionId);
    if (!session) {
      return res.json({ code: 404, message: '会话不存在' });
    }
    if (req.user.role !== 'admin' && String(session.userId) !== String(req.user.id)) {
      return res.status(403).json({ code: 403, message: '无权在该会话中发言' });
    }

    // 发送者身份以登录态为准，防止冒充他人或客服
    const user = await db.user.findByPk(req.user.id);
    if (!user) {
      return res.json({ code: 404, message: '用户不存在' });
    }

    const message = await db.ChatMessage.create({
      sessionId: sessionId,
      senderId: user.id,
      senderName: user.username,
      senderType: 'user',
      receiverId: 1, // 管理员ID
      messageType: messageType || 'text',
      content: content,
      isRead: 0,
      createTime: new Date()
    });

    // 更新会话
    await db.ChatSession.update({
      lastMessage: messageType === 'text' ? content : '[图片]',
      lastTime: new Date(),
      unreadCount: db.sequelize.literal('unreadCount + 1')
    }, { where: { id: sessionId } });

    res.json({ code: 200, data: message, message: '发送成功' });
  } catch (error) {
    console.error('========== 发送消息失败 ==========');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('===================================');
    res.json({ code: 500, message: '发送失败' });
  }
});

// 获取用户未读消息数
router.get('/unread/:userId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && String(req.user.id) !== String(req.params.userId)) {
      return res.status(403).json({ code: 403, message: '无权查看其他用户的未读数' });
    }

    const userId = req.params.userId;
    const session = await db.ChatSession.findOne({
      where: { userId: userId, status: 1 }
    });
    const count = session ? session.userUnreadCount : 0;
    res.json({ code: 200, data: { count: count } });
  } catch (error) {
    console.error('获取未读数失败:', error);
    res.json({ code: 500, message: '获取未读数失败' });
  }
});

// ==================== 管理员端接口 ====================

// 用用户表最新资料覆盖会话中的历史快照，避免后台显示旧头像或空头像
async function attachLatestUserProfiles(sessions) {
  const userIds = [...new Set(sessions.map((session) => session.userId))];
  const users = userIds.length
    ? await db.user.findAll({
      where: { id: userIds },
      attributes: ['id', 'username', 'avatar']
    })
    : [];
  const userMap = new Map(users.map((user) => [Number(user.id), user]));

  return sessions.map((session) => {
    const data = session.toJSON();
    const user = userMap.get(Number(session.userId));
    if (user) {
      data.userName = user.username;
      data.userAvatar = user.avatar || '';
    }
    return data;
  });
}

// 获取所有会话列表（管理员）
router.get('/admin/sessions', requireAdmin, async (req, res) => {
  try {
    const sessions = await db.ChatSession.findAll({
      where: { status: 1 },
      order: [['lastTime', 'DESC']]
    });
    const data = await attachLatestUserProfiles(sessions);
    res.json({ code: 200, data, message: '获取会话列表成功' });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.json({ code: 500, message: '获取会话列表失败' });
  }
});

// 管理员获取消息列表
router.get('/admin/messages/:sessionId', requireAdmin, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    const messages = await db.ChatMessage.findAll({
      where: { sessionId: sessionId },
      order: [['createTime', 'ASC']]
    });
    
    // 标记用户消息为已读
    await db.ChatMessage.update(
      { isRead: 1 },
      { where: { sessionId: sessionId, senderType: 'user', isRead: 0 } }
    );
    
    // 清空管理员未读数
    await db.ChatSession.update(
      { unreadCount: 0 },
      { where: { id: sessionId } }
    );
    
    res.json({ code: 200, data: messages, message: '获取消息成功' });
  } catch (error) {
    console.error('获取消息失败:', error);
    res.json({ code: 500, message: '获取消息失败' });
  }
});

// 管理员发送消息
router.post('/admin/message/send', requireAdmin, async (req, res) => {
  try {
    const { sessionId, content, messageType } = req.body;
    
    console.log('========== 管理员发送消息 ==========');
    console.log('sessionId:', sessionId);
    console.log('messageType:', messageType);
    console.log('content:', content);
    
    if (!sessionId || !content) {
      return res.json({ code: 400, message: '参数不完整' });
    }
    
    const session = await db.ChatSession.findByPk(sessionId);
    if (!session) {
      return res.json({ code: 404, message: '会话不存在' });
    }
    
    // 创建消息
    const message = await db.ChatMessage.create({
      sessionId: sessionId,
      senderId: 1, // 管理员ID
      senderName: '客服',
      senderType: 'admin',
      receiverId: session.userId,
      messageType: messageType || 'text',
      content: content,
      isRead: 0,
      createTime: new Date()
    });
    
    console.log('消息创建成功，ID:', message.id);
    
    // 更新会话
    await db.ChatSession.update({
      lastMessage: messageType === 'text' ? content : '[图片]',
      lastTime: new Date(),
      userUnreadCount: db.sequelize.literal('userUnreadCount + 1')
    }, { where: { id: sessionId } });
    
    console.log('===================================');
    
    res.json({ code: 200, data: message, message: '发送成功' });
  } catch (error) {
    console.error('========== 发送消息失败 ==========');
    console.error('错误信息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('===================================');
    res.json({ code: 500, message: '发送失败' });
  }
});

// 关闭会话
router.put('/admin/session/close/:sessionId', requireAdmin, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    await db.ChatSession.update(
      { status: 2 },
      { where: { id: sessionId } }
    );
    res.json({ code: 200, message: '会话已关闭' });
  } catch (error) {
    console.error('关闭会话失败:', error);
    res.json({ code: 500, message: '关闭会话失败' });
  }
});

// 获取未读消息总数（管理员）
router.get('/admin/unread/count', requireAdmin, async (req, res) => {
  try {
    const sessions = await db.ChatSession.findAll({ where: { status: 1 } });
    const totalUnread = sessions.reduce((sum, s) => sum + (s.unreadCount || 0), 0);
    res.json({ code: 200, data: { count: totalUnread } });
  } catch (error) {
    console.error('获取未读数失败:', error);
    res.json({ code: 500, message: '获取未读数失败' });
  }
});

module.exports = router;