from rest_framework import permissions

class OrPermission(permissions.BasePermission):
    """
    Helper class to allow bitwise OR operations on permission instances.
    """
    def __init__(self, op1, op2):
        self.op1 = op1
        self.op2 = op2

    def __or__(self, other):
        return OrPermission(self, other)

    def has_permission(self, request, view):
        return self.op1.has_permission(request, view) or self.op2.has_permission(request, view)
        
    def has_object_permission(self, request, view, obj):
        return self.op1.has_object_permission(request, view, obj) or self.op2.has_object_permission(request, view, obj)


class HasMenuAccess(permissions.BasePermission):
    """
    Allows access only to authenticated users who have the specified menu permission.
    The required permission must be passed in the viewset/view.
    """
    def __init__(self, required_permission):
        self.required_permission = required_permission

    def __or__(self, other):
        return OrPermission(self, other)

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Django stores custom permissions as 'app_label.codename'
        # Since our custom permissions are on CustomUser in the 'accounts' app:
        full_perm = f"accounts.{self.required_permission}"
        return request.user.has_perm(full_perm)

def require_menu_access(permission_codename):
    """Factory to create a permission class for a specific menu access"""
    class _RequireMenuAccess(HasMenuAccess):
        def __init__(self):
            super().__init__(permission_codename)
    return _RequireMenuAccess


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Allows read-only access for authenticated users, but requires superuser
    or specific 'perm_sys_settings' for write actions.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        return request.user.is_superuser or request.user.has_perm('accounts.perm_sys_settings')

class IsSuperUser(permissions.BasePermission):
    """
    Allows access only to superusers.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
