from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import Permission
from .models import CustomRole

class RoleInheritanceBackend(ModelBackend):
    """
    Custom authentication backend that extends ModelBackend.
    Overrides _get_group_permissions to include permissions from all descendant CustomRoles.
    """

    def _get_group_permissions(self, user_obj):
        if not user_obj.is_active or user_obj.is_anonymous:
            return Permission.objects.none()

        # Get all CustomRoles directly assigned to the user
        user_roles = CustomRole.objects.filter(user=user_obj)
        
        # Iteratively find all descendant roles
        all_ids = set(user_roles.values_list('id', flat=True))
        current_layer_ids = list(all_ids)
        
        while current_layer_ids:
            # Find children whose parent is in current_layer_ids, and exclude those already in all_ids to prevent infinite loops
            children_ids = CustomRole.objects.filter(parent_id__in=current_layer_ids).exclude(id__in=all_ids).values_list('id', flat=True)
            if not children_ids:
                break
            all_ids.update(children_ids)
            current_layer_ids = list(children_ids)

        # Return queryset of permissions linked to any of these roles
        return Permission.objects.filter(group__id__in=all_ids)
