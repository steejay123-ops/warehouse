"""
ماژول ابزارهای اکسل — نقش‌ها (Roles)
تولید فایل اکسل خروجی، فایل قالب نمونه، و خوانش/اعتبارسنجی فایل آپلودی
"""
import io
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from django.http import HttpResponse
from django.contrib.auth.models import Permission

from .models import CustomRole


# ── Column Definitions ──────────────────────────────────────────────
ROLES_COLUMNS = [
    {'header': 'نام سیستمی (name)', 'field': 'name', 'width': 25},
    {'header': 'عنوان فارسی (title)', 'field': 'title', 'width': 25},
    {'header': 'رنگ (color)', 'field': 'color', 'width': 15},
    {'header': 'نقش والد (parent)', 'field': 'parent', 'width': 25},
    {'header': 'دسترسی‌ها (permissions)', 'field': 'permissions', 'width': 60},
]

MAX_IMPORT_ROWS = 500


def _apply_header_style(ws):
    """Apply professional styling to header row."""
    header_font = Font(name='B Nazanin', size=12, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='7C3AED', end_color='7C3AED', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    for col_idx, col_def in enumerate(ROLES_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
        ws.column_dimensions[cell.column_letter].width = col_def['width']


def generate_roles_excel(queryset):
    """
    Generate an Excel file from a CustomRole queryset.
    Returns an HttpResponse with the xlsx file attached.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = 'نقش‌ها'
    ws.sheet_view.rightToLeft = True

    # Write headers
    for col_idx, col_def in enumerate(ROLES_COLUMNS, 1):
        ws.cell(row=1, column=col_idx, value=col_def['header'])
    _apply_header_style(ws)

    # Write data rows
    data_font = Font(name='B Nazanin', size=11)
    data_alignment = Alignment(horizontal='right', vertical='center')

    for row_idx, role in enumerate(queryset, 2):
        # Get parent name
        parent_name = role.parent.name if role.parent else ''

        # Get permission codenames
        perm_codenames = list(role.permissions.values_list('codename', flat=True))
        perms_str = ', '.join(perm_codenames)

        row_data = [
            role.name or '',
            role.title or '',
            role.color or '#94a3b8',
            parent_name,
            perms_str,
        ]
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = data_font
            cell.alignment = data_alignment

    # Save to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="roles_export.xlsx"'
    return response


def generate_roles_template():
    """
    Generate a template Excel file with headers and 2 sample rows.
    Returns an HttpResponse with the xlsx file attached.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = 'قالب نقش‌ها'
    ws.sheet_view.rightToLeft = True

    # Write headers
    for col_idx, col_def in enumerate(ROLES_COLUMNS, 1):
        ws.cell(row=1, column=col_idx, value=col_def['header'])
    _apply_header_style(ws)

    # Sample rows
    sample_data = [
        ['operator', 'اپراتور انبار', '#22c55e', '', 'view_wh_dashboard, view_wh_docs'],
        ['supervisor', 'سرپرست شمارش', '#f59e0b', 'operator', 'view_sys_supervisor, view_wh_dashboard'],
    ]
    note_font = Font(name='B Nazanin', size=11, italic=True, color='6B7280')
    data_alignment = Alignment(horizontal='right', vertical='center')

    for row_idx, row in enumerate(sample_data, 2):
        for col_idx, value in enumerate(row, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = note_font
            cell.alignment = data_alignment

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="roles_template.xlsx"'
    return response


def parse_roles_excel(file):
    """
    Parse an uploaded Excel file and validate each row.
    Returns: { 'valid_rows': [...], 'errors': [...] }
    """
    try:
        wb = load_workbook(file, read_only=True, data_only=True)
    except Exception:
        return {'valid_rows': [], 'errors': [{'row': 0, 'field': 'file', 'message': 'فایل اکسل معتبر نیست یا قابل خواندن نمی‌باشد.'}]}

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    if len(rows) > MAX_IMPORT_ROWS:
        return {'valid_rows': [], 'errors': [{'row': 0, 'field': 'file', 'message': f'حداکثر {MAX_IMPORT_ROWS} سطر قابل پردازش است. فایل شما {len(rows)} سطر دارد.'}]}

    # Pre-fetch existing data
    existing_role_names = set(CustomRole.objects.values_list('name', flat=True))
    all_permissions = {p.codename: p for p in Permission.objects.all()}
    # Build a map of role names for parent resolution (including roles from this file)
    existing_roles_map = {r.name: r for r in CustomRole.objects.all()}

    valid_rows = []
    errors = []
    seen_names = set()
    # Track new role names added in this import for parent resolution
    new_role_names_in_file = set()

    # First pass: collect all role names in file for parent resolution
    for row in rows:
        if row and row[0]:
            new_role_names_in_file.add(str(row[0]).strip())

    for idx, row in enumerate(rows):
        row_num = idx + 2

        # Skip completely empty rows
        if not row or all(cell is None or str(cell).strip() == '' for cell in row):
            continue

        # Pad row
        row = list(row) + [None] * (len(ROLES_COLUMNS) - len(row))

        name = str(row[0] or '').strip()
        title = str(row[1] or '').strip()
        color = str(row[2] or '#94a3b8').strip()
        parent_name = str(row[3] or '').strip() if row[3] else ''
        perms_str = str(row[4] or '').strip() if row[4] else ''

        row_errors = []

        # ── Required fields ──
        if not name:
            row_errors.append({'row': row_num, 'field': 'name', 'message': 'نام سیستمی نقش الزامی است.'})
        if not title:
            row_errors.append({'row': row_num, 'field': 'title', 'message': 'عنوان فارسی نقش الزامی است.'})

        # ── Name uniqueness ──
        if name:
            if ' ' in name:
                row_errors.append({'row': row_num, 'field': 'name', 'message': 'نام سیستمی نباید شامل فاصله باشد.'})
            elif name in existing_role_names or name in seen_names:
                row_errors.append({'row': row_num, 'field': 'name', 'message': 'این نام سیستمی قبلاً ثبت شده است.'})
            else:
                seen_names.add(name)

        # ── Color validation ──
        if color and not color.startswith('#'):
            color = '#94a3b8'

        # ── Parent validation ──
        resolved_parent_name = None
        if parent_name:
            if parent_name not in existing_roles_map and parent_name not in new_role_names_in_file:
                row_errors.append({'row': row_num, 'field': 'parent', 'message': f'نقش والد «{parent_name}» در سیستم وجود ندارد.'})
            else:
                resolved_parent_name = parent_name

        # ── Permissions validation ──
        resolved_permissions = []
        if perms_str:
            perm_codenames = [p.strip() for p in perms_str.split(',') if p.strip()]
            for pcode in perm_codenames:
                if pcode not in all_permissions:
                    row_errors.append({'row': row_num, 'field': 'permissions', 'message': f'دسترسی «{pcode}» در سیستم وجود ندارد.'})
                else:
                    resolved_permissions.append(all_permissions[pcode])

        if row_errors:
            errors.extend(row_errors)
        else:
            valid_rows.append({
                'name': name,
                'title': title,
                'color': color,
                'parent_name': resolved_parent_name,
                'permissions': resolved_permissions,
            })

    wb.close()
    return {'valid_rows': valid_rows, 'errors': errors}
