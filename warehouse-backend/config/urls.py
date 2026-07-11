from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/warehouses/', include('warehouses.urls')),
    path('api/inventory/items/', include('inventory.urls')),
]
