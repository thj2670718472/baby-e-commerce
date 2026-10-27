<template>
	<view class="goods-detail-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">商品详情</text>
			<text class="header-placeholder"></text>
		</view>
		
		<swiper class="goods-images" indicator-dots="true" autoplay="true" interval="3000" duration="500" circular="true">
			<swiper-item v-for="(image, index) in goodsImages" :key="index">
				<image :src="image" mode="aspectFill"></image>
			</swiper-item>
		</swiper>
		
		<view class="goods-info-section">
			<view class="price-row">
				<text class="goods-price" :class="{ 'discount-price': discountInfo?.isActive }">￥{{ getDisplayPrice }}</text>
				<text class="original-price" v-if="discountInfo?.isActive">原价￥{{ formatPrice(goods.price) }}</text>
			</view>
			<text class="goods-name">{{ goods.name }}</text>
			<view class="stock-row">
				<text class="stock-status" :class="goods.status ? getStockClass(goods.quantity) : 'offline'">{{ goods.status ? getStockText(goods.quantity) : '已下架' }}</text>
			</view>
			<view class="sales-row">
			  <text class="sales-text">已售{{ goods.sales || 0 }}件</text>
			</view>
		</view>
		
		<view class="review-section">
			<view class="section-header">
				<text class="section-title">用户评价 ({{ reviewStats.total || 0 }})</text>
				<text class="section-more" @click="viewAllReviews">查看更多 </text>
			</view>
			<view class="review-stats" v-if="reviewStats.total > 0">
				<view class="rating-overview">
					<text class="rating-number">{{ reviewStats.avgRating || 0 }}</text>
					<view class="rating-stars">
						<text v-for="i in 5" :key="i" class="star" :class="{ active: i <= reviewStats.avgRating }">★</text>
					</view>
					<text class="rating-count">{{ reviewStats.total }}条评价</text>
				</view>
				<view class="rating-distribution">
					<view class="rating-bar" v-for="star in 5" :key="star">
						<text class="star-label">{{ star }}星</text>
						<view class="progress-bar">
							<view class="progress-fill" :style="{ width: getRatingPercent(star) + '%' }"></view>
						</view>
						<text class="star-count">{{ reviewStats.ratingCounts?.[star] || 0 }}</text>
					</view>
				</view>
			</view>
			<view class="review-list">
				<view class="review-item" v-for="review in previewReviews" :key="review.id">
					<view class="review-header">
						<text class="review-user">{{ review.userName || '匿名用户' }}</text>
						<view class="review-rating">
							<text v-for="i in 5" :key="i" class="star" :class="{ active: i <= review.rating }">★</text>
						</view>
						<text class="review-time">{{ formatTime(review.createTime) }}</text>
					</view>
					<text class="review-content">{{ review.content || '默认好评' }}</text>
					<!-- 评价图片 -->
					<view class="review-images" v-if="review.images && review.images.length > 0">
						<image 
							v-for="(img, idx) in review.images" 
							:key="idx" 
							:src="getImageUrl(img)" 
							mode="aspectFill" 
							class="review-image"
							@click="previewReviewImages(review.images, idx)"
						></image>
					</view>
				</view>
				<view v-if="reviews.length === 0" class="no-review">
					<text>暂无评价</text>
				</view>
			</view>
		</view>
		
		<view class="goods-detail-section">
			<view class="section-header"><text class="section-title">商品详情</text></view>
			<view class="section-content"><text class="detail-text">{{ goods.description || '暂无商品描述' }}</text></view>
		</view>
		
		<view class="bottom-bar">
			<view class="bottom-left">
				<view class="bottom-item" @click="toggleFavorite">
					<text class="bottom-icon" :class="{ favorited: isFavorite }">{{ isFavorite ? '❤️' : '🤍' }}</text>
					<text class="bottom-text" :class="{ favorited: isFavorite }">{{ isFavorite ? '已收藏' : '收藏' }}</text>
				</view>
				<view class="bottom-item" @click="addToCart">
				      <text class="bottom-icon">🛒</text>
				      <text class="bottom-text">购物车</text>
				</view>
			</view>
			<view class="bottom-right">
				<view class="quantity-control">
					<view class="quantity-btn minus" @click="decreaseQuantity">-</view>
					<text class="quantity-num">{{ quantity }}</text>
					<view class="quantity-btn plus" @click="increaseQuantity">+</view>
				</view>
				<button class="buy-btn confirm" @click="showBuyModal(false)" :disabled="goods.quantity === 0 || !goods.status">确认购买</button>
				<button class="buy-btn pay" @click="showBuyModal(true)" :disabled="goods.quantity === 0 || !goods.status">支付并购买</button>
			</view>
		</view>
		<!-- 购买弹窗 -->
		<view class="modal" v-if="buyModalVisible" @click="closeBuyModal">
		  <view class="modal-content buy-modal" @click.stop>
		    <view class="modal-header">
		      <text class="modal-title">确认订单</text>
		      <text class="modal-close" @click="closeBuyModal">×</text>
		    </view>
		    <scroll-view class="modal-body" scroll-y>
		      <view class="address-section" @click="selectAddress">
		        <view v-if="selectedAddress" class="address-info">
		          <view class="address-top">
		            <text class="address-name">{{ selectedAddress.name }}</text>
		            <text class="address-phone">{{ selectedAddress.phone }}</text>
		            <view v-if="selectedAddress.isDefault" class="default-tag">默认</view>
		          </view>
		          <text class="address-detail">{{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.detail }}</text>
		        </view>
		        <view v-else class="no-address"><text>请选择收货地址</text></view>
		        <text class="address-arrow">></text>
		      </view>
		      <view class="goods-info-row">
		        <image class="goods-thumb" :src="getImageUrl(goods.images?.[0])" mode="aspectFill"></image>
		        <view class="goods-detail">
		          <text class="goods-name">{{ goods.name }}</text>
		          <view class="goods-price-row">
		            <text class="goods-price">￥{{ formatPrice(originalPrice) }}</text>
		            <text class="goods-quantity">x{{ quantity }}</text>
		          </view>
		        </view>
		      </view>
		      <view class="coupon-section" @click="showCouponSelector">
		        <view class="coupon-left"><text class="coupon-icon">🎫</text><text class="coupon-label">优惠券</text></view>
		        <view class="coupon-right">
		          <text class="coupon-value" v-if="selectedCoupon">{{ selectedCoupon.name }} 省￥{{ formatPrice(selectedCoupon.amount) }}</text>
		          <text class="coupon-placeholder" v-else>选择优惠券</text>
		          <text class="coupon-arrow">></text>
		        </view>
		      </view>
		      <view class="points-section">
		        <view class="points-left"><text class="points-icon">⭐</text><text class="points-label">积分抵扣</text></view>
		        <view class="points-right"><text class="points-info">当前{{ userPoints }}积分，可抵扣￥{{ maxDeductAmount }}</text></view>
		      </view>
		      <view class="points-input-row" v-if="userPoints >= 10 && !selectedCoupon">
		        <text class="points-input-label">使用积分</text>
		        <input class="points-input" v-model="usePoints" type="number" :max="maxDeductPoints" :placeholder="`最多可用${maxDeductPoints}积分`" @blur="onPointsBlur"/>
		        <text class="points-unit">积分</text>
		      </view>
		      <view class="price-detail">
		        <view class="price-item"><text class="price-label">商品总额</text><text class="price-value">￥{{ formatPrice(originalTotal) }}</text></view>
		        <view class="price-item" v-if="selectedCoupon"><text class="price-label">优惠券</text><text class="price-value discount">-￥{{ formatPrice(selectedCoupon.amount) }}</text></view>
		        <view class="price-item" v-if="actualUsePoints > 0"><text class="price-label">积分抵扣</text><text class="price-value discount">-￥{{ formatPrice(actualUsePoints / 10) }}</text></view>
		        <view class="price-item total"><text class="price-label">实付款</text><text class="price-value total-price">￥{{ formatPrice(finalTotal) }}</text></view>
		      </view>
		    </scroll-view>
		    <view class="modal-footer"><button class="modal-btn primary" @click="submitOrder" :loading="submitting">提交订单</button></view>
		  </view>
		</view>
		
		<!-- 优惠券选择弹窗 -->
		<view class="modal" v-if="couponSelectorVisible" @click="closeCouponSelector">
		  <view class="modal-content coupon-modal" @click.stop>
		    <view class="modal-header"><text class="modal-title">选择优惠券</text><text class="modal-close" @click="closeCouponSelector">×</text></view>
		    <scroll-view class="coupon-list" scroll-y>
		      <view class="coupon-option" @click="selectNoCoupon">
		        <view class="option-left"><view class="radio" :class="{ checked: !selectedCoupon }"></view><text class="option-text">不使用优惠券</text></view>
		      </view>
		      <view class="coupon-option" v-for="coupon in availableCoupons" :key="coupon.id" @click="selectCoupon(coupon)">
		        <view class="option-left"><view class="radio" :class="{ checked: selectedCoupon?.id === coupon.id }"></view>
		          <view class="coupon-card"><view class="coupon-amount">￥{{ coupon.amount }}</view><view class="coupon-info"><text class="coupon-name">{{ coupon.name }}</text><text class="coupon-threshold">满{{ coupon.threshold }}元可用</text></view></view>
		        </view>
		      </view>
		    </scroll-view>
		  </view>
		</view>
		<!-- 地址选择弹窗 -->
		<view class="modal" v-if="addressModalVisible" @click="closeAddressModal">
		  <view class="modal-content address-modal" @click.stop>
		    <view class="modal-header"><text class="modal-title">选择收货地址</text><text class="modal-close" @click="closeAddressModal">×</text></view>
		    <scroll-view class="address-list" scroll-y>
		      <view class="address-item" v-for="addr in addressList" :key="addr.id" :class="{ selected: selectedAddress?.id === addr.id }" @click="chooseAddress(addr)">
		        <view class="address-content">
		          <view class="address-top"><text class="address-name">{{ addr.name }}</text><text class="address-phone">{{ addr.phone }}</text><view v-if="addr.isDefault" class="default-tag">默认</view></view>
		          <text class="address-detail">{{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}</text>
		        </view>
		        <view v-if="selectedAddress?.id === addr.id" class="check-icon">✓</view>
		      </view>
		      <view v-if="addressList.length === 0" class="no-address-tip"><text>暂无地址，请先添加</text><button class="add-address-btn" @click="goToAddAddress">添加地址</button></view>
		    </scroll-view>
		  </view>
		</view>
		
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getGoodsDetail, createOrder, payOrder, getGoodsReviews, getReviewStats, checkFavorite, addFavorite, removeFavorite, getDiscountStatus, BASE_URL, getAddressList, getAvailableCoupons, useCoupon, getUserPoints, addToCart as addToCartApi } from '../../api/index.js'

