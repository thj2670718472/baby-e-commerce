<template>
  <div class="coupon-page">
    <div class="summary-grid">
      <div class="summary-card">
        <span class="summary-label">累计发放</span>
        <strong class="summary-value">{{ stats.totalIssued }}</strong>
        <span class="summary-sub">{{ stats.activeTemplates }} 个模板启用中</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">未使用</span>
        <strong class="summary-value success">{{ stats.unusedCount }}</strong>
        <span class="summary-sub">可继续核销</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">已核销</span>
        <strong class="summary-value primary">{{ stats.redeemedCount }}</strong>
        <span class="summary-sub">核销率 {{ stats.redemptionRate }}%</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">已过期 / 作废</span>
        <strong class="summary-value muted">{{ stats.expiredCount }} / {{ stats.revokedCount }}</strong>
        <span class="summary-sub">过期为系统自动处理</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">已核销优惠金额</span>
        <strong class="summary-value danger">¥{{ formatMoney(stats.discountAmount) }}</strong>
        <span class="summary-sub">仅统计已使用优惠券</span>
      </div>
    </div>

    <el-card shadow="never" class="content-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="优惠券模板" name="templates">
          <div class="toolbar">
            <el-button type="primary" @click="openCreate">新增优惠券</el-button>
            <el-button @click="loadAll">刷新</el-button>
            <span class="toolbar-tip">共 {{ templates.length }} 个模板，停用后用户不能抽到或使用对应优惠券</span>
          </div>

          <el-table :data="templates" v-loading="templateLoading" stripe border>
            <el-table-column label="优惠券" min-width="180">
              <template #default="{ row }">
                <div class="coupon-name">{{ row.name }}</div>
                <div class="coupon-desc">{{ row.description || '暂无说明' }}</div>
              </template>
            </el-table-column>

            <el-table-column label="优惠内容" width="150" align="center">
              <template #default="{ row }">
                <span class="amount">¥{{ formatMoney(row.amount) }}</span>
                <div class="muted-text">满 ¥{{ formatMoney(row.threshold) }} 可用</div>
              </template>
            </el-table-column>

            <el-table-column label="概率" width="80" align="center">
              <template #default="{ row }">{{ Math.round(Number(row.probability) * 100) }}%</template>
            </el-table-column>

            <el-table-column label="已发放 / 总量" width="130" align="center">
              <template #default="{ row }">
                {{ row.issuedCount }} / {{ Number(row.totalCount) === -1 ? '不限' : row.totalCount }}
              </template>
            </el-table-column>

            <el-table-column label="状态统计" width="190" align="center">
              <template #default="{ row }">
                <div class="mini-stats">
                  <span>未用 {{ row.unusedCount }}</span>
                  <span>已核销 {{ row.redeemedCount }}</span>
                  <span>过期 {{ row.expiredCount }}</span>
                  <span>作废 {{ row.revokedCount }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="领取规则" width="130" align="center">
              <template #default="{ row }">
                <div>{{ row.validityDays }} 天有效</div>
                <div class="muted-text">每人限领 {{ row.perUserLimit }} 张</div>
              </template>
            </el-table-column>

            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'" size="small">
                  {{ Number(row.status) === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="190" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button link type="success" :disabled="Number(row.status) !== 1" @click="openIssue(row)">发放</el-button>
                <el-button
                  link
                  :type="Number(row.status) === 1 ? 'warning' : 'success'"
                  @click="toggleTemplate(row)"
                >
                  {{ Number(row.status) === 1 ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="发放与核销记录" name="records">
          <div class="toolbar filters">
            <el-select
              v-model="recordQuery.templateId"
              placeholder="全部模板"
              clearable
              style="width: 180px"
              @change="handleRecordSearch"
            >
              <el-option
                v-for="item in templates"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
            <el-select
              v-model="recordQuery.status"
              placeholder="全部状态"
              clearable
              style="width: 130px"
              @change="handleRecordSearch"
            >
              <el-option label="未使用" :value="1" />
              <el-option label="已使用" :value="2" />
              <el-option label="已过期" :value="3" />
              <el-option label="已作废" :value="4" />
            </el-select>
            <el-input
              v-model="recordQuery.keyword"
              placeholder="用户名或手机号"
              clearable
              style="width: 200px"
              @keyup.enter="handleRecordSearch"
              @clear="handleRecordSearch"
            />
            <el-button type="primary" @click="handleRecordSearch">查询</el-button>
            <el-button @click="resetRecordSearch">重置</el-button>
          </div>

          <el-table :data="records" v-loading="recordLoading" stripe border>
            <el-table-column label="用户" width="150">
              <template #default="{ row }">
                <div>{{ row.username }}</div>
                <div class="muted-text">{{ row.phone || '未填写手机号' }}</div>
              </template>
            </el-table-column>

            <el-table-column label="优惠券" min-width="180">
              <template #default="{ row }">
                <div class="coupon-name">{{ row.templateName }}</div>
                <div class="muted-text">满 ¥{{ formatMoney(row.threshold) }} 减 ¥{{ formatMoney(row.amount) }}</div>
              </template>
            </el-table-column>

            <el-table-column prop="sourceText" label="来源" width="100" align="center" />

            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ row.statusText }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="领取时间" width="165">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>

            <el-table-column label="有效期至" width="165">
              <template #default="{ row }">{{ formatTime(row.expireTime) }}</template>
            </el-table-column>

            <el-table-column label="关联订单" width="100" align="center">
              <template #default="{ row }">{{ row.orderId || '-' }}</template>
            </el-table-column>

            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <el-button
                  v-if="Number(row.status) === 1"
                  link
                  type="danger"
                  @click="revokeCoupon(row)"
                >
                  作废
                </el-button>
                <span v-else class="muted-text">-</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              v-model:current-page="recordQuery.page"
              v-model:page-size="recordQuery.pageSize"
              :page-sizes="[20, 50, 100]"
              :total="recordTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadRecords"
              @size-change="handleRecordSearch"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 模板新增 / 编辑 -->
    <el-dialog
      v-model="templateDialogVisible"
      :title="templateForm.id ? '编辑优惠券模板' : '新增优惠券模板'"
      width="560px"
      top="5vh"
      @closed="resetTemplateForm"
    >
      <el-form :model="templateForm" label-width="110px">
        <el-form-item label="优惠券名称" required>
          <el-input v-model="templateForm.name" maxlength="100" show-word-limit placeholder="例如：新人满减券" />
        </el-form-item>

        <el-form-item label="使用门槛" required>
          <el-input-number v-model="templateForm.threshold" :min="0" :precision="2" :step="10" />
          <span class="form-tip">0 表示无门槛</span>
        </el-form-item>

        <el-form-item label="优惠金额" required>
          <el-input-number v-model="templateForm.amount" :min="0.01" :precision="2" :step="5" />
          <span class="form-tip">不能超过使用门槛</span>
        </el-form-item>

        <el-form-item label="抽取概率" required>
          <el-input-number v-model="templateForm.probability" :min="0.01" :max="1" :precision="2" :step="0.05" />
          <span class="form-tip">0.1 表示 10%，启用模板概率总和不超过 1</span>
        </el-form-item>

        <el-form-item label="发放总量">
          <el-input-number v-model="templateForm.totalCount" :min="-1" :precision="0" :step="10" />
          <span class="form-tip">-1 表示不限量</span>
        </el-form-item>

        <el-form-item label="有效天数" required>
          <el-input-number v-model="templateForm.validityDays" :min="1" :max="365" :precision="0" />
          <span class="form-tip">领取后按自然日计算</span>
        </el-form-item>

        <el-form-item label="每人限领" required>
          <el-input-number v-model="templateForm.perUserLimit" :min="1" :max="100" :precision="0" />
          <span class="form-tip">自动抽奖和后台发放合计</span>
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="templateForm.status" />
        </el-form-item>

        <el-form-item label="运营说明">
          <el-input
            v-model="templateForm.description"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="供后台识别使用，不影响用户端展示"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingTemplate" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <!-- 手动发放 -->
    <el-dialog v-model="issueDialogVisible" title="手动发放优惠券" width="560px">
      <div v-if="issueTemplate" class="issue-summary">
        <div>
          <strong>{{ issueTemplate.name }}</strong>
          <span class="muted-text">满 ¥{{ formatMoney(issueTemplate.threshold) }} 减 ¥{{ formatMoney(issueTemplate.amount) }}</span>
        </div>
        <span class="muted-text">{{ issueTemplate.validityDays }} 天有效，每人限领 {{ issueTemplate.perUserLimit }} 张</span>
      </div>

      <div class="issue-toolbar">
        <el-button link type="primary" @click="selectAllUsers">选择全部普通用户</el-button>
        <el-button link @click="issueUserIds = []">清空选择</el-button>
        <span class="muted-text">单次最多 200 人</span>
      </div>

      <el-select
        v-model="issueUserIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        :multiple-limit="200"
        placeholder="搜索并选择用户"
        style="width: 100%"
      >
        <el-option
          v-for="user in users"
          :key="user.id"
          :label="`${user.username}${user.phone ? ` · ${user.phone}` : ''}`"
          :value="Number(user.id)"
        />
      </el-select>

      <template #footer>
        <el-button @click="issueDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" :disabled="issueUserIds.length === 0" @click="submitIssue">
          发放给 {{ issueUserIds.length }} 人
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import couponAPI from '@/api/coupon'
import userAPI from '@/api/user'

const activeTab = ref('templates')

const stats = reactive({
  totalTemplates: 0,
  activeTemplates: 0,
  totalIssued: 0,
  unusedCount: 0,
  redeemedCount: 0,
  expiredCount: 0,
  revokedCount: 0,
  discountAmount: 0,
  redemptionRate: 0
})

const templates = ref([])
const templateLoading = ref(false)
const templateDialogVisible = ref(false)
const savingTemplate = ref(false)

const emptyTemplate = () => ({
  id: null,
  name: '',
  threshold: 0,
  amount: 10,
  probability: 0.1,
  totalCount: -1,
  validityDays: 3,
  perUserLimit: 1,
  description: '',
  status: true
})

const templateForm = reactive(emptyTemplate())

const resetTemplateForm = () => {
  Object.assign(templateForm, emptyTemplate())
}

const loadStatistics = async () => {
  try {
    const res = await couponAPI.getStatistics()
    if (res.code === 200 && res.data?.summary) {
      Object.assign(stats, res.data.summary)
    }
  } catch (error) {
    // 请求层已提示
  }
}

const loadTemplates = async () => {
  templateLoading.value = true
  try {
    const res = await couponAPI.getAdminTemplates()
    if (res.code === 200) templates.value = res.data || []
  } catch (error) {
    templates.value = []
  } finally {
    templateLoading.value = false
  }
}

const loadAll = () => {
  loadStatistics()
  loadTemplates()
}

const openCreate = () => {
  resetTemplateForm()
  templateDialogVisible.value = true
}

const openEdit = (row) => {
  Object.assign(templateForm, {
    id: row.id,
    name: row.name,
    threshold: Number(row.threshold),
    amount: Number(row.amount),
    probability: Number(row.probability),
    totalCount: Number(row.totalCount),
    validityDays: Number(row.validityDays || 3),
    perUserLimit: Number(row.perUserLimit || 1),
    description: row.description || '',
    status: Number(row.status) === 1
  })
  templateDialogVisible.value = true
}

const validateTemplate = () => {
  if (!templateForm.name.trim()) {
    ElMessage.warning('请填写优惠券名称')
    return false
  }
  if (!templateForm.amount || Number(templateForm.amount) <= 0) {
    ElMessage.warning('优惠金额必须大于 0')
    return false
  }
  if (Number(templateForm.threshold) > 0 && Number(templateForm.amount) > Number(templateForm.threshold)) {
    ElMessage.warning('优惠金额不能超过使用门槛')
    return false
  }
  if (!templateForm.probability || Number(templateForm.probability) <= 0 || Number(templateForm.probability) > 1) {
    ElMessage.warning('抽取概率必须在 0.01 到 1 之间')
    return false
  }
  return true
}

const saveTemplate = async () => {
  if (!validateTemplate()) return
  savingTemplate.value = true
  try {
    const payload = {
      name: templateForm.name.trim(),
      threshold: Number(templateForm.threshold),
      amount: Number(templateForm.amount),
      probability: Number(templateForm.probability),
      totalCount: Number(templateForm.totalCount),
      validityDays: Number(templateForm.validityDays),
      perUserLimit: Number(templateForm.perUserLimit),
      description: templateForm.description,
      status: templateForm.status ? 1 : 0
    }
    const res = templateForm.id
      ? await couponAPI.updateTemplate(templateForm.id, payload)
      : await couponAPI.createTemplate(payload)
    if (res.code === 200) {
      ElMessage.success(templateForm.id ? '优惠券模板已更新' : '优惠券模板已创建')
      templateDialogVisible.value = false
      loadAll()
    }
  } catch (error) {
    ElMessage.error(error.message || '保存优惠券模板失败')
  } finally {
    savingTemplate.value = false
  }
}

const toggleTemplate = async (row) => {
  const nextStatus = Number(row.status) === 1 ? 0 : 1
  try {
    await ElMessageBox.confirm(
      nextStatus === 1
        ? `确定启用「${row.name}」吗？`
        : `停用后用户不能抽到或使用「${row.name}」，确定继续吗？`,
      '状态确认',
      { type: 'warning' }
    )
    const res = await couponAPI.updateTemplate(row.id, { status: nextStatus })
    if (res.code === 200) {
      ElMessage.success(nextStatus === 1 ? '已启用' : '已停用')
      loadAll()
    }
  } catch (error) {
    if (!['cancel', 'close'].includes(error)) ElMessage.error(error.message || '更新状态失败')
  }
}

const users = ref([])
const issueDialogVisible = ref(false)
const issueTemplate = ref(null)
const issueUserIds = ref([])
const issuing = ref(false)

const loadUsers = async () => {
  try {
    const res = await userAPI.getUsers()
    if (res.code === 200) {
      users.value = (res.data || []).filter((user) => (
        user.role !== 'admin' && user.isactive !== false && Number(user.isactive) !== 0
      ))
    }
  } catch (error) {
    users.value = []
  }
}

const openIssue = async (row) => {
  issueTemplate.value = row
  issueUserIds.value = []
  issueDialogVisible.value = true
  if (users.value.length === 0) await loadUsers()
}

const selectAllUsers = () => {
  issueUserIds.value = users.value.slice(0, 200).map((user) => Number(user.id))
}

const submitIssue = async () => {
  if (!issueTemplate.value || issueUserIds.value.length === 0) return
  issuing.value = true
  try {
    const res = await couponAPI.issueCoupons({
      templateId: issueTemplate.value.id,
      userIds: issueUserIds.value
    })
    if (res.code === 200) {
      const { issuedCount, skipped = [] } = res.data || {}
      ElMessage.success(`成功发放 ${issuedCount || 0} 张优惠券`)
      if (skipped.length > 0) {
        ElMessage.warning(`${skipped.length} 个用户未发放：${skipped[0].reason}${skipped.length > 1 ? ' 等' : ''}`)
      }
      issueDialogVisible.value = false
      loadAll()
      if (activeTab.value === 'records') loadRecords()
    }
  } catch (error) {
    ElMessage.error(error.message || '发放优惠券失败')
  } finally {
    issuing.value = false
  }
}

const records = ref([])
const recordTotal = ref(0)
const recordLoading = ref(false)
const recordQuery = reactive({
  page: 1,
  pageSize: 20,
  templateId: '',
  status: '',
  keyword: ''
})

const loadRecords = async () => {
  recordLoading.value = true
  try {
    const res = await couponAPI.getUserCoupons({
      page: recordQuery.page,
      pageSize: recordQuery.pageSize,
      templateId: recordQuery.templateId || undefined,
      status: recordQuery.status === '' ? undefined : recordQuery.status,
      keyword: recordQuery.keyword.trim() || undefined
    })
    if (res.code === 200) {
      records.value = res.data?.list || []
      recordTotal.value = res.data?.total || 0
    }
  } catch (error) {
    records.value = []
    recordTotal.value = 0
  } finally {
    recordLoading.value = false
  }
}

const handleRecordSearch = () => {
  recordQuery.page = 1
  loadRecords()
}

const resetRecordSearch = () => {
  recordQuery.templateId = ''
  recordQuery.status = ''
  recordQuery.keyword = ''
  handleRecordSearch()
}

const revokeCoupon = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt(
      `确定作废「${row.username}」的「${row.templateName}」吗？请填写作废原因。`,
      '作废优惠券',
      {
        type: 'warning',
        inputPlaceholder: '例如：活动配置错误',
        inputValidator: (input) => (input && input.trim() ? true : '请填写作废原因'),
        confirmButtonText: '确认作废',
        cancelButtonText: '取消'
      }
    )
    const res = await couponAPI.revokeUserCoupon(row.id, value.trim())
    if (res.code === 200) {
      ElMessage.success('优惠券已作废')
      loadRecords()
      loadAll()
    }
  } catch (error) {
    if (!['cancel', 'close'].includes(error)) ElMessage.error(error.message || '作废优惠券失败')
  }
}

const handleTabChange = (name) => {
  if (name === 'records') {
    loadRecords()
    if (users.value.length === 0) loadUsers()
  }
}

const statusTagType = (status) => {
  if (Number(status) === 1) return 'success'
  if (Number(status) === 2) return 'primary'
  if (Number(status) === 3) return 'info'
  return 'danger'
}

const formatMoney = (value) => Number(value || 0).toFixed(2)

const formatTime = (value) => {
  if (!value) return '-'
  return String(value).replace('T', ' ').split('.')[0]
}

onMounted(() => {
  loadAll()
  loadUsers()
  loadRecords()
})
</script>

<style scoped>
.coupon-page {
  padding: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
}

.summary-label,
.summary-sub,
.muted-text {
  color: #909399;
  font-size: 12px;
}

.summary-value {
  color: #303133;
  font-size: 26px;
  line-height: 1.2;
}

.summary-value.success { color: #67c23a; }
.summary-value.primary { color: #409eff; }
.summary-value.danger { color: #f56c6c; }
.summary-value.muted { color: #606266; }

.content-card {
  border-radius: 8px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.filters {
  flex-wrap: wrap;
}

.toolbar-tip {
  margin-left: auto;
  color: #909399;
  font-size: 13px;
}

.coupon-name {
  color: #303133;
  font-weight: 600;
}

.coupon-desc {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}

.amount {
  color: #f56c6c;
  font-weight: 700;
}

.mini-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 10px;
  color: #606266;
  font-size: 12px;
}

.form-tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.issue-summary {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  margin-bottom: 14px;
  background: #f5f7fa;
  border-radius: 8px;
}

.issue-summary > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.issue-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
