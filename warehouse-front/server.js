const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// ایجاد پروکسی یکپارچه برای API و WebSocket با فیلتر دقیق مسیر
const backendProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  ws: true, // فعال‌سازی WebSocket
  pathFilter: (pathname, req) => {
    // فقط درخواست‌هایی که با /api یا /ws شروع می‌شوند را پروکسی کن
    return pathname.startsWith('/api') || pathname.startsWith('/ws');
  }
});

// استفاده از پروکسی به عنوان Middleware بدون بریدن مسیر (بدون mount path)
app.use(backendProxy);

// سرو کردن فایل‌های استاتیک فرانت‌اند
app.use(express.static(path.join(__dirname, 'dist/warehouse-app/browser')));

// ریدایرکت بقیه مسیرها به index.html (برای روتینگ انگولار)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/warehouse-app/browser/index.html'));
});

// گوش دادن روی تمام کارت‌های شبکه (0.0.0.0) برای دسترسی گوشی و لپ‌تاپ‌های دیگر
const server = app.listen(4200, '0.0.0.0', () => {
  console.log('Production server with proxy running on http://0.0.0.0:4200');
});

// هندل کردن اتصال‌های WebSocket فقط برای مسیر مجاز
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    backendProxy.upgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});
