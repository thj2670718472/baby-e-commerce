<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div class="absolute top-40 left-40 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
    </div>

    <!-- 登录卡片 -->
    <div class="relative w-full max-w-md">
      <!-- Logo和标题 -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white mb-4 shadow-lg">
          <el-icon :size="40"><Lock /></el-icon>
        </div>
        <h2 class="text-3xl font-bold text-gray-900 mb-2">欢迎回来</h2>
        <p class="text-gray-500">请输入您的账号密码登录系统</p>
      </div>

      <!-- 登录表单卡片 -->
      <el-card class="border-0 shadow-2xl backdrop-blur-sm bg-white/90">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-position="top"
          class="p-6"
          @keyup.enter="handleSubmit"
        >
          <!-- 账号输入 -->
          <el-form-item label="账号" prop="username">
            <el-input
              v-model="formData.username"
              placeholder="请输入账号/邮箱"
              :prefix-icon="User"
              size="large"
              class="custom-input"
            />
          </el-form-item>

          <!-- 密码输入 -->
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="formData.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              size="large"
              show-password
              class="custom-input"
            />
          </el-form-item>
        

          <!-- 记住密码和忘记密码 -->
          <div class="flex items-center justify-between mb-6">
            <el-checkbox v-model="rememberPassword" size="large">记住密码</el-checkbox>
            <el-link type="primary" underline="never" class="text-sm">忘记密码？</el-link>
          </div>

          <!-- 登录按钮 -->
          <el-button
            type="primary"
            size="large"
            class="w-full !bg-gradient-to-r !from-blue-600 !to-purple-600 border-0 hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
            :loading="loading"
            @click="handleSubmit"
          >
            登 录
          </el-button>       

          <!-- 注册链接 -->
          <div class="text-center mt-6">
            <el-button
            type="primary"
            size="large"
            class="w-full !bg-gradient-to-r !from-blue-600 !to-purple-600 border-0 hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
            @click="goToRegister"
          >
            注册新账号
          </el-button> 
            <!-- <span class="text-gray-500 text-sm">还没有账号？</span> -->
            <!-- <el-link type="primary" underline="never" class="ml-1">立即注册</el-link> -->
          </div>
        </el-form>
      </el-card>

      <!-- 底部信息 -->
      <div class="text-center mt-8 text-sm text-gray-400">
        © 2024 公司名称. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
// 路由实例
const router = useRouter()
import UserAPI  from '@/api/user'
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, ChatDotRound, Platform, Message } from '@element-plus/icons-vue'

// 表单数据
const formData = reactive({
  username: '',
  password: ''  
})

// 表单引用
const formRef = ref(null)
const loading = ref(false)
const rememberPassword = ref(false)

// 表单验证规则
const formRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
  ]
}

// 处理登录
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    console.log('test',formData)
    // 模拟登录请求
    //await new Promise(resolve => setTimeout(resolve, 1500))
    let rtn= await UserAPI.login(formData)
    console.log('rtn',rtn)
    if (rtn.code==200){
       ElMessage.success('登录成功！')
       // 这里可以跳转到首页
        router.push('/main')
        //ElMessage.success('跳转到首页')
    } 
    
  } catch (error) {
    if (error.message) {
      ElMessage.error('登录失败：' + error.message)
    }
  } finally {
    loading.value = false
  }
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/register')
}

</script>

<style scoped>
/* 自定义动画 */
@keyframes blob {
  0% {
    transform: translate(0px, 0px) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
  100% {
    transform: translate(0px, 0px) scale(1);
  }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}

/* 自定义输入框样式 */
:deep(.custom-input .el-input__wrapper) {
  @apply shadow-sm hover:shadow-md transition-shadow;
}

:deep(.custom-input .el-input__inner) {
  @apply h-12;
}

/* 自定义卡片样式 */
:deep(.el-card) {
  @apply backdrop-blur-sm bg-white/90 border-0;
}

/* 自定义按钮样式 */
:deep(.el-button--primary) {
  @apply h-12 text-base font-medium;
}

/* 响应式调整 */
@media (max-width: 640px) {
  :deep(.el-form-item) {
    @apply mb-4;
  }
}
</style>
