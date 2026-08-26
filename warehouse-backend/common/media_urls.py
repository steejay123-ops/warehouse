"""
دسترسی امضاشده به فایل‌های رسانه — بستن مسیر دانلود بدون احراز هویت

مسئله: مسیر `/media/` با `django.views.static.serve` همه فایل‌ها را بدون هیچ
بررسی هویتی سرو می‌کند. تا وقتی محتوای رسانه فقط لوگو و پیوست‌های عمومی بود
اهمیتی نداشت، ولی با آمدن عکس کالای انبار، هر کسی که یک URL داشته باشد (یا
حدس بزند) می‌تواند تصاویر انبار را ببیند.

چرا «هدر Authorization» جواب نمی‌دهد: مرورگر روی `<img src>` هدر سفارشی
نمی‌فرستد. تنها راه‌های واقعی، کوکی یا URL امضاشده است. این پروژه توکن را در
localStorage نگه می‌دارد (نه کوکی)، پس URL امضاشده انتخاب شده است.

نکته کلیدی طراحی — امضا باید *پایدار* باشد:
اگر برای هر پاسخ یک امضای تازه (با زمان لحظه‌ای) تولید شود، URL هر بار عوض
می‌شود و کش Service Worker و کش مرورگر هر بار miss می‌خورند — یعنی عکس‌ها
آفلاین دیده نمی‌شوند و مصرف پهنای باند چند برابر می‌شود. پس انقضا روی مرز
پنجره‌های ۳۰ روزه گِرد می‌شود: رشته URL در طول یک پنجره ثابت می‌ماند و اعتبار
هر URL بین ۳۰ تا ۶۰ روز است.

محدودیت باقی‌مانده (صادقانه): این امضا به فایل مقید است نه به کاربر. کسی که
URL امضاشده را در اختیار دیگری بگذارد، تا پایان اعتبار قابل استفاده است. آنچه
بسته می‌شود، دسترسی *بدون* عبور از احراز هویت و شمارش/حدس مسیرها است. برای
مقید کردن به کاربر باید رسانه از طریق کوکی HttpOnly سرو شود که تغییر معماری
ورود را لازم دارد.
"""
import time
from urllib.parse import quote

from django.conf import settings
from django.http import HttpResponseForbidden
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.static import serve

# پیشوندهایی که دسترسی به آن‌ها امضا لازم دارد. بقیه مسیرهای رسانه (لوگو،
# پیوست‌های قدیمی) رفتار قبلی خود را نگه می‌دارند تا چیزی نشکند.
PROTECTED_PREFIXES = ('item_photos/', 'chat_attachments/', 'comment_attachments/')

# طول پنجره اعتبار/پایداری امضا (۷ روز برای چت و رسانه‌ها)
_WINDOW_SECONDS = 7 * 24 * 60 * 60

_KEY_SALT = 'inventory.media.signed_url.v1'
_SAFE_INLINE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.gif')


def _current_expiry() -> int:
    """
    مرز پنجره بعدی — برای همه درخواست‌های داخل یک پنجره یکسان است.

    +2 (نه +1) تا URLای که در آخرین ثانیه‌های یک پنجره تولید شده هم دست‌کم
    یک پنجره کامل اعتبار داشته باشد.
    """
    now = int(time.time())
    return ((now // _WINDOW_SECONDS) + 2) * _WINDOW_SECONDS


def _signature(path: str, expiry: int) -> str:
    return salted_hmac(_KEY_SALT, f'{path}:{expiry}', algorithm='sha256').hexdigest()[:32]


def is_protected(path: str) -> bool:
    return any(path.startswith(p) for p in PROTECTED_PREFIXES)


def signed_media_url(name: str) -> str:
    """
    URL امضاشده برای یک فایل ذخیره‌شده.

    :param name: مسیر نسبیِ فایل در استوریج (مقدار FieldFile.name)
    """
    if not name:
        return ''
    path = name.lstrip('/')
    base = f"{settings.MEDIA_URL.rstrip('/')}/{quote(path)}"
    if not is_protected(path):
        return base
    expiry = _current_expiry()
    return f'{base}?e={expiry}&s={_signature(path, expiry)}'


def verify(path: str, expiry_raw: str, signature: str) -> bool:
    try:
        expiry = int(expiry_raw)
    except (TypeError, ValueError):
        return False
    if expiry < int(time.time()):
        return False
    return constant_time_compare(signature or '', _signature(path, expiry))


def serve_media(request, path):
    """
    جایگزین `django.views.static.serve` برای مسیر `/media/`.

    مسیرهای محافظت‌شده امضای معتبر می‌خواهند؛ بقیه مثل قبل سرو می‌شوند.
    """
    normalized = (path or '').lstrip('/')

    if is_protected(normalized) and not verify(
        normalized, request.GET.get('e'), request.GET.get('s')
    ):
        return HttpResponseForbidden('لینک تصویر معتبر نیست یا منقضی شده است.')

    response = serve(request, path, document_root=settings.MEDIA_ROOT)
    response['X-Content-Type-Options'] = 'nosniff'

    # برای فایل‌های غیرتصویر (مانند PDF, ZIP, TXT) هدر attachment ست می‌شود
    lower_path = normalized.lower()
    if not any(lower_path.endswith(ext) for ext in _SAFE_INLINE_EXTENSIONS):
        filename = quote(normalized.split('/')[-1])
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

    # عکس‌ها با نام یکتا ذخیره می‌شوند و هرگز بازنویسی نمی‌شوند، پس تا سقف
    # اعتبار امضا کش‌شدنی‌اند. این همان چیزی است که مشاهده آفلاین را ممکن می‌کند.
    if is_protected(normalized):
        response['Cache-Control'] = f'private, max-age={_WINDOW_SECONDS}, immutable'
    return response


__all__ = ['signed_media_url', 'serve_media', 'is_protected', 'verify']
