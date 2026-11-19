/**
 * KOSH INNOVATIONS — COST CENTRE MASTER & AUTOMATIC DETERMINATION SERVICE
 *
 * Automatically determines eligible Cost Centres from:
 *  1. Company, Branch, and Department mappings in the Cost Centre Master & Mapping store
 *  2. Synchronized Finance & Budget Control Ledger Cost Centres (budgetControlService)
 *  3. Employee Default Cost Centre mappings from User Role & Organizational Scope Assignments (userRoleAdminService)
 *
 * Strict Governance Rules:
 *  - Users never manually type a Cost Centre code.
 *  - If an employee has a default Cost Centre mapped and valid for the selected Company, Branch, and Department, it is automatically selected as the default.
 *  - If a single valid Cost Centre exists, it is automatically selected.
 *  - If multiple valid Cost Centres exist, all valid options from the master are returned for dropdown selection.
 *  - If no valid mapping exists for the selected Company, Branch, and Department, resolution returns `valid: false` with a clear validation message and blocks PR submission. Never fabricates or assumes a Cost Centre.
 */

import { INITIAL_BRANCHES } from '../data/seedData';
import { INITIAL_USER_ROLE_ASSIGNMENTS } from '../data/userRoleAdminSeed';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { budgetControlService } from './budgetControlService';

