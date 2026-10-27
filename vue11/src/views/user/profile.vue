<template>
  <div class="profile-container">
    <el-card shadow="never" class="profile-card">
      <template #header>
        <div class="card-header">
          <span>个人资料</span>
        </div>
      </template>
      
      <el-form :model="formData" label-width="100px" class="profile-form">
        <!-- ========== 新增：头像上传 ========== -->
        <el-form-item label="头像">
          <div class="avatar-upload-wrapper">
            <el-upload
              class="avatar-uploader"
              action="#"
              :show-file-list="false"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
            >
              <img v-if="formData.avatar" :src="getAvatarUrl(formData.avatar)" class="avatar-image" />
              <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
            </el-upload>
            <div class="avatar-tip">
              <p>点击更换头像</p>
              <p class="tip-size">支持 jpg、png 格式，大小不超过 2MB</p>
            </div>
          </div>
        </el-form-item>
        <!-- ========== 头像上传结束 ========== -->
        
        <el-form-item label="用户名">
          <el-input v-model="formData.username" :disabled="isAdmin" />
        </el-form-item>
        
        <el-form-item label="邮箱">
          <el-input v-model="formData.email" />
        </el-form-item>
        
        <el-form-item label="电话">
          <el-input v-model="formData.phone" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">保存修改</el-button>
          <el-button @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import userAPI from '@/api/user'
import service from '@/utils/request'

// 静态资源地址，可通过环境变量覆盖
const BASE_URL = import.meta.env.VITE_FILE_BASE_URL || 'http://localhost:3000'

const formData = ref({
  username: '',
  email: '',
  phone: '',
  avatar: ''  // 新增 avatar 字段
})

const submitting = ref(false)

// 判断是否为管理员
const isAdmin = computed(() => {
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      return user.role === 'admin'
    } catch (e) {
      console.error('解析用户信息失败:', e)
      return false
    }
  }
  return false
})

// ========== 获取头像URL ==========
const getAvatarUrl = (avatar) => {
  if (!avatar) return ''
  if (avatar.startsWith('http')) return avatar
  if (avatar.startsWith('/uploads/')) return BASE_URL + avatar
  if (avatar.startsWith('data:')) return avatar
  return BASE_URL + avatar
}

// ========== 头像上传前校验 ==========
const beforeAvatarUpload = (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG 格式的图片！')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB！')
    return false
  }
  return true
}

// ========== 处理头像上传 ==========
const handleAvatarUpload = async ({ file }) => {
  const formDataUpload = new FormData()
  formDataUpload.append('file', file)
  
  try {
    const res = await service.post('/upload/image', formDataUpload)

    if (res.code === 200) {
      // 上传成功，更新本地头像地址
      formData.value.avatar = res.data.url
      ElMessage.success('头像上传成功')
    } else {
      ElMessage.error(res.message || '头像上传失败')
    }
  } catch (error) {
    console.error('头像上传失败:', error)
    ElMessage.error('头像上传失败，请重试')
  }
}

// 加载用户信息
const loadUserInfo = () => {
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      formData.value.username = user.username || ''
      formData.value.email = user.email || ''
      formData.value.phone = user.phone || ''
      formData.value.avatar = user.avatar || ''  // 加载头像
    } catch {
      console.error('解析用户信息失败')
    }
  }
}

// 保存修改
const handleSubmit = async () => {
  const userStr = sessionStorage.getItem('user')
  if (!userStr) {
    ElMessage.error('用户信息丢失，请重新登录')
    return
  }
  
  submitting.value = true
  
  try {
    const user = JSON.parse(userStr)
    
    // 调用API更新个人资料（包含头像）
    const res = await userAPI.updateProfile({
      oldUsername: user.username,
      username: formData.value.username,
      email: formData.value.email,
      phone: formData.value.phone,
      avatar: formData.value.avatar  // 传递头像
    })
    
    if (res.code === 200) {
      ElMessage.success('保存成功')
      
      // 更新 sessionStorage 中的用户信息
      const updatedUser = {
        ...user,
        username: formData.value.username,
        email: formData.value.email,
        phone: formData.value.phone,
        avatar: formData.value.avatar  // 更新头像
      }
      sessionStorage.setItem('user', JSON.stringify(updatedUser))
      
      // 如果后端返回了更新后的用户信息，优先使用
      if (res.data) {
        sessionStorage.setItem('user', JSON.stringify(res.data))
      }
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

// 取消
const handleCancel = () => {
  loadUserInfo()
}

// 组件挂载时加载用户信息
onMounted(() => {
  loadUserInfo()
})
</script>

<style scoped>
.profile-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}

.profile-card {
  max-width: 600px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-form {
  margin-top: 20px;
}

/* ========== 新增：头像上传样式 ========== */
.avatar-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar-uploader {
  width: 100px;
  height: 100px;
  border: 1px dashed #d9d9d9;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.3s;
  flex-shrink: 0;
}

.avatar-uploader:hover {
  border-color: #409eff;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
}

.avatar-tip {
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.avatar-tip p {
  margin: 0;
}

.avatar-tip .tip-size {
  color: #c0c4cc;
}
</style>