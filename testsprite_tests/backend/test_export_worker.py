import time
import requests

def test_export_worker_status_progression():
    """
    تست بک‌اند برای TestSprite:
    درخواست یک خروجی را به API می‌فرستد. 
    اگر خروجی بزرگ باشد (کد 202) وضعیت Job را در دیتابیس Polling می‌کند
    تا زمانی که Worker آن را به وضعیت done برساند.
    """
    target_url = globals().get('TARGET_URL', 'http://localhost:8000')
    auth_headers = globals().get('__AUTH_HEADERS__', {})

    payload = {
        "entity": "items",
        "fields": ["fa_unic_code", "description", "vendor", "balance"],
        "report_name": "TestSprite Backend Worker Test"
    }
    
    resp = requests.post(f"{target_url}/api/reports/export/", json=payload, headers=auth_headers)
    assert resp.status_code in [200, 202], f"Expected 200 or 202, got {resp.status_code}: {resp.text}"

    if resp.status_code == 202:
        # خروجی غیرهمگام (Background Job) شروع شد
        data = resp.json()
        job_id = data["job_id"]
        
        max_attempts = 45  # 45 seconds timeout
        done = False
        last_progress = -1
        
        for _ in range(max_attempts):
            status_resp = requests.get(f"{target_url}/api/reports/exports/{job_id}/", headers=auth_headers)
            assert status_resp.status_code == 200
            status_data = status_resp.json()
            
            # در صورت نیاز به بررسی پیشرفت:
            current_progress = status_data.get("progress", 0)
            if current_progress > last_progress:
                last_progress = current_progress
            
            if status_data["status"] == "done":
                done = True
                # بررسی امکان دانلود فایل
                download_resp = requests.get(f"{target_url}/api/reports/exports/{job_id}/download/", headers=auth_headers, stream=True)
                assert download_resp.status_code == 200, "Download endpoint returned error"
                break
            elif status_data["status"] == "failed":
                assert False, "Export job failed internally"
            
            time.sleep(1)
        
        assert done, "Export job did not complete within the timeout (Worker might be dead)"
    else:
        # خروجی همگام (حجم داده‌ها کمتر از SYNC_ROW_LIMIT بوده است)
        content_type = resp.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type, f"Expected Excel content type, got {content_type}"

# برای اجرا در TestSprite باید حتماً تابع تست در انتهای فایل صدا زده شود
test_export_worker_status_progression()
