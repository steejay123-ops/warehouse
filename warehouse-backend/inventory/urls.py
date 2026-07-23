from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ItemViewSet, CountTaskViewSet, DocTaskViewSet

router = DefaultRouter()
router.register(r'count-tasks', CountTaskViewSet, basename='counttask')
router.register(r'doc-tasks', DocTaskViewSet, basename='doctask')
router.register(r'items', ItemViewSet, basename='item')

urlpatterns = [
    path('', include(router.urls)),
]
