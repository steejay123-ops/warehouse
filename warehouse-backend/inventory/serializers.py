from rest_framework import serializers
from .models import Item, CountTask, CountTaskHistory, DocTask, DocTaskHistory

class ItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    modified_by_name = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source='warehouse.project_name', read_only=True)

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

class CountTaskHistorySerializer(serializers.ModelSerializer):
    action_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CountTaskHistory
        fields = '__all__'

    def get_action_by_name(self, obj):
        if obj.action_by:
            return f"{obj.action_by.first_name} {obj.action_by.last_name}".strip() or obj.action_by.username
        return None

class CountTaskSerializer(serializers.ModelSerializer):
    counter_name = serializers.SerializerMethodField()
    supervisor_name = serializers.SerializerMethodField()
    assigned_manager_name = serializers.SerializerMethodField()
    item_details = serializers.SerializerMethodField()
    history = CountTaskHistorySerializer(many=True, read_only=True)
    is_blind = serializers.SerializerMethodField()

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

    def get_assigned_manager_name(self, obj):
        if obj.assigned_manager:
            return f"{obj.assigned_manager.first_name} {obj.assigned_manager.last_name}".strip() or obj.assigned_manager.username
        return None

    def get_is_blind(self, obj):
        """آیا شمارش کور فعال است؟"""
        from warehouses.services import get_setting
        wh_id = obj.item.warehouse_id if obj.item else None
        blind_mode = get_setting('blind_counting', wh_id)
        return blind_mode == 'blind'

    def get_item_details(self, obj):
        """اگر شمارش کور فعال باشد، balance از پاسخ حذف شود"""
        data = ItemSerializer(obj.item).data
        from warehouses.services import get_setting
        wh_id = obj.item.warehouse_id if obj.item else None
        blind_mode = get_setting('blind_counting', wh_id)
        if blind_mode == 'blind':
            data.pop('balance', None)
            data.pop('bal4miv', None)
        return data
class DocTaskHistorySerializer(serializers.ModelSerializer):
    action_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocTaskHistory
        fields = '__all__'

    def get_action_by_name(self, obj):
        if obj.action_by:
            return f"{obj.action_by.first_name} {obj.action_by.last_name}".strip() or obj.action_by.username
        return None

class DocTaskSerializer(serializers.ModelSerializer):
    doc_worker_name = serializers.SerializerMethodField()
    doc_supervisor_name = serializers.SerializerMethodField()
    assigned_manager_name = serializers.SerializerMethodField()
    item_details = serializers.SerializerMethodField()
    history = DocTaskHistorySerializer(many=True, read_only=True)

    class Meta:
        model = DocTask
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'created_by', 'modified_by')

    def get_doc_worker_name(self, obj):
        if obj.doc_worker:
            return f"{obj.doc_worker.first_name} {obj.doc_worker.last_name}".strip() or obj.doc_worker.username
        return None

    def get_doc_supervisor_name(self, obj):
        if obj.doc_supervisor:
            return f"{obj.doc_supervisor.first_name} {obj.doc_supervisor.last_name}".strip() or obj.doc_supervisor.username
        return None

    def get_assigned_manager_name(self, obj):
        if obj.assigned_manager:
            return f"{obj.assigned_manager.first_name} {obj.assigned_manager.last_name}".strip() or obj.assigned_manager.username
        return None

    def get_item_details(self, obj):
        return {
            'id': obj.item.id,
            'name': obj.item.name,
            'fa_unic_code': obj.item.fa_unic_code,
            'en_unic_code': obj.item.en_unic_code,
            'warehouse_name': obj.item.warehouse.name if obj.item.warehouse else None
        }
