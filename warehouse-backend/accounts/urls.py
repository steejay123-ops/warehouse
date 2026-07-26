from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, CustomTokenObtainPairView, CustomRoleViewSet, PermissionViewSet, UserTableViewStateViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'roles', CustomRoleViewSet, basename='role')
router.register(r'permissions', PermissionViewSet, basename='permission')
router.register(r'table-views', UserTableViewStateViewSet, basename='table-view')

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
