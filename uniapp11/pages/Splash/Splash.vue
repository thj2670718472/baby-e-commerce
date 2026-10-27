<template>
	<view class="splash">
		<!-- 全屏背景图片 -->
		<image class="bg-image" src="/static/闪屏页.png" mode="aspectFill"></image>
		
		<!-- 文字内容浮层 -->
		<view class="content-overlay">
			<!-- 上方文字区域 -->
			<view class="top-text-area">
				<text class="top-title">母婴频道闪亮登场</text>
				<text class="top-subtitle">给关爱baby的你</text>
			</view>
			
			
			
			<!-- 下方文字区域 -->
			<view class="bottom-text-area">
				<text class="bottom-slogan">关爱宝宝健康成长</text>
				<view class="loading-dots">
					<view class="dot"></view>
					<view class="dot"></view>
					<view class="dot"></view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
	const timer = setTimeout(() => {
		uni.switchTab({
			url: '/pages/Home/Home',
			fail: () => {
				uni.reLaunch({
					url: '/pages/Home/Home'
				})
			}
		})
	}, 3000)
	
	return () => clearTimeout(timer)
})
</script>

<style scoped>
.splash {
	width: 100%;
	height: 100vh;
	position: relative;
	overflow: hidden;
}

/* 全屏背景图片 */
.bg-image {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
}

/* 文字浮层 */
.content-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	align-items: center;
	z-index: 2;
	padding: 80rpx 0 100rpx 0;
	box-sizing: border-box;
	background-color: rgba(0, 0, 0, 0.2); /* 可选：添加半透明遮罩让文字更清晰 */
}

/* 上方文字区域 */
.top-text-area {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.top-title {
	font-size: 48rpx;
	color: #FFFFFF;
	font-weight: bold;
	letter-spacing: 4rpx;
	margin-bottom: 20rpx;
	text-shadow: 2rpx 2rpx 4rpx rgba(0, 0, 0, 0.3);
}

.top-subtitle {
	font-size: 28rpx;
	color: #FFFFFF;
	opacity: 0.95;
	letter-spacing: 2rpx;
	text-shadow: 1rpx 1rpx 2rpx rgba(0, 0, 0, 0.3);
}


.brand-name {
	font-size: 52rpx;
	color: #FFFFFF;
	font-weight: bold;
	letter-spacing: 4rpx;
	text-shadow: 2rpx 2rpx 4rpx rgba(0, 0, 0, 0.3);
}

/* 下方文字区域 */
.bottom-text-area {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

.bottom-slogan {
	font-size: 28rpx;
	color: #FFFFFF;
	opacity: 0.9;
	letter-spacing: 2rpx;
	margin-bottom: 40rpx;
	text-shadow: 1rpx 1rpx 2rpx rgba(0, 0, 0, 0.3);
}

.loading-dots {
	display: flex;
	gap: 20rpx;
}

.dot {
	width: 16rpx;
	height: 16rpx;
	background-color: rgba(255, 255, 255, 0.9);
	border-radius: 50%;
	animation: pulse 1.5s ease-in-out infinite;
}

.dot:nth-child(1) {
	animation-delay: 0s;
}

.dot:nth-child(2) {
	animation-delay: 0.3s;
}

.dot:nth-child(3) {
	animation-delay: 0.6s;
}

@keyframes bounce {
	0% {
		transform: scale(0.8);
		opacity: 0;
	}
	50% {
		transform: scale(1.1);
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}

@keyframes pulse {
	0%, 100% {
		transform: scale(0.8);
		opacity: 0.3;
	}
	50% {
		transform: scale(1.2);
		opacity: 1;
	}
}
</style>