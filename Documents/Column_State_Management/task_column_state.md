<div dir="rtl" align="right">

# تسک‌های پیاده‌سازی مدیریت وضعیت ستون‌ها (Popup UI)

- `[ ]` **بک‌اند (Backend):**
  - `[ ]` ساخت مدل `UserTableViewState` در `accounts/models.py` با فیلد `is_last_selected`.
  - `[ ]` ایجاد و اجرای مایگریشن‌ها.
  - `[ ]` ساخت Serializer برای مدل جدید.
  - `[ ]` ایجاد API View برای `GET`, `POST`, `DELETE` و یک endpoint برای تنظیم `last_selected`.
  - `[ ]` ثبت آدرس در `urls.py`.

- `[ ]` **فرانت‌اند (Frontend):**
  - `[ ]` افزودن متدهای لازم (`getTableViews`, `saveTableView`, `deleteTableView`, `setLastSelectedView`) به سرویس API.
  - `[ ]` آپدیت `data-table.component.ts`:
    - `[ ]` فراخوانی APIها هنگام لود (خواندن نماها و اعمال خودکار نمای `is_last_selected=true`).
    - `[ ]` متدهای باز و بسته کردن پاپ‌آپ جدید.
  - `[ ]` آپدیت `data-table.component.html`:
    - `[ ]` افزودن دکمه‌ی «مدیریت نماها» در کنار «انتخاب ستون‌ها».
    - `[ ]` ساختاربندی پاپ‌آپ:
      - `[ ]` کادر متنی + دکمه ذخیره در بالا.
      - `[ ]` لیست نماهای قبلی + دکمه‌های «اعمال» و «حذف» در پایین.

- `[ ]` **تست و بررسی (Testing):**
  - `[ ]` تست ذخیره، اعمال و حذف نما از طریق پاپ‌آپ.
  - `[ ]` تست ماندگاری آخرین انتخاب پس از رفرش صفحه.

</div>
