from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import Group, Permission
from .models import CustomUser
from warehouses.models import Warehouse

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename']

class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(many=True, queryset=Permission.objects.all(), required=False)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']

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
            'supervisor', 'is_active', 'date_joined', 'last_login',
            'updated_at', 'created_by', 'modified_by',
            'groups', 'user_permissions', 'assigned_warehouses', 'is_superuser',
            'requires_password_change', 'ui_preferences', 'roles'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login', 'updated_at', 'created_by', 'modified_by']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Add roles as list of group names
        ret['roles'] = list(instance.groups.values_list('name', flat=True))
        # Admin gets all warehouses logic
        if instance.is_superuser or instance.groups.filter(name='admin').exists():
            ret['assigned_warehouses'] = list(Warehouse.objects.values_list('id', flat=True))
        return ret

    def create(self, validated_data):
        groups = validated_data.pop('groups', [])
        roles = validated_data.pop('roles', None)
        user_permissions = validated_data.pop('user_permissions', [])
        assigned_warehouses = validated_data.pop('assigned_warehouses', [])
        password = validated_data.pop('password', '123456')
        
        user = CustomUser(**validated_data)
        user.set_password(password)
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
        roles = validated_data.pop('roles', None)
        if roles is not None:
            group_objs = Group.objects.filter(name__in=roles)
            instance.groups.set(group_objs)
        
        return super().update(instance, validated_data)

from axes.handlers.proxy import AxesProxyHandler
from rest_framework.exceptions import Throttled

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        request = self.context.get('request')
        if request and not AxesProxyHandler.is_allowed(request):
            import math
            from django.utils.timezone import now
            from django.conf import settings
            from axes.models import AccessAttempt
            from django.db.models import Q
            
            username = attrs.get(self.username_field)
            ip_address = request.META.get('REMOTE_ADDR')
            
            attempt = AccessAttempt.objects.filter(Q(username=username) | Q(ip_address=ip_address)).order_by('-attempt_time').first()
            minutes_left = 15
            if attempt:
                delta = (attempt.attempt_time + settings.AXES_COOLOFF_TIME) - now()
                minutes_left = int(math.ceil(delta.total_seconds() / 60.0))
                if minutes_left < 1:
                    minutes_left = 1
                    
            raise Throttled(detail=f'تعداد تلاش‌های ناموفق شما بیش از حد مجاز است. لطفاً {minutes_left} دقیقه دیگر دوباره امتحان کنید.')

        data = super().validate(attrs)
        user = self.user
        
        # Calculate permissions
        user_perms = set(user.user_permissions.values_list('codename', flat=True))
        for group in user.groups.all():
            user_perms.update(group.permissions.values_list('codename', flat=True))
        
        if user.is_superuser:
            user_perms.add('admin_all') # Or all permissions
            
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'avatar_letter': user.first_name[0] if user.first_name else 'U',
            'roles': list(user.groups.values_list('name', flat=True)),
            'role_titles': list(user.groups.values_list('name', flat=True)),
            'email': user.email,
            'national_code': user.national_code,
            'phone_number': user.phone_number,
            'operational_zone': user.operational_zone,
            'supervisor_id': user.supervisor_id,
            'requires_password_change': user.requires_password_change,
            'ui_preferences': user.ui_preferences,
            'permissions': list(user_perms),
        }
        return {
            'tokens': {
                'access': data['access'],
                'refresh': data['refresh'],
            },
            'user': data['user']
        }
