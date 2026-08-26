from django.apps import AppConfig
from django.core import checks
from django.conf import settings


def check_channel_layer_configuration(app_configs, **kwargs):
    errors = []
    channel_layers = getattr(settings, 'CHANNEL_LAYERS', {})
    default_layer = channel_layers.get('default', {})
    backend = default_layer.get('BACKEND', '')

    if 'InMemoryChannelLayer' in backend:
        msg = (
            "سامانه پیام‌رسانی بلادرنگ از InMemoryChannelLayer استفاده می‌کند. "
            "ارسال و دریافت پیام‌های وب‌سوکت تنها در محیط تک‌پروسه کار می‌کند و در حالت چند Worker به Redis نیاز است."
        )
        if not getattr(settings, 'DEBUG', True):
            errors.append(
                checks.Warning(
                    msg,
                    hint="متغیرهای REDIS_URL یا REDIS_HOST را در تنظیمات محیطی سرور پروداکشن مقداردهی کنید.",
                    id='communications.W001'
                )
            )
    return errors


class CommunicationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'communications'
    verbose_name = 'سیستم ارتباطات و گفتگوها'

    def ready(self):
        checks.register(check_channel_layer_configuration, checks.Tags.compatibility)
