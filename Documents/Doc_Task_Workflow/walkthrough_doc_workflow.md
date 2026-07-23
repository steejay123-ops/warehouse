<div dir="rtl" align="right">

# گزارش اجرا: چرخه کاری ارجاع اسناد مالی

این تغییرات برای پیاده‌سازی کامل گردش کار ارجاع اسناد، درست مشابه با ارجاع میدانی کالاها انجام شد.

## تغییرات انجام شده

### ۱. بک‌اند (تکمیل مدل‌ها و APIها)
- **مدل‌ها:** در فایل `inventory/models.py` مدل‌های `DocTask` و `DocTaskHistory` از قبل وجود داشتند.
- **تایید سرپرست اسناد:** گزینه `require_doc_supervisor_approval` در `services.py` پیش‌تر تعبیه شده بود.
- **نقش‌ها:** اجرای `init_roles` با موفقیت نقش‌های `doc_worker` و `doc_supervisor` را در سیستم تثبیت کرد.
- **سریالایزر:** ایجاد سریالایزرهای اختصاصی `DocTaskSerializer` و `DocTaskHistorySerializer` در `inventory/serializers.py` تا دیتای کاربر به درستی فرمت شود.
- **ویو و APIها:**
  - ساخت یک `DocTaskViewSet` کاملاً مجزا در `inventory/views.py` شامل اکشن‌های (`pool_tasks`, `claim_tasks`, `bulk_submit`, `bulk_approve`, `reject`, `manager_reject`, `bulk_manager_approve`, `bulk_cancel`).
  - به‌روزرسانی اکشن `bulk_assign` برای هندل کردن وضعیت `checking` و ارجاع صحیح `DocTask` به کاربران همراه با بررسی `require_doc_supervisor_approval` و `doc_skip_supervisor`.
- **ثبت Endpoint:** اضافه شدن روت `/api/inventory/doc-tasks/` به `inventory/urls.py`.

### ۲. فرانت‌اند (اصلاح بخش ارجاع و رابط کاربری)
- **دریافت لیست کاربران اسناد:** به‌روزرسانی فایل `dispatch.ts` برای تفکیک نقش‌های ارجاع‌شونده در `docWorkers` و `docSupervisors`.
- **بخش ارجاع اسناد (`executeDocDispatch`):** شبیه‌سازی دقیق از روی اکشن ارجاع میدانی:
  - اضافه شدن تنظیمات سرپرست در فرم (با پشتیبانی از قابلیت `skip`).
  - ارسال آرایه‌ای از آیدی‌ها برای کارشناس، سرپرست و مدیر.
  - نمایش پیام پاپ‌آپ تایید (Confirmation Dialog) قبل از ارجاع با نام دقیق اشخاص یا استخر عمومی که با رنگ‌بندی تفکیک شده‌اند.
- **طراحی فرم:** به‌روزرسانی فایل `dispatch.html` جهت افزودن Dropdownهای انتخاب سرپرست و مدیر اسناد.

## نتایج تایید
- **پایگاه داده:** هیچ Migration جدیدی نیاز نبود چراکه مدل‌ها از قبل ثبت شده بودند. دستورهای `makemigrations` و `migrate` بدون خطا انجام شد.
- **کامپایل فرانت‌اند:** دستور `npm run build` برای اپلیکیشن Angular به طور کامل اجرا شد و خروجی با موفقیت و بدون ارور (حجم نهایی در حدود `1.12 MB`) تولید گردید.

</div>
