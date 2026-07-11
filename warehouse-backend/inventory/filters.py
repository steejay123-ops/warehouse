import django_filters
from .models import Item
from django.db.models import Q

class CharInFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass

class ItemFilter(django_filters.FilterSet):
    # Multiple choice filters
    field_assignee__in = CharInFilter(field_name='field_assignee', lookup_expr='in')
    doc_assignee__in = CharInFilter(field_name='doc_assignee', lookup_expr='in')
    field_status__in = CharInFilter(field_name='field_status', lookup_expr='in')
    doc_status__in = CharInFilter(field_name='doc_status', lookup_expr='in')
    labelStatus__in = CharInFilter(field_name='tag_status', lookup_expr='in')
    tag_status__in = CharInFilter(field_name='tag_status', lookup_expr='in')

    # Date ranges
    created_at_after = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_at_before = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    updated_at_after = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='gte')
    updated_at_before = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='lte')
    hov_date_after = django_filters.DateFilter(field_name='hov_date', lookup_expr='gte')
    hov_date_before = django_filters.DateFilter(field_name='hov_date', lookup_expr='lte')

    
    # Text search
    description = django_filters.CharFilter(lookup_expr='icontains')
    tag = django_filters.CharFilter(lookup_expr='icontains')
    fa_unic_code = django_filters.CharFilter(lookup_expr='icontains')
    plpkitem = django_filters.CharFilter(lookup_expr='icontains')
    old_location = django_filters.CharFilter(lookup_expr='icontains')
    new_location = django_filters.CharFilter(lookup_expr='icontains')
    
    # Text search for other fields (icontains)
    item_no = django_filters.CharFilter(lookup_expr='icontains')
    unit = django_filters.CharFilter(lookup_expr='icontains')
    scope_discipline = django_filters.CharFilter(lookup_expr='icontains')
    vendor = django_filters.CharFilter(lookup_expr='icontains')
    supplier = django_filters.CharFilter(lookup_expr='icontains')
    irn_no = django_filters.CharFilter(lookup_expr='icontains')
    po = django_filters.CharFilter(lookup_expr='icontains')
    pk_number = django_filters.CharFilter(lookup_expr='icontains')
    pl = django_filters.CharFilter(lookup_expr='icontains')
    item2 = django_filters.CharFilter(lookup_expr='icontains')
    indent = django_filters.CharFilter(lookup_expr='icontains')
    remark = django_filters.CharFilter(lookup_expr='icontains')
    price_remark = django_filters.CharFilter(lookup_expr='icontains')
    issue_remark = django_filters.CharFilter(lookup_expr='icontains')
    customs_field = django_filters.CharFilter(lookup_expr='icontains')
    hov_no = django_filters.CharFilter(lookup_expr='icontains')
    msr_status = django_filters.CharFilter(lookup_expr='icontains')
    inventory_status = django_filters.CharFilter(lookup_expr='icontains')
    currency = django_filters.CharFilter(lookup_expr='icontains')
    invoice_file = django_filters.CharFilter(lookup_expr='icontains')
    invoice_page = django_filters.CharFilter(lookup_expr='icontains')
    customs_file = django_filters.CharFilter(lookup_expr='icontains')
    customs_file_page = django_filters.CharFilter(lookup_expr='icontains')
    
    # Exact matches for numeric fields
    balance = django_filters.NumberFilter(lookup_expr='exact')
    bal4miv = django_filters.NumberFilter(lookup_expr='exact')
    price_amount = django_filters.NumberFilter(lookup_expr='exact')
    
    # Number ranges
    balance_min = django_filters.NumberFilter(field_name='balance', lookup_expr='gte')
    balance_max = django_filters.NumberFilter(field_name='balance', lookup_expr='lte')
    
    class Meta:
        model = Item
        fields = {
            'warehouse': ['exact'],
            'field_assignee': ['exact', 'isnull'],
            'doc_assignee': ['exact', 'isnull'],
            'field_status': ['exact', 'in'],
            'doc_status': ['exact', 'in'],
            'tag_status': ['exact', 'in'],
            'has_conflict': ['exact'],
            'needs_qc': ['exact'],
            'is_fragile': ['exact'],
            'is_heavy': ['exact'],
        }
