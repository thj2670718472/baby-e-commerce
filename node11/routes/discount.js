var express = require('express');
var router = express.Router();
const { getDiscountStatus } = require('../utils/discount');

// 打折规则统一维护在 utils/discount.js，下单结算用的是同一份规则
router.get('/status', (req, res) => {
  res.send({
    code: 200,
    data: getDiscountStatus()
  });
});

module.exports = router;
