import request from '../utils/request.js';
import { BASE_URL } from '../config.js';

// 服务器地址统一在 config.js 中配置（支持 .env 与真机局域网地址）
export { BASE_URL };

// ==================== 用户相关 ====================

// 用户登录（POST，避免密码出现在 URL 中）
export const login = (data) => {
  return request({
    url: '/user/login',
    method: 'POST',
    data
  });
};

// 用户注册
export const register = (data) => {
  return request({
    url: '/user/register',
    method: 'POST',
    data
  });
};

// 修改密码
export const changePassword = (data) => {
  return request({
    url: '/user/change-password',
    method: 'POST',
    data
  });
};

// 更新用户资料
export const updateUserProfile = (data) => {
  return request({
    url: '/user/profile',
    method: 'PUT',
    data
  });
};

// 获取用户列表（仅管理员）
export const getUserList = () => {
  return request({
    url: '/user/list',
    method: 'GET'
  });
};

// 获取客服公开信息（头像等），普通用户可用
export const getAdminInfo = () => {
  return request({
    url: '/user/admin-info',
    method: 'GET'
  });
};

// 删除用户
export const deleteUser = (id) => {
  return request({
    url: `/user/${id}`,
    method: 'DELETE'
  });
};


// ==================== 积分相关 ====================
export const getUserPoints = (userId) => request({ url: `/points/user/${userId}`, method: 'GET' });
export const getPointsRecords = (userId) => request({ url: `/points/records/${userId}`, method: 'GET' });
export const getExchangeRecords = (userId) => request({ url: `/points/exchange-records/${userId}`, method: 'GET' });

// 积分商城：商品列表 / 商品详情 / 兑换商品
export const getPointsShop = (params = {}) => request({ url: '/points/shop', method: 'GET', params });
export const getPointsGoodsDetail = (id) => request({ url: `/points/shop/${id}`, method: 'GET' });
export const exchangePointsGoods = (data) => request({ url: '/points/exchange', method: 'POST', data });

// ==================== 聊天相关 ====================

export const getChatSession = (data) => request({ url: '/chat/session/get', method: 'POST', data });
export const getChatMessages = (sessionId) => request({ url: `/chat/messages/${sessionId}`, method: 'GET' });
export const sendChatMessage = (data) => request({ url: '/chat/message/send', method: 'POST', data });
export const getChatUnread = (userId) => request({ url: `/chat/unread/${userId}`, method: 'GET' });

// 上传聊天图片 - H5 版本
export const uploadChatImage = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log('========== 上传图片 (H5) ==========');
    console.log('文件路径:', filePath);
    console.log('上传地址:', BASE_URL + '/chat/upload');
    
    if (!filePath) {
      console.error('文件路径为空');
      reject(new Error('文件路径为空'));
      return;
    }
    
    fetch(filePath)
      .then(res => res.blob())
      .then(blob => {
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        
        return fetch(BASE_URL + '/chat/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${uni.getStorageSync('token') || ''}`
          },
          body: formData
        });
      })
      .then(res => res.json())
      .then(data => {
        console.log('上传成功:', data);
        resolve(data);
      })
      .catch(err => {
        console.error('上传失败:', err);
        reject(err);
      });
      
    console.log('================================');
  });
};

// ==================== 商品相关 ====================

export const getGoodsList = (params = {}) => {
  return request({
    url: '/goods',
    method: 'GET',
    params: { status: 'true', ...params }
  });
};

export const getGoodsDetail = (id) => {
  return request({
    url: `/goods/${id}`,
    method: 'GET'
  });
};

// ==================== 分类相关 ====================

export const getCategoryList = () => {
  return request({
    url: '/category',
    method: 'GET'
  });
};

export const getEnabledCategoryList = () => {
  return request({
    url: '/category/enabled',
    method: 'GET'
  });
};

// ==================== 地址相关 ====================

export const getAddressList = (userId) => {
  return request({
    url: `/address/list/${userId}`,
    method: 'GET'
  });
};

export const getDefaultAddress = (userId) => {
  return request({
    url: `/address/default/${userId}`,
    method: 'GET'
  });
};

export const getAddressDetail = (id) => {
  return request({
    url: `/address/${id}`,
    method: 'GET'
  });
};

export const addAddress = (data) => {
  return request({
    url: '/address',
    method: 'POST',
    data
  });
};

export const updateAddress = (id, data) => {
  return request({
    url: `/address/${id}`,
    method: 'PUT',
    data
  });
};

export const deleteAddress = (id) => {
  return request({
    url: `/address/${id}`,
    method: 'DELETE'
  });
};

export const setDefaultAddress = (id) => {
  return request({
    url: `/address/${id}/default`,
    method: 'PUT'
  });
};

// ==================== 物流相关 ====================

// 查询物流信息
export const getLogisticsInfo = (orderId) => {
  return request({
    url: `/orders/logistics/${orderId}`,
    method: 'GET'
  });
};

// ==================== 订单相关 ====================

