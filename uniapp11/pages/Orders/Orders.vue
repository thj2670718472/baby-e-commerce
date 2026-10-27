<template>
	<view class="orders-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">我的订单</text>
			<text class="header-placeholder"></text>
		</view>
		
		<view class="status-tabs">
			<view class="status-tab" :class="{ active: currentStatus === '' }" @click="changeStatus('')">
				<text>全部</text>
			</view>
			<view class="status-tab" :class="{ active: currentStatus === '待付款' }" @click="changeStatus('待付款')">
				<text>待付款</text>
			</view>
			<view class="status-tab" :class="{ active: currentStatus === '已付款' || currentStatus === '待发货' }" @click="changeStatus('已付款')">
				<text>待发货</text>
			</view>
			<view class="status-tab" :class="{ active: currentStatus === '已发货' }" @click="changeStatus('已发货')">
				<text>待收货</text>
			</view>
			<view class="status-tab" :class="{ active: currentStatus === '已完成' }" @click="changeStatus('已完成')">
				<text>已完成</text>
			</view>
		</view>
		
		<scroll-view class="order-list" scroll-y :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="onRefresh" @scrolltolower="loadMoreOrders">
			<view v-if="loading" class="loading-container">
				<text>加载中...</text>
			</view>
			
			<view v-else-if="filteredOrders.length === 0" class="empty-container">
				<image class="empty-image" src="/static/订单.png" mode="aspectFit"></image>
				<text class="empty-text">暂无订单</text>
				<button class="go-shopping-btn" @click="goShopping">去购物</button>
			</view>
			
			<view v-else class="order-items">
				<view class="order-item" v-for="order in filteredOrders" :key="order.id">
					<view class="order-header" @click="viewOrderDetail(order)">
						<text class="order-no">订单号：{{ order.orderNo }}</text>
						<view class="order-status" :class="getStatusClass(order.status)">
							<text>{{ order.status }}</text>
						</view>
					</view>
					
					<view class="order-goods" @click="viewOrderDetail(order)">
						<view class="goods-item" v-for="(goods, gIndex) in order.order_goods" :key="gIndex">
							<image class="goods-image" :src="getGoodsImage(goods)" mode="aspectFill"></image>
							<view class="goods-info">
								<text class="goods-name">{{ goods.goodsName }}</text>
								<view class="goods-price-qty">
									<text class="goods-price">￥{{ formatPrice(goods.price) }}</text>
									<text class="goods-qty">x{{ goods.quantity }}</text>
								</view>
							</view>
						</view>
					</view>
					
					<view class="order-footer">
						<view class="order-info">
							<view v-if="order.couponAmount > 0" class="price-detail">
								<text class="original-total">原价：￥{{ formatPrice(order.originalAmount) }}</text>
								<text class="coupon-discount">优惠券：-￥{{ formatPrice(order.couponAmount) }}</text>
							</view>
							<text class="order-total">实付：￥{{ formatPrice(order.totalAmount) }}</text>
						</view>
						
						<view class="order-actions">
							<template v-if="order.status === '待付款'">
								<view class="action-btn cancel" @click="cancelOrder(order)">取消订单</view>
								<view class="action-btn pay" @click="payOrder(order)">付款</view>
							</template>
							<template v-else-if="order.status === '已发货'">
								<view class="action-btn receive" @click="receiveOrderHandler(order)">确认收货</view>
							</template>
							<template v-else-if="order.status === '已完成'">
								<view class="action-btn return" @click="applyReturnHandler(order)">申请退货</view>
								<view class="action-btn review" @click="goToReview(order)">去评价</view>
								<view class="action-btn buy-again" @click="buyAgain(order)">再次购买</view>
							</template>
							<template v-else-if="order.status === '已取消' || order.status === '已退货'">
								<view class="action-btn delete" @click="deleteOrderHandler(order)">删除订单</view>
							</template>
							<template v-else-if="order.status === '退货中'">
							
							</template>
							
						</view>
					</view>
				</view>
			</view>

			<view v-if="filteredOrders.length > 0 && !loading" class="load-more" style="text-align: center; padding: 20rpx 0;">
				<text v-if="loadingMore" style="font-size: 24rpx; color: #999;">加载中...</text>
				<text v-else-if="!hasMore" style="font-size: 24rpx; color: #999;">没有更多订单了</text>
			</view>
		</scroll-view>
		
		<view class="modal" v-if="returnModalVisible" @click="closeReturnModal">
			<view class="modal-content" @click.stop>
				<view class="modal-header">
					<text class="modal-title">申请退货</text>
					<text class="modal-close" @click="closeReturnModal">×</text>
				</view>
				<view class="modal-body">
					<view class="form-item">
						<text class="form-label">订单号</text>
						<text class="form-value">{{ returnForm.orderNo }}</text>
					</view>
					<view class="form-item">
						<text class="form-label">退货原因</text>
						<textarea class="form-textarea" v-model="returnForm.reason" placeholder="请输入退货原因" maxlength="200"></textarea>
						<text class="char-count">{{ returnForm.reason.length }}/200</text>
					</view>
				</view>
				<view class="modal-footer">
					<button class="modal-btn cancel" @click="closeReturnModal">取消</button>
					<button class="modal-btn confirm" @click="submitReturn" :loading="submitting">提交申请</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { 
	getOrderList, 
	cancelOrder as apiCancelOrder, 
	receiveOrder as apiReceiveOrder, 
	applyReturn as apiApplyReturn,
	deleteOrder as apiDeleteOrder,
	payOrder as apiPayOrder,
	BASE_URL 
} from '../../api/index.js'

