<template>
	<view class="login-page">
		<!-- 顶部logo -->
		<view class="logo-section">
			<image src="/static/闪屏页.png" mode="aspectFit"></image>
			<text class="app-name">母婴商城</text>
		</view>
		
		<!-- 登录/注册表单 -->
		<view class="form-section">
			<view class="form-tabs">
				<view 
					class="tab-item" 
					:class="{ active: activeTab === 'login' }" 
					@click="activeTab = 'login'"
				>
					登录
				</view>
				<view 
					class="tab-item" 
					:class="{ active: activeTab === 'register' }" 
					@click="activeTab = 'register'"
				>
					注册
				</view>
			</view>
			
			<!-- 登录表单 -->
			<view v-if="activeTab === 'login'" class="form-content">
				<view class="form-item">
					<text class="form-label">用户名</text>
					<input 
						v-model="loginForm.username" 
						type="text" 
						placeholder="请输入用户名" 
						class="form-input"
					/>
				</view>
				<view class="form-item">
					<text class="form-label">密码</text>
					<input 
						v-model="loginForm.password" 
						type="password" 
						placeholder="请输入密码" 
						class="form-input"
					/>
				</view>
				<view class="form-actions">
					<text class="forgot-password">忘记密码？</text>
				</view>
				<button 
					class="form-button" 
					@click="login"
					:loading="loading"
					:disabled="loading"
				>
					登录
				</button>
			</view>
			
			<!-- 注册表单 -->
			<view v-else class="form-content">
				<view class="form-item">
					<text class="form-label">用户名</text>
					<input 
						v-model="registerForm.username" 
						type="text" 
						placeholder="请输入用户名" 
						class="form-input"
					/>
				</view>
				<view class="form-item">
					<text class="form-label">密码</text>
					<input 
						v-model="registerForm.password" 
						type="password" 
						placeholder="请输入密码" 
						class="form-input"
					/>
				</view>
				<view class="form-item">
					<text class="form-label">确认密码</text>
					<input 
						v-model="registerForm.confirmPassword" 
						type="password" 
						placeholder="请确认密码" 
						class="form-input"
					/>
				</view>
				<view class="form-item">
					<text class="form-label">手机号</text>
					<input 
						v-model="registerForm.phone" 
						type="tel" 
						placeholder="请输入手机号" 
						class="form-input"
					/>
				</view>
				<view class="form-item">
					<text class="form-label">邮箱</text>
					<input 
						v-model="registerForm.email" 
						type="email" 
						placeholder="请输入邮箱" 
						class="form-input"
					/>
				</view>
				<button 
					class="form-button" 
					@click="register"
					:loading="loading"
					:disabled="loading"
				>
					注册
				</button>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { login as loginApi, register as registerApi } from '../../api/index.js'

// 当前激活的标签
const activeTab = ref('login')

// 加载状态
const loading = ref(false)

// 登录表单数据
const loginForm = ref({
	username: '',
	password: ''
})

// 注册表单数据
const registerForm = ref({
	username: '',
	password: '',
	confirmPassword: '',
	phone: '',
	email: ''
})

// 登录
const login = async () => {
	if (!loginForm.value.username || !loginForm.value.password) {
		uni.showToast({
			title: '请填写用户名和密码',
			icon: 'none'
		})
		return
	}
	
	loading.value = true
	try {
		const res = await loginApi(loginForm.value)
		if (res.code === 200) {
			uni.showToast({
				title: '登录成功',
				icon: 'success'
			})
			// 保存用户信息到本地存储
			uni.setStorageSync('userInfo', res.data)
			uni.setStorageSync('token', res.token || (res.data && res.data.token) || '')
			// 跳转到首页
			uni.switchTab({
				url: '/pages/Home/Home'
			})
		} else {
			uni.showToast({
				title: res.message || '登录失败',
				icon: 'none'
			})
		}
	} catch (error) {
		uni.showToast({
			title: '网络错误，请稍后重试',
			icon: 'none'
		})
	} finally {
		loading.value = false
	}
}

// 注册
const register = async () => {
	if (!registerForm.value.username || !registerForm.value.password) {
		uni.showToast({
			title: '请填写用户名和密码',
			icon: 'none'
		})
		return
	}
	
	if (registerForm.value.password !== registerForm.value.confirmPassword) {
		uni.showToast({
			title: '两次输入的密码不一致',
			icon: 'none'
		})
		return
	}
	
	loading.value = true
	try {
		const res = await registerApi(registerForm.value)
		if (res.code === 200) {
			uni.showToast({
				title: '注册成功',
				icon: 'success'
			})
			// 切换到登录标签
			activeTab.value = 'login'
			// 填充用户名到登录表单
			loginForm.value.username = registerForm.value.username
		} else {
			uni.showToast({
				title: res.message || '注册失败',
				icon: 'none'
			})
		}
	} catch (error) {
		uni.showToast({
			title: '网络错误，请稍后重试',
			icon: 'none'
		})
	} finally {
		loading.value = false
	}
}
</script>

<style scoped>
.login-page {
	min-height: 100vh;
	background-color: #f5f5f5;
	padding: 60rpx 30rpx;
}

/* 顶部logo */
.logo-section {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 60rpx;
}

.logo-section image {
	width: 200rpx;
	height: 200rpx;
	margin-bottom: 20rpx;
}

.app-name {
	font-size: 36rpx;
	font-weight: bold;
	color: #333333;
}

/* 登录/注册表单 */
.form-section {
	background-color: #ffffff;
	border-radius: 20rpx;
	padding: 40rpx 30rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.form-tabs {
	display: flex;
	border-bottom: 2rpx solid #f0f0f0;
	margin-bottom: 40rpx;
}

.tab-item {
	flex: 1;
	text-align: center;
	padding: 20rpx 0;
	font-size: 28rpx;
	color: #999999;
	position: relative;
}

.tab-item.active {
	color: #ff6b6b;
	font-weight: bold;
}

.tab-item.active::after {
	content: '';
	position: absolute;
	bottom: -2rpx;
	left: 25%;
	width: 50%;
	height: 4rpx;
	background-color: #ff6b6b;
}

.form-content {
	margin-bottom: 20rpx;
}

.form-item {
	margin-bottom: 30rpx;
}

.form-label {
	display: block;
	font-size: 24rpx;
	color: #333333;
	margin-bottom: 10rpx;
}

.form-input {
	width: 100%;
	padding: 20rpx;
	border: 2rpx solid #f0f0f0;
	border-radius: 10rpx;
	font-size: 24rpx;
	color: #333333;
}

.form-actions {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 40rpx;
}

.forgot-password {
	font-size: 24rpx;
	color: #ff6b6b;
}

.form-button {
	width: 100%;
	height: 80rpx;
	background-color: #ff6b6b;
	color: #ffffff;
	font-size: 32rpx;
	font-weight: bold;
	border-radius: 40rpx;
	border: none;
	margin-top: 20rpx;
}

</style>