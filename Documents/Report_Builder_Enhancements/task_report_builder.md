<div dir="rtl" align="right">

# لیست وظایف: بهبود موتور و رابط کاربری گزارش‌ساز (فاز تکمیلی)

| وضعیت | بخش | وظیفه | فایل مرتبط |
| :---: | :---: | :--- | :--- |
| `[x]` | **مستندات** | ایجاد ساختار DUAL-SAVE در پوشه Documents | `Documents/` |
| `[x]` | **فرانت‌اند** | افزودن `operators`, `choices`, `dynamic` به `_joinTargetFields` | `reports.ts` |
| `[x]` | **فرانت‌اند** | جایگزینی `fieldsMeta` با `allSelectableFields` در `reports.html` برای فیلترها | `reports.html` |
| `[x]` | **فرانت‌اند** | بومی‌سازی کلمات `LEFT` و `INNER` در فرم JOIN | `reports.html` |
| `[x]` | **بک‌اند** | تبدیل `exists_aliases` به ویژگی کلاس `self._exists_aliases` | `engine.py` |
| `[x]` | **بک‌اند** | افزودن بررسی امنیتی و ساخت `Q(Exists(...))` در `_build_node_q` | `engine.py` |
| `[x]` | **بک‌اند** | حذف حلقه قدیمی `Exists(subq)` از متد `build()` | `engine.py` |
| `[x]` | **بک‌اند** | رفع ارور ۵۰۰ با محدود کردن خروجیِ چندین جدول `many` | `engine.py` |
| `[x]` | **بک‌اند** | تضمین پایداری صفحه‌بندی Flat JOIN با افزودن شناسه‌های جداول به `order_by` | `engine.py` |
| `[ ]` | **بررسی** | بیلد فرانت‌اند و بررسی سرویس‌ها | `Terminal` |

</div>
