<template>
  <view class="cart-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">购物车</text>
      <text class="header-clear" @click="handleClear">清空</text>
    </view>

    <!-- 折扣提示 -->
    <view class="discount-tip" v-if="discountInfo?.isActive">
      <text>🎉 {{ discountInfo.targetDayName }}狂欢日 全场{{ Math.round(discountInfo.discountRate * 10) }}折</text>
    </view>

    <scroll-view class="content" scroll-y v-if="cartList.length > 0">
      <view class="cart-item" v-for="item in cartList" :key="item.id">
        <view class="checkbox" :class="{ checked: item.checked }" @click="toggleCheck(item)">
          <text v-if="item.checked" class="check-icon">✓</text>
        </view>
        <image :src="getImageUrl(item.goodsImage)" mode="aspectFill" class="goods-image" @click="goDetail(item.goodsId)"></image>
        <view class="goods-info" @click="goDetail(item.goodsId)">
          <text class="goods-name">{{ item.goodsName }}</text>
          <view class="price-wrapper">
            <text class="goods-price" :class="{ 'discount-price': discountInfo?.isActive }">￥{{ getDisplayPrice(item.price) }}</text>
            <text class="original-price" v-if="discountInfo?.isActive">￥{{ formatPrice(item.price) }}</text>
          </view>
        </view>
        <view class="quantity-control">
          <view class="quantity-btn" @click="decrease(item)">-</view>
          <text class="quantity-num">{{ item.quantity }}</text>
          <view class="quantity-btn" @click="increase(item)">+</view>
        </view>
      </view>
    </scroll-view>

    <view v-else class="empty-container">
      <text class="empty-text">购物车为空</text>
      <button class="go-btn" @click="goShopping">去逛逛</button>
    </view>

    <view class="bottom-bar" v-if="cartList.length > 0">
      <view class="bottom-left">
        <view class="checkbox all-checkbox" :class="{ checked: isAllChecked }" @click="toggleAllCheck">
          <text v-if="isAllChecked" class="check-icon">✓</text>
        </view>
        <text class="all-text" @click="toggleAllCheck">全选</text>
      </view>
      <view class="bottom-right">
        <view class="total-info">
          <text class="total-label">合计：</text>
          <text class="total-price">￥{{ totalPrice }}</text>
        </view>
        <button class="submit-btn" @click="handleSubmit" :disabled="selectedCount === 0">去结算({{ selectedCount }})</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getCartList, updateCartQuantity, deleteCartItem, clearCart, BASE_URL, getDiscountStatus } from '../../api/index.js'

const cartList = ref([])
const discountInfo = ref(null)

const totalPrice = computed(() => {
  return cartList.value
    .filter(item => item.checked)
    .reduce((sum, item) => {
      const price = discountInfo.value?.isActive ? item.price * discountInfo.value.discountRate : item.price
      return sum + price * item.quantity
    }, 0)
    .toFixed(2)
})

const selectedCount = computed(() => {
  return cartList.value.filter(item => item.checked).reduce((sum, item) => sum + item.quantity, 0)
})

const isAllChecked = computed(() => {
  return cartList.value.length > 0 && cartList.value.every(item => item.checked)
})

const formatPrice = (price) => Number(price).toFixed(2)

const getDisplayPrice = (price) => {
  if (discountInfo.value?.isActive) return formatPrice(price * discountInfo.value.discountRate)
  return formatPrice(price)
}

const getImageUrl = (image) => {
  if (!image) return '/static/商品.png'
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  if (image.startsWith('/uploads/')) return BASE_URL + image
  if (image.startsWith('data:image')) return image
  try {
    JSON.parse(image)
    const arr = JSON.parse(image)
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0]
      if (first.startsWith('http')) return first
      if (first.startsWith('/uploads/')) return BASE_URL + first
      return BASE_URL + first
    }
  } catch (e) {
    if (image.startsWith('/')) return BASE_URL + image
    return BASE_URL + image
  }
  return '/static/商品.png'
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
    if (res.code === 200) discountInfo.value = res.data
  } catch (e) {}
}

const loadCartList = async () => {
  const user = getCurrentUser()
  if (!user) return
  try {
    const res = await getCartList(user.id)
    if (res.code === 200) {
      cartList.value = (res.data || []).map(item => ({ ...item, checked: true }))
    }
  } catch (error) {}
}

const toggleCheck = (item) => { item.checked = !item.checked }

const toggleAllCheck = () => {
  const newVal = !isAllChecked.value
  cartList.value.forEach(item => { item.checked = newVal })
}

