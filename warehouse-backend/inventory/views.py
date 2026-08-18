from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.parsers import MultiPartParser, FormParser
from .signals import broadcast_count_task_update, broadcast_doc_task_update
from .models import Item, ImportLog, ImportHistory, ItemFieldDefinition
from .models import CountTaskHistory
from common.sync_models import soft_delete_queryset
from .serializers import ItemSerializer, CountTaskSerializer, DocTaskSerializer, ItemFieldDefinitionSerializer
from django.forms.models import model_to_dict
from warehouses.models import Warehouse
from common.mixins import DeleteImpactMixin
from .models import CountTask, DocTask
from django.db.models import Q
from django.utils import timezone
import openpyxl
import uuid
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import PatternFill
import json
import tempfile
import os
import traceback
import queue
import threading
import asyncio
from datetime import datetime
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from django.utils import timezone

from rest_framework.pagination import PageNumberPagination
from .filters import ItemFilter


def _soft_delete_items_cascade(items_qs):
    """
    حذف نرم گروهی آیتم‌ها + Cascade دستی به مدل‌های سینک‌شونده وابسته
    (CountTask و CountTaskHistory) تا کلاینت آفلاین tombstone همه را بگیرد.
    DocTask/ItemPhoto/ImportHistory عمداً دست نمی‌خورند (خارج از دامنه سینک فاز ۰؛
    نمایششان با فیلتر item__is_deleted=False کنترل می‌شود).
    خروجی: تعداد آیتم‌های حذف‌نرم‌شده.
    """
    item_ids = list(items_qs.values_list('id', flat=True))
    if not item_ids:
        return 0
    soft_delete_queryset(CountTaskHistory.objects.filter(task__item_id__in=item_ids))
    soft_delete_queryset(CountTask.objects.filter(item_id__in=item_ids))
    return soft_delete_queryset(Item.objects.filter(id__in=item_ids))


class ItemPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000

from django.db.models import Case, When, Value, IntegerField, Q

