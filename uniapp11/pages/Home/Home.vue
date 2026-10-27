<template>
	<view class="home-page">
		<!-- 品牌头部与搜索栏（首页时显示） -->
		<view class="search-bar" v-if="!isSearching">
			<view class="brand-row">
				<view class="brand-lockup">
					<image class="brand-mark" src="/static/babycity-icon.png" mode="aspectFill"></image>
					<view class="brand-text">
						<text class="brand-name">BabyCity</text>
						<text class="brand-subtitle">母婴商城</text>
					</view>
				</view>
				<text class="brand-slogan">给宝宝更好的爱</text>
			</view>
			<view class="search-input">
				<image class="search-icon" src="/static/搜索.png"></image>
				<input 
					class="search-input-field" 
					v-model="searchKeyword" 
					placeholder="搜索商品名称" 
					@input="onSearchInput"
					@confirm="handleSearch"
					@focus="onSearchFocus"
				/>
				<view class="search-button" @click="handleSearch">
					<text class="search-button-text">搜索</text>
				</view>
				<view class="favorite-btn" @click="goToFavorite">
					<text class="favorite-icon">❤️</text>
				</view>
			</view>
		</view>
		
		<!-- 搜索面板（点击搜索框时弹出） -->
		<view class="search-panel" v-if="showSearchPanel && !isSearching" @click.stop>
			<view class="suggest-list" v-if="searchKeyword.trim() && searchSuggests.length > 0">
				<text class="panel-title">搜索建议</text>
				<view 
					class="suggest-item" 
					v-for="(item, index) in searchSuggests" 
					:key="index" 
					@click="quickSearch(item.keyword)"
				>
					<text class="suggest-icon">🔍</text>
					<text class="suggest-text">{{ item.keyword }}</text>
				</view>
			</view>
			
			<view class="panel-section" v-if="!searchKeyword.trim() && searchHistory.length > 0">
				<view class="panel-header">
					<text class="panel-title">🕐 搜索历史</text>
					<view class="clear-btn" @click="clearHistory">
						<text class="clear-icon">🗑️</text>
						<text class="clear-text">清除</text>
					</view>
				</view>
				<view class="tag-list">
					<text 
						class="tag-item history-tag" 
						v-for="(item, index) in searchHistory" 
						:key="index" 
						@click="quickSearch(item.keyword)"
					>
						{{ item.keyword }}
					</text>
				</view>
			</view>
			
			<view class="panel-section" v-if="!searchKeyword.trim()">
				<view class="panel-header">
					<text class="panel-title">🔥 热门搜索</text>
					
				</view>
				<view class="tag-list">
					<text 
						class="tag-item hot-tag" 
						v-for="(item, index) in hotKeywords" 
						:key="index" 
						@click="quickSearch(item.keyword)"
					>
						<text class="hot-rank" v-if="index < 3" :class="'rank-' + (index + 1)">{{ index + 1 }}</text>
						{{ item.keyword }}
					</text>
				</view>
				<view v-if="hotKeywords.length === 0" class="empty-text">暂无热搜词</view>
			</view>
		</view>
		
		<!-- 搜索结果页 -->
		<view v-if="isSearching" class="search-page">
			<view class="search-top-bar">
				<view class="back-btn" @click="goBack">
					<text class="back-text">返回</text>
				</view>
				<view class="search-input-small">
					<image class="search-icon-small" src="/static/搜索.png"></image>
					<input 
						class="search-field-small" 
						v-model="searchKeyword" 
						placeholder="搜索商品名称" 
						@confirm="handleSearch"
					/>
				</view>
				<text class="search-btn-text" @click="handleSearch">搜索</text>
			</view>
			
			<view class="search-result-header">
				<text class="search-keyword">搜索"{{ searchedKeyword }}"</text>
				<text class="search-result-count">共 {{ searchResults.length }} 件商品</text>
			</view>
			
			<view v-if="searchResults.length === 0 && !searchLoading" class="no-result">
				<image class="no-result-image" src="/static/搜索.png" mode="aspectFit"></image>
				<text class="no-result-text">未找到相关商品</text>
				<text class="no-result-tip">试试其他关键词吧</text>
			</view>
			
			<scroll-view v-else class="search-results-list" scroll-y>
				<view class="goods-grid">
					<view class="goods-item" v-for="(item, index) in searchResults" :key="index" @click="navigateToDetail(item.id)">
						<image :src="getImageUrl(item.images)" mode="aspectFill"></image>
						<view class="goods-info">
							<text class="goods-name">{{ item.name }}</text>
							<text class="goods-category">{{ item.category }}</text>
							<view class="price-wrapper">
								<text class="goods-price" :class="{ 'discount-price': discountInfo?.isActive }">
									￥{{ getDisplayPrice(item.price) }}
								</text>
								<text class="original-price" v-if="discountInfo?.isActive">
									￥{{ formatPrice(item.price) }}
								</text>
							</view>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>
		
		<!-- 首页内容 -->
		<view v-if="!isSearching">
			<swiper class="banner" indicator-dots="true" autoplay="true" interval="3000" duration="500">
				<swiper-item v-for="(item, index) in banners" :key="index">
					<image :src="item.image" mode="aspectFill"></image>
				</swiper-item>
			</swiper>
			<!-- 打折倒计时 -->
			<view class="discount-banner" v-if="discountInfo">
				<view class="discount-content">
					<text class="discount-icon">🎉</text>
					<view class="discount-center">
						<text class="discount-text" v-if="discountInfo.isActive">
							{{ discountInfo.targetDayName }}狂欢日 全场{{ Math.round(discountInfo.discountRate * 10) }}折！
						</text>
						<text class="discount-text" v-else>
							距离{{ discountInfo.targetDayName }}狂欢日还有
						</text>
						<view class="countdown" v-if="!discountInfo.isActive">
							<view class="countdown-item">
								<text class="countdown-num">{{ discountInfo.countdown.days }}</text>
								<text class="countdown-label">天</text>
							</view>
							<view class="countdown-item">
								<text class="countdown-num">{{ discountInfo.countdown.hours }}</text>
								<text class="countdown-label">小时</text>
							</view>
							<view class="countdown-item">
								<text class="countdown-num">{{ discountInfo.countdown.minutes }}</text>
								<text class="countdown-label">分</text>
							</view>
						</view>
						<view class="countdown" v-else>
							<view class="countdown-item">
								<text class="countdown-num">{{ discountInfo.countdown.hours }}</text>
								<text class="countdown-label">小时</text>
							</view>
							<view class="countdown-item">
								<text class="countdown-num">{{ discountInfo.countdown.minutes }}</text>
								<text class="countdown-label">分</text>
							</view>
							<text class="discount-end-text">后结束</text>
						</view>
					</view>
					<text class="discount-icon">🎉</text>
				</view>
			</view>

			<!-- 秒杀入口 -->
			<view class="seckill-entry" @click="goToSeckill">
				<text class="seckill-icon">⚡</text>
				<view class="seckill-info">
					<text class="seckill-title">限时秒杀</text>
					<text class="seckill-sub">好货低价，手慢无</text>
				</view>
				<text class="seckill-arrow">›</text>
			</view>

			<!-- 商品展示 -->
			<view class="goods-section">
				<view class="section-header">
					<text class="section-title">{{ babyAgeText ? `${babyAgeText}推荐` : '商品' }}</text>
					<text class="section-more" @click="viewAllGoods">更多 </text>
				</view>
				<view class="goods-grid">
					<view class="goods-item" v-for="(item, index) in displayGoods" :key="index" @click="navigateToDetail(item.id)">
						<image :src="getImageUrl(item.images)" mode="aspectFill"></image>
						<text class="item-name">{{ item.name }}</text>
						<view class="price-wrapper">
							<text class="item-price" :class="{ 'discount-price': discountInfo?.isActive }">
								￥{{ getDisplayPrice(item.price) }}
							</text>
							<text class="original-price" v-if="discountInfo?.isActive">
								￥{{ formatPrice(item.price) }}
							</text>
							<text class="item-sales">已售{{ item.sales || 0 }}件</text>
						</view>
					
					</view>
				</view>
			</view>
		</view>
		
		<view class="search-mask" v-if="showSearchPanel && !isSearching" @click="closeSearchPanel"></view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { 
	getGoodsList, getDiscountStatus, 
	getHotKeywords, getSearchHistory, clearSearchHistory, 
	getSearchSuggest, recordSearchKeyword,
	getBabyList, BASE_URL
} from '../../api/index.js'

