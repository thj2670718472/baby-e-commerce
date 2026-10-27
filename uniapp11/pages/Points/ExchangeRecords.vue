<template>
	<view class="exchange-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">兑换记录</text>
			<text class="header-placeholder"></text>
		</view>

		<scroll-view class="content" scroll-y v-if="records.length > 0">
			<view class="record-item" v-for="item in records" :key="item.id">
				<image class="record-image" :src="getImageUrl(item.goodsImage)" mode="aspectFill"></image>

				<view class="record-info">
					<text class="record-name">{{ item.goodsName }}</text>
					<text class="record-time">{{ formatTime(item.createTime) }}</text>
					<text class="record-address" v-if="item.address">寄送至：{{ item.address }}</text>
				</view>

				<view class="record-right">
					<text class="record-points">-{{ item.points }}</text>
					<text class="record-status" :class="statusClass(item.status)">{{ item.status }}</text>
				</view>
			</view>
		</scroll-view>

		<view v-else-if="!loading" class="empty-container">
			<text class="empty-text">暂无兑换记录</text>
			<text class="empty-link" @click="goShop">去积分商城看看 ></text>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getExchangeRecords, BASE_URL } from '../../api/index.js'

const records = ref([])
const loading = ref(false)

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const getImageUrl = (image) => {
	if (!image) return '/static/商品.png'
	if (image.startsWith('http') || image.startsWith('data:')) return image
	return BASE_URL + image
}

const formatTime = (time) => {
	if (!time) return ''
	const [date, rest] = String(time).split('T')
	return date + ' ' + (rest ? rest.split('.')[0] : '')
}

const statusClass = (status) => {
	if (status === '已完成') return 'done'
	if (status === '已取消') return 'cancel'
	if (status === '已发货') return 'shipped'
	return 'pending'
}

const loadData = async () => {
	const user = getCurrentUser()
	if (!user) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		return
	}

	loading.value = true
	try {
		const res = await getExchangeRecords(user.id)
		if (res.code === 200) records.value = res.data || []
	} catch (error) {
		records.value = []
	} finally {
		loading.value = false
	}
}

const goShop = () => {
	uni.redirectTo({ url: '/pages/Points/Shop' })
}

const navigateBack = () => uni.navigateBack()

onMounted(() => loadData())
</script>

<style scoped>
.exchange-page { min-height: 100vh; background-color: #f5f5f5; }

.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }

.content { padding: 20rpx; }
.record-item { display: flex; align-items: flex-start; gap: 20rpx; background-color: #fff; padding: 24rpx; border-radius: 16rpx; margin-bottom: 12rpx; }
.record-image { width: 120rpx; height: 120rpx; border-radius: 12rpx; background-color: #f5f5f5; flex-shrink: 0; }

.record-info { flex: 1; overflow: hidden; }
.record-name { font-size: 28rpx; color: #333; font-weight: bold; display: block; }
.record-time { font-size: 22rpx; color: #999; margin-top: 8rpx; display: block; }
.record-address { font-size: 22rpx; color: #bbb; margin-top: 8rpx; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.record-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10rpx; flex-shrink: 0; }
.record-points { font-size: 30rpx; color: #ff6b6b; font-weight: bold; }
.record-status { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 20rpx; }
.record-status.pending { color: #ff9800; background-color: #fff5e6; }
.record-status.shipped { color: #2196f3; background-color: #e8f4ff; }
.record-status.done { color: #4caf50; background-color: #eef8ee; }
.record-status.cancel { color: #999; background-color: #f2f2f2; }

.empty-container { display: flex; flex-direction: column; align-items: center; padding: 150rpx 0; }
.empty-text { font-size: 28rpx; color: #999; }
.empty-link { font-size: 24rpx; color: #ff6b6b; margin-top: 20rpx; }
</style>