class PriorityOrderingFilter(filters.OrderingFilter):
    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        
        search_value = request.query_params.get('search', '').strip()
        search_fields = getattr(view, 'search_fields', [])
        
        if search_value and search_fields:
            # Create OR conditions for all search fields starting with the search value
            q_objects = Q()
            for field in search_fields:
                kwargs = {f"{field}__istartswith": search_value}
                q_objects |= Q(**kwargs)
                
            queryset = queryset.annotate(
                match_priority=Case(
                    When(q_objects, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField()
                )
            )
            if ordering:
                return queryset.order_by(*ordering, 'match_priority')
            else:
                return queryset.order_by('match_priority')
        
        if ordering:
            return queryset.order_by(*ordering)
        return queryset

class ItemFieldDefinitionViewSet(viewsets.ModelViewSet):
    queryset = ItemFieldDefinition.objects.all()
    serializer_class = ItemFieldDefinitionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['warehouse']
    search_fields = ['name', 'label']

    def perform_create(self, serializer):
        # اگر رکورد حذف‌نرم با همان (انبار، نام) وجود دارد، احیا می‌شود؛
        # وگرنه INSERT به قید unique_together دیتابیس می‌خورد (اعتبارسنجی DRF
        # فقط رکوردهای زنده را می‌بیند).
        tombstone = ItemFieldDefinition.all_objects.filter(
            warehouse=serializer.validated_data.get('warehouse'),
            name=serializer.validated_data.get('name'),
            is_deleted=True,
        ).first()
        if tombstone:
            serializer.instance = tombstone
            serializer.save(created_by=self.request.user, is_deleted=False)
        else:
            serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete()

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_name = old_instance.name
        new_instance = serializer.save(modified_by=self.request.user)
        new_name = new_instance.name
        
        # If the system name changed, migrate all item data in this warehouse
        if old_name != new_name:
            items_to_update = []
            items = Item.objects.filter(warehouse=new_instance.warehouse)
            for item in items:
                if item.dynamic_data and old_name in item.dynamic_data:
                    item.dynamic_data[new_name] = item.dynamic_data.pop(old_name)
                    items_to_update.append(item)
            
            if items_to_update:
                now = timezone.now()
                for item in items_to_update:
                    item.updated_at = now  # bulk_update سیگنال auto_now را رد می‌کند
                Item.objects.bulk_update(items_to_update, ['dynamic_data', 'updated_at'])

    @action(detail=False, methods=['post'])
    def copy_from_warehouse(self, request):
        source_warehouse_id = request.data.get('source_warehouse_id')
        target_warehouse_id = request.data.get('target_warehouse_id')
        
        if not source_warehouse_id or not target_warehouse_id:
            return Response({'error': 'شناسه انبار مبدأ و مقصد الزامی است.'}, status=400)
            
        try:
            with transaction.atomic():
                source_fields = ItemFieldDefinition.objects.filter(warehouse_id=source_warehouse_id)
                target_existing_names = set(ItemFieldDefinition.objects.filter(warehouse_id=target_warehouse_id).values_list('name', flat=True))
                # فیلدهای حذف‌نرم مقصد: به‌جای ساخت (که به unique_together می‌خورد) احیا می‌شوند
                target_tombstones = {
                    fd.name: fd
                    for fd in ItemFieldDefinition.all_objects.filter(warehouse_id=target_warehouse_id, is_deleted=True)
                }

                new_fields = []
                resurrected = 0
                for field in source_fields:
                    if field.name in target_existing_names:
                        continue
                    tombstone = target_tombstones.get(field.name)
                    if tombstone:
                        tombstone.label = field.label
                        tombstone.field_type = field.field_type
                        tombstone.is_required = field.is_required
                        tombstone.default_value = field.default_value
                        tombstone.is_active = field.is_active
                        tombstone.is_deleted = False
                        tombstone.save()
                        resurrected += 1
                    else:
                        new_field = ItemFieldDefinition(
                            warehouse_id=target_warehouse_id,
                            name=field.name,
                            label=field.label,
                            field_type=field.field_type,
                            is_required=field.is_required,
                            default_value=field.default_value,
                            is_active=field.is_active,
                            created_by=request.user
                        )
                        new_fields.append(new_field)

                if new_fields:
                    ItemFieldDefinition.objects.bulk_create(new_fields)

                return Response({'message': f'{len(new_fields) + resurrected} فیلد با موفقیت کپی شد.'}, status=200)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class ItemViewSet(DeleteImpactMixin, viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, PriorityOrderingFilter]
    filterset_class = ItemFilter
    pagination_class = ItemPagination
    search_fields = ['fa_unic_code', 'description', 'po', 'pl', 'pk_number', 'my_tag']
    ordering_fields = '__all__'
    parser_classes = (MultiPartParser, FormParser, *viewsets.ModelViewSet.parser_classes)

    def get_queryset(self):
        return super().get_queryset()

    def perform_create(self, serializer):
        # احیای رکورد حذف‌نرم با همان (انبار، کد یکتا) به‌جای INSERT تکراری
        tombstone = Item.all_objects.filter(
            warehouse=serializer.validated_data.get('warehouse'),
            fa_unic_code=serializer.validated_data.get('fa_unic_code'),
            is_deleted=True,
        ).first()
        if tombstone:
            serializer.instance = tombstone
            serializer.save(is_deleted=False)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        with transaction.atomic():
            _soft_delete_items_cascade(Item.objects.filter(id=instance.id))

    def get_permissions(self):
        from accounts.permissions import HasMenuAccess
        from rest_framework.permissions import AllowAny, IsAuthenticated
        
        if self.action in ['download_import_log', 'download_template']:
            permission_classes = [AllowAny()]
        elif self.action in ['list', 'retrieve', 'dashboard_stats']:
            permission_classes = [IsAuthenticated()]
        elif self.action == 'bulk_assign':
            permission_classes = [HasMenuAccess('perm_rec_dispatch')]
        elif self.action in ['export_excel', 'export_excel_mt']: # I'll just secure export here in case it's added
            permission_classes = [HasMenuAccess('view_sys_export')]
        elif self.action in ['import_excel', 'cancel_import', 'delete_from_excel', 'clear_warehouse_data']:
            permission_classes = [HasMenuAccess('perm_rec_import')]
        elif self.action in ['reject', 'manager_reject']:
            permission_classes = [HasMenuAccess('perm_rec_recount')]
        elif self.action in ['update', 'partial_update']:
            permission_classes = [HasMenuAccess('perm_wh_edit') | HasMenuAccess('view_sys_counter') | HasMenuAccess('view_sys_supervisor')]
        else: # create, destroy, bulk_update, etc
            permission_classes = [HasMenuAccess('perm_wh_edit')]
            
        return permission_classes


    @action(detail=False, methods=['post'])
    def export_excel(self, request):
        import openpyxl
        from django.http import HttpResponse
        
        data_scope = request.data.get('data_scope', 'all')
        columns_scope = request.data.get('columns_scope', 'all_db')
        columns_list = request.data.get('columns_list', [])
        warehouse_id = request.data.get('warehouse_id') or request.query_params.get('warehouse_id')
        
        from django.http import QueryDict
        original_query_params = request._request.GET
        try:
            q = QueryDict(mutable=True)
            for k, v in request.data.items():
                if isinstance(v, list):
                    q.setlist(k, [str(x) for x in v])
                else:
                    q[k] = str(v)
            request._request.GET = q
            
            if data_scope == 'selected':
                selected_ids = request.data.get('selected_ids', [])
                queryset = self.get_queryset().filter(id__in=selected_ids)
                queryset = self.filter_queryset(queryset)
            else:
                queryset = self.filter_queryset(self.get_queryset())
        finally:
            request._request.GET = original_query_params
            
        expected_fields_dict = self.get_expected_fields(warehouse_id)
        valid_fields = {f.name: f for f in Item._meta.fields if f.name != 'dynamic_data'}
        
        if columns_scope == 'all_db':
            headers = list(expected_fields_dict.keys())
        elif columns_scope in ['visible', 'custom']:
            headers = [c for c in columns_list if c in expected_fields_dict]
            if not headers:
                headers = list(expected_fields_dict.keys())
        else:
            headers = list(expected_fields_dict.keys())
            
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Export"
        
        # Write headers
        ws.append([(valid_fields[h].verbose_name if hasattr(valid_fields[h], 'verbose_name') and valid_fields[h].verbose_name else h) if h in valid_fields else f"{h} (داینامیک)" for h in headers])
        ws.append([h for h in headers])
        
        for item in queryset.iterator():
            row = []
            for h in headers:
                if h in valid_fields:
                    val = getattr(item, h, '')
                else:
                    val = item.dynamic_data.get(h, '') if item.dynamic_data else ''
                    
                if val is None:
                    val = ''
                elif hasattr(val, 'username'):
                    val = f"{val.first_name} {val.last_name}".strip() or val.username
                elif val.__class__.__name__ == 'Warehouse':
                    val = str(val)
                elif hasattr(val, 'project_name') and getattr(val, 'project_name'):
                    val = getattr(val, 'project_name')
                else:
                    val = str(val)
                row.append(val)
            ws.append(row)
            
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="export.xlsx"'
        wb.save(response)
        
        return response

    @action(detail=False, methods=['get'])
    def export_columns(self, request):
        valid_fields = Item._meta.fields
        columns = []
        for f in valid_fields:
            if f.name == 'dynamic_data': continue
            label = getattr(f, 'verbose_name', '') or f.name
            columns.append({"key": f.name, "label": str(label)})
            
        warehouse_id = request.query_params.get('warehouse_id')
        if warehouse_id:
            dynamic_defs = ItemFieldDefinition.objects.filter(warehouse_id=warehouse_id, is_active=True)
            for d in dynamic_defs:
                columns.append({"key": d.name, "label": f"{d.name} (داینامیک)"})
                
        return Response(columns)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        import openpyxl
        from openpyxl.styles import PatternFill
        from django.http import HttpResponse

        warehouse_id = request.query_params.get('warehouse_id')
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Template"

        expected_fields = self.get_expected_fields(warehouse_id)
        headers = list(expected_fields.keys())

        # Add dynamic fields if warehouse_id is provided
        dynamic_fields = []
        if warehouse_id:
            dynamic_defs = ItemFieldDefinition.objects.filter(warehouse_id=warehouse_id, is_active=True)
            for d in dynamic_defs:
                dynamic_fields.append(d)

        # Write headers
        ws.append(headers)

        # Color system fields in the header
        from warehouses.services import get_setting
        restricted_fields = get_setting('SENSITIVE_EXCEL_FIELDS', warehouse_id) or ['doc_status', 'field_status', 'tag_status']
        
        system_fields = ['id', 'created_at', 'updated_at', 'created_by', 'modified_by'] + restricted_fields
        sys_fill = PatternFill(start_color="FFE699", end_color="FFE699", fill_type="solid") # Warning color (yellow/orange)
        for col_idx, h in enumerate(headers, 1):
            if h in system_fields:
                ws.cell(row=1, column=col_idx).fill = sys_fill

        # Write sample data
        sample_row_1 = []
        sample_row_2 = []
        valid_fields_dict = {f.name: f for f in Item._meta.fields}

        for h in headers:
            field = valid_fields_dict.get(h)
            
            # System fields mock data
            if h in system_fields:
                if h == 'id':
                    sample_row_1.append(101)
                    sample_row_2.append(102)
                elif h in ['created_at', 'updated_at']:
                    sample_row_1.append('2023-10-01 12:00')
                    sample_row_2.append('2023-10-01 12:05')
                elif h in ['created_by', 'modified_by']:
                    sample_row_1.append('سیستم / کاربر ۱')
                    sample_row_2.append('سیستم / کاربر ۲')
                else:
                    sample_row_1.append('مقدار سیستمی')
                    sample_row_2.append('مقدار سیستمی')
                continue
                
            # Dynamic fields mock data
            dyn_field = next((df for df in dynamic_fields if df.name == h), None)
            if dyn_field:
                if dyn_field.field_type == 'number':
                    sample_row_1.append(10)
                    sample_row_2.append(25)
                elif dyn_field.field_type == 'boolean':
                    sample_row_1.append(True)
                    sample_row_2.append(False)
                elif dyn_field.field_type == 'date':
                    sample_row_1.append('1402/05/10')
                    sample_row_2.append('1402/06/15')
                else:
                    sample_row_1.append('مقدار تست ۱')
                    sample_row_2.append('مقدار تست ۲')
                continue

            if h == 'fa_unic_code':
                sample_row_1.append('FA-10001')
                sample_row_2.append('FA-10002')
            elif h == 'warehouse':
                sample_row_1.append('انبار مرکزی')
                sample_row_2.append('انبار مرکزی')
            elif h in ['inventory', 'bal4miv']:
                sample_row_1.append(100.0)
                sample_row_2.append(50.5)
            elif field and field.get_internal_type() == 'BooleanField':
                sample_row_1.append(False)
                sample_row_2.append(True)
            elif field and field.get_internal_type() == 'DateField':
                sample_row_1.append('2023-01-01')
                sample_row_2.append('2023-02-01')
            else:
                sample_row_1.append('نمونه داده')
                sample_row_2.append('نمونه داده ۲')

        ws.append(sample_row_1)
        ws.append(sample_row_2)

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Warehouse_Template.xlsx"'
        wb.save(response)

        return response

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        try:
            records = request.data
            if not isinstance(records, list):
                return Response({"error": "Data must be a list of records"}, status=400)
            
            record_dict = {str(r['id']): r for r in records if 'id' in r}
            items = Item.objects.filter(id__in=record_dict.keys())
            
            items_to_update = []
            update_fields = set()
            valid_fields = {f.name: f for f in Item._meta.fields}

            for item in items:
                record = record_dict[str(item.id)]
                for key, value in record.items():
                    if key in valid_fields and key != 'id':
                        field = valid_fields[key]
                        if field.is_relation and field.many_to_one:
                            setattr(item, field.attname, value)
                            update_fields.add(field.name)
                        else:
                            setattr(item, key, value)
                            update_fields.add(key)
                items_to_update.append(item)
            
            if items_to_update and update_fields:
                for item in items_to_update:
                    item.updated_at = timezone.now()
                    item.modified_by = request.user
                update_fields.update(['updated_at', 'modified_by'])
                Item.objects.bulk_update(items_to_update, list(update_fields))
            
            return Response({"success": f"Updated {len(items_to_update)} items"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        ids = request.data.get('item_ids', request.data.get('ids', []))
        
        # Field Counting Assignments
        field_assignee_id = request.data.get('field_assignee')
        supervisor_id = request.data.get('supervisor_assignee')
        manager_id = request.data.get('manager_assignee')
        
        # Document Phase Assignments
        doc_assignee_id = request.data.get('doc_assignee') or request.data.get('doc_assignee_id')
        doc_supervisor_id = request.data.get('doc_supervisor_assignee') or request.data.get('doc_supervisor_id')
        doc_manager_id = request.data.get('doc_manager_assignee') or request.data.get('doc_manager_id')

        
        field_status = request.data.get('field_status')
        doc_status = request.data.get('doc_status')
        force = request.data.get('force', False)
        
        items = Item.objects.filter(id__in=ids)
        
        # مورد 3: هشدار برای ارسال مجدد کالایی که CountTask دارد
        if field_status == 'counting' and not force:
            from .models import CountTask
            existing_tasks = CountTask.objects.filter(item__in=items).count()
            if existing_tasks > 0:
                return Response({
                    'warning': True,
                    'message': f'تعداد {existing_tasks} مورد از کالاهای انتخاب شده قبلاً به فرآیند شمارش رفته‌اند. آیا از ارجاع مجدد اطمینان دارید؟'
                }, status=200)
                
        # هشدار برای ارسال مجدد کالایی که DocTask دارد
        if doc_status in ['checking', 'processing'] and not force:
            from .models import DocTask
            existing_doc_tasks = DocTask.objects.filter(item__in=items).count()
            if existing_doc_tasks > 0:
                return Response({
                    'warning': True,
                    'message': f'تعداد {existing_doc_tasks} مورد از کالاهای انتخاب شده قبلاً به فرآیند بررسی اسناد رفته‌اند. آیا از ارجاع مجدد اطمینان دارید؟'
                }, status=200)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        def _get_user_or_none(uid):
            if uid:
                try:
                    return User.objects.get(id=uid)
                except (User.DoesNotExist, ValueError):
                    return None
            return None

        counter_user = _get_user_or_none(field_assignee_id)
        manager_user = _get_user_or_none(manager_id)
        
        doc_worker_user = _get_user_or_none(doc_assignee_id)
        doc_manager_user = _get_user_or_none(doc_manager_id)
        
        supervisor_user = None
        skip_supervisor = False
        if supervisor_id:
            if str(supervisor_id) == 'skip':
                skip_supervisor = True
            else:
                supervisor_user = _get_user_or_none(supervisor_id)
                
        doc_supervisor_user = None
        doc_skip_supervisor = False
        if doc_supervisor_id:
            if str(doc_supervisor_id) == 'skip':
                doc_skip_supervisor = True
            else:
                doc_supervisor_user = _get_user_or_none(doc_supervisor_id)
        
        update_data = {}
        if 'field_assignee' in request.data:
            if counter_user:
                update_data['field_assignee'] = f"{counter_user.first_name} {counter_user.last_name}".strip() or counter_user.username
            else:
                update_data['field_assignee'] = 'استخر عمومی'
                
        if 'doc_assignee' in request.data:
            if doc_worker_user:
                update_data['doc_assignee'] = f"{doc_worker_user.first_name} {doc_worker_user.last_name}".strip() or doc_worker_user.username
            else:
                update_data['doc_assignee'] = 'استخر عمومی'

        if field_status is not None:
            update_data['field_status'] = field_status
        if doc_status is not None:
            update_data['doc_status'] = doc_status
            
        items_list = list(items)
        if update_data:
            update_data['updated_at'] = timezone.now()
            update_data['modified_by'] = request.user
            items.update(**update_data)
            
        from warehouses.services import get_setting
        first_item = items_list[0] if items_list else None
        wh_id = first_item.warehouse_id if first_item else None
        
        # Create CountTasks if it's a field dispatch
        if field_status == 'counting':
            from .models import CountTask
            
            # بررسی تنظیم تایید سرپرست
            req_supervisor = get_setting('require_supervisor_approval', wh_id)
            
            tasks_to_create = []
            for item in items_list:
                tasks_to_create.append(CountTask(
                    item=item,
                    counter=counter_user,
                    supervisor=supervisor_user if (req_supervisor and not skip_supervisor) else None,
                    skip_supervisor=skip_supervisor,
                    assigned_manager=manager_user,
                    status='PENDING_COUNT',
                    created_by=request.user,
                    modified_by=request.user
                ))
            if tasks_to_create:
                CountTask.objects.bulk_create(tasks_to_create)
                broadcast_count_task_update()

        # Create DocTasks if it's a document dispatch
        if doc_status == 'processing':
            from .models import DocTask
            import re
            from datetime import date as _dt_date
            
            # بررسی تنظیم تایید سرپرست اسناد
            req_doc_supervisor = get_setting('require_doc_supervisor_approval', wh_id)
            
            doc_tasks_to_create = []
            for item in items_list:
                # تبدیل امن مقادیر اولیه فیلدهای مالی کالا
                p_amount = item.price_amount
                s_price = item.similar_unit_price
                t_value = item.total_value
                curr = item.currency if item.currency in ['IRR', 'USD', 'EUR', 'OTHER'] else None
                inv_type = item.invoice_type if item.invoice_type in ['formal', 'domestic', 'foreign', 'consignment'] else None
                
                # صفحه و ردیف فاکتور
                p_row = int(str(item.page_row).strip()) if item.page_row and str(item.page_row).strip().isdigit() else None
                inv_page = int(str(item.invoice_page).strip()) if item.invoice_page and str(item.invoice_page).strip().isdigit() else None
                
                # مهر و امضا
                stamp_val = bool(item.stamp) if isinstance(item.stamp, bool) else (str(item.stamp).lower() in ['true', '1', 'بله', 'دارد', 'yes'])
                sign_val = bool(item.signature) if isinstance(item.signature, bool) else (str(item.signature).lower() in ['true', '1', 'بله', 'دارد', 'yes'])
                
                # تاریخ فاکتور
                inv_date = None
                if item.invoice_date:
                    inv_date_str = str(item.invoice_date).strip()
                    jalali_match = re.match(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$', inv_date_str)
                    if jalali_match:
                        y, m, d = int(jalali_match.group(1)), int(jalali_match.group(2)), int(jalali_match.group(3))
                        if 1300 <= y <= 1500:
                            try:
                                import jdatetime
                                inv_date = jdatetime.date(y, m, d).togregorian()
                            except Exception:
                                pass
                        elif 1900 <= y <= 2100:
                            try:
                                inv_date = _dt_date(y, m, d)
                            except Exception:
                                pass
                    elif isinstance(item.invoice_date, _dt_date):
                        inv_date = item.invoice_date

                doc_tasks_to_create.append(DocTask(
                    item=item,
                    doc_worker=doc_worker_user,
                    doc_supervisor=doc_supervisor_user if (req_doc_supervisor and not doc_skip_supervisor) else None,
                    skip_supervisor=doc_skip_supervisor,
                    assigned_manager=doc_manager_user,
                    status='PENDING_DOC',
                    price_amount=p_amount,
                    similar_unit_price=s_price,
                    total_value=t_value,
                    currency=curr,
                    invoice_type=inv_type,
                    invoice_date=inv_date,
                    inv_rti_number=item.inv_rti_number or None,
                    added_rti_no=item.added_rti_no or None,
                    page_row=p_row,
                    invoice_page=inv_page,
                    doc_supplier=item.doc_supplier or None,
                    folder_address=item.folder_address or None,
                    stamp=stamp_val,
                    signature=sign_val,
                    created_by=request.user,
                    modified_by=request.user,
                    sync_id=uuid.uuid4()
                ))
            if doc_tasks_to_create:
                DocTask.objects.bulk_create(doc_tasks_to_create)
                broadcast_doc_task_update()
            
        return Response({'status': 'success', 'updated': len(items_list)})

    @action(detail=False, methods=['post'])
    def bulk_tag(self, request):
        updates = request.data.get('updates', [])
        updated_count = 0
        if updates:
            with transaction.atomic():
                for up in updates:
                    item_id = up.get('id')
                    tag = up.get('my_tag', '')
                    if item_id:
                        Item.objects.filter(id=item_id).update(
                            my_tag=tag,
                            updated_at=timezone.now(), 
                            modified_by=request.user
                        )
                        updated_count += 1
        else:
            # Fallback for old bulk_tag format if any
            ids = request.data.get('ids', [])
            tag = request.data.get('tag')
            items = Item.objects.filter(id__in=ids)
            if tag == 'conflict':
                items.update(has_conflict=True, updated_at=timezone.now(), modified_by=request.user)
            updated_count = items.count()
            
        return Response({'status': 'success', 'updated': updated_count})

    def get_expected_fields(self, warehouse_id=None):
        fields = {}
        for f in Item._meta.fields:
            name = f.name
            if name == 'dynamic_data': continue
            if name == 'warehouse':
                fields['warehouse'] = 'warehouse'
            elif name in ['created_by', 'modified_by']:
                fields[name] = name
            else:
                fields[name] = name
                
        if warehouse_id:
            from .models import ItemFieldDefinition
            dynamic_defs = ItemFieldDefinition.objects.filter(warehouse_id=warehouse_id, is_active=True)
            for d in dynamic_defs:
                fields[d.name] = d.name
                
        return fields

    @action(detail=False, methods=['post'])
    def parse_headers(self, request):
        from warehouses.services import get_setting
        file_obj = request.FILES.get('file')
        warehouse_id = request.data.get('warehouse_id')
        
        if not file_obj:
            return Response({'error': 'هیچ فایلی ارسال نشده است.'}, status=400)
            
        try:
            fd, temp_path = tempfile.mkstemp(suffix='.xlsx')
            with os.fdopen(fd, 'wb') as f:
                for chunk in file_obj.chunks():
                    f.write(chunk)
            
            wb = openpyxl.load_workbook(temp_path, read_only=True, data_only=True)
            ws = wb.active
            
            # Read only the first row for headers to maximize speed
            first_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), [])
            # Convert to lower case to remove case sensitivity
            raw_headers = [str(val).strip().lower() if val is not None else '' for val in first_row]
            
            wb.close()
            try:
                os.remove(temp_path)
            except Exception:
                pass
            
            expected_fields = self.get_expected_fields(warehouse_id)
            
            found_fields = []
            for h in raw_headers:
                if h in expected_fields:
                    found_fields.append(expected_fields[h])
            
            all_expected = set(expected_fields.values())
            missing_fields = list(all_expected - set(found_fields))
            
            # Check for sensitive fields
            restricted_fields = get_setting('SENSITIVE_EXCEL_FIELDS', warehouse_id) or ['doc_status', 'field_status', 'tag_status']
            has_restricted = any(f in found_fields for f in restricted_fields)
            is_superuser = request.user.is_superuser if request.user and request.user.is_authenticated else False
            
            return Response({
                'status': 'success', 
                'found_fields': list(set(found_fields)), 
                'missing_fields': list(set(missing_fields)),
                'has_restricted_fields': has_restricted,
                'is_superuser': is_superuser
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def cancel_import(self, request):
        import_id = request.data.get('import_id')
        if import_id:
            cache.set(f"cancel_import_{import_id}", True, timeout=3600)
            return Response({'status': 'cancelled'})
        return Response({'error': 'import_id required'}, status=400)

    @action(detail=False, methods=['get'], permission_classes=[], authentication_classes=[])
    def download_import_log(self, request):
        import_id = request.query_params.get('import_id')
        if not import_id:
            return Response({'error': 'import_id required'}, status=400)
            
        file_path = os.path.join(tempfile.gettempdir(), f"import_log_{import_id}.xlsx")
        if not os.path.exists(file_path):
            return Response({'error': 'فایل لاگ یافت نشد یا منقضی شده است.'}, status=404)
            
        with open(file_path, 'rb') as f:
            file_data = f.read()
            
        response = StreamingHttpResponse(
            iter([file_data]),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="import_log_{import_id}.xlsx"'
        return response

    @action(detail=False, methods=['post'])
    def import_excel(self, request):
        file_obj = request.FILES.get('file')
        warehouse_id = request.data.get('warehouse_id')
        
        from warehouses.services import get_setting
        sys_conflict_strategy = get_setting('default_conflict_strategy', warehouse_id)
        sys_tag_status = get_setting('default_tag_status', warehouse_id)
        
        conflict_strategy = request.data.get('conflict_strategy') or sys_conflict_strategy
        import_tag = request.data.get('import_tag', '')
        import_id = request.data.get('import_id', '')
        
        if not file_obj:
            return Response({'error': 'هیچ فایلی ارسال نشده است.'}, status=400)
            
        # Save file to temp to allow streaming response generator to read it
        fd, temp_path = tempfile.mkstemp(suffix='.xlsx')
        with os.fdopen(fd, 'wb') as f:
            for chunk in file_obj.chunks():
                f.write(chunk)
                
        user_id = request.user.id if request.user.is_authenticated else None
        original_file_name = file_obj.name

        def worker(q):
            try:
                q.put(json.dumps({"type": "info", "msg": ">> فایل با موفقیت دریافت شد. در حال خواندن محتوا..."}) + "\n")
                wb = openpyxl.load_workbook(temp_path, data_only=True)
                ws = wb.active
                
                raw_headers = [str(cell.value).strip().lower() if cell.value else '' for cell in ws[1]]
                expected_fields = self.get_expected_fields(warehouse_id)
                
                dynamic_fields_keys = []
                if warehouse_id:
                    dynamic_fields_keys = [d.name for d in ItemFieldDefinition.objects.filter(warehouse_id=warehouse_id, is_active=True)]
                
                found_fields = []
                col_indices = {}
                
                for idx, h in enumerate(raw_headers):
                    if h in expected_fields:
                        found_fields.append(expected_fields[h])
                        col_indices[expected_fields[h]] = idx
                
                all_expected_db_fields = set(expected_fields.values())
                missing_fields = list(all_expected_db_fields - set(found_fields))
                
                if 'fa_unic_code' not in found_fields and 'id' not in found_fields:
                    q.put(json.dumps({"type": "err", "msg": ">> خطای حیاتی: ستون 'fa_unic_code' یا 'id' در فایل اکسل یافت نشد. یکی از این ستون‌ها اجباری است."}) + "\n")
                    q.put(json.dumps({
                        "type": "summary",
                        "status": "failed",
                        "created": 0, "updated": 0, "skipped": 0, "failed": 0,
                        "found_fields": list(set(found_fields)),
                        "missing_fields": list(set(missing_fields)),
                        "error_details": [{"row": 0, "code": "HEADER", "error": "ستون fa_unic_code یا id یافت نشد"}]
                    }) + "\n")
                    return
                
                created = 0
                updated = 0
                skipped = 0
                failed = 0
                error_details = []
                
                # Fetch sensitive fields settings and user permissions
                restricted_fields = get_setting('SENSITIVE_EXCEL_FIELDS', warehouse_id) or ['doc_status', 'field_status', 'tag_status']
                is_superuser = request.user.is_superuser if request.user and request.user.is_authenticated else False
                
                # Setup output workbook for log
                out_wb = openpyxl.Workbook(write_only=True)
                out_ws = out_wb.create_sheet('Log')
                log_headers = list(raw_headers) + ['وضعیت پردازش', 'جزئیات پیام']
                out_ws.append(log_headers)
                
                FILL_COLORS = {
                    'created': PatternFill(start_color="C6F6D5", end_color="C6F6D5", fill_type="solid"),
                    'updated': PatternFill(start_color="BFDBFE", end_color="BFDBFE", fill_type="solid"),
                    'warn': PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid"),
                    'err': PatternFill(start_color="FECDD3", end_color="FECDD3", fill_type="solid")
                }
                
                def append_colored_row(row_data_tuple, status_code, message):
                    row_cells = []
                    for val in list(row_data_tuple) + [status_code, message]:
                        c = WriteOnlyCell(out_ws, value=val)
                        if status_code in FILL_COLORS:
                            c.fill = FILL_COLORS[status_code]
                        row_cells.append(c)
                    out_ws.append(row_cells)

                q.put(json.dumps({"type": "info", "msg": ">> پردازش سطرها شروع شد..."}) + "\n")
                
                try:
                    history_records = []
                    
                    with transaction.atomic():
                        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                            # Check cancel flag
                            if import_id and cache.get(f"cancel_import_{import_id}"):
                                raise Exception("CANCELED_BY_USER")

                            row_data = {}
                            for db_field, col_idx in col_indices.items():
                                row_data[db_field] = row[col_idx]
                            
                            raw_fa = row_data.get('fa_unic_code')
                            fa_unic_code = str(raw_fa).strip() if raw_fa is not None and str(raw_fa).strip() != '' else None
                            
                            raw_id = row_data.pop('id', None)
                            item_id = str(raw_id).strip() if raw_id is not None and str(raw_id).strip() != '' else None
                            
                            if not fa_unic_code and not item_id:
                                failed += 1
                                err_msg = "ستون fa_unic_code و id خالی است"
                                error_details.append({"row": row_idx, "code": "N/A", "error": err_msg})
                                append_colored_row(row, 'err', err_msg)
                                q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا: {err_msg}"}) + "\n")
                                continue
                            
                            # Ignore Excel data for core system fields
                            for ignore_field in ['created_at', 'updated_at', 'created_by', 'modified_by', 'sync_id', 'is_deleted']:
                                row_data.pop(ignore_field, None)
                                
                            # Ignore sensitive fields if not superuser
                            if not is_superuser:
                                for ignore_field in restricted_fields:
                                    row_data.pop(ignore_field, None)
                                
                            if 'hov_date' in row_data:
                                date_val = row_data['hov_date']
                                if isinstance(date_val, datetime):
                                    row_data['hov_date'] = date_val.date()
                                else:
                                    row_data['hov_date'] = None
                                    
                            excel_tag = row_data.pop('my_tag', '')
                            if not excel_tag: excel_tag = ''
                            excel_tag = str(excel_tag).strip().replace(',', '،')
                            
                            final_tags = []
                            if excel_tag:
                                final_tags.extend([t.strip() for t in excel_tag.split('،') if t.strip()])
                            if import_tag:
                                import_tag_clean = import_tag.replace(',', '،')
                                final_tags.extend([t.strip() for t in import_tag_clean.split('،') if t.strip()])
                            
                            unique_tags = list(set(final_tags))
                            if unique_tags:
                                row_data['my_tag'] = '،'.join(unique_tags)
                            else:
                                row_data['my_tag'] = ''

                            warehouse_str = row_data.pop('warehouse', None)
                            target_warehouse_id = int(warehouse_id) if warehouse_id else None
                            
                            if warehouse_str:
                                wh_str = str(warehouse_str).strip()
                                wh = Warehouse.objects.filter(Q(name__iexact=wh_str) | Q(code__iexact=wh_str)).first()
                                if wh:
                                    target_warehouse_id = wh.id
                                else:
                                    failed += 1
                                    err_msg = f"انبار با نام یا کد '{wh_str}' یافت نشد."
                                    error_details.append({"row": row_idx, "code": fa_unic_code, "error": err_msg})
                                    append_colored_row(row, 'err', err_msg)
                                    q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا در {fa_unic_code}: {err_msg}"}) + "\n")
                                    continue

                            # Extract dynamic data
                            dynamic_data_updates = {}
                            if target_warehouse_id:
                                for d_key in dynamic_fields_keys:
                                    if d_key in row_data and row_data[d_key] is not None:
                                        dynamic_data_updates[d_key] = row_data.pop(d_key)

                            defaults = {k: v for k, v in row_data.items() if k != 'fa_unic_code' and v is not None}
                            if target_warehouse_id: defaults['warehouse_id'] = target_warehouse_id
                            if user_id: defaults['modified_by_id'] = user_id
                            
                            existing_item = None
                            if item_id:
                                try:
                                    clean_id = int(float(item_id))
                                except ValueError:
                                    clean_id = item_id
                                    
                                existing_item = Item.objects.filter(id=clean_id).first()
                                
                                # Check if ID points to a different fa_unic_code
                                if existing_item and fa_unic_code:
                                    db_code = str(existing_item.fa_unic_code).strip() if existing_item.fa_unic_code else ""
                                    if db_code and db_code != fa_unic_code:
                                        failed += 1
                                        err_msg = f"مغایرت شناسه: کالا با id={clean_id} دارای کد {db_code} است ولی اکسل کد {fa_unic_code} را ارسال کرده است."
                                        error_details.append({"row": row_idx, "code": fa_unic_code, "error": err_msg})
                                        append_colored_row(row, 'err', err_msg)
                                        q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا: {err_msg}"}) + "\n")
                                        continue
                            
                            if not existing_item and fa_unic_code and target_warehouse_id:
                                existing_item = Item.objects.filter(fa_unic_code=fa_unic_code, warehouse_id=target_warehouse_id).first()
                                # Check if fa_unic_code points to a different ID
                                if existing_item and item_id:
                                    if str(existing_item.id) != str(item_id).split('.')[0]: # split to handle '1.0'
                                        failed += 1
                                        err_msg = f"مغایرت شناسه: کد {fa_unic_code} متعلق به id={existing_item.id} است ولی اکسل id={item_id} را ارسال کرده است."
                                        error_details.append({"row": row_idx, "code": fa_unic_code, "error": err_msg})
                                        append_colored_row(row, 'err', err_msg)
                                        q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا: {err_msg}"}) + "\n")
                                        continue
                                
                            # رکورد حذف‌نرم با همین کد؟ (unique_together هنوز فعال است)
                            # → باید احیا شود، وگرنه INSERT خطای دیتابیس می‌دهد.
                            resurrect_tombstone = None
                            if not existing_item and fa_unic_code and target_warehouse_id:
                                resurrect_tombstone = Item.all_objects.filter(
                                    fa_unic_code=fa_unic_code,
                                    warehouse_id=target_warehouse_id,
                                    is_deleted=True,
                                ).first()

                            item_display_code = fa_unic_code or f"ID:{item_id}"
                            
                            # Build merged dynamic_data for this item if needed
                            final_dynamic_data = {}
                            if existing_item and existing_item.dynamic_data:
                                final_dynamic_data = existing_item.dynamic_data.copy()
                            if dynamic_data_updates:
                                final_dynamic_data.update(dynamic_data_updates)
                            
                            if final_dynamic_data:
                                defaults['dynamic_data'] = final_dynamic_data
                                
                            if resurrect_tombstone:
                                # احیای رکورد حذف‌نرم: از دید کاربر «رکورد جدید» است،
                                # اما ردیف قبلی (با همان sync_id) به‌روزرسانی و زنده می‌شود.
                                from django.core.serializers.json import DjangoJSONEncoder
                                old_state = model_to_dict(resurrect_tombstone)
                                old_state_json = json.loads(json.dumps(old_state, cls=DjangoJSONEncoder))

                                if user_id: defaults['created_by_id'] = user_id
                                if 'tag_status' not in defaults:
                                    defaults['tag_status'] = sys_tag_status
                                Item.all_objects.filter(id=resurrect_tombstone.id).update(
                                    fa_unic_code=fa_unic_code,
                                    is_deleted=False,
                                    updated_at=timezone.now(),
                                    **defaults,
                                )
                                history_records.append(ImportHistory(item=resurrect_tombstone, action='update', previous_state=old_state_json))

                                created += 1
                                append_colored_row(row, 'created', 'ثبت رکورد جدید (احیای رکورد حذف‌شده)')
                                q.put(json.dumps({"type": "created", "msg": f"[ردیف {row_idx}] ثبت رکورد جدید (احیا): {fa_unic_code}"}) + "\n")
                            elif existing_item:
                                # Append new tags to existing item's tags
                                if existing_item.my_tag:
                                    existing_tags = [t.strip() for t in existing_item.my_tag.split('،') if t.strip()]
                                    new_tags = [t.strip() for t in defaults.get('my_tag', '').split('،') if t.strip()]
                                    combined_tags = list(set(existing_tags + new_tags))
                                    defaults['my_tag'] = '،'.join(combined_tags) if combined_tags else ''

                                if conflict_strategy == 'ignore':
                                    skipped += 1
                                    append_colored_row(row, 'warn', 'نادیده گرفتن رکورد تکراری')
                                    q.put(json.dumps({"type": "warn", "msg": f"[ردیف {row_idx}] نادیده گرفتن رکورد تکراری: {item_display_code}"}) + "\n")
                                    continue
                                elif conflict_strategy == 'log':
                                    error_details.append({"row": row_idx, "code": item_display_code, "error": "تداخل رکورد (ثبت در لاگ)"})
                                    skipped += 1
                                    append_colored_row(row, 'warn', 'تداخل رکورد (ثبت در لاگ)')
                                    q.put(json.dumps({"type": "warn", "msg": f"[ردیف {row_idx}] تداخل رکورد: {item_display_code}"}) + "\n")
                                    continue
                                elif conflict_strategy == 'update_empty':
                                    new_defaults = {k: v for k, v in defaults.items() if not getattr(existing_item, k) and v not in [None, '']}
                                    # Always update fa_unic_code if empty
                                    if fa_unic_code and not existing_item.fa_unic_code:
                                        new_defaults['fa_unic_code'] = fa_unic_code
                                    # Always update tag since we append them
                                    if defaults.get('my_tag') and defaults.get('my_tag') != existing_item.my_tag:
                                        new_defaults['my_tag'] = defaults['my_tag']
                                        
                                    if new_defaults:
                                        from django.core.serializers.json import DjangoJSONEncoder
                                        old_state = model_to_dict(existing_item)
                                        old_state_json = json.loads(json.dumps(old_state, cls=DjangoJSONEncoder))
                                        
                                        Item.objects.filter(id=existing_item.id).update(**{**new_defaults, 'updated_at': timezone.now()})
                                        history_records.append(ImportHistory(item=existing_item, action='update', previous_state=old_state_json))
                                        
                                        updated += 1
                                        append_colored_row(row, 'updated', 'تکمیل نواقص رکورد')
                                        q.put(json.dumps({"type": "updated", "msg": f"[ردیف {row_idx}] تکمیل نواقص رکورد: {item_display_code}"}) + "\n")
                                    else:
                                        skipped += 1
                                        append_colored_row(row, 'warn', 'بدون نقص، نادیده گرفته شد')
                                        q.put(json.dumps({"type": "warn", "msg": f"[ردیف {row_idx}] بدون نقص، نادیده گرفته شد: {item_display_code}"}) + "\n")
                                elif conflict_strategy == 'replace':
                                    if fa_unic_code: defaults['fa_unic_code'] = fa_unic_code
                                    
                                    from django.core.serializers.json import DjangoJSONEncoder
                                    old_state = model_to_dict(existing_item)
                                    old_state_json = json.loads(json.dumps(old_state, cls=DjangoJSONEncoder))
                                    
                                    Item.objects.filter(id=existing_item.id).update(**{**defaults, 'updated_at': timezone.now()})
                                    history_records.append(ImportHistory(item=existing_item, action='update', previous_state=old_state_json))
                                    
                                    updated += 1
                                    append_colored_row(row, 'updated', 'بروزرسانی کامل رکورد')
                                    q.put(json.dumps({"type": "updated", "msg": f"[ردیف {row_idx}] بروزرسانی رکورد: {item_display_code}"}) + "\n")
                            else:
                                if not target_warehouse_id:
                                    failed += 1
                                    err_msg = "بدون انبار امکان ساخت رکورد جدید نیست"
                                    error_details.append({"row": row_idx, "code": item_display_code, "error": err_msg})
                                    append_colored_row(row, 'err', err_msg)
                                    q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا در {item_display_code}: {err_msg}"}) + "\n")
                                    continue
                                    
                                if not fa_unic_code:
                                    failed += 1
                                    err_msg = "برای ساخت رکورد جدید، کد یکتا (fa_unic_code) الزامی است"
                                    error_details.append({"row": row_idx, "code": "N/A", "error": err_msg})
                                    append_colored_row(row, 'err', err_msg)
                                    q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا: {err_msg}"}) + "\n")
                                    continue
                                    
                                try:
                                    if user_id: defaults['created_by_id'] = user_id
                                    if 'tag_status' not in defaults:
                                        defaults['tag_status'] = sys_tag_status
                                    new_item = Item.objects.create(fa_unic_code=fa_unic_code, **defaults)
                                    history_records.append(ImportHistory(item=new_item, action='create'))
                                    
                                    created += 1
                                    append_colored_row(row, 'created', 'ثبت رکورد جدید')
                                    q.put(json.dumps({"type": "created", "msg": f"[ردیف {row_idx}] ثبت رکورد جدید: {fa_unic_code}"}) + "\n")
                                except Exception as e:
                                    failed += 1
                                    err_msg = str(e)
                                    error_details.append({"row": row_idx, "code": fa_unic_code, "error": err_msg})
                                    append_colored_row(row, 'err', err_msg)
                                    q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا در {fa_unic_code}: {err_msg}"}) + "\n")

                        log_record = ImportLog.objects.create(
                            import_id=import_id,
                            warehouse_id=target_warehouse_id if 'target_warehouse_id' in locals() and target_warehouse_id else None,
                            imported_by_id=user_id,
                            file_name=original_file_name,
                            records_created=created,
                            records_updated=updated,
                            records_skipped=skipped,
                            records_failed=failed,
                            conflict_strategy=conflict_strategy,
                            error_details=error_details
                        )
                        
                        for hr in history_records:
                            hr.import_log = log_record
                        ImportHistory.objects.bulk_create(history_records)

                        # Save the colored log workbook
                        if import_id:
                            out_file_path = os.path.join(tempfile.gettempdir(), f"import_log_{import_id}.xlsx")
                            out_wb.save(out_file_path)

                except Exception as ex:
                    if str(ex) == "CANCELED_BY_USER":
                        q.put(json.dumps({
                            "type": "summary",
                            "status": "cancelled",
                            "created": 0, "updated": 0, "skipped": 0, "failed": 0,
                            "found_fields": [], "missing_fields": [],
                            "error_details": []
                        }) + "\n")
                        return
                    else:
                        raise ex

                q.put(json.dumps({
                    "type": "summary",
                    "status": "success",
                    "created": created,
                    "updated": updated,
                    "skipped": skipped,
                    "failed": failed,
                    "found_fields": list(set(found_fields)),
                    "missing_fields": list(set(missing_fields)),
                    "error_details": error_details
                }) + "\n")
                
            except Exception as e:
                traceback.print_exc()
                q.put(json.dumps({"type": "err", "msg": f">> خطای سیستمی: {str(e)}"}) + "\n")
            finally:
                q.put(None)
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass

        async def stream_logs_async():
            q = queue.Queue()
            thread = threading.Thread(target=worker, args=(q,))
            thread.start()
            
            while True:
                chunk = await asyncio.to_thread(q.get)
                if chunk is None:
                    break
                yield chunk

        response = StreamingHttpResponse(
            stream_logs_async(), 
            content_type='application/x-ndjson'
        )
        response['X-Accel-Buffering'] = 'no'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    @action(detail=False, methods=['post'])
    def revert_import(self, request):
        import_id = request.data.get('import_id')
        if not import_id:
            return Response({'error': 'شناسه فرآیند الزامی است.'}, status=400)
            
        try:
            import_log = ImportLog.objects.get(import_id=import_id)
        except ImportLog.DoesNotExist:
            return Response({'error': 'فرآیندی با این شناسه یافت نشد.'}, status=404)
            
        if import_log.is_reverted:
            return Response({'error': 'این فرآیند قبلاً بازگردانی شده است.'}, status=400)
            
        time_elapsed = (timezone.now() - import_log.imported_at).total_seconds()
        if time_elapsed > 900: # 15 minutes
            return Response({'error': 'مهلت ۱۵ دقیقه‌ای برای بازگردانی این فرآیند به پایان رسیده است.'}, status=400)
            
        try:
            with transaction.atomic():
                histories = import_log.histories.all()
                items_to_create = []
                for history in histories:
                    if history.action == 'create':
                        if history.item:
                            # بازگردانی ایجاد = حذف (نرم) رکورد ساخته‌شده
                            _soft_delete_items_cascade(Item.objects.filter(id=history.item_id))
                    elif history.action == 'update' or history.action == 'delete':
                        if history.previous_state:
                            state = history.previous_state.copy()

                            # Handle foreign keys correctly for both update and create
                            fk_fields = ['warehouse', 'created_by', 'modified_by']
                            for fk in fk_fields:
                                if fk in state and isinstance(state[fk], int):
                                    state[f'{fk}_id'] = state.pop(fk)

                            if history.action == 'update' and history.item:
                                # بامپ updated_at تا کلاینت‌های سینک مقادیر بازگردانی‌شده را بگیرند
                                Item.all_objects.filter(id=history.item.id).update(**{**state, 'updated_at': timezone.now()})
                            elif history.action == 'delete':
                                # حذف حالا نرم است؛ ردیف tombstone هنوز با همه داده‌ها موجود است
                                # → فقط احیا می‌شود. اگر (به هر دلیل) واقعاً حذف شده بود، بازسازی.
                                restored = Item.all_objects.filter(
                                    warehouse_id=state.get('warehouse_id'),
                                    fa_unic_code=state.get('fa_unic_code'),
                                    is_deleted=True,
                                ).update(is_deleted=False, updated_at=timezone.now())
                                if not restored:
                                    items_to_create.append(Item(**state))
                
                if items_to_create:
                    Item.objects.bulk_create(items_to_create, ignore_conflicts=True)
                            
                import_log.is_reverted = True
                import_log.save()
                
            return Response({'status': 'success', 'msg': 'فرآیند با موفقیت بازگردانی شد.', 'affected_records': len(histories)})
        except Exception as e:
            return Response({'error': f'خطا در بازگردانی: {str(e)}'}, status=500)

    @action(detail=False, methods=['post'])
    def clear_warehouse_data(self, request):
        warehouse_id = request.data.get('warehouse_id')
        if not warehouse_id:
            return Response({'error': 'شناسه انبار الزامی است.'}, status=400)
            
        try:
            items_deleted = 0
            user_id = request.user.id if request.user.is_authenticated else None
            import_id = f"clear_{datetime.now().strftime('%Y%m%d%H%M%S')}_{warehouse_id}"
            
            with transaction.atomic():
                import_log = ImportLog.objects.create(
                    import_id=import_id,
                    warehouse_id=warehouse_id,
                    imported_by_id=user_id,
                    file_name="حذف تمامی داده‌های انبار"
                )
                
                items_qs = Item.objects.filter(warehouse_id=warehouse_id)
                
                # We need to bulk read the items to save them
                from django.core.serializers.json import DjangoJSONEncoder
                histories = []
                for item in items_qs.iterator(chunk_size=1000):
                    state = model_to_dict(item)
                    state = json.loads(json.dumps(state, cls=DjangoJSONEncoder))
                    
                    histories.append(ImportHistory(
                        import_log=import_log,
                        item=None, 
                        action='delete',
                        previous_state=state
                    ))
                
                if histories:
                    ImportHistory.objects.bulk_create(histories)
                    
                deleted = _soft_delete_items_cascade(items_qs)
                items_deleted = deleted
                
                import_log.records_created = items_deleted # Store count here
                import_log.save()
                
            return Response({'status': 'success', 'msg': f'{items_deleted} رکورد با موفقیت حذف شدند.', 'import_id': import_id})
        except Exception as e:
            return Response({'error': f'خطا در حذف داده‌ها: {str(e)}'}, status=500)

    @action(detail=False, methods=['get'])
    def latest_import(self, request):
        warehouse_id = request.query_params.get('warehouse_id')
        if not warehouse_id:
            return Response({'error': 'شناسه انبار الزامی است.'}, status=400)
            
        try:
            logs = ImportLog.objects.filter(warehouse_id=warehouse_id, is_reverted=False).order_by('-imported_at')[:10]
            
            recent_imports = []
            for log in logs:
                time_elapsed = (timezone.now() - log.imported_at).total_seconds()
                if time_elapsed <= 900:
                    recent_imports.append({
                        'import_id': log.import_id,
                        'file_name': log.file_name,
                        'imported_at': log.imported_at.isoformat(),
                        'time_remaining_seconds': 900 - int(time_elapsed),
                        'records_affected': log.records_created + log.records_updated
                    })
                
            return Response({
                'latest_import': recent_imports[0] if recent_imports else None,
                'recent_imports': recent_imports
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def delete_from_excel(self, request):
        warehouse_id = request.data.get('warehouse_id')
        file_obj = request.FILES.get('file')
        
        if not warehouse_id or not file_obj:
            return Response({'error': 'پارامترهای warehouse_id و file الزامی است.'}, status=400)
            
        try:
            wb = openpyxl.load_workbook(file_obj, data_only=True)
            sheet = wb.active
            headers = [str(cell.value).strip() if cell.value else '' for cell in sheet[1]]
            
            id_idx = headers.index('id') if 'id' in headers else None
            fa_unic_idx = headers.index('fa_unic_code') if 'fa_unic_code' in headers else None
            
            if id_idx is None and fa_unic_idx is None:
                return Response({'error': 'ستون fa_unic_code یا id در فایل اکسل یافت نشد.'}, status=400)
                
            ids_to_delete = []
            fa_unics_to_delete = []
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                id_val = row[id_idx] if id_idx is not None else None
                fa_val = row[fa_unic_idx] if fa_unic_idx is not None else None
                
                if id_val:
                    ids_to_delete.append(str(id_val).strip())
                elif fa_val:
                    fa_unics_to_delete.append(str(fa_val).strip())
                    
            if not ids_to_delete and not fa_unics_to_delete:
                return Response({'error': 'هیچ شناسه یا کدی در فایل یافت نشد.'}, status=400)
                
            items_deleted = 0
            user_id = request.user.id if request.user.is_authenticated else None
            import_id = f"del_{datetime.now().strftime('%Y%m%d%H%M%S')}_{warehouse_id}"
            
            with transaction.atomic():
                import_log = ImportLog.objects.create(
                    import_id=import_id,
                    warehouse_id=warehouse_id,
                    imported_by_id=user_id,
                    file_name=f"حذف گروهی (اکسل): {file_obj.name}"
                )
                
                query = Q()
                if ids_to_delete:
                    query |= Q(id__in=ids_to_delete)
                if fa_unics_to_delete:
                    query |= Q(fa_unic_code__in=fa_unics_to_delete)
                    
                items_qs = Item.objects.filter(Q(warehouse_id=warehouse_id) & query)
                
                # We need to bulk read the items to save them
                from django.core.serializers.json import DjangoJSONEncoder
                histories = []
                for item in items_qs.iterator(chunk_size=1000):
                    # For delete action, item foreign key might be nullified when item is deleted. 
                    # We store it anyway.
                    state = model_to_dict(item)
                    state = json.loads(json.dumps(state, cls=DjangoJSONEncoder))
                    
                    histories.append(ImportHistory(
                        import_log=import_log,
                        item=None, # item will be deleted, don't set foreign key
                        action='delete',
                        previous_state=state
                    ))
                
                if histories:
                    ImportHistory.objects.bulk_create(histories)
                    
                deleted = _soft_delete_items_cascade(items_qs)
                items_deleted = deleted
                
                import_log.records_created = items_deleted # Store count in this field for history
                import_log.save()
                
            return Response({'status': 'success', 'msg': f'{items_deleted} رکورد با موفقیت از انبار حذف شدند.', 'import_id': import_id})
        except Exception as e:
            return Response({'error': f'خطا در پردازش فایل: {str(e)}'}, status=500)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        import jdatetime
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Q
        
        project_id = request.query_params.get('project_id')
        items = Item.objects.all()
        if project_id and project_id != 'ALL':
            items = items.filter(warehouse_id=project_id)
            
        now = timezone.localtime(timezone.now()) if timezone.is_aware(timezone.now()) else timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Overall
        total_quantity = items.count()
        total_counted = items.exclude(field_status__in=['waiting', 'counting', 'در انتظار شمارش']).count()
        printed_tags = items.filter(tag_status__in=['printed', 'reprint', 'چاپ شده', 'چاپ مجدد']).count()
        docs_approved = items.filter(doc_status='done').count()
        conflicts = items.filter(Q(has_conflict=True) | Q(field_status='recount')).count()
        done = items.filter(field_status='done', doc_status='done').count()
        
        # Days stats (last 7 days)
        weekly_data = []
        
        for i in range(6, -1, -1):
            d_start = today_start - timedelta(days=i)
            d_end = d_start + timedelta(days=1)
            
            day_items = items.filter(updated_at__gte=d_start, updated_at__lt=d_end)
            
            c_count = day_items.exclude(field_status__in=['waiting', 'counting', 'در انتظار شمارش']).count()
            c_docs = day_items.filter(doc_status='done').count()
            c_feed = day_items.filter(field_status='done', doc_status='done').count()
            
            jdt = jdatetime.datetime.fromgregorian(datetime=d_start)
            day_label = 'امروز' if i == 0 else ('دیروز' if i == 1 else jdt.strftime('%A'))
            
            weekly_data.append({
                'day': day_label,
                'count': c_count,
                'docs': c_docs,
                'feed': c_feed
            })
            
        today_stats = weekly_data[-1]
        yesterday_stats = weekly_data[-2]
        
        last_7_days_count = sum(d['count'] for d in weekly_data)
        last_7_days_docs = sum(d['docs'] for d in weekly_data)
        last_7_days_feed = sum(d['feed'] for d in weekly_data)
        
        max_val = max([max(d['count'], d['docs'], d['feed']) for d in weekly_data] + [10])
        
        return Response({
            'overall': {
                'total': total_quantity,
                'counted': total_counted,
                'printed': printed_tags,
                'docs_approved': docs_approved,
                'conflicts': conflicts,
                'done': done,
                'ready_to_feed': max(0, total_counted - done)
            },
            'today': today_stats,
            'yesterday': yesterday_stats,
            'last_week_totals': {
                'count': last_7_days_count,
                'docs': last_7_days_docs,
                'feed': last_7_days_feed
            },
            'weekly_data': weekly_data,
            'overallMax': max_val
        })

from .serializers import CountTaskSerializer
from .models import CountTask
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

class CountTaskViewSet(viewsets.ModelViewSet):
    serializer_class = CountTaskSerializer

    def get_permissions(self):
        from accounts.permissions import HasMenuAccess
        from rest_framework.permissions import IsAuthenticated
        
        if self.action in ['list', 'retrieve', 'pool_tasks', 'claim_tasks', 'get_export_columns', 'export_excel']:
            permission_classes = [HasMenuAccess('view_sys_counter') | HasMenuAccess('view_sys_supervisor') | HasMenuAccess('view_sys_manager_review') | HasMenuAccess('view_sys_recounts')]
        elif self.action == 'bulk_submit':
            permission_classes = [HasMenuAccess('view_sys_counter')]
        elif self.action == 'bulk_approve':
            permission_classes = [HasMenuAccess('view_sys_supervisor')]
        elif self.action in ['reject', 'bulk_reject']:
            permission_classes = [HasMenuAccess('perm_rec_recount') | HasMenuAccess('view_sys_supervisor') | HasMenuAccess('view_sys_manager_review')]
        elif self.action in ['manager_reject', 'bulk_manager_reject']:
            permission_classes = [HasMenuAccess('perm_rec_recount') | HasMenuAccess('view_sys_manager_review')]
        elif self.action in ['bulk_manager_approve', 'bulk_cancel']:
            permission_classes = [HasMenuAccess('view_sys_manager_review')]
        else: # create, update, etc
            permission_classes = [IsAuthenticated()]
            
        return permission_classes

    def perform_destroy(self, instance):
        # حذف نرم + tombstone تاریخچه، تا کلاینت‌های آفلاین باخبر شوند
        with transaction.atomic():
            soft_delete_queryset(CountTaskHistory.objects.filter(task_id=instance.id))
            instance.soft_delete()

    def get_object(self):
        """
        زیرساخت سینک: اگر pk عددی نبود، به‌عنوان sync_id تفسیر می‌شود
        (کلاینت آفلاین ممکن است فقط sync_id پایدار را داشته باشد).
        """
        pk = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        if pk is not None and not str(pk).isdigit():
            from django.shortcuts import get_object_or_404
            queryset = self.filter_queryset(self.get_queryset())
            obj = get_object_or_404(queryset, sync_id=pk)
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def update(self, request, *args, **kwargs):
        """
        تشخیص تداخل خوش‌بینانه: کلاینت می‌تواند base_updated_at (نسخه‌ای که
        رویش تغییر داده) بفرستد؛ اگر سرور جدیدتر باشد → 409 + رکورد سروری
        برای reconciliation سمت کلاینت. بدون این پارامتر، رفتار قبلی حفظ است.
        """
        base_raw = request.data.get('base_updated_at')
        if base_raw:
            from django.utils.dateparse import parse_datetime
            base = parse_datetime(str(base_raw))
            if base is None:
                return Response({'detail': 'base_updated_at نامعتبر است.'}, status=400)
            if timezone.is_naive(base):
                base = timezone.make_aware(base)
            instance = self.get_object()
            # تلورانس ۱ms برای جلوگیری از تداخل کاذب ناشی از گرد شدن میکروثانیه
            if (instance.updated_at - base).total_seconds() > 0.001:
                return Response({
                    'detail': 'conflict',
                    'server_record': self.get_serializer(instance).data,
                }, status=409)
        return super().update(request, *args, **kwargs)

    def get_queryset(self):
        user = self.request.user
        queryset = CountTask.objects.all().select_related('item', 'counter', 'supervisor', 'created_by', 'modified_by')
        
        as_role = self.request.query_params.get('as_role')
        warehouse_id = self.request.query_params.get('warehouse_id')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
        
        if as_role == 'counter':
            return queryset.filter(counter=user)
        elif as_role == 'supervisor':
            return queryset.filter(supervisor=user)
        elif as_role == 'manager':
            from django.db.models import Q
            queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True))
        elif as_role == 'tracking':
            # بازگرداندن همه موارد در حال شمارش برای پیگیری
            show_completed = self.request.query_params.get('show_completed', 'false').lower() == 'true'
            if not show_completed:
                queryset = queryset.exclude(status='FINAL_APPROVED')
        else:
            # Fallback to permission checking if as_role is not provided
            if user.is_superuser or user.has_perm('accounts.view_sys_manager_review') or user.has_perm('accounts.can_act_as_manager') or user.has_perm('inventory.can_act_as_manager'):
                from django.db.models import Q
                queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True))
            elif user.has_perm('accounts.view_sys_supervisor') or user.has_perm('accounts.can_act_as_supervisor') or user.has_perm('inventory.can_act_as_supervisor'):
                queryset = queryset.filter(supervisor=user)
            elif user.has_perm('accounts.view_sys_counter') or user.has_perm('accounts.can_act_as_counter') or user.has_perm('inventory.can_act_as_counter'):
                queryset = queryset.filter(counter=user)
            else:
                queryset = CountTask.objects.none()
            
        return queryset

    @action(detail=False, methods=['get'])
    def pool_tasks(self, request):
        as_role = request.query_params.get('as_role')
        warehouse_id = request.query_params.get('warehouse_id')
        queryset = CountTask.objects.all().select_related('item', 'counter', 'supervisor', 'created_by', 'modified_by')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
            
        if as_role == 'counter':
            queryset = queryset.filter(counter__isnull=True, status='PENDING_COUNT')
        elif as_role == 'supervisor':
            queryset = queryset.filter(supervisor__isnull=True, status='COUNTED')
        elif as_role == 'manager':
            queryset = queryset.filter(assigned_manager__isnull=True, status='MANAGER_REVIEW')
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def claim_tasks(self, request):
        task_ids = request.data.get('task_ids', [])
        as_role = request.data.get('as_role')

        if not task_ids or not as_role:
            return Response({'error': 'شناسه تسک‌ها یا نقش ارسال نشده است.'}, status=400)

        tasks = CountTask.objects.filter(id__in=task_ids)

        if as_role == 'counter':
            tasks = tasks.filter(counter__isnull=True, status='PENDING_COUNT')
            # Fetch valid IDs to update Items as well
            valid_task_ids = list(tasks.values_list('id', flat=True))
            if not valid_task_ids:
                broadcast_count_task_update()
                return Response({'success': False, 'claimed_count': 0, 'message': 'این کالا(ها) قبلاً توسط انبارگردان دیگری بر عهده گرفته شده است.'})

            from .models import Item
            item_ids = list(CountTask.objects.filter(id__in=valid_task_ids).values_list('item_id', flat=True))

            # Update CountTasks
            updated = CountTask.objects.filter(id__in=valid_task_ids).update(counter=request.user, updated_at=timezone.now())

            # Update Item field_assignee
            assignee_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            Item.objects.filter(id__in=item_ids).update(field_assignee=assignee_name, updated_at=timezone.now())

        elif as_role == 'supervisor':
            tasks = tasks.filter(supervisor__isnull=True, status='COUNTED')
            updated = tasks.update(supervisor=request.user)
        elif as_role == 'manager':
            tasks = tasks.filter(assigned_manager__isnull=True, status='MANAGER_REVIEW')
            updated = tasks.update(assigned_manager=request.user)
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)

        broadcast_count_task_update()
        return Response({'success': True, 'claimed_count': updated})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, modified_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)
        
        updated_instance = serializer.save(modified_by=self.request.user)
        
        if old_status != new_status:
            from .models import CountTaskHistory
            
            note = ''
            if new_status in ['MANAGER_REJECTED', 'FINAL_APPROVED']:
                note = updated_instance.manager_note
            elif new_status == 'SUPERVISOR_REJECTED':
                note = updated_instance.supervisor_note
            elif new_status in ['COUNTED', 'INITIAL_COUNT']:
                note = updated_instance.counter_note
                
            CountTaskHistory.objects.create(
                task=updated_instance,
                action_by=self.request.user,
                action_type=new_status,
                counted_balance=updated_instance.counted_balance,
                note=note
            )

    @action(detail=False, methods=['post'])
    def bulk_submit(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        sync_ids = request.data.get('sync_ids', [])
        warehouse_id = request.data.get('warehouse_id') or request.query_params.get('warehouse_id')

        # کلاینت آفلاین ممکن است فقط sync_id پایدار را داشته باشد
        if sync_ids:
            task_ids = list(set(task_ids) | set(
                CountTask.objects.filter(sync_id__in=sync_ids).values_list('id', flat=True)
            ))

        if task_ids:
            tasks = CountTask.objects.filter(id__in=task_ids, counter=user, status__in=['PENDING_COUNT', 'INITIAL_COUNT', 'SUPERVISOR_REJECTED', 'MANAGER_REJECTED'], counted_balance__isnull=False)
        else:
            tasks = CountTask.objects.filter(counter=user, status__in=['PENDING_COUNT', 'INITIAL_COUNT', 'SUPERVISOR_REJECTED', 'MANAGER_REJECTED'], counted_balance__isnull=False)

        if warehouse_id and str(warehouse_id) not in ['ALL', '-1']:
            tasks = tasks.filter(item__warehouse_id=warehouse_id)

        first_task = tasks.first()
        if not first_task:
            # Idempotency: اگر تسک‌های درخواستی قبلاً ارسال شده‌اند (مثلاً retry صف
            # آفلاین پس از گم شدن پاسخ در تونل)، موفقیت no-op برگردان نه ابهام.
            if task_ids:
                already = CountTask.objects.filter(
                    id__in=task_ids, counter=user,
                    status__in=['COUNTED', 'MANAGER_REVIEW', 'FINAL_APPROVED'],
                ).count()
                if already > 0:
                    return Response({
                        'message': f'{already} مورد قبلاً ارسال شده بود.',
                        'already_submitted': already,
                    })
            return Response({'message': 'هیچ موردی برای ارسال یافت نشد.'})
            
        from warehouses.services import get_setting
        wh_setting_cache = {}

        def get_warehouse_req_sup(wh_id):
            if wh_id not in wh_setting_cache:
                wh_setting_cache[wh_id] = get_setting('require_supervisor_approval', wh_id)
            return wh_setting_cache[wh_id]
        
        from .models import CountTaskHistory
        histories = []
        tasks_list = list(tasks)
        counted_count = 0
        manager_count = 0
        for task in tasks_list:
            wh_id = task.item.warehouse_id if task.item else None
            req_sup_app = get_warehouse_req_sup(wh_id)
            task_req_sup = req_sup_app and not task.skip_supervisor
            target_status = 'COUNTED' if task_req_sup else 'MANAGER_REVIEW'
            if target_status == 'COUNTED':
                counted_count += 1
            else:
                manager_count += 1
            histories.append(CountTaskHistory(
                task=task,
                action_by=user,
                action_type=target_status,
                counted_balance=task.counted_balance,
                note=task.counter_note
            ))
            task.status = target_status
            task.modified_by = user
            task.updated_at = timezone.now()  # bulk_update سیگنال auto_now را رد می‌کند

        count = len(tasks_list)
        if count > 0:
            CountTask.objects.bulk_update(tasks_list, ['status', 'modified_by', 'updated_at'])
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
        if counted_count > 0 and manager_count > 0:
            msg = f'{count} مورد ارسال شد ({counted_count} مورد به سرپرست و {manager_count} مورد مستقیم به مدیر).'
        elif counted_count > 0:
            msg = f'{count} مورد به سرپرست ارسال شد.'
        else:
            msg = f'{count} مورد مستقیماً به مدیر ارسال شد.'
        broadcast_count_task_update()
        return Response({'message': msg})

    @action(detail=False, methods=['post'])
    def bulk_approve(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ موردی انتخاب نشده است.'}, status=400)
            
        tasks = CountTask.objects.filter(id__in=task_ids, supervisor=user, status__in=['COUNTED', 'MANAGER_REJECTED'])
        
        note = request.data.get('note', '')
        
        from .models import CountTaskHistory
        histories = []
        for task in tasks:
            task.supervisor_note = note
            histories.append(CountTaskHistory(
                task=task,
                action_by=user,
                action_type='MANAGER_REVIEW',
                counted_balance=task.counted_balance,
                note=note
            ))
            
        count = tasks.update(status='MANAGER_REVIEW', supervisor_note=note, modified_by=user, updated_at=timezone.now())
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
        broadcast_count_task_update()
        return Response({'message': f'{count} مورد تایید و برای مدیر ارسال شد.'})

    @action(detail=False, methods=['post'])
    def bulk_manager_approve(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        
        if not task_ids:
            return Response({'error': 'هیچ موردی انتخاب نشده است.'}, status=400)
            
        tasks = CountTask.objects.filter(id__in=task_ids, status='MANAGER_REVIEW').select_related('item')
        
        from .models import CountTaskHistory
        from django.db import transaction
        
        with transaction.atomic():
            histories = []
            items_to_update = []
            
            for task in tasks:
                task.manager_note = note
                histories.append(CountTaskHistory(
                    task=task,
                    action_by=user,
                    action_type='FINAL_APPROVED',
                    counted_balance=task.counted_balance,
                    note=note
                ))
                
                # بروزرسانی کالای اصلی پس از تایید نهایی
                item = task.item
                item.field_status = 'done'
                if task.counted_balance is not None:
                    # بررسی مغایرت (اصلاح ۱۰)
                    if str(task.counted_balance) != str(item.bal4miv):
                        item.has_conflict = True
                    item.inventory = task.counted_balance
                item.modified_by = user
                item.updated_at = timezone.now()
                items_to_update.append(item)
            
            count = tasks.update(status='FINAL_APPROVED', manager_note=note, modified_by=user, updated_at=timezone.now())
            
            if items_to_update:
                Item.objects.bulk_update(items_to_update, ['field_status', 'inventory', 'has_conflict', 'modified_by', 'updated_at'])
            
            if histories:
                CountTaskHistory.objects.bulk_create(histories)
            
        broadcast_count_task_update()
        return Response({'message': f'{count} مورد به صورت گروهی تایید نهایی شد.'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        task = self.get_object()
        note = request.data.get('note', '')
        
        if task.status not in ['COUNTED', 'MANAGER_REJECTED']:
            return Response({'error': 'فقط موارد شمرده شده قابل رد هستند.'}, status=400)
            
        task.status = 'SUPERVISOR_REJECTED'
        task.supervisor_note = note
        task.modified_by = request.user
        task.save()
        
        from .models import CountTaskHistory
        CountTaskHistory.objects.create(
            task=task,
            action_by=request.user,
            action_type='SUPERVISOR_REJECTED',
            counted_balance=task.counted_balance,
            note=note
        )
        
        broadcast_count_task_update()
        return Response({'message': 'مورد با موفقیت رد شد و به شمارشگر ارجاع داده شد.'})

    @action(detail=True, methods=['post'])
    def manager_reject(self, request, pk=None):
        """رد توسط مدیر — بسته به تنظیم سرپرست، به سرپرست یا انبارگردان برمی‌گردد"""
        task = self.get_object()
        note = request.data.get('note', '')
        
        if not note.strip():
            return Response({'error': 'لطفاً علت بازشماری را بنویسید.'}, status=400)
        
        if task.status != 'MANAGER_REVIEW':
            return Response({'error': 'فقط موارد در انتظار تایید مدیر قابل رد هستند.'}, status=400)
        
        from warehouses.services import get_setting
        
        # بسته به تنظیم سرپرست، تعیین مقصد
        req_supervisor = get_setting('require_supervisor_approval', task.item.warehouse_id)
        
        if req_supervisor and task.supervisor:
            # ارسال به سرپرست
            target_status = 'MANAGER_REJECTED'
            target_msg = 'مورد برای بازشماری به سرپرست ارجاع شد.'
        else:
            # ارسال مستقیم به انبارگردان
            target_status = 'PENDING_COUNT'
            target_msg = 'مورد برای بازشماری مستقیماً به انبارگردان ارجاع شد.'
        
        task.status = target_status
        task.manager_note = note
        task.counted_balance = None  # پاک کردن مقدار قبلی برای شمارش مجدد
        task.modified_by = request.user
        task.save()
        
        from .models import CountTaskHistory
        CountTaskHistory.objects.create(
            task=task,
            action_by=request.user,
            action_type='MANAGER_REJECTED',
            counted_balance=task.counted_balance,
            note=note
        )
        
        broadcast_count_task_update()
        return Response({'message': target_msg})

    @action(detail=False, methods=['post'])
    def bulk_reject(self, request):
        """رد گروهی توسط سرپرست و ارجاع به شمارشگر"""
        user = request.user
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        
        if not task_ids:
            return Response({'error': 'هیچ موردی انتخاب نشده است.'}, status=400)
            
        tasks = CountTask.objects.filter(id__in=task_ids, supervisor=user, status__in=['COUNTED', 'MANAGER_REJECTED'])
        
        from .models import CountTaskHistory
        histories = []
        tasks_list = list(tasks)
        for task in tasks_list:
            task.supervisor_note = note
            task.status = 'SUPERVISOR_REJECTED'
            task.modified_by = user
            task.updated_at = timezone.now()
            histories.append(CountTaskHistory(
                task=task,
                action_by=user,
                action_type='SUPERVISOR_REJECTED',
                counted_balance=task.counted_balance,
                note=note
            ))
            
        if tasks_list:
            CountTask.objects.bulk_update(tasks_list, ['status', 'supervisor_note', 'modified_by', 'updated_at'])
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
        broadcast_count_task_update()
        return Response({'message': f'{len(tasks_list)} مورد با موفقیت رد شد و به شمارشگر ارجاع داده شد.'})

    @action(detail=False, methods=['post'])
    def bulk_manager_reject(self, request):
        """رد گروهی توسط مدیر — ارجاع به سرپرست یا شمارشگر بر اساس تنظیمات انبار"""
        user = request.user
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        
        if not note.strip():
            return Response({'error': 'لطفاً علت بازشماری را بنویسید.'}, status=400)
            
        if not task_ids:
            return Response({'error': 'هیچ موردی انتخاب نشده است.'}, status=400)
            
        tasks = CountTask.objects.filter(id__in=task_ids, status='MANAGER_REVIEW').select_related('item')
        
        from warehouses.services import get_setting
        from .models import CountTaskHistory
        
        histories = []
        tasks_list = list(tasks)
        for task in tasks_list:
            req_supervisor = get_setting('require_supervisor_approval', task.item.warehouse_id)
            if req_supervisor and task.supervisor:
                target_status = 'MANAGER_REJECTED'
            else:
                target_status = 'PENDING_COUNT'
                
            task.status = target_status
            task.manager_note = note
            task.counted_balance = None
            task.modified_by = user
            task.updated_at = timezone.now()
            
            histories.append(CountTaskHistory(
                task=task,
                action_by=user,
                action_type='MANAGER_REJECTED',
                counted_balance=None,
                note=note
            ))
            
        if tasks_list:
            CountTask.objects.bulk_update(tasks_list, ['status', 'manager_note', 'counted_balance', 'modified_by', 'updated_at'])
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
        broadcast_count_task_update()
        return Response({'message': f'{len(tasks_list)} مورد با موفقیت رد شد و جهت بازشماری ارجاع داده شد.'})

    @action(detail=False, methods=['post'])
    def bulk_cancel(self, request):
        """لغو تخصیص گروهی — رکوردهای PENDING_COUNT و INITIAL_COUNT مجاز هستند."""
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)

        all_tasks = CountTask.objects.filter(id__in=task_ids)
        eligible_tasks = all_tasks.filter(status__in=['PENDING_COUNT', 'INITIAL_COUNT'])
        ineligible_count = all_tasks.count() - eligible_tasks.count()

        if eligible_tasks.count() == 0:
            return Response(
                {'error': 'هیچ‌یک از رکوردهای انتخاب شده قابل لغو تخصیص نیستند. فقط رکوردهای «در انتظار شمارش» و «شمارش اولیه» مجاز هستند.'},
                status=400
            )

        item_ids = list(eligible_tasks.values_list('item_id', flat=True))

        with transaction.atomic():
            # پاک کردن تاریخچه مربوطه به صورت نرم
            soft_delete_queryset(CountTaskHistory.objects.filter(task_id__in=eligible_tasks.values_list('id', flat=True)))
            deleted_count = eligible_tasks.count()
            eligible_tasks.delete()
            # بازگرداندن وضعیت آیتم‌ها
            Item.objects.filter(id__in=item_ids).update(
                field_status='checking',
                field_assignee=None,
                updated_at=timezone.now()
            )

        msg = f'{deleted_count} وظیفه شمارش با موفقیت لغو تخصیص شد.'
        if ineligible_count > 0:
            msg += f' ({ineligible_count} رکورد به دلیل وضعیت نامعتبر نادیده گرفته شد.)'

        broadcast_count_task_update()
        return Response({'message': msg})

    @action(detail=False, methods=['get'], url_path='get_export_columns')
    def get_export_columns(self, request):
        """لیست ستون‌های مجاز برای خروجی اکسل پیگیری شمارش"""
        columns = [
            {'key': 'warehouse_name',    'label': 'نام انبار'},
            {'key': 'fa_unic_code',      'label': 'کد یکتا'},
            {'key': 'description',       'label': 'شرح کالا'},
            {'key': 'counter_name',      'label': 'شمارنده'},
            {'key': 'supervisor_name',   'label': 'سرپرست'},
            {'key': 'manager_name',      'label': 'مدیر'},
            {'key': 'status',            'label': 'وضعیت'},
            {'key': 'counted_balance',   'label': 'موجودی شمارش شده'},
            {'key': 'inventory',         'label': 'موجودی سیستم'},
            {'key': 'difference',        'label': 'اختلاف'},
            {'key': 'created_at',        'label': 'تاریخ ایجاد'},
            {'key': 'updated_at',        'label': 'تاریخ بروزرسانی'},
            {'key': 'counter_note',      'label': 'یادداشت شمارنده'},
            {'key': 'supervisor_note',   'label': 'یادداشت سرپرست'},
            {'key': 'manager_note',      'label': 'یادداشت مدیر'},
        ]
        return Response(columns)

    @action(detail=False, methods=['post'], url_path='export_excel')
    def export_excel(self, request):
        """خروجی اکسل صفحه پیگیری شمارش با تاریخ شمسی و وضعیت فارسی"""
        import openpyxl
        from django.http import HttpResponse

        STATUS_FA = {
            'PENDING_COUNT':      'در انتظار شمارش',
            'INITIAL_COUNT':      'آماده ارسال (پیش‌نویس)',
            'COUNTED':            'شمارش شده (ارسال به سرپرست)',
            'SUPERVISOR_REVIEW':  'در بررسی سرپرست',
            'SUPERVISOR_APPROVED':'تایید سرپرست',
            'SUPERVISOR_REJECTED':'رد شده توسط سرپرست (بازشماری)',
            'MANAGER_REVIEW':     'در بررسی مدیر',
            'MANAGER_REJECTED':   'رد شده توسط مدیر (بازشماری)',
            'FINAL_APPROVED':     'تأیید نهایی',
        }

        def to_jalali(dt):
            if not dt:
                return ''
            try:
                import jdatetime
                from django.utils import timezone
                if timezone.is_aware(dt):
                    dt = timezone.localtime(dt)
                jdt = jdatetime.datetime.fromgregorian(datetime=dt)
                return jdt.strftime('%Y/%m/%d %H:%M')
            except Exception as e:
                # اگر خطایی رخ داد، لاگ بگیریم تا اشکال‌زدایی راحت‌تر باشد
                import logging
                logging.getLogger(__name__).error(f"Date conversion error: {e}")
                return str(dt)

        data_scope    = request.data.get('data_scope', 'all')
        columns_scope = request.data.get('columns_scope', 'all_db')
        columns_list  = request.data.get('columns_list', [])

        # اعمال همان فیلترهای get_queryset
        from django.http import QueryDict
        original_query_params = request._request.GET
        try:
            q = QueryDict(mutable=True)
            for k, v in request.data.items():
                if isinstance(v, list):
                    q.setlist(k, [str(x) for x in v])
                elif v is not None:
                    q[k] = str(v)
            request._request.GET = q

            if data_scope == 'selected':
                selected_ids = request.data.get('selected_ids', [])
                queryset = self.get_queryset().filter(id__in=selected_ids)
            else:
                queryset = self.get_queryset()
        finally:
            request._request.GET = original_query_params

        # ستون‌ها
        ALL_COLUMNS = [
            {'key': 'warehouse_name',    'label': 'نام انبار'},
            {'key': 'fa_unic_code',      'label': 'کد یکتا'},
            {'key': 'description',       'label': 'شرح کالا'},
            {'key': 'counter_name',      'label': 'شمارنده'},
            {'key': 'supervisor_name',   'label': 'سرپرست'},
            {'key': 'manager_name',      'label': 'مدیر'},
            {'key': 'status',            'label': 'وضعیت'},
            {'key': 'counted_balance',   'label': 'موجودی شمارش شده'},
            {'key': 'inventory',         'label': 'موجودی سیستم'},
            {'key': 'difference',        'label': 'اختلاف'},
            {'key': 'created_at',        'label': 'تاریخ ایجاد'},
            {'key': 'updated_at',        'label': 'تاریخ بروزرسانی'},
            {'key': 'counter_note',      'label': 'یادداشت شمارنده'},
            {'key': 'supervisor_note',   'label': 'یادداشت سرپرست'},
            {'key': 'manager_note',      'label': 'یادداشت مدیر'},
        ]
        all_keys = [c['key'] for c in ALL_COLUMNS]
        key_to_label = {c['key']: c['label'] for c in ALL_COLUMNS}

        if columns_scope in ('visible', 'custom') and columns_list:
            selected_keys = [k for k in columns_list if k in all_keys]
            if not selected_keys:
                selected_keys = all_keys
        else:
            selected_keys = all_keys

        # بررسی وضعیت شمارش کور برای هر انبار جهت حفظ محرمانگی داده‌ها
        from warehouses.services import get_setting
        warehouse_blind_cache = {}

        def check_is_blind(task):
            wh_id = task.item.warehouse_id if task.item else None
            if wh_id not in warehouse_blind_cache:
                warehouse_blind_cache[wh_id] = (get_setting('blind_counting', wh_id) == 'blind')
            return warehouse_blind_cache[wh_id]

        def get_cell(task, key):
            if key == 'warehouse_name':
                if task.item and task.item.warehouse:
                    return getattr(task.item.warehouse, 'project_name', None) or task.item.warehouse.name or ''
                return ''
            elif key == 'fa_unic_code':
                return getattr(task.item, 'fa_unic_code', '') if task.item else ''
            elif key == 'description':
                return getattr(task.item, 'description', '') if task.item else ''
            elif key == 'counter_name':
                if task.counter:
                    return f"{task.counter.first_name} {task.counter.last_name}".strip() or task.counter.username
                return ''
            elif key == 'supervisor_name':
                if task.supervisor:
                    return f"{task.supervisor.first_name} {task.supervisor.last_name}".strip() or task.supervisor.username
                return ''
            elif key == 'manager_name':
                if task.assigned_manager:
                    return f"{task.assigned_manager.first_name} {task.assigned_manager.last_name}".strip() or task.assigned_manager.username
                return ''
            elif key == 'status':
                return STATUS_FA.get(task.status, task.status)
            elif key == 'counted_balance':
                return task.counted_balance if task.counted_balance is not None else ''
            elif key == 'inventory':
                if check_is_blind(task):
                    return ''
                inv = getattr(task.item, 'inventory', None) if task.item else None
                if inv is None and task.item:
                    inv = getattr(task.item, 'balance', None) or getattr(task.item, 'bal4miv', '')
                return inv if inv is not None else ''
            elif key == 'difference':
                if check_is_blind(task):
                    return ''
                inv = getattr(task.item, 'inventory', None) if task.item else None
                if inv is None and task.item:
                    inv = getattr(task.item, 'balance', None) or getattr(task.item, 'bal4miv', None)
                cnt = task.counted_balance
                if inv is not None and cnt is not None:
                    try:
                        return float(cnt) - float(inv)
                    except Exception:
                        return ''
                return ''
            elif key == 'created_at':
                return to_jalali(task.created_at)
            elif key == 'updated_at':
                return to_jalali(task.updated_at)
            elif key == 'counter_note':
                return task.counter_note or ''
            elif key == 'supervisor_note':
                return task.supervisor_note or ''
            elif key == 'manager_note':
                return task.manager_note or ''
            return ''

        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'پیگیری شمارش'
        
        # راست‌چین کردن شیت
        ws.sheet_view.rightToLeft = True

        # استایل‌های ثابت
        header_font = Font(name='Tahoma', bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='2C3E50', end_color='2C3E50', fill_type='solid') # سرمه‌ای تیره و شیک
        cell_font = Font(name='Tahoma', size=10)
        
        # رنگ‌های یکی‌درمیان ردیف‌ها
        fill_even = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
        fill_odd = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

        center_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='E0E0E0'), right=Side(style='thin', color='E0E0E0'),
            top=Side(style='thin', color='E0E0E0'), bottom=Side(style='thin', color='E0E0E0')
        )

        # هدر
        headers = [key_to_label[k] for k in selected_keys]
        ws.append(headers)
        
        for col_idx, cell in enumerate(ws[1], 1):
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_alignment
            cell.border = thin_border

        # فریز کردن سطر اول (برای اسکرول راحت)
        ws.freeze_panes = 'A2'

        # محاسبه عرض اولیه بر اساس هدرها
        col_widths = {i: len(headers[i]) + 6 for i in range(len(headers))}

        # داده‌ها
        row_idx = 2
        for task in queryset.select_related('item', 'item__warehouse', 'counter', 'supervisor', 'assigned_manager').iterator():
            row_data = [str(get_cell(task, k)) for k in selected_keys]
            ws.append(row_data)
            
            # تعیین رنگ پس‌زمینه ردیف
            current_fill = fill_even if row_idx % 2 == 0 else fill_odd
            
            # استایل‌دهی به سلول‌ها و محاسبه عرض
            for col_idx, val in enumerate(row_data):
                cell = ws.cell(row=row_idx, column=col_idx + 1)
                cell.font = cell_font
                cell.fill = current_fill
                cell.alignment = center_alignment
                cell.border = thin_border
                
                # بروزرسانی عرض ستون (محدود کردن به حداکثر 60 برای جلوگیری از عرض بیش‌از‌حد)
                lines = val.split('\n')
                max_line_len = max([len(line) for line in lines]) if lines else 0
                if max_line_len > col_widths.get(col_idx, 10):
                    col_widths[col_idx] = min(max_line_len + 4, 60)
            
            row_idx += 1

        # اعمال عرض ستون‌ها
        for col_idx, width in col_widths.items():
            ws.column_dimensions[get_column_letter(col_idx + 1)].width = width

        # افزودن قابلیت فیلتر روی هدرها
        if row_idx > 2:
            last_col_letter = get_column_letter(len(selected_keys))
            ws.auto_filter.ref = f"A1:{last_col_letter}{row_idx - 1}"

        from io import BytesIO
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="count_tracking_export.xlsx"'
        return response

def _create_doc_task_snapshot(task):
    """ایجاد اسنپ‌شات از تمام مقادیر ۱۴ فیلد مالی و فیلدهای پویای تسک در لحظه عملیات"""
    return {
        'added_rti_no': task.added_rti_no,
        'inv_rti_number': task.inv_rti_number,
        'invoice_type': task.invoice_type,
        'invoice_date': str(task.invoice_date) if task.invoice_date else None,
        'invoice_page': task.invoice_page,
        'page_row': task.page_row,
        'doc_supplier': task.doc_supplier,
        'total_value': str(task.total_value) if task.total_value is not None else None,
        'price_amount': str(task.price_amount) if task.price_amount is not None else None,
        'similar_unit_price': str(task.similar_unit_price) if task.similar_unit_price is not None else None,
        'currency': task.currency,
        'folder_address': task.folder_address,
        'stamp': task.stamp,
        'signature': task.signature,
        'worker_note': task.worker_note,
        'supervisor_note': task.supervisor_note,
        'manager_note': task.manager_note,
        'status': task.status,
        'item_dynamic_data': task.item.dynamic_data if (task.item and getattr(task.item, 'dynamic_data', None)) else {}
    }


class DocTaskViewSet(viewsets.ModelViewSet):
    serializer_class = DocTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = DocTask.objects.filter(item__is_deleted=False).select_related('item', 'doc_worker', 'doc_supervisor', 'created_by', 'modified_by')
        
        as_role = self.request.query_params.get('as_role')
        warehouse_id = self.request.query_params.get('warehouse_id')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
        
        if as_role == 'doc_worker':
            return queryset.filter(doc_worker=user)
        elif as_role == 'doc_supervisor':
            return queryset.filter(doc_supervisor=user)
        elif as_role == 'manager':
            queryset = queryset.filter(assigned_manager=user, status='DOC_MANAGER_REVIEW')
        elif as_role == 'tracking':
            show_completed = self.request.query_params.get('show_completed', 'false').lower() == 'true'
            if not show_completed:
                queryset = queryset.exclude(status='DOC_FINAL_APPROVED')
        else:
            # Fallback
            from django.db.models import Q
            if user.is_superuser or user.groups.filter(name__in=['admin', 'manager']).exists() or user.has_perm('accounts.view_sys_manager_review'):
                queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True) | Q(doc_worker=user) | Q(doc_supervisor=user))
            else:
                queryset = queryset.filter(Q(doc_worker=user) | Q(doc_supervisor=user) | Q(assigned_manager=user))
            
        return queryset

    @action(detail=False, methods=['get'])
    def pool_tasks(self, request):
        as_role = request.query_params.get('as_role')
        warehouse_id = request.query_params.get('warehouse_id')
        queryset = DocTask.objects.filter(item__is_deleted=False).select_related('item', 'doc_worker', 'doc_supervisor', 'created_by', 'modified_by')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
            
        if as_role == 'doc_worker':
            queryset = queryset.filter(doc_worker__isnull=True, status='PENDING_DOC')
        elif as_role == 'doc_supervisor':
            queryset = queryset.filter(doc_supervisor__isnull=True, status='DOC_PROCESSED')
        elif as_role == 'manager':
            queryset = queryset.filter(assigned_manager__isnull=True, status='DOC_MANAGER_REVIEW')
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def claim_tasks(self, request):
        task_ids = request.data.get('task_ids', [])
        sync_ids = request.data.get('sync_ids', [])
        as_role = request.data.get('as_role')

        if (not task_ids and not sync_ids) or not as_role:
            return Response({'error': 'لیست شناسه‌ها یا نقش ارسال نشده است.'}, status=400)

        from django.db.models import Q
        q_filter = Q()
        if task_ids:
            q_filter |= Q(id__in=task_ids)
        if sync_ids:
            q_filter |= Q(sync_id__in=sync_ids)

        tasks = DocTask.objects.filter(q_filter).select_related('item')
        from .models import DocTaskHistory

        if as_role == 'doc_worker':
            tasks = tasks.filter(doc_worker__isnull=True, status='PENDING_DOC')
            valid_tasks = list(tasks)
            if not valid_tasks:
                return Response({'success': True, 'claimed_count': 0})

            valid_task_ids = [t.id for t in valid_tasks]
            item_ids = [t.item_id for t in valid_tasks if t.item_id]

            # Update DocTasks
            updated = DocTask.objects.filter(id__in=valid_task_ids).update(doc_worker=request.user)

            # Update Item doc_assignee
            assignee_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            from .models import Item
            Item.objects.filter(id__in=item_ids).update(doc_assignee=assignee_name, updated_at=timezone.now())

            # Log History
            histories = [
                DocTaskHistory(
                    task=t,
                    action_by=request.user,
                    action_type='CLAIMED',
                    note=f'بر عهده گرفته شد توسط کارشناس مالی ({assignee_name})',
                    data_snapshot=_create_doc_task_snapshot(t)
                ) for t in valid_tasks
            ]
            DocTaskHistory.objects.bulk_create(histories)

        elif as_role == 'doc_supervisor':
            tasks = tasks.filter(doc_supervisor__isnull=True, status='DOC_PROCESSED')
            valid_tasks = list(tasks)
            if not valid_tasks:
                return Response({'success': True, 'claimed_count': 0})
            valid_task_ids = [t.id for t in valid_tasks]
            updated = DocTask.objects.filter(id__in=valid_task_ids).update(doc_supervisor=request.user)
            supervisor_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            histories = [
                DocTaskHistory(
                    task=t,
                    action_by=request.user,
                    action_type='CLAIMED',
                    note=f'بر عهده گرفته شد توسط سرپرست اسناد ({supervisor_name})',
                    data_snapshot=_create_doc_task_snapshot(t)
                ) for t in valid_tasks
            ]
            DocTaskHistory.objects.bulk_create(histories)

        elif as_role == 'manager':
            tasks = tasks.filter(assigned_manager__isnull=True, status='DOC_MANAGER_REVIEW')
            valid_tasks = list(tasks)
            if not valid_tasks:
                return Response({'success': True, 'claimed_count': 0})
            valid_task_ids = [t.id for t in valid_tasks]
            updated = DocTask.objects.filter(id__in=valid_task_ids).update(assigned_manager=request.user)
            manager_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            histories = [
                DocTaskHistory(
                    task=t,
                    action_by=request.user,
                    action_type='CLAIMED',
                    note=f'بر عهده گرفته شد توسط مدیر ({manager_name})',
                    data_snapshot=_create_doc_task_snapshot(t)
                ) for t in valid_tasks
            ]
            DocTaskHistory.objects.bulk_create(histories)
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)

        broadcast_doc_task_update()
        return Response({'success': True, 'claimed_count': updated})

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, modified_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)
        
        updated_instance = serializer.save(modified_by=self.request.user)
        
        if old_status != new_status:
            from .models import DocTaskHistory
            
            note = ''
            if new_status in ['DOC_MANAGER_REJECTED', 'DOC_FINAL_APPROVED']:
                note = updated_instance.manager_note
            elif new_status == 'DOC_SUPERVISOR_REJECTED':
                note = updated_instance.supervisor_note
            elif new_status == 'DOC_PROCESSED':
                note = updated_instance.worker_note
                
            DocTaskHistory.objects.create(
                task=updated_instance,
                action_by=self.request.user,
                action_type=new_status,
                note=note,
                data_snapshot=_create_doc_task_snapshot(updated_instance)
            )

    @action(detail=False, methods=['post'])
    def bulk_submit(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        sync_ids = request.data.get('sync_ids', [])
        warehouse_id = request.data.get('warehouse_id') or request.query_params.get('warehouse_id')
        
        from django.db.models import Q
        if task_ids or sync_ids:
            q_filter = Q()
            if task_ids:
                q_filter |= Q(id__in=task_ids)
            if sync_ids:
                q_filter |= Q(sync_id__in=sync_ids)
            tasks = DocTask.objects.filter(q_filter, doc_worker=user, status__in=['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED']).select_related('item')
        else:
            tasks = DocTask.objects.filter(doc_worker=user, status__in=['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED']).select_related('item')
        
        if warehouse_id and str(warehouse_id) not in ['ALL', '-1']:
            tasks = tasks.filter(item__warehouse_id=warehouse_id)
        
        first_task = tasks.first()
        if not first_task:
            return Response({'message': 'هیچ رکوردی برای ارجاع یافت نشد.'})
            
        from warehouses.services import get_setting
        from .models import DocTaskHistory
        histories = []
        tasks_list = list(tasks)
        
        # بررسی تنظیم تایید سرپرست به تفکیک انبار هر تسک
        wh_settings_cache = {}
        target_status_counts = {'DOC_PROCESSED': 0, 'DOC_MANAGER_REVIEW': 0}
        
        for task in tasks_list:
            wh_id = task.item.warehouse_id if task.item else None
            if wh_id not in wh_settings_cache:
                wh_settings_cache[wh_id] = get_setting('require_doc_supervisor_approval', wh_id)
            req_sup_app = wh_settings_cache[wh_id]
            
            task_req_sup = req_sup_app and not task.skip_supervisor
            target_status = 'DOC_PROCESSED' if task_req_sup else 'DOC_MANAGER_REVIEW'
            task.status = target_status
            task.modified_by = user
            target_status_counts[target_status] += 1
            
            histories.append(DocTaskHistory(
                task=task,
                action_by=user,
                action_type=target_status,
                note=task.worker_note,
                data_snapshot=_create_doc_task_snapshot(task)
            ))
            
        count = len(tasks_list)
        if count > 0:
            DocTask.objects.bulk_update(tasks_list, ['status', 'modified_by'])
            broadcast_doc_task_update()
        if histories:
            DocTaskHistory.objects.bulk_create(histories)
            
        if target_status_counts['DOC_PROCESSED'] > 0 and target_status_counts['DOC_MANAGER_REVIEW'] > 0:
            msg = f'{count} کالا ارسال شد ({target_status_counts["DOC_PROCESSED"]} مورد جهت بررسی سرپرست و {target_status_counts["DOC_MANAGER_REVIEW"]} مورد مستقیماً به مدیر).'
        elif target_status_counts['DOC_PROCESSED'] > 0:
            msg = f'{count} کالا جهت بررسی سرپرست ارسال شد.'
        else:
            msg = f'{count} کالا مستقیماً جهت بررسی مدیر ارسال شد.'
            
        return Response({'message': msg})

    @action(detail=False, methods=['post'])
    def bulk_approve(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ کالایی انتخاب نشده است.'}, status=400)
            
        from django.db.models import Q
        tasks = DocTask.objects.filter(id__in=task_ids, status__in=['DOC_PROCESSED', 'DOC_MANAGER_REJECTED'])
        if not (user.is_superuser or user.groups.filter(name__in=['admin', 'manager']).exists()):
            tasks = tasks.filter(Q(doc_supervisor=user) | Q(doc_supervisor__isnull=True))
        
        note = request.data.get('note', '')
        
        from .models import DocTaskHistory
        histories = []
        for task in tasks:
            task.supervisor_note = note
            task.status = 'DOC_MANAGER_REVIEW'
            task.modified_by = user
            if task.doc_supervisor_id is None:
                task.doc_supervisor = user
            histories.append(DocTaskHistory(
                task=task,
                action_by=user,
                action_type='DOC_MANAGER_REVIEW',
                note=note,
                data_snapshot=_create_doc_task_snapshot(task)
            ))
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'supervisor_note', 'doc_supervisor'])
            DocTaskHistory.objects.bulk_create(histories)
            broadcast_doc_task_update()
            
        return Response({'message': f'{len(histories)} رکورد جهت تایید نهایی مدیر ارسال شد.'})

    @action(detail=False, methods=['post'])
    def reject(self, request):
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids, status__in=['DOC_PROCESSED', 'DOC_MANAGER_REJECTED'])
        
        from .models import DocTaskHistory
        histories = []
        for task in tasks:
            task.supervisor_note = note
            task.status = 'DOC_SUPERVISOR_REJECTED'
            task.modified_by = request.user
            histories.append(DocTaskHistory(
                task=task,
                action_by=request.user,
                action_type='DOC_SUPERVISOR_REJECTED',
                note=note,
                data_snapshot=_create_doc_task_snapshot(task)
            ))
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'supervisor_note'])
            DocTaskHistory.objects.bulk_create(histories)
            broadcast_doc_task_update()
            
        return Response({'message': f'{len(histories)} رکورد به بررسی‌کننده اسناد برگشت داده شد.'})

    @action(detail=False, methods=['post'])
    def manager_reject(self, request):
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids, status='DOC_MANAGER_REVIEW')
        
        from .models import DocTaskHistory
        histories = []
        for task in tasks:
            task.manager_note = note
            task.status = 'DOC_MANAGER_REJECTED'
            task.modified_by = request.user
            histories.append(DocTaskHistory(
                task=task,
                action_by=request.user,
                action_type='DOC_MANAGER_REJECTED',
                note=note,
                data_snapshot=_create_doc_task_snapshot(task)
            ))
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'manager_note'])
            DocTaskHistory.objects.bulk_create(histories)
            broadcast_doc_task_update()
            
        return Response({'message': f'{len(histories)} رکورد به سرپرست اسناد (یا بررسی‌کننده) برگشت داده شد.'})

    @action(detail=False, methods=['post'])
    def bulk_manager_approve(self, request):
        task_ids = request.data.get('task_ids', [])
        note = request.data.get('note', '')
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)
            
        tasks_list = list(DocTask.objects.filter(id__in=task_ids, status='DOC_MANAGER_REVIEW').select_related('item'))
        if not tasks_list:
            return Response({'message': 'هیچ رکوردی در انتظار تایید مدیر یافت نشد.'})
        
        from .models import DocTaskHistory, Item
        from django.db import transaction
        
        histories = []
        items_to_update = []
        now = timezone.now()
        
        with transaction.atomic():
            for task in tasks_list:
                if note:
                    task.manager_note = note
                task.status = 'DOC_FINAL_APPROVED'
                task.modified_by = request.user
                histories.append(DocTaskHistory(
                    task=task,
                    action_by=request.user,
                    action_type='DOC_FINAL_APPROVED',
                    note=task.manager_note,
                    data_snapshot=_create_doc_task_snapshot(task)
                ))
                
                # انتقال و همگام‌سازی فیلدهای مالی به رکورد کالا (Item)
                item = task.item
                if item:
                    item.doc_status = 'approved'
                    item.price_amount = task.price_amount
                    item.total_value = task.total_value
                    item.similar_unit_price = task.similar_unit_price
                    item.currency = task.currency
                    item.invoice_type = task.invoice_type
                    item.invoice_date = str(task.invoice_date) if task.invoice_date else None
                    item.inv_rti_number = task.inv_rti_number
                    item.added_rti_no = task.added_rti_no
                    item.page_row = str(task.page_row) if task.page_row is not None else None
                    item.invoice_page = str(task.invoice_page) if task.invoice_page is not None else None
                    item.doc_supplier = task.doc_supplier
                    item.folder_address = task.folder_address
                    if task.stamp is not None:
                        item.stamp = 'دارد' if task.stamp else 'ندارد'
                    if task.signature is not None:
                        item.signature = 'دارد' if task.signature else 'ندارد'
                    item.modified_by = request.user
                    item.updated_at = now
                    items_to_update.append(item)
                
            if tasks_list:
                DocTask.objects.bulk_update(tasks_list, ['status', 'modified_by', 'manager_note'])
                DocTaskHistory.objects.bulk_create(histories)
                if items_to_update:
                    Item.objects.bulk_update(items_to_update, [
                        'doc_status', 'price_amount', 'total_value', 'similar_unit_price',
                        'currency', 'invoice_type', 'invoice_date', 'inv_rti_number',
                        'added_rti_no', 'page_row', 'invoice_page', 'doc_supplier',
                        'folder_address', 'stamp', 'signature', 'modified_by', 'updated_at'
                    ])
                broadcast_doc_task_update()
            
        return Response({'message': f'{len(histories)} رکورد نهایی شد.'})
        
    @action(detail=False, methods=['post'])
    def bulk_cancel(self, request):
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids)
        item_ids = list(tasks.values_list('item_id', flat=True))
        
        from .models import Item
        deleted_count, _ = tasks.delete()
        Item.objects.filter(id__in=item_ids).update(doc_status='checking', doc_assignee=None, updated_at=timezone.now())
        
        broadcast_doc_task_update()
        return Response({'message': f'{deleted_count} وظیفه ارجاع اسناد با موفقیت لغو شد.'})

    @action(detail=False, methods=['get'], url_path='download_template')
    def download_template(self, request):
        """تولید فایل اکسل نمونه آزمایشی برای کارتابل مالی متناسب با فیلدهای قابل ویرایش"""
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.datavalidation import DataValidation
        from django.http import HttpResponse
        from warehouses.services import get_setting

        warehouse_id = request.query_params.get('warehouse_id')
        if warehouse_id and str(warehouse_id) in ['ALL', '-1', 'null', 'undefined']:
            warehouse_id = None
        num_wh_id = int(warehouse_id) if warehouse_id and str(warehouse_id).isdigit() else None

        # دریافت تنظیمات فیلدهای کارتابل مالی
        saved_perms = get_setting('field_permissions_doc', num_wh_id) or {}
        if isinstance(saved_perms, str):
            import json
            try:
                saved_perms = json.loads(saved_perms)
            except Exception:
                saved_perms = {}

        # لیست فیلدهای استاندارد مالی
        STANDARD_DOC_FIELDS = [
            {'key': 'price_amount',       'default_label': 'قیمت واحد',        'type': 'number',   'sample1': '2500000',               'sample2': '1850000'},
            {'key': 'similar_unit_price', 'default_label': 'قیمت کالای مشابه', 'type': 'number',   'sample1': '2400000',               'sample2': '1800000'},
            {'key': 'total_value',        'default_label': 'ارزش کل',          'type': 'number',   'sample1': '25000000',              'sample2': '18500000'},
            {'key': 'currency',           'default_label': 'ارز',              'type': 'currency', 'sample1': 'ریال',                  'sample2': 'دلار'},
            {'key': 'invoice_type',       'default_label': 'نوع فاکتور',        'type': 'inv_type', 'sample1': 'رسمی/مالیاتی',          'sample2': 'خریدهای داخلی'},
            {'key': 'invoice_date',       'default_label': 'تاریخ فاکتور',     'type': 'date',     'sample1': '1405/05/25 07:10',      'sample2': '1405/06/01 10:30'},
            {'key': 'inv_rti_number',     'default_label': 'شماره RTI فاکتور', 'type': 'text',     'sample1': 'RTI-1405-001',          'sample2': 'RTI-1405-002'},
            {'key': 'added_rti_no',       'default_label': 'شماره RTI افزوده‌شده', 'type': 'text', 'sample1': 'RTI-ADD-99',           'sample2': 'RTI-ADD-100'},
            {'key': 'invoice_page',       'default_label': 'صفحه فاکتور',      'type': 'number',   'sample1': '1',                     'sample2': '2'},
            {'key': 'page_row',           'default_label': 'ردیف فاکتور',      'type': 'number',   'sample1': '1',                     'sample2': '3'},
            {'key': 'doc_supplier',       'default_label': 'تأمین‌کننده',      'type': 'text',     'sample1': 'شرکت تأمین تجهیز پارس', 'sample2': 'شرکت مهندسی پویا'},
            {'key': 'folder_address',     'default_label': 'مسیر پوشه اسناد',  'type': 'text',     'sample1': 'Z:/Docs/Archive/1405',  'sample2': 'Z:/Docs/Archive/1405'},
            {'key': 'stamp',              'default_label': 'مهر',              'type': 'boolean',  'sample1': 'بله',                   'sample2': 'خیر'},
            {'key': 'signature',          'default_label': 'امضا',             'type': 'boolean',  'sample1': 'بله',                   'sample2': 'بله'},
            {'key': 'worker_note',        'default_label': 'یادداشت کارشناس',  'type': 'text',     'sample1': 'مدارک مالی مطابقت دارد', 'sample2': 'فاکتور ضمیمه شد'},
        ]

        # همیشه ستون شناساگر کد یکتا در ابتدا قرار می‌گیرد
        columns = [
            {'key': 'fa_unic_code', 'label': 'کد یکتا', 'type': 'text', 'sample1': 'FA-10001', 'sample2': 'FA-10002'}
        ]

        for f in STANDARD_DOC_FIELDS:
            cfg = saved_perms.get(f['key'], {}) if isinstance(saved_perms, dict) else {}
            is_editable = cfg.get('editable', True)
            is_visible = cfg.get('visible', True)
            if is_visible and is_editable:
                label = (cfg.get('custom_label') or '').strip() or f['default_label']
                columns.append({
                    'key': f['key'],
                    'label': label,
                    'type': f['type'],
                    'sample1': f['sample1'],
                    'sample2': f['sample2'],
                })

        # افزودن فیلدهای داینامیک فعال و قابل ویرایش انبار
        if num_wh_id:
            from .models import ItemFieldDefinition
            dyn_defs = ItemFieldDefinition.objects.filter(warehouse_id=num_wh_id, is_active=True)
            for d in dyn_defs:
                dyn_key = f"dyn_{d.name}"
                cfg = saved_perms.get(dyn_key, {}) if isinstance(saved_perms, dict) else {}
                is_editable = cfg.get('editable', True)
                is_visible = cfg.get('visible', True)
                if is_visible and is_editable:
                    label = (cfg.get('custom_label') or '').strip() or d.label or d.name
                    dtype = d.field_type
                    if dtype == 'number':
                        s1, s2 = '100', '250'
                    elif dtype == 'boolean':
                        s1, s2 = 'بله', 'خیر'
                    elif dtype == 'date':
                        s1, s2 = '1405/05/25', '1405/06/01'
                    else:
                        s1, s2 = 'مقدار نمونه ۱', 'مقدار نمونه ۲'
                    columns.append({
                        'key': dyn_key,
                        'label': label,
                        'type': 'boolean' if dtype == 'boolean' else ('number' if dtype == 'number' else ('date' if dtype == 'date' else 'text')),
                        'sample1': s1,
                        'sample2': s2,
                    })

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'قالب اسناد مالی'
        ws.sheet_view.rightToLeft = True

        header_font = Font(name='Tahoma', bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
        sample_font = Font(name='Tahoma', size=10)
        center_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'), right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'), bottom=Side(style='thin', color='E2E8F0')
        )
        fill_row1 = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
        fill_row2 = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

        headers = [c['label'] for c in columns]
        ws.append(headers)

        for col_idx, cell in enumerate(ws[1], 1):
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_alignment
            cell.border = thin_border

        row1_data = [c['sample1'] for c in columns]
        row2_data = [c['sample2'] for c in columns]
        ws.append(row1_data)
        ws.append(row2_data)

        for r_idx, (r_data, r_fill) in enumerate([(row1_data, fill_row1), (row2_data, fill_row2)], start=2):
            for c_idx, val in enumerate(r_data, 1):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.font = sample_font
                cell.fill = r_fill
                cell.alignment = center_alignment
                cell.border = thin_border

        # اعمال کشوها با DataValidation
        bool_dv = DataValidation(type="list", formula1='"بله,خیر"', allow_blank=True)
        inv_dv = DataValidation(type="list", formula1='"رسمی/مالیاتی,خریدهای داخلی,خریدهای خارجی,امانی"', allow_blank=True)
        cur_dv = DataValidation(type="list", formula1='"ریال,دلار,یورو,سایر"', allow_blank=True)

        ws.add_data_validation(bool_dv)
        ws.add_data_validation(inv_dv)
        ws.add_data_validation(cur_dv)

        for col_idx, col in enumerate(columns, 1):
            col_letter = get_column_letter(col_idx)
            if col['type'] == 'boolean':
                bool_dv.add(f"{col_letter}2:{col_letter}500")
            elif col['type'] == 'inv_type':
                inv_dv.add(f"{col_letter}2:{col_letter}500")
            elif col['type'] == 'currency':
                cur_dv.add(f"{col_letter}2:{col_letter}500")

            max_len = max(len(str(col['label'])), len(str(col.get('sample1', ''))), len(str(col.get('sample2', ''))))
            ws.column_dimensions[col_letter].width = max(max_len + 6, 14)

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Customs_Doc_Template.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='get_export_columns')
    def get_export_columns(self, request):
        """لیست ستون‌های مجاز برای خروجی اکسل کارتابل مالی و اسناد"""
        columns = [
            {'key': 'warehouse_name',        'label': 'نام انبار'},
            {'key': 'fa_unic_code',          'label': 'کد یکتا'},
            {'key': 'description',           'label': 'شرح کالا'},
            {'key': 'po',                    'label': 'شماره PO'},
            {'key': 'new_location',          'label': 'لوکیشن'},
            {'key': 'status',                'label': 'وضعیت'},
            {'key': 'doc_worker_name',       'label': 'کارشناس مالی'},
            {'key': 'doc_supervisor_name',   'label': 'سرپرست'},
            {'key': 'assigned_manager_name', 'label': 'مدیر'},
            {'key': 'inv_rti_number',        'label': 'شماره RTI فاکتور'},
            {'key': 'added_rti_no',          'label': 'شماره RTI افزوده‌شده'},
            {'key': 'invoice_type',          'label': 'نوع فاکتور'},
            {'key': 'invoice_date',          'label': 'تاریخ فاکتور'},
            {'key': 'invoice_page',          'label': 'صفحه فاکتور'},
            {'key': 'page_row',              'label': 'ردیف فاکتور'},
            {'key': 'doc_supplier',          'label': 'تأمین‌کننده'},
            {'key': 'price_amount',          'label': 'قیمت واحد'},
            {'key': 'similar_unit_price',    'label': 'قیمت کالای مشابه'},
            {'key': 'total_value',           'label': 'ارزش کل'},
            {'key': 'currency',              'label': 'ارز'},
            {'key': 'folder_address',        'label': 'مسیر پوشه اسناد'},
            {'key': 'stamp',                 'label': 'مهر'},
            {'key': 'signature',             'label': 'امضا'},
            {'key': 'worker_note',           'label': 'یادداشت کارشناس'},
            {'key': 'supervisor_note',       'label': 'یادداشت سرپرست'},
            {'key': 'manager_note',          'label': 'یادداشت مدیر'},
            {'key': 'created_at',            'label': 'تاریخ ایجاد'},
            {'key': 'updated_at',            'label': 'تاریخ بروزرسانی'},
        ]
        return Response(columns)

    @action(detail=False, methods=['post'], url_path='export_excel')
    def export_excel(self, request):
        """خروجی اکسل صفحه کارتابل مالی با تاریخ شمسی و وضعیت فارسی"""
        import openpyxl
        from django.http import HttpResponse

        STATUS_FA = {
            'PENDING_DOC':             'در انتظار بررسی',
            'DOC_PROCESSED':           'ارسال‌شده به سرپرست',
            'DOC_SUPERVISOR_REJECTED': 'رد سرپرست',
            'DOC_MANAGER_REVIEW':      'در بررسی مدیر',
            'DOC_MANAGER_REJECTED':    'رد مدیر',
            'DOC_FINAL_APPROVED':      'تأیید نهایی',
        }

        INVOICE_TYPE_FA = {
            'formal':      'رسمی/مالیاتی',
            'domestic':    'خریدهای داخلی',
            'foreign':     'خریدهای خارجی',
            'consignment': 'امانی',
        }

        CURRENCY_FA = {
            'IRR':   'ریال',
            'USD':   'دلار',
            'EUR':   'یورو',
            'OTHER': 'سایر',
        }

        def to_jalali(dt):
            if not dt:
                return ''
            try:
                import jdatetime
                from django.utils import timezone
                if timezone.is_aware(dt):
                    dt = timezone.localtime(dt)
                jdt = jdatetime.datetime.fromgregorian(datetime=dt)
                return jdt.strftime('%Y/%m/%d %H:%M')
            except Exception:
                return str(dt)

        data_scope    = request.data.get('data_scope', 'all')
        columns_scope = request.data.get('columns_scope', 'all_db')
        columns_list  = request.data.get('columns_list', [])

        from django.http import QueryDict
        original_query_params = request._request.GET
        try:
            q = QueryDict(mutable=True)
            for k, v in request.data.items():
                if isinstance(v, list):
                    q.setlist(k, [str(x) for x in v])
                elif v is not None:
                    q[k] = str(v)
            request._request.GET = q

            if data_scope == 'selected':
                selected_ids = request.data.get('selected_ids', [])
                queryset = self.get_queryset().filter(id__in=selected_ids)
            else:
                queryset = self.get_queryset()
        finally:
            request._request.GET = original_query_params

        ALL_COLUMNS = [
            {'key': 'warehouse_name',        'label': 'نام انبار'},
            {'key': 'fa_unic_code',          'label': 'کد یکتا'},
            {'key': 'description',           'label': 'شرح کالا'},
            {'key': 'po',                    'label': 'شماره PO'},
            {'key': 'new_location',          'label': 'لوکیشن'},
            {'key': 'status',                'label': 'وضعیت'},
            {'key': 'doc_worker_name',       'label': 'کارشناس مالی'},
            {'key': 'doc_supervisor_name',   'label': 'سرپرست'},
            {'key': 'assigned_manager_name', 'label': 'مدیر'},
            {'key': 'inv_rti_number',        'label': 'شماره RTI فاکتور'},
            {'key': 'added_rti_no',          'label': 'شماره RTI افزوده‌شده'},
            {'key': 'invoice_type',          'label': 'نوع فاکتور'},
            {'key': 'invoice_date',          'label': 'تاریخ فاکتور'},
            {'key': 'invoice_page',          'label': 'صفحه فاکتور'},
            {'key': 'page_row',              'label': 'ردیف فاکتور'},
            {'key': 'doc_supplier',          'label': 'تأمین‌کننده'},
            {'key': 'price_amount',          'label': 'قیمت واحد'},
            {'key': 'similar_unit_price',    'label': 'قیمت کالای مشابه'},
            {'key': 'total_value',           'label': 'ارزش کل'},
            {'key': 'currency',              'label': 'ارز'},
            {'key': 'folder_address',        'label': 'مسیر پوشه اسناد'},
            {'key': 'stamp',                 'label': 'مهر'},
            {'key': 'signature',             'label': 'امضا'},
            {'key': 'worker_note',           'label': 'یادداشت کارشناس'},
            {'key': 'supervisor_note',       'label': 'یادداشت سرپرست'},
            {'key': 'manager_note',          'label': 'یادداشت مدیر'},
            {'key': 'created_at',            'label': 'تاریخ ایجاد'},
            {'key': 'updated_at',            'label': 'تاریخ بروزرسانی'},
        ]
        all_keys = [c['key'] for c in ALL_COLUMNS]
        key_to_label = {c['key']: c['label'] for c in ALL_COLUMNS}

        if columns_scope in ('visible', 'custom') and columns_list:
            selected_keys = [k for k in columns_list if k in all_keys]
            if not selected_keys:
                selected_keys = all_keys
        else:
            selected_keys = all_keys

        def get_cell(task, key):
            if key == 'warehouse_name':
                if task.item and task.item.warehouse:
                    return getattr(task.item.warehouse, 'project_name', None) or task.item.warehouse.name or ''
                return ''
            elif key == 'fa_unic_code':
                return getattr(task.item, 'fa_unic_code', '') if task.item else ''
            elif key == 'description':
                return getattr(task.item, 'description', '') if task.item else ''
            elif key == 'po':
                return getattr(task.item, 'po', '') if task.item else ''
            elif key == 'new_location':
                return getattr(task.item, 'new_location', '') if task.item else ''
            elif key == 'status':
                return STATUS_FA.get(task.status, task.status)
            elif key == 'doc_worker_name':
                if task.doc_worker:
                    return f"{task.doc_worker.first_name} {task.doc_worker.last_name}".strip() or task.doc_worker.username
                return ''
            elif key == 'doc_supervisor_name':
                if task.doc_supervisor:
                    return f"{task.doc_supervisor.first_name} {task.doc_supervisor.last_name}".strip() or task.doc_supervisor.username
                return ''
            elif key == 'assigned_manager_name':
                if task.assigned_manager:
                    return f"{task.assigned_manager.first_name} {task.assigned_manager.last_name}".strip() or task.assigned_manager.username
                return ''
            elif key == 'inv_rti_number':
                return task.inv_rti_number or ''
            elif key == 'added_rti_no':
                return task.added_rti_no or ''
            elif key == 'invoice_type':
                return INVOICE_TYPE_FA.get(task.invoice_type, task.invoice_type or '')
            elif key == 'invoice_date':
                return task.invoice_date or ''
            elif key == 'invoice_page':
                return task.invoice_page if task.invoice_page is not None else ''
            elif key == 'page_row':
                return task.page_row if task.page_row is not None else ''
            elif key == 'doc_supplier':
                return task.doc_supplier or ''
            elif key == 'price_amount':
                return task.price_amount or ''
            elif key == 'similar_unit_price':
                return task.similar_unit_price or ''
            elif key == 'total_value':
                return task.total_value or ''
            elif key == 'currency':
                return CURRENCY_FA.get(task.currency, task.currency or '')
            elif key == 'folder_address':
                return task.folder_address or ''
            elif key == 'stamp':
                return 'بله' if task.stamp else 'خیر'
            elif key == 'signature':
                return 'بله' if task.signature else 'خیر'
            elif key == 'worker_note':
                return task.worker_note or ''
            elif key == 'supervisor_note':
                return task.supervisor_note or ''
            elif key == 'manager_note':
                return task.manager_note or ''
            elif key == 'created_at':
                return to_jalali(task.created_at)
            elif key == 'updated_at':
                return to_jalali(task.updated_at)
            return ''

        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'کارتابل مالی'
        ws.sheet_view.rightToLeft = True

        header_font = Font(name='Tahoma', bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid') # سرمه‌ای دودی مدرن
        cell_font = Font(name='Tahoma', size=10)

        fill_even = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
        fill_odd = PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid')

        center_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'), right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'), bottom=Side(style='thin', color='E2E8F0')
        )

        headers = [key_to_label[k] for k in selected_keys]
        ws.append(headers)

        for col_idx, cell in enumerate(ws[1], 1):
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_alignment
            cell.border = thin_border

        ws.freeze_panes = 'A2'
        col_widths = {i: len(headers[i]) + 6 for i in range(len(headers))}

        row_idx = 2
        for task in queryset.select_related('item', 'item__warehouse', 'doc_worker', 'doc_supervisor', 'assigned_manager').iterator():
            row_data = [str(get_cell(task, k)) for k in selected_keys]
            ws.append(row_data)

            current_fill = fill_even if row_idx % 2 == 0 else fill_odd

            for col_idx, val in enumerate(row_data):
                cell = ws.cell(row=row_idx, column=col_idx + 1)
                cell.font = cell_font
                cell.fill = current_fill
                cell.alignment = center_alignment
                cell.border = thin_border

                lines = val.split('\n')
                max_line_len = max([len(line) for line in lines]) if lines else 0
                if max_line_len > col_widths.get(col_idx, 10):
                    col_widths[col_idx] = min(max_line_len + 4, 60)

            row_idx += 1

        for col_idx, width in col_widths.items():
            ws.column_dimensions[get_column_letter(col_idx + 1)].width = width

        if row_idx > 2:
            last_col_letter = get_column_letter(len(selected_keys))
            ws.auto_filter.ref = f"A1:{last_col_letter}{row_idx - 1}"

        from io import BytesIO
        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="customs_cartable_export.xlsx"'
        return response



