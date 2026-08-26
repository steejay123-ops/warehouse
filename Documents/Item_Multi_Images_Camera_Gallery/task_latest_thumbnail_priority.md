<div dir="rtl" align="right">

# چک‌لیست وظایف اولویت‌بندی آخرین عکس کالا و همگام‌سازی بلادرنگ تامب‌نیل

- [x] فاز ۱: تصحیح اولویت‌بندی تامب‌نیل در بک‌اند
  - [x] اصلاح متد `get_primary_thumbnail` در `ItemSerializer`
  - [x] بررسی مرتب‌سازی تصاویر در `ItemViewSet.photos` و `ItemPhotoViewSet`

- [x] فاز ۲: پیاده‌سازی همگام‌سازی آنی رویداد `photosChanged` در فرانت‌اند
  - [x] اتصال `(photosChanged)` و به‌روزرسانی آنی در `counter-dashboard.ts` و `.html`
  - [x] اتصال `(photosChanged)` و به‌روزرسانی آنی در `supervisor-dashboard.ts` و `.html`
  - [x] اتصال `(photosChanged)` و به‌روزرسانی آنی در `manager-review.ts` و `.html`
  - [x] اتصال `(photosChanged)` و به‌روزرسانی آنی در `dispatch.ts` و `.html`

- [x] فاز ۳: تست و راستی‌آزمایی
  - [x] بررسی بیلد کامل فرانت‌اند (`npm run build`)
  - [x] بررسی ساختار بک‌اند (`python manage.py check`)
  - [x] ثبت مستندات DUAL-SAVE و Master_Log

</div>
