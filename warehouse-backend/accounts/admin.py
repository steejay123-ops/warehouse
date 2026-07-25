from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, CustomRole

@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ('title', 'name', 'parent', 'color')
    list_filter = ('parent',)
    search_fields = ('title', 'name')
    filter_horizontal = ('permissions',)

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'national_code', 'phone_number', 'is_active', 'is_staff')
    list_filter = ('is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'first_name', 'last_name', 'national_code', 'phone_number')
    filter_horizontal = ('groups', 'user_permissions', 'assigned_warehouses')
    
    fieldsets = UserAdmin.fieldsets + (
        ('اطلاعات سازمانی و هویتی (سفارشی)', {
            'fields': (
                'national_code', 
                'phone_number', 
                'operational_zone', 
                'supervisor',
                'assigned_warehouses',
                'ui_preferences',
                'requires_password_change'
            )
        }),
    )