const discountInfo = ref(null)
const babyAgeText = ref('')

const banners = ref([
	{ id: 1, image: '/static/banner1.png' },
	{ id: 2, image: '/static/banner2.png' },
	{ id: 3, image: '/static/banner3.png' }
])

const allGoods = ref([])
const displayGoods = ref([])

const searchKeyword = ref('')
const searchedKeyword = ref('')
const isSearching = ref(false)
const showSearchPanel = ref(false)
const searchResults = ref([])
const searchLoading = ref(false)
const searchSuggests = ref([])
const hotKeywords = ref([])
const searchHistory = ref([])

let suggestTimer = null

const onSearchFocus = () => {
	showSearchPanel.value = true
	loadSearchHistory()
	loadHotKeywords()
}

const closeSearchPanel = () => { showSearchPanel.value = false }

const onSearchInput = (e) => {
	const keyword = e.detail.value.trim()
	if (!keyword) { searchSuggests.value = []; return }
	clearTimeout(suggestTimer)
	suggestTimer = setTimeout(() => { loadSuggests(keyword) }, 300)
}

const loadSuggests = async (keyword) => {
	try {
		const res = await getSearchSuggest(keyword)
		if (res.code === 200) searchSuggests.value = res.data || []
	} catch (error) {}
}

const loadHotKeywords = async () => {
	try {
		const res = await getHotKeywords()
		if (res.code === 200) hotKeywords.value = res.data || []
	} catch (error) {}
}

