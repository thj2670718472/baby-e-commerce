<template>
  <div class="baby-status">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>婴儿状况</span>
          <el-button type="primary" @click="saveBabyInfo">保存</el-button>
        </div>
      </template>
      
      <div class="baby-count">
        <el-form-item label="婴儿数量">
          <el-input-number v-model="babyCount" :min="1" :max="5" @change="handleBabyCountChange" />
        </el-form-item>
      </div>
      
      <div v-for="(baby, index) in babies" :key="index" class="baby-form">
        <el-divider content-position="left">婴儿 {{ index + 1 }}</el-divider>
        <el-form :model="baby" label-width="120px">
          <el-form-item label="姓名">
            <el-input v-model="baby.name" placeholder="请输入婴儿姓名" />
          </el-form-item>
          <el-form-item label="出生日期">
            <el-date-picker
              v-model="baby.birthDate"
              type="date"
              placeholder="选择出生日期"
              style="width: 100%"
              @change="calculateAge(index)"
            />
          </el-form-item>
          <el-form-item label="年龄">
            <el-input v-model="baby.age" disabled placeholder="自动计算" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="baby.gender">
              <el-radio label="男">男</el-radio>
              <el-radio label="女">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="身高（cm）">
            <el-input v-model="baby.height" type="number" placeholder="请输入身高" />
          </el-form-item>
          <el-form-item label="体重（kg）">
            <el-input v-model="baby.weight" type="number" placeholder="请输入体重" />
          </el-form-item>
        </el-form>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

// 婴儿数量
const babyCount = ref(1)

// 婴儿信息列表
const babies = ref([
  {
    name: '',
    birthDate: '',
    age: '',
    gender: '男',
    height: '',
    weight: ''
  }
])

// 获取当前用户ID
const getUserId = () => {
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      return user.id || null
    } catch (e) {
      console.error('解析用户信息失败:', e)
      return null
    }
  }
  return null
}

// 处理婴儿数量变化
const handleBabyCountChange = (count) => {
  const currentCount = babies.value.length
  
  if (count > currentCount) {
    // 增加婴儿
    for (let i = currentCount; i < count; i++) {
      babies.value.push({
        name: '',
        birthDate: '',
        age: '',
        gender: '男',
        height: '',
        weight: ''
      })
    }
  } else if (count < currentCount) {
    // 减少婴儿
    babies.value = babies.value.slice(0, count)
  }
}

// 计算年龄
const calculateAge = (index) => {
  const baby = babies.value[index]
  if (!baby.birthDate) {
    baby.age = ''
    return
  }
  
  const birthDate = new Date(baby.birthDate)
  const today = new Date()
  
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  const dayDiff = today.getDate() - birthDate.getDate()
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--
  }
  
  if (age === 0) {
    // 不到1岁，显示月数
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + 
                 (today.getMonth() - birthDate.getMonth())
    if (dayDiff < 0) {
      months--
    }
    if (months === 0) {
      // 不到1个月，显示天数
      let days = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24))
      baby.age = `${days}天`
    } else {
      baby.age = `${months}个月`
    }
  } else {
    baby.age = `${age}岁`
  }
}

// 保存婴儿信息
const saveBabyInfo = async () => {
  // 验证数据
  const valid = babies.value.every((baby, index) => {
    if (!baby.name) {
      ElMessage.error(`请输入婴儿 ${index + 1} 的姓名`)
      return false
    }
    if (!baby.birthDate) {
      ElMessage.error(`请选择婴儿 ${index + 1} 的出生日期`)
      return false
    }
    return true
  })
  
  if (!valid) {
    return
  }
  
  const userId = getUserId()
  if (!userId) {
    ElMessage.error('用户未登录')
    return
  }
  
  try {
    // 保存到数据库
    const response = await request.post('/baby/save', {
      userId,
      babies: babies.value
    })
    
    if (response.code === 200) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error('保存失败: ' + response.message)
    }
  } catch (error) {
    console.error('保存婴儿信息失败:', error)
    ElMessage.error('保存失败，请稍后重试')
  }
}

// 加载保存的婴儿信息
const loadBabyInfo = async () => {
  const userId = getUserId()
  if (!userId) {
    ElMessage.error('用户未登录')
    return
  }
  
  try {
    // 从数据库加载
    const response = await request.get(`/baby/list?userId=${userId}`)
    
    if (response.code === 200 && response.data) {
      const babyList = response.data
      if (babyList.length > 0) {
        babyCount.value = babyList.length
        babies.value = babyList.map(baby => ({
          name: baby.name,
          birthDate: baby.birthDate,
          age: '', // 重新计算年龄
          gender: baby.gender,
          height: baby.height,
          weight: baby.weight
        }))
        
        // 重新计算年龄
        babies.value.forEach((baby, index) => {
          calculateAge(index)
        })
      }
    }
  } catch (error) {
    console.error('加载婴儿信息失败:', error)
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadBabyInfo()
})
</script>

<style scoped>
.baby-status {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.baby-count {
  margin-bottom: 30px;
}

.baby-form {
  margin-bottom: 40px;
}

.el-divider {
  margin: 20px 0;
}

.el-form {
  margin-top: 20px;
}

.el-form-item {
  margin-bottom: 20px;
}
</style>