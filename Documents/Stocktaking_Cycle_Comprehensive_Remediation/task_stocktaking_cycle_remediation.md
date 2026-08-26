<div dir="rtl" align="right">

# چک‌لیست وظایف طرح جامع اصلاح چرخه انبارگردانی (Task Checklist)

## فاز ۱: تصحیح و ایمن‌سازی هسته بک‌اند (Backend Core & Security)
- [x] اصلاح منطق شمارش کور در `CountTaskViewSet` و تزریق `is_blind: False` در `get_serializer_context` <!-- id: 1-1 -->
- [x] قفل‌گذاری وضعیت در `perform_update` و جلوگیری از پرش‌های غیرمجاز وضعیت با متد PATCH <!-- id: 1-2 -->
- [x] تصحیح فیلتر جستجوی متنی `q_filter` در `CountTaskViewSet` و حذف فیلدهای منسوخ `item_no` و `old_location` <!-- id: 1-3 -->
- [x] تصحیح فیلتر جستجوی متنی در `DocTaskViewSet` و حذف `en_unic_code` و `item_no` <!-- id: 1-4 -->
- [x] افزودن اعتبارسنجی انبار (IDOR Check) در متدهای `bulk_manager_approve` و `bulk_manager_reject` <!-- id: 1-5 -->
- [x] اصلاح فرمول مغایرت در خروجی اکسل بر مبنای موجودی دفتری اولیه (`bal4miv`) <!-- id: 1-6 -->
- [x] **دروازه نگهبان ۱ (Gate 1):** اجرای موفقیت‌آمیز تمام ۶۹ تست یونیت بک‌اند در `inventory/tests.py` <!-- id: 1-7 -->

---

## فاز ۲: همگام‌سازی کارتابل‌ها و ایزولاسیون کش کلاینت (Frontend SWR & Sync)
- [x] ایزولاسیون کلیدهای SWR در `supervisor-dashboard.ts` و `manager-review.ts` جهت جلوگیری از تداخل با سایر نقش‌ها <!-- id: 2-1 -->
- [x] اصلاح همگام‌سازی وضعیت در `counter-dashboard.ts` در تابع `bulkSubmit` <!-- id: 2-2 -->
- [x] تفکیک دسترسی و اصلاح شرط نمایش موجودی سیستمی (`bal4miv`) در `counter-dashboard.html` <!-- id: 2-3 -->
- [x] **دروازه نگهبان ۲ (Gate 2):** اعتبارسنجی بیلد فرانت‌اند با `ng build` <!-- id: 2-4 -->

---

## فاز ۳: مدرن‌سازی تجربه کاربری و پاکسازی ستون‌ها (UI/UX & Dead Columns)
- [x] حذف ستون‌های منسوخ و مرده `old_location`، `plpkitem` و `item_no` از `dispatch.html` <!-- id: 3-1 -->
- [x] جایگزینی پنجره‌های بومی `confirm()` با کامپوننت مدرن `ConfirmDialogService` در داشبوردها و گزارش‌ساز <!-- id: 3-2 -->
- [x] **دروازه نگهبان ۳ (Gate 3):** بیلد نهایی و تست یکپارچگی کلاینت و سرور بدون هیچ‌گونه خطا <!-- id: 3-3 -->

</div>
