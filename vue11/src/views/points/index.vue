<template>
  <div class="points-page">
    <el-card shadow="never" class="card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- ==================== 积分商品 ==================== -->
        <el-tab-pane label="积分商品" name="goods">
          <div class="toolbar">
            <el-button type="primary" @click="openCreate">
              <el-icon><Plus /></el-icon>
              <span>新增商品</span>
            </el-button>
            <el-button @click="loadGoods">
              <el-icon><Refresh /></el-icon>
              <span>刷新</span>
            </el-button>
            <span class="toolbar-tip">共 {{ goodsList.length }} 个积分商品</span>
          </div>

          <el-table :data="goodsList" v-loading="goodsLoading" stripe border>
            <el-table-column prop="id" label="ID" width="70" align="center" />

            <el-table-column label="图片" width="90" align="center">
              <template #default="{ row }">
                <el-image
                  v-if="row.image"
                  :src="row.image"
                  :preview-src-list="[row.image]"
                  preview-teleported
                  fit="cover"
                  class="thumb"
                />
                <span v-else class="no-image">无图</span>
              </template>
            </el-table-column>

            <el-table-column prop="name" label="商品名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />

            <el-table-column label="所需积分" width="110" align="center">
              <template #default="{ row }">
                <span class="points-text">{{ row.points }}</span>
              </template>
            </el-table-column>

            <el-table-column label="库存" width="90" align="center">
              <template #default="{ row }">
                <span :class="{ 'stock-empty': Number(row.stock) <= 0 }">{{ row.stock }}</span>
              </template>
            </el-table-column>

            <el-table-column label="每人限兑" width="100" align="center">
              <template #default="{ row }">
                {{ Number(row.redeemLimit) > 0 ? `${row.redeemLimit} 件` : '不限' }}
              </template>
            </el-table-column>

            <el-table-column prop="sort" label="排序" width="80" align="center" />

            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status ? 'success' : 'info'" size="small">
                  {{ row.status ? '上架' : '下架' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="200" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
                <el-button link :type="row.status ? 'warning' : 'success'" @click="toggleStatus(row)">
                  {{ row.status ? '下架' : '上架' }}
                </el-button>
                <el-button link type="danger" @click="removeGoods(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!goodsLoading && goodsList.length === 0" description="还没有积分商品，先新增一个吧" />
        </el-tab-pane>

        <!-- ==================== 兑换记录 ==================== -->
        <el-tab-pane label="兑换记录" name="exchange">
          <div class="toolbar">
            <el-select
              v-model="exchangeQuery.status"
              placeholder="全部状态"
              clearable
              style="width: 150px"
              @change="handleExchangeSearch"
            >
              <el-option label="待发货" value="待发货" />
              <el-option label="已发货" value="已发货" />
              <el-option label="已完成" value="已完成" />
              <el-option label="已取消" value="已取消" />
            </el-select>

            <el-input
              v-model="exchangeQuery.keyword"
              placeholder="按商品名称搜索"
              clearable
              style="width: 220px"
              @keyup.enter="handleExchangeSearch"
              @clear="handleExchangeSearch"
            />

            <el-button type="primary" @click="handleExchangeSearch">查询</el-button>
            <el-button @click="resetExchangeSearch">重置</el-button>
          </div>

          <el-table :data="exchangeList" v-loading="exchangeLoading" stripe border>
            <el-table-column prop="id" label="兑换单号" width="100" align="center" />

            <el-table-column label="用户" width="130">
              <template #default="{ row }">{{ row.username }}</template>
            </el-table-column>

            <el-table-column label="商品" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.goodsName }} × {{ row.quantity }}</template>
            </el-table-column>

            <el-table-column label="消耗积分" width="110" align="center">
              <template #default="{ row }">
                <span class="points-text">{{ row.points }}</span>
              </template>
            </el-table-column>

            <el-table-column label="收货信息" min-width="220">
              <template #default="{ row }">
                <div class="receiver">
                  <span class="receiver-phone">{{ row.phone || '未填写电话' }}</span>
                  <span class="receiver-address">{{ row.address || '未填写地址' }}</span>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="兑换时间" width="170" align="center">
              <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
            </el-table-column>

            <el-table-column label="操作" width="170" align="center" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.status === '待发货'" link type="primary" @click="changeStatus(row, '已发货')">
                  发货
                </el-button>
                <el-button v-if="row.status === '已发货'" link type="success" @click="changeStatus(row, '已完成')">
                  完成
                </el-button>
                <el-button
                  v-if="row.status === '待发货' || row.status === '已发货'"
                  link
                  type="danger"
                  @click="cancelExchange(row)"
                >
                  取消
                </el-button>
                <span v-if="row.status === '已完成' || row.status === '已取消'" class="no-action">-</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              v-model:current-page="exchangeQuery.page"
              v-model:page-size="exchangeQuery.pageSize"
              :page-sizes="[10, 20, 50]"
              :total="exchangeTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadExchange"
              @size-change="handleExchangeSearch"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ==================== 新增 / 编辑弹窗 ==================== -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑积分商品' : '新增积分商品'"
      width="620px"
      top="4vh"
      @closed="resetForm"
    >
      <el-form :model="form" label-width="90px">
        <el-form-item label="商品名称" required>
          <el-input v-model="form.name" maxlength="100" show-word-limit placeholder="例如：婴儿手口湿巾 80 抽" />
        </el-form-item>

        <el-form-item label="商品图片">
          <el-upload
            class="uploader"
            :show-file-list="false"
            :http-request="handleUpload"
            accept="image/*"
          >
            <el-image v-if="form.image" :src="form.image" fit="cover" class="preview" />
            <div v-else class="upload-placeholder">
              <el-icon><Plus /></el-icon>
              <span>上传图片</span>
            </div>
          </el-upload>
          <el-input v-model="form.image" placeholder="也可以直接粘贴图片地址" class="image-input" clearable />
        </el-form-item>

        <el-form-item label="所需积分" required>
          <el-input-number v-model="form.points" :min="1" :step="100" :precision="0" />
        </el-form-item>

        <el-form-item label="库存">
          <el-input-number v-model="form.stock" :min="0" :precision="0" />
        </el-form-item>

        <el-form-item label="每人限兑">
          <el-input-number v-model="form.redeemLimit" :min="0" :max="99" :precision="0" />
          <span class="form-tip">0 表示不限，修改后仅影响之后的兑换</span>
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :precision="0" />
          <span class="form-tip">数值越大越靠前</span>
        </el-form-item>

        <el-form-item label="上架">
          <el-switch v-model="form.status" />
        </el-form-item>

        <el-form-item label="商品简述">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="200" show-word-limit />
        </el-form-item>

        <el-form-item label="商品详情">
          <el-input
            v-model="form.detail"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="商品规格、材质、适用年龄等完整介绍"
          />
        </el-form-item>

        <el-form-item label="配送说明">
          <el-input v-model="form.shippingNote" maxlength="255" placeholder="例如：48 小时内发货，节假日顺延" />
        </el-form-item>

        <el-form-item label="兑换规则">
          <el-input
            v-model="form.rules"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="例如：每人限兑 1 件，积分商品不支持无理由退换"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveGoods">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import pointsAPI from '@/api/points'
