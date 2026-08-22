# چک‌لیست وظایف (Task List)

<div dir="rtl" align="right">

- [x] **فاز ۱: افزودن آیتم منوی رهگیری تغییرات به سایدبار و تنظیم مجوزها**
  - [x] افزودن `audit` به آرایه `SYSTEM_NAV_ITEMS` در `layout.ts`
  - [x] هماهنگ‌سازی دسترسی‌های روت `/audit` در `auth.guard.ts` (`view_wh_audit`, `perm_sys_logs`)

- [x] **فاز ۲: افزودن کامپوننت انتخابگر انبار به صفحه رهگیری تغییرات**
  - [x] ایمپورت `WarehouseSelectorComponent` در `audit.ts`
  - [x] پیاده‌سازی متد `onWarehouseChanged` جهت تغییر انبار جاری و رفرش بلادرنگ داده‌ها و آمارها
  - [x] قرار دادن `<app-warehouse-selector>` با گزینه `[allowAll]="true"` در هدر `audit.html`

- [x] **فاز ۳: بیلد، راستی‌آزمایی و تست در مرورگر**
  - [x] اجرای `npm run build` و رفع هرگونه خطای کامپایل
  - [x] باز کردن مرورگر و تست عملیاتی انتخاب انبار و گزینه «همه انبارها»
  - [x] ثبت گزارش نهایی و مستندسازی کامل (DUAL-SAVE)

</div>
