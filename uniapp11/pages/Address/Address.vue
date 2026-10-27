<template>
	<view class="address-page">
		<!-- 顶部导航栏 -->
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">收货地址</text>
			<text class="header-add" @click="navigateToAddAddress">新增</text>
		</view>
		
		<!-- 地址列表 -->
		<scroll-view class="address-list" scroll-y>
			<view v-if="loading" class="loading-container">
				<text>加载中...</text>
			</view>
			
			<view v-else-if="addressList.length === 0" class="empty-container">
				<image class="empty-image" src="/static/地址.png" mode="aspectFit"></image>
				<text class="empty-text">暂无收货地址</text>
				<text class="empty-subtext">添加一个收货地址吧</text>
				<button class="empty-btn" @click="navigateToAddAddress">新增地址</button>
			</view>
			
			<view v-else class="address-items">
				<view 
					class="address-item" 
					v-for="address in addressList" 
					:key="address.id"
					:class="{ 'default-address': address.isDefault }"
				>
					<view class="address-content" @click="selectAddress(address)">
						<view class="address-header-info">
							<text class="address-name">{{ address.name }}</text>
							<text class="address-phone">{{ address.phone }}</text>
							<view v-if="address.isDefault" class="address-default">默认</view>
						</view>
						<text class="address-detail">{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</text>
					</view>
					<view class="address-actions">
						<view class="action-item" @click="editAddress(address)">
							<text class="action-icon">✏️</text>
							<text class="action-text">编辑</text>
						</view>
						<view class="action-item" @click="deleteAddressHandler(address)">
							<text class="action-icon">🗑️</text>
							<text class="action-text">删除</text>
						</view>
						<view v-if="!address.isDefault" class="action-item" @click="setDefaultHandler(address)">
							<text class="action-icon">⭐</text>
							<text class="action-text">设为默认</text>
						</view>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAddressList, deleteAddress, updateAddress } from '../../api/index.js'

// 地址列表
const addressList = ref([])

// 加载状态
const loading = ref(false)

// 当前用户
const currentUser = ref(null)

// 获取当前用户
const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) {
		return null
	}
}

// 加载地址列表
const loadAddressList = async () => {
	const user = getCurrentUser()
	if (!user) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		return
	}
	
	currentUser.value = user
	loading.value = true
	
	try {
		const res = await getAddressList(user.id)
		if (res.code === 200) {
			addressList.value = res.data || []
		}
	} catch (error) {
		console.error('加载地址列表失败:', error)
		uni.showToast({ title: '加载失败', icon: 'none' })
	} finally {
		loading.value = false
	}
}

// 选择地址（返回上一页时使用）
const selectAddress = (address) => {
	// 如果是从订单确认页来的，返回选中的地址
	const pages = getCurrentPages()
	const prevPage = pages[pages.length - 2]
	
	if (prevPage && prevPage.route === 'pages/Orders/OrderConfirm') {
		// 通过事件总线或全局变量传递
		uni.$emit('addressSelected', address)
		uni.navigateBack()
	}
}

// 跳转到新增地址
const navigateToAddAddress = () => {
	uni.navigateTo({
		url: '/pages/Address/AddAddress'
	})
}

// 编辑地址
const editAddress = (address) => {
	uni.navigateTo({
		url: `/pages/Address/AddAddress?id=${address.id}`
	})
}

// 删除地址
const deleteAddressHandler = (address) => {
	uni.showModal({
		title: '确认删除',
		content: '确定要删除这个地址吗？',
		confirmText: '删除',
		confirmColor: '#ff6b6b',
		success: async (res) => {
			if (res.confirm) {
				try {
					const result = await deleteAddress(address.id)
					if (result.code === 200) {
						uni.showToast({ title: '删除成功', icon: 'success' })
						loadAddressList()
					} else {
						uni.showToast({ title: result.message || '删除失败', icon: 'none' })
					}
				} catch (error) {
					uni.showToast({ title: '删除失败', icon: 'none' })
				}
			}
		}
	})
}

// 设为默认地址
const setDefaultHandler = async (address) => {
	try {
		// 先取消其他默认地址
		for (const addr of addressList.value) {
			if (addr.isDefault && addr.id !== address.id) {
				await updateAddress(addr.id, { ...addr, isDefault: false })
			}
		}
		
		// 设置当前地址为默认
		const result = await updateAddress(address.id, { ...address, isDefault: true })
		
		if (result.code === 200) {
			uni.showToast({ title: '已设为默认地址', icon: 'success' })
			loadAddressList()
		} else {
			uni.showToast({ title: result.message || '设置失败', icon: 'none' })
		}
	} catch (error) {
		console.error('设置默认地址失败:', error)
		uni.showToast({ title: '设置失败', icon: 'none' })
	}
}

// 返回上一页
const navigateBack = () => {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack()
	} else {
		uni.switchTab({ url: '/pages/Myhome/Myhome' })
	}
}

onShow(() => {
	loadAddressList()
})

onMounted(() => {
	loadAddressList()
})
</script>

<style scoped>
.address-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f5f5f5;
	overflow: hidden;
}

.page-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx;
	padding-top: calc(var(--status-bar-height) + 30rpx);
	background-color: #ffffff;
	position: sticky;
	top: 0;
	z-index: 10;
	flex-shrink: 0;
}

.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-add { font-size: 28rpx; color: #ff6b6b; font-weight: bold; }

.address-list {
	flex: 1;
	height: 0;
	padding: 20rpx;
	box-sizing: border-box;
}

.loading-container {
	display: flex;
	justify-content: center;
	padding: 100rpx 0;
}

.empty-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 150rpx 0;
}

.empty-image {
	width: 200rpx;
	height: 200rpx;
	opacity: 0.5;
}

.empty-text {
	font-size: 32rpx;
	color: #333;
	font-weight: bold;
	margin-top: 20rpx;
}

.empty-subtext {
	font-size: 24rpx;
	color: #999;
	margin-top: 10rpx;
}

.empty-btn {
	margin-top: 40rpx;
	padding: 20rpx 60rpx;
	background-color: #ff6b6b;
	color: #fff;
	font-size: 28rpx;
	border-radius: 40rpx;
	border: none;
}

.address-item {
	background-color: #ffffff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
	border: 2rpx solid transparent;
}

.address-item.default-address {
	border-color: #ff6b6b;
}

.address-content {
	margin-bottom: 20rpx;
}

.address-header-info {
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin-bottom: 12rpx;
}

.address-name {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
}

.address-phone {
	font-size: 26rpx;
	color: #666;
}

.address-default {
	font-size: 20rpx;
	color: #ff6b6b;
	background-color: #fff0f0;
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
}

.address-detail {
	font-size: 26rpx;
	color: #666;
	line-height: 1.5;
}

.address-actions {
	display: flex;
	justify-content: flex-end;
	gap: 40rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid #f0f0f0;
}

.action-item {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.action-icon {
	font-size: 28rpx;
}

.action-text {
	font-size: 24rpx;
	color: #666;
}
</style>