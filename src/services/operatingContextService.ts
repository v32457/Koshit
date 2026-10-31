/**
 * KOSH INNOVATIONS — ENTERPRISE OPERATING CONTEXT SERVICE
 * Single authoritative context engine for Company, Branch, Environment, and User scope.
 */

import { User, Company, Branch, BusinessPartner, Warehouse, AuditLogEntry } from '../types';

export type EnvironmentId = 'DEV' | 'UAT' | 'PROD';

export interface UserContextScope {
  userId: string;
  role: string;
  isGlobalScope: boolean;
  allowedCompanyIds: string[];
  allowedBranchIds: string[];
}

export interface OperatingContext {
  activeCompanyId: string;
  activeBranchId: string;
  environmentId: EnvironmentId;
  userId: string;
  activeCompany: Company;
  activeBranch: Branch;
  scope: UserContextScope;
  isValidContext: boolean;
  contextErrorMessage?: string;
}

export interface ContextValidationResult {
  isValid: boolean;
  companyId: string;
  branchId: string;
  errorMessage?: string;
}

const STORAGE_KEYS = {
  COMPANY_ID: 'kosh_active_company_id',
  BRANCH_ID: 'kosh_active_branch_id',
  ENV_ID: 'kosh_active_env_id',
};

/**
 * Validates whether a company and branch pair is valid and authorized for the user
 */
export function validateContextPair(
  companyId: string,
  branchId: string,
  user: User,
  companies: Company[],
  branches: Branch[]
): ContextValidationResult {
  // 1. Validate Company
  const company = companies.find((c) => c.id === companyId);
  if (!company) {
    return { isValid: false, companyId: '', branchId: '', errorMessage: `Company ID "${companyId}" not found in system registry.` };
  }
  if (!company.isEnabled) {
    return { isValid: false, companyId, branchId: '', errorMessage: `Company "${company.name}" (${company.code}) is currently DISABLED.` };
  }

  // Check user company authorization
  if (!user.isGlobalScope && user.orgId && user.orgId !== company.id) {
    // Check if user is restricted
    if (user.allowedBranchIds && user.allowedBranchIds.length > 0) {
      const allowedBranches = branches.filter((b) => user.allowedBranchIds.includes(b.id));
      const hasBranchInCompany = allowedBranches.some((b) => (b.companyId || 'co-kosh-01') === companyId);
      if (!hasBranchInCompany) {
        return { isValid: false, companyId, branchId: '', errorMessage: `User "${user.fullName}" is not authorized for Company "${company.name}".` };
      }
    }
  }

  // 2. Filter Branches for this Company
  const companyBranches = branches.filter(
    (b) => (b.companyId || 'co-kosh-01') === companyId && b.lifecycleStatus === 'ACTIVE'
  );

  if (companyBranches.length === 0) {
    return {
      isValid: false,
      companyId,
      branchId: '',
      errorMessage: `Company "${company.name}" has no ACTIVE operating branches.`,
    };
  }

  // 3. Validate Branch
  let targetBranch = companyBranches.find((b) => b.id === branchId);

  // If no branch requested or requested branch does not belong to this company, pick default
  if (!targetBranch) {
    // Prefer main branch, or first active branch
    targetBranch = companyBranches.find((b) => b.isMainBranch) || companyBranches[0];
  }

  if (!targetBranch) {
    return {
      isValid: false,
      companyId,
      branchId: '',
      errorMessage: `No valid branch available for Company "${company.name}".`,
    };
  }

  if (targetBranch.lifecycleStatus === 'INACTIVE') {
    return {
      isValid: false,
      companyId,
      branchId: targetBranch.id,
      errorMessage: `Selected branch "${targetBranch.name}" is INACTIVE.`,
    };
  }

  // Check if branch actually belongs to company
  const branchCompanyId = targetBranch.companyId || 'co-kosh-01';
  if (branchCompanyId !== companyId) {
    return {
      isValid: false,
      companyId,
      branchId: targetBranch.id,
      errorMessage: `Branch "${targetBranch.name}" belongs to Company "${branchCompanyId}", not active Company "${companyId}".`,
    };
  }

  // Check user branch authorization if restricted
  if (!user.isGlobalScope && user.allowedBranchIds && user.allowedBranchIds.length > 0) {
    if (!user.allowedBranchIds.includes(targetBranch.id)) {
      // Find an authorized branch in this company
      const authorizedInCompany = companyBranches.find((b) => user.allowedBranchIds.includes(b.id));
      if (!authorizedInCompany) {
        return {
          isValid: false,
          companyId,
          branchId: '',
          errorMessage: `User "${user.fullName}" is not authorized for any branch in Company "${company.name}".`,
        };
      }
      targetBranch = authorizedInCompany;
    }
  }

  return {
    isValid: true,
    companyId,
    branchId: targetBranch.id,
  };
}

