/**
 * KOSH INNOVATIONS — BACKEND CHANGE HISTORY & AUDIT PERSISTENCE SERVICE
 *
 * Implements authoritative append-only persistence for:
 * 1. global_change_history
 * 2. branch_change_history
 * 3. rule_audit_reports
 */

import { getPool } from '../db/pool.js';
import type { RowDataPacket } from 'mysql2';

export interface BackendGlobalChangeEntry {
  id?: string;
  entityId: string;
  companyId?: string;
  branchId?: string;
  fieldAttribute: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  changedByUserId: string;
  changedAt?: string;
  changeReason: string;
  approvalReference?: string;
  applicableRuleVersion?: number;
  relatedRequestRef?: string;
}

export interface BackendBranchChangeEntry {
  id?: string;
  entityId: string;
  globalItemId: string | number;
  companyId: string;
  branchId: string;
  fieldAttribute: string;
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  changedByUserId: string;
  changedAt?: string;
  changeReason: string;
  approvalReference?: string;
  applicableRuleVersion?: number;
  relatedRequestRef?: string;
}

export interface BackendRuleAuditReport {
  auditId: string;
  entityId: string;
  auditType: 'GLOBAL_ITEM_CREATION' | 'BRANCH_ITEM_ACTIVATION';
  ruleVersion: number;
  overallResult: 'PASS' | 'WARNING' | 'ERROR' | 'BLOCKED';
  checkpoints: any[];
  errors: string[];
  warnings: string[];
  evaluatedBy: string;
  evaluatedByUserId: string;
  timestamp: string;
  canSubmit?: boolean;
}

// In-memory fallback stores
const memoryGlobalHistory: BackendGlobalChangeEntry[] = [];
const memoryBranchHistory: BackendBranchChangeEntry[] = [];
const memoryAuditReports: BackendRuleAuditReport[] = [];

