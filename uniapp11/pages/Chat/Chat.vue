<template>
  <view class="chat-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">客服咨询</text>
      <text class="header-placeholder"></text>
    </view>
    
    <scroll-view class="message-list" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
      <view class="message-item" v-for="(msg, index) in messages" :key="msg.id || index">
        <view class="message-time" v-if="showMessageTime(index)">
          {{ formatMessageTime(msg.createTime) }}
        </view>
        
        <view class="message-left" v-if="msg.senderType === 'admin'">
          <image 
            class="avatar" 
            :src="adminAvatar" 
            mode="aspectFill"
            @error="onAdminAvatarError"
          ></image>
          <view class="bubble-wrapper">
            <view class="bubble admin-bubble">
              <image v-if="msg.messageType === 'image'" :src="msg.content" mode="widthFix" @click="previewImage(msg.content)"></image>
              <text v-else>{{ msg.content }}</text>
            </view>
          </view>
        </view>
        
        <view class="message-right" v-else>
          <view class="bubble-wrapper">
            <view class="bubble user-bubble">
              <image v-if="msg.messageType === 'image'" :src="msg.content" mode="widthFix" @click="previewImage(msg.content)"></image>
              <text v-else>{{ msg.content }}</text>
            </view>
          </view>
          <image 
            class="avatar" 
            :src="userAvatar" 
            mode="aspectFill"
            @error="onUserAvatarError"
          ></image>
        </view>
      </view>
      
      <view v-if="loading" class="loading-tip">加载中...</view>
      <view v-if="messages.length === 0 && !loading" class="empty-tip">发送消息开始咨询吧~</view>
    </scroll-view>
    
    <view class="input-bar">
      <view class="input-actions">
        <view class="action-btn" @click="handleChooseImage">
          <text class="action-icon">📷</text>
        </view>
      </view>
      <view class="input-wrapper">
        <textarea 
          class="message-textarea" 
          v-model="inputText" 
          placeholder="输入消息..." 
          :adjust-position="true"
          :hold-keyboard="true"
          :auto-height="true"
          :maxlength="500"
          :cursor-spacing="20"
          @confirm="sendTextMessage"
        />
      </view>
      <button class="send-btn" @click="sendTextMessage" :disabled="!inputText.trim()">发送</button>
    </view>

    <view class="preview-modal" v-if="previewImageUrl" @click="closePreview">
      <view class="preview-content" @click.stop>
        <image :src="previewImageUrl" mode="widthFix"></image>
        <view class="preview-actions">
          <button class="preview-btn cancel" @click="closePreview">取消</button>
          <button class="preview-btn send" @click="confirmSendImage">发送</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getChatSession, getChatMessages, uploadChatImage, getAdminInfo, BASE_URL } from '../../api/index.js'

const sessionId = ref(null)
const messages = ref([])
const inputText = ref('')
const scrollTop = ref(0)
const loading = ref(false)
const userInfo = ref({ id: '', username: '', avatar: '' })
const previewImageUrl = ref('')
const pendingImagePath = ref('')
const wsConnected = ref(false)

// 管理员头像
const adminAvatar = ref('/static/babycity-icon.png')

// ==================== [用户] WebSocket 连接 ====================
// 跟随接口地址，真机调试时无需再改这里
const WS_URL = BASE_URL.replace(/^http/i, 'ws') + '/ws/chat'

const connectWebSocket = () => {
  uni.connectSocket({
    url: WS_URL,
    success: () => {}
  })

  // ── [用户发送] 连接成功后发送认证 ──
  uni.onSocketOpen(() => {
    wsConnected.value = true
    uni.sendSocketMessage({
      data: JSON.stringify({
        type: 'auth',
        userId: userInfo.value.id,
        userName: userInfo.value.username,
        role: 'user',
        token: uni.getStorageSync('token') || ''
      })
    })
  })

  // ── [用户接收] 接收服务端推送的消息 ──
  uni.onSocketMessage((res) => {
    try {
      const msg = JSON.parse(res.data)
      switch (msg.type) {
        // [用户接收] 收到新消息（管理员发来的回复）
        case 'new_message': {
          const newMsg = msg.data
          // 避免重复
          if (!newMsg || messages.value.find(m => m.id === newMsg.id)) return
          messages.value.push(newMsg)
          scrollToBottom()
          // [用户发送] 收到管理员消息后，自动标记已读
          if (newMsg.senderType === 'admin') {
            uni.sendSocketMessage({
              data: JSON.stringify({
                type: 'read_messages',
                sessionId: sessionId.value
              })
            })
          }
          break
        }
        // [用户接收] 管理员关闭了会话
        case 'session_closed':
          uni.showToast({ title: '咨询已结束', icon: 'none' })
          setTimeout(() => {
            const pages = getCurrentPages()
            if (pages.length > 1) {
              uni.navigateBack()
            } else {
              uni.switchTab({ url: '/pages/Myhome/Myhome' })
            }
          }, 1500)
          break
        // [用户接收] 未读数更新（服务端推送）
        case 'unread_update':
          break
        case 'error':
          console.error('WebSocket错误:', msg.message)
          break
      }
    } catch (e) {
      console.error('解析WebSocket消息失败:', e)
    }
  })

  // ── [用户] 连接断开，5秒后自动重连 ──
  uni.onSocketClose(() => {
    wsConnected.value = false
    setTimeout(() => {
      if (sessionId.value) {
        connectWebSocket()
      }
    }, 5000)
  })

  uni.onSocketError(() => {
    uni.closeSocket()
  })
}
// ==================== [用户] WebSocket 结束 ====================

