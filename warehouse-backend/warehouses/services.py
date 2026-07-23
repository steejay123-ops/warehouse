from .models import SystemSetting

DEFAULT_SETTINGS = {
    'require_supervisor_approval': True,
    'require_doc_supervisor_approval': True,
    'blind_counting': 'blind',
    'max_recounts': -1,
    'default_conflict_strategy': 'ignore',
    'default_tag_status': 'عدم نیاز به چاپ',
    'system_version': '1.0',
}

def get_setting(key, warehouse_id=None):
    """
    Returns the effective setting for a given key and warehouse_id.
    It checks warehouse override first, then global, then default.
    """
    if warehouse_id:
        wh_setting = SystemSetting.objects.filter(key=key, warehouse_id=warehouse_id).first()
        if wh_setting:
            return wh_setting.value
            
    global_setting = SystemSetting.objects.filter(key=key, warehouse__isnull=True).first()
    if global_setting:
        return global_setting.value
        
    return DEFAULT_SETTINGS.get(key)

def get_all_settings(warehouse_id=None):
    """
    Returns all effective settings.
    """
    settings_dict = DEFAULT_SETTINGS.copy()
    
    global_settings = SystemSetting.objects.filter(warehouse__isnull=True)
    for s in global_settings:
        settings_dict[s.key] = s.value
        
    if warehouse_id:
        wh_settings = SystemSetting.objects.filter(warehouse_id=warehouse_id)
        for s in wh_settings:
            settings_dict[s.key] = s.value
            
    return settings_dict
