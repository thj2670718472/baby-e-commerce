<template>
  <view class="review-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">商品评价</text>
      <text class="header-placeholder"></text>
    </view>

    <scroll-view class="content" scroll-y>
      <view class="goods-list">
        <view class="goods-item" v-for="(item, index) in goodsList" :key="index">
          <image :src="getImageUrl(item.goodsImage)" mode="aspectFill" class="goods-image"></image>
          <view class="goods-info">
            <text class="goods-name">{{ item.goodsName }}</text>
            <text class="goods-price">￥{{ formatPrice(item.price) }}</text>
          </view>
          <view class="goods-action">
            <view v-if="item.reviewed" class="reviewed-tag"><text>已评价</text></view>
            <button v-else class="review-btn" @click="openReviewModal(item, index)">去评价</button>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 评价弹窗 -->
    <view class="modal" v-if="reviewModalVisible" @click="closeReviewModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">评价商品</text>
          <text class="modal-close" @click="closeReviewModal">×</text>
        </view>
        <view class="modal-body">
          <view class="current-goods" v-if="currentGoods">
            <image :src="getImageUrl(currentGoods.goodsImage)" mode="aspectFill" class="modal-goods-image"></image>
            <view class="modal-goods-info">
              <text class="modal-goods-name">{{ currentGoods.goodsName }}</text>
              <text class="modal-goods-price">￥{{ formatPrice(currentGoods.price) }}</text>
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">评分</text>
            <view class="rating-select">
              <text v-for="i in 5" :key="i" class="star" :class="{ active: i <= currentRating }" @click="currentRating = i">★</text>
            </view>
          </view>

          <view class="form-item">
            <text class="form-label">评价内容</text>
            <textarea class="form-textarea" v-model="currentContent" placeholder="请输入评价内容（默认好评）" maxlength="500"></textarea>
            <text class="char-count">{{ currentContent.length }}/500</text>
          </view>

          <!-- ===== 上传图片 ===== -->
          <view class="form-item">
            <text class="form-label">上传图片</text>
            <view class="image-upload-list">
              <view class="image-item" v-for="(img, idx) in currentImages" :key="idx">
                <image :src="img" mode="aspectFill" class="uploaded-image"></image>
                <view class="delete-image" @click="removeImage(idx)">×</view>
              </view>
              <view class="upload-btn" @click="chooseImage" v-if="currentImages.length < 9">
                <text class="upload-icon">+</text>
                <text class="upload-text">添加图片</text>
              </view>
            </view>
            <text class="upload-tip">最多9张，支持jpg/png</text>
          </view>
          <!-- ===== 上传图片结束 ===== -->
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @click="closeReviewModal">取消</button>
          <button class="modal-btn confirm" @click="submitSingleReview" :loading="submitting">提交评价</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { submitReview, BASE_URL, getOrderDetail } from '../../api/index.js'

const orderId = ref('')
const goodsList = ref([])
const submitting = ref(false)
const reviewModalVisible = ref(false)
const currentGoods = ref(null)
const currentIndex = ref(-1)
const currentRating = ref(5)
const currentContent = ref('')
const currentImages = ref([])

const formatPrice = (price) => Number(price).toFixed(2)

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

const openReviewModal = (goods, index) => {
  currentGoods.value = goods
  currentIndex.value = index
  currentRating.value = 5
  currentContent.value = ''
  currentImages.value = []
  reviewModalVisible.value = true
}

const closeReviewModal = () => {
  reviewModalVisible.value = false
  currentGoods.value = null
  currentIndex.value = -1
}

// ========== 选择图片 ==========
const chooseImage = () => {
  const remainCount = 9 - currentImages.value.length
  uni.chooseImage({
    count: remainCount,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      // 小程序中 tempFilePaths 是临时路径，直接用于预览
      // 需要上传到服务器获取真实URL
      uploadImages(res.tempFilePaths)
    }
  })
}

