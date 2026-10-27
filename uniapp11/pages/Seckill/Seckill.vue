<template>
	<view class="seckill-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">限时秒杀</text>
			<text class="header-placeholder"></text>
		</view>

		<view v-if="loading" class="loading-container">
			<text>加载中...</text>
		</view>

		<view v-else-if="sessions.length === 0" class="empty-container">
			<text class="empty-text">暂无秒杀活动</text>
		</view>

		<view v-else class="session-list">
			<view class="session-card" v-for="session in sessions" :key="session.id">
				<view class="session-header">
					<view class="session-title-wrap">
						<text class="session-title">{{ session.name }}</text>
						<text class="session-status" :class="statusClass(session.status)">{{ session.status }}</text>
					</view>
					<view class="session-countdown" v-if="session.status === '进行中'">
						<text class="countdown-label">距结束</text>
						<text class="countdown-time">{{ countdownText(session.endTime) }}</text>
					</view>
					<text class="session-time" v-else>{{ formatRange(session) }}</text>
				</view>

				<view class="seckill-goods" v-for="item in session.goods" :key="item.id">
					<image class="goods-image" :src="getImageUrl(item.goodsImage)" mode="aspectFill"></image>
					<view class="goods-info">
						<text class="goods-name">{{ item.goodsName }}</text>
						<view class="price-row">
							<text class="seckill-price">￥{{ formatPrice(item.seckillPrice) }}</text>
							<text class="original-price">￥{{ formatPrice(item.originalPrice) }}</text>
						</view>
						<text class="stock-text" :class="{ 'stock-low': item.stock > 0 && item.stock <= 3 }">
							{{ item.stock > 0 ? `仅剩 ${item.stock} 件` : '已抢完' }}
						</text>
					</view>
					<view
						class="buy-btn"
						:class="{ disabled: item.stock <= 0 || session.status !== '进行中' }"
						@click="handleBuy(item, session)"
					>
						<text>{{ buyButtonText(item, session) }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getSeckillSessions, seckillBuy, payOrder } from '../../api/index.js'
import { BASE_URL } from '../../config.js'

const sessions = ref([])
const loading = ref(false)
// 服务端时间与本地时间的偏差，用于校准倒计时
const serverOffset = ref(0)
const nowTick = ref(Date.now())
let timer = null

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const loadSessions = async () => {
	loading.value = true
	try {
		const res = await getSeckillSessions()
		if (res.code === 200) {
			sessions.value = res.data || []
			serverOffset.value = (res.serverTime || Date.now()) - Date.now()
		}
	} catch (e) {
		console.error('加载秒杀场次失败:', e)
	} finally {
		loading.value = false
	}
}

onShow(() => {
	loadSessions()
	timer = setInterval(() => { nowTick.value = Date.now() }, 1000)
})

onUnmounted(() => {
	if (timer) clearInterval(timer)
})

const statusClass = (status) => ({
	'badge-active': status === '进行中',
	'badge-wait': status === '未开始',
	'badge-over': status === '已结束' || status === '已下线'
})

const formatPrice = (price) => Number(price).toFixed(2)

const formatRange = (session) => {
	const fmt = (t) => {
		const d = new Date(t)
		const h = String(d.getHours()).padStart(2, '0')
		const m = String(d.getMinutes()).padStart(2, '0')
		return `${h}:${m}`
	}
	return `${fmt(session.startTime)} - ${fmt(session.endTime)}`
}

const countdownText = (endTime) => {
	const left = Math.max(0, new Date(endTime).getTime() - (nowTick.value + serverOffset.value))
	const h = String(Math.floor(left / 3600000)).padStart(2, '0')
	const m = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0')
	const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
	return `${h}:${m}:${s}`
}

const buyButtonText = (item, session) => {
	if (session.status === '未开始') return '未开始'
	if (session.status !== '进行中') return '已结束'
	if (item.stock <= 0) return '已抢完'
	return '立即抢购'
}

const getImageUrl = (img) => {
	if (!img) return '/static/商品.png'
	if (img.startsWith('http')) return img
	return BASE_URL + img
}

const handleBuy = (item, session) => {
	if (item.stock <= 0 || session.status !== '进行中') return
	const user = getCurrentUser()
	if (!user) {
		uni.showModal({
			title: '提示', content: '请先登录', success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) }
		})
		return
	}
	uni.showLoading({ title: '抢购中...' })
	seckillBuy(item.id, 1).then(async (res) => {
		uni.hideLoading()
		if (res.code === 200) {
			uni.showModal({
				title: '抢购成功',
				content: `已按秒杀价 ￥${formatPrice(res.data.totalAmount)} 锁定订单，去支付？`,
				confirmText: '去支付',
				confirmColor: '#ff6b6b',
				success: async (r) => {
					if (r.confirm) {
						try {
							const payRes = await payOrder(res.data.id)
							if (payRes.code === 200) {
								uni.showToast({ title: '支付成功', icon: 'success' })
							} else {
								uni.showToast({ title: payRes.message || '支付失败', icon: 'none' })
							}
						} catch (e) {}
						uni.navigateTo({ url: `/pages/Orders/OrderDetail?orderId=${res.data.id}` })
					}
				}
			})
			loadSessions()
		} else {
			uni.showToast({ title: res.message || '抢购失败', icon: 'none' })
			loadSessions()
		}
	}).catch((e) => {
		uni.hideLoading()
		const msg = (e && e.data && e.data.message) || '抢购失败，请重试'
		uni.showToast({ title: msg, icon: 'none' })
		loadSessions()
	})
}

const navigateBack = () => uni.navigateBack()
</script>

<style scoped>
.seckill-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 40rpx; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }

.loading-container, .empty-container { display: flex; justify-content: center; padding: 200rpx 0; }
.empty-text { color: #999; font-size: 28rpx; }

.session-list { padding: 20rpx; }
.session-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.session-title-wrap { display: flex; align-items: center; gap: 12rpx; }
.session-title { font-size: 32rpx; font-weight: bold; color: #333; }
.session-status { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.badge-active { color: #fff; background: #ff6b6b; }
.badge-wait { color: #ff9800; background: #fff3e0; }
.badge-over { color: #999; background: #f0f0f0; }
.session-countdown { display: flex; align-items: center; gap: 8rpx; }
.countdown-label { font-size: 22rpx; color: #666; }
.countdown-time { font-size: 26rpx; color: #ff6b6b; font-weight: bold; }
.session-time { font-size: 22rpx; color: #999; }

.seckill-goods { display: flex; align-items: center; padding: 16rpx 0; border-top: 1rpx solid #f5f5f5; }
.goods-image { width: 140rpx; height: 140rpx; border-radius: 12rpx; flex-shrink: 0; background: #f5f5f5; }
.goods-info { flex: 1; margin-left: 20rpx; overflow: hidden; }
.goods-name { font-size: 26rpx; color: #333; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.price-row { display: flex; align-items: baseline; gap: 10rpx; margin-top: 10rpx; }
.seckill-price { font-size: 32rpx; color: #ff6b6b; font-weight: bold; }
.original-price { font-size: 22rpx; color: #999; text-decoration: line-through; }
.stock-text { display: block; font-size: 22rpx; color: #ff9800; margin-top: 8rpx; }
.stock-low { color: #ff4d4d; font-weight: bold; }

.buy-btn { flex-shrink: 0; margin-left: 16rpx; background: linear-gradient(135deg, #ff6b6b, #ff8e53); color: #fff; font-size: 26rpx; padding: 14rpx 28rpx; border-radius: 999rpx; }
.buy-btn.disabled { background: #ccc; }
</style>
