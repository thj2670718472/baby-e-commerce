import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/login',    
  },
  { 
    path: '/login', 
    name: 'Login', 
    component: () => import('@/views/user/login.vue'), 
    meta: { 
      title: '登录', 
      requiresAuth: false 
    } 
  },
  { 
    path: '/register', 
    name: 'Register', 
    component: () => import('@/views/user/rigister.vue'), 
    meta: { 
      title: '注册', 
      requiresAuth: false 
    } 
  },
  {
  path: '/main/chat',
  name: 'ChatManage',
  component: () => import('@/views/chat/index.vue'),
  meta: { title: '问题咨询', icon: 'ChatDotRound' }

  },
  {
    path: '/main',
    name: 'Main',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/main/dashboard',
    meta: { requiresAuth: true },
    children: [ 
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { 
          title: '仪表盘', 
          icon: 'Odometer', 
          requiresAuth: true 
        },
      },  
      {
        path: 'product/list',
        name: 'ProductList',
        component: () => import('@/views/product/index.vue'),
        meta: { 
          title: '商品列表', 
          icon: 'Goods', 
          requiresAuth: true
        }
      },
      {
        path: 'product/category',
        name: 'ProductCategory',
        component: () => import('@/views/product/category.vue'),
        meta: { 
          title: '商品分类', 
          icon: 'Collection', 
          requiresAuth: true
        }
      },
      {
        path: 'order',
        name: 'Order',
        component: () => import('@/views/order/index.vue'),
        meta: { 
          title: '订单管理', 
          icon: 'List', 
          requiresAuth: true
        }
      },
      {
        path: 'order/detail',
        name: 'OrderDetail',
        component: () => import('@/views/order/detail.vue'),
        meta: { 
          title: '订单详情', 
          requiresAuth: true
        }
      },
      {
        path: 'user',
        name: 'User',
        component: () => import('@/views/user/index.vue'),
        meta: { 
          title: '用户管理', 
          icon: 'User', 
          requiresAuth: true
        }
      },
      {
        path: 'user/profile',
        name: 'UserProfile',
        component: () => import('@/views/user/profile.vue'),
        meta: { 
          title: '个人资料', 
          requiresAuth: true
        }
      },
      {
        path: 'user/change-password',
        name: 'ChangePassword',
        component: () => import('@/views/user/change-password.vue'),
        meta: { 
          title: '修改密码', 
          requiresAuth: true
        }
      },
      {
        path: 'user/address',
        name: 'UserAddress',
        component: () => import('@/views/user/address.vue'),
        meta: { 
          title: '地址管理', 
          requiresAuth: true
        }
      },
      {
        path: 'user/baby-status',
        name: 'BabyStatus',
        component: () => import('@/views/user/baby-status.vue'),
        meta: { 
          title: '婴儿状况', 
          requiresAuth: true
        }
      },
      {
        path: 'review',
        name: 'Review',
        component: () => import('@/views/review/index.vue'),
        meta: { 
          title: '评价管理', 
          icon: 'ChatDotSquare', 
          requiresAuth: true
        }
      },
      {
        path: 'seckill',
        name: 'Seckill',
        component: () => import('@/views/seckill/index.vue'),
        meta: {
          title: '秒杀管理',
          icon: 'AlarmClock',
          requiresAuth: true
        }
      },
      {
        path: 'coupon',
        name: 'CouponManage',
        component: () => import('@/views/coupon/index.vue'),
        meta: {
          title: '优惠券管理',
          icon: 'Ticket',
          requiresAuth: true
        }
      },
      {
        path: 'baby-culture',
        name: 'BabyCulture',
        component: () => import('@/views/baby-culture/index1.vue'),
        meta: {
          title: '婴儿培养',
          icon: 'Reading',
          requiresAuth: true
        }
      },
      {
        path: 'points',
        name: 'PointsMall',
        component: () => import('@/views/points/index.vue'),
        meta: {
          title: '积分商城',
          icon: 'Coin',
          requiresAuth: true
        }
      },
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from) => {
  const isLoggedIn = !!sessionStorage.getItem('user')
  
  // 判断是否为管理员
  let isAdmin = false
  const userStr = sessionStorage.getItem('user')
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      isAdmin = user.role === 'admin'
    } catch (e) {
      console.error('解析用户信息失败:', e)
    }
  }
  
  if (to.path === '/') {
    if (isLoggedIn) {
      // 管理员跳转到仪表盘，普通用户跳转到商品列表
      if (isAdmin) {
        return { path: '/main/dashboard' }
      } else {
        return { path: '/main/product/list' }
      }
    } else {
      return { path: '/login' }
    }
  }
  
  // 普通用户访问仪表盘时，重定向到商品列表
  if (to.path === '/main/dashboard' && isLoggedIn && !isAdmin) {
    return { path: '/main/product/list' }
  }
  
  if (!to.meta.requiresAuth) {
    return true
  }
  
  if (!isLoggedIn) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }
  
  return true
})

export default router
