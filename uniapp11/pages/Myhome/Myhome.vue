<template>
	<view class="my-home-page">
		<!-- 顶部用户信息 -->
		<view class="user-info-section">
		  <view class="user-avatar" >
		    <image :key="avatarKey" :src="displayAvatar" mode="aspectFill" @error="onAvatarError"></image>
		  </view>
		  <view class="user-info" @click="navigateToProfile">
		    <text class="user-name">{{ (userInfo && userInfo.username) || '登录/注册' }}</text>
		    <text class="user-phone">{{ (userInfo && userInfo.phone) || '点击登录' }}</text>
		  </view>
		  <view class="edit-btn" @click="navigateToProfile">
		    <text>修改个人信息</text>
		  </view>
		</view>
		
		<!-- 订单状态 -->
		<view class="order-section">
			<view class="section-header" @click="navigateToOrders">
				<text class="section-title">我的订单</text>
				<text class="section-more">查看全部 </text>
			</view>
			<view class="order-status">
				<view class="status-item" @click="navigateToOrders('待付款')">
					<text class="status-icon">💳</text>
					<text class="status-text">待付款</text>
				</view>
				<view class="status-item" @click="navigateToOrders('已付款')">
					<text class="status-icon">📦</text>
					<text class="status-text">待发货</text>
				</view>
				<view class="status-item" @click="navigateToOrders('已发货')">
					<text class="status-icon">🚚</text>
					<text class="status-text">待收货</text>
				</view>
				<view class="status-item" @click="navigateToOrders('已完成')">
					<text class="status-icon">✅</text>
					<text class="status-text">已完成</text>
				</view>
				<view class="status-item" @click="navigateToOrders('退货中')">
					<text class="status-icon">🔄</text>
					<text class="status-text">退款/售后</text>
				</view>
			</view>
		</view>
		
		<!-- 功能列表 -->
		<view class="function-section">
			<view class="function-item" @click="navigateToCart">
			  <text class="function-icon">🛒</text>
			  <text class="function-text">购物车</text>
			  
			</view>
			<view class="function-item" @click="navigateToCoupon">
				<text class="function-icon">🎫</text>
				<text class="function-text">优惠券</text>
				<view class="unread-badge" v-if="couponCount > 0">{{ couponCount > 99 ? '99+' : couponCount }}</view>
			
			</view>
			
			<view class="function-item" @click="navigateToChat">
				<text class="function-icon">💬</text>
				<text class="function-text">问题咨询</text>
				<view class="unread-badge" v-if="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</view>
				
			</view>
			
			<view class="function-item" @click="navigateToBabyStatus">
				<text class="function-icon">👶</text>
				<text class="function-text">婴儿状况</text>
				
			</view>
			
			<view class="function-item" @click="navigateToAddress">
				<text class="function-icon">📍</text>
				<text class="function-text">收货地址</text>
				
			</view>
			<view class="function-item" @click="navigateToPoints">
			  <text class="function-icon">⭐</text>
			  <text class="function-text">积分中心</text>
			  
			</view>
		</view>
		
		<view class="version-info">
			<text class="version-text">版本 1.0.0</text>
		</view>
		<!-- 放在每个页面的模板最后，</template> 之前 -->
		<view class="ai-float-btn" @click="goToAI">
		  <text class="ai-icon">🤖</text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getChatUnread, getCouponCount, BASE_URL } from '../../api/index.js'

const userInfo = ref({ username: '', phone: '', avatar: '', id: '' })
const avatarKey = ref(0)
const displayAvatar = ref('/static/人物.png')
const unreadCount = ref(0)
const couponCount = ref(0)

const loadUserInfo = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (userStr) {
			const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
			userInfo.value = {
				id: user.id || '',
				username: user.username || '',
				phone: user.phone || '',
				avatar: user.avatar || ''
			}
			updateDisplayAvatar()
			loadUnreadCount()
			loadCouponCount()
		} else {
			userInfo.value = { id: '', username: '', phone: '', avatar: '' }
			displayAvatar.value = '/static/人物.png'
		}
	} catch (error) {
		userInfo.value = { id: '', username: '', phone: '', avatar: '' }
		displayAvatar.value = '/static/人物.png'
	}
}

const navigateToCart = () => {
  if (checkLogin()) uni.navigateTo({ url: '/pages/Cart/Cart' })
}
const loadUnreadCount = async () => {
	if (!userInfo.value.id) return
	try {
		const res = await getChatUnread(userInfo.value.id)
		if (res.code === 200) unreadCount.value = res.data.count || 0
	} catch (error) {}
}

