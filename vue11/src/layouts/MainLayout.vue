<template>
  <div class="main-layout">
    <!-- 侧边菜单 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="aside">
      <div class="logo" :class="{ collapse: isCollapse }">
        <span v-if="!isCollapse">母婴系统</span>
        <span v-else>商</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="menu"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
      >
        <el-menu-item index="/main/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/main/chat">
          <el-icon><ChatDotRound /></el-icon>
          <span>问题咨询</span>
        </el-menu-item>

        <el-sub-menu index="/main/product">
          <template #title>
            <el-icon><Goods /></el-icon>
            <span>商品管理</span>
          </template>
          <el-menu-item index="/main/product/list">商品列表</el-menu-item>
          <el-menu-item index="/main/product/category">商品分类</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/main/order">
          <el-icon><List /></el-icon>
          <span>订单管理</span>
        </el-menu-item>

        <el-menu-item index="/main/user">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>

        <el-menu-item index="/main/review">
          <el-icon><ChatDotSquare /></el-icon>
          <span>评价管理</span>
        </el-menu-item>

        <el-menu-item index="/main/baby-culture">
          <el-icon><Reading /></el-icon>
          <span>婴儿培养</span>
        </el-menu-item>

        <el-menu-item index="/main/points">
          <el-icon><Coin /></el-icon>
          <span>积分商城</span>
        </el-menu-item>

        <el-menu-item index="/main/coupon">
          <el-icon><Ticket /></el-icon>
          <span>优惠券管理</span>
        </el-menu-item>

        <el-menu-item index="/main/seckill">
          <el-icon><AlarmClock /></el-icon>
          <span>秒杀管理</span>
        </el-menu-item>
      </el-menu>
      
      <div class="collapse-btn" @click="toggleCollapse">
        <el-icon>
          <component :is="isCollapse ? 'Expand' : 'Fold'" />
        </el-icon>
      </div>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-container class="main-container">
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/main/dashboard' }">
              首页
            </el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              {{ username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
              <el-dropdown-item command="profile">个人资料</el-dropdown-item>
              <el-dropdown-item command="changePassword">修改密码</el-dropdown-item>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <el-main class="content">
        <!-- 不使用keep-alive，每次都重新加载组件 -->
        <router-view :key="$route.fullPath" />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { 
  Odometer, 
  Goods, 
  List, 
  User,
  ArrowDown,
  Expand,
  Fold,
  ChatDotSquare,
  Reading,
  Coin,
  AlarmClock,
  Ticket
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const isCollapse = ref(false)

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 当前页面标题
const currentTitle = computed(() => route.meta.title || '首页')

// 用户名 - 修复JSON解析问题
const username = computed(() => {
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      return user.username || '管理员'
    } catch (e) {
      console.error('解析用户信息失败:', e)
      return '管理员'
    }
  }
  return '管理员'
})

// 切换菜单折叠
const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

// 处理下拉菜单命令
const handleCommand = (command) => {
  if (command === 'logout') {
    handleLogout()
  } else if (command === 'profile') {
    router.push('/main/user/profile')
  } else if (command === 'changePassword') {
    router.push('/main/user/change-password')
  }
}

// 退出登录
const handleLogout = () => {
  ElMessageBox.confirm('确认退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'info'
  }).then(() => {
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('token')
    localStorage.removeItem('token')
    router.push('/login')
  }).catch(() => {})
}
</script>

<style scoped>
.main-layout {
  height: 100vh;
  display: flex;
}

.aside {
  background-color: #304156;
  color: #fff;
  height: 100vh;
  position: relative;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  background-color: #2b3a4a;
  overflow: hidden;
  white-space: nowrap;
  transition: all 0.3s;
}

.logo.collapse {
  font-size: 20px;
}

.menu {
  flex: 1;
  border-right: none;
  background-color: transparent;
}

:deep(.el-menu) {
  background-color: transparent;
  border-right: none;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  color: #bfcbd9;
  background-color: transparent !important;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background-color: #263445 !important;
  color: #fff;
}

:deep(.el-menu-item.is-active) {
  background-color: #1f2d3a !important;
  color: #409eff;
}

.collapse-btn {
  height: 40px;
  line-height: 40px;
  text-align: center;
  color: #bfcbd9;
  cursor: pointer;
  border-top: 1px solid #263445;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  flex: 1;
}

.header-right {
  cursor: pointer;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #333;
}

.content {
  flex: 1;
  background-color: #f5f7fa;
  overflow-y: auto;
  padding: 0;
}

:deep(.el-main) {
  padding: 0;
}
</style>
