<template>
  <div class="seckill-admin">
    <el-card>
      <div class="toolbar">
        <span class="page-title">秒杀管理</span>
        <el-button type="primary" @click="openSessionDialog()">新建场次</el-button>
      </div>

      <el-table :data="sessions" v-loading="loading" border stripe>
        <el-table-column prop="name" label="场次名称" min-width="150" />
        <el-table-column label="时间范围" min-width="230">
          <template #default="{ row }">{{ fmt(row.startTime) }} ~ {{ fmt(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商品数" width="80" align="center">
          <template #default="{ row }">{{ (row.goods || []).length }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openGoodsDialog(row)">管理商品</el-button>
            <el-button size="small" @click="toggleSession(row)">
              {{ row.status === '已下线' ? '启用' : '停用' }}
            </el-button>
            <el-button size="small" type="danger" @click="removeSession(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑场次 -->
    <el-dialog v-model="sessionDialog.visible" :title="sessionDialog.form.id ? '编辑场次' : '新建场次'" width="440px">
      <el-form :model="sessionDialog.form" label-width="90px">
        <el-form-item label="场次名称">
          <el-input v-model="sessionDialog.form.name" placeholder="如：今晚 8 点场" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="sessionDialog.form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="sessionDialog.form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sessionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="sessionDialog.saving" @click="saveSession">保存</el-button>
      </template>
    </el-dialog>

    <!-- 秒杀商品管理 -->
    <el-dialog v-model="goodsDialog.visible" :title="`秒杀商品 - ${goodsDialog.session?.name || ''}`" width="880px">
      <div class="goods-toolbar">
        <el-button type="primary" size="small" @click="goodsDialog.adding = !goodsDialog.adding">
          {{ goodsDialog.adding ? '收起添加表单' : '添加商品' }}
        </el-button>
      </div>

      <div v-if="goodsDialog.adding" class="add-form">
        <el-select v-model="addForm.goodsId" filterable placeholder="选择商品" style="width: 260px">
          <el-option
            v-for="g in goodsOptions"
            :key="g.id"
            :label="`${g.name}（￥${g.price}，库存 ${g.quantity}）`"
            :value="g.id"
          />
        </el-select>
        <el-input-number v-model="addForm.seckillPrice" :min="0.01" :precision="2" placeholder="秒杀价" />
        <el-input-number v-model="addForm.stock" :min="1" :step="1" placeholder="秒杀库存" />
        <el-input-number v-model="addForm.maxPerUser" :min="1" :step="1" placeholder="每人限购" />
        <el-button type="primary" :loading="goodsDialog.saving" @click="saveGoods">添加</el-button>
      </div>

      <el-table :data="goodsDialog.session?.goods || []" border size="small">
        <el-table-column prop="goodsName" label="商品" min-width="180" />
        <el-table-column label="原价" width="90" align="center">
          <template #default="{ row }">￥{{ row.originalPrice }}</template>
        </el-table-column>
        <el-table-column label="秒杀价" width="90" align="center">
          <template #default="{ row }">
            <span class="seckill-price-text">￥{{ row.seckillPrice }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock" label="剩余库存" width="90" align="center" />
        <el-table-column prop="sold" label="已售" width="70" align="center" />
        <el-table-column prop="maxPerUser" label="限购" width="70" align="center" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="openEditGoods(row)">改价/补库存</el-button>
            <el-button size="small" type="danger" @click="removeGoods(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 编辑秒杀商品 -->
    <el-dialog v-model="editDialog.visible" title="编辑秒杀商品" width="400px">
      <el-form :model="editDialog.form" label-width="90px">
        <el-form-item label="秒杀价">
          <el-input-number v-model="editDialog.form.seckillPrice" :min="0.01" :precision="2" />
        </el-form-item>
        <el-form-item label="剩余库存">
          <el-input-number v-model="editDialog.form.stock" :min="0" :step="1" />
        </el-form-item>
        <el-form-item label="每人限购">
          <el-input-number v-model="editDialog.form.maxPerUser" :min="1" :step="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="editDialog.saving" @click="saveEditGoods">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import {
  getSeckillAdminList,
  createSeckillSession,
  updateSeckillSession,
  deleteSeckillSession,
  createSeckillGoods,
  updateSeckillGoods,
  deleteSeckillGoods
} from '@/api/seckill'

