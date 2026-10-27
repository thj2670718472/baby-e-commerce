var express = require('express');
var router = express.Router();
var goodsDal=require('../db/goodsdal');
var categoryDal=require('../db/categorydal');

var responseHelper=require('../utils/responseHelper');
const { requireAdmin } = require('../middleware/auth');

/* GET goods listing.
 * 支持 status 过滤、name/keyword 关键词检索、category 分类筛选、sort 排序；
 * 传 page/pageSize 时返回分页结构，不传时仍返回数组（兼容旧前端） */
router.get('/', async function(req, res, next) {
  try {
    // 非上架状态（下架商品）只允许管理员查看，避免把未上架商品暴露给普通用户
    const statusParam = req.query.status;
    const wantsHidden = statusParam !== undefined && statusParam !== '' && statusParam !== 'true';
    if (wantsHidden && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({ code: 403, message: '需要管理员权限' });
    }

    // name 是前端历史用法，keyword 是更语义化的别名，两个都收
    const keyword = req.query.keyword || req.query.name;
    const result = await goodsDal.getAllGoods(req.query.status, {
      page: req.query.page,
      pageSize: req.query.pageSize,
      keyword,
      category: req.query.category,
      sort: req.query.sort
    });
    responseHelper.success(res, result, "获取商品列表成功");
  } catch (error) {
    console.error('获取商品列表失败:', error);
    responseHelper.error(res, '获取商品列表失败');
  }
});

/* GET goods by id. */
router.get('/:id', async function(req, res, next) {
  let result=await goodsDal.getGoodsById(req.params.id);
  if(result){
    responseHelper.success(res,result,"获取商品详情成功");
  }
  else{
    responseHelper.error(res,"商品不存在");
  }
});

/* POST add goods. */
router.post('/', requireAdmin, async function(req, res, next) {
  try {
    console.log('接收到的请求数据:', req.body);
    
    // 检查分类是否存在，不存在则创建
    const categoryName = req.body.category;
    if (categoryName) {
      console.log('检查分类是否存在:', categoryName);
      // 检查分类是否存在
      const existingCategories = await categoryDal.getAllCategory();
      console.log('现有分类:', existingCategories);
      const categoryExists = existingCategories.some(cat => cat.name === categoryName);
      console.log('分类是否存在:', categoryExists);
      
      if (!categoryExists) {
        // 创建新分类
        console.log('创建新分类:', categoryName);
        const newCategory = {
          name: categoryName,
          sort: existingCategories.length + 1, // 设置排序为最后
          status: true // 默认启用
        };
        const createdCategory = await categoryDal.addCategory(newCategory);
        console.log('创建的新分类:', createdCategory);
      }
    }
    
    const model={
      name:req.body.name,
      quantity:req.body.quantity,
      category:req.body.category,
      price:req.body.price,
      status:req.body.status,
      images:req.body.images,
      description:req.body.description
    }
    console.log('准备添加的商品数据:', model);
    let result=await goodsDal.addGoods(model);
    console.log('添加商品的结果:', result);
    if(result){
      responseHelper.success(res,result,"新增商品成功");
    }
    else{
      responseHelper.error(res,"新增商品失败");
    }
  } catch (error) {
    console.error('添加商品时出错:', error);
    responseHelper.error(res,"添加商品时出错");
  }
});

/* PUT update goods. */
router.put('/:id', requireAdmin, async function(req, res, next) {
  try {
    // 检查分类是否存在，不存在则创建
    const categoryName = req.body.category;
    if (categoryName) {
      // 检查分类是否存在
      const existingCategories = await categoryDal.getAllCategory();
      const categoryExists = existingCategories.some(cat => cat.name === categoryName);
      
      if (!categoryExists) {
        // 创建新分类
        const newCategory = {
          name: categoryName,
          sort: existingCategories.length + 1, // 设置排序为最后
          status: true // 默认启用
        };
        await categoryDal.addCategory(newCategory);
      }
    }
    
    const model={
      id:req.params.id,
      name:req.body.name,
      quantity:req.body.quantity,
      category:req.body.category,
      price:req.body.price,
      status:req.body.status,
      images:req.body.images,
      description:req.body.description
    }
    let result=await goodsDal.updateGoods(model);
    if(result[0] > 0){
      responseHelper.success(res,result,"更新商品成功");
    }
    else{
      responseHelper.error(res,"更新商品失败");
    }
  } catch (error) {
    console.error('更新商品时出错:', error);
    responseHelper.error(res,"更新商品时出错");
  }
});

/* DELETE delete goods. */
router.delete('/:id', requireAdmin, async function(req, res, next) {
  let result=await goodsDal.deleteGoods(req.params.id);
  if(result > 0){
    responseHelper.success(res,result,"删除商品成功");
  }
  else{
    responseHelper.error(res,"删除商品失败");
  }
});

module.exports = router;