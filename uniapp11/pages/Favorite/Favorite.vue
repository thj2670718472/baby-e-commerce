<template>
	<view class="favorite-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">我的收藏</text>
			<text class="header-placeholder"></text>
		</view>
		
		<scroll-view class="content" scroll-y>
			<view v-if="loading" class="loading-container">
				<text>加载中...</text>
			</view>
			
			<view v-else-if="favoriteList.length === 0" class="empty-container">
				<image class="empty-image" src="/static/收藏.png" mode="aspectFit"></image>
				<text class="empty-text">暂时没有收藏的商品</text>
				<button class="go-shopping-btn" @click="goShopping">去逛逛</button>
			</view>
			
			<view v-else class="favorite-list">
				<view class="favorite-item" v-for="item in favoriteList" :key="item.id">
					<image class="goods-image" :src="getImageUrl(item.goodsImage)" mode="aspectFill" @click="goToDetail(item.goodsId)"></image>
					<view class="goods-info" @click="goToDetail(item.goodsId)">
						<text class="goods-name">{{ item.goodsName }}</text>
						<view class="price-wrapper">
							<text class="goods-price" :class="{ 'discount-price': discountInfo?.isActive }">
								￥{{ getDisplayPrice(item.goodsPrice) }}
							</text>
							<text class="original-price" v-if="discountInfo?.isActive">
								￥{{ formatPrice(item.goodsPrice) }}
							</text>
						</view>
					</view>
					<view class="goods-actions">
						<button class="buy-btn" @click.stop="buyNow(item)">立即购买</button>
						<button class="delete-btn" @click.stop="handleRemoveFavorite(item)">取消收藏</button>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getFavoriteList, removeFavorite as apiRemoveFavorite, getDiscountStatus, BASE_URL } from '../../api/index.js'

const favoriteList = ref([])
const loading = ref(false)
const currentUser = ref(null)
const discountInfo = ref(null)

const formatPrice = (price) => Number(price).toFixed(2)

const getDisplayPrice = (price) => {
	if (discountInfo.value?.isActive) {
		return formatPrice(price * discountInfo.value.discountRate)
	}
	return formatPrice(price)
}

const getImageUrl = (image) => {
	if (!image) return '/static/商品.png'
	if (image.startsWith('http')) return image
	if (image.startsWith('/uploads/')) return BASE_URL + image
	return image
}

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const loadDiscountStatus = async () => {
	try {
		const res = await getDiscountStatus()
		if (res.code === 200) {
			discountInfo.value = res.data
		}
	} catch (error) {
		console.error('加载打折状态失败:', error)
	}
}

const loadFavoriteList = async () => {
	const user = getCurrentUser()
	if (!user) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		return
	}
	currentUser.value = user
	loading.value = true
	
	try {
		const res = await getFavoriteList(user.id)
		if (res.code === 200) {
			favoriteList.value = res.data || []
		}
	} catch (error) {
		console.error('加载收藏列表失败:', error)
	} finally {
		loading.value = false
	}
}

const goToDetail = (goodsId) => {
	uni.navigateTo({ url: `/pages/GoodsDetail/GoodsDetail?id=${goodsId}` })
}

const buyNow = (item) => {
	const actualPrice = discountInfo.value?.isActive
		? item.goodsPrice * discountInfo.value.discountRate
		: item.goodsPrice
	
	const goodsData = [{
		goodsId: item.goodsId,
		name: item.goodsName,
		price: actualPrice,
		quantity: 1,
		image: item.goodsImage
	}]
	uni.navigateTo({
		url: `/pages/Orders/OrderConfirm?goodsData=${encodeURIComponent(JSON.stringify(goodsData))}`
	})
}

const handleRemoveFavorite = (item) => {
	uni.showModal({
		title: '提示',
		content: '确定要取消收藏吗？',
		confirmText: '确定',
		confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				try {
					const result = await apiRemoveFavorite(currentUser.value.id, item.goodsId)
					if (result.code === 200) {
						uni.showToast({ title: '已取消收藏', icon: 'success' })
						loadFavoriteList()
					}
				} catch (error) {
					uni.showToast({ title: '操作失败', icon: 'none' })
				}
			}
		}
	})
}

const goShopping = () => {
	uni.switchTab({ url: '/pages/Home/Home' })
}

const navigateBack = () => uni.navigateBack()

onMounted(() => {
	loadDiscountStatus()
	loadFavoriteList()
})
</script>

<style scoped>
.favorite-page { min-height: 100vh; background-color: #f5f5f5; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }
.content { padding: 20rpx; }
.loading-container { display: flex; justify-content: center; padding: 150rpx 0; }
.empty-container { display: flex; flex-direction: column; align-items: center; padding: 150rpx 0; }
.empty-image { width: 200rpx; height: 200rpx; opacity: 0.5; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }
.go-shopping-btn { margin-top: 40rpx; padding: 20rpx 60rpx; background-color: #ff6b6b; color: #fff; font-size: 28rpx; border-radius: 40rpx; border: none; }
.favorite-list { display: flex; flex-direction: column; gap: 20rpx; }
.favorite-item { display: flex; align-items: center; gap: 20rpx; background-color: #fff; padding: 20rpx; border-radius: 16rpx; }
.goods-image { width: 120rpx; height: 120rpx; border-radius: 12rpx; }
.goods-info { flex: 1; }
.goods-name { font-size: 28rpx; color: #333; margin-bottom: 10rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.price-wrapper { display: flex; align-items: baseline; gap: 10rpx; }
.goods-price { font-size: 30rpx; color: #333; font-weight: bold; }
.goods-price.discount-price { color: #ff6b6b; }
.original-price { font-size: 22rpx; color: #999; text-decoration: line-through; }
.goods-actions { display: flex; flex-direction: column; gap: 10rpx; }
.buy-btn { padding: 12rpx 24rpx; background-color: #ff6b6b; color: #fff; font-size: 24rpx; border-radius: 30rpx; border: none; width: 160rpx; }
.delete-btn { padding: 12rpx 24rpx; background-color: #f5f5f5; color: #666; font-size: 24rpx; border-radius: 30rpx; border: 1rpx solid #ddd; width: 160rpx; }
</style>