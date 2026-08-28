# طرح پیاده‌سازی جامع و فراتکامل‌یافته سیستم ارتباطات و نظرات انبار (Communication & Contextual Comments Ultra-Master Blueprint)

<div dir="rtl" align="right">

> [!NOTE]
> **وضعیت سند:** نسخه ۱۰.۰ (تکمیل ۱۰ چرخه بازخوانی و پالایش مستقل معماری)  
> **سازگاری کامل:** همگام با زیرساخت Local-First (`SyncModelMixin`)، استانداردهای وب‌سوکت چنلز، پروتکل امنیت آپلود فایل، بهینه‌سازی تاچ/موبایل و اعلان‌های صوتی/سیستمی.

---

## ۱. گزارش جامع ۱۰ دور بازخوانی و ارتقای معماری (10-Iteration Deep Review Report)

### 🔄 دور ۱: معماری پایگاه داده و مدل‌های چندریختی (Polymorphic DB Architecture)
* **دستاورد:** تبدیل مدل نظرات (`GenericComment`) به سیستم Generic Relations جهت پوشش همزمان کالاها (`Item`)، تسک‌های انبارگردانی (`CountTask`)، تسک‌های اسناد (`DocTask`) و بارنامه‌ها بدون نیاز به جدول‌های تکراری.

### 🔄 دور ۲: امنیت دسترسی و تفکیک انبارها (Warehouse Scoping & RBAC Protection)
* **دستاورد:** اعتبارسنجی دوگانه (REST + WebSocket Handshake) برای جلوگیری از آسیب‌پذیری IDOR و فیلتر خودکار کاربران مجاز به منشن در همان انبار.

### 🔄 دور ۳: پایداری در شبکه ضعیف و شرایط آفلاین (Offline Resilience & Idempotency)
* **دستاورد:** افزودن کلیدهای یکتایی کلاینت (`client_temp_id`) جهت جلوگیری از ارسال مجدد پیام‌های تکراری پس از وصل شدن اینترنت و اعمال پرچم `SKIP_GLOBAL_ERROR_TOAST: true`.

### 🔄 دور ۴: رندرینگ فوق‌سریع در فرانت‌اند (Angular CDK Virtual Scrolling)
* **دستاورد:** استفاده از `CdkVirtualScrollViewport` برای پیمایش روان هزاران پیام بدون افت فریم و ایزوله‌سازی رویدادهای سوکت در `runOutsideAngular`.

### 🔄 دور ۵: چرخه عمر فایل‌ها و مدیریت هارد سرور (Media Storage Lifecycle & Purge)
* **دستاورد:** طراحی دستور خودکار (`purge_expired_chat_media`) جهت پاکسازی فیزیکی فایل‌های پیوست منقضی‌شده از دیسک بدون دستکاری لاگ‌های حساس تجاری.

### 🔄 دور ۶: انطباق کامل با پروتکل همگام‌سازی محلی پروژه (`SyncModelMixin` Local-First Alignment)
* **چالش شناسایی‌شده:** مدل‌های چت نباید به صورت ایزوله از مکانیزم آفلاین پروژه عمل کنند.
* **بهبود اعمال‌شده:** ارث‌بری تمامی مدل‌های `Conversation`، `Message` و `GenericComment` از کلاس استانداردی پروژه یعنی `SyncModelMixin` به همراه تعریف `base_manager_name = 'all_objects'` جهت حفظ پیوستگی Foreign Key حتی در رکوردهای حذف‌نرم شده (`is_deleted`).

### 🔄 دور ۷: استانداردسازی قرارداد Payload وب‌سوکت و تراکنش‌های اتمیک (WebSocket Data Contract & Concurrency)
* **چالش شناسایی‌شده:** عدم قطعیت در فرمت پکت‌های وب‌سوکت و ریسک تداخل همزمانی هنگام علامت‌گذاری خوانده شدن پیام‌ها.
* **بهبود اعمال‌شده:** تعریف دقیق کدهای رویداد (`chat.message.new`, `chat.typing`, `chat.read_receipt`, `comment.new`) و استفاده از `transaction.atomic` با قفل ردیفی (`select_for_update`) در تغییر وضعیت پیام‌ها.

