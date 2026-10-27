import BaseAPI from "./base";
import { ElMessage } from "element-plus";

class PointsAPI extends BaseAPI {
  constructor() {
    super("/points");
  }

  // 积分商品列表（status=all 查全部，默认只查上架）
  async getShopList(params = {}) {
    try {
      return await this.get("/shop", params);
    } catch (error) {
      if (error._isCanceled) {
        return { code: 200, data: [] };
      }
      ElMessage.error(error.message || "获取积分商品失败");
      throw error;
    }
  }

  // 新增积分商品
  async addShopGoods(data) {
    try {
      const res = await this.post("/shop", data);
      if (res.code === 200) ElMessage.success("新增成功");
      return res;
    } catch (error) {
      if (error._isCanceled) return { code: 400, message: "请求已取消" };
      ElMessage.error(error.message || "新增失败");
      throw error;
    }
  }

  // 修改积分商品
  async updateShopGoods(id, data) {
    try {
      const res = await this.put(`/shop/${id}`, data);
      if (res.code === 200) ElMessage.success("保存成功");
      return res;
    } catch (error) {
      if (error._isCanceled) return { code: 400, message: "请求已取消" };
      ElMessage.error(error.message || "保存失败");
      throw error;
    }
  }

  // 删除积分商品
  async removeShopGoods(id) {
    try {
      const res = await this.delete(`/shop/${id}`);
      if (res.code === 200) ElMessage.success("删除成功");
      return res;
    } catch (error) {
      if (error._isCanceled) return { code: 400, message: "请求已取消" };
      ElMessage.error(error.message || "删除失败");
      throw error;
    }
  }

  // 兑换记录列表（管理员）
  async getExchangeList(params = {}) {
    try {
      return await this.get("/exchange-list", params);
    } catch (error) {
      if (error._isCanceled) {
        return { code: 200, data: { list: [], total: 0 } };
      }
      ElMessage.error(error.message || "获取兑换记录失败");
      throw error;
    }
  }

  // 更新兑换单状态（发货 / 完成 / 取消并退还积分）
  async updateExchangeStatus(id, status) {
    try {
      const res = await this.put(`/exchange/${id}/status`, { status });
      if (res.code === 200) ElMessage.success("状态已更新");
      return res;
    } catch (error) {
      if (error._isCanceled) return { code: 400, message: "请求已取消" };
      ElMessage.error(error.message || "状态更新失败");
      throw error;
    }
  }
}

export default new PointsAPI();
