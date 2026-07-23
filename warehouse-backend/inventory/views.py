from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Item, ImportLog, ImportHistory
from .serializers import ItemSerializer, CountTaskSerializer, DocTaskSerializer
from django.forms.models import model_to_dict
from warehouses.models import Warehouse
from .models import CountTask, DocTask
from django.db.models import Q
from django.utils import timezone
import openpyxl
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

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, PriorityOrderingFilter]
    filterset_class = ItemFilter
    pagination_class = ItemPagination
    search_fields = ['fa_unic_code', 'plpkitem', 'description', 'po', 'pl', 'pk_number', 'tag']
    ordering_fields = '__all__'
    parser_classes = (MultiPartParser, FormParser, *viewsets.ModelViewSet.parser_classes)

    def get_queryset(self):
        queryset = super().get_queryset()
        
        show_counted = self.request.query_params.get('show_counted') == 'true'
        show_counting = self.request.query_params.get('show_counting') == 'true'
        
        excluded_statuses = []
        if not show_counted:
            excluded_statuses.append('done')
        if not show_counting:
            excluded_statuses.extend(['counting', 'recount'])
            
        if excluded_statuses:
            queryset = queryset.exclude(field_status__in=excluded_statuses)
            
        return queryset

    def get_permissions(self):
        from accounts.permissions import HasMenuAccess
        
        if self.action in ['list', 'retrieve']:
            permission_classes = [HasMenuAccess('view_wh_docs') | HasMenuAccess('view_sys_counter')]
        elif self.action == 'bulk_assign':
            permission_classes = [HasMenuAccess('perm_rec_dispatch')]
        elif self.action in ['export_excel', 'export_excel_mt']: # I'll just secure export here in case it's added
            permission_classes = [HasMenuAccess('view_sys_export')]
        elif self.action in ['import_excel', 'cancel_import', 'delete_from_excel', 'clear_warehouse_data']:
            permission_classes = [HasMenuAccess('perm_rec_import')]
        elif self.action in ['reject', 'manager_reject']:
            permission_classes = [HasMenuAccess('perm_rec_recount')]
        else: # create, update, partial_update, destroy, bulk_update, etc
            permission_classes = [HasMenuAccess('perm_wh_edit')]
            
        return permission_classes


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
        doc_assignee_id = request.data.get('doc_assignee') # Used to be string, now expected to be ID or null
        doc_supervisor_id = request.data.get('doc_supervisor_assignee')
        doc_manager_id = request.data.get('doc_manager_assignee')
        
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
        if doc_status == 'checking' and not force:
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
            
        if update_data:
            update_data['updated_at'] = timezone.now()
            update_data['modified_by'] = request.user
            items.update(**update_data)
            
        from warehouses.services import get_setting
        first_item = items.first()
        wh_id = first_item.warehouse_id if first_item else None
        
        # Create CountTasks if it's a field dispatch
        if field_status == 'counting':
            from .models import CountTask
            
            # بررسی تنظیم تایید سرپرست
            req_supervisor = get_setting('require_supervisor_approval', wh_id)
            
            tasks_to_create = []
            for item in items:
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

        # Create DocTasks if it's a document dispatch
        if doc_status == 'processing':
            from .models import DocTask
            
            # بررسی تنظیم تایید سرپرست اسناد
            req_doc_supervisor = get_setting('require_doc_supervisor_approval', wh_id)
            
            doc_tasks_to_create = []
            for item in items:
                doc_tasks_to_create.append(DocTask(
                    item=item,
                    doc_worker=doc_worker_user,
                    doc_supervisor=doc_supervisor_user if (req_doc_supervisor and not doc_skip_supervisor) else None,
                    skip_supervisor=doc_skip_supervisor,
                    assigned_manager=doc_manager_user,
                    status='PENDING_DOC',
                    created_by=request.user,
                    modified_by=request.user
                ))
            if doc_tasks_to_create:
                DocTask.objects.bulk_create(doc_tasks_to_create)
            
        return Response({'status': 'success', 'updated': items.count()})

    @action(detail=False, methods=['post'])
    def bulk_tag(self, request):
        updates = request.data.get('updates', [])
        updated_count = 0
        if updates:
            with transaction.atomic():
                for up in updates:
                    item_id = up.get('id')
                    tag = up.get('tag', '')
                    if item_id:
                        Item.objects.filter(id=item_id).update(
                            tag=tag, 
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
            elif tag == 'fragile':
                items.update(is_fragile=True, updated_at=timezone.now(), modified_by=request.user)
            elif tag == 'heavy':
                items.update(is_heavy=True, updated_at=timezone.now(), modified_by=request.user)
            elif tag == 'qc':
                items.update(needs_qc=True, updated_at=timezone.now(), modified_by=request.user)
            updated_count = items.count()
            
        return Response({'status': 'success', 'updated': updated_count})

    def get_expected_fields(self):
        return {
            'id': 'id', 'fa_unic_code': 'fa_unic_code', 'plpkitem': 'plpkitem', 'pl': 'pl', 'po': 'po',
            'pk_number': 'pk_number', 'item_no': 'item_no', 'description': 'description',
            'unit': 'unit', 'scope_discipline': 'scope_discipline', 'balance': 'balance',
            'bal4miv': 'bal4miv', 'old_location': 'old_location', 'new_location': 'new_location',
            'hov_no': 'hov_no', 'hov_date': 'hov_date', 'msr_status': 'msr_status', 'vendor': 'vendor',
            'supplier': 'supplier', 'irn_no': 'irn_no', 'item2': 'item2', 'inventory_status': 'inventory_status',
            'indent': 'indent', 'remark': 'remark', 'price_amount': 'price_amount', 'currency': 'currency',
            'invoice_file': 'invoice_file', 'invoice_page': 'invoice_page', 'customs_field': 'customs_field',
            'customs_file': 'customs_file', 'customs_file_page': 'customs_file_page',
            'price_remark': 'price_remark', 'issue_remark': 'issue_remark',
            'created_at': 'created_at', 'updated_at': 'updated_at', 'created_by': 'created_by',
            'modified_by': 'modified_by', 'warehouse': 'warehouse', 'tag': 'tag'
        }

    @action(detail=False, methods=['post'])
    def parse_headers(self, request):
        file_obj = request.FILES.get('file')
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
            raw_headers = [str(val).strip() if val is not None else '' for val in first_row]
            
            wb.close()
            try:
                os.remove(temp_path)
            except Exception:
                pass
            
            expected_fields = self.get_expected_fields()
            
            found_fields = []
            for h in raw_headers:
                if h in expected_fields:
                    found_fields.append(expected_fields[h])
            
            all_expected = set(expected_fields.values())
            missing_fields = list(all_expected - set(found_fields))
            return Response({'status': 'success', 'found_fields': list(set(found_fields)), 'missing_fields': list(set(missing_fields))})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    @action(detail=False, methods=['post'])
    def cancel_import(self, request):
        import_id = request.data.get('import_id')
        if import_id:
            cache.set(f"cancel_import_{import_id}", True, timeout=3600)
            return Response({'status': 'cancelled'})
        return Response({'error': 'import_id required'}, status=400)

    @action(detail=False, methods=['get'], permission_classes=[])
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
                
                raw_headers = [str(cell.value).strip() if cell.value else '' for cell in ws[1]]
                expected_fields = self.get_expected_fields()
                
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
                            
                            fa_unic_code = row_data.get('fa_unic_code')
                            item_id = row_data.pop('id', None)
                            
                            if not fa_unic_code and not item_id:
                                failed += 1
                                err_msg = "ستون fa_unic_code و id خالی است"
                                error_details.append({"row": row_idx, "code": "N/A", "error": err_msg})
                                append_colored_row(row, 'err', err_msg)
                                q.put(json.dumps({"type": "err", "msg": f"[ردیف {row_idx}] خطا: {err_msg}"}) + "\n")
                                continue
                            
                            # Ignore Excel data for these fields
                            for ignore_field in ['created_at', 'updated_at', 'created_by', 'modified_by']:
                                row_data.pop(ignore_field, None)
                                
                            if 'hov_date' in row_data:
                                date_val = row_data['hov_date']
                                if isinstance(date_val, datetime):
                                    row_data['hov_date'] = date_val.date()
                                else:
                                    row_data['hov_date'] = None
                                    
                            excel_tag = row_data.pop('tag', '')
                            if not excel_tag: excel_tag = ''
                            excel_tag = str(excel_tag).strip()
                            
                            final_tags = []
                            if excel_tag:
                                final_tags.extend([t.strip() for t in excel_tag.split('،') if t.strip()])
                                final_tags.extend([t.strip() for t in excel_tag.split(',') if t.strip()])
                            if import_tag:
                                final_tags.extend([t.strip() for t in import_tag.split('،') if t.strip()])
                                final_tags.extend([t.strip() for t in import_tag.split(',') if t.strip()])
                            
                            unique_tags = list(set(final_tags))
                            if unique_tags:
                                row_data['tag'] = '،'.join(unique_tags)

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

                            defaults = {k: v for k, v in row_data.items() if k != 'fa_unic_code' and v is not None}
                            if target_warehouse_id: defaults['warehouse_id'] = target_warehouse_id
                            if user_id: defaults['modified_by_id'] = user_id
                            
                            existing_item = None
                            if item_id:
                                existing_item = Item.objects.filter(id=item_id).first()
                            
                            if not existing_item and fa_unic_code and target_warehouse_id:
                                existing_item = Item.objects.filter(fa_unic_code=fa_unic_code, warehouse_id=target_warehouse_id).first()
                                
                            item_display_code = fa_unic_code or f"ID:{item_id}"
                            
                            if existing_item:
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
                                        
                                    if new_defaults:
                                        from django.core.serializers.json import DjangoJSONEncoder
                                        old_state = model_to_dict(existing_item)
                                        old_state_json = json.loads(json.dumps(old_state, cls=DjangoJSONEncoder))
                                        
                                        Item.objects.filter(id=existing_item.id).update(**new_defaults)
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
                                    
                                    Item.objects.filter(id=existing_item.id).update(**defaults)
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
                            history.item.delete()
                    elif history.action == 'update' or history.action == 'delete':
                        if history.previous_state:
                            state = history.previous_state.copy()
                            
                            # Handle foreign keys correctly for both update and create
                            fk_fields = ['warehouse', 'created_by', 'modified_by']
                            for fk in fk_fields:
                                if fk in state and isinstance(state[fk], int):
                                    state[f'{fk}_id'] = state.pop(fk)
                            
                            if history.action == 'update' and history.item:
                                Item.objects.filter(id=history.item.id).update(**state)
                            elif history.action == 'delete':
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
                    
                deleted, _ = items_qs.delete()
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
                    
                deleted, _ = items_qs.delete()
                items_deleted = deleted
                
                import_log.records_created = items_deleted # Store count in this field for history
                import_log.save()
                
            return Response({'status': 'success', 'msg': f'{items_deleted} رکورد با موفقیت از انبار حذف شدند.', 'import_id': import_id})
        except Exception as e:
            return Response({'error': f'خطا در پردازش فایل: {str(e)}'}, status=500)

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        from datetime import timedelta
        from django.utils import timezone
        from django.db.models import Q
        
        project_id = request.query_params.get('project_id')
        items = Item.objects.all()
        if project_id and project_id != 'ALL':
            items = items.filter(warehouse_id=project_id)
            
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Overall
        total_quantity = items.count()
        printed_tags = items.filter(tag_status__in=['printed', 'reprint']).count()
        conflicts = items.filter(Q(has_conflict=True) | Q(field_status='recount')).count()
        done = items.filter(field_status='done', doc_status='done').count()
        
        # Days stats (last 7 days)
        weekly_data = []
        days_name = ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه', 'یکشنبه']
        
        for i in range(6, -1, -1):
            d_start = today_start - timedelta(days=i)
            d_end = d_start + timedelta(days=1)
            
            day_items = items.filter(updated_at__gte=d_start, updated_at__lt=d_end)
            
            # Approximation for daily stats based on updated_at
            c_count = day_items.exclude(field_status__in=['waiting', 'counting', 'در انتظار شمارش']).count()
            c_docs = day_items.exclude(doc_status__in=['waiting', 'processing']).count()
            # For MT26 feed, doc_status='done' and field_status='done'
            c_feed = day_items.filter(field_status='done', doc_status='done').count()
            
            day_idx = d_start.weekday()
            
            weekly_data.append({
                'day': 'امروز' if i == 0 else ('دیروز' if i == 1 else days_name[day_idx]),
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
                'printed': printed_tags,
                'conflicts': conflicts,
                'done': done
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
        
        if self.action in ['list', 'retrieve', 'pool_tasks', 'claim_tasks']:
            permission_classes = [HasMenuAccess('view_sys_counter') | HasMenuAccess('view_sys_supervisor') | HasMenuAccess('view_sys_manager_review') | HasMenuAccess('view_sys_recounts')]
        elif self.action == 'bulk_submit':
            permission_classes = [HasMenuAccess('view_sys_counter')]
        elif self.action == 'bulk_approve':
            permission_classes = [HasMenuAccess('view_sys_supervisor')]
        elif self.action in ['reject', 'manager_reject', 'bulk_manager_reject']:
            permission_classes = [HasMenuAccess('perm_rec_recount')]
        elif self.action in ['bulk_manager_approve', 'bulk_cancel']:
            permission_classes = [HasMenuAccess('view_sys_manager_review')]
        else: # create, update, etc
            permission_classes = [IsAuthenticated()]
            
        return permission_classes

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
            # Fallback to group checking if as_role is not provided
            if user.is_superuser or user.groups.filter(name__in=['admin', 'manager']).exists():
                from django.db.models import Q
                queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True))
            elif user.groups.filter(name='supervisor').exists():
                queryset = queryset.filter(supervisor=user)
            elif user.groups.filter(name='counter').exists():
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
                return Response({'success': True, 'claimed_count': 0})
                
            from .models import Item
            item_ids = list(CountTask.objects.filter(id__in=valid_task_ids).values_list('item_id', flat=True))
            
            # Update CountTasks
            updated = CountTask.objects.filter(id__in=valid_task_ids).update(counter=request.user)
            
            # Update Item field_assignee
            assignee_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            Item.objects.filter(id__in=item_ids).update(field_assignee=assignee_name)
            
        elif as_role == 'supervisor':
            tasks = tasks.filter(supervisor__isnull=True, status='COUNTED')
            updated = tasks.update(supervisor=request.user)
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)
            
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
            elif new_status == 'COUNTED':
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
        
        if task_ids:
            tasks = CountTask.objects.filter(id__in=task_ids, counter=user, status__in=['PENDING_COUNT', 'SUPERVISOR_REJECTED', 'MANAGER_REJECTED'], counted_balance__isnull=False)
        else:
            tasks = CountTask.objects.filter(counter=user, status__in=['PENDING_COUNT', 'SUPERVISOR_REJECTED', 'MANAGER_REJECTED'], counted_balance__isnull=False)
        
        first_task = tasks.first()
        if not first_task:
            return Response({'message': 'هیچ موردی برای ارسال یافت نشد.'})
            
        from warehouses.services import get_setting
        req_sup_app = get_setting('require_supervisor_approval', first_task.item.warehouse_id)
        
        from .models import CountTaskHistory
        histories = []
        tasks_list = list(tasks)
        for task in tasks_list:
            task_req_sup = req_sup_app and not task.skip_supervisor
            target_status = 'COUNTED' if task_req_sup else 'MANAGER_REVIEW'
            histories.append(CountTaskHistory(
                task=task,
                action_by=user,
                action_type=target_status,
                counted_balance=task.counted_balance,
                note=task.counter_note
            ))
            task.status = target_status
            task.modified_by = user
            
        count = len(tasks_list)
        if count > 0:
            CountTask.objects.bulk_update(tasks_list, ['status', 'modified_by'])
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
        msg = f'{count} مورد برای سرپرست ارسال شد.' if target_status == 'COUNTED' else f'{count} مورد مستقیماً برای مدیر ارسال شد.'
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
            
        count = tasks.update(status='MANAGER_REVIEW', supervisor_note=note, modified_by=user)
        if histories:
            CountTaskHistory.objects.bulk_create(histories)
            
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
                    item.balance = task.counted_balance
                item.modified_by = user
                item.updated_at = timezone.now()
                items_to_update.append(item)
            
            count = tasks.update(status='FINAL_APPROVED', manager_note=note, modified_by=user)
            
            if items_to_update:
                Item.objects.bulk_update(items_to_update, ['field_status', 'balance', 'has_conflict', 'modified_by', 'updated_at'])
            
            if histories:
                CountTaskHistory.objects.bulk_create(histories)
            
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
        
        # بررسی سقف بازشماری (اصلاح ۵)
        max_recounts = get_setting('max_recounts', task.item.warehouse_id)
        if max_recounts is not None and max_recounts != -1:
            from .models import CountTaskHistory
            reject_count = CountTaskHistory.objects.filter(
                task=task,
                action_type__in=['MANAGER_REJECTED', 'SUPERVISOR_REJECTED']
            ).count()
            if reject_count >= int(max_recounts):
                return Response({
                    'error': f'سقف بازشماری ({max_recounts} بار) برای این کالا پر شده است.'
                }, status=400)
        
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
        
        return Response({'message': target_msg})

