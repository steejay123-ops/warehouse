from django.core.cache import cache
from .models import SystemSetting

DEFAULT_SETTINGS = {
    'manager_approval_mode': 'any_manager',
    'require_supervisor_approval': True,
    'require_doc_supervisor_approval': True,
    'blind_counting': 'blind',
    'default_conflict_strategy': 'ignore',
    'system_version': '1.0',
    'offline_sync_interval_minutes': 15,
    'offline_cache_ttl_minutes': 60,
    'field_permissions_counter': {},
    'field_permissions_doc': {},
    'scanner_row_delimiter': ';',
    'scanner_col_delimiter': '|',
    'counter_can_view_history': True,
    'counter_can_view_previous_notes': True,
    'financial_can_view_history': True,
    'financial_can_view_previous_notes': True,
    'scanner_camera_preset': 'adaptive',
    'scanner_custom_resolution': '1080p',
    'scanner_custom_interval_ms': 60,
    'scanner_custom_roi_size': 850,
    'scanner_custom_try_harder': True,
}

SETTINGS_CACHE_TTL = 3600  # 1 hour

def get_setting_cache_key(key, warehouse_id=None):
    return f"sys_setting:{key}:{warehouse_id or 'global'}"

def clear_setting_cache(key=None, warehouse_id=None):
    if key:
        cache.delete(get_setting_cache_key(key, warehouse_id))
        cache.delete(get_setting_cache_key(key, None))
    cache.delete(f"sys_settings_all:{warehouse_id or 'global'}")
    cache.delete("sys_settings_all:global")

def get_setting(key, warehouse_id=None):
    """
    Returns the effective setting for a given key and warehouse_id.
    It checks warehouse override first, then global, then default.
    Uses Django cache to eliminate repeated DB queries.
    """
    cache_key = get_setting_cache_key(key, warehouse_id)
    cached_val = cache.get(cache_key)
    if cached_val is not None:
        return cached_val

    result = DEFAULT_SETTINGS.get(key)
    
    if warehouse_id:
        wh_setting = SystemSetting.objects.filter(key=key, warehouse_id=warehouse_id).first()
        if wh_setting:
            result = wh_setting.value
            cache.set(cache_key, result, SETTINGS_CACHE_TTL)
            return result
            
    global_setting = SystemSetting.objects.filter(key=key, warehouse__isnull=True).first()
    if global_setting:
        result = global_setting.value
        
    cache.set(cache_key, result, SETTINGS_CACHE_TTL)
    return result

def get_all_settings(warehouse_id=None):
    """
    Returns all effective settings with caching.
    """
    cache_key = f"sys_settings_all:{warehouse_id or 'global'}"
    cached_dict = cache.get(cache_key)
    if cached_dict is not None:
        return cached_dict

    settings_dict = DEFAULT_SETTINGS.copy()
    
    global_settings = SystemSetting.objects.filter(warehouse__isnull=True)
    for s in global_settings:
        settings_dict[s.key] = s.value
        
    if warehouse_id:
        wh_settings = SystemSetting.objects.filter(warehouse_id=warehouse_id)
        for s in wh_settings:
            settings_dict[s.key] = s.value
            
    cache.set(cache_key, settings_dict, SETTINGS_CACHE_TTL)
    return settings_dict

