from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WarehouseViewSet, SettingsViewSet

router = DefaultRouter()
router.register(r'', WarehouseViewSet)

urlpatterns = [
    path('<int:warehouse_id>/settings/', SettingsViewSet.as_view({'get': 'warehouse_settings', 'post': 'warehouse_settings', 'delete': 'warehouse_settings'})),
    path('', include(router.urls)),
]
