/**
 * CIPPLATFORM — CENTRALIZED RBAC PERMISSION REGISTRY SERVICE
 * Registers the 11 mandatory Inventory Validation, Cross-Branch, Stock Aging,
 * PR Aging, and Transfer permissions plus Data Grid Governance permissions.
 *
 * CRITICAL SECURITY INVARIANT:
 * New permissions are registered centrally in Role & User Administration and are
 * NEVER auto-granted to existing non-admin operational roles (ITEM_MAKER, ITEM_CHECKER,
 * BRANCH_COORDINATOR, MASTER_DATA_AUDITOR, INTEGRATION_SERVICE_ACCOUNT, READ_ONLY_USER).
 */

import { User, UserRole } from '../types';
import { EnterpriseAuditService } from './enterpriseAuditService';

export type EnterprisePermissionKey =
  | 'INVENTORY_VALIDATION_CONFIG_VIEW'
  | 'INVENTORY_VALIDATION_CONFIG_MANAGE'
  | 'INVENTORY_VALIDATION_OVERRIDE_APPROVE'
  | 'INVENTORY_CROSS_BRANCH_STOCK_VIEW'
  | 'INVENTORY_CROSS_BRANCH_TRANSFER_REQUEST'
  | 'INVENTORY_CROSS_BRANCH_TRANSFER_APPROVE'
  | 'INVENTORY_AGING_VIEW'
  | 'INVENTORY_AGING_CONFIG_MANAGE'
  | 'PR_AGING_VIEW'
  | 'PR_AGING_CONFIG_MANAGE'
  | 'INVENTORY_VALIDATION_REPORT_EXPORT'
  | 'GRID_SETTINGS_MANAGE'
  | 'EXPORT_ALL_FILTERED'
  | 'CHARGE_MASTER_VIEW'
  | 'CHARGE_MASTER_MANAGE'
  | 'CHARGE_TRANSACTION_EDIT'
  | 'CHARGE_MANDATORY_EXCEPTION_APPROVE'
  | 'CHARGE_ALLOCATION_OVERRIDE'
  | 'CHARGE_VARIANCE_APPROVE'
  | 'LANDED_COST_VIEW'
  | 'SECURITY_GOVERNANCE_VIEW'
  | 'SECURITY_GOVERNANCE_MANAGE'
  | 'SECURITY_EXCEPTION_APPROVE'
  | 'SECURITY_INCIDENT_MANAGE'
  | 'SECURITY_BLACKOUT_OVERRIDE'
  | 'SECURITY_EXPORT_APPROVE'
  | 'GLOBAL_ITEM_CREATE'
  | 'GLOBAL_ITEM_MODIFY'
  | 'GLOBAL_ITEM_CHECKER'
  | 'GLOBAL_ITEM_APPROVE'
  | 'BRANCH_ITEM_CREATE'
  | 'BRANCH_ITEM_MODIFY'
  | 'BRANCH_ITEM_CHECKER'
  | 'BRANCH_ITEM_APPROVE'
  | 'ITEM_RULE_CONFIGURE'
  | 'ITEM_RULE_PUBLISH'
  | 'ITEM_DUPLICATE_RESOLVE'
  | 'ITEM_DATA_MIGRATION'
  | 'ITEM_AUDIT_VIEW';

export interface PermissionDefinition {
  key: EnterprisePermissionKey;
  label: string;
  moduleGroup:
    | 'Inventory Validation'
    | 'Cross-Branch Stock & Transfers'
    | 'Stock Aging'
    | 'PR Aging'
    | 'Reports & Grid Governance'
    | 'Charge Management & Landed Cost'
    | 'Zero-Trust Visual Protection'
    | 'Global Item Master'
    | 'Branch Item Availability'
    | 'Item Rule & Audit Governance';
  description: string;
  sensitivity: 'STANDARD' | 'HIGH' | 'CRITICAL';
}

