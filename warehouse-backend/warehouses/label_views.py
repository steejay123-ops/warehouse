from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse

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
            # Return warehouse-specific OR global templates
            qs = qs.filter(warehouse_id__in=[warehouse_id, None])
        return qs

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
            {'key': 'balance', 'label': 'موجودی فیزیکی', 'group': 'مقادیر'},
            {'key': 'bal4miv', 'label': 'موجودی مجاز MIV', 'group': 'مقادیر'},
            {'key': 'old_location', 'label': 'لوکیشن قبلی', 'group': 'مکان'},
            {'key': 'new_location', 'label': 'لوکیشن جدید', 'group': 'مکان'},
            {'key': 'hov_no', 'label': 'شماره HOV', 'group': 'تدارکات'},
            {'key': 'vendor', 'label': 'سازنده (Vendor)', 'group': 'تدارکات'},
            {'key': 'supplier', 'label': 'تامین‌کننده (Supplier)', 'group': 'تدارکات'},
            {'key': 'irn_no', 'label': 'شماره IRN', 'group': 'تدارکات'},
            {'key': 'tag', 'label': 'تگ‌ها', 'group': 'سایر'},
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
        item_ids = request.data.get('item_ids', [])

        if not template_id or not item_ids:
            return Response(
                {'error': 'template_id و item_ids الزامی هستند.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            template = LabelTemplate.objects.get(id=template_id)
        except LabelTemplate.DoesNotExist:
            return Response(
                {'error': 'قالب لیبل یافت نشد.'},
                status=status.HTTP_404_NOT_FOUND
            )

        items = Item.objects.filter(id__in=item_ids).select_related('warehouse')
        if not items.exists():
            return Response(
                {'error': 'رکوردی یافت نشد.'},
                status=status.HTTP_404_NOT_FOUND
            )

        from .label_pdf_generator import LabelPdfGenerator
        generator = LabelPdfGenerator(template, list(items))
        pdf_buffer = generator.generate()

        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="labels_{template_id}.pdf"'
        return response
