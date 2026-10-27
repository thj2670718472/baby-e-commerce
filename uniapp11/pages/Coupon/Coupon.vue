<template>
  <view class="coupon-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">优惠券</text>
      <text class="header-my" @click="goToMyCoupons">我的</text>
    </view>

    <!-- 抽取动画区域 -->
    <view class="draw-section">
      <view class="draw-box" :class="{ animating: isDrawing }" @click="handleDraw">
        <image class="draw-bg" src="/static/coupon-bg.png" mode="aspectFill"></image>
        <view class="draw-content">
          <text class="draw-title">{{ drawButtonText }}</text>
          <text class="draw-tip">{{ drawTipText }}</text>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-actions">
      <button class="action-btn" @click="goToRecords">抽取记录</button>
      <button class="action-btn primary" @click="handleDraw">点击抽取</button>
    </view>

    <!-- 中奖弹窗 -->
    <view class="modal" v-if="showResultModal" @click="closeResultModal">
      <view class="modal-content" @click.stop>
        <view class="result-header">
          <text class="result-icon">🎉</text>
          <text class="result-title">恭喜你！</text>
        </view>
        <view class="result-body">
          <text class="result-text">{{ resultMessage }}</text>
        </view>
        <view class="result-footer">
          <button class="result-btn" @click="closeResultModal">知道了</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { drawCoupon, getCouponWeekStatus } from '../../api/index.js'

const isDrawing = ref(false)
const showResultModal = ref(false)
const resultMessage = ref('')
const currentUser = ref(null)
const hasDrawnThisWeek = ref(false)

// 获取当前用户
const getCurrentUser = () => {
  try {
    const userStr = uni.getStorageSync('userInfo')
    if (!userStr) return null
    return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
  } catch (e) {
    return null
  }
}

const drawButtonText = computed(() => {
  if (hasDrawnThisWeek.value) return '已抽取'
  if (isDrawing.value) return '抽取中...'
  return '点击抽取'
})

const drawTipText = computed(() => {
  if (hasDrawnThisWeek.value) return '下周再来吧'
  return '每周可抽取一次'
})

const checkWeekStatus = async () => {
  const user = currentUser.value
  if (!user) return
  try {
    const res = await getCouponWeekStatus(user.id)
    if (res.code === 200) {
      hasDrawnThisWeek.value = res.data.hasDrawn
    }
  } catch (error) {
    console.error('检查抽取状态失败:', error)
  }
}

const handleDraw = async () => {
  const user = currentUser.value
  if (!user) {
    uni.showModal({
      title: '提示', content: '请先登录',
      success: (res) => { if (res.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) }
    })
    return
  }

  if (hasDrawnThisWeek.value) {
    uni.showToast({ title: '本周已经抽取过了，下周再来吧', icon: 'none' })
    return
  }

  if (isDrawing.value) return

  isDrawing.value = true

  try {
    const res = await drawCoupon({ userId: user.id })
    if (res.code === 200) {
      hasDrawnThisWeek.value = true
      resultMessage.value = res.message
      showResultModal.value = true
    } else {
      uni.showToast({ title: res.message || '抽取失败', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: '抽取失败', icon: 'none' })
  } finally {
    isDrawing.value = false
  }
}

const closeResultModal = () => {
  showResultModal.value = false
}

const goToRecords = () => {
  uni.navigateTo({ url: '/pages/Coupon/Records' })
}

const goToMyCoupons = () => {
  uni.navigateTo({ url: '/pages/Coupon/MyCoupons' })
}

const navigateBack = () => uni.navigateBack()

onMounted(() => {
  currentUser.value = getCurrentUser()
  if (currentUser.value) {
    checkWeekStatus()
  }
})
</script>

<style scoped>
.coupon-page { min-height: 100vh; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; color: #fff; }
.header-back { font-size: 28rpx; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-my { font-size: 28rpx; }

.draw-section { flex: 1; display: flex; align-items: center; justify-content: center; }
.draw-box { width: 500rpx; height: 400rpx; position: relative; }
.draw-box.animating { animation: shake 0.5s ease-in-out infinite; }
.draw-bg { width: 100%; height: 100%; border-radius: 24rpx; }
.draw-content { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.draw-title { font-size: 48rpx; color: #fff; font-weight: bold; text-shadow: 2rpx 2rpx 4rpx rgba(0,0,0,0.3); }
.draw-tip { font-size: 24rpx; color: #fff; margin-top: 20rpx; opacity: 0.8; }

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.bottom-actions { display: flex; padding: 40rpx 30rpx; gap: 30rpx; }
.action-btn { flex: 1; height: 80rpx; background-color: rgba(255,255,255,0.9); color: #ff6b6b; font-size: 30rpx; border-radius: 40rpx; border: none; }
.action-btn.primary { background-color: #fff; color: #ff6b6b; font-weight: bold; }

.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { width: 80%; background-color: #fff; border-radius: 24rpx; padding: 50rpx 40rpx; }
.result-header { text-align: center; margin-bottom: 30rpx; }
.result-icon { font-size: 80rpx; }
.result-title { display: block; font-size: 36rpx; font-weight: bold; color: #ff6b6b; margin-top: 15rpx; }
.result-body { text-align: center; margin-bottom: 40rpx; }
.result-text { font-size: 30rpx; color: #333; line-height: 1.5; }
.result-btn { width: 100%; height: 80rpx; background-color: #ff6b6b; color: #fff; font-size: 30rpx; border-radius: 40rpx; border: none; }
</style>