const orderList = ref([])
const loading = ref(false)
const refreshing = ref(false)
const submitting = ref(false)
const currentStatus = ref('')
const PAGE_SIZE = 10
const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const returnModalVisible = ref(false)
const returnForm = ref({ orderId: null, orderNo: '', reason: '' })
const currentUser = ref(null)
const DEFAULT_IMAGE = '/static/商品.png'

const filteredOrders = computed(() => {
	if (!currentStatus.value) return orderList.value
	if (currentStatus.value === '已付款') {
		return orderList.value.filter(order => order.status === '已付款' || order.status === '待发货')
	}
	return orderList.value.filter(order => order.status === currentStatus.value)
})

const formatPrice = (price) => Number(price).toFixed(2)

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

const getStatusClass = (status) => {
	const map = { 
		'待付款': 'pending', 
		'已付款': 'paid', 
		'待发货': 'paid', 
		'已发货': 'shipped', 
		'已完成': 'completed', 
		'已取消': 'cancelled', 
		'退货中': 'returning', 
		'已退货': 'returned' 
	}
	return map[status] || ''
}

const changeStatus = (status) => {
	if (currentStatus.value === status) return
	currentStatus.value = status
	loadOrderList()
}

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const loadOrderList = async (reset = true) => {
	const user = getCurrentUser()
	if (!user) { orderList.value = []; return }
	currentUser.value = user
	if (reset) {
		page.value = 1
		loading.value = true
	} else {
		if (!hasMore.value || loadingMore.value) return
		loadingMore.value = true
	}
	try {
		const params = { page: page.value, pageSize: PAGE_SIZE }
		if (currentStatus.value) params.status = currentStatus.value
		const res = await getOrderList(user.id, params)
		if (res.code === 200) {
			const data = res.data || {}
			const list = data.list || []
			orderList.value = reset ? list : [...orderList.value, ...list]
			hasMore.value = page.value < (data.totalPages || 1)
		}
	} catch (error) {
		console.error('加载订单失败:', error)
	} finally {
		loading.value = false
		refreshing.value = false
		loadingMore.value = false
	}
}

const loadMoreOrders = () => {
	if (!hasMore.value || loading.value) return
	page.value += 1
	loadOrderList(false)
}

const onRefresh = () => { refreshing.value = true; loadOrderList() }

const viewOrderDetail = (order) => {
	uni.navigateTo({ url: `/pages/Orders/OrderDetail?orderId=${order.id}` })
}

