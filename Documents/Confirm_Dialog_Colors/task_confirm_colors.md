<div dir="rtl" align="right">

# تسک‌ها: پیاده‌سازی رنگ‌بندی نقش‌ها در دیالوگ تایید ارجاع

- `[/]` **گام ۱: آماده‌سازی تسک‌ها**
  - `[x]` ساخت مستند Planning و اخذ تایید.
  - `[ ]` ایجاد و ذخیره Task در `Documents/Confirm_Dialog_Colors` (مرحله فعلی).
- `[ ]` **گام ۲: کامپوننت دیالوگ سراسری**
  - `[ ]` تغییر قالب `confirm-dialog.component.ts` از `{{ config()?.message }}` به `[innerHTML]="config()?.message"`.
- `[ ]` **گام ۳: فرم تخصیص کالا (`dispatch.ts`)**
  - `[ ]` افزودن استایل Tailwind (`span class="..."`) به متغیرهای نام در `executeFieldDispatch`.
- `[ ]` **گام ۴: تاییدیه نهایی**
  - `[ ]` اطمینان از صحت کامپایل کدها در ترمینال.
  - `[ ]` تولید فایل Walkthrough برای مشاهده کاربر.

</div>
