from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import Group, Permission
from .models import CustomUser, CustomRole
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, CustomRoleSerializer, PermissionSerializer

from common.mixins import DeleteImpactMixin

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserViewSet(DeleteImpactMixin, viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer
    pagination_class = None

    def get_queryset(self):
        qs = CustomUser.objects.all()
        user = self.request.user
        
        has_perm = self.request.query_params.get('has_perm')
        if has_perm:
            from django.db.models import Q
            qs = qs.filter(
                Q(user_permissions__codename=has_perm) | 
                Q(groups__permissions__codename=has_perm)
            ).distinct()

        if user and user.is_authenticated:
            # Hide superusers from non-superuser users
            if not user.is_superuser:
                qs = qs.exclude(is_superuser=True)
        return qs

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated, AllowAny
        from .permissions import HasMenuAccess
        
        if self.action == 'verify_card':
            permission_classes = [AllowAny()]
        elif self.action in ['change_password', 'update_preferences', 'my_avatar']:
            permission_classes = [IsAuthenticated()]
        elif self.action in ['list', 'retrieve', 'export_excel', 'download_template']:
            permission_classes = [HasMenuAccess('view_sys_users')]
        elif self.action in ['create', 'import_excel']:
            permission_classes = [HasMenuAccess('perm_usr_add')]
        else: # update, partial_update, destroy, toggle_status, user_avatar
            permission_classes = [HasMenuAccess('perm_usr_edit')]
            
        return permission_classes

    def _validate_user_deactivation(self, request, user, action_name="حذف"):
        from rest_framework.exceptions import ValidationError
        from django.db.models import Q
        from django.contrib.auth.models import Permission
        
        # 1. Self-deletion guard
        if request.user.id == user.id:
            raise ValidationError(f"شما نمی‌توانید حساب کاربری خود را {action_name} کنید.")
            
        # 2. Protect last active superuser
        if user.is_superuser:
            active_superusers = CustomUser.objects.filter(
                is_active=True, is_superuser=True
            ).exclude(id=user.id).count()
            
            if active_superusers == 0:
                raise ValidationError(f"امکان {action_name} تنها مدیر (Admin) فعال سیستم وجود ندارد.")
                
        # 3. Protect last key roles
        KEY_PERMISSIONS = {
            'can_act_as_counter': 'انبارگردان',
            'can_act_as_supervisor': 'سرپرست انبار',
            'can_act_as_manager': 'مدیر انبار',
            'can_act_as_doc_worker': 'کارشناس اسناد',
            'can_act_as_doc_supervisor': 'سرپرست اسناد'
        }
        
        user_perms = set(
            user.user_permissions.filter(codename__in=KEY_PERMISSIONS.keys()).values_list('codename', flat=True)
        ) | set(
            Permission.objects.filter(group__user=user, codename__in=KEY_PERMISSIONS.keys()).values_list('codename', flat=True)
        )

        for perm in user_perms:
            other_active_users = CustomUser.objects.filter(
                is_active=True
            ).exclude(id=user.id).filter(
                Q(user_permissions__codename=perm) | 
                Q(groups__permissions__codename=perm)
            ).count()
            
            if other_active_users == 0:
                role_name = KEY_PERMISSIONS.get(perm, perm)
                raise ValidationError(f"امکان {action_name} این کاربر وجود ندارد. سیستم باید حداقل یک کاربر فعال با دسترسی «{role_name}» داشته باشد.")

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        self._validate_user_deactivation(request, user, action_name="حذف")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        user = self.get_object()
        from rest_framework.exceptions import ValidationError
        
        # If user is currently active and is being deactivated
        if user.is_active:
            self._validate_user_deactivation(request, user, action_name="غیرفعال‌سازی")
                    
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

    @action(detail=False, methods=['post', 'delete'], url_path='me/avatar')
    def my_avatar(self, request):
        """Update or delete the authenticated user's own avatar."""
        from .avatar_utils import process_and_optimize_avatar, delete_user_avatar_file
        user = request.user
        
        if request.method == 'DELETE':
            delete_user_avatar_file(user)
            user.avatar = None
            user.save()
            return Response({'success': True, 'avatar': None, 'message': 'تصویر پروفایل با موفقیت حذف شد.'})
            
        avatar_file = request.FILES.get('avatar')
        if not avatar_file:
            return Response({'error': 'فایل تصویری ارسال نشده است.'}, status=400)
            
        try:
            optimized_file = process_and_optimize_avatar(avatar_file)
            delete_user_avatar_file(user)
            user.avatar = optimized_file
            user.save()
            return Response({
                'success': True,
                'avatar': user.avatar.url,
                'message': 'تصویر پروفایل با موفقیت بروزرسانی شد.'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=True, methods=['post', 'delete'], url_path='avatar')
    def user_avatar(self, request, pk=None):
        """Update or delete avatar for a specific user (admin action)."""
        from .avatar_utils import process_and_optimize_avatar, delete_user_avatar_file
        user = self.get_object()
        
        if request.method == 'DELETE':
            delete_user_avatar_file(user)
            user.avatar = None
            user.save()
            return Response({'success': True, 'avatar': None, 'message': 'تصویر کاربر با موفقیت حذف شد.'})
            
        avatar_file = request.FILES.get('avatar')
        if not avatar_file:
            return Response({'error': 'فایل تصویری ارسال نشده است.'}, status=400)
            
        try:
            optimized_file = process_and_optimize_avatar(avatar_file)
            delete_user_avatar_file(user)
            user.avatar = optimized_file
            user.save()
            return Response({
                'success': True,
                'avatar': user.avatar.url,
                'message': 'تصویر کاربر با موفقیت بروزرسانی شد.'
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    # ── Excel Import/Export Actions ──────────────────────────────────
    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """Download all users as an Excel file."""
        from .excel_utils import generate_users_excel
        queryset = self.get_queryset()
        return generate_users_excel(queryset)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Download an empty Excel template with sample data."""
        from .excel_utils import generate_users_template
        return generate_users_template()

    @action(detail=False, methods=['post'])
    def import_excel(self, request):
        """Upload an Excel file and bulk-create or update users."""
        from .excel_utils import parse_users_excel
        file = request.FILES.get('file')
        if not file:
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فایلی انتخاب نشده است.'}]}, status=400)

        if not file.name.endswith('.xlsx'):
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فقط فایل‌های با فرمت xlsx پشتیبانی می‌شوند.'}]}, status=400)

        update_existing = request.POST.get('update_existing') in ('true', 'True', True, '1', 1) or request.data.get('update_existing') in ('true', 'True', True, '1', 1)
        result = parse_users_excel(file, update_existing=update_existing)

        # If there are file-level errors (row=0), return immediately
        file_errors = [e for e in result['errors'] if e['row'] == 0]
        if file_errors:
            return Response({'success': False, 'summary': {'total_rows': 0, 'created': 0, 'updated': 0, 'skipped': 0}, 'errors': file_errors}, status=400)

        created_count = 0
        updated_count = 0
        for row_data in result['valid_rows']:
            is_update = row_data.pop('is_update', False)
            user_id = row_data.pop('user_id', None)
            roles = row_data.pop('roles', [])
            warehouses = row_data.pop('warehouses', [])

            if is_update and user_id:
                user = CustomUser.objects.filter(id=user_id).first()
                if user:
                    for k, v in row_data.items():
                        setattr(user, k, v)
                    if request.user and request.user.is_authenticated:
                        user.modified_by = request.user
                    user.save()
                    if roles:
                        user.groups.set(roles)
                    if warehouses:
                        user.assigned_warehouses.set(warehouses)
                    updated_count += 1
                    continue

            password = row_data.get('national_code') or '123456'
            user = CustomUser(**row_data)
            user.set_password(password)
            user.requires_password_change = True
            if request.user and request.user.is_authenticated:
                user.created_by = request.user
            user.save()

            if roles:
                user.groups.set(roles)
            if warehouses:
                user.assigned_warehouses.set(warehouses)
            created_count += 1

        total_rows = created_count + updated_count + len(result['errors'])
        return Response({
            'success': True,
            'summary': {
                'total_rows': total_rows,
                'created': created_count,
                'updated': updated_count,
                'skipped': len(result['errors'])
            },
            'errors': result['errors']
        })

    @action(detail=False, methods=['get'], url_path='verify_card')
    def verify_card(self, request):
        """Public verification endpoint for personnel ID card scanning."""
        code = request.query_params.get('code', '').strip()
        user_id = None
        if code.upper().startswith('EMP-'):
            try:
                user_id = int(code[4:]) - 1000
            except ValueError:
                pass
        elif code.isdigit():
            user_id = int(code)
            
        user = None
        if user_id is not None and user_id > 0:
            user = CustomUser.objects.filter(id=user_id).first()
        if not user and code:
            user = CustomUser.objects.filter(national_code=code).first() or CustomUser.objects.filter(username=code).first()
            
        if not user:
            return Response({'valid': False, 'message': 'پرسنل با این شناسه در سامانه یافت نشد.'}, status=404)
            
        roles = []
        for g in user.groups.all():
            try:
                cr = g.customrole
                roles.append({'id': cr.id, 'title': cr.title or cr.name, 'color': cr.color or '#4f46e5'})
            except Exception:
                roles.append({'id': g.id, 'title': g.name, 'color': '#4f46e5'})
                
        wh_names = list(user.assigned_warehouses.values_list('name', flat=True))
        
        avatar_url = user.avatar.url if user.avatar else None
        
        return Response({
            'valid': True,
            'is_active': user.is_active,
            'id': user.id,
            'personnel_code': f"EMP-{1000 + user.id}",
            'first_name': user.first_name,
            'last_name': user.last_name,
            'national_code': user.national_code or '---',
            'phone_number': user.phone_number or '---',
            'operational_zone': user.operational_zone or 'انبار مرکزی',
            'company': user.company or 'فارس عــالیش',
            'avatar': avatar_url,
            'blood_type': user.blood_type or 'O+',
            'emergency_contact': user.emergency_contact or user.phone_number or '۰۲۱-۸۸۹۹۰۰۱۱',
            'roles': roles if roles else [{'id': 0, 'title': 'پرسنل عملیات انبار', 'color': '#4f46e5'}],
            'assigned_warehouses': wh_names if wh_names else ['انبار مرکزی']
        })

class CustomRoleViewSet(DeleteImpactMixin, viewsets.ModelViewSet):
    queryset = CustomRole.objects.all()
    serializer_class = CustomRoleSerializer
    pagination_class = None

    def get_permissions(self):
        from .permissions import HasMenuAccess
        return [HasMenuAccess('perm_usr_role')]

    def get_queryset(self):
        return CustomRole.objects.all()

    # ── Excel Import/Export Actions ──────────────────────────────────
    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """Download all roles as an Excel file."""
        from .roles_excel_utils import generate_roles_excel
        queryset = self.get_queryset()
        return generate_roles_excel(queryset)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Download an empty Excel template with sample data."""
        from .roles_excel_utils import generate_roles_template
        return generate_roles_template()

    @action(detail=False, methods=['post'])
    def import_excel(self, request):
        """Upload an Excel file and bulk-create or update roles."""
        from .roles_excel_utils import parse_roles_excel
        file = request.FILES.get('file')
        if not file:
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فایلی انتخاب نشده است.'}]}, status=400)

        if not file.name.endswith('.xlsx'):
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فقط فایل‌های با فرمت xlsx پشتیبانی می‌شوند.'}]}, status=400)

        update_existing = request.POST.get('update_existing') in ('true', 'True', True, '1', 1) or request.data.get('update_existing') in ('true', 'True', True, '1', 1)
        result = parse_roles_excel(file, update_existing=update_existing)

        file_errors = [e for e in result['errors'] if e['row'] == 0]
        if file_errors:
            return Response({'success': False, 'summary': {'total_rows': 0, 'created': 0, 'updated': 0, 'skipped': 0}, 'errors': file_errors}, status=400)

        created_count = 0
        updated_count = 0
        # Two-pass creation: first create/update roles without parents, then set parents
        processed_roles = {}
        for row_data in result['valid_rows']:
            is_update = row_data.pop('is_update', False)
            role_id = row_data.pop('role_id', None)
            permissions = row_data.pop('permissions', [])
            parent_name = row_data.pop('parent_name', None)

            if is_update and role_id:
                role = CustomRole.objects.filter(id=role_id).first()
                if role:
                    role.title = row_data['title']
                    role.color = row_data['color']
                    role.save()
                    if permissions:
                        role.permissions.set(permissions)
                    processed_roles[row_data['name']] = {'role': role, 'parent_name': parent_name}
                    updated_count += 1
                    continue

            role = CustomRole(name=row_data['name'], title=row_data['title'], color=row_data['color'])
            role.save()
            if permissions:
                role.permissions.set(permissions)
            processed_roles[row_data['name']] = {'role': role, 'parent_name': parent_name}
            created_count += 1

        # Second pass: resolve parents
        for name, info in processed_roles.items():
            if info['parent_name']:
                parent = CustomRole.objects.filter(name__iexact=info['parent_name']).first()
                if not parent:
                    parent = CustomRole.objects.filter(title__iexact=info['parent_name']).first()
                if parent and parent.id != info['role'].id:
                    info['role'].parent = parent
                    info['role'].save()

        total_rows = created_count + updated_count + len(result['errors'])
        return Response({
            'success': True,
            'summary': {
                'total_rows': total_rows,
                'created': created_count,
                'updated': updated_count,
                'skipped': len(result['errors'])
            },
            'errors': result['errors']
        })



class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.filter(content_type__model__in=['customuser', 'group', 'warehouse', 'record'])
    serializer_class = PermissionSerializer
    pagination_class = None

    def get_permissions(self):
        from .permissions import HasMenuAccess
        return [HasMenuAccess('perm_usr_role')]


from rest_framework.permissions import IsAuthenticated
from .models import UserTableViewState
from .serializers import UserTableViewStateSerializer

class UserTableViewStateViewSet(viewsets.ModelViewSet):
    serializer_class = UserTableViewStateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Only return views for the current user
        qs = UserTableViewState.objects.filter(user=self.request.user)
        table_name = self.request.query_params.get('table_name')
        if table_name:
            qs = qs.filter(table_name=table_name)
        return qs

    @action(detail=True, methods=['post'])
    def set_last_selected(self, request, pk=None):
        view_state = self.get_object()
        
        # Reset others for the same table
        UserTableViewState.objects.filter(
            user=request.user, 
            table_name=view_state.table_name
        ).update(is_last_selected=False)
        
        # Set this one
        view_state.is_last_selected = True
        view_state.save()
        
        return Response({'status': 'success', 'message': 'نمای انتخاب شده با موفقیت ذخیره شد.'})

