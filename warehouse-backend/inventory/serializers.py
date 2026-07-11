from rest_framework import serializers
from .models import Item, CountTask

class ItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    modified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_modified_by_name(self, obj):
        if obj.modified_by:
            return f"{obj.modified_by.first_name} {obj.modified_by.last_name}".strip() or obj.modified_by.username
        return None

class CountTaskSerializer(serializers.ModelSerializer):
    counter_name = serializers.SerializerMethodField()
    supervisor_name = serializers.SerializerMethodField()
    item_details = ItemSerializer(source='item', read_only=True)

    class Meta:
        model = CountTask
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'created_by', 'modified_by')

    def get_counter_name(self, obj):
        if obj.counter:
            return f"{obj.counter.first_name} {obj.counter.last_name}".strip() or obj.counter.username
        return None

    def get_supervisor_name(self, obj):
        if obj.supervisor:
            return f"{obj.supervisor.first_name} {obj.supervisor.last_name}".strip() or obj.supervisor.username
        return None

