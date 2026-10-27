<template>
  <div class="change-password-container">
    <el-card shadow="never" class="change-password-card">
      <template #header>
        <div class="card-header">
          <span>修改密码</span>
        </div>
      </template>
      
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="120px" class="change-password-form">
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input v-model="formData.oldPassword" type="password" placeholder="请输入旧密码" />
        </el-form-item>
        
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="formData.newPassword" type="password" placeholder="请输入新密码" />
        </el-form-item>
        
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="formData.confirmPassword" type="password" placeholder="请确认新密码" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">确认修改</el-button>
          <el-button @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import userAPI from '@/api/user'
import { useRouter } from 'vue-router'

const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const formData = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 验证新密码不能与旧密码相同
const validateNewPassword = (rule, value, callback) => {
  if (value && formData.oldPassword && value === formData.oldPassword) {
    callback(new Error('新密码不能与旧密码相同'))
  } else {
    callback()
  }
}

// 验证确认密码
const validateConfirmPassword = (rule, value, callback) => {
  if (value && value !== formData.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const formRules = {
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度至少为6位', trigger: 'blur' },
    { validator: validateNewPassword, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 确认修改
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    // 表单验证
    await formRef.value.validate()
    
    submitting.value = true
    
    // 获取当前登录用户信息
    const userStr = sessionStorage.getItem('user')
    if (!userStr) {
      ElMessage.error('用户未登录，请重新登录')
      router.push('/login')
      return
    }
    
    let user
    try {
      user = JSON.parse(userStr)
    } catch (error) {
      console.error('解析用户信息失败:', error)
      ElMessage.error('用户信息格式错误，请重新登录')
      router.push('/login')
      return
    }
    
    if (!user.username) {
      ElMessage.error('用户名不存在，请重新登录')
      router.push('/login')
      return
    }
    
    // 调用API修改密码
    const res = await userAPI.changePassword({
      username: user.username,
      oldPassword: formData.oldPassword,
      newPassword: formData.newPassword
    })
    
    if (res && res.code === 200) {
      ElMessage.success('密码修改成功，请重新登录')
      // 清除本地存储的用户信息与登录凭证
      sessionStorage.removeItem('user')
      sessionStorage.removeItem('token')
      localStorage.removeItem('token')
      // 跳转到登录页面
      setTimeout(() => {
        router.push('/login')
      }, 1500)
    } else {
      // 后端返回的错误信息已经在API层处理了，这里不再重复提示
      console.log('修改密码失败:', res?.message)
    }
  } catch (error) {
    // 表单验证失败或接口调用失败
    if (error.message && error.message !== 'cancel') {
      console.error('修改密码失败:', error)
      // 错误提示已经在API层处理，这里不再重复
    }
  } finally {
    submitting.value = false
  }
}

// 取消
const handleCancel = () => {
  formData.oldPassword = ''
  formData.newPassword = ''
  formData.confirmPassword = ''
  formRef.value?.resetFields()
}
</script>

<style scoped>
.change-password-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.change-password-card {
  max-width: 500px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.change-password-form {
  margin-top: 20px;
}
</style>