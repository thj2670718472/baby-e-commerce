var express = require('express');
var router = express.Router();

/* GET 服务健康检查（不再渲染初版 Express 欢迎页） */
router.get('/', function(req, res, next) {
  res.json({
    code: 200,
    message: 'BabyCity API',
    data: { status: 'ok', time: new Date().toISOString() }
  });
});

module.exports = router;
