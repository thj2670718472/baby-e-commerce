<template>
	<view class="detail-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">商品详情</text>
			<text class="header-placeholder"></text>
		</view>

		<scroll-view class="content" scroll-y v-if="product">
			<image class="hero-image" :src="getImageUrl(product.image)" mode="aspectFill"></image>

			<view class="main-card">
				<view class="price-row">
					<view class="points-box">
						<text class="points-num">{{ product.points }}</text>
						<text class="points-unit">积分</text>
					</view>
					<text class="stock-text">库存 {{ product.stock }}</text>
				</view>

				<text class="goods-name">{{ product.name }}</text>
				<text class="goods-desc" v-if="product.description">{{ product.description }}</text>

				<view class="meta-row">
					<text class="meta-chip">{{ limitText }}</text>
					<text class="meta-chip">已兑换 {{ product.exchangedCount || 0 }} 件</text>
				</view>
			</view>

			<view class="section-card">
				<view class="section-header">
					<text class="section-title">收货地址</text>
					<text class="section-action" @click="goAddress">管理地址 ›</text>
				</view>
				<view class="address-box" @click="goAddress">
					<template v-if="selectedAddress">
						<view class="address-user">
							<text class="address-name">{{ selectedAddress.name }}</text>
							<text class="address-phone">{{ selectedAddress.phone }}</text>
						</view>
						<text class="address-detail">{{ formatAddress(selectedAddress) }}</text>
					</template>
					<text v-else class="address-empty">还没有收货地址，点击添加</text>
				</view>
			</view>

			<view class="section-card">
				<text class="section-title">商品介绍</text>
				<text class="section-content">{{ product.detail || product.description || '暂无详细介绍' }}</text>
			</view>

			<view class="section-card">
				<text class="section-title">兑换须知</text>
				<text class="section-content">{{ product.rules || '积分兑换商品不支持无理由退换，请在兑换前确认商品信息。' }}</text>
			</view>

			<view class="section-card">
				<text class="section-title">配送说明</text>
				<text class="section-content">{{ product.shippingNote || '兑换成功后 48 小时内发货，节假日顺延。' }}</text>
			</view>

			<view class="bottom-space"></view>
		</scroll-view>

		<view v-else-if="!loading" class="empty-container">
			<text class="empty-text">商品不存在或已下架</text>
			<text class="empty-link" @click="navigateBack">返回积分商城</text>
		</view>

		<view v-else class="empty-container">
			<text class="empty-text">加载中...</text>
		</view>

		<view class="bottom-bar" v-if="product">
			<view class="balance-box">
				<text class="balance-label">我的积分</text>
				<text class="balance-num">{{ isLoggedIn ? points : '未登录' }}</text>
			</view>
			<button
				class="exchange-btn"
				:class="{ disabled: !canExchange }"
				:disabled="!canExchange"
				@click="openConfirm"
			>
				{{ actionText }}
			</button>
		</view>

		<view class="modal-mask" v-if="showConfirm && product" @click="closeConfirm">
			<view class="modal" @click.stop>
				<text class="modal-title">确认兑换</text>

				<view class="modal-row">
					<text class="modal-label">商品</text>
					<text class="modal-value">{{ product.name }}</text>
				</view>

				<view class="modal-row">
					<text class="modal-label">收货地址</text>
					<text class="modal-value address">{{ selectedAddress ? formatAddress(selectedAddress) : '请先添加收货地址' }}</text>
				</view>

				<view class="modal-row">
					<text class="modal-label">兑换数量</text>
					<view class="qty-control">
						<text class="qty-btn" :class="{ disabled: quantity <= 1 }" @click="changeQuantity(-1)">-</text>
						<text class="qty-value">{{ quantity }}</text>
						<text class="qty-btn" :class="{ disabled: quantity >= maxQuantity }" @click="changeQuantity(1)">+</text>
					</view>
				</view>

				<view class="modal-row">
					<text class="modal-label">消耗积分</text>
					<text class="modal-value highlight">{{ totalPoints }}</text>
				</view>

				<text class="modal-tip">{{ product.rules || '积分商品不支持无理由退换，请确认后兑换。' }}</text>

				<view class="modal-actions">
					<button class="modal-btn cancel" @click="closeConfirm">取消</button>
					<button class="modal-btn confirm" :disabled="submitting" @click="confirmExchange">
						{{ submitting ? '提交中...' : '确认兑换' }}
					</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
	getPointsGoodsDetail,
	exchangePointsGoods,
	getUserPoints,
	getAddressList,
	BASE_URL
} from '../../api/index.js'

const productId = ref(null)
const product = ref(null)
const loading = ref(false)
const submitting = ref(false)
const showConfirm = ref(false)
const quantity = ref(1)
const points = ref(0)
const addressList = ref([])

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) {
		return null
	}
}

const isLoggedIn = computed(() => !!getCurrentUser())

