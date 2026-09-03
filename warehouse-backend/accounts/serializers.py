from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import Group, Permission
from .models import CustomUser, CustomRole
from warehouses.models import Warehouse

class PermissionSerializer(serializers.ModelSerializer):
    is_sensitive = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename', 'is_sensitive']

    def get_is_sensitive(self, obj):
        from .models import SENSITIVE_PERMISSION_CODENAMES
        return obj.codename in SENSITIVE_PERMISSION_CODENAMES

class CustomRoleSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(many=True, queryset=Permission.objects.all(), required=False)

    class Meta:
        model = CustomRole
        fields = ['id', 'name', 'title', 'color', 'parent', 'permissions']

class UserSerializer(serializers.ModelSerializer):
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=Group.objects.all(), required=False)
    user_permissions = serializers.PrimaryKeyRelatedField(many=True, queryset=Permission.objects.all(), required=False)
    assigned_warehouses = serializers.PrimaryKeyRelatedField(many=True, queryset=Warehouse.objects.all(), required=False)
    roles = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="List of group names to assign to the user"
    )

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 
            'national_code', 'phone_number', 'operational_zone', 
            'supervisor', 'company', 'address', 'avatar', 'blood_type', 'emergency_contact', 'is_active', 'date_joined', 'last_login',
            'updated_at', 'created_by', 'modified_by',
            'groups', 'user_permissions', 'assigned_warehouses', 'is_superuser',
            'requires_password_change', 'ui_preferences', 'roles'
        ]
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'phone_number': {'required': False, 'allow_blank': True, 'allow_null': True},
        }

    def validate_email(self, value):
        if value is None:
            return ""
        return value.strip()

    def validate_phone_number(self, value):
        if not value:
            return None
        from .excel_utils import normalize_digits
        import re
        raw = normalize_digits(str(value).strip())
        digits = re.sub(r'[^\d+]', '', raw)
        if digits.startswith('+98'):
            digits = '0' + digits[3:]
        elif digits.startswith('0098'):
            digits = '0' + digits[4:]
        elif digits.startswith('98') and len(digits) == 12:
            digits = '0' + digits[2:]
        elif digits.startswith('9') and len(digits) == 10:
            digits = '0' + digits

        if not re.match(r'^09\d{9}$', digits):
            raise serializers.ValidationError(
                "شماره تلفن همراه نامعتبر است. شماره معتبر باید با 09 شروع شده و ۱۱ رقم باشد (مانند 09123456789)."
            )
        return digits

    def validate(self, attrs):
        if not self.instance:
            phone = attrs.get('phone_number')
            if not phone:
                raise serializers.ValidationError({'phone_number': 'وارد کردن شماره تلفن همراه الزامی است.'})
        return super().validate(attrs)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['avatar'] = instance.avatar.url if instance.avatar else None
        # Build rich role objects from CustomRole
        role_data = []
        for group in instance.groups.all():
            try:
                cr = group.customrole
                role_data.append({
                    'id': cr.id, 'name': cr.name,
                    'title': cr.title, 'color': cr.color,
                })
            except CustomRole.DoesNotExist:
                role_data.append({
                    'id': group.id, 'name': group.name,
                    'title': group.name, 'color': '#94a3b8',
                })
        ret['roles'] = [r['name'] for r in role_data]
        ret['role_objects'] = role_data
        # Admin/superuser gets all warehouses
        if instance.is_superuser:
            ret['assigned_warehouses'] = list(Warehouse.objects.values_list('id', flat=True))
        return ret

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            is_req_admin = request.user.is_superuser
            if not is_req_admin and 'is_superuser' in validated_data:
                validated_data.pop('is_superuser')
                
        groups = validated_data.pop('groups', [])
        roles = validated_data.pop('roles', None)
        user_permissions = validated_data.pop('user_permissions', [])
        assigned_warehouses = validated_data.pop('assigned_warehouses', [])
        password = validated_data.pop('password', None)
        
        if not validated_data.get('email'):
            validated_data['email'] = ''
            
        user = CustomUser(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_password('123456')
            user.requires_password_change = True
        user.save()
        
        if roles is not None:
            group_objs = Group.objects.filter(name__in=roles)
            user.groups.set(group_objs)
        else:
            user.groups.set(groups)
            
        user.user_permissions.set(user_permissions)
        user.assigned_warehouses.set(assigned_warehouses)
        
        return user

    def update(self, instance, validated_data):
        from django.db.models import Q
        from rest_framework.exceptions import ValidationError
        
        if 'email' in validated_data and not validated_data['email']:
            validated_data['email'] = ''
        
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            is_req_admin = request.user.is_superuser
            if not is_req_admin and 'is_superuser' in validated_data:
                validated_data.pop('is_superuser')
                
        roles = validated_data.pop('roles', None)
        
        # Check if the user is currently an admin (superuser only)
        was_admin = instance.is_superuser
        
        # Determine new states
        new_is_active = validated_data.get('is_active', instance.is_active)
        new_is_superuser = validated_data.get('is_superuser', instance.is_superuser)
        new_has_admin_role = False  # Admin protection is based on is_superuser now
        if roles is not None:
            new_has_admin_role = False  # Role name no longer determines admin status
            
        will_be_admin = new_is_active and (new_is_superuser or new_has_admin_role)
        
        if was_admin and not will_be_admin:
            # Check if there are other active admins
            active_admins = CustomUser.objects.filter(
                is_active=True, is_superuser=True
            ).exclude(id=instance.id).count()
            
            if active_admins == 0:
                raise ValidationError("شما نمی‌توانید آخرین مدیر (Admin) فعال سیستم را تنزل درجه داده یا غیرفعال کنید.")
                
        if roles is not None:
            group_objs = Group.objects.filter(name__in=roles)
            instance.groups.set(group_objs)
        
        return super().update(instance, validated_data)

from axes.handlers.proxy import AxesProxyHandler
from rest_framework.exceptions import Throttled, AuthenticationFailed
from .middleware import get_client_ip
from .audit_utils import log_login_event
from .models import UserLoginLog, AuditLog

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    device_model = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get('request')
        ip_address = get_client_ip(request) if request else None
        user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''
        
        device_model = attrs.get('device_model')
        if not device_model and hasattr(self, 'initial_data') and isinstance(self.initial_data, dict):
            device_model = self.initial_data.get('device_model')
        if not device_model and request:
            device_model = request.data.get('device_model') if hasattr(request, 'data') else None
            if not device_model:
                device_model = request.headers.get('Sec-Ch-Ua-Model') or request.META.get('HTTP_SEC_CH_UA_MODEL')

        username = attrs.get(self.username_field, '')

        if request and not AxesProxyHandler.is_allowed(request):
            import math
            from django.utils.timezone import now
            from django.conf import settings
            from axes.models import AccessAttempt
            from django.db.models import Q
            
            attempt = AccessAttempt.objects.filter(Q(username=username) | Q(ip_address=ip_address)).order_by('-attempt_time').first()
            minutes_left = 15
            if attempt:
                delta = (attempt.attempt_time + settings.AXES_COOLOFF_TIME) - now()
                minutes_left = int(math.ceil(delta.total_seconds() / 60.0))
                if minutes_left < 1:
                    minutes_left = 1
            
            log_login_event(
                username=username,
                status='FAILED_LOCKED',
                ip_address=ip_address,
                user_agent=user_agent,
                device_model=device_model,
                failure_reason=f'مسدودسازی ضدنفوذ به دلیل تلاش‌های مکرر ({minutes_left} دقیقه)'
            )
            raise Throttled(detail=f'تعداد تلاش‌های ناموفق شما بیش از حد مجاز است. لطفاً {minutes_left} دقیقه دیگر دوباره امتحان کنید.')

        try:
            data = super().validate(attrs)
        except AuthenticationFailed as e:
            # بررسی وجود کاربر برای تعیین علت دقیق
            user_obj = CustomUser.objects.filter(username=username).first()
            if user_obj and not user_obj.is_active:
                log_login_event(
                    username=username,
                    status='FAILED_INACTIVE',
                    user=user_obj,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    device_model=device_model,
                    failure_reason='حساب کاربری غیرفعال است'
                )
            else:
                log_login_event(
                    username=username,
                    status='FAILED_CREDENTIALS',
                    user=user_obj,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    device_model=device_model,
                    failure_reason='کلمه عبور نادرست یا نام کاربری نامعتبر'
                )
            raise e
        except Exception as e:
            log_login_event(
                username=username,
                status='FAILED_CREDENTIALS',
                ip_address=ip_address,
                user_agent=user_agent,
                device_model=device_model,
                failure_reason=str(e)
            )
            raise e

        user = self.user
        
        # ثبت موفقیت ورود
        log_login_event(
            username=user.username,
            status='SUCCESS',
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
            device_model=device_model
        )
        
        # Calculate permissions
        user_perms = set(user.user_permissions.values_list('codename', flat=True))
        for group in user.groups.all():
            user_perms.update(group.permissions.values_list('codename', flat=True))
        
        if user.is_superuser:
            user_perms.add('admin_all') # Or all permissions
            
        # Build role info from CustomRole
        role_names = []
        role_titles = []
        for group in user.groups.all():
            role_names.append(group.name)
            try:
                cr = group.customrole
                role_titles.append(cr.title)
            except Exception:
                role_titles.append(group.name)

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar': user.avatar.url if user.avatar else None,
            'avatar_letter': user.first_name[0] if user.first_name else 'U',
            'roles': role_names,
            'role_titles': role_titles,
            'email': user.email,
            'national_code': user.national_code,
            'phone_number': user.phone_number,
            'operational_zone': user.operational_zone,
            'supervisor_id': user.supervisor_id,
            'requires_password_change': user.requires_password_change,
            'ui_preferences': user.ui_preferences,
            'is_superuser': user.is_superuser,
            'permissions': list(user_perms),
        }
        return {
            'tokens': {
                'access': data['access'],
                'refresh': data['refresh'],
            },
            'user': data['user']
        }


class UserLoginLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = UserLoginLog
        fields = [
            'id', 'user', 'user_display', 'username_attempted',
            'ip_address', 'user_agent', 'device_model', 'status', 'status_display',
            'failure_reason', 'metadata', 'created_at'
        ]
        read_only_fields = fields

    def get_user_display(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else obj.user.username
        return obj.username_attempted


class AuditLogListSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)
    module_display = serializers.CharField(source='get_module_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    has_diff = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'actor_username', 'actor_name', 'user_display', 'user_role', 'warehouse', 'warehouse_name',
            'module', 'module_display', 'action', 'action_display',
            'severity', 'severity_display', 'target_model', 'target_object_id',
            'target_repr', 'has_diff', 'ip_address', 'created_at'
        ]
        read_only_fields = fields

    def get_has_diff(self, obj):
        return bool(obj.before_state or obj.after_state)

    def get_user_display(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else obj.user.username
        if obj.actor_name:
            return f"{obj.actor_name} (سابق)"
        if obj.actor_username:
            return f"{obj.actor_username} (سابق)"
        return "سیستم"

    def get_user_role(self, obj):
        if obj.user:
            groups = list(obj.user.groups.all())
            if groups:
                first_group = groups[0]
                try:
                    return first_group.customrole.title
                except Exception:
                    return first_group.name
            if obj.user.is_superuser:
                return "مدیر ارشد (Admin)"
            return "کاربر سیستم"
        return "سیستم"


class AuditLogSerializer(AuditLogListSerializer):
    class Meta(AuditLogListSerializer.Meta):
        fields = [
            'id', 'user', 'actor_username', 'actor_name', 'user_display', 'user_role', 'warehouse', 'warehouse_name',
            'module', 'module_display', 'action', 'action_display',
            'severity', 'severity_display', 'target_model', 'target_object_id',
            'target_repr', 'before_state', 'after_state', 'details',
            'ip_address', 'created_at'
        ]
        read_only_fields = fields



from .models import CustomUser, CustomRole, UserTableViewState

class UserTableViewStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserTableViewState
        fields = ['id', 'table_name', 'view_name', 'columns_state', 'is_last_selected', 'created_at']
        read_only_fields = ['id', 'created_at']
        
    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)