const goods = ref({ id: '', name: '', price: 0, quantity: 0, images: [], description: '' })
const discountInfo = ref(null)
const goodsId = ref('')
const quantity = ref(1)
const reviews = ref([])
const reviewStats = ref({ total: 0, avgRating: 0, ratingCounts: {} })
const previewReviews = computed(() => reviews.value.slice(0, 2))
const isFavorite = ref(false)
const buyModalVisible = ref(false)
const isPaid = ref(false)
const addressList = ref([])
const selectedAddress = ref(null)
const addressModalVisible = ref(false)
const currentUser = ref(null)
const submitting = ref(false)
const userPoints = ref(0)
const usePoints = ref(0)
const availableCoupons = ref([])
const selectedCoupon = ref(null)
const couponSelectorVisible = ref(false)

const maxDeductPoints = computed(() => {
  const fromUser = Math.floor(userPoints.value / 10) * 10
  const fromPrice = Math.floor(originalTotal.value * 0.5 * 10)
  return Math.min(fromUser, fromPrice)
})
const maxDeductAmount = computed(() => formatPrice(maxDeductPoints.value / 10))
const actualUsePoints = computed(() => {
	const points = parseInt(usePoints.value) || 0
	const max = maxDeductPoints.value
	return Math.min(points - (points % 10), max)
})

