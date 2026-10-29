<template>
	<view class="add-address-page">
		<!-- 顶部导航栏 -->
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">{{ isEdit ? '编辑地址' : '新增地址' }}</text>
			<text class="header-save" @click="saveAddress">保存</text>
		</view>
		
		<!-- 地址表单 -->
		<view class="address-form">
			<view class="form-item">
				<text class="form-label">收货人</text>
				<input 
					v-model="addressForm.name" 
					type="text" 
					placeholder="请输入收货人姓名" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">手机号</text>
				<input 
					v-model="addressForm.phone" 
					type="tel" 
					placeholder="请输入手机号" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">省份</text>
				<input 
					v-model="addressForm.province" 
					type="text" 
					placeholder="请输入省份" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">城市</text>
				<input 
					v-model="addressForm.city" 
					type="text" 
					placeholder="请输入城市" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">区县</text>
				<input 
					v-model="addressForm.district" 
					type="text" 
					placeholder="请输入区县" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">详细地址</text>
				<textarea 
					v-model="addressForm.detail" 
					placeholder="请输入详细地址" 
					class="form-textarea"
					maxlength="100"
				/>
			</view>
			
			<view class="form-item checkbox-item" @click="toggleDefault">
				<text class="form-label">设为默认</text>
				<view class="checkbox">
					<view :class="['checkbox-inner', addressForm.isDefault ? 'checked' : '']"></view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { addAddress, updateAddress, getAddressDetail } from '../../api/index.js'

// 地址ID（编辑模式）
const addressId = ref('')

// 是否编辑模式
const isEdit = ref(false)

// 当前用户
const currentUser = ref(null)

// 地址表单
const addressForm = ref({
	id: '',
	userId: '',
	name: '',
	phone: '',
	province: '',
	city: '',
	district: '',
	detail: '',
	isDefault: false
})

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

// 加载地址详情（编辑模式）
const loadAddressDetail = async () => {
	if (!addressId.value) return
	
	try {
		const res = await getAddressDetail(addressId.value)
		if (res.code === 200) {
			addressForm.value = res.data
		}
	} catch (error) {
		console.error('加载地址详情失败:', error)
		uni.showToast({ title: '加载失败', icon: 'none' })
	}
}

// 切换默认地址
const toggleDefault = () => {
	addressForm.value.isDefault = !addressForm.value.isDefault
}

// 保存地址
const saveAddress = async () => {
	// 验证
	if (!addressForm.value.name) {
		uni.showToast({ title: '请输入收货人姓名', icon: 'none' })
		return
	}
	if (!addressForm.value.phone) {
		uni.showToast({ title: '请输入手机号', icon: 'none' })
		return
	}
	if (!addressForm.value.province || !addressForm.value.city || !addressForm.value.district) {
		uni.showToast({ title: '请填写完整地区信息', icon: 'none' })
		return
	}
	if (!addressForm.value.detail) {
		uni.showToast({ title: '请输入详细地址', icon: 'none' })
		return
	}
	
	const user = getCurrentUser()
	if (!user) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		return
	}
	
	addressForm.value.userId = user.id
	
	uni.showLoading({ title: '保存中...' })
	
	try {
		let res
		if (isEdit.value) {
			res = await updateAddress(addressId.value, addressForm.value)
		} else {
			res = await addAddress(addressForm.value)
		}
		
		uni.hideLoading()
		
		if (res.code === 200) {
			uni.showToast({
				title: isEdit.value ? '编辑成功' : '添加成功',
				icon: 'success'
			})
			setTimeout(() => {
				uni.navigateBack()
			}, 1500)
		} else {
			uni.showToast({ title: res.message || '保存失败', icon: 'none' })
		}
	} catch (error) {
		uni.hideLoading()
		console.error('保存地址失败:', error)
		uni.showToast({ title: '保存失败', icon: 'none' })
	}
}

// 返回上一页
const navigateBack = () => {
	uni.navigateBack()
}

onLoad((options) => {
	addressId.value = options.id
	isEdit.value = !!addressId.value
})

onMounted(() => {
	currentUser.value = getCurrentUser()
	if (isEdit.value) {
		loadAddressDetail()
	}
})
</script>

<style scoped>
.add-address-page {
	min-height: 100vh;
	background-color: #f5f5f5;
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
}

.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-save { font-size: 28rpx; color: #ff6b6b; font-weight: bold; }

.address-form {
	padding: 20rpx;
}

.form-item {
	display: flex;
	align-items: center;
	background-color: #ffffff;
	padding: 24rpx;
	margin-bottom: 20rpx;
	border-radius: 16rpx;
}

.form-label {
	width: 140rpx;
	font-size: 28rpx;
	color: #333;
}

.form-input {
	flex: 1;
	font-size: 28rpx;
	color: #333;
}

.form-textarea {
	flex: 1;
	font-size: 28rpx;
	color: #333;
	min-height: 120rpx;
}

.checkbox-item {
	justify-content: space-between;
}

.checkbox {
	width: 44rpx;
	height: 44rpx;
	border: 2rpx solid #ddd;
	border-radius: 8rpx;
	background-color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
}

.checkbox-inner {
	width: 28rpx;
	height: 28rpx;
	border-radius: 6rpx;
}

.checkbox-inner.checked {
	background-color: #ff6b6b;
	position: relative;
}

.checkbox-inner.checked::after {
	content: '✓';
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	color: #fff;
	font-size: 20rpx;
}
</style>