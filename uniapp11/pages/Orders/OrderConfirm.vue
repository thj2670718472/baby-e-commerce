<template>
	<view class="order-confirm-page">
		<!-- 顶部导航栏 -->
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">确认订单</text>
			<text class="header-placeholder"></text>
		</view>
		
		<!-- 收货地址 -->
		<view class="address-section" @click="selectAddress">
			<view v-if="selectedAddress" class="address-info">
				<view class="address-top">
					<text class="address-name">{{ selectedAddress.name }}</text>
					<text class="address-phone">{{ selectedAddress.phone }}</text>
					<view v-if="selectedAddress.isDefault" class="default-tag">默认</view>
				</view>
				<text class="address-detail">{{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.detail }}</text>
			</view>
			<view v-else class="no-address">
				<text class="no-address-text">请选择收货地址</text>
			</view>
			<text class="address-arrow">></text>
		</view>
		
		<!-- 商品列表 -->
		<view class="goods-section">
			<view class="section-title">商品信息</view>
			<view class="goods-list">
				<view class="goods-item" v-for="(item, index) in goodsList" :key="index">
					<image class="goods-image" :src="getImageUrl(item.image)" mode="aspectFill"></image>
					<view class="goods-info">
						<text class="goods-name">{{ item.name }}</text>
						<view class="goods-price-qty">
							<text class="goods-price">￥{{ formatPrice(item.price) }}</text>
							<view class="quantity-control">
								<view class="quantity-btn" @click="decreaseQuantity(index)">-</view>
								<text class="quantity-num">{{ item.quantity }}</text>
								<view class="quantity-btn" @click="increaseQuantity(index)">+</view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
		
		
		
		<!-- 底部操作栏 -->
		<view class="bottom-bar">
			<view class="total-info">
				<text class="total-label">合计：</text>
				<text class="total-price">￥{{ formatPrice(totalPrice) }}</text>
			</view>
			<button class="submit-btn" @click="submitOrder">提交订单</button>
		</view>
		
		<!-- 地址选择弹窗 -->
		<view class="modal" v-if="addressModalVisible" @click="closeAddressModal">
			<view class="modal-content" @click.stop>
				<view class="modal-header">
					<text class="modal-title">选择收货地址</text>
					<text class="modal-close" @click="closeAddressModal">×</text>
				</view>
				<scroll-view class="address-list" scroll-y>
					<view class="address-item" 
						v-for="addr in addressList" 
						:key="addr.id"
						:class="{ selected: selectedAddress && selectedAddress.id === addr.id }"
						@click="chooseAddress(addr)"
					>
						<view class="address-content">
							<view class="address-top">
								<text class="address-name">{{ addr.name }}</text>
								<text class="address-phone">{{ addr.phone }}</text>
								<view v-if="addr.isDefault" class="default-tag">默认</view>
							</view>
							<text class="address-detail">{{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}</text>
						</view>
						<view v-if="selectedAddress && selectedAddress.id === addr.id" class="check-icon">✓</view>
					</view>
					<view v-if="addressList.length === 0" class="no-address-tip">
						<text>暂无地址，请先添加</text>
						<button class="add-address-btn" @click="goToAddAddress">添加地址</button>
					</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAddressList, createOrder, BASE_URL } from '../../api/index.js'

// 商品列表
const goodsList = ref([])

// 地址列表
const addressList = ref([])

// 选中的地址
const selectedAddress = ref(null)



// 地址弹窗
const addressModalVisible = ref(false)

// 当前用户
const currentUser = ref(null)

// 计算总价
const totalPrice = computed(() => {
	return goodsList.value.reduce((sum, item) => {
		return sum + (Number(item.price) * Number(item.quantity))
	}, 0)
})

// 格式化价格
const formatPrice = (price) => {
	return Number(price).toFixed(2)
}

// 获取图片URL - 参考 Vue 后台的写法
const getImageUrl = (image) => {
	if (!image) return '/static/商品.png'
	
	// 如果是数组，取第一张
	if (Array.isArray(image) && image.length > 0) {
		image = image[0]
	}
	
	if (typeof image === 'string') {
		if (image.startsWith('http://') || image.startsWith('https://')) {
			return image
		}
		if (image.startsWith('blob:') || image.startsWith('data:')) {
			return image
		}
		if (image.startsWith('/uploads/')) {
			return BASE_URL + image
		}
	}
	
	return '/static/商品.png'
}

// 增加数量
const increaseQuantity = (index) => {
	const item = goodsList.value[index]
	const maxQuantity = item.originalQuantity || 999
	if (item.quantity < maxQuantity) {
		item.quantity++
	}
}