const increase = async (item) => {
  try { await updateCartQuantity(item.id, item.quantity + 1); item.quantity++ } catch (error) {}
}

const decrease = async (item) => {
  if (item.quantity <= 1) {
    const res = await uni.showModal({ title: '提示', content: '确定删除该商品吗？' })
    if (res.confirm) {
      try { await deleteCartItem(item.id); cartList.value = cartList.value.filter(i => i.id !== item.id); uni.showToast({ title: '已删除', icon: 'success' }) } catch (error) {}
    }
    return
  }
  try { await updateCartQuantity(item.id, item.quantity - 1); item.quantity-- } catch (error) {}
}

const handleClear = async () => {
  if (cartList.value.length === 0) return
  const res = await uni.showModal({ title: '提示', content: '确定清空购物车吗？' })
  if (res.confirm) {
    const user = getCurrentUser()
    try { await clearCart(user.id); cartList.value = []; uni.showToast({ title: '已清空', icon: 'success' }) } catch (error) {}
  }
}

const handleSubmit = () => {
  const checkedItems = cartList.value.filter(item => item.checked)
  if (checkedItems.length === 0) { uni.showToast({ title: '请选择商品', icon: 'none' }); return }
  const goodsData = checkedItems.map(item => ({
    cartId: item.id,
    goodsId: item.goodsId,
    name: item.goodsName,
    price: discountInfo.value?.isActive ? (item.price * discountInfo.value.discountRate).toFixed(2) : item.price,
    quantity: item.quantity,
    image: item.goodsImage
  }))
  uni.navigateTo({ url: `/pages/Orders/OrderConfirm?goodsData=${encodeURIComponent(JSON.stringify(goodsData))}` })
}

const goDetail = (goodsId) => { uni.navigateTo({ url: `/pages/GoodsDetail/GoodsDetail?id=${goodsId}` }) }
const goShopping = () => uni.switchTab({ url: '/pages/Home/Home' })
const navigateBack = () => uni.navigateBack()

onMounted(() => { loadDiscountStatus(); loadCartList() })
</script>

<style scoped>
.cart-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 120rpx; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-clear { font-size: 26rpx; color: #ff6b6b; }

.discount-tip { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); text-align: center; padding: 15rpx; color: #fff; font-size: 24rpx; font-weight: bold; }

.content { padding: 20rpx; }
.cart-item { display: flex; align-items: center; background-color: #fff; padding: 20rpx; border-radius: 16rpx; margin-bottom: 15rpx; gap: 15rpx; }

.checkbox { width: 40rpx; height: 40rpx; border: 2rpx solid #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.checkbox.checked { background-color: #ff6b6b; border-color: #ff6b6b; }
.check-icon { color: #fff; font-size: 24rpx; font-weight: bold; }

.goods-image { width: 120rpx; height: 120rpx; border-radius: 12rpx; flex-shrink: 0; }
.goods-info { flex: 1; min-width: 0; }
.goods-name { font-size: 28rpx; color: #333; margin-bottom: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.price-wrapper { display: flex; align-items: baseline; gap: 10rpx; }
.goods-price { font-size: 30rpx; color: #ff6b6b; font-weight: bold; }
.goods-price.discount-price { color: #ff6b6b; }
.original-price { font-size: 22rpx; color: #999; text-decoration: line-through; }

.quantity-control { display: flex; align-items: center; gap: 10rpx; flex-shrink: 0; }
.quantity-btn { width: 44rpx; height: 44rpx; padding: 0; border: 2rpx solid #ddd; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #666; }
.quantity-num { font-size: 26rpx; min-width: 36rpx; text-align: center; }

.empty-container { display: flex; flex-direction: column; align-items: center; padding: 150rpx 0; }
.empty-text { font-size: 28rpx; color: #999; }
.go-btn { margin-top: 30rpx; padding: 15rpx 50rpx; background-color: #ff6b6b; color: #fff; border-radius: 30rpx; border: none; }

.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 20rpx 30rpx; background-color: #fff; box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05); }
.bottom-left { display: flex; align-items: center; gap: 10rpx; }
.all-checkbox { width: 40rpx; height: 40rpx; }
.all-text { font-size: 26rpx; color: #333; }
.bottom-right { display: flex; align-items: center; gap: 15rpx; }
.total-price { font-size: 36rpx; color: #ff6b6b; font-weight: bold; }
.submit-btn { padding: 15rpx 35rpx; background-color: #ff6b6b; color: #fff; font-size: 28rpx; border-radius: 35rpx; border: none; }
.submit-btn[disabled] { opacity: 0.5; }
</style>