const loadSearchHistory = async () => {
	const user = getCurrentUser()
	if (!user) return
	try {
		const res = await getSearchHistory(user.id)
		if (res.code === 200) searchHistory.value = res.data || []
	} catch (error) {}
}

const quickSearch = (keyword) => {
	searchKeyword.value = keyword
	closeSearchPanel()
	handleSearch()
}

const clearHistory = async () => {
	const user = getCurrentUser()
	if (!user) return
	uni.showModal({
		title: '提示',
		content: '确定要清除所有搜索历史吗？',
		success: async (res) => {
			if (res.confirm) {
				try {
					await clearSearchHistory(user.id)
					searchHistory.value = []
					uni.showToast({ title: '已清除', icon: 'success' })
				} catch (error) {}
			}
		}
	})
}

const handleSearch = () => {
	const keyword = searchKeyword.value.trim()
	if (!keyword) { uni.showToast({ title: '请输入搜索关键词', icon: 'none' }); return }
	isSearching.value = true
	showSearchPanel.value = false
	searchedKeyword.value = keyword
	performSearch(keyword)
}

const performSearch = async (keyword) => {
	searchLoading.value = true
	const user = getCurrentUser()
	recordSearchKeyword({ keyword: keyword.trim(), userId: user?.id || null }).catch(() => {})
	try {
		// 检索交给服务端（/goods?name=xxx），前端只负责渲染
		const res = await getGoodsList({ name: keyword.trim(), sort: 'sales_desc' })
		if (res.code === 200) {
			searchResults.value = res.data || []
		} else { searchResults.value = [] }
	} catch (error) { searchResults.value = [] } finally { searchLoading.value = false }
}

const goBack = () => {
	isSearching.value = false
	showSearchPanel.value = false
	searchKeyword.value = ''
	searchResults.value = []
	searchSuggests.value = []
}

