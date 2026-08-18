from rest_framework import serializers
from .models import Item, CountTask, CountTaskHistory, DocTask, DocTaskHistory, ItemFieldDefinition

class ItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    modified_by_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'

    def get_warehouse_name(self, obj):
        if obj.warehouse:
            return obj.warehouse.project_name or obj.warehouse.name
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_modified_by_name(self, obj):
        if obj.modified_by:
            return f"{obj.modified_by.first_name} {obj.modified_by.last_name}".strip() or obj.modified_by.username
        return None

class ItemFieldDefinitionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ItemFieldDefinition
        fields = ['id', 'warehouse', 'name', 'label', 'field_type', 'default_value', 'is_required', 'is_active', 'created_by_name', 'sync_id', 'is_deleted', 'updated_at']
        read_only_fields = ['id', 'sync_id', 'is_deleted', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
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
        if self.context and 'is_blind' in self.context:
            return bool(self.context['is_blind'])
        from warehouses.services import get_setting
        wh_id = obj.item.warehouse_id if obj.item else None
        blind_mode = get_setting('blind_counting', wh_id)
        return blind_mode == 'blind'

    def get_item_details(self, obj):
        """اگر شمارش کور فعال باشد، inventory (موجودی) از پاسخ حذف شود"""
        if not obj.item:
            return None
        data = ItemSerializer(obj.item, context=self.context).data
        is_blind = False
        if self.context and 'is_blind' in self.context:
            is_blind = bool(self.context['is_blind'])
        else:
            from warehouses.services import get_setting
            wh_id = obj.item.warehouse_id if obj.item else None
            blind_mode = get_setting('blind_counting', wh_id)
            is_blind = (blind_mode == 'blind')
        if is_blind:
            data.pop('inventory', None)
            data.pop('bal4miv', None)
            data.pop('balance', None)
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
        read_only_fields = ('created_at', 'updated_at', 'created_by', 'modified_by', 'sync_id')

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
        if not obj.item:
            return None
        return ItemSerializer(obj.item, context=self.context).data

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        # تبدیل امن تاریخ شمسی و مقادیر خالی به فرمت استاندارد
        inv_date = data.get('invoice_date')
        if inv_date is not None:
            if inv_date == '' or inv_date == 'null':
                data['invoice_date'] = None
            elif isinstance(inv_date, str):
                inv_date_str = inv_date.strip()
                import re
                jalali_match = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', inv_date_str)
                if jalali_match:
                    y, m, d = int(jalali_match.group(1)), int(jalali_match.group(2)), int(jalali_match.group(3))
                    if 1300 <= y <= 1500:
                        try:
                            import jdatetime
                            g_date = jdatetime.date(y, m, d).togregorian()
                            data['invoice_date'] = g_date.strftime('%Y-%m-%d')
                        except Exception:
                            pass
                    elif 1900 <= y <= 2100:
                        data['invoice_date'] = f"{y:04d}-{m:02d}-{d:02d}"

        # تبدیل مقادیر خالی فیلدهای عددی و انتخابی به None
        nullable_fields = [
            'price_amount', 'similar_unit_price', 'total_value',
            'invoice_page', 'page_row', 'currency', 'invoice_type',
            'added_rti_no', 'inv_rti_number', 'doc_supplier', 'folder_address',
            'worker_note', 'supervisor_note', 'manager_note'
        ]
        for f in nullable_fields:
            if f in data and (data[f] == '' or data[f] == 'null'):
                data[f] = None

        return super().to_internal_value(data)