/**
 * Initializes and restores operating context from persistent storage or default rules
 */
export function restoreOperatingContext(
  user: User,
  companies: Company[],
  branches: Branch[]
): OperatingContext {
  const storedCompanyId = localStorage.getItem(STORAGE_KEYS.COMPANY_ID) || '';
  const storedBranchId = localStorage.getItem(STORAGE_KEYS.BRANCH_ID) || '';
  const storedEnvId = (localStorage.getItem(STORAGE_KEYS.ENV_ID) as EnvironmentId) || 'DEV';

  // Find initial default company if stored is invalid
  const defaultCompany = companies.find((c) => c.isEnabled && c.isDefault) || companies.find((c) => c.isEnabled) || companies[0];

  const targetCompanyId = storedCompanyId || defaultCompany?.id || 'co-kosh-01';

  const validation = validateContextPair(targetCompanyId, storedBranchId, user, companies, branches);

  let finalCompanyId = validation.companyId;
  let finalBranchId = validation.branchId;

  if (!validation.isValid) {
    // Fall back to default enabled company
    const fallbackValidation = validateContextPair(defaultCompany.id, '', user, companies, branches);
    finalCompanyId = fallbackValidation.companyId;
    finalBranchId = fallbackValidation.branchId;
  }

  const activeCompany = companies.find((c) => c.id === finalCompanyId) || defaultCompany;
  const activeBranch = branches.find((b) => b.id === finalBranchId) || branches[0];

  // Persist corrected context
  localStorage.setItem(STORAGE_KEYS.COMPANY_ID, finalCompanyId);
  localStorage.setItem(STORAGE_KEYS.BRANCH_ID, finalBranchId);
  localStorage.setItem(STORAGE_KEYS.ENV_ID, storedEnvId);

  // Compute authorized scope
  const allowedCompanyIds = user.isGlobalScope
    ? companies.filter((c) => c.isEnabled).map((c) => c.id)
    : companies.filter((c) => c.isEnabled && (c.id === user.orgId || (user.allowedBranchIds && user.allowedBranchIds.some((bId) => branches.find((b) => b.id === bId)?.companyId === c.id)))).map((c) => c.id);

  const allowedBranchIds = user.isGlobalScope
    ? branches.filter((b) => b.lifecycleStatus === 'ACTIVE').map((b) => b.id)
    : user.allowedBranchIds;

  return {
    activeCompanyId: finalCompanyId,
    activeBranchId: finalBranchId,
    environmentId: storedEnvId,
    userId: user.id,
    activeCompany,
    activeBranch,
    scope: {
      userId: user.id,
      role: user.role,
      isGlobalScope: user.isGlobalScope,
      allowedCompanyIds,
      allowedBranchIds,
    },
    isValidContext: validation.isValid || !!activeCompany,
    contextErrorMessage: validation.errorMessage,
  };
}

/**
 * Switches Active Company and automatically resets Branch selection to a valid active branch
 */
export function switchCompanyContext(
  newCompanyId: string,
  user: User,
  companies: Company[],
  branches: Branch[]
): OperatingContext {
  const company = companies.find((c) => c.id === newCompanyId);
  if (!company) {
    throw new Error(`Company ID "${newCompanyId}" does not exist in registry.`);
  }
  if (!company.isEnabled) {
    throw new Error(`Cannot switch to Company "${company.name}" because it is currently DISABLED.`);
  }

  const validation = validateContextPair(newCompanyId, '', user, companies, branches);
  if (!validation.isValid) {
    throw new Error(validation.errorMessage || `Invalid company context for "${company.name}".`);
  }

  localStorage.setItem(STORAGE_KEYS.COMPANY_ID, validation.companyId);
  localStorage.setItem(STORAGE_KEYS.BRANCH_ID, validation.branchId);

  return restoreOperatingContext(user, companies, branches);
}

