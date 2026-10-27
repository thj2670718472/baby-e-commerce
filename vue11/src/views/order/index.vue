<template>
  <div class="order-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单管理</span>
        </div>
      </template>
      
      <el-table :data="orderList" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="160" />
        <el-table-column v-if="isAdmin" prop="userName" label="用户名" width="100" />
        <el-table-column label="商品名" width="120">
          <template #default="{ row }">
            <span v-if="row.order_goods && row.order_goods.length > 0">
              {{ row.order_goods.map(item => item.goodsName).join(', ') }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="address" label="收货地址" min-width="200" />
        <el-table-column prop="phone" label="联系电话" width="110" />
        <el-table-column prop="orderTime" label="下单时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="operation-btns">
              <el-button type="primary" size="small" @click.stop="viewDetail(row)">详情</el-button>
              <el-button 
                v-if="isAdmin && row.status === '已付款'" 
                type="success" 
                size="small" 
                @click.stop="handleShip(row)"
              >
                发货
              </el-button>
              <el-button 
                v-if="isAdmin && row.status === '退货中'" 
                type="warning" 
                size="small" 
                @click.stop="handleApproveReturn(row)"
              >
                审核退货
              </el-button>
              <el-button 
                v-if="!isAdmin && row.status === '已发货'" 
                type="success" 
                size="small" 
                @click.stop="handleReceive(row)"
              >
                收货
              </el-button>
              <el-button 
                v-if="!isAdmin && canReturn(row.status)" 
                type="danger" 
                size="small" 
                @click.stop="handleReturn(row)"
              >
                申请退货
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
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
import { getOrderList, applyReturn, approveReturn, shipOrder, receiveOrder } from '@/api/order'

export default {
  name: 'OrderIndex',
  data() {
    return {
      orderList: [],
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
      updateOrder: {},
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
    this.loadOrderList()
  },
  methods: {
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
    loadOrderList() {
      getOrderList().then(response => {
        if (response.code === 200) {
          let orders = response.data
          if (!this.isAdmin) {
            const userStr = sessionStorage.getItem('user')
            if (userStr) {
              try {
                const user = JSON.parse(userStr)
                orders = orders.filter(order => order.userId === user.id)
              } catch (e) {}
            }
          }
          this.orderList = orders
        }
      }).catch(() => {
        this.$message.error('获取订单列表失败')
      })
    },
    viewDetail(order) {
      this.$router.push({
        path: '/main/order/detail',
        query: { orderId: order.id }
      })
    },
    handleShip(order) {
      this.shipForm = {
        orderId: order.id,
        orderNo: order.orderNo,
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
          this.loadOrderList()
        } else {
          this.$message.error(response.message)
        }
      }).catch(() => {
        this.$message.error('发货失败')
      }).finally(() => {
        this.shipLoading = false
      })
    },
    handleReceive(order) {
      this.$confirm('确认已收到商品吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        receiveOrder(order.id).then(response => {
          if (response.code === 200) {
            this.$message.success('确认收货成功')
            this.loadOrderList()
          } else {
            this.$message.error(response.message)
          }
        }).catch(() => {
          this.$message.error('确认收货失败')
        })
      }).catch(() => {})
    },
    handleReturn(order) {
      this.returnForm = {
        orderId: order.id,
        orderNo: order.orderNo,
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
          this.$message.success('退货申请已提交')
          this.returnDialogVisible = false
          this.loadOrderList()
        } else {
          this.$message.error(response.message)
        }
      }).catch(() => {
        this.$message.error('申请退货失败')
      }).finally(() => {
        this.returnLoading = false
      })
    },
    handleApproveReturn(order) {
      this.approveForm = {
        orderId: order.id,
        orderNo: order.orderNo,
        returnReason: order.returnReason,
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
          this.loadOrderList()
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
.order-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.operation-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.operation-btns .el-button {
  margin: 0;
}
</style>