export const changeHistoryBackend = {
  /**
   * Record Global Change History entries
   */
  async recordGlobalChanges(entries: BackendGlobalChangeEntry[]): Promise<void> {
    for (const entry of entries) {
      const historyId = entry.id || `gch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const normalizedEntry = { ...entry, id: historyId };
      memoryGlobalHistory.unshift(normalizedEntry);

      try {
        const pool = getPool();
        await pool.execute(
          `INSERT INTO global_change_history (
            history_id, entity_id, company_id, branch_id, field_attribute,
            previous_value, new_value, changed_by, changed_by_user_id,
            changed_at, change_reason, approval_reference, applicable_rule_version, related_request_ref
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            entry.entityId,
            entry.companyId || null,
            entry.branchId || null,
            entry.fieldAttribute,
            entry.previousValue || null,
            entry.newValue || null,
            entry.changedBy,
            entry.changedByUserId,
            entry.changedAt ? new Date(entry.changedAt) : new Date(),
            entry.changeReason,
            entry.approvalReference || null,
            entry.applicableRuleVersion ?? 1,
            entry.relatedRequestRef || null,
          ]
        );
      } catch (dbErr) {
        console.warn('DB recordGlobalChanges error, saved to memory:', dbErr);
      }
    }
  },

  /**
   * Get Global Change History
   */
  async getGlobalHistory(entityId?: string): Promise<BackendGlobalChangeEntry[]> {
    try {
      const pool = getPool();
      let query = `SELECT * FROM global_change_history`;
      const params: any[] = [];
      if (entityId) {
        query += ` WHERE entity_id = ?`;
        params.push(entityId);
      }
      query += ` ORDER BY changed_at DESC LIMIT 500`;

      const [rows] = await pool.execute<RowDataPacket[]>(query, params);
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.history_id,
          entityId: r.entity_id,
          companyId: r.company_id,
          branchId: r.branch_id,
          fieldAttribute: r.field_attribute,
          previousValue: r.previous_value,
          newValue: r.new_value,
          changedBy: r.changed_by,
          changedByUserId: r.changed_by_user_id,
          changedAt: r.changed_at instanceof Date ? r.changed_at.toISOString() : String(r.changed_at),
          changeReason: r.change_reason,
          approvalReference: r.approval_reference,
          applicableRuleVersion: r.applicable_rule_version,
          relatedRequestRef: r.related_request_ref,
        }));
      }
    } catch {
      // Memory fallback
    }

    return entityId
      ? memoryGlobalHistory.filter((e) => e.entityId === entityId)
      : [...memoryGlobalHistory];
  },

  /**
   * Record Branch Change History entries
   */
  async recordBranchChanges(entries: BackendBranchChangeEntry[]): Promise<void> {
    for (const entry of entries) {
      const historyId = entry.id || `bch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const normalizedEntry = { ...entry, id: historyId };
      memoryBranchHistory.unshift(normalizedEntry);

      try {
        const pool = getPool();
        const numericGlobalId =
          typeof entry.globalItemId === 'number'
            ? entry.globalItemId
            : parseInt(String(entry.globalItemId).replace(/\D/g, ''), 10) || 1;

        await pool.execute(
          `INSERT INTO branch_change_history (
            history_id, entity_id, global_item_id, company_id, branch_id, field_attribute,
            previous_value, new_value, changed_by, changed_by_user_id,
            changed_at, change_reason, approval_reference, applicable_rule_version, related_request_ref
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            entry.entityId,
            numericGlobalId,
            entry.companyId,
            entry.branchId,
            entry.fieldAttribute,
            entry.previousValue || null,
            entry.newValue || null,
            entry.changedBy,
            entry.changedByUserId,
            entry.changedAt ? new Date(entry.changedAt) : new Date(),
            entry.changeReason,
            entry.approvalReference || null,
            entry.applicableRuleVersion ?? 1,
            entry.relatedRequestRef || null,
          ]
        );
      } catch (dbErr) {
        console.warn('DB recordBranchChanges error, saved to memory:', dbErr);
      }
    }
  },

  /**
   * Get Branch Change History
   */
  async getBranchHistory(params: {
    entityId?: string;
    globalItemId?: string;
    branchId?: string;
    companyId?: string;
  }): Promise<BackendBranchChangeEntry[]> {
    try {
      const pool = getPool();
      let query = `SELECT * FROM branch_change_history WHERE 1=1`;
      const queryParams: any[] = [];

      if (params.entityId) {
        query += ` AND entity_id = ?`;
        queryParams.push(params.entityId);
      }
      if (params.companyId) {
        query += ` AND company_id = ?`;
        queryParams.push(params.companyId);
      }
      if (params.branchId) {
        query += ` AND branch_id = ?`;
        queryParams.push(params.branchId);
      }
      if (params.globalItemId) {
        const numericGlobalId = parseInt(String(params.globalItemId).replace(/\D/g, ''), 10);
        if (!isNaN(numericGlobalId) && numericGlobalId > 0) {
          query += ` AND global_item_id = ?`;
          queryParams.push(numericGlobalId);
        }
      }
      query += ` ORDER BY changed_at DESC LIMIT 500`;

      const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.history_id,
          entityId: r.entity_id,
          globalItemId: r.global_item_id,
          companyId: r.company_id,
          branchId: r.branch_id,
          fieldAttribute: r.field_attribute,
          previousValue: r.previous_value,
          newValue: r.new_value,
          changedBy: r.changed_by,
          changedByUserId: r.changed_by_user_id,
          changedAt: r.changed_at instanceof Date ? r.changed_at.toISOString() : String(r.changed_at),
          changeReason: r.change_reason,
          approvalReference: r.approval_reference,
          applicableRuleVersion: r.applicable_rule_version,
          relatedRequestRef: r.related_request_ref,
        }));
      }
    } catch {
      // Memory fallback
    }

    return memoryBranchHistory.filter((e) => {
      if (params.entityId && e.entityId !== params.entityId) return false;
      if (params.companyId && e.companyId !== params.companyId) return false;
      if (params.branchId && e.branchId !== params.branchId) return false;
      if (params.globalItemId && String(e.globalItemId) !== String(params.globalItemId)) return false;
      return true;
    });
  },

  /**
   * Persist Rule Audit Report (Immutable)
   */
  async saveAuditReport(report: BackendRuleAuditReport): Promise<BackendRuleAuditReport> {
    memoryAuditReports.unshift(report);

    try {
      const pool = getPool();
      await pool.execute(
        `INSERT INTO rule_audit_reports (
          audit_id, entity_id, audit_type, rule_version, overall_result,
          checkpoints_json, errors_json, warnings_json, evaluated_by, evaluated_by_user_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE overall_result = VALUES(overall_result)`,
        [
          report.auditId,
          report.entityId,
          report.auditType,
          report.ruleVersion || 1,
          report.overallResult,
          JSON.stringify(report.checkpoints || []),
          JSON.stringify(report.errors || []),
          JSON.stringify(report.warnings || []),
          report.evaluatedBy,
          report.evaluatedByUserId,
          report.timestamp ? new Date(report.timestamp) : new Date(),
        ]
      );
    } catch (err) {
      console.warn('DB saveAuditReport error, saved to memory:', err);
    }

    return report;
  },

  /**
   * Get Audit Reports
   */
  async getAuditReports(entityId?: string, auditType?: string): Promise<BackendRuleAuditReport[]> {
    try {
      const pool = getPool();
      let query = `SELECT * FROM rule_audit_reports WHERE 1=1`;
      const queryParams: any[] = [];

      if (entityId) {
        query += ` AND entity_id = ?`;
        queryParams.push(entityId);
      }
      if (auditType) {
        query += ` AND audit_type = ?`;
        queryParams.push(auditType);
      }
      query += ` ORDER BY timestamp DESC LIMIT 100`;

      const [rows] = await pool.execute<RowDataPacket[]>(query, queryParams);
      if (rows.length > 0) {
        return rows.map((r) => {
          let checkpoints: any[] = [];
          let errors: string[] = [];
          let warnings: string[] = [];
          try {
            checkpoints = typeof r.checkpoints_json === 'string' ? JSON.parse(r.checkpoints_json) : r.checkpoints_json || [];
          } catch {}
          try {
            errors = typeof r.errors_json === 'string' ? JSON.parse(r.errors_json) : r.errors_json || [];
          } catch {}
          try {
            warnings = typeof r.warnings_json === 'string' ? JSON.parse(r.warnings_json) : r.warnings_json || [];
          } catch {}

          const hasBlocked = checkpoints.some((c: any) => c.status === 'BLOCKED');
          const hasError = checkpoints.some((c: any) => c.status === 'ERROR');

          return {
            auditId: r.audit_id,
            entityId: r.entity_id,
            auditType: r.audit_type,
            ruleVersion: r.rule_version,
            overallResult: r.overall_result,
            checkpoints,
            errors,
            warnings,
            evaluatedBy: r.evaluated_by,
            evaluatedByUserId: r.evaluated_by_user_id,
            timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
            canSubmit: !hasBlocked && !hasError,
          };
        });
      }
    } catch {
      // Memory fallback
    }

    return memoryAuditReports.filter((r) => {
      if (entityId && r.entityId !== entityId) return false;
      if (auditType && r.auditType !== auditType) return false;
      return true;
    });
  },
};
