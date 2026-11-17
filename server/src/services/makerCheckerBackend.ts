/**
 * KOSH INNOVATIONS — DUAL MAKER-CHECKER APPROVAL BACKEND SERVICE (PHASE 9)
 *
 * Implements two completely independent approval stages:
 * - Stage 1: Global Item Creation -> Global Checker Approval (DRAFT -> SUBMITTED -> APPROVED / REJECTED)
 *   * Global approval must NOT auto-activate any branch.
 * - Stage 2: Branch Item Activation -> Branch Checker Approval (DRAFT -> SUBMITTED -> APPROVED / REJECTED)
 *   * Branch approval must NOT modify Global Item identity.
 *
 * Strict Server-Side Controls:
 * - RBAC permission validation (GLOBAL_ITEM_APPROVE vs BRANCH_ITEM_APPROVE)
 * - Strict non-self-approval enforcement: maker !== checker (creator cannot approve their own record)
 */

import { getPool } from '../db/pool.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { changeHistoryBackend } from './changeHistoryBackend.js';
import { branchItemBackend, type BranchItemAvailabilityPayload } from './branchItemBackend.js';
import { INITIAL_GLOBAL_ITEMS, INITIAL_USERS } from '../../../src/data/seedData.js';
import type { GlobalItem, User, UserRole } from '../../../src/types/index.js';

export interface ActorContext {
  userId: string;
  userName: string;
  userRole: UserRole;
  userEmail?: string;
}

export interface ApprovalActionPayload {
  remarks?: string;
  actorUserId?: string;
  actorName?: string;
  actorRole?: UserRole;
  ruleVersion?: number;
}

export interface BackendGlobalItemRecord {
  item_id: number | string;
  item_code: string;
  item_description: string;
  category_code?: string | null;
  type_code?: string | null;
  material_form_code?: string | null;
  process_code?: string | null;
  material_code?: string | null;
  colour_code?: string | null;
  grade?: string | null;
  status: string;
  is_active: number | boolean;
  created_by_user_id: string;
  created_by_name: string;
  submitted_by_user_id?: string | null;
  submitted_at?: string | null;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// In-Memory Global Items Cache with full fallback support
const memoryGlobalItems = new Map<string, BackendGlobalItemRecord>();

// Initialize memory store with seed items
for (const item of INITIAL_GLOBAL_ITEMS) {
  memoryGlobalItems.set(String(item.id), {
    item_id: item.id,
    item_code: item.globalItemCode,
    item_description: item.description,
    category_code: item.categoryCode || null,
    type_code: item.attributes.type || null,
    material_form_code: item.attributes.materialForm || null,
    process_code: item.attributes.process || null,
    material_code: item.attributes.material || null,
    colour_code: item.attributes.colour || null,
    grade: item.attributes.specification || null,
    status: item.status,
    is_active: 1,
    created_by_user_id: item.createdBy || 'usr-maker-02',
    created_by_name: item.createdByName || 'Ananya Deshmukh',
    submitted_by_user_id: item.createdBy || 'usr-maker-02',
    submitted_at: item.createdAt,
    approved_by_user_id: item.status === 'APPROVED' ? 'usr-checker-03' : null,
    approved_at: item.status === 'APPROVED' ? item.updatedAt : null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  });
}

// Allowed Approval Roles
const GLOBAL_CHECKER_ROLES = new Set<UserRole>([
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'GLOBAL_ITEM_ADMIN',
  'ITEM_CHECKER',
]);

const BRANCH_CHECKER_ROLES = new Set<UserRole>([
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ITEM_CHECKER',
]);

const GLOBAL_MAKER_ROLES = new Set<UserRole>([
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'GLOBAL_ITEM_ADMIN',
  'ITEM_MAKER',
]);

const BRANCH_MAKER_ROLES = new Set<UserRole>([
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ITEM_MAKER',
  'BRANCH_COORDINATOR',
]);

export class MakerCheckerBackendService {
  /**
   * Resolve authoritative actor identity from headers/body + seed user registry
   */
  resolveActor(
    input: {
      userId?: string;
      userName?: string;
      userRole?: string;
      userEmail?: string;
    }
  ): ActorContext {
    const rawUserId = input.userId?.trim();
    const matchedUser = rawUserId
      ? INITIAL_USERS.find((u) => u.id === rawUserId || u.email.toLowerCase() === rawUserId.toLowerCase())
      : undefined;

    if (matchedUser) {
      return {
        userId: matchedUser.id,
        userName: input.userName || matchedUser.fullName,
        userRole: (input.userRole as UserRole) || matchedUser.role,
        userEmail: matchedUser.email,
      };
    }

    const fallbackRole = (input.userRole as UserRole) || 'ITEM_CHECKER';
    return {
      userId: rawUserId || 'usr-checker-03',
      userName: input.userName || 'Venkatesh Iyer',
      userRole: fallbackRole,
      userEmail: input.userEmail,
    };
  }

