<div dir="rtl" align="right">

# گزارش تغییرات: بهبود پنل پیگیری شمارش

## خلاصه تغییرات

| # | ویژگی | فایل تغییر یافته | توضیح |
|---|-------|------------------|-------|
| 1 | Mini Dashboard | `count-tracking.html` + `.ts` | ۴ باکس آماری (کل، شمرده شده، دارای مغایرت، تأیید نهایی) |
| 2 | فیلتر مغایرت | `count-tracking.html` + `.ts` | دکمه Toggle «فقط دارای مغایرت» |
| 3 | ستون مغایرت | `count-tracking.html` + `.ts` | نمایش `+N` / `-N` / `✓ صفر` با رنگ‌بندی |
| 4 | سورت کلاینت‌ساید | `count-tracking.ts` | `onSortChanged()` + `resolveSortValue()` |
| 5 | تأیید گروهی مدیر | `count-tracking.html` + `.ts` | دکمه + فراخوانی `bulkManagerApprove` |
| 6 | WebSocket | `count-tracking.ts` | اشتراک در `notifications$` برای به‌روزرسانی خودکار |

---

## جزئیات فنی

### ۱. Mini Dashboard
- متد `computeStats()` پس از هر `loadTasks()` آمار را محاسبه می‌کند.
- ۴ باکس زیبا با آیکون SVG و رنگ‌بندی متمایز در هدر صفحه.

### ۲. فیلتر مغایرت
- دکمه Toggle در هدر (کنار دکمه‌های قبلی).
- متد `toggleDiscrepancyFilter()` متغیر `showOnlyDiscrepancies` را عوض کرده و `applyFilters()` را فراخوانی می‌کند.
- فیلتر در `applyFilters()` قبل از تمام فیلترهای دیگر اعمال می‌شود.

### ۳. ستون مغایرت
- فیلد `_discrepancy` در `loadTasks()` محاسبه و به هر `row` اضافه می‌شود.
- نمایش:
  - `null` → خاکستری `"-"`
  - `0` → سبز `✓ صفر`
  - مثبت → نارنجی `+N`
  - منفی → قرمز `-N`

### ۴. سورت کلاینت‌ساید

> [!IMPORTANT]
> قبلاً رویداد `(sortChanged)` به جدول متصل نبود و سورت اصلاً کار نمی‌کرد!

- متد `onSortChanged(sort: SortState)` اضافه شد.
- متد `resolveSortValue()` برای هر ستون مقدار مناسب سورت برمی‌گرداند (عدد، رشته، تاریخ).
- پشتیبانی از Collation فارسی (`localeCompare('fa')`).

### ۵. تأیید گروهی مدیر
- دکمه «تأیید گروهی بدون مغایرت» اضافه شد.
- متد `bulkApproveGreenTasks()` فقط تسک‌هایی با وضعیت `MANAGER_REVIEW` و `_discrepancy === 0` را انتخاب می‌کند.
- با تأیید کاربر، `bulkManagerApprove` فراخوانی شده و وضعیت به `FINAL_APPROVED` تغییر می‌کند.

### ۶. WebSocket
- اشتراک در `WebSocketService.notifications$` در `ngOnInit`.
- لغو اشتراک در `ngOnDestroy`.
- در صورت دریافت رویداد `count_task_update`، لیست تسک‌ها به‌طور خودکار رفرش می‌شود.

## بیلد
- بیلد موفق ✅
- بدون خطای کامپایل

</div>
