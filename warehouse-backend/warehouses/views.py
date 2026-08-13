from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Warehouse, SystemSetting
from .serializers import WarehouseSerializer

from common.mixins import DeleteImpactMixin

class WarehouseViewSet(DeleteImpactMixin, viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    pagination_class = None

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
        """Upload an Excel file and bulk-create warehouses."""
        from .excel_utils import parse_warehouses_excel
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
        for row_data in result['valid_rows']:
            wh = Warehouse(**row_data)
            if request.user and request.user.is_authenticated:
                wh.created_by = request.user
            wh.save()
            created_count += 1

        total_rows = created_count + len(result['errors'])
        return Response({
            'success': True,
            'summary': {
                'total_rows': total_rows,
                'created': created_count,
                'skipped': len(result['errors'])
            },
            'errors': result['errors']
        })

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
            # Needs superadmin or perm_sys_settings
            if not request.user.has_perm('accounts.perm_sys_settings') and not request.user.is_superuser:
                return Response({'error': 'Unauthorized'}, status=403)
            data = request.data
            for key, value in data.items():
                SystemSetting.objects.update_or_create(
                    key=key, warehouse=None,
                    defaults={'value': value}
                )
            return Response({'status': 'success'})

    @action(detail=False, methods=['get', 'post', 'delete'], url_path='warehouse/(?P<warehouse_id>[^/.]+)')
    def warehouse_settings(self, request, warehouse_id=None):
        if request.method == 'GET':
            from .services import get_all_settings
            effective_global = get_all_settings(None)
            
            wh_settings = SystemSetting.objects.filter(warehouse_id=warehouse_id)
            wh_dict = {s.key: s.value for s in wh_settings}
            
            result = {}
            for k, v in effective_global.items():
                if k in wh_dict:
                    result[k] = {'value': wh_dict[k], 'is_override': True}
                else:
                    result[k] = {'value': v, 'is_override': False}
                    
            return Response(result)
            
        elif request.method == 'POST':
            if not request.user.has_perm('accounts.perm_wh_edit') and not request.user.is_superuser:
                return Response({'error': 'Unauthorized'}, status=403)
            data = request.data
            for key, value in data.items():
                SystemSetting.objects.update_or_create(
                    key=key, warehouse_id=warehouse_id,
                    defaults={'value': value}
                )
            return Response({'status': 'success'})
            
        elif request.method == 'DELETE':
            if not request.user.has_perm('accounts.perm_wh_edit') and not request.user.is_superuser:
                return Response({'error': 'Unauthorized'}, status=403)
            keys = request.data.get('keys', [])
            SystemSetting.objects.filter(warehouse_id=warehouse_id, key__in=keys).delete()
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
