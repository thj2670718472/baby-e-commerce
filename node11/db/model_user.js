function model_user(db,SEQ){
    const user=db.define('user',{
        username:{
            type:SEQ.STRING,
            allowNull:false,
            unique:'uq_tb_user_username'
        },
        password:{
            type:SEQ.STRING,
            allowNull:false
        },
        role:{
            type:SEQ.STRING(20),
            allowNull:false,
            defaultValue:'user',
            validate:{
                isIn:[['user','admin']]
            }
        },
        phone:{
            type:SEQ.STRING,
            allowNull:false
        },
        email:{
            type:SEQ.STRING,
            allowNull:false
        },
        isactive:{
            type:SEQ.BOOLEAN,
            allowNull:false
        },
        points:{
            type:SEQ.INTEGER,
            allowNull:false,
            defaultValue:0
        },
        // ========== 新增 avatar 字段 ==========
        avatar:{
            type:SEQ.STRING,
            allowNull:true,
            defaultValue:''
        }
        // ====================================
    },{
        tableName:'tb_user',
        freezeTableName:true
    });
    return user;
}
module.exports=model_user;