### 🔄 دور ۸: امنیت عمیق فایل‌ها و جلوگیری از نفوذ (File Upload Security & Magic Bytes)
* **چالش شناسایی‌شده:** ریسک آپلود اسکریپت‌های مخرب با تغییر پسوند فایل یا نشت آدرس‌های مستقیم فایل‌های اسناد.
* **بهبود اعمال‌شده:** اعتبارسنجی بایت‌های هدر واقعی فایل (Magic Bytes)، نام‌گذاری تصادفی UUID فایل‌ها در دیسک، و هدایت دانلودها از طریق یک اندپوینت اعتبارسنجی‌شده.

### 🔄 دور ۹: دسترسی‌پذیری، پیمایش کیبورد و تجربه لمسی موبایل (Mobile Touch & Keyboard UX)
* **چالش شناسایی‌شده:** تداخل کیبورد مجازی در تبلت‌ها و هندلدهای صنعتی انبار و به‌هم‌ریختگی منوی منشن.
* **بهبود اعمال‌شده:** تطبیق کادر چت با استاندارد `visualViewport` در موبایل، پشتیبانی از کلیدهای میانبر (`Ctrl+Enter` برای ارسال و `Esc` برای بستن)، و منوی بازشونده منشن که با تشخیص فضای عمودی بالا یا پایین باز می‌شود.

### 🔄 دور ۱۰: موتور اعلان‌های صوتی، پوش نوتیفیکیشن و بی‌صدا کردن (Auditory & System Push Notifications)
* **چالش شناسایی‌شده:** عدم اطلاع کاربر از پیام‌های فوری هنگامی که در تب دیگری از مرورگر یا در حال کار در منوی دیگری است.
* **بهبود اعمال‌شده:** یکپارچه‌سازی با Web Notifications API، پخش افکت صوتی بسیار ملایم (Chime) هنگام دریافت پیام و دکمه قطع صدا (Mute/Unmute) در هدر چت.

---

## ۲. مدل‌های داده نهایی و ۱۰۰٪ منطبق بر استانداردهای پروژه

