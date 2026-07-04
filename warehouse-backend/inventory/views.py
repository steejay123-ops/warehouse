from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import Record
from .serializers import RecordSerializer

class RecordViewSet(viewsets.ModelViewSet):
    queryset = Record.objects.all()
    serializer_class = RecordSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['warehouse', 'category', 'assigned_to', 'field_status', 'tag_status']
    search_fields = ['id', 'part_no', 'mesc', 'desc']
    ordering_fields = ['id', 'created_at']

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        ids = request.data.get('ids', [])
        assignee = request.data.get('assignee')
        records = Record.objects.filter(id__in=ids)
        records.update(assigned_to=assignee)
        return Response({'status': 'success', 'updated': records.count()})

    @action(detail=False, methods=['post'])
    def bulk_tag(self, request):
        ids = request.data.get('ids', [])
        tag = request.data.get('tag')
        records = Record.objects.filter(id__in=ids)
        if tag == 'conflict':
            records.update(has_conflict=True)
        elif tag == 'fragile':
            records.update(is_fragile=True)
        elif tag == 'heavy':
            records.update(is_heavy=True)
        elif tag == 'qc':
            records.update(needs_qc=True)
        return Response({'status': 'success', 'updated': records.count()})
