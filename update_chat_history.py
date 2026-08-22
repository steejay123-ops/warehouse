#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat History Dashboard Generator & Sync Tool (Enhanced Version)
Warehouse Project - Shahr-e Shiraz
Generates an interactive, standalone HTML dashboard containing full conversation history,
incremental caching, accurate ISO timestamp extraction, deep search, advanced markdown rendering,
and automatic background watch capabilities.
"""

import sys
import os
import glob
import json
import re
import datetime
import http.server
import socketserver
import webbrowser
import threading
import urllib.parse
import base64
import time
import argparse

# Ensure UTF-8 output
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BRAIN_DIR = r"C:\Users\Payandeh\.gemini\antigravity-ide\brain"
CONVERSATIONS_DIR = r"C:\Users\Payandeh\.gemini\antigravity-ide\conversations"
OUTPUT_HTML_PATH = os.path.join(PROJECT_DIR, "chat_history_dashboard.html")
OUTPUT_JSON_PATH = os.path.join(PROJECT_DIR, "chat_history_data.json")

def gregorian_to_jalali(gy, gm, gd):
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    if gm > 2:
        gy2 = gy
    else:
        gy2 = gy - 1
    days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]
    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + (days // 31)
        jd = 1 + (days % 31)
    else:
        jm = 7 + ((days - 186) // 30)
        jd = 1 + ((days - 186) % 30)
    return jy, jm, jd

def parse_iso_datetime(iso_str):
    """Parses ISO timestamp string and converts to local datetime."""
    if not iso_str or not isinstance(iso_str, str):
        return None
    try:
        iso_clean = iso_str.strip()
        if iso_clean.endswith('Z'):
            iso_clean = iso_clean[:-1] + '+00:00'
        dt = datetime.datetime.fromisoformat(iso_clean)
        if dt.tzinfo:
            # Convert UTC/offset to local machine time
            dt = dt.astimezone().replace(tzinfo=None)
        return dt
    except Exception:
        return None

def format_date(dt_obj):
    if not dt_obj:
        return {"gregorian": "", "jalali": "", "jalali_month_year": "", "timestamp": 0, "iso": ""}
    g_str = dt_obj.strftime("%Y-%m-%d %H:%M")
    jy, jm, jd = gregorian_to_jalali(dt_obj.year, dt_obj.month, dt_obj.day)
    persian_months = [
        "", "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ]
    j_month_name = persian_months[jm] if 1 <= jm <= 12 else str(jm)
    j_str = f"{jd} {j_month_name} {jy} ({dt_obj.strftime('%H:%M')})"
    j_month_year = f"{j_month_name} {jy}"
    return {
        "gregorian": g_str,
        "jalali": j_str,
        "jalali_month_year": j_month_year,
        "timestamp": int(dt_obj.timestamp()),
        "iso": dt_obj.isoformat()
    }

def clean_user_prompt(text):
    if not text:
        return ""
    text = re.sub(r'<USER_REQUEST>\s*', '', text)
    text = re.sub(r'</USER_REQUEST>.*', '', text, flags=re.DOTALL)
    text = re.sub(r'/(grill-me|goal|schedule|learn)\s*', '', text)
    text = re.sub(r'@\[[^\]]+\]\s*', '', text)
    text = re.sub(r'<div[^>]*>', '', text)
    text = re.sub(r'</div>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()

def detect_tags(text, plan_text=""):
    combined = (text + " " + plan_text).lower()
    tags = []
    
    tag_keywords = [
        ("Angular", ["angular", "component", "ts", "template", "front", "html", "css", "فرانت"]),
        ("Django", ["django", "models.py", "views.py", "viewset", "serializer", "backend", "بک‌"]),
        ("Database", ["postgres", "sqlite", "migration", "دیتابیس", "مایگریشن", "جدول", "db"]),
        ("Counter", ["counter", "counttask", "شمارش", "شمارنده", "انبارگردانی", "مغایرت"]),
        ("Supervisor", ["supervisor", "سرپرست", "کارتابل سرپرست", "تایید سرپرست"]),
        ("Customs", ["customs", "گمرک", "کارتابل مالی", "ارزیاب", "ترخیص"]),
        ("Barcode", ["barcode", "scanner", "بارکد", "اسکنر", "دوربین", "خوان"]),
        ("ID Cards", ["personnel", "id card", "کارت پرسنلی", "صدور کارت", "بوم کارت"]),
        ("Label Designer", ["label", "لیبل", "چاپ لیبل", "طراحی لیبل"]),
        ("Reports", ["report", "گزارش", "گزارش‌ساز", "excel", "اکسل"]),
        ("Role & RBAC", ["permission", "role", "دستور", "نقش", "دسترسی", "کاربر"]),
        ("Settings", ["settings", "تنظیمات", "پیکربندی"]),
        ("Shortcuts", ["shortcut", "کیبورد", "کلید میانبر", "f1", "f2", "escape"]),
        ("PWA & Offline", ["pwa", "offline", "آفلاین", "service worker", "cache"]),
        ("Bugfix", ["bug", "fix", "خطا", "ارور", "رفع مشکل", "حل مشکل", "debug"]),
        ("UI/UX", ["ui", "ux", "طراحی", "استایل", "مودال", "تم", "رنگ", "cropper", "avatar"]),
    ]
    
    for tag_name, keywords in tag_keywords:
        for kw in keywords:
            if kw in combined:
                tags.append(tag_name)
                break
                
    if not tags:
        tags.append("General")
    return list(dict.fromkeys(tags))[:4]

KNOWN_DELETED_CIDS = {'be88e285-5df6-499c-a3aa-a2e069c17d73'}
DELETED_CHATS_FILE = os.path.join(os.path.dirname(__file__), 'deleted_chats.json')

def load_deleted_cids():
    deleted_set = set(KNOWN_DELETED_CIDS)
    if os.path.exists(DELETED_CHATS_FILE):
        try:
            with open(DELETED_CHATS_FILE, 'r', encoding='utf-8', errors='ignore') as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, str) and len(item) > 4:
                            deleted_set.add(item.lower().strip())
        except Exception:
            pass
    return deleted_set

def clean_extracted_title(t):
    if not t:
        return ""
    t = t.replace('\\n', ' ').replace('\n', ' ').replace('\r', ' ')
    if '# User Requests' in t:
        t = t.split('# User Requests')[0]
    if '###' in t:
        t = t.split('###')[0]
    if '##' in t:
        t = t.split('##')[0]
    t = re.sub(r'^(Conversation\s+[0-9a-f\-]+:?|[0-9a-f\-]{36}:?|Title:?)\s*', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'-\s*Created:.*', '', t, flags=re.IGNORECASE).strip()
    t = re.sub(r'["\']}', '', t).strip()
    t = re.sub(r'^{{\s*CHECKPOINT\s*\d+\s*}}', '', t).strip()
    t = t.strip(' "\'()[]{}:')
    t = ' '.join(t.split())
    if t and not t.startswith('{') and not t.startswith('**') and len(t) >= 2:
        return t
    return ""

def clean_title_and_summary(raw_text):
    if not raw_text:
        return "", ""
    lines = [l.strip() for l in raw_text.replace('\r', '\n').split('\n') if l.strip()]
    title = ""
    summary = ""
    for l in lines:
        if l.startswith('- Created:') or l.startswith('- Last modified:'):
            continue
        if l.startswith('### USER Objective:'):
            continue
        if not title:
            title = l.replace('## Conversation', '').replace('\\n', ' ').strip()
            if ':' in title and len(title.split(':')[0]) > 20:
                title = title.split(':', 1)[1].strip()
        elif not summary and len(l) > 10:
            summary = l
            
    title = clean_extracted_title(title)
    return title, summary

def load_existing_cache():
    """Loads existing json database for incremental speedups."""
    if not os.path.exists(OUTPUT_JSON_PATH):
        return {}
    try:
        with open(OUTPUT_JSON_PATH, 'r', encoding='utf-8', errors='ignore') as f:
            data = json.load(f)
            if isinstance(data, list):
                return {item['id']: item for item in data if 'id' in item}
    except Exception:
        pass
    return {}

def extract_all_conversations():
    if not os.path.exists(BRAIN_DIR):
        print(f"Brain directory not found at: {BRAIN_DIR}")
        return []

    existing_cache = load_existing_cache()
    deleted_cids = load_deleted_cids()
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    cids = [d for d in os.listdir(BRAIN_DIR) if os.path.isdir(os.path.join(BRAIN_DIR, d)) and uuid_pattern.match(d)]
    print(f"Found {len(cids)} valid conversation folders in brain.")

    # Pass 1: Global scan of all logs across brain for Antigravity official titles & metadata
    known_metadata = {}
    for cid in cids:
        log_dir = os.path.join(BRAIN_DIR, cid, '.system_generated', 'logs')
        if not os.path.isdir(log_dir):
            continue
        for fname in os.listdir(log_dir):
            if fname.endswith('.jsonl') or fname.endswith('.txt'):
                fpath = os.path.join(log_dir, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            if 'Conversation' in line or '<conversation_summaries>' in line:
                                # 1. Extract Conversation titles: ## Conversation <cid>: <Title>
                                for m in re.finditer(r'##\s*Conversation\s+([0-9a-f\-]{36}):\s*([^\n\r\\]+)', line):
                                    mcid = m.group(1).lower().strip()
                                    raw_t = m.group(2).strip()
                                    raw_t = re.sub(r'-\s*Created:.*', '', raw_t).strip()
                                    raw_t = clean_extracted_title(raw_t)
                                    if raw_t and not raw_t.startswith('{'):
                                        if mcid not in known_metadata:
                                            known_metadata[mcid] = {}
                                        if len(raw_t) > len(known_metadata[mcid].get('title', '')):
                                            known_metadata[mcid]['title'] = raw_t
                                
                                # 2. Extract ISO timestamps if available
                                for m in re.finditer(r'##\s*Conversation\s+([0-9a-f\-]{36}):[\s\S]*?-\s*Created:\s*([^\n\r\\]+)', line):
                                    mcid = m.group(1).lower().strip()
                                    c_iso = m.group(2).strip()
                                    if mcid in known_metadata and not known_metadata[mcid].get('created_iso'):
                                        known_metadata[mcid]['created_iso'] = c_iso

                            if 'USER Objective:' in line:
                                obj_match = re.search(r'###\s*USER\s*Objective:\s*([^\n\r\\]+)', line)
                                if obj_match:
                                    obj_t = clean_extracted_title(obj_match.group(1).strip())
                                    if obj_t and not obj_t.startswith('{'):
                                        cid_lower = cid.lower()
                                        if cid_lower not in known_metadata:
                                            known_metadata[cid_lower] = {}
                                        if not known_metadata[cid_lower].get('objective'):
                                            known_metadata[cid_lower]['objective'] = obj_t
                except Exception:
                    pass

    valid_known_count = len([k for k, v in known_metadata.items() if v.get('title') or v.get('objective')])
    print(f"Discovered {valid_known_count} official conversation titles from Antigravity history.")

    conversations = []
    processed_cids = set()

    for idx, cid in enumerate(cids):
        cdir = os.path.join(BRAIN_DIR, cid)
        
        # Locate transcript file (transcript.jsonl > overview.txt > transcript_full.jsonl)
        tpath = os.path.join(cdir, '.system_generated', 'logs', 'transcript.jsonl')
        if not os.path.exists(tpath):
            tpath = os.path.join(cdir, '.system_generated', 'logs', 'overview.txt')
        if not os.path.exists(tpath):
            tpath = os.path.join(cdir, '.system_generated', 'logs', 'transcript_full.jsonl')
            
        plan_path = os.path.join(cdir, 'implementation_plan.md')
        walkthrough_path = os.path.join(cdir, 'walkthrough.md')
        meta_plan = os.path.join(cdir, 'implementation_plan.md.metadata.json')
        meta_walkthrough = os.path.join(cdir, 'walkthrough.md.metadata.json')

        # Read plan & walkthrough
        plan_content = ""
        plan_summary = ""
        if os.path.exists(plan_path):
            try:
                with open(plan_path, 'r', encoding='utf-8', errors='ignore') as pf:
                    plan_content = pf.read()
            except Exception:
                pass
                
        if os.path.exists(meta_plan):
            try:
                with open(meta_plan, 'r', encoding='utf-8', errors='ignore') as mf:
                    plan_meta_obj = json.load(mf)
                    plan_summary = plan_meta_obj.get('Summary', '')
            except Exception:
                pass

        walkthrough_content = ""
        walkthrough_summary = ""
        if os.path.exists(walkthrough_path):
            try:
                with open(walkthrough_path, 'r', encoding='utf-8', errors='ignore') as wf:
                    walkthrough_content = wf.read()
            except Exception:
                pass

        if os.path.exists(meta_walkthrough):
            try:
                with open(meta_walkthrough, 'r', encoding='utf-8', errors='ignore') as wmf:
                    wt_meta_obj = json.load(wmf)
                    walkthrough_summary = wt_meta_obj.get('Summary', '')
            except Exception:
                pass

        # Read transcript and extract messages
        messages = []
        first_user_prompt = ""
        all_user_prompts = []
        tool_counts = 0
        first_iso = None
        last_iso = None
        
        if os.path.exists(tpath):
            try:
                with open(tpath, 'r', encoding='utf-8', errors='ignore') as tf:
                    for line in tf:
                        if not line.strip():
                            continue
                        try:
                            obj = json.loads(line)
                            mtype = obj.get('type')
                            msource = obj.get('source')
                            mcontent = obj.get('content', '')
                            step_created = obj.get('created_at')

                            if step_created and isinstance(step_created, str):
                                if not first_iso:
                                    first_iso = step_created
                                last_iso = step_created
                            
                            if mtype == 'USER_INPUT' and msource == 'USER_EXPLICIT':
                                cleaned_p = clean_user_prompt(mcontent)
                                if cleaned_p:
                                    all_user_prompts.append(cleaned_p)
                                    if not first_user_prompt:
                                        first_user_prompt = cleaned_p
                                    messages.append({
                                        'sender': 'user',
                                        'text': cleaned_p,
                                        'time': step_created or ''
                                    })
                            elif mtype == 'PLANNER_RESPONSE':
                                tcalls = obj.get('tool_calls', [])
                                tool_counts += len(tcalls)
                                tool_summary_list = []
                                for tc in tcalls:
                                    tname = tc.get('name', 'tool')
                                    args = tc.get('arguments', {})
                                    tsum = args.get('toolSummary') or args.get('toolAction') or tname
                                    tool_summary_list.append(tsum)
                                
                                if mcontent or tool_summary_list:
                                    messages.append({
                                        'sender': 'assistant',
                                        'text': mcontent if mcontent else '',
                                        'tools': tool_summary_list,
                                        'time': step_created or ''
                                    })
                        except Exception:
                            continue
            except Exception:
                pass

        cid_lower = cid.lower()
        has_known_meta = cid_lower in known_metadata and bool(known_metadata[cid_lower].get('title') or known_metadata[cid_lower].get('objective'))

        # Skip empty ghost folders that have 0 messages, 0 plans, and 0 metadata
        if not messages and not plan_content and not walkthrough_content and not has_known_meta:
            continue

        # Calculate exact creation and update times (ISO priority > metadata > filesystem)
        created_time = None
        if first_iso:
            created_time = parse_iso_datetime(first_iso)
        if not created_time and has_known_meta and known_metadata[cid_lower].get('created_iso'):
            created_time = parse_iso_datetime(known_metadata[cid_lower]['created_iso'])
        if not created_time and os.path.exists(tpath):
            created_time = datetime.datetime.fromtimestamp(os.path.getctime(tpath))
        if not created_time and os.path.exists(cdir):
            created_time = datetime.datetime.fromtimestamp(os.path.getctime(cdir))
        if not created_time:
            created_time = datetime.datetime.now()

        updated_time = None
        if last_iso:
            updated_time = parse_iso_datetime(last_iso)
        if not updated_time and has_known_meta and known_metadata[cid_lower].get('modified_iso'):
            updated_time = parse_iso_datetime(known_metadata[cid_lower]['modified_iso'])
        if not updated_time and os.path.exists(tpath):
            updated_time = datetime.datetime.fromtimestamp(os.path.getmtime(tpath))
        if not updated_time and os.path.exists(cdir):
            updated_time = datetime.datetime.fromtimestamp(os.path.getmtime(cdir))
        if not updated_time:
            updated_time = created_time

        # Determine Exact Official Title (100% Match with IDE Sidebar)
        exact_title = ""
        summary_fa = ""
        
        # 1. Exact official Antigravity title from conversation summaries
        if has_known_meta:
            k_meta = known_metadata[cid_lower]
            k_title = clean_extracted_title(k_meta.get('title', ''))
            k_obj = clean_extracted_title(k_meta.get('objective', ''))
            if k_title:
                exact_title = k_title
            elif k_obj:
                exact_title = k_obj

        # 2. Check implementation plan title
        if not exact_title and plan_content:
            cleaned_plan_lines = [re.sub(r'<[^>]+>', '', l).strip() for l in plan_content.split('\n') if l.strip()]
            for pline in cleaned_plan_lines[:5]:
                clean_p = pline.replace('#', '').strip()
                if clean_p and not clean_p.startswith('[') and len(clean_p) > 3 and len(clean_p) < 100:
                    exact_title = clean_p
                    break

        # 3. Check walkthrough title
        if not exact_title and walkthrough_content:
            cleaned_wt_lines = [re.sub(r'<[^>]+>', '', l).strip() for l in walkthrough_content.split('\n') if l.strip()]
            for wline in cleaned_wt_lines[:5]:
                clean_w = wline.replace('#', '').strip()
                if clean_w and not clean_w.startswith('[') and len(clean_w) > 3 and len(clean_w) < 100:
                    exact_title = clean_w
                    break

        # 4. Current active chat explicit title fix
        if cid_lower.startswith('db61efad'):
            exact_title = "بررسی منطق مرتب‌سازی فایل"

        # 5. First user prompt fallback
        if not exact_title:
            if first_user_prompt:
                clean_p = ' '.join(first_user_prompt.split())
                exact_title = clean_p[:55] + ("..." if len(clean_p) > 55 else "")
            else:
                exact_title = f"مکالمه انبار ({cid[:8].upper()})"

        exact_title = ' '.join(exact_title.split())

        # Determine Persian Summary
        if plan_summary:
            summary_fa = plan_summary[:160]
        elif walkthrough_summary:
            summary_fa = walkthrough_summary[:160]
        elif first_user_prompt:
            summary_fa = first_user_prompt[:140] + ("..." if len(first_user_prompt) > 140 else "")
        else:
            summary_fa = "مکالمه، پیاده‌سازی و مدیریت تسک‌های پروژه اتوماسیون انبار."

        summary_fa = ' '.join(summary_fa.split())
        tags = detect_tags((first_user_prompt or "") + " " + exact_title, plan_content)
        is_deleted = cid_lower in deleted_cids
        
        conv_item = {
            'id': cid,
            'title': exact_title,
            'title_en': exact_title,
            'summary_fa': summary_fa,
            'tags': tags,
            'created_at': format_date(created_time),
            'updated_at': format_date(updated_time),
            'messages_count': len(messages),
            'tools_count': tool_counts,
            'has_plan': bool(plan_content),
            'has_walkthrough': bool(walkthrough_content),
            'plan_content': plan_content,
            'walkthrough_content': walkthrough_content,
            'messages': messages,
            'first_prompt': first_user_prompt,
            'is_deleted': is_deleted
        }
        conversations.append(conv_item)
        processed_cids.add(cid_lower)

    # Pass 3: Reconcile with archive cache & historical logs to auto-detect and preserve deleted chats
    deleted_from_disk_count = 0

    # 1. Reconcile with existing JSON cache
    for old_cid, cached_item in existing_cache.items():
        old_cid_lower = old_cid.lower()
        if old_cid_lower not in processed_cids:
            cached_copy = dict(cached_item)
            cached_copy['is_deleted'] = True
            conversations.append(cached_copy)
            processed_cids.add(old_cid_lower)
            deleted_from_disk_count += 1

    # 2. Reconcile with all historical logged conversation titles whose folders were deleted
    for mcid, meta in known_metadata.items():
        mcid_lower = mcid.lower()
        if mcid_lower not in processed_cids:
            del_title = clean_extracted_title(meta.get('title') or meta.get('objective') or '')
            if del_title and len(del_title) >= 2:
                c_iso = meta.get('created_iso')
                c_time = parse_iso_datetime(c_iso) if c_iso else datetime.datetime.now()
                del_conv_item = {
                    'id': mcid,
                    'title': del_title,
                    'title_en': del_title,
                    'summary_fa': f"این چت با عنوان «{del_title}» پیش‌تر در سایدبار ثبت شده و از روی دیسک حذف گردیده است.",
                    'tags': detect_tags(del_title, ""),
                    'created_at': format_date(c_time),
                    'updated_at': format_date(c_time),
                    'messages_count': 0,
                    'tools_count': 0,
                    'has_plan': False,
                    'has_walkthrough': False,
                    'plan_content': "",
                    'walkthrough_content': "",
                    'messages': [{
                        'sender': 'assistant',
                        'text': f'این مکالمه با شناسه {mcid} و عنوان «{del_title}» پیش‌تر در سایدبار نرم‌افزار قرار داشته و حذف شده است.',
                        'time': c_iso or '',
                        'tools': []
                    }],
                    'first_prompt': del_title,
                    'is_deleted': True
                }
                conversations.append(del_conv_item)
                processed_cids.add(mcid_lower)
                deleted_from_disk_count += 1

    if deleted_from_disk_count > 0:
        print(f"Identified and preserved {deleted_from_disk_count} deleted chat(s) from archive & history.")

    # Sort conversations by updated date (newest first)
    conversations.sort(key=lambda c: c['updated_at'].get('timestamp', 0), reverse=True)
    return conversations

def generate_dashboard_html(conversations):
    json_bytes = json.dumps(conversations, ensure_ascii=False).encode('utf-8')
    b64_json = base64.b64encode(json_bytes).decode('ascii')
    
    total_chats = len(conversations)
    total_messages = sum(c['messages_count'] for c in conversations)
    total_plans = sum(1 for c in conversations if c['has_plan'])
    total_walkthroughs = sum(1 for c in conversations if c['has_walkthrough'])
    
    html_raw = r"""<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تاریخچه و بایگانی جامع چت‌های پروژه انبار (Chat History Dashboard)</title>
    
    <!-- Google Fonts: Vazirmatn & Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-primary: #0b0f19;
            --bg-secondary: #111827;
            --bg-card: rgba(17, 24, 39, 0.85);
            --border-color: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(139, 92, 246, 0.4);
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --text-muted: #6b7280;
            --accent-primary: #8b5cf6;
            --accent-glow: rgba(139, 92, 246, 0.25);
            --accent-blue: #3b82f6;
            --accent-emerald: #10b981;
            --accent-amber: #f59e0b;
            --accent-rose: #f43f5e;
            --glass-bg: rgba(17, 24, 39, 0.7);
            --glass-blur: blur(16px);
            --shadow-card: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
            --shadow-glow: 0 0 25px -5px rgba(139, 92, 246, 0.3);
        }

        .light {
            --bg-primary: #f8fafc;
            --bg-secondary: #ffffff;
            --bg-card: rgba(255, 255, 255, 0.9);
            --border-color: rgba(0, 0, 0, 0.08);
            --border-hover: rgba(139, 92, 246, 0.5);
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-muted: #94a3b8;
            --accent-primary: #7c3aed;
            --accent-glow: rgba(124, 58, 237, 0.15);
            --glass-bg: rgba(255, 255, 255, 0.85);
            --shadow-card: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }

        .en-font {
            font-family: 'Inter', sans-serif;
        }

        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
            background-image: 
                radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
                radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%);
            background-attachment: fixed;
        }

        /* Header & Navbar */
        .navbar {
            position: sticky;
            top: 0;
            z-index: 50;
            background: var(--glass-bg);
            backdrop-filter: var(--glass-blur);
            -webkit-backdrop-filter: var(--glass-blur);
            border-bottom: 1px solid var(--border-color);
            padding: 0.85rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1.5rem;
            transition: all 0.3s ease;
        }

        .brand-section {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .brand-logo {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-blue));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }

        .brand-title h1 {
            font-size: 1.25rem;
            font-weight: 800;
            color: var(--text-primary);
            letter-spacing: -0.02em;
        }

        .brand-title p {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .nav-actions {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.55rem 1.1rem;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), #6d28d9);
            color: white;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px var(--accent-glow);
            filter: brightness(1.1);
        }

        .btn-secondary {
            background: var(--bg-card);
            color: var(--text-primary);
            border-color: var(--border-color);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--border-hover);
        }

        /* Container */
        .container {
            max-width: 1440px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
        }

        /* Stats Bar */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.25rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: var(--bg-card);
            backdrop-filter: var(--glass-blur);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.25rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 1.25rem;
            box-shadow: var(--shadow-card);
            transition: transform 0.25s ease, border-color 0.25s ease;
        }

        .stat-card:hover {
            transform: translateY(-3px);
            border-color: var(--border-hover);
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .stat-info h3 {
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--text-primary);
        }

        .stat-info p {
            font-size: 0.85rem;
            color: var(--text-muted);
            font-weight: 500;
        }

        /* Controls / Search & Filters */
        .controls-panel {
            background: var(--bg-card);
            backdrop-filter: var(--glass-blur);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: var(--shadow-card);
        }

        .search-row {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.25rem;
            flex-wrap: wrap;
            align-items: center;
        }

        .search-wrapper {
            flex: 1;
            position: relative;
            min-width: 280px;
        }

        .search-input {
            width: 100%;
            padding: 0.85rem 1.2rem 0.85rem 3rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: rgba(0, 0, 0, 0.2);
            color: var(--text-primary);
            font-size: 0.95rem;
            outline: none;
            transition: all 0.2s ease;
        }

        .light .search-input {
            background: rgba(255, 255, 255, 0.8);
        }

        .search-input:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 1.1rem;
            pointer-events: none;
        }

        /* Deep Search Toggle */
        .deep-search-label {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.7rem 1rem;
            background: rgba(139, 92, 246, 0.08);
            border: 1px solid rgba(139, 92, 246, 0.25);
            border-radius: 12px;
            color: #c4b5fd;
            font-size: 0.825rem;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
        }

        .light .deep-search-label {
            background: rgba(124, 58, 237, 0.06);
            color: #6d28d9;
        }

        .deep-search-label:hover {
            background: rgba(139, 92, 246, 0.18);
            border-color: var(--accent-primary);
        }

        .deep-search-label input {
            accent-color: var(--accent-primary);
            cursor: pointer;
            width: 16px;
            height: 16px;
        }

        .toggle-deleted-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.85rem 1.1rem;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-secondary);
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
            white-space: nowrap;
        }

        .toggle-deleted-label:hover {
            background: rgba(245, 158, 11, 0.12);
            border-color: var(--accent-amber);
            color: var(--text-primary);
        }

        .toggle-deleted-label input {
            accent-color: var(--accent-amber);
            cursor: pointer;
            width: 16px;
            height: 16px;
        }

        .sort-select {
            padding: 0.85rem 1.2rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-card);
            color: var(--text-primary);
            font-size: 0.9rem;
            outline: none;
            cursor: pointer;
            min-width: 200px;
        }

        /* Segmented View Mode Toggle */
        .view-mode-group {
            display: inline-flex;
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 0.25rem;
            gap: 0.25rem;
            align-items: center;
        }

        .light .view-mode-group {
            background: rgba(0, 0, 0, 0.05);
        }

        .view-mode-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.55rem 0.95rem;
            border-radius: 8px;
            font-size: 0.825rem;
            font-weight: 600;
            border: none;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .view-mode-btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.05);
        }

        .view-mode-btn.active {
            background: var(--accent-primary);
            color: white;
            box-shadow: 0 2px 8px var(--accent-glow);
        }

        /* Title with Copy Button */
        .title-with-copy {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            flex: 1;
        }

        .copy-title-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 8px;
            width: 28px;
            height: 28px;
            min-width: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 0.1rem;
        }

        .copy-title-btn:hover {
            background: rgba(139, 92, 246, 0.2);
            border-color: var(--accent-primary);
            color: var(--text-primary);
            transform: scale(1.1);
        }

        .copy-title-btn.copied {
            background: rgba(16, 185, 129, 0.2) !important;
            border-color: #10b981 !important;
            color: #10b981 !important;
        }

        /* Time Groups Container */
        .time-groups-container {
            display: flex;
            flex-direction: column;
            gap: 2.5rem;
            width: 100%;
        }

        .time-group-section {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            margin-bottom: 0.5rem;
        }

        .group-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            width: 100%;
            margin-bottom: 0.5rem;
        }

        .group-title-wrapper {
            display: inline-flex;
            align-items: center;
            gap: 0.6rem;
            background: var(--bg-card);
            backdrop-filter: var(--glass-blur);
            border: 1px solid var(--border-color);
            padding: 0.45rem 1.1rem;
            border-radius: 9999px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .group-title-text {
            font-size: 0.95rem;
            font-weight: 800;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .group-count-badge {
            background: rgba(139, 92, 246, 0.2);
            color: #a78bfa;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 0.15rem 0.5rem;
            border-radius: 9999px;
        }

        .group-divider-line {
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--border-color), transparent);
        }

        .tags-wrapper {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            padding-top: 0.5rem;
            border-top: 1px solid var(--border-color);
        }

        .tag-pill {
            padding: 0.35rem 0.85rem;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-secondary);
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
        }

        .tag-pill:hover {
            background: rgba(139, 92, 246, 0.15);
            color: var(--text-primary);
            border-color: var(--accent-primary);
        }

        .tag-pill.active {
            background: var(--accent-primary);
            color: white;
            border-color: var(--accent-primary);
            box-shadow: 0 2px 8px var(--accent-glow);
        }

        .tag-badge {
            background: rgba(0, 0, 0, 0.25);
            padding: 0.1rem 0.45rem;
            border-radius: 9999px;
            font-size: 0.7rem;
        }

        /* Chat Cards Grid */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            gap: 1rem;
            width: 100%;
        }

        .chat-card {
            background: var(--bg-card);
            backdrop-filter: var(--glass-blur);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.1rem 1.3rem;
            box-shadow: var(--shadow-card);
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            user-select: none;
        }

        .chat-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-blue));
            opacity: 0;
            transition: opacity 0.25s ease;
        }

        .chat-card:hover {
            transform: translateY(-2px);
            border-color: var(--border-hover);
            box-shadow: var(--shadow-glow), var(--shadow-card);
        }

        .chat-card:hover::before {
            opacity: 1;
        }

        .chat-card.expanded {
            border-color: var(--accent-primary);
            box-shadow: var(--shadow-glow), var(--shadow-card);
            background: rgba(17, 24, 39, 0.98);
            transform: translateY(-2px);
        }

        .light .chat-card.expanded {
            background: rgba(255, 255, 255, 0.98);
        }

        .chat-card.expanded::before {
            opacity: 1;
        }

        .chat-card.deleted-card {
            border: 1px dashed rgba(245, 158, 11, 0.55) !important;
            background: rgba(245, 158, 11, 0.04) !important;
        }

        .chat-card.deleted-card::before {
            background: linear-gradient(90deg, var(--accent-amber), #ef4444) !important;
        }

        .chat-card.deleted-card:hover {
            border-color: rgba(245, 158, 11, 0.9) !important;
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.25) !important;
        }

        .deleted-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 0.15rem 0.5rem;
            border-radius: 6px;
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.35);
            margin-right: 0.4rem;
            vertical-align: middle;
        }

        .card-compact-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.75rem;
        }

        .card-compact-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex-shrink: 0;
        }

        .card-chevron {
            font-size: 0.65rem;
            color: var(--text-muted);
            transition: transform 0.25s ease, color 0.25s ease;
        }

        .chat-card.expanded .card-chevron {
            transform: rotate(180deg);
            color: var(--accent-primary);
        }

        .card-title-en, .card-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--text-primary);
            line-height: 1.5;
            letter-spacing: -0.01em;
            word-break: break-word;
        }

        .card-meta-date {
            font-size: 0.75rem;
            color: var(--text-muted);
            white-space: nowrap;
        }

        .card-compact-summary {
            font-size: 0.86rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.5;
        }

        .chat-card.expanded .card-compact-summary {
            display: none;
        }

        .card-expanded-body {
            display: none;
            margin-top: 0.9rem;
            padding-top: 0.9rem;
            border-top: 1px dashed var(--border-color);
            animation: fadeInCard 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .chat-card.expanded .card-expanded-body {
            display: block;
        }

        @keyframes fadeInCard {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .card-full-summary-box {
            background: rgba(0, 0, 0, 0.15);
            padding: 0.8rem 1rem;
            border-radius: 10px;
            border: 1px solid var(--border-color);
        }

        .light .card-full-summary-box {
            background: rgba(0, 0, 0, 0.03);
        }

        .card-full-summary-text {
            font-size: 0.88rem;
            color: var(--text-primary);
            line-height: 1.7;
        }

        .btn-open-chat {
            width: 100%;
            justify-content: center;
            margin-top: 0.9rem;
            padding: 0.6rem;
            font-size: 0.85rem;
            border-radius: 10px;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .card-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }

        .card-tag {
            font-size: 0.72rem;
            font-weight: 600;
            padding: 0.2rem 0.55rem;
            border-radius: 6px;
            background: rgba(139, 92, 246, 0.1);
            color: #a78bfa;
            border: 1px solid rgba(139, 92, 246, 0.2);
            font-family: 'Inter', sans-serif;
        }

        .card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 0.85rem;
            border-top: 1px solid var(--border-color);
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .card-badges {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .pill-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.2rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .badge-plan {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .badge-wt {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .card-cid {
            font-family: monospace;
            font-size: 0.75rem;
            color: var(--text-muted);
            background: rgba(0, 0, 0, 0.15);
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
        }

        /* Empty State */
        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 4rem 2rem;
            background: var(--bg-card);
            border-radius: 20px;
            border: 1px dashed var(--border-color);
        }

        .empty-state h3 {
            font-size: 1.25rem;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .empty-state p {
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        /* Modal / Reader Drawer */
        .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 100;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .modal-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            width: 100%;
            max-width: 1060px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            transform: scale(0.96) translateY(20px);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }

        .modal-overlay.active .modal-content {
            transform: scale(1) translateY(0);
        }

        .modal-header {
            padding: 1.5rem 2rem;
            background: var(--glass-bg);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 1.5rem;
        }

        .modal-title-area h2 {
            font-size: 1.35rem;
            font-weight: 800;
            color: var(--text-primary);
            margin-bottom: 0.4rem;
            line-height: 1.5;
        }

        .modal-meta-row {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .modal-close-btn {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
            background: var(--accent-rose);
            color: white;
            border-color: var(--accent-rose);
        }

        /* Modal Tabs */
        .modal-tabs {
            display: flex;
            padding: 0 2rem;
            background: var(--bg-card);
            border-bottom: 1px solid var(--border-color);
            gap: 1rem;
        }

        .modal-tab-btn {
            padding: 0.85rem 1.25rem;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .modal-tab-btn:hover {
            color: var(--text-primary);
        }

        .modal-tab-btn.active {
            color: var(--accent-primary);
            border-bottom-color: var(--accent-primary);
        }

        .modal-body {
            padding: 2rem;
            overflow-y: auto;
            flex: 1;
        }

        /* Chat Message Bubbles */
        .messages-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .message-bubble {
            padding: 1.25rem 1.5rem;
            border-radius: 16px;
            line-height: 1.7;
            max-width: 95%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .user-message {
            align-self: flex-start;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(59, 130, 246, 0.12));
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-bottom-right-radius: 4px;
        }

        .assistant-message {
            align-self: flex-end;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-bottom-left-radius: 4px;
        }

        .message-header {
            font-size: 0.8rem;
            font-weight: 700;
            margin-bottom: 0.6rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
        }

        .user-header {
            color: #a78bfa;
        }

        .assistant-header {
            color: #38bdf8;
        }

        .tool-pill-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
            margin-top: 0.85rem;
            padding-top: 0.75rem;
            border-top: 1px dashed var(--border-color);
        }

        .tool-pill {
            font-size: 0.72rem;
            padding: 0.15rem 0.5rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            color: var(--text-muted);
            font-family: monospace;
        }

        /* Enhanced Markdown Styling */
        .markdown-body {
            font-size: 0.95rem;
            color: var(--text-primary);
            line-height: 1.8;
            word-break: break-word;
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: var(--text-primary);
            font-weight: 700;
        }

        .markdown-body p {
            margin-bottom: 0.9rem;
        }

        .markdown-body code {
            background: rgba(0, 0, 0, 0.35);
            padding: 0.2rem 0.45rem;
            border-radius: 6px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 0.875em;
            color: #f472b6;
            direction: ltr;
            display: inline-block;
        }

        .light .markdown-body code {
            background: rgba(0, 0, 0, 0.06);
            color: #db2777;
        }

        /* Code Block Container */
        .code-block-wrapper {
            position: relative;
            background: #090d16;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            margin: 1.25rem 0;
            overflow: hidden;
            direction: ltr;
            text-align: left;
        }

        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.4rem 0.85rem;
            background: rgba(255, 255, 255, 0.05);
            border-bottom: 1px solid var(--border-color);
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .copy-code-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            border-radius: 6px;
            padding: 0.2rem 0.55rem;
            font-size: 0.72rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .copy-code-btn:hover {
            background: var(--accent-primary);
            color: white;
            border-color: var(--accent-primary);
        }

        .code-block-wrapper pre {
            padding: 1rem 1.25rem;
            overflow-x: auto;
            margin: 0;
            background: transparent;
        }

        .code-block-wrapper pre code {
            background: none;
            padding: 0;
            color: #e2e8f0;
            display: block;
        }

        /* Responsive Tables */
        .table-responsive {
            width: 100%;
            overflow-x: auto;
            margin: 1.25rem 0;
            border-radius: 12px;
            border: 1px solid var(--border-color);
        }

        .markdown-table {
            width: 100%;
            border-collapse: collapse;
            text-align: right;
        }

        .markdown-table th, .markdown-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.88rem;
        }

        .markdown-table th {
            background: rgba(255, 255, 255, 0.04);
            font-weight: 700;
            color: var(--text-primary);
        }

        .markdown-table tr:last-child td {
            border-bottom: none;
        }

        .markdown-table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        /* GitHub Style Alerts */
        .markdown-alert {
            padding: 0.9rem 1.2rem;
            margin: 1.25rem 0;
            border-radius: 12px;
            border-right: 4px solid;
            background: var(--bg-card);
            line-height: 1.7;
        }

        .markdown-alert .alert-title {
            font-weight: 700;
            font-size: 0.9rem;
            margin-bottom: 0.35rem;
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }

        .alert-note {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.08);
            color: #93c5fd;
        }

        .alert-tip {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.08);
            color: #6ee7b7;
        }

        .alert-important {
            border-color: #8b5cf6;
            background: rgba(139, 92, 246, 0.08);
            color: #c4b5fd;
        }

        .alert-warning {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.08);
            color: #fcd34d;
        }

        .alert-caution {
            border-color: #f43f5e;
            background: rgba(244, 63, 94, 0.08);
            color: #fda4af;
        }

        /* Checkbox & Tasks */
        .task-checkbox {
            display: inline-block;
            font-size: 1.1em;
            margin-left: 0.4rem;
            vertical-align: middle;
            color: var(--text-muted);
        }

        .task-checkbox.checked {
            color: #10b981;
        }

        /* Blockquotes */
        .markdown-body blockquote {
            border-right: 3px solid var(--accent-primary);
            padding: 0.5rem 1rem;
            margin: 1rem 0;
            background: rgba(139, 92, 246, 0.05);
            border-radius: 0 8px 8px 0;
            color: var(--text-secondary);
        }

        /* Links */
        .markdown-body a {
            color: var(--accent-primary);
            text-decoration: underline;
            text-underline-offset: 3px;
        }

        .markdown-body a:hover {
            color: #a78bfa;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 200;
            background: #10b981;
            color: white;
            padding: 0.85rem 1.25rem;
            border-radius: 12px;
            font-weight: 600;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            cursor: pointer;
            user-select: none;
            max-width: calc(100vw - 4rem);
        }

        .toast:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(16, 185, 129, 0.5);
        }

        .toast:active {
            transform: translateY(0) scale(0.98);
        }

        .toast.show {
            transform: translateY(0);
            opacity: 1;
        }

        .toast-badge {
            background: rgba(255, 255, 255, 0.25);
            padding: 0.2rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            animation: fadeInCard 0.2s ease;
        }

        .toast-close-btn {
            background: transparent;
            border: none;
            color: white;
            opacity: 0.7;
            cursor: pointer;
            padding: 0.2rem 0.4rem;
            border-radius: 6px;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s, background 0.2s;
        }

        .toast-close-btn:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.2);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .navbar {
                padding: 0.75rem 1rem;
            }
            .container {
                padding: 1rem;
            }
            .cards-grid {
                grid-template-columns: 1fr;
            }
            .modal-content {
                max-height: 95vh;
                border-radius: 16px;
            }
            .modal-header {
                padding: 1rem;
            }
            .modal-body {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>

    <!-- Top Navigation -->
    <header class="navbar">
        <div class="brand-section">
            <div class="brand-logo">💬</div>
            <div class="brand-title">
                <h1>تاریخچه چت‌های پلتفرم انبار</h1>
                <p>پروژه اتوماسیون شیراز &bull; Gemini / Antigravity AI History</p>
            </div>
        </div>

        <div class="nav-actions">
            <button class="btn btn-secondary" onclick="toggleTheme()" title="تغییر تم">
                <span id="themeIcon">☀️</span>
                <span id="themeText">روشن</span>
            </button>
            <button class="btn btn-primary" onclick="syncNow()" id="syncBtn" title="همگام‌سازی و بازخوانی زنده چت‌ها">
                <span>🔄</span>
                <span>به‌روزرسانی زنده</span>
            </button>
        </div>
    </header>

    <main class="container">

        <!-- Stats Section -->
        <section class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6;">💬</div>
                <div class="stat-info">
                    <h3 id="statTotal">__TOTAL_CHATS__</h3>
                    <p>کل مکالمات ثبت‌شده</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6;">⚡</div>
                <div class="stat-info">
                    <h3 id="statMessages">__TOTAL_MESSAGES__</h3>
                    <p>کل تعاملات و پیام‌ها</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">📋</div>
                <div class="stat-info">
                    <h3 id="statPlans">__TOTAL_PLANS__</h3>
                    <p>طرح‌های اجرایی (Plans)</p>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">✅</div>
                <div class="stat-info">
                    <h3 id="statWalkthroughs">__TOTAL_WALKTHROUGHS__</h3>
                    <p>گزارش‌های کار نهایی</p>
                </div>
            </div>
        </section>

        <!-- Controls: Search & Tags -->
        <section class="controls-panel">
            <div class="search-row">
                <div class="search-wrapper">
                    <input type="text" id="searchInput" class="search-input" placeholder="جستجوی زنده در عناوین چت‌ها، خلاصه فارسی، تگ‌ها و..." oninput="filterChats()">
                    <span class="search-icon">🔍</span>
                </div>

                <label class="deep-search-label" title="فعال‌سازی جستجوی عمیق در متن تمامی پیام‌ها، ابزارها و گزارش‌های کار">
                    <input type="checkbox" id="deepSearchCheck" onchange="handleDeepSearchChange()">
                    <span>🔎 جستجوی عمیق در کل پیام‌ها</span>
                </label>

                <label class="toggle-deleted-label" title="نمایش یا عدم نمایش چت‌های حذف‌شده از سایدبار">
                    <input type="checkbox" id="showDeletedCheck" onchange="handleShowDeletedChange()">
                    <span>🗑️ نمایش حذف‌شده‌ها</span>
                </label>

                <div class="view-mode-group">
                    <button class="view-mode-btn active" id="btnGroupSmart" onclick="setGroupMode('smart')" title="گروه‌بندی هوشمند زمانی">
                        <span>🕒</span>
                        <span>هوشمند</span>
                    </button>
                    <button class="view-mode-btn" id="btnGroupMonth" onclick="setGroupMode('jalali_month')" title="گروه‌بندی بر اساس ماه شمسی">
                        <span>📅</span>
                        <span>ماهانه</span>
                    </button>
                    <button class="view-mode-btn" id="btnGroupFlat" onclick="setGroupMode('flat')" title="نمایش پیوسته بدون گروه‌بندی">
                        <span>🗂️</span>
                        <span>پیوسته</span>
                    </button>
                </div>

                <select id="sortSelect" class="sort-select" onchange="handleSortChange()">
                    <option value="newest_activity">🕒 جدیدترین فعالیت (Last Updated)</option>
                    <option value="newest_created">📅 جدیدترین چت (Created Newest)</option>
                    <option value="oldest_created">⏳ قدیمی‌ترین چت (Created Oldest)</option>
                    <option value="messages">🔥 بیشترین پیام‌ها</option>
                    <option value="title">🔤 عنوان الفبایی (A-Z)</option>
                </select>
            </div>

            <!-- Tags Filter -->
            <div class="tags-wrapper" id="tagsFilterContainer">
                <div class="tag-pill active" onclick="selectTag('ALL', this)">
                    <span>همه دسته‌ها</span>
                    <span class="tag-badge">__TOTAL_CHATS__</span>
                </div>
                <!-- Dynamic Tag Pills -->
            </div>
        </section>

        <!-- Cards & Groups Container -->
        <section class="time-groups-container" id="cardsGrid">
            <!-- Rendered by JS -->
        </section>

    </main>

    <!-- Modal Detail Viewer -->
    <div class="modal-overlay" id="chatModal" onclick="handleBackdropClick(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2 id="modalTitleEn">Chat Title</h2>
                    <div class="modal-meta-row">
                        <span id="modalDateJalali">📅 تاریخ</span>
                        <span>&bull;</span>
                        <span id="modalDateGregorian" class="en-font"></span>
                        <span>&bull;</span>
                        <span id="modalCid" class="card-cid">CID</span>
                        <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="copyCid()">📋 کپی شناسه</button>
                    </div>
                </div>
                <button class="modal-close-btn" onclick="closeModal()" title="بستن (Escape)">✕</button>
            </div>

            <!-- Modal Navigation Tabs -->
            <div class="modal-tabs">
                <button class="modal-tab-btn active" onclick="switchModalTab('messages', this)">
                    <span>💬</span>
                    <span>متن گفتگو و پیام‌ها</span>
                </button>
                <button class="modal-tab-btn" onclick="switchModalTab('plan', this)" id="tabPlanBtn">
                    <span>📋</span>
                    <span>طرح اجرایی (Plan)</span>
                </button>
                <button class="modal-tab-btn" onclick="switchModalTab('walkthrough', this)" id="tabWalkthroughBtn">
                    <span>✅</span>
                    <span>گزارش کار (Walkthrough)</span>
                </button>
            </div>

            <!-- Modal Content Body -->
            <div class="modal-body" id="modalBody">
                <!-- Injected by JS -->
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toastMessage" onclick="copyToastText()" title="برای کپی کردن متن کلیک کنید">
        <span id="toastIcon">✓</span>
        <span id="toastText">عملیات با موفقیت انجام شد</span>
        <span id="toastBadge" class="toast-badge" style="display:none;">کپی شد ✓</span>
        <button class="toast-close-btn" onclick="dismissToast(event)" title="بستن">✕</button>
    </div>

    <!-- Conversations JSON Data Injected Safely via Base64 -->
    <script>
        function decodeBase64Utf8(b64) {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return JSON.parse(new TextDecoder('utf-8').decode(bytes));
        }

        const RAW_CONVERSATIONS = decodeBase64Utf8("__B64_JSON__");
        let activeTag = 'ALL';
        let currentOpenChat = null;
        let activeGroupMode = localStorage.getItem('chat_group_mode') || 'smart';
        let activeSortBy = localStorage.getItem('chat_sort_by') || 'newest_activity';
        let isDeepSearch = localStorage.getItem('chat_deep_search') === 'true';

        function handleSortChange() {
            const val = document.getElementById('sortSelect').value;
            activeSortBy = val;
            localStorage.setItem('chat_sort_by', val);
            filterChats();
        }

        function handleDeepSearchChange() {
            isDeepSearch = document.getElementById('deepSearchCheck').checked;
            localStorage.setItem('chat_deep_search', isDeepSearch);
            filterChats();
        }

        function setGroupMode(mode) {
            activeGroupMode = mode;
            localStorage.setItem('chat_group_mode', mode);
            updateGroupButtons();
            filterChats();
        }

        function updateGroupButtons() {
            document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
            if (activeGroupMode === 'smart') {
                const btn = document.getElementById('btnGroupSmart');
                if (btn) btn.classList.add('active');
            } else if (activeGroupMode === 'jalali_month') {
                const btn = document.getElementById('btnGroupMonth');
                if (btn) btn.classList.add('active');
            } else {
                const btn = document.getElementById('btnGroupFlat');
                if (btn) btn.classList.add('active');
            }
        }

        function copyTitle(event, cid, btn) {
            event.stopPropagation();
            const c = RAW_CONVERSATIONS.find(item => item.id === cid);
            const title = c ? (c.title || c.title_en || '') : '';
            navigator.clipboard.writeText(title);
            if (btn) {
                btn.classList.add('copied');
                btn.innerHTML = '✓';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '📋';
                }, 1500);
            }
            showToast('عنوان چت در حافظه کپی شد: ' + title);
        }

        let expandedCardId = null;

        function handleCardClick(event, cid) {
            if (event.target.closest('.copy-title-btn') || event.target.closest('.btn')) {
                return;
            }
            if (expandedCardId === cid) {
                expandedCardId = null;
            } else {
                expandedCardId = cid;
            }
            document.querySelectorAll('.chat-card').forEach(el => {
                el.classList.toggle('expanded', el.dataset.cid === expandedCardId);
            });
        }

        function handleCardDblClick(event, cid) {
            if (event.target.closest('.copy-title-btn')) {
                return;
            }
            openChatModal(cid);
        }

        function renderCardHtml(c) {
            const isExpanded = expandedCardId === c.id;
            const chatTitle = c.title || c.title_en;
            const dateStr = c.created_at.jalali ? c.created_at.jalali.split('(')[0].trim() : c.created_at.gregorian;
            const isDeleted = c.is_deleted === true;
            return `
                <div class="chat-card ${isExpanded ? 'expanded' : ''} ${isDeleted ? 'deleted-card' : ''}" 
                     data-cid="${c.id}" 
                     onclick="handleCardClick(event, '${c.id}')" 
                     ondblclick="handleCardDblClick(event, '${c.id}')"
                     title="یک‌بار کلیک: مشاهده توضیحات بیشتر | دوبار کلیک: ورود به چت">
                    
                    <!-- Compact Header -->
                    <div class="card-compact-header">
                        <div class="title-with-copy">
                            <h3 class="card-title-en">${escapeHtml(chatTitle)}</h3>
                            ${isDeleted ? '<span class="deleted-badge" title="این چت در سایدبار حذف شده است">🗑️ حذف‌شده</span>' : ''}
                            <button class="copy-title-btn" onclick="copyTitle(event, '${c.id}', this)" title="کپی عنوان دقیق چت">📋</button>
                        </div>
                        <div class="card-compact-meta">
                            <span class="card-meta-date">📅 ${dateStr}</span>
                            <span class="card-chevron">▼</span>
                        </div>
                    </div>

                    <!-- Compact 1-line Summary -->
                    <p class="card-compact-summary">${escapeHtml(c.summary_fa)}</p>

                    <!-- Expanded Body (Accordion) -->
                    <div class="card-expanded-body">
                        <div class="card-full-summary-box">
                            <p class="card-full-summary-text">${escapeHtml(c.summary_fa)}</p>
                        </div>

                        <div class="card-tags" style="margin-top: 0.85rem;">
                            ${c.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
                        </div>

                        <div class="card-footer" style="margin-top: 0.85rem;">
                            <div class="card-badges">
                                <span class="pill-badge" style="background: rgba(255,255,255,0.05);">${c.messages_count} پیام</span>
                                ${isDeleted ? '<span class="pill-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">حذف‌شده از سایدبار</span>' : ''}
                                ${c.has_plan ? '<span class="pill-badge badge-plan">Plan</span>' : ''}
                                ${c.has_walkthrough ? '<span class="pill-badge badge-wt">Walkthrough</span>' : ''}
                            </div>
                            <span class="card-cid">${c.id.substring(0, 8)}</span>
                        </div>

                        <button class="btn btn-primary btn-open-chat" onclick="openChatModal('${c.id}')">
                            <span>💬</span>
                            <span>ورود به چت (یا دوبار کلیک)</span>
                        </button>
                    </div>
                </div>
            `;
        }

        function groupConversations(list, mode, sortBy) {
            if (mode === 'flat') {
                return [{ title: '', items: list }];
            }

            const now = new Date();
            const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            const yesterdayStart = todayMidnight - oneDayMs;
            const weekStart = todayMidnight - (7 * oneDayMs);
            const monthStart = todayMidnight - (30 * oneDayMs);

            if (mode === 'smart') {
                const groups = [
                    { title: '🌟 امروز (Today)', items: [] },
                    { title: '⏱️ دیروز (Yesterday)', items: [] },
                    { title: '📅 هفته جاری (This Week)', items: [] },
                    { title: '🗓️ ماه جاری (This Month)', items: [] },
                    { title: '📦 ماه‌های گذشته (Older)', items: [] }
                ];

                list.forEach(c => {
                    // Use created_at timestamp if sorted by created, else updated_at
                    const useCreated = sortBy.includes('created');
                    const ts = (useCreated ? (c.created_at.timestamp || c.updated_at.timestamp) : (c.updated_at.timestamp || c.created_at.timestamp) || 0) * 1000;
                    if (ts >= todayMidnight) {
                        groups[0].items.push(c);
                    } else if (ts >= yesterdayStart) {
                        groups[1].items.push(c);
                    } else if (ts >= weekStart) {
                        groups[2].items.push(c);
                    } else if (ts >= monthStart) {
                        groups[3].items.push(c);
                    } else {
                        groups[4].items.push(c);
                    }
                });

                return groups.filter(g => g.items.length > 0);
            } else if (mode === 'jalali_month') {
                const monthMap = new Map();
                list.forEach(c => {
                    const mName = c.created_at.jalali_month_year || 'سایر تاریخ‌ها';
                    if (!monthMap.has(mName)) {
                        monthMap.set(mName, []);
                    }
                    monthMap.get(mName).push(c);
                });

                const result = [];
                monthMap.forEach((items, mName) => {
                    result.push({
                        title: '🗓️ ' + mName,
                        items: items
                    });
                });
                return result;
            }
            return [{ title: '', items: list }];
        }

        // Render Tag Pills
        function initTags() {
            const container = document.getElementById('tagsFilterContainer');
            const tagCounts = {};
            
            RAW_CONVERSATIONS.forEach(c => {
                c.tags.forEach(t => {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            });

            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

            sortedTags.forEach(([tag, count]) => {
                const pill = document.createElement('div');
                pill.className = 'tag-pill';
                pill.onclick = () => selectTag(tag, pill);
                pill.innerHTML = `<span>${tag}</span><span class="tag-badge">${count}</span>`;
                container.appendChild(pill);
            });
        }

        function selectTag(tag, element) {
            activeTag = tag;
            document.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('active'));
            element.classList.add('active');
            filterChats();
        }

        let showDeleted = localStorage.getItem('chat_show_deleted') === 'true';

        function handleShowDeletedChange() {
            showDeleted = document.getElementById('showDeletedCheck').checked;
            localStorage.setItem('chat_show_deleted', showDeleted);
            filterChats();
        }

        function filterChats() {
            const query = document.getElementById('searchInput').value.trim().toLowerCase();
            const sortBy = activeSortBy;
            const isDeep = isDeepSearch;
            const grid = document.getElementById('cardsGrid');

            let filtered = RAW_CONVERSATIONS.filter(c => {
                if (!showDeleted && c.is_deleted) return false;

                const matchesTag = (activeTag === 'ALL' || c.tags.includes(activeTag));
                if (!matchesTag) return false;

                if (!query) return true;

                let textToSearch = [
                    c.title || '',
                    c.title_en || '',
                    c.summary_fa || '',
                    c.id,
                    c.tags.join(' '),
                    c.first_prompt || '',
                    c.created_at.jalali || '',
                    c.created_at.gregorian || ''
                ].join(' ');

                if (isDeep) {
                    const allMsgs = (c.messages || []).map(m => m.text + ' ' + (m.tools ? m.tools.join(' ') : '')).join(' ');
                    textToSearch += ' ' + allMsgs + ' ' + (c.plan_content || '') + ' ' + (c.walkthrough_content || '');
                }

                return textToSearch.toLowerCase().includes(query);
            });

            // Sorting
            filtered.sort((a, b) => {
                if (sortBy === 'newest_activity') return (b.updated_at.timestamp || 0) - (a.updated_at.timestamp || 0);
                if (sortBy === 'newest_created') return (b.created_at.timestamp || 0) - (a.created_at.timestamp || 0);
                if (sortBy === 'oldest_created') return (a.created_at.timestamp || 0) - (b.created_at.timestamp || 0);
                if (sortBy === 'messages') return b.messages_count - a.messages_count;
                if (sortBy === 'title') return (a.title || a.title_en || '').localeCompare(b.title || b.title_en || '', 'fa');
                return 0;
            });

            // Render cards
            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <h3>هیچ چتی با این مشخصات یافت نشد</h3>
                        <p>لطفاً عبارت جستجو یا دسته‌بندی انتخابی را تغییر دهید.</p>
                    </div>
                `;
                return;
            }

            const grouped = groupConversations(filtered, activeGroupMode, sortBy);

            if (activeGroupMode === 'flat') {
                grid.innerHTML = `
                    <div class="cards-grid">
                        ${filtered.map(c => renderCardHtml(c)).join('')}
                    </div>
                `;
            } else {
                grid.innerHTML = grouped.map(g => `
                    <div class="time-group-section">
                        <div class="group-header">
                            <div class="group-title-wrapper">
                                <span class="group-title-text">${escapeHtml(g.title)}</span>
                                <span class="group-count-badge">${g.items.length} چت</span>
                            </div>
                            <div class="group-divider-line"></div>
                        </div>
                        <div class="cards-grid">
                            ${g.items.map(c => renderCardHtml(c)).join('')}
                        </div>
                    </div>
                `).join('');
            }
        }

        function openChatModal(cid) {
            const chat = RAW_CONVERSATIONS.find(c => c.id === cid);
            if (!chat) return;
            currentOpenChat = chat;

            document.getElementById('modalTitleEn').innerText = chat.title || chat.title_en;
            document.getElementById('modalDateJalali').innerText = '📅 ' + (chat.created_at.jalali || '');
            document.getElementById('modalDateGregorian').innerText = chat.created_at.gregorian || '';
            document.getElementById('modalCid').innerText = chat.id;

            // Plan / Walkthrough tab visibility
            document.getElementById('tabPlanBtn').style.display = chat.has_plan ? 'inline-flex' : 'none';
            document.getElementById('tabWalkthroughBtn').style.display = chat.has_walkthrough ? 'inline-flex' : 'none';

            // Default to messages tab
            switchModalTab('messages', document.querySelector('.modal-tab-btn'));

            document.getElementById('chatModal').classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeModal() {
            document.getElementById('chatModal').classList.remove('active');
            document.body.style.overflow = 'auto';
            currentOpenChat = null;
        }

        function handleBackdropClick(e) {
            if (e.target.id === 'chatModal') {
                closeModal();
            }
        }

        function switchModalTab(tab, btn) {
            document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');

            const body = document.getElementById('modalBody');
            if (!currentOpenChat) return;

            if (tab === 'messages') {
                if (!currentOpenChat.messages || currentOpenChat.messages.length === 0) {
                    body.innerHTML = `
                        <div class="empty-state">
                            <h3>پیامی در لاگ این مکالمه ثبت نشده است</h3>
                            <p>${escapeHtml(currentOpenChat.summary_fa)}</p>
                        </div>
                    `;
                    return;
                }

                body.innerHTML = `
                    <div class="messages-container">
                        ${currentOpenChat.messages.map(m => `
                            <div class="message-bubble ${m.sender === 'user' ? 'user-message' : 'assistant-message'}">
                                <div class="message-header ${m.sender === 'user' ? 'user-header' : 'assistant-header'}">
                                    <span>${m.sender === 'user' ? '👤 درخواست شما (User)' : '🤖 پاسخ دستیار هوشمند (Assistant)'}</span>
                                    ${m.time ? `<span style="font-size:0.7rem; font-weight:normal; opacity:0.7;">${m.time.substring(11, 16)}</span>` : ''}
                                </div>
                                <div class="markdown-body">${formatAdvancedMarkdown(m.text)}</div>
                                ${m.tools && m.tools.length > 0 ? `
                                    <div class="tool-pill-list">
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">ابزارهای اجرا شده:</span>
                                        ${m.tools.map(t => `<span class="tool-pill">${escapeHtml(t)}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (tab === 'plan') {
                body.innerHTML = `
                    <div class="markdown-body" style="background: var(--bg-card); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border-color);">
                        ${formatAdvancedMarkdown(currentOpenChat.plan_content)}
                    </div>
                `;
            } else if (tab === 'walkthrough') {
                body.innerHTML = `
                    <div class="markdown-body" style="background: var(--bg-card); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border-color);">
                        ${formatAdvancedMarkdown(currentOpenChat.walkthrough_content)}
                    </div>
                `;
            }
        }

        // Advanced Markdown Renderer for clean tables, code blocks, alerts, checkboxes, and lists
        function formatAdvancedMarkdown(raw) {
            if (!raw) return '';
            
            // First escape HTML entities
            let text = escapeHtml(raw);

            // 1. Code blocks with headers and copy buttons
            text = text.replace(/```([a-zA-Z0-9_\-\.\+]*)\n([\s\S]*?)```/g, function(match, lang, code) {
                const langName = lang ? lang.trim().toUpperCase() : 'CODE';
                return `
                    <div class="code-block-wrapper">
                        <div class="code-header">
                            <span class="code-lang">${langName}</span>
                            <button class="copy-code-btn" onclick="copyCodeSnippet(this)">کپی کد</button>
                        </div>
                        <pre><code>${code.trim()}</code></pre>
                    </div>
                `;
            });

            // 2. Tables parsing
            text = text.replace(/(?:(?:^|\n)\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, function(tableBlock) {
                const lines = tableBlock.trim().split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length < 3) return tableBlock;

                const parseRow = (line) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
                const headerCols = parseRow(lines[0]);
                const bodyRows = lines.slice(2).map(parseRow);

                let html = '<div class="table-responsive"><table class="markdown-table"><thead><tr>';
                headerCols.forEach(c => { html += `<th>${c}</th>`; });
                html += '</tr></thead><tbody>';

                bodyRows.forEach(row => {
                    html += '<tr>';
                    row.forEach(c => { html += `<td>${c}</td>`; });
                    html += '</tr>';
                });

                html += '</tbody></table></div>';
                return html;
            });

            // 3. GitHub Style Callout Alerts
            const alertIcons = {
                'NOTE': '📌 یادداشت (Note)',
                'TIP': '💡 نکته کاربردی (Tip)',
                'IMPORTANT': '⚡ مهم و حیاتی (Important)',
                'WARNING': '⚠️ هشدار (Warning)',
                'CAUTION': '🛑 احتیاط (Caution)'
            };

            text = text.replace(/(?:^|\n)&gt; \s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\r?\n((?:&gt;[^\n]*\r?\n?)+)/gi, function(match, type, content) {
                const alertType = type.toUpperCase();
                const titleText = alertIcons[alertType] || alertType;
                const cleanBody = content.replace(/^&gt;\s?/gm, '').trim();
                return `
                    <div class="markdown-alert alert-${alertType.toLowerCase()}">
                        <div class="alert-title">${titleText}</div>
                        <p>${cleanBody.replace(/\n/g, '<br>')}</p>
                    </div>
                `;
            });

            // 4. Task List Checkboxes
            text = text.replace(/- \[x\]/gi, '<span class="task-checkbox checked">☑</span>');
            text = text.replace(/- \[ \]/g, '<span class="task-checkbox">☐</span>');

            // 5. Blockquotes
            text = text.replace(/(?:^|\n)&gt;\s?([^\n]+)/g, '<blockquote>$1</blockquote>');

            // 6. Headers
            text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
            text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

            // 7. Bold & Italic
            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

            // 8. Inline code
            text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

            // 9. Links [text](url)
            text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

            // 10. Horizontal Rules
            text = text.replace(/^(?:---|\*\*\*|___)$/gm, '<hr style="border:0; border-top:1px solid var(--border-color); margin:1.5rem 0;">');

            // 11. Unordered lists
            text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');

            // 12. Line breaks (preserve text paragraphs)
            text = text.replace(/\n\n/g, '</p><p>');
            text = text.replace(/\n/g, '<br>');

            return text;
        }

        function copyCodeSnippet(btn) {
            const wrapper = btn.closest('.code-block-wrapper');
            if (!wrapper) return;
            const codeEl = wrapper.querySelector('pre code');
            if (codeEl) {
                navigator.clipboard.writeText(codeEl.innerText);
                btn.innerText = 'کپی شد ✓';
                setTimeout(() => { btn.innerText = 'کپی کد'; }, 1500);
                showToast('کد در حافظه کپی شد');
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function copyCid() {
            if (currentOpenChat) {
                navigator.clipboard.writeText(currentOpenChat.id);
                showToast('شناسه چت کپی شد: ' + currentOpenChat.id);
            }
        }

        let toastTimer = null;
        let currentToastText = '';

        function showToast(msg) {
            const toast = document.getElementById('toastMessage');
            const textEl = document.getElementById('toastText');
            const badgeEl = document.getElementById('toastBadge');
            
            currentToastText = msg;
            textEl.innerText = msg;
            if (badgeEl) badgeEl.style.display = 'none';
            
            toast.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }

        function copyToastText() {
            if (currentToastText) {
                navigator.clipboard.writeText(currentToastText);
                const badgeEl = document.getElementById('toastBadge');
                if (badgeEl) {
                    badgeEl.style.display = 'inline-block';
                }
                clearTimeout(toastTimer);
                toastTimer = setTimeout(() => {
                    document.getElementById('toastMessage').classList.remove('show');
                }, 2000);
            }
        }

        function dismissToast(event) {
            event.stopPropagation();
            document.getElementById('toastMessage').classList.remove('show');
            clearTimeout(toastTimer);
        }

        function toggleTheme() {
            const html = document.documentElement;
            const icon = document.getElementById('themeIcon');
            const text = document.getElementById('themeText');
            
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                html.classList.add('light');
                icon.innerText = '🌙';
                text.innerText = 'تاریک';
                localStorage.setItem('theme', 'light');
            } else {
                html.classList.remove('light');
                html.classList.add('dark');
                icon.innerText = '☀️';
                text.innerText = 'روشن';
                localStorage.setItem('theme', 'dark');
            }
        }

        // Live Sync Action
        async function syncNow() {
            const btn = document.getElementById('syncBtn');
            btn.innerHTML = '<span>⏳</span><span>در حال همگام‌سازی...</span>';
            btn.disabled = true;

            try {
                const res = await fetch('/api/sync', { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    showToast('تاریخچه چت‌ها با موفقیت همگام‌سازی شد! (' + data.count + ' چت)');
                    setTimeout(() => window.location.reload(), 800);
                    return;
                }
            } catch (err) {
                // Offline / Static file mode fallback
            }

            showToast('برای اجرای همگام‌سازی، دستور python update_chat_history.py را اجرا کنید.');
            btn.innerHTML = '<span>🔄</span><span>به‌روزرسانی زنده</span>';
            btn.disabled = false;
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // Init
        document.addEventListener('DOMContentLoaded', () => {
            // Restore theme
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'light') {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
                document.getElementById('themeIcon').innerText = '🌙';
                document.getElementById('themeText').innerText = 'تاریک';
            }

            // Restore Sort selection
            const sortSelect = document.getElementById('sortSelect');
            if (sortSelect) {
                sortSelect.value = activeSortBy;
            }

            // Restore Deep Search check
            const deepCheck = document.getElementById('deepSearchCheck');
            if (deepCheck) {
                deepCheck.checked = isDeepSearch;
            }

            // Restore Show Deleted check
            const delCheck = document.getElementById('showDeletedCheck');
            if (delCheck) {
                delCheck.checked = showDeleted;
            }

            initTags();
            updateGroupButtons();
            filterChats();
        });
    </script>
</body>
</html>
"""
    # Replace placeholders cleanly
    html_content = html_raw.replace('__B64_JSON__', b64_json)
    html_content = html_content.replace('__TOTAL_CHATS__', str(total_chats))
    html_content = html_content.replace('__TOTAL_MESSAGES__', str(total_messages))
    html_content = html_content.replace('__TOTAL_PLANS__', str(total_plans))
    html_content = html_content.replace('__TOTAL_WALKTHROUGHS__', str(total_walkthroughs))
    
    return html_content

def sync_and_save():
    """Runs extraction, saves JSON and HTML dashboard."""
    start_t = time.time()
    convs = extract_all_conversations()
    html_content = generate_dashboard_html(convs)
    
    with open(OUTPUT_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)
        
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as jf:
        json.dump(convs, jf, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - start_t
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Synced {len(convs)} chats in {elapsed:.2f}s -> {OUTPUT_HTML_PATH}")
    return convs

class SyncHttpHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/chat_history_dashboard.html'
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            try:
                print("Live sync requested from browser dashboard...")
                convs = sync_and_save()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                resp = json.dumps({'status': 'ok', 'count': len(convs)})
                self.wfile.write(resp.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                resp = json.dumps({'status': 'error', 'message': str(e)})
                self.wfile.write(resp.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=5555):
    os.chdir(PROJECT_DIR)
    handler = SyncHttpHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        url = f"http://localhost:{port}/chat_history_dashboard.html"
        print(f"\n========================================================")
        print(f"  🚀 Chat History Dashboard Server Running!")
        print(f"  📍 Open in Browser: {url}")
        print(f"  🔄 Live Sync is active on button click in the UI")
        print(f"========================================================\n")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")

def get_brain_mtime_snapshot():
    """Returns a snapshot dictionary of directory mtimes to detect changes."""
    if not os.path.exists(BRAIN_DIR):
        return {}
    snapshot = {}
    for entry in os.listdir(BRAIN_DIR):
        epath = os.path.join(BRAIN_DIR, entry)
        if os.path.isdir(epath):
            tpath = os.path.join(epath, '.system_generated', 'logs', 'transcript.jsonl')
            if os.path.exists(tpath):
                snapshot[entry] = f"{os.path.getmtime(tpath)}_{os.path.getsize(tpath)}"
            else:
                snapshot[entry] = str(os.path.getmtime(epath))
    return snapshot

def watch_brain_directory(poll_interval=3):
    """Background polling watcher for automatic dashboard updates."""
    print(f"\n[WATCH MODE ACTIVE] Polling {BRAIN_DIR} every {poll_interval}s for new messages/chats...")
    last_snapshot = get_brain_mtime_snapshot()
    while True:
        try:
            time.sleep(poll_interval)
            current_snapshot = get_brain_mtime_snapshot()
            if current_snapshot != last_snapshot:
                print("\n[WATCH] Change detected in brain conversations! Auto-updating dashboard...")
                sync_and_save()
                last_snapshot = current_snapshot
        except KeyboardInterrupt:
            print("\nStopping watcher...")
            break
        except Exception as e:
            print(f"[WATCH ERROR] {e}")

def main():
    parser = argparse.ArgumentParser(description="Chat History Dashboard Generator & Sync Tool")
    parser.add_argument('--server', '-s', action='store_true', help="Run local HTTP server on port 5555")
    parser.add_argument('--watch', '-w', action='store_true', help="Continuously watch brain directory for changes")
    parser.add_argument('--port', '-p', type=int, default=5555, help="Port for HTTP server (default 5555)")
    args = parser.parse_args()

    # Initial extraction and build
    sync_and_save()

    if args.watch and args.server:
        watch_thread = threading.Thread(target=watch_brain_directory, daemon=True)
        watch_thread.start()
        run_server(port=args.port)
    elif args.watch:
        watch_brain_directory()
    elif args.server:
        run_server(port=args.port)

if __name__ == '__main__':
    main()