const navigateToPoints = () => {
  if (checkLogin()) uni.navigateTo({ url: '/pages/Points/Points' })
}

const loadCouponCount = async () => {
	if (!userInfo.value.id) return
	try {
		const res = await getCouponCount(userInfo.value.id)
		if (res.code === 200) couponCount.value = res.data.count || 0
	} catch (error) {}
}


const goToAI = () => {
  uni.navigateTo({ url: '/pages/AI/AIchat' })
}
const updateDisplayAvatar = () => {
	const avatar = userInfo.value.avatar
	if (!avatar) {
		displayAvatar.value = '/static/人物.png'
	} else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
		displayAvatar.value = avatar
	} else if (avatar.startsWith('/uploads/')) {
		displayAvatar.value = BASE_URL + avatar
	} else {
		displayAvatar.value = avatar
	}
	avatarKey.value++
}


const onAvatarError = () => {
	displayAvatar.value = '/static/人物.png'
	avatarKey.value++
}

const checkLogin = () => {
	if (!userInfo.value.username) {
		uni.navigateTo({ url: '/pages/Login/Login' })
		return false
	}
	return true
}

const navigateToProfile = () => { if (checkLogin()) uni.navigateTo({ url: '/pages/Myhome/Profile' }) }
const navigateToCoupon = () => { if (checkLogin()) uni.navigateTo({ url: '/pages/Coupon/Coupon' }) }
const navigateToChat = () => { if (checkLogin()) uni.navigateTo({ url: '/pages/Chat/Chat' }) }
const navigateToBabyStatus = () => { if (checkLogin()) uni.navigateTo({ url: '/pages/Myhome/babyStatus' }) }
const navigateToOrders = (status) => { if (checkLogin()) uni.navigateTo({ url: `/pages/Orders/Orders?status=${status || ''}` }) }
const navigateToAddress = () => { if (checkLogin()) uni.navigateTo({ url: '/pages/Address/Address' }) }

onShow(() => loadUserInfo())
onMounted(() => loadUserInfo())
</script>

<style scoped>
.my-home-page { min-height: 100vh; background-color: #f5f5f5; }
.user-info-section { display: flex; align-items: center; background-color: #ff6b6b; padding: 40rpx 30rpx; padding-top: calc(var(--status-bar-height) + 40rpx); color: #fff; }
.user-avatar { width: 120rpx; height: 120rpx; border-radius: 50%; overflow: hidden; background-color: #fff; }
.user-avatar image { width: 100%; height: 100%; }
.user-info { flex: 1; margin-left: 30rpx; }
.user-name { font-size: 32rpx; font-weight: bold; display: block; margin-bottom: 10rpx; }
.user-phone { font-size: 24rpx; opacity: 0.8; }
.user-arrow { font-size: 32rpx; }
.order-section { background-color: #fff; margin-top: 20rpx; padding: 20rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 32rpx; font-weight: bold; color: #333; }
.section-more { font-size: 24rpx; color: #999; }
.order-status { display: flex; justify-content: space-around; }
.status-item { display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.status-icon { font-size: 48rpx; }
.status-text { font-size: 24rpx; color: #333; }
.function-section { background-color: #fff; margin-top: 20rpx; }
.function-item { display: flex; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.function-item:last-child { border-bottom: none; }
.function-icon { font-size: 32rpx; margin-right: 20rpx; }
.function-text { flex: 1; font-size: 28rpx; color: #333; }
.unread-badge { min-width: 36rpx; height: 36rpx; background-color: #ff6b6b; color: #fff; font-size: 22rpx; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; padding: 0 8rpx; margin-right: 10rpx; }

.ai-float-btn {
  position: fixed;
  right: 30rpx;
  bottom: 200rpx;
  width: 90rpx;
  height: 90rpx;
  padding: 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 20rpx rgba(102, 126, 234, 0.4);
  z-index: 999;
}
.ai-icon { font-size: 44rpx; }
.edit-btn {
  padding: 8rpx 20rpx;
  border: 2rpx solid rgba(255,255,255,0.8);
  border-radius: 25rpx;
  font-size: 22rpx;
  color: #fff;
}
.version-info { text-align: center; padding: 40rpx 0; }
.version-text { font-size: 24rpx; color: #999; }
</style>