class DocTaskViewSet(viewsets.ModelViewSet):
    serializer_class = DocTaskSerializer

    def get_permissions(self):
        from accounts.permissions import HasMenuAccess
        from rest_framework.permissions import IsAuthenticated
        
        # Similar permissions to counting but using doc permissions if they existed
        # Actually for now, since we have the roles doc_worker, doc_supervisor, let's use the counting permissions for now, 
        # or just allow IsAuthenticated and rely on s_role filtering since roles are new.
        if self.action in ['list', 'retrieve', 'pool_tasks', 'claim_tasks']:
            permission_classes = [IsAuthenticated()]
        elif self.action == 'bulk_submit':
            permission_classes = [IsAuthenticated()]
        elif self.action == 'bulk_approve':
            permission_classes = [IsAuthenticated()]
        elif self.action in ['reject', 'manager_reject', 'bulk_manager_reject']:
            permission_classes = [IsAuthenticated()]
        elif self.action in ['bulk_manager_approve', 'bulk_cancel']:
            permission_classes = [IsAuthenticated()]
        else:
            permission_classes = [IsAuthenticated()]
            
        return permission_classes

    def get_queryset(self):
        user = self.request.user
        queryset = DocTask.objects.all().select_related('item', 'doc_worker', 'doc_supervisor', 'created_by', 'modified_by')
        
        as_role = self.request.query_params.get('as_role')
        warehouse_id = self.request.query_params.get('warehouse_id')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
        
        if as_role == 'doc_worker':
            return queryset.filter(doc_worker=user)
        elif as_role == 'doc_supervisor':
            return queryset.filter(doc_supervisor=user)
        elif as_role == 'manager':
            from django.db.models import Q
            queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True))
        elif as_role == 'tracking':
            show_completed = self.request.query_params.get('show_completed', 'false').lower() == 'true'
            if not show_completed:
                queryset = queryset.exclude(status='DOC_FINAL_APPROVED')
        else:
            # Fallback
            if user.is_superuser or user.groups.filter(name__in=['admin', 'manager']).exists():
                from django.db.models import Q
                queryset = queryset.filter(Q(assigned_manager=user) | Q(assigned_manager__isnull=True))
            elif user.groups.filter(name='doc_supervisor').exists():
                queryset = queryset.filter(doc_supervisor=user)
            elif user.groups.filter(name='doc_worker').exists():
                queryset = queryset.filter(doc_worker=user)
            else:
                queryset = DocTask.objects.none()
            
        return queryset

    @action(detail=False, methods=['get'])
    def pool_tasks(self, request):
        as_role = request.query_params.get('as_role')
        warehouse_id = request.query_params.get('warehouse_id')
        queryset = DocTask.objects.all().select_related('item', 'doc_worker', 'doc_supervisor', 'created_by', 'modified_by')
        
        if warehouse_id:
            queryset = queryset.filter(item__warehouse_id=warehouse_id)
            
        if as_role == 'doc_worker':
            queryset = queryset.filter(doc_worker__isnull=True, status='PENDING_DOC')
        elif as_role == 'doc_supervisor':
            queryset = queryset.filter(doc_supervisor__isnull=True, status='DOC_PROCESSED')
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def claim_tasks(self, request):
        task_ids = request.data.get('task_ids', [])
        as_role = request.data.get('as_role')
        
        if not task_ids or not as_role:
            return Response({'error': 'لیست شناسه‌ها یا نقش ارسال نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids)
        
        if as_role == 'doc_worker':
            tasks = tasks.filter(doc_worker__isnull=True, status='PENDING_DOC')
            valid_task_ids = list(tasks.values_list('id', flat=True))
            if not valid_task_ids:
                return Response({'success': True, 'claimed_count': 0})
                
            from .models import Item
            item_ids = list(DocTask.objects.filter(id__in=valid_task_ids).values_list('item_id', flat=True))
            
            # Update DocTasks
            updated = DocTask.objects.filter(id__in=valid_task_ids).update(doc_worker=request.user)
            
            # Update Item doc_assignee
            assignee_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            Item.objects.filter(id__in=item_ids).update(doc_assignee=assignee_name)
            
        elif as_role == 'doc_supervisor':
            tasks = tasks.filter(doc_supervisor__isnull=True, status='DOC_PROCESSED')
            updated = tasks.update(doc_supervisor=request.user)
        else:
            return Response({'error': 'نقش نامعتبر است.'}, status=400)
            
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
                note=note
            )

    @action(detail=False, methods=['post'])
    def bulk_submit(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        
        if task_ids:
            tasks = DocTask.objects.filter(id__in=task_ids, doc_worker=user, status__in=['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED'])
        else:
            tasks = DocTask.objects.filter(doc_worker=user, status__in=['PENDING_DOC', 'DOC_SUPERVISOR_REJECTED', 'DOC_MANAGER_REJECTED'])
        
        first_task = tasks.first()
        if not first_task:
            return Response({'message': 'هیچ رکوردی برای ارجاع یافت نشد.'})
            
        from warehouses.services import get_setting
        req_sup_app = get_setting('require_doc_supervisor_approval', first_task.item.warehouse_id)
        
        from .models import DocTaskHistory
        histories = []
        tasks_list = list(tasks)
        for task in tasks_list:
            task_req_sup = req_sup_app and not task.skip_supervisor
            target_status = 'DOC_PROCESSED' if task_req_sup else 'DOC_MANAGER_REVIEW'
            histories.append(DocTaskHistory(
                task=task,
                action_by=user,
                action_type=target_status,
                note=task.worker_note
            ))
            task.status = target_status
            task.modified_by = user
            
        count = len(tasks_list)
        if count > 0:
            DocTask.objects.bulk_update(tasks_list, ['status', 'modified_by'])
        if histories:
            DocTaskHistory.objects.bulk_create(histories)
            
        msg = f'{count} کالا جهت بررسی سرپرست ارسال شد.' if target_status == 'DOC_PROCESSED' else f'{count} کالا مستقیماً جهت بررسی مدیر ارسال شد.'
        return Response({'message': msg})

    @action(detail=False, methods=['post'])
    def bulk_approve(self, request):
        user = request.user
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ کالایی انتخاب نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids, doc_supervisor=user, status__in=['DOC_PROCESSED', 'DOC_MANAGER_REJECTED'])
        
        note = request.data.get('note', '')
        
        from .models import DocTaskHistory
        histories = []
        for task in tasks:
            task.supervisor_note = note
            histories.append(DocTaskHistory(
                task=task,
                action_by=user,
                action_type='DOC_MANAGER_REVIEW',
                note=note
            ))
            task.status = 'DOC_MANAGER_REVIEW'
            task.modified_by = user
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'supervisor_note'])
            DocTaskHistory.objects.bulk_create(histories)
            
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
            histories.append(DocTaskHistory(
                task=task,
                action_by=request.user,
                action_type='DOC_SUPERVISOR_REJECTED',
                note=note
            ))
            task.status = 'DOC_SUPERVISOR_REJECTED'
            task.modified_by = request.user
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'supervisor_note'])
            DocTaskHistory.objects.bulk_create(histories)
            
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
            histories.append(DocTaskHistory(
                task=task,
                action_by=request.user,
                action_type='DOC_MANAGER_REJECTED',
                note=note
            ))
            task.status = 'DOC_MANAGER_REJECTED'
            task.modified_by = request.user
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by', 'manager_note'])
            DocTaskHistory.objects.bulk_create(histories)
            
        return Response({'message': f'{len(histories)} رکورد به سرپرست اسناد (یا بررسی‌کننده) برگشت داده شد.'})

    @action(detail=False, methods=['post'])
    def bulk_manager_approve(self, request):
        task_ids = request.data.get('task_ids', [])
        if not task_ids:
            return Response({'error': 'هیچ رکوردی انتخاب نشده است.'}, status=400)
            
        tasks = DocTask.objects.filter(id__in=task_ids, status='DOC_MANAGER_REVIEW')
        
        from .models import DocTaskHistory, Item
        histories = []
        item_ids_to_update = []
        for task in tasks:
            histories.append(DocTaskHistory(
                task=task,
                action_by=request.user,
                action_type='DOC_FINAL_APPROVED',
                note=task.manager_note
            ))
            task.status = 'DOC_FINAL_APPROVED'
            task.modified_by = request.user
            item_ids_to_update.append(task.item_id)
            
        if tasks:
            DocTask.objects.bulk_update(tasks, ['status', 'modified_by'])
            DocTaskHistory.objects.bulk_create(histories)
            Item.objects.filter(id__in=item_ids_to_update).update(doc_status='approved')
            
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
        Item.objects.filter(id__in=item_ids).update(doc_status='checking', doc_assignee=None)
        
        return Response({'message': f'{deleted_count} وظیفه ارجاع اسناد با موفقیت لغو شد.'})


