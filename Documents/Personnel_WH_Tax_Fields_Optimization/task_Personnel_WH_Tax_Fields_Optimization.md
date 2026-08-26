<div dir="rtl" align="right">

# چک‌لیست تسک‌های انطباق کامل با راهنمای رسمی مالیات دارایی 1.7.0.4 (Tax File Tasks)

- [x] **فاز ۱: توسعه مدل‌ها و پایگاه داده بک‌اند (Django Models & 13 Tax Tables)** <!-- id: 1 -->
  - [x] افزودن فیلدهای ۶ گانه تنظیمی فایل WH به مدل `PersonnelProfile` <!-- id: 2 -->
  - [x] به‌روزرسانی انتخاب‌های استاندارد ۱۳ جدول رسمی دارایی در `PersonnelProfile` (معافیت ۱۱ گانه ماده ۱۸، رسته ۵ انبارداری، استثنائات و ...) <!-- id: 3 -->
  - [x] ساخت و اعمال مایگریشن جنگو با `makemigrations` و `migrate` <!-- id: 4 -->
  - [x] به‌روزرسانی `PersonnelProfileSerializer` در `serializers.py` <!-- id: 5 -->

- [x] **فاز ۲: ارتقای موتور صدور فایل‌های مالیاتی WP و WH (`tax_bank_exporter.py`)** <!-- id: 6 -->
  - [x] صدور استاندارد فایل `WP` (۲۳ ستونه) با فرمت کاما-دلیمیتر و کدهای رسمی نسخه 1.7.0.4 <!-- id: 7 -->
  - [x] صدور استاندارد فایل `WH` (۳۹ ستونه) با اولویت مقادیر انفرادی پرسنل و فال‌بک به تنظیمات کارگاه <!-- id: 8 -->

- [x] **فاز ۳: توسعه فرانت‌اند انگولار (Angular Interface, Component & 5-Tab HTML UI)** <!-- id: 9 -->
  - [x] افزودن فیلدهای جدید مالیاتی به اینترفیس `PersonnelProfile` در `personnel.model.ts` <!-- id: 10 -->
  - [x] تنظیم مقادیر پیش‌فرض در متدهای `openAddPersonnelModal` و `openEditPersonnelModal` در `personnel-management.ts` <!-- id: 11 -->
  - [x] طراحی دراپ‌داون‌های استاندارد با گزینه‌ها و توضیحات فارسی کامل در تب‌های ۱ و ۳ در `personnel-management.html` <!-- id: 12 -->

- [x] **فاز ۴: تست‌های جامع، بیلد فرانت‌اند و راستی‌آزمایی (QA & Verification)** <!-- id: 13 -->
  - [x] اجرای تست‌های واحد بک‌اند با `manage.py test personnel` <!-- id: 14 -->
  - [x] اجرای بیلد فرانت‌اند با `npm run build` <!-- id: 15 -->

</div>