const uploadImages = (filePaths) => {
  filePaths.forEach((filePath) => {
    uni.uploadFile({
      url: BASE_URL + '/upload/image',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${uni.getStorageSync('token') || ''}`
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.code === 200) {
          console.log('上传成功，URL:', data.data.url)
          const fullUrl = data.data.url.startsWith('http') 
            ? data.data.url 
            : BASE_URL + data.data.url
          currentImages.value.push(fullUrl)
        }
      }
    })
  })
}

const removeImage = (index) => {
  currentImages.value.splice(index, 1)
}
// ========== 图片操作结束 ==========

const submitSingleReview = async () => {
  const user = getCurrentUser()
  if (!user) { uni.showToast({ title: '请先登录' }); return }
  if (!currentGoods.value) return

  submitting.value = true
  uni.showLoading({ title: '提交中...' })

  try {
    await submitReview({
      orderId: orderId.value,
      goodsId: currentGoods.value.goodsId,
      userId: user.id,
      userName: '',
      rating: currentRating.value,
      content: currentContent.value || '默认好评',
      images: currentImages.value,  // ← 传图片数组
      isAnonymous: true
    })

    goodsList.value[currentIndex.value].reviewed = true
    uni.hideLoading()
    uni.showToast({ title: '评价已提交，等待审核', icon: 'success', duration: 1500 })
    closeReviewModal()

    // 检查是否全部评价完
    const allReviewed = goodsList.value.every(item => item.reviewed)
    if (allReviewed) {
      setTimeout(() => { uni.navigateBack() }, 1500)
    }
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '评价失败', icon: 'none' })
  } finally { submitting.value = false }
}

const navigateBack = () => {
  const unreviewed = goodsList.value.filter(item => !item.reviewed)
  if (unreviewed.length > 0) {
    uni.showModal({
      title: '提示', content: `还有${unreviewed.length}件商品未评价，确定离开？`,
      confirmText: '确定', cancelText: '继续评价',
      success: (res) => { if (res.confirm) uni.navigateBack() }
    })
  } else { uni.navigateBack() }
}



onLoad(async (options) => {
  orderId.value = options.orderId
  
  // 先查订单详情，获取已评价的商品ID列表
  try {
    const orderRes = await getOrderDetail(orderId.value)
    const reviewedIds = orderRes.data?.reviewedGoodsIds || []
    
    if (options.goodsData) {
      const goods = JSON.parse(decodeURIComponent(options.goodsData))
      goodsList.value = goods.map(item => ({
        ...item,
        reviewed: reviewedIds.includes(item.goodsId)  // ← 标记是否已评价
      }))
    }
  } catch (e) {
    if (options.goodsData) {
      const goods = JSON.parse(decodeURIComponent(options.goodsData))
      goodsList.value = goods.map(item => ({ ...item, reviewed: false }))
    }
  }
})
</script>

<style scoped>
.review-page { min-height: 100vh; background-color: #f5f5f5; display: flex; flex-direction: column; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-placeholder { width: 100rpx; }
.content { flex: 1; padding: 20rpx; }
.goods-list { background-color: #fff; border-radius: 16rpx; padding: 20rpx; margin-bottom: 20rpx; }
.goods-item { display: flex; align-items: center; gap: 20rpx; padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.goods-item:last-child { border-bottom: none; }
.goods-image { width: 100rpx; height: 100rpx; border-radius: 12rpx; background-color: #f9f9f9; }
.goods-info { flex: 1; }
.goods-name { font-size: 26rpx; color: #333; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8rpx; }
.goods-price { font-size: 26rpx; color: #ff6b6b; font-weight: bold; }
.goods-action { min-width: 120rpx; text-align: right; }
.review-btn { padding: 12rpx 24rpx; background-color: #ff6b6b; color: #fff; font-size: 24rpx; border-radius: 30rpx; border: none; }
.reviewed-tag { display: inline-block; padding: 12rpx 24rpx; background-color: #f5f5f5; border-radius: 30rpx; }
.reviewed-tag text { font-size: 24rpx; color: #999; }

.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background-color: #fff; border-radius: 16rpx; width: 85%; max-width: 600rpx; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; }
.modal-close { font-size: 40rpx; color: #999; }
.modal-body { padding: 30rpx; }
.current-goods { display: flex; gap: 20rpx; padding: 20rpx; background-color: #f9f9f9; border-radius: 12rpx; margin-bottom: 30rpx; }
.modal-goods-image { width: 80rpx; height: 80rpx; border-radius: 12rpx; }
.modal-goods-name { font-size: 26rpx; color: #333; margin-bottom: 8rpx; display: block; }
.modal-goods-price { font-size: 26rpx; color: #ff6b6b; font-weight: bold; }
.form-item { margin-bottom: 30rpx; }
.form-label { font-size: 28rpx; color: #333; margin-bottom: 15rpx; display: block; }
.rating-select { display: flex; gap: 15rpx; }
.rating-select .star { font-size: 48rpx; color: #ddd; }
.rating-select .star.active { color: #ffb800; }
.form-textarea { width: 100%; height: 180rpx; padding: 20rpx; border: 1rpx solid #e0e0e0; border-radius: 12rpx; font-size: 26rpx; box-sizing: border-box; background-color: #f9f9f9; }
.char-count { text-align: right; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.modal-footer { display: flex; gap: 20rpx; padding: 30rpx; border-top: 1rpx solid #f0f0f0; }
.modal-btn { flex: 1; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: 40rpx; font-size: 28rpx; border: none; }
.modal-btn.cancel { background-color: #f5f5f5; color: #666; }
.modal-btn.confirm { background-color: #ff6b6b; color: #fff; }

/* 图片上传 */
.image-upload-list { display: flex; flex-wrap: wrap; gap: 15rpx; }
.image-item { width: 140rpx; height: 140rpx; border-radius: 12rpx; position: relative; }
.uploaded-image { width: 100%; height: 100%; border-radius: 12rpx; }
.delete-image { position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background-color: #ff6b6b; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24rpx; }
.upload-btn { width: 140rpx; height: 140rpx; border: 2rpx dashed #ddd; border-radius: 12rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #f9f9f9; }
.upload-icon { font-size: 48rpx; color: #ccc; }
.upload-text { font-size: 20rpx; color: #ccc; margin-top: 4rpx; }
.upload-tip { font-size: 22rpx; color: #ccc; margin-top: 10rpx; }
</style>