const sessions = ref([])
const goodsOptions = ref([])
const loading = ref(false)

const sessionDialog = reactive({ visible: false, saving: false, form: {} })
const goodsDialog = reactive({ visible: false, saving: false, adding: false, session: null })
const editDialog = reactive({ visible: false, saving: false, form: {} })
const addForm = reactive({ goodsId: null, seckillPrice: 1, stock: 10, maxPerUser: 1 })

const load = async () => {
  loading.value = true
  try {
    const res = await getSeckillAdminList()
    if (res.code === 200) sessions.value = res.data || []
  } finally {
    loading.value = false
  }
}

const loadGoodsOptions = async () => {
  const res = await request({ url: '/goods?status=true&page=1&pageSize=100', method: 'get' })
  if (res.code === 200) {
    const payload = res.data
    goodsOptions.value = Array.isArray(payload) ? payload : payload.list || []
  }
}

onMounted(() => { load(); loadGoodsOptions() })

const fmt = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false })
const tagType = (s) => (s === '进行中' ? 'danger' : s === '未开始' ? 'warning' : 'info')

// ---------- 场次 ----------
const openSessionDialog = (session) => {
  sessionDialog.form = session
    ? { id: session.id, name: session.name, startTime: session.startTime, endTime: session.endTime }
    : { id: null, name: '', startTime: '', endTime: '' }
  sessionDialog.visible = true
}

const saveSession = async () => {
  const f = sessionDialog.form
  if (!f.name || !f.startTime || !f.endTime) {
    ElMessage.warning('请完整填写场次名称与起止时间')
    return
  }
  sessionDialog.saving = true
  try {
    const res = f.id ? await updateSeckillSession(f.id, f) : await createSeckillSession(f)
    if (res.code === 200) {
      ElMessage.success('保存成功')
      sessionDialog.visible = false
      load()
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } finally {
    sessionDialog.saving = false
  }
}

const toggleSession = async (row) => {
  const res = await updateSeckillSession(row.id, { status: row.status === '已下线' })
  if (res.code === 200) { ElMessage.success('已更新'); load() } else { ElMessage.error(res.message || '操作失败') }
}

const removeSession = async (row) => {
  await ElMessageBox.confirm(`删除场次「${row.name}」及其下所有秒杀商品？`, '提示', { type: 'warning' })
  const res = await deleteSeckillSession(row.id)
  if (res.code === 200) { ElMessage.success('已删除'); load() } else { ElMessage.error(res.message || '删除失败') }
}

// ---------- 秒杀商品 ----------
const openGoodsDialog = (session) => {
  goodsDialog.session = session
  goodsDialog.adding = false
  goodsDialog.visible = true
}

const saveGoods = async () => {
  if (!addForm.goodsId) { ElMessage.warning('请选择商品'); return }
  goodsDialog.saving = true
  try {
    const res = await createSeckillGoods({ ...addForm, sessionId: goodsDialog.session.id })
    if (res.code === 200) {
      ElMessage.success('已添加')
      goodsDialog.adding = false
      addForm.goodsId = null
      load()
    } else {
      ElMessage.error(res.message || '添加失败')
    }
  } finally {
    goodsDialog.saving = false
  }
}

const openEditGoods = (row) => {
  editDialog.form = { id: row.id, seckillPrice: Number(row.seckillPrice), stock: row.stock, maxPerUser: row.maxPerUser }
  editDialog.visible = true
}

const saveEditGoods = async () => {
  editDialog.saving = true
  try {
    const { id, ...data } = editDialog.form
    const res = await updateSeckillGoods(id, data)
    if (res.code === 200) {
      ElMessage.success('已保存')
      editDialog.visible = false
      load()
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } finally {
    editDialog.saving = false
  }
}

const removeGoods = async (row) => {
  await ElMessageBox.confirm(`下架秒杀商品「${row.goodsName}」？已售订单不受影响`, '提示', { type: 'warning' })
  const res = await deleteSeckillGoods(row.id)
  if (res.code === 200) { ElMessage.success('已下架'); load() } else { ElMessage.error(res.message || '操作失败') }
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 18px; font-weight: bold; }
.goods-toolbar { margin-bottom: 12px; }
.add-form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 12px; background: #f8f8f8; border-radius: 6px; margin-bottom: 12px; }
.seckill-price-text { color: #f56c6c; font-weight: bold; }
</style>