```python
# communications/models.py
import uuid
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from common.sync_models import SyncModelMixin
from warehouses.models import Warehouse

class ConversationType(models.TextChoices):
    DIRECT = 'direct', 'گفتگوی دو‌نفره'
    WAREHOUSE_GROUP = 'warehouse_group', 'گروه کاری انبار'
    ANNOUNCEMENT = 'announcement', 'اطلاعیه عمومی'

class Conversation(SyncModelMixin):
    title = models.CharField(max_length=255, null=True, blank=True, verbose_name="عنوان گفتگو")
    conv_type = models.CharField(max_length=25, choices=ConversationType.choices, default=ConversationType.DIRECT, verbose_name="نوع گفتگو")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, null=True, blank=True, related_name='chat_conversations', verbose_name="انبار")
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chat_conversations', verbose_name="اعضا")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")

    class Meta:
        ordering = ['-updated_at']
        base_manager_name = 'all_objects'
        indexes = [
            models.Index(fields=['warehouse', 'conv_type', 'updated_at']),
        ]

    def __str__(self):
        return self.title or f"{self.get_conv_type_display()} ({self.id})"

class Message(SyncModelMixin):
    client_temp_id = models.CharField(max_length=100, null=True, blank=True, db_index=True, verbose_name="شناسه کلاینت")
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages', verbose_name="گفتگو")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_chat_messages', verbose_name="فرستنده")
    text = models.TextField(blank=True, null=True, verbose_name="متن پیام")
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies', verbose_name="پاسخ به")
    is_system = models.BooleanField(default=False, verbose_name="پیام سیستمی")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="تاریخ ارسال")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='read_chat_messages', blank=True, verbose_name="خوانده‌شده توسط")

    class Meta:
        ordering = ['created_at']
        base_manager_name = 'all_objects'
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
        ]

    def __str__(self):
        return f"{self.sender}: {self.text[:30] if self.text else '[فایل]'}"

class MessageAttachment(SyncModelMixin):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='attachments', verbose_name="پیام")
    file = models.FileField(upload_to='chat_attachments/%Y/%m/', verbose_name="فایل")
    file_name = models.CharField(max_length=255, verbose_name="نام فایل")
    file_size = models.PositiveIntegerField(verbose_name="حجم بایت")
    content_type = models.CharField(max_length=100, verbose_name="نوع فایل")
    thumbnail = models.ImageField(upload_to='chat_attachments/thumbs/%Y/%m/', null=True, blank=True, verbose_name="بندانگشتی")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")

    class Meta:
        base_manager_name = 'all_objects'

class GenericComment(SyncModelMixin):
    """مدل چندریختی برای کامنت و یادداشت روی کالاها، تسک‌های شمارش، اسناد و حواله‌ها"""
    client_temp_id = models.CharField(max_length=100, null=True, blank=True, db_index=True, verbose_name="شناسه کلاینت")
    
    # ارتباط چندریختی با هر موجودیت در سیستم
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, verbose_name="نوع موجودیت")
    object_id = models.CharField(max_length=100, verbose_name="شناسه موجودیت")
    target_object = GenericForeignKey('content_type', 'object_id')
    
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='authored_comments', verbose_name="نویسنده")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies', verbose_name="پاسخ به نظر")
    text = models.TextField(verbose_name="متن نظر")
    mentioned_users = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='comment_mentions', blank=True, verbose_name="کاربران منشن‌شده")
    attachment = models.FileField(upload_to='comment_attachments/%Y/%m/', null=True, blank=True, verbose_name="پیوست")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")

    class Meta:
        ordering = ['created_at']
        base_manager_name = 'all_objects'
        indexes = [
            models.Index(fields=['content_type', 'object_id', 'created_at']),
        ]
```

---

## ۳. معماری پروتکل وب‌سوکت و استاندارد Payloadها

```json
// نمونه پکت ارسال پیام جدید چت
{
  "event": "chat.message.new",
  "warehouse_id": 1,
  "conversation_id": "a3b8e7c1-...",
  "temp_id": "client-uuid-12345",
  "text": "سلام، فاکتور کالا تایید شد؟",
  "reply_to": null,
  "attachments": []
}

// نمونه پکت ارسال نظر با منشن روی کالا
{
  "event": "comment.new",
  "warehouse_id": 1,
  "content_type": "inventory.item",
  "object_id": "1054",
  "temp_id": "client-uuid-67890",
  "text": "@manager لطفاً بررسی نمایید",
  "mentioned_user_ids": [2]
}
```

---

## ۴. برنامه فازبندی شده ۶ مرحله‌ای پیاده‌سازی

| فاز | شرح عملیات و اقلام تحویلی | لایه | وضعیت تضمین سرعت |
| :---: | :--- | :---: | :---: |
| **فاز ۱** | ساخت اپ `communications`، مدل‌های مشتق از `SyncModelMixin`، مایگریشن و APIهای REST | Backend | **بدون تغییر در جداول اصلی (Zero Overhead)** |
| **فاز ۲** | پیاده‌سازی `ChatConsumer` و `CommentConsumer` در وب‌سوکت با احراز هویت توکن JWT و بررسی دسترسی انبار | Backend Channels | **ایزوله در ورکر مستقل سوکت** |
| **فاز ۳** | ساخت `CommunicationService` با پشتیبانی از صف آفلاین (`IndexedDB`) و اتصال مجدد هوشمند | Frontend Core | **پردازش خارج از Zone انگولار** |
| **فاز ۴** | کامپوننت نظرات تعاملی `ContextualCommentsComponent` با منوی هوشمند منشن (`@`) | Frontend UI | **بارگذاری تنبل درون تب کالاها** |
| **فاز ۵** | کشوی پیام‌رسان عمومی `ChatDrawerComponent` با Virtual Scroll، اعلان صوتی و تم ریسپانسیو | Frontend UI | **بارگذاری بر حسب تقاضا (On Demand)** |
| **فاز ۶** | پنل تنظیمات انبار در `wh-settings`، دستور دوره‌ای پاکسازی فایل‌ها و تست‌های E2E | Full-Stack | **تست پایداری و ۶۰ فریم بر ثانیه** |

