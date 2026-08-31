# فهرست وظایف فازبندی‌شده بازطراحی منوها و کارتابل‌ها (Role-Based Menu & Cartable Redesign Tasks)

## فاز ۱: زیرساخت مسیردهی هم‌زمان و سینک URL (Routing Coexistence & URL Sync)
- [ ] <!-- id: 1.1 --> تعریف مسیرهای جدید در `app.routes.ts` (`/attendance-hub`, `/manager-approvals`, `/finance-cartable`, `/base-settings`) با حفظ کامل مسیرهای قبلی <!-- priority: High -->
- [ ] <!-- id: 1.2 --> پیاده‌سازی سرویس هماهنگی دوطرفه State تب‌ها و فیلترها با URL Query Params <!-- priority: High -->
- [ ] <!-- id: 1.3 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G2 (URL & Filter Sync Guardian) <!-- priority: High -->

## فاز ۲: استقرار منوهای جدید در کنار منوهای قبلی سایدبار (Sidebar Coexistence)
- [ ] <!-- id: 2.1 --> اضافه کردن ۴ پرتال جدید به منوی سایدبار در `layout.ts` بدون حذف منوهای قبلی <!-- priority: High -->
- [ ] <!-- id: 2.2 --> به‌روزرسانی قالب سایدبار در `layout.html` جهت تمایز شکیل و دسترسی هم‌زمان به هر دو حالت <!-- priority: High -->
- [ ] <!-- id: 2.3 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G1 (Sidebar Coexistence Guardian) <!-- priority: High -->

## فاز ۳: پیاده‌سازی کارتابل اختصاصی تاییدات مدیر بر پایه کپی ساختار (Manager Approval Hub)
- [ ] <!-- id: 3.1 --> ساخت کامپوننت `ManagerApprovals` با هدر اختصاصی و ۴ تب بالای صفحه <!-- priority: High -->
- [ ] <!-- id: 3.2 --> کپی مستقیم کدهای تاییدات پرسنل و ناوگان جدید (بدون بازنویسی لاجیک) <!-- priority: High -->
- [ ] <!-- id: 3.3 --> کپی ماژولار کارتابل ویرایش‌ها و کامپوننت مقایسه تغییرات (Diff Viewer) <!-- priority: High -->
- [ ] <!-- id: 3.4 --> کپی جدول و لاجیک تایید دوره‌های ۳۱ روزه ماهانه کارکرد <!-- priority: High -->
- [ ] <!-- id: 3.5 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G0 (Zero-Rewrite Guardian) و G3 (Manager Hub Guardian) <!-- priority: High -->

## فاز ۴: پیاده‌سازی کارتابل جامع مالی و حسابداری بر پایه کپی ساختار (Finance Cartable)
- [ ] <!-- id: 4.1 --> ساخت کامپوننت `FinanceCartable` با ۵ تب استاندارد در بالای صفحه <!-- priority: High -->
- [ ] <!-- id: 4.2 --> کپی لاجیک تایید نهایی مالی (فعال‌سازی قطعی پرسنل و ناوگان) <!-- priority: High -->
- [ ] <!-- id: 4.3 --> کپی دقیق موتور ۵۸ ستونه حقوق و فیش حقوقی بدون دستکاری فرمول‌ها <!-- priority: High -->
- [ ] <!-- id: 4.4 --> کپی ماژول تسویه ناوگان و خروجی فایل شبا/پایا بانکی <!-- priority: High -->
- [ ] <!-- id: 4.5 --> کپی ژنراتور دیسکت‌های قانونی تامین اجتماعی/مالیات و گزارشات مالی <!-- priority: High -->
- [ ] <!-- id: 4.6 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G0 (Zero-Rewrite Guardian) و G4 (Finance Guardian) <!-- priority: High -->

## فاز ۵: پیاده‌سازی پورتال مستقل تنظیمات پایه بر پایه کپی ساختار (Base Settings Portal)
- [ ] <!-- id: 5.1 --> ساخت کامپوننت `BaseSettings` با ۳ تب ماژولار و توسعه‌پذیر <!-- priority: Medium -->
- [ ] <!-- id: 5.2 --> کپی جداول ۲۰ گروه شغلی و پارامترهای دستمزد <!-- priority: Medium -->
- [ ] <!-- id: 5.3 --> کپی تقویم کاری و روزهای تعطیل/جمعه‌کاری <!-- priority: Medium -->
- [ ] <!-- id: 5.4 --> 🛡️ اجرای ارزیابی ایجنت نگهبان G0 (Zero-Rewrite Guardian) و G5 (Base Settings Guardian) <!-- priority: Medium -->

## فاز ۶: آزمون‌های جامع ۷ ایجنت نگهبان، اعتبارسنجی Build و تحویل به کاربر (Final Verification)
- [ ] <!-- id: 6.1 --> اجرای ارزیابی نهایی هر ۷ ایجنت نگهبان (Pass All 7 Strict Guardians) <!-- priority: High -->
- [ ] <!-- id: 6.2 --> بررسی عدم وجود خطای کامپایل فرانت‌اند (`npx tsc --noEmit`) <!-- priority: High -->
- [ ] <!-- id: 6.3 --> ثبت مستندات نهایی Walkthrough طبق استاندارد DUAL-SAVE <!-- priority: Medium -->
- [ ] <!-- id: 6.4 --> (پس از تایید نهایی و رضایت کاربر): پاک‌سازی اختیاری منوهای قدیمی <!-- priority: Low -->
