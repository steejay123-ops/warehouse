<div dir="rtl" align="right">

# فهرست وظایف تفصیلی طرح یکسان‌سازی صفحات پنل کارمند با صفحات مرجع سیستم
## (Employee Portal Comprehensive Unification Task Checklist)
### بر اساس الگوهای پیاده‌شده در `/app/finance/projects-and-sections` و `/app/operations/users`

---

## 📌 محور ۱: یکسان‌سازی معماری هدر فرماندهی (Sticky Command Center)
- [x] <!-- id: task_axis1_header_container --> **۱.۱ کانتینر چسبان شیشه‌ای و کارت سفید هدر:**
  - اعمال کانتینر چسبان `sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-1 pb-2` در تمام ۶ صفحه.
  - اعمال کادر سفید داخلی `bg-white p-2.5 md:p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3`.
- [x] <!-- id: task_axis1_title_badge --> **۱.۲ حذف متن‌های حجیم و توضیحات تب از هدر (Ultra-Compact Header Alignment):**
  - حذف باکس آیکون، عناوین تکراری و پاراگراف توضیحات تب‌ها از سمت راست هدر جهت جلوگیری از فشردگی سلکتور بخش و تب‌ها.
  - چینش مستقیم انتخابگر بخش فعال و کپسول تب‌های فرعی در سمت راست دقیقا منطبق بر استاندارد مرجع `projects-and-sections` و `users`.
- [x] <!-- id: task_axis1_section_picker --> **۱.۳ انتخابگر شیشه‌ای بخش فعال پروژه (ProjectSection Picker):**
  - کپسول انتخاب بخش با استایل هماهنگ `bg-slate-100/90 py-1 px-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5`.
  - نمایش نام پروژه ◀ نام بخش با اسپینر لودینگ اختصاصی.
- [x] <!-- id: task_axis1_subtabs_pills --> **۱.۴ محفظه قرصی تب‌های فرعی (Enclosed Pill Subtabs):**
  - کانتینر تب‌ها: `flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 overflow-x-auto w-full md:w-auto`.
  - تب فعال: `bg-white text-indigo-700 shadow-xs font-black`.
  - تب غیرفعال: `text-slate-600 hover:text-slate-900 font-bold`.
  - شمارنده‌های کپسولی عددی: `text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md` با هایلایت فعال/غیرفعال.
- [x] <!-- id: task_axis1_action_buttons --> **۱.۵ دکمه‌های استاندارد ۳گانه آیکونی و دکمه‌های اکشن اصلی:**
  - دکمه سبز زمردی خروجی اکسل ۲ ردیفه (`bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100/80 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs`) مجهز به `title` فارسی.
  - دکمه آبی/ایندیگو ایمپورت یا تمپلت اکسل یا میانبر (`bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100/80 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs`) مجهز به `title` فارسی.
  - دکمه اسلیت تازه‌سازی زنده داده‌ها (`bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs`) با انیمیشن چرخش آیکون در زمان لودینگ.
  - دکمه برجسته اقدام اصلی (`Call to Action`) با گرادیان پررنگ و برجسته.

---

## 📌 محور ۲: یکسان‌سازی جداول داده، هدر جدول و فیلترهای زنده (Tables & In-Line Filters)
- [x] <!-- id: task_axis2_table_container --> **۲.۱ کانتینر کارتی جداول داده:**
  - قرارگیری کلیه جداول در کادر مدرن `bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden`.
- [x] <!-- id: task_axis2_table_header_search --> **۲.۲ نوار ابزار و جستجوی زنده بالای جدول:**
  - اینپوت جستجوی متنی مجهز به پیشوند `🔍` در سمت راست و دکمه پاک‌سازی `✕` در سمت چپ.
  - شمارنده زنده تعداد رکوردهای فیلتر شده نسبت به کل رکوردها (نمایش X از Y رکورد).
  - دکمه‌های اکشن کمکی بالای جدول (مانند تعریف سریع طرف‌حساب، اعمال دسته‌ای و...).
