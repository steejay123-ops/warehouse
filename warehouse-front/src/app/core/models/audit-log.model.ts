/**
 * مدل‌های رهگیری تغییرات (Audit Trail)
 * مطابق با Django audit.AuditLog model
 */

export type AuditAction = 'create' | 'update' | 'delete' | 'dispatch' | 'login' | 'logout' | 'import' | 'export';

export interface AuditLog {
  id: number;
  user: number | null;
  user_display: string;
  action: AuditAction;
  model_name: string;
  object_id: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  ip_address: string | null;
  timestamp: string;
}

export interface AuditFilters {
  user?: number;
  action?: AuditAction;
  model_name?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface ImportLog {
  id: number;
  user: number | null;
  user_display: string;
  project: number;
  project_name: string;
  original_filename: string;
  records_created: number;
  records_updated: number;
  errors: ImportError[];
  status: 'processing' | 'done' | 'failed';
  created_at: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}
