from rest_framework import serializers
from .models import Warehouse, SystemSetting

class WarehouseSerializer(serializers.ModelSerializer):
    total_quantity = serializers.SerializerMethodField()
    counted_quantity = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = '__all__'

    def get_total_quantity(self, obj):
        return obj.items.count()

    def get_counted_quantity(self, obj):
        # We only count items that have actively been counted (and potentially approved)
        return obj.items.exclude(field_status__in=['waiting', 'counting', 'در انتظار شمارش']).count()

    def get_percent(self, obj):
        total = self.get_total_quantity(obj)
        if total == 0:
            return 0
        return int((self.get_counted_quantity(obj) / total) * 100)

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = '__all__'
