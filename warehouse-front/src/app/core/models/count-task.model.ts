import { Item } from './item.model';

export type CountTaskStatus = 
  | 'PENDING_COUNT'
  | 'COUNTED'
  | 'SUPERVISOR_REJECTED'
  | 'MANAGER_REVIEW'
  | 'MANAGER_REJECTED'
  | 'FINAL_APPROVED';

export interface CountTaskHistory {
  id: number;
  task: number;
  action_by: number | null;
  action_type: string;
  counted_balance: string | null;
  note: string | null;
  created_at: string;
  action_by_name?: string;
}

export interface CountTask {
  id: number;
  item: number;
  counter: number;
  supervisor: number;
  status: CountTaskStatus;
  counted_balance: string | null;
  counter_note: string | null;
  supervisor_note: string | null;
  manager_note: string | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  modified_by: number | null;
  
  // Serializer method fields & nested objects
  counter_name?: string;
  supervisor_name?: string;
  item_details?: Item;
  history?: CountTaskHistory[];
}
