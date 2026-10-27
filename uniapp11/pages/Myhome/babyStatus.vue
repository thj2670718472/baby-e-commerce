<template>
	<view class="baby-status-page">
		<view class="page-header">
			<text class="header-back" @click="navigateBack">返回</text>
			<text class="header-title">婴儿状况</text>
			<text class="header-save" @click="handleSave">保存</text>
		</view>
		
		<scroll-view class="content" scroll-y>
			<view class="baby-count-section">
				<text class="section-label">婴儿数量</text>
				<view class="count-selector">
					<view class="count-btn" :class="{ disabled: babyCount <= 1 }" @click="decreaseBabyCount">-</view>
					<text class="count-num">{{ babyCount }}</text>
					<view class="count-btn" :class="{ disabled: babyCount >= 5 }" @click="increaseBabyCount">+</view>
				</view>
			</view>
			
			<view class="baby-form-list">
				<view class="baby-form-item" v-for="(baby, index) in babies" :key="index">
					<view class="baby-header">
						<text class="baby-title">婴儿 {{ index + 1 }}</text>
					</view>
					
					<view class="form-item">
						<text class="form-label">姓名</text>
						<input v-model="baby.name" type="text" placeholder="请输入婴儿姓名" class="form-input"/>
					</view>
					
					<view class="form-item">
						<text class="form-label">出生日期</text>
						<picker mode="date" :value="baby.birthDate" :end="today" @change="(e) => onBirthDateChange(index, e)">
							<view class="picker-value">
								<text :class="{ placeholder: !baby.birthDate }">{{ baby.birthDate || '请选择出生日期' }}</text>
								<text class="picker-arrow">📅</text>
							</view>
						</picker>
					</view>
					
					<view class="form-item">
						<text class="form-label">年龄</text>
						<input v-model="baby.age" type="text" class="form-input" disabled placeholder="自动计算"/>
					</view>
					
					<view class="form-item">
						<text class="form-label">性别</text>
						<view class="radio-group">
							<view class="radio-item" :class="{ active: baby.gender === '男' }" @click="baby.gender = '男'">
								<view class="radio-circle"></view>
								<text>男</text>
							</view>
							<view class="radio-item" :class="{ active: baby.gender === '女' }" @click="baby.gender = '女'">
								<view class="radio-circle"></view>
								<text>女</text>
							</view>
						</view>
					</view>
					
					<view class="form-item">
						<text class="form-label">身高(cm)</text>
						<input v-model="baby.height" type="digit" placeholder="请输入身高" class="form-input"/>
					</view>
					
					<view class="form-item">
						<text class="form-label">体重(kg)</text>
						<input v-model="baby.weight" type="digit" placeholder="请输入体重" class="form-input"/>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getBabyList, saveBabyInfo } from '../../api/index.js'

const today = computed(() => {
	const date = new Date()
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
})

const babyCount = ref(1)
const babies = ref([{ name: '', birthDate: '', age: '', gender: '男', height: '', weight: '' }])

const getCurrentUser = () => {
	try {
		const userStr = uni.getStorageSync('userInfo')
		if (!userStr) return null
		return typeof userStr === 'string' ? JSON.parse(userStr) : userStr
	} catch (e) { return null }
}

const increaseBabyCount = () => {
	if (babyCount.value >= 5) { uni.showToast({ title: '最多添加5个婴儿', icon: 'none' }); return }
	babyCount.value++
	babies.value.push({ name: '', birthDate: '', age: '', gender: '男', height: '', weight: '' })
}

const decreaseBabyCount = () => {
	if (babyCount.value <= 1) return
	babyCount.value--
	babies.value.pop()
}

const onBirthDateChange = (index, e) => {
	babies.value[index].birthDate = e.detail.value
	calculateAge(index)
}

const calculateAge = (index) => {
	const baby = babies.value[index]
	if (!baby.birthDate) { baby.age = ''; return }
	const birthDate = new Date(baby.birthDate)
	const todayDate = new Date()
	let ageYears = todayDate.getFullYear() - birthDate.getFullYear()
	const monthDiff = todayDate.getMonth() - birthDate.getMonth()
	const dayDiff = todayDate.getDate() - birthDate.getDate()
	if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ageYears--
	
	if (ageYears === 0) {
		let months = (todayDate.getFullYear() - birthDate.getFullYear()) * 12 + (todayDate.getMonth() - birthDate.getMonth())
		if (dayDiff < 0) months--
		if (months === 0) {
			const days = Math.floor((todayDate - birthDate) / (1000 * 60 * 60 * 24))
			baby.age = `${days}天`
		} else {
			baby.age = `${months}个月`
		}
	} else {
		baby.age = `${ageYears}岁`
	}
}

