/**
 * 测试公共工具：造用户/商品/订单，以及带 token 的请求头
 */
const db = require('../db/mysqldb');
const userDal = require('../db/userdal');
const { signUserToken } = require('../middleware/auth');

let orderSeq = 0;

/**
 * 创建测试用户并签好 token。
 * 管理员必须显式传 role: 'admin'，与生产权限模型保持一致。
 */
async function createUser({ username, role: requestedRole = 'user', points = 0 } = {}) {
  const name = username || `user_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const user = await userDal.addUser({
    username: name,
    password: 'test123',
    phone: '13800000000',
    email: `${name}@test.com`,
    role: requestedRole
  });
  if (points) await user.update({ points });
  const { token, role } = signUserToken(user);
  return { user, token, role };
}

async function createGoods({ name = '测试商品', price = 100, quantity = 10, sales = 0 } = {}) {
  return db.goods.create({
    name,
    price,
    quantity,
    category: '测试分类',
    status: true,
    images: '[]',
    description: '测试商品描述',
    sales
  });
}

/** 直接在库里建订单（不校验库存，用于流程测试的夹具） */
async function createOrder(userId, username, { status = '待付款', goodsId, goodsName = '测试商品', quantity = 1, price = 100 } = {}) {
  orderSeq += 1;
  const order = await db.order.create({
    orderNo: `TEST${Date.now()}${orderSeq}`,
    userId,
    userName: username,
    totalAmount: price * quantity,
    originalAmount: price * quantity,
    status,
    address: '测试地址',
    phone: '13800000000',
    paymentMethod: '在线支付',
    orderTime: new Date()
  });
  if (goodsId) {
    await db.order_goods.create({
      orderId: order.id,
      goodsId,
      goodsName,
      goodsImage: '',
      price,
      quantity,
      subtotal: price * quantity
    });
  }
  return order;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { createUser, createGoods, createOrder, auth };
