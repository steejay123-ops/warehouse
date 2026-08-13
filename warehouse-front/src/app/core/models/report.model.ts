/**
 * مدل‌های گزارش‌ساز پویا — قرارداد با /api/reports/
 */

export type ReportFieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'choice';

export type ReportOperator =
  | 'eq' | 'icontains' | 'istartswith' | 'in' | 'isnull'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export type AggFn = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ReportEntity {
  key: string;
  label: string;
}

export interface ReportFieldMeta {
  key: string;
  label: string;
  type: ReportFieldType;
  operators: ReportOperator[];
  choices: string[] | null;
  groupable: boolean;
  aggregatable: boolean;
  dynamic: boolean;
}

export interface ReportJoinMeta {
  key: string;           // کلید JOIN در whitelist
  target: string;        // کلید موجودیت مقصد
  label: string;         // برچسب فارسی
  cardinality: 'many' | 'one';
  allowed_types: ('left' | 'inner')[];
  default_alias: string; // alias پیشنهادی (= key)
}

export interface EntityFieldsResponse {
  entity: string;
  label: string;
  warehouse_required_for_dynamic: boolean;
  fields: ReportFieldMeta[];
  joins: ReportJoinMeta[];
}

export interface ReportJoinSpec {
  to: string;            // کلید JOIN در whitelist
  type: 'left' | 'inner';
  as: string;            // alias — فیلدهای مقصد با alias.field آدرس‌دهی می‌شوند
}

/** برگ شرط فیلتر */
export interface FilterCondition {
  field: string;
  operator: ReportOperator;
  value: unknown;
  /** نقیض شرط (NOT) */
  not?: boolean;
}

/** گروه AND/OR بازگشتی */
export interface FilterGroup {
  op: 'AND' | 'OR';
  children: FilterNode[];
  /** نقیض کل گروه (NOT) */
  not?: boolean;
}

export type FilterNode = FilterGroup | FilterCondition;

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (node as FilterGroup).op !== undefined;
}

export interface ReportAggregation {
  field: string;
  fn: AggFn;
  alias?: string;
}

export interface ReportSort {
  field: string;
  dir: 'asc' | 'desc';
}

export type HavingOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

/** شرط روی نتایج تجمیع (HAVING) — فقط با گروه‌بندی */
export interface ReportHaving {
  alias: string;
  operator: HavingOperator;
  value: unknown;
}

export type ChartType = 'bar' | 'pie' | 'line';

/** تنظیم نمودار — فقط سمت کلاینت؛ engine آن را نادیده می‌گیرد */
export interface ReportChart {
  type: ChartType;
  /** کلید یکی از فیلدهای group_by */
  x: string;
  /** alias یکی از تجمیع‌ها */
  y: string;
}

export interface ReportSpec {
  entity: string;
  warehouse_id?: number | null;
  joins?: ReportJoinSpec[];
  fields?: string[];
  filters?: FilterGroup | null;
  group_by?: string[];
  aggregations?: ReportAggregation[];
  having?: ReportHaving[];
  sort?: ReportSort[];
  chart?: ReportChart | null;
  page?: number;
  page_size?: number;
  report_name?: string;
  /** فقط برای export — پیش‌فرض بک‌اند xlsx است */
  format?: 'xlsx' | 'pdf';
}

export interface ReportColumn {
  key: string;
  label: string;
  type: ReportFieldType;
}

export interface ReportResult {
  columns: ReportColumn[];
  count: number;
  page: number;
  page_size: number;
  rows: Record<string, unknown>[];
  /** حالت JOIN — فقط وقتی joins در spec بود برمی‌گردد */
  join_mode?: 'flat' | 'exists' | 'aggregated';
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string | null;
  entity: string;
  spec: ReportSpec;
  is_public: boolean;
  warehouse: number | null;
  owner: number;
  owner_username: string;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ReportExportJob {
  id: number;
  report_name: string;
  status: ExportJobStatus;
  status_display: string;
  progress: number;
  total_rows: number;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

/** نتیجه export: یا فایل فوری یا job پس‌زمینه */
export type ExportOutcome =
  | { kind: 'file'; blob: Blob }
  | { kind: 'job'; jobId: number; totalRows: number };