const handleSave = async () => {
	const user = getCurrentUser()
	if (!user) { uni.showToast({ title: '请先登录', icon: 'none' }); return }
	
	for (let i = 0; i < babies.value.length; i++) {
		const baby = babies.value[i]
		if (!baby.name) { uni.showToast({ title: `请输入婴儿 ${i + 1} 的姓名`, icon: 'none' }); return }
		if (!baby.birthDate) { uni.showToast({ title: `请选择婴儿 ${i + 1} 的出生日期`, icon: 'none' }); return }
	}
	
	uni.showLoading({ title: '保存中...' })
	try {
		const res = await saveBabyInfo({ userId: user.id, babies: babies.value })
		uni.hideLoading()
		if (res.code === 200) {
			uni.showToast({ title: '保存成功', icon: 'success' })
			setTimeout(() => uni.navigateBack(), 1500)
		} else {
			uni.showToast({ title: res.message || '保存失败', icon: 'none' })
		}
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: '保存失败', icon: 'none' })
	}
}

const loadBabyInfo = async () => {
	const user = getCurrentUser()
	if (!user) return
	try {
		const res = await getBabyList(user.id)
		if (res.code === 200 && res.data && res.data.length > 0) {
			const babyList = res.data
			babyCount.value = babyList.length
			babies.value = babyList.map(baby => ({
				name: baby.name || '',
				birthDate: baby.birthDate ? baby.birthDate.split('T')[0] : '',
				age: '',
				gender: baby.gender || '男',
				height: baby.height !== null ? String(baby.height) : '',
				weight: baby.weight !== null ? String(baby.weight) : ''
			}))
			babies.value.forEach((_, idx) => calculateAge(idx))
		}
	} catch (error) {
		console.error('加载婴儿信息失败:', error)
	}
}

const navigateBack = () => uni.navigateBack()

onMounted(() => {
	loadBabyInfo()
})
</script>

<style scoped>
.baby-status-page { min-height: 100vh; background-color: #f5f5f5; padding-bottom: 40rpx; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 30rpx; padding-top: calc(var(--status-bar-height) + 30rpx); background-color: #fff; position: sticky; top: 0; z-index: 10; }
.header-back { font-size: 28rpx; color: #333; }
.header-title { font-size: 36rpx; font-weight: bold; color: #333; }
.header-save { font-size: 28rpx; color: #ff6b6b; font-weight: bold; }
.content { padding: 20rpx; }
.baby-count-section { display: flex; justify-content: space-between; align-items: center; background-color: #fff; padding: 30rpx; border-radius: 16rpx; margin-bottom: 20rpx; }
.section-label { font-size: 28rpx; color: #333; }
.count-selector { display: flex; align-items: center; gap: 30rpx; }
.count-btn { width: 60rpx; height: 60rpx; display: flex; align-items: center; justify-content: center; background-color: #f5f5f5; border-radius: 50%; font-size: 40rpx; color: #333; }
.count-btn.disabled { opacity: 0.3; }
.count-num { font-size: 32rpx; font-weight: bold; color: #333; min-width: 40rpx; text-align: center; }
.baby-form-item { background-color: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 20rpx; }
.baby-header { margin-bottom: 30rpx; padding-bottom: 20rpx; border-bottom: 1rpx solid #f0f0f0; }
.baby-title { font-size: 32rpx; font-weight: bold; color: #ff6b6b; }
.form-item { display: flex; align-items: center; margin-bottom: 30rpx; }
.form-label { width: 140rpx; font-size: 28rpx; color: #333; }
.form-input { flex: 1; font-size: 28rpx; color: #333; padding: 10rpx 0; }
.form-input[disabled] { color: #999; background-color: transparent; }
.picker-value { flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 10rpx 0; }
.picker-value .placeholder { color: #999; }
.picker-arrow { font-size: 28rpx; }
.radio-group { display: flex; gap: 60rpx; }
.radio-item { display: flex; align-items: center; gap: 15rpx; font-size: 28rpx; color: #333; }
.radio-circle { width: 36rpx; height: 36rpx; border: 3rpx solid #ddd; border-radius: 50%; position: relative; }
.radio-item.active .radio-circle { border-color: #ff6b6b; }
.radio-item.active .radio-circle::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20rpx; height: 20rpx; background-color: #ff6b6b; border-radius: 50%; }
</style>