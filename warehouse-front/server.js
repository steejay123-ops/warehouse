const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// ایجاد پروکسی
const apiProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
});

// هدایت درخواست‌های API به پروکسی، بدون حذف کلمه /api
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return apiProxy(req, res, next);
  }
  next();
});

// سرو کردن فایل‌های استاتیک فرانت‌اند
app.use(express.static(path.join(__dirname, 'dist/warehouse-app/browser')));

// ریدایرکت بقیه مسیرها به index.html (برای روتینگ انگولار)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist/warehouse-app/browser/index.html'));
});

// گوش دادن روی تمام کارت‌های شبکه (0.0.0.0) برای دسترسی گوشی و لپ‌تاپ‌های دیگر
app.listen(4200, '0.0.0.0', () => {
  console.log('Production server with proxy running on http://0.0.0.0:4200');
});