- [x] <!-- id: task_axis2_table_typography --> **۲.۳ تایپوگرافی سلول‌ها و تفکیک فونت انگلیسی/فارسی:**
  - فونت انگلیسی مونو (`font-mono`) با تراز چپ یا وسط برای تمام اعداد، کدهای ملی، پلاک خودرو، تاریخ‌های شمسی، شماره شبا، مبالغ و ساعات.
  - فونت استاندارد سیستم با تراز راست برای عناوین، اسامی و توضیحات فارسی.
- [x] <!-- id: task_axis2_table_cell_actions --> **۲.۴ ارگونومی دکمه‌های عملیاتی درون‌سلولی:**
  - تراشه‌های ظریف و ارگونومیک (`px-2 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-[11px] font-bold transition-all`).
- [x] <!-- id: task_axis2_remove_bulky_cards --> **۲.۵ حذف کارت‌های تکراری و کادرهای حجیم بالای جدول (High Data Density):**
  - حذف ۴ کارت بزرگ و نوار مصرف تنخواه از تب تنخواه‌گردان و انتقال مانده فعال به بج ظریف در هدر.
  - حذف کارت‌های تکراری متریک از تب‌های فاکتور هزینه، ثبت خودرو و پرسنل جدید جهت اتصال مستقیم جدول داده‌ها به هدر چسبان.

---

## 📌 محور ۳: استانداردسازی وضعیت‌های تهی و لودینگ (Empty States & Skeletons)
- [x] <!-- id: task_axis3_empty_states --> **۳.۱ طراحی وضعیت‌های تهی معنادار و جذاب:**
  - باکس گرافیکی وضعیت تهی با آیکون موضوعی بزرگ متناسب با هر صفحه (📭، 👥، 🚚، 💰، 🚗، 📋).
  - تیتر دو سطری شامل عنوان برجسته و توضیح ساده راهنمای کاربر.
  - دکمه فراخوان به اقدام (`CTA Button`) جهت ثبت سریع اولین رکورد.
- [x] <!-- id: task_axis3_loading_spinners --> **۳.۲ لودینگ و اسپینرهای متمرکز و یکنواخت:**
  - اسپینر لودینگ متمرکز درون جدول با متن فارسی راهنما (`در حال بارگذاری اطلاعات...`) با ابعاد `w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin`.

---

## 📌 محور ۴: یکسان‌سازی فرم‌ها، مودال‌ها و اعتبارسنجی برخط (Modals & Input Ergonomics)
- [x] <!-- id: task_axis4_modal_headers --> **۴.۱ هدر شیک و کانتینر مودال‌ها:**
  - پس‌زمینه مات تیره کل صفحه: `fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs`.
  - بدنه مودال: `bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden`.
  - هدر مودال با گرادیان تم صفحه یا تیره مدرن `bg-slate-900`، عنوان، زیرنویس کم‌رنگ و دکمه ضربدر `✕`.
- [x] <!-- id: task_axis4_input_styling --> **۴.۲ استایل یکدست ورودی‌ها و اینپوت‌های فرم:**
  - فیلدهای یکنواخت با ارتفاع استاندارد، بوردر ملایم، پس‌زمینه خاکستری `bg-slate-50` و فوکوس رنگی ایندیگو/تم.
- [x] <!-- id: task_axis4_toman_preview --> **۴.۳ نمایش زنده معادل به تومان برای کلیه مبالغ ریالی:**
  - نمایش لحظه‌ای معادل تومان با فونت مونو در زیر فیلد مبلغ ریال در تمامی فرم‌های مالی (فاکتور، تنخواه، دستمزد راننده).
- [x] <!-- id: task_axis4_sheba_validation --> **۴.۴ سیستم اعتبارسنجی آنلاین شماره شبا با نمایش نام و آیکون بانک:**
  - اتصال الگوریتم ISO 7064 Mod 97 و نمایش فوری وضعیت اعتبار و نام بانک صادرکننده در فرم‌های خودرو، پرسنل، تنخواه و طرف‌حساب.

---

