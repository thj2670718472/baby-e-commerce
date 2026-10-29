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

    <!-- 近 7 日趋势 -->
    <el-card class="trend-card" shadow="never">
      <template #header>
        <div class="trend-header">
          <div class="trend-heading">
            <span class="trend-title">近 7 日销售趋势</span>
            <span class="trend-desc">按下单日期统计已完成订单</span>
          </div>
          <div class="trend-today">
            <span class="today-item">今日销售额 <b>¥{{ trend.today.sales.toLocaleString() }}</b></span>
            <span class="today-item">今日完成订单 <b>{{ trend.today.orders }}</b> 单</span>
          </div>
        </div>
      </template>
      <div ref="trendRef" class="trend-chart"></div>
    </el-card>
  </div>

</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Money, ShoppingCart, Goods, User, Collection, Grid, Check, Avatar } from '@element-plus/icons-vue'
import request from '@/utils/request'
// ECharts 按需引入，只有仪表盘会加载这几个模块
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

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

// ==================== 近 7 日趋势 ====================
const trendRef = ref(null)
const trend = ref({
  list: [],
  today: { sales: 0, orders: 0 }
})
let trendChart = null
let refreshInterval = null

const buildTrendOption = (list) => ({
  grid: { left: 8, right: 8, top: 46, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: '#c7d2fe' } },
    formatter: (params) => {
      if (!params || params.length === 0) return ''
      const sales = params.find((item) => item.seriesName === '销售额')
      const orders = params.find((item) => item.seriesName === '完成订单')
      return [
        params[0].axisValue,
        `销售额：¥${Number(sales ? sales.value : 0).toFixed(2)}`,
        `完成订单：${orders ? orders.value : 0} 单`
      ].join('<br/>')
    }
  },
  legend: {
    data: ['销售额', '完成订单'],
    right: 0,
    top: 0,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 4,
    textStyle: { color: '#6b7280', fontSize: 12 }
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: list.map((item) => item.label),
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisTick: { show: false },
    axisLabel: { color: '#9ca3af', fontSize: 12 }
  },
  yAxis: [
    {
      type: 'value',
      name: '销售额(¥)',
      nameTextStyle: { color: '#9ca3af', fontSize: 11, padding: [0, 0, 0, 10] },
      axisLabel: {
        color: '#9ca3af',
        fontSize: 12,
        formatter: (value) => (value >= 1000 ? `${value / 1000}k` : value)
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
    },
    {
      type: 'value',
      name: '订单数',
      nameTextStyle: { color: '#9ca3af', fontSize: 11, padding: [0, 10, 0, 0] },
      minInterval: 1,
      axisLabel: { color: '#9ca3af', fontSize: 12 },
      splitLine: { show: false }
    }
  ],
  series: [
    {
      name: '销售额',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: list.map((item) => item.sales),
      itemStyle: { color: '#6366f1' },
      lineStyle: { width: 3 },
      areaStyle: { color: 'rgba(99, 102, 241, 0.12)' }
    },
    {
      name: '完成订单',
      type: 'line',
      smooth: true,
      yAxisIndex: 1,
      symbol: 'circle',
      symbolSize: 6,
      data: list.map((item) => item.orders),
      itemStyle: { color: '#10b981' },
      lineStyle: { width: 3 }
    }
  ]
})

const renderTrend = () => {
  if (!trendRef.value) return
  if (!trendChart) trendChart = echarts.init(trendRef.value)
  // notMerge = true：切换数据时整体替换，避免残留旧的 series
  trendChart.setOption(buildTrendOption(trend.value.list), true)
}

const fetchTrend = async () => {
  try {
    const response = await request.get('/dashboard/trend')
    const data = response && response.code === 200 ? response.data : response
    if (data && Array.isArray(data.list) && data.list.length > 0) {
      trend.value = data
      renderTrend()
    }
  } catch (error) {
    console.error('获取趋势数据失败:', error)
  }
}

const handleResize = () => {
  if (trendChart) trendChart.resize()
}

onMounted(() => {
  fetchStatistics()
  fetchTrend()
  // 启动定期刷新（每30秒）
  refreshInterval = setInterval(() => {
    fetchStatistics()
    fetchTrend()
  }, 30000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理定时器与图表实例
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  window.removeEventListener('resize', handleResize)
  if (trendChart) {
    trendChart.dispose()
    trendChart = null
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

.trend-card {
  border-radius: 12px;
  margin-bottom: 20px;
}

.trend-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.trend-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.trend-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.trend-desc {
  font-size: 12px;
  color: #9ca3af;
}

.trend-today {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 13px;
  color: #6b7280;
}

.today-item b {
  margin-left: 4px;
  font-size: 16px;
  color: #111827;
}

.trend-chart {
  width: 100%;
  height: 320px;
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