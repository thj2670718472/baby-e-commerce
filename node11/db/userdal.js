const user=require('./mysqldb').user;
const { hashPassword, verifyPassword } = require('../utils/password');

function userdal(){
    this.addUser=async function(model) {
        return await user.create({
            username: model.username,
            password: hashPassword(model.password),
            phone: model.phone || '',
            email: model.email || '',
            isactive: model.isactive || true,
            role: model.role === 'admin' ? 'admin' : 'user'
        });
    }
    this.getAllUser=async function() {
        // 已停用（业务上的“删除”）账号不再出现在管理端列表
        return await user.findAll({ where: { isactive: true } });
    }
    this.login=async function(model) {
        const userInfo = await user.findOne({ where: { username: model.username } });
        if (!userInfo) return null;

        // 停用账号不允许登录：删除用户改为停用，订单、评价等历史数据保留
        if (userInfo.isactive === false || Number(userInfo.isactive) === 0) return null;

        const { ok, needsUpgrade } = verifyPassword(model.password, userInfo.password);
        if (!ok) return null;

        // 历史明文密码：登录成功后自动升级为哈希
        if (needsUpgrade) {
            const upgraded = hashPassword(model.password);
            await user.update({ password: upgraded }, { where: { id: userInfo.id } });
            userInfo.password = upgraded;
        }

        return userInfo;
    }
    
    this.getUserByUsername=async function(username) {
        return await user.findOne({where:{username:username}});
    }
    this.getAdminUser=async function() {
        return await user.findOne({where:{role:'admin'},order:[['id','ASC']]});
    }
    this.getUserById=async function(id) {
        return await user.findOne({where:{id:id}});
    }
    this.deleteUser=async function(id) {
        return await user.destroy({where:{id:id}});
    }
    // 业务删除：停用账号，保留订单、评价、积分等历史数据（有外键引用时 destroy 会失败）
    this.disableUser=async function(id) {
        return await user.update({ isactive: false }, { where: { id } });
    }
    this.updateUser=async function(model) {
        return await user.update(model,{where:{id:model.id}});
    }
    
    this.changePassword=async function(model) {
        // 先验证旧密码是否正确（兼容历史明文密码）
        const userInfo = await user.findOne({ where: { username: model.username } });
        if (!userInfo) return null;

        const { ok } = verifyPassword(model.oldPassword, userInfo.password);
        if (!ok) return null;

        // 更新为新密码的哈希值
        const result = await user.update(
            { password: hashPassword(model.newPassword) },
            { where: { id: userInfo.id } }
        );
        // 返回更新结果，包含受影响的行数
        return { success: true, affectedRows: result[0] };
    }
  
}
module.exports=new userdal();