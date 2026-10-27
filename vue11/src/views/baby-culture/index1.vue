<template>
  <div class="baby-culture">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>婴儿培养</span>
          <el-button v-if="isAdmin" type="primary" @click="handleAdd">新增文章</el-button>
        </div>
      </template>

      <el-empty v-if="articleList.length === 0" description="暂无文章" />

      <div v-else class="article-list">
        <div v-for="article in articleList" :key="article.id" class="article-item" @click="viewDetail(article)">
          <div class="article-title">{{ article.title }}</div>
          <div class="article-summary">{{ article.summary }}</div>
          <div class="article-meta">
            <span v-if="article.author">作者：{{ article.author }}</span>
            <span>发布时间：{{ formatDate(article.createdAt) }}</span>
            <span>浏览：{{ article.viewCount }}次</span>
          </div>
          <div v-if="isAdmin" class="article-actions" @click.stop>
            <el-button type="primary" size="small" @click="handleEdit(article)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(article)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 文章详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="文章详情" width="700px">
      <div v-if="currentArticle" class="article-detail">
        <h2>{{ currentArticle.title }}</h2>
        <div class="detail-meta">
          <span v-if="currentArticle.author">作者：{{ currentArticle.author }}</span>
          <span>发布时间：{{ formatDate(currentArticle.createdAt) }}</span>
          <span>浏览：{{ currentArticle.viewCount }}次</span>
        </div>
        <div class="detail-content">{{ currentArticle.content }}</div>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑文章对话框 -->
    <el-dialog v-model="formDialogVisible" :title="isEdit ? '编辑文章' : '新增文章'" width="700px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入文章标题" />
        </el-form-item>
        <el-form-item label="摘要" prop="summary">
          <el-input v-model="form.summary" type="textarea" :rows="3" placeholder="请输入文章摘要" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="10" placeholder="请输入文章内容" />
        </el-form-item>
        <el-form-item label="作者" prop="author">
          <el-input v-model="form.author" placeholder="请输入作者姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="loading">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBabyCultureList, getBabyCultureDetail, createBabyCulture, updateBabyCulture, deleteBabyCulture } from '@/api/babyCulture'

const articleList = ref([])
const detailDialogVisible = ref(false)
const formDialogVisible = ref(false)
const currentArticle = ref(null)
const loading = ref(false)
const formRef = ref(null)
const isEdit = ref(false)

const form = ref({
  id: null,
  title: '',
  summary: '',
  content: '',
  author: ''
})

const rules = {
  title: [{ required: true, message: '请输入文章标题', trigger: 'blur' }],
  summary: [{ required: true, message: '请输入文章摘要', trigger: 'blur' }],
  content: [{ required: true, message: '请输入文章内容', trigger: 'blur' }]
}

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

const loadArticles = async () => {
  try {
    const res = await getBabyCultureList()
    if (res.code === 200) {
      articleList.value = res.data || []
    }
  } catch (error) {
    console.error('加载文章列表失败:', error)
  }
}

const viewDetail = async (article) => {
  try {
    const res = await getBabyCultureDetail(article.id)
    if (res.code === 200) {
      currentArticle.value = res.data
      detailDialogVisible.value = true
      loadArticles()
    }
  } catch (error) {
    ElMessage.error('获取文章详情失败')
  }
}

const handleAdd = () => {
  isEdit.value = false
  form.value = {
    id: null,
    title: '',
    summary: '',
    content: '',
    author: ''
  }
  formDialogVisible.value = true
}

const handleEdit = (article) => {
  isEdit.value = true
  form.value = {
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    author: article.author
  }
  formDialogVisible.value = true
}

const handleDelete = (article) => {
  ElMessageBox.confirm('确定要删除这篇文章吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await deleteBabyCulture(article.id)
      if (res.code === 200) {
        ElMessage.success('删除成功')
        loadArticles()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        let res
        if (isEdit.value) {
          res = await updateBabyCulture(form.value.id, form.value)
        } else {
          res = await createBabyCulture(form.value)
        }
        
        if (res.code === 200) {
          ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
          formDialogVisible.value = false
          loadArticles()
        } else {
          ElMessage.error(res.message || '操作失败')
        }
      } catch (error) {
        ElMessage.error('操作失败')
      } finally {
        loading.value = false
      }
    }
  })
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadArticles()
})
</script>

<style scoped>
.baby-culture {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-item {
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.article-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border-color: #409eff;
}

.article-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.article-summary {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.6;
}

.article-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  gap: 16px;
}

.article-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.article-detail h2 {
  text-align: center;
  margin-bottom: 20px;
}

.detail-meta {
  display: flex;
  justify-content: center;
  gap: 20px;
  color: #999;
  font-size: 14px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.detail-content {
  line-height: 1.8;
  color: #333;
  font-size: 14px;
  white-space: pre-wrap;
}
</style>
