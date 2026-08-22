import { inject } from '@angular/core';
import { Router, CanActivateFn, CanActivateChildFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * گارد احراز هویت — فقط کاربران لاگین‌شده اجازه ورود دارند
 */
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  'dashboard': ['view_sys_dashboard', 'view_wh_dashboard'],
  'users': ['view_sys_users'],
  'projects': ['view_sys_projects'],
  'id-cards': ['view_sys_id_cards'],
  'counter': ['view_sys_counter'],
  'supervisor': ['view_sys_supervisor'],
  'manager-review': ['view_sys_manager_review'],
  'recounts': ['view_sys_recounts'],
  'settings': ['view_sys_settings'],
  'docs': ['view_wh_docs'],
  'dispatch': ['view_wh_dispatch'],
  'customs': ['view_wh_customs'],
  'doc_approvals': ['view_wh_doc_approvals'],
  'feeding': ['view_wh_feeding'],
  'feed_approvals': ['view_wh_feed_approvals'],
  'labels': ['view_wh_labels'],
  'label-designer': ['view_wh_label_designer'],
  'audit': ['view_wh_audit', 'perm_sys_logs']
};

export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // اگر URL حاوی هش verify-card باشد (مثلاً از لینک‌های قدیمی یا اسکن با #)، مستقیماً بدون لاگین هدایت شود
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash;
    const match = hash.match(/#\/?verify-card(?:\/([^/?#]+))?/);
    if (match) {
      const code = match[1];
      const targetUrl = code ? `/verify-card/${code}` : '/verify-card';
      return router.parseUrl(targetUrl);
    }
  }

  if (auth.isLoggedIn()) {
    const user = auth.user();
    if (user?.requires_password_change) {
      if (state.url.includes('/change-password')) {
        return true;
      }
      return router.parseUrl('/change-password');
    }
    
    // Check RBAC permissions
    const path = route.routeConfig?.path;
    if (path && ROUTE_PERMISSIONS[path]) {
        const requiredPerms = ROUTE_PERMISSIONS[path];
        const userPerms = auth.userPermissions();
        const isAdmin = userPerms.includes('admin_all');
        
        if (!isAdmin) {
            const hasAccess = requiredPerms.some(p => userPerms.includes(p));
            if (!hasAccess) {
                // Find first available tab
                for (const p of Object.keys(ROUTE_PERMISSIONS)) {
                    if (ROUTE_PERMISSIONS[p].some(req => userPerms.includes(req))) {
                        return router.parseUrl('/' + p);
                    }
                }
                // Fallback if no permissions
                return router.parseUrl('/login');
            }
        }
    }
    
    return true;
  }
  return router.parseUrl('/login');
};

export const AuthGuardChild: CanActivateChildFn = (childRoute, state) => {
  return AuthGuard(childRoute, state);
};
