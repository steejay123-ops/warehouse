from django.contrib import admin
from django.urls import path, include
from warehouses.views import SettingsViewSet, PublicConfigViewSet
from config.views_backup import (
    BackupCreateView,
    BackupRestoreView,
    SnapshotListView,
    SnapshotCreateView,
    SnapshotRollbackView,
    SnapshotSummaryView
)

from django.urls import re_path
from common.media_urls import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/personnel/', include('personnel.urls')),
    path('api/communications/', include('communications.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/settings/global/', SettingsViewSet.as_view({'get': 'global_settings', 'post': 'global_settings'})),
    path('api/public/config/', PublicConfigViewSet.as_view({'get': 'list'})),
    path('api/backup/create/', BackupCreateView.as_view()),
    path('api/backup/restore/', BackupRestoreView.as_view()),
    path('api/backup/snapshots/', SnapshotListView.as_view(), name='snapshot_list'),
    path('api/backup/snapshots/create/', SnapshotCreateView.as_view(), name='snapshot_create'),
    path('api/backup/snapshots/rollback/', SnapshotRollbackView.as_view(), name='snapshot_rollback'),
    path('api/backup/snapshots/summary/', SnapshotSummaryView.as_view(), name='snapshot_summary'),
    # عکس کالا امضای معتبر می‌خواهد؛ بقیه رسانه‌ها مثل قبل. مسیر `static()`
    # پیشین حذف شد چون در حالت DEBUG یک مسیر سروِ بی‌امضا اضافه می‌کرد.
    re_path(r'^media/(?P<path>.*)$', serve_media),
]

