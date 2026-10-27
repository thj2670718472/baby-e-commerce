<template>
  <div class="user-management-container">
    <div class="header">
      <h2>用户管理</h2>
    </div>

    <!-- 用户列表表格 -->
    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="loading" 
        :data="userList" 
        border 
        stripe 
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="phone" label="电话" width="120" align="center" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="isactive" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isactive ? 'success' : 'danger'">
              {{ row.isactive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import UserAPI from '@/api/user'

// 数据列表
const userList = ref([])
const loading = ref(false)

// 加载用户列表
const loadUsers = async () => {
  loading.value = true
  try {
    const res = await UserAPI.getUsers()
    if (res.code === 200) {
      // 过滤掉管理员用户
      userList.value = (res.data || []).filter(user => user.role !== 'admin')
    } else {
      ElMessage.error(res.message || '加载用户列表失败')
    }
  } catch (error) {
    console.error('加载用户列表失败:', error)
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

// 删除用户
const handleDelete = (row) => {
  ElMessageBox.confirm(`确认删除用户"${row.username}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await UserAPI.deleteUser(row.id)
      if (res.code === 200) {
        loadUsers()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})
}

// 组件挂载时加载数据
onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management-container {
  padding: 20px;
}

.header {
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.table-card {
  border-radius: 8px;
}
</style>