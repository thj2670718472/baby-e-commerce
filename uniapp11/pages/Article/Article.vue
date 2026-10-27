<template>
  <view class="article-page">
    <view class="article-header">
      <text class="header-title">育儿知识</text>
    </view>

    <!-- 推荐文章 -->
    <view class="article-list" v-if="articles.length > 0">
      <view class="section-title">{{ babyAgeText ? `${babyAgeText}推荐阅读` : '推荐阅读' }}</view>
      <view class="article-item" v-for="article in articles" :key="article.id" @click="showArticleDetail(article.id)">
        <text class="article-title">{{ article.title }}</text>
        <text class="article-summary">{{ article.summary }}</text>
        <view class="article-meta">
          <text v-if="article.author">作者：{{ article.author }}</text>
          <text>{{ formatDate(article.createdAt) }}</text>
        </view>
      </view>
    </view>

    <!-- 更多按钮 -->
    <view class="more-btn-wrapper">
      <button class="more-btn" @click="goAllArticles">更多育儿知识 </button>
    </view>

    <!-- 文章详情弹窗 -->
    <view class="modal" v-if="showModal">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">文章详情</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <text class="detail-title">{{ selectedArticle.title }}</text>
          <view class="detail-meta">
            <text v-if="selectedArticle.author">作者：{{ selectedArticle.author }}</text>
            <text>{{ formatDate(selectedArticle.createdAt) }}</text>
          </view>
          <view class="detail-content">
            <text>{{ selectedArticle.content }}</text>
          </view>
        </view>
        <view class="modal-footer">
          <button class="close-button" @click="closeModal">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getRecommendArticles, getArticleDetail, getBabyList } from '../../api/index.js'

const articles = ref([])
const allArticles = ref([])
const showModal = ref(false)
const selectedArticle = ref({})
const babyAgeText = ref('')

const getCurrentUser = () => {
  try {
    const u = uni.getStorageSync('userInfo')
    return u ? (typeof u === 'string' ? JSON.parse(u) : u) : null
  } catch (e) { return null }
}

const getBabyAge = async () => {
  const user = getCurrentUser()
  if (!user) return null
  try {
    const res = await getBabyList(user.id)
    if (res.code === 200 && res.data?.length > 0) {
      const baby = res.data[0]
      if (baby.birthDate) {
        const birth = new Date(baby.birthDate)
        const now = new Date()
        return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
      }
    }
  } catch (e) {}
  return null
}

const getAgeText = (months) => {
  if (months <= 6) return '0-6个月'
  if (months <= 12) return '6-12个月'
  if (months <= 36) return '1-3岁'
  return '3岁以上'
}

const loadArticles = async () => {
  try {
    const months = await getBabyAge()
    const res = await getRecommendArticles(months || 99)
    if (res.code === 200) {
      articles.value = res.data.recommended?.slice(0, 4) || []
      allArticles.value = res.data.all || []
      if (months !== null) babyAgeText.value = getAgeText(months)
    }
  } catch (e) {}
}

const showArticleDetail = async (id) => {
  showModal.value = true
  try {
    const res = await getArticleDetail(id)
    if (res.code === 200) selectedArticle.value = res.data
  } catch (e) {}
}

const closeModal = () => { showModal.value = false }

const goAllArticles = () => {
  uni.navigateTo({ url: '/pages/Article/AllArticles' })
}

const formatDate = (date) => date ? new Date(date).toLocaleDateString('zh-CN') : ''

onMounted(() => loadArticles())
</script>

<style scoped>
.article-page { min-height: 100vh; background-color: #f5f5f5; }
.article-header { display: flex; justify-content: center; padding: 30rpx; padding-top: calc(var(--status-bar-height) + 30rpx); background-color: #fff; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }

.section-title { font-size: 28rpx; font-weight: bold; color: #ff6b6b; padding: 20rpx; }
.article-list { padding: 0 20rpx; }
.article-item { background-color: #fff; border-radius: 16rpx; padding: 25rpx; margin-bottom: 15rpx; }
.article-title { font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 10rpx; }
.article-summary { font-size: 24rpx; color: #666; margin-bottom: 15rpx; line-height: 1.5; }
.article-meta { font-size: 20rpx; color: #999; display: flex; gap: 20rpx; }

.more-btn-wrapper { padding: 30rpx; text-align: center; }
.more-btn { background-color: #ff6b6b; color: #fff; font-size: 26rpx; border-radius: 30rpx; border: none; padding: 12rpx 35rpx; display: inline-block; }

.modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { background-color: #fff; border-radius: 16rpx; width: 90%; max-height: 80vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 25rpx; border-bottom: 1rpx solid #e0e0e0; }
.modal-title { font-size: 32rpx; font-weight: bold; }
.modal-close { font-size: 36rpx; color: #999; }
.modal-body { flex: 1; padding: 25rpx; overflow-y: auto; }
.detail-title { font-size: 28rpx; font-weight: bold; text-align: center; margin-bottom: 15rpx; }
.detail-meta { display: flex; justify-content: center; gap: 20rpx; margin-bottom: 20rpx; padding-bottom: 15rpx; border-bottom: 1rpx solid #e0e0e0; font-size: 22rpx; color: #999; }
.detail-content { font-size: 26rpx; line-height: 1.8; white-space: pre-wrap; }
.modal-footer { display: flex; justify-content: center; padding: 20rpx; border-top: 1rpx solid #e0e0e0; }
.close-button { width: 180rpx; height: 60rpx; background-color: #409eff; color: #fff; font-size: 26rpx; border-radius: 30rpx; border: none; }
</style>