<div dir="rtl" align="right">

# Task: Excel Dynamic Fields Fix

- `[ ]` Update `get_expected_fields` in `inventory/views.py`
  - `[ ]` Add `warehouse_id` parameter
  - `[ ]` Exclude `dynamic_data`
  - `[ ]` Add dynamic fields from `ItemFieldDefinition`
- `[ ]` Update `export_columns` in `inventory/views.py`
  - `[ ]` Exclude `dynamic_data`
- `[ ]` Update `download_template` in `inventory/views.py`
  - `[ ]` Pass `warehouse_id` to `get_expected_fields`
- `[ ]` Update `export_excel` in `inventory/views.py`
  - `[ ]` Extract values from `item.dynamic_data` for dynamic headers
- `[ ]` Update `parse_headers` and `import_excel` in `inventory/views.py`
  - `[ ]` Pass `warehouse_id` to `get_expected_fields`
  - `[ ]` Collect dynamic fields into `dynamic_data` dictionary before saving

</div>
