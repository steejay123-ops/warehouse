"""
خروجی Excel گزارش‌ساز — ترکیبی و بدون سقف ردیف

- نتایج کوچک (تا SYNC_ROW_LIMIT): تولید همزمان و دانلود فوری.
- نتایج بزرگ: ReportExportJob + threading.Thread — فایل با Workbook(write_only=True)
  و iterator(chunk_size) ساخته می‌شود (مصرف RAM ثابت)، فرانت درصد پیشرفت را
  poll می‌کند و در پایان دانلود streaming انجام می‌شود. به این ترتیب هیچ
  درخواست HTTP طولانی‌ای نداریم و تایم‌اوت Cloudflare Tunnel بی‌اثر است.
"""
import threading
import uuid
from decimal import Decimal

import openpyxl
from django.db import connection
from django.http import HttpResponse
from django.utils import timezone

from .models import ReportExportJob

SYNC_ROW_LIMIT = 10_000
CHUNK_SIZE = 2000


def _cell_value(v):
    if v is None:
        return ''
    if isinstance(v, (int, float, Decimal, bool)):
        return v
    if hasattr(v, 'isoformat'):
        return v.isoformat()
    return str(v)


def _write_workbook(ws_target, qs, columns, progress_cb=None, total=0):
    """نوشتن ردیف‌ها در worksheet (الگوی دو ردیف سربرگ export_excel موجود)."""
    ws_target.append([c['label'] for c in columns])   # ردیف ۱: برچسب فارسی
    ws_target.append([c['key'] for c in columns])     # ردیف ۲: کلید سیستمی

    keys = [c['key'] for c in columns]
    written = 0
    for row in qs.iterator(chunk_size=CHUNK_SIZE):
        ws_target.append([_cell_value(row.get(k)) for k in keys])
        written += 1
        if progress_cb and written % CHUNK_SIZE == 0:
            progress_cb(written, total)
    if progress_cb:
        progress_cb(written, total)
    return written


def _make_workbook():
    wb = openpyxl.Workbook(write_only=True)
    ws = wb.create_sheet(title='Report')
    try:
        ws.sheet_view.rightToLeft = True
    except Exception:
        pass  # در حالت write_only بعضی نسخه‌ها sheet_view ندارند — حیاتی نیست
    return wb, ws


def sync_excel_response(qs, columns, filename='report.xlsx'):
    """تولید همزمان برای نتایج کوچک — دانلود فوری."""
    wb, ws = _make_workbook()
    _write_workbook(ws, qs, columns)
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response


def start_export_job(user, spec, report_name, total_rows):
    """ساخت job و شروع تولید فایل در thread پس‌زمینه."""
    job = ReportExportJob.objects.create(
        owner=user, spec=spec, report_name=report_name or 'report',
        status='pending', total_rows=total_rows,
    )
    t = threading.Thread(target=_run_export_job, args=(job.pk, user.pk), daemon=True)
    t.start()
    return job


def _run_export_job(job_pk, user_pk):
    """بدنه thread — کوئری را دوباره از spec می‌سازد و فایل را روی دیسک می‌نویسد."""
    from accounts.models import CustomUser
    from .engine import ReportEngine, ReportError

    try:
        job = ReportExportJob.objects.get(pk=job_pk)
        ReportExportJob.objects.filter(pk=job_pk).update(status='running')

        user = CustomUser.objects.get(pk=user_pk)
        engine = ReportEngine(user, job.spec)
        qs, columns, total = engine.export_queryset()

        exports_dir = ReportExportJob.exports_dir()
        fname = f'report_{job_pk}_{uuid.uuid4().hex[:8]}.xlsx'
        fpath = exports_dir / fname

        def progress_cb(written, _total):
            pct = min(99, int(written * 100 / max(1, total)))
            ReportExportJob.objects.filter(pk=job_pk).update(
                progress=pct, total_rows=total,
            )

        wb, ws = _make_workbook()
        _write_workbook(ws, qs, columns, progress_cb=progress_cb, total=total)
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
        connection.close()  # اتصال DB مخصوص این thread


def cleanup_old_jobs(max_age_hours=24):
    """پاک‌سازی فرصت‌طلبانه فایل‌ها و jobهای قدیمی + jobهای یتیم (ری‌استارت سرور)."""
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

    # jobهایی که وسط ری‌استارت پروسه ناتمام مانده‌اند (بیش از ۱ ساعت running)
    stale_cutoff = timezone.now() - timezone.timedelta(hours=1)
    ReportExportJob.objects.filter(
        status__in=('pending', 'running'), created_at__lt=stale_cutoff,
    ).update(status='failed', error_message='پروسه سرور ری‌استارت شد؛ دوباره اجرا کنید.')