// 加载管理员头像
const loadAdminAvatar = async () => {
  try {
    const res = await getAdminInfo()
    if (res.code === 200 && res.data && res.data.avatar) {
      const avatar = res.data.avatar
      if (avatar.startsWith('http') || avatar.startsWith('data:')) {
        adminAvatar.value = avatar
      } else if (avatar.startsWith('/uploads/')) {
        adminAvatar.value = BASE_URL + avatar
      } else {
        adminAvatar.value = avatar
      }
    }
  } catch (error) {
    console.error('加载管理员头像失败:', error)
  }
}

const onAdminAvatarError = () => {
  adminAvatar.value = '/static/babycity-icon.png'
}

const userAvatarFallback = ref(false)
const onUserAvatarError = () => {
  userAvatarFallback.value = true
}

const userAvatar = computed(() => {
  const avatar = userInfo.value.avatar
  if (userAvatarFallback.value || !avatar) return '/static/人物.png'
  if (avatar.startsWith('http')) return avatar
  if (avatar.startsWith('/uploads/')) return BASE_URL + avatar
  if (avatar.startsWith('/')) return avatar
  return '/static/人物.png'
})

const formatMessageTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

const showMessageTime = (index) => {
  if (index === 0) return true
  const currentMsg = messages.value[index]
  const prevMsg = messages.value[index - 1]
  if (!currentMsg || !prevMsg) return true
  const currentTime = new Date(currentMsg.createTime)
  const prevTime = new Date(prevMsg.createTime)
  return currentTime - prevTime > 5 * 60 * 1000
}

const previewImage = (url) => {
  uni.previewImage({ urls: [url] })
}

const scrollToBottom = () => {
  scrollTop.value = 99999
}

const getCurrentUser = () => {
  try {
    const userStr = uni.getStorageSync('userInfo')
    if (!userStr) return null
    return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
  } catch (e) {
    return null
  }
}

const loadSession = async () => {
  try {
    const res = await getChatSession({
      userId: userInfo.value.id,
      userName: userInfo.value.username,
      userAvatar: userInfo.value.avatar
    })
    if (res.code === 200) {
      sessionId.value = res.data.id
      loadMessages()
    } else {
      uni.showToast({ title: res.message || '连接失败', icon: 'none' })
    }
  } catch (error) {
    console.error('加载会话失败:', error)
    uni.showToast({ title: '连接失败', icon: 'none' })
  }
}

const loadMessages = async () => {
  if (!sessionId.value) return
  try {
    const res = await getChatMessages(sessionId.value)
    if (res.code === 200) {
      messages.value = res.data || []
      scrollToBottom()
    }
  } catch (error) {
    console.error('加载消息失败:', error)
  } finally {
    loading.value = false
  }
}

// [用户发送] 通过 WebSocket 发送文本消息
const sendTextMessage = () => {
  const text = inputText.value.trim()
  if (!text) return

  if (!wsConnected.value) {
    uni.showToast({ title: '连接中，请稍候', icon: 'none' })
    return
  }

  inputText.value = ''

  uni.sendSocketMessage({
    data: JSON.stringify({
      type: 'send_message',
      sessionId: sessionId.value,
      content: text,
      messageType: 'text'
    })
  })
}

const handleChooseImage = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      pendingImagePath.value = res.tempFilePaths[0]
      previewImageUrl.value = res.tempFilePaths[0]
    },
    fail: (err) => {
      console.error('选择图片失败:', err)
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  })
}

const closePreview = () => {
  previewImageUrl.value = ''
}

