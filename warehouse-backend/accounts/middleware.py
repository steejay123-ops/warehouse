import contextvars
import logging

logger = logging.getLogger(__name__)

_current_user_var = contextvars.ContextVar('current_user', default=None)
_current_ip_var = contextvars.ContextVar('current_ip', default=None)
_current_user_agent_var = contextvars.ContextVar('current_user_agent', default=None)
_current_warehouse_var = contextvars.ContextVar('current_warehouse', default=None)
_current_active_role_var = contextvars.ContextVar('current_active_role', default=None)
_current_active_app_var = contextvars.ContextVar('current_active_app', default='personnel')
_current_client_tab_id_var = contextvars.ContextVar('current_client_tab_id', default=None)

def get_client_ip(request):
    """
    استخراج آدرس آی‌پی واقعی کلاینت با پشتیبانی از هدرهای پروکسی
    """
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR')
    return ip

def get_current_user():
    return _current_user_var.get()

def set_current_user(user):
    return _current_user_var.set(user)

def get_current_ip():
    return _current_ip_var.get()

def set_current_ip(ip):
    return _current_ip_var.set(ip)

def get_current_user_agent():
    return _current_user_agent_var.get()

def get_current_warehouse():
    return _current_warehouse_var.get()

def set_current_warehouse(warehouse):
    return _current_warehouse_var.set(warehouse)

def get_current_active_role():
    return _current_active_role_var.get()

def set_current_active_role(role):
    return _current_active_role_var.set(role)

def get_current_active_app():
    return _current_active_app_var.get()

def set_current_active_app(app_module):
    return _current_active_app_var.set(app_module)

def get_current_client_tab_id():
    return _current_client_tab_id_var.get()

def set_current_client_tab_id(tab_id):
    return _current_client_tab_id_var.set(tab_id)


def get_user_allowed_apps(user) -> list[str]:
    """
    محاسبه دامنه‌ها/برنامه‌های مجاز کاربر (warehouse و finance) بر اساس مجوزها یا وضعیت سوپریوزر
    """
    if not user or not user.is_authenticated:
        return []
    if user.is_superuser:
        return ['warehouse', 'finance']

    allowed = set()
    user_perms = user.get_all_permissions()

    # بررسی دسترسی به انبارداری
    warehouse_perm_markers = [
        'accounts.view_sys_counter', 'accounts.view_sys_supervisor',
        'accounts.view_sys_manager_review', 'accounts.view_sys_reports',
        'accounts.view_wh_dispatch', 'accounts.view_wh_docs',
        'accounts.view_wh_doc_approvals', 'accounts.perm_inventory_finalize',
        'accounts.perm_doc_approve_action', 'inventory.view_item',
        'warehouses.view_warehouse', 'inventory.add_item', 'inventory.change_item'
    ]
    if any(p in user_perms for p in warehouse_perm_markers):
        allowed.add('warehouse')

    # بررسی دسترسی به مالی و پرسنلی
    finance_perm_markers = [
        'accounts.view_sys_personnel', 'accounts.view_sys_personnel_attendance',
        'accounts.view_sys_payroll', 'accounts.view_sys_treasury',
        'accounts.view_sys_fleet_attendance', 'accounts.view_sys_fleet_settlement',
        'accounts.perm_approve_personnel_supervisor', 'accounts.perm_approve_fleet_supervisor',
        'accounts.perm_approve_personnel_finance', 'accounts.perm_approve_fleet_finance',
        'accounts.perm_approve_personnel_manager', 'accounts.perm_approve_fleet_manager',
        'accounts.perm_manager_payment_authorize', 'accounts.perm_treasury_disburse_action',
        'accounts.perm_manage_projects_sections'
    ]
    if any(p in user_perms for p in finance_perm_markers):
        allowed.add('finance')

    return sorted(list(allowed))