export const ENTERPRISE_PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: 'INVENTORY_VALIDATION_CONFIG_VIEW',
    label: 'Inventory Validation Config View',
    moduleGroup: 'Inventory Validation',
    description: 'View Company, Branch, and Warehouse inventory availability policies and enforcement rules.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'INVENTORY_VALIDATION_CONFIG_MANAGE',
    label: 'Inventory Validation Config Manage',
    moduleGroup: 'Inventory Validation',
    description: 'Create, edit, and version Inventory Availability Validation policies and warehouse priorities.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'INVENTORY_VALIDATION_OVERRIDE_APPROVE',
    label: 'Inventory Validation Override Approve',
    moduleGroup: 'Inventory Validation',
    description: 'Approve authorized shortage or cross-branch inventory exceptions under Maker-Checker control.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'INVENTORY_CROSS_BRANCH_STOCK_VIEW',
    label: 'Cross-Branch Stock View',
    moduleGroup: 'Cross-Branch Stock & Transfers',
    description: 'View same-company stock balances across other authorized branches (never across companies).',
    sensitivity: 'HIGH',
  },
  {
    key: 'INVENTORY_CROSS_BRANCH_TRANSFER_REQUEST',
    label: 'Cross-Branch Transfer Request',
    moduleGroup: 'Cross-Branch Stock & Transfers',
    description: 'Initiate formal inter-branch stock transfer requests from transfer-eligible warehouses.',
    sensitivity: 'HIGH',
  },
  {
    key: 'INVENTORY_CROSS_BRANCH_TRANSFER_APPROVE',
    label: 'Cross-Branch Transfer Approve',
    moduleGroup: 'Cross-Branch Stock & Transfers',
    description: 'Approve, dispatch, or receive inter-branch inventory transfers (Maker-Checker enforced).',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'INVENTORY_AGING_VIEW',
    label: 'Inventory Aging View',
    moduleGroup: 'Stock Aging',
    description: 'View warehouse stock age buckets, batch receipt dates, expiry alerts, and FIFO/FEFO details.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'INVENTORY_AGING_CONFIG_MANAGE',
    label: 'Inventory Aging Config Manage',
    moduleGroup: 'Stock Aging',
    description: 'Configure stock aging buckets, shelf-life/expiry thresholds, and FIFO/FEFO rules.',
    sensitivity: 'HIGH',
  },
  {
    key: 'PR_AGING_VIEW',
    label: 'PR Aging View',
    moduleGroup: 'PR Aging',
    description: 'View separate Purchase Requisition pending aging, stage age, SLA due date, and escalations.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'PR_AGING_CONFIG_MANAGE',
    label: 'PR Aging Config Manage',
    moduleGroup: 'PR Aging',
    description: 'Configure Purchase Requisition aging buckets, stage SLAs, and escalation thresholds.',
    sensitivity: 'HIGH',
  },
  {
    key: 'INVENTORY_VALIDATION_REPORT_EXPORT',
    label: 'Inventory & Aging Report Export',
    moduleGroup: 'Reports & Grid Governance',
    description: 'View and export governed Inventory Availability, Cross-Branch, Stock Aging & PR Aging reports.',
    sensitivity: 'HIGH',
  },
  {
    key: 'GRID_SETTINGS_MANAGE',
    label: 'Global Data Grid Settings Manage',
    moduleGroup: 'Reports & Grid Governance',
    description: 'Configure default rows-per-page (20), permitted page sizes, and export record/size caps.',
    sensitivity: 'HIGH',
  },
  {
    key: 'EXPORT_ALL_FILTERED',
    label: 'Export All Filtered Records',
    moduleGroup: 'Reports & Grid Governance',
    description: 'Export complete filtered datasets across all pages within configured governance caps.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'CHARGE_MASTER_VIEW',
    label: 'Charge Master & Rules View',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'View centralized Charge Master definitions, statutory tax mappings, and applicability rules.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'CHARGE_MASTER_MANAGE',
    label: 'Charge Master & Rules Manage',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'Create, update, and activate/deactivate Charge Master records, rules, and tax mappings.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'CHARGE_TRANSACTION_EDIT',
    label: 'Transaction Charges Create & Edit',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'Add, edit, calculate, and manage transaction charges across PR, RFQ, PO, Shipment, GRN, and Invoices.',
    sensitivity: 'HIGH',
  },
  {
    key: 'CHARGE_MANDATORY_EXCEPTION_APPROVE',
    label: 'Mandatory Charge Bypass Approve',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'Approve exceptions to bypass or waive rule-mandated procurement charges.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'CHARGE_ALLOCATION_OVERRIDE',
    label: 'Charge Manual Allocation Override',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'Perform and approve manual overrides of header-to-line charge allocations.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'CHARGE_VARIANCE_APPROVE',
    label: 'Charge Amendment & Variance Approve',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'Approve PO charge amendments and Estimated vs Actual invoice charge variances.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'LANDED_COST_VIEW',
    label: 'Landed Cost Workbench View',
    moduleGroup: 'Charge Management & Landed Cost',
    description: 'View item-wise and shipment-wise landed cost breakdowns across procurement lifecycle stages.',
    sensitivity: 'STANDARD',
  },
  {
    key: 'SECURITY_GOVERNANCE_VIEW',
    label: 'Security Governance Dashboard View',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'View Zero-Trust Security Governance dashboards, effective policies, events, and system health.',
    sensitivity: 'HIGH',
  },
  {
    key: 'SECURITY_GOVERNANCE_MANAGE',
    label: 'Security Policy Hierarchy Manage',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'Create, edit, version, and toggle Global, Company, Branch, Module, and optional Page/User security policies.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'SECURITY_EXCEPTION_APPROVE',
    label: 'Security Exception Maker-Checker Approve',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'Approve, reject, or revoke time-limited Zero-Trust security exceptions (cannot self-approve).',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'SECURITY_INCIDENT_MANAGE',
    label: 'Security Incident Management',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'Investigate, assign, acknowledge, resolve, and close Zero-Trust security incidents.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'SECURITY_BLACKOUT_OVERRIDE',
    label: 'Security Blackout Override & Session Control',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'Override active security blackouts and suspend or terminate protected sessions.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'SECURITY_EXPORT_APPROVE',
    label: 'Restricted Export Approval',
    moduleGroup: 'Zero-Trust Visual Protection',
    description: 'Authorize sensitive document/data exports exceeding Zero-Trust policy thresholds.',
    sensitivity: 'HIGH',
  },
  {
    key: 'GLOBAL_ITEM_CREATE',
    label: 'Global Item Creation',
    moduleGroup: 'Global Item Master',
    description: 'Create draft Global Item identities, technical specifications, and default UOM conversions.',
    sensitivity: 'HIGH',
  },
  {
    key: 'GLOBAL_ITEM_MODIFY',
    label: 'Global Item Modification',
    moduleGroup: 'Global Item Master',
    description: 'Modify Global Item identity, specifications, and default UOM configuration.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'GLOBAL_ITEM_CHECKER',
    label: 'Global Item Checker Review',
    moduleGroup: 'Global Item Master',
    description: 'Review Global Item Creation Audit reports and checker queue items.',
    sensitivity: 'HIGH',
  },
  {
    key: 'GLOBAL_ITEM_APPROVE',
    label: 'Global Item Approval',
    moduleGroup: 'Global Item Master',
    description: 'Approve or reject Global Items after Global Audit under non-self-approval controls.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'BRANCH_ITEM_CREATE',
    label: 'Branch Item Availability Creation',
    moduleGroup: 'Branch Item Availability',
    description: 'Configure branch Category, UOM overrides, compliance, warehouse, and inventory setup for approved Global Items.',
    sensitivity: 'HIGH',
  },
  {
    key: 'BRANCH_ITEM_MODIFY',
    label: 'Branch Item Availability Modification',
    moduleGroup: 'Branch Item Availability',
    description: 'Modify branch-specific Category, operational compliance, warehouse planning, and availability settings.',
    sensitivity: 'HIGH',
  },
  {
    key: 'BRANCH_ITEM_CHECKER',
    label: 'Branch Item Checker Review',
    moduleGroup: 'Branch Item Availability',
    description: 'Review Branch Item Activation Audit reports in branch checker queue.',
    sensitivity: 'HIGH',
  },
  {
    key: 'BRANCH_ITEM_APPROVE',
    label: 'Branch Item Approval',
    moduleGroup: 'Branch Item Availability',
    description: 'Approve or reject Branch Item Availability configurations for live procurement & inventory use.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'ITEM_RULE_CONFIGURE',
    label: 'Item Rule Configuration',
    moduleGroup: 'Item Rule & Audit Governance',
    description: 'Configure draft Global Item Code, Description, and Rule-Based Audit checkpoints.',
    sensitivity: 'HIGH',
  },
  {
    key: 'ITEM_RULE_PUBLISH',
    label: 'Item Rule Publishing',
    moduleGroup: 'Item Rule & Audit Governance',
    description: 'Approve, publish, and retire Item Code, Description, and Audit Rule versions.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'ITEM_DUPLICATE_RESOLVE',
    label: 'Global Duplicate Resolution & Merge',
    moduleGroup: 'Item Rule & Audit Governance',
    description: 'Review potential global duplicate matches and authorize master item merges.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'ITEM_DATA_MIGRATION',
    label: 'Legacy Item Data Migration',
    moduleGroup: 'Item Rule & Audit Governance',
    description: 'Execute and reconcile legacy Global-to-Branch item migrations and review flagged items.',
    sensitivity: 'CRITICAL',
  },
  {
    key: 'ITEM_AUDIT_VIEW',
    label: 'Item Audit & Change History View',
    moduleGroup: 'Item Rule & Audit Governance',
    description: 'View Global & Branch Item Creation/Activation Audits and immutable change history.',
    sensitivity: 'STANDARD',
  },
];