const selectedAddress = computed(() => {
	if (!addressList.value.length) return null
	return addressList.value.find((item) => item.isDefault) || addressList.value[0]
})

const maxQuantity = computed(() => {
	if (!product.value) return 1
	let max = Math.min(99, Number(product.value.stock) || 0)
	if (Number(product.value.redeemLimit) > 0) {
		max = Math.min(max, Number(product.value.userRemaining) || 0)
	}
	return Math.max(1, max)
})

const totalPoints = computed(() => {
	if (!product.value) return 0
	return Number(product.value.points) * quantity.value
})

const limitText = computed(() => {
	if (!product.value) return ''
	return Number(product.value.redeemLimit) > 0
		? `每人限兑 ${product.value.redeemLimit} 件`
		: '不限兑换数量'
})

const actionText = computed(() => {
	if (!product.value) return '立即兑换'
	if (Number(product.value.stock) <= 0) return '已兑完'
	if (!isLoggedIn.value) return '登录后兑换'
	if (!selectedAddress.value) return '请先添加地址'
	if (Number(product.value.redeemLimit) > 0 && Number(product.value.userRemaining) <= 0) return '已达限兑数量'
	if (points.value < totalPoints.value) return '积分不足'
	return '立即兑换'
})

const canExchange = computed(() => {
	if (!product.value) return false
	if (Number(product.value.stock) <= 0) return false
	if (!isLoggedIn.value) return true
	if (!selectedAddress.value) return false
	if (Number(product.value.redeemLimit) > 0 && Number(product.value.userRemaining) <= 0) return false
	return points.value >= totalPoints.value
})

const getImageUrl = (image) => {
	if (!image) return '/static/商品.png'
	if (image.startsWith('http') || image.startsWith('data:')) return image
	if (image.startsWith('/')) return BASE_URL + image
	return BASE_URL + image
}

const formatAddress = (address) => {
	if (!address) return ''
	return `${address.province || ''}${address.city || ''}${address.district || ''}${address.detail || ''}`
}

const loadAddresses = async () => {
	const user = getCurrentUser()
	if (!user) {
		addressList.value = []
		return
	}
	try {
		const res = await getAddressList(user.id)
		if (res.code === 200) addressList.value = res.data || []
	} catch (error) {
		addressList.value = []
	}
}

const loadPoints = async () => {
	const user = getCurrentUser()
	if (!user) {
		points.value = 0
		return
	}
	try {
		const res = await getUserPoints(user.id)
		if (res.code === 200) points.value = Number(res.data.points) || 0
	} catch (error) {
		points.value = 0
	}
}

const loadProduct = async () => {
	if (!productId.value) return
	loading.value = true
	try {
		const res = await getPointsGoodsDetail(productId.value)
		if (res.code === 200) {
			product.value = res.data
			quantity.value = 1
			await Promise.all([loadPoints(), loadAddresses()])
		} else {
			product.value = null
		}
	} catch (error) {
		product.value = null
	} finally {
		loading.value = false
	}
}

const changeQuantity = (step) => {
	const next = quantity.value + step
	if (next < 1 || next > maxQuantity.value) return
	quantity.value = next
}

const openConfirm = () => {
	if (!isLoggedIn.value) {
		uni.showModal({
			title: '提示',
			content: '请先登录后再兑换',
			confirmText: '去登录',
			success: (res) => {
				if (res.confirm) uni.navigateTo({ url: '/pages/Login/Login' })
			}
		})
		return
	}
	if (!canExchange.value) {
		uni.showToast({ title: actionText.value, icon: 'none' })
		return
	}
	quantity.value = 1
	showConfirm.value = true
}

const closeConfirm = () => {
	if (submitting.value) return
	showConfirm.value = false
}

const confirmExchange = async () => {
	if (!product.value || !selectedAddress.value || submitting.value) return
	submitting.value = true
	try {
		const res = await exchangePointsGoods({
			pointsGoodsId: product.value.id,
			quantity: quantity.value,
			address: formatAddress(selectedAddress.value),
			phone: selectedAddress.value.phone
		})
		if (res.code === 200) {
			showConfirm.value = false
			uni.showToast({ title: '兑换成功', icon: 'success' })
			await loadProduct()
		} else {
			uni.showToast({ title: res.message || '兑换失败', icon: 'none' })
		}
	} catch (error) {
		uni.showToast({ title: error.message || '兑换失败', icon: 'none' })
	} finally {
		submitting.value = false
	}
}

const goAddress = () => {
	if (!isLoggedIn.value) {
		uni.showModal({
			title: '提示',
			content: '请先登录后再管理收货地址',
			confirmText: '去登录',
			success: (res) => {
				if (res.confirm) uni.navigateTo({ url: '/pages/Login/Login' })
			}
		})
		return
	}
	uni.navigateTo({ url: '/pages/Address/Address' })
}

const navigateBack = () => {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.redirectTo({ url: '/pages/Points/Shop' })
	}
}

onLoad((options) => {
	productId.value = options.id
	loadProduct()
})