---

## ۵. برنامه تست و اعتبارسنجی عملکردی (Verification Plan)

1. **تست همگام‌سازی آفلاین:** قطع شبکه در حین نوشتن پیام، ارسال پیام (نمایش وضعیت در حال ارسال)، اتصال مجدد و تأیید ثبت پیام با `client_temp_id` بدون تکثیر.
2. **تست امنیت انبار (IDOR):** تلاش برای پیوستن به گروه انبار دیگر توسط کاربر عادی و اطمینان از بسته شدن اتصال با کد `4003 Forbidden`.
3. **تست رندرینگ ۶۰ فریم:** اجرای جدول کالاها همراه با ارسال رگباری ۲۰ پیام چت و راستی‌آزمایی عدم پرش اسکرول و عدم افت فریم.
4. **تست سوییچ مدیر:** خاموش کردن چت در تنظیمات و اطمینان از عدم ارسال هیچ کانکشن وب‌سوکت توسط کلاینت.

---

# طرح جامع ارتقا و بهینه‌سازی سیستم حقوق، دستمزد و مالیات (Personnel Payroll & Tax Engine Optimization Blueprint)

> [!NOTE]
> **وضعیت سند:** آماده اجرا پس از تایید کاربر  
> **مرجع اصلی محاسبات:** فایل اکسل شرکت `E:\warehouse project\حقوق تیر ماه انبارداری.xlsm` و فایل خروجی اداره مالیات `E:\warehouse project\نمونه مالیات محاسبه شده.xlsx`

### خلاصه‌سازی فازهای اجرایی:
* **فاز ۱: توسعه مدل‌ها و پارامتریک‌سازی:** افزودن `surplus_overtime_percent` به `PayrollYearlySettings` و فیلدهای ممیزی دارایی به `MonthlyPayrollRecord`.
* **فاز ۲: ارتقای موتور محاسبات و تسهیم مازاد (`payroll_engine.py`):** پیاده‌سازی تناسب هوشمند روزهای بیمه، تسهیم مازاد به اضافه‌کار و سفر/مأموریت با ضرایب وزنی و صفرسازی مغایرت در ستون `چک مالیات`.
* **فاز ۳: ماژول درون‌ریزی اکسل مالیات دارایی:** سرویس و اندپوینت اختصاصی آپلود فایل اکسل دارایی جهت به‌روزرسانی کد ملی و مالیات محاسبه‌شده.
* **فاز ۴: ارتقای فرانت‌اند و جدول ۵۸ ستونه:** دکمه و مودال آپلود اکسل دارایی، استایل‌بندی ستون‌ها، فیلد تنظیم درصد تسهیم مازاد.
* **فاز ۵: آزمون‌های جامع و راستی‌آزمایی نهایی:** تست‌های تطبیق ۱۰۰٪ بک‌اند با سطرهای اکسل شرکت و بیلد بدون خطای فرانت‌اند.

---

# 📦 طرح اجرایی بسته ۴: کارایی دیتابیس، پنل ادمین، تنظیمات و پاکسازی نهایی (Performance & Maintenance)

> [!IMPORTANT]
> **سند مرجع اختصاصی:** [Documents/Communication_System_Hardening/implementation_plan_package_4.md](Communication_System_Hardening/implementation_plan_package_4.md)  
> **فازهای پوشش‌داده:** فاز ۵ (بازطراحی وضعیت خوانده‌شدن و کارایی) + فاز ۸ (تنظیمات، پاکسازی و انطباق) + فاز ۹ (زیرساخت Redis)  
> **وضعیت:** در انتظار تأیید کاربر جهت شروع پیاده‌سازی

