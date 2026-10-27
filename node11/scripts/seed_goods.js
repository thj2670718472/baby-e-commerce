/**
 * 初始化演示用的分类与商品数据（可重复执行，按名称去重）
 * 用法：node scripts/seed_goods.js
 */
const db = require('../db/mysqldb');
const fs = require('fs');
const path = require('path');

const categories = [
  { name: '奶粉', sort: 1 },
  { name: '奶瓶', sort: 2 },
  { name: '尿布', sort: 3 },
  { name: '婴儿车', sort: 4 },
  { name: '婴儿床', sort: 5 },
  { name: '衣服', sort: 6 },
  { name: '玩具', sort: 7 },
  { name: '食品', sort: 8 },
  { name: '其他', sort: 9 },
];

const goodsList = [
  {
    name: '婴儿配方奶粉 1段 900g',
    category: '奶粉',
    price: 268,
    quantity: 120,    image: 'formula.jpg',
    description: '适合 0-6 个月宝宝，接近母乳配比，添加 DHA 与益生元组合，易溶解不结块。',
  },
  {
    name: '宽口径玻璃奶瓶 240ml',
    category: '奶瓶',
    price: 89,
    quantity: 200,    image: 'bottle.jpg',
    description: '高硼硅玻璃瓶身，耐高温易清洗，仿母乳硅胶奶嘴配防胀气阀，宝宝吸吮更轻松。',
  },
  {
    name: '超薄透气纸尿裤 L 码 48 片',
    category: '尿布',
    price: 128,
    quantity: 300,    image: 'diaper.jpg',
    description: '3D 立体剪裁贴合腿型，芯体导流快，长时间干爽不闷热，适合 9-14kg 宝宝。',
  },
  {
    name: '轻便可折叠婴儿推车',
    category: '婴儿车',
    price: 899,
    quantity: 45,    image: 'stroller.jpg',
    description: '一键收车仅 6.2kg，可平躺可坐，四轮避震，可登机，带防晒遮阳篷。',
  },
  {
    name: '实木婴儿床 带护栏',
    category: '婴儿床',
    price: 1299,
    quantity: 30,    image: 'crib.jpg',
    description: '新西兰松木无漆打磨，护栏高度可调，可拆侧栏拼接大床，附赠椰棕床垫。',
  },
  {
    name: '纯棉婴儿连体衣',
    category: '衣服',
    price: 69,
    quantity: 500,    image: 'onesie.jpg',
    description: 'A 类精梳棉，柔软亲肤不刺痒，斜襟按扣方便换尿布，春秋季单穿或打底皆可。',
  },
  {
    name: '木质益智摇铃套装',
    category: '玩具',
    price: 59,
    quantity: 260,    image: 'toy.jpg',
    description: '榉木无漆打磨，圆角处理，声音轻柔不刺耳，锻炼抓握与听觉追踪，适合 3 个月以上。',
  },
  {
    name: '婴儿高铁米粉 250g',
    category: '食品',
    price: 45,
    quantity: 400,    image: 'baby-food.jpg',
    description: '6 个月以上辅食，强化铁与钙，单一谷物配方，冲调细腻好吞咽，无添加糖盐。',
  },
  {
    name: '婴儿洗发沐浴二合一',
    category: '其他',
    price: 79,
    quantity: 180,    image: 'care.jpg',
    description: '弱酸性无泪配方，温和清洁头发与身体，含燕麦提取物，敏感肌宝宝可用。',
  },
  {
    name: '儿童安全座椅 0-4 岁',
    category: '其他',
    price: 1580,
    quantity: 25,    image: 'car-seat.jpg',
    description: 'ISOFIX 硬接口，双向安装，五点式安全带，侧撞防护，适合 0-18kg 儿童。',
  },
  {
    name: '婴儿手口湿巾 80 抽',
    category: '其他',
    price: 29,
    quantity: 800,    image: 'wipes.jpg',
    description: '纯水配方无酒精香精，加厚珍珠纹不易破，可擦拭手口与玩具，抽取不连张。',
  },
];

async function seedCategories() {
  let created = 0;
  for (const item of categories) {
    const existed = await db.category.findOne({ where: { name: item.name } });
    if (existed) continue;
    await db.category.create({ name: item.name, sort: item.sort, status: true });
    created += 1;
  }
  return created;
}

async function seedGoods() {
  let created = 0;
  for (const item of goodsList) {
    const existed = await db.goods.findOne({ where: { name: item.name } });
    if (existed) continue;
    // 引用的图片文件必须真实存在于 public/uploads/goods/，否则前端只能显示占位图
    if (!fs.existsSync(path.join(__dirname, '..', 'public', 'uploads', 'goods', item.image))) {
      console.warn(`[seed_goods] 警告: 图片文件不存在 public/uploads/goods/${item.image}`);
    }
    await db.goods.create({
      name: item.name,
      category: item.category,
      price: item.price,
      quantity: item.quantity,      status: true,
      images: JSON.stringify([`/uploads/goods/${item.image}`]),
      description: item.description,
    });
    created += 1;
  }
  return created;
}

async function run() {
  const categoryCount = await seedCategories();
  const goodsCount = await seedGoods();
  const totalCategories = await db.category.count();
  const totalGoods = await db.goods.count();
  console.log(`新增分类 ${categoryCount} 条，当前共 ${totalCategories} 条`);
  console.log(`新增商品 ${goodsCount} 条，当前共 ${totalGoods} 条`);
}

// 支持直接运行，也被 init-db 复用
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化失败:', error);
      process.exit(1);
    });
}

module.exports = { run };
