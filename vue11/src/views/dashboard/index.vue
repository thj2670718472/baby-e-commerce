<template>  
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1 class="text-2xl font-bold">仪表盘</h1>
      <div class="dashboard-date">{{ new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) }}</div>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stats-card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">总销售额</p>
            <p class="stats-value">¥{{ statistics.totalSales.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Money /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-green-500 to-green-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">订单总数</p>
            <p class="stats-value">{{ statistics.totalOrders.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><ShoppingCart /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">商品数量</p>
            <p class="stats-value">{{ statistics.totalProducts.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Goods /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">用户总数</p>
            <p class="stats-value">{{ statistics.totalUsers.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><User /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-pink-500 to-pink-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">商品种类数</p>
            <p class="stats-value">{{ statistics.productTypes.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Collection /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">商品分类数</p>
            <p class="stats-value">{{ statistics.productCategories.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Grid /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-teal-500 to-teal-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">完成订单数</p>
            <p class="stats-value">{{ statistics.completedOrders.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Check /></el-icon>
        </div>
      </el-card>
      
      <el-card class="stats-card bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div class="stats-content">
          <div class="stats-info">
            <p class="stats-label">婴儿数</p>
            <p class="stats-value">{{ statistics.babyCount.toLocaleString() }}</p>
          </div>
          <el-icon class="stats-icon"><Avatar /></el-icon>
        </div>
      </el-card>
    </div>
  </div>
 
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Money, ShoppingCart, Goods, User, Collection, Grid, Check, Avatar } from '@element-plus/icons-vue'
import request from '@/utils/request'

const statistics = ref({
  totalSales: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalUsers: 0,
  productTypes: 0,
  productCategories: 0,
  completedOrders: 0,
  babyCount: 0
})

const fetchStatistics = async () => {
  try {
    const response = await request.get('/dashboard/statistics')
    const data = response && response.code === 200 ? response.data : response
    if (data && typeof data === 'object') {
      statistics.value = { ...statistics.value, ...data }
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 定期刷新数据（每30秒）
let refreshInterval = null

onMounted(() => {
  fetchStatistics()
  // 启动定期刷新
  refreshInterval = setInterval(fetchStatistics, 30000)
})

onUnmounted(() => {
  // 清理定时器
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  min-height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.dashboard-date {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stats-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  height: 150px;
  display: flex;
  align-items: center;
}

.stats-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

.stats-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 24px;
}

.stats-info {
  flex: 1;
}

.stats-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
  font-weight: 500;
}

.stats-value {
  font-size: 28px;
  font-weight: bold;
  line-height: 1;
  margin: 0;
}

.stats-icon {
  font-size: 48px;
  opacity: 0.8;
  transition: transform 0.3s ease;
}

.stats-card:hover .stats-icon {
  transform: scale(1.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .stats-card {
    height: 130px;
  }
  
  .stats-value {
    font-size: 24px;
  }
  
  .stats-icon {
    font-size: 40px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1025px) and (max-width: 1440px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1441px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>