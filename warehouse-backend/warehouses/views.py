from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Warehouse, SystemSetting
from .serializers import WarehouseSerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    pagination_class = None

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        from accounts.permissions import HasMenuAccess
        
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated()]
        elif self.action == 'create':
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
        from .services import get_setting
        return Response({
            'system_version': get_setting('system_version'),
            'system_name': 'سامانه یکپارچه مدیریت انبارگردانی فارس عالیش'
        })