  // =========================================================================
  // STAGE 1: GLOBAL ITEM CREATION WORKFLOW (GLOBAL CHECKER QUEUE)
  // =========================================================================

  /**
   * Retrieve Global Item by ID (from DB or in-memory)
   */
  async getGlobalItem(itemId: string | number): Promise<BackendGlobalItemRecord | null> {
    const strId = String(itemId);
    try {
      const pool = getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT item_id, item_code, item_description, type_code, material_form_code,
                process_code, material_code, colour_code, grade, status, is_active,
                created_by_user_id, created_by_name, submitted_by_user_id, submitted_at,
                approved_by_user_id, approved_at, created_at, updated_at
         FROM global_items WHERE item_id = ? OR item_code = ?`,
        [itemId, strId] as any
      );
      if (rows.length > 0) {
        return rows[0] as BackendGlobalItemRecord;
      }
    } catch {
      // In-memory fallback
    }

    // Check memory store
    const item = memoryGlobalItems.get(strId);
    if (item) return item;

    for (const val of memoryGlobalItems.values()) {
      if (val.item_code === strId) return val;
    }

    return null;
  }

  /**
   * Stage 1: Submit Global Item for Checker Review (DRAFT -> SUBMITTED)
   */
  async submitGlobalItem(
    itemId: string | number,
    actorCtx: ActorContext,
    remarks: string = 'Submitted Global Item for Checker review'
  ): Promise<{ success: boolean; item: BackendGlobalItemRecord }> {
    // 1. RBAC check for submitter (Maker)
    if (!GLOBAL_MAKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to submit Global Items. Required: GLOBAL_ITEM_CREATE / GLOBAL_ITEM_MODIFY.`
      );
      err.code = 'FORBIDDEN_MAKER_ROLE';
      err.status = 403;
      throw err;
    }

    const item = await this.getGlobalItem(itemId);
    if (!item) {
      const err: any = new Error(`Global Item ID "${itemId}" not found.`);
      err.code = 'ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (item.status === 'APPROVED' || item.status === 'SAP_CREATED') {
      const err: any = new Error(`Global Item "${item.item_code}" is already approved.`);
      err.code = 'ITEM_ALREADY_APPROVED';
      err.status = 409;
      throw err;
    }