import uploadAPI from '@/api/upload'

const activeTab = ref('goods')

// ==================== 积分商品 ====================
const goodsList = ref([])
const goodsLoading = ref(false)

const dialogVisible = ref(false)
const saving = ref(false)

const emptyForm = () => ({
  id: null,
  name: '',
  image: '',
  description: '',
  detail: '',
  shippingNote: '',
  rules: '',
  points: 500,
  stock: 10,
  redeemLimit: 0,
  sort: 0,
  status: true
})

const form = reactive(emptyForm())

const resetForm = () => {
  Object.assign(form, emptyForm())
}

const loadGoods = async () => {
  goodsLoading.value = true
  try {
    // status=all：后台需要看到下架商品
    const res = await pointsAPI.getShopList({ status: 'all' })
    if (res.code === 200) goodsList.value = res.data || []
  } catch (error) {
    goodsList.value = []
  } finally {
    goodsLoading.value = false
  }
}

const openCreate = () => {
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    image: row.image || '',
    description: row.description || '',
    detail: row.detail || '',
    shippingNote: row.shippingNote || '',
    rules: row.rules || '',
    points: Number(row.points),
    stock: Number(row.stock),
    redeemLimit: Number(row.redeemLimit) || 0,
    sort: Number(row.sort || 0),
    status: !!row.status
  })
  dialogVisible.value = true
}

const handleUpload = async (options) => {
  try {
    const res = await uploadAPI.uploadImage(options.file)
    if (res.code === 200) form.image = res.data.url
  } catch (error) {
    // uploadAPI 内部已提示
  }
}