def get_user_valid_roles_for_app(user, app_module: str = 'personnel') -> list[str]:
    """
    محاسبه لیست نقش‌های معتبر و مجاز کاربر در ماژول انتخاب‌شده جهت جلوگیری از جعل نقش (Anti Role-Spoofing)
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_superuser:
        if app_module == 'personnel':
            return ['operator', 'supervisor', 'accountant', 'manager', 'treasury', 'superuser']
        return ['counter', 'warehouse_supervisor', 'docs_specialist', 'manager_review', 'superuser']

    roles = []
    if app_module == 'personnel':
        if user.has_perm('accounts.view_sys_personnel_attendance') or user.has_perm('accounts.view_sys_personnel'):
            roles.append('operator')
        if user.has_perm('accounts.perm_approve_personnel_supervisor') or user.has_perm('accounts.perm_approve_fleet_supervisor'):
            roles.append('supervisor')
        if user.has_perm('accounts.perm_approve_personnel_finance') or user.has_perm('accounts.perm_approve_fleet_finance') or user.has_perm('accounts.view_sys_payroll'):
            roles.append('accountant')
        if user.has_perm('accounts.perm_manager_payment_authorize') or user.has_perm('accounts.can_act_as_manager') or user.has_perm('accounts.perm_approve_personnel_manager'):
            roles.append('manager')
        if user.has_perm('accounts.perm_treasury_disburse_action') or user.has_perm('accounts.view_sys_treasury'):
            roles.append('treasury')
        if not roles:
            roles.append('operator')
    else:
        # Warehouse & Inventory App
        if user.has_perm('accounts.view_sys_counter') or user.has_perm('accounts.view_wh_dispatch'):
            roles.append('counter')
        if user.has_perm('accounts.view_sys_supervisor') or user.has_perm('accounts.view_wh_doc_approvals'):
            roles.append('warehouse_supervisor')
        if user.has_perm('accounts.view_wh_docs') or user.has_perm('accounts.perm_doc_approve_action'):
            roles.append('docs_specialist')
        if user.has_perm('accounts.view_sys_manager_review') or user.has_perm('accounts.perm_inventory_finalize'):
            roles.append('manager_review')
        if not roles:
            roles.append('counter')

    return roles


def resolve_effective_role(user, requested_role: str, app_module: str = 'personnel') -> str:
    """
    اعتبارسنجی نقش درخواستی در برابر اختیارات واقعی کاربر؛ در صورت عدم صلاحیت، بالاترین نقش معتبر جایگزین می‌شود.
    """
    if not user or not user.is_authenticated:
        return 'anonymous'

    valid_roles = get_user_valid_roles_for_app(user, app_module)
    if user.is_superuser:
        return requested_role if requested_role in valid_roles else 'superuser'

    if requested_role and requested_role in valid_roles:
        return requested_role

    # اگر نقشی فرستاده نشده یا نامعتبر بود، آخرین (بالاترین) نقش معتبر را برمی‌گردانیم
    return valid_roles[-1] if valid_roles else 'operator'


class AuditContextMiddleware:
    """
    میان‌افزار کانتکست ایزوله جهت نگهداری کاربر جاری، آدرس آی‌پی و مشخصات مرورگر در چرخه درخواست
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and not user.is_authenticated:
            user = None
            
        ip = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', '')
        
        # استخراج انبار فعال از هدر سفارشی در صورت ارسال توسط فرانت‌اند
        wh_header = request.META.get('HTTP_X_WAREHOUSE_ID')
        warehouse_id = None
        if wh_header and str(wh_header).isdigit():
            warehouse_id = int(wh_header)

        t_user = _current_user_var.set(user)
        t_ip = _current_ip_var.set(ip)
        t_ua = _current_user_agent_var.set(ua)
        t_wh = _current_warehouse_var.set(warehouse_id)

        try:
            response = self.get_response(request)
            if hasattr(response, 'headers') or hasattr(response, '__setitem__'):
                response['Accept-CH'] = 'Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List'
                response['Permissions-Policy'] = 'ch-ua-model=(self)'
            return response
        finally:
            _current_user_var.reset(t_user)
            _current_ip_var.reset(t_ip)
            _current_user_agent_var.reset(t_ua)
            _current_warehouse_var.reset(t_wh)


class ActiveRoleMiddleware:
    """
    میان‌افزار استخراج هدرهای X-Active-Role و X-Active-App، اعتبارسنجی ضدجعل و الصاق نقش فعال به request
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and not user.is_authenticated:
            user = None

        # استخراج ماژول کلان از هدر X-Active-App (پیش‌فرض: personnel)
        raw_app = request.META.get('HTTP_X_ACTIVE_APP', '').strip().lower()
        active_app = 'warehouse' if raw_app == 'warehouse' else 'personnel'

        # استخراج نقش درخواستی از هدر X-Active-Role
        raw_role = request.META.get('HTTP_X_ACTIVE_ROLE', '').strip().lower()

        # استخراج شناسه سشن تب مرورگر از هدر X-Client-Tab-Id
        client_tab_id = request.META.get('HTTP_X_CLIENT_TAB_ID', '').strip() or None

        # ارزیابی ضدجعل و تخصیص نقش نهایی
        effective_role = resolve_effective_role(user, raw_role, active_app)

        # الصاق به شیء درخواست
        request.active_app = active_app
        request.active_role = effective_role
        request.client_tab_id = client_tab_id
        request.valid_roles = get_user_valid_roles_for_app(user, active_app)

        t_role = _current_active_role_var.set(effective_role)
        t_app = _current_active_app_var.set(active_app)
        t_tab = _current_client_tab_id_var.set(client_tab_id)

        try:
            response = self.get_response(request)
            return response
        finally:
            _current_active_role_var.reset(t_role)
            _current_active_app_var.reset(t_app)
            _current_client_tab_id_var.reset(t_tab)
