"""
خروجی Excel گزارش‌ساز — ترکیبی، بدون سقف ردیف و با استایل

- نتایج کوچک (تا SYNC_ROW_LIMIT): تولید همزمان و دانلود فوری (با ردیف‌های زبرا).
- نتایج بزرگ: ReportExportJob — اگر worker جدا (run_export_worker) زنده باشد job
  فقط در صف می‌ماند و worker برمی‌دارد؛ وگرنه fallback به threading.Thread فعلی.
  فایل با Workbook(write_only=True) و iterator(chunk_size) ساخته می‌شود
  (مصرف RAM ثابت)، فرانت درصد پیشرفت را poll می‌کند و در پایان دانلود streaming
  انجام می‌شود. به این ترتیب هیچ درخواست HTTP طولانی‌ای نداریم و تایم‌اوت
  Cloudflare Tunnel بی‌اثر است.

استایل در حالت write_only فقط از طریق WriteOnlyCell ممکن است و
column_dimensions باید قبل از append اولین ردیف ست شود. freeze_panes و
auto_filter بین نسخه‌های openpyxl رفتار متفاوتی در این حالت دارند → try/except.
"""
import datetime as _dt
import threading
import uuid
from decimal import Decimal

import openpyxl
from openpyxl.cell import WriteOnlyCell
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.views import Pane
from django.db import connection
from django.db.models import Q
from django.utils import timezone

from django.http import HttpResponse

from .models import ExportWorkerStatus, ReportExportJob

SYNC_ROW_LIMIT = 10_000
CHUNK_SIZE = 2000
WORKER_ALIVE_WINDOW = 15  # ثانیه — نبض تازه‌تر از این یعنی worker زنده است

# ─── استایل‌ها (هم‌رنگ پالت indigo/slate رابط کاربری) ───
_HEADER_FILL = PatternFill('solid', fgColor='4F46E5')
_HEADER_FONT = Font(bold=True, color='FFFFFF', size=11)
_KEY_FONT = Font(italic=True, color='94A3B8', size=9)
_TITLE_FONT = Font(bold=True, size=13, color='1E293B')
_ZEBRA_FILL = PatternFill('solid', fgColor='F1F5F9')
_THIN = Side(style='thin', color='CBD5E1')
_HEADER_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)
_CENTER = Alignment(horizontal='center', vertical='center')

_NUMBER_FORMATS = {
    'number': '#,##0.###',
    'date': 'yyyy/mm/dd',
    'datetime': 'yyyy/mm/dd hh:mm',
}

_COL_WIDTHS = {
    'boolean': 10,
    'number': 14,
    'date': 14,
    'datetime': 19,
    'choice': 16,
    'text': 25,
}


def _jalali_now_str():
    now = timezone.localtime()
    try:
        import jdatetime
        return jdatetime.datetime.fromgregorian(datetime=now).strftime('%Y/%m/%d %H:%M')
    except ImportError:
        return now.strftime('%Y-%m-%d %H:%M')


def _cell_value(v):
    if v is None:
        return ''
    if isinstance(v, bool):
        return 'بله' if v else 'خیر'
    if isinstance(v, (int, float, Decimal)):
        return v
    if isinstance(v, _dt.datetime):
        # Excel از datetime آگاه از timezone پشتیبانی نمی‌کند
        if timezone.is_aware(v):
            v = timezone.localtime(v).replace(tzinfo=None)
        return v
    if isinstance(v, _dt.date):
        return v
    if hasattr(v, 'isoformat'):
        return v.isoformat()
    return str(v)


def _styled_cell(ws, value, number_format=None, fill=None):
    c = WriteOnlyCell(ws, value=value)
    if number_format and not isinstance(value, str):
        c.number_format = number_format
    if fill is not None:
        c.fill = fill
    return c


