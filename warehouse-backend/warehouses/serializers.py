from rest_framework import serializers
from .models import Warehouse

class WarehouseSerializer(serializers.ModelSerializer):
    total_quantity = serializers.SerializerMethodField()
    counted_quantity = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = '__all__'

    def get_total_quantity(self, obj):
        return obj.records.count()

    def get_counted_quantity(self, obj):
        return obj.records.exclude(field_status='در انتظار شمارش').count()

    def get_percent(self, obj):
        total = self.get_total_quantity(obj)
        if total == 0:
            return 0
        return int((self.get_counted_quantity(obj) / total) * 100)
