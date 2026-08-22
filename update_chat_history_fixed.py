#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat History Dashboard Generator & Sync Tool
Warehouse Project - Shahr-e Shiraz
Generates an interactive, standalone HTML dashboard containing full conversation history,
search, tags, modal reader, and automatic sync capabilities.
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

def format_date(dt_obj):
    if not dt_obj:
        return {"gregorian": "", "jalali": "", "formatted": ""}
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
        "timestamp": int(dt_obj.timestamp())
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

def clean_extracted_title(t):
    if not t:
        return ""
    t = t.replace('\\n', '\n').replace('\r', '\n')
    if '# User Requests' in t:
        t = t.split('# User Requests')[0]
    if '###' in t:
        t = t.split('###')[0]
    if '##' in t:
        t = t.split('##')[0]
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    for l in lines:
        l = re.sub(r'^(Conversation\s+[0-9a-f\-]+:?|[0-9a-f\-]{36}:?|Title:?)\s*', '', l, flags=re.IGNORECASE).strip()
        l = re.sub(r'-\s*Created:.*', '', l, flags=re.IGNORECASE).strip()
        l = re.sub(r'["\']}', '', l).strip()
        l = re.sub(r'^{{\s*CHECKPOINT\s*\d+\s*}}', '', l).strip()
        if l and not l.startswith('{') and not l.startswith('**') and len(l) >= 2:
            return l
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

