<template>
  <view class="ai-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">AI育儿助手</text>
      <text class="header-placeholder"></text>
    </view>

    <scroll-view class="chat-list" scroll-y :scroll-top="scrollTop">
      <!-- 欢迎消息 -->
      <view class="chat-item left" v-if="messages.length === 0">
        <text class="ai-avatar">🤖</text>
        <view class="bubble ai-bubble">
          <text>你好！我是AI育儿助手，有什么关于宝宝的问题都可以问我~</text>
        </view>
      </view>

      <!-- 消息列表 -->
      <view class="chat-item" v-for="(msg, idx) in messages" :key="idx" :class="msg.role === 'user' ? 'right' : 'left'">
        <!-- AI消息：头像在左，消息在右 -->
        <template v-if="msg.role === 'assistant'">
          <text class="ai-avatar">🤖</text>
          <view class="bubble ai-bubble">
            <text>{{ msg.content }}</text>
          </view>
        </template>
        
        <!-- 用户消息：消息在左，头像在右 -->
        <template v-else>
          <view class="bubble user-bubble">
            <text>{{ msg.content }}</text>
          </view>
          <image class="avatar-img" :src="userAvatar" mode="aspectFill"></image>
        </template>
      </view>

      <view v-if="loading" class="loading-tip">AI思考中...</view>
    </scroll-view>

    <!-- 快捷问题 -->
    <view class="quick-questions">
      <text class="quick-tag" v-for="q in quickQuestions" :key="q" @click="sendQuick(q)">{{ q }}</text>
    </view>

    <view class="input-bar">
      <input class="input-field" v-model="inputText" placeholder="输入问题..." @confirm="sendMessage" />
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim() || loading">发送</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { aiChat, BASE_URL } from '../../api/index.js'

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const scrollTop = ref(0)

const quickQuestions = ['6个月宝宝能吃什么？', '怎么给宝宝断夜奶？', '宝宝发烧怎么办？']

const getCurrentUser = () => {
  try {
    const u = uni.getStorageSync('userInfo')
    return u ? (typeof u === 'string' ? JSON.parse(u) : u) : null
  } catch (e) { return null }
}

const userAvatar = computed(() => {
  const user = getCurrentUser()
  if (!user?.avatar) return '/static/人物.png'
  if (user.avatar.startsWith('http')) return user.avatar
  if (user.avatar.startsWith('/uploads/')) return BASE_URL + user.avatar
  return '/static/人物.png'
})

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  
  inputText.value = ''
  messages.value.push({ role: 'user', content: text })
  scrollToBottom()
  
  loading.value = true
  try {
    const res = await aiChat(messages.value)
    if (res.code === 200) {
      messages.value.push({ role: 'assistant', content: res.data.content })
    } else {
      messages.value.push({ role: 'assistant', content: '抱歉，AI服务暂时不可用' })
    }
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '网络错误，请重试' })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

// AI 助手需要登录后才能使用
onLoad(() => {
  if (!getCurrentUser()) {
    uni.showModal({
      title: '提示',
      content: '登录后才能使用 AI 育儿助手',
      showCancel: false,
      success: () => {
        uni.navigateTo({ url: '/pages/Login/Login' })
      }
    })
  }
})

const sendQuick = (q) => { inputText.value = q; sendMessage() }

const scrollToBottom = () => { scrollTop.value = 99999 }

const navigateBack = () => uni.navigateBack()
</script>

<style scoped>
.ai-page { display: flex; flex-direction: column; height: 100vh; background-color: #f5f5f5; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 60rpx; }

.chat-list { flex: 1; padding: 20rpx; overflow-y: auto; }
.chat-item { display: flex; margin-bottom: 30rpx; align-items: flex-start; }
.chat-item.left { justify-content: flex-start; }
.chat-item.right { justify-content: flex-end; }

.ai-avatar { font-size: 40rpx; flex-shrink: 0; }
.avatar-img { 
  width: 60rpx; height: 60rpx; border-radius: 50%; 
  flex-shrink: 0; background-color: #f0f0f0;
}

.bubble { max-width: 72%; padding: 18rpx 22rpx; font-size: 28rpx; line-height: 1.5; }
.ai-bubble { 
  background-color: #fff; color: #333; 
  margin-left: 12rpx;
  border-radius: 4rpx 16rpx 16rpx 16rpx;
}
.user-bubble { 
  background-color: #ff6b6b; color: #fff; 
  margin-right: 12rpx;
  border-radius: 16rpx 4rpx 16rpx 16rpx;
}

.loading-tip { text-align: center; color: #999; padding: 20rpx; font-size: 24rpx; }

.quick-questions { display: flex; flex-wrap: wrap; gap: 15rpx; padding: 15rpx 20rpx; background-color: #fff; }
.quick-tag { padding: 8rpx 20rpx; background-color: #fff5f5; color: #ff6b6b; border-radius: 20rpx; font-size: 24rpx; }

.input-bar { display: flex; padding: 15rpx 20rpx; background-color: #fff; gap: 15rpx; align-items: center; padding-bottom: calc(15rpx + env(safe-area-inset-bottom)); }
.input-field { flex: 1; height: 60rpx; padding: 0 15rpx; background-color: #f5f5f5; border-radius: 30rpx; font-size: 26rpx; }
.send-btn { width: 100rpx; height: 60rpx; padding: 0; margin: 0; background-color: #ff6b6b; color: #fff; border-radius: 30rpx; font-size: 26rpx; line-height: 60rpx; white-space: nowrap; border: none; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.send-btn[disabled] { opacity: 0.5; }
</style>