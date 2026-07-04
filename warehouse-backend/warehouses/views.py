from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Warehouse
from .serializers import WarehouseSerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    pagination_class = None

    @action(detail=True, methods=['patch'])
    def toggle_archive(self, request, pk=None):
        warehouse = self.get_object()
        warehouse.is_active = not warehouse.is_active
        warehouse.save()
        return Response(self.get_serializer(warehouse).data)
