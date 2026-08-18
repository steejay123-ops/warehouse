from django.contrib import admin
from django.urls import path, include
from warehouses.views import SettingsViewSet, PublicConfigViewSet
from config.views_backup import BackupCreateView, BackupRestoreView

from django.conf import settings
from django.conf.urls.static import static
from django.urls import re_path
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/settings/global/', SettingsViewSet.as_view({'get': 'global_settings', 'post': 'global_settings'})),
    path('api/public/config/', PublicConfigViewSet.as_view({'get': 'list'})),
    path('api/backup/create/', BackupCreateView.as_view()),
    path('api/backup/restore/', BackupRestoreView.as_view()),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