const cancelOrder = (order) => {
	uni.showModal({
		title: '提示', content: '确定要取消该订单吗？', confirmText: '确定', confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				uni.showLoading({ title: '取消中...' })
				const result = await apiCancelOrder(order.id)
				uni.hideLoading()
				if (result.code === 200) { 
					uni.showToast({ title: '订单已取消', icon: 'success' })
					loadOrderList() 
				} else { 
					uni.showToast({ title: result.message || '取消失败', icon: 'none' }) 
				}
			}
		}
	})
}

const payOrder = async (order) => {
	uni.showModal({
		title: '模拟支付', 
		content: `确认支付 ￥${formatPrice(order.totalAmount)} 吗？`, 
		confirmText: '支付', 
		confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				uni.showLoading({ title: '支付中...' })
				const result = await apiPayOrder(order.id)
				uni.hideLoading()
				if (result.code === 200) { 
					uni.showToast({ title: '支付成功', icon: 'success' })
					loadOrderList() 
				} else { 
					uni.showToast({ title: result.message || '支付失败', icon: 'none' }) 
				}
			}
		}
	})
}

const receiveOrderHandler = (order) => {
	uni.showModal({
		title: '提示', content: '确认已收到商品吗？', confirmText: '确认', confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				uni.showLoading({ title: '处理中...' })
				const result = await apiReceiveOrder(order.id)
				uni.hideLoading()
				if (result.code === 200) { 
					uni.showToast({ title: '确认收货成功', icon: 'success' })
					loadOrderList() 
				} else { 
					uni.showToast({ title: result.message || '操作失败', icon: 'none' }) 
				}
			}
		}
	})
}

const applyReturnHandler = (order) => {
	returnForm.value = { orderId: order.id, orderNo: order.orderNo, reason: '' }
	returnModalVisible.value = true
}

const closeReturnModal = () => { returnModalVisible.value = false }

const submitReturn = async () => {
	if (!returnForm.value.reason.trim()) { 
		uni.showToast({ title: '请输入退货原因', icon: 'none' })
		return 
	}
	submitting.value = true
	const result = await apiApplyReturn(returnForm.value.orderId, returnForm.value.reason)
	if (result.code === 200) { 
		uni.showToast({ title: '退货申请已提交', icon: 'success' })
		closeReturnModal()
		loadOrderList() 
	} else { 
		uni.showToast({ title: result.message || '申请失败', icon: 'none' }) 
	}
	submitting.value = false
}

const deleteOrderHandler = (order) => {
	uni.showModal({
		title: '提示', content: '确定要删除该订单吗？', confirmText: '删除', confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				const result = await apiDeleteOrder(order.id)
				if (result.code === 200) { 
					uni.showToast({ title: '删除成功', icon: 'success' })
					loadOrderList() 
				} else { 
					uni.showToast({ title: result.message || '删除失败', icon: 'none' }) 
				}
			}
		}
	})
}

const goToReview = (order) => {
	const goodsList = order.order_goods.map(goods => ({
		goodsId: goods.goodsId,
		goodsName: goods.goodsName,
		goodsImage: goods.goodsImage,
		price: goods.price
	}))
	
	uni.navigateTo({
		url: `/pages/Orders/Review?orderId=${order.id}&goodsData=${encodeURIComponent(JSON.stringify(goodsList))}`
	})
}

const buyAgain = (order) => {
	uni.switchTab({ url: '/pages/Home/Home' })
}

const goShopping = () => uni.switchTab({ url: '/pages/Home/Home' })

const navigateBack = () => {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.switchTab({ url: '/pages/Home/Home' })
	}
}

onShow(() => loadOrderList())
onMounted(() => loadOrderList())
onReachBottom(loadMoreOrders)
</script>

