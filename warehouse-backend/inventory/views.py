from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Item, ImportLog, ImportHistory
from .serializers import ItemSerializer
from django.forms.models import model_to_dict
from warehouses.models import Warehouse
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
        field_assignee_id = request.data.get('field_assignee') # Now expecting ID
        supervisor_id = request.data.get('supervisor_assignee') # New
        doc_assignee = request.data.get('doc_assignee') # Still text for now or ID?
        field_status = request.data.get('field_status')
        doc_status = request.data.get('doc_status')
        
        items = Item.objects.filter(id__in=ids)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        counter_user = None
        if field_assignee_id:
            try:
                counter_user = User.objects.get(id=field_assignee_id)
            except User.DoesNotExist:
                pass
                
        supervisor_user = None
        if supervisor_id:
            try:
                supervisor_user = User.objects.get(id=supervisor_id)
            except User.DoesNotExist:
                pass
        
        update_data = {}
        if counter_user:
            update_data['field_assignee'] = f"{counter_user.first_name} {counter_user.last_name}".strip() or counter_user.username
        if doc_assignee is not None:
            update_data['doc_assignee'] = doc_assignee
        if field_status is not None:
            update_data['field_status'] = field_status
        if doc_status is not None:
            update_data['doc_status'] = doc_status
            
        if update_data:
            update_data['updated_at'] = timezone.now()
            update_data['modified_by'] = request.user
            items.update(**update_data)
            
        # Create CountTasks if it's a field dispatch
        if counter_user and supervisor_user and field_status == 'counting':
            from .models import CountTask
            tasks_to_create = []
            for item in items:
                tasks_to_create.append(CountTask(
                    item=item,
                    counter=counter_user,
                    supervisor=supervisor_user,
                    status='PENDING_COUNT',
                    created_by=request.user,
                    modified_by=request.user
                ))
            if tasks_to_create:
                CountTask.objects.bulk_create(tasks_to_create)
            
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
        conflict_strategy = request.data.get('conflict_strategy', 'ignore')
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

from .serializers import CountTaskSerializer
from .models import CountTask
from rest_framework import permissions

class CountTaskViewSet(viewsets.ModelViewSet):
    serializer_class = CountTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = CountTask.objects.all().select_related('item', 'counter', 'supervisor', 'created_by', 'modified_by')
        
        # Managers and Admins see everything
        if user.is_superuser or user.groups.filter(name__in=['admin', 'manager']).exists():
            pass
        # Supervisors see COUNTED and MANAGER_REJECTED assigned to them
        elif user.groups.filter(name='supervisor').exists():
            queryset = queryset.filter(supervisor=user)
        # Counters see PENDING_COUNT and SUPERVISOR_REJECTED assigned to them
        elif user.groups.filter(name='counter').exists():
            queryset = queryset.filter(counter=user)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, modified_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(modified_by=self.request.user)
