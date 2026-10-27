<template>
  <div class="order-detail">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>订单详情</span>
          <div class="header-actions">
            <el-button 
              v-if="isAdmin && orderDetail && orderDetail.status === '已付款'" 
              type="success" 
              size="small" 
              @click="handleShip"
            >
              发货
            </el-button>
            <el-button 
              v-if="isAdmin && orderDetail && orderDetail.status === '退货中'" 
              type="warning" 
              size="small" 
              @click="handleApproveReturn"
            >
              审核退货
            </el-button>
            <el-button 
              v-if="!isAdmin && orderDetail && orderDetail.status === '已发货'" 
              type="success" 
              size="small" 
              @click="handleReceive"
            >
              确认收货
            </el-button>
            <el-button 
              v-if="!isAdmin && orderDetail && canReturn(orderDetail.status)" 
              type="danger" 
              size="small" 
              @click="handleReturn"
            >
              申请退货
            </el-button>
          </div>
        </div>
      </template>
      
      <div v-if="orderDetail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ orderDetail.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="用户名">{{ orderDetail.userName }}</el-descriptions-item>
          <el-descriptions-item label="总金额">¥{{ Number(orderDetail.totalAmount).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(orderDetail.status)">{{ orderDetail.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="收货地址" :span="2">{{ orderDetail.address }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ orderDetail.phone }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ orderDetail.paymentMethod }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ formatTime(orderDetail.orderTime) }}</el-descriptions-item>

          <!-- 物流信息 -->
          <el-descriptions-item v-if="orderDetail.logisticsCompany" label="物流公司">
            {{ orderDetail.logisticsCompany }}
          </el-descriptions-item>
          <el-descriptions-item v-if="orderDetail.logisticsNo" label="快递单号">
            {{ orderDetail.logisticsNo }}
          </el-descriptions-item>
          <el-descriptions-item v-if="orderDetail.shipTime" label="发货时间">
            {{ formatTime(orderDetail.shipTime) }}
          </el-descriptions-item>

          <!-- 退货信息 -->
          <el-descriptions-item v-if="orderDetail.returnReason" label="退货理由" :span="2">
            {{ orderDetail.returnReason }}
          </el-descriptions-item>
          <el-descriptions-item v-if="orderDetail.returnTime" label="退货申请时间">
            {{ formatTime(orderDetail.returnTime) }}
          </el-descriptions-item>
        </el-descriptions>
        
        <el-divider>商品列表</el-divider>
        
        <el-table :data="orderDetail.order_goods || []" style="width: 100%" border>
          <el-table-column prop="goodsName" label="商品名称" />
          <el-table-column prop="price" label="单价" width="100">
            <template #default="{ row }">
              ¥{{ Number(row.price).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column prop="subtotal" label="小计" width="100">
            <template #default="{ row }">
              ¥{{ Number(row.subtotal).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button type="primary" link @click="viewGoodsDetail(row)">商品详情</el-button>
              <el-button type="success" link @click="goToReview(row)">去评论</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else-if="!loading">
        <el-empty description="订单不存在"></el-empty>
      </div>
      
      <div style="margin-top: 20px; text-align: right;">
        <el-button @click="goBack">返回</el-button>
      </div>
    </el-card>

    <!-- 发货对话框 -->
    <el-dialog title="发货" v-model="shipDialogVisible" width="500px">
      <el-form :model="shipForm" label-width="100px">
        <el-form-item label="订单号">
          <span>{{ shipForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="物流公司" required>
          <el-select v-model="shipForm.logisticsCompany" placeholder="请选择物流公司" style="width: 100%">
            <el-option label="顺丰速运" value="顺丰速运" />
            <el-option label="中通快递" value="中通快递" />
            <el-option label="圆通速递" value="圆通速递" />
            <el-option label="韵达快递" value="韵达快递" />
            <el-option label="申通快递" value="申通快递" />
            <el-option label="京东物流" value="京东物流" />
            <el-option label="邮政EMS" value="邮政EMS" />
            <el-option label="极兔速递" value="极兔速递" />
          </el-select>
        </el-form-item>
        <el-form-item label="快递单号" required>
          <el-input v-model="shipForm.logisticsNo" placeholder="请输入快递单号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmShip" :loading="shipLoading">确认发货</el-button>
      </template>
    </el-dialog>

    <!-- 退货申请对话框 -->
    <el-dialog title="申请退货" v-model="returnDialogVisible" width="500px">
      <el-form :model="returnForm" label-width="80px">
        <el-form-item label="订单号">
          <span>{{ returnForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="退货理由" prop="reason" :rules="[{ required: true, message: '请输入退货理由', trigger: 'blur' }]">
          <el-input 
            v-model="returnForm.reason" 
            type="textarea" 
            rows="4" 
            placeholder="请输入退货理由"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReturn" :loading="returnLoading">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- 审核退货对话框 -->
    <el-dialog title="审核退货申请" v-model="approveReturnDialogVisible" width="500px">
      <el-form :model="approveForm" label-width="80px">
        <el-form-item label="订单号">
          <span>{{ approveForm.orderNo }}</span>
        </el-form-item>
        <el-form-item label="退货理由">
          <span>{{ approveForm.returnReason }}</span>
        </el-form-item>
        <el-form-item label="审核结果">
          <el-radio-group v-model="approveForm.approved">
            <el-radio :label="true">通过</el-radio>
            <el-radio :label="false">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveReturnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmApproveReturn" :loading="approveLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { getOrderDetail, applyReturn, approveReturn, shipOrder, receiveOrder } from '@/api/order'

export default {
  name: 'OrderDetail',
  data() {
    return {
      orderDetail: null,
      loading: false,
      returnDialogVisible: false,
      approveReturnDialogVisible: false,
      shipDialogVisible: false,
      shipForm: {
        orderId: null,
        orderNo: '',
        logisticsCompany: '',
        logisticsNo: ''
      },
      shipLoading: false,
      returnForm: {
        orderId: null,
        orderNo: '',
        reason: ''
      },
      approveForm: {
        orderId: null,
        orderNo: '',
        returnReason: '',
        approved: true
      },
      returnLoading: false,
      approveLoading: false
    }
  },
  computed: {
    isAdmin() {
      const userStr = sessionStorage.getItem('user')
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          return user.role === 'admin'
        } catch (e) {
          return false
        }
      }
      return false
    }
  },
  mounted() {
    this.loadOrderDetail()
  },
  methods: {
    loadOrderDetail() {
      const orderId = this.$route.query.orderId
      if (orderId) {
        this.loading = true
        getOrderDetail(orderId)
          .then(response => {
            this.orderDetail = response.data
          })
          .catch(() => {
            this.$message.error('获取订单详情失败')
          })
          .finally(() => {
            this.loading = false
          })
      } else {
        this.$message.error('缺少订单ID')
      }
    },
    getStatusType(status) {
      const statusMap = {
        '待付款': 'warning',
        '已付款': 'success',
        '已发货': 'primary',
        '已完成': 'success',
        '已取消': 'danger',
        '退货中': 'info',
        '已退货': 'danger'
      }
      return statusMap[status] || 'info'
    },
    canReturn(status) {
      return status === '已付款' || status === '已发货' || status === '已完成'
    },
    formatTime(time) {
      if (!time) return '-'
      const date = new Date(time)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const h = String(date.getHours()).padStart(2, '0')
      const min = String(date.getMinutes()).padStart(2, '0')
      const s = String(date.getSeconds()).padStart(2, '0')
      return `${y}-${m}-${d} ${h}:${min}:${s}`
    },
    goBack() {
      this.$router.push('/main/order')
    },
    viewGoodsDetail(row) {
      this.$router.push({
        path: '/main/product/list',
        query: { goodsId: row.goodsId }
      })
    },
    goToReview(row) {
      this.$router.push({
        path: '/main/product/list',
        query: { goodsId: row.goodsId, review: true }
      })
    },
    handleShip() {
      this.shipForm = {
        orderId: this.orderDetail.id,
        orderNo: this.orderDetail.orderNo,
        logisticsCompany: '',
        logisticsNo: ''
      }
      this.shipDialogVisible = true
    },
    confirmShip() {
      if (!this.shipForm.logisticsCompany) {
        this.$message.warning('请选择物流公司')
        return
      }
      if (!this.shipForm.logisticsNo) {
        this.$message.warning('请输入快递单号')
        return
      }
      this.shipLoading = true
      shipOrder(this.shipForm.orderId, {
        logisticsCompany: this.shipForm.logisticsCompany,
        logisticsNo: this.shipForm.logisticsNo
      }).then(response => {
        if (response.code === 200) {
          this.$message.success('发货成功')
          this.shipDialogVisible = false
          this.loadOrderDetail()
        } else {
          this.$message.error(response.message)
        }
      }).catch(() => {
        this.$message.error('发货失败')
      }).finally(() => {
        this.shipLoading = false
      })
    },
    handleReceive() {
      this.$confirm('确认已收到商品吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        receiveOrder(this.orderDetail.id).then(response => {
          if (response.code === 200) {
            this.$message.success('确认收货成功')
            this.loadOrderDetail()
          } else {
            this.$message.error(response.message)
          }
        }).catch(() => {
          this.$message.error('确认收货失败')
        })
      }).catch(() => {})
    },
    handleReturn() {
      this.returnForm = {
        orderId: this.orderDetail.id,
        orderNo: this.orderDetail.orderNo,
        reason: ''
      }
      this.returnDialogVisible = true
    },
    confirmReturn() {
      if (!this.returnForm.reason.trim()) {
        this.$message.warning('请输入退货理由')
        return
      }
      this.returnLoading = true
      applyReturn(this.returnForm.orderId, this.returnForm.reason).then(response => {
        if (response.code === 200) {
          this.$message.success('退货申请已提交，等待管理员审核')
          this.returnDialogVisible = false
          this.loadOrderDetail()
        } else {
          this.$message.error(response.message)
        }
      }).catch(() => {
        this.$message.error('申请退货失败')
      }).finally(() => {
        this.returnLoading = false
      })
    },
    handleApproveReturn() {
      this.approveForm = {
        orderId: this.orderDetail.id,
        orderNo: this.orderDetail.orderNo,
        returnReason: this.orderDetail.returnReason,
        approved: true
      }
      this.approveReturnDialogVisible = true
    },
    confirmApproveReturn() {
      this.approveLoading = true
      approveReturn(this.approveForm.orderId, this.approveForm.approved).then(response => {
        if (response.code === 200) {
          this.$message.success(this.approveForm.approved ? '退货申请已通过' : '退货申请已拒绝')
          this.approveReturnDialogVisible = false
          this.loadOrderDetail()
        } else {
          this.$message.error(response.message)
        }
      }).catch(() => {
        this.$message.error('审核退货失败')
      }).finally(() => {
        this.approveLoading = false
      })
    }
  }
}
</script>

<style scoped>
.order-detail {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .el-button {
  margin: 0;
}
</style>