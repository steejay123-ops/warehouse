"""
ماژول ابزارهای اکسل — کاربران (Users)
تولید فایل اکسل خروجی، فایل قالب نمونه، و خوانش/اعتبارسنجی فایل آپلودی
"""
import io
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from django.http import HttpResponse
from django.contrib.auth.models import Group

from .models import CustomUser
from warehouses.models import Warehouse


# ── Column Definitions ──────────────────────────────────────────────
USERS_COLUMNS = [
    {'header': 'نام (first_name)', 'field': 'first_name', 'width': 20},
    {'header': 'نام خانوادگی (last_name)', 'field': 'last_name', 'width': 20},
    {'header': 'شناسه ورود (username)', 'field': 'username', 'width': 20},
    {'header': 'کد ملی (national_code)', 'field': 'national_code', 'width': 18},
    {'header': 'تلفن (phone_number)', 'field': 'phone_number', 'width': 18},
    {'header': 'منطقه عملیاتی (operational_zone)', 'field': 'operational_zone', 'width': 22},
    {'header': 'نقش‌ها (roles)', 'field': 'roles', 'width': 30},
    {'header': 'انبارها (warehouses)', 'field': 'warehouses', 'width': 30},
    {'header': 'فعال (is_active)', 'field': 'is_active', 'width': 12},
]

MAX_IMPORT_ROWS = 500