// 减少数量
const decreaseQuantity = (index) => {
	if (goodsList.value[index].quantity > 1) {
		goodsList.value[index].quantity--
	}
}

// 选择地址
const selectAddress = () => {
	addressModalVisible.value = true
}

// 关闭地址弹窗
const closeAddressModal = () => {
	addressModalVisible.value = false
}

// 选择地址
const chooseAddress = (addr) => {
	selectedAddress.value = addr
	closeAddressModal()
}

// 加载地址列表 - 参考 Vue 后台的写法
const loadAddressList = async () => {
	try {
		// 获取用户信息 - 参考 Vue 后台的 sessionStorage 方式
		const userStr = uni.getStorageSync('userInfo')
		console.log('存储的用户信息:', userStr)
		
		if (!userStr) {
			console.log('未登录')
			return
		}
		
		// 解析用户信息 - 注意：如果已经是对象就不要再次解析
		let user
		if (typeof userStr === 'string') {
			try {
				user = JSON.parse(userStr)
			} catch (e) {
				console.error('解析用户信息失败:', e)
				return
			}
		} else {
			user = userStr
		}
		
		currentUser.value = user
		console.log('当前用户:', user)
		
		// 调用地址列表接口 - 参考 Vue 后台的 addressAPI.getList(userId)
		const res = await getAddressList(user.id)
		console.log('地址列表响应:', res)
		
		if (res.code === 200) {
			addressList.value = res.data || []
			
			// 优先选择默认地址
			const defaultAddr = addressList.value.find(addr => addr.isDefault)
			if (defaultAddr) {
				selectedAddress.value = defaultAddr
			} else if (addressList.value.length > 0) {
				selectedAddress.value = addressList.value[0]
			}
			
			console.log('选中的地址:', selectedAddress.value)
		}
	} catch (error) {
		console.error('加载地址列表失败:', error)
	}
}

// 提交订单 - 参考 Vue 后台的创建订单方式
const submitOrder = async () => {
	// 验证地址
	if (!selectedAddress.value) {
		uni.showToast({ title: '请选择收货地址', icon: 'none' })
		return
	}
	
	// 验证商品
	if (goodsList.value.length === 0) {
		uni.showToast({ title: '商品信息错误', icon: 'none' })
		return
	}
	
	// 验证用户
	if (!currentUser.value) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		return
	}
	
	// 构建订单数据 - 参考 Vue 后台的 createOrder 参数格式
	const orderData = {
		userId: currentUser.value.id,
		userName: currentUser.value.username,
		totalAmount: totalPrice.value,
		status: '待付款',
		paymentMethod: '在线支付',
		orderTime: new Date().toISOString(),
		address: `${selectedAddress.value.province}${selectedAddress.value.city}${selectedAddress.value.district}${selectedAddress.value.detail}`,
		phone: selectedAddress.value.phone,
		cartIds: goodsList.value.map(item => item.cartId).filter(Boolean),
		goods: goodsList.value.map(item => ({
			goodsId: item.goodsId,
			goodsName: item.name,
			goodsImage: Array.isArray(item.image) ? item.image[0] : item.image,
			price: Number(item.price),
			quantity: Number(item.quantity)
		}))
	}
	
	console.log('提交订单数据:', orderData)
	
	uni.showLoading({ title: '提交中...' })
	
	try {
		const res = await createOrder(orderData)
		uni.hideLoading()
		
		if (res.code === 200) {
			uni.showToast({ title: '订单提交成功', icon: 'success' })
			setTimeout(() => {
				// 跳转到订单列表
				uni.redirectTo({ url: '/pages/Orders/Orders' })
			}, 1500)
		} else {
			uni.showToast({ title: res.message || '提交失败', icon: 'none' })
		}
	} catch (error) {
		uni.hideLoading()
		console.error('提交订单失败:', error)
		uni.showToast({ title: '提交失败', icon: 'none' })
	}
}

// 跳转到添加地址
const goToAddAddress = () => {
	closeAddressModal()
	uni.navigateTo({ url: '/pages/Address/AddAddress' })
}

// 返回上一页
const navigateBack = () => {
	uni.navigateBack()
}

// 解析传入的商品数据
const parseGoodsData = (goodsData) => {
	try {
		if (typeof goodsData === 'string') {
			return JSON.parse(decodeURIComponent(goodsData))
		}
		return goodsData
	} catch (e) {
		console.error('解析商品数据失败:', e)
		return []
	}
}

