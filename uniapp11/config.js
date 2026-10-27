/**
 * 接口地址配置
 * - H5 开发：默认 http://localhost:3000
 * - 真机 / 小程序：把 VITE_API_BASE 改成电脑的局域网地址（启动后端时会打印），
 *   例如 VITE_API_BASE=http://192.168.1.10:3000
 * - 也可以在运行时调用 setApiBaseUrl('http://192.168.1.10:3000') 动态切换
 */
const ENV = (() => {
  try {
    return (typeof import.meta !== 'undefined' && import.meta.env) || {};
  } catch (e) {
    return {};
  }
})();

const DEFAULT_BASE_URL = 'http://localhost:3000';
const OVERRIDE_KEY = 'apiBaseUrl';

const normalize = (url) => String(url || '').trim().replace(/\/+$/, '');

export function setApiBaseUrl(url) {
  if (!url) {
    uni.removeStorageSync(OVERRIDE_KEY);
    return;
  }
  uni.setStorageSync(OVERRIDE_KEY, normalize(url));
}

export function getApiBaseUrl() {
  let cached = '';
  try {
    cached = normalize(uni.getStorageSync(OVERRIDE_KEY));
  } catch (e) {
    cached = '';
  }
  return cached || normalize(ENV.VITE_API_BASE) || DEFAULT_BASE_URL;
}

export const BASE_URL = getApiBaseUrl();

export default { BASE_URL, getApiBaseUrl, setApiBaseUrl };