onShow(() => {
	if (productId.value) loadAddresses()
})
</script>

<style scoped>
.detail-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f5f5f5;
	overflow: hidden;
}

.page-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx;
	padding-top: calc(var(--status-bar-height) + 30rpx);
	background-color: #ffffff;
	flex-shrink: 0;
}
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-placeholder { width: 60rpx; }

.content {
	flex: 1;
	height: 0;
}

.hero-image {
	width: 100%;
	height: 560rpx;
	display: block;
	background-color: #f0f0f0;
}

.main-card {
	margin: 20rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border-radius: 18rpx;
}
.price-row { display: flex; justify-content: space-between; align-items: center; }
.points-box { display: flex; align-items: baseline; }
.points-num { font-size: 46rpx; color: #ff6b6b; font-weight: bold; }
.points-unit { font-size: 24rpx; color: #ff6b6b; margin-left: 6rpx; }
.stock-text { font-size: 24rpx; color: #999; }
.goods-name { display: block; margin-top: 16rpx; font-size: 34rpx; color: #333; font-weight: bold; line-height: 1.4; }
.goods-desc { display: block; margin-top: 10rpx; font-size: 25rpx; color: #888; line-height: 1.6; }
.meta-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.meta-chip { padding: 7rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; color: #ff6b6b; background-color: #fff2ef; }

.section-card {
	margin: 0 20rpx 20rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border-radius: 18rpx;
}
.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title { display: block; font-size: 29rpx; color: #333; font-weight: bold; }
.section-action { font-size: 23rpx; color: #ff8e8e; }
.section-content { display: block; margin-top: 16rpx; font-size: 25rpx; color: #666; line-height: 1.8; white-space: pre-wrap; }

.address-box { margin-top: 18rpx; padding: 22rpx; border-radius: 14rpx; background-color: #fff7f5; }
.address-user { display: flex; align-items: center; gap: 18rpx; margin-bottom: 8rpx; }
.address-name { font-size: 27rpx; color: #333; font-weight: bold; }
.address-phone { font-size: 24rpx; color: #777; }
.address-detail { display: block; font-size: 24rpx; color: #666; line-height: 1.6; }
.address-empty { font-size: 24rpx; color: #ff8e8e; }

.bottom-space { height: 20rpx; }
.bottom-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	padding: 18rpx 24rpx;
	padding-bottom: calc(env(safe-area-inset-bottom) + 18rpx);
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	flex-shrink: 0;
}
.balance-box { display: flex; flex-direction: column; }
.balance-label { font-size: 21rpx; color: #999; }
.balance-num { margin-top: 4rpx; font-size: 30rpx; color: #ff6b6b; font-weight: bold; }
.exchange-btn {
	width: 320rpx;
	height: 76rpx;
	line-height: 76rpx;
	margin: 0;
	border: none;
	border-radius: 38rpx;
	font-size: 28rpx;
	color: #fff;
	background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
}
.exchange-btn::after { border: none; }
.exchange-btn.disabled { background: #d8d8d8; }

.empty-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}
.empty-text { font-size: 27rpx; color: #999; }
.empty-link { margin-top: 20rpx; font-size: 25rpx; color: #ff6b6b; }

.modal-mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 99;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: rgba(0, 0, 0, 0.45);
}
.modal { width: 620rpx; padding: 36rpx 28rpx 28rpx; border-radius: 22rpx; background-color: #fff; }
.modal-title { display: block; text-align: center; font-size: 32rpx; font-weight: bold; color: #333; margin-bottom: 24rpx; }
.modal-row { display: flex; justify-content: space-between; align-items: center; gap: 24rpx; padding: 14rpx 0; }
.modal-label { flex-shrink: 0; font-size: 25rpx; color: #999; }
.modal-value { font-size: 25rpx; color: #333; text-align: right; }
.modal-value.address { line-height: 1.5; }
.modal-value.highlight { font-size: 34rpx; color: #ff6b6b; font-weight: bold; }
.modal-tip { display: block; margin-top: 16rpx; font-size: 21rpx; color: #aaa; line-height: 1.6; }
.qty-control { display: flex; align-items: center; }
.qty-btn { width: 54rpx; height: 54rpx; padding: 0; line-height: 50rpx; text-align: center; border: 1rpx solid #ddd; border-radius: 10rpx; font-size: 32rpx; color: #666; }
.qty-btn.disabled { opacity: 0.35; }
.qty-value { min-width: 72rpx; text-align: center; font-size: 28rpx; color: #333; }
.modal-actions { display: flex; gap: 20rpx; margin-top: 28rpx; }
.modal-btn { flex: 1; height: 76rpx; line-height: 76rpx; border: none; border-radius: 38rpx; font-size: 27rpx; }
.modal-btn::after { border: none; }
.modal-btn.cancel { background-color: #f5f5f5; color: #666; }
.modal-btn.confirm { color: #fff; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); }
</style>
