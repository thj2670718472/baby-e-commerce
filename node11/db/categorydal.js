const category=require('./mysqldb').category;
const goods=require('./mysqldb').goods;

function categorydal(){
    this.addCategory=async function(model) {
        // 检查分类名称是否重复
        const existingCategory = await category.findOne({where:{name:model.name}});
        if (existingCategory) {
            throw new Error('分类名称已存在');
        }
        // 自动计算排序值（最大排序值+1）
        const maxSort = await category.max('sort');
        model.sort = (maxSort || 0) + 1;
        return await category.create(model);
    }
    this.getAllCategory=async function() {
        // 按sort字段升序排序
        return await category.findAll({order: [['sort', 'ASC']]});
    }
    this.getEnabledCategory=async function() {
        // 获取启用的分类，按sort字段升序排序
        return await category.findAll({where:{status: true}, order: [['sort', 'ASC']]});
    }
    this.getCategoryById=async function(id) {
        return await category.findOne({where:{id:id}});
    }
    this.deleteCategory=async function(id) {
        return await category.destroy({where:{id:id}});
    }
    this.updateCategory=async function(model) {
        const transaction = await category.sequelize.transaction();
        try {
            const current = await category.findByPk(model.id, {transaction});
            if (!current) throw new Error('分类不存在');

            // 检查分类名称是否重复（排除当前分类）
            const existingCategory = await category.findOne({
                where:{name:model.name},
                transaction
            });
            if (existingCategory && String(existingCategory.id) !== String(model.id)) {
                throw new Error('分类名称已存在');
            }

            const oldName = current.name;
            const result = await category.update(model,{where:{id:model.id},transaction});

            // 商品以分类名称关联，重命名时同步更新
            if (model.name && oldName !== model.name) {
                await goods.update(
                    {category: model.name},
                    {where:{category: oldName}, transaction}
                );
            }

            // 如果分类被禁用，将该分类下的所有商品下架
            if (model.status === false) {
                await goods.update(
                    {status: false},
                    {where:{category: model.name}, transaction}
                );
            }

            await transaction.commit();
            return result;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    this.getCategoryByName=async function(name) {
        return await category.findOne({where:{name:name}});
    }
}
module.exports=new categorydal();