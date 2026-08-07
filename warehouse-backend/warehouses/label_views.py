from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Q

from .models import LabelTemplate
from .label_serializers import LabelTemplateSerializer
from inventory.models import Item, ItemFieldDefinition


class LabelTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = LabelTemplateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = LabelTemplate.objects.all()
        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            # Return warehouse-specific OR global templates.
            # NOTE: warehouse_id__in=[x, None] does NOT work for NULL in SQL.
            # Must use Q objects: WHERE warehouse_id = x OR warehouse_id IS NULL
            qs = qs.filter(
                Q(warehouse_id=warehouse_id) | Q(warehouse__isnull=True)
            )
        return qs

    def perform_destroy(self, instance):
        """
        اگر کاربر از منوی انبار سعی کند لیبل Global را حذف کند، رد شود.
        لیبل Global فقط از context Global (بدون warehouse param) قابل حذف است.
        """
        warehouse_id = self.request.query_params.get('warehouse')
        if instance.warehouse is None and warehouse_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'لیبل‌های Global از منوی انبار قابل حذف نیستند. '
                'برای حذف، از منوی تنظیمات اصلی اقدام کنید.'
            )
        super().perform_destroy(instance)

    def perform_update(self, serializer):
        """
        اگر کاربر از منوی انبار سعی کند لیبل Global را ویرایش کند، رد شود.
        برای سفارشی‌سازی از دکمه «کپی به این انبار» استفاده کنید.
        """
        warehouse_id = self.request.query_params.get('warehouse')
        instance = self.get_object()
        if instance.warehouse is None and warehouse_id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                'لیبل‌های Global از منوی انبار قابل ویرایش نیستند. '
                'از دکمه «کپی به این انبار» استفاده کنید.'
            )
        serializer.save()

    @action(detail=True, methods=['post'], url_path='copy-to-warehouse')
    def copy_to_warehouse(self, request, pk=None):
        """
        یک لیبل (Global یا انبار دیگر) را با نام جدید برای انبار مشخص کپی می‌کند.
        Body: { warehouse_id: int, name: str (optional) }
        """
        source = self.get_object()
        target_warehouse_id = request.data.get('warehouse_id')
        new_name = request.data.get('name', f'کپی {source.name}')

        if not target_warehouse_id:
            return Response(
                {'error': 'warehouse_id الزامی است.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # بررسی مجوز ویرایش انبار
        if not request.user.has_perm('accounts.perm_wh_edit') and not request.user.is_superuser:
            return Response({'error': 'Unauthorized'}, status=403)

        import copy as copy_module
        cloned = LabelTemplate.objects.create(
            warehouse_id=target_warehouse_id,
            name=new_name,
            width_mm=source.width_mm,
            height_mm=source.height_mm,
            qr_source_field=source.qr_source_field,
            elements=copy_module.deepcopy(source.elements),
            paper_type=source.paper_type,
            grid_rows=source.grid_rows,
            grid_cols=source.grid_cols,
            margin_mm=source.margin_mm,
            is_active=False,  # کپی به‌صورت پیش‌فرض غیرفعال است
        )

        serializer = self.get_serializer(cloned)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='active')
    def get_active(self, request):
        """
        Get the active template for a warehouse (with fallback to global).
        ?warehouse=<id>
        """
        warehouse_id = request.query_params.get('warehouse')

        template = None
        if warehouse_id:
            # Try warehouse-specific first
            template = LabelTemplate.objects.filter(
                warehouse_id=warehouse_id, is_active=True
            ).first()

        if not template:
            # Fallback to global
            template = LabelTemplate.objects.filter(
                warehouse__isnull=True, is_active=True
            ).first()

        if template:
            return Response(self.get_serializer(template).data)
        return Response(None, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='available-fields')
    def available_fields(self, request):
        """
        Returns all fields available for label design:
        - Static Item model fields
        - Dynamic fields for the warehouse
        - Special fields (print date, warehouse name, etc.)
        """
        warehouse_id = request.query_params.get('warehouse')

        fields = []

        # 1. Static Item model fields
        static_fields = [
            {'key': 'fa_unic_code', 'label': 'کد یکتا (FA-UNIC)', 'group': 'شناسه‌ها'},
            {'key': 'plpkitem', 'label': 'کد ترکیبی PL-PK-Item', 'group': 'شناسه‌ها'},
            {'key': 'pl', 'label': 'پکینگ لیست (PL)', 'group': 'شناسه‌ها'},
            {'key': 'po', 'label': 'سفارش خرید (PO)', 'group': 'شناسه‌ها'},
            {'key': 'pk_number', 'label': 'پکیج (PK)', 'group': 'شناسه‌ها'},
            {'key': 'item_no', 'label': 'ردیف (Item)', 'group': 'شناسه‌ها'},
            {'key': 'description', 'label': 'شرح کالا', 'group': 'مشخصات'},
            {'key': 'unit', 'label': 'واحد سنجش', 'group': 'مشخصات'},
            {'key': 'scope_discipline', 'label': 'دیسیپلین کاری', 'group': 'مشخصات'},
            {'key': 'inventory', 'label': 'موجودی فیزیکی', 'group': 'مقادیر'},
            {'key': 'bal4miv', 'label': 'موجودی مجاز MIV', 'group': 'مقادیر'},
            {'key': 'old_location', 'label': 'لوکیشن قبلی', 'group': 'مکان'},
            {'key': 'new_location', 'label': 'لوکیشن جدید', 'group': 'مکان'},
            {'key': 'hov_no', 'label': 'شماره HOV', 'group': 'تدارکات'},
            {'key': 'vendor', 'label': 'سازنده (Vendor)', 'group': 'تدارکات'},
            {'key': 'supplier', 'label': 'تامین‌کننده (Supplier)', 'group': 'تدارکات'},
            {'key': 'irn_no', 'label': 'شماره IRN', 'group': 'تدارکات'},
            {'key': 'my_tag', 'label': 'تگ‌ها', 'group': 'سایر'},
            {'key': 'remark', 'label': 'ملاحظات', 'group': 'سایر'},
        ]
        fields.extend(static_fields)

        # 2. Dynamic fields for this warehouse
        if warehouse_id:
            dynamic_defs = ItemFieldDefinition.objects.filter(
                warehouse_id=warehouse_id, is_active=True
            )
            for d in dynamic_defs:
                fields.append({
                    'key': f'dynamic__{d.name}',
                    'label': f'{d.label} (پویا)',
                    'group': 'فیلدهای پویا'
                })

        # 3. Special fields
        special_fields = [
            {'key': '__print_date__', 'label': 'تاریخ و ساعت چاپ (شمسی)', 'group': 'ویژه'},
            {'key': '__warehouse_name__', 'label': 'نام انبار', 'group': 'ویژه'},
            {'key': '__project_name__', 'label': 'نام پروژه', 'group': 'ویژه'},
            {'key': '__custom_remark__', 'label': 'توضیحات لحظه‌ای (هنگام چاپ)', 'group': 'ویژه'},
        ]
        fields.extend(special_fields)

        return Response(fields)

    @action(detail=False, methods=['post'], url_path='generate-pdf')
    def generate_pdf(self, request):
        """
        Generate a PDF with labels for the given items using the specified template.
        Body: { template_id: int, item_ids: [int, ...] }
        """
        template_id = request.data.get('template_id')
        items_config = request.data.get('items_config', [])
        custom_remark = request.data.get('custom_remark', '')
        print_settings = request.data.get('print_settings', {})

        # Fallback for old API format
        if not items_config:
            item_ids = request.data.get('item_ids', [])
            items_config = [{'id': i, 'quantity': 1} for i in item_ids]

        if not template_id or not items_config:
            return Response(
                {'error': 'template_id و رکوردها الزامی هستند.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            template = LabelTemplate.objects.get(id=template_id)
        except LabelTemplate.DoesNotExist:
            return Response(
                {'error': 'قالب لیبل یافت نشد.'},
                status=status.HTTP_404_NOT_FOUND
            )

        item_ids = [conf['id'] for conf in items_config]
        items_qs = Item.objects.filter(id__in=item_ids).select_related('warehouse')
        if not items_qs.exists():
            return Response(
                {'error': 'رکوردی یافت نشد.'},
                status=status.HTTP_404_NOT_FOUND
            )

        items_map = {item.id: item for item in items_qs}
        collation = print_settings.get('collation', 'group')
        
        final_items = []
        if collation == 'collate':
            # Collate mode: A,B, A,B, A,B
            max_qty = max((int(conf.get('quantity', 1)) for conf in items_config), default=1)
            for round_i in range(max_qty):
                for conf in items_config:
                    if round_i < int(conf.get('quantity', 1)):
                        item = items_map.get(conf['id'])
                        if item:
                            final_items.append(item)
        else:
            # Group mode (default): A,A,A, B,B,B
            for conf in items_config:
                item = items_map.get(conf['id'])
                if item:
                    qty = int(conf.get('quantity', 1))
                    for _ in range(qty):
                        final_items.append(item)

        from .label_pdf_generator import LabelPdfGenerator
        generator = LabelPdfGenerator(template, final_items, custom_remark=custom_remark, print_settings=print_settings)
        pdf_buffer = generator.generate()

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="labels_{template_id}.pdf"'
        return response
