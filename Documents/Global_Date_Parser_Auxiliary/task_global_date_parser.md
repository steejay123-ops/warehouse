# چک‌لیست وظایف پیاده‌سازی: موتور سراسری تحلیل و پارس تاریخ (Dual-Path Date Parser Engine)

<div dir="rtl" align="right">

| شناسه | لایه / بخش | شرح وظیفه فنی | وضعیت |
| :---: | :--- | :--- | :---: |
| **T-01** | بک‌اند (Core) | پیاده‌سازی ماژول مرکزی `warehouse-backend/common/date_utils.py` شامل مسیر سریع Fast-Path و مسیر کمکی Fallback | [ ] |
| **T-02** | بک‌اند (FallBack Engine) | اعمال دقیق ۴ نکته (طول متغیر، ارقام فارسی/عربی، Token-Padding تک‌رقمی‌ها، اعتبارسنجی دامنه) | [ ] |
| **T-03** | بک‌اند (Refactor) | اتصال تابع جدید به `inventory/views.py` (`_parse_date_flexible`) و ایمپورت‌های اکسل اسناد | [ ] |
| **T-04** | فرانت‌اند (Core) | پیاده‌سازی ماژول متناظر `warehouse-front/src/app/core/utils/date-utils.ts` با منطق تطبیق‌یافته کلاینت | [ ] |
| **T-05** | آزمون واحد (Unit Tests) | نگارش تست‌های خودکار در `warehouse-backend/common/tests/test_date_utils.py` با پوشش ۱۰۰٪ ماتریس سناریوها | [ ] |
| **T-06** | اعتبارسنجی نهایی | اجرای تست‌های بک‌اند و بیلد فرانت‌اند و اطمینان از سلامت کامل سامانه | [ ] |

</div>
