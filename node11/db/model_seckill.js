/**
 * 秒杀模型：场次 + 秒杀商品
 * 秒杀库存（stock）是独立于商品库存的专属池，抢购时原子扣减；
 * 未支付取消/超时释放时回补秒杀库存。
 */
function model_seckill(db, SEQ) {
    const SeckillSession = db.define('seckill_session', {
        name: {
            type: SEQ.STRING,
            allowNull: false,
            comment: '场次名称'
        },
        startTime: {
            type: SEQ.DATE,
            allowNull: false,
            comment: '开始时间'
        },
        endTime: {
            type: SEQ.DATE,
            allowNull: false,
            comment: '结束时间'
        },
        status: {
            type: SEQ.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: '是否启用'
        }
    }, {
        tableName: 'tb_seckill_session',
        freezeTableName: true
    });

    const SeckillGoods = db.define('seckill_goods', {
        sessionId: {
            type: SEQ.INTEGER,
            allowNull: false,
            comment: '所属场次ID'
        },
        goodsId: {
            type: SEQ.INTEGER,
            allowNull: false,
            comment: '商品ID'
        },
        goodsName: {
            type: SEQ.STRING,
            allowNull: false,
            comment: '商品名称（冗余，列表页免联表）'
        },
        goodsImage: {
            type: SEQ.TEXT,
            allowNull: true,
            comment: '商品主图'
        },
        seckillPrice: {
            type: SEQ.DECIMAL(10, 2),
            allowNull: false,
            comment: '秒杀价'
        },
        originalPrice: {
            type: SEQ.DECIMAL(10, 2),
            allowNull: false,
            comment: '原价（划线展示用）'
        },
        stock: {
            type: SEQ.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '秒杀专属库存'
        },
        maxPerUser: {
            type: SEQ.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: '每人限购件数'
        },
        sort: {
            type: SEQ.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: '排序，越小越靠前'
        }
    }, {
        tableName: 'tb_seckill_goods',
        freezeTableName: true
    });

    return { SeckillSession, SeckillGoods };
}
module.exports = model_seckill;
