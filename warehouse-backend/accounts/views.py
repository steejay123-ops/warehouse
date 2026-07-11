from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import Group, Permission
from .models import CustomUser
from .serializers import UserSerializer, CustomTokenObtainPairSerializer, GroupSerializer, PermissionSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'success', 'is_active': user.is_active})

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({'error': 'رمز عبور فعلی نادرست است.'}, status=400)
            
        user.set_password(new_password)
        user.requires_password_change = False
        user.save()
        return Response({'success': True, 'message': 'رمز عبور با موفقیت تغییر یافت.'})

    @action(detail=False, methods=['post'])
    def update_preferences(self, request):
        user = request.user
        prefs = request.data.get('preferences', {})
        if isinstance(prefs, dict):
            # Update specific keys instead of overriding completely
            if not isinstance(user.ui_preferences, dict):
                user.ui_preferences = {}
            user.ui_preferences.update(prefs)
            user.save()
            return Response({'status': 'success', 'preferences': user.ui_preferences})
        return Response({'error': 'Invalid preferences format'}, status=400)

class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer

class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.filter(content_type__model__in=['customuser', 'group', 'warehouse', 'record'])
    serializer_class = PermissionSerializer