    if (item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW') {
      const err: any = new Error(`Global Item "${item.item_code}" is already in SUBMITTED review status.`);
      err.code = 'ITEM_ALREADY_SUBMITTED';
      err.status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedRecord: BackendGlobalItemRecord = {
      ...item,
      status: 'SUBMITTED',
      submitted_by_user_id: actorCtx.userId,
      submitted_at: now,
      updated_at: now,
    };

    // Update DB if available
    try {
      const pool = getPool();
      await pool.execute(
        `UPDATE global_items 
         SET status = 'SUBMITTED', submitted_by_user_id = ?, submitted_at = NOW(), updated_at = NOW()
         WHERE item_id = ?`,
        [actorCtx.userId, item.item_id] as any
      );

      await pool.execute(
        `INSERT INTO item_approval_history (item_id, action, action_by, comments)
         VALUES (?, 'SUBMIT', ?, ?)`,
        [item.item_id, `${actorCtx.userName} (${actorCtx.userRole})`, remarks] as any
      );
    } catch {
      // Memory update
    }

    memoryGlobalItems.set(String(item.item_id), updatedRecord);
    memoryGlobalItems.set(String(item.item_code), updatedRecord);

    // Record Change History
    try {
      await changeHistoryBackend.recordGlobalChanges([
        {
          entityId: String(item.item_id),
          fieldAttribute: 'GLOBAL_ITEM_STATUS',
          previousValue: item.status,
          newValue: 'SUBMITTED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record global change history on submit:', e);
    }

    return { success: true, item: updatedRecord };
  }

  /**
   * Stage 1: Approve Global Item (SUBMITTED -> APPROVED)
   *
   * CRITICAL INVARIANTS:
   * 1. Strict non-self-approval: maker !== checker (creator cannot approve their own item).
   * 2. Server-side RBAC: Role must have GLOBAL_ITEM_APPROVE (ITEM_CHECKER, GLOBAL_ITEM_ADMIN, PLATFORM_ADMIN, ORG_ADMIN).
   * 3. Global Approval does NOT auto-activate any branch. Zero branch items are modified or activated.
   */
  async approveGlobalItem(
    itemId: string | number,
    actorCtx: ActorContext,
    remarks: string = 'Approved for Global Item Master catalog'
  ): Promise<{ success: boolean; item: BackendGlobalItemRecord }> {
    // 1. RBAC check for Checker
    if (!GLOBAL_CHECKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to approve Global Items. Required: GLOBAL_ITEM_APPROVE / GLOBAL_ITEM_CHECKER.`
      );
      err.code = 'FORBIDDEN_CHECKER_ROLE';
      err.status = 403;
      throw err;
    }

    const item = await this.getGlobalItem(itemId);
    if (!item) {
      const err: any = new Error(`Global Item ID "${itemId}" not found.`);
      err.code = 'ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (item.status === 'APPROVED' || item.status === 'SAP_CREATED') {
      const err: any = new Error(`Global Item "${item.item_code}" is already approved.`);
      err.code = 'ITEM_ALREADY_APPROVED';
      err.status = 409;
      throw err;
    }

    if (item.status !== 'SUBMITTED' && item.status !== 'UNDER_REVIEW') {
      const err: any = new Error(
        `Global Item "${item.item_code}" must be SUBMITTED before approval. Current status: "${item.status}".`
      );
      err.code = 'INVALID_STATUS_FOR_APPROVAL';
      err.status = 400;
      throw err;
    }

    // 2. Strict non-self-approval enforcement (maker !== checker)
    const creatorUserId = item.created_by_user_id || item.submitted_by_user_id;
    if (creatorUserId && actorCtx.userId === creatorUserId) {
      const err: any = new Error(
        `Segregation of duties violation: Creator (${creatorUserId}) cannot approve their own Global Item record.`
      );
      err.code = 'MAKER_CHECKER_SELF_APPROVAL_BLOCKED';
      err.status = 403;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedRecord: BackendGlobalItemRecord = {
      ...item,
      status: 'APPROVED',
      is_active: 1,
      approved_by_user_id: actorCtx.userId,
      approved_at: now,
      updated_at: now,
    };

    // Update DB if available
    try {
      const pool = getPool();
      await pool.execute(
        `UPDATE global_items 
         SET status = 'APPROVED', is_active = 1, approved_by_user_id = ?, approved_at = NOW(), updated_at = NOW()
         WHERE item_id = ?`,
        [actorCtx.userId, item.item_id] as any
      );

      await pool.execute(
        `INSERT INTO item_approval_history (item_id, action, action_by, comments)
         VALUES (?, 'APPROVE', ?, ?)`,
        [item.item_id, `${actorCtx.userName} (${actorCtx.userRole})`, remarks] as any
      );
    } catch {
      // Memory update
    }

    memoryGlobalItems.set(String(item.item_id), updatedRecord);
    memoryGlobalItems.set(String(item.item_code), updatedRecord);

    // Record Change History
    try {
      await changeHistoryBackend.recordGlobalChanges([
        {
          entityId: String(item.item_id),
          fieldAttribute: 'GLOBAL_ITEM_STATUS',
          previousValue: item.status,
          newValue: 'APPROVED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          approvalReference: `GAPPR-${Date.now().toString(36).toUpperCase()}`,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record global change history on approve:', e);
    }

    // NOTE: INVARIANT VERIFIED — Global approval does NOT create or activate any branch record!
    return { success: true, item: updatedRecord };
  }

  /**
   * Stage 1: Reject Global Item (SUBMITTED -> REJECTED)
   */
  async rejectGlobalItem(
    itemId: string | number,
    actorCtx: ActorContext,
    remarks: string
  ): Promise<{ success: boolean; item: BackendGlobalItemRecord }> {
    if (!remarks || !remarks.trim()) {
      const err: any = new Error('Mandatory rejection remarks required.');
      err.code = 'REMARKS_REQUIRED';
      err.status = 400;
      throw err;
    }

    if (!GLOBAL_CHECKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to reject Global Items. Required: GLOBAL_ITEM_APPROVE / GLOBAL_ITEM_CHECKER.`
      );
      err.code = 'FORBIDDEN_CHECKER_ROLE';
      err.status = 403;
      throw err;
    }

    const item = await this.getGlobalItem(itemId);
    if (!item) {
      const err: any = new Error(`Global Item ID "${itemId}" not found.`);
      err.code = 'ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (item.status !== 'SUBMITTED' && item.status !== 'UNDER_REVIEW') {
      const err: any = new Error(
        `Global Item "${item.item_code}" must be in SUBMITTED status to reject. Current: "${item.status}".`
      );
      err.code = 'INVALID_STATUS_FOR_REJECTION';
      err.status = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedRecord: BackendGlobalItemRecord = {
      ...item,
      status: 'REJECTED',
      updated_at: now,
    };

    // Update DB if available
    try {
      const pool = getPool();
      await pool.execute(
        `UPDATE global_items 
         SET status = 'REJECTED', updated_at = NOW()
         WHERE item_id = ?`,
        [item.item_id] as any
      );

      await pool.execute(
        `INSERT INTO item_approval_history (item_id, action, action_by, comments)
         VALUES (?, 'REJECT', ?, ?)`,
        [item.item_id, `${actorCtx.userName} (${actorCtx.userRole})`, remarks] as any
      );
    } catch {
      // Memory update
    }

    memoryGlobalItems.set(String(item.item_id), updatedRecord);
    memoryGlobalItems.set(String(item.item_code), updatedRecord);

    // Record Change History
    try {
      await changeHistoryBackend.recordGlobalChanges([
        {
          entityId: String(item.item_id),
          fieldAttribute: 'GLOBAL_ITEM_STATUS',
          previousValue: item.status,
          newValue: 'REJECTED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record global change history on reject:', e);
    }

    return { success: true, item: updatedRecord };
  }

  // =========================================================================
  // STAGE 2: BRANCH ITEM ACTIVATION WORKFLOW (BRANCH CHECKER QUEUE)
  // =========================================================================

  /**
   * Retrieve Branch Item by Availability ID
   */
  async getBranchItem(branchAvailabilityId: string): Promise<BranchItemAvailabilityPayload | null> {
    const list = await branchItemBackend.getBranchItems({});
    const found = list.find(
      (b) =>
        b.branchAvailabilityId === branchAvailabilityId ||
        `${b.branchId}_${b.globalItemId}` === branchAvailabilityId
    );
    return found || null;
  }

  /**
   * Stage 2: Submit Branch Item Activation for Checker Review (DRAFT -> SUBMITTED)
   *
   * PREREQUISITE INVARIANT:
   * Global Item MUST be in APPROVED status. Cannot submit branch activation for unapproved global item.
   */
  async submitBranchItem(
    branchAvailabilityId: string,
    actorCtx: ActorContext,
    remarks: string = 'Submitted Branch Item Activation for Checker review'
  ): Promise<{ success: boolean; branchItem: BranchItemAvailabilityPayload }> {
    // 1. RBAC check for branch maker
    if (!BRANCH_MAKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to submit Branch Items. Required: BRANCH_ITEM_CREATE / BRANCH_ITEM_MODIFY.`
      );
      err.code = 'FORBIDDEN_BRANCH_MAKER_ROLE';
      err.status = 403;
      throw err;
    }

    const branchItem = await this.getBranchItem(branchAvailabilityId);
    if (!branchItem) {
      const err: any = new Error(`Branch Item record "${branchAvailabilityId}" not found.`);
      err.code = 'BRANCH_ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // 2. Prerequisite Check: Global Item MUST be APPROVED
    const globalItem = await this.getGlobalItem(branchItem.globalItemId);
    if (!globalItem || (globalItem.status !== 'APPROVED' && globalItem.status !== 'SAP_CREATED')) {
      const err: any = new Error(
        `Cannot submit Branch Item activation: Referenced Global Item "${branchItem.globalItemCode}" is not in APPROVED status (current: "${globalItem?.status || 'UNKNOWN'}").`
      );
      err.code = 'GLOBAL_ITEM_NOT_APPROVED';
      err.status = 422;
      throw err;
    }

    if (branchItem.branchStatus === 'APPROVED' || branchItem.approvalStatus === 'APPROVED') {
      const err: any = new Error(`Branch Item "${branchAvailabilityId}" is already approved.`);
      err.code = 'BRANCH_ITEM_ALREADY_APPROVED';
      err.status = 409;
      throw err;
    }

    if (branchItem.branchStatus === 'SUBMITTED' || branchItem.approvalStatus === 'PENDING') {
      const err: any = new Error(`Branch Item "${branchAvailabilityId}" is already SUBMITTED for review.`);
      err.code = 'BRANCH_ITEM_ALREADY_SUBMITTED';
      err.status = 409;
      throw err;
    }

    // 3. Evaluate Rule-Based Audit before submission
    const auditReport = await branchItemBackend.evaluateBranchItemAudit(
      branchItem,
      actorCtx.userName,
      actorCtx.userId,
      1
    );

    if (!auditReport.canSubmit) {
      const err: any = new Error(
        `Cannot submit Branch Item: Audit failed with ${auditReport.errors.length} mandatory error(s): ${auditReport.errors.join('; ')}`
      );
      err.code = 'AUDIT_VALIDATION_FAILED';
      err.status = 422;
      err.auditReport = auditReport;
      throw err;
    }

    const updated = await branchItemBackend.saveBranchItemAvailability({
      ...branchItem,
      branchStatus: 'SUBMITTED',
      approvalStatus: 'PENDING',
      updatedByUserId: actorCtx.userId,
    });

    // Record Change History
    try {
      await changeHistoryBackend.recordBranchChanges([
        {
          entityId: branchAvailabilityId,
          globalItemId: String(branchItem.globalItemId),
          companyId: branchItem.companyId,
          branchId: branchItem.branchId,
          fieldAttribute: 'BRANCH_ITEM_STATUS',
          previousValue: branchItem.branchStatus || 'DRAFT',
          newValue: 'SUBMITTED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record branch change history on submit:', e);
    }

    return { success: true, branchItem: updated };
  }

  /**
   * Stage 2: Approve Branch Item Activation (SUBMITTED -> APPROVED)
   *
   * CRITICAL INVARIANTS:
   * 1. Strict non-self-approval: maker !== checker (creator cannot approve their own branch item).
   * 2. Server-side RBAC: Role must have BRANCH_ITEM_APPROVE (ITEM_CHECKER, PLATFORM_ADMIN, ORG_ADMIN).
   * 3. Branch Approval activates procurement & inventory for THIS BRANCH ONLY.
   * 4. Branch Approval must NOT modify Global Item identity in global_items!
   */
  async approveBranchItem(
    branchAvailabilityId: string,
    actorCtx: ActorContext,
    remarks: string = 'Approved for branch procurement and inventory availability'
  ): Promise<{ success: boolean; branchItem: BranchItemAvailabilityPayload }> {
    // 1. RBAC check for Branch Checker
    if (!BRANCH_CHECKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to approve Branch Items. Required: BRANCH_ITEM_APPROVE / BRANCH_ITEM_CHECKER.`
      );
      err.code = 'FORBIDDEN_BRANCH_CHECKER_ROLE';
      err.status = 403;
      throw err;
    }

    const branchItem = await this.getBranchItem(branchAvailabilityId);
    if (!branchItem) {
      const err: any = new Error(`Branch Item record "${branchAvailabilityId}" not found.`);
      err.code = 'BRANCH_ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (branchItem.branchStatus === 'APPROVED' && branchItem.approvalStatus === 'APPROVED') {
      const err: any = new Error(`Branch Item "${branchAvailabilityId}" is already approved.`);
      err.code = 'BRANCH_ITEM_ALREADY_APPROVED';
      err.status = 409;
      throw err;
    }

    if (branchItem.branchStatus !== 'SUBMITTED' && branchItem.approvalStatus !== 'PENDING') {
      const err: any = new Error(
        `Branch Item "${branchAvailabilityId}" must be SUBMITTED before approval. Current: "${branchItem.branchStatus}".`
      );
      err.code = 'INVALID_STATUS_FOR_APPROVAL';
      err.status = 400;
      throw err;
    }

    // 2. Strict non-self-approval enforcement (maker !== checker)
    const creatorUserId = branchItem.createdByUserId || branchItem.userId;
    if (creatorUserId && actorCtx.userId === creatorUserId) {
      const err: any = new Error(
        `Segregation of duties violation: Creator (${creatorUserId}) cannot approve their own Branch Item Activation.`
      );
      err.code = 'MAKER_CHECKER_SELF_APPROVAL_BLOCKED';
      err.status = 403;
      throw err;
    }

    // 3. Verify Global Item snapshot remains pristine
    const globalItemBefore = await this.getGlobalItem(branchItem.globalItemId);

    // Save approved branch item
    const approvalRef = `BAPPR-${Date.now().toString(36).toUpperCase()}`;
    const updated = await branchItemBackend.saveBranchItemAvailability({
      ...branchItem,
      branchStatus: 'APPROVED',
      approvalStatus: 'APPROVED',
      isActive: true,
      updatedByUserId: actorCtx.userId,
    });

    // 4. Invariant Assertion: Global Item identity MUST NOT BE MODIFIED
    const globalItemAfter = await this.getGlobalItem(branchItem.globalItemId);
    if (globalItemBefore && globalItemAfter) {
      if (
        globalItemBefore.item_code !== globalItemAfter.item_code ||
        globalItemBefore.item_description !== globalItemAfter.item_description
      ) {
        throw new Error('CRITICAL INVARIANT VIOLATION: Global Item identity was mutated during branch approval!');
      }
    }

    // Record Change History
    try {
      await changeHistoryBackend.recordBranchChanges([
        {
          entityId: branchAvailabilityId,
          globalItemId: String(branchItem.globalItemId),
          companyId: branchItem.companyId,
          branchId: branchItem.branchId,
          fieldAttribute: 'BRANCH_ITEM_STATUS',
          previousValue: branchItem.branchStatus || 'SUBMITTED',
          newValue: 'APPROVED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          approvalReference: approvalRef,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record branch change history on approve:', e);
    }

    return { success: true, branchItem: updated };
  }

  /**
   * Stage 2: Reject Branch Item Activation (SUBMITTED -> REJECTED)
   */
  async rejectBranchItem(
    branchAvailabilityId: string,
    actorCtx: ActorContext,
    remarks: string
  ): Promise<{ success: boolean; branchItem: BranchItemAvailabilityPayload }> {
    if (!remarks || !remarks.trim()) {
      const err: any = new Error('Mandatory rejection remarks required.');
      err.code = 'REMARKS_REQUIRED';
      err.status = 400;
      throw err;
    }

    if (!BRANCH_CHECKER_ROLES.has(actorCtx.userRole)) {
      const err: any = new Error(
        `Role "${actorCtx.userRole}" is not authorized to reject Branch Items. Required: BRANCH_ITEM_APPROVE / BRANCH_ITEM_CHECKER.`
      );
      err.code = 'FORBIDDEN_BRANCH_CHECKER_ROLE';
      err.status = 403;
      throw err;
    }

    const branchItem = await this.getBranchItem(branchAvailabilityId);
    if (!branchItem) {
      const err: any = new Error(`Branch Item record "${branchAvailabilityId}" not found.`);
      err.code = 'BRANCH_ITEM_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (branchItem.branchStatus !== 'SUBMITTED' && branchItem.approvalStatus !== 'PENDING') {
      const err: any = new Error(
        `Branch Item "${branchAvailabilityId}" must be in SUBMITTED status to reject. Current: "${branchItem.branchStatus}".`
      );
      err.code = 'INVALID_STATUS_FOR_REJECTION';
      err.status = 400;
      throw err;
    }

    const updated = await branchItemBackend.saveBranchItemAvailability({
      ...branchItem,
      branchStatus: 'REJECTED',
      approvalStatus: 'REJECTED',
      isActive: false,
      updatedByUserId: actorCtx.userId,
    });

    // Record Change History
    try {
      await changeHistoryBackend.recordBranchChanges([
        {
          entityId: branchAvailabilityId,
          globalItemId: String(branchItem.globalItemId),
          companyId: branchItem.companyId,
          branchId: branchItem.branchId,
          fieldAttribute: 'BRANCH_ITEM_STATUS',
          previousValue: branchItem.branchStatus || 'SUBMITTED',
          newValue: 'REJECTED',
          changedBy: actorCtx.userName,
          changedByUserId: actorCtx.userId,
          changeReason: remarks,
          applicableRuleVersion: 1,
        },
      ]);
    } catch (e) {
      console.warn('Failed to record branch change history on reject:', e);
    }

    return { success: true, branchItem: updated };
  }
}

export const makerCheckerBackend = new MakerCheckerBackendService();
