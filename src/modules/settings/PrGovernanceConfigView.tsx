/**
 * CIPPLATFORM — MASTER PURCHASE REQUISITION GOVERNANCE CONFIGURATION VIEW
 * Rendered inside Governance & System Settings → General Settings → Purchase Requisition.
 * Supports Multi-Company (Level 1) and Multi-Branch (Level 2) policy inheritance,
 * authorized branch overrides, centrally controlled locks, dependency validation,
 * controlled policy versioning, and live effective policy preview.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  RotateCcw,
  Eye,
  Search,
  Building2,
  GitBranch,
  Sliders,
  FileCheck,
  Clock,
  Coins,
  Bell,
  History,
  Layers,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Company, Branch, User } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';
import {
  PrGovernancePolicyConfig,
  PrActivationFieldKey,
  PrPolicyVersionRecord,
} from '../../types/prGovernancePolicy';
import {
  prGovernancePolicyService,
  normalizeCompanyId,
  normalizeBranchId,
} from '../../services/prGovernancePolicyService';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { BranchPRCleanupPolicy, PRStatus, PRType } from '../../types/purchaseRequisition';
import { EnterpriseAuditService } from '../../services/enterpriseAuditService';
import { inventoryValidationService } from '../../services/inventoryValidationService';
import {
  InventoryValidationPolicyConfig,
  InventoryValidationStage,
  CrossBranchUsabilityMode,
  AvailableStockCalculationMode,
  InventoryEnforcementMode,
} from '../../types/procurementFinanceGovernance';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';
import { PrTypeMasterPanel } from './PrTypeMasterPanel';
import { ChargeItemMappingView } from './ChargeItemMappingView';

interface PrGovernanceConfigViewProps {
  currentUser?: User;
  companies?: Company[];
  branches?: Branch[];
}

type PrGovSectionId =
  | 'ALL_EXPANDED'
  | 'general-policy'
  | 'company-branch-scope'
  | 'creation-editing'
  | 'approval-workflow'
  | 'return-resubmission'
  | 'partial-conversion'
  | 'short-close-cancel'
  | 'budget-financial'
  | 'rfq-po-integration'
  | 'notifications'
  | 'audit-security'
  | 'policy-history'
  | 'numbering-duplicates'
  | 'delegation-escalation'
  | 'simulation-recovery'
  | 'consolidated-report'
  | 'inventory-validation-partk'
  | 'pr-type-master'
  | 'charge-item-mapping';

const SECTION_TABS: Array<{ id: PrGovSectionId; label: string; keywords: string }> = [
  {
    id: 'general-policy',
    label: 'General Policy',
    keywords: 'module activation manual mrp repair maintenance submission approval short close cancel rfq po partial expected delivery date budget remarks audit',
  },
  {
    id: 'company-branch-scope',
    label: 'Company & Branch Scope',
    keywords: 'company branch inheritance override matrix stale age threshold cleanup',
  },
  {
    id: 'creation-editing',
    label: 'PR Creation & Editing',
    keywords: 'draft pending approval returned header lock line lock converted unconverted reapproval terminal amendment',
  },
  {
    id: 'approval-workflow',
    label: 'Approval Workflow',
    keywords: 'approval levels matrix branch department amount manager l1 escalation delegation remarks',
  },
  {
    id: 'return-resubmission',
    label: 'Return & Resubmission',
    keywords: 'return for correction mandatory reason resubmit same pr number approval cycle withdraw reject',
  },
  {
    id: 'partial-conversion',
    label: 'Partial Conversion',
    keywords: 'partial rfq po conversion multiple references converted remaining quantity line level lock',
  },
  {
    id: 'short-close-cancel',
    label: 'Short Close & Cancellation',
    keywords: 'short close cancellation applicable pr types statuses authorized roles reason remarks reconciliation',
  },
  {
    id: 'budget-financial',
    label: 'Budget & Financial Controls',
    keywords: 'budget validation mandatory check reservation uncommitted release po commitments duplicate reconciliation currency exchange rate',
  },
  {
    id: 'rfq-po-integration',
    label: 'RFQ & PO Integration',
    keywords: 'rfq po conversion validate approved eligible lines remaining quantity duplicate references',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    keywords: 'notification email whatsapp centre submission approval return resubmission short close cancel budget buyer',
  },
  {
    id: 'audit-security',
    label: 'Audit & Security',
    keywords: 'mandatory audit trail status line approval conversion short close cancel budget config security log',
  },
  {
    id: 'policy-history',
    label: 'Maker-Checker & Version History',
    keywords: 'version effective from until maker checker approve rollback pending active superseded expired history snapshot',
  },
  {
    id: 'numbering-duplicates',
    label: 'Numbering, Periods & Duplicates',
    keywords: 'pr numbering sequence financial period closed backdated duplicate detection warning justification multi branch procurement buyer',
  },
  {
    id: 'delegation-escalation',
    label: 'Delegation & SLA Escalation',
    keywords: 'temporary approver delegation start end date amount sla breach escalation reminder alternate approver',
  },
  {
    id: 'simulation-recovery',
    label: 'Policy Simulation & Recovery',
    keywords: 'simulate preview sandbox role status conversion failure recovery reconciliation queue idempotency retry',
  },
  {
    id: 'consolidated-report',
    label: 'Consolidated PR & Budget Report',
    keywords: 'consolidated report company branch department currency reserved released budget ageing buyer workload',
  },
  {
    id: 'inventory-validation-partk',
    label: 'Part K: Inventory & Cross-Branch Policy',
    keywords: 'part k inventory availability validation cross branch visibility transfer warehouse priority qc blocked rejected incoming revalidation stages expiry near expiry',
  },
  {
    id: 'pr-type-master',
    label: 'PR Type Master & Mapping',
    keywords: 'pr type master capex asset requisition manual mrp repair maintenance company branch purchase org item category eligibility mapping version history',
  },
  {
    id: 'charge-item-mapping',
    label: 'Charge Item Mapping',
    keywords: 'charge item mapping company branch override central lock freight customs loading unloading insurance tariff applicability',
  },
];

const ACTIVATION_FIELD_METADATA: Array<{
  key: PrActivationFieldKey;
  label: string;
  description: string;
  immutable?: boolean;
}> = [
  {
    key: 'prModuleEnabled',
    label: 'Purchase Requisition Module',
    description: 'Master enablement switch for PR creation, submission, and conversion in this scope.',
  },
  {
    key: 'manualPrCreationEnabled',
    label: 'Manual PR Creation',
    description: 'Allow users to create manual ad-hoc Purchase Requisitions.',
  },
  {
    key: 'mrpPrCreationEnabled',
    label: 'MRP-Based PR Creation',
    description: 'Allow automated Material Requirements Planning (MRP) PR generation.',
  },
  {
    key: 'repairPrEnabled',
    label: 'Repair PR',
    description: 'Allow breakdown and equipment repair requisitions.',
  },
  {
    key: 'maintenancePrEnabled',
    label: 'Maintenance PR',
    description: 'Allow preventive and scheduled maintenance requisitions.',
  },
  {
    key: 'capexAssetPrEnabled',
    label: 'Capex / Asset PR',
    description: 'Allow capital expenditure / fixed asset requisitions (requires PR Type Master approval & eligibility mapping).',
  },
  {
    key: 'prEditingEnabled',
    label: 'PR Editing',
    description: 'Allow editing of eligible Draft and Returned Purchase Requisitions.',
  },
  {
    key: 'prSubmissionEnabled',
    label: 'PR Submission',
    description: 'Allow submission and resubmission of PRs into the approval workflow.',
  },
  {
    key: 'prApprovalEnabled',
    label: 'PR Approval',
    description: 'Enable multi-level Manager L1 and Matrix approval workflow.',
  },
  {
    key: 'prReturnForCorrectionEnabled',
    label: 'PR Return for Correction',
    description: 'Allow approvers to return PRs to the requester for correction and resubmission.',
  },
  {
    key: 'prWithdrawalEnabled',
    label: 'PR Withdrawal',
    description: 'Allow requesters to withdraw pending PRs prior to final approval.',
  },
  {
    key: 'prCancellationEnabled',
    label: 'PR Cancellation',
    description: 'Allow authorized cancellation of eligible unconverted PRs/lines.',
  },
  {
    key: 'prShortCloseEnabled',
    label: 'PR Short Close',
    description: 'Allow authorized short closure of remaining unconverted quantities on approved PRs.',
  },
  {
    key: 'rfqConversionEnabled',
    label: 'RFQ Conversion',
    description: 'Allow converting approved PR lines into Future RFQ / Sourcing RFQs.',
  },
  {
    key: 'poConversionEnabled',
    label: 'PO Conversion',
    description: 'Allow converting eligible PR lines into Purchase Orders.',
  },
  {
    key: 'partialConversionEnabled',
    label: 'Partial Conversion',
    description: 'Allow partial quantity conversion with line-level locking of converted quantities.',
  },
  {
    key: 'expectedDeliveryDateEnabled',
    label: 'Expected Delivery Date',
    description: 'Display, validate, and persist Expected Delivery Date across PR creation and editing.',
  },
  {
    key: 'budgetValidationEnabled',
    label: 'Budget Validation',
    description: 'Enforce cost-centre budget validation and commitment reservation.',
  },
  {
    key: 'mandatoryRemarksEnabled',
    label: 'Mandatory Remarks',
    description: 'Require mandatory justification/remarks on PR submission and governance actions.',
  },
  {
    key: 'prAuditTrailEnabled',
    label: 'PR Audit Trail',
    description: 'Mandatory cryptographic audit logging of all PR lifecycle and configuration changes.',
    immutable: true,
  },
];

const ALL_PR_TYPES: PRType[] = ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'];
const ALL_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'BRANCH_ADMIN',
  'PROCUREMENT_MANAGER',
  'DEPARTMENT_HEAD',
  'BUYER',
  'REQUESTER',
];

export const PrGovernanceConfigView: React.FC<PrGovernanceConfigViewProps> = ({
  currentUser,
  companies = INITIAL_COMPANIES,
  branches = INITIAL_BRANCHES,
}) => {
  const activeCompanies = useMemo(() => companies.filter((c) => c.isEnabled !== false), [companies]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    activeCompanies[0]?.id || 'co-kosh-01'
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [activeSection, setActiveSection] = useState<PrGovSectionId>('general-policy');
  const [expandAllSections, setExpandAllSections] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showEffectivePreviewModal, setShowEffectivePreviewModal] = useState<boolean>(false);
  const [selectedVersionSnapshot, setSelectedVersionSnapshot] =
    useState<PrPolicyVersionRecord | null>(null);

  // Policies & version history state
  const [policiesVersionTick, setPoliciesVersionTick] = useState(0);
  const effectivePolicy = useMemo(
    () =>
      prGovernancePolicyService.getEffectivePolicy(
        selectedCompanyId,
        selectedBranchId === 'ALL' ? undefined : selectedBranchId
      ),
    [selectedCompanyId, selectedBranchId, policiesVersionTick]
  );

  const companyDefaultPolicy = useMemo(
    () => prGovernancePolicyService.getEffectivePolicy(selectedCompanyId, undefined),
    [selectedCompanyId, policiesVersionTick]
  );

  const [formState, setFormState] = useState<PrGovernancePolicyConfig>(() =>
    JSON.parse(JSON.stringify(effectivePolicy))
  );
  const [changeSummaryInput, setChangeSummaryInput] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Sync formState when company/branch selection changes
  useEffect(() => {
    setFormState(JSON.parse(JSON.stringify(effectivePolicy)));
  }, [effectivePolicy]);

  // Company's branches
  const companyBranches = useMemo(() => {
    const normComp = normalizeCompanyId(selectedCompanyId);
    return branches.filter(
      (b) => normalizeCompanyId(b.companyId || 'co-kosh-01') === normComp && b.lifecycleStatus !== 'INACTIVE'
    );
  }, [branches, selectedCompanyId]);

  // Existing Stale Cleanup Policy support (preserved from original General Settings PR tab)
  const [branchCleanupPolicies, setBranchCleanupPolicies] = useState<BranchPRCleanupPolicy[]>(() =>
    PurchaseRequisitionService.getBranchCleanupPolicies()
  );
  const targetCleanupBranch =
    (selectedBranchId !== 'ALL'
      ? companyBranches.find((b) => b.id === selectedBranchId)
      : companyBranches[0]) || companyBranches[0];

  const currentCleanupPolicy = useMemo(() => {
    if (!targetCleanupBranch) return null;
    return (
      branchCleanupPolicies.find((p) => p.branchId === targetCleanupBranch.id) || {
        branchId: targetCleanupBranch.id,
        branchCode: targetCleanupBranch.portalBranchCode || targetCleanupBranch.code,
        branchName: targetCleanupBranch.name,
        ageThresholdDays: 45,
        advanceWarningDays: 5,
        isEnabled: true,
        notifyRequesters: true,
        notifyApprovers: true,
        notifyBuyers: true,
        channels: ['IN_PORTAL', 'EMAIL'] as Array<'IN_PORTAL' | 'EMAIL' | 'WHATSAPP'>,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.fullName || 'System Admin',
      }
    );
  }, [branchCleanupPolicies, targetCleanupBranch, currentUser]);

  const [editingCleanup, setEditingCleanup] = useState<BranchPRCleanupPolicy | null>(
    currentCleanupPolicy
  );
  useEffect(() => {
    if (currentCleanupPolicy) setEditingCleanup({ ...currentCleanupPolicy });
  }, [currentCleanupPolicy]);

  const isBranchScope = selectedBranchId !== 'ALL';
  const hasExplicitBranchOverride = prGovernancePolicyService.hasBranchOverride(
    selectedCompanyId,
    selectedBranchId
  );
  const isInheritingFromCompany = isBranchScope && formState.isInheritedFromCompany;

  // Section 17: Part K Enhanced Inventory & Cross-Branch Policy State
  const [partKWarehouseCode, setPartKWarehouseCode] = useState<string>('ALL');
  const [partKCategory, setPartKCategory] = useState<string>('ALL');
  const [partKItemCode, setPartKItemCode] = useState<string>('ALL');
  const [partKPolicy, setPartKPolicy] = useState<InventoryValidationPolicyConfig>(() =>
    inventoryValidationService.getEffectivePolicy({
      companyId: selectedCompanyId,
      branchId: selectedBranchId,
    })
  );

  useEffect(() => {
    setPartKPolicy(
      inventoryValidationService.getEffectivePolicy({
        companyId: selectedCompanyId,
        branchId: selectedBranchId,
        warehouseCode: partKWarehouseCode,
        itemCategory: partKCategory,
        itemCode: partKItemCode,
      })
    );
  }, [selectedCompanyId, selectedBranchId, partKWarehouseCode, partKCategory, partKItemCode]);

  const partKAvailableWarehouses = useMemo(() => {
    const list: Array<{ code: string; name: string }> = [];
    const targetBranches =
      selectedBranchId === 'ALL'
        ? companyBranches
        : companyBranches.filter((b) => b.id === selectedBranchId);
    targetBranches.forEach((b) => {
      (b.warehouses || []).forEach((w) => {
        if (!list.some((x) => x.code === w.warehouseCode)) {
          list.push({ code: w.warehouseCode, name: `${w.warehouseCode} — ${w.warehouseName}` });
        }
      });
    });
    return list;
  }, [companyBranches, selectedBranchId]);

  const handleSavePartKPolicy = () => {
    try {
      const co = companies.find((c) => c.id === selectedCompanyId);
      const br = companyBranches.find((b) => b.id === selectedBranchId);
      const saved = inventoryValidationService.savePolicyConfig(
        {
          ...partKPolicy,
          companyId: selectedCompanyId,
          companyCode: co?.code || selectedCompanyId,
          branchId: selectedBranchId,
          branchCode: br?.portalBranchCode || br?.code || 'ALL',
          branchName: br?.name || 'All Branches (Company Default)',
          warehouseCode: partKWarehouseCode,
          itemCategory: partKCategory,
          itemCode: partKItemCode || 'ALL',
          createdBy: currentUser?.fullName || 'Platform Governance Admin',
          approvedBy: currentUser?.fullName || 'Governance Admin',
        },
        currentUser?.fullName || 'Platform Governance Admin',
        currentUser
      );
      setPartKPolicy(saved);
      setFeedbackBanner({
        type: 'success',
        message: `Part K Inventory Validation Policy v${saved.version} saved for ${saved.companyCode} / ${saved.branchName} (Cross-Branch: ${saved.crossBranchUsability}, Enforcement: ${saved.enforcementMode}).`,
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Unable to save Part K Inventory Validation Policy.',
      });
    }
  };

  // Check if a field is centrally controlled by the Company Policy
  const isFieldCentrallyLockedForBranch = (key: string): boolean => {
    if (!isBranchScope) return false;
    return companyDefaultPolicy.centrallyControlledFields.includes(key);
  };

  // Toggle whether a setting is Centrally Controlled (Company scope only)
  const handleToggleCentralLock = (key: string) => {
    if (isBranchScope || key === 'prAuditTrailEnabled') return;
    setFormState((prev) => {
      const exists = prev.centrallyControlledFields.includes(key);
      const next = exists
        ? prev.centrallyControlledFields.filter((k) => k !== key)
        : [...prev.centrallyControlledFields, key];
      return {
        ...prev,
        centrallyControlledFields: next,
      };
    });
  };

  const handleActivationToggle = (key: PrActivationFieldKey, checked: boolean) => {
    if (key === 'prAuditTrailEnabled') return; // Mandatory immutable
    if (isFieldCentrallyLockedForBranch(key)) return; // Locked by Company Policy
    if (isBranchScope && formState.isInheritedFromCompany) {
      // Automatically switch branch into Override mode if permitted
      if (!companyDefaultPolicy.allowBranchOverride) {
        setFeedbackBanner({
          type: 'error',
          message: `Company policy for ${companyDefaultPolicy.companyCode} has locked all branches to inherit Company Defaults.`,
        });
        return;
      }
    }

    setFormState((prev) => {
      const nextActivation = { ...prev.activation, [key]: checked };
      const nextPartial = { ...prev.partialConversion };
      const nextRfqPo = { ...prev.rfqPoIntegration };
      const nextShortClose = { ...prev.shortClose };
      const nextCancel = { ...prev.cancellation };
      const nextBudget = { ...prev.budget };

      if (key === 'rfqConversionEnabled' && !checked) {
        nextPartial.enablePartialRfqConversion = false;
        nextRfqPo.enablePrToRfqConversion = false;
        nextRfqPo.enablePartialRfqConversion = false;
      }
      if (key === 'poConversionEnabled' && !checked) {
        nextPartial.enablePartialPoConversion = false;
        nextRfqPo.enablePrToPoConversion = false;
        nextRfqPo.enablePartialPoConversion = false;
      }
      if (key === 'partialConversionEnabled') {
        nextPartial.enablePartialRfqConversion = checked && nextActivation.rfqConversionEnabled;
        nextPartial.enablePartialPoConversion = checked && nextActivation.poConversionEnabled;
      }
      if (key === 'prShortCloseEnabled') {
        nextShortClose.enableShortClose = checked;
      }
      if (key === 'prCancellationEnabled') {
        nextCancel.enablePrCancellation = checked;
      }
      if (key === 'budgetValidationEnabled') {
        nextBudget.enableBudgetValidation = checked;
      }
      if (key === 'expectedDeliveryDateEnabled' && !checked) {
        nextActivation.expectedDeliveryDateMandatory = false;
      }

      return {
        ...prev,
        isInheritedFromCompany: isBranchScope ? false : false,
        activation: nextActivation,
        partialConversion: nextPartial,
        rfqPoIntegration: nextRfqPo,
        shortClose: nextShortClose,
        cancellation: nextCancel,
        budget: nextBudget,
      };
    });
  };

  const handleEnableBranchOverride = () => {
    if (!isBranchScope) return;
    if (!companyDefaultPolicy.allowBranchOverride) {
      setFeedbackBanner({
        type: 'error',
        message: `Company policy for ${companyDefaultPolicy.companyCode} does not permit branch-level overrides.`,
      });
      return;
    }
    const branchObj = companyBranches.find((b) => b.id === selectedBranchId);
    const updated: PrGovernancePolicyConfig = {
      ...formState,
      branchId: selectedBranchId,
      branchCode: branchObj?.portalBranchCode || branchObj?.code || selectedBranchId,
      branchName: branchObj?.name || selectedBranchId,
      policyScope: 'BRANCH',
      isInheritedFromCompany: false,
      remarks: `Authorized branch-specific policy override for ${branchObj?.name || selectedBranchId}`,
    };
    const { savedPolicy, warnings } = prGovernancePolicyService.savePolicyConfiguration(
      updated,
      currentUser,
      `Enabled authorized branch override for ${branchObj?.name || selectedBranchId}`
    );
    setPoliciesVersionTick((t) => t + 1);
    setFormState(savedPolicy);
    setFeedbackBanner({
      type: warnings.length > 0 ? 'warning' : 'success',
      message: `Authorized branch override enabled for ${savedPolicy.branchName} (${savedPolicy.policyVersion}). ${warnings.join(' ')}`,
    });
  };

  const handleResetToCompanyDefault = () => {
    if (!isBranchScope) {
      // Reset company policy to approved system default
      const sysDefault = prGovernancePolicyService.savePolicyConfiguration(
        {
          ...prGovernancePolicyService.getEffectivePolicy('SYSTEM_DEFAULT_TEMPLATE', 'ALL'),
          companyId: selectedCompanyId,
          companyCode:
            companies.find((c) => c.id === selectedCompanyId)?.code || selectedCompanyId,
          companyName:
            companies.find((c) => c.id === selectedCompanyId)?.name || selectedCompanyId,
          branchId: 'ALL',
          policyVersion: formState.policyVersion,
        },
        currentUser,
        'Reset Company Policy to Approved System Default'
      );
      setPoliciesVersionTick((t) => t + 1);
      setFormState(sysDefault.savedPolicy);
      setFeedbackBanner({
        type: 'success',
        message: `Company policy for ${sysDefault.savedPolicy.companyCode} reset to Approved System Default (${sysDefault.savedPolicy.policyVersion}).`,
      });
      return;
    }

    const eff = prGovernancePolicyService.resetBranchToCompanyDefault(
      selectedCompanyId,
      selectedBranchId,
      currentUser
    );
    setPoliciesVersionTick((t) => t + 1);
    setFormState(JSON.parse(JSON.stringify(eff)));
    setFeedbackBanner({
      type: 'success',
      message: `Branch policy reset to inherit Company Default Policy (${eff.policyVersion}).`,
    });
  };

  const handleDiscardChanges = () => {
    setFormState(JSON.parse(JSON.stringify(effectivePolicy)));
    setChangeSummaryInput('');
    setFeedbackBanner({
      type: 'warning',
      message: 'Unsaved configuration changes discarded. Reverted to active saved policy.',
    });
  };

  const handleSaveConfiguration = () => {
    try {
      const compObj = companies.find((c) => c.id === selectedCompanyId);
      const brObj =
        selectedBranchId !== 'ALL'
          ? companyBranches.find((b) => b.id === selectedBranchId)
          : undefined;

      const payload: PrGovernancePolicyConfig = {
        ...formState,
        companyId: selectedCompanyId,
        companyCode: compObj?.code || formState.companyCode,
        companyName: compObj?.name || formState.companyName,
        branchId: selectedBranchId,
        branchCode:
          selectedBranchId === 'ALL'
            ? 'ALL'
            : brObj?.portalBranchCode || brObj?.code || formState.branchCode,
        branchName:
          selectedBranchId === 'ALL'
            ? 'All Branches (Company Default)'
            : brObj?.name || formState.branchName,
        policyScope: selectedBranchId === 'ALL' ? 'COMPANY' : 'BRANCH',
        isInheritedFromCompany: selectedBranchId === 'ALL' ? false : false,
      };

      const { savedPolicy, warnings } = prGovernancePolicyService.savePolicyConfiguration(
        payload,
        currentUser,
        changeSummaryInput.trim() ||
          `Saved ${payload.policyScope} PR Governance Configuration for ${payload.companyCode} / ${payload.branchName}`
      );

      setPoliciesVersionTick((t) => t + 1);
      setFormState(JSON.parse(JSON.stringify(savedPolicy)));
      setChangeSummaryInput('');
      setFeedbackBanner({
        type: warnings.length > 0 ? 'warning' : 'success',
        message: `Saved ${savedPolicy.policyScope} Policy (${savedPolicy.policyVersion}) for ${savedPolicy.companyCode} — ${savedPolicy.branchName}. ${warnings.join(' ')}`,
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Failed to save PR Governance Policy.',
      });
    }
  };

  // Enterprise Governance State: Simulation Sandbox, Delegation, Reconciliation Queue & Maker-Checker
  const [simRole, setSimRole] = useState<string>('PROCUREMENT_MANAGER');
  const [simPrType, setSimPrType] = useState<PRType>('MANUAL');
  const [simPrStatus, setSimPrStatus] = useState<PRStatus>('APPROVED_PENDING_BUYER');
  const [simConversionStatus, setSimConversionStatus] = useState<
    'UNCONVERTED' | 'PARTIALLY_CONVERTED' | 'FULLY_CONVERTED'
  >('UNCONVERTED');
  const [simAmount, setSimAmount] = useState<number>(150000);
  const [simCurrency, setSimCurrency] = useState<string>('INR');

  // Delegation Form State
  const [delDelegatorName, setDelDelegatorName] = useState('Ramesh Iyer (Department Head)');
  const [delDelegateeName, setDelDelegateeName] = useState('Ananya Nair (Procurement Manager)');
  const [delStartDate, setDelStartDate] = useState('2026-11-01');
  const [delEndDate, setDelEndDate] = useState('2026-12-31');
  const [delMaxAmount, setDelMaxAmount] = useState<number>(500000);
  const [delScopeDesc, setDelScopeDesc] = useState('Temporary L1/L2 PR approval delegation');

  // Reconciliation Reason State
  const [reconReasonInput, setReconReasonInput] = useState('');

  const handleSubmitForMakerChecker = () => {
    try {
      const compObj = companies.find((c) => c.id === selectedCompanyId);
      const brObj =
        selectedBranchId !== 'ALL'
          ? companyBranches.find((b) => b.id === selectedBranchId)
          : undefined;

      const payload: PrGovernancePolicyConfig = {
        ...formState,
        companyId: selectedCompanyId,
        companyCode: compObj?.code || formState.companyCode,
        companyName: compObj?.name || formState.companyName,
        branchId: selectedBranchId,
        branchCode:
          selectedBranchId === 'ALL'
            ? 'ALL'
            : brObj?.portalBranchCode || brObj?.code || formState.branchCode,
        branchName:
          selectedBranchId === 'ALL'
            ? 'All Branches (Company Default)'
            : brObj?.name || formState.branchName,
        policyScope: selectedBranchId === 'ALL' ? 'COMPANY' : 'BRANCH',
      };

      const maker: User = currentUser || {
        id: 'usr-maker-01',
        fullName: 'Rajesh Sharma (Policy Maker)',
        email: 'maker@kosh.in',
        role: 'PLATFORM_ADMIN',
        orgId: selectedCompanyId,
        allowedBranchIds: [],
        isGlobalScope: true,
        twoFactorEnabled: true,
      };

      const { pendingRecord, warnings } =
        prGovernancePolicyService.submitPolicyChangeForApproval(
          payload,
          maker,
          changeSummaryInput.trim() ||
            `Proposed ${payload.policyScope} Policy (${payload.companyCode}) for Maker-Checker Approval`
        );

      setPoliciesVersionTick((t) => t + 1);
      setChangeSummaryInput('');
      setActiveSection('policy-history');
      setFeedbackBanner({
        type: 'success',
        message: `Submitted Policy Version ${pendingRecord.policyVersion} as PENDING_APPROVAL. Active policy remains unchanged until approved by a separate Governance Checker. ${warnings.join(' ')}`,
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        message: err?.message || 'Failed to submit policy for Maker-Checker approval.',
      });
    }
  };

  // Filtered section tabs when searching settings
  const matchingSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTION_TABS;
    const q = searchQuery.toLowerCase().trim();
    return SECTION_TABS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const shouldRenderSection = (sectionId: PrGovSectionId): boolean => {
    if (expandAllSections || searchQuery.trim().length > 0) {
      return matchingSections.some((s) => s.id === sectionId);
    }
    return activeSection === sectionId;
  };

  const policyHistoryRecords = useMemo(
    () => prGovernancePolicyService.getPolicyHistory(selectedCompanyId, selectedBranchId),
    [selectedCompanyId, selectedBranchId, policiesVersionTick]
  );

  const delegationsList = useMemo(
    () => prGovernancePolicyService.getDelegations(selectedCompanyId, selectedBranchId),
    [selectedCompanyId, selectedBranchId, policiesVersionTick]
  );

  const escalationsList = useMemo(
    () =>
      prGovernancePolicyService.evaluateSlaEscalations(
        PurchaseRequisitionService.getPurchaseRequisitions()
      ),
    [policiesVersionTick]
  );

  const reconciliationQueue = useMemo(
    () => prGovernancePolicyService.getReconciliationQueue(selectedCompanyId),
    [selectedCompanyId, policiesVersionTick]
  );

  const simulationResult = useMemo(
    () =>
      prGovernancePolicyService.simulatePolicyOutcome({
        companyId: selectedCompanyId,
        branchId: selectedBranchId,
        userRole: simRole,
        prType: simPrType,
        prStatus: simPrStatus,
        conversionStatus: simConversionStatus,
        estimatedAmount: simAmount,
        currency: simCurrency,
        draftPolicyOverride: formState,
      }),
    [
      selectedCompanyId,
      selectedBranchId,
      simRole,
      simPrType,
      simPrStatus,
      simConversionStatus,
      simAmount,
      simCurrency,
      formState,
    ]
  );

  const consolidatedReport = useMemo(
    () =>
      PurchaseRequisitionService.generateConsolidatedPrReport({
        companyId: selectedCompanyId,
        branchId: selectedBranchId,
      }),
    [selectedCompanyId, selectedBranchId, policiesVersionTick]
  );

  const prAuditLogs = useMemo(
    () =>
      EnterpriseAuditService.getAuditLogs({
        companyId: normalizeCompanyId(selectedCompanyId),
        entityType: 'PURCHASE_REQUISITION',
      }),
    [selectedCompanyId, policiesVersionTick]
  );

  const auditGrid = useStandardDataGrid({
    gridId: 'pr-gov-audit-logs',
    userId: currentUser?.id,
    data: prAuditLogs,
    defaultSortField: 'timestamp',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: selectedCompanyId,
  });

  const historyGrid = useStandardDataGrid({
    gridId: 'pr-gov-policy-history',
    userId: currentUser?.id,
    data: policyHistoryRecords,
    defaultSortField: 'modifiedAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'policyVersion',
    filterSignature: `${selectedCompanyId}|${selectedBranchId}`,
  });

  const delegationsGrid = useStandardDataGrid({
    gridId: 'pr-gov-delegations',
    userId: currentUser?.id,
    data: delegationsList,
    defaultSortField: 'startDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${selectedCompanyId}|${selectedBranchId}`,
  });

  const reconGrid = useStandardDataGrid({
    gridId: 'pr-gov-reconciliation-queue',
    userId: currentUser?.id,
    data: reconciliationQueue,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: selectedCompanyId,
  });

  const currencyReportGrid = useStandardDataGrid({
    gridId: 'pr-gov-currency-report',
    userId: currentUser?.id,
    data: consolidatedReport.metricsByCurrency,
    defaultSortField: 'originalPrValue',
    defaultSortDirection: 'desc',
    tieBreakerField: 'currency',
    filterSignature: `${selectedCompanyId}|${selectedBranchId}`,
  });

  return (
    <div className="space-y-5 text-xs">
      {/* Feedback Notification Banner */}
      {feedbackBanner && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedbackBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-500 hover:text-slate-900 font-bold px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION A — COMPANY & BRANCH SCOPE HEADER CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5" />
              <span>Governance & System Settings → General Settings → Purchase Requisition</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
              <span>Master Purchase Requisition Governance Configuration</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {formState.policyVersion}
              </span>
            </h2>
            <p className="text-slate-500 mt-0.5">
              Authoritative multi-company and multi-branch policy engine governing PR creation, editing locks, approval workflow, partial conversion, short close, cancellation, and budget release.
            </p>
          </div>

          {/* Primary Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEffectivePreviewModal(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>View Effective Policy</span>
            </button>

            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard Changes</span>
            </button>

            <button
              type="button"
              onClick={handleResetToCompanyDefault}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isBranchScope ? 'Reset to Company Default' : 'Restore System Default'}</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitForMakerChecker}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              title="Submit policy change as PENDING_APPROVAL for Maker-Checker review without overwriting active policy"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Submit for Checker Approval</span>
            </button>

            <button
              type="button"
              onClick={handleSaveConfiguration}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

        {/* Company & Branch Selectors + Governance Metadata Strip */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Level 1 — Company Selector</span>
            </label>
            <select
              aria-label="Select Company"
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setSelectedBranchId('ALL');
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              {activeCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              <span>Level 2 — Branch Selector</span>
            </label>
            <select
              aria-label="Select Branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="ALL">All Branches (Level 1 — Company Default Policy)</option>
              {companyBranches.map((b) => {
                const hasOvr = prGovernancePolicyService.hasBranchOverride(
                  selectedCompanyId,
                  b.id
                );
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.portalBranchCode || b.code}) —{' '}
                    {hasOvr ? 'Branch Override Active' : 'Inherits Company Policy'}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Effective From Date</label>
            <input
              type="date"
              value={formState.effectiveFrom}
              onChange={(e) => setFormState({ ...formState, effectiveFrom: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Effective Until (Optional)
            </label>
            <input
              type="date"
              value={formState.effectiveUntil || ''}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  effectiveUntil: e.target.value || undefined,
                })
              }
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Policy Change Remarks / Audit Note
            </label>
            <input
              type="text"
              value={changeSummaryInput}
              onChange={(e) => setChangeSummaryInput(e.target.value)}
              placeholder="e.g. Updated branch short-close rule..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
        </div>

        {/* Policy Scope & Inheritance Indicator Strip */}
        <div
          className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            !isBranchScope
              ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
              : isInheritingFromCompany
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/80 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Policy Scope
              </span>
              <span className="font-bold text-xs">
                {isBranchScope ? 'Level 2 — Branch Policy' : 'Level 1 — Company Policy'}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Inheritance Mode
              </span>
              <span className="font-bold text-xs flex items-center gap-1">
                {!isBranchScope ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Authoritative Company Default</span>
                  </>
                ) : isInheritingFromCompany ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inheriting Company Policy ({companyDefaultPolicy.policyVersion})</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Authorized Branch Override Active ({formState.policyVersion})</span>
                  </>
                )}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Policy Owner
              </span>
              <span className="font-bold text-xs">{formState.policyOwner}</span>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Effective Status & Version
              </span>
              <span className="font-bold text-xs text-emerald-700">
                {formState.effectiveStatus} • {formState.policyVersion} (From {formState.effectiveFrom})
              </span>
            </div>
            <div className="h-6 w-px bg-slate-300 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                Last Modified
              </span>
              <span className="font-medium text-xs">
                {formState.modifiedBy} • {new Date(formState.modifiedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Scope Switching Actions */}
          <div className="flex items-center gap-2">
            {isBranchScope ? (
              isInheritingFromCompany ? (
                <button
                  type="button"
                  onClick={handleEnableBranchOverride}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition"
                >
                  Enable Branch Override
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetToCompanyDefault}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition"
                >
                  Inherit Company Policy
                </button>
              )
            ) : (
              <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.allowBranchOverride}
                  onChange={(e) =>
                    setFormState({ ...formState, allowBranchOverride: e.target.checked })
                  }
                  className="rounded text-indigo-600 w-3.5 h-3.5"
                />
                <span className="font-bold text-slate-800">
                  Allow Branches to Override Permitted Settings
                </span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH SETTINGS & 12-SECTION NAVIGATION BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PR governance settings (e.g. Short Close, Partial Conversion, Budget Release, Return for Correction)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpandAllSections(!expandAllSections)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            {expandAllSections ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Tabbed Section View</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                <span>Expand All Sections</span>
              </>
            )}
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {matchingSections.map((sec) => {
            const isActive = !expandAllSections && activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setExpandAllSections(false);
                  setActiveSection(sec.id);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* GENERAL POLICY & PR MODULE ACTIVATION                                 */}
      {/* ===================================================================== */}
      {shouldRenderSection('general-policy') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>General Policy — Purchase Requisition Module Activation</span>
              </h3>
              <p className="text-slate-500 mt-0.5">
                Enable or disable core PR capabilities. Settings marked as Centrally Controlled at the Company level cannot be overridden by branches.
              </p>
            </div>
            {!formState.activation.prModuleEnabled && (
              <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>PR Module Disabled: Read-only historical access only</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ACTIVATION_FIELD_METADATA.map((item) => {
              const isEnabled = Boolean(formState.activation[item.key]);
              const isCentralLocked = isFieldCentrallyLockedForBranch(item.key);
              const isCompanyCentralMarked =
                formState.centrallyControlledFields.includes(item.key);
              const isDisabledControl = Boolean(item.immutable || isCentralLocked);

              return (
                <div
                  key={item.key}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    isEnabled
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {item.immutable && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold uppercase">
                            Mandatory
                          </span>
                        )}
                        {isCentralLocked && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold uppercase flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Central Lock
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{item.description}</p>
                    </div>

                    <label
                      className={`relative inline-flex items-center ${
                        isDisabledControl ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Toggle ${item.label}`}
                        checked={isEnabled}
                        disabled={isDisabledControl}
                        onChange={(e) => handleActivationToggle(item.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {item.key === 'expectedDeliveryDateEnabled' && isEnabled && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mt-1 flex items-center justify-between text-[11px]">
                      <label className="font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          aria-label="Mandatory Expected Delivery Date in PR Header"
                          checked={Boolean(formState.activation.expectedDeliveryDateMandatory)}
                          disabled={isDisabledControl}
                          onChange={(e) =>
                            setFormState((prev) => ({
                              ...prev,
                              activation: {
                                ...prev.activation,
                                expectedDeliveryDateMandatory: e.target.checked,
                              },
                            }))
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Mandatory PR Header Entry</span>
                      </label>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {formState.activation.expectedDeliveryDateMandatory ? 'Mandatory (*)' : 'Optional'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                    <span
                      className={`font-bold ${
                        isEnabled ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {isEnabled ? '● Enabled' : '○ Disabled'}
                    </span>

                    {!isBranchScope && !item.immutable ? (
                      <button
                        type="button"
                        onClick={() => handleToggleCentralLock(item.key)}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition flex items-center gap-1 ${
                          isCompanyCentralMarked
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="When marked Centrally Controlled, branches cannot override this setting"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>
                          {isCompanyCentralMarked ? 'Centrally Locked' : 'Branch Overridable'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-slate-400">
                        {isCentralLocked
                          ? 'Locked by Company Governance'
                          : isInheritingFromCompany
                          ? 'Inherited from Company'
                          : 'Branch Configured'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: COMPANY & BRANCH INHERITANCE MATRIX + STALE CLEANUP        */}
      {/* ===================================================================== */}
      {shouldRenderSection('company-branch-scope') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Multi-Company & Multi-Branch Policy Inheritance Matrix</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Live comparison of Company Default Policy vs Branch-level inheritance and overrides across all active branches of {companyDefaultPolicy.companyName}.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-3">Governance Policy Setting</th>
                  <th className="p-3 text-center bg-indigo-50/60 text-indigo-950">
                    {companyDefaultPolicy.companyCode} (Company Default)
                  </th>
                  {companyBranches.map((br) => (
                    <th key={br.id} className="p-3 text-center">
                      {br.name} ({br.portalBranchCode || br.code})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(
                  [
                    { key: 'prModuleEnabled', label: 'PR Module Activation' },
                    { key: 'manualPrCreationEnabled', label: 'Manual PR Creation' },
                    { key: 'mrpPrCreationEnabled', label: 'MRP-Based PR Creation' },
                    { key: 'prShortCloseEnabled', label: 'Short Close' },
                    { key: 'prCancellationEnabled', label: 'PR Cancellation' },
                    { key: 'partialConversionEnabled', label: 'Partial Conversion' },
                    { key: 'expectedDeliveryDateEnabled', label: 'Expected Delivery Date' },
                    { key: 'budgetValidationEnabled', label: 'Budget Validation' },
                  ] as Array<{ key: PrActivationFieldKey; label: string }>
                ).map((row) => {
                  const compVal = companyDefaultPolicy.activation[row.key];
                  return (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{row.label}</td>
                      <td className="p-3 text-center bg-indigo-50/30">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            compVal
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {compVal ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      {companyBranches.map((br) => {
                        const hasOvr = prGovernancePolicyService.hasBranchOverride(
                          selectedCompanyId,
                          br.id
                        );
                        const brEff = prGovernancePolicyService.getEffectivePolicy(
                          selectedCompanyId,
                          br.id
                        );
                        const brVal = brEff.activation[row.key];
                        return (
                          <td key={br.id} className="p-3 text-center">
                            {!hasOvr ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                Inherited ({brVal ? 'Enabled' : 'Disabled'})
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  brVal
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                {brVal ? 'Enabled (Override)' : 'Disabled (Override)'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stale Unapproved PR Age Threshold & Cleanup Configuration (Preserved) */}
          {editingCleanup && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Branch Stale Draft PR Age Threshold & Advance Warning ({editingCleanup.branchName})
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Controls automated warning notifications and bulk cleanup eligibility for unapproved draft PRs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    PurchaseRequisitionService.saveBranchCleanupPolicy({
                      ...editingCleanup,
                      updatedAt: new Date().toISOString(),
                      updatedBy: currentUser?.fullName || 'Platform Admin',
                    });
                    setBranchCleanupPolicies(
                      PurchaseRequisitionService.getBranchCleanupPolicies()
                    );
                    const res = PurchaseRequisitionService.evaluateAndTriggerBranchPrNotifications(
                      editingCleanup.branchId
                    );
                    setFeedbackBanner({
                      type: 'success',
                      message: `Saved Stale PR Threshold for ${editingCleanup.branchName}. ${res.message}`,
                    });
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                >
                  Save & Evaluate Threshold
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Stale Age Threshold (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={editingCleanup.ageThresholdDays}
                    onChange={(e) =>
                      setEditingCleanup({
                        ...editingCleanup,
                        ageThresholdDays: Number(e.target.value) || 45,
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Advance Warning Period (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={editingCleanup.advanceWarningDays}
                    onChange={(e) =>
                      setEditingCleanup({
                        ...editingCleanup,
                        advanceWarningDays: Number(e.target.value) || 5,
                      })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCleanup.isEnabled}
                      onChange={(e) =>
                        setEditingCleanup({ ...editingCleanup, isEnabled: e.target.checked })
                      }
                      className="rounded text-amber-600 w-4 h-4"
                    />
                    <span className="font-bold text-slate-800">
                      Enable Stale PR Cleanup Policy
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: PR CREATION, EDITING & LOCKING POLICY                      */}
      {/* ===================================================================== */}
      {shouldRenderSection('creation-editing') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>PR Creation, Editing & Document Locking Policy</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Governs header and line mutability across PR lifecycle states. Mandatory document locks are enforced at both UI and backend service layers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                label: 'Draft PR Editing',
                desc: 'Rule #1: Draft PRs are editable by the creator/requester before submission.',
                checked: formState.editingAndLocking.draftPrEditing,
                locked: false,
                onChange: (v: boolean) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    editingAndLocking: { ...formState.editingAndLocking, draftPrEditing: v },
                  }),
              },
              {
                label: 'Pending Approval Editing (Locked)',
                desc: 'Mandatory Rule #2: Pending Approval PRs are strictly locked against editing.',
                checked: false,
                locked: true,
              },
              {
                label: 'Returned PR Editing',
                desc: 'Rule #3: Returned PRs can be corrected and resubmitted under the same PR number.',
                checked: formState.editingAndLocking.returnedPrEditing,
                locked: false,
                onChange: (v: boolean) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    editingAndLocking: { ...formState.editingAndLocking, returnedPrEditing: v },
                  }),
              },
              {
                label: 'Approved PR Header Lock',
                desc: 'Mandatory Rule #4: Approved PR headers are permanently immutable.',
                checked: true,
                locked: true,
              },
              {
                label: 'Converted PR Line Lock',
                desc: 'Mandatory Rule #5: Converted PR lines (RFQ/PO) are permanently locked.',
                checked: true,
                locked: true,
              },
              {
                label: 'Unconverted Line Editing on Approved PRs',
                desc: 'Rule #6: Allow amending unconverted lines on Approved PRs subject to reapproval.',
                checked: formState.editingAndLocking.unconvertedLineEditing,
                locked: false,
                onChange: (v: boolean) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    editingAndLocking: {
                      ...formState.editingAndLocking,
                      unconvertedLineEditing: v,
                    },
                  }),
              },
              {
                label: 'Require Reapproval on Approved Line Amendment',
                desc: 'Rule #7: Amendments to approved unconverted lines trigger PENDING_REAPPROVAL.',
                checked: formState.editingAndLocking.requireReapprovalOnApprovedLineEdit,
                locked: false,
                onChange: (v: boolean) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    editingAndLocking: {
                      ...formState.editingAndLocking,
                      requireReapprovalOnApprovedLineEdit: v,
                    },
                  }),
              },
              {
                label: 'Short Closed & Cancelled PR Lock',
                desc: 'Mandatory Rule #8: Short Closed and Cancelled lines are permanently read-only.',
                checked: true,
                locked: true,
              },
              {
                label: 'Rejected & Withdrawn Terminal Lock',
                desc: 'Mandatory Rule #9: Terminal records cannot be reopened through normal operations.',
                checked: true,
                locked: true,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {item.locked && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold">
                        Immutable Rule
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={item.locked}
                  onChange={(e) => item.onChange && item.onChange(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 mt-1 cursor-pointer disabled:opacity-60"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 4: APPROVAL WORKFLOW & MATRIX CONFIGURATION                   */}
      {/* ===================================================================== */}
      {shouldRenderSection('approval-workflow') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>Approval Policy & Matrix Configuration</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Configure multi-level approval hierarchy, branch/department approvers, amount-based routing, escalation, and delegation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <label className="block font-bold text-slate-700 mb-1">Approval Levels</label>
              <select
                value={formState.approval.approvalLevels}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    approval: { ...formState.approval, approvalLevels: Number(e.target.value) },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value={1}>1 Level (Manager L1 Only)</option>
                <option value={2}>2 Levels (L1 Manager + L2 Plant/Procurement)</option>
                <option value={3}>3 Levels (L1 + L2 + L3 Executive Matrix)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <label className="block font-bold text-slate-700 mb-1">
                Approval Escalation SLA (Hours)
              </label>
              <input
                type="number"
                min={4}
                max={240}
                value={formState.approval.escalationAfterHours}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    isInheritedFromCompany: false,
                    approval: {
                      ...formState.approval,
                      escalationAfterHours: Number(e.target.value) || 48,
                    },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            {[
              { key: 'branchLevelApprovers', label: 'Branch-Level Approvers' },
              { key: 'departmentLevelApprovers', label: 'Department-Level Approvers' },
              { key: 'amountBasedApproval', label: 'Amount-Based Approval Matrix' },
              { key: 'managerL1Approval', label: 'Mandatory Manager L1 Approval' },
              { key: 'approvalEscalation', label: 'Automated SLA Escalation' },
              { key: 'approvalDelegation', label: 'Allow Approver Delegation' },
              { key: 'mandatoryApprovalRemarks', label: 'Mandatory Approval Remarks' },
              { key: 'approvalNotifications', label: 'Send Approval Alerts' },
            ].map((item) => (
              <label
                key={item.key}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between cursor-pointer"
              >
                <span className="font-bold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((formState.approval as any)[item.key])}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      isInheritedFromCompany: false,
                      approval: { ...formState.approval, [item.key]: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>

          {/* Approval Matrix Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Level</th>
                  <th className="p-2.5">Approval Stage Name</th>
                  <th className="p-2.5 text-right">Min Amount</th>
                  <th className="p-2.5 text-right">Max Amount</th>
                  <th className="p-2.5">Authorized Role</th>
                  <th className="p-2.5 text-center">Branch Scoped</th>
                  <th className="p-2.5 text-center">Dept Scoped</th>
                  <th className="p-2.5 text-center">SLA (Hrs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formState.approval.approvalMatrix.map((tier) => (
                  <tr key={tier.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-indigo-700">
                      L{tier.levelNumber}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{tier.levelName}</td>
                    <td className="p-2.5 text-right font-mono">
                      {tier.minAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {tier.maxAmount ? tier.maxAmount.toLocaleString('en-IN') : 'Unlimited'}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[10px] font-bold">
                        {tier.approverRole}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">{tier.branchScoped ? 'Yes' : 'No'}</td>
                    <td className="p-2.5 text-center">{tier.departmentScoped ? 'Yes' : 'No'}</td>
                    <td className="p-2.5 text-center font-mono">{tier.slaHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 5: RETURN FOR CORRECTION & RESUBMISSION                       */}
      {/* ===================================================================== */}
      {shouldRenderSection('return-resubmission') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-600" />
              <span>Return for Correction, Resubmission & Withdrawal Policy</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Selected Business Policy: Returned PRs return to the authorized requester for correction and resubmission under the same PR number, preserving prior approval history and starting a new approval cycle.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                key: 'returnForCorrection',
                label: 'Enable Return for Correction',
                desc: 'Allow approvers to return a PR to its requester instead of permanently locking it.',
              },
              {
                key: 'mandatoryReturnReason',
                label: 'Mandatory Return Reason',
                desc: 'Require approvers to enter a mandatory reason when returning a PR.',
              },
              {
                key: 'resubmissionAllowed',
                label: 'Allow Requester Correction & Resubmission',
                desc: 'Permit requester to edit permitted fields on a returned PR and resubmit.',
              },
              {
                key: 'retainSamePrNumberOnResubmit',
                label: 'Retain Same PR Number & Start New Cycle',
                desc: 'Preserve original PR number and previous approval comments on resubmission.',
              },
              {
                key: 'withdrawalBeforeApproval',
                label: 'Allow Withdrawal Before Final Approval',
                desc: 'Allow requester to withdraw a submitted PR while still pending approval.',
              },
              {
                key: 'allowTerminalReject',
                label: 'Allow Separate Terminal Reject Action',
                desc: 'Retain terminal Reject as a distinct, explicitly configured outcome.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900">{item.label}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean((formState.approval as any)[item.key])}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormState((prev) => ({
                      ...prev,
                      isInheritedFromCompany: false,
                      activation: {
                        ...prev.activation,
                        prReturnForCorrectionEnabled:
                          item.key === 'returnForCorrection'
                            ? checked
                            : prev.activation.prReturnForCorrectionEnabled,
                        prWithdrawalEnabled:
                          item.key === 'withdrawalBeforeApproval'
                            ? checked
                            : prev.activation.prWithdrawalEnabled,
                      },
                      approval: {
                        ...prev.approval,
                        [item.key]: checked,
                      },
                    }));
                  }}
                  className="rounded text-indigo-600 w-4 h-4 mt-1"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 6: PARTIAL RFQ & PO CONVERSION POLICY (LINE-LEVEL LOCKING)    */}
      {/* ===================================================================== */}
      {shouldRenderSection('partial-conversion') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Partial RFQ & PO Conversion Policy (Line-Level Locking)</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Selected Business Rule: LINE-LEVEL LOCKING. Converted quantities are permanently locked while remaining unconverted quantities can be processed or short-closed under policy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                key: 'enablePartialRfqConversion',
                label: 'Enable Partial RFQ Conversion',
                disabled: !formState.activation.rfqConversionEnabled,
              },
              {
                key: 'enablePartialPoConversion',
                label: 'Enable Partial PO Conversion',
                disabled: !formState.activation.poConversionEnabled,
              },
              {
                key: 'allowMultipleRfqReferences',
                label: 'Allow Multiple RFQ References',
                disabled: false,
              },
              {
                key: 'allowMultiplePoReferences',
                label: 'Allow Multiple PO References',
                disabled: false,
              },
              {
                key: 'convertedQuantityTracking',
                label: 'Converted Quantity Tracking',
                disabled: false,
              },
              {
                key: 'remainingQuantityTracking',
                label: 'Remaining Quantity Tracking',
                disabled: false,
              },
              {
                key: 'lineLevelConversionLock',
                label: 'Line-Level Conversion Lock (Mandatory)',
                disabled: true,
              },
              {
                key: 'conversionApprovalValidation',
                label: 'Validate PR Approval Before Conversion',
                disabled: false,
              },
            ].map((item) => (
              <label
                key={item.key}
                className={`p-3 rounded-xl border border-slate-200 flex items-center justify-between ${
                  item.disabled
                    ? 'bg-slate-100 opacity-70 cursor-not-allowed'
                    : 'bg-white cursor-pointer'
                }`}
              >
                <span className="font-bold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((formState.partialConversion as any)[item.key])}
                  disabled={item.disabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormState((prev) => ({
                      ...prev,
                      isInheritedFromCompany: false,
                      partialConversion: {
                        ...prev.partialConversion,
                        [item.key]: checked,
                      },
                      rfqPoIntegration: {
                        ...prev.rfqPoIntegration,
                        enablePartialRfqConversion:
                          item.key === 'enablePartialRfqConversion'
                            ? checked
                            : prev.rfqPoIntegration.enablePartialRfqConversion,
                        enablePartialPoConversion:
                          item.key === 'enablePartialPoConversion'
                            ? checked
                            : prev.rfqPoIntegration.enablePartialPoConversion,
                      },
                    }));
                  }}
                  className="rounded text-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>

          {/* Reference Table Illustrating Line-Level Locking Rule */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 mb-2">
              Authoritative Line-Level Locking Reference Matrix
            </div>
            <table className="w-full text-left border-collapse text-xs bg-white rounded-lg overflow-hidden border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <th className="p-2">PR Line Example</th>
                  <th className="p-2 text-right">Quantity</th>
                  <th className="p-2 text-right">Converted</th>
                  <th className="p-2 text-right">Remaining</th>
                  <th className="p-2">Effective Line Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="p-2 font-sans font-bold">Item A (Fully Converted)</td>
                  <td className="p-2 text-right">100</td>
                  <td className="p-2 text-right text-indigo-700 font-bold">100</td>
                  <td className="p-2 text-right">0</td>
                  <td className="p-2 font-sans">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                      Locked (Permanently Immutable)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-bold">Item B (Unconverted)</td>
                  <td className="p-2 text-right">500</td>
                  <td className="p-2 text-right">0</td>
                  <td className="p-2 text-right text-emerald-700 font-bold">500</td>
                  <td className="p-2 font-sans">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      Available for RFQ/PO, Short Close, or Cancel
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-sans font-bold">Item C (Partial Conversion)</td>
                  <td className="p-2 text-right">50</td>
                  <td className="p-2 text-right text-indigo-700 font-bold">20</td>
                  <td className="p-2 text-right text-amber-700 font-bold">30</td>
                  <td className="p-2 font-sans">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                      Partially Converted (20 Locked • 30 Eligible for RFQ/PO or Short Close)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 7: SHORT CLOSE POLICY & CANCELLATION POLICY                   */}
      {/* ===================================================================== */}
      {shouldRenderSection('short-close-cancel') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Short Close Policy Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Short Close Policy</h3>
                <p className="text-slate-500 mt-0.5">
                  Closes remaining unconverted quantities while preserving converted lines and downstream RFQ/PO/GRN records.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formState.shortClose.enableShortClose}
                onChange={(e) => handleActivationToggle('prShortCloseEnabled', e.target.checked)}
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { key: 'mandatoryReason', label: 'Mandatory Short Close Reason' },
                { key: 'mandatoryRemarks', label: 'Mandatory Short Close Remarks' },
                {
                  key: 'budgetReconciliationRequired',
                  label: 'Budget Reconciliation Required',
                },
                { key: 'notificationRequired', label: 'Send Short Close Notification' },
                { key: 'allowLineLevelShortClose', label: 'Allow Line-Level Short Close' },
                {
                  key: 'requireApprovalForShortClose',
                  label: 'Require Approval for Short Close',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold text-slate-800">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean((formState.shortClose as any)[item.key])}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isInheritedFromCompany: false,
                        shortClose: {
                          ...formState.shortClose,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-indigo-600 w-3.5 h-3.5"
                  />
                </label>
              ))}
            </div>

            <div>
              <span className="block font-bold text-slate-700 mb-1.5">
                Applicable PR Types for Short Close
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_PR_TYPES.map((t) => {
                  const active = formState.shortClose.applicablePrTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? formState.shortClose.applicablePrTypes.filter((x) => x !== t)
                          : [...formState.shortClose.applicablePrTypes, t];
                        setFormState({
                          ...formState,
                          isInheritedFromCompany: false,
                          shortClose: { ...formState.shortClose, applicablePrTypes: next },
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer border ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cancellation Policy Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Purchase Request Cancellation Policy
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Separate from Short Close. Only completely unconverted lines may be cancelled and permanently locked.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formState.cancellation.enablePrCancellation}
                onChange={(e) =>
                  handleActivationToggle('prCancellationEnabled', e.target.checked)
                }
                className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { key: 'mandatoryCancellationReason', label: 'Mandatory Cancellation Reason' },
                {
                  key: 'mandatoryCancellationRemarks',
                  label: 'Mandatory Cancellation Remarks',
                },
                {
                  key: 'budgetReconciliationRequired',
                  label: 'Budget Reconciliation Required',
                },
                { key: 'notificationRequired', label: 'Send Cancellation Notification' },
                { key: 'allowLineLevelCancellation', label: 'Allow Line-Level Cancellation' },
                { key: 'requireAdditionalApproval', label: 'Require Additional Approval' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="font-bold text-slate-800">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean((formState.cancellation as any)[item.key])}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        isInheritedFromCompany: false,
                        cancellation: {
                          ...formState.cancellation,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-indigo-600 w-3.5 h-3.5"
                  />
                </label>
              ))}
            </div>

            <div>
              <span className="block font-bold text-slate-700 mb-1.5">
                Applicable PR Types for Cancellation
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_PR_TYPES.map((t) => {
                  const active = formState.cancellation.applicablePrTypes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? formState.cancellation.applicablePrTypes.filter((x) => x !== t)
                          : [...formState.cancellation.applicablePrTypes, t];
                        setFormState({
                          ...formState,
                          isInheritedFromCompany: false,
                          cancellation: {
                            ...formState.cancellation,
                            applicablePrTypes: next,
                          },
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer border ${
                        active
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 8: BUDGET & FINANCIAL GOVERNANCE                              */}
      {/* ===================================================================== */}
      {shouldRenderSection('budget-financial') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-indigo-600" />
              <span>Budget & Financial Governance</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Selected Business Policy: Automatically release eligible uncommitted budget reservations after successful reconciliation while preserving existing PO commitments.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-indigo-950 text-xs">
                Authoritative Uncommitted Budget Release Formula
              </div>
              <div className="font-mono font-bold text-indigo-700 text-xs mt-1">
                Eligible Release Amount = Original PR Reservation − Valid Outstanding Commitments − Previously Released Amount
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              PO Commitments Protected • Duplicate Release Blocked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'enableBudgetValidation',
                label: 'Enable Budget Validation',
                immutable: false,
              },
              {
                key: 'mandatoryBudgetCheck',
                label: 'Mandatory Budget Check Before Submission',
                immutable: false,
              },
              {
                key: 'budgetReservationOnApproval',
                label: 'Reserve Budget on PR Approval',
                immutable: false,
              },
              {
                key: 'autoUncommittedBudgetRelease',
                label: 'Automatic Uncommitted Budget Release',
                immutable: false,
              },
              {
                key: 'budgetReleaseOnShortClose',
                label: 'Release Uncommitted Budget on Short Close',
                immutable: false,
              },
              {
                key: 'budgetReleaseOnCancellation',
                label: 'Release Uncommitted Budget on Cancellation',
                immutable: false,
              },
              {
                key: 'preservePoCommitments',
                label: 'Preserve Existing PO Commitments (Mandatory)',
                immutable: true,
              },
              {
                key: 'preventDuplicateBudgetRelease',
                label: 'Prevent Duplicate Budget Release (Mandatory)',
                immutable: true,
              },
              {
                key: 'budgetReconciliationAudit',
                label: 'Mandatory Budget Reconciliation Audit',
                immutable: true,
              },
            ].map((item) => (
              <label
                key={item.key}
                className={`p-3 rounded-xl border border-slate-200 flex items-center justify-between ${
                  item.immutable
                    ? 'bg-slate-100 opacity-75 cursor-not-allowed'
                    : 'bg-white cursor-pointer'
                }`}
              >
                <span className="font-bold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((formState.budget as any)[item.key])}
                  disabled={item.immutable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormState((prev) => ({
                      ...prev,
                      isInheritedFromCompany: false,
                      activation: {
                        ...prev.activation,
                        budgetValidationEnabled:
                          item.key === 'enableBudgetValidation'
                            ? checked
                            : prev.activation.budgetValidationEnabled,
                      },
                      budget: {
                        ...prev.budget,
                        [item.key]: checked,
                      },
                    }));
                  }}
                  className="rounded text-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 9: RFQ & PO INTEGRATION POLICY                                */}
      {/* ===================================================================== */}
      {shouldRenderSection('rfq-po-integration') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>RFQ & PO Integration Policy</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Controls downstream conversion of Approved PR lines into RFQs and Purchase Orders. PR operations never reverse downstream RFQ, PO, GRN, or Invoice records.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'enablePrToRfqConversion', label: 'Enable PR to RFQ Conversion' },
              { key: 'enablePrToPoConversion', label: 'Enable PR to PO Conversion' },
              { key: 'enablePartialRfqConversion', label: 'Enable Partial RFQ Conversion' },
              { key: 'enablePartialPoConversion', label: 'Enable Partial PO Conversion' },
              { key: 'validateApprovedPr', label: 'Validate Approved PR Status' },
              { key: 'validateEligiblePrLines', label: 'Validate Eligible PR Lines' },
              { key: 'validateRemainingQuantity', label: 'Validate Remaining Quantity' },
              { key: 'validateBudget', label: 'Validate Active Budget Reservation' },
              { key: 'preventDuplicateConversion', label: 'Prevent Duplicate / Over Conversion' },
              { key: 'preserveConversionReferences', label: 'Preserve RFQ / PO References on Line' },
            ].map((item) => (
              <label
                key={item.key}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between cursor-pointer"
              >
                <span className="font-bold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((formState.rfqPoIntegration as any)[item.key])}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormState((prev) => ({
                      ...prev,
                      isInheritedFromCompany: false,
                      activation: {
                        ...prev.activation,
                        rfqConversionEnabled:
                          item.key === 'enablePrToRfqConversion'
                            ? checked
                            : prev.activation.rfqConversionEnabled,
                        poConversionEnabled:
                          item.key === 'enablePrToPoConversion'
                            ? checked
                            : prev.activation.poConversionEnabled,
                      },
                      rfqPoIntegration: {
                        ...prev.rfqPoIntegration,
                        [item.key]: checked,
                      },
                    }));
                  }}
                  className="rounded text-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 10: NOTIFICATION POLICY                                       */}
      {/* ===================================================================== */}
      {shouldRenderSection('notifications') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>Notification Policy (Company & Branch Scoped)</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Integrates with existing CIPPlatform Email Configuration, WhatsApp Gateway, and In-Portal Notification Centre.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { key: 'prSubmissionNotification', label: 'PR Submission' },
              { key: 'approvalNotification', label: 'PR Approval' },
              { key: 'returnForCorrectionNotification', label: 'Return for Correction' },
              { key: 'resubmissionNotification', label: 'PR Resubmission' },
              { key: 'shortCloseNotification', label: 'PR Short Close' },
              { key: 'cancellationNotification', label: 'PR Cancellation' },
              { key: 'rfqConversionNotification', label: 'RFQ Conversion' },
              { key: 'poConversionNotification', label: 'PO Conversion' },
              { key: 'budgetReleaseNotification', label: 'Uncommitted Budget Release' },
              { key: 'buyerAssignmentNotification', label: 'Buyer Assignment' },
            ].map((item) => (
              <label
                key={item.key}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer"
              >
                <span className="font-bold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean((formState.notifications as any)[item.key])}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      isInheritedFromCompany: false,
                      notifications: {
                        ...formState.notifications,
                        [item.key]: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 11: AUDIT & SECURITY POLICY                                   */}
      {/* ===================================================================== */}
      {shouldRenderSection('audit-security') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Mandatory Audit & Security Enforcement</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Cryptographically chained audit trail across PR status changes, line edits, approvals, conversions, short close, cancellation, budget releases, and policy updates.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Timestamp (UTC)</th>
                  <th className="p-2.5">Company / Branch</th>
                  <th className="p-2.5">Event Type</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5">Actor</th>
                  <th className="p-2.5">Reason / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditGrid.pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400">
                      No PR audit events recorded yet for this company.
                    </td>
                  </tr>
                ) : (
                  auditGrid.pagedData.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-2.5 font-bold text-slate-800">
                        {log.companyName || log.companyId}
                        {log.branchId ? ` / ${log.branchName || log.branchId}` : ''}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold">
                          {log.eventType}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-800">{log.eventDescription}</td>
                      <td className="p-2.5 font-bold text-slate-700">{log.changedByName}</td>
                      <td className="p-2.5 text-slate-600">{log.changeReason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={auditGrid.currentPage}
            totalPages={auditGrid.totalPages}
            pageSize={auditGrid.pageSize}
            totalRecords={auditGrid.totalRecords}
            onPageChange={auditGrid.setCurrentPage}
            onPageSizeChange={auditGrid.setPageSize}
            pageSizeOptions={auditGrid.pageSizeOptions}
            defaultSortNotice="Newest Events First (DESC)"
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 12: MAKER-CHECKER POLICY ADMINISTRATION, VERSIONING & ROLLBACK*/}
      {/* ===================================================================== */}
      {shouldRenderSection('policy-history') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Maker-Checker Policy Administration, Version History & Controlled Rollback</span>
              </h3>
              <p className="text-slate-500 mt-0.5">
                Policy creator cannot self-approve policy changes. Pending proposals do not overwrite the active policy until approved by a separate Governance Checker.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Version</th>
                  <th className="p-2.5">Scope & Entity</th>
                  <th className="p-2.5">Effective Window</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Maker (Creator / Modifier)</th>
                  <th className="p-2.5">Checker (Approver / Activator)</th>
                  <th className="p-2.5">Change Summary</th>
                  <th className="p-2.5 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyGrid.pagedData.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-indigo-700">
                      {rec.policyVersion}
                      {rec.rollbackTargetVersion && (
                        <span className="block text-[9px] text-amber-700 font-sans">
                          Rollback → {rec.rollbackTargetVersion}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] mr-1.5">
                        {rec.policyScope}
                      </span>
                      <span className="font-bold text-slate-900">
                        {rec.companyCode} — {rec.branchName}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      <span>From: {rec.effectiveFrom}</span>
                      {rec.effectiveUntil && (
                        <span className="block text-rose-700">Until: {rec.effectiveUntil}</span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'PENDING_APPROVAL'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : rec.status === 'REJECTED' || rec.status === 'EXPIRED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">
                      <span className="font-bold text-slate-800 block">{rec.modifiedBy}</span>
                      <span className="text-[10px]">
                        {new Date(rec.modifiedAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">
                      {rec.approvedBy ? (
                        <>
                          <span className="font-bold text-emerald-800 block">{rec.approvedBy}</span>
                          {rec.approvedAt && (
                            <span className="text-[10px]">
                              {new Date(rec.approvedAt).toLocaleString()}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-amber-700 font-bold text-[10px]">
                          Awaiting Checker Approval
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-700 max-w-xs">{rec.changeSummary}</td>
                    <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                      {rec.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const checkerUser: User = {
                                  id: 'usr-checker-gov-01',
                                  fullName: 'Vikramaditya Rao (Governance Checker)',
                                  email: 'checker@kosh.in',
                                  role: 'ORG_ADMIN',
                                  orgId: selectedCompanyId,
                                  allowedBranchIds: [],
                                  isGlobalScope: true,
                                  twoFactorEnabled: true,
                                };
                                const { activatedPolicy } =
                                  prGovernancePolicyService.approveAndActivatePolicyChange(
                                    rec.id,
                                    checkerUser,
                                    'Verified and approved via Maker-Checker Governance'
                                  );
                                setPoliciesVersionTick((t) => t + 1);
                                setFormState(JSON.parse(JSON.stringify(activatedPolicy)));
                                setFeedbackBanner({
                                  type: 'success',
                                  message: `Checker approved and activated Policy Version ${activatedPolicy.policyVersion}. Previous version marked SUPERSEDED.`,
                                });
                              } catch (err: any) {
                                setFeedbackBanner({
                                  type: 'error',
                                  message: err?.message || 'Maker-Checker approval failed.',
                                });
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px] cursor-pointer"
                          >
                            Approve & Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const checkerUser: User = {
                                  id: 'usr-checker-gov-01',
                                  fullName: 'Vikramaditya Rao (Governance Checker)',
                                  email: 'checker@kosh.in',
                                  role: 'ORG_ADMIN',
                                  orgId: selectedCompanyId,
                                  allowedBranchIds: [],
                                  isGlobalScope: true,
                                  twoFactorEnabled: true,
                                };
                                prGovernancePolicyService.rejectPolicyChange(
                                  rec.id,
                                  checkerUser,
                                  'Rejected during Checker review'
                                );
                                setPoliciesVersionTick((t) => t + 1);
                                setFeedbackBanner({
                                  type: 'warning',
                                  message: `Rejected pending policy version ${rec.policyVersion}. Active policy remains unchanged.`,
                                });
                              } catch (err: any) {
                                setFeedbackBanner({
                                  type: 'error',
                                  message: err?.message || 'Rejection failed.',
                                });
                              }
                            }}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-bold text-[11px] cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(rec.status === 'SUPERSEDED' || rec.status === 'HISTORICAL') && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const maker: User = currentUser || {
                                id: 'usr-maker-01',
                                fullName: 'Rajesh Sharma (Policy Maker)',
                                email: 'maker@kosh.in',
                                role: 'PLATFORM_ADMIN',
                                orgId: selectedCompanyId,
                                allowedBranchIds: [],
                                isGlobalScope: true,
                                twoFactorEnabled: true,
                              };
                              const pendingRollback =
                                prGovernancePolicyService.requestPolicyRollback({
                                  targetVersionRecordId: rec.id,
                                  maker,
                                  reason: `Controlled rollback to approved baseline ${rec.policyVersion}`,
                                });
                              setPoliciesVersionTick((t) => t + 1);
                              setFeedbackBanner({
                                type: 'success',
                                message: `Created controlled rollback proposal (${pendingRollback.policyVersion} → ${rec.policyVersion}) awaiting Checker approval.`,
                              });
                            } catch (err: any) {
                              setFeedbackBanner({
                                type: 'error',
                                message: err?.message || 'Rollback request failed.',
                              });
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold text-[11px] cursor-pointer"
                        >
                          Request Rollback
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedVersionSnapshot(rec)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-bold text-[11px] cursor-pointer"
                      >
                        Snapshot
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={historyGrid.currentPage}
            totalPages={historyGrid.totalPages}
            pageSize={historyGrid.pageSize}
            totalRecords={historyGrid.totalRecords}
            onPageChange={historyGrid.setCurrentPage}
            onPageSizeChange={historyGrid.setPageSize}
            pageSizeOptions={historyGrid.pageSizeOptions}
            defaultSortNotice="Newest Policy Versions First (DESC)"
          />

          {selectedVersionSnapshot && (
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-300">
                  Policy Version Snapshot: {selectedVersionSnapshot.policyVersion} (
                  {selectedVersionSnapshot.companyCode} / {selectedVersionSnapshot.branchName})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedVersionSnapshot(null)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  Close ✕
                </button>
              </div>
              <pre className="text-[10px] font-mono overflow-x-auto max-h-56 bg-slate-950 p-3 rounded-lg">
                {JSON.stringify(selectedVersionSnapshot.snapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 13: PR NUMBERING, FINANCIAL PERIODS & DUPLICATE PREVENTION    */}
      {/* ===================================================================== */}
      {shouldRenderSection('numbering-duplicates') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>PR Numbering, Financial Period Controls, Multi-Branch Procurement & Duplicate Prevention</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Configure company/branch/financial-year PR numbering sequences, closed period & backdate restrictions, cross-branch procurement visibility, and configurable duplicate PR detection.
            </p>
          </div>

          {/* A. PR Numbering & Financial Period Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">PR Prefix</label>
              <input
                type="text"
                value={formState.numberingAndPeriod?.prPrefix || 'PR'}
                disabled={Boolean(formState.numberingAndPeriod?.sequenceLockedAfterTransactions)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      prPrefix: e.target.value.toUpperCase(),
                    },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Active Financial Year</label>
              <input
                type="text"
                value={formState.numberingAndPeriod?.activeFinancialYear || '2026'}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      activeFinancialYear: e.target.value,
                    },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Open Period Start</label>
              <input
                type="date"
                value={formState.numberingAndPeriod?.openPeriodStart || '2026-01-01'}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      openPeriodStart: e.target.value,
                    },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Open Period End</label>
              <input
                type="date"
                value={formState.numberingAndPeriod?.openPeriodEnd || '2027-03-31'}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      openPeriodEnd: e.target.value,
                    },
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <label className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-slate-800">Include Company Code in PR#</span>
              <input
                type="checkbox"
                checked={Boolean(formState.numberingAndPeriod?.includeCompanyCode)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      includeCompanyCode: e.target.checked,
                    },
                  })
                }
                className="rounded text-indigo-600"
              />
            </label>

            <label className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-slate-800">Include Branch Code in PR#</span>
              <input
                type="checkbox"
                checked={Boolean(formState.numberingAndPeriod?.includeBranchCode)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      includeBranchCode: e.target.checked,
                    },
                  })
                }
                className="rounded text-indigo-600"
              />
            </label>

            <label className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-slate-800">Restrict Closed Financial Periods</span>
              <input
                type="checkbox"
                checked={Boolean(formState.numberingAndPeriod?.restrictClosedPeriodTransactions ?? true)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      restrictClosedPeriodTransactions: e.target.checked,
                    },
                  })
                }
                className="rounded text-indigo-600"
              />
            </label>

            <label className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
              <span className="font-bold text-slate-800">Allow Backdated PRs</span>
              <input
                type="checkbox"
                checked={Boolean(formState.numberingAndPeriod?.allowBackdatedPr)}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    numberingAndPeriod: {
                      ...(formState.numberingAndPeriod as any),
                      allowBackdatedPr: e.target.checked,
                    },
                  })
                }
                className="rounded text-indigo-600"
              />
            </label>
          </div>

          {/* B. Duplicate PR Prevention Controls */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-900">
              Configurable Duplicate PR Detection (Requirement G)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
                <span className="font-bold text-slate-800">Enable Duplicate Detection</span>
                <input
                  type="checkbox"
                  checked={Boolean(formState.duplicatePrevention?.enableDuplicateDetection ?? true)}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      duplicatePrevention: {
                        ...(formState.duplicatePrevention as any),
                        enableDuplicateDetection: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600"
                />
              </label>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Duplicate Warning Level</label>
                <select
                  value={formState.duplicatePrevention?.warningLevel || 'WARNING_WITH_JUSTIFICATION'}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      duplicatePrevention: {
                        ...(formState.duplicatePrevention as any),
                        warningLevel: e.target.value as any,
                      },
                    })
                  }
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="WARNING_WITH_JUSTIFICATION">
                    Warning + Mandatory Justification
                  </option>
                  <option value="HARD_BLOCK">Hard Block</option>
                  <option value="ADVISORY_ONLY">Advisory Warning Only</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Similar Quantity Tolerance (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formState.duplicatePrevention?.quantityVarianceTolerancePercent ?? 20}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      duplicatePrevention: {
                        ...(formState.duplicatePrevention as any),
                        quantityVarianceTolerancePercent: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <label className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer">
                <span className="font-bold text-slate-800">Centralized Buyer Cross-Branch Access</span>
                <input
                  type="checkbox"
                  checked={Boolean(formState.multiBranchProcurement?.centralizedProcurementVisibility ?? true)}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      multiBranchProcurement: {
                        ...(formState.multiBranchProcurement as any),
                        centralizedProcurementVisibility: e.target.checked,
                        crossBranchProcurementAuthorized: e.target.checked,
                      },
                    })
                  }
                  className="rounded text-indigo-600"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 14: APPROVAL DELEGATION & SLA ESCALATION                      */}
      {/* ===================================================================== */}
      {shouldRenderSection('delegation-escalation') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Approval Delegation & SLA Escalation Governance</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Delegations never bypass company, branch, or amount-based approval restrictions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 items-end">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Delegator</label>
              <input
                type="text"
                value={delDelegatorName}
                onChange={(e) => setDelDelegatorName(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Delegatee (Alternate)</label>
              <input
                type="text"
                value={delDelegateeName}
                onChange={(e) => setDelDelegateeName(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={delStartDate}
                onChange={(e) => setDelStartDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={delEndDate}
                onChange={(e) => setDelEndDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Amount (INR)</label>
              <input
                type="number"
                value={delMaxAmount}
                onChange={(e) => setDelMaxAmount(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={() => {
                  try {
                    prGovernancePolicyService.createDelegation(
                      {
                        companyId: selectedCompanyId,
                        branchId: selectedBranchId,
                        delegatorUserId: 'usr-del-from',
                        delegatorName: delDelegatorName,
                        delegatorRole: 'DEPARTMENT_HEAD',
                        delegateeUserId: 'usr-del-to',
                        delegateeName: delDelegateeName,
                        delegateeRole: 'PROCUREMENT_MANAGER',
                        startDate: delStartDate,
                        endDate: delEndDate,
                        maxApprovalAmount: delMaxAmount,
                        currency: 'INR',
                        scopeDescription: delScopeDesc,
                      },
                      currentUser
                    );
                    setPoliciesVersionTick((t) => t + 1);
                    setFeedbackBanner({
                      type: 'success',
                      message: `Created temporary approval delegation from ${delDelegatorName} to ${delDelegateeName}.`,
                    });
                  } catch (err: any) {
                    setFeedbackBanner({
                      type: 'error',
                      message: err?.message || 'Failed to create delegation.',
                    });
                  }
                }}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                + Add Delegation
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Delegator → Delegatee</th>
                  <th className="p-2.5">Company / Branch Scope</th>
                  <th className="p-2.5">Effective Window</th>
                  <th className="p-2.5">Max Amount Cap</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delegationsGrid.pagedData.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">
                      {del.delegatorName} → <span className="text-indigo-700">{del.delegateeName}</span>
                    </td>
                    <td className="p-2.5 font-mono">
                      {del.companyId} / {del.branchId}
                    </td>
                    <td className="p-2.5 font-mono">
                      {del.startDate} to {del.endDate}
                    </td>
                    <td className="p-2.5 font-mono font-bold">
                      {del.currency} {del.maxApprovalAmount?.toLocaleString('en-IN') || 'Unlimited'}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          del.approvalStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {del.approvalStatus}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      {del.approvalStatus === 'PENDING_APPROVAL' && (
                        <button
                          type="button"
                          onClick={() => {
                            prGovernancePolicyService.approveDelegation(del.id, {
                              id: 'usr-checker-gov-01',
                              fullName: 'Vikramaditya Rao (Org Admin)',
                              email: 'checker@kosh.in',
                              role: 'ORG_ADMIN',
                              orgId: selectedCompanyId,
                              allowedBranchIds: [],
                              isGlobalScope: true,
                              twoFactorEnabled: true,
                            });
                            setPoliciesVersionTick((t) => t + 1);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold text-[11px] cursor-pointer"
                        >
                          Approve Delegation
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={delegationsGrid.currentPage}
            totalPages={delegationsGrid.totalPages}
            pageSize={delegationsGrid.pageSize}
            totalRecords={delegationsGrid.totalRecords}
            onPageChange={delegationsGrid.setCurrentPage}
            onPageSizeChange={delegationsGrid.setPageSize}
            pageSizeOptions={delegationsGrid.pageSizeOptions}
            defaultSortNotice="Newest Delegations First (DESC)"
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 15: POLICY SIMULATION SANDBOX & FAILURE RECOVERY QUEUE        */}
      {/* ===================================================================== */}
      {shouldRenderSection('simulation-recovery') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Interactive Policy Simulation Sandbox & Failure Recovery Queue (Requirements L & M)</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Preview effective policy behavior across roles, PR statuses, and conversion states without creating or modifying actual PR transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Simulate User Role</label>
              <select
                value={simRole}
                onChange={(e) => setSimRole(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                <option value="ORG_ADMIN">ORG_ADMIN</option>
                <option value="PROCUREMENT_MANAGER">PROCUREMENT_MANAGER</option>
                <option value="DEPARTMENT_HEAD">DEPARTMENT_HEAD</option>
                <option value="BUYER">BUYER</option>
                <option value="REQUESTER">REQUESTER</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Simulate PR Type</label>
              <select
                value={simPrType}
                onChange={(e) => setSimPrType(e.target.value as PRType)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="MANUAL">MANUAL</option>
                <option value="MRP">MRP</option>
                <option value="REPAIR">REPAIR</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="CAPEX_ASSET">CAPEX_ASSET</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Simulate PR Status</label>
              <select
                value={simPrStatus}
                onChange={(e) => setSimPrStatus(e.target.value as PRStatus)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_MANAGER_APPROVAL">PENDING_MANAGER_APPROVAL</option>
                <option value="RETURNED_FOR_CORRECTION">RETURNED_FOR_CORRECTION</option>
                <option value="APPROVED_PENDING_BUYER">APPROVED_PENDING_BUYER</option>
                <option value="SHORT_CLOSED">SHORT_CLOSED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Line Conversion State</label>
              <select
                value={simConversionStatus}
                onChange={(e) => setSimConversionStatus(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold"
              >
                <option value="UNCONVERTED">UNCONVERTED (0% Converted)</option>
                <option value="PARTIALLY_CONVERTED">PARTIALLY_CONVERTED (40%)</option>
                <option value="FULLY_CONVERTED">FULLY_CONVERTED (100% Locked)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Simulated PR Value</label>
              <input
                type="number"
                value={simAmount}
                onChange={(e) => setSimAmount(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-indigo-300">
              Expected Workflow Outcome: {simulationResult.expectedWorkflowOutcome}
            </span>
            <span className="font-mono text-[11px] text-emerald-400">
              SLA: {simulationResult.approvalRequirements.slaHours}h • Reporting Currency:{' '}
              {simulationResult.budgetRequirements.reportingCurrency}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
              <h4 className="font-bold text-emerald-900">
                Available Governed Actions ({simulationResult.availableActions.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {simulationResult.availableActions.map((a) => (
                  <span
                    key={a.action}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[11px]"
                  >
                    ✓ {a.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
              <h4 className="font-bold text-rose-900">
                Restricted Actions & Reasons ({simulationResult.restrictedActions.length})
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {simulationResult.restrictedActions.map((r) => (
                  <div
                    key={r.action}
                    className="p-2 rounded bg-white border border-rose-200 flex items-start justify-between gap-2 text-[11px]"
                  >
                    <span className="font-bold text-rose-800 shrink-0">✕ {r.label}</span>
                    <span className="text-slate-600 text-right">{r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Failure Recovery & Reconciliation Queue */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900">
                Failure Recovery & Reconciliation Queue (Requirement M)
              </h4>
              <input
                type="text"
                value={reconReasonInput}
                onChange={(e) => setReconReasonInput(e.target.value)}
                placeholder="Mandatory reconciliation reason..."
                className="p-2 bg-slate-50 border border-slate-300 rounded-lg w-64"
              />
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                    <th className="p-2.5">Operation Type</th>
                    <th className="p-2.5">PR Number</th>
                    <th className="p-2.5">Idempotency Key</th>
                    <th className="p-2.5">Failure Reason</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Recovery Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconGrid.pagedData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        No unresolved transaction failures in the reconciliation queue.
                      </td>
                    </tr>
                  ) : (
                    reconGrid.pagedData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-rose-700">
                          {item.operationType}
                        </td>
                        <td className="p-2.5 font-bold">{item.prNumber}</td>
                        <td className="p-2.5 font-mono text-[11px]">{item.idempotencyKey}</td>
                        <td className="p-2.5 text-slate-700">{item.errorMessage}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'UNRESOLVED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          {item.status === 'UNRESOLVED' && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  prGovernancePolicyService.reconcileFailureQueueItem({
                                    queueItemId: item.id,
                                    actor: currentUser || {
                                      id: 'usr-admin-01',
                                      fullName: 'Rajesh Sharma (Platform Admin)',
                                      email: 'admin@kosh.in',
                                      role: 'PLATFORM_ADMIN',
                                      orgId: selectedCompanyId,
                                      allowedBranchIds: [],
                                      isGlobalScope: true,
                                      twoFactorEnabled: true,
                                    },
                                    reason:
                                      reconReasonInput.trim() ||
                                      'Authorized administrator manual reconciliation',
                                  });
                                  setPoliciesVersionTick((t) => t + 1);
                                } catch (err: any) {
                                  setFeedbackBanner({
                                    type: 'error',
                                    message: err?.message || 'Reconciliation failed.',
                                  });
                                }
                              }}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded font-bold text-[11px] cursor-pointer"
                            >
                              Reconcile Item
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DataGridFooter
              currentPage={reconGrid.currentPage}
              totalPages={reconGrid.totalPages}
              pageSize={reconGrid.pageSize}
              totalRecords={reconGrid.totalRecords}
              onPageChange={reconGrid.setCurrentPage}
              onPageSizeChange={reconGrid.setPageSize}
              pageSizeOptions={reconGrid.pageSizeOptions}
              defaultSortNotice="Newest Queue Items First (DESC)"
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 16: CONSOLIDATED PR & FINANCIAL RECONCILIATION REPORT         */}
      {/* ===================================================================== */}
      {shouldRenderSection('consolidated-report') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-4 h-4 text-indigo-600" />
              <span>Consolidated Multi-Company / Multi-Currency PR & Budget Reconciliation Report (Requirement O)</span>
            </h3>
            <p className="text-slate-500 mt-0.5">
              Reconciles commitments in their original transaction currency and separately in Company Reporting Currency ({consolidatedReport.companyReportingSummary.reportingCurrency}) using preserved historical exchange rates.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Scoped PR Count
              </span>
              <span className="text-lg font-bold text-slate-900">
                {consolidatedReport.totalPrCount}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
              <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                Reserved Budget (Reporting INR)
              </span>
              <span className="text-lg font-mono font-bold text-indigo-950">
                INR {consolidatedReport.companyReportingSummary.totalReservedBudgetReporting.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
              <span className="text-[10px] font-bold uppercase text-amber-800 block">
                Outstanding Commitments (INR)
              </span>
              <span className="text-lg font-mono font-bold text-amber-950">
                INR {consolidatedReport.companyReportingSummary.totalOutstandingCommitmentsReporting.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                Released Budget (Reporting INR)
              </span>
              <span className="text-lg font-mono font-bold text-emerald-950">
                INR {consolidatedReport.companyReportingSummary.totalReleasedBudgetReporting.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Avg Approval Ageing
              </span>
              <span className="text-lg font-mono font-bold text-slate-900">
                {consolidatedReport.averageApprovalAgeingDays} Days
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="p-2.5">Tx Currency</th>
                  <th className="p-2.5 text-right">PR Count</th>
                  <th className="p-2.5 text-right">Original PR Value</th>
                  <th className="p-2.5 text-right">Approved Value</th>
                  <th className="p-2.5 text-right">RFQ Converted</th>
                  <th className="p-2.5 text-right">PO Converted</th>
                  <th className="p-2.5 text-right">Short Closed</th>
                  <th className="p-2.5 text-right">Cancelled</th>
                  <th className="p-2.5 text-right">Reserved Budget</th>
                  <th className="p-2.5 text-right">Released Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currencyReportGrid.pagedData.map((m) => (
                  <tr key={m.currency} className="hover:bg-slate-50 font-mono">
                    <td className="p-2.5 font-bold text-indigo-700">{m.currency}</td>
                    <td className="p-2.5 text-right font-bold">{m.prCount}</td>
                    <td className="p-2.5 text-right">{m.originalPrValue.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right text-emerald-700">
                      {m.approvedValue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2.5 text-right">{m.rfqConvertedValue.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right">{m.poConvertedValue.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right text-amber-700">
                      {m.shortClosedValue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2.5 text-right text-rose-700">
                      {m.cancelledValue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2.5 text-right font-bold">
                      {m.reservedBudget.toLocaleString('en-IN')}
                    </td>
                    <td className="p-2.5 text-right font-bold text-emerald-700">
                      {m.releasedBudget.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataGridFooter
            currentPage={currencyReportGrid.currentPage}
            totalPages={currencyReportGrid.totalPages}
            pageSize={currencyReportGrid.pageSize}
            totalRecords={currencyReportGrid.totalRecords}
            onPageChange={currencyReportGrid.setCurrentPage}
            onPageSizeChange={currencyReportGrid.setPageSize}
            pageSizeOptions={currencyReportGrid.pageSizeOptions}
            defaultSortNotice="Highest Value Currencies First (DESC)"
          />
        </div>
      )}

      {/* SECTION 17: PART K — INVENTORY AVAILABILITY & CROSS-BRANCH GOVERNANCE POLICY */}
      {shouldRenderSection('inventory-validation-partk') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>Part K — Inventory Availability, Cross-Branch & Stage Revalidation Policy</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hierarchy: Company → Branch → Warehouse → Item Category → Item (lower scopes cannot weaken restrictive company rules). Active Version: v{partKPolicy.version}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePartKPolicy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Part K Inventory Policy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Warehouse Scope</label>
              <select
                value={partKWarehouseCode}
                onChange={(e) => setPartKWarehouseCode(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="ALL">All Branch Warehouses</option>
                {partKAvailableWarehouses.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Item Category Scope</label>
              <select
                value={partKCategory}
                onChange={(e) => setPartKCategory(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="ALL">All Item Categories</option>
                <option value="Raw Materials">Raw Materials</option>
                <option value="Consumables">Consumables</option>
                <option value="Spare Parts">Spare Parts</option>
                <option value="Chemicals & Adhesives">Chemicals & Adhesives</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Specific Item Code (or ALL)</label>
              <input
                type="text"
                value={partKItemCode}
                onChange={(e) => setPartKItemCode(e.target.value || 'ALL')}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                placeholder="ALL"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-bold text-slate-900">Enable Inventory Validation</div>
                <div className="text-[11px] text-slate-500">Disabled policies never block PR creation or approval.</div>
              </div>
              <input
                type="checkbox"
                checked={partKPolicy.isEnabled}
                onChange={(e) => setPartKPolicy({ ...partKPolicy, isEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-600"
              />
            </label>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Enforcement Mode</label>
              <select
                value={partKPolicy.enforcementMode}
                onChange={(e) =>
                  setPartKPolicy({
                    ...partKPolicy,
                    enforcementMode: e.target.value as InventoryEnforcementMode,
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="INFORMATION_ONLY">1. Information Only</option>
                <option value="WARNING">2. Warning (Allow with Justification)</option>
                <option value="BLOCK_APPROVAL">3. Block Approval</option>
                <option value="REQUIRE_EXCEPTION_APPROVAL">4. Require Authorized Exception Approval</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Cross-Branch Usability Mode</label>
              <select
                value={partKPolicy.crossBranchUsability || 'VISIBILITY_ONLY'}
                onChange={(e) =>
                  setPartKPolicy({
                    ...partKPolicy,
                    crossBranchUsability: e.target.value as CrossBranchUsabilityMode,
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="DISABLED">DISABLED (Local Branch Only)</option>
                <option value="VISIBILITY_ONLY">VISIBILITY_ONLY (Default — Visible, Not Locally Usable)</option>
                <option value="TRANSFER_REQUIRED">TRANSFER_REQUIRED (Formal Stock Transfer Needed)</option>
                <option value="AUTHORIZED_EXCEPTION">AUTHORIZED_EXCEPTION (Maker-Checker Exception)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Validation Stage</label>
              <select
                value={partKPolicy.validationStage}
                onChange={(e) =>
                  setPartKPolicy({
                    ...partKPolicy,
                    validationStage: e.target.value as InventoryValidationStage,
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="ON_PR_CREATION">On PR Creation</option>
                <option value="ON_PR_SUBMISSION">On PR Submission</option>
                <option value="ON_PR_APPROVAL">On PR Approval</option>
                <option value="ON_BUYER_ASSIGNMENT">On Buyer Assignment</option>
                <option value="ON_RFQ_CREATION">On RFQ Creation</option>
                <option value="ON_RFQ_AWARD">On RFQ Award</option>
                <option value="ON_PO_CREATION">On PO Creation</option>
                <option value="ON_PO_RELEASE">On PO Release</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Available Stock Formula</label>
              <select
                value={partKPolicy.availableStockCalculation}
                onChange={(e) =>
                  setPartKPolicy({
                    ...partKPolicy,
                    availableStockCalculation: e.target.value as AvailableStockCalculationMode,
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="PHYSICAL_MINUS_RESERVED">Physical - Reserved</option>
                <option value="PHYSICAL_MINUS_RESERVED_ALLOCATED">Physical - Reserved - Allocated</option>
                <option value="EXPECTED_WITH_INCOMING">Available + Incoming Stock</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Near-Expiry Warning Window (Days)</label>
              <input
                type="number"
                min={1}
                value={partKPolicy.nearExpiryThresholdDays ?? 30}
                onChange={(e) =>
                  setPartKPolicy({
                    ...partKPolicy,
                    nearExpiryThresholdDays: Number(e.target.value) || 30,
                  })
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {([
              ['considerReservedStock', 'Deduct Reserved Stock'],
              ['considerAllocatedStock', 'Deduct Allocated Stock'],
              ['considerIncomingStock', 'Show Incoming Stock'],
              ['crossBranchVisibilityEnabled', 'Enable Cross-Branch Visibility'],
              ['includeQualityInspectionStock', 'Include QC Inspection Stock'],
              ['includeBlockedStock', 'Include Blocked Stock'],
              ['includeRejectedStock', 'Include Rejected Stock'],
              ['excludeExpiredStock', 'Exclude Expired Batches'],
            ] as const).map(([key, label]) => (
              <label
                key={key}
                className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean((partKPolicy as any)[key])}
                  onChange={(e) => setPartKPolicy({ ...partKPolicy, [key]: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="text-[11px] font-bold text-slate-700">
              Active Stage-Gated Revalidation Checkpoints (All 8 Lifecycle Gates):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['ON_PR_CREATION', '1. PR Creation'],
                ['ON_PR_SUBMISSION', '2. PR Submission'],
                ['ON_PR_APPROVAL', '3. PR Approval'],
                ['ON_BUYER_ASSIGNMENT', '4. Buyer Assignment'],
                ['ON_RFQ_CREATION', '5. RFQ Creation'],
                ['ON_RFQ_AWARD', '6. RFQ Award'],
                ['ON_PO_CREATION', '7. PO Creation'],
                ['ON_PO_RELEASE', '8. PO Release'],
              ] as Array<[InventoryValidationStage, string]>).map(([stageKey, stageLabel]) => {
                const active = (partKPolicy.revalidationStages || []).includes(stageKey);
                return (
                  <label
                    key={stageKey}
                    className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer text-[11px] font-bold ${
                      active ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => {
                        const existing = partKPolicy.revalidationStages || [];
                        const next = e.target.checked
                          ? Array.from(new Set([...existing, stageKey]))
                          : existing.filter((s) => s !== stageKey);
                        setPartKPolicy({ ...partKPolicy, revalidationStages: next });
                      }}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span>{stageLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 18: PR TYPE MASTER & ELIGIBILITY MAPPING                      */}
      {/* ===================================================================== */}
      {shouldRenderSection('pr-type-master') && (
        <PrTypeMasterPanel
          currentUser={currentUser}
          companies={companies}
          branches={branches}
        />
      )}

      {shouldRenderSection('charge-item-mapping') && (
        <ChargeItemMappingView
          currentUser={currentUser}
          companies={companies}
          branches={branches}
          initialCompanyId={selectedCompanyId}
          initialBranchId={selectedBranchId}
          embeddedInPrConfig
        />
      )}

      {/* EFFECTIVE POLICY PREVIEW MODAL */}
      {showEffectivePreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-indigo-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>
                    Effective PR Governance Policy — {effectivePolicy.companyCode} /{' '}
                    {effectivePolicy.branchName}
                  </span>
                </h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Resolution Source: {effectivePolicy.resolutionSource} • Policy Version:{' '}
                  {effectivePolicy.policyVersion} • Effective From: {effectivePolicy.effectiveFrom}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEffectivePreviewModal(false)}
                className="text-slate-300 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACTIVATION_FIELD_METADATA.map((m) => {
                  const val = effectivePolicy.activation[m.key];
                  return (
                    <div
                      key={m.key}
                      className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between"
                    >
                      <span className="font-bold text-slate-700">{m.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          val
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {val ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEffectivePreviewModal(false)}
                className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
