<div dir="rtl" align="right">

# پیاده‌سازی PWA و دیتابیس آفلاین (Offline-First)

این طرح به منظور تبدیل اپلیکیشن Angular فعلی به یک برنامه پیشرونده وب (PWA) با قابلیت کارکرد کامل در حالت آفلاین و همگام‌سازی داده‌ها تدوین شده است.

## بررسی و بازبینی
در بررسی اولیه این طرح، متوجه شدم که سرویس ورکر پیش‌فرض انگولار (NGSW) از همگام‌سازی آفلاینِ درخواست‌های تغییری (مثل POST/PUT/DELETE) پشتیبانی نمی‌کند. بنابراین، طرح را تکمیل کردم تا از ترکیب Dexie.js برای دیتابیس لوکال و یک سرویس سفارشی همگام‌سازی (Sync Service) در سطح اپلیکیشن استفاده کنیم. مفاهیمی مثل آپدیت خوش‌بینانه (Optimistic UI) به آن اضافه شد تا کاربر تجربه‌ای مشابه اپلیکیشن‌های نیتیو داشته باشد.

## User Review Required
> [!WARNING]
> ارتقاء به PWA نیاز به HTTPS دارد (مگر در لوکال هاست). آیا محیط پروداکشن SSL دارد؟

> [!IMPORTANT]
> تداخل داده‌ها (Conflict Resolution): استراتژی آخرین تغییر برنده است (Last Write Wins) پیشنهاد می‌شود. تایید می‌کنید؟

## Proposed Changes

### 1. PWA and App Shell Setup
- **[NEW]** ng add @angular/pwa
- **[MODIFY]** ngsw-config.json

### 2. Offline Database
- **[NEW]** npm install dexie
- **[NEW]** src/app/core/services/db.service.ts

### 3. Synchronization Mechanism (Background Sync replacement)
- **[NEW]** src/app/core/services/sync.service.ts (listens for 'online' event)
- **[MODIFY]** src/app/core/interceptors/api.interceptor.ts (queues POST/PUT requests in offline mode)

### 4. Optimistic UI
- **[MODIFY]** UI forms/components to update locally immediately.

</div>