onLoad((options) => {
	console.log('OrderConfirm onLoad, options:', options)
	
	if (options.goodsData) {
		const parsedGoods = parseGoodsData(options.goodsData)
		goodsList.value = parsedGoods.map(item => ({
			...item,
			quantity: item.quantity || 1,
			originalQuantity: item.originalQuantity || 999
		}))
		console.log('商品列表:', goodsList.value)
	}
	
	// 加载地址列表
	loadAddressList()
})
</script>

<style scoped>
.order-confirm-page {
	min-height: 100vh;
	background-color: #f5f5f5;
	padding-bottom: 120rpx;
}

.page-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx;
	background-color: #ffffff;
	position: sticky;
	top: 0;
	z-index: 10;
}

.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }

.address-section {
	display: flex;
	align-items: center;
	padding: 30rpx;
	background-color: #ffffff;
	margin-bottom: 20rpx;
}

.address-info { flex: 1; }
.address-top {
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin-bottom: 10rpx;
}
.address-name { font-size: 30rpx; font-weight: bold; color: #333; }
.address-phone { font-size: 26rpx; color: #666; }
.default-tag {
	font-size: 20rpx;
	color: #ff6b6b;
	background-color: #ffe6e6;
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
}
.address-detail { font-size: 26rpx; color: #666; line-height: 1.4; }
.no-address { flex: 1; }
.no-address-text { font-size: 28rpx; color: #999; }
.address-arrow { font-size: 32rpx; color: #ccc; margin-left: 20rpx; }

.goods-section {
	background-color: #ffffff;
	padding: 30rpx;
	margin-bottom: 20rpx;
}
.section-title {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 20rpx;
}
.goods-list { display: flex; flex-direction: column; gap: 20rpx; }
.goods-item { display: flex; gap: 20rpx; }
.goods-image {
	width: 160rpx;
	height: 160rpx;
	border-radius: 12rpx;
	background-color: #f9f9f9;
}
.goods-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.goods-name {
	font-size: 28rpx;
	color: #333;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
.goods-price-qty {
	display: flex;
	justify-content: space-between;
	align-items: center;
}
.goods-price { font-size: 30rpx; color: #ff6b6b; font-weight: bold; }
.quantity-control { display: flex; align-items: center; gap: 15rpx; }
.quantity-btn {
	width: 48rpx;
	height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #ddd;
	border-radius: 8rpx;
	font-size: 32rpx;
	color: #666;
	background-color: #fff;
}
.quantity-num { font-size: 28rpx; color: #333; min-width: 40rpx; text-align: center; }

.remark-section {
	display: flex;
	align-items: center;
	padding: 30rpx;
	background-color: #ffffff;
}
.remark-label { font-size: 28rpx; color: #333; margin-right: 20rpx; }
.remark-input { flex: 1; font-size: 26rpx; color: #333; }

.bottom-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 30rpx;
	padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	background-color: #ffffff;
	box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05);
}
.total-info { display: flex; align-items: baseline; }
.total-label { font-size: 26rpx; color: #666; }
.total-price { font-size: 40rpx; color: #ff6b6b; font-weight: bold; }
.submit-btn {
	width: 200rpx;
	height: 70rpx;
	background-color: #ff6b6b;
	color: #fff;
	font-size: 28rpx;
	font-weight: bold;
	border-radius: 35rpx;
	border: none;
}

/* 弹窗 */
.modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0,0,0,0.5);
	display: flex;
	align-items: flex-end;
	z-index: 100;
}
.modal-content {
	background-color: #ffffff;
	border-radius: 24rpx 24rpx 0 0;
	width: 100%;
	max-height: 70vh;
}
.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx;
	border-bottom: 1rpx solid #f0f0f0;
}
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; }
.modal-close { font-size: 40rpx; color: #999; }
.address-list { max-height: 60vh; padding: 20rpx 30rpx; }
.address-item {
	display: flex;
	align-items: center;
	padding: 24rpx;
	background-color: #f9f9f9;
	border-radius: 16rpx;
	margin-bottom: 20rpx;
	border: 2rpx solid transparent;
}
.address-item.selected {
	border-color: #ff6b6b;
	background-color: #fff5f5;
}
.address-content { flex: 1; }
.check-icon { font-size: 32rpx; color: #ff6b6b; margin-left: 20rpx; }
.no-address-tip {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 60rpx 0;
}
.no-address-tip text {
	font-size: 26rpx;
	color: #999;
	margin-bottom: 30rpx;
}
.add-address-btn {
	width: 200rpx;
	height: 60rpx;
	background-color: #ff6b6b;
	color: #fff;
	font-size: 26rpx;
	border-radius: 30rpx;
	border: none;
}
</style>