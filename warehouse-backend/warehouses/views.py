from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Warehouse, SystemSetting
from .serializers import WarehouseSerializer
from .services import broadcast_warehouse_mutation

from django.db.models import Count, Q
from common.mixins import DeleteImpactMixin

class WarehouseViewSet(DeleteImpactMixin, viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    pagination_class = None

    def get_queryset(self):
        return Warehouse.objects.annotate(
            annotated_total_quantity=Count('items'),
            annotated_counted_quantity=Count(
                'items',
                filter=~Q(items__field_status__in=['waiting', 'counting', 'در انتظار شمارش'])
            )
        )

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        from accounts.permissions import HasMenuAccess
        
        if self.action in ['list', 'retrieve', 'export_excel', 'download_template']:
            permission_classes = [IsAuthenticated()]
        elif self.action in ['create', 'import_excel']:
            permission_classes = [HasMenuAccess('perm_wh_create')]
        elif self.action == 'toggle_archive':
            permission_classes = [HasMenuAccess('perm_wh_freeze')]
        else: # update, partial_update, destroy
            permission_classes = [HasMenuAccess('perm_wh_edit')]
            
        return permission_classes

    def perform_create(self, serializer):
        from accounts.audit_utils import log_audit_event
        instance = serializer.save()
        log_audit_event(
            module='warehouses',
            action='CREATE',
            target_model='Warehouse',
            target_object_id=instance.id,
            target_repr=f"انبار: {instance.name}",
            severity='info',
            warehouse=instance,
            after_state={'id': instance.id, 'name': instance.name, 'code': instance.code, 'is_active': instance.is_active}
        )
        broadcast_warehouse_mutation(instance.id, 'CREATE', instance.name)

    def perform_update(self, serializer):
        from accounts.audit_utils import log_audit_event, calculate_model_diff
        instance = self.get_object()
        before_state = {'name': instance.name, 'code': instance.code, 'is_active': instance.is_active, 'location': instance.location}
        
        if 'is_active' in self.request.data:
            if not self.request.user.has_perm('accounts.perm_wh_freeze') and not self.request.user.is_superuser:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("شما مجوز فریز/فعال‌سازی انبار را ندارید.")
        updated_instance = serializer.save()
        after_state = {'name': updated_instance.name, 'code': updated_instance.code, 'is_active': updated_instance.is_active, 'location': updated_instance.location}
        
        diff_b, diff_a = calculate_model_diff(before_state, after_state)
        is_freeze_change = before_state.get('is_active') != after_state.get('is_active')
        
        log_audit_event(
            module='warehouses',
            action='UPDATE',
            target_model='Warehouse',
            target_object_id=updated_instance.id,
            target_repr=f"انبار: {updated_instance.name}",
            severity='critical' if is_freeze_change else 'warning',
            warehouse=updated_instance,
            before_state=diff_b,
            after_state=diff_a,
            details={'freeze_toggled': is_freeze_change}
        )
        broadcast_warehouse_mutation(updated_instance.id, 'UPDATE', updated_instance.name)

    def perform_destroy(self, instance):
        from accounts.audit_utils import log_audit_event
        wh_id = instance.id
        wh_name = instance.name
        log_audit_event(
            module='warehouses',
            action='DELETE',
            target_model='Warehouse',
            target_object_id=wh_id,
            target_repr=f"حذف انبار: {wh_name}",
            severity='critical',
            warehouse=instance,
            before_state={'id': wh_id, 'name': wh_name, 'code': instance.code}
        )
        super().perform_destroy(instance)
        broadcast_warehouse_mutation(wh_id, 'DELETE', wh_name)

    @action(detail=True, methods=['patch'])
    def toggle_archive(self, request, pk=None):
        from accounts.audit_utils import log_audit_event
        warehouse = self.get_object()
        old_status = warehouse.is_active
        warehouse.is_active = not warehouse.is_active
        warehouse.save()
        log_audit_event(
            module='warehouses',
            action='UPDATE',
            target_model='Warehouse',
            target_object_id=warehouse.id,
            target_repr=f"{'فریز' if not warehouse.is_active else 'فعال‌سازی'} انبار: {warehouse.name}",
            severity='critical',
            warehouse=warehouse,
            before_state={'is_active': old_status},
            after_state={'is_active': warehouse.is_active},
            details={'action': 'toggle_archive'}
        )
        broadcast_warehouse_mutation(warehouse.id, 'TOGGLE_FREEZE', warehouse.name)
        return Response(self.get_serializer(warehouse).data)


    # ── Excel Import/Export Actions ──────────────────────────────────
    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """Download all warehouses as an Excel file."""
        from .excel_utils import generate_warehouses_excel
        queryset = self.get_queryset()
        return generate_warehouses_excel(queryset)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Download an empty Excel template with sample data."""
        from .excel_utils import generate_warehouses_template
        return generate_warehouses_template()

    @action(detail=False, methods=['post'])
    def import_excel(self, request):
        """Upload an Excel file and bulk-create warehouses with isolated row transactions."""
        from .excel_utils import parse_warehouses_excel
        from django.db import transaction

        file = request.FILES.get('file')
        if not file:
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فایلی انتخاب نشده است.'}]}, status=400)

        if not file.name.endswith('.xlsx'):
            return Response({'success': False, 'errors': [{'row': 0, 'field': 'file', 'message': 'فقط فایل‌های با فرمت xlsx پشتیبانی می‌شوند.'}]}, status=400)

        result = parse_warehouses_excel(file)

        file_errors = [e for e in result['errors'] if e['row'] == 0]
        if file_errors:
            return Response({'success': False, 'summary': {'total_rows': 0, 'created': 0, 'skipped': 0}, 'errors': file_errors}, status=400)

        created_count = 0
        errors = list(result['errors'])

        for row_item in result['valid_rows']:
            row_num = row_item['row_num']
            row_data = row_item['data']
            try:
                with transaction.atomic():
                    wh = Warehouse(**row_data)
                    if request.user and request.user.is_authenticated:
                        wh.created_by = request.user
                        wh.modified_by = request.user
                    wh.save()
                    created_count += 1
            except Exception as e:
                errors.append({
                    'row': row_num,
                    'field': 'database',
                    'message': f'خطا در ذخیره‌سازی انبار: {str(e)}'
                })

        total_rows = created_count + len(errors)
        return Response({
            'success': created_count > 0,
            'summary': {
                'total_rows': total_rows,
                'created': created_count,
                'skipped': len(errors)
            },
            'errors': errors
        }, status=200 if (created_count > 0 or not errors) else 400)

class SettingsViewSet(viewsets.ViewSet):
    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    @action(detail=False, methods=['get', 'post'], url_path='global')
    def global_settings(self, request):
        from .services import get_all_settings, validate_settings_payload, compute_settings_etag

        if request.method == 'GET':
            all_settings = get_all_settings(None)
            etag = compute_settings_etag(all_settings)
            
            if request.user.is_superuser or request.user.has_perm('accounts.perm_sys_settings') or request.user.has_perm('accounts.view_sys_settings'):
                resp = Response(all_settings)
                resp['ETag'] = etag
                return resp
            
            projection_keys = [
                'field_permissions_counter',
                'field_permissions_doc',
                'blind_counting',
                'counter_can_view_history',
                'counter_can_view_previous_notes',
                'financial_can_view_history',
                'financial_can_view_previous_notes',
            ]
            projected_settings = {k: v for k, v in all_settings.items() if k in projection_keys or k.startswith('scanner_')}
            resp = Response(projected_settings)
            resp['ETag'] = etag
            return resp

        elif request.method == 'POST':
            if not (request.user.is_superuser or request.user.has_perm('accounts.perm_sys_settings')):
                return Response({'error': 'تنها مدیر ارشد سیستم مجاز به تغییر تنظیمات سراسری است.'}, status=403)

            data = request.data
            if not isinstance(data, dict):
                return Response({'error': 'فرمت داده ارسالی باید دیکشنری (JSON Object) باشد.'}, status=400)

            # ETag / Optimistic Concurrency Control (Item 2)
            if_match = request.headers.get('If-Match') or request.META.get('HTTP_IF_MATCH')
            if if_match and if_match.strip() != '*':
                current_all = get_all_settings(None)
                current_etag = compute_settings_etag(current_all)
                if if_match.strip() != current_etag:
                    return Response({
                        'error': 'تنظیمات همزمان توسط کاربر یا تب دیگری تغییر کرده است. لطفاً صفحه را تازه‌سازی کنید.',
                        'code': 'CONCURRENT_MODIFICATION',
                        'current_etag': current_etag
                    }, status=412)

            invalid_keys = validate_settings_payload(data)
            if invalid_keys:
                return Response({
                    'error': 'کلیدهای ارسالی نامعتبر یا دارای نوع/مقدار اشتباه هستند.',
                    'invalid_keys': invalid_keys
                }, status=400)

            from django.db import transaction
            from .services import clear_setting_cache

            with transaction.atomic():
                for key, value in data.items():
                    SystemSetting.objects.update_or_create(
                        key=key, warehouse=None,
                        defaults={'value': value}
                    )
                    clear_setting_cache(key, None)

            from accounts.audit_utils import log_audit_event
            log_audit_event(
                user=request.user,
                module='settings',
                action='UPDATE',
                severity='warning',
                target_model='SystemSetting',
                target_repr='تغییر تنظیمات سراسری سیستم',
                details={'updated_keys': list(data.keys())},
                ip_address=getattr(request, 'META', {}).get('REMOTE_ADDR')
            )

            updated_all = get_all_settings(None)
            new_etag = compute_settings_etag(updated_all)
            resp = Response({'status': 'success', 'etag': new_etag})
            resp['ETag'] = new_etag
            return resp

    @action(detail=False, methods=['get', 'post', 'delete'], url_path='warehouse/(?P<warehouse_id>[^/.]+)')
    def warehouse_settings(self, request, warehouse_id=None):
        from django.shortcuts import get_object_or_404
        from django.db import transaction
        from .models import Warehouse, SystemSetting
        from .services import get_all_settings, clear_setting_cache, validate_settings_payload

        try:
            wh_id_int = int(warehouse_id)
        except (ValueError, TypeError):
            return Response({'error': 'شناسه انبار نامعتبر است.'}, status=400)

        warehouse = get_object_or_404(Warehouse, id=wh_id_int)
        is_super = request.user.is_superuser
        is_assigned = request.user.assigned_warehouses.filter(id=wh_id_int).exists()

        if request.method == 'GET':
            if not is_super and not is_assigned:
                return Response({'error': 'شما به این انبار دسترسی ندارید.'}, status=403)

            effective_global = get_all_settings(None)
            wh_settings = SystemSetting.objects.filter(warehouse_id=warehouse.id)
            wh_dict = {s.key: s.value for s in wh_settings}

            result = {}
            for k, v in effective_global.items():
                if k in wh_dict:
                    result[k] = {'value': wh_dict[k], 'is_override': True}
                else:
                    result[k] = {'value': v, 'is_override': False}

            return Response(result)

        elif request.method == 'POST':
            if not is_super and (not request.user.has_perm('accounts.perm_wh_edit') or not is_assigned):
                return Response({'error': 'شما مجوز ویرایش تنظیمات این انبار را ندارید.'}, status=403)

            data = request.data
            if not isinstance(data, dict):
                return Response({'error': 'فرمت داده ارسالی باید دیکشنری باشد.'}, status=400)

            invalid_keys = validate_settings_payload(data)
            if invalid_keys:
                return Response({
                    'error': 'کلیدهای ارسالی نامعتبر یا دارای نوع/مقدار اشتباه هستند.',
                    'invalid_keys': invalid_keys
                }, status=400)

            with transaction.atomic():
                for key, value in data.items():
                    SystemSetting.objects.update_or_create(
                        key=key, warehouse_id=warehouse.id,
                        defaults={'value': value}
                    )
                    clear_setting_cache(key, warehouse.id)

            from accounts.audit_utils import log_audit_event
            log_audit_event(
                user=request.user,
                warehouse=warehouse,
                module='settings',
                action='UPDATE',
                severity='warning',
                target_model='SystemSetting',
                target_repr=f"تغییر تنظیمات انبار {warehouse.name}",
                details={'warehouse_id': warehouse.id, 'updated_keys': list(data.keys())},
                ip_address=getattr(request, 'META', {}).get('REMOTE_ADDR')
            )

            return Response({'status': 'success'})

        elif request.method == 'DELETE':
            if not is_super and (not request.user.has_perm('accounts.perm_wh_edit') or not is_assigned):
                return Response({'error': 'شما مجوز حذف تنظیمات این انبار را ندارید.'}, status=403)

            keys = request.data.get('keys', [])
            if not isinstance(keys, list):
                return Response({'error': 'کلیدهای حذف باید به صورت آرایه (List) ارسال شوند.'}, status=400)

            with transaction.atomic():
                SystemSetting.objects.filter(warehouse_id=warehouse.id, key__in=keys).delete()
                for k in keys:
                    clear_setting_cache(k, warehouse.id)

            from accounts.audit_utils import log_audit_event
            log_audit_event(
                user=request.user,
                warehouse=warehouse,
                module='settings',
                action='DELETE',
                severity='warning',
                target_model='SystemSetting',
                target_repr=f"حذف تنظیمات سفارشی انبار {warehouse.name}",
                details={'warehouse_id': warehouse.id, 'deleted_keys': keys},
                ip_address=getattr(request, 'META', {}).get('REMOTE_ADDR')
            )

            return Response({'status': 'success'})

class PublicConfigViewSet(viewsets.ViewSet):
    def get_permissions(self):
        from rest_framework.permissions import AllowAny
        return [AllowAny()]

    def list(self, request):
        from .services import get_setting, DEFAULT_SETTINGS

        def clamped_minutes(key, low, high):
            """یک مقدار خرابِ واردشده توسط ادمین نباید این endpoint حساسِ بوت را ۵۰۰ کند."""
            try:
                return max(low, min(high, int(get_setting(key))))
            except (TypeError, ValueError):
                return DEFAULT_SETTINGS[key]

        return Response({
            'system_version': get_setting('system_version'),
            'system_name': 'سامانه یکپارچه مدیریت انبارگردانی فارس عالیش',
            'offline_sync_interval_minutes': clamped_minutes('offline_sync_interval_minutes', 1, 1440),
            # صفر = «هیچ‌وقت کهنه نشود» و مقدار معتبری است، پس کف بازه صفر است
            'offline_cache_ttl_minutes': clamped_minutes('offline_cache_ttl_minutes', 0, 10080),
            'chat_enabled': bool(get_setting('chat_enabled')),
            'chat_file_sharing': bool(get_setting('chat_file_sharing')),
        })
