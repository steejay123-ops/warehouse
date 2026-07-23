from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import Group, Permission
from .models import CustomUser
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, GroupSerializer, PermissionSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    pagination_class = None

    def get_queryset(self):
        qs = CustomUser.objects.all()
        user = self.request.user
        if user and user.is_authenticated:
            # Hide superusers from non-admin users
            if not (user.is_superuser or user.groups.filter(name='admin').exists()):
                qs = qs.exclude(is_superuser=True)
        return qs

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        from .permissions import HasMenuAccess
        
        if self.action in ['change_password', 'update_preferences']:
            permission_classes = [IsAuthenticated()]
        elif self.action in ['list', 'retrieve']:
            permission_classes = [HasMenuAccess('view_sys_users')]
        elif self.action == 'create':
            permission_classes = [HasMenuAccess('perm_usr_add')]
        else: # update, partial_update, destroy, toggle_status
            permission_classes = [HasMenuAccess('perm_usr_edit')]
            
        return permission_classes

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        from django.db.models import Q
        from rest_framework.exceptions import ValidationError
        
        # Check if user is an admin
        if user.is_superuser or user.groups.filter(name='admin').exists():
            active_admins = CustomUser.objects.filter(is_active=True).filter(
                Q(is_superuser=True) | Q(groups__name='admin')
            ).exclude(id=user.id).count()
            
            if active_admins == 0:
                raise ValidationError("امکان حذف تنها مدیر (Admin) فعال سیستم وجود ندارد.")
                
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        user = self.get_object()
        from django.db.models import Q
        from rest_framework.exceptions import ValidationError
        
        # If user is currently active and is being deactivated
        if user.is_active:
            if user.is_superuser or user.groups.filter(name='admin').exists():
                active_admins = CustomUser.objects.filter(is_active=True).filter(
                    Q(is_superuser=True) | Q(groups__name='admin')
                ).exclude(id=user.id).count()
                
                if active_admins == 0:
                    raise ValidationError("امکان غیرفعال‌سازی تنها مدیر (Admin) فعال سیستم وجود ندارد.")
                    
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'success', 'is_active': user.is_active})

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({'error': 'رمز عبور فعلی نادرست است.'}, status=400)
            
        if new_password == '123456':
            return Response({'error': 'استفاده از رمز عبور پیش‌فرض (123456) مجاز نیست.'}, status=400)
            
        from django.utils import timezone
        user.set_password(new_password)
        user.requires_password_change = False
        user.password_changed_at = timezone.now()
        user.save()
        
        return Response({'success': True, 'message': 'رمز عبور با موفقیت تغییر یافت.'})

    @action(detail=True, methods=['post'])
    def admin_reset_password(self, request, pk=None):
        from django.utils import timezone
        user = self.get_object()
        user.set_password('123456')
        user.requires_password_change = True
        user.password_changed_at = timezone.now()
        user.save()
            
        return Response({'success': True, 'message': 'رمز عبور با موفقیت به مقدار پیش‌فرض تغییر یافت و کاربر باید دوباره لاگین کند.'})

    @action(detail=False, methods=['post'])
    def update_preferences(self, request):
        user = request.user
        prefs = request.data.get('preferences', {})
        if isinstance(prefs, dict):
            # Update specific keys instead of overriding completely
            if not isinstance(user.ui_preferences, dict):
                user.ui_preferences = {}
            user.ui_preferences.update(prefs)
            user.save()
            return Response({'status': 'success', 'preferences': user.ui_preferences})
        return Response({'error': 'Invalid preferences format'}, status=400)

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    pagination_class = None

    def get_permissions(self):
        from .permissions import HasMenuAccess
        return [HasMenuAccess('perm_usr_role')]

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if group.name in ['admin', 'manager', 'supervisor', 'counter']:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('امکان حذف نقش‌های سیستمی و کلیدی وجود ندارد.')
        return super().destroy(request, *args, **kwargs)

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.filter(content_type__model__in=['customuser', 'group', 'warehouse', 'record'])
    serializer_class = PermissionSerializer
    pagination_class = None

    def get_permissions(self):
        from .permissions import HasMenuAccess
        return [HasMenuAccess('perm_usr_role')]

