<template>
  <div class="chat-manage-container">
    <div class="chat-wrapper">
      <!-- 左侧会话列表 -->
      <div class="session-list">
        <div class="session-header">
          <h3>咨询列表</h3>
          <span class="unread-badge" v-if="totalUnread > 0">{{ totalUnread }}</span>
        </div>
        <div class="session-items">
          <div 
            class="session-item" 
            v-for="session in sessions" 
            :key="session.id"
            :class="{ active: currentSessionId === session.id }"
            @click="selectSession(session)"
          >
            <div class="session-avatar">
              <img :src="getAvatarUrl(session.userAvatar)" alt="头像">
            </div>
            <div class="session-info">
              <div class="session-name">
                {{ session.userName }}
                <span class="unread-count" v-if="session.unreadCount > 0">{{ session.unreadCount }}</span>
              </div>
              <div class="session-last">{{ session.lastMessage || '暂无消息' }}</div>
            </div>
            <div class="session-time">{{ formatTime(session.lastTime) }}</div>
          </div>
          <div v-if="sessions.length === 0" class="empty-session">
            暂无咨询
          </div>
        </div>
      </div>
      
      <!-- 右侧聊天区域 -->
      <div class="chat-area" v-if="currentSessionId">
        <div class="chat-header">
          <div class="chat-user">
            <img :src="getAvatarUrl(currentSession?.userAvatar)" alt="头像">
            <span>{{ currentSession?.userName }}</span>
          </div>
          <el-button type="danger" size="small" @click="closeSession">结束咨询</el-button>
        </div>
        
        <div class="message-list" ref="messageListRef">
          <div 
            class="message-item" 
            v-for="(msg, index) in messages" 
            :key="msg.id"
            :class="{ 'message-right': msg.senderType === 'admin', 'message-left': msg.senderType === 'user' }"
          >
            <div class="message-time" v-if="showTime(index)">{{ formatMessageTime(msg.createTime) }}</div>
            <div class="message-content">
              <img 
                class="message-avatar" 
                :src="getSenderAvatar(msg)" 
                alt="头像"
                @error="onAvatarError($event, msg)"
              >
              <div class="message-bubble" :class="{ 'admin-bubble': msg.senderType === 'admin', 'user-bubble': msg.senderType === 'user' }">
                <img v-if="msg.messageType === 'image'" :src="msg.content" class="message-image" @click="previewImage(msg.content)">
                <span v-else>{{ msg.content }}</span>
              </div>
            </div>
          </div>
          <div v-if="messages.length === 0" class="empty-message">
            暂无消息
          </div>
        </div>
        
        <div class="input-area">
          <div class="input-actions">
            <el-button type="text" class="upload-btn" @click="triggerFileSelect">
              <el-icon :size="24"><Picture /></el-icon>
            </el-button>
            <input 
              type="file" 
              ref="fileInputRef" 
              accept="image/*" 
              style="display: none" 
              @change="handleFileSelect"
            />
          </div>
          <el-input
            v-model="inputText"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
            class="message-input"
            size="large"
          />
          <el-button type="primary" @click="sendMessage" :disabled="!inputText.trim()" size="large">发送</el-button>
        </div>
      </div>
      
      <div class="chat-area empty-chat" v-else>
        <div class="empty-tip">
          <el-icon :size="60"><ChatDotRound /></el-icon>
          <p>选择会话开始聊天</p>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      title="预览图片"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="preview-content">
        <img :src="previewImageUrl" alt="预览" style="width: 100%; max-height: 400px; object-fit: contain;" />
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSendImage">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, ChatDotRound } from '@element-plus/icons-vue'
import service from '@/utils/request'