// [用户发送] 上传图片（REST），再通过 WebSocket 发送图片消息
const confirmSendImage = async () => {
  const filePath = pendingImagePath.value
  if (!filePath) {
    previewImageUrl.value = ''
    pendingImagePath.value = ''
    return
  }

  previewImageUrl.value = ''
  uni.showLoading({ title: '发送中...', mask: true })

  try {
    // 图片上传走 REST（FormData 不适合走 WebSocket）
    const uploadRes = await uploadChatImage(filePath)

    if (uploadRes.code === 200) {
      if (!wsConnected.value) {
        uni.hideLoading()
        uni.showToast({ title: '连接已断开，请重试', icon: 'none' })
        return
      }
      // [用户发送] 上传成功后，通过 WebSocket 发送图片消息
      uni.sendSocketMessage({
        data: JSON.stringify({
          type: 'send_message',
          sessionId: sessionId.value,
          content: BASE_URL + uploadRes.data.url,
          messageType: 'image'
        })
      })
      uni.hideLoading()
    } else {
      uni.hideLoading()
      uni.showToast({ title: uploadRes.message || '上传失败', icon: 'none' })
    }
  } catch (error) {
    uni.hideLoading()
    console.error('发送图片失败:', error)
    uni.showToast({ title: '发送失败，请重试', icon: 'none' })
  } finally {
    pendingImagePath.value = ''
  }
}

const navigateBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/Myhome/Myhome' })
  }
}

onMounted(() => {
  const user = getCurrentUser()
  if (user) {
    userInfo.value = user
    loadAdminAvatar()
    loadSession()
    connectWebSocket()
  } else {
    uni.showToast({ title: '请先登录', icon: 'none' })
    setTimeout(() => {
      uni.navigateTo({ url: '/pages/Login/Login' })
    }, 1500)
  }
})

onUnmounted(() => {
  uni.closeSocket()
})
</script>

<style scoped>
.chat-page { display: flex; flex-direction: column; height: 100vh; background-color: #f5f5f5; position: relative; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; padding-top: calc(var(--status-bar-height) + 20rpx); background-color: #fff; border-bottom: 1rpx solid #eee; flex-shrink: 0; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 60rpx; }

.message-list { flex: 1; padding: 20rpx; background-color: #f5f5f5; overflow-y: auto; }
.message-item { margin-bottom: 30rpx; }
.message-time { text-align: center; font-size: 22rpx; color: #999; margin-bottom: 20rpx; }

.message-left, .message-right { display: flex; align-items: flex-start; }
.message-right { justify-content: flex-end; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background-color: #f0f0f0; flex-shrink: 0; }
.message-left .avatar { margin-right: 15rpx; }
.message-right .avatar { margin-left: 15rpx; }

.bubble-wrapper { max-width: 70%; }
.bubble { padding: 20rpx 25rpx; border-radius: 20rpx; font-size: 28rpx; line-height: 1.5; word-break: break-all; }
.admin-bubble { background-color: #fff; color: #333; border-radius: 20rpx 20rpx 20rpx 5rpx; }
.user-bubble { background-color: #ff6b6b; color: #fff; border-radius: 20rpx 20rpx 5rpx 20rpx; }
.bubble image { max-width: 300rpx; border-radius: 10rpx; }

.loading-tip, .empty-tip { text-align: center; color: #999; padding: 50rpx 0; font-size: 28rpx; }

.input-bar { display: flex; align-items: flex-end; padding: 15rpx 20rpx; background-color: #fff; border-top: 1rpx solid #eee; flex-shrink: 0; }
.input-actions { display: flex; margin-right: 10rpx; margin-bottom: 5rpx; }
.action-btn { padding: 10rpx; }
.action-icon { font-size: 44rpx; }
.input-wrapper { flex: 1; background-color: #f5f5f5; border-radius: 25rpx; padding: 10rpx 20rpx; max-height: 150rpx; }
.message-textarea { width: 100%; min-height: 50rpx; max-height: 130rpx; font-size: 28rpx; color: #333; line-height: 1.4; padding: 5rpx 0; }
.send-btn { width: 120rpx; height: 70rpx; padding: 0; background-color: #ff6b6b; color: #fff; font-size: 28rpx; border-radius: 35rpx; margin-left: 15rpx; border: none; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 5rpx; white-space: nowrap; }
.send-btn[disabled] { opacity: 0.5; }

.preview-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.preview-content { width: 80%; max-height: 80vh; background-color: #fff; border-radius: 16rpx; overflow: hidden; }
.preview-content image { width: 100%; max-height: 60vh; }
.preview-actions { display: flex; padding: 20rpx; gap: 20rpx; }
.preview-btn { flex: 1; height: 80rpx; border-radius: 40rpx; font-size: 28rpx; border: none; }
.preview-btn.cancel { background-color: #f5f5f5; color: #666; }
.preview-btn.send { background-color: #ff6b6b; color: #fff; }
</style>