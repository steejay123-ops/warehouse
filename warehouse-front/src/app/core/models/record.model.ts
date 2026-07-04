/**
 * مدل‌های مربوط به رکوردهای کالای انبار
 * مطابق با Django warehouse.Record model
 */

export type RecordStatus = 'defined' | 'counting' | 'completed' | 'feeding' | 'archived';
export type LabelStatus = 'pending' | 'printed' | 'reprint';
export type FieldStatus = 'waiting' | 'counting' | 'recount' | 'done';
export type DocStatus = 'waiting' | 'processing' | 'done';
export type MTStatus = 'ready' | 'exported' | 'completed';
export type RecordCondition = 'new' | 'used' | 'refurbished';

export interface Record {
  id: number;
  code: string;
  mesc: string;
  part_no: string;
  description: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  condition: RecordCondition;
  remarks: string;
  project: number;
  project_code: string;
  project_name: string;
  tags: Tag[];
  tag_ids: number[];

  // وضعیت گردش کار
  status: RecordStatus;

  // فاز لیبل
  label_status: LabelStatus;

  // فاز میدانی
  field_assignee: number | null;
  field_assignee_name: string;
  field_status: FieldStatus;

  // فاز اسناد
  doc_assignee: number | null;
  doc_assignee_name: string;
  doc_status: DocStatus;

  // فاز تغذیه MT
  mt26_status: MTStatus;
  mt49_status: MTStatus;

  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  project: number | null;
}

export interface RecordCreatePayload {
  mesc: string;
  part_no: string;
  description: string;
  category: string;
  location: string;
  quantity: number;
  unit: string;
  condition: RecordCondition;
  remarks?: string;
  project: number;
  tag_ids?: number[];
}

export type RecordUpdatePayload = Partial<RecordCreatePayload>;

/** پارامترهای فیلتر / جستجوی رکوردها */
export interface RecordFilters {
  project?: number | string;
  status?: RecordStatus;
  field_status?: FieldStatus;
  doc_status?: DocStatus;
  label_status?: LabelStatus;
  category?: string;
  search?: string;
  tag?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

/** پیلود عملیات دسته‌ای */
export interface BulkDispatchPayload {
  record_ids: number[];
  assignee_id: number;
  type: 'field' | 'doc';
}

export interface BulkTagPayload {
  record_ids: number[];
  tag_ids: number[];
}

export interface BulkLabelPayload {
  record_ids: number[];
  action: 'print' | 'reprint';
}

export interface BulkRecountPayload {
  record_ids: number[];
}
