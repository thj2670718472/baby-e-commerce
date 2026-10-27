var express = require('express');
var router = express.Router();
var categoryDal=require('../db/categorydal');

var responseHelper=require('../utils/responseHelper');
const { requireAdmin } = require('../middleware/auth');

/* GET category listing. */
router.get('/', async function(req, res, next) {
  let result=await categoryDal.getAllCategory();
  responseHelper.success(res,result,"获取分类列表成功");
});

/* GET enabled category listing. */
router.get('/enabled', async function(req, res, next) {
  let result=await categoryDal.getEnabledCategory();
  responseHelper.success(res,result,"获取启用分类列表成功");
});

/* GET category by name. */
router.get('/name/:name', async function(req, res, next) {
  let result=await categoryDal.getCategoryByName(req.params.name);
  if(result){
    responseHelper.success(res,result,"获取分类详情成功");
  }
  else{
    responseHelper.error(res,"分类不存在");
  }
});

/* GET category by id. */
router.get('/:id', async function(req, res, next) {
  let result=await categoryDal.getCategoryById(req.params.id);
  if(result){
    responseHelper.success(res,result,"获取分类详情成功");
  }
  else{
    responseHelper.error(res,"分类不存在");
  }
});

/* POST add category. */
router.post('/', requireAdmin, async function(req, res, next) {
  const model={
    name:req.body.name,
    sort:req.body.sort,
    status:req.body.status
  }
  try {
    let result=await categoryDal.addCategory(model);
    if(result){
      responseHelper.success(res,result,"新增分类成功");
    }
    else{
      responseHelper.error(res,"新增分类失败");
    }
  } catch (error) {
    if (error.message === '分类名称已存在') {
      responseHelper.error(res, error.message);
    } else {
      console.error('新增分类失败:', error);
      responseHelper.error(res,"新增分类失败");
    }
  }
});

/* PUT update category. */
router.put('/:id', requireAdmin, async function(req, res, next) {
  const model={
    id:req.params.id,
    name:req.body.name,
    sort:req.body.sort,
    status:req.body.status
  }
  try {
    let result=await categoryDal.updateCategory(model);
    if(result){
      responseHelper.success(res,result,"更新分类成功");
    }
    else{
      responseHelper.error(res,"更新分类失败");
    }
  } catch (error) {
    if (error.message === '分类名称已存在') {
      responseHelper.error(res, error.message);
    } else {
      console.error('更新分类失败:', error);
      responseHelper.error(res,"更新分类失败");
    }
  }
});

/* DELETE delete category. */
router.delete('/:id', requireAdmin, async function(req, res, next) {
  let result=await categoryDal.deleteCategory(req.params.id);
  if(result){
    responseHelper.success(res,result,"删除分类成功");
  }
  else{
    responseHelper.error(res,"删除分类失败");
  }
});

module.exports = router;