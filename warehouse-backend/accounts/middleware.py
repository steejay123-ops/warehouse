import contextvars

_current_user_var = contextvars.ContextVar('current_user', default=None)
_current_ip_var = contextvars.ContextVar('current_ip', default=None)
_current_user_agent_var = contextvars.ContextVar('current_user_agent', default=None)
_current_warehouse_var = contextvars.ContextVar('current_warehouse', default=None)

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
