<template>
	<view class="shop-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">积分商城</text>
			<text class="header-points">{{ points }} 分</text>
		</view>

		<view class="notice-bar">
			<text class="notice-text">积分兑换好物，默认地址发货</text>
			<text class="notice-link" @click="goExchangeRecords">兑换记录 ></text>
		</view>

		<view class="goods-grid" v-if="goodsList.length > 0">
			<view class="goods-card" v-for="item in goodsList" :key="item.id" @click="goToDetail(item)">
				<image class="goods-image" :src="getImageUrl(item.image)" mode="aspectFill"></image>
				<view class="goods-body">
					<view class="goods-title-row">
						<text class="goods-name">{{ item.name }}</text>
						<text class="detail-arrow">详情 ›</text>
					</view>
					<text class="goods-desc" v-if="item.description">{{ item.description }}</text>

					<view class="goods-footer">
						<view class="points-box">
							<text class="points-num">{{ item.points }}</text>
							<text class="points-unit">积分</text>
						</view>
						<text class="stock-text">库存 {{ item.stock }}</text>
					</view>

					<button
						class="exchange-btn"
						:class="{ disabled: !canExchange(item) }"
						:disabled="!canExchange(item)"
						@click.stop="openModal(item)"
					>
						{{ item.stock <= 0 ? '已兑完' : (points < item.points ? '积分不足' : '立即兑换') }}
					</button>
				</view>
			</view>
		</view>

		<view v-else-if="!loading" class="empty-state">
			<text class="empty-text">暂无可兑换商品</text>
			<text class="empty-tip">先去逛逛，攒点积分吧</text>
		</view>

		<view class="modal-mask" v-if="exchangeTarget" @click="closeModal">
			<view class="modal" @click.stop>
				<text class="modal-title">确认兑换</text>

				<view class="modal-row">
					<text class="modal-label">商品</text>
					<text class="modal-value">{{ exchangeTarget.name }}</text>
				</view>

				<view class="modal-row">
					<text class="modal-label">数量</text>
					<view class="qty-control">
						<text class="qty-btn" @click="changeQuantity(-1)">-</text>
						<text class="qty-value">{{ quantity }}</text>
						<text class="qty-btn" @click="changeQuantity(1)">+</text>
					</view>
				</view>

				<view class="modal-row">
					<text class="modal-label">消耗积分</text>
					<text class="modal-value highlight">{{ exchangeTarget.points * quantity }}</text>
				</view>

				<text class="modal-tip">兑换后将按默认收货地址发货</text>

				<view class="modal-actions">
					<button class="modal-btn cancel" @click="closeModal">取消</button>
					<button class="modal-btn confirm" :disabled="submitting" @click="confirmExchange">
						{{ submitting ? '提交中...' : '确认兑换' }}
					</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getPointsShop, exchangePointsGoods, getUserPoints, BASE_URL } from '../../api/index.js'

const goodsList = ref([])
const points = ref(0)
const loading = ref(false)
const submitting = ref(false)
const exchangeTarget = ref(null)
const quantity = ref(1)

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const getImageUrl = (image) => {
	if (!image) return '/static/商品.png'
	if (image.startsWith('http') || image.startsWith('data:')) return image
	return BASE_URL + image
}

const canExchange = (item) => Number(item.stock) > 0 && Number(points.value) >= Number(item.points)

const loadPoints = async () => {
	const user = getCurrentUser()
	if (!user) return
	try {
		const res = await getUserPoints(user.id)
		if (res.code === 200) points.value = res.data.points || 0
	} catch (error) {}
}

const loadGoods = async () => {
	loading.value = true
	try {
		const res = await getPointsShop()
		if (res.code === 200) goodsList.value = res.data || []
	} catch (error) {
		goodsList.value = []
	} finally {
		loading.value = false
	}
}

const goToDetail = (item) => {
	uni.navigateTo({ url: `/pages/Points/Detail?id=${item.id}` })
}

const openModal = (item) => {
	if (!getCurrentUser()) {
		uni.showModal({
			title: '提示',
			content: '请先登录',
			success: (res) => { if (res.confirm) uni.navigateTo({ url: '/pages/Login/Login' }) }
		})
		return
	}
	if (!canExchange(item)) return
	exchangeTarget.value = item
	quantity.value = 1
}

const closeModal = () => {
	exchangeTarget.value = null
}

const changeQuantity = (step) => {
	if (!exchangeTarget.value) return
	const max = Math.min(99, Number(exchangeTarget.value.stock) || 1)
	const next = quantity.value + step
	if (next < 1 || next > max) return
	quantity.value = next
}