// 图片等静态资源地址（接口请求走 /api 代理，无需配置）
const BASE_URL = import.meta.env.VITE_FILE_BASE_URL || 'http://localhost:3000'
// WebSocket 走 Vite 代理，避免硬编码主机地址
const WS_URL = import.meta.env.VITE_WS_URL
  || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/chat`

// 认证失败标记：避免无意义的重连风暴
let authFailed = false

const sessions = ref([])
const currentSessionId = ref(null)
const currentSession = ref(null)
const messages = ref([])
const inputText = ref('')
const totalUnread = ref(0)
const messageListRef = ref(null)
const fileInputRef = ref(null)

// 图片预览相关
const previewVisible = ref(false)
const previewImageUrl = ref('')
const pendingFile = ref(null)

let ws = null
let wsReconnectTimer = null

// ========== 获取管理员头像 ==========
const getAdminAvatar = () => {
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      // 如果管理员用户有头像，使用管理员的头像
      if (user.avatar) {
        return getAvatarUrl(user.avatar)
      }
    } catch (e) {
      console.error('解析用户信息失败:', e)
    }
  }
  // 默认管理员头像
  return '/admin-avatar.png'
}

// ========== 获取头像URL（通用） ==========
const getAvatarUrl = (avatar) => {
  if (!avatar) return '/images/user.png'
  if (avatar.startsWith('http') || avatar.startsWith('data:')) return avatar
  if (avatar.startsWith('/uploads/')) return BASE_URL + avatar
  if (avatar.startsWith('/')) return avatar
  return '/images/user.png'
}

// ========== 获取发送者头像 ==========
const getSenderAvatar = (msg) => {
  if (msg.senderType === 'admin') {
    return getAdminAvatar()
  }
  return getAvatarUrl(currentSession.value?.userAvatar)
}

// ========== 头像加载失败时的处理 ==========
const onAvatarError = (event, msg) => {
  event.target.src = msg.senderType === 'admin'
    ? '/admin-avatar.png'
    : '/images/user.png'
}

const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  
  return `${date.getMonth() + 1}-${date.getDate()}`
}

const formatMessageTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const showTime = (index) => {
  if (index === 0) return true
  const current = messages.value[index]
  const prev = messages.value[index - 1]
  if (!current || !prev) return true
  return new Date(current.createTime) - new Date(prev.createTime) > 5 * 60 * 1000
}

const previewImage = (url) => {
  window.open(url, '_blank')
}

const loadSessions = async () => {
  try {
    const res = await service.get('/chat/admin/sessions')
    if (res.code === 200) {
      sessions.value = res.data || []
    }
  } catch (error) {
    console.error('加载会话列表失败:', error)
  }
}

const loadUnreadCount = async () => {
  try {
    const res = await service.get('/chat/admin/unread/count')
    if (res.code === 200) {
      totalUnread.value = res.data.count || 0
    }
  } catch (error) {
    console.error('加载未读数失败:', error)
  }
}

const selectSession = async (session) => {
  currentSessionId.value = session.id
  currentSession.value = session
  await loadMessages()
  // [管理员发送] 进入会话后，标记该会话的用户消息为已读
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'read_messages',
      sessionId: session.id
    }))
  }
}

const loadMessages = async () => {
  if (!currentSessionId.value) return
  
  try {
    const res = await service.get(`/chat/admin/messages/${currentSessionId.value}`)
    if (res.code === 200) {
      messages.value = res.data || []
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载消息失败:', error)
  }
}

// [管理员发送] 通过 WebSocket 发送文本消息
const sendMessage = () => {
  const text = inputText.value.trim()
  if (!text) return

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    ElMessage.error('连接已断开，请刷新页面')
    return
  }

  inputText.value = ''

  ws.send(JSON.stringify({
    type: 'send_message',
    sessionId: currentSessionId.value,
    content: text,
    messageType: 'text'
  }))
}

// 触发文件选择
const triggerFileSelect = () => {
  fileInputRef.value.click()
}

// 处理文件选择
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 校验文件类型
  if (!file.type.startsWith('image/')) {
    ElMessage.error('只能上传图片文件')
    return
  }
  
  // 校验文件大小（10MB）
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过10MB')
    return
  }
  
  pendingFile.value = file
  
  // 创建预览URL
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImageUrl.value = e.target.result
    previewVisible.value = true
  }
  reader.readAsDataURL(file)
  
  // 清空input，以便可以重复选择同一个文件
  event.target.value = ''
}

// 确认发送图片
// [管理员发送] 上传图片（REST），再通过 WebSocket 发送图片消息
const confirmSendImage = async () => {
  if (!pendingFile.value) return

  previewVisible.value = false

  const formData = new FormData()
  formData.append('file', pendingFile.value)

  try {
    // 图片上传走 REST（FormData 不适合走 WebSocket）
    const uploadRes = await service.post('/chat/upload', formData)

    if (uploadRes.code === 200) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ElMessage.error('连接已断开，请刷新页面')
        return
      }
      // [管理员发送] 上传成功后，通过 WebSocket 发送图片消息
      ws.send(JSON.stringify({
        type: 'send_message',
        sessionId: currentSessionId.value,
        content: BASE_URL + uploadRes.data.url,
        messageType: 'image'
      }))
    } else {
      ElMessage.error(uploadRes.message || '上传失败')
    }
  } catch (error) {
    console.error('发送图片失败:', error)
    ElMessage.error('发送失败')
  } finally {
    pendingFile.value = null
    previewImageUrl.value = ''
  }
}

// [管理员发送] 关闭会话（仅管理员可操作）
const closeSession = () => {
  ElMessageBox.confirm('确定要结束这次咨询吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ElMessage.error('连接已断开，请刷新页面')
      return
    }
    ws.send(JSON.stringify({
      type: 'close_session',
      sessionId: currentSessionId.value
    }))
  }).catch(() => {})
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

// ==================== [管理员] WebSocket 连接 ====================
const connectWebSocket = () => {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(WS_URL)

  // ── [管理员发送] 连接成功后发送认证 ──
  ws.onopen = () => {
    const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}')
    ws.send(JSON.stringify({
      type: 'auth',
      userId: currentUser.id,
      userName: currentUser.username,
      role: 'admin',
      token: sessionStorage.getItem('token') || localStorage.getItem('token') || ''
    }))
    loadSessions()
    loadUnreadCount()
    if (currentSessionId.value) {
      loadMessages()
    }
  }

  // ── [管理员接收] 接收服务端推送的消息 ──
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        // [管理员接收] 收到新消息（用户发来的）
        case 'new_message': {
          const newMsg = msg.data
          // 只处理当前会话的消息
          if (newMsg.sessionId === currentSessionId.value) {
            // 避免重复消息
            if (!messages.value.find(m => m.id === newMsg.id)) {
              messages.value.push(newMsg)
              scrollToBottom()
            }
            // [管理员发送] 收到用户消息后，自动标记已读
            if (newMsg.senderType === 'user') {
              ws.send(JSON.stringify({
                type: 'read_messages',
                sessionId: currentSessionId.value
              }))
            }
          }
          break
        }
        // [管理员接收] 会话列表刷新（含未读角标）
        case 'sessions_update':
          sessions.value = msg.data || []
          break
        // [管理员接收] 未读总数更新
        case 'unread_update':
          totalUnread.value = msg.data.count || 0
          break
        // [管理员接收] 会话已关闭确认
        case 'session_closed':
          if (msg.data.sessionId === currentSessionId.value) {
            ElMessage.success('会话已关闭')
            currentSessionId.value = null
            currentSession.value = null
            messages.value = []
          }
          loadSessions()
          loadUnreadCount()
          break
        case 'error':
          console.error('WebSocket错误:', msg.message)
          // 认证失败时明确提示，避免界面看起来"没反应"
          if (msg.message && msg.message.includes('认证')) {
            authFailed = true
            ElMessage.error('登录状态已失效，请重新登录后再使用客服功能')
            sessionStorage.removeItem('user')
            sessionStorage.removeItem('token')
            localStorage.removeItem('token')
            setTimeout(() => { window.location.href = '/login' }, 1200)
          } else {
            ElMessage.warning(msg.message || '操作失败')
          }
          break
      }
    } catch (e) {
      console.error('解析WebSocket消息失败:', e)
    }
  }

  // ── [管理员] 连接断开，5秒后自动重连（认证失败不再重连）──
  ws.onclose = () => {
    if (authFailed) return
    wsReconnectTimer = setTimeout(() => {
      connectWebSocket()
    }, 5000)
  }

  ws.onerror = () => {
    ws?.close()
  }
}

onMounted(() => {
  // 没有 token 时先引导重新登录，避免建立无意义的连接
  const token = sessionStorage.getItem('token') || localStorage.getItem('token')
  if (!token) {
    ElMessage.error('登录状态已失效，请重新登录后再使用客服功能')
    setTimeout(() => { window.location.href = '/login' }, 1200)
    return
  }

  loadSessions()
  loadUnreadCount()
  connectWebSocket()
})

onUnmounted(() => {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
  }
  if (ws) {
    ws.onclose = null
    ws.close()
  }
})
</script>

<style scoped>
.chat-manage-container {
  height: calc(100vh - 100px);
  background-color: #f5f5f5;
  padding: 20px;
}

.chat-wrapper {
  display: flex;
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}

.session-list {
  width: 300px;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.session-header {
  padding: 20px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 10px;
}

.session-header h3 {
  margin: 0;
  font-size: 18px;
}

.unread-badge {
  background-color: #ff6b6b;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.session-items {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.session-item:hover {
  background-color: #f5f5f5;
}

.session-item.active {
  background-color: #e6f7ff;
}

.session-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 12px;
  flex-shrink: 0;
  background-color: #f0f0f0;
}

.session-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-weight: 500;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.unread-count {
  background-color: #ff6b6b;
  color: #fff;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
}

.session-last {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

.empty-session {
  text-align: center;
  padding: 50px 0;
  color: #999;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-user img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.message-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #fafafa;
}

.message-item {
  margin-bottom: 20px;
}

.message-time {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 15px;
}

.message-content {
  display: flex;
  align-items: flex-start;
}

.message-right {
  display: flex;
  justify-content: flex-end;
}

.message-right .message-content {
  flex-direction: row-reverse;
}

.message-left .message-content {
  flex-direction: row;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background-color: #f0f0f0;
}

.message-left .message-avatar {
  margin-right: 12px;
}

.message-right .message-avatar {
  margin-left: 12px;
}

.message-bubble {
  max-width: 60%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.admin-bubble {
  background-color: #fff;
  color: #333;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  border-radius: 12px 12px 12px 4px;
}

.user-bubble {
  background-color: #ff6b6b;
  color: #fff;
  border-radius: 12px 12px 4px 12px;
}

.message-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
}

.empty-message {
  text-align: center;
  padding: 50px 0;
  color: #999;
}

.empty-chat {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-tip {
  text-align: center;
  color: #999;
}

.empty-tip p {
  margin-top: 10px;
}

.input-area {
  padding: 15px 20px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #fff;
}

.input-actions {
  display: flex;
  gap: 5px;
}

.upload-btn {
  padding: 8px;
  font-size: 20px;
}

.message-input {
  flex: 1;
}

.preview-content {
  text-align: center;
}
</style>