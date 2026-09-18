from rest_framework import permissions

class IsOrgStructureManagerOrReadOnly(permissions.BasePermission):
    """
    اجازه خواندن به تمام کاربران احراز هویت شده،
    اما عملیات ایجاد، ویرایش و حذف فقط برای superuser یا دارندگان دسترسی‌های مدیریتی/مالی:
    - view_sys_projects / admin_all
    - perm_approve_personnel_manager / can_act_as_manager
    - perm_sys_settings
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        u = request.user
        if u.is_superuser or u.is_staff:
            return True

        user_roles = getattr(u, 'roles', []) or []
        user_dept = getattr(u, 'department', '') or ''
        if 'admin' in user_roles or 'superuser' in user_roles or user_dept == 'admin':
            return True

        # بررسی پرمیشن‌های ادمین/حسابداری
        for perm in ['accounts.admin_all', 'accounts.view_sys_projects', 'accounts.perm_sys_settings', 'accounts.perm_approve_personnel_manager', 'accounts.can_act_as_manager']:
            if u.has_perm(perm):
                return True

        return False


class IsPayrollSettingsManagerOrReadOnly(permissions.BasePermission):
    """
    اجازه خواندن و مشاهده تنظیمات پایه به کلیه کاربران احراز هویت شده،
    اما هرگونه تغییر، ذخیره، ایجاد سال مالی یا نسخه جدید منحصراً برای:
    - superuser / is_staff
    - accounts.admin_all
    - accounts.perm_sys_settings
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        u = request.user
        if u.is_superuser or u.is_staff:
            return True

        user_roles = getattr(u, 'roles', []) or []
        user_dept = getattr(u, 'department', '') or ''
        if 'admin' in user_roles or 'superuser' in user_roles or user_dept in ('admin', 'management'):
            return True

        for perm in ['accounts.admin_all', 'accounts.perm_sys_settings']:
            if u.has_perm(perm):
                return True

        return False