const saveGoods = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请填写商品名称')
    return
  }
  if (!form.points || Number(form.points) <= 0) {
    ElMessage.warning('兑换积分必须大于 0')
    return
  }

  const payload = {
    name: form.name.trim(),
    image: form.image,
    description: form.description,
    detail: form.detail,
    shippingNote: form.shippingNote,
    rules: form.rules,
    points: Number(form.points),
    stock: Number(form.stock),
    redeemLimit: Number(form.redeemLimit) || 0,
    sort: Number(form.sort),
    status: form.status
  }

  saving.value = true
  try {
    const res = form.id
      ? await pointsAPI.updateShopGoods(form.id, payload)
      : await pointsAPI.addShopGoods(payload)

    if (res.code === 200) {
      dialogVisible.value = false
      loadGoods()
    }
  } catch (error) {
    // api 层已提示
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (row) => {
  const nextStatus = !row.status
  try {
    const res = await pointsAPI.updateShopGoods(row.id, { status: nextStatus })
    if (res.code === 200) loadGoods()
  } catch (error) {
    // api 层已提示
  }
}

const removeGoods = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.name}」吗？已产生的兑换记录不会受影响。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    const res = await pointsAPI.removeShopGoods(row.id)
    if (res.code === 200) loadGoods()
  } catch (error) {
    // 取消或接口失败
  }
}

// ==================== 兑换记录 ====================
const exchangeList = ref([])
const exchangeTotal = ref(0)
const exchangeLoading = ref(false)

const exchangeQuery = reactive({
  page: 1,
  pageSize: 10,
  status: '',
  keyword: ''
})

const loadExchange = async () => {
  exchangeLoading.value = true
  try {
    const res = await pointsAPI.getExchangeList({
      page: exchangeQuery.page,
      pageSize: exchangeQuery.pageSize,
      status: exchangeQuery.status || undefined,
      keyword: exchangeQuery.keyword.trim() || undefined
    })
    if (res.code === 200) {
      exchangeList.value = res.data.list || []
      exchangeTotal.value = res.data.total || 0
    }
  } catch (error) {
    exchangeList.value = []
    exchangeTotal.value = 0
  } finally {
    exchangeLoading.value = false
  }
}

const handleExchangeSearch = () => {
  exchangeQuery.page = 1
  loadExchange()
}

const resetExchangeSearch = () => {
  exchangeQuery.status = ''
  exchangeQuery.keyword = ''
  exchangeQuery.page = 1
  loadExchange()
}

const changeStatus = async (row, status) => {
  try {
    const res = await pointsAPI.updateExchangeStatus(row.id, status)
    if (res.code === 200) loadExchange()
  } catch (error) {
    // api 层已提示
  }
}

const cancelExchange = async (row) => {
  try {
    await ElMessageBox.confirm(
      `取消后将退还 ${row.points} 积分并恢复库存，确定取消「${row.goodsName}」的兑换单吗？`,
      '取消兑换',
      { type: 'warning', confirmButtonText: '确定取消', cancelButtonText: '再想想' }
    )
    const res = await pointsAPI.updateExchangeStatus(row.id, '已取消')
    if (res.code === 200) {
      loadExchange()
      loadGoods()
    }
  } catch (error) {
    // 取消或接口失败
  }
}

// ==================== 工具函数 ====================
const statusTagType = (status) => {
  if (status === '待发货') return 'warning'
  if (status === '已发货') return 'primary'
  if (status === '已完成') return 'success'
  return 'info'
}

const formatTime = (time) => {
  if (!time) return '-'
  return String(time).replace('T', ' ').split('.')[0]
}

const handleTabChange = (name) => {
  if (name === 'exchange' && exchangeList.value.length === 0) loadExchange()
}

onMounted(() => {
  loadGoods()
})
</script>

<style scoped>
.points-page {
  padding: 16px;
}

.card {
  border-radius: 8px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.toolbar-tip {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
}

.thumb {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  display: block;
}

.no-image {
  font-size: 12px;
  color: #c0c4cc;
}

.points-text {
  color: #f56c6c;
  font-weight: 600;
}

.stock-empty {
  color: #f56c6c;
}

.receiver {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}

.receiver-phone {
  font-size: 13px;
  color: #303133;
}

.receiver-address {
  font-size: 12px;
  color: #909399;
}

.no-action {
  color: #c0c4cc;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.uploader {
  margin-right: 12px;
}

.upload-placeholder {
  width: 80px;
  height: 80px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8c939d;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.upload-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}

.preview {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  cursor: pointer;
}

.image-input {
  flex: 1;
  max-width: 260px;
}

.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}
</style>