export const getOrderList = (userId, params = {}) => {
  return request({
    url: '/orders/list',
    method: 'GET',
    params: { userId, ...params }
  });
};

export const getAllOrderList = () => {
  return request({
    url: '/orders/list',
    method: 'GET'
  });
};

export const getOrderDetail = (id) => {
  return request({
    url: `/orders/detail/${id}`,
    method: 'GET'
  });
};

export const createOrder = (data) => {
  return request({
    url: '/orders/create',
    method: 'POST',
    data
  });
};

export const updateOrderStatus = (id, status) => {
  return request({
    url: `/orders/update-status/${id}`,
    method: 'PUT',
    data: { status }
  });
};

// 用户支付订单（仅能支付自己的待付款订单）
export const payOrder = (id) => {
  return request({
    url: `/orders/pay/${id}`,
    method: 'POST'
  });
};

export const receiveOrder = (id) => {
  return request({
    url: `/orders/receive/${id}`,
    method: 'POST'
  });
};

export const applyReturn = (id, reason) => {
  return request({
    url: `/orders/return/${id}`,
    method: 'POST',
    data: { reason }
  });
};

export const cancelOrder = (id) => {
  return request({
    url: `/orders/cancel/${id}`,
    method: 'POST'
  });
};

export const deleteOrder = (id) => {
  return request({
    url: `/orders/${id}`,
    method: 'DELETE'
  });
};

export const shipOrder = (id) => {
  return request({
    url: `/orders/ship/${id}`,
    method: 'POST'
  });
};

export const approveReturn = (id, approved) => {
  return request({
    url: `/orders/approve-return/${id}`,
    method: 'POST',
    data: { approved }
  });
};

export const getOrderCount = (userId) => {
  return request({
    url: `/orders/count/${userId}`,
    method: 'GET'
  });
};

// ==================== 收藏相关 ====================

export const getFavoriteList = (userId) => {
  return request({
    url: `/favorite/list/${userId}`,
    method: 'GET'
  });
};

export const checkFavorite = (userId, goodsId) => {
  return request({
    url: `/favorite/check/${userId}/${goodsId}`,
    method: 'GET'
  });
};

export const addFavorite = (data) => {
  return request({
    url: '/favorite/add',
    method: 'POST',
    data
  });
};

export const removeFavorite = (userId, goodsId) => {
  return request({
    url: `/favorite/remove/${userId}/${goodsId}`,
    method: 'DELETE'
  });
};

// ==================== 优惠券相关 ====================

export const getCouponTemplates = () => {
  return request({
    url: '/coupon/templates',
    method: 'GET'
  });
};

export const getCouponWeekStatus = (userId) => {
  return request({
    url: `/coupon/week-status/${userId}`,
    method: 'GET'
  });
};

export const drawCoupon = (data) => {
  return request({
    url: '/coupon/draw',
    method: 'POST',
    data
  });
};

export const getUserCoupons = (userId, status) => {
  return request({
    url: `/coupon/list/${userId}`,
    method: 'GET',
    params: { status }
  });
};

export const getAvailableCoupons = (userId, amount) => {
  return request({
    url: `/coupon/available/${userId}`,
    method: 'GET',
    params: { amount }
  });
};

export const getDrawRecords = (userId) => {
  return request({
    url: `/coupon/records/${userId}`,
    method: 'GET'
  });
};

export const useCoupon = (id, orderId) => {
  return request({
    url: `/coupon/use/${id}`,
    method: 'PUT',
    data: { orderId }
  });
};

export const getCouponCount = (userId) => {
  return request({
    url: `/coupon/count/${userId}`,
    method: 'GET'
  });
};

// ==================== 打折相关 ====================

export const getDiscountStatus = () => {
  return request({
    url: '/discount/status',
    method: 'GET'
  });
};


// ==================== 购物车相关 ====================

export const getCartList = (userId) => {
  return request({ url: `/cart/list/${userId}`, method: 'GET' });
};

export const addToCart = (data) => {
  return request({ url: '/cart/add', method: 'POST', data });
};

export const updateCartQuantity = (id, quantity) => {
  return request({ url: `/cart/update/${id}`, method: 'PUT', data: { quantity } });
};

export const deleteCartItem = (id) => {
  return request({ url: `/cart/delete/${id}`, method: 'DELETE' });
};

export const clearCart = (userId) => {
  return request({ url: `/cart/clear/${userId}`, method: 'DELETE' });
};
// ==================== 评价相关 ====================

export const submitReview = (data) => {
  return request({
    url: '/reviews/submit',
    method: 'POST',
    data
  });
};

export const getGoodsReviews = (goodsId, params = {}) => {
  return request({
    url: `/reviews/goods/${goodsId}`,
    method: 'GET',
    params
  });
};

export const getReviewStats = (goodsId) => {
  return request({
    url: `/reviews/stats/${goodsId}`,
    method: 'GET'
  });
};

export const getAllReviews = (params = {}) => {
  return request({
    url: '/reviews/list',
    method: 'GET',
    params
  });
};

