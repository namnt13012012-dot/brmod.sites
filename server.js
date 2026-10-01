const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path'); // ✅ Thêm thư mục file

const app = express();

app.use(cors());
app.use(express.json());

// ✅ PHỤC VỤ FILE GIAO DIỆN — ĐỂ Ở ĐÂY
app.use(express.static(path.join(__dirname, '.')));

// ===== CẤU HÌNH =====
const SECRET_KEY = 'BrModSites_2026_KhoaBiMat_ABC123xyz';
const CONFIG = {
  siteUrl: 'https://brmod-sites.onrender.com',
  minWaitSeconds: 10,
  maxKeysPerIp: 2,
  hasLink4mKey: true,
  youtube: {
    channelName: 'Quốc Thái PC',
    channelUrl: 'https://www.youtube.com/@quocthaipc',
    channelHandle: '@quocthaipc'
  }
};

// ===== SỐ LƯỢNG KEY =====
let availableKeys = 1000;

// ===== DỮ LIỆU =====
const users = new Map();
const ipClaims = new Map();

// ===== HMAC =====
function generateHMAC(data, timestamp) {
  const str = JSON.stringify(data) + timestamp;
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(str)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ===== TẠO KEY =====
function createKey(durationHours = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  const now = new Date();
  const exp = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  return {
    key: `BrMod-${code}`,
    durationHours,
    expiresAt: exp.toISOString(),
    claimedAt: now.toISOString(),
    source: 'CLAIM'
  };
}

// ===== TRANG CHỦ =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // ✅ Mở index.html tự động
});

// ===== API /info =====
app.get('/info', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const ipData = ipClaims.get(clientIp) || { count: 0 };
  res.json({
    success: true,
    siteUrl: CONFIG.siteUrl,
    minWaitSeconds: CONFIG.minWaitSeconds,
    hasLink4mKey: CONFIG.hasLink4mKey,
    availableKeys,
    clientIp,
    maxKeysPerIp: CONFIG.maxKeysPerIp,
    ipClaimsToday: ipData.count,
    ipRemainingClaims: Math.max(0, CONFIG.maxKeysPerIp - ipData.count),
    iplimitReached: ipData.count >= CONFIG.maxKeysPerIp,
    youtube: CONFIG.youtube
  });
});

app.get('/me', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userId = `usr_${crypto.createHash('md5').update(clientIp + Date.now()).digest('hex').slice(0, 10)}`;
  if (!users.has(userId)) {
    users.set(userId, {
      id: userId, username: 'ddhwww', role: 'user', status: 'active',
      referralCode: userId.slice(-6), referredBy: null, referralsCount: 0,
      bonusClaims: 0, claimedKeys: [], referralHistory: []
    });
  }
  res.json({ success: true, user: users.get(userId), claimedKeys: users.get(userId).claimedKeys });
});

app.get('/sync-keys', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userId = Array.from(users.entries()).find(([_, u]) => u.claimedKeys.length > 0)?.[0]
    || `usr_${crypto.createHash('md5').update(clientIp).digest('hex').slice(0, 10)}`;
  const user = users.get(userId) || { claimedKeys: [] };
  const now = new Date();
  const activeKey = user.claimedKeys.find(k => new Date(k.expiresAt) > now);
  res.json({
    success: true, mergedKeys: user.claimedKeys, hasActiveKey: !!activeKey,
    activeKey: activeKey || null,
    activeRemainingMinutes: activeKey ? Math.floor((new Date(activeKey.expiresAt) - now) / 60000) : 0,
    message: activeKey ? 'Đã đăng bộ 1 khóa vào tài khoản thành công!' : 'Chưa có khóa hoạt động'
  });
});

app.post('/GenerateT', (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const token = generateHMAC(req.body || [], timestamp);
  res.json([token, timestamp, 100]);
});

app.post('/claim-key', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const ipData = ipClaims.get(clientIp) || { count: 0 };
  if (ipData.count >= CONFIG.maxKeysPerIp) {
    return res.status(429).json({ success: false, error: 'Đã đạt giới hạn 2 khóa/IP hôm nay' });
  }
  if (availableKeys <= 0) {
    return res.status(404).json({ success: false, error: 'Khóa đã hết' });
  }
  const newKey = createKey(5);
  ipClaims.set(clientIp, { count: ipData.count + 1 });
  availableKeys--;
  const userId = `usr_${crypto.createHash('md5').update(clientIp).digest('hex').slice(0, 10)}`;
  if (!users.has(userId)) {
    users.set(userId, {
      id: userId, username: 'ddhwww', role: 'user', status: 'active',
      referralCode: userId.slice(-6), referredBy: null, referralsCount: 0,
      bonusClaims: 0, claimedKeys: [], referralHistory: []
    });
  }
  users.get(userId).claimedKeys.push(newKey);
  res.json({ success: true, key: newKey, message: 'Nhận khóa thành công!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server chạy cổng ${PORT}`));
