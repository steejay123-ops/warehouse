// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { financeOfflineDb, warehouseOfflineDb } from './offline-db';

describe('OfflineDatabase schema and indexing specifications', () => {
  it('should include project_id as an indexed key in financeOfflineDb attendanceRecords table', () => {
    expect(financeOfflineDb.attendanceRecords).toBeDefined();
    const indexes = financeOfflineDb.attendanceRecords.schema.indexes;
    const indexNames = indexes.map(idx => idx.name);
    
    expect(indexNames).toContain('project_id');
    expect(indexNames).toContain('date');
    expect(indexNames).toContain('status');
  });

  it('should include project_id as an indexed key in warehouseOfflineDb attendanceRecords table', () => {
    expect(warehouseOfflineDb.attendanceRecords).toBeDefined();
    const indexes = warehouseOfflineDb.attendanceRecords.schema.indexes;
    const indexNames = indexes.map(idx => idx.name);
    
    expect(indexNames).toContain('project_id');
  });

  it('should find project_id index in table schema indexes', () => {
    const hasIndexInFinance = financeOfflineDb.attendanceRecords.schema.indexes.some(idx => idx.name === 'project_id');
    const hasIndexInWarehouse = warehouseOfflineDb.attendanceRecords.schema.indexes.some(idx => idx.name === 'project_id');

    expect(hasIndexInFinance).toBe(true);
    expect(hasIndexInWarehouse).toBe(true);
  });
});