// Default grants strictly follow Separation of Duties:
// - GLOBAL_ITEM_ADMIN does NOT automatically receive unrestricted BRANCH_ITEM_* operational approvals.
// - BRANCH_COORDINATOR does NOT receive GLOBAL_ITEM_MODIFY or GLOBAL_ITEM_APPROVE.
const DEFAULT_ROLE_GRANTS: Record<UserRole, EnterprisePermissionKey[]> = {
  PLATFORM_ADMIN: ENTERPRISE_PERMISSION_CATALOG.map((p) => p.key),
  ORG_ADMIN: ENTERPRISE_PERMISSION_CATALOG.map((p) => p.key),
  GLOBAL_ITEM_ADMIN: [
    'INVENTORY_VALIDATION_CONFIG_VIEW',
    'INVENTORY_AGING_VIEW',
    'PR_AGING_VIEW',
    'GLOBAL_ITEM_CREATE',
    'GLOBAL_ITEM_MODIFY',
    'GLOBAL_ITEM_CHECKER',
    'GLOBAL_ITEM_APPROVE',
    'ITEM_RULE_CONFIGURE',
    'ITEM_RULE_PUBLISH',
    'ITEM_DUPLICATE_RESOLVE',
    'ITEM_AUDIT_VIEW',
  ],
  ITEM_MAKER: ['PR_AGING_VIEW', 'GLOBAL_ITEM_CREATE', 'GLOBAL_ITEM_MODIFY', 'ITEM_AUDIT_VIEW'],
  ITEM_CHECKER: [
    'PR_AGING_VIEW',
    'GLOBAL_ITEM_CHECKER',
    'GLOBAL_ITEM_APPROVE',
    'BRANCH_ITEM_CHECKER',
    'BRANCH_ITEM_APPROVE',
    'ITEM_AUDIT_VIEW',
  ],
  BRANCH_COORDINATOR: [
    'INVENTORY_AGING_VIEW',
    'PR_AGING_VIEW',
    'BRANCH_ITEM_CREATE',
    'BRANCH_ITEM_MODIFY',
    'ITEM_AUDIT_VIEW',
  ],
  MASTER_DATA_AUDITOR: [
    'INVENTORY_VALIDATION_CONFIG_VIEW',
    'INVENTORY_AGING_VIEW',
    'PR_AGING_VIEW',
    'ITEM_AUDIT_VIEW',
  ],
  INTEGRATION_SERVICE_ACCOUNT: ['ITEM_AUDIT_VIEW'],
  READ_ONLY_USER: ['PR_AGING_VIEW', 'ITEM_AUDIT_VIEW'],
};

