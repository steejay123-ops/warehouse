<div dir="rtl" align="right">

# گزارش اجرا: ابطال توکن بر اساس زمان و رفع مشکل دکمه چشم

با توجه به تایید شما، من تغییرات مربوط به سیستم احراز هویت و رابط کاربری را پیاده‌سازی و تست کردم.

### کارهای انجام شده

<table dir="rtl" align="right" border="1" style="width: 100%; text-align: right;">
  <thead>
    <tr>
      <th>بخش سیستم</th>
      <th>فایل مورد نظر</th>
      <th>شرح اقدامات انجام شده</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>مدل داده‌ای</b></td>
      <td><code>accounts/models.py</code></td>
      <td>فیلد <code>password_changed_at</code> به جدول کاربران اضافه شد و تغییرات دیتابیس (Migration) با موفقیت روی دیتابیس اِعمال گردید تا از این پس زمان آخرین تغییر رمز ذخیره شود.</td>
    </tr>
    <tr>
      <td><b>سیستم امنیتی سفارشی</b></td>
      <td><code>accounts/authentication.py</code> و <code>settings.py</code></td>
      <td>
        سیستم پیش‌فرض SimpleJWT غیرفعال شد و به جای آن کلاس <code>CustomJWTAuthentication</code> را نوشتم. این سیستم در هر درخواست بررسی می‌کند که اگر زمان ساخت توکن (<code>iat</code>) قبل از <code>password_changed_at</code> باشد، خطای ۴۰۱ می‌دهد. در نتیجه <b>بدون سربار روی دیتابیس</b>، نشست‌های قبلی کاملا و در لحظه باطل می‌شوند.
      </td>
    </tr>
    <tr>
      <td><b>توابع بک‌اند</b></td>
      <td><code>accounts/views.py</code></td>
      <td>توابع <code>change_password</code> و <code>admin_reset_password</code> آپدیت شدند تا هنگام تغییر رمز، زمان فعلی سیستم را در <code>password_changed_at</code> ذخیره کنند.</td>
    </tr>
    <tr>
      <td><b>اصلاحات رابط کاربری (Frontend)</b></td>
      <td><code>change-password.ts</code> و <code>change-password.html</code></td>
      <td>
        <ul>
          <li>برای حل مشکل واکنش ندادن دکمه چشم، شیء <code>ChangeDetectorRef</code> به کامپوننت متصل شد و پس از هر بار کلیک، رابط کاربری به زور (Force) رفرش می‌شود.</li>
          <li>سه دکمه چشم از حالت مشترک خارج شدند و به هر کدام (رمز قبلی، جدید و تکرار جدید) یک متغیر مستقل اختصاص داده شد. حالا با کلیک روی هر دکمه، فقط همان فیلد نمایان یا مخفی می‌شود.</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

### نتیجه نهایی
- وقتی ادمین رمزی را ریست کند، یا کاربر رمز خودش را تغییر دهد، تمام توکن‌های قبلی آن اکانت در همان لحظه از کار می‌افتند.
- دکمه‌های چشم در فرمِ تغییرِ رمز کاملاً مستقل و واکنش‌گرا شده‌اند.
- کد فرانت‌اند با موفقیت کامپایل شد و بررسی کدهای بک‌اند (<code>manage.py check</code>) نیز بدون هیچ مشکلی پایان یافت.

</div>
