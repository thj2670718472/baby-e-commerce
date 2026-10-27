<template>
  <div class="product-list-container">
    <div class="header">
      <h2>商品列表</h2>
      <el-button v-if="isAdmin" type="primary" @click="handleAdd">新增商品</el-button>
    </div>

    <!-- 搜索筛选 -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="商品名称">
          <el-input v-model="filterForm.name" placeholder="请输入商品名称" clearable />
        </el-form-item>
        <el-form-item label="商品分类">
          <el-select v-model="filterForm.category" placeholder="请选择分类" clearable filterable>
            <el-option
              v-for="item in categoryOptions"
              :key="item.id"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isAdmin" label="商品状态">
          <el-select v-model="filterForm.status" placeholder="请选择状态" clearable>
            <el-option label="启用" :value="true" />
            <el-option label="禁用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 商品列表表格 -->
    <el-card class="table-card" shadow="never">
      <div class="batch-actions" v-if="!isAdmin">
        <el-button 
          type="primary" 
          @click="handleBatchBuy" 
          :disabled="selectedGoods.length === 0"
        >
          批量购买
        </el-button>
        <span v-if="selectedGoods.length > 0" class="selected-count">
          已选择 {{ selectedGoods.length }} 件商品
        </span>
      </div>
      <el-table 
        v-loading="loading" 
        :data="goodsList" 
        border 
        stripe 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" v-if="!isAdmin" />
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column label="商品图片" width="150" align="center">
          <template #default="{ row }">
            <div class="image-gallery-container">
              <div v-if="row.images && row.images.length > 0" class="gallery-preview">
                <div class="preview-image">
                  <el-image 
                    :src="row.images[0]" 
                    fit="cover"
                    style="width: 80px; height: 80px; border-radius: 4px; cursor: pointer;"
                    :preview-src-list="row.images"
                    :initial-index="0"
                  />
                </div>
              </div>
              <div v-else class="no-image">
                <el-icon><Picture /></el-icon>
                <span>暂无图片</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="商品名称" min-width="150" />
        <el-table-column prop="category" label="分类" width="120" align="center" />
        <el-table-column prop="price" label="价格" width="120" align="center">
          <template #default="{ row }">
            ¥{{ Number(row.price).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="库存" width="150" align="center">
          <template #default="{ row }">
            <template v-if="isAdmin">
              {{ row.quantity }}
              <span v-if="row.quantity === 0" style="color: #f56c6c; margin-left: 4px;">(没货)</span>
              <span v-else-if="row.quantity < 50" style="color: #e6a23c; margin-left: 4px;">(急缺)</span>
              <span v-else-if="row.quantity < 100" style="color: #67c23a; margin-left: 4px;">(不多)</span>
              <span v-else style="color: #409eff; margin-left: 4px;">(充足)</span>
            </template>
            <template v-else>
              <span v-if="row.quantity === 0" style="color: #f56c6c;">没货</span>
              <span v-else-if="row.quantity < 50" style="color: #e6a23c;">急缺</span>
              <span v-else-if="row.quantity < 100" style="color: #67c23a;">不多</span>
              <span v-else style="color: #409eff;">充足</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status ? 'success' : 'danger'">
              {{ row.status ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="isAdmin" type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="info" link @click="handleDetail(row)">详情</el-button>
            <el-button v-if="isAdmin" type="danger" link @click="handleDelete(row)">删除</el-button>
            <el-button v-show="!isAdmin && row.status" :disabled="row.quantity === 0" type="success" link @click="handleBuy(row)">购买</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog 
      :title="dialogTitle" 
      v-model="dialogVisible" 
      width="750px"
      @closed="handleDialogClosed"
    >
      <el-form 
        ref="formRef"
        :model="formData" 
        :rules="formRules" 
        label-width="100px"
      >
        <!-- 商品图片多图上传 -->
        <el-form-item label="商品图片" prop="images" required>
          <div class="multi-upload-container">
            <!-- 已上传图片列表 -->
            <div class="image-list">
              <div 
                v-for="(img, index) in formData.images" 
                :key="index" 
                class="image-item"
              >
                <el-image 
                  :src="img" 
                  fit="cover" 
                  class="image-preview"
                  :preview-src-list="formData.images"
                  :initial-index="index"
                />
                <div class="image-actions">
                  <el-button 
                    type="danger" 
                    size="small" 
                    circle 
                    @click="removeImageAtIndex(index)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div v-if="index === 0" class="cover-badge">封面</div>
              </div>
              
              <!-- 上传按钮 - 最多5张 -->
              <div v-if="formData.images.length < 5" class="upload-item">
                <el-upload
                  class="image-uploader"
                  action="#"
                  :show-file-list="false"
                  :before-upload="handleBeforeUpload"
                  :http-request="handleUploadImage"
                  :disabled="uploading"
                  accept="image/jpeg,image/png,image/jpg"
                >
                  <div class="upload-placeholder">
                    <el-icon class="upload-icon"><Plus /></el-icon>
                    <span>上传图片</span>
                    <span class="upload-count">{{ formData.images.length }}/5</span>
                  </div>
                </el-upload>
              </div>
            </div>
            
            <div class="upload-tip">
              <div>支持jpg、png格式，大小不超过8MB，最多上传5张图片</div>
              <div>建议尺寸：800x800像素，第一张图片将作为封面</div>
              <div v-if="uploading" style="color: #409eff;">
                <el-icon class="is-loading"><Loading /></el-icon>
                图片上传中...
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="商品名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入商品名称" maxlength="50" show-word-limit />
        </el-form-item>

        <el-form-item label="商品分类" prop="category">
          <el-select v-model="formData.category" placeholder="请选择分类" style="width: 100%" filterable>
            <el-option
              v-for="item in categoryOptions"
              :key="item.id"
              :label="item.name"
              :value="item.name"
            />
          </el-select>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="商品价格" prop="price">
              <el-input-number 
                v-model="formData.price" 
                :min="0" 
                :precision="2" 
                :step="1"
                style="width: 100%" 
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品库存" prop="quantity">
              <el-input-number v-model="formData.quantity" :min="0" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="商品状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio :value="true">上架</el-radio>
            <el-radio :value="false">下架</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="商品描述" prop="description">
          <el-input 
            v-model="formData.description" 
            type="textarea" 
            placeholder="请输入商品描述" 
            rows="4" 
            maxlength="500" 
            show-word-limit 
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 商品详情弹窗 -->
    <el-dialog 
      title="商品详情" 
      v-model="detailDialogVisible" 
      width="750px"
    >
      <div class="detail-container">
        <div class="detail-images">
          <div class="detail-main-image">
            <el-image 
              v-if="detailData.images && detailData.images.length > 0" 
              :src="detailData.images[detailCurrentIndex]" 
              fit="contain" 
              style="width: 300px; height: 300px; border-radius: 8px;"
              :preview-src-list="detailData.images"
              :initial-index="detailCurrentIndex"
            />
            <div v-else class="no-image" style="width: 300px; height: 300px;">
              <el-icon><Picture /></el-icon>
              <span>暂无图片</span>
            </div>
          </div>
          
          <!-- 缩略图列表 -->
          <div v-if="detailData.images && detailData.images.length > 1" class="detail-thumbnails">
            <div 
              v-for="(img, index) in detailData.images" 
              :key="index"
              class="thumbnail-item"
              :class="{ active: detailCurrentIndex === index }"
              @click="detailCurrentIndex = index"
            >
              <el-image :src="img" fit="cover" style="width: 60px; height: 60px; border-radius: 4px;" />
            </div>
          </div>
        </div>
        
        <div class="detail-info">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="商品名称">{{ detailData.name }}</el-descriptions-item>
            <el-descriptions-item label="商品分类">{{ detailData.category }}</el-descriptions-item>
            <el-descriptions-item label="商品价格">¥{{ Number(detailData.price).toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="商品库存">
              <template v-if="isAdmin">
                {{ detailData.quantity }}
                <span v-if="detailData.quantity === 0" style="color: #f56c6c; margin-left: 8px;">(没货)</span>
                <span v-else-if="detailData.quantity < 50" style="color: #e6a23c; margin-left: 8px;">(急缺)</span>
                <span v-else-if="detailData.quantity < 100" style="color: #67c23a; margin-left: 8px;">(不多)</span>
                <span v-else style="color: #409eff; margin-left: 8px;">(充足)</span>
              </template>
              <template v-else>
                <span v-if="detailData.quantity === 0" style="color: #f56c6c;">没货</span>
                <span v-else-if="detailData.quantity < 50" style="color: #e6a23c;">急缺</span>
                <span v-else-if="detailData.quantity < 100" style="color: #67c23a;">不多</span>
                <span v-else style="color: #409eff;">充足</span>
              </template>
            </el-descriptions-item>
            <el-descriptions-item label="商品状态">{{ detailData.status ? '上架' : '下架' }}</el-descriptions-item>
            <el-descriptions-item label="商品描述">
              <div v-if="detailData.description && detailData.description !== ''" class="description-content">
                {{ detailData.description }}
              </div>
              <div v-else class="no-description">暂无描述</div>
            </el-descriptions-item>
          </el-descriptions>
          
          <!-- 评价区域 -->
          <el-divider>商品评价</el-divider>
          
          <div class="review-section">
            <!-- 评价统计 -->
            <div class="review-stats" v-if="reviewStats">
              <div class="rating-overview">
                <div class="average-rating">
                  <span class="rating-number">{{ reviewStats.avgRating }}</span>
                  <el-rate :model-value="parseFloat(reviewStats.avgRating)" disabled show-score text-color="#ff9900" />
                </div>
                <div class="total-reviews">共 {{ reviewStats.total }} 条评价</div>
              </div>
              <div class="rating-distribution">
                <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="rating-bar">
                  <span class="star-label">{{ star }}星</span>
                  <el-progress :percentage="getRatingPercentage(star)" :stroke-width="8" :show-text="false" />
                  <span class="count">{{ reviewStats.ratingCounts[star] || 0 }}</span>
                </div>
              </div>
            </div>
            
            <!-- 写评价按钮 -->
            <div class="write-review-btn" v-if="!isAdmin && fromOrderDetail">
              <el-button type="primary" @click="showReviewDialog">写评价</el-button>
            </div>
            
            <!-- 评价列表 -->
            <div class="review-list">
              <div v-if="reviews.length > 0">
                <div v-for="review in reviews" :key="review.id" class="review-item">
                  <div class="review-header">
                    <span class="username">匿名用户</span>
                    <el-rate :model-value="review.rating" disabled />
                    <span class="review-time">{{ formatTime(review.createTime) }}</span>
                  </div>
                  <div class="review-content">{{ review.content }}</div>
                </div>
              </div>
              <el-empty v-else description="暂无评价"></el-empty>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="detailDialogVisible = false">关闭</el-button>
          <el-button type="primary" v-if="!isAdmin && detailData.status && detailData.quantity > 0 && fromOrderDetail" @click="handleBuyFromDetail">再次购买</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 购买弹窗 -->
    <el-dialog 
      title="购买商品" 
      v-model="buyDialogVisible" 
      width="500px"
    >
      <el-form 
        ref="buyFormRef"
        :model="buyData" 
        :rules="buyFormRules" 
        label-width="100px"
      >
        <el-form-item label="商品名称" prop="productName">
          <el-input v-model="buyData.productName" disabled />
        </el-form-item>
        <el-form-item label="商品价格" prop="productPrice">
          <el-input v-model="buyData.productPrice" disabled />
        </el-form-item>
        <el-form-item label="收货地址">
          <el-select 
            v-model="selectedAddress" 
            placeholder="请选择收货地址" 
            style="width: 100%"
            :loading="loadingAddresses"
            :sortable="false"
            value-key="id"
          >
            <el-option 
              v-for="addr in addresses" 
              :key="addr.id" 
              :label="`${addr.name} ${addr.phone} ${addr.province}${addr.city}${addr.district}${addr.detail}`" 
              :value="addr"
            >
              <div class="address-option">
                <div class="address-info">
                  <span class="address-name">{{ addr.name }}</span>
                  <span class="address-phone">{{ addr.phone }}</span>
                  <el-tag v-if="addr.isDefault" type="success" size="small">默认</el-tag>
                </div>
                <div class="address-detail">{{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}</div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="购买数量" prop="quantity">
          <el-input-number 
            v-model="buyData.quantity" 
            :min="1" 
            :max="detailData.quantity" 
            :step="1"
            style="width: 100%" 
          />
        </el-form-item>
        <el-form-item label="总价">
          <el-input 
            v-model="totalPrice" 
            disabled 
            style="color: #f56c6c; font-weight: bold;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="buyDialogVisible = false">取消</el-button>
          <el-button type="warning" @click="handleBuySubmit()">确认购买</el-button>
          <el-button type="primary" @click="handlePay">支付并购买</el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- 评价弹窗 -->
    <el-dialog 
      title="写评价" 
      v-model="reviewDialogVisible" 
      width="500px"
    >
      <el-form 
        ref="reviewFormRef"
        :model="reviewForm" 
        :rules="reviewFormRules" 
        label-width="80px"
      >
        <el-form-item label="评分" prop="rating">
          <el-rate v-model="reviewForm.rating" :colors="['#99A9BF', '#F7BA2A', '#FF9900']" />
        </el-form-item>
        <el-form-item label="评价内容" prop="content">
          <el-input 
            v-model="reviewForm.content" 
            type="textarea" 
            :rows="4" 
            placeholder="请输入您的评价（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="reviewDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitReview" :loading="submittingReview">提交评价</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 批量购买弹窗 -->
    <el-dialog 
      title="批量购买" 
      v-model="batchBuyDialogVisible" 
      width="700px"
    >
      <el-form 
        ref="batchBuyFormRef"
        :model="batchBuyData" 
        label-width="100px"
      >
        <el-form-item label="收货地址">
          <el-select 
            v-model="selectedAddress" 
            placeholder="请选择收货地址" 
            style="width: 100%"
            :loading="loadingAddresses"
            :sortable="false"
            value-key="id"
          >
            <el-option 
              v-for="addr in addresses" 
              :key="addr.id" 
              :label="`${addr.name} ${addr.phone} ${addr.province}${addr.city}${addr.district}${addr.detail}`" 
              :value="addr"
            >
              <div class="address-option">
                <div class="address-info">
                  <span class="address-name">{{ addr.name }}</span>
                  <span class="address-phone">{{ addr.phone }}</span>
                  <el-tag v-if="addr.isDefault" type="success" size="small">默认</el-tag>
                </div>
                <div class="address-detail">{{ addr.province }}{{ addr.city }}{{ addr.district }}{{ addr.detail }}</div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="商品列表">
          <el-table :data="batchBuyData.goods" border stripe style="width: 100%">
            <el-table-column prop="name" label="商品名称" min-width="200" />
            <el-table-column prop="price" label="价格" width="100" align="center">
              <template #default="{ row }">
                ¥{{ Number(row.price).toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="购买数量" width="150" align="center">
              <template #default="{ row }">
                <el-input-number 
                  v-model="row.quantity" 
                  :min="1" 
                  :max="row.originalQuantity" 
                  :step="1"
                  style="width: 100%" 
                />
              </template>
            </el-table-column>
            <el-table-column prop="subtotal" label="小计" width="120" align="center">
              <template #default="{ row }">
                ¥{{ (Number(row.price) * row.quantity).toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>

        <el-form-item label="总价">
          <el-input 
            v-model="batchTotalPrice" 
            disabled 
            style="color: #f56c6c; font-weight: bold;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="batchBuyDialogVisible = false">取消</el-button>
          <el-button type="warning" @click="handleBatchBuySubmit(false)">确认购买</el-button>
          <el-button type="primary" @click="handleBatchBuySubmit(true)">支付并购买</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Picture, Loading, ArrowLeft, ArrowRight, Delete } from '@element-plus/icons-vue'
import goodsAPI from '@/api/goods'
import categoryAPI from '@/api/category'
import reviewAPI from '@/api/review'
import { createOrder } from '@/api/order'
import addressAPI from '@/api/address'

// 判断是否为管理员
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

// 数据列表
const goodsList = ref([])
const loading = ref(false)
const categoryOptions = ref([])
const uploading = ref(false)



// 筛选表单
const filterForm = reactive({
  name: '',
  category: '',
  status: ''
})

// 分页
const pagination = reactive({
  page: 1,
  limit: 10,
  total: 0
})

// 弹窗相关
const dialogVisible = ref(false)
const dialogTitle = ref('新增商品')
const submitLoading = ref(false)
const formRef = ref(null)
const formData = reactive({
  id: '',
  name: '',
  category: '',
  price: 0,
  quantity: 0,
  status: true,
  images: [], // 图片数组
  originalImages: [], // 原始图片数组
  description: ''
})

// 详情弹窗相关
const detailDialogVisible = ref(false)
const detailCurrentIndex = ref(0)
const fromOrderDetail = ref(false)
const detailData = reactive({
  id: '',
  name: '',
  category: '',
  price: 0,
  quantity: 0,
  status: true,
  images: [],
  description: ''
})

// 评价相关
const reviews = ref([])
const reviewStats = ref(null)
const reviewDialogVisible = ref(false)
const reviewFormRef = ref(null)
const reviewForm = reactive({
  rating: 5,
  content: ''
})
const submittingReview = ref(false)

// 评价表单验证规则
const reviewFormRules = {
  rating: [
    { required: true, message: '请选择评分', trigger: 'change' }
  ]
}

// 购买弹窗相关
const buyDialogVisible = ref(false)
const buyData = reactive({
  productId: '',
  productName: '',
  productPrice: 0,
  quantity: 1
})

// 批量购买弹窗相关
const batchBuyDialogVisible = ref(false)
const batchBuyData = reactive({
  goods: []
})

// 地址相关
const addresses = ref([])
const selectedAddress = ref(null)
const loadingAddresses = ref(false)

// 批量选择相关
const selectedGoods = ref([])



// 上传配置
const uploadUrl = '/api/upload/images' // 多图上传接口

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入商品名称', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择商品分类', trigger: 'change' },
    {
      validator: async (rule, value, callback) => {
        if (!value) {
          return callback();
        }
        try {
          // 调用后端API检查分类状态
          const res = await categoryAPI.getByName(value);
          if (res.code === 200 && res.data) {
            if (res.data.status === false) {
              callback(new Error('该类商品被禁用'));
            } else {
              callback();
            }
          } else {
            // 分类不存在，不允许创建新分类
            callback(new Error('请选择已有分类'));
          }
        } catch (error) {
          console.error('验证分类失败:', error);
          // 验证失败时，不允许创建新分类
          callback(new Error('请选择已有分类'));
        }
      },
      trigger: ['blur', 'change']
    }
  ],
  price: [
    { required: true, message: '请输入商品价格', trigger: 'blur' },
    { type: 'number', min: 0, message: '价格必须大于等于0', trigger: 'blur' }
  ],
  quantity: [
    { required: true, message: '请输入商品库存', trigger: 'blur' },
    { type: 'number', min: 0, message: '库存必须大于等于0', trigger: 'blur' }
  ],
  images: [
    { required: true, message: '请至少上传一张商品图片', trigger: 'change', validator: (rule, value, callback) => {
      if (!formData.images || formData.images.length === 0) {
        callback(new Error('请至少上传一张商品图片'))
      } else {
        callback()
      }
    } }
  ]
}

// 购买表单验证规则
const buyFormRules = {
  quantity: [
    { required: true, message: '请输入购买数量', trigger: 'blur' },
    { type: 'number', min: 1, message: '购买数量必须大于0', trigger: 'blur' }
  ]
}

// 计算总价
const totalPrice = computed(() => {
  return `¥${(buyData.quantity * buyData.productPrice).toFixed(2)}`
})

// 购买表单引用
const buyFormRef = ref(null)

// 批量购买表单引用
const batchBuyFormRef = ref(null)

// 计算批量购买总价
const batchTotalPrice = computed(() => {
  const total = batchBuyData.goods.reduce((sum, item) => {
    return sum + (Number(item.price) * item.quantity)
  }, 0)
  return `¥${total.toFixed(2)}`
})

// 加载分类选项
const loadCategories = async () => {
  try {
    const res = await categoryAPI.getEnabledList()
    if (res.code === 200) {
      categoryOptions.value = res.data || []
    }
  } catch (error) {
    console.error('加载分类列表失败:', error)
  }
}

// 加载商品列表
const loadGoods = async () => {
  loading.value = true
  try {
    const res = await goodsAPI.getList()
    if (res.code === 200) {
      let list = res.data || []
      
      // 处理图片数据
      list = list.map(item => {
        let images = item.images || []
        if (typeof images === 'string') {
          try {
            images = JSON.parse(images)
          } catch(e) {
            images = []
          }
        }
        // 兼容旧数据
        if (images.length === 0 && item.image) {
          images = [item.image]
        }
        return {
          ...item,
          images: Array.isArray(images) ? images : []
        }
      })
      
      // 应用筛选
      let filteredList = [...list]
      
      // 非管理员用户只显示上架商品
      if (!isAdmin.value) {
        filteredList = filteredList.filter(item => item.status === true)
      }
      
      if (filterForm.name) {
        filteredList = filteredList.filter(item => item.name && item.name.includes(filterForm.name))
      }
      if (filterForm.category) {
        filteredList = filteredList.filter(item => item.category === filterForm.category)
      }
      if (filterForm.status !== '') {
        filteredList = filteredList.filter(item => item.status === filterForm.status)
      }
      
      pagination.total = filteredList.length
      const start = (pagination.page - 1) * pagination.limit
      const end = start + pagination.limit
      goodsList.value = filteredList.slice(start, end)
      
      // 检查URL参数中是否有goodsId，如果有则自动打开详情弹窗
      await checkGoodsIdParam()
    } else {
      ElMessage.error(res.message || '加载商品列表失败')
    }
  } catch (error) {
    console.error('加载商品列表失败:', error)
    ElMessage.error('加载商品列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadGoods()
}

// 检查URL参数中的goodsId
const checkGoodsIdParam = async () => {
  const urlParams = new URLSearchParams(window.location.search)
  const goodsId = urlParams.get('goodsId')
  const review = urlParams.get('review') === 'true'
  if (goodsId) {
    // 从订单详情页面跳转过来
    fromOrderDetail.value = true
    // 查找对应商品
    const goods = goodsList.value.find(item => item.id == parseInt(goodsId))
    if (goods) {
      // 直接设置详情数据，不调用handleDetail方法，避免覆盖fromOrderDetail
      detailData.id = goods.id
      detailData.name = goods.name || ''
      detailData.category = goods.category || ''
      detailData.price = goods.price || 0
      detailData.quantity = goods.quantity || 0
      detailData.status = goods.status === true || goods.status === 1
      detailData.images = [...(goods.images || [])]
      detailData.description = goods.description || ''
      detailCurrentIndex.value = 0
      detailDialogVisible.value = true
      
      // 加载评价数据
      await loadReviews(goods.id)
      await loadReviewStats(goods.id)
      
      // 如果需要评论，自动打开评价弹窗
      if (review) {
        setTimeout(() => {
          showReviewDialog()
        }, 500)
      }
      // 从URL中移除参数
      urlParams.delete('goodsId')
      urlParams.delete('review')
      const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }
}

// 重置筛选
const handleReset = () => {
  filterForm.name = ''
  filterForm.category = ''
  filterForm.status = ''
  handleSearch()
}

// 分页大小改变
const handleSizeChange = (val) => {
  pagination.limit = val
  loadGoods()
}

// 页码改变
const handleCurrentChange = (val) => {
  pagination.page = val
  loadGoods()
}

// 新增
const handleAdd = () => {
  dialogTitle.value = '新增商品'
  formData.id = ''
  formData.name = ''
  formData.category = ''
  formData.price = 0
  formData.quantity = 0
  formData.status = true
  formData.images = []
  formData.originalImages = []
  formData.description = ''
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row) => {
  dialogTitle.value = '编辑商品'
  formData.id = row.id
  formData.name = row.name || ''
  formData.category = row.category || ''
  formData.price = Number(row.price) || 0
  formData.quantity = Number(row.quantity) || 0
  formData.status = row.status === true || row.status === 1
  formData.images = [...(row.images || [])]
  formData.originalImages = [...(row.images || [])]
  formData.description = row.description || ''
  dialogVisible.value = true
}

// 详情
const handleDetail = async (row) => {
  // 直接点击详情按钮，不是从订单详情页面跳转过来
  fromOrderDetail.value = false
  detailData.id = row.id
  detailData.name = row.name || ''
  detailData.category = row.category || ''
  detailData.price = row.price || 0
  detailData.quantity = row.quantity || 0
  detailData.status = row.status === true || row.status === 1
  detailData.images = [...(row.images || [])]
  detailData.description = row.description || ''
  detailCurrentIndex.value = 0
  detailDialogVisible.value = true
  
  // 加载评价数据
  await loadReviews(row.id)
  await loadReviewStats(row.id)
}

// 从详情弹窗购买
const handleBuyFromDetail = async () => {
  // 填充商品信息到购买表单
  buyData.productId = detailData.id
  buyData.productName = detailData.name
  buyData.productPrice = Number(detailData.price)
  buyData.quantity = 1
  
  // 加载地址列表
  await loadAddresses()
  
  // 关闭详情弹窗
  detailDialogVisible.value = false
  
  // 打开购买弹窗
  buyDialogVisible.value = true
}

// 加载评价列表
const loadReviews = async (goodsId) => {
  try {
    const res = await reviewAPI.getGoodsReviews(goodsId)
    if (res.code === 200) {
      reviews.value = res.data || []
    }
  } catch (error) {
    console.error('加载评价失败:', error)
  }
}

// 加载评价统计
const loadReviewStats = async (goodsId) => {
  try {
    const res = await reviewAPI.getReviewStats(goodsId)
    if (res.code === 200) {
      reviewStats.value = res.data
    }
  } catch (error) {
    console.error('加载评价统计失败:', error)
  }
}

// 计算评分百分比
const getRatingPercentage = (star) => {
  if (!reviewStats.value || reviewStats.value.total === 0) return 0
  const count = reviewStats.value.ratingCounts[star] || 0
  return Math.round((count / reviewStats.value.total) * 100)
}

// 显示评价弹窗
const showReviewDialog = () => {
  reviewForm.rating = 5
  reviewForm.content = ''
  reviewDialogVisible.value = true
}

// 提交评价
const submitReview = async () => {
  if (!reviewFormRef.value) return
  
  try {
    await reviewFormRef.value.validate()
    
    const userStr = sessionStorage.getItem('user')
    if (!userStr) {
      ElMessage.error('请先登录')
      return
    }
    
    const user = JSON.parse(userStr)
    
    submittingReview.value = true
    
    const res = await reviewAPI.submit({
      goodsId: detailData.id,
      userId: user.id,
      userName: user.username,
      rating: reviewForm.rating,
      content: reviewForm.content
    })
    
    if (res.code === 200) {
      reviewDialogVisible.value = false
      // 重新加载评价数据
      await loadReviews(detailData.id)
      await loadReviewStats(detailData.id)
    }
  } catch (error) {
    console.error('提交评价失败:', error)
  } finally {
    submittingReview.value = false
  }
}

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-'
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(`确认删除商品"${row.name}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await goodsAPI.remove(row.id)
      if (res.code === 200) {
        loadGoods()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})  
}

// 加载地址列表
const loadAddresses = async () => {
  const userStr = sessionStorage.getItem('user')
  if (!userStr) {
    ElMessage.error('请先登录')
    return
  }
  
  let user
  try {
    user = JSON.parse(userStr)
  } catch (e) {
    ElMessage.error('登录信息已失效，请重新登录')
    return
  }
  loadingAddresses.value = true
  
  try {
    const res = await addressAPI.getList(user.id)
    if (res.code === 200) {
      addresses.value = res.data || []
      console.log('Loaded addresses:', addresses.value)
      // 优先选择默认地址
      const defaultAddress = addresses.value.find(addr => addr.isDefault)
      if (defaultAddress) {
        console.log('Selected default address:', defaultAddress)
        selectedAddress.value = defaultAddress
      } else if (addresses.value.length > 0) {
        // 如果没有默认地址，选择第一个地址
        console.log('Selected first address:', addresses.value[0])
        selectedAddress.value = addresses.value[0]
      } else {
        selectedAddress.value = null
      }
    }
  } catch (error) {
    console.error('加载地址列表失败:', error)
    ElMessage.error('加载地址列表失败')
  } finally {
    loadingAddresses.value = false
  }
}

// 购买
const handleBuy = async (row) => {
  // 填充商品信息到购买表单
  buyData.productId = row.id
  buyData.productName = row.name
  buyData.productPrice = Number(row.price)
  buyData.quantity = 1
  
  // 同时填充详情数据，用于显示库存限制
  detailData.quantity = row.quantity
  
  // 加载地址列表
  await loadAddresses()
  
  // 打开购买弹窗
  buyDialogVisible.value = true
}

// 处理支付
const handlePay = () => {
  console.log('handlePay called')
  handleBuySubmit(true)
}

// 处理选择变化
const handleSelectionChange = (val) => {
  selectedGoods.value = val
}

// 批量购买
const handleBatchBuy = async () => {
  // 填充商品信息到批量购买表单
  batchBuyData.goods = selectedGoods.value.map(item => ({
    goodsId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: 1,
    originalQuantity: item.quantity,
    image: item.images && item.images.length > 0 ? item.images[0] : ''
  }))
  
  // 加载地址列表
  await loadAddresses()
  
  // 打开批量购买弹窗
  batchBuyDialogVisible.value = true
}

// 处理批量购买提交
const handleBatchBuySubmit = async (isPaid = false) => {
  // 验证是否选择了地址
  if (!selectedAddress.value) {
    ElMessage.error('请选择收货地址')
    return
  }
  
  // 验证是否有商品
  if (batchBuyData.goods.length === 0) {
    ElMessage.error('请选择要购买的商品')
    return
  }
  
  try {
    // 获取当前用户信息
    const userStr = sessionStorage.getItem('user')
    if (!userStr) {
      ElMessage.error('请先登录')
      return
    }
    
    const user = JSON.parse(userStr)
    
    // 计算总金额
    const totalAmount = batchBuyData.goods.reduce((sum, item) => {
      return sum + (Number(item.price) * item.quantity)
    }, 0)
    
    // 构建订单数据
    const orderData = {
      userId: user.id,
      userName: user.username,
      totalAmount: totalAmount,
      status: isPaid ? '已付款' : '待付款',
      paymentMethod: '在线支付',
      orderTime: new Date().toISOString(),
      orderNo: 'ORD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100),
      goods: batchBuyData.goods.map(item => ({
        goodsId: item.goodsId,
        goodsName: item.name,
        goodsImage: item.image ? item.image.substring(0, 255) : '',
        price: item.price,
        quantity: item.quantity,
        subtotal: Number(item.price) * item.quantity
      }))
    }
    
    // 添加地址信息
    if (selectedAddress.value) {
      orderData.address = `${selectedAddress.value.province}${selectedAddress.value.city}${selectedAddress.value.district}${selectedAddress.value.detail}`
      orderData.phone = selectedAddress.value.phone
    }
    
    // 调用订单API创建订单
    const res = await createOrder(orderData)
    if (res.code === 200) {
      if (isPaid) {
        ElMessage.success('支付并购买成功！')
      } else {
        ElMessage.success('购买成功！')
      }
      batchBuyDialogVisible.value = false
      
      // 清空选择
      selectedGoods.value = []
      
      // 重新加载商品列表（更新库存）
      loadGoods()
    } else {
      ElMessage.error(res.message || '购买失败')
    }
  } catch (error) {
    console.error('购买失败:', error)
    ElMessage.error('购买失败，请重试')
  }
}

// 处理购买提交
const handleBuySubmit = async (isPaid = false) => {
  console.log('handleBuySubmit called, isPaid:', isPaid)
  if (!buyFormRef.value) return
  
  // 验证是否选择了地址
  if (!selectedAddress.value) {
    ElMessage.error('请选择收货地址')
    return
  }
  
  try {
    await buyFormRef.value.validate()
    
    // 获取当前用户信息
    const userStr = sessionStorage.getItem('user')
    if (!userStr) {
      ElMessage.error('请先登录')
      return
    }
    
    const user = JSON.parse(userStr)
    
    // 构建订单数据
    const orderData = {
      userId: user.id,
      userName: user.username,
      totalAmount: buyData.quantity * buyData.productPrice,
      status: isPaid ? '已付款' : '待付款',
      paymentMethod: '在线支付',
      orderTime: new Date().toISOString(),
      orderNo: 'ORD' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 100),
      goods: [{
        goodsId: buyData.productId,
        goodsName: buyData.productName,
        goodsImage: detailData.images && detailData.images.length > 0 ? detailData.images[0] : '',
        price: buyData.productPrice,
        quantity: buyData.quantity,
        subtotal: buyData.quantity * buyData.productPrice
      }]
    }
    
    // 添加地址信息
    if (selectedAddress.value) {
      orderData.address = `${selectedAddress.value.province}${selectedAddress.value.city}${selectedAddress.value.district}${selectedAddress.value.detail}`
      orderData.phone = selectedAddress.value.phone
    }
    
    // 调用订单API创建订单
    const res = await createOrder(orderData)
    if (res.code === 200) {
      if (isPaid) {
        ElMessage.success('支付并购买成功！')
      } else {
        ElMessage.success('购买成功！')
      }
      buyDialogVisible.value = false
      
      // 重新加载商品列表（更新库存）
      loadGoods()
    } else {
      ElMessage.error(res.message || '购买失败')
    }
  } catch (error) {
    console.error('购买失败:', error)
    ElMessage.error('购买失败，请重试')
  }
}

// 删除指定索引的图片
const removeImageAtIndex = (index) => {
  if (formData.images.length <= 1) {
    ElMessage.warning('至少保留一张图片')
    return
  }
  formData.images.splice(index, 1)
  ElMessage.info('图片已删除')
}

// 文件上传前校验
const handleBeforeUpload = (file) => {
  const isImage = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/jpg'
  const isLt8M = file.size / 1024 / 1024 < 8

  if (!isImage) {
    ElMessage.error('只能上传 JPG/PNG 格式的图片文件！')
    return false
  }
  if (!isLt8M) {
    ElMessage.error('图片大小不能超过 8MB！')
    return false
  }
  uploading.value = true
  return true
}

// 上传成功处理
const handleUploadSuccess = (response, file) => {
  uploading.value = false
  if (response.code === 200) {
    // 根据后端返回结构获取图片URL
    const imageUrl = response.data?.url || response.data?.urls?.[0] || response.data
    if (imageUrl) {
      formData.images.push(imageUrl)
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error('上传失败：未获取到图片地址')
    }
  } else {
    ElMessage.error(response.message || '图片上传失败')
  }
}

// 上传失败处理
const handleUploadError = (error) => {
  uploading.value = false
  console.error('上传错误:', error)
  ElMessage.error('图片上传失败，请重试')
}

// 压缩图片 - 优化版，确保压缩后变小
const compressImage = (base64, maxWidth = 1024, maxHeight = 1024, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = base64
    img.onload = () => {
      let width = img.width
      let height = img.height
      
      // 如果图片尺寸超过限制，进行等比缩放
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      
      // 创建canvas进行压缩
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      
      // 统一输出为JPEG格式，质量可调
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
      resolve(compressedBase64)
    }
    img.onerror = reject
  })
}

// 上传图片
const handleUploadImage = async ({ file }) => {
  uploading.value = true
  const loadingMsg = ElMessage({
    message: '图片处理中...',
    type: 'info',
    duration: 0
  })
  
  try {
    // 使用 FileReader 读取图片
    const reader = new FileReader()
    reader.readAsDataURL(file)
    
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
    })
    
    // 计算原图大小
    const originalSize = (base64.length * 0.75) / (1024 * 1024)
    console.log(`原图大小: ${originalSize.toFixed(2)}MB`)
    
    // 固定压缩参数，确保压缩后变小
    let maxWidth = 800
    let maxHeight = 800
    let quality = 0.7
    
    // 如果原图小于500KB，可以适当提高质量
    if (originalSize < 0.5) {
      quality = 0.85
      maxWidth = 1200
      maxHeight = 1200
    } else if (originalSize < 1) {
      quality = 0.8
      maxWidth = 1000
      maxHeight = 1000
    }
    
    // 压缩图片
    const compressedBase64 = await compressImage(base64, maxWidth, maxHeight, quality)
    
    // 计算压缩后大小
    const compressedSize = (compressedBase64.length * 0.75) / (1024 * 1024)
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
    console.log(`压缩后大小: ${compressedSize.toFixed(2)}MB，压缩比例: ${compressionRatio}%`)
    
    // 更新表单数据 - 添加到图片数组
    formData.images.push(compressedBase64)
    
    loadingMsg.close()
    if (compressedSize < originalSize) {
      ElMessage.success(`图片上传成功 (压缩后: ${compressedSize.toFixed(2)}MB，节省 ${compressionRatio}% 空间)`)
    } else {
      ElMessage.success('图片上传成功')
    }
  } catch (error) {
    console.error('上传失败:', error)
    loadingMsg.close()
    ElMessage.error('图片上传失败，请重试')
  } finally {
    uploading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  // 手动验证图片
  if (!formData.images || formData.images.length === 0) {
    ElMessage.error('请至少上传一张商品图片')
    return
  }
  
  try {
    await formRef.value.validate()
    
    // 检查分类状态：通过API检查分类状态
    try {
      const res = await categoryAPI.getByName(formData.category);
      if (res.code === 200 && res.data) {
        if (res.data.status === false) {
          ElMessage.error('该类商品被禁用，无法上架')
          return
        }
      }
    } catch (error) {
      console.error('验证分类状态失败:', error);
    }
    
    submitLoading.value = true
    
    const submitData = {
      name: formData.name.trim(),
      quantity: Number(formData.quantity),
      category: formData.category,
      price: Number(formData.price),
      status: Boolean(formData.status),
      images: formData.images, // 图片URL数组
      description: formData.description.trim()
    }
    
    console.log('提交的数据:', submitData)
    
    let res
    if (formData.id) {
      res = await goodsAPI.update(formData.id, submitData)
    } else {
      res = await goodsAPI.add(submitData)
    }
    
    if (res.code === 200) {
      ElMessage.success(formData.id ? '更新成功' : '新增成功')
      dialogVisible.value = false
      await loadGoods()
    } else {
      ElMessage.error(res.message || '操作失败')
    }
  } catch (error) {
    console.error('提交失败:', error)
    if (error.response) {
      ElMessage.error(error.response.data?.message || `服务器错误: ${error.response.status}`)
    } else if (error.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('操作失败，请重试')
    }
  } finally {
    submitLoading.value = false
  }
}

// 弹窗关闭后的回调
const handleDialogClosed = () => {
  formRef.value?.resetFields()
  uploading.value = false
}

// 组件挂载时加载数据
onMounted(() => {
  loadGoods()
  loadCategories()
})
</script>

<style scoped>
.product-list-container {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.filter-card,
.table-card {
  margin-bottom: 20px;
  border-radius: 8px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.selected-count {
  color: #606266;
  font-size: 14px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 列表中的图片画廊样式 */
.image-gallery-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.preview-image {
  display: flex;
  justify-content: center;
  align-items: center;
}

.gallery-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gallery-controls .el-button {
  width: 24px;
  height: 24px;
  padding: 0;
}

.image-index {
  font-size: 12px;
  color: #909399;
}

.no-image {
  width: 80px;
  height: 80px;
  background-color: #f5f7fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 24px;
}

.no-image span {
  font-size: 12px;
  margin-top: 4px;
}

/* 多图上传样式 */
.multi-upload-container {
  width: 100%;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  background-color: #fafafa;
}

.image-item .image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-actions {
  opacity: 1;
}

.cover-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(64, 158, 255, 0.8);
  color: white;
  font-size: 10px;
  text-align: center;
  padding: 2px;
}

.upload-item {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  border: 1px dashed #d9d9d9;
  background-color: #fafafa;
  transition: all 0.3s;
}

.upload-item:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.image-uploader {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.upload-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.upload-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.upload-placeholder span {
  font-size: 12px;
}

.upload-count {
  font-size: 10px;
  color: #c0c4cc;
  margin-top: 2px;
}

.upload-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.upload-tip div {
  margin-top: 2px;
}

.upload-tip .is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

:deep(.el-dialog__body) {
  padding-top: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 评价区域样式 */
.review-section {
  margin-top: 20px;
}

.review-stats {
  display: flex;
  gap: 40px;
  margin-bottom: 30px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.rating-overview {
  text-align: center;
  min-width: 150px;
}

.average-rating {
  margin-bottom: 10px;
}

.rating-number {
  font-size: 48px;
  font-weight: bold;
  color: #ff9900;
  margin-right: 10px;
}

.total-reviews {
  color: #909399;
  font-size: 14px;
}

.rating-distribution {
  flex: 1;
  max-width: 400px;
}

.rating-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.star-label {
  width: 30px;
  color: #606266;
  font-size: 14px;
}

.rating-bar .el-progress {
  flex: 1;
}

.count {
  width: 30px;
  text-align: right;
  color: #909399;
  font-size: 14px;
}

.write-review-btn {
  margin-bottom: 20px;
  text-align: right;
}

.review-list {
  margin-top: 20px;
}

.review-item {
  padding: 20px 0;
  border-bottom: 1px solid #ebeef5;
}

.review-item:last-child {
  border-bottom: none;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
}

.username {
  font-weight: 500;
  color: #303133;
}

.review-time {
  color: #909399;
  font-size: 14px;
  margin-left: auto;
}

.review-content {
  color: #606266;
  line-height: 1.6;
  padding-left: 0;
}

/* 详情弹窗样式 */
.detail-container {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.detail-images {
  flex-shrink: 0;
  text-align: center;
}

.detail-main-image {
  margin-bottom: 12px;
}

.detail-thumbnails {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.thumbnail-item {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.thumbnail-item.active {
  border-color: #409eff;
}

.thumbnail-item:hover {
  border-color: #409eff;
}

.detail-info {
  flex: 1;
  min-width: 250px;
}

.description-content {
  line-height: 1.5;
  white-space: pre-wrap;
}

.no-description {
  color: #909399;
  font-style: italic;
}

/* 地址选项样式 */
.address-option {
  padding: 8px 0;
}

.address-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.address-name {
  font-weight: 500;
}

.address-phone {
  color: #606266;
}

.address-detail {
  color: #606266;
  font-size: 12px;
  line-height: 1.4;
}

/* 表单验证错误样式 */
:deep(.el-form-item.is-error .el-upload) {
  border-color: #f56c6c;
}
</style>
