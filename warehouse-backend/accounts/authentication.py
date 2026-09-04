from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework.exceptions import PermissionDenied
from datetime import datetime

class CustomJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        auth_result = super().authenticate(request)
        if auth_result is None:
            return None

        user, validated_token = auth_result
        self.enforce_token_app_scope(request, user, validated_token)
        return user, validated_token

    def enforce_token_app_scope(self, request, user, validated_token):
        if not user or user.is_superuser:
            return

        path = getattr(request, 'path_info', None) or getattr(request, 'path', '') or ''

        # استخراج دامنه‌های مجاز از توکن (یا محاسبه از مدل کاربر در صورت فقدان کلیم در توکن‌های قدیمی)
        allowed_apps = validated_token.get('allowed_apps')
        if allowed_apps is None:
            from accounts.middleware import get_user_allowed_apps
            allowed_apps = get_user_allowed_apps(user)

        def _log_boundary_violation(target_module, detail_msg):
            try:
                from accounts.models import AuditLog
                AuditLog.objects.create(
                    user=user,
                    actor_username=user.username,
                    actor_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                    module='system',
                    action='REJECT',
                    severity='critical',
                    target_model='ApiEndpoint',
                    target_object_id=path[:100],
                    target_repr=f"انسداد دسترسی بین‌سامانه‌ای غیرمجاز به {path}",
                    details={
                        'event': 'CROSS_APP_DENIED',
                        'target_module': target_module,
                        'requested_path': path,
                        'allowed_apps': allowed_apps,
                        'active_app': validated_token.get('active_app'),
                        'message': detail_msg
                    },
                    ip_address=getattr(request, 'META', {}).get('REMOTE_ADDR')
                )
            except Exception:
                pass

        # 1. درخواست‌های مربوط به سامانه مالی و پرسنلی:
        if path.startswith('/api/personnel/'):
            if 'finance' not in allowed_apps and 'personnel' not in allowed_apps:
                msg = 'این توکن فاقد قلمرو مجاز (App-Scoped Claim: finance) برای دسترسی به سامانه مالی و پرسنلی است.'
                _log_boundary_violation('finance', msg)
                raise PermissionDenied(msg, code='app_scope_denied')

        # 2. درخواست‌های مربوط به انبارداری و کالاها و گزارش‌ساز انبار:
        elif path.startswith('/api/inventory/') or path.startswith('/api/reports/'):
            if 'warehouse' not in allowed_apps:
                msg = 'این توکن فاقد قلمرو مجاز (App-Scoped Claim: warehouse) برای دسترسی به سامانه انبارداری است.'
                _log_boundary_violation('warehouse', msg)
                raise PermissionDenied(msg, code='app_scope_denied')

        # 3. تغییرات و مدیریت انبارها:
        elif path.startswith('/api/warehouses/') and getattr(request, 'method', 'GET') not in ('GET', 'HEAD', 'OPTIONS'):
            if 'warehouse' not in allowed_apps:
                msg = 'این توکن فاقد قلمرو مجاز (App-Scoped Claim: warehouse) برای ویرایش مشخصات انبار است.'
                _log_boundary_violation('warehouses', msg)
                raise PermissionDenied(msg, code='app_scope_denied')

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        
        # Check if the token was issued before the password was last changed
        if user and user.password_changed_at:
            # iat (issued at) is a Unix timestamp in integer seconds
            iat = validated_token.get('iat')
            if iat:
                pwd_timestamp = int(user.password_changed_at.timestamp())
                if pwd_timestamp > int(iat):
                    raise AuthenticationFailed('رمز عبور تغییر کرده است، لطفا مجددا وارد شوید.', code='password_changed')
                    
        return user