def extract_all_conversations():
    if not os.path.exists(BRAIN_DIR):
        print(f"Brain directory not found at: {BRAIN_DIR}")
        return []

    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    cids = [d for d in os.listdir(BRAIN_DIR) if os.path.isdir(os.path.join(BRAIN_DIR, d)) and uuid_pattern.match(d)]
    print(f"Found {len(cids)} valid conversation folders in brain.")

    # Gather historical summaries from all transcripts across brain
    known_metadata = {}
    for cid in cids:
        tpath = os.path.join(BRAIN_DIR, cid, '.system_generated', 'logs', 'transcript.jsonl')
        if os.path.exists(tpath):
            try:
                with open(tpath, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        if 'CONVERSATION_HISTORY' in line or '<conversation_summaries>' in line:
                            try:
                                obj = json.loads(line)
                                raw_text = obj.get('content', '')
                                if not raw_text:
                                    continue
                                # Split by conversation blocks
                                sections = re.split(r'##\s*Conversation\s+([0-9a-f\-]+):', raw_text)
                                for i in range(1, len(sections), 2):
                                    mcid = sections[i].strip()
                                    sec_body = sections[i+1] if i+1 < len(sections) else ''
                                    
                                    # Extract title line
                                    title_line = sec_body.strip().split('\n')[0].strip()
                                    title_line = re.sub(r'-\s*Created:.*', '', title_line).strip()
                                    
                                    # Extract objective if present
                                    obj_match = re.search(r'###\s*USER\s*Objective:\s*([^\n\r]+(?:\n[^\n\r#]+)?)', sec_body)
                                    objective = obj_match.group(1).strip() if obj_match else ''
                                    
                                    if mcid not in known_metadata or (title_line and len(title_line) > len(known_metadata[mcid].get('title', ''))):
                                        known_metadata[mcid] = {
                                            'title': title_line,
                                            'objective': objective
                                        }
                            except Exception:
                                pass
                        elif '# USER Objective:' in line:
                            try:
                                obj_match = re.search(r'#\s*USER\s*Objective:\s*([^\n\r]+)', line)
                                if obj_match:
                                    obj_title = obj_match.group(1).strip()
                                    if obj_title and (cid not in known_metadata or not known_metadata[cid].get('title')):
                                        known_metadata[cid] = {
                                            'title': obj_title,
                                            'objective': obj_title
                                        }
                            except Exception:
                                pass
            except Exception:
                pass

    conversations = []

    for idx, cid in enumerate(cids):
        cdir = os.path.join(BRAIN_DIR, cid)
        tpath = os.path.join(cdir, '.system_generated', 'logs', 'transcript.jsonl')
        plan_path = os.path.join(cdir, 'implementation_plan.md')
        walkthrough_path = os.path.join(cdir, 'walkthrough.md')
        
        # Determine timestamps
        created_time = None
        updated_time = None
        
        if os.path.exists(tpath):
            created_time = datetime.datetime.fromtimestamp(os.path.getctime(tpath))
            updated_time = datetime.datetime.fromtimestamp(os.path.getmtime(tpath))
        elif os.path.exists(cdir):
            created_time = datetime.datetime.fromtimestamp(os.path.getctime(cdir))
            updated_time = datetime.datetime.fromtimestamp(os.path.getmtime(cdir))
        else:
            created_time = datetime.datetime.now()
            updated_time = datetime.datetime.now()

        # Read plan & walkthrough
        plan_content = ""
        plan_summary = ""
        if os.path.exists(plan_path):
            try:
                with open(plan_path, 'r', encoding='utf-8', errors='ignore') as pf:
                    plan_content = pf.read()
            except Exception:
                pass
                
        meta_plan = os.path.join(cdir, 'implementation_plan.md.metadata.json')
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

        meta_walkthrough = os.path.join(cdir, 'walkthrough.md.metadata.json')
        if os.path.exists(meta_walkthrough):
            try:
                with open(meta_walkthrough, 'r', encoding='utf-8', errors='ignore') as wmf:
                    wt_meta_obj = json.load(wmf)
                    walkthrough_summary = wt_meta_obj.get('Summary', '')
            except Exception:
                pass

        # Read transcript
        messages = []
        first_user_prompt = ""
        all_user_prompts = []
        tool_counts = 0
        
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
                            
                            if mtype == 'USER_INPUT' and msource == 'USER_EXPLICIT':
                                cleaned_p = clean_user_prompt(mcontent)
                                if cleaned_p:
                                    all_user_prompts.append(cleaned_p)
                                    if not first_user_prompt:
                                        first_user_prompt = cleaned_p
                                    messages.append({
                                        'sender': 'user',
                                        'text': cleaned_p,
                                        'raw': mcontent[:1000]
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
                                        'tools': tool_summary_list
                                    })
                        except Exception:
                            continue
            except Exception:
                pass

        # Determine Exact Title & Persian Summary
        exact_title = ""
        summary_fa = ""
        
        # 1. Check known metadata from conversation summaries / objectives
        if cid in known_metadata:
            k_meta = known_metadata[cid]
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

        # 4. Analyze prompt with topic classifier
        prompt_sample = (first_user_prompt or " ".join(all_user_prompts) or "")
        
        topic_rules = [
            (r'(?i)initial_count|شمارش اولیه|شمارش اول', 'Initial Count Workflow Implementation', 'پیاده‌سازی چرخه کاری وضعیت شمارش اولیه و ثبت مستقیم در انبارگردانی'),
            (r'(?i)barcode|بارکد|اسکنر|دوربین', 'Barcode Scanner Integration & Camera Review', 'یکپارچه‌سازی اسکنر، بارکدخوان، جستجوی بلادرنگ کالا و دوربین موبایل'),
            (r'(?i)counter|شمارشگر|شمارنده|داشبورد شمارش', 'Counter Dashboard UI & Workflow Enhancements', 'توسعه و بهینه‌سازی داشبورد شمارش، نوار فیلتر و کلیدهای میانبر انبار'),
            (r'(?i)supervisor|سرپرست|مدیر انبار', 'Supervisor Dashboard & Manager Review Cartable', 'پیاده‌سازی و اصلاحات کارتابل سرپرست، تایید گروهی و ثبت دلایل رد شمارش'),
            (r'(?i)customs|گمرک|کارتابل مالی|ترخیص', 'Customs Cartable Comprehensive Fixes & Redesign', 'بازطراحی چیدمان، اصلاح فیلدهای پویا و اعتبارسنجی کارتابل مالی و گمرک'),
            (r'(?i)personnel|id card|کارت پرسنلی|صدور کارت|بوم', 'Personnel ID Cards Customization & Print Canvas', 'طراحی بوم گرافیکی، تنظیم موقعیت پیکسل‌به‌پیکسل و صدور کارت پرسنلی'),
            (r'(?i)label|لیبل|چاپ لیبل|طراحی لیبل', 'Label Designer & Print Preview System', 'سیستم طراحی پویا، پیش‌نمایش چاپ و صدور لیبل‌های انبار و بارکد کالا'),
            (r'(?i)report|گزارش|گزارش‌ساز|dynamic report|join', 'Dynamic Report Builder & Multi-Entity Join Plan', 'موتور گزارش‌ساز پویا، ارتباط چند جدولی و خروجی ساختاریافته اکسل'),
            (r'(?i)migration|مایگریشن|database|پایگاه داده|postgres', 'Django Database Migration & Model Architecture', 'طراحی و اعمال مایگریشن‌های پیش‌رونده و بهینه‌سازی مدل‌های جنگو'),
            (r'(?i)permission|نقش|دستور|rbac|کاربر|users|auth', 'Role-Based Access Control & User Permissions System', 'مدیریت نقش‌ها، سطوح دسترسی پیشرفته فیلدها و احراز هویت پایدار'),
            (r'(?i)settings|تنظیمات|انبار شیراز', 'Warehouse Settings & Configuration Management', 'صفحه تنظیمات جامع انبار، مدیریت متغیرهای محیطی و فرم‌های پیکربندی'),
            (r'(?i)avatar|عکس کاربر|cropper|عکس پرسنل', 'Avatar Camera & Cropper Floating UI Refinement', 'ماژول عکاسی پرسنل، ابزار برش و فشرده‌سازی خودکار تصاویر آواتار'),
            (r'(?i)shortcut|کیبورد|کلید میانبر', 'Keyboard Shortcuts Comprehensive Audit & Cheat Sheet', 'ممیزی و پیاده‌سازی کلیدهای میانبر سراسری کیبورد در تمام فرم‌ها'),
            (r'(?i)filter|فیلتر|جستجو|omnisearch', 'OmniSearch & Smart Filtering Architecture', 'موتور جستجوی همه‌جانبه، فیلترهای چندمعیاره و حفظ وضعیت در URL'),
            (r'(?i)pwa|offline|آفلاین|sync', 'PWA Offline Storage & Local-First Synchronization', 'پشتیبانی آفلاین، کش داده‌های محلی و همگام‌سازی بلادرنگ'),
            (r'(?i)refresh|رفرش|دکمه تازه سازی', 'Live Refresh & Dynamic UI Synchronization', 'افزودن دکمه‌های تازه‌سازی زنده و به‌روزرسانی بدون بارگذاری مجدد'),
            (r'(?i)export|import|اکسل|excel', 'Excel Dynamic Import & Structured Data Export', 'سیستم درون‌ریزی و برون‌بری اکسل با نگاشت ستون‌های سفارشی'),
            (r'(?i)angular|build|بیلد|کامپایل', 'Angular Frontend Optimization & Build Fixes', 'بررسی و رفع خطاهای کامپایل، تست بیلد و بهینه‌سازی باندل فرانت‌اند'),
            (r'(?i)django|backend|viewset|api|rest', 'Django REST Framework Backend API Services', 'توسعه اندپوینت‌های API، ویوست‌ها و منطق بیزنس سمت سرور'),
        ]
        
        for pat, en_t, fa_s in topic_rules:
            if re.search(pat, prompt_sample + " " + plan_content):
                if not exact_title:
                    exact_title = en_t
                if not summary_fa:
                    summary_fa = fa_s
                break
                
        if not exact_title:
            if first_user_prompt:
                exact_title = first_user_prompt[:50] + ("..." if len(first_user_prompt) > 50 else "")
            else:
                exact_title = f"مکالمه انبار ({cid[:8].upper()})"
            
        if not summary_fa:
            if plan_summary:
                summary_fa = plan_summary[:160]
            elif walkthrough_summary:
                summary_fa = walkthrough_summary[:160]
            elif first_user_prompt:
                summary_fa = first_user_prompt[:140] + ("..." if len(first_user_prompt) > 140 else "")
            else:
                summary_fa = "مکالمه، پیاده‌سازی و مدیریت تسک‌های پروژه اتوماسیون انبار."

        tags = detect_tags(prompt_sample, plan_content)
        
        conversations.append({
            'id': cid,
            'title': exact_title,
            'title_en': exact_title,
            'summary_fa': summary_fa,
            'tags': tags,
            'updated_at': format_date(created_time),
            'updated_at': format_date(updated_time),
            'messages_count': len(messages),
            'tools_count': tool_counts,
            'has_plan': bool(plan_content),
            'has_walkthrough': bool(walkthrough_content),
            'plan_content': plan_content,
            'walkthrough_content': walkthrough_content,
            'messages': messages,
            'first_prompt': first_user_prompt
        })

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
    
    html_raw = """<!DOCTYPE html>
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

        .sort-select {
            padding: 0.85rem 1.2rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-card);
            color: var(--text-primary);
            font-size: 0.9rem;
            outline: none;
            cursor: pointer;
            min-width: 180px;
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

        /* Time Grouping Sections */
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
            max-width: 1000px;
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

        /* Markdown rendered content */
        .markdown-body {
            font-size: 0.95rem;
            color: var(--text-primary);
            line-height: 1.8;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: var(--text-primary);
            font-weight: 700;
        }

        .markdown-body p {
            margin-bottom: 1rem;
        }

        .markdown-body code {
            background: rgba(0, 0, 0, 0.3);
            padding: 0.2rem 0.45rem;
            border-radius: 6px;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 0.875em;
            color: #f472b6;
        }

        .markdown-body pre {
            background: #090d16;
            padding: 1.25rem;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            overflow-x: auto;
            margin: 1.25rem 0;
            direction: ltr;
            text-align: left;
        }

        .markdown-body pre code {
            background: none;
            padding: 0;
            color: #e2e8f0;
        }

        .markdown-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.25rem 0;
        }

        .markdown-body th, .markdown-body td {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border-color);
            text-align: right;
        }

        .markdown-body th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 700;
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
                    <input type="text" id="searchInput" class="search-input" placeholder="جستجوی زنده در عناوین چت‌ها، خلاصه فارسی، تگ‌ها و متن گفتگوها..." oninput="filterChats()">
                    <span class="search-icon">🔍</span>
                </div>

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

                <select id="sortSelect" class="sort-select" onchange="filterChats()">
                    <option value="newest">📅 جدیدترین به قدیمی‌ترین</option>
                    <option value="oldest">📅 قدیمی‌ترین به جدیدترین</option>
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

        function copyTitle(event, title, btn) {
            event.stopPropagation();
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
        let expandedCardEl = null;

        function handleCardClick(event, cid) {
            // Ignore if clicked on copy button or buttons inside expanded area
            if (event.target.closest('.copy-title-btn') || event.target.closest('.btn')) {
                return;
            }
            // Use the actual clicked element (not just its id) as the source of truth.
            // This guarantees only the exact card the user clicked toggles, even if
            // two cards were ever rendered with the same id.
            const clickedEl = event.currentTarget;

            if (expandedCardEl === clickedEl) {
                clickedEl.classList.remove('expanded');
                expandedCardEl = null;
                expandedCardId = null;
                return;
            }

            if (expandedCardEl) {
                expandedCardEl.classList.remove('expanded');
            }
            clickedEl.classList.add('expanded');
            expandedCardEl = clickedEl;
            expandedCardId = cid;
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
            return `
                <div class="chat-card ${isExpanded ? 'expanded' : ''}" 
                     data-cid="${c.id}" 
                     onclick="handleCardClick(event, '${c.id}')" 
                     ondblclick="handleCardDblClick(event, '${c.id}')"
                     title="یک‌بار کلیک: مشاهده توضیحات بیشتر | دوبار کلیک: ورود به چت">
                    
                    <!-- Compact Header -->
                    <div class="card-compact-header">
                        <div class="title-with-copy">
                            <h3 class="card-title-en">${escapeHtml(chatTitle)}</h3>
                            <button class="copy-title-btn" data-title="${escapeHtml(chatTitle)}" onclick="copyTitle(event, this.dataset.title, this)" title="کپی عنوان دقیق چت">📋</button>
                        </div>
                        <div class="card-compact-meta">
                            <span class="card-meta-date">📅 ${c.updated_at.jalali ? c.updated_at.jalali.split('(')[0].trim() : c.updated_at.gregorian}</span>
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

        function groupConversations(list, mode) {
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
                    const ts = (c.updated_at.timestamp || c.updated_at.timestamp || 0) * 1000;
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
                    const mName = c.updated_at.jalali_month_year || 'سایر تاریخ‌ها';                   
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

        function filterChats() {
            const query = document.getElementById('searchInput').value.trim().toLowerCase();
            const sortBy = document.getElementById('sortSelect').value;
            const grid = document.getElementById('cardsGrid');

            let filtered = RAW_CONVERSATIONS.filter(c => {
                const matchesTag = (activeTag === 'ALL' || c.tags.includes(activeTag));
                if (!matchesTag) return false;

                if (!query) return true;

                const textToSearch = [
                    c.title || '',
                    c.title_en || '',
                    c.summary_fa || '',
                    c.id,
                    c.tags.join(' '),
                    c.first_prompt || '',
                    c.updated_at.jalali || '',
                    c.updated_at.gregorian || ''                   
                ].join(' ').toLowerCase();

                return textToSearch.includes(query);
            });

            // Sorting
            filtered.sort((a, b) => {
                if (sortBy === 'newest') return (b.updated_at.timestamp || 0) - (a.updated_at.timestamp || 0);
                if (sortBy === 'oldest') return (a.updated_at.timestamp || 0) - (b.updated_at.timestamp || 0);
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

            const grouped = groupConversations(filtered, activeGroupMode);

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

            // Re-sync the tracked expanded element reference to the freshly
            // rendered DOM node (the old reference is now detached).
            expandedCardEl = expandedCardId
                ? grid.querySelector(`.chat-card[data-cid="${expandedCardId}"]`)
                : null;
        }

        function openChatModal(cid) {
            const chat = RAW_CONVERSATIONS.find(c => c.id === cid);
            if (!chat) return;
            currentOpenChat = chat;

            document.getElementById('modalTitleEn').innerText = chat.title || chat.title_en;
            document.getElementById('modalDateJalali').innerText = '📅 ' + (chat.updated_at.jalali || '');
            document.getElementById('modalDateGregorian').innerText = chat.updated_at.gregorian || '';
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
                                </div>
                                <div class="markdown-body">${formatSimpleMarkdown(m.text)}</div>
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
                        ${formatSimpleMarkdown(currentOpenChat.plan_content)}
                    </div>
                `;
            } else if (tab === 'walkthrough') {
                body.innerHTML = `
                    <div class="markdown-body" style="background: var(--bg-card); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--border-color);">
                        ${formatSimpleMarkdown(currentOpenChat.walkthrough_content)}
                    </div>
                `;
            }
        }

        function formatSimpleMarkdown(text) {
            if (!text) return '';
            let html = escapeHtml(text);
            // Headers
            html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
            // Bold
            html = html.replace(/\\*\\*(.*?)\\*\\*/gim, '<strong>$1</strong>');
            // Code block
            html = html.replace(/```([a-z]*)\\n([\\s\\S]*?)```/gim, '<pre><code>$2</code></pre>');
            // Inline code
            html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
            // Line breaks
            html = html.replace(/\\n/gim, '<br>');
            return html;
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
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

class SyncHttpHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/chat_history_dashboard.html'
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            try:
                print("Live sync requested from browser dashboard...")
                convs = extract_all_conversations()
                html_content = generate_dashboard_html(convs)
                with open(OUTPUT_HTML_PATH, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                resp = json.dumps({'status': 'ok', 'count': len(convs)})
                self.wfile.write(resp.encode('utf-8'))
                print(f"Sync complete! Re-generated {len(convs)} conversations.")
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

def main():
    print("Extracting conversations from brain and transcripts...")
    convs = extract_all_conversations()
    print(f"Extracted {len(convs)} conversations successfully.")
    
    html_content = generate_dashboard_html(convs)
    with open(OUTPUT_HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"Dashboard saved successfully to: {OUTPUT_HTML_PATH}")

    # Also save json backup
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as jf:
        json.dump(convs, jf, ensure_ascii=False, indent=2)
    print(f"JSON data backup saved to: {OUTPUT_JSON_PATH}")

    if '--server' in sys.argv or '-s' in sys.argv:
        run_server()

if __name__ == '__main__':
    main()
