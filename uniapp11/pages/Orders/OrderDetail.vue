<template>
	<view class="order-detail-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">订单详情</text>
			<text class="header-placeholder"></text>
		</view>
		
		<scroll-view class="content" scroll-y v-if="orderDetail">
			<!-- 订单状态 -->
			<view class="status-card">
				<view class="status-icon">{{ getStatusIcon(orderDetail.status) }}</view>
				<text class="status-text">{{ orderDetail.status }}</text>
				<text class="status-desc">{{ getStatusDesc(orderDetail.status) }}</text>
			</view>
			
			<!-- 收货地址 -->
			<view class="address-card">
				<view class="card-title">
					<text class="title-icon">📍</text>
					<text class="title-text">收货信息</text>
				</view>
				<view class="address-content">
					<view class="address-line">
						<text class="address-name">{{ orderDetail.userName }}</text>
						<text class="address-phone">{{ orderDetail.phone }}</text>
					</view>
					<text class="address-detail">{{ orderDetail.address }}</text>
				</view>
			</view>
			
			<!-- 商品列表 -->
			<view class="goods-card">
				<view class="card-title">
					<text class="title-icon">🛒</text>
					<text class="title-text">商品信息</text>
				</view>
				<view class="goods-list">
					<view 
						class="goods-item" 
						v-for="goods in orderDetail.order_goods" 
						:key="goods.id"
						@click="viewGoods(goods.goodsId)"
					>
						<image :src="getGoodsImage(goods)" mode="aspectFill"></image>
						<view class="goods-info">
							<text class="goods-name">{{ goods.goodsName }}</text>
							<view class="goods-price-row">
								<text class="goods-price">￥{{ formatPrice(goods.price) }}</text>
								<text class="goods-quantity">x{{ goods.quantity }}</text>
							</view>
						</view>
					</view>
				</view>
			</view>
			
			<!-- 订单信息 -->
			<view class="info-card">
				<view class="info-item">
					<text class="info-label">订单编号</text>
					<text class="info-value">{{ orderDetail.orderNo }}</text>
				</view>
				<view class="info-item">
					<text class="info-label">下单时间</text>
					<text class="info-value">{{ formatTime(orderDetail.orderTime) }}</text>
				</view>
				<view class="info-item">
					<text class="info-label">支付方式</text>
					<text class="info-value">{{ orderDetail.paymentMethod || '在线支付' }}</text>
				</view>
				<view class="info-item" v-if="orderDetail.returnReason">
					<text class="info-label">退货理由</text>
					<text class="info-value">{{ orderDetail.returnReason }}</text>
				</view>
			</view>
			
			<!-- 价格明细 -->
			<view class="price-card">
				<view class="price-item">
					<text class="price-label">商品总额</text>
					<text class="price-value">￥{{ formatPrice(orderDetail.originalAmount || orderDetail.totalAmount) }}</text>
				</view>
				<view class="price-item" v-if="orderDetail.couponAmount > 0">
					<text class="price-label">优惠券</text>
					<text class="price-value discount">-￥{{ formatPrice(orderDetail.couponAmount) }}</text>
				</view>
				<view class="price-item">
					<text class="price-label">运费</text>
					<text class="price-value">￥0.00</text>
				</view>
				<view class="price-item total">
					<text class="price-label">实付款</text>
					<text class="price-value">￥{{ formatPrice(orderDetail.totalAmount) }}</text>
				</view>
			</view>
		</scroll-view>
		
		<!-- 底部操作栏 -->
		<view class="bottom-bar" v-if="orderDetail">
			<template v-if="orderDetail.status === '待付款'">
				<button class="bottom-btn secondary" @click="cancelOrder">取消订单</button>
				<button class="bottom-btn primary" @click="payOrder">去付款</button>
			</template>
			<template v-else-if="orderDetail.status === '已发货'">
				<button class="bottom-btn secondary" @click="viewLogistics">查看物流</button>
				<button class="bottom-btn primary" @click="confirmReceive">确认收货</button>
			</template>
			<template v-else-if="orderDetail.status === '已完成'">
				<button class="bottom-btn secondary" @click="applyReturn">申请退货</button>
				<button class="bottom-btn primary" @click="buyAgain">再次购买</button>
			</template>
			<template v-else-if="orderDetail.status === '退货中'">
			
			</template>
			
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { 
	getOrderDetail, 
	cancelOrder as apiCancelOrder, 
	receiveOrder as apiReceiveOrder,
	payOrder as apiPayOrder,
	BASE_URL 
} from '../../api/index.js'

