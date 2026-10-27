import BaseAPI from "./base";
import { ElMessage } from "element-plus";
class UserAPI extends BaseAPI {
  constructor() {
    super("/user"); //设置调用的路径
  }

  // 登录
  async login(data) {
    try {
      // 使用 POST，避免密码出现在 URL 与访问日志中
      const res = await this.post("/login", data);
      if (res.code === 200) {
        //ElMessage.success("登录成功");
        // 保存登录 token
        const token = res.token || (res.data && res.data.token);
        if (token) {
          sessionStorage.setItem("token", token);
        }
        // 保存当前用户
        if (res.data) {
          // 确保存储的是对象，不是字符串
          sessionStorage.setItem("user", JSON.stringify(res.data));
        }
      }
      return res;
    } catch (error) {
      ElMessage.error(error.message || "登录失败");
      throw error;
    }
  }
  
  // 退出登录
  // async logout() {
  // try {
  // const res = await this.post('/logout')
  // // 清除本地存储
  // localStorage.removeItem('token')
  // localStorage.removeItem('userInfo')
  // toast.success('已退出登录')
  // return res
  // } catch (error) {
  // toast.error('退出失败')
  // throw error
  // }
  // }

  // 注册
  async register(data) {
    try {
      const res = await this.post('/register', data)
      if (res.code === 200) {
        ElMessage.success('注册成功')
      }
      return res
    } catch (error) {
      ElMessage.error(error.message || '注册失败')
      throw error
    }
  }
  
  // 修改密码
  async changePassword(data) {
    try {
      const res = await this.post('/change-password', data)
      if (res.code === 200) {
        ElMessage.success('密码修改成功')
      } else {
        ElMessage.error(res.message || '密码修改失败')
      }
      return res
    } catch (error) {
      ElMessage.error(error.message || '密码修改失败')
      throw error
    }
  }
  
  // 更新个人资料
  async updateProfile(data) {
    try {
      const res = await this.put('/profile', data)
      if (res.code === 200) {
        ElMessage.success('个人资料更新成功')
      } else {
        ElMessage.error(res.message || '个人资料更新失败')
      }
      return res
    } catch (error) {
      ElMessage.error(error.message || '个人资料更新失败')
      throw error
    }
  }
  
  // 获取用户列表
  async getUsers() {
    try {
      const res = await this.get('/list')
      return res
    } catch (error) {
      ElMessage.error(error.message || '获取用户列表失败')
      throw error
    }
  }
  
  // 删除用户
  async deleteUser(id) {
    try {
      const res = await this.delete(`/${id}`)
      if (res.code === 200) {
        ElMessage.success('删除成功')
      } else {
        ElMessage.error(res.message || '删除失败')
      }
      return res
    } catch (error) {
      ElMessage.error(error.message || '删除失败')
      throw error
    }
  }
}
export default new UserAPI();