const STORAGE_KEY_ROLE_PERMS = 'cip_rbac_role_permissions_v1';
const STORAGE_KEY_USER_PERMS = 'cip_rbac_user_permissions_v1';

let memoryRoleGrants: Record<UserRole, EnterprisePermissionKey[]> | null = null;
let memoryUserOverrides: Record<string, { granted: EnterprisePermissionKey[]; revoked: EnterprisePermissionKey[] }> | null = null;

function cloneDefaults(): Record<UserRole, EnterprisePermissionKey[]> {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_GRANTS));
}

let centralPermissionEvaluator: ((user: User, permission: EnterprisePermissionKey) => boolean) | null = null;
let centralMutationHook: ((event: { type: 'ROLE_GRANT' | 'ROLE_REVOKE' | 'USER_OVERRIDE'; role?: UserRole; userId?: string; permission: EnterprisePermissionKey; mode?: 'GRANT' | 'REVOKE' | 'CLEAR'; actor: { id: string; name: string } }) => void) | null = null;

export const rbacPermissionService = {
  registerCentralBridge(hooks: {
    evaluator: (user: User, permission: EnterprisePermissionKey) => boolean;
    onMutate?: typeof centralMutationHook;
  }): void {
    centralPermissionEvaluator = hooks.evaluator;
    if (hooks.onMutate) centralMutationHook = hooks.onMutate;
  },

  getRolePermissionsMap(): Record<UserRole, EnterprisePermissionKey[]> {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ROLE_PERMS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return { ...cloneDefaults(), ...parsed };
          }
        }
      } catch {
        // ignore
      }
    }
    if (!memoryRoleGrants) {
      memoryRoleGrants = cloneDefaults();
    }
    return JSON.parse(JSON.stringify(memoryRoleGrants));
  },

  saveRolePermissionsMap(map: Record<UserRole, EnterprisePermissionKey[]>): void {
    memoryRoleGrants = JSON.parse(JSON.stringify(map));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ROLE_PERMS, JSON.stringify(map));
      } catch {
        // ignore
      }
    }
  },

  getUserOverridesMap(): Record<string, { granted: EnterprisePermissionKey[]; revoked: EnterprisePermissionKey[] }> {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_USER_PERMS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {
        // ignore
      }
    }
    if (!memoryUserOverrides) {
      memoryUserOverrides = {};
    }
    return JSON.parse(JSON.stringify(memoryUserOverrides));
  },

  saveUserOverridesMap(
    map: Record<string, { granted: EnterprisePermissionKey[]; revoked: EnterprisePermissionKey[] }>
  ): void {
    memoryUserOverrides = JSON.parse(JSON.stringify(map));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_USER_PERMS, JSON.stringify(map));
      } catch {
        // ignore
      }
    }
  },

  hasPermission(user: User | null | undefined, permission: EnterprisePermissionKey): boolean {
    if (!user) return false;
    if (user.status && user.status !== 'ACTIVE') return false;

    const overrides = this.getUserOverridesMap()[user.id];
    if (overrides?.revoked?.includes(permission)) return false;
    if (overrides?.granted?.includes(permission)) return true;

    const roleMap = this.getRolePermissionsMap();
    const roleGrants = roleMap[user.role] || [];
    if (roleGrants.includes(permission)) return true;

    if (centralPermissionEvaluator) {
      return centralPermissionEvaluator(user, permission);
    }
    return false;
  },

  grantRolePermission(
    role: UserRole,
    permission: EnterprisePermissionKey,
    actor: { id: string; name: string },
    reason = 'Admin Role Permission Assignment'
  ): void {
    const map = this.getRolePermissionsMap();
    const existing = map[role] || [];
    if (!existing.includes(permission)) {
      map[role] = [...existing, permission];
      this.saveRolePermissionsMap(map);
      if (centralMutationHook) {
        centralMutationHook({ type: 'ROLE_GRANT', role, permission, actor });
      }
      EnterpriseAuditService.logEvent({
        companyId: 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: role,
        eventType: 'RBAC_PERMISSION_GRANTED',
        eventDescription: `Granted ${permission} to role ${role}`,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeReason: reason,
        newValue: { role, permission },
      });
    }
  },

  revokeRolePermission(
    role: UserRole,
    permission: EnterprisePermissionKey,
    actor: { id: string; name: string },
    reason = 'Admin Role Permission Revocation'
  ): void {
    const map = this.getRolePermissionsMap();
    const existing = map[role] || [];
    if (existing.includes(permission)) {
      map[role] = existing.filter((p) => p !== permission);
      this.saveRolePermissionsMap(map);
      if (centralMutationHook) {
        centralMutationHook({ type: 'ROLE_REVOKE', role, permission, actor });
      }
      EnterpriseAuditService.logEvent({
        companyId: 'co-kosh-01',
        entityType: 'SECURITY',
        entityId: role,
        eventType: 'RBAC_PERMISSION_REVOKED',
        eventDescription: `Revoked ${permission} from role ${role}`,
        changedByUserId: actor.id,
        changedByName: actor.name,
        changeReason: reason,
        newValue: { role, permission },
      });
    }
  },

  setUserPermissionOverride(
    userId: string,
    permission: EnterprisePermissionKey,
    mode: 'GRANT' | 'REVOKE' | 'CLEAR',
    actor: { id: string; name: string }
  ): void {
    const map = this.getUserOverridesMap();
    const entry = map[userId] || { granted: [], revoked: [] };
    entry.granted = entry.granted.filter((p) => p !== permission);
    entry.revoked = entry.revoked.filter((p) => p !== permission);
    if (mode === 'GRANT') entry.granted.push(permission);
    if (mode === 'REVOKE') entry.revoked.push(permission);
    map[userId] = entry;
    this.saveUserOverridesMap(map);
    if (centralMutationHook) {
      centralMutationHook({ type: 'USER_OVERRIDE', userId, permission, mode, actor });
    }
    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'SECURITY',
      entityId: userId,
      eventType: 'USER_PERMISSION_OVERRIDE',
      eventDescription: `${mode} ${permission} for user ${userId}`,
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: 'User RBAC override update',
      newValue: { userId, permission, mode },
    });
  },

  resetForTesting(): void {
    memoryRoleGrants = cloneDefaults();
    memoryUserOverrides = {};
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_ROLE_PERMS);
        localStorage.removeItem(STORAGE_KEY_USER_PERMS);
      } catch {
        // ignore
      }
    }
  },
};