def _write_workbook(ws_target, qs, columns, progress_cb=None, total=0,
                    report_name='گزارش', zebra=False):
    """
    نوشتن شیت کامل: عنوان + دو ردیف سربرگ (برچسب فارسی/کلید سیستمی) + داده.
    zebra فقط برای نتایج کوچک (هزینه WriteOnlyCell به‌ازای هر سلول).
    """
    # عرض ستون‌ها و فریز — الزاماً قبل از append اولین ردیف؛ در write_only
    # عناصر cols/sheetViews فقط قبل از sheetData نوشته می‌شوند و مقدار
    # ws.freeze_panes بی‌صدا گم می‌شود (openpyxl 3.1.5) → Pane مستقیم.
    for i, c in enumerate(columns, start=1):
        ws_target.column_dimensions[get_column_letter(i)].width = (
            _COL_WIDTHS.get(c.get('type'), 25)
        )
    try:
        ws_target.sheet_view.pane = Pane(
            topLeftCell='A4', ySplit=3, state='frozen', activePane='bottomLeft',
        )
    except Exception:
        pass  # پشتیبانی write_only بین نسخه‌ها فرق دارد — حیاتی نیست

    # ردیف ۱: عنوان (ادغام سلول در write_only ممکن نیست — فقط سلول اول)
    title = _styled_cell(ws_target, f'{report_name} — {_jalali_now_str()}')
    title.font = _TITLE_FONT
    ws_target.append([title])

    # ردیف ۲: برچسب فارسی
    header_row = []
    for c in columns:
        cell = _styled_cell(ws_target, c['label'])
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.border = _HEADER_BORDER
        cell.alignment = _CENTER
        header_row.append(cell)
    ws_target.append(header_row)

    # ردیف ۳: کلید سیستمی (برای import/دیباگ)
    key_row = []
    for c in columns:
        cell = _styled_cell(ws_target, c['key'])
        cell.font = _KEY_FONT
        cell.alignment = _CENTER
        key_row.append(cell)
    ws_target.append(key_row)

    keys = [c['key'] for c in columns]
    formats = [_NUMBER_FORMATS.get(c.get('type')) for c in columns]
    needs_cell = [f is not None for f in formats]

    written = 0
    for row in qs.iterator(chunk_size=CHUNK_SIZE):
        fill = _ZEBRA_FILL if (zebra and written % 2 == 1) else None
        out = []
        for j, k in enumerate(keys):
            v = _cell_value(row.get(k))
            if fill is not None or needs_cell[j]:
                out.append(_styled_cell(ws_target, v, number_format=formats[j], fill=fill))
            else:
                out.append(v)
        ws_target.append(out)
        written += 1
        if progress_cb and written % CHUNK_SIZE == 0:
            progress_cb(written, total)
    if progress_cb:
        progress_cb(written, total)

    # فیلتر روی محدوده داده (سربرگ فیلتر = ردیف کلیدها) — بعد از داده مجاز است
    last_col = get_column_letter(len(columns)) if columns else 'A'
    try:
        ws_target.auto_filter.ref = f'A3:{last_col}{3 + written}'
    except Exception:
        pass
    return written


def _make_workbook():
    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet(title='Report')
    try:
        ws.sheet_view.rightToLeft = True
    except Exception:
        pass  # در حالت write_only بعضی نسخه‌ها sheet_view ندارند — حیاتی نیست
    return wb, ws


def sync_excel_response(qs, columns, filename='report.xlsx', report_name='گزارش'):
    """تولید همزمان برای نتایج کوچک — دانلود فوری."""
    wb, ws = _make_workbook()
    _write_workbook(ws, qs, columns, report_name=report_name, zebra=True)
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response


def worker_alive():
    """آیا worker جدا (run_export_worker) نبض تازه دارد؟"""
    st = ExportWorkerStatus.objects.filter(pk=1).first()
    if st is None:
        return False
    return (timezone.now() - st.alive_at).total_seconds() < WORKER_ALIVE_WINDOW