// ========== 解析图片 ==========
const parseImages = (images) => {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') {
    try { return JSON.parse(images) } catch (e) { return [] }
  }
  return []
}

const previewReviewImages = (images, index) => {
  const urls = parseImages(images).map(img => getImageUrl(img))
  uni.previewImage({ urls, current: index })
}

const getImageUrl = (img) => {
	if (!img) return '/static/商品.png'
	if (typeof img === 'string') {
		if (img.startsWith('http')) return img
		if (img.startsWith('/uploads/')) return BASE_URL + img
		if (img.startsWith('data:image')) return img
		return BASE_URL + img
	}
	if (Array.isArray(img) && img.length > 0) return getImageUrl(img[0])
	return '/static/商品.png'
}

const goodsImages = computed(() => {
	if (!goods.value.images) return ['/static/商品.png']
	if (Array.isArray(goods.value.images)) return goods.value.images.map(img => getImageUrl(img))
	try {
		const parsed = JSON.parse(goods.value.images)
		if (Array.isArray(parsed)) return parsed.map(img => getImageUrl(img))
	} catch (e) {}
	return ['/static/商品.png']
})

const originalPrice = computed(() => discountInfo.value?.isActive ? goods.value.price * discountInfo.value.discountRate : goods.value.price)
const originalTotal = computed(() => originalPrice.value * quantity.value)
const finalTotal = computed(() => {
	let total = originalTotal.value
	if (selectedCoupon.value && total >= selectedCoupon.value.threshold) total -= selectedCoupon.value.amount
	total -= actualUsePoints.value / 10
	return Math.max(0, total)
})
const getDisplayPrice = computed(() => formatPrice(originalPrice.value))
const formatPrice = (price) => Number(price).toFixed(2)
const getStockText = (q) => q === 0 ? '没货' : q < 50 ? '急缺' : q < 100 ? '不多' : '充足'
const getStockClass = (q) => q === 0 ? 'out' : q < 50 ? 'low' : q < 100 ? 'medium' : 'enough'
const formatTime = (time) => time ? new Date(time).toISOString().split('T')[0] : ''
const getRatingPercent = (star) => reviewStats.value.total ? Math.round(((reviewStats.value.ratingCounts?.[star] || 0) / reviewStats.value.total) * 100) : 0
const getCurrentUser = () => { try { const u = uni.getStorageSync('userInfo'); return u ? (typeof u === 'string' ? JSON.parse(u) : u) : null } catch (e) { return null } }

