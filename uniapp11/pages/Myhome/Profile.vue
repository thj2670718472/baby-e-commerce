<template>
	<view class="profile-page">
		<!-- 顶部导航栏 -->
		<view class="profile-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">个人资料</text>
			<text class="header-save" @click="saveProfile">保存</text>
		</view>
		
		<!-- 头像区域 -->
		<view class="avatar-section">
			<view class="avatar-wrapper" @click="changeAvatar">
				<image 
					:key="avatarKey"
					:src="displayAvatar" 
					mode="aspectFill"
					class="avatar-image"
					@error="onImageError"
				></image>
				<view class="avatar-camera">
					<text class="camera-icon">📷</text>
				</view>
			</view>
			<text class="avatar-tip">点击更换头像</text>
		</view>
		
		<!-- 表单区域 -->
		<view class="form-section">
			<view class="form-item">
				<text class="form-label">用户名</text>
				<input 
					v-model="userInfo.username" 
					type="text" 
					placeholder="请输入用户名" 
					class="form-input"
					:disabled="isAdmin"
				/>
			</view>
			<view class="form-item" v-if="isAdmin">
				<text class="form-tip">管理员用户名不可修改</text>
			</view>
			
			<view class="form-item">
				<text class="form-label">手机号</text>
				<input 
					v-model="userInfo.phone" 
					type="text" 
					placeholder="请输入手机号（选填）" 
					class="form-input"
				/>
			</view>
			
			<view class="form-item">
				<text class="form-label">邮箱</text>
				<input 
					v-model="userInfo.email" 
					type="text" 
					placeholder="请输入邮箱（选填）" 
					class="form-input"
				/>
			</view>
		</view>
		
		<!-- 修改密码入口 -->
		<view class="menu-section">
			<view class="menu-item" @click="goToChangePassword">
				
				<text class="menu-text">修改密码</text>
				<text class="menu-arrow">></text>
			</view>
		</view>
		
		<!-- 退出登录按钮 -->
		<view class="logout-section">
			<button class="logout-btn" @click="handleLogout">退出登录</button>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { updateUserProfile, BASE_URL } from '../../api/index.js'

// 用户信息
const userInfo = ref({
	id: '',
	username: '',
	phone: '',
	email: '',
	avatar: ''
})

// 用于强制刷新图片的 key
const avatarKey = ref(0)

// 显示的图片路径
const displayAvatar = ref('/static/人物.png')

// 原始用户信息
const originalUserInfo = ref({})

// 判断是否为管理员
const isAdmin = computed(() => {
	return userInfo.value.role === 'admin'
})

// 图片加载失败时的处理
const onImageError = () => {
	console.log('图片加载失败，使用默认头像')
	displayAvatar.value = '/static/人物.png'
	avatarKey.value++
}

// 加载用户信息
const loadUserInfo = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		console.log('加载用户信息:', userStr)
		if (userStr) {
			const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
			userInfo.value = {
				id: user.id || '',
				username: user.username || '',
				phone: user.phone || '',
				email: user.email || '',
				avatar: user.avatar || '',
				role: user.role === 'admin' ? 'admin' : 'user'
			}
			originalUserInfo.value = { ...userInfo.value }
			updateDisplayAvatar()
		}
	} catch (error) {
		console.error('加载用户信息失败:', error)
		displayAvatar.value = '/static/人物.png'
	}
}

// 更新显示的图片
const updateDisplayAvatar = () => {
	const avatar = userInfo.value.avatar
	console.log('更新显示图片，原始路径:', avatar)
	
	if (!avatar) {
		displayAvatar.value = '/static/人物.png'
	} else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
		displayAvatar.value = avatar
	} else if (avatar.startsWith('/uploads/')) {
		displayAvatar.value = BASE_URL + avatar
	} else if (avatar.startsWith('data:')) {
		displayAvatar.value = avatar
	} else {
		displayAvatar.value = BASE_URL + avatar
	}
	
	avatarKey.value++
	console.log('最终显示路径:', displayAvatar.value)
}

// 更换头像
const changeAvatar = () => {
	uni.chooseImage({
		count: 1,
		sizeType: ['compressed'],
		sourceType: ['album', 'camera'],
		success: (res) => {
			const tempFilePath = res.tempFilePaths[0]
			uploadAvatarToServer(tempFilePath)
		},
		fail: (err) => {
			console.error('选择图片失败:', err)
			uni.showToast({ title: '选择图片失败', icon: 'none' })
		}
	})
}