def _apply_header_style(ws):
    """Apply professional styling to header row."""
    header_font = Font(name='B Nazanin', size=12, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='4F46E5', end_color='4F46E5', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    for col_idx, col_def in enumerate(USERS_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
        ws.column_dimensions[cell.column_letter].width = col_def['width']


def generate_users_excel(queryset):
    """
    Generate an Excel file from a User queryset.
    Returns an HttpResponse with the xlsx file attached.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = 'کاربران'
    ws.sheet_view.rightToLeft = True

    # Write headers
    for col_idx, col_def in enumerate(USERS_COLUMNS, 1):
        ws.cell(row=1, column=col_idx, value=col_def['header'])
    _apply_header_style(ws)

    # Write data rows
    data_font = Font(name='B Nazanin', size=11)
    data_alignment = Alignment(horizontal='right', vertical='center')

    for row_idx, user in enumerate(queryset, 2):
        # Get role names
        role_names = list(user.groups.values_list('name', flat=True))
        roles_str = ', '.join(role_names)

        # Get warehouse codes
        wh_codes = list(user.assigned_warehouses.values_list('code', flat=True))
        wh_str = ', '.join([c for c in wh_codes if c])

        row_data = [
            user.first_name or '',
            user.last_name or '',
            user.username or '',
            user.national_code or '',
            user.phone_number or '',
            user.operational_zone or '',
            roles_str,
            wh_str,
            'بله' if user.is_active else 'خیر',
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
    response['Content-Disposition'] = 'attachment; filename="users_export.xlsx"'
    return response


def generate_users_template():
    """
    Generate a template Excel file with headers and 2 sample rows.
    Returns an HttpResponse with the xlsx file attached.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = 'قالب کاربران'
    ws.sheet_view.rightToLeft = True

    # Write headers
    for col_idx, col_def in enumerate(USERS_COLUMNS, 1):
        ws.cell(row=1, column=col_idx, value=col_def['header'])
    _apply_header_style(ws)

    # Sample rows
    sample_data = [
        ['علی', 'محمدی', 'ali.mohammadi', '1234567890', '09121234567', 'تهران', 'operator', 'WH-1, WH-2', 'بله'],
        ['فاطمه', 'احمدی', 'fatemeh.ahmadi', '0987654321', '09351234567', 'اصفهان', 'supervisor', 'WH-3', 'بله'],
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
    response['Content-Disposition'] = 'attachment; filename="users_template.xlsx"'
    return response


def parse_users_excel(file):
    """
    Parse an uploaded Excel file and validate each row.
    Returns: { 'valid_rows': [...], 'errors': [...] }
    
    Each valid_row is a dict ready for user creation.
    Each error is: { 'row': int, 'field': str, 'message': str }
    """
    try:
        wb = load_workbook(file, read_only=True, data_only=True)
    except Exception:
        return {'valid_rows': [], 'errors': [{'row': 0, 'field': 'file', 'message': 'فایل اکسل معتبر نیست یا قابل خواندن نمی‌باشد.'}]}

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    if len(rows) > MAX_IMPORT_ROWS:
        return {'valid_rows': [], 'errors': [{'row': 0, 'field': 'file', 'message': f'حداکثر {MAX_IMPORT_ROWS} سطر قابل پردازش است. فایل شما {len(rows)} سطر دارد.'}]}

    # Pre-fetch existing usernames and national codes for duplicate checking
    existing_usernames = set(CustomUser.objects.values_list('username', flat=True))
    existing_national_codes = set(
        CustomUser.objects.exclude(national_code__isnull=True)
        .exclude(national_code='')
        .values_list('national_code', flat=True)
    )
    existing_roles = {g.name: g for g in Group.objects.all()}
    existing_warehouses = {w.code: w for w in Warehouse.objects.exclude(code__isnull=True)}

    valid_rows = []
    errors = []
    seen_usernames = set()
    seen_national_codes = set()

    for idx, row in enumerate(rows):
        row_num = idx + 2  # Excel row number (1-indexed, skip header)

        # Skip completely empty rows
        if not row or all(cell is None or str(cell).strip() == '' for cell in row):
            continue

        # Pad row to expected columns
        row = list(row) + [None] * (len(USERS_COLUMNS) - len(row))

        first_name = str(row[0] or '').strip()
        last_name = str(row[1] or '').strip()
        username = str(row[2] or '').strip()
        national_code = str(row[3] or '').strip() if row[3] else ''
        phone_number = str(row[4] or '').strip() if row[4] else ''
        operational_zone = str(row[5] or '').strip() if row[5] else ''
        roles_str = str(row[6] or '').strip() if row[6] else ''
        warehouses_str = str(row[7] or '').strip() if row[7] else ''
        is_active_str = str(row[8] or '').strip() if row[8] else 'بله'

        row_errors = []

        # ── Required fields ──
        if not first_name:
            row_errors.append({'row': row_num, 'field': 'first_name', 'message': 'نام الزامی است.'})
        if not last_name:
            row_errors.append({'row': row_num, 'field': 'last_name', 'message': 'نام خانوادگی الزامی است.'})
        if not username:
            row_errors.append({'row': row_num, 'field': 'username', 'message': 'شناسه ورود الزامی است.'})

        # ── Username uniqueness ──
        if username:
            if ' ' in username:
                row_errors.append({'row': row_num, 'field': 'username', 'message': 'شناسه ورود نباید شامل فاصله باشد.'})
            elif username in existing_usernames or username in seen_usernames:
                row_errors.append({'row': row_num, 'field': 'username', 'message': 'این شناسه ورود قبلاً ثبت شده است.'})
            else:
                seen_usernames.add(username)

        # ── National code validation ──
        if national_code:
            if not national_code.isdigit() or len(national_code) != 10:
                row_errors.append({'row': row_num, 'field': 'national_code', 'message': 'کد ملی باید دقیقاً ۱۰ رقم عددی باشد.'})
            elif national_code in existing_national_codes or national_code in seen_national_codes:
                row_errors.append({'row': row_num, 'field': 'national_code', 'message': 'این کد ملی قبلاً ثبت شده است.'})
            else:
                seen_national_codes.add(national_code)

        # ── Roles validation ──
        resolved_roles = []
        if roles_str:
            role_names = [r.strip() for r in roles_str.split(',') if r.strip()]
            for rname in role_names:
                if rname not in existing_roles:
                    row_errors.append({'row': row_num, 'field': 'roles', 'message': f'نقش «{rname}» در سیستم وجود ندارد.'})
                else:
                    resolved_roles.append(existing_roles[rname])

        # ── Warehouses validation ──
        resolved_warehouses = []
        if warehouses_str:
            wh_codes = [w.strip() for w in warehouses_str.split(',') if w.strip()]
            for wcode in wh_codes:
                if wcode not in existing_warehouses:
                    row_errors.append({'row': row_num, 'field': 'warehouses', 'message': f'انبار با کد «{wcode}» در سیستم وجود ندارد.'})
                else:
                    resolved_warehouses.append(existing_warehouses[wcode])

        # ── is_active parsing ──
        is_active = True
        if is_active_str.lower() in ('خیر', '0', 'no', 'false'):
            is_active = False

        if row_errors:
            errors.extend(row_errors)
        else:
            valid_rows.append({
                'first_name': first_name,
                'last_name': last_name,
                'username': username,
                'national_code': national_code or None,
                'phone_number': phone_number or None,
                'operational_zone': operational_zone or None,
                'is_active': is_active,
                'roles': resolved_roles,
                'warehouses': resolved_warehouses,
            })

    wb.close()
    return {'valid_rows': valid_rows, 'errors': errors}
