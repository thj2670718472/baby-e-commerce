/**
 * 数据表注释统一配置。
 * 新库由 Sequelize sync 写入，已有库由 scripts/init-db.js 幂等更新。
 */
module.exports = {
  tb_user: '用户账号表：登录凭证、角色、积分余额与头像',
  tb_goods: '商品表：商品基础信息、价格、库存、销量与上下架状态',
  tb_category: '商品分类表：分类名称、排序与启用状态',
  tb_order: '订单表：订单状态、金额、收货信息、物流与售后信息',
  tb_order_goods: '订单商品明细表：订单内商品的名称、价格与数量快照',
  tb_address: '用户收货地址表：收货人、联系电话、省市区与默认标记',
  tb_review: '商品评价表：评分、内容、图片、审核状态与订单关联',
  baby_culture: '育儿文章表：文章标题、摘要、正文、发布状态与浏览量',
  tb_baby: '宝宝档案表：宝宝姓名、出生日期、性别、身高与体重',
  tb_favorite: '商品收藏表：用户收藏的商品记录',
  tb_chat_session: '客服会话表：用户会话、最后消息、未读数与关闭状态',
  tb_chat_message: '客服消息表：会话内文本/图片消息、发送方与已读状态',
  tb_coupon_template: '优惠券模板表：面额、使用门槛、发放概率与库存',
  tb_user_coupon: '用户优惠券表：用户领取的券、有效期、状态与关联订单',
  tb_coupon_draw_record: '优惠券抽取记录表：用户每次抽中的优惠券快照',
  tb_user_draw_record: '用户每周抽券记录表：按用户、年份和周次限制抽券资格',
  tb_search_history: '用户搜索历史表：历史关键词与最近搜索时间',
  tb_cart: '购物车表：用户加入购物车的商品、数量与价格快照',
  tb_points_record: '用户积分流水表：收入/支出、来源、数量与关联说明',
  tb_points_goods: '积分商城商品表：兑换所需积分、库存、排序与上下架状态',
  tb_points_exchange: '积分商品兑换单表：兑换商品、积分、数量、收货信息与状态',
  tb_seckill_session: '秒杀活动场次表：场次名称、起止时间与启用状态',
  tb_seckill_goods: '秒杀活动商品表：秒杀价、原价、库存、限购数与排序'
};