const loadDiscountStatus = async () => { try { const r = await getDiscountStatus(); if (r.code === 200) discountInfo.value = r.data } catch (e) {} }
const loadGoodsDetail = async () => { if (!goodsId.value) return; try { const r = await getGoodsDetail(goodsId.value); if (r.code === 200) goods.value = r.data } catch (e) {} }

// ========== 加载评价时解析图片 ==========
// 详情页只展示前 2 条（previewReviews），按需取 2 条即可
const loadReviews = async () => {
  try {
    const [a, b] = await Promise.all([
      getGoodsReviews(goodsId.value, { page: 1, pageSize: 2 }),
      getReviewStats(goodsId.value)
    ])
    if (a.code === 200) {
      const payload = a.data
      const list = Array.isArray(payload) ? payload : (payload && payload.list) || []
      reviews.value = list.map(item => ({
        ...item,
        images: parseImages(item.images)
      }))
    }
    if (b.code === 200) reviewStats.value = b.data || { total: 0, avgRating: 0, ratingCounts: {} }
  } catch (e) {}
}

const checkFavoriteStatus = async () => { const u = getCurrentUser(); if (!u) return; try { const r = await checkFavorite(u.id, goodsId.value); if (r.code === 200) isFavorite.value = r.data.isFavorite } catch (e) {} }

