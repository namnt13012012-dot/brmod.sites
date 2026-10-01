const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

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

// ===== TẠO HMAC =====
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
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BRMOD — KEY HUB</title>
      <style>
        body { font-family: Arial; background: #050816; color: #fff; text-align: center; padding: 50px; }
        h1 { color: #22c55e; }
        .ok { color: #22c55e; font-size: 20px; }
        .api { background: #111a2f; padding: 15px; border-radius: 10px; margin: 10px auto; max-width: 500px; }
        a { color: #3b82f6; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>✅ BRMOD Server Đang Hoạt Động</h1>
      <p class="ok">Tất cả API đã sẵn sàng!</p>
      <div class="api">
        <p><strong>/info</strong> — Thông tin hệ thống & số key</p>
        <p><strong>/claim-key</strong> — Nhận key mới</p>
        <p><strong>/sync-keys</strong> — Kiểm tra key đã nhận</p>
      </div>
    </body>
    </html>
  `);
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

// ===== API /me =====
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

// ===== API /sync-keys =====
app.get('/sync-keys', (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userId = Array.from(users.entries()).find(([_, u]) => u.claimedKeys.length > 0)?.[0] 
    || `usr_${crypto.createHash('md5').update(clientIp).digest('hex').slice(0, 10)}`;
  const user = users.get(userId) || { claimedKeys: [] };
  const now = new Date();
  const activeKey = user.claimedKeys.find(k => new Date(k.expiresAt) > now);
  const remaining = activeKey ? Math.floor((new Date(activeKey.expiresAt) - now) / 60000) : 0;
  res.json({
    success: true, mergedKeys: user.claimedKeys, hasActiveKey: !!activeKey,
    activeKey: activeKey || null, activeRemainingMinutes: remaining,
    message: activeKey ? 'Đã đăng bộ 1 khóa vào tài khoản thành công!' : 'Chưa có khóa hoạt động'
  });
});

// ===== API /GenerateT =====
app.post('/GenerateT', (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const data = req.body || [];
  const token = generateHMAC(data, timestamp);
  res.json([token, timestamp, 100]);
});

// ===== API Nhận khóa =====
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

// ===== KHỞI ĐỘNG =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server chạy cổng ${PORT}`);
});