### خلاصه‌سازی اقدامات کلیدی بسته ۴:
* **بازطراحی وضعیت خوانده‌شدن و حذف N+1:** ایجاد مدل `ConversationParticipant` با فیلد `last_read_message` و تبدیل `mark_as_read` به یک تک‌کوئری اتمیک، بهینه‌سازی `get_last_message` و `unread_count` با `Prefetch` و `annotate`.
* **برودکست ناهمگام و Tie-breaker:** خروج ارسال وب‌سوکت از مسیر اصلی Request با `transaction.on_commit`، اصلاح فیلتر `since_id` با Tie-breaker روی `id` جهت جلوگیری از ریزش پیام‌های هم‌زمان.
* **تنظیمات و دسترسی امنیتی:** افزودن `chat_enabled` و `chat_file_sharing` به `DEFAULT_SETTINGS` و `PublicConfigViewSet`، اعمال گارد ۴۰۳ در REST (`IsChatEnabled`) و رد وب‌سوکت با کد ۴۰۰۳.
* **پاکسازی دیسک و پنل ادمین:** اصلاح دستور `purge_expired_chat_media` برای خواندن از `all_objects` و Hard Delete فایل‌ها از دیسک و دیتابیس، ایجاد `communications/admin.py` و پاکسازی ۵ اسکریپت تستی موقت ریشه.
* **زیرساخت Redis Channels:** پیکربندی `RedisChannelLayer` در `settings.py` با پشتیبانی از Fallback امن.

---

# 📅 طرح اجرایی موتور سراسری تحلیل و پارس تاریخ (Dual-Path Date Parser Engine)

> [!IMPORTANT]
> **سند مرجع اختصاصی:** [Documents/Global_Date_Parser_Auxiliary/implementation_plan_global_date_parser.md](Global_Date_Parser_Auxiliary/implementation_plan_global_date_parser.md)  
> **وضعیت:** تدوین‌شده و در انتظار تأیید کاربر جهت شروع پیاده‌سازی

### خلاصه‌سازی اقدامات کلیدی طرح:
* **معماری دو مسیره (Fast-Path / Fallback):** بیش از ۹۵٪ داده‌های استاندارد از مسیر سریع (رگکس سبک زیر ۲ میکروثانیه) عبور کرده و تابع کمکی ارقام منحصراً به عنوان مسیر جبرانی (Fallback) وارد مدار می‌شود.
* **تحقق ۴ اصل فنی چت قبل:**
  1. پشتیبانی از طول‌های متغیر ارقام: ۶ رقم (`YYMMDD` با پیشوند قرن خورشیدی)، ۸ رقم (`YYYYMMDD` با ساعت پیش‌فرض)، ۱۲ رقم (`YYYYMMDDHHmm` با ثانیه صفر)، ۱۴ رقم (`YYYYMMDDHHmmss`).
  2. تبدیل خودکار ارقام فارسی (`۰-۹`) و عربی (`٠-٩`) به انگلیسی با جدول نگاشت `str.maketrans`.
  3. رفع تداخل ماه‌ها و روزهای تک‌رقمی با پیش‌پردازش قطعات و پر کردن با صفر (`Token-Padding` به عنوان مثال تبدیل `1403/5/8` به `14030508`).
  4. اعتبارسنجی سخت‌گیرانه دامنه تقویمی (ماه ۱ تا ۱۲، روز ۱ تا ۳۱، تفکیک خورشیدی ۱۳۰۰-۱۵۰۰ و میلادی بالای ۱۹۰۰).
* **یکپارچه‌سازی در سامانه:** استقرار در `warehouse-backend/common/date_utils.py` و جایگزینی متد محلی `_parse_date_flexible` در `inventory/views.py` و ایجاد ماژول متناظر کلاینت در `warehouse-front/src/app/core/utils/date-utils.ts`.