export const auditReview = (id, status) => {
  return request({
    url: `/reviews/audit/${id}`,
    method: 'PUT',
    data: { status }
  });
};

export const deleteReview = (id) => {
  return request({
    url: `/reviews/${id}`,
    method: 'DELETE'
  });
};

// ==================== 婴儿培养（文章）相关 ====================

export const getArticles = () => {
  return request({
    url: '/baby-culture',
    method: 'GET'
  });
};

export const getArticleDetail = (id) => {
  return request({
    url: `/baby-culture/${id}`,
    method: 'GET'
  });
};
export const getRecommendArticles = (months) => {
  return request({ url: '/baby-culture/recommend', method: 'GET', params: { months } });
};

// ==================== 婴儿状况相关 ====================

export const getBabyList = (userId) => {
  return request({
    url: '/baby/list',
    method: 'GET',
    params: { userId }
  });
};

export const saveBabyInfo = (data) => {
  return request({
    url: '/baby/save',
    method: 'POST',
    data
  });
};

// AI 对话
export const aiChat = (messages) => {
  return request({ url: '/ai/chat', method: 'POST', data: { messages } });
};

// AI 推荐食谱
export const aiRecommendFood = (babyAge, allergy) => {
  return request({ url: '/ai/recommend-food', method: 'POST', data: { babyAge, allergy } });
};
// ==================== 搜索相关 ====================

export const recordSearchKeyword = (data) => {
  return request({
    url: '/search/record',
    method: 'POST',
    data
  });
};

export const getHotKeywords = () => {
  return request({
    url: '/search/hot',
    method: 'GET'
  });
};

export const getSearchHistory = (userId) => {
  return request({
    url: `/search/history/${userId}`,
    method: 'GET'
  });
};

export const clearSearchHistory = (userId) => {
  return request({
    url: `/search/history/${userId}`,
    method: 'DELETE'
  });
};

export const getSearchSuggest = (keyword) => {
  return request({
    url: '/search/suggest',
    method: 'GET',
    params: { keyword }
  });
};

// ==================== 图片上传相关 ====================

export const uploadImage = (filePath) => {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: BASE_URL + '/upload/image',
      filePath: filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${uni.getStorageSync('token') || ''}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          resolve(data);
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

export const uploadBase64Image = (base64data) => {
  return request({
    url: '/upload/base64',
    method: 'POST',
    data: { image: base64data }
  });
};

// ==================== 仪表盘相关（管理员用） ====================

export const getStatistics = () => {
  return request({
    url: '/dashboard/statistics',
    method: 'GET'
  });
};

// ==================== 秒杀相关 ====================

// 场次列表（含各场次商品与状态，serverTime 用于倒计时校准）
export const getSeckillSessions = () => {
  return request({
    url: '/seckill/sessions',
    method: 'GET'
  });
};

// 抢购：成功返回待付款订单
export const seckillBuy = (seckillGoodsId, quantity = 1, extra = {}) => {
  return request({
    url: '/seckill/buy',
    method: 'POST',
    data: { seckillGoodsId, quantity, ...extra }
  });
};

// ==================== 默认导出 ====================

export default {
  BASE_URL,
  login,
  register,
  changePassword,
  updateUserProfile,
  getUserList,
  deleteUser,
  getGoodsList,
  getGoodsDetail,
  getCategoryList,
  getEnabledCategoryList,
  getAddressList,
  getDefaultAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddressDetail,
  getOrderList,
  getAllOrderList,
  getOrderDetail,
  createOrder,
  updateOrderStatus,
  receiveOrder,
  applyReturn,
  cancelOrder,
  deleteOrder,
  shipOrder,
  getLogisticsInfo,
  approveReturn,
  getOrderCount,
  submitReview,
  getGoodsReviews,
  getReviewStats,
  getAllReviews,
  auditReview,
  deleteReview,
  getArticles,
  getArticleDetail,
  getBabyList,
  saveBabyInfo,
  getCartList,
  addToCart,
  updateCartQuantity,
  deleteCartItem,
  clearCart,
  // ========== 新增搜索相关 ==========
  recordSearchKeyword,
  getHotKeywords,
  getSearchHistory,
  clearSearchHistory,
  getSearchSuggest,
  // ========== 搜索相关结束 ==========
  uploadImage,
  uploadBase64Image,
  getStatistics,
  getChatSession,
  getChatMessages,
  sendChatMessage,
  getChatUnread,
  uploadChatImage,
  getCouponTemplates,
  getCouponWeekStatus,
  drawCoupon,
  getUserCoupons,
  getAvailableCoupons,
  getDrawRecords,
  useCoupon,
  getCouponCount,
  getFavoriteList,
  checkFavorite,
  addFavorite,
  removeFavorite,
  getDiscountStatus,
  getUserPoints,
  getPointsRecords,
  getExchangeRecords,
  getPointsShop,
  getPointsGoodsDetail,
  exchangePointsGoods,

};