const viewAllGoods = () => {
	searchKeyword.value = ''
	isSearching.value = true
	showSearchPanel.value = false
	searchedKeyword.value = '全部商品'
	performSearch('')
}

const loadDiscountStatus = async () => {
	try {
		const res = await getDiscountStatus()
		if (res.code === 200) discountInfo.value = res.data
	} catch (error) {}
}

const getDisplayPrice = (price) => {
	if (discountInfo.value?.isActive) return formatPrice(price * discountInfo.value.discountRate)
	return formatPrice(price)
}

const formatPrice = (price) => Number(price).toFixed(2)

const buildImageUrl = (url) => {
	if (!url) return ''
	if (url.startsWith('http') || url.startsWith('data:')) return url
	return BASE_URL + url
}

const getImageUrl = (images) => {
	if (!images) return '/static/商品.png'
	let first = images
	if (Array.isArray(images)) {
		first = images[0]
	} else if (typeof images === 'string') {
		try {
			const parsed = JSON.parse(images)
			first = Array.isArray(parsed) ? parsed[0] : images
		} catch (e) {
			first = images
		}
	}
	return buildImageUrl(first) || '/static/商品.png'
}

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const goToSeckill = () => {
	uni.navigateTo({ url: '/pages/Seckill/Seckill' })
}

const goToFavorite = () => {
	const user = getCurrentUser()
	if (!user) {
		uni.showModal({
			title: '提示', content: '请先登录',
			success: (res) => { if (res.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) }
		})
		return
	}
	uni.navigateTo({ url: '/pages/Favorite/Favorite' })
}

// ========== 获取婴儿年龄（月龄） ==========
const getBabyAge = async () => {
	const user = getCurrentUser()
	if (!user) return null
	try {
		const res = await getBabyList(user.id)
		if (res.code === 200 && res.data && res.data.length > 0) {
			const baby = res.data[0]  // 取第一个婴儿
			if (baby.birthDate) {
				const birth = new Date(baby.birthDate)
				const now = new Date()
				const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
				return { months, name: baby.name }
			}
		}
	} catch (error) {}
	return null
}

// ========== 根据月龄返回推荐关键词 ==========
const getAgeKeywords = (months) => {
	if (months <= 6) return { keywords: ['奶粉', '奶瓶', '尿布','婴儿车','婴儿床'], text: '0-6个月' }
	if (months <= 12) return { keywords: ['衣服', '裤子'], text: '6-12个月' }
	if (months <= 36) return { keywords: ['玩具', '食品'], text: '1-3岁' }
	return { keywords: ['其他'], text: '3岁以上' }
}

// ========== 加载商品（根据婴儿年龄推荐） ==========
const loadGoods = async () => {
	try {
		const res = await getGoodsList()
		if (res.code === 200) {
			const goodsData = res.data || []
			allGoods.value = goodsData
			
			// 尝试获取婴儿年龄
			const baby = await getBabyAge()
			
			if (baby) {
				const { keywords, text } = getAgeKeywords(baby.months)
				babyAgeText.value = text
				
				// 匹配推荐商品
				const recommended = goodsData.filter(item =>
					keywords.some(k => item.name.includes(k) || item.category.includes(k))
				)
				const rest = goodsData.filter(item => !recommended.includes(item))
				
				// 推荐的排前面，随机补充到8个
				const shuffledRest = shuffleArray([...rest])
				displayGoods.value = [...recommended, ...shuffledRest].slice(0, 8)
			} else {
				// 没有婴儿信息，随机展示
				const shuffled = shuffleArray([...goodsData])
				displayGoods.value = shuffled.slice(0, 8)
			}
		}
	} catch (error) {}
}

const shuffleArray = (array) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

const navigateToDetail = (goodsId) => {
	uni.navigateTo({ url: `/pages/GoodsDetail/GoodsDetail?id=${goodsId}` })
}

onMounted(() => {
	loadDiscountStatus()
	loadGoods()
})
</script>

<style scoped>
.home-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 20rpx; position: relative; }

