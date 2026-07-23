<div dir="rtl" align="right">

- `[x]` 1. Create accounts/permissions.py
  - `[x]` 1.1 Implement HasMenuAccess
  - `[x]` 1.2 Implement IsAdminOrReadOnly
- `[x]` 2. Update config/settings.py
  - `[x]` 2.1 Set DEFAULT_PERMISSION_CLASSES to IsAuthenticated
- `[x]` 3. Update accounts/views.py
  - `[x]` 3.1 Apply permissions to UserViewSet
  - `[x]` 3.2 Apply permissions to GroupViewSet
  - `[x]` 3.3 Apply permissions to PermissionViewSet
- `[x]` 4. Update warehouses/views.py
  - `[x]` 4.1 Apply permissions to WarehouseViewSet
- `[x]` 5. Update inventory/views.py
  - `[x]` 5.1 Apply permissions to ItemViewSet
  - `[x]` 5.2 Apply permissions to CountTaskViewSet
- `[x]` 6. Verification
  - `[x]` 6.1 Verify API access limits

</div>
