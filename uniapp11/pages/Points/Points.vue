<template>
	<view class="points-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">积分中心</text>
			<text class="header-placeholder"></text>
		</view>

		<!-- 积分余额卡片 -->
		<view class="points-card">
			<text class="points-label">当前积分</text>
			<text class="points-num">{{ points }}</text>
			<view class="points-actions">
				<button class="action-btn shop-btn" @click="goShop">积分商城</button>
				<button class="action-btn exchange-btn" @click="goRecords">积分记录</button>
				<button class="action-btn records-btn" @click="goExchangeRecords">兑换记录</button>
			</view>
		</view>

		<!-- 积分规则 -->
		<view class="rule-section">
			<text class="section-title">积分规则</text>
			<view class="rule-list">
				<view class="rule-item">
					<text class="rule-icon">🛒</text>
					<text class="rule-text">消费满100元得30积分，不满得20积分</text>
				</view>
				<view class="rule-item">
					<text class="rule-icon">⭐</text>
					<text class="rule-text">完成商品评价得5积分</text>
				</view>
				<view class="rule-item">
					<text class="rule-icon">💱</text>
					<text class="rule-text">10积分可抵扣1元（下单时使用）</text>
				</view>
				<view class="rule-item">
				      <text class="warning-icon">⚠️</text>
				      <text class="rule-text-sub">积分最多抵扣商品价格的50%</text>
				</view>
				
			</view>
		</view>

		<!-- 最近记录 -->
		<view class="record-section">
			<view class="section-header">
				<text class="section-title">最近记录</text>
				<text class="section-more" @click="goRecords">全部 ></text>
			</view>
			<view class="record-item" v-for="item in recentRecords" :key="item.id">
				<view class="record-left">
					<text class="record-source">{{ item.source }}</text>
					<text class="record-desc">{{ item.description }}</text>
					<text class="record-time">{{ formatTime(item.createTime) }}</text>
				</view>
				<text class="record-points" :class="item.type">
					{{ item.type === 'income' ? '+' : '-' }}{{ item.points }}
				</text>
			</view>
			<view v-if="recentRecords.length === 0" class="empty-text">暂无积分记录</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUserPoints, getPointsRecords } from '../../api/index.js'

const points = ref(0)
const recentRecords = ref([])

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const formatTime = (time) => {
	if (!time) return ''
	return time.split('T')[0]
}

const loadData = async () => {
	const user = getCurrentUser()
	if (!user) return
	try {
		const [pRes, rRes] = await Promise.all([
			getUserPoints(user.id),
			getPointsRecords(user.id)
		])
		if (pRes.code === 200) points.value = pRes.data.points
		if (rRes.code === 200) recentRecords.value = (rRes.data || []).slice(0, 5)
	} catch (error) {}
}

const goShop = () => {
	uni.navigateTo({ url: '/pages/Points/Shop' })
}

const goRecords = () => {
	uni.navigateTo({ url: '/pages/Points/Records' })
}

const goExchangeRecords = () => {
	uni.navigateTo({ url: '/pages/Points/ExchangeRecords' })
}

const navigateBack = () => uni.navigateBack()

onMounted(() => loadData())
</script>

<style scoped>
.points-page { min-height: 100vh; background-color: #f5f5f5; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }

.points-card { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); margin: 20rpx; border-radius: 20rpx; padding: 50rpx 40rpx; text-align: center; color: #fff; }
.points-label { font-size: 26rpx; opacity: 0.9; }
.points-num { font-size: 80rpx; font-weight: bold; display: block; margin: 15rpx 0 25rpx; }
.points-actions { display: flex; gap: 16rpx; justify-content: center; }
.action-btn { padding: 14rpx 24rpx; border-radius: 30rpx; font-size: 24rpx; border: none; line-height: 1.6; }
.action-btn::after { border: none; }
.shop-btn { background-color: #fff; color: #ff6b6b; font-weight: bold; }
.exchange-btn { background-color: rgba(255,255,255,0.85); color: #ff6b6b; }
.records-btn { background-color: rgba(255,255,255,0.25); color: #fff; }

.rule-section { background-color: #fff; margin: 20rpx; border-radius: 16rpx; padding: 25rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 20rpx; display: block; }
.rule-item { display: flex; align-items: center; gap: 15rpx; padding: 12rpx 0; }
.rule-icon { font-size: 32rpx; }
.rule-text { font-size: 26rpx; color: #666; }

.record-section { background-color: #fff; margin: 20rpx; border-radius: 16rpx; padding: 25rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15rpx; }
.section-more { font-size: 24rpx; color: #999; }
.record-item { display: flex; justify-content: space-between; align-items: center; padding: 18rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.record-item:last-child { border-bottom: none; }
.record-source { font-size: 28rpx; color: #333; display: block; }
.record-desc { font-size: 24rpx; color: #999; margin-top: 4rpx; display: block; }
.record-time { font-size: 22rpx; color: #ccc; margin-top: 4rpx; display: block; }
.record-points { font-size: 30rpx; font-weight: bold; }
.record-points.income { color: #ff6b6b; }
.record-points.expense { color: #4caf50; }
.empty-text { text-align: center; padding: 40rpx 0; color: #ccc; font-size: 26rpx; }
</style>