export interface CostCentreMasterRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  companyId: string;
  sapCostCenterCode: string;
  sapDimension: number;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: 'APPROVED' | 'DRAFT' | 'PENDING_APPROVAL' | 'REJECTED';
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface CostCentreDepartmentMapping {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific canonical branchId
  departmentId?: string;
  departmentCode?: string;
  departmentName: string;
  costCentreCode: string;
  isPrimaryForDepartment: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  approvalStatus: 'APPROVED' | 'DRAFT';
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface EmployeeCostCentreDefaultMapping {
  id: string;
  userId: string;
  companyId: string;
  branchId?: string; // 'ALL' or specific branchId
  departmentName?: string; // Optional department filter
  defaultCostCentreCode: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CostCentreDeterminationResult {
  valid: boolean;
  companyId: string;
  branchId: string;
  department: string;
  eligibleCostCentres: CostCentreMasterRecord[];
  defaultCostCentreCode: string;
  resolutionSource:
    | 'EMPLOYEE_DEFAULT'
    | 'DEPARTMENT_PRIMARY'
    | 'SINGLE_DEPARTMENT_MAPPING'
    | 'MULTIPLE_DEPARTMENT_MAPPINGS'
    | 'NONE_MAPPED';
  validationMessage?: string;
}

const STORAGE_KEY_CC_MASTER = 'kosh_cost_centre_master_v1';
const STORAGE_KEY_CC_DEPT_MAPPINGS = 'kosh_cost_centre_dept_mappings_v1';
const STORAGE_KEY_CC_EMP_DEFAULTS = 'kosh_cost_centre_emp_defaults_v1';

export const INITIAL_COST_CENTRE_MASTER: CostCentreMasterRecord[] = [
  {
    id: 'cc-prod-101',
    code: 'CC-PROD-101',
    name: 'Puducherry Plant Production & Operations',
    description: 'Primary manufacturing cost centre for Injection Moulding & Corrugation',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PROD-101',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-prod-01',
    code: 'CC-PROD-01',
    name: 'Puducherry Polymer & Extrusion Line',
    description: 'Polymer processing and extrusion operations cost centre',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PROD-01',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-qa-301',
    code: 'CC-QA-301',
    name: 'Quality Assurance & Metallurgy Lab',
    description: 'Quality inspection, CMM calibration, and metallurgy testing',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-QA-301',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-maint-202',
    code: 'CC-MAINT-202',
    name: 'Plant Maintenance & Engineering Utilities',
    description: 'Preventive, breakdown, and utility engineering maintenance',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-MAINT-202',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-maint-104',
    code: 'CC-MAINT-104',
    name: 'Electrical & Facility Utilities Maintenance',
    description: 'Substation, HVAC, and plant facility utilities maintenance',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-MAINT-104',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-proc-01',
    code: 'CC-PROC-01',
    name: 'Central Inventory, Stores & Sourcing HQ',
    description: 'Central stores, raw material warehousing, and procurement operations',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PROC-01',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-proc-02',
    code: 'CC-PROC-02',
    name: 'Strategic Sourcing & Vendor Development',
    description: 'Corporate purchasing and supplier quality development',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PROC-02',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-it-01',
    code: 'CC-IT-01',
    name: 'Corporate IT, ERP & Digital Systems',
    description: 'SAP HANA, cybersecurity, software subscriptions, and IT infrastructure',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-IT-01',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-fin-100',
    code: 'CC-FIN-100',
    name: 'Corporate Finance, Audit & Legal Governance',
    description: 'Statutory audit, tax advisory, legal compliance, and corporate finance',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-FIN-100',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-leg-100',
    code: 'CC-LEG-100',
    name: 'Corporate Legal & Intellectual Property Cell',
    description: 'Patent filings, regulatory affairs, and corporate legal retainers',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-LEG-100',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-pun-101',
    code: 'CC-PUN-101',
    name: 'Pune Moulding & Blow Division',
    description: 'Pune Western Region moulding and blow division operations',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PUN-101',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-pun-202',
    code: 'CC-PUN-202',
    name: 'Pune Engineering & Automation',
    description: 'Pune robotics and conveyor line engineering',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-PUN-202',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-far-101',
    code: 'CC-FAR-101',
    name: 'Faridabad Tooling & Machining Unit',
    description: 'Precision CNC tooling and die manufacturing cost centre',
    companyId: 'co-kosh-01',
    sapCostCenterCode: 'CC-FAR-101',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-che-101',
    code: 'CC-CHE-101',
    name: 'Chennai Automotive Component Assembly',
    description: 'Automotive corrugated tubing and harness assembly cost centre',
    companyId: 'co-kosh-02',
    sapCostCenterCode: 'CC-CHE-101',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-che-qual',
    code: 'CC-CHE-301',
    name: 'Chennai Quality Control & Testing Lab',
    description: 'Chennai automotive inspection and testing cost centre',
    companyId: 'co-kosh-02',
    sapCostCenterCode: 'CC-CHE-301',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-log-02',
    code: 'CC-LOG-02',
    name: 'Chennai Logistics & Dispatch Operations',
    description: 'South hub OEM dispatch and logistics warehousing',
    companyId: 'co-kosh-02',
    sapCostCenterCode: 'CC-LOG-02',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-asm-202',
    code: 'CC-ASM-202',
    name: 'Hosur Tier 1 Sub-Assembly Division',
    description: 'Hosur OEM sub-assembly and testing cost centre',
    companyId: 'co-kosh-02',
    sapCostCenterCode: 'CC-ASM-202',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-hsr-tool',
    code: 'CC-HSR-204',
    name: 'Hosur Tooling & Mould Maintenance',
    description: 'Hosur die casting and injection tool maintenance cost centre',
    companyId: 'co-kosh-02',
    sapCostCenterCode: 'CC-HSR-204',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'cc-exp-101',
    code: 'CC-EXP-101',
    name: 'Global Exports & SEZ Operations',
    description: 'International export division cost centre',
    companyId: 'co-kosh-03',
    sapCostCenterCode: 'CC-EXP-101',
    sapDimension: 1,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
];

export const INITIAL_COST_CENTRE_DEPT_MAPPINGS: CostCentreDepartmentMapping[] = [
  // Puducherry Main Plant & HQ (co-kosh-01 / br-pond-01)
  // Multiple valid Cost Centres mapped to Production & Plant Operations to support multi-option dropdown selection & employee default resolution
  {
    id: 'ccm-pdy-prod-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production & Plant Operations',
    costCentreCode: 'CC-PROD-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-prod-2',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production & Plant Operations',
    costCentreCode: 'CC-PROD-01',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-prod-3',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production & Plant Operations',
    costCentreCode: 'CC-IT-01',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Alias for short department names used in legacy PRs ("Production", "Production & Operations")
  {
    id: 'ccm-pdy-prod-short-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production',
    costCentreCode: 'CC-PROD-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-prod-short-2',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production',
    costCentreCode: 'CC-PROD-01',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-prod-ops',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PDY-PROD',
    departmentName: 'Production & Operations',
    costCentreCode: 'CC-PROD-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Puducherry Quality Assurance & Metallurgy (Single valid Cost Centre)
  {
    id: 'ccm-pdy-qual-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-02',
    departmentCode: 'PDY-QUAL',
    departmentName: 'Quality Assurance & Metallurgy',
    costCentreCode: 'CC-QA-301',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-qual-short',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PDY-QUAL',
    departmentName: 'Quality Assurance',
    costCentreCode: 'CC-QA-301',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Puducherry Plant Maintenance & Utilities (Multiple valid Cost Centres)
  {
    id: 'ccm-pdy-mnt-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-03',
    departmentCode: 'PDY-MNT',
    departmentName: 'Plant Maintenance & Utilities',
    costCentreCode: 'CC-MAINT-202',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-mnt-2',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-03',
    departmentCode: 'PDY-MNT',
    departmentName: 'Plant Maintenance & Utilities',
    costCentreCode: 'CC-MAINT-104',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-mnt-short',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PDY-MNT',
    departmentName: 'Maintenance & Engineering',
    costCentreCode: 'CC-MAINT-202',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Puducherry Central Inventory & Stores / Procurement / Finance
  {
    id: 'ccm-pdy-str-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-04',
    departmentCode: 'PDY-STR',
    departmentName: 'Central Inventory & Stores',
    costCentreCode: 'CC-PROC-01',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-str-2',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentId: 'dept-pdy-04',
    departmentCode: 'PDY-STR',
    departmentName: 'Central Inventory & Stores',
    costCentreCode: 'CC-PROC-02',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-proc',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'PROC',
    departmentName: 'Procurement',
    costCentreCode: 'CC-PROC-01',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-fin-1',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'FIN',
    departmentName: 'Finance',
    costCentreCode: 'CC-FIN-100',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pdy-fin-2',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentCode: 'FIN',
    departmentName: 'Finance',
    costCentreCode: 'CC-LEG-100',
    isPrimaryForDepartment: false,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Pune Western Region Plant (co-kosh-01 / br-pune-04)
  {
    id: 'ccm-pun-mould',
    companyId: 'co-kosh-01',
    branchId: 'br-pune-04',
    departmentId: 'dept-pun-01',
    departmentCode: 'PUN-MOULD',
    departmentName: 'Moulding & Blow Division',
    costCentreCode: 'CC-PUN-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-pun-eng',
    companyId: 'co-kosh-01',
    branchId: 'br-pune-04',
    departmentId: 'dept-pun-02',
    departmentCode: 'PUN-ENG',
    departmentName: 'Engineering & Automation',
    costCentreCode: 'CC-PUN-202',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Faridabad Plant (co-kosh-01 / br-far-006)
  {
    id: 'ccm-far-tool',
    companyId: 'co-kosh-01',
    branchId: 'br-far-006',
    departmentId: 'dept-far-01',
    departmentCode: 'FAR-TOOL',
    departmentName: 'Tooling & Machining Unit',
    costCentreCode: 'CC-FAR-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Chennai Automotive Components Unit (co-kosh-02 / br-chen-02)
  {
    id: 'ccm-che-auto',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    departmentId: 'dept-che-01',
    departmentCode: 'CHE-AUTO',
    departmentName: 'Automotive Component Assembly',
    costCentreCode: 'CC-CHE-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-che-qual',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    departmentId: 'dept-che-02',
    departmentCode: 'CHE-QUAL',
    departmentName: 'Quality Control & Testing',
    costCentreCode: 'CC-CHE-301',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-che-log',
    companyId: 'co-kosh-02',
    branchId: 'br-chen-02',
    departmentId: 'dept-che-03',
    departmentCode: 'CHE-LOG',
    departmentName: 'Logistics & Dispatch Ops',
    costCentreCode: 'CC-LOG-02',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Hosur OEM & Assembly Works (co-kosh-02 & co-kosh-01 / br-hosr-03 & br-hosur-02)
  {
    id: 'ccm-hsr-assy-co2',
    companyId: 'co-kosh-02',
    branchId: 'br-hosr-03',
    departmentId: 'dept-hsr-01',
    departmentCode: 'HSR-ASSY',
    departmentName: 'Tier 1 Sub-Assembly Division',
    costCentreCode: 'CC-ASM-202',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-hsr-assy-co1',
    companyId: 'co-kosh-01',
    branchId: 'br-hosur-02',
    departmentCode: 'HSR-ASSY',
    departmentName: 'Assembly',
    costCentreCode: 'CC-ASM-202',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  {
    id: 'ccm-hsr-tool-co2',
    companyId: 'co-kosh-02',
    branchId: 'br-hosr-03',
    departmentId: 'dept-hsr-02',
    departmentCode: 'HSR-TOOL',
    departmentName: 'Tooling & Mould Maintenance',
    costCentreCode: 'CC-HSR-204',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
  // Global Exports (co-kosh-03 / br-snd-007)
  {
    id: 'ccm-exp-ops',
    companyId: 'co-kosh-03',
    branchId: 'br-snd-007',
    departmentCode: 'EXP-OPS',
    departmentName: 'Export Operations',
    costCentreCode: 'CC-EXP-101',
    isPrimaryForDepartment: true,
    status: 'ACTIVE',
    approvalStatus: 'APPROVED',
    effectiveFrom: '2025-04-01',
  },
];

export const INITIAL_EMPLOYEE_COST_CENTRE_DEFAULTS: EmployeeCostCentreDefaultMapping[] = [
  {
    id: 'ecc-usr-maker-02',
    userId: 'usr-maker-02',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentName: 'Production & Plant Operations',
    defaultCostCentreCode: 'CC-PROD-01',
    status: 'ACTIVE',
  },
  {
    id: 'ecc-usr-buyer-01',
    userId: 'usr-buyer-01',
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    departmentName: 'Central Inventory & Stores',
    defaultCostCentreCode: 'CC-PROC-02',
    status: 'ACTIVE',
  },
];

let memoryMasters: CostCentreMasterRecord[] | null = null;
let memoryDeptMappings: CostCentreDepartmentMapping[] | null = null;
let memoryEmpDefaults: EmployeeCostCentreDefaultMapping[] | null = null;

function normCompany(companyId?: string): string {
  const raw = (companyId || '').trim();
  const upper = raw.toUpperCase();
  if (!raw) return '';
  if (upper === 'COMP-001' || upper === 'KOSH-HQ' || upper === 'KOSH_INNOVATIONS' || upper === 'CO-KOSH-01') {
    return 'co-kosh-01';
  }
  if (upper === 'COMP-002' || upper === 'KOSH-AUTO' || upper === 'KOSH-SOUTH' || upper === 'CO-KOSH-02') {
    return 'co-kosh-02';
  }
  if (upper === 'COMP-003' || upper === 'KOSH-TOOL' || upper === 'KOSH-EXPORTS' || upper === 'CO-KOSH-03') {
    return 'co-kosh-03';
  }
  if (upper === 'COMP-004' || upper === 'KOSH-NORTH' || upper === 'CO-KOSH-04') {
    return 'co-kosh-04';
  }
  return normalizeCompanyId(raw);
}

function normBranch(branchId?: string): string {
  const raw = (branchId || '').trim();
  const upper = raw.toUpperCase();
  if (!raw || upper === 'ALL') return 'ALL';
  if (upper === 'BR-001' || upper === '001' || upper === 'BR-POND-01' || upper === 'BRANCH-001') {
    return 'br-pond-01';
  }
  if (upper === 'BR-002' || upper === '002' || upper === 'BR-CHEN-02' || upper === 'BRANCH-002') {
    return 'br-chen-02';
  }
  if (upper === 'BR-003' || upper === '003' || upper === 'BR-HOSR-03') {
    return 'br-hosr-03';
  }
  if (upper === 'BR-HOSUR-02') {
    return 'br-hosur-02';
  }
  if (upper === 'BR-004' || upper === '004' || upper === 'BR-PUNE-04') {
    return 'br-pune-04';
  }
  if (upper === 'BR-005' || upper === '005' || upper === 'BR-DDUN-05') {
    return 'br-ddun-05';
  }
  if (upper === 'BR-006' || upper === '006' || upper === 'BR-FAR-006') {
    return 'br-far-006';
  }
  if (upper === 'BR-007' || upper === '007' || upper === 'BR-SND-007') {
    return 'br-snd-007';
  }
  return normalizeBranchId(raw);
}

function normalizeDeptToken(dept?: string): string {
  return (dept || '')
    .trim()
    .toLowerCase()
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+/g, ' ');
}

export const costCentreMasterService = {
  getCostCentreMasters(): CostCentreMasterRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CC_MASTER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryMasters) {
      memoryMasters = JSON.parse(JSON.stringify(INITIAL_COST_CENTRE_MASTER));
    }
    return memoryMasters!;
  },

  saveCostCentreMasters(records: CostCentreMasterRecord[]): void {
    memoryMasters = JSON.parse(JSON.stringify(records));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CC_MASTER, JSON.stringify(records));
      } catch {}
    }
  },

  getDepartmentMappings(): CostCentreDepartmentMapping[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CC_DEPT_MAPPINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryDeptMappings) {
      memoryDeptMappings = JSON.parse(JSON.stringify(INITIAL_COST_CENTRE_DEPT_MAPPINGS));
    }
    return memoryDeptMappings!;
  },

  saveDepartmentMappings(mappings: CostCentreDepartmentMapping[]): void {
    memoryDeptMappings = JSON.parse(JSON.stringify(mappings));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CC_DEPT_MAPPINGS, JSON.stringify(mappings));
      } catch {}
    }
  },

  getEmployeeDefaultMappings(): EmployeeCostCentreDefaultMapping[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CC_EMP_DEFAULTS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    if (!memoryEmpDefaults) {
      memoryEmpDefaults = JSON.parse(JSON.stringify(INITIAL_EMPLOYEE_COST_CENTRE_DEFAULTS));
    }
    return memoryEmpDefaults!;
  },

  saveEmployeeDefaultMappings(mappings: EmployeeCostCentreDefaultMapping[]): void {
    memoryEmpDefaults = JSON.parse(JSON.stringify(mappings));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CC_EMP_DEFAULTS, JSON.stringify(mappings));
      } catch {}
    }
  },

  resetToDefaults(): void {
    memoryMasters = JSON.parse(JSON.stringify(INITIAL_COST_CENTRE_MASTER));
    memoryDeptMappings = JSON.parse(JSON.stringify(INITIAL_COST_CENTRE_DEPT_MAPPINGS));
    memoryEmpDefaults = JSON.parse(JSON.stringify(INITIAL_EMPLOYEE_COST_CENTRE_DEFAULTS));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CC_MASTER);
      localStorage.removeItem(STORAGE_KEY_CC_DEPT_MAPPINGS);
      localStorage.removeItem(STORAGE_KEY_CC_EMP_DEFAULTS);
    }
  },

  /**
   * Resolves the employee's configured default Cost Centre codes from:
   *  1. Explicit EmployeeCostCentreDefaultMapping records
   *  2. OrganizationalScope.costCentreIds in UserRoleAssignments (INITIAL_USER_ROLE_ASSIGNMENTS / localStorage)
   */
  getEmployeeDefaultCostCentres(params: {
    userId?: string;
    companyId: string;
    branchId?: string;
    department?: string;
  }): string[] {
    if (!params.userId) return [];
    const normCo = normCompany(params.companyId);
    const normBr = normBranch(params.branchId);
    const normDept = normalizeDeptToken(params.department);
    const uidLower = params.userId.trim().toLowerCase();

    const codes: string[] = [];

    // 1. Explicit Employee Cost Centre Default Mappings
    const empDefaults = this.getEmployeeDefaultMappings().filter(
      (m) =>
        m.status === 'ACTIVE' &&
        m.userId.trim().toLowerCase() === uidLower &&
        normCompany(m.companyId) === normCo &&
        (!m.branchId || m.branchId === 'ALL' || normBranch(m.branchId) === normBr) &&
        (!m.departmentName || normalizeDeptToken(m.departmentName) === normDept)
    );
    for (const ed of empDefaults) {
      if (ed.defaultCostCentreCode && !codes.includes(ed.defaultCostCentreCode)) {
        codes.push(ed.defaultCostCentreCode);
      }
    }

    // 2. UserRoleAssignment scope.costCentreIds
    let assignments = INITIAL_USER_ROLE_ASSIGNMENTS;
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('kosh_ura_assignments_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) assignments = parsed;
        }
      } catch {}
    }

    const matchingAssignments = assignments.filter(
      (a) =>
        a.status === 'ACTIVE' &&
        a.userId.trim().toLowerCase() === uidLower &&
        (normCompany(a.companyId) === normCo ||
          (a.scope?.companyIds || []).some((cid) => normCompany(cid) === normCo)) &&
        (!a.branchId ||
          normBranch(a.branchId) === normBr ||
          (a.scope?.branchIds || []).length === 0 ||
          (a.scope?.branchIds || []).some((bid) => normBranch(bid) === normBr))
    );

    for (const a of matchingAssignments) {
      for (const cc of a.scope?.costCentreIds || []) {
        if (cc && !codes.includes(cc)) {
          codes.push(cc);
        }
      }
    }

    return codes;
  },

  /**
   * Automatically determines valid Cost Centres for the selected Company, Branch, Department, and optional Employee.
   * Never creates or assumes a Cost Centre when no valid mapping exists.
   */
  resolveCostCentresForContext(params: {
    companyId: string;
    branchId: string;
    department: string;
    userId?: string;
    evaluationDate?: string;
  }): CostCentreDeterminationResult {
    const normCo = normCompany(params.companyId);
    const normBr = normBranch(params.branchId);
    const rawDept = (params.department || '').trim();
    const normDept = normalizeDeptToken(rawDept);

    if (!normCo || !normBr || !normDept) {
      return {
        valid: false,
        companyId: normCo,
        branchId: normBr,
        department: rawDept,
        eligibleCostCentres: [],
        defaultCostCentreCode: '',
        resolutionSource: 'NONE_MAPPED',
        validationMessage:
          'Company, Branch, and Department must be selected to automatically determine the Cost Centre.',
      };
    }

    const activeMasters = this.getCostCentreMasters().filter(
      (m) => m.status === 'ACTIVE' && m.approvalStatus === 'APPROVED'
    );
    const masterByCode = new Map<string, CostCentreMasterRecord>();
    for (const m of activeMasters) {
      masterByCode.set(m.code.toUpperCase(), m);
    }

    // Resolve Branch department metadata if available
    const branchObj = INITIAL_BRANCHES.find((b) => normBranch(b.id) === normBr);
    const matchedBranchDept = (branchObj?.departments || []).find(
      (d) =>
        normalizeDeptToken(d.departmentName) === normDept ||
        normalizeDeptToken(d.departmentCode) === normDept ||
        normalizeDeptToken(d.id) === normDept
    );

    // Filter active department mappings for this Company + Branch + Department
    const deptMappings = this.getDepartmentMappings().filter((m) => {
      if (m.status !== 'ACTIVE' || m.approvalStatus !== 'APPROVED') return false;
      if (normCompany(m.companyId) !== normCo && normCompany(m.companyId) !== normCompany(branchObj?.companyId)) {
        return false;
      }
      if (m.branchId !== 'ALL' && normBranch(m.branchId) !== normBr) {
        return false;
      }
      const mapDeptName = normalizeDeptToken(m.departmentName);
      const mapDeptCode = normalizeDeptToken(m.departmentCode);
      const mapDeptId = normalizeDeptToken(m.departmentId);

      if (mapDeptName === normDept || (mapDeptCode && mapDeptCode === normDept)) {
        return true;
      }
      if (
        matchedBranchDept &&
        ((mapDeptId && mapDeptId === normalizeDeptToken(matchedBranchDept.id)) ||
          (mapDeptCode && mapDeptCode === normalizeDeptToken(matchedBranchDept.departmentCode)) ||
          mapDeptName === normalizeDeptToken(matchedBranchDept.departmentName))
      ) {
        return true;
      }
      return false;
    });

    const eligibleCodesOrdered: string[] = [];
    let primaryCode = '';

    for (const dm of deptMappings) {
      const codeUpper = dm.costCentreCode.trim().toUpperCase();
      if (masterByCode.has(codeUpper)) {
        if (!eligibleCodesOrdered.includes(codeUpper)) {
          eligibleCodesOrdered.push(codeUpper);
        }
        if (dm.isPrimaryForDepartment && !primaryCode) {
          primaryCode = codeUpper;
        }
      }
    }

    // Also include any active Cost Centre from Budget Control Ledgers explicitly mapped to this Company + Branch + Department
    const ledgers = budgetControlService.getLedgers().filter(
      (l) =>
        normCompany(l.companyId) === normCo &&
        normBranch(l.branchId) === normBr &&
        normalizeDeptToken(l.department) === normDept &&
        l.costCenter &&
        l.costCenter !== 'ALL'
    );
    for (const ldg of ledgers) {
      const codeUpper = ldg.costCenter.trim().toUpperCase();
      if (masterByCode.has(codeUpper) && !eligibleCodesOrdered.includes(codeUpper)) {
        eligibleCodesOrdered.push(codeUpper);
      }
    }

    const eligibleCostCentres = eligibleCodesOrdered
      .map((code) => masterByCode.get(code)!)
      .filter(Boolean);

    if (eligibleCostCentres.length === 0) {
      return {
        valid: false,
        companyId: normCo,
        branchId: normBr,
        department: rawDept,
        eligibleCostCentres: [],
        defaultCostCentreCode: '',
        resolutionSource: 'NONE_MAPPED',
        validationMessage: `No valid Cost Centre mapping exists in Cost Centre Master for Company '${params.companyId}', Branch '${params.branchId}', and Department '${rawDept}'. Submission is blocked until a valid Cost Centre mapping is configured.`,
      };
    }

    // Check employee default Cost Centre mapping
    const empDefaultCodes = this.getEmployeeDefaultCostCentres({
      userId: params.userId,
      companyId: normCo,
      branchId: normBr,
      department: rawDept,
    });

    const matchedEmpDefault = empDefaultCodes
      .map((c) => c.trim().toUpperCase())
      .find((code) => eligibleCostCentres.some((ec) => ec.code.toUpperCase() === code));

    if (matchedEmpDefault) {
      // Sort employee's default Cost Centre first
      const sorted = [
        ...eligibleCostCentres.filter((c) => c.code.toUpperCase() === matchedEmpDefault),
        ...eligibleCostCentres.filter((c) => c.code.toUpperCase() !== matchedEmpDefault),
      ];
      return {
        valid: true,
        companyId: normCo,
        branchId: normBr,
        department: rawDept,
        eligibleCostCentres: sorted,
        defaultCostCentreCode: sorted[0].code,
        resolutionSource: 'EMPLOYEE_DEFAULT',
      };
    }

    const defaultCode =
      primaryCode && eligibleCostCentres.some((c) => c.code.toUpperCase() === primaryCode)
        ? primaryCode
        : eligibleCostCentres[0].code;

    return {
      valid: true,
      companyId: normCo,
      branchId: normBr,
      department: rawDept,
      eligibleCostCentres,
      defaultCostCentreCode: defaultCode,
      resolutionSource:
        eligibleCostCentres.length === 1
          ? 'SINGLE_DEPARTMENT_MAPPING'
          : primaryCode
          ? 'DEPARTMENT_PRIMARY'
          : 'MULTIPLE_DEPARTMENT_MAPPINGS',
    };
  },
};
