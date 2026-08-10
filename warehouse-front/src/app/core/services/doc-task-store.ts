import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { offlineDb } from './offline-db';
import { OfflineSyncService } from './offline-sync.service';
import { SyncPullService } from './sync-pull.service';
import { environment } from '../../../environments/environment';
import { DocTask } from '../models/doc-task.model';

/**
 * DocTaskStore — مخزن Local-First تسک‌های مالی/اسناد
 *
 * خواندن/نوشتن فقط با Dexie انجام می‌شود؛ سرور در پس‌زمینه سینک می‌شود:
 * - خواندن: از جدول `docTasks` (که Pull پُرش می‌کند) — نمایش فوری حتی آفلاین
 * - نوشتن: به‌روزرسانی خوش‌بینانه محلی (پرچم `_offlinePending`) + enqueue در صف
 * - بعد از هر پردازش موفق صف، Pull دلتا اجرا می‌شود تا نسخهٔ رسمی سرور جایگزین شود
 */
@Injectable({ providedIn: 'root' })
export class DocTaskStore {
  private sync = OfflineSyncService.getInstance();
  readonly pull = SyncPullService.getInstance();

  private lastWarehouseId: number | null = null;
  private subs: Subscription[] = [];
  private wired = false;

  /**
   * سیم‌کشی تریگرهای Pull خودکار (یک‌بار)
   */
  private wireTriggers(): void {
    if (this.wired) return;
    this.wired = true;

    this.subs.push(
      this.sync.syncOutcome$.subscribe((outcome) => {
        const touched =
          (outcome.status === 'completed' && outcome.synced > 0) ||
          (outcome.status === 'partial' && (outcome.synced > 0 || outcome.rejected > 0));
        if (touched && this.lastWarehouseId !== null) {
          this.pull.pullChanges(this.lastWarehouseId);
        }
      })
    );

    this.subs.push(
      this.sync.rejected$.subscribe((err) => {
        if (err.entityType?.startsWith('doc_task') && this.lastWarehouseId !== null) {
          this.pull.pullChanges(this.lastWarehouseId);
        }
      })
    );
  }

  // ════════════════════════════════════════════
  //  خواندن (از Dexie)
  // ════════════════════════════════════════════

  /** تسک‌های خود کارشناس مالی در یک انبار */
  async getMyTasks(warehouseId: number, userId: number): Promise<DocTask[]> {
    const rows = await offlineDb.docTasks
      .where('warehouse_id').equals(warehouseId).toArray();
    return rows.filter((t: DocTask) => t.doc_worker === userId && !t._offlinePending === false || (t.doc_worker === userId));
  }

  /** تسک‌های استخر (بدون کارشناس، در انتظار بررسی) */
  async getPoolTasks(warehouseId: number): Promise<DocTask[]> {
    const rows = await offlineDb.docTasks
      .where('warehouse_id').equals(warehouseId).toArray();
    return rows.filter(
      (t: DocTask) => t.doc_worker === null && t.status === 'PENDING_DOC'
    );
  }

  // ════════════════════════════════════════════
  //  Pull
  // ════════════════════════════════════════════

  /** دانلود دلتای انبار در پس‌زمینه */
  refresh(warehouseId: number): Promise<unknown> {
    this.lastWarehouseId = warehouseId;
    this.wireTriggers();
    return this.pull.pullChanges(warehouseId);
  }

  // ════════════════════════════════════════════
  //  نوشتن (خوش‌بینانه محلی + صف)
  // ════════════════════════════════════════════

  /**
   * ذخیرهٔ پیش‌نویس فیلدهای مالی — status تغییری نمی‌کند.
   */
  async saveDraft(
    task: DocTask,
    changes: Partial<DocTask>,
    userId: number
  ): Promise<void> {
    if (!task.sync_id) throw new Error('sync_id missing');

    await offlineDb.docTasks.update(task.sync_id, {
      ...changes,
      _offlinePending: true,
    });

    await this.sync.enqueue(
      'PATCH',
      `${environment.apiUrl}/inventory/doc-tasks/${task.id}/`,
      { ...changes, base_updated_at: task.updated_at },
      {
        userId,
        entityType: 'doc_task',
        entitySyncId: task.sync_id,
        baseUpdatedAt: task.updated_at,
      }
    );

    this.sync.processQueue();
  }

  /**
   * ارسال گروهی تسک‌های بررسی‌شده.
   * وضعیت محلی خوش‌بینانه DOC_PROCESSED (یا DOC_MANAGER_REVIEW) می‌شود.
   */
  async submitTasks(tasks: DocTask[], userId: number): Promise<void> {
    const withSyncId = tasks.filter((t) => t.sync_id);
    for (const t of withSyncId) {
      await offlineDb.docTasks.update(t.sync_id!, {
        status: 'DOC_PROCESSED',
        _offlinePending: true,
      });
    }

    await this.sync.enqueue(
      'POST',
      `${environment.apiUrl}/inventory/doc-tasks/bulk_submit/`,
      {
        task_ids: tasks.map((t) => t.id).filter((id) => !!id),
        sync_ids: withSyncId.map((t) => t.sync_id),
      },
      { userId, entityType: 'doc_task_bulk' }
    );

    this.sync.processQueue();
  }
}
