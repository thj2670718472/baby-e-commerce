<template>
	<view class="change-password-page">
		<!-- 顶部导航栏 -->
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">修改密码</text>
			<text class="header-placeholder"></text>
		</view>
		
		<!-- 表单区域 -->
		<view class="form-section">
			<view class="form-item">
				<text class="form-label">旧密码</text>
				<input 
					v-model="formData.oldPassword" 
					:type="showOldPassword ? 'text' : 'password'"
					placeholder="请输入旧密码" 
					class="form-input"
				/>
				<text class="eye-icon" @click="showOldPassword = !showOldPassword">
					{{ showOldPassword ? '👁️' : '👁️‍🗨️' }}
				</text>
			</view>
			
			<view class="form-item">
				<text class="form-label">新密码</text>
				<input 
					v-model="formData.newPassword" 
					:type="showNewPassword ? 'text' : 'password'"
					placeholder="请输入新密码（至少6位）" 
					class="form-input"
				/>
				<text class="eye-icon" @click="showNewPassword = !showNewPassword">
					{{ showNewPassword ? '👁️' : '👁️‍🗨️' }}
				</text>
			</view>
			
			<view class="form-item">
				<text class="form-label">确认密码</text>
				<input 
					v-model="formData.confirmPassword" 
					:type="showConfirmPassword ? 'text' : 'password'"
					placeholder="请确认新密码" 
					class="form-input"
				/>
				<text class="eye-icon" @click="showConfirmPassword = !showConfirmPassword">
					{{ showConfirmPassword ? '👁️' : '👁️‍🗨️' }}
				</text>
			</view>
		</view>
		
		<!-- 密码规则提示 -->
		<view class="tips-section">
			<text class="tips-title">密码规则：</text>
			<text class="tips-item">• 长度至少6位</text>
			<text class="tips-item">• 新密码不能与旧密码相同</text>
		</view>
		
		<!-- 确认按钮 -->
		<view class="button-section">
			<button 
				class="submit-btn" 
				@click="handleSubmit"
				:loading="loading"
				:disabled="loading"
			>
				确认修改
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { changePassword } from '../../api/index.js'

// 表单数据
const formData = ref({
	oldPassword: '',
	newPassword: '',
	confirmPassword: ''
})

// 密码显示状态
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

// 加载状态
const loading = ref(false)

// 提交修改
const handleSubmit = async () => {
	// 验证旧密码
	if (!formData.value.oldPassword) {
		uni.showToast({
			title: '请输入旧密码',
			icon: 'none'
		})
		return
	}
	
	// 验证新密码
	if (!formData.value.newPassword) {
		uni.showToast({
			title: '请输入新密码',
			icon: 'none'
		})
		return
	}
	
	// 验证密码长度
	if (formData.value.newPassword.length < 6) {
		uni.showToast({
			title: '新密码长度至少为6位',
			icon: 'none'
		})
		return
	}
	
	// 验证新旧密码不能相同
	if (formData.value.oldPassword === formData.value.newPassword) {
		uni.showToast({
			title: '新密码不能与旧密码相同',
			icon: 'none'
		})
		return
	}
	
	// 验证确认密码
	if (formData.value.newPassword !== formData.value.confirmPassword) {
		uni.showToast({
			title: '两次输入的密码不一致',
			icon: 'none'
		})
		return
	}
	
	// 获取用户名
	const userStr = uni.getStorageSync('userInfo')
	if (!userStr) {
		uni.showToast({
			title: '请先登录',
			icon: 'none'
		})
		// 跳转到登录页
		setTimeout(() => {
			uni.reLaunch({
				url: '/pages/Login/Login'
			})
		}, 1500)
		return
	}
	
	let user
	try {
		user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) {
		console.error('解析用户信息失败:', e)
		uni.showToast({
			title: '用户信息错误，请重新登录',
			icon: 'none'
		})
		setTimeout(() => {
			uni.reLaunch({
				url: '/pages/Login/Login'
			})
		}, 1500)
		return
	}
	
	if (!user.username) {
		uni.showToast({
			title: '用户名不存在，请重新登录',
			icon: 'none'
		})
		setTimeout(() => {
			uni.reLaunch({
				url: '/pages/Login/Login'
			})
		}, 1500)
		return
	}
	
	// 显示加载中
	uni.showLoading({
		title: '修改中...',
		mask: true
	})
	
	loading.value = true
	
	try {
		const res = await changePassword({
			username: user.username,
			oldPassword: formData.value.oldPassword,
			newPassword: formData.value.newPassword
		})
		
		uni.hideLoading()
		
		if (res.code === 200) {
			uni.showToast({
				title: '密码修改成功，请重新登录',
				icon: 'success',
				duration: 2000
			})
			
			// 清除本地存储（只有修改密码成功才清除）
			uni.removeStorageSync('userInfo')
			uni.removeStorageSync('token')
			
			// 跳转到登录页
			setTimeout(() => {
				uni.reLaunch({
					url: '/pages/Login/Login'
				})
			}, 2000)
		} else {
			uni.showToast({
				title: res.message || '密码修改失败',
				icon: 'none'
			})
		}
	} catch (error) {
		uni.hideLoading()
		console.error('修改密码失败:', error)
		uni.showToast({
			title: '网络错误，请重试',
			icon: 'none'
		})
	} finally {
		loading.value = false
	}
}

// 返回上一页
const navigateBack = () => {
	uni.navigateBack()
}
</script>

<style scoped>
.change-password-page {
	min-height: 100vh;
	background-color: #f5f5f5;
}

/* 顶部导航栏 */
.page-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx 30rpx;
	background-color: #ffffff;
	position: sticky;
	top: 0;
	z-index: 10;
	box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.header-back {
	font-size: 28rpx;
	color: #333333;
}

.header-title {
	font-size: 36rpx;
	font-weight: bold;
	color: #333333;
}

.header-placeholder {
	width: 60rpx;
}

/* 表单区域 */
.form-section {
	background-color: #ffffff;
	padding: 0 30rpx;
	margin-top: 20rpx;
	margin-bottom: 20rpx;
	border-radius: 16rpx;
}

.form-item {
	display: flex;
	align-items: center;
	padding: 30rpx 0;
	border-bottom: 1rpx solid #f0f0f0;
}

.form-item:last-child {
	border-bottom: none;
}

.form-label {
	width: 140rpx;
	font-size: 28rpx;
	color: #333333;
	font-weight: 500;
}

.form-input {
	flex: 1;
	font-size: 28rpx;
	color: #333333;
	padding: 10rpx 0;
}

.form-input::placeholder {
	color: #cccccc;
}

.eye-icon {
	font-size: 36rpx;
	padding: 10rpx;
	color: #999999;
}

/* 提示区域 */
.tips-section {
	padding: 20rpx 30rpx;
	background-color: transparent;
}

.tips-title {
	display: block;
	font-size: 26rpx;
	color: #666666;
	margin-bottom: 15rpx;
	font-weight: 500;
}

.tips-item {
	display: block;
	font-size: 24rpx;
	color: #999999;
	line-height: 1.8;
}

/* 按钮区域 */
.button-section {
	padding: 60rpx 30rpx;
}

.submit-btn {
	width: 100%;
	height: 90rpx;
	background-color: #ff6b6b;
	color: #ffffff;
	font-size: 32rpx;
	font-weight: bold;
	border-radius: 45rpx;
	border: none;
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 107, 0.3);
}

.submit-btn:active {
	opacity: 0.8;
	transform: scale(0.98);
}

.submit-btn[disabled] {
	opacity: 0.6;
}
</style>