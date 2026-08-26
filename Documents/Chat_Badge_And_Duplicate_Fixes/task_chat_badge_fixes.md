<div dir="rtl" align="right">

# وظایف اجرایی بسته اصلاح شمارش بج و فریم‌های وب‌سوکت

- [x] **فاز ۱: اصلاح برودکست بک‌اند و حذف دلتای تکراری (`broadcast.py`)** <!-- id: 0 -->
  - [x] اصلاح `broadcast_message_ws` جهت ارسال پیام تنها به کانال شخصی اعضا و حذف ارسال مضاعف دلتا <!-- id: 1 -->
  - [x] پاکسازی ارسال‌های تکراری در `broadcast_message_updated_ws` و `broadcast_read_receipt_ws` <!-- id: 2 -->
- [x] **فاز ۲: ارتقای هسته سرویس فرانت‌اند (`communication.service.ts`)** <!-- id: 3 -->
  - [x] افزودن متد `leaveConversation` و مدیریت چرخه حیات روم‌ها <!-- id: 4 -->
  - [x] پیاده‌سازی مکانیزم Deduplication برای شناسه‌های پیام‌های ورودی (`processedMessageIds`) <!-- id: 5 -->
  - [x] تصحیح شمارش `totalUnreadCount` بر پایه مجموع یکپارچه `unread_count` مکالمات <!-- id: 6 -->
- [x] **فاز ۳: سیم‌کشی خروج در کامپوننت چت (`chat-drawer.component.ts`)** <!-- id: 7 -->
  - [x] خروج از روم فعال هنگام بازگشت به لیست (`backToList`) و بستن دراور (`closeDrawer`) <!-- id: 8 -->
- [x] **فاز ۴: تست‌های خودکار و راستی‌آزمایی جامع (Tests & Verification)** <!-- id: 9 -->
  - [x] اجرای تست‌های بک‌اند جنگو <!-- id: 10 -->
  - [x] به‌روزرسانی و اجرای تست‌های فرانت‌اند (`communication.service.spec.ts`) <!-- id: 11 -->

</div>