.search-bar { padding: 20rpx; padding-top: calc(var(--status-bar-height) + 20rpx); background-color: #ffffff; position: sticky; top: 0; z-index: 110; }
.brand-row { display: flex; align-items: center; justify-content: space-between; padding: 2rpx 4rpx 20rpx; }
.brand-lockup { display: flex; align-items: center; gap: 14rpx; }
.brand-mark { width: 76rpx; height: 76rpx; border-radius: 22rpx; overflow: hidden; flex-shrink: 0; background-color: #ffffff; box-shadow: 0 8rpx 18rpx rgba(255, 107, 107, 0.18); }
.brand-text { display: flex; flex-direction: column; }
.brand-name { font-size: 34rpx; line-height: 1.1; font-weight: 800; color: #2f2f2f; letter-spacing: 1rpx; }
.brand-subtitle { margin-top: 3rpx; font-size: 21rpx; line-height: 1.2; color: #999; letter-spacing: 5rpx; }
.brand-slogan { padding: 8rpx 16rpx; border-radius: 22rpx; font-size: 22rpx; color: #ff6b6b; background-color: #fff2ef; }
.search-input { display: flex; align-items: center; background-color: #f0f0f0; border-radius: 40rpx; padding: 10rpx 20rpx; }
.search-icon { width: 32rpx; height: 32rpx; margin-right: 10rpx; }
.search-input-field { font-size: 28rpx; color: #333; flex: 1; }
.search-button { padding: 10rpx 24rpx; background-color: #ff6b6b; border-radius: 30rpx; margin-left: 10rpx; }
.search-button-text { font-size: 24rpx; color: #fff; font-weight: bold; }
.favorite-btn { padding: 10rpx 16rpx; margin-left: 10rpx; }
.favorite-icon { font-size: 36rpx; }

.search-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.4); z-index: 90; }

.search-panel { position: relative; z-index: 100; background-color: #fff; margin: 0 20rpx; border-radius: 0 0 16rpx 16rpx; padding: 20rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1); max-height: 60vh; overflow-y: auto; }
.panel-section { margin-bottom: 25rpx; }
.panel-section:last-child { margin-bottom: 0; }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15rpx; }
.panel-title { font-size: 28rpx; font-weight: bold; color: #333; }
.clear-btn { display: flex; align-items: center; gap: 5rpx; }
.clear-icon { font-size: 24rpx; }
.clear-text { font-size: 24rpx; color: #999; }
.tag-list { display: flex; flex-wrap: wrap; gap: 15rpx; }
.tag-item { padding: 10rpx 24rpx; border-radius: 24rpx; font-size: 26rpx; }
.history-tag { background-color: #f5f5f5; color: #666; }
.hot-tag { background-color: #fff5f5; color: #ff6b6b; }
.hot-rank { font-weight: bold; margin-right: 6rpx; }
.hot-rank.rank-1 { color: #ff0000; }
.hot-rank.rank-2 { color: #ff6600; }
.hot-rank.rank-3 { color: #ff9900; }
.empty-text { text-align: center; padding: 20rpx 0; color: #ccc; font-size: 24rpx; }

.suggest-list { margin-bottom: 20rpx; }
.suggest-item { display: flex; align-items: center; padding: 20rpx 10rpx; border-bottom: 1rpx solid #f5f5f5; }
.suggest-item:last-child { border-bottom: none; }
.suggest-icon { font-size: 28rpx; margin-right: 15rpx; }
.suggest-text { font-size: 28rpx; color: #333; }

.search-page { min-height: 100vh; background-color: #f5f5f5; }
.search-top-bar { display: flex; align-items: center; padding: 15rpx 20rpx; background-color: #fff; gap: 15rpx; position: sticky; top: 0; z-index: 10; }
.back-btn { display: flex; align-items: center; gap: 4rpx; flex-shrink: 0; }
.back-text { font-size: 26rpx; color: #333; }
.search-input-small { flex: 1; display: flex; align-items: center; background-color: #f0f0f0; border-radius: 30rpx; padding: 8rpx 16rpx; }
.search-icon-small { width: 28rpx; height: 28rpx; margin-right: 8rpx; }
.search-field-small { flex: 1; font-size: 26rpx; color: #333; }
.search-btn-text { font-size: 26rpx; color: #ff6b6b; font-weight: bold; flex-shrink: 0; }
.search-result-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background-color: #ffffff; border-bottom: 1rpx solid #f0f0f0; }
.search-keyword { font-size: 28rpx; color: #333; font-weight: bold; }
.search-result-count { font-size: 24rpx; color: #999; }
.search-results-list { padding: 20rpx; }
.no-result { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 150rpx 40rpx; background-color: #ffffff; margin: 20rpx; border-radius: 16rpx; }
.no-result-image { width: 160rpx; height: 160rpx; margin-bottom: 30rpx; opacity: 0.5; }
.no-result-text { font-size: 32rpx; color: #666; margin-bottom: 10rpx; }
.no-result-tip { font-size: 26rpx; color: #999; }

.banner { height: 300rpx; width: 100%; }
.banner image { width: 100%; height: 100%; }

.discount-banner { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); margin: 20rpx; padding: 24rpx 20rpx; border-radius: 16rpx; }
.discount-content { display: flex; align-items: center; justify-content: center; gap: 15rpx; }
.discount-icon { font-size: 36rpx; }
.discount-center { display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.discount-text { font-size: 30rpx; color: #fff; font-weight: bold; }
.discount-end-text { font-size: 24rpx; color: rgba(255,255,255,0.9); margin-left: 10rpx; }
.countdown { display: flex; gap: 15rpx; }
.countdown-item { display: flex; align-items: baseline; gap: 5rpx; }
.countdown-num { font-size: 36rpx; font-weight: bold; color: #fff; background-color: rgba(0,0,0,0.2); padding: 4rpx 14rpx; border-radius: 10rpx; }
.countdown-label { font-size: 22rpx; color: #fff; }

.item-sales {
  font-size: 20rpx;
  color: #999;
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.goods-section { margin-top: 20rpx; background-color: #ffffff; padding: 20rpx; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 32rpx; font-weight: bold; color: #333; }
.section-more { font-size: 24rpx; color: #999; }

.goods-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }
.goods-item { background-color: #f9f9f9; border-radius: 16rpx; padding: 20rpx; position: relative; }
.goods-item image { width: 100%; height: 200rpx; border-radius: 12rpx; margin-bottom: 10rpx; }
.item-name { font-size: 24rpx; color: #333; margin-bottom: 10rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
/* 打折日价格行会多一个划线原价，卡片又只有约 305rpx 宽，
   这里允许换行并锁定各段不压缩，避免「已售0件」被挤成竖排 */
.price-wrapper { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4rpx 8rpx; margin-bottom: 10rpx; }
.item-price { font-size: 28rpx; color: #333; font-weight: bold; flex-shrink: 0; }
.item-price.discount-price { color: #ff6b6b; }
.original-price { font-size: 20rpx; color: #999; text-decoration: line-through; flex-shrink: 0; }



.goods-info { padding: 20rpx; }
.goods-name { font-size: 26rpx; color: #333; margin-bottom: 8rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.goods-category { font-size: 22rpx; color: #999; margin-bottom: 8rpx; }
.goods-price { font-size: 28rpx; color: #333; font-weight: bold; }
.goods-price.discount-price { color: #ff6b6b; }

.seckill-entry { display: flex; align-items: center; margin: 20rpx; padding: 24rpx 20rpx; border-radius: 16rpx; background: linear-gradient(135deg, #2b2b3c, #454559); }
.seckill-icon { font-size: 44rpx; margin-right: 16rpx; }
.seckill-info { flex: 1; display: flex; flex-direction: column; }
.seckill-title { font-size: 30rpx; font-weight: bold; color: #ffd166; }
.seckill-sub { font-size: 22rpx; color: #ccc; margin-top: 4rpx; }
.seckill-arrow { font-size: 40rpx; color: #ffd166; }
</style>