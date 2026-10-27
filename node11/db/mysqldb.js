const Sequelize = require('sequelize');
const config = require('../utils/config');
const model_user = require('./model_user');
const model_goods = require('./model_goods');
const model_category = require('./model_category');
const model_order = require('./model_order');
const model_order_goods = require('./model_order_goods');
const model_address = require('./model_address');
const model_review = require('./model_review');
const model_baby_culture = require('./model_baby_culture');
const model_baby = require('./model_baby');
const model_favorite = require('./model_favorite');
const model_chat = require('./model_chat');
const model_coupon = require('./model_coupon');
const model_draw_record = require('./model_draw_record');
const model_search_history = require('./model_search_history');
const model_cart = require('./model_cart');
const model_points_record = require('./model_points_record');
const model_points_goods = require('./model_points_goods');
const model_points_exchange = require('./model_points_exchange');


const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: config.db.logging ? console.log : false,
    pool: config.db.pool
});

let user = model_user(sequelize, Sequelize);
let goods = model_goods(sequelize, Sequelize);
let category = model_category(sequelize, Sequelize);
let order = model_order(sequelize, Sequelize);
let order_goods = model_order_goods(sequelize, Sequelize);
let address = model_address(sequelize, Sequelize);
let review = model_review(sequelize, Sequelize);
let baby_culture = model_baby_culture(sequelize, Sequelize);
let baby = model_baby(sequelize, Sequelize);
let favorite = model_favorite(sequelize, Sequelize);

let chatModels = model_chat(sequelize, Sequelize);
let ChatSession = chatModels.ChatSession;
let ChatMessage = chatModels.ChatMessage;

let couponModels = model_coupon(sequelize, Sequelize);
let CouponTemplate = couponModels.CouponTemplate;
let UserCoupon = couponModels.UserCoupon;
let CouponDrawRecord = couponModels.CouponDrawRecord;

let drawRecordModels = model_draw_record(sequelize, Sequelize);
let UserDrawRecord = drawRecordModels.UserDrawRecord;

let searchHistory = model_search_history(sequelize, Sequelize);
let cart = model_cart(sequelize, Sequelize);
let pointsRecord = model_points_record(sequelize, Sequelize);
let pointsGoods = model_points_goods(sequelize, Sequelize);
let pointsExchange = model_points_exchange(sequelize, Sequelize);

let seckillModels = require('./model_seckill')(sequelize, Sequelize);
let SeckillSession = seckillModels.SeckillSession;
let SeckillGoods = seckillModels.SeckillGoods;


// 关联
SeckillSession.hasMany(SeckillGoods, { foreignKey: 'sessionId' });
SeckillGoods.belongsTo(SeckillSession, { foreignKey: 'sessionId' });
order.hasMany(order_goods, { foreignKey: 'orderId' });
order_goods.belongsTo(order, { foreignKey: 'orderId' });
user.hasMany(order, { foreignKey: 'userId' });
order.belongsTo(user, { foreignKey: 'userId' });
user.hasMany(address, { foreignKey: 'userId' });
address.belongsTo(user, { foreignKey: 'userId' });
goods.hasMany(review, { foreignKey: 'goodsId' });
review.belongsTo(goods, { foreignKey: 'goodsId' });
user.hasMany(review, { foreignKey: 'userId' });
review.belongsTo(user, { foreignKey: 'userId' });
user.hasMany(baby, { foreignKey: 'userId' });
baby.belongsTo(user, { foreignKey: 'userId' });

user.hasMany(favorite, { foreignKey: 'userId' });
favorite.belongsTo(user, { foreignKey: 'userId' });
goods.hasMany(favorite, { foreignKey: 'goodsId' });
favorite.belongsTo(goods, { foreignKey: 'goodsId' });

user.hasMany(ChatSession, { foreignKey: 'userId' });
ChatSession.belongsTo(user, { foreignKey: 'userId' });
ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId' });

user.hasMany(UserCoupon, { foreignKey: 'userId' });
UserCoupon.belongsTo(user, { foreignKey: 'userId' });
user.hasMany(CouponDrawRecord, { foreignKey: 'userId' });
CouponDrawRecord.belongsTo(user, { foreignKey: 'userId' });

CouponTemplate.hasMany(UserCoupon, { foreignKey: 'templateId' });
UserCoupon.belongsTo(CouponTemplate, { foreignKey: 'templateId' });

user.hasMany(UserDrawRecord, { foreignKey: 'userId' });
UserDrawRecord.belongsTo(user, { foreignKey: 'userId' });

user.hasMany(cart, { foreignKey: 'userId' });
cart.belongsTo(user, { foreignKey: 'userId' });
goods.hasMany(cart, { foreignKey: 'goodsId' });
cart.belongsTo(goods, { foreignKey: 'goodsId' });

user.hasMany(pointsExchange, { foreignKey: 'userId' });
pointsExchange.belongsTo(user, { foreignKey: 'userId' });
pointsGoods.hasMany(pointsExchange, { foreignKey: 'pointsGoodsId' });
pointsExchange.belongsTo(pointsGoods, { foreignKey: 'pointsGoodsId' });
user.hasMany(pointsRecord, { foreignKey: 'userId' });
pointsRecord.belongsTo(user, { foreignKey: 'userId' });

// 统一补充表级注释，新建表时随 CREATE TABLE 一并写入
const tableComments = require('./tableComments');
for (const model of Object.values(sequelize.models)) {
    const tableName = model.getTableName();
    if (typeof tableName === 'string' && tableComments[tableName]) {
        model.options.comment = tableComments[tableName];
    }
}

// sync 的 promise 挂到导出上：测试需要等它落定后才能安全地 force 重建表
const syncPromise = sequelize.sync({ force: false }).then(() => {
    console.log('数据库表结构同步完成');
}).catch((error) => {
    console.error('数据库表结构同步失败:', error);
});

module.exports.syncPromise = syncPromise;
module.exports.SeckillSession = SeckillSession;
module.exports.SeckillGoods = SeckillGoods;
module.exports.user = user;
module.exports.goods = goods;
module.exports.category = category;
module.exports.order = order;
module.exports.order_goods = order_goods;
module.exports.address = address;
module.exports.review = review;
module.exports.baby_culture = baby_culture;
module.exports.baby = baby;
module.exports.favorite = favorite;
module.exports.ChatSession = ChatSession;
module.exports.ChatMessage = ChatMessage;
module.exports.CouponTemplate = CouponTemplate;
module.exports.UserCoupon = UserCoupon;
module.exports.CouponDrawRecord = CouponDrawRecord;
module.exports.UserDrawRecord = UserDrawRecord;
module.exports.searchHistory = searchHistory;
module.exports.cart = cart;
module.exports.pointsRecord = pointsRecord;
module.exports.pointsGoods = pointsGoods;
module.exports.pointsExchange = pointsExchange;

module.exports.sequelize = sequelize;