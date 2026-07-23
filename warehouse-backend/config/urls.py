from django.contrib import admin
from django.urls import path, include
from warehouses.views import SettingsViewSet, PublicConfigViewSet

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/settings/global/', SettingsViewSet.as_view({'get': 'global_settings', 'post': 'global_settings'})),
    path('api/public/config/', PublicConfigViewSet.as_view({'get': 'list'})),
]