// 上传头像到服务器
const uploadAvatarToServer = (filePath) => {
	uni.showLoading({ title: '上传中...', mask: true })
	
	console.log('开始上传图片，服务器地址:', BASE_URL + '/upload/image')
	
	uni.uploadFile({
		url: BASE_URL + '/upload/image',
		filePath: filePath,
		name: 'file',
		header: {
			Authorization: `Bearer ${uni.getStorageSync('token') || ''}`
		},
		success: (res) => {
			uni.hideLoading()
			try {
				const data = JSON.parse(res.data)
				if (data.code === 200) {
					const avatarUrl = data.data.url
					saveAvatarToServer(avatarUrl)
				} else {
					uni.showToast({ title: data.message || '上传失败', icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '上传失败，响应格式错误', icon: 'none' })
			}
		},
		fail: (err) => {
			uni.hideLoading()
			uni.showToast({ title: '上传失败，请检查网络', icon: 'none' })
		}
	})
}

// 保存头像URL到服务器
const saveAvatarToServer = async (avatarUrl) => {
	uni.showLoading({ title: '保存中...', mask: true })
	
	try {
		const res = await updateUserProfile({
			oldUsername: originalUserInfo.value.username,
			username: userInfo.value.username,
			phone: userInfo.value.phone,
			email: userInfo.value.email,
			avatar: avatarUrl
		})
		
		uni.hideLoading()
		
		if (res.code === 200) {
			userInfo.value.avatar = avatarUrl
			updateDisplayAvatar()
			
			const userStr = uni.getStorageSync('userInfo')
			if (userStr) {
				const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
				user.avatar = avatarUrl
				uni.setStorageSync('userInfo', JSON.stringify(user))
			}
			
			originalUserInfo.value.avatar = avatarUrl
			
			uni.showToast({ title: '头像已更换', icon: 'success' })
		} else {
			uni.showToast({ title: res.message || '保存失败', icon: 'none' })
		}
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: '网络错误，请重试', icon: 'none' })
	}
}

// 保存个人资料
const saveProfile = async () => {
	if (!userInfo.value.username || userInfo.value.username.trim() === '') {
		uni.showToast({ title: '请输入用户名', icon: 'none' })
		return
	}
	
	userInfo.value.phone = userInfo.value.phone?.trim() || ''
	userInfo.value.email = userInfo.value.email?.trim() || ''
	userInfo.value.username = userInfo.value.username.trim()
	
	uni.showLoading({ title: '保存中...', mask: true })
	
	try {
		const res = await updateUserProfile({
			oldUsername: originalUserInfo.value.username,
			username: userInfo.value.username,
			phone: userInfo.value.phone,
			email: userInfo.value.email,
			avatar: userInfo.value.avatar
		})
		
		uni.hideLoading()
		
		if (res.code === 200) {
			const userStr = uni.getStorageSync('userInfo')
			if (userStr) {
				const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr
				user.username = userInfo.value.username
				user.phone = userInfo.value.phone
				user.email = userInfo.value.email
				user.avatar = userInfo.value.avatar
				uni.setStorageSync('userInfo', JSON.stringify(user))
			}
			
			originalUserInfo.value = { ...userInfo.value }
			
			uni.showToast({ title: '保存成功', icon: 'success' })
			setTimeout(() => uni.navigateBack(), 1500)
		} else {
			uni.showToast({ title: res.message || '保存失败', icon: 'none' })
		}
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: '网络错误，请重试', icon: 'none' })
	}
}

const goToChangePassword = () => {
	uni.navigateTo({ url: '/pages/Myhome/ChangePassword' })
}

const handleLogout = () => {
	uni.showModal({
		title: '提示',
		content: '确定要退出登录吗？',
		confirmText: '退出',
		confirmColor: '#ff6b6b',
		success: (res) => {
			if (res.confirm) {
				uni.removeStorageSync('userInfo')
				uni.removeStorageSync('token')
				uni.showToast({ title: '已退出登录', icon: 'success' })
				setTimeout(() => uni.reLaunch({ url: '/pages/Login/Login' }), 1500)
			}
		}
	})
}

const navigateBack = () => uni.navigateBack()

onMounted(() => loadUserInfo())
</script>

<style scoped>
.profile-page { min-height: 100vh; background-color: #f5f5f5; }
.profile-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-save { font-size: 28rpx; color: #ff6b6b; font-weight: bold; }
.avatar-section { display: flex; flex-direction: column; align-items: center; padding: 60rpx 0 40rpx; background-color: #fff; margin-bottom: 20rpx; }
.avatar-wrapper { position: relative; width: 160rpx; height: 160rpx; }
.avatar-image { width: 160rpx; height: 160rpx; border-radius: 50%; background-color: #f0f0f0; }
.avatar-camera { position: absolute; bottom: 0; right: 0; width: 48rpx; height: 48rpx; background-color: #ff6b6b; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 4rpx solid #fff; }
.camera-icon { font-size: 24rpx; }
.avatar-tip { font-size: 24rpx; color: #999; margin-top: 20rpx; }
.form-section { background-color: #fff; padding: 0 30rpx; margin-bottom: 20rpx; }
.form-item { display: flex; align-items: center; padding: 30rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.form-item:last-child { border-bottom: none; }
.form-label { width: 120rpx; font-size: 28rpx; color: #333; }
.form-input { flex: 1; font-size: 28rpx; color: #333; }
.form-tip { font-size: 24rpx; color: #ff6b6b; padding: 10rpx 0 20rpx 120rpx; }
.menu-section { background-color: #fff; margin-bottom: 20rpx; }
.menu-item { display: flex; align-items: center; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.menu-item:last-child { border-bottom: none; }

.menu-text { flex: 1; font-size: 28rpx; color: #333; }
.menu-arrow { font-size: 28rpx; color: #ccc; }
.logout-section { padding: 40rpx 30rpx; }
.logout-btn { width: 100%; height: 90rpx; background-color: #fff; color: #ff6b6b; font-size: 32rpx; font-weight: bold; border-radius: 45rpx; border: 2rpx solid #ff6b6b; }
</style>