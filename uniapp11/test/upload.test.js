import test from 'node:test';
import assert from 'node:assert/strict';

const storage = { token: 'mobile-test-token' };
globalThis.uni = {
  getStorageSync(key) {
    return storage[key] || '';
  },
  removeStorageSync(key) {
    delete storage[key];
  }
};

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  if (url === 'blob:test-image') {
    return { blob: async () => new Blob(['image'], { type: 'image/jpeg' }) };
  }
  return { json: async () => ({ code: 200, data: { url: '/uploads/chat/test.jpg' } }) };
};

const { uploadChatImage } = await import('../api/index.js');

test('聊天图片上传携带登录 token', async () => {
  const result = await uploadChatImage('blob:test-image');
  const uploadCall = calls.find((item) => String(item.url).endsWith('/chat/upload'));

  assert.equal(result.code, 200);
  assert.ok(uploadCall, '应调用聊天图片上传接口');
  assert.equal(
    uploadCall.options.headers.Authorization,
    'Bearer mobile-test-token'
  );
});