<style scoped>
.orders-page { min-height: 100vh; background-color: #f5f5f5; display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }
.status-tabs { display: flex; background-color: #fff; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.status-tab { flex: 1; text-align: center; padding: 16rpx 0; font-size: 26rpx; color: #666; position: relative; }
.status-tab.active { color: #ff6b6b; font-weight: bold; }
.status-tab.active::after { content: ''; position: absolute; bottom: -1rpx; left: 50%; transform: translateX(-50%); width: 60rpx; height: 4rpx; background-color: #ff6b6b; border-radius: 2rpx; }
.order-list { flex: 1; padding: 20rpx; }
.loading-container, .empty-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 150rpx 0; }
.empty-image { width: 200rpx; height: 200rpx; opacity: 0.5; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }
.go-shopping-btn { margin-top: 40rpx; padding: 20rpx 60rpx; background-color: #ff6b6b; color: #fff; font-size: 28rpx; border-radius: 40rpx; border: none; }
.order-item { background-color: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05); }
.order-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20rpx; border-bottom: 1rpx solid #f0f0f0; }
.order-no { font-size: 24rpx; color: #666; }
.order-status { font-size: 24rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.order-status.pending { color: #ff9800; background-color: #fff3e0; }
.order-status.paid { color: #409eff; background-color: #e3f2fd; }
.order-status.shipped { color: #2196f3; background-color: #e3f2fd; }
.order-status.completed { color: #4caf50; background-color: #e8f5e9; }
.order-status.cancelled { color: #999; background-color: #f5f5f5; }
.order-status.returning { color: #ff9800; background-color: #fff3e0; }
.order-status.returned { color: #f44336; background-color: #ffebee; }
.order-goods { padding: 20rpx 0; }
.goods-item { display: flex; gap: 20rpx; margin-bottom: 16rpx; }
.goods-item:last-child { margin-bottom: 0; }
.goods-image { width: 120rpx; height: 120rpx; border-radius: 12rpx; background-color: #f9f9f9; }
.goods-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.goods-name { font-size: 26rpx; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.goods-price-qty { display: flex; justify-content: space-between; align-items: center; }
.goods-price { font-size: 26rpx; color: #ff6b6b; font-weight: bold; }
.goods-qty { font-size: 24rpx; color: #999; }
.order-footer { border-top: 1rpx solid #f0f0f0; padding-top: 20rpx; }
.order-info { margin-bottom: 16rpx; }
.price-detail { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 8rpx; }
.original-total { font-size: 22rpx; color: #999; text-decoration: line-through; }
.coupon-discount { font-size: 22rpx; color: #ff6b6b; }
.order-total { font-size: 28rpx; color: #333; font-weight: bold; display: block; text-align: right; }
.order-actions { display: flex; justify-content: flex-end; gap: 16rpx; flex-wrap: wrap; }
.action-btn { padding: 12rpx 24rpx; border-radius: 24rpx; font-size: 24rpx; }
.action-btn.cancel { color: #666; background-color: #f5f5f5; }
.action-btn.pay { color: #fff; background-color: #ff6b6b; }
.action-btn.receive { color: #fff; background-color: #4caf50; }
.action-btn.return { color: #ff9800; background-color: #fff3e0; }
.action-btn.review { color: #fff; background-color: #ffb800; }
.action-btn.buy-again { color: #fff; background-color: #ff6b6b; }
.action-btn.delete { color: #f44336; background-color: #ffebee; }
.action-btn.detail { color: #666; background-color: #f5f5f5; }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background-color: #fff; border-radius: 16rpx; width: 85%; max-width: 600rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; }
.modal-close { font-size: 40rpx; color: #999; }
.modal-body { padding: 30rpx; }
.form-item { margin-bottom: 20rpx; }
.form-label { font-size: 28rpx; color: #333; margin-bottom: 10rpx; display: block; }
.form-value { font-size: 26rpx; color: #666; }
.form-textarea { width: 100%; height: 160rpx; padding: 20rpx; border: 1rpx solid #e0e0e0; border-radius: 12rpx; font-size: 26rpx; box-sizing: border-box; }
.char-count { text-align: right; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.modal-footer { display: flex; gap: 20rpx; padding: 30rpx; border-top: 1rpx solid #f0f0f0; }
.modal-btn { flex: 1; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: 40rpx; font-size: 28rpx; border: none; }
.modal-btn.cancel { background-color: #f5f5f5; color: #666; }
.modal-btn.confirm { background-color: #ff6b6b; color: #fff; }
</style>