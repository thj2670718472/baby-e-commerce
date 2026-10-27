<template>
  <view class="reviews-page">
    <view class="page-header">
      <text class="header-back" @click="navigateBack">返回</text>
      <text class="header-title">全部评价</text>
      <text class="header-placeholder"></text>
    </view>

    <!-- 评分统计 -->
    <view class="stats-card" v-if="reviewStats.total > 0">
      <view class="rating-overview">
        <text class="avg-rating">{{ reviewStats.avgRating }}</text>
        <view class="rating-stars">
          <text v-for="i in 5" :key="i" class="star" :class="{ active: i <= reviewStats.avgRating }">★</text>
        </view>
        <text class="total-count">{{ reviewStats.total }}条评价</text>
      </view>
      
      <!-- 按星筛选 -->
      <view class="rating-distribution">
        <view class="rating-bar" :class="{ active: currentFilter === star }" v-for="star in 5" :key="star" @click="filterReviews(star)">
          <text class="star-label">{{ star }}星</text>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: getRatingPercent(star) + '%' }"></view>
          </view>
          <text class="star-count">{{ reviewStats.ratingCounts?.[star] || 0 }}</text>
        </view>
      </view>
      <!-- 全部按钮 -->
      <view class="show-all" @click="filterReviews(0)">
        <text :class="{ active: currentFilter === 0 }">查看全部评价</text>
      </view>
    </view>

    <!-- 评价列表 -->
    <scroll-view class="review-list" scroll-y v-if="filteredReviews.length > 0" @scrolltolower="loadMore">
      <view class="review-item" v-for="review in filteredReviews" :key="review.id">
        <view class="review-header">
          <text class="review-user">{{ review.userName || '匿名用户' }}</text>
          <view class="review-stars">
            <text v-for="i in 5" :key="i" class="star" :class="{ active: i <= review.rating }">★</text>
          </view>
          <text class="review-time">{{ formatTime(review.createTime) }}</text>
        </view>
        <text class="review-content">{{ review.content || '默认好评' }}</text>
        <view class="review-images" v-if="review.images && review.images.length > 0">
          <image v-for="(img, idx) in review.images" :key="idx" :src="getImageUrl(img)" mode="aspectFill" class="review-img" @click="previewImages(review.images, idx)"></image>
        </view>
      </view>
      <view style="text-align: center; padding: 20rpx 0;">
        <text v-if="loadingMore" style="font-size: 24rpx; color: #999;">加载中...</text>
        <text v-else-if="!hasMore" style="font-size: 24rpx; color: #999;">没有更多评价了</text>
      </view>
    </scroll-view>
    <view v-else class="empty-tip">暂无评价</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { getGoodsReviews, getReviewStats, BASE_URL } from '../../api/index.js'

const goodsId = ref('')
const reviews = ref([])
const reviewStats = ref({ total: 0, avgRating: 0, ratingCounts: {} })
const currentFilter = ref(0)
const PAGE_SIZE = 10
const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)

const filteredReviews = computed(() => {
  if (currentFilter.value === 0) return reviews.value
  return reviews.value.filter(r => r.rating === currentFilter.value)
})

const getRatingPercent = (star) => {
  if (!reviewStats.value.total) return 0
  const count = reviewStats.value.ratingCounts?.[star] || 0
  return Math.round((count / reviewStats.value.total) * 100)
}

const parseImages = (images) => {
  if (!images) return []
  if (Array.isArray(images)) return images
  if (typeof images === 'string') { try { return JSON.parse(images) } catch (e) { return [] } }
  return []
}

const getImageUrl = (img) => {
  if (!img) return '/static/商品.png'
  if (img.startsWith('http')) return img
  if (img.startsWith('/uploads/')) return BASE_URL + img
  return BASE_URL + img
}

const formatTime = (time) => time ? new Date(time).toISOString().split('T')[0] : ''

const previewImages = (images, index) => {
  const urls = parseImages(images).map(img => getImageUrl(img))
  uni.previewImage({ urls, current: index })
}

const filterReviews = (type) => { currentFilter.value = type }

const applyList = (payload, reset) => {
  const list = Array.isArray(payload) ? payload : (payload && payload.list) || []
  const total = Array.isArray(payload) ? list.length : (payload && payload.total) || 0
  const mapped = list.map(item => ({ ...item, images: parseImages(item.images) }))
  reviews.value = reset ? mapped : [...reviews.value, ...mapped]
  hasMore.value = reviews.value.length < total
}

const loadData = async (reset = true) => {
  try {
    if (reset) {
      page.value = 1
    } else {
      if (!hasMore.value || loadingMore.value) return
      loadingMore.value = true
    }
    const [a, b] = await Promise.all([
      getGoodsReviews(goodsId.value, { page: page.value, pageSize: PAGE_SIZE }),
      reset ? getReviewStats(goodsId.value) : Promise.resolve(null)
    ])
    if (a.code === 200) applyList(a.data, reset)
    if (b && b.code === 200) reviewStats.value = b.data || { total: 0, avgRating: 0, ratingCounts: {} }
  } catch (e) {} finally {
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  loadData(false)
}

const navigateBack = () => uni.navigateBack()

onLoad((options) => { goodsId.value = options.goodsId; loadData() })
onReachBottom(loadMore)
</script>

<style scoped>
.reviews-page { min-height: 100vh; background-color: #f5f5f5; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-placeholder { width: 100rpx; }

.stats-card { background-color: #fff; padding: 30rpx; margin-bottom: 15rpx; }
.rating-overview { text-align: center; margin-bottom: 25rpx; }
.avg-rating { font-size: 56rpx; font-weight: bold; color: #ff6b6b; display: block; }
.rating-stars { margin: 8rpx 0; display: flex; justify-content: center; gap: 5rpx; }
.rating-stars .star { font-size: 28rpx; color: #ddd; }
.rating-stars .star.active { color: #ffb800; }
.total-count { font-size: 24rpx; color: #999; }

.rating-distribution { margin-bottom: 15rpx; }
.rating-bar { display: flex; align-items: center; gap: 10rpx; padding: 12rpx 10rpx; margin-bottom: 6rpx; border-radius: 8rpx; }
.rating-bar.active { background-color: #fff5f5; }
.star-label { width: 50rpx; font-size: 24rpx; color: #666; }
.progress-bar { flex: 1; height: 10rpx; background-color: #eee; border-radius: 5rpx; overflow: hidden; }
.progress-fill { height: 100%; background-color: #ffb800; border-radius: 5rpx; }
.star-count { width: 40rpx; font-size: 24rpx; color: #999; text-align: right; }

.show-all { text-align: center; padding-top: 5rpx; }
.show-all text { font-size: 24rpx; color: #409eff; }
.show-all text.active { color: #ff6b6b; font-weight: bold; }

.review-list { padding: 0 20rpx; }
.review-item { background-color: #fff; padding: 25rpx; margin-bottom: 15rpx; border-radius: 12rpx; }
.review-header { display: flex; align-items: center; gap: 15rpx; margin-bottom: 10rpx; }
.review-user { font-size: 26rpx; color: #333; font-weight: 500; }
.review-stars { display: flex; }
.star { font-size: 22rpx; color: #ddd; }
.star.active { color: #ffb800; }
.review-time { font-size: 22rpx; color: #999; margin-left: auto; }
.review-content { font-size: 26rpx; color: #666; line-height: 1.5; }
.review-images { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.review-img { width: 120rpx; height: 120rpx; border-radius: 8rpx; }
.empty-tip { text-align: center; padding: 100rpx 0; color: #999; font-size: 28rpx; }
</style>