def start_export_job(user, spec, report_name, total_rows):
    """
    ساخت job. اگر worker زنده باشد job در صف می‌ماند تا worker بردارد
    (پایدار در برابر ری‌استارت)؛ وگرنه fallback به thread پس‌زمینه فعلی.
    """
    job = ReportExportJob.objects.create(
        owner=user, spec=spec, report_name=report_name or 'report',
        status='pending', total_rows=total_rows,
    )
    if not worker_alive():
        t = threading.Thread(target=_run_export_job, args=(job.pk, user.pk), daemon=True)
        t.start()
    return job


def _run_export_job(job_pk, user_pk):
    """بدنه پردازش (thread یا worker) — کوئری را دوباره از spec می‌سازد و فایل را می‌نویسد."""
    from accounts.models import CustomUser
    from .engine import ReportEngine, ReportError

    try:
        job = ReportExportJob.objects.get(pk=job_pk)
        ReportExportJob.objects.filter(pk=job_pk).update(
            status='running', heartbeat_at=timezone.now(),
        )

        user = CustomUser.objects.get(pk=user_pk)
        engine = ReportEngine(user, job.spec)
        qs, columns, total = engine.export_queryset()

        exports_dir = ReportExportJob.exports_dir()
        fname = f'report_{job_pk}_{uuid.uuid4().hex[:8]}.xlsx'
        fpath = exports_dir / fname

        def progress_cb(written, _total):
            pct = min(99, int(written * 100 / max(1, total)))
            # heartbeat هر CHUNK_SIZE ردیف — نشان زنده بودن پردازش‌های طولانی
            ReportExportJob.objects.filter(pk=job_pk).update(
                progress=pct, total_rows=total, heartbeat_at=timezone.now(),
            )

        wb, ws = _make_workbook()
        _write_workbook(
            ws, qs, columns, progress_cb=progress_cb, total=total,
            report_name=job.report_name, zebra=(total <= SYNC_ROW_LIMIT),
        )
        wb.save(str(fpath))

        ReportExportJob.objects.filter(pk=job_pk).update(
            status='done', progress=100,
            file_path=f'report_exports/{fname}',
            finished_at=timezone.now(),
        )
    except ReportError as e:
        ReportExportJob.objects.filter(pk=job_pk).update(
            status='failed', error_message=e.message, finished_at=timezone.now(),
        )
    except Exception as e:  # noqa: BLE001 — هر خطای غیرمنتظره باید status را ببندد
        ReportExportJob.objects.filter(pk=job_pk).update(
            status='failed', error_message=str(e)[:1000], finished_at=timezone.now(),
        )
    finally:
        # اتصال DB مخصوص این thread/پروسه — داخل تراکنش (تست‌ها) بسته نشود
        if not connection.in_atomic_block:
            connection.close()


def cleanup_old_jobs(max_age_hours=24):
    """پاک‌سازی فرصت‌طلبانه فایل‌ها و jobهای قدیمی + jobهای واقعاً مرده."""
    cutoff = timezone.now() - timezone.timedelta(hours=max_age_hours)
    old = ReportExportJob.objects.filter(created_at__lt=cutoff)
    for job in old:
        p = job.absolute_file_path
        if p is not None and p.exists():
            try:
                p.unlink()
            except OSError:
                pass
    old.delete()

    # running بدون نبض تازه (بیش از ۱ ساعت) → مرده؛ نبض ملاک است نه زمان شروع
    stale_cutoff = timezone.now() - timezone.timedelta(hours=1)
    ReportExportJob.objects.filter(status='running').filter(
        Q(heartbeat_at__lt=stale_cutoff)
        | Q(heartbeat_at__isnull=True, created_at__lt=stale_cutoff),
    ).update(status='failed', error_message='پردازش ناتمام ماند؛ دوباره اجرا کنید.')

    # pending قدیمی فقط وقتی worker زنده نیست (با worker زنده، صف سالم است)
    if not worker_alive():
        ReportExportJob.objects.filter(
            status='pending', created_at__lt=stale_cutoff,
        ).update(status='failed', error_message='پروسه سرور ری‌استارت شد؛ دوباره اجرا کنید.')