/**
 * Switches Active Branch for the currently active company
 */
export function switchBranchContext(
  newBranchId: string,
  activeCompanyId: string,
  user: User,
  companies: Company[],
  branches: Branch[]
): OperatingContext {
  const branch = branches.find((b) => b.id === newBranchId);
  if (!branch) {
    throw new Error(`Branch ID "${newBranchId}" does not exist in registry.`);
  }

  if (branch.lifecycleStatus === 'INACTIVE') {
    throw new Error(`Cannot switch to Branch "${branch.name}" because it is currently INACTIVE.`);
  }

  const branchCompanyId = branch.companyId || 'co-kosh-01';
  if (branchCompanyId !== activeCompanyId) {
    throw new Error(`Branch "${branch.name}" belongs to Company "${branchCompanyId}", which does not match active Company "${activeCompanyId}".`);
  }

  if (!user.isGlobalScope && user.allowedBranchIds && user.allowedBranchIds.length > 0) {
    if (!user.allowedBranchIds.includes(newBranchId)) {
      throw new Error(`User "${user.fullName}" is not authorized to access Branch "${branch.name}".`);
    }
  }

  localStorage.setItem(STORAGE_KEYS.COMPANY_ID, activeCompanyId);
  localStorage.setItem(STORAGE_KEYS.BRANCH_ID, newBranchId);

  return restoreOperatingContext(user, companies, branches);
}

/**
 * Gets exact mapped SAP Company Database ID for active company
 */
export function getSapCompanyDbForCompany(companyId: string, companies: Company[]): string {
  const company = companies.find((c) => c.id === companyId);
  return company?.sapCompanyDb || 'KOSH_PROD_HANA';
}

/**
 * Filters Business Partners strictly by Active Company and Active Branch
 */
export function filterBusinessPartnersByContext(
  bps: BusinessPartner[],
  companyId: string,
  branchId: string,
  isGlobalUserScope = true
): BusinessPartner[] {
  return bps.filter((bp) => {
    const bpCompanyId = bp.branchId ? (bp as any).companyId || 'co-kosh-01' : 'co-kosh-01';
    
    // Strict Company Filter
    if (bpCompanyId !== companyId) {
      return false;
    }

    // Branch filter if not global or explicit branch requested
    if (branchId && bp.branchId) {
      return bp.branchId === branchId;
    }

    return true;
  });
}

/**
 * Filters Warehouses strictly by Active Company and Branch
 */
export function filterWarehousesByContext(
  warehouses: Warehouse[],
  branches: Branch[],
  companyId: string,
  branchId?: string
): Warehouse[] {
  // Get all valid branch IDs for this company
  const companyBranchIds = new Set(
    branches.filter((b) => (b.companyId || 'co-kosh-01') === companyId).map((b) => b.id)
  );

  return warehouses.filter((w) => {
    if (!companyBranchIds.has(w.branchId)) return false;
    if (branchId && w.branchId !== branchId) return false;
    return true;
  });
}

/**
 * Creates audit log payload enriched with explicit context details
 */
export function createAuditLogWithContext(
  actor: User,
  context: OperatingContext,
  action: string,
  entityName: string,
  entityId: string,
  details: Record<string, any>
): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    correlationId: `corr-${Date.now()}`,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    entityName,
    entityId,
    companyId: context.activeCompanyId,
    branchId: context.activeBranchId,
    environmentId: context.environmentId,
    timestamp: new Date().toISOString(),
    details: {
      ...details,
      operatingContext: {
        companyCode: context.activeCompany.code,
        companyName: context.activeCompany.name,
        branchCode: context.activeBranch.portalBranchCode,
        branchName: context.activeBranch.name,
        sapCompanyDb: context.activeCompany.sapCompanyDb,
        environment: context.environmentId,
      },
    },
    ipAddress: '127.0.0.1',
  };
}
