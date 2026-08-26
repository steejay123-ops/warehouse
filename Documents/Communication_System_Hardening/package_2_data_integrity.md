<div dir="rtl" align="right">

# 📦 بسته ۲: یکپارچگی داده، صف آفلاین و پایداری پیام‌ها (Data Integrity & Delivery)

> **سند مرجع:** [implementation_plan_communication_hardening.md](implementation_plan_communication_hardening.md)
> **فازهای پوشش‌داده:** فاز ۴
> **پیش‌نیاز:** بسته ۱ (باید کامل و سبز شده باشد)
> **ایرادات حل‌شده:** ۱۳، ۱۴، ۱۶، ۱۸، ۱۹، ۲۰، ۲۱، ۲۲، ۲۴

---

## 🎯 هدف بسته ۲
اجرای قطعی قاعده «داده کاربر هرگز گم نشود». تضمین تحویل پیام‌ها در قطعی شبکه، ممانعت از تکرار پیام با کلید Idempotency، حفظ پیام در خطای شبکه در فرانت با Dexie، سقف طول متن، Throttling و Soft Delete.

---

## 🛠️ فایل‌های تحت تغییر در این بسته

| لایه | مسیر فایل | نوع تغییر |
| :--- | :--- | :---: |
| **تست بک‌اند** | `warehouse-backend/communications/tests/test_integrity.py` | [NEW] |
| **تست فرانت** | `warehouse-front/src/app/core/services/communication.service.spec.ts` | [MODIFY] |
| **بک‌اند** | `warehouse-backend/communications/models.py` | [MODIFY] |
| **بک‌اند** | `warehouse-backend/communications/views.py` | [MODIFY] |
| **بک‌اند** | `warehouse-backend/communications/serializers.py` | [MODIFY] |
| **بک‌اند** | `warehouse-backend/communications/broadcast.py` | [MODIFY] |
| **بک‌اند** | `warehouse-backend/config/settings.py` | [MODIFY] |
| **فرانت‌اند** | `warehouse-front/src/app/core/services/communication.service.ts` | [MODIFY] |
| **فرانت‌اند** | `warehouse-front/src/app/components/communications/chat-drawer/chat-drawer.component.html` | [MODIFY] |
| **فرانت‌اند** | `warehouse-front/src/app/core/services/photo-upload-queue.service.ts` / صف چت | [MODIFY] |

---

## 📋 چک‌لیست اقدامات اجرایی بسته ۲

- [ ] افزودن اعتبارسنجی `unique_together` یا گارد `get_or_create` بر پایه `client_temp_id` در `perform_create`
- [ ] بازنویسی `perform_destroy` در ViewSetها با فراخوانی `instance.soft_delete()` و فیلتر رکوردهای فعال
- [ ] تعریف سقف کاراکتر (۴۰۰۰ حرف) در `MessageSerializer` و `GenericCommentSerializer`
- [ ] پیکربندی Scoped Rate Limiting (مثلاً ۶۰ پیام در دقیقه) در `settings.py` برای چت
- [ ] ثبت وقایع حذف/ویرایش پیام و تغییر اعضا در `accounts.AuditLog`
- [ ] ارسال رویداد `chat.message.updated` روی وب‌سوکت برای پیوست‌ها و ادغام در استیت فرانت
- [ ] مدیریت استیت سه‌حالته `pending / sent / failed` در `CommunicationService`
- [ ] اصلاح باگ `_offlinePending` و نمایش وضعیت در انتظار به جای تیک تحویل در آفلاین
- [ ] پیاده‌سازی دکمه تلاش مجدد (Retry) در UI هنگام بروز خطای شبکه بدون پاک شدن متن کاربر

---

## 🛡️ گیت پذیرش و فرمان‌های راستی‌آزمایی

```bash
# تست‌های بک‌اند یکپارچگی داده و پایداری پیام
cd "E:/warehouse project/warehouse-backend" && python manage.py test communications.tests.test_integrity -v 2

# تست‌های کلاینت فرانت‌اند
cd "E:/warehouse project/warehouse-front" && npm test
```

---

## 💬 پرامپت آماده برای شروع چت ۲ (کپی و ارسال در چت جدید)

```text
سلام. من می‌خواهم «بسته ۲: یکپارچگی داده، صف آفلاین و پایداری پیام‌ها» از سیستم ارتباطات را پیاده‌سازی کنم.
لطفاً فایل‌های زیر را مبنا قرار بده:
1. E:\warehouse project\Documents\Communication_System_Hardening\package_2_data_integrity.md
2. E:\warehouse project\Documents\Communication_System_Hardening\task_communication_hardening.md
3. E:\warehouse project\Documents\Communication_System_Hardening\implementation_plan_communication_hardening.md

بسته ۱ قبلاً با موفقیت اجرا شده است. لطفاً فاز ۴ را مطابق چک‌لیست بسته ۲ پیاده‌سازی کن و تست‌های آن را اجرا و گزارش کن.
```

</div>
