from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Warehouse, SystemSetting
from .serializers import WarehouseSerializer

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

    def perform_update(self, serializer):
        if 'is_active' in self.request.data:
            if not self.request.user.has_perm('accounts.perm_wh_freeze') and not self.request.user.is_superuser:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("شما مجوز فریز/فعال‌سازی انبار را ندارید.")
        serializer.save()

    @action(detail=True, methods=['patch'])
    def toggle_archive(self, request, pk=None):
        warehouse = self.get_object()
        warehouse.is_active = not warehouse.is_active
        warehouse.save()
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
        if request.method == 'GET':
            from .services import get_all_settings
            return Response(get_all_settings(None))
        elif request.method == 'POST':
            if not (request.user.is_superuser or request.user.has_perm('accounts.perm_sys_settings')):
                return Response({'error': 'تنها مدیر ارشد سیستم مجاز به تغییر تنظیمات سراسری است.'}, status=403)

            data = request.data
            if not isinstance(data, dict):
                return Response({'error': 'فرمت داده ارسالی باید دیکشنری (JSON Object) باشد.'}, status=400)

            from django.db import transaction
            from .services import clear_setting_cache

            with transaction.atomic():
                for key, value in data.items():
                    SystemSetting.objects.update_or_create(
                        key=key, warehouse=None,
                        defaults={'value': value}
                    )
                    clear_setting_cache(key, None)

            return Response({'status': 'success'})

    @action(detail=False, methods=['get', 'post', 'delete'], url_path='warehouse/(?P<warehouse_id>[^/.]+)')
    def warehouse_settings(self, request, warehouse_id=None):
        from django.shortcuts import get_object_or_404
        from django.db import transaction
        from .models import Warehouse, SystemSetting
        from .services import get_all_settings, clear_setting_cache

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

            with transaction.atomic():
                for key, value in data.items():
                    SystemSetting.objects.update_or_create(
                        key=key, warehouse_id=warehouse.id,
                        defaults={'value': value}
                    )
                    clear_setting_cache(key, warehouse.id)

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
        })
