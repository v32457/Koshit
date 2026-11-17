/**
 * KOSH INNOVATIONS — CHANGE HISTORY SERVICE
 *
 * Implements append-only field-level change history tracking for:
 * 1. Global Item Master (global_change_history)
 * 2. Branch Item Availability (branch_change_history)
 *
 * Every mutation records:
 * - entityId
 * - companyId, branchId
 * - fieldAttribute
 * - previousValue, newValue
 * - changedBy, changedByUserId
 * - changedAt (ISO Timestamp)
 * - changeReason
 * - approvalReference
 * - applicableRuleVersion
 * - relatedRequestRef
 */

import { GlobalChangeHistoryEntry, BranchChangeHistoryEntry } from '../types';

const STORAGE_KEY_GLOBAL_HISTORY = 'kosh_global_change_history_v1';
const STORAGE_KEY_BRANCH_HISTORY = 'kosh_branch_change_history_v1';

export interface DiffContext {
  companyId?: string;
  branchId?: string;
  changedBy: string;
  changedByUserId: string;
  changeReason: string;
  approvalReference?: string;
  applicableRuleVersion?: number;
  relatedRequestRef?: string;
}

function stringifyValue(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

const IGNORED_DIFF_KEYS = new Set([
  'updatedAt',
  'updatedBy',
  'updatedByName',
  'lastAuditReportId',
  'lastAuditStatus',
  'approvalHistory',
  'revisionHistory',
]);

export const changeHistoryService = {
  /**
   * Get Global Item Change History
   */
  async getGlobalHistory(entityId?: string): Promise<GlobalChangeHistoryEntry[]> {
    // 1. Try backend API if in browser
    if (typeof window !== 'undefined') {
      try {
        const url = entityId
          ? `/api/change-history/global?entityId=${encodeURIComponent(entityId)}`
          : '/api/change-history/global';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            return json.data;
          }
        }
      } catch {
        // Fallback to local storage
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_GLOBAL_HISTORY);
        if (raw) {
          const list: GlobalChangeHistoryEntry[] = JSON.parse(raw);
          return entityId ? list.filter((e) => e.entityId === entityId) : list;
        }
      } catch {}
    }
    return [];
  },

  /**
   * Append Global Item Change Entries
   */
  async recordGlobalChanges(entries: GlobalChangeHistoryEntry[]): Promise<void> {
    if (!entries.length) return;

    // 1. Save to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const existing = await this.getGlobalHistory();
        const merged = [...entries, ...existing];
        localStorage.setItem(STORAGE_KEY_GLOBAL_HISTORY, JSON.stringify(merged));
      } catch {}
    }

    // 2. Post to backend if in browser
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/change-history/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
      } catch (err) {
        console.warn('Backend global history sync failed:', err);
      }
    }
  },

  /**
   * Diff two versions of a Global Item and record append-only changes
   */
  async diffAndRecordGlobalChanges(
    entityId: string,
    previousItem: Record<string, any> | undefined | null,
    newItem: Record<string, any>,
    context: DiffContext
  ): Promise<GlobalChangeHistoryEntry[]> {
    const entries: GlobalChangeHistoryEntry[] = [];
    if (!previousItem) {
      // Creation entry
      const entry: GlobalChangeHistoryEntry = {
        id: `gch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        entityId,
        companyId: context.companyId,
        branchId: context.branchId,
        fieldAttribute: 'ITEM_CREATION',
        previousValue: '',
        newValue: newItem.globalItemCode || stringifyValue(newItem),
        changedBy: context.changedBy,
        changedByUserId: context.changedByUserId,
        changedAt: new Date().toISOString(),
        changeReason: context.changeReason || 'Initial Global Item Master creation',
        approvalReference: context.approvalReference,
        applicableRuleVersion: context.applicableRuleVersion ?? 1,
        relatedRequestRef: context.relatedRequestRef,
      };
      entries.push(entry);
    } else {
      const allKeys = new Set([...Object.keys(previousItem), ...Object.keys(newItem)]);
      for (const key of allKeys) {
        if (IGNORED_DIFF_KEYS.has(key)) continue;

        const prevStr = stringifyValue(previousItem[key]);
        const newStr = stringifyValue(newItem[key]);

        if (prevStr !== newStr) {
          entries.push({
            id: `gch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            entityId,
            companyId: context.companyId,
            branchId: context.branchId,
            fieldAttribute: key,
            previousValue: prevStr,
            newValue: newStr,
            changedBy: context.changedBy,
            changedByUserId: context.changedByUserId,
            changedAt: new Date().toISOString(),
            changeReason: context.changeReason || `Updated field ${key}`,
            approvalReference: context.approvalReference,
            applicableRuleVersion: context.applicableRuleVersion,
            relatedRequestRef: context.relatedRequestRef,
          });
        }
      }
    }

    if (entries.length > 0) {
      await this.recordGlobalChanges(entries);
    }
    return entries;
  },

  /**
   * Get Branch Item Change History
   */
  async getBranchHistory(params: {
    entityId?: string;
    globalItemId?: string;
    branchId?: string;
    companyId?: string;
  }): Promise<BranchChangeHistoryEntry[]> {
    // 1. Try backend API if in browser
    if (typeof window !== 'undefined') {
      try {
        const query = new URLSearchParams();
        if (params.entityId) query.set('entityId', params.entityId);
        if (params.globalItemId) query.set('globalItemId', params.globalItemId);
        if (params.branchId) query.set('branchId', params.branchId);
        if (params.companyId) query.set('companyId', params.companyId);

        const res = await fetch(`/api/change-history/branch?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            return json.data;
          }
        }
      } catch {
        // Fallback to local storage
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BRANCH_HISTORY);
        if (raw) {
          let list: BranchChangeHistoryEntry[] = JSON.parse(raw);
          if (params.entityId) {
            list = list.filter((e) => e.entityId === params.entityId);
          }
          if (params.globalItemId) {
            list = list.filter((e) => String(e.globalItemId) === String(params.globalItemId));
          }
          if (params.branchId) {
            list = list.filter((e) => e.branchId === params.branchId);
          }
          if (params.companyId) {
            list = list.filter((e) => e.companyId === params.companyId);
          }
          return list;
        }
      } catch {}
    }
    return [];
  },

  /**
   * Append Branch Item Change Entries
   */
  async recordBranchChanges(entries: BranchChangeHistoryEntry[]): Promise<void> {
    if (!entries.length) return;

    // 1. Save to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const existing = await this.getBranchHistory({});
        const merged = [...entries, ...existing];
        localStorage.setItem(STORAGE_KEY_BRANCH_HISTORY, JSON.stringify(merged));
      } catch {}
    }

    // 2. Post to backend if in browser
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/change-history/branch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
        });
      } catch (err) {
        console.warn('Backend branch history sync failed:', err);
      }
    }
  },

  /**
   * Diff two versions of a Branch Item Record and record append-only changes
   */
  async diffAndRecordBranchChanges(
    entityId: string,
    globalItemId: string,
    companyId: string,
    branchId: string,
    previousRecord: Record<string, any> | undefined | null,
    newRecord: Record<string, any>,
    context: DiffContext
  ): Promise<BranchChangeHistoryEntry[]> {
    const entries: BranchChangeHistoryEntry[] = [];

    if (!previousRecord) {
      entries.push({
        id: `bch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        entityId,
        globalItemId,
        companyId,
        branchId,
        fieldAttribute: 'BRANCH_ITEM_ACTIVATION',
        previousValue: '',
        newValue: stringifyValue(newRecord),
        changedBy: context.changedBy,
        changedByUserId: context.changedByUserId,
        changedAt: new Date().toISOString(),
        changeReason: context.changeReason || 'Initial Branch Item Availability configured',
        approvalReference: context.approvalReference,
        applicableRuleVersion: context.applicableRuleVersion ?? 1,
        relatedRequestRef: context.relatedRequestRef,
      });
    } else {
      const allKeys = new Set([...Object.keys(previousRecord), ...Object.keys(newRecord)]);
      for (const key of allKeys) {
        if (IGNORED_DIFF_KEYS.has(key)) continue;

        const prevStr = stringifyValue(previousRecord[key]);
        const newStr = stringifyValue(newRecord[key]);

        if (prevStr !== newStr) {
          entries.push({
            id: `bch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            entityId,
            globalItemId,
            companyId,
            branchId,
            fieldAttribute: key,
            previousValue: prevStr,
            newValue: newStr,
            changedBy: context.changedBy,
            changedByUserId: context.changedByUserId,
            changedAt: new Date().toISOString(),
            changeReason: context.changeReason || `Field modified: ${key}`,
            approvalReference: context.approvalReference,
            applicableRuleVersion: context.applicableRuleVersion,
            relatedRequestRef: context.relatedRequestRef,
          });
        }
      }
    }

    if (entries.length > 0) {
      await this.recordBranchChanges(entries);
    }
    return entries;
  },
};