const toggleFavorite = async () => {
	const u = getCurrentUser()
	if (!u) { uni.showModal({ title: '提示', content: '请先登录', success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) } }); return }
	if (isFavorite.value) { try { await removeFavorite(u.id, goodsId.value); isFavorite.value = false; uni.showToast({ title: '已取消收藏', icon: 'success' }) } catch (e) {} }
	else { try { const img = Array.isArray(goods.value.images) ? goods.value.images[0] : goods.value.images; await addFavorite({ userId: u.id, goodsId: goods.value.id, goodsName: goods.value.name, goodsImage: img || '', goodsPrice: goods.value.price }); isFavorite.value = true; uni.showToast({ title: '收藏成功', icon: 'success' }) } catch (e) {} }
}
const viewAllReviews = () => {
  uni.navigateTo({ url: `/pages/Goods/Reviews?goodsId=${goodsId.value}` })
}
const increaseQuantity = () => { if (!goods.value.status) { uni.showToast({ title: '商品已下架，无法购买' }); return }
		if (goods.value.quantity === 0) { uni.showToast({ title: '商品已售罄' }); return } if (quantity.value < goods.value.quantity) quantity.value++; else uni.showToast({ title: '库存不足' }) }
const decreaseQuantity = () => { if (quantity.value > 1) quantity.value-- }

const loadAddressList = async () => { const u = currentUser.value; if (!u) return; try { const r = await getAddressList(u.id); if (r.code === 200) { addressList.value = r.data || []; const d = addressList.value.find(a => a.isDefault); selectedAddress.value = d || addressList.value[0] || null } } catch (e) {} }
const loadAvailableCoupons = async () => { const u = currentUser.value; if (!u) return; try { const r = await getAvailableCoupons(u.id, originalTotal.value); if (r.code === 200) availableCoupons.value = r.data || [] } catch (e) {} }
const loadUserPoints = async () => { const u = currentUser.value; if (!u) return; try { const r = await getUserPoints(u.id); if (r.code === 200) userPoints.value = r.data.points || 0 } catch (e) {} }
const onPointsBlur = () => {
  let val = parseInt(usePoints.value) || 0
  if (val < 0) val = 0
  if (val > maxDeductPoints.value) val = maxDeductPoints.value
  val = Math.floor(val / 10) * 10
  usePoints.value = val
  if (val > 0) selectedCoupon.value = null
}

const showBuyModal = async (pay) => {
	const u = getCurrentUser()
	if (!u) { uni.showModal({ title: '提示', content: '请先登录', success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) } }); return }
	if (!goods.value.status) { uni.showToast({ title: '商品已下架，无法购买' }); return }
		if (goods.value.quantity === 0) { uni.showToast({ title: '商品已售罄' }); return }
	currentUser.value = u; isPaid.value = pay; usePoints.value = 0
	await Promise.all([loadAddressList(), loadAvailableCoupons(), loadUserPoints()])
	if (addressList.value.length === 0) { uni.showModal({ title: '提示', content: '请先添加收货地址', confirmText: '去添加', success: (r) => { if (r.confirm) uni.navigateTo({ url: '/pages/Address/AddAddress' }) } }); return }
	buyModalVisible.value = true
}

