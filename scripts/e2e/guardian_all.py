import os
import sys
import subprocess

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def run_all_guardians():
    print("=" * 70)
    print("🛡️ اجرای تجمیعی تمامی ۵ ایجنت نگهبان (Master Guardian Verification Suite)")
    print("=" * 70)

    guardians = [
        ("فاز ۱: گردش کار ۳ سطحی و بازشماری (سناریوهای ۱ و ۲)", "guardian_phase1.py"),
        ("فاز ۲: مسیرهای هوشمند دور زدن و رد مدیر (سناریوهای ۳ و ۴)", "guardian_phase2.py"),
        ("فاز ۳: استخرهای عمومی و مدیریت وظایف (سناریوهای ۵ و ۶)", "guardian_phase3.py"),
        ("فاز ۴: شمارش کور، تفکیک انبارها و مغایرت (سناریوهای ۷ و ۸)", "guardian_phase4.py"),
        ("فاز ۵: کارکرد آفلاین، سینک دستی، فیلترها و اکسل (سناریوهای ۹ و ۱۰)", "guardian_phase5.py"),
    ]

    backend_python = r"e:\warehouse project\warehouse-backend\venv\Scripts\python.exe"
    script_dir = r"e:\warehouse project\scripts\e2e"

    all_passed = True
    results = []

    for name, script_file in guardians:
        script_path = os.path.join(script_dir, script_file)
        print(f"\n▶️ ارزیابی {name} ...")
        proc = subprocess.run([backend_python, script_path], capture_output=True, text=True, encoding='utf-8')
        passed = (proc.returncode == 0)
        results.append((name, passed, proc.stdout.strip()))
        if passed:
            print(f"   ✅ تایید شد (PASSED 100%)")
        else:
            print(f"   ❌ رد شد (REJECTED)")
            print(proc.stdout)
            all_passed = False

    print("\n" + "=" * 70)
    print("📊 خلاصه نهایی عملکرد ایجنت‌های نگهبان:")
    print("=" * 70)
    for name, passed, output in results:
        status_icon = "✅ تایید ۱۰۰٪" if passed else "❌ مردود"
        print(f" - {name}: {status_icon}")

    if all_passed:
        print("\n🎉 تمامی ۱۰ سناریو در ۵ فاز با موفقیت قطعی و تاییدیه رسمی نگهبانان پاس شدند.")
    return all_passed

if __name__ == '__main__':
    ok = run_all_guardians()
    sys.exit(0 if ok else 1)