## 📌 محور ۵: نشان‌های وضعیت یکنواخت (Unified Status Badges)
- [x] <!-- id: task_axis5_status_palette --> **۵.۱ پیاده‌سازی پالت ۵گانه استاندارد نشان‌های وضعیت:**
  - `draft` (پیش‌نویس): خاکستری (`bg-slate-100 text-slate-700 border border-slate-200`).
  - `pending_supervisor` (در انتظار سرپرست): زرد کهربایی با پالس ملایم (`bg-amber-50 text-amber-800 border border-amber-200`).
  - `pending_accountant` (در انتظار حسابدار): آبی ملایم (`bg-blue-50 text-blue-800 border border-blue-200`).
  - `approved` / `ready_to_pay` (تاییدشده / پرداخت‌شده): سبز زمردی (`bg-emerald-50 text-emerald-800 border border-emerald-200`).
  - `rejected` (رد شده): قرمز ملایم (`bg-rose-50 text-rose-800 border border-rose-200`) به همراه نمایش تولتیپ علت رد.

---

## 📌 محور ۶: هماهنگ‌سازی ماندگاری آدرس و کلیدهای میانبر (URL Sync & Shortcuts)
- [x] <!-- id: task_axis6_url_query_sync --> **۶.۱ اتصال دوطرفه فیلترها، تب‌ها و بخش فعال به URL Query Params:**
  - ذخیره و بازیابی خودکار پارامترهای `section_id`, `tab`, `date`, `search` در آدرس مرورگر برای حفظ وضعیت هنگام رفرش در هر ۶ صفحه.
- [x] <!-- id: task_axis6_keyboard_traversal --> **۶.۲ ارگونومی کیبورد و کلیدهای میانبر:**
  - بستن فوری مودال‌ها با کلید `Escape` و ثبت فرم‌ها با کلید `Enter`.

---

## 📌 محور ۷: پیاده‌سازی صفحه به صفحه (Implementation per Page)
- [x] <!-- id: task_page_attendance --> **۷.۱ اعمال کلیه محورها روی صفحه `employee-attendance` (کارکرد پرسنل)**
- [x] <!-- id: task_page_fleet --> **۷.۲ اعمال کلیه محورها روی صفحه `employee-fleet` (کارکرد ناوگان)**
- [x] <!-- id: task_page_invoices --> **۷.۳ اعمال کلیه محورها روی صفحه `employee-invoices` (ثبت فاکتور هزینه)**
- [x] <!-- id: task_page_petty_cash --> **۷.۴ اعمال کلیه محورها روی صفحه `employee-petty-cash` (مدیریت تن‌خواه)**
- [x] <!-- id: task_page_new_vehicle --> **۷.۵ اعمال کلیه محورها روی صفحه `employee-new-vehicle` (تعریف خودرو جدید)**
- [x] <!-- id: task_page_new_personnel --> **۷.۶ اعمال کلیه محورها روی صفحه `employee-new-personnel` (تعریف پرسنل جدید)**

---

## 📌 محور ۸: راستی‌آزمایی، تست‌های واحد و بیلد پروداکشن
- [x] <!-- id: task_axis8_vitest --> **۸.۱ اجرای کامل سوئیت تست‌های واحد Vitest و کسب قبولی ۱۰۰٪**
- [x] <!-- id: task_axis8_section_guardian --> **۸.۲ اجرای ممیزی ایجنت نگهبان (`section_guardian.py`) و پاس شدن تمام فازها**
- [x] <!-- id: task_axis8_tsc_check --> **۸.۳ اعتبارسنجی تایپ‌اسکریپت بدون هیچ‌گونه اخطار (`npx tsc --noEmit`)**
- [x] <!-- id: task_axis8_production_build --> **۸.۴ بیلد کامل و موفق پروداکشن انگولار (`npm run build`)**
- [x] <!-- id: task_axis8_final_report --> **۸.۵ تهیه جدول گزارش جامع مقایسه قبل و بعد همراه با فایل‌های تغییر یافته**

</div>