const closeBuyModal = () => { buyModalVisible.value = false; selectedCoupon.value = null; usePoints.value = 0 }
const selectAddress = () => { addressModalVisible.value = true }
const closeAddressModal = () => { addressModalVisible.value = false }
const chooseAddress = (a) => { selectedAddress.value = a; closeAddressModal() }
// 显示优惠券选择器
const showCouponSelector = () => { couponSelectorVisible.value = true }
// 关闭优惠券选择器
const closeCouponSelector = () => { couponSelectorVisible.value = false }
// 不使用优惠券
const selectNoCoupon = () => { selectedCoupon.value = null; closeCouponSelector() }
// 选择优惠券
const selectCoupon = (coupon) => {
	//校验门槛
  if (originalTotal.value < coupon.threshold) { uni.showToast({ title: `满${coupon.threshold}元才可使用` }); return }
  selectedCoupon.value = coupon; usePoints.value = 0; closeCouponSelector()
}
const submitOrder = async () => {
  if (!selectedAddress.value) { uni.showToast({ title: '请选择收货地址' }); return }
  submitting.value = true; uni.showLoading({ title: '提交中...' })
  try {
    // 只提交商品 id 与数量，价格、优惠、状态均由服务端计算
    const d = {
      paymentMethod: '在线支付',
      address: `${selectedAddress.value.province}${selectedAddress.value.city}${selectedAddress.value.district}${selectedAddress.value.detail}`,
      phone: selectedAddress.value.phone,
      goods: [{ goodsId: goods.value.id, quantity: quantity.value }],
      couponId: selectedCoupon.value?.id,
      usePoints: actualUsePoints.value
    }
    const r = await createOrder(d)
    if (r.code === 200) {
      // 选择"立即支付"时，创建订单后再发起支付
      if (isPaid.value) {
        const payRes = await payOrder(r.data.id)
        if (payRes.code !== 200) {
          uni.hideLoading()
          uni.showToast({ title: payRes.message || '订单已创建，请在订单页支付', icon: 'none' })
          closeBuyModal(); setTimeout(() => uni.navigateTo({ url: '/pages/Orders/Orders' }), 1500)
          return
        }
      }
      uni.hideLoading(); uni.showToast({ title: isPaid.value ? '支付并购买成功！' : '购买成功！', icon: 'success' })
      closeBuyModal(); setTimeout(() => uni.navigateTo({ url: '/pages/Orders/Orders' }), 1500)
    } else { uni.hideLoading(); uni.showToast({ title: r.message || '购买失败' }) }
  } catch (e) { uni.hideLoading(); uni.showToast({ title: '购买失败，请重试' }) }
  finally { submitting.value = false }
}
const goToAddAddress = () => { closeAddressModal(); uni.navigateTo({ url: '/pages/Address/AddAddress' }) }
//加入购物车
const addToCart = async () => {
	  if (!goods.value.status) { uni.showToast({ title: '商品已下架，无法加入购物车' }); return }
  const user = getCurrentUser()
  if (!user) { uni.showModal({ title: '提示', content: '请先登录' }); return }
  const price = discountInfo.value?.isActive ? (goods.value.price * discountInfo.value.discountRate).toFixed(2) : goods.value.price
  const res = await addToCartApi({
    userId: user.id, goodsId: goods.value.id, goodsName: goods.value.name,
    goodsImage: Array.isArray(goods.value.images) ? goods.value.images[0] : goods.value.images, price
  })
  if (res.code === 200) uni.showToast({ title: '已加入购物车', icon: 'success' })
}
const navigateBack = () => uni.navigateBack()
onLoad((options) => { goodsId.value = options.id; loadDiscountStatus(); loadGoodsDetail(); loadReviews(); checkFavoriteStatus() })
</script>



