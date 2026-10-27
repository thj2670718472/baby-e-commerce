/**
 * 打折活动统一配置与计算
 *
 * 之前折扣只在前端 pages/Cart、Category、Home 里用 * 0.7 计算展示，
 * 后端下单时仍按 goods.price 原价结算，导致"页面显示7折、订单付原价"。
 * 现在规则集中在这里：前端调用 /discount/status 拿展示参数，
 * 下单时后端用同一份规则重算成交价，保证口径一致。
 */

// 配置区域（改时间、折扣都只改这里）
const TARGET_DAY = 1;        // 0=周日, 1=周一, 2=周二 ... 6=周六
const DISCOUNT_RATE = 0.7;   // 0.7 = 7折
const DISCOUNT_NAME = '狂欢日';  // 显示名称

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getDayName(day) {
  return DAY_NAMES[day];
}

// 金额统一保留两位小数，避免浮点误差
function roundPrice(value) {
  return Number(Number(value || 0).toFixed(2));
}

// 判断指定时间是否为打折日
// DISCOUNT_FORCE=on/off 仅用于本地联调强制开关，不配置时按真实日期判断
function isDiscountDay(date = new Date()) {
  const force = process.env.DISCOUNT_FORCE;
  if (force === 'on') return true;
  if (force === 'off') return false;
  return date.getDay() === TARGET_DAY;
}

// 计算距离目标星期还有多少天
function getDaysUntilTarget(targetDay, from = new Date()) {
  const currentDay = from.getDay();
  if (currentDay === targetDay) return 0;

  let diff = targetDay - currentDay;
  if (diff < 0) diff += 7;
  return diff;
}

function getTimeUntilNextDiscountDay(from = new Date()) {
  const daysUntil = getDaysUntilTarget(TARGET_DAY, from);

  const nextDiscountDay = new Date(from);
  nextDiscountDay.setDate(from.getDate() + daysUntil);
  nextDiscountDay.setHours(0, 0, 0, 0);

  const timeUntil = nextDiscountDay - from;

  return {
    days: Math.floor(timeUntil / (1000 * 60 * 60 * 24)),
    hours: Math.floor((timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60)),
    totalSeconds: Math.max(0, Math.floor(timeUntil / 1000))
  };
}

// 打折活动完整状态：/discount/status 与下单结算共用
function getDiscountStatus(now = new Date()) {
  const isActive = isDiscountDay(now);

  let countdown = { days: 0, hours: 0, minutes: 0, totalSeconds: 0 };
  let endTime = null;

  if (isActive) {
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    const timeLeft = dayEnd - now;

    countdown = {
      days: 0,
      hours: Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)),
      totalSeconds: Math.max(0, Math.floor(timeLeft / 1000))
    };
    endTime = dayEnd.toISOString();
  } else {
    countdown = getTimeUntilNextDiscountDay(now);
  }

  const dayName = getDayName(TARGET_DAY);

  return {
    isActive,
    discountRate: DISCOUNT_RATE,
    discountText: isActive
      ? `${dayName}${DISCOUNT_NAME} 全场${Math.round(DISCOUNT_RATE * 10)}折！`
      : `距离${dayName}${DISCOUNT_NAME}还有`,
    targetDay: TARGET_DAY,
    targetDayName: dayName,
    countdown,
    endTime
  };
}

/**
 * 把原价折算成成交单价
 * @param {number|string} price 商品原价
 * @param {boolean} isActive 当前是否处于打折日，默认按当前时间判断
 */
function applyDiscount(price, isActive) {
  const origin = Number(price) || 0;
  const active = typeof isActive === 'boolean' ? isActive : isDiscountDay();
  if (!active) return roundPrice(origin);
  return roundPrice(origin * DISCOUNT_RATE);
}

module.exports = {
  TARGET_DAY,
  DISCOUNT_RATE,
  DISCOUNT_NAME,
  getDayName,
  roundPrice,
  isDiscountDay,
  getDiscountStatus,
  applyDiscount
};