const orderId = ref('')
const orderDetail = ref(null)
const DEFAULT_IMAGE = '/static/商品.png'

const formatPrice = (price) => Number(price).toFixed(2)

const formatTime = (time) => {
	if (!time) return ''
	const date = new Date(time)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const getGoodsImage = (goods) => {
	if (!goods.goodsImage) return DEFAULT_IMAGE
	let image = goods.goodsImage
	if (typeof image === 'string') {
		if (image.startsWith('http://') || image.startsWith('https://')) return image
		if (image.startsWith('/uploads/')) return BASE_URL + image
		if (image.startsWith('data:image')) return image
		try {
			const parsed = JSON.parse(image)
			if (Array.isArray(parsed) && parsed.length > 0) image = parsed[0]
		} catch (e) {}
	}
	if (Array.isArray(image) && image.length > 0) image = image[0]
	if (typeof image === 'string') {
		if (image.startsWith('http')) return image
		if (image.startsWith('/uploads/')) return BASE_URL + image
	}
	return DEFAULT_IMAGE
}

const getStatusIcon = (status) => {
	const map = {
		'待付款': '💳', '已付款': '📦', '待发货': '📦',
		'已发货': '🚚', '已完成': '✅', '已取消': '❌',
		'退货中': '🔄', '已退货': '↩️'
	}
	return map[status] || '📋'
}

const getStatusDesc = (status) => {
	const map = {
		'待付款': '请尽快完成支付',
		'已付款': '等待商家发货',
		'待发货': '等待商家发货',
		'已发货': '商品正在配送中',
		'已完成': '交易已完成',
		'已取消': '订单已取消',
		'退货中': '退货申请处理中',
		'已退货': '已退货'
	}
	return map[status] || ''
}

const loadOrderDetail = async () => {
	try {
		const res = await getOrderDetail(orderId.value)
		if (res.code === 200) orderDetail.value = res.data
	} catch (error) {
		uni.showToast({ title: '加载失败', icon: 'none' })
	}
}

// 查看物流
const viewLogistics = () => {
  uni.navigateTo({ 
    url: `/pages/Orders/Logistics?orderId=${orderDetail.value.id}` 
  })
}

const viewGoods = (goodsId) => {
	uni.navigateTo({ url: `/pages/GoodsDetail/GoodsDetail?id=${goodsId}` })
}

const payOrder = async () => {
	const res = await uni.showModal({
		title: '模拟支付',
		content: `确认支付 ￥${formatPrice(orderDetail.value.totalAmount)} 吗？`,
		confirmText: '支付'
	})
	if (res.confirm) {
		uni.showLoading({ title: '支付中...' })
		const result = await apiPayOrder(orderId.value)
		uni.hideLoading()
		if (result.code === 200) {
			uni.showToast({ title: '支付成功', icon: 'success' })
			loadOrderDetail()
		} else {
			uni.showToast({ title: result.message || '支付失败', icon: 'none' })
		}
	}
}

const cancelOrder = async () => {
	const res = await uni.showModal({
		title: '提示', content: '确定要取消订单吗？', confirmText: '确定'
	})
	if (res.confirm) {
		uni.showLoading({ title: '取消中...' })
		const result = await apiCancelOrder(orderId.value)
		uni.hideLoading()
		if (result.code === 200) {
			uni.showToast({ title: '订单已取消', icon: 'success' })
			setTimeout(() => uni.navigateBack(), 1500)
		} else {
			uni.showToast({ title: result.message || '取消失败', icon: 'none' })
		}
	}
}

const confirmReceive = async () => {
	const res = await uni.showModal({
		title: '提示', content: '确认已收到商品吗？', confirmText: '确认'
	})
	if (res.confirm) {
		uni.showLoading({ title: '处理中...' })
		const result = await apiReceiveOrder(orderId.value)
		uni.hideLoading()
		if (result.code === 200) {
			uni.showToast({ title: '确认收货成功', icon: 'success' })
			loadOrderDetail()
		} else {
			uni.showToast({ title: result.message || '操作失败', icon: 'none' })
		}
	}
}

const applyReturn = () => {
	uni.navigateBack()
	setTimeout(() => { uni.$emit('applyReturn', orderId.value) }, 100)
}

const buyAgain = () => { uni.switchTab({ url: '/pages/Home/Home' }) }


const navigateBack = () => { uni.navigateBack() }

onLoad((options) => {
	orderId.value = options.orderId
	loadOrderDetail()
})
</script>

<style scoped>
.order-detail-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 120rpx; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }
.content { padding: 20rpx; }
.status-card { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); border-radius: 16rpx; padding: 40rpx 30rpx; margin-bottom: 20rpx; color: #fff; display: flex; flex-direction: column; align-items: center; }
.status-icon { font-size: 60rpx; margin-bottom: 15rpx; }
.status-text { font-size: 36rpx; font-weight: bold; margin-bottom: 10rpx; }
.status-desc { font-size: 24rpx; opacity: 0.9; }
.address-card, .goods-card, .info-card, .price-card { background-color: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 20rpx; }
.card-title { display: flex; align-items: center; margin-bottom: 20rpx; }
.title-icon { font-size: 32rpx; margin-right: 10rpx; }
.title-text { font-size: 30rpx; font-weight: bold; }
.address-line { display: flex; gap: 30rpx; margin-bottom: 10rpx; }
.address-name { font-size: 30rpx; font-weight: bold; }
.address-phone { font-size: 28rpx; color: #666; }
.address-detail { font-size: 26rpx; color: #666; line-height: 1.5; }
.goods-item { display: flex; gap: 20rpx; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.goods-item:last-child { border-bottom: none; }
.goods-item image { width: 120rpx; height: 120rpx; border-radius: 12rpx; }
.goods-info { flex: 1; }
.goods-name { font-size: 26rpx; line-height: 1.4; }
.goods-price-row { display: flex; justify-content: space-between; margin-top: 10rpx; }
.goods-price { font-size: 28rpx; color: #ff6b6b; font-weight: bold; }
.goods-quantity { font-size: 24rpx; color: #999; }
.info-item { display: flex; justify-content: space-between; padding: 15rpx 0; }
.info-label { font-size: 26rpx; color: #666; }
.info-value { font-size: 26rpx; color: #333; }
.price-item { display: flex; justify-content: space-between; padding: 15rpx 0; }
.price-item.total { border-top: 1rpx solid #f0f0f0; margin-top: 10rpx; padding-top: 20rpx; }
.price-label { font-size: 26rpx; color: #666; }
.price-value { font-size: 26rpx; color: #333; }
.price-value.discount { color: #ff6b6b; }
.price-item.total .price-value { font-size: 32rpx; color: #ff6b6b; font-weight: bold; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 20rpx; padding: 20rpx 30rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background-color: #fff; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05); }
.bottom-btn { flex: 1; height: 80rpx; border-radius: 40rpx; font-size: 28rpx; border: none; }
.bottom-btn.primary { background-color: #ff6b6b; color: #fff; }
.bottom-btn.secondary { background-color: #fff; color: #666; border: 1rpx solid #ddd; }
</style>