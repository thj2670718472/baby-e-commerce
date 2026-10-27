import BaseAPI from './base'

class CouponAPI extends BaseAPI {
  constructor() {
    super('/coupon')
  }

  getAdminTemplates() {
    return this.get('/admin/templates')
  }

  createTemplate(data) {
    return this.post('/admin/templates', data)
  }

  updateTemplate(id, data) {
    return this.put(`/admin/templates/${id}`, data)
  }

  issueCoupons(data) {
    return this.post('/admin/issue', data)
  }

  getUserCoupons(params = {}) {
    return this.get('/admin/user-coupons', params)
  }

  revokeUserCoupon(id, reason) {
    return this.put(`/admin/user-coupons/${id}/revoke`, { reason })
  }

  getStatistics() {
    return this.get('/admin/statistics')
  }
}

export default new CouponAPI()
