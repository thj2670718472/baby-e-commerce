import request from '@/utils/request'

// 秒杀管理（场次 + 秒杀商品），全部需要管理员 token

export function getSeckillAdminList() {
  return request({ url: '/seckill/admin/list', method: 'get' })
}

export function createSeckillSession(data) {
  return request({ url: '/seckill/session', method: 'post', data })
}

export function updateSeckillSession(id, data) {
  return request({ url: `/seckill/session/${id}`, method: 'put', data })
}

export function deleteSeckillSession(id) {
  return request({ url: `/seckill/session/${id}`, method: 'delete' })
}

export function createSeckillGoods(data) {
  return request({ url: '/seckill/goods', method: 'post', data })
}

export function updateSeckillGoods(id, data) {
  return request({ url: `/seckill/goods/${id}`, method: 'put', data })
}

export function deleteSeckillGoods(id) {
  return request({ url: `/seckill/goods/${id}`, method: 'delete' })
}
