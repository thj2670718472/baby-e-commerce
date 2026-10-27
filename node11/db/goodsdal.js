const { Op } = require('sequelize');
const goods = require('./mysqldb').goods;

// 关键词里的 % 和 _ 是 LIKE 通配符，需要转义，否则用户输入 "%" 会匹配全部商品
function escapeLike(keyword) {
    return String(keyword).replace(/[\\%_]/g, (char) => `\\${char}`);
}

function goodsdal() {
    this.addGoods = async function(model) {
        try {
            console.log('添加商品数据:', {
                name: model.name,
                quantity: model.quantity,
                category: model.category,
                price: model.price,
                status: model.status,
                imagesLength: model.images ? model.images.length : 0,
                description: model.description || ''
            });

            return await goods.create({
                name: model.name,
                quantity: model.quantity,
                category: model.category,
                price: model.price,
                status: model.status,
                images: JSON.stringify(model.images || []),
                description: model.description || ''
            });
        } catch (error) {
            console.error('添加商品失败:', error);
            throw error;
        }
    }

    const mapGoods = (item) => {
        let images = item.images || [];
        if (typeof images === 'string') {
            try {
                images = JSON.parse(images);
            } catch (e) {
                images = [];
            }
        }
        return {
            ...item.toJSON(),
            images: Array.isArray(images) ? images : []
        };
    };

    // 排序白名单：前端只能选这里列出的排序，避免把任意字符串拼进 SQL
    const SORTS = {
        default: [['id', 'ASC']],
        newest: [['id', 'DESC']],
        price_asc: [['price', 'ASC']],
        price_desc: [['price', 'DESC']],
        sales_desc: [['sales', 'DESC']]
    };

    this.getAllGoods = async function(status, options = {}) {
        try {
            const where = {};
            if (status !== undefined && status !== null && status !== '') {
                where.status = status === 'true' || status === true;
            }

            // 关键词检索：商品名或分类名命中都算
            const keyword = typeof options.keyword === 'string' ? options.keyword.trim() : '';
            if (keyword) {
                const like = `%${escapeLike(keyword)}%`;
                where[Op.or] = [
                    { name: { [Op.like]: like } },
                    { category: { [Op.like]: like } }
                ];
            }

            // 按分类名筛选（商品表的 category 存的就是分类名称）
            const category = typeof options.category === 'string' ? options.category.trim() : '';
            if (category) where.category = category;

            const order = SORTS[options.sort] || SORTS.default;
            const page = Number(options.page);
            const pageSize = Number(options.pageSize || 20);

            // 不传 page 时保持原有行为（返回数组），避免影响已有前端
            if (Number.isInteger(page) && page > 0) {
                const size = Math.min(Math.max(pageSize, 1), 100);
                const { count, rows } = await goods.findAndCountAll({
                    where,
                    order,
                    limit: size,
                    offset: (page - 1) * size
                });
                return {
                    list: rows.map(mapGoods),
                    total: count,
                    page,
                    pageSize: size,
                    totalPages: Math.ceil(count / size)
                };
            }

            // 关键词搜索时限制返回条数，避免一次把整张表拉回客户端
            const goodsList = await goods.findAll({
                where,
                order,
                ...(keyword ? { limit: 100 } : {})
            });
            return goodsList.map(mapGoods);
        } catch (error) {
            console.error('获取商品列表失败:', error);
            throw error;
        }
    }

    this.getGoodsById = async function(id) {
        try {
            const item = await goods.findOne({ where: { id: id } });
            if (item) {
                let images = item.images || [];
                if (typeof images === 'string') {
                    try {
                        images = JSON.parse(images);
                    } catch (e) {
                        images = [];
                    }
                }
                return {
                    ...item.toJSON(),
                    images: Array.isArray(images) ? images : []
                };
            }
            return null;
        } catch (error) {
            console.error('获取商品详情失败:', error);
            throw error;
        }
    }

    this.deleteGoods = async function(id) {
        try {
            return await goods.destroy({ where: { id: id } });
        } catch (error) {
            console.error('删除商品失败:', error);
            throw error;
        }
    }

    this.updateGoods = async function(model) {
        try {
            console.log('更新商品数据:', {
                id: model.id,
                name: model.name,
                quantity: model.quantity,
                category: model.category,
                price: model.price,
                status: model.status,
                imagesLength: model.images ? model.images.length : 0,
                description: model.description || ''
            });

            const updateData = {
                name: model.name,
                quantity: model.quantity,
                category: model.category,
                price: model.price,
                status: model.status
            };

            if (model.images !== undefined) {
                updateData.images = JSON.stringify(model.images || []);
            }

            if (model.description !== undefined) {
                updateData.description = model.description;
            }

            const result = await goods.update(updateData, {
                where: { id: model.id }
            });

            console.log('更新结果:', result);
            console.log('更新后的图片数量:', updateData.images ? JSON.parse(updateData.images).length : 0);
            console.log('更新后的描述值:', updateData.description || '未修改描述');

            return result;
        } catch (error) {
            console.error('更新商品失败:', error);
            throw error;
        }
    }

    this.getGoodsByCategory = async function(category) {
        try {
            return await goods.findAll({ where: { category: category } });
        } catch (error) {
            console.error('按分类获取商品失败:', error);
            throw error;
        }
    }
}

module.exports = new goodsdal();