<style scoped>
.goods-detail-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 120rpx; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 60rpx; }
.goods-images { height: 500rpx; width: 100%; background-color: #f9f9f9; }
.goods-images image { width: 100%; height: 100%; }
.goods-info-section { background-color: #fff; padding: 30rpx; margin-bottom: 20rpx; }
.price-row { display: flex; align-items: baseline; margin-bottom: 15rpx; }
.goods-price { font-size: 44rpx; color: #333; font-weight: bold; }
.goods-price.discount-price { color: #ff6b6b; }
.original-price { font-size: 26rpx; color: #999; text-decoration: line-through; margin-left: 15rpx; }
.goods-name { font-size: 32rpx; color: #333; font-weight: bold; line-height: 1.4; margin-bottom: 15rpx; display: block; }
.stock-row { display: flex; align-items: center; }
.stock-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 8rpx; }
.stock-status.enough { color: #4caf50; background-color: #e8f5e9; }
.stock-status.medium { color: #ff9800; background-color: #fff3e0; }
.stock-status.low { color: #ff5722; background-color: #fbe9e7; }
.stock-status.out { color: #f44336; background-color: #ffebee; }
.stock-status.offline { color: #999; background-color: #f0f0f0; }
.review-section { background-color: #fff; padding: 30rpx; margin-bottom: 20rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; }
.section-more { font-size: 24rpx; color: #999; }
.review-stats { display: flex; gap: 30rpx; padding: 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 20rpx; }
.rating-overview { text-align: center; min-width: 140rpx; }
.rating-number { font-size: 48rpx; font-weight: bold; color: #ff6b6b; }
.rating-stars { margin: 8rpx 0; }
.rating-stars .star { font-size: 24rpx; color: #ddd; }
.rating-stars .star.active { color: #ffb800; }
.rating-count { font-size: 22rpx; color: #999; }
.rating-distribution { flex: 1; }
.rating-bar { display: flex; align-items: center; gap: 10rpx; margin-bottom: 8rpx; }
.star-label { width: 40rpx; font-size: 22rpx; color: #666; }
.progress-bar { flex: 1; height: 12rpx; background-color: #eee; border-radius: 6rpx; overflow: hidden; }
.progress-fill { height: 100%; background-color: #ffb800; border-radius: 6rpx; }
.star-count { width: 40rpx; font-size: 22rpx; color: #999; text-align: right; }
.review-list { margin-top: 10rpx; }
.review-item { padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.review-item:last-child { border-bottom: none; }
.review-header { display: flex; align-items: center; gap: 20rpx; margin-bottom: 10rpx; }
.review-user { font-size: 26rpx; color: #333; font-weight: 500; }
.review-rating { display: flex; }
.review-rating .star { font-size: 22rpx; color: #ddd; }
.review-rating .star.active { color: #ffb800; }
.review-time { font-size: 22rpx; color: #999; margin-left: auto; }
.review-content { font-size: 26rpx; color: #666; line-height: 1.5; }
.no-review { text-align: center; padding: 40rpx 0; color: #999; font-size: 26rpx; }
.goods-detail-section { background-color: #fff; padding: 30rpx; margin-bottom: 20rpx; }
.section-content { font-size: 26rpx; color: #666; line-height: 1.6; }
.detail-text { white-space: pre-wrap; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; background-color: #fff; padding: 20rpx 30rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05); z-index: 20; }
.bottom-left { display: flex; gap: 40rpx; }
.bottom-item { display: flex; flex-direction: column; align-items: center; gap: 5rpx; }
.bottom-icon { font-size: 36rpx; }
.bottom-icon.favorited { color: #ff6b6b; }
.bottom-text { font-size: 20rpx; color: #666; }
.bottom-text.favorited { color: #ff6b6b; }
.bottom-right { flex: 1; display: flex; align-items: center; gap: 15rpx; justify-content: flex-end; }
.quantity-control { display: flex; align-items: center; gap: 15rpx; }
.quantity-btn { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #ddd; border-radius: 8rpx; font-size: 32rpx; color: #666; background-color: #fff; }
.quantity-num { font-size: 28rpx; color: #333; min-width: 40rpx; text-align: center; }
.buy-btn { width: 160rpx; height: 70rpx; font-size: 26rpx; font-weight: bold; border-radius: 35rpx; border: none; }
.buy-btn.confirm { background-color: #ffb800; color: #fff; }
.buy-btn.pay { background-color: #ff6b6b; color: #fff; }
.buy-btn[disabled] { opacity: 0.5; }
.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background-color: #fff; border-radius: 16rpx; width: 90%; max-height: 80vh; display: flex; flex-direction: column; }
.buy-modal { max-width: 650rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; }
.modal-close { font-size: 40rpx; color: #999; }
.modal-body { padding: 15rpx 0rpx; overflow-y: auto; overflow-x: hidden; }
.modal-footer { padding: 20rpx 30rpx; border-top: 1rpx solid #f0f0f0; }
.modal-btn { width: 100%; height: 80rpx; border-radius: 40rpx; font-size: 30rpx; border: none; }
.modal-btn.primary { background-color: #ff6b6b; color: #fff; }
.address-section { display: flex; align-items: center; padding: 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 20rpx; }
.address-info { flex: 1; }
.address-top { display: flex; align-items: center; gap: 20rpx; margin-bottom: 10rpx; }
.address-name { font-size: 28rpx; font-weight: bold; color: #333; }
.address-phone { font-size: 26rpx; color: #666; }
.default-tag { font-size: 20rpx; color: #ff6b6b; background-color: #ffe6e6; padding: 4rpx 12rpx; border-radius: 8rpx; }
.address-detail { font-size: 24rpx; color: #666; }
.address-arrow { font-size: 32rpx; color: #ccc; }
.goods-info-row { display: flex; gap: 20rpx; padding: 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 20rpx; }
.goods-thumb { width: 100rpx; height: 100rpx; border-radius: 12rpx; }
.goods-price-row { display: flex; justify-content: space-between; margin-top: 10rpx; }
.goods-quantity { font-size: 26rpx; color: #666; }
.coupon-section { display: flex; justify-content: space-between; align-items: center; padding: 25rpx 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 10rpx; }
.coupon-left { display: flex; align-items: center; gap: 10rpx; }
.coupon-icon { font-size: 32rpx; }
.coupon-label { font-size: 28rpx; color: #333; }
.coupon-right { display: flex; align-items: center; }
.coupon-value { font-size: 26rpx; color: #ff6b6b; }
.coupon-placeholder { font-size: 26rpx; color: #999; }
.coupon-arrow { font-size: 28rpx; color: #ccc; margin-left: 10rpx; }
.points-section { display: flex; justify-content: space-between; align-items: center; padding: 15rpx 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 10rpx; }
.points-left { display: flex; align-items: center; gap: 10rpx; }
.points-icon { font-size: 32rpx; }
.points-label { font-size: 28rpx; color: #333; }
.points-info { font-size: 24rpx; color: #999; }
.points-input-row { display: flex; align-items: center; padding: 15rpx 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 20rpx; }
.points-input-label { font-size: 26rpx; color: #333; margin-right: 15rpx; }
.points-input { flex: 1; font-size: 26rpx; color: #333; }
.points-unit { font-size: 24rpx; color: #999; }
.price-detail { padding: 10rpx 0; }
.price-item { display: flex; justify-content: space-between; padding: 15rpx 0; }
.price-label { font-size: 26rpx; color: #666; }
.price-value { font-size: 26rpx; color: #333; }
.price-value.discount { color: #ff6b6b; }
.price-item.total { border-top: 1rpx solid #f0f0f0; margin-top: 10rpx; padding-top: 20rpx; }
.price-item.total .price-value { font-size: 32rpx; color: #ff6b6b; font-weight: bold; }
.sales-row { margin-top: 10rpx; }
.sales-text { font-size: 24rpx; color: #999; }
.coupon-modal { max-width: 600rpx; }
.coupon-list { max-height: 60vh; padding: 20rpx; }
.coupon-option { padding: 15rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.option-left { display: flex; align-items: center; gap: 15rpx; }
.radio { width: 40rpx; height: 40rpx; border: 2rpx solid #ddd; border-radius: 50%; }
.radio.checked { border-color: #ff6b6b; background-color: #ff6b6b; }
.radio.checked::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16rpx; height: 16rpx; background-color: #fff; border-radius: 50%; }
.option-text { font-size: 28rpx; color: #333; }
.coupon-card { display: flex; align-items: center; gap: 20rpx; flex: 1; }
.coupon-amount { font-size: 36rpx; font-weight: bold; color: #ff6b6b; }
.coupon-name { font-size: 28rpx; color: #333; display: block; margin-bottom: 5rpx; }
.coupon-threshold { font-size: 22rpx; color: #999; }
.address-modal { max-width: 600rpx; }
.address-list { max-height: 60vh; padding: 20rpx; }
.address-item { display: flex; align-items: center; padding: 24rpx; background-color: #f9f9f9; border-radius: 16rpx; margin-bottom: 20rpx; border: 2rpx solid transparent; }
.address-item.selected { border-color: #ff6b6b; background-color: #fff5f5; }
.check-icon { font-size: 32rpx; color: #ff6b6b; margin-left: 20rpx; }
.no-address-tip { display: flex; flex-direction: column; align-items: center; padding: 60rpx 0; }
.no-address-tip text { font-size: 26rpx; color: #999; margin-bottom: 30rpx; }
.add-address-btn { width: 200rpx; height: 60rpx; background-color: #ff6b6b; color: #fff; font-size: 26rpx; border-radius: 30rpx; border: none; }
.review-images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.review-image { width: 120rpx; height: 120rpx; border-radius: 8rpx;}
</style>