const confirmExchange = async () => {
	if (!exchangeTarget.value || submitting.value) return

	const user = getCurrentUser()
	if (!user) return

	const totalPoints = Number(exchangeTarget.value.points) * quantity.value
	if (points.value < totalPoints) {
		uni.showToast({ title: '积分不足', icon: 'none' })
		return
	}

	submitting.value = true
	try {
		const res = await exchangePointsGoods({
			userId: user.id,
			pointsGoodsId: exchangeTarget.value.id,
			quantity: quantity.value
		})

		if (res.code === 200) {
			uni.showToast({ title: '兑换成功', icon: 'success' })
			closeModal()
			await Promise.all([loadPoints(), loadGoods()])
		} else {
			uni.showToast({ title: res.message || '兑换失败', icon: 'none' })
		}
	} catch (error) {
		uni.showToast({ title: '兑换失败', icon: 'none' })
	} finally {
		submitting.value = false
	}
}

const goExchangeRecords = () => {
	uni.navigateTo({ url: '/pages/Points/ExchangeRecords' })
}

const navigateBack = () => uni.navigateBack()

onMounted(() => {
	loadPoints()
	loadGoods()
})
</script>

<style scoped>
.shop-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 40rpx; }

.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; }
.header-points { font-size: 26rpx; color: #ff6b6b; font-weight: bold; }

.notice-bar { display: flex; justify-content: space-between; align-items: center; margin: 20rpx; padding: 20rpx 24rpx; background-color: #fff5f5; border-radius: 12rpx; }
.notice-text { font-size: 24rpx; color: #ff6b6b; }
.notice-link { font-size: 24rpx; color: #999; }

.goods-grid { display: flex; flex-wrap: wrap; padding: 0 15rpx; }
.goods-card { width: 335rpx; margin: 0 10rpx 20rpx; background-color: #fff; border-radius: 16rpx; overflow: hidden; }
.goods-image { width: 335rpx; height: 300rpx; background-color: #f5f5f5; }
.goods-body { padding: 20rpx; }
.goods-title-row { display: flex; align-items: center; justify-content: space-between; gap: 10rpx; }
.goods-name { flex: 1; font-size: 28rpx; color: #333; font-weight: bold; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-arrow { flex-shrink: 0; font-size: 21rpx; color: #ff8e8e; }
.goods-desc { font-size: 22rpx; color: #999; margin-top: 8rpx; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.goods-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16rpx; }
.points-box { display: flex; align-items: baseline; }
.points-num { font-size: 36rpx; color: #ff6b6b; font-weight: bold; }
.points-unit { font-size: 22rpx; color: #ff6b6b; margin-left: 4rpx; }
.stock-text { font-size: 22rpx; color: #bbb; }

.exchange-btn { margin-top: 16rpx; height: 64rpx; line-height: 64rpx; font-size: 26rpx; color: #fff; background: linear-gradient(135deg, #ff6b6b, #ff8e8e); border-radius: 32rpx; border: none; }
.exchange-btn::after { border: none; }
.exchange-btn.disabled { background: #dcdcdc; color: #fff; }

.empty-state { display: flex; flex-direction: column; align-items: center; padding-top: 200rpx; }
.empty-text { font-size: 28rpx; color: #999; }
.empty-tip { font-size: 24rpx; color: #ccc; margin-top: 12rpx; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 99; }
.modal { width: 580rpx; background-color: #fff; border-radius: 20rpx; padding: 40rpx 30rpx 30rpx; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; display: block; text-align: center; margin-bottom: 30rpx; }
.modal-row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; }
.modal-label { font-size: 26rpx; color: #999; }
.modal-value { font-size: 26rpx; color: #333; max-width: 380rpx; text-align: right; }
.modal-value.highlight { color: #ff6b6b; font-weight: bold; font-size: 32rpx; }

.qty-control { display: flex; align-items: center; }
.qty-btn { width: 52rpx; height: 52rpx; line-height: 48rpx; text-align: center; border: 1rpx solid #ddd; border-radius: 8rpx; font-size: 32rpx; color: #666; }
.qty-value { min-width: 70rpx; text-align: center; font-size: 28rpx; color: #333; }

.modal-tip { font-size: 22rpx; color: #bbb; text-align: center; margin-top: 20rpx; }
.modal-actions { display: flex; gap: 20rpx; margin-top: 30rpx; }
.modal-btn { flex: 1; height: 76rpx; line-height: 76rpx; border-radius: 38rpx; font-size: 28rpx; border: none; }
.modal-btn::after { border: none; }
.modal-btn.cancel { background-color: #f5f5f5; color: #666; }
.modal-btn.confirm { background: linear-gradient(135deg, #ff6b6b, #ff8e8e); color: #fff; }
</style>
