/**
 * CIPPLATFORM - PURCHASE REQUISITION CREATION MODAL
 * Phase 1 PR Module: Handles creation across MRP, Manual, Repair, and Maintenance with inventory UOM lock, duplicate warning, and mandatory budget validation.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { User, Branch, Department, GlobalItem } from '../../types';
import { INITIAL_BRANCHES, INITIAL_GLOBAL_ITEMS } from '../../data/seedData';
import {
  PRType,
  PRPriority,
  PurchaseRequisitionHeader,
  PurchaseRequisitionLine,
  ExpensePrLineRecord,
  PRChargeItem,
  PRChargeApplicability,
  PRChargeType,
} from '../../types/purchaseRequisition';
import { EffectiveMappedChargeOption } from '../../types/chargeManagement';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { BuyerService } from '../../services/buyerService';
import { BuyerAssignmentRecord } from '../../types/buyerAssignment';
import { getBranchActiveItems } from '../../utils/branchItemHelper';
import { isValidIsoDate } from '../../services/prGridConfigService';
import { prGovernancePolicyService, normalizeCompanyId } from '../../services/prGovernancePolicyService';
import { prTypeMasterService, normalizeItemCategoryCode } from '../../services/prTypeMasterService';
import { expenseCategoryService } from '../../services/expenseCategoryService';
import { costCentreMasterService } from '../../services/costCentreMasterService';
import {
  calculateExpensePrLine,
  calculateExpensePrFinancials,
  calculateInventoryPrFinancials,
} from '../../services/prFinancialCalculator';
import { budgetControlService } from '../../services/budgetControlService';
import { prGovernanceBackendClient } from '../../services/prGovernanceBackendClient';
import { prChargeItemService, formatChargeAmount, getCurrencySymbol } from '../../services/prChargeItemService';
import { PrMappedChargesSelector } from './PrMappedChargesSelector';
import { prDuplicateGovernanceService } from '../../services/prDuplicateGovernanceService';
import { DuplicatePrGovernancePanel } from './DuplicatePrGovernancePanel';
import { EnterpriseModal } from '../../components/EnterpriseModal';
import { useViewportAndOrientation } from '../../components/ResponsiveWorkspace';
import { X, Plus, Trash2, AlertTriangle, CheckCircle2, ShieldCheck, Box, Maximize2, Minimize2, Building2, MapPin, Warehouse, Paperclip, Eye, Download, Upload, FileText, Lock, Search, Calendar, Coins } from 'lucide-react';

interface PurchaseCreationModalProps {
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const PurchaseCreationModal: React.FC<PurchaseCreationModalProps> = ({
  currentUser,
  onClose,
  onSuccess,
}) => {
  const { isDesktop } = useViewportAndOrientation();
  // 1. Company selection state
  const companies = [
    { id: 'KOSH-HQ', code: 'KOSH_INNOVATIONS', name: 'Kosh Innovations Pvt Ltd (KOSH-HQ)' },
    { id: 'KOSH-AUTO', code: 'KOSH_AUTO', name: 'Kosh Automotive Division (KOSH-AUTO)' },
    { id: 'KOSH-TOOL', code: 'KOSH_TOOL', name: 'Kosh Precision Tooling Ltd (KOSH-TOOL)' },
  ];
  const [selectedCompanyId, setSelectedCompanyId] = useState(currentUser.orgId || 'KOSH-HQ');
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // 2. Load branch and departments available under the selected branch
  const availableBranches: Branch[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('kosh_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_BRANCHES;
  }, []);

  const companyBranches: Branch[] = useMemo(() => {
    const normComp = normalizeCompanyId(selectedCompany.id);
    const filtered = availableBranches.filter(
      (b) => b.companyId === normComp || b.companyId === selectedCompany.id
    );
    return filtered.length > 0 ? filtered : availableBranches;
  }, [availableBranches, selectedCompany.id]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentUser.allowedBranchIds?.[0] || availableBranches[0]?.id || 'br-pond-01'
  );

  useEffect(() => {
    const isCurrentBranchValid = companyBranches.some(
      (b) => b.id === selectedBranchId || b.portalBranchCode === selectedBranchId
    );
    if (!isCurrentBranchValid && companyBranches[0]) {
      setSelectedBranchId(companyBranches[0].id);
    }
  }, [companyBranches, selectedBranchId]);

  const targetBranch = useMemo(() => {
    return (
      companyBranches.find(
        (b) => b.id === selectedBranchId || b.portalBranchCode === selectedBranchId
      ) ||
      availableBranches.find(
        (b) => b.id === selectedBranchId || b.portalBranchCode === selectedBranchId
      ) ||
      availableBranches[0]
    );
  }, [availableBranches, companyBranches, selectedBranchId]);

  // Real-time Governance Policy Synchronization
  const [governanceTick, setGovernanceTick] = useState(0);

  useEffect(() => {
    prTypeMasterService.ensureExpensePrTypeRegistered();
    const handlePolicyUpdate = () => {
      setGovernanceTick((t) => t + 1);
    };
    window.addEventListener('cip-pr-governance-updated', handlePolicyUpdate);
    return () => window.removeEventListener('cip-pr-governance-updated', handlePolicyUpdate);
  }, []);

  // Load all items & filter active items for selected branch
  const allGlobalItems: GlobalItem[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('kosh_global_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_GLOBAL_ITEMS;
  }, []);

  const branchAvailableItems: GlobalItem[] = useMemo(() => {
    const activeForBranch = getBranchActiveItems(allGlobalItems, targetBranch);
    if (activeForBranch.length > 0) return activeForBranch;
    return allGlobalItems;
  }, [allGlobalItems, targetBranch]);

  const activeDepartments: Department[] = useMemo(() => {
    return (targetBranch?.departments || []).filter((d) => d.status === 'ACTIVE');
  }, [targetBranch]);

  const [department, setDepartment] = useState<string>(() => {
    return activeDepartments[0]?.departmentName || 'Production & Plant Operations';
  });

  useEffect(() => {
    if (
      activeDepartments.length > 0 &&
      !activeDepartments.some((d) => d.departmentName === department)
    ) {
      setDepartment(activeDepartments[0].departmentName);
    }
  }, [activeDepartments, department]);

  // Automatic Cost Centre Determination from Company, Branch, Department & Employee Default Mapping
  const costCentreDetermination = useMemo(
    () =>
      costCentreMasterService.resolveCostCentresForContext({
        companyId: selectedCompany.id,
        branchId: targetBranch?.id || 'ALL',
        department,
        userId: currentUser.id,
      }),
    [selectedCompany.id, targetBranch?.id, department, currentUser.id, governanceTick]
  );

  // Helper: Default warehouse resolution based on item code, category & selected branch
  const getDefaultWarehouse = (itemCode: string, category: string): string => {
    const branchPrefix = targetBranch?.shortName || targetBranch?.name.split(' ')[0] || 'Main';
    const codeUpper = itemCode.toUpperCase();
    const catUpper = category.toUpperCase();

    if (codeUpper.startsWith('RM') || catUpper.includes('RAW')) {
      return `WH-RM-01 (${branchPrefix} Central Raw Material Store)`;
    } else if (codeUpper.startsWith('SPARE') || catUpper.includes('SPARE') || catUpper.includes('MECHANICAL')) {
      return `WH-SPARE-02 (${branchPrefix} Maintenance & Spares Bay)`;
    } else if (codeUpper.startsWith('FG') || catUpper.includes('FINISHED')) {
      return `WH-FG-01 (${branchPrefix} Finished Goods Warehouse)`;
    }
    return `WH-GEN-01 (${branchPrefix} General Inventory Bay)`;
  };

  // Typeable Search Autocomplete Combobox state
  const [openSearchIdx, setOpenSearchIdx] = useState<number | null>(null);
  const [searchTermMap, setSearchTermMap] = useState<{ [key: number]: string }>({});

  // Resolve effective Company & Branch PR Governance Policy
  const effectiveGovernancePolicy = useMemo(
    () => prGovernancePolicyService.getEffectivePolicy(selectedCompany.id, targetBranch?.id),
    [selectedCompany.id, targetBranch?.id, governanceTick]
  );

  const isDeliveryDateEnabled =
    effectiveGovernancePolicy.activation?.expectedDeliveryDateEnabled !== false;
  const isDeliveryDateMandatory =
    isDeliveryDateEnabled &&
    Boolean(effectiveGovernancePolicy.activation?.expectedDeliveryDateMandatory);

  // 3. PR Type based on genuine PR Type Master, User RBAC, Eligibility Mapping, and Governance Policy
  const allowedPrTypes: Array<{ value: PRType; label: string }> = useMemo(() => {
    prTypeMasterService.ensureExpensePrTypeRegistered();
    const role = currentUser.role || 'REQUESTER';
    const act = effectiveGovernancePolicy.activation;
    if (!act.prModuleEnabled) return [];

    const legacyRoleAllowMap: Record<string, string[]> = {
      MANUAL: [],
      MRP: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'PROCUREMENT_MANAGER'],
      REPAIR: [],
      MAINTENANCE: [
        'PLATFORM_ADMIN',
        'ORG_ADMIN',
        'BRANCH_ADMIN',
        'PROCUREMENT_MANAGER',
        'DEPARTMENT_HEAD',
        'PLANT_ENGINEER',
        'MAINTENANCE_SUPERVISOR',
      ],
      CAPEX_ASSET: [],
      EXPENSE: [],
    };

    return prTypeMasterService
      .getPrTypes()
      .filter((prt) => {
        if (prt.status !== 'ACTIVE' || prt.approvalStatus !== 'APPROVED') return false;
        const code = prt.code as PRType;
        // Governance activation toggle check
        if (code === 'MANUAL' && !act.manualPrCreationEnabled) return false;
        if (code === 'MRP' && !act.mrpPrCreationEnabled) return false;
        if (code === 'REPAIR' && !act.repairPrEnabled) return false;
        if (code === 'MAINTENANCE' && !act.maintenancePrEnabled) return false;
        if (code === 'CAPEX_ASSET' && !act.capexAssetPrEnabled) return false;
        if (code === 'EXPENSE' && act.expensePrEnabled === false) return false;

        // Role check (PR Type Master explicit roles or legacy defaults)
        const roleGate =
          prt.allowedRoles && prt.allowedRoles.length > 0
            ? prt.allowedRoles
            : legacyRoleAllowMap[code] || [];
        if (roleGate.length > 0 && !roleGate.includes(role)) return false;

        // Company / Branch / Category eligibility check (at context level: itemCategoryCode='ALL')
        const evalRes = prTypeMasterService.evaluatePrTypeEligibility({
          companyId: selectedCompany.id,
          branchId: targetBranch?.id || 'ALL',
          itemCategoryCode: 'ALL',
          prTypeCode: code,
          userRole: role,
        });
        return evalRes.eligible;
      })
      .map((prt) => ({ value: prt.code as PRType, label: prt.name }));
  }, [currentUser.role, effectiveGovernancePolicy, selectedCompany.id, targetBranch?.id]);

  const [prType, setPrType] = useState<PRType>(() => allowedPrTypes[0]?.value || 'MANUAL');
  const isExpensePr = prType === 'EXPENSE';

  // Track whether user explicitly modified inventory lines/charges or expense lines to enforce non-destructive dynamic PR Type switching
  const [inventoryUserModified, setInventoryUserModified] = useState(false);
  const [expenseUserModified, setExpenseUserModified] = useState(false);

  useEffect(() => {
    if (allowedPrTypes.length > 0 && !allowedPrTypes.some((t) => t.value === prType)) {
      setPrType(allowedPrTypes[0].value);
    }
  }, [allowedPrTypes, prType]);

  const [priority, setPriority] = useState<PRPriority>('NORMAL');
  const [currency, setCurrency] = useState<string>('INR');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState('Hosur Plant Store - Bay 2');
  const [costCentre, setCostCentre] = useState<string>(
    () => costCentreDetermination.defaultCostCentreCode || ''
  );
  const [equipmentId, setEquipmentId] = useState('');

  // Conditional Budget Validation flag (must be ON in BOTH activation and budget sections)
  const isBudgetEnabled = Boolean(
    effectiveGovernancePolicy.activation?.budgetValidationEnabled &&
      effectiveGovernancePolicy.budget?.enableBudgetValidation
  );

  // Eligible item categories for active Company, Branch, PR Type & User Role (never hardcoded)
  const eligibleCategories = useMemo(
    () =>
      prTypeMasterService.getEligibleCategoriesForContext({
        companyId: selectedCompany.id,
        branchId: targetBranch?.id || 'ALL',
        prTypeCode: prType,
        userRole: currentUser.role,
      }),
    [selectedCompany.id, targetBranch?.id, prType, currentUser.role, governanceTick]
  );

  // Eligible Expense Categories (with SAP Expense GL Accounts) for EXPENSE PR Type
  const eligibleExpenseCategories = useMemo(
    () =>
      expenseCategoryService.getEligibleExpenseCategories(
        selectedCompany.id,
        targetBranch?.id || 'ALL'
      ),
    [selectedCompany.id, targetBranch?.id, governanceTick]
  );

  const eligibleCategoryCodesSet = useMemo(
    () => new Set(eligibleCategories.map((c) => c.code)),
    [eligibleCategories]
  );

  const prTypeBranchItems: GlobalItem[] = useMemo(() => {
    return branchAvailableItems.filter((item) => {
      const normCat = normalizeItemCategoryCode(item.categoryCode || 'OT');
      return eligibleCategoryCodesSet.has(normCat);
    });
  }, [branchAvailableItems, eligibleCategoryCodesSet]);

  // Clear delivery date when policy disables it
  useEffect(() => {
    if (!isDeliveryDateEnabled) {
      setExpectedDeliveryDate('');
    }
  }, [isDeliveryDateEnabled]);

  // Expanded Text Pop-up Editor state for Double-Click
  const [expandedEditor, setExpandedEditor] = useState<{
    lineIdx: number;
    field: 'purchasePurpose' | 'businessJustification';
    title: string;
    itemCode: string;
    value: string;
  } | null>(null);

  // Expanded Item Code Editor Modal state
  const [expandedItemEditorIdx, setExpandedItemEditorIdx] = useState<number | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Line File Attachments Modal State
  const [activeAttachmentLineIdx, setActiveAttachmentLineIdx] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    fileName: string;
    fileSize: string;
    fileType: string;
    uploadedAt: string;
  } | null>(null);

  // Line Charge Items Modal State
  const [activeChargeLineIdx, setActiveChargeLineIdx] = useState<number | null>(null);
  const [lineChargeSelectorError, setLineChargeSelectorError] = useState<string | null>(null);

  // Initial Item Selection from Branch Item Master filtered by active PR Type categories
  const firstMasterItem = prTypeBranchItems[0] || branchAvailableItems[0] || {
    globalItemCode: 'RMPAOPOEXLG0001',
    description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    categoryCode: 'RM',
    inventoryUom: 'KG'
  };

  // 4. Item lines state: Auto-driven by Branch Item Master (No manual text entry for Item Code, Description, or Warehouse)
  const [lines, setLines] = useState<Array<{
    id?: string;
    itemCode: string;
    description: string;
    itemCategory: string;
    inventoryUom: string;
    requestedQuantity: number;
    approximateUnitPrice: number;
    specifications: string;
    purchasePurpose: string;
    businessJustification: string;
    defaultWarehouse: string;
    assignedBuyer: BuyerAssignmentRecord | null;
    deliverySchedules: Array<{
      id: string;
      deliveryDate: string;
      quantity: number;
    }>;
    lineAttachments: Array<{
      id: string;
      fileName: string;
      fileSize: string;
      fileType: string;
      uploadedAt: string;
    }>;
    lineCharges?: PRChargeItem[];
  }>>([
    {
      id: 'draft-line-1',
      itemCode: firstMasterItem.globalItemCode,
      description: firstMasterItem.description,
      itemCategory: firstMasterItem.categoryCode || 'Raw Materials',
      inventoryUom: firstMasterItem.inventoryUom || 'KG', // LOCKED TO ITEM MASTER
      requestedQuantity: 200,
      approximateUnitPrice: 150,
      specifications: 'IS 2062 Gr E250',
      purchasePurpose: 'Structural fabrication for Q3 assembly line expansion',
      businessJustification: 'Required to meet peak production schedule for EV chassis frames',
      defaultWarehouse: getDefaultWarehouse(firstMasterItem.globalItemCode, firstMasterItem.categoryCode || 'Raw Materials'),
      assignedBuyer: BuyerService.getDefaultBuyer(selectedCompany.id, targetBranch.id, firstMasterItem.categoryCode || 'Raw Materials') || null,
      deliverySchedules: [
        { id: 'sch-1', deliveryDate: '2026-11-20', quantity: 100 },
        { id: 'sch-2', deliveryDate: '2026-12-05', quantity: 100 }
      ],
      lineAttachments: [
        {
          id: 'att-101',
          fileName: 'IS2062_Gr_E250_Steel_Plate_Spec.pdf',
          fileSize: '1.4 MB',
          fileType: 'PDF Document',
          uploadedAt: '2026-11-05 10:15'
        },
        {
          id: 'att-102',
          fileName: 'Q3_Assembly_Line_CAD_Drawing_v2.png',
          fileSize: '2.8 MB',
          fileType: 'Image/Drawing',
          uploadedAt: '2026-11-05 10:20'
        }
      ],
      lineCharges: [],
    }
  ]);

  // 4b. Governed Expense Lines State for EXPENSE PR Type (Non-Inventory Services & Operational Expenses)
  const [expenseLines, setExpenseLines] = useState<ExpensePrLineRecord[]>(() => {
    const defaultCat = eligibleExpenseCategories[0] || {
      categoryCode: 'EXP-CONS',
      categoryName: 'Consultancy Charges',
      sapGlAccountCode: '610100',
      sapGlAccountName: 'Consultancy & Advisory Expense',
      defaultTaxCode: 'GST18',
      defaultTaxPercent: 18,
    };
    const calc = calculateExpensePrLine({
      amount: 50000,
      taxPercent: defaultCat.defaultTaxPercent ?? 18,
      isTaxInclusive: false,
    });
    const resolvedCc = costCentreDetermination.defaultCostCentreCode || '';
    const resolvedCcObj = costCentreDetermination.eligibleCostCentres.find(
      (c) => c.code === resolvedCc
    );
    return [
      {
        id: 'exp-line-1',
        prId: '',
        lineNumber: 1,
        expenseCategoryCode: defaultCat.categoryCode,
        expenseCategoryName: defaultCat.categoryName,
        description: 'ISO 27001 & Cybersecurity Compliance Advisory Services',
        expenseDescription: 'ISO 27001 & Cybersecurity Compliance Advisory Services',
        costCentre: resolvedCc,
        costCenter: resolvedCc,
        sapCostCenterCode: resolvedCcObj?.sapCostCenterCode || resolvedCc,
        department,
        serviceFromDate: '2026-11-20',
        serviceToDate: '2026-11-30',
        expectedServiceDate: '2026-11-30',
        amount: 50000,
        currency: 'INR',
        taxCode: defaultCat.defaultTaxCode || 'GST18',
        taxPercent: defaultCat.defaultTaxPercent ?? 18,
        taxRatePercent: defaultCat.defaultTaxPercent ?? 18,
        isTaxInclusive: false,
        baseAmount: calc.baseAmount,
        taxAmount: calc.taxAmount,
        totalWithTax: calc.totalWithTax,
        totalAmountWithTax: calc.totalWithTax,
        sapGlAccountCode: defaultCat.sapGlAccountCode,
        sapGlAccountName: defaultCat.sapGlAccountName,
        vendorSuggestion: 'KPMG Advisory Services Pvt Ltd',
        purchasePurpose: 'Annual cybersecurity & IT governance audit advisory',
        businessJustification: 'Mandatory statutory & client security compliance requirement for FY 2026-27',
        lineAttachments: [
          {
            id: 'exp-att-1',
            fileName: 'Consultancy_SOW_Proposal_FY26.pdf',
            fileSize: '1.1 MB',
            fileType: 'PDF Document',
            uploadedAt: '2026-11-10 09:30',
          },
        ],
        status: 'ACTIVE',
      },
    ];
  });

  // Synchronize determined Cost Centre whenever Company, Branch, Department, or Employee context changes
  useEffect(() => {
    const nextDefaultCc = costCentreDetermination.valid
      ? costCentreDetermination.defaultCostCentreCode
      : '';
    setCostCentre(nextDefaultCc);
    setExpenseLines((prev) =>
      prev.map((el) => {
        if (!costCentreDetermination.valid) {
          return {
            ...el,
            costCentre: '',
            costCenter: '',
            sapCostCenterCode: undefined,
            department,
          };
        }
        const stillValid = costCentreDetermination.eligibleCostCentres.find(
          (c) => c.code === el.costCentre
        );
        const targetCcObj =
          stillValid ||
          costCentreDetermination.eligibleCostCentres.find((c) => c.code === nextDefaultCc) ||
          costCentreDetermination.eligibleCostCentres[0];
        const targetCode = targetCcObj?.code || '';
        return {
          ...el,
          costCentre: targetCode,
          costCenter: targetCode,
          sapCostCenterCode: targetCcObj?.sapCostCenterCode || targetCode,
          department,
        };
      })
    );
  }, [costCentreDetermination, department]);

  const [budgetStatus, setBudgetStatus] = useState<'NOT_VALIDATED' | 'SUFFICIENT' | 'INSUFFICIENT'>('NOT_VALIDATED');
  const [budgetCheckMessage, setBudgetCheckMessage] = useState<string | null>(null);

  // Dynamic revalidation of existing lines whenever PR Type, Company, Branch, or lines change (NEVER deletes lines)
  const categoryValidationResult = useMemo(() => {
    if (isExpensePr) {
      const prTypeEval = prTypeMasterService.evaluatePrTypeEligibility({
        companyId: selectedCompany.id,
        branchId: targetBranch?.id || 'ALL',
        itemCategoryCode: 'ALL',
        prTypeCode: 'EXPENSE',
        userRole: currentUser.role,
      });
      const retainedInvalidInventoryLines = inventoryUserModified
        ? lines.map((l, idx) => ({
            lineIndex: idx,
            lineId: l.id || `draft-line-${idx + 1}`,
            itemCode: l.itemCode,
            rawCategory: l.itemCategory,
            normalizedCategory: l.itemCategory,
            reason: `Retained Inventory Line #${idx + 1} (${l.itemCode}) is incompatible with PR Type 'EXPENSE'. Clear retained inventory lines or switch back to an Inventory PR Type.`,
          }))
        : [];
      return {
        valid: prTypeEval.eligible && retainedInvalidInventoryLines.length === 0,
        prTypeEligible: prTypeEval.eligible,
        prTypeReason: prTypeEval.eligible ? undefined : prTypeEval.reason,
        eligibleCategories,
        invalidLines: retainedInvalidInventoryLines,
      };
    }
    return prTypeMasterService.validateLinesCategoriesForPrType({
      companyId: selectedCompany.id,
      branchId: targetBranch?.id || 'ALL',
      prTypeCode: prType,
      lines: lines.map((l, idx) => ({
        id: l.id || `draft-line-${idx + 1}`,
        itemCode: l.itemCode,
        itemCategory: l.itemCategory,
      })),
      userRole: currentUser.role,
    });
  }, [
    isExpensePr,
    inventoryUserModified,
    selectedCompany.id,
    targetBranch?.id,
    prType,
    lines,
    eligibleCategories,
    currentUser.role,
    governanceTick,
  ]);

  const invalidLineMap = useMemo(() => {
    const map = new Map<number, { rawCategory: string; reason: string }>();
    for (const bad of categoryValidationResult.invalidLines) {
      map.set(bad.lineIndex, { rawCategory: bad.rawCategory, reason: bad.reason });
    }
    return map;
  }, [categoryValidationResult]);

  // Expense line validation & classification conflict check
  const expenseLinesValidation = useMemo(() => {
    if (!isExpensePr) {
      return {
        valid: !expenseUserModified,
        errors: expenseUserModified
          ? [
              'Retained Expense Lines exist while an Inventory PR Type is selected. Clear retained Expense Lines or switch back to EXPENSE PR Type.',
            ]
          : [],
        lineErrors: {} as Record<number, string[]>,
      };
    }
    return expenseCategoryService.validateExpenseLinesForPr({
      companyId: selectedCompany.id,
      branchId: targetBranch?.id || 'ALL',
      department,
      userId: currentUser.id,
      expenseLines: expenseLines.map((el) => ({
        id: el.id,
        expenseCategoryCode: el.expenseCategoryCode,
        expenseDescription: el.expenseDescription || el.description,
        costCentre: el.costCentre,
        department,
        serviceFromDate: el.serviceFromDate,
        serviceToDate: el.serviceToDate,
        expectedServiceDate: el.expectedServiceDate,
        amount: el.amount,
        taxPercent: el.taxPercent ?? el.taxRatePercent,
        isTaxInclusive: el.isTaxInclusive ?? el.taxInclusive,
        sapGlAccountCode: el.sapGlAccountCode,
        purchasePurpose: el.purchasePurpose,
        businessJustification: el.businessJustification,
      })),
    });
  }, [
    isExpensePr,
    expenseUserModified,
    selectedCompany.id,
    targetBranch?.id,
    department,
    currentUser.id,
    expenseLines,
    costCentre,
  ]);

  const draftSessionStorageKey = `kosh_pr_creation_draft_key_${currentUser.id}`;
  const [draftKey] = useState<string>(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const existing = sessionStorage.getItem(draftSessionStorageKey);
        if (existing) return existing;
        const fresh = `pr-draft-${currentUser.id}-${Date.now()}`;
        sessionStorage.setItem(draftSessionStorageKey, fresh);
        return fresh;
      }
    } catch {}
    return `pr-draft-${currentUser.id}-${Date.now()}`;
  });
  const [dupRefreshTick, setDupRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    void prDuplicateGovernanceService.hydrateFromBackend().then(() => {
      if (active) setDupRefreshTick((t) => t + 1);
    });
    const onPrsUpdated = () => {
      if (active) setDupRefreshTick((t) => t + 1);
    };
    window.addEventListener('cip-prs-updated', onPrsUpdated);
    return () => {
      active = false;
      window.removeEventListener('cip-prs-updated', onPrsUpdated);
    };
  }, []);

  const duplicateLinesInput = useMemo(
    () =>
      isExpensePr
        ? []
        : lines.map((l, idx) => ({
            id: l.id || `draft-line-${idx + 1}`,
            itemCode: l.itemCode,
            description: l.description,
            requestedQuantity: Number(l.requestedQuantity) || 0,
            inventoryUom: l.inventoryUom,
            purchasePurpose: l.purchasePurpose,
          })),
    [isExpensePr, lines]
  );

  const duplicateSnapshot = useMemo(
    () =>
      prDuplicateGovernanceService.evaluateDuplicateConditions({
        draftKey,
        companyId: selectedCompany.id,
        branchId: targetBranch.id,
        requesterId: currentUser.id,
        purchasePurpose: isExpensePr ? expenseLines[0]?.purchasePurpose : lines[0]?.purchasePurpose,
        expectedDeliveryDate: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
        lines: duplicateLinesInput,
        actorUser: currentUser,
      }),
    [
      draftKey,
      selectedCompany.id,
      targetBranch.id,
      currentUser,
      isExpensePr,
      expenseLines,
      lines,
      duplicateLinesInput,
      isDeliveryDateEnabled,
      expectedDeliveryDate,
      governanceTick,
      dupRefreshTick,
    ]
  );

  const expenseFinancials = useMemo(
    () =>
      calculateExpensePrFinancials(
        expenseLines.map((el) => ({
          amount: el.amount,
          taxPercent: el.taxPercent,
          isTaxInclusive: el.isTaxInclusive,
        }))
      ),
    [expenseLines]
  );

  const totalEstimatedValue = isExpensePr
    ? expenseFinancials.expenseBaseTotal
    : lines.reduce((acc, l) => acc + l.requestedQuantity * l.approximateUnitPrice, 0);

  // Dedicated Tab for Item Lines vs Charge Items (Charge Items tab is hidden for EXPENSE PRs)
  const [activeTab, setActiveTab] = useState<'LINES' | 'CHARGES'>('LINES');

  useEffect(() => {
    if (isExpensePr && activeTab === 'CHARGES') {
      setActiveTab('LINES');
    }
  }, [isExpensePr, activeTab]);

  // Effective Mapped Charges for active Company, Branch & PR Type scope
  const effectiveMappedCharges = useMemo(
    () =>
      prChargeItemService.getEffectiveMappedChargesForPR(
        selectedCompany.id,
        targetBranch.id,
        prType
      ),
    [selectedCompany.id, targetBranch.id, prType, governanceTick]
  );

  const [chargeSelectorError, setChargeSelectorError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);

  // Charge Items State: auto-populated strictly from Company/Branch Mandatory mapped charges
  const [chargeItems, setChargeItems] = useState<PRChargeItem[]>(() => {
    const initialMapped = prChargeItemService.getEffectiveMappedChargesForPR(
      selectedCompany.id,
      targetBranch.id,
      'MANUAL'
    );
    return initialMapped
      .filter((opt: EffectiveMappedChargeOption) => opt.applicability === 'MANDATORY')
      .map((opt: EffectiveMappedChargeOption) =>
        prChargeItemService.createPrChargeFromMappedOption(opt, 30000, 'INR')
      );
  });

  // Synchronize charge items when Company or Branch changes: retain valid mapped items and enforce mandatory charges
  useEffect(() => {
    if (isExpensePr) return;
    const mappedByCode = new Map(
      effectiveMappedCharges.map((opt: EffectiveMappedChargeOption) => [opt.chargeCode.toUpperCase(), opt])
    );
    setChargeItems((prev) => {
      const retained = prev.filter((item) => mappedByCode.has(item.chargeCode.toUpperCase()));
      let next = retained;
      for (const opt of effectiveMappedCharges) {
        if (
          opt.applicability === 'MANDATORY' &&
          !next.some((item) => item.chargeCode.toUpperCase() === opt.chargeCode.toUpperCase())
        ) {
          next = [
            ...next,
            prChargeItemService.createPrChargeFromMappedOption(opt, totalEstimatedValue, currency),
          ];
        }
      }
      return prChargeItemService.recalculateSelectedChargesOnly(next, totalEstimatedValue, currency);
    });
  }, [effectiveMappedCharges, isExpensePr]);

  // Recalculate selected header and line charge items cleanly when line total or currency changes
  useEffect(() => {
    if (isExpensePr) return;
    setChargeItems((prev) =>
      prChargeItemService.recalculateSelectedChargesOnly(prev, totalEstimatedValue, currency)
    );
    setLines((prev) => prChargeItemService.recalculateLinesCharges(prev, currency));
  }, [totalEstimatedValue, currency, isExpensePr]);

  const chargesSummary = useMemo(() => {
    if (isExpensePr) {
      return {
        itemsSubtotal: expenseFinancials.expenseBaseTotal,
        applicableChargesBaseTotal: 0,
        applicableChargesTaxTotal: expenseFinancials.expenseTaxTotal,
        applicableChargesTotalWithTax: expenseFinancials.expenseTaxTotal,
        grandTotalWithCharges: expenseFinancials.totalExpensePrValue,
        applicableChargesCount: 0,
        headerChargesBaseTotal: 0,
        headerChargesTaxTotal: 0,
        lineChargesBaseTotal: 0,
        lineChargesTaxTotal: 0,
        lineChargesCount: 0,
      };
    }
    return prChargeItemService.calculateFullRequisitionSummary(
      chargeItems,
      lines,
      totalEstimatedValue
    );
  }, [isExpensePr, expenseFinancials, chargeItems, lines, totalEstimatedValue]);

  const headerLineChargeDuplicateCheck = useMemo(
    () =>
      isExpensePr
        ? { valid: true, duplicateChargeCodes: [], errors: [] }
        : prChargeItemService.validateHeaderAndLineChargeDuplicates(
            chargeItems,
            lines,
            Boolean(effectiveGovernancePolicy.activation?.allowSameChargeAtHeaderAndLine)
          ),
    [isExpensePr, chargeItems, lines, effectiveGovernancePolicy.activation?.allowSameChargeAtHeaderAndLine]
  );

  const approvalWorkflowPlan = useMemo(
    () =>
      prGovernancePolicyService.resolveApprovalWorkflowPlan(
        {
          companyId: selectedCompany.id,
          branchId: targetBranch?.id || 'ALL',
          department,
          estimatedTotalValue: totalEstimatedValue,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
          currency,
          status: 'DRAFT',
          approvalCycleCount: 1,
          approvalHistory: [],
          creatorId: currentUser.id,
          creatorName: currentUser.fullName,
        },
        effectiveGovernancePolicy
      ),
    [
      selectedCompany.id,
      targetBranch?.id,
      department,
      totalEstimatedValue,
      chargesSummary.grandTotalWithCharges,
      currency,
      currentUser.id,
      currentUser.fullName,
      effectiveGovernancePolicy,
    ]
  );

  useEffect(() => {
    if (!isBudgetEnabled) {
      setBudgetStatus('NOT_VALIDATED');
      setBudgetCheckMessage(null);
    }
  }, [isBudgetEnabled]);

  const handleUpdateChargeApplicability = (chargeId: string, applicability: PRChargeApplicability) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          const updated = {
            ...item,
            applicability,
            ...(applicability === 'APPLICABLE' && item.chargeType === 'AT_ACTUALS'
              ? { rateOrPercentage: 0 }
              : {}),
          };
          return prChargeItemService.calculateChargeItem(updated, totalEstimatedValue);
        }
        return item;
      })
    );
  };

  const handleUpdateChargeType = (chargeId: string, chargeType: PRChargeType) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          const updated = {
            ...item,
            chargeType,
            ...(chargeType === 'AT_ACTUALS' ? { rateOrPercentage: 0 } : {}),
          };
          return prChargeItemService.calculateChargeItem(updated, totalEstimatedValue);
        }
        return item;
      })
    );
  };

  const handleUpdateChargeRate = (chargeId: string, rateOrPercentage: number) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          const updated = { ...item, rateOrPercentage };
          return prChargeItemService.calculateChargeItem(updated, totalEstimatedValue);
        }
        return item;
      })
    );
  };

  const handleUpdateChargeGst = (chargeId: string, gstRatePercent: number) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          const updated = { ...item, gstRatePercent };
          return prChargeItemService.calculateChargeItem(updated, totalEstimatedValue);
        }
        return item;
      })
    );
  };

  const handleUpdateChargePayee = (chargeId: string, payeeType: any) => {
    setChargeItems((prev) =>
      prev.map((item) => (item.id === chargeId ? { ...item, payeeType } : item))
    );
  };

  const handleUpdateChargeRemarks = (chargeId: string, remarks: string) => {
    setChargeItems((prev) =>
      prev.map((item) => (item.id === chargeId ? { ...item, remarks } : item))
    );
  };

  const handleResetChargeToFixedTariff = (chargeId: string) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          return prChargeItemService.resetToFixedTariff(item, totalEstimatedValue);
        }
        return item;
      })
    );
  };

  const handleSyncMappedTariffs = () => {
    setChargeSelectorError(null);
    const mandatoryOnly = effectiveMappedCharges
      .filter((opt: EffectiveMappedChargeOption) => opt.applicability === 'MANDATORY')
      .map((opt: EffectiveMappedChargeOption) =>
        prChargeItemService.createPrChargeFromMappedOption(opt, totalEstimatedValue, currency)
      );
    setChargeItems(mandatoryOnly);
  };

  const handleAddMappedCharge = (option: EffectiveMappedChargeOption, customAmount?: number) => {
    setChargeSelectorError(null);
    if (isExpensePr) {
      setChargeSelectorError('Charge Items apply only to Inventory PRs and cannot be added to an EXPENSE PR.');
      return;
    }
    if (
      !effectiveGovernancePolicy.activation?.allowSameChargeAtHeaderAndLine &&
      lines.some((l) =>
        (l.lineCharges || []).some(
          (lc) =>
            lc.applicability !== 'NOT_APPLICABLE' &&
            lc.chargeCode.toUpperCase() === option.chargeCode.toUpperCase()
        )
      )
    ) {
      setChargeSelectorError(
        `Charge "${option.chargeCode}" (${option.chargeName}) is already attached at PR Line level and cannot also be added at PR Header level.`
      );
      return;
    }
    try {
      setInventoryUserModified(true);
      const context =
        customAmount !== undefined
          ? {
              rateOverride: customAmount,
              chargeTypeOverride: 'FIXED' as PRChargeType,
              applicabilityOverride:
                option.calculationMethod !== 'PERCENTAGE' && customAmount === Number(option.rate)
                  ? ('AS_PER_FIXED_CHARGES' as PRChargeApplicability)
                  : ('APPLICABLE' as PRChargeApplicability),
            }
          : undefined;
      setChargeItems((prev) =>
        prChargeItemService.addMappedChargeToPrList(
          prev,
          option,
          totalEstimatedValue,
          currency,
          context
        )
      );
    } catch (err: any) {
      setChargeSelectorError(err?.message || 'Unable to add selected charge.');
    }
  };

  const handleAddMultipleMappedCharges = (options: EffectiveMappedChargeOption[]) => {
    setChargeSelectorError(null);
    if (isExpensePr) {
      setChargeSelectorError('Charge Items apply only to Inventory PRs.');
      return;
    }
    setInventoryUserModified(true);
    setChargeItems((prev) => {
      let next = prev;
      for (const opt of options) {
        try {
          next = prChargeItemService.addMappedChargeToPrList(next, opt, totalEstimatedValue, currency);
        } catch (err: any) {
          setChargeSelectorError(err?.message || 'Duplicate charge skipped.');
        }
      }
      return next;
    });
  };

  const handleRemoveCharge = (chargeId: string) => {
    setChargeItems((prev) => prev.filter((item) => item.id !== chargeId));
  };

  // Line-Level Charge Item Handlers
  const getLineSubtotal = (lineIdx: number, list = lines) => {
    const l = list[lineIdx];
    if (!l) return 0;
    return (Number(l.requestedQuantity) || 0) * (Number(l.approximateUnitPrice) || 0);
  };

  const handleAddLineMappedCharge = (
    lineIdx: number,
    option: EffectiveMappedChargeOption,
    customAmount?: number
  ) => {
    setLineChargeSelectorError(null);
    if (
      !effectiveGovernancePolicy.activation?.allowSameChargeAtHeaderAndLine &&
      chargeItems.some(
        (hc) =>
          hc.applicability !== 'NOT_APPLICABLE' &&
          hc.chargeCode.toUpperCase() === option.chargeCode.toUpperCase()
      )
    ) {
      setLineChargeSelectorError(
        `Charge "${option.chargeCode}" (${option.chargeName}) is already attached at PR Header level and cannot also be added at PR Line level.`
      );
      return;
    }
    try {
      setInventoryUserModified(true);
      setLines((prev) =>
        prev.map((line, i) => {
          if (i !== lineIdx) return line;
          const lineSub = (Number(line.requestedQuantity) || 0) * (Number(line.approximateUnitPrice) || 0);
          const context =
            customAmount !== undefined
              ? {
                  quantity: Number(line.requestedQuantity) || 1,
                  rateOverride: customAmount,
                  chargeTypeOverride: 'FIXED' as PRChargeType,
                  applicabilityOverride:
                    option.calculationMethod !== 'PERCENTAGE' && customAmount === Number(option.rate)
                      ? ('AS_PER_FIXED_CHARGES' as PRChargeApplicability)
                      : ('APPLICABLE' as PRChargeApplicability),
                }
              : { quantity: Number(line.requestedQuantity) || 1 };
          const nextCharges = prChargeItemService.addMappedChargeToPrList(
            line.lineCharges || [],
            option,
            lineSub,
            currency,
            context
          );
          return { ...line, lineCharges: nextCharges };
        })
      );
    } catch (err: any) {
      setLineChargeSelectorError(err?.message || 'Unable to add selected line charge.');
    }
  };

  const handleUpdateLineChargeField = (
    lineIdx: number,
    chargeId: string,
    patch: Partial<PRChargeItem>
  ) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== lineIdx) return line;
        const lineSub = (Number(line.requestedQuantity) || 0) * (Number(line.approximateUnitPrice) || 0);
        const nextCharges = (line.lineCharges || []).map((c) => {
          if (c.id !== chargeId) return c;
          const merged = {
            ...c,
            ...patch,
            ...(patch.chargeType === 'AT_ACTUALS' ? { rateOrPercentage: 0 } : {}),
          };
          return prChargeItemService.calculateChargeItem(merged, lineSub, {
            quantity: Number(line.requestedQuantity) || 1,
          });
        });
        return { ...line, lineCharges: nextCharges };
      })
    );
  };

  const handleRemoveLineCharge = (lineIdx: number, chargeId: string) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === lineIdx
          ? { ...line, lineCharges: (line.lineCharges || []).filter((c) => c.id !== chargeId) }
          : line
      )
    );
  };

  // Expense PR Line Handlers
  const handleAddExpenseLine = () => {
    setExpenseUserModified(true);
    const nextNum = expenseLines.length + 1;
    const cat =
      eligibleExpenseCategories[nextNum % Math.max(1, eligibleExpenseCategories.length)] ||
      eligibleExpenseCategories[0] || {
        categoryCode: 'EXP-PROF',
        categoryName: 'Professional Fees',
        sapGlAccountCode: '610200',
        sapGlAccountName: 'Professional & Technical Retainer Fees',
        defaultTaxCode: 'GST18',
        defaultTaxPercent: 18,
      };
    const calc = calculateExpensePrLine({
      amount: 25000,
      taxPercent: cat.defaultTaxPercent ?? 18,
      isTaxInclusive: false,
    });
    const autoCc = costCentreDetermination.valid
      ? costCentreDetermination.defaultCostCentreCode
      : '';
    const autoCcObj = costCentreDetermination.eligibleCostCentres.find(
      (c) => c.code === autoCc
    );
    const defaultFromDate = expectedDeliveryDate || '2026-12-01';
    const defaultToDate = expectedDeliveryDate || '2026-12-10';
    setExpenseLines((prev) => [
      ...prev,
      {
        id: `exp-line-${Date.now()}-${nextNum}`,
        prId: '',
        lineNumber: nextNum,
        expenseCategoryCode: cat.categoryCode,
        expenseCategoryName: cat.categoryName,
        description: `${cat.categoryName} — Specialized Service Engagement`,
        expenseDescription: `${cat.categoryName} — Specialized Service Engagement`,
        costCentre: autoCc,
        costCenter: autoCc,
        sapCostCenterCode: autoCcObj?.sapCostCenterCode || autoCc || undefined,
        department,
        serviceFromDate: defaultFromDate,
        serviceToDate: defaultToDate,
        expectedServiceDate: defaultToDate,
        amount: 25000,
        currency,
        taxCode: cat.defaultTaxCode || 'GST18',
        taxPercent: cat.defaultTaxPercent ?? 18,
        taxRatePercent: cat.defaultTaxPercent ?? 18,
        isTaxInclusive: false,
        taxInclusive: false,
        baseAmount: calc.baseAmount,
        taxAmount: calc.taxAmount,
        totalWithTax: calc.totalWithTax,
        totalAmountWithTax: calc.totalWithTax,
        sapGlAccountCode: cat.sapGlAccountCode,
        sapGlAccountName: cat.sapGlAccountName,
        vendorSuggestion: 'Authorized Service Partner',
        purchasePurpose: `Operational requirement for ${cat.categoryName}`,
        businessJustification: `Essential non-inventory service engagement for ${department}`,
        lineAttachments: [],
        status: 'ACTIVE',
      },
    ]);
  };

  const handleUpdateExpenseLine = (idx: number, patch: Partial<ExpensePrLineRecord>) => {
    setExpenseUserModified(true);
    setExpenseLines((prev) =>
      prev.map((el, i) => {
        if (i !== idx) return el;
        let updated: ExpensePrLineRecord = { ...el, ...patch };
        if (patch.description !== undefined && patch.expenseDescription === undefined) {
          updated.expenseDescription = patch.description;
        }
        if (patch.expenseDescription !== undefined && patch.description === undefined) {
          updated.description = patch.expenseDescription;
        }
        if (patch.taxRatePercent !== undefined && patch.taxPercent === undefined) {
          updated.taxPercent = patch.taxRatePercent;
        }
        if (patch.taxPercent !== undefined && patch.taxRatePercent === undefined) {
          updated.taxRatePercent = patch.taxPercent;
        }
        if (patch.taxInclusive !== undefined && patch.isTaxInclusive === undefined) {
          updated.isTaxInclusive = patch.taxInclusive;
        }
        if (patch.isTaxInclusive !== undefined && patch.taxInclusive === undefined) {
          updated.taxInclusive = patch.isTaxInclusive;
        }
        if (patch.costCentre !== undefined) {
          const matchedCc = costCentreDetermination.eligibleCostCentres.find(
            (c) => c.code === patch.costCentre
          );
          updated.costCenter = patch.costCentre;
          updated.sapCostCenterCode = matchedCc?.sapCostCenterCode || patch.costCentre;
        }
        if (patch.serviceToDate !== undefined || patch.serviceFromDate !== undefined) {
          updated.expectedServiceDate =
            updated.serviceToDate || updated.serviceFromDate || updated.expectedServiceDate;
        }
        if (patch.expenseCategoryCode) {
          const matchedCat = eligibleExpenseCategories.find(
            (c) => c.categoryCode === patch.expenseCategoryCode
          );
          if (matchedCat) {
            const nextTaxRate =
              patch.taxPercent !== undefined
                ? patch.taxPercent
                : patch.taxRatePercent !== undefined
                ? patch.taxRatePercent
                : matchedCat.defaultTaxPercent ?? 18;
            updated = {
              ...updated,
              expenseCategoryName: matchedCat.categoryName,
              sapGlAccountCode: matchedCat.sapGlAccountCode,
              sapGlAccountName: matchedCat.sapGlAccountName,
              taxCode: patch.taxCode || matchedCat.defaultTaxCode || 'GST18',
              taxPercent: nextTaxRate,
              taxRatePercent: nextTaxRate,
            };
          }
        }
        const calc = calculateExpensePrLine({
          amount: Number(updated.amount) || 0,
          taxPercent: Number(updated.taxPercent ?? updated.taxRatePercent ?? 18),
          isTaxInclusive: Boolean(updated.isTaxInclusive ?? updated.taxInclusive),
        });
        return {
          ...updated,
          baseAmount: calc.baseAmount,
          taxAmount: calc.taxAmount,
          totalWithTax: calc.totalWithTax,
          totalAmountWithTax: calc.totalWithTax,
        };
      })
    );
  };

  const handleRemoveExpenseLine = (idx: number) => {
    setExpenseUserModified(true);
    setExpenseLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // Revalidate buyers when context changes
  React.useEffect(() => {
    setLines(prev => prev.map(l => ({
      ...l,
      assignedBuyer: BuyerService.getDefaultBuyer(selectedCompany.id, targetBranch.id, l.itemCategory) || null
    })));
  }, [selectedCompany.id, targetBranch.id]);

  const handleAddLine = () => {
    setInventoryUserModified(true);
    const slNo = lines.length + 1;
    const sourceItems = prTypeBranchItems.length > 0 ? prTypeBranchItems : branchAvailableItems;
    const selectedItem = sourceItems[slNo % sourceItems.length] || sourceItems[0] || firstMasterItem;
    const itemCode = selectedItem.globalItemCode;
    const category = selectedItem.categoryCode || 'OT';
    setLines([...lines, {
      id: `draft-line-${Date.now()}-${slNo}`,
      itemCode,
      description: selectedItem.description,
      itemCategory: category,
      inventoryUom: selectedItem.inventoryUom || 'NOS', // LOCKED
      requestedQuantity: 10,
      approximateUnitPrice: 350,
      specifications: 'Sealed rubber contact both sides',
      purchasePurpose: 'Scheduled preventive maintenance for conveyor drive',
      businessJustification: 'Essential replacement to prevent unscheduled line shutdown',
      defaultWarehouse: getDefaultWarehouse(itemCode, category),
      assignedBuyer: BuyerService.getDefaultBuyer(selectedCompany.id, targetBranch.id, category) || null,
      deliverySchedules: [
        { id: `sch-${Date.now()}-1`, deliveryDate: '2026-11-25', quantity: 10 }
      ],
      lineAttachments: [
        {
          id: `att-bearing-${Date.now()}`,
          fileName: `${itemCode}_Technical_Datasheet.pdf`,
          fileSize: '840 KB',
          fileType: 'PDF Document',
          uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        }
      ],
      lineCharges: [],
    }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleAddScheduleSplit = (lineIdx: number) => {
    const updated = [...lines];
    const targetLine = updated[lineIdx];
    const currentTotalScheduled = targetLine.deliverySchedules.reduce((sum, s) => sum + s.quantity, 0);
    const remainingQty = Math.max(0, targetLine.requestedQuantity - currentTotalScheduled);

    targetLine.deliverySchedules.push({
      id: `sch-${Date.now()}-${targetLine.deliverySchedules.length + 1}`,
      deliveryDate: '2026-12-15',
      quantity: remainingQty > 0 ? remainingQty : 5
    });
    setLines(updated);
  };

  const handleRemoveScheduleSplit = (lineIdx: number, schIdx: number) => {
    const updated = [...lines];
    if (updated[lineIdx].deliverySchedules.length > 1) {
      updated[lineIdx].deliverySchedules = updated[lineIdx].deliverySchedules.filter((_, i) => i !== schIdx);
      setLines(updated);
    }
  };

  const handleFileUploadForLine = (lineIdx: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = Array.from(files).map((f, i) => ({
      id: `att-${Date.now()}-${i}`,
      fileName: f.name,
      fileSize: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
      fileType: f.type || 'Document',
      uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    }));

    const updated = [...lines];
    updated[lineIdx].lineAttachments = [...(updated[lineIdx].lineAttachments || []), ...newAttachments];
    setLines(updated);
  };

  const handleDeleteLineAttachment = (lineIdx: number, attId: string) => {
    const updated = [...lines];
    updated[lineIdx].lineAttachments = updated[lineIdx].lineAttachments.filter((a) => a.id !== attId);
    setLines(updated);
  };

  const handleRunBudgetValidation = () => {
    setFormError(null);
    if (!isBudgetEnabled) {
      setBudgetStatus('NOT_VALIDATED');
      setBudgetCheckMessage(null);
      return;
    }
    const valuation = prGovernancePolicyService.resolvePrValuationAmount(
      {
        companyId: selectedCompany.id,
        branchId: targetBranch.id,
        currency,
        estimatedTotalValue: totalEstimatedValue,
        grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
      },
      effectiveGovernancePolicy
    );
    const snap = budgetControlService.validateBudgetAtStage({
      transactionId: draftKey,
      transactionNumber: draftKey,
      sourceChainId: draftKey,
      stage: 'PR_SUBMISSION',
      companyId: selectedCompany.id,
      branchId: targetBranch.id,
      department,
      costCenter: costCentre || 'CC-PROD-101',
      proposedAmount: valuation.reportingAmount,
      validatedBy: currentUser.fullName,
    });
    if (
      snap.overallOutcome === 'BLOCKED_INSUFFICIENT_BUDGET' ||
      snap.overallOutcome === 'PENDING_EXCEPTION_APPROVAL' ||
      snap.budgetShortfall > 0
    ) {
      setBudgetStatus('INSUFFICIENT');
      setBudgetCheckMessage(
        `Shortfall of ${valuation.reportingCurrency} ${snap.budgetShortfall.toLocaleString()} against available ${valuation.reportingCurrency} ${snap.availableBudget.toLocaleString()} (${snap.costCenter}).`
      );
    } else {
      setBudgetStatus('SUFFICIENT');
      setBudgetCheckMessage(
        `Available ${valuation.reportingCurrency} ${snap.availableBudget.toLocaleString()} sufficient for ${valuation.reportingCurrency} ${valuation.reportingAmount.toLocaleString()} (${snap.costCenter}).`
      );
    }
  };

  const clearDraftSessionKey = () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(draftSessionStorageKey);
      }
    } catch {}
  };

  const handleCheckDuplicates = async () => {
    setFormError(null);
    await prDuplicateGovernanceService.hydrateFromBackend();
    setDupRefreshTick((t) => t + 1);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setFormError(null);

    if (!effectiveGovernancePolicy.activation.prModuleEnabled) {
      setFormError(
        `Purchase Requisition module is disabled for ${effectiveGovernancePolicy.companyCode} / ${effectiveGovernancePolicy.branchName}.`
      );
      return;
    }
    if (!isDraft && !effectiveGovernancePolicy.activation.prSubmissionEnabled) {
      setFormError('PR Submission is currently disabled under the active governance policy.');
      return;
    }

    // Enforce PR Type & Category Mapping validation for all lines before submit/save
    if (!categoryValidationResult.valid) {
      const msg =
        categoryValidationResult.prTypeReason ||
        categoryValidationResult.invalidLines
          .map((bad) => `Line #${bad.lineIndex + 1} (${bad.itemCode || 'Item'} — ${bad.rawCategory}): ${bad.reason}`)
          .join(' | ');
      setFormError(
        `PR Type / Category validation failed: ${msg} Replace incompatible item lines or switch to an eligible PR Type before proceeding.`
      );
      return;
    }

    if (isExpensePr) {
      if (!expenseLinesValidation.valid) {
        setFormError(expenseLinesValidation.errors.join(' | '));
        return;
      }
    } else {
      if (expenseUserModified) {
        setFormError(
          `Retained Expense Lines exist while Inventory PR Type '${prType}' is selected. Clear retained Expense Lines or switch back to EXPENSE PR Type before submitting.`
        );
        return;
      }
      if (!headerLineChargeDuplicateCheck.valid) {
        setFormError(headerLineChargeDuplicateCheck.errors.join(' | '));
        return;
      }
    }

    // Validate Expected Delivery Date based on policy
    if (isDeliveryDateEnabled) {
      if (isDeliveryDateMandatory && !isDraft && (!expectedDeliveryDate || !expectedDeliveryDate.trim())) {
        setFormError('Expected Delivery Date is mandatory under active company policy.');
        return;
      }
      if (expectedDeliveryDate && expectedDeliveryDate.trim() && !isValidIsoDate(expectedDeliveryDate)) {
        setFormError('Please enter a valid Expected Delivery Date in YYYY-MM-DD format.');
        return;
      }
    }

    // Validate line-level purchase purpose on submission (drafts may use fallback text)
    if (!isDraft && !isExpensePr) {
      const missingLinePurposeIdx = lines.findIndex((l) => !l.purchasePurpose || !l.purchasePurpose.trim());
      if (missingLinePurposeIdx !== -1) {
        setFormError(`Please enter a mandatory Purchase Purpose for Item Line #${missingLinePurposeIdx + 1}.`);
        return;
      }
    }

    // Conditional Budget Validation (only runs when Enable Budget Validation is ON)
    let resolvedBudgetStatus: 'NOT_VALIDATED' | 'SUFFICIENT' | 'INSUFFICIENT' = 'NOT_VALIDATED';
    if (isBudgetEnabled) {
      const valuation = prGovernancePolicyService.resolvePrValuationAmount(
        {
          companyId: selectedCompany.id,
          branchId: targetBranch.id,
          currency,
          estimatedTotalValue: totalEstimatedValue,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
        },
        effectiveGovernancePolicy
      );
      const snap = budgetControlService.validateBudgetAtStage({
        transactionId: draftKey,
        transactionNumber: draftKey,
        sourceChainId: draftKey,
        stage: 'PR_SUBMISSION',
        companyId: selectedCompany.id,
        branchId: targetBranch.id,
        department,
        costCenter: costCentre || 'CC-PROD-101',
        proposedAmount: valuation.reportingAmount,
        validatedBy: currentUser.fullName,
      });
      resolvedBudgetStatus =
        snap.overallOutcome === 'BLOCKED_INSUFFICIENT_BUDGET' ||
        snap.overallOutcome === 'PENDING_EXCEPTION_APPROVAL' ||
        snap.budgetShortfall > 0
          ? 'INSUFFICIENT'
          : 'SUFFICIENT';
      setBudgetStatus(resolvedBudgetStatus);

      if (!isDraft && effectiveGovernancePolicy.budget.mandatoryBudgetCheck && resolvedBudgetStatus !== 'SUFFICIENT') {
        setFormError(
          `Mandatory budget validation failed: Total PR Value (${valuation.reportingCurrency} ${valuation.reportingAmount.toLocaleString()}) exceeds available budget (${valuation.reportingCurrency} ${snap.availableBudget.toLocaleString()}).`
        );
        return;
      }
    } else {
      resolvedBudgetStatus = 'NOT_VALIDATED';
      setBudgetStatus('NOT_VALIDATED');
    }

    const formattedLines: PurchaseRequisitionLine[] = isExpensePr
      ? []
      : lines.map((l, i) => {
          const stableLineId = l.id || `draft-line-${i + 1}`;
          return {
            id: stableLineId,
            prId: '',
            itemCode: l.itemCode,
            description: l.description,
            itemCategory: l.itemCategory,
            inventoryUom: l.inventoryUom, // Enforced authoritative UOM
            requestedQuantity: l.requestedQuantity,
            approximateUnitPrice: l.approximateUnitPrice,
            currency,
            estimatedTotalValue: l.requestedQuantity * l.approximateUnitPrice,
            specifications: l.specifications,
            purchasePurpose: l.purchasePurpose?.trim() || (isDraft ? 'Draft Purchase Requisition' : ''),
            businessJustification: l.businessJustification,
            deliverySchedules: l.deliverySchedules.map((sch) => ({
              id: sch.id,
              lineId: stableLineId,
              deliveryDate: sch.deliveryDate || (isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : ''),
              quantity: sch.quantity
            })),
            lineAttachments: l.lineAttachments,
            lineCharges: l.lineCharges || [],
            lineChargesTotalValue: (l.lineCharges || []).reduce(
              (sum, c) => (c.applicability !== 'NOT_APPLICABLE' ? sum + (c.estimatedAmount || 0) : sum),
              0
            ),
            assignedBuyer: l.assignedBuyer?.buyerName || 'Default Procurement Buyer',
            buyerStatus: 'PENDING_CONFIGURATION',
            status: 'ACTIVE'
          };
        });

    try {
      // Backend & Service Duplicate PR Governance Validation
      const latestSnap = prDuplicateGovernanceService.evaluateDuplicateConditions({
        draftKey,
        companyId: selectedCompany.id,
        branchId: targetBranch.id,
        requesterId: currentUser.id,
        purchasePurpose: isExpensePr ? expenseLines[0]?.purchasePurpose : lines[0]?.purchasePurpose,
        expectedDeliveryDate: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
        lines: duplicateLinesInput,
        actorUser: currentUser,
      });

      if (latestSnap.hasDuplicates) {
        if (isDraft) {
          const hardBlocked = latestSnap.conditions.find((c) => !c.policyAllowsOverride && c.warningLevel === 'HARD_BLOCK');
          if (hardBlocked) {
            setDupRefreshTick((t) => t + 1);
            setFormError(hardBlocked.policyReason);
            return;
          }
          const unacked = latestSnap.conditions.find((c) => !c.acknowledgement);
          if (
            unacked &&
            effectiveGovernancePolicy.duplicatePrevention?.warningLevel === 'WARNING_WITH_JUSTIFICATION' &&
            effectiveGovernancePolicy.duplicatePrevention?.requireJustificationToProceed
          ) {
            setDupRefreshTick((t) => t + 1);
            setFormError(
              `Duplicate PR detected for ${unacked.itemCode}. Enter justification and click "Acknowledge & Record Justification" in the Duplicate PR Governance panel above before saving.`
            );
            return;
          }
        } else {
          const submitDupCheck = await prDuplicateGovernanceService.validateSubmissionRemote({
            draftKey,
            companyId: selectedCompany.id,
            branchId: targetBranch.id,
            requesterId: currentUser.id,
            purchasePurpose: isExpensePr ? expenseLines[0]?.purchasePurpose : lines[0]?.purchasePurpose,
            expectedDeliveryDate: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
            lines: duplicateLinesInput,
            actorUser: currentUser,
          });
          setDupRefreshTick((t) => t + 1);
          if (!submitDupCheck.allowed) {
            setFormError(submitDupCheck.message);
            return;
          }
        }
      }

      if (!isDraft) {
        const submitCheck = prGovernancePolicyService.evaluatePrAction({
          action: 'SUBMIT_PR',
          companyId: selectedCompany.id,
          branchId: targetBranch.id,
          user: currentUser,
        });
        if (!submitCheck.allowed) {
          setFormError(submitCheck.reason || 'PR Submission is disabled by policy.');
          return;
        }
        const delCheck = prGovernancePolicyService.validateExpectedDeliveryDate(
          isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
          effectiveGovernancePolicy,
          true
        );
        if (!delCheck.valid) {
          setFormError(delCheck.reason || 'Expected Delivery Date validation failed for submission.');
          return;
        }
      }

      const persistedAckJustif = latestSnap.conditions
        .map((c) => c.acknowledgement?.justification)
        .filter(Boolean)
        .join(' | ');

      // Backend Policy, Category Mapping, Approval Workflow & Conditional Budget check
      const remoteGovCheck = await prGovernanceBackendClient.validatePrRemote({
        action: isDraft ? 'SAVE_DRAFT' : 'SUBMIT',
        pr: {
          companyId: selectedCompany.id,
          branchId: targetBranch.id,
          prType,
          department,
          costCentre,
          currency,
          estimatedTotalValue: totalEstimatedValue,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
          budgetValidationStatus: resolvedBudgetStatus,
          lines: formattedLines.map((fl) => ({
            id: fl.id,
            itemCode: fl.itemCode,
            itemCategory: fl.itemCategory,
            chargeItems: (fl.lineCharges || []).map((c) => ({
              chargeCode: c.chargeCode,
              applicability: c.applicability,
            })),
          })),
          expenseLines: isExpensePr
            ? expenseLines.map((el) => ({
                id: el.id,
                expenseCategoryCode: el.expenseCategoryCode,
                expenseDescription: el.expenseDescription || el.description,
                costCentre: el.costCentre,
                serviceFromDate: el.serviceFromDate,
                serviceToDate: el.serviceToDate,
                expectedServiceDate: el.serviceToDate || el.serviceFromDate || el.expectedServiceDate,
                amount: el.amount,
                taxPercent: el.taxPercent ?? el.taxRatePercent,
                sapGlAccountCode: el.sapGlAccountCode,
                purchasePurpose: el.purchasePurpose,
                businessJustification: el.businessJustification,
              }))
            : [],
          chargeItems: isExpensePr
            ? []
            : chargeItems.map((c) => ({
                chargeCode: c.chargeCode,
                applicability: c.applicability,
              })),
        },
        actorUser: currentUser,
      });
      if (remoteGovCheck && !remoteGovCheck.allowed) {
        setFormError(remoteGovCheck.errors[0] || 'Backend PR governance validation failed.');
        return;
      }

      const newPr = PurchaseRequisitionService.createPR(
        {
          prType,
          procurementMechanism: isExpensePr ? 'EXPENSE_PR' : 'INVENTORY_PR',
          companyId: selectedCompany.id,
          companyCode: selectedCompany.code,
          branchId: targetBranch.id,
          branchCode: targetBranch.portalBranchCode || '001',
          branchName: targetBranch.name,
          department,
          costCentre: isExpensePr ? expenseLines[0]?.costCentre || costCentre : costCentre,
          requesterId: currentUser.id,
          requesterName: currentUser.fullName,
          creatorId: currentUser.id,
          creatorName: currentUser.fullName,
          modifiedBy: currentUser.fullName,
          priority,
          status: 'DRAFT',
          purchasePurpose: isExpensePr
            ? expenseLines[0]?.purchasePurpose?.trim() || 'Expense Requisition'
            : lines[0]?.purchasePurpose?.trim() || 'Draft Purchase Requisition',
          businessJustification: isExpensePr
            ? expenseLines[0]?.businessJustification?.trim() || ''
            : lines[0]?.businessJustification || '',
          deliveryLocation,
          estimatedTotalValue: totalEstimatedValue,
          chargeItems: isExpensePr ? [] : chargeItems,
          chargesTotalValue: isExpensePr ? 0 : chargesSummary.applicableChargesBaseTotal,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
          currency,
          expectedDeliveryDate: isExpensePr
            ? expenseLines[0]?.serviceToDate ||
              expenseLines[0]?.serviceFromDate ||
              expenseLines[0]?.expectedServiceDate ||
              expectedDeliveryDate ||
              undefined
            : isDeliveryDateEnabled && expectedDeliveryDate
            ? expectedDeliveryDate
            : undefined,
          requiredBy: isExpensePr
            ? expenseLines[0]?.serviceToDate ||
              expenseLines[0]?.serviceFromDate ||
              expenseLines[0]?.expectedServiceDate ||
              expectedDeliveryDate ||
              undefined
            : isDeliveryDateEnabled && expectedDeliveryDate
            ? expectedDeliveryDate
            : undefined,
          budgetValidationStatus: isBudgetEnabled
            ? resolvedBudgetStatus === 'SUFFICIENT'
              ? 'SUFFICIENT'
              : 'NOT_VALIDATED'
            : 'NOT_VALIDATED',
          budgetSourceRef: isBudgetEnabled ? 'BUDGET-FY26-Q3-ALLOCATION' : undefined,
          erpStockStatus: 'FRESH',
          erpStockTimestamp: new Date().toISOString(),
          equipmentId: (prType === 'REPAIR' || prType === 'MAINTENANCE') ? equipmentId : undefined,
          duplicateGovernanceKey: draftKey,
          duplicateGovernance: latestSnap,
          duplicateOverrideJustification: persistedAckJustif || undefined,
          lines: formattedLines,
          expenseLines: isExpensePr ? expenseLines : [],
          changeHistory: [],
          attachments: []
        },
        currentUser
      );

      if (!isDraft) {
        const submitRes = PurchaseRequisitionService.submitPR(newPr.id, currentUser);
        if (!submitRes.success) {
          setDupRefreshTick((t) => t + 1);
          setFormError(submitRes.message || 'Unable to submit Purchase Requisition.');
          return;
        }
      }

      clearDraftSessionKey();
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Unable to save Purchase Requisition. Please check all required fields.';
      setDupRefreshTick((t) => t + 1);
      setFormError(msg);
    }
  };

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-[#0B192C] text-white p-3 rounded-lg shadow-2xl flex items-center gap-3 border border-slate-700">
        <span className="text-xs font-bold">PR Creation (Minimized)</span>
        <button onClick={() => setIsMinimized(false)} className="px-2 py-1 bg-indigo-600 rounded text-xs">Maximize</button>
      </div>
    );
  }

  return (
    <div className={`${isMaximized ? 'fixed inset-0 z-50 w-full h-full' : 'fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto'}`}>
      <div className={`bg-white sm:rounded-2xl border border-slate-200 shadow-2xl ${isMaximized ? 'w-full h-full rounded-none' : 'w-full h-full sm:h-auto sm:max-w-7xl sm:max-h-[94vh]'} flex flex-col overflow-hidden min-w-0`}>
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800 shrink-0 min-w-0">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-xs sm:text-sm font-bold flex items-center gap-2 truncate">
              <Box className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Purchase Requisition</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Enterprise PR: Select Company & Branch, Currency{isDeliveryDateEnabled ? ', Expected Delivery Date' : ''}, item-code based default warehouses, and double-click purpose inputs.
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setIsMinimized(true)} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <div className="w-3 h-0.5 bg-slate-400" />
            </button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="text-slate-400 hover:text-white p-1 rounded-lg">
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs min-w-0">
          {/* Top Control Panel: Company, Branch, PR Type, Priority, Department, Currency, Expected Delivery Date */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isDeliveryDateEnabled ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200`}>
            {/* 1. Company Master Selection */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Company *
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Branch Master Selection */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Branch *
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  const updatedLines = lines.map((l) => ({
                    ...l,
                    defaultWarehouse: getDefaultWarehouse(l.itemCode, l.itemCategory)
                  }));
                  setLines(updatedLines);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    [{b.portalBranchCode}] {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. PR Type (RBAC) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">PR Type *</label>
                <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                  {currentUser.role}
                </span>
              </div>
              <select
                value={prType}
                onChange={(e) => setPrType(e.target.value as PRType)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
              >
                {allowedPrTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Priority */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PRPriority)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* 5. Branch-Specific Department */}
            <div>
              <label
                className="block font-bold text-slate-700 mb-1 truncate"
                title={`Department * (${targetBranch?.shortName || 'Branch'})`}
              >
                Department * ({targetBranch?.shortName || 'Branch'})
              </label>
              {activeDepartments.length > 0 ? (
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {activeDepartments.map((d) => (
                    <option key={d.id} value={d.departmentName}>
                      [{d.departmentCode}] {d.departmentName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Production & Operations"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* 6. Transaction Currency */}
            <div>
              <label htmlFor="pr-create-currency" className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Coins className="w-3.5 h-3.5 text-indigo-600" /> Currency *
              </label>
              <select
                id="pr-create-currency"
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>

            {/* 7. Expected Delivery Date (Governed by effective Company & Branch Policy) */}
            {isDeliveryDateEnabled && (
              <div>
                <label htmlFor="pr-create-expected-delivery-date" className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Expected Delivery Date {isDeliveryDateMandatory && <span className="text-rose-500">*</span>}
                </label>
                <input
                  id="pr-create-expected-delivery-date"
                  aria-label="Expected Delivery Date"
                  type="date"
                  required={isDeliveryDateMandatory}
                  value={expectedDeliveryDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setExpectedDeliveryDate(nextDate);
                    if (nextDate && lines.length > 0 && lines[0].deliverySchedules.length === 1) {
                      const updated = [...lines];
                      updated[0].deliverySchedules[0].deliveryDate = nextDate;
                      setLines(updated);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Consolidated Unified Duplicate PR Governance Panel (Header & Line-Level) */}
          <DuplicatePrGovernancePanel
            draftKey={draftKey}
            companyId={selectedCompany.id}
            branchId={targetBranch.id}
            requesterId={currentUser.id}
            purchasePurpose={lines[0]?.purchasePurpose}
            expectedDeliveryDate={isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined}
            lines={duplicateLinesInput}
            currentUser={currentUser}
            snapshot={duplicateSnapshot}
            onSnapshotUpdated={() => {
              setFormError(null);
              setDupRefreshTick((t) => t + 1);
            }}
            onRefresh={() => void handleCheckDuplicates()}
          />

          {/* Dynamic PR Type Category Mapping Validation Banner (Retains All Existing Lines) */}
          {!categoryValidationResult.valid && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-1.5"
            >
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  PR Type &amp; Category Mapping Violation ({prType}): {categoryValidationResult.invalidLines.length} incompatible line(s) retained for correction
                </span>
              </div>
              {categoryValidationResult.prTypeReason && (
                <p className="text-[11px] font-semibold">{categoryValidationResult.prTypeReason}</p>
              )}
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {categoryValidationResult.invalidLines.map((bad) => (
                  <li key={bad.lineIndex}>
                    <strong>Line #{bad.lineIndex + 1} ({bad.itemCode || 'Item'} · {bad.rawCategory}):</strong>{' '}
                    {bad.reason}
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-rose-700 font-medium pt-0.5">
                Eligible Categories for {prType} ({selectedCompany.code} / {targetBranch?.shortName || targetBranch?.name}):{' '}
                <strong>
                  {eligibleCategories.length > 0
                    ? eligibleCategories.map((c) => c.display).join(', ')
                    : 'None configured'}
                </strong>
              </div>
            </div>
          )}

          {/* Cross-Mechanism Retention & Header/Line Duplicate Charge Governance Banners */}
          {isExpensePr && inventoryUserModified && (lines.length > 0 || chargeItems.length > 0) && (
            <div
              role="alert"
              className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Dynamic PR Type Change: {lines.length} Inventory Item Line(s) / {chargeItems.length} Charge Item(s) retained
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  EXPENSE PRs cannot be submitted while inventory item lines or inventory Charge Items remain attached.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLines([]);
                  setChargeItems([]);
                  setInventoryUserModified(false);
                  setFormError(null);
                }}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-[11px] cursor-pointer shrink-0"
              >
                Clear Retained Inventory Lines &amp; Charges
              </button>
            </div>
          )}

          {!isExpensePr && expenseUserModified && expenseLines.length > 0 && (
            <div
              role="alert"
              className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Dynamic PR Type Change: {expenseLines.length} Expense Line(s) retained for review
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Inventory PR ({prType}) cannot be submitted while non-inventory Expense PR lines remain attached.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpenseLines([]);
                  setExpenseUserModified(false);
                  setFormError(null);
                }}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-[11px] cursor-pointer shrink-0"
              >
                Clear Retained Expense Lines
              </button>
            </div>
          )}

          {!isExpensePr && !headerLineChargeDuplicateCheck.valid && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-1"
            >
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Duplicate Charge Item Governance Block (Header vs Line Level)</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                {headerLineChargeDuplicateCheck.errors.map((errMsg, idx) => (
                  <li key={idx}>{errMsg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* TABS: PR Lines vs Charge Items (Charge Items tab is hidden on Expense Requisition screen) */}
          <div className="flex items-center gap-2 border-b border-slate-200 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('LINES')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'LINES'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>
                {isExpensePr
                  ? 'Expense & Service Lines (SAP Service Mode)'
                  : 'PR Item Lines & Deliverables'}
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {isExpensePr ? expenseLines.length : lines.length}
              </span>
            </button>

            {!isExpensePr && (
              <button
                type="button"
                onClick={() => setActiveTab('CHARGES')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === 'CHARGES'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Charge Items</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    chargesSummary.applicableChargesCount > 0
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {`${chargesSummary.applicableChargesCount} Applicable`}
                </span>
              </button>
            )}
          </div>

          {activeTab === 'LINES' && isExpensePr && (
            <div className="space-y-3 min-w-0">
              {/* Expense PR Governance Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 min-w-0">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-indigo-950 text-xs">
                      Non-Inventory Expense &amp; Service Requisition Lines
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {expenseLines.length} Expense Line(s)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      SAP B1 10.0 HANA: dDocument_Service
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    <strong>Governed Service &amp; Expense Requisition:</strong> Select an active Expense Category, specify mandatory <strong>Service From Date</strong> and <strong>Service To Date</strong>, and verify the automatically determined <strong>Cost Centre</strong> for {selectedCompany.code} / {targetBranch?.shortName || targetBranch?.name} / {department}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddExpenseLine}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs transition text-xs shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Expense Line
                </button>
              </div>

              {/* Automatic Cost Centre Determination Missing Mapping Warning Banner */}
              {!costCentreDetermination.valid && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-800">
                      Cost Centre Determination Error — No Valid Cost Centre Mapping
                    </div>
                    <p className="text-[11px] text-rose-700">
                      {costCentreDetermination.validationMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Expense Financial Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Expense Base Subtotal</div>
                  <div className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                    {formatChargeAmount(expenseFinancials.expenseBaseTotal, currency)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Applicable Expense Tax</div>
                  <div className="text-sm font-extrabold text-slate-700 font-mono mt-0.5">
                    {formatChargeAmount(expenseFinancials.expenseTaxTotal, currency)}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-800">Total Expense PR Value</div>
                  <div className="text-base font-extrabold text-indigo-900 font-mono mt-0.5">
                    {formatChargeAmount(expenseFinancials.totalExpensePrValue, currency)}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium">Base + Applicable Tax</div>
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-emerald-900">SAP GL Mapping Status</div>
                  <div className="text-xs font-extrabold text-emerald-800 font-mono mt-0.5">
                    {eligibleExpenseCategories.length} Active GL Categories
                  </div>
                  <div className="text-[10px] text-emerald-700">Service Layer AccountCode Ready</div>
                </div>
              </div>

              {/* Expense Lines Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto max-h-[44vh]">
                  <table className="w-full text-left text-xs border-collapse min-w-[1480px]">
                    <thead>
                      <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                        <th className="p-2.5 text-center border-r border-slate-800 w-12">#</th>
                        <th className="p-2.5 border-r border-slate-800 w-56">Expense Category &amp; SAP GL *</th>
                        <th className="p-2.5 border-r border-slate-800 w-56">Expense Description *</th>
                        <th className="p-2.5 border-r border-slate-800 w-48">Cost Centre (Auto-Mapped) *</th>
                        <th className="p-2.5 border-r border-slate-800 w-36">Service From Date *</th>
                        <th className="p-2.5 border-r border-slate-800 w-36">Service To Date *</th>
                        <th className="p-2.5 text-right border-r border-slate-800 w-36">Amount ({getCurrencySymbol(currency).trim()}) *</th>
                        <th className="p-2.5 text-center border-r border-slate-800 w-24">GST / Tax %</th>
                        <th className="p-2.5 text-right border-r border-slate-800 w-40">Base / Tax / Total</th>
                        <th className="p-2.5 border-r border-slate-800 w-40">Vendor Suggestion</th>
                        <th className="p-2.5 border-r border-slate-800 w-64">Purchase Purpose * &amp; Justification *</th>
                        <th className="p-2.5 text-center w-14">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {expenseLines.map((expLine, idx) => {
                        const hasDateRangeError = Boolean(
                          expLine.serviceFromDate &&
                            expLine.serviceToDate &&
                            expLine.serviceToDate < expLine.serviceFromDate
                        );
                        return (
                          <tr key={expLine.id} className="hover:bg-indigo-50/20 align-top">
                            <td className="p-2 text-center font-mono font-bold text-slate-700 bg-slate-50 border-r border-slate-200">
                              #{idx + 1}
                            </td>
                            <td className="p-2 border-r border-slate-200 space-y-1">
                              <select
                                aria-label={`Expense Category Line ${idx + 1}`}
                                value={expLine.expenseCategoryCode}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { expenseCategoryCode: e.target.value })
                                }
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold text-xs text-slate-800"
                              >
                                {eligibleExpenseCategories.map((cat) => (
                                  <option key={cat.categoryCode} value={cat.categoryCode}>
                                    {cat.categoryName} ({cat.categoryCode})
                                  </option>
                                ))}
                              </select>
                              <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                  SAP GL: {expLine.sapGlAccountCode || 'Unmapped'}
                                </span>
                                {expLine.sapCostCenterCode && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    Dim: {expLine.sapCostCenterCode}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <textarea
                                rows={2}
                                aria-label={`Expense Description Line ${idx + 1}`}
                                value={expLine.description}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { description: e.target.value })
                                }
                                placeholder="Describe independent non-inventory service/expense..."
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              {!costCentreDetermination.valid ||
                              costCentreDetermination.eligibleCostCentres.length === 0 ? (
                                <div
                                  aria-label={`Cost Centre Line ${idx + 1}`}
                                  className="p-1.5 rounded bg-rose-50 border border-rose-300 text-rose-800 text-[10px] font-bold leading-tight space-y-0.5"
                                >
                                  <div className="flex items-center gap-1 text-rose-700">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>No Cost Centre Mapped</span>
                                  </div>
                                  <div className="font-normal text-[9.5px] text-rose-700">
                                    Configure Cost Centre mapping for {department}.
                                  </div>
                                </div>
                              ) : costCentreDetermination.eligibleCostCentres.length > 1 ? (
                                <div className="space-y-1">
                                  <select
                                    aria-label={`Cost Centre Line ${idx + 1}`}
                                    value={
                                      expLine.costCentre ||
                                      costCentreDetermination.defaultCostCentreCode
                                    }
                                    onChange={(e) =>
                                      handleUpdateExpenseLine(idx, { costCentre: e.target.value })
                                    }
                                    className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-slate-800"
                                  >
                                    {costCentreDetermination.eligibleCostCentres.map((cc) => (
                                      <option key={cc.code} value={cc.code}>
                                        {cc.code} — {cc.name}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-[9.5px] font-semibold text-indigo-700">
                                    {costCentreDetermination.resolutionSource === 'EMPLOYEE_DEFAULT'
                                      ? `Default: ${costCentreDetermination.defaultCostCentreCode} (Employee Mapped)`
                                      : `${costCentreDetermination.eligibleCostCentres.length} Valid Cost Centres Mapped`}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  aria-label={`Cost Centre Line ${idx + 1}`}
                                  className="p-1.5 bg-slate-100 border border-slate-300 rounded space-y-0.5"
                                >
                                  <div className="font-mono font-bold text-xs text-slate-900 flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>
                                      {expLine.costCentre ||
                                        costCentreDetermination.eligibleCostCentres[0].code}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 leading-tight">
                                    {costCentreDetermination.eligibleCostCentres[0].name}
                                  </div>
                                  <div className="text-[9px] font-semibold text-emerald-700">
                                    {costCentreDetermination.resolutionSource === 'EMPLOYEE_DEFAULT'
                                      ? 'Auto: Employee Default'
                                      : 'Auto: Dept Master Mapped'}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="date"
                                aria-label={`Service From Date Line ${idx + 1}`}
                                required
                                value={expLine.serviceFromDate || ''}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { serviceFromDate: e.target.value })
                                }
                                className={`w-full p-1.5 bg-white border rounded font-mono text-xs text-slate-800 ${
                                  !expLine.serviceFromDate
                                    ? 'border-rose-400 bg-rose-50/40'
                                    : 'border-slate-300'
                                }`}
                              />
                              {!expLine.serviceFromDate && (
                                <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                  Service From Date is required
                                </div>
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="date"
                                aria-label={`Service To Date Line ${idx + 1}`}
                                required
                                min={expLine.serviceFromDate || undefined}
                                value={expLine.serviceToDate || ''}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { serviceToDate: e.target.value })
                                }
                                className={`w-full p-1.5 bg-white border rounded font-mono text-xs text-slate-800 ${
                                  !expLine.serviceToDate || hasDateRangeError
                                    ? 'border-rose-400 bg-rose-50/40'
                                    : 'border-slate-300'
                                }`}
                              />
                              {!expLine.serviceToDate ? (
                                <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                  Service To Date is required
                                </div>
                              ) : (
                                hasDateRangeError && (
                                  <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                    Cannot be earlier than Service From Date
                                  </div>
                                )
                              )}
                            </td>
                            <td className="p-2 border-r border-slate-200 space-y-1">
                              <input
                                type="number"
                                aria-label={`Expense Amount Line ${idx + 1}`}
                                value={expLine.amount}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, {
                                    amount: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-right text-xs text-slate-900"
                              />
                              <label className="flex items-center justify-end gap-1 text-[10px] text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(expLine.isTaxInclusive ?? expLine.taxInclusive)}
                                  onChange={(e) =>
                                    handleUpdateExpenseLine(idx, {
                                      isTaxInclusive: e.target.checked,
                                      taxInclusive: e.target.checked,
                                    })
                                  }
                                />
                                <span>Tax Inclusive</span>
                              </label>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-center">
                              <select
                                aria-label={`Expense Tax Rate Line ${idx + 1}`}
                                value={expLine.taxPercent ?? expLine.taxRatePercent ?? 18}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, {
                                    taxPercent: Number(e.target.value),
                                    taxRatePercent: Number(e.target.value),
                                  })
                                }
                                className="p-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                              <div className="text-[9px] font-mono text-slate-500 mt-1">
                                {expLine.taxCode}
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono space-y-0.5 bg-slate-50/60">
                              <div className="text-[10px] text-slate-600">
                                Base: <strong>{formatChargeAmount(expLine.baseAmount, currency)}</strong>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Tax: {formatChargeAmount(expLine.taxAmount, currency)}
                              </div>
                              <div className="text-xs font-extrabold text-indigo-900 border-t border-slate-200 pt-0.5">
                                {formatChargeAmount(
                                  Number(expLine.totalWithTax ?? expLine.totalAmountWithTax ?? expLine.totalAmount ?? 0),
                                  currency
                                )}
                              </div>
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <input
                                type="text"
                                aria-label={`Vendor Suggestion Line ${idx + 1}`}
                                value={expLine.vendorSuggestion || ''}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { vendorSuggestion: e.target.value })
                                }
                                placeholder="Optional agency/firm..."
                                className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs text-slate-700"
                              />
                            </td>
                            <td className="p-2 border-r border-slate-200 space-y-1.5">
                              <input
                                type="text"
                                aria-label={`Expense Purchase Purpose Line ${idx + 1}`}
                                value={expLine.purchasePurpose}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, { purchasePurpose: e.target.value })
                                }
                                placeholder="Mandatory Purchase Purpose *"
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900"
                              />
                              <input
                                type="text"
                                aria-label={`Expense Business Justification Line ${idx + 1}`}
                                value={expLine.businessJustification}
                                onChange={(e) =>
                                  handleUpdateExpenseLine(idx, {
                                    businessJustification: e.target.value,
                                  })
                                }
                                placeholder="Mandatory Business Justification *"
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700"
                              />
                            </td>
                            <td className="p-2 text-center align-middle">
                              {expenseLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExpenseLine(idx)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                  title="Remove expense line"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'LINES' && !isExpensePr && (
            <>
              {/* Item Lines Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-3 rounded-xl border border-slate-200 min-w-0">
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-slate-800 text-xs flex flex-wrap items-center gap-2">
                <span>PR Item Lines & Default Warehouses</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {lines.length} Line(s) Total
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Click, type, or double-click Item Code, Purchase Purpose, or Business Justification to open the expanded input popup editor.
              </p>
            </div>
            <button
              onClick={handleAddLine}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-xs transition text-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item Line
            </button>
          </div>

          {/* RESPONSIVE ITEM LINES: Cards on Mobile/Tablet (< 1024px), Full-Width High-Density Table on Desktop (>= 1024px) */}
          {!isDesktop ? (
            <div className="space-y-3 min-w-0">
              {lines.map((line, idx) => {
                const defaultWh = getDefaultWarehouse(line.itemCode, line.itemCategory);
                const attCount = (line.lineAttachments || []).length;
                const eligibleBuyers = BuyerService.getEligibleBuyers(selectedCompany.id, targetBranch.id, line.itemCategory);
                const lineCatError = invalidLineMap.get(idx);
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3.5 space-y-3 shadow-2xs min-w-0 ${
                      lineCatError ? 'bg-rose-50/70 border-rose-400' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 bg-slate-200 rounded font-mono font-bold text-slate-800 text-xs">
                          Line #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedItemEditorIdx(idx);
                            setItemSearchQuery(line.itemCode);
                          }}
                          className="font-mono font-bold text-indigo-700 hover:underline text-xs truncate cursor-pointer"
                        >
                          {line.itemCode}
                        </button>
                        {lineCatError && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold text-[10px]">
                            Category Invalid for {prType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-bold text-[11px]">
                          UOM: {line.inventoryUom}
                        </span>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="p-1 bg-rose-50 text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-slate-800">{line.description}</div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Req Qty
                        </label>
                        <input
                          type="number"
                          value={line.requestedQuantity}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value) || 0;
                            const updated = [...lines];
                            updated[idx].requestedQuantity = newQty;
                            if (updated[idx].deliverySchedules.length === 1) {
                              updated[idx].deliverySchedules[0].quantity = newQty;
                            }
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Unit Price ({currency})
                        </label>
                        <input
                          type="number"
                          value={line.approximateUnitPrice}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[idx].approximateUnitPrice = parseFloat(e.target.value) || 0;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Line Subtotal
                        </label>
                        <div className="px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg font-mono font-bold text-indigo-800 text-xs">
                          {currency} {(line.requestedQuantity * line.approximateUnitPrice).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                          Purchase Purpose *
                        </label>
                        <input
                          type="text"
                          value={line.purchasePurpose}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[idx].purchasePurpose = e.target.value;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600">
                        <span className="truncate">
                          WH: <strong>{defaultWh.split(' (')[0]}</strong>
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLineChargeSelectorError(null);
                              setActiveChargeLineIdx(idx);
                            }}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded border border-amber-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Coins className="w-3 h-3" />
                            {(line.lineCharges || []).filter((c) => c.applicability !== 'NOT_APPLICABLE').length > 0
                              ? `${(line.lineCharges || []).filter((c) => c.applicability !== 'NOT_APPLICABLE').length} Charge(s)`
                              : '+ Line Charge'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveAttachmentLineIdx(idx)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-bold text-[11px]"
                          >
                            {attCount} File(s)
                          </button>
                          <select
                            value={line.assignedBuyer?.id || ''}
                            onChange={(e) => {
                              const buyer = eligibleBuyers.find((b) => b.id === e.target.value) || null;
                              const updated = [...lines];
                              updated[idx].assignedBuyer = buyer;
                              setLines(updated);
                            }}
                            className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-bold"
                          >
                            <option value="">
                              {line.assignedBuyer ? line.assignedBuyer.buyerName : 'Select Buyer'}
                            </option>
                            {eligibleBuyers.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.buyerName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
            <div className="overflow-x-auto max-h-[44vh]">
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1728px]">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-44" />
                  <col className="w-48" />
                  <col className="w-16" />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-36" />
                  <col className="w-44" />
                  <col className="w-48" />
                  <col className="w-60" />
                  <col className="w-36" />
                  <col className="w-44" />
                  <col className="w-14" />
                </colgroup>
                <thead>
                  <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                    <th className="p-2.5 text-center border-r border-slate-800">Sl No.</th>
                    <th className="p-2.5 border-r border-slate-800">Item Code & Category</th>
                    <th className="p-2.5 border-r border-slate-800">Description (Item Master)</th>
                    <th className="p-2.5 text-center border-r border-slate-800">UOM</th>
                    <th className="p-2.5 text-right border-r border-slate-800">Req Qty</th>
                    <th className="p-2.5 text-right border-r border-slate-800">Unit Price ({getCurrencySymbol(currency).trim()})</th>
                    <th className="p-2.5 text-right border-r border-slate-800">Subtotal ({getCurrencySymbol(currency).trim()})</th>
                    <th className="p-2.5 border-r border-slate-800">Line Charge Items</th>
                    <th className="p-2.5 border-r border-slate-800">Delivery Schedule Splits</th>
                    <th className="p-2.5 border-r border-slate-800">Default Warehouse (Item-Based)</th>
                    <th className="p-2.5 border-r border-slate-800">
                      Purchase Purpose * & Business Justification
                      <span className="text-[9px] font-normal text-indigo-300 block font-sans">
                        💡 Double-click or click to enlarge
                      </span>
                    </th>
                    <th className="p-2.5 border-r border-slate-800">Item Attachments & Files</th>
                    <th className="p-2.5 border-r border-slate-800 w-44">Assigned Buyer (Override)</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lines.map((line, idx) => {
                    const totalScheduledQty = line.deliverySchedules.reduce((sum, s) => sum + (s.quantity || 0), 0);
                    const scheduleMatched = totalScheduledQty === line.requestedQuantity;
                    const defaultWh = getDefaultWarehouse(line.itemCode, line.itemCategory);
                    const attCount = (line.lineAttachments || []).length;
                    const activeLineCharges = (line.lineCharges || []).filter(
                      (c) => c.applicability !== 'NOT_APPLICABLE'
                    );
                    const lineChargesTotal = activeLineCharges.reduce(
                      (sum, c) => sum + (c.estimatedAmount || 0),
                      0
                    );
                    
                    const eligibleBuyers = BuyerService.getEligibleBuyers(selectedCompany.id, targetBranch.id, line.itemCategory);
                    const lineCatError = invalidLineMap.get(idx);

                    return (
                      <React.Fragment key={idx}>
                        <tr className={`hover:bg-indigo-50/30 transition align-top ${lineCatError ? 'bg-rose-50/80' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>


                          {/* 1. Sl No. Non-editable */}
                          <td className="p-2 text-center border-r border-slate-200 font-bold bg-slate-100 text-slate-700 font-mono w-14">
                            <span className="px-1.5 py-1 bg-slate-200 rounded text-[11px] block border border-slate-300">
                              #{idx + 1}
                            </span>
                          </td>

                          {/* 2. Item Code (Automatic Expanded Editor on Click/Type/Double-Click) */}
                          <td className="p-2 border-r border-slate-200 space-y-1 w-44">
                            <div className="relative">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-bold text-slate-700 truncate">Item Code</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedItemEditorIdx(idx);
                                    setItemSearchQuery(line.itemCode);
                                  }}
                                  className="text-[9px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-bold"
                                  title="Click to open enlarged Item Code selector"
                                >
                                  <Maximize2 className="w-2.5 h-2.5" /> Enlarge
                                </button>
                              </div>
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2 top-2 pointer-events-none" />
                                <input
                                  type="text"
                                  value={line.itemCode}
                                  onFocus={() => {
                                    setExpandedItemEditorIdx(idx);
                                    setItemSearchQuery(line.itemCode);
                                  }}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItemSearchQuery(val);
                                    setExpandedItemEditorIdx(idx);
                                  }}
                                  onDoubleClick={() => {
                                    setExpandedItemEditorIdx(idx);
                                    setItemSearchQuery(line.itemCode);
                                  }}
                                  placeholder="Click or type item code..."
                                  className={`w-full pl-7 pr-2 py-1.5 bg-white border rounded font-mono font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer ${
                                    lineCatError ? 'border-rose-400 text-rose-700' : 'border-indigo-200 text-indigo-700'
                                  }`}
                                  title="Click or type to open expanded item code selector modal"
                                />
                              </div>
                              <div className="flex items-center justify-between gap-1 mt-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border truncate max-w-full ${
                                    lineCatError
                                      ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  Cat: {line.itemCategory}
                                </span>
                                {lineCatError && (
                                  <span className="text-[9px] font-bold text-rose-700 shrink-0" title={lineCatError.reason}>
                                    Incompatible
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 3. Item Master Description (Locked - Auto Populated) */}
                          <td className="p-2 border-r border-slate-200 bg-slate-50/50 w-48">
                            <div className="p-2 bg-white rounded border border-slate-200 space-y-1">
                              <div className="font-semibold text-slate-800 text-[11px] leading-tight line-clamp-2">
                                {line.description}
                              </div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono border border-slate-300">
                                <Lock className="w-2.5 h-2.5 text-slate-400" /> Item Master Locked
                              </span>
                            </div>
                          </td>

                          {/* 4. Inventory UOM (Locked) */}
                          <td className="p-2 text-center border-r border-slate-200 font-bold w-16">
                            <span className="px-2 py-1.5 bg-slate-200 text-slate-800 rounded font-bold text-xs block border border-slate-300 cursor-not-allowed">
                              {line.inventoryUom}
                            </span>
                          </td>

                          {/* 5. Requested Qty */}
                          <td className="p-2 border-r border-slate-200 w-20">
                            <input
                              type="number"
                              value={line.requestedQuantity}
                              onChange={(e) => {
                                const newQty = parseFloat(e.target.value) || 0;
                                const updated = [...lines];
                                updated[idx].requestedQuantity = newQty;
                                if (updated[idx].deliverySchedules.length === 1) {
                                  updated[idx].deliverySchedules[0].quantity = newQty;
                                }
                                setLines(updated);
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          {/* 6. Approx Unit Price */}
                          <td className="p-2 border-r border-slate-200 w-24">
                            <input
                              type="number"
                              value={line.approximateUnitPrice}
                              onChange={(e) => {
                                const updated = [...lines];
                                updated[idx].approximateUnitPrice = parseFloat(e.target.value) || 0;
                                setLines(updated);
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>

                          {/* 7. Line Subtotal */}
                          <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-indigo-700 bg-indigo-50/20 text-xs w-28">
                            {formatChargeAmount(line.requestedQuantity * line.approximateUnitPrice, currency)}
                          </td>

                          {/* 7b. Line-Level Charge Items */}
                          <td className="p-2 border-r border-slate-200 align-middle w-36">
                            <div className="space-y-1 text-center">
                              <button
                                type="button"
                                aria-label={`Manage line charges for line ${idx + 1}`}
                                onClick={() => {
                                  setLineChargeSelectorError(null);
                                  setActiveChargeLineIdx(idx);
                                }}
                                className={`w-full px-2 py-1.5 font-bold rounded border flex items-center justify-center gap-1 text-[11px] transition shadow-2xs cursor-pointer ${
                                  activeLineCharges.length > 0
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                <Coins className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {activeLineCharges.length > 0
                                    ? `${activeLineCharges.length} Charge(s)`
                                    : '+ Add Charge'}
                                </span>
                              </button>
                              <div className="text-[9.5px] font-semibold text-slate-500">
                                {activeLineCharges.length > 0 ? (
                                  <span className="text-emerald-700 font-mono font-bold">
                                    +{formatChargeAmount(lineChargesTotal, currency)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Click to add charges</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 8. Delivery Schedule Splits */}
                          <td className="p-2 border-r border-slate-200 space-y-1.5 w-44">
                            <div className="flex items-center justify-between">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                scheduleMatched ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {scheduleMatched ? `Split Matched (${totalScheduledQty})` : `Mismatch (${totalScheduledQty}/${line.requestedQuantity})`}
                              </span>
                              <button
                                onClick={() => handleAddScheduleSplit(idx)}
                                className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10px] border border-indigo-200 flex items-center gap-0.5"
                              >
                                <Plus className="w-2.5 h-2.5" /> Split
                              </button>
                            </div>

                            <div className="space-y-1">
                              {line.deliverySchedules.map((sch, schIdx) => (
                                <div key={sch.id || schIdx} className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-[10px]">
                                  <input
                                    type="date"
                                    value={sch.deliveryDate}
                                    onChange={(e) => {
                                      const updated = [...lines];
                                      updated[idx].deliverySchedules[schIdx].deliveryDate = e.target.value;
                                      setLines(updated);
                                    }}
                                    className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium"
                                  />
                                  <input
                                    type="number"
                                    value={sch.quantity}
                                    onChange={(e) => {
                                      const updated = [...lines];
                                      updated[idx].deliverySchedules[schIdx].quantity = parseFloat(e.target.value) || 0;
                                      setLines(updated);
                                    }}
                                    className="w-16 px-1 py-0.5 bg-white border border-slate-200 rounded text-right font-bold text-[10px]"
                                  />
                                  {line.deliverySchedules.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveScheduleSplit(idx, schIdx)}
                                      className="text-rose-500 hover:text-rose-700 p-0.5 rounded ml-auto"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* 9. Branch Warehouse Master (Locked - Auto Assigned) */}
                          <td className="p-2 border-r border-slate-200 bg-slate-50/70 w-48">
                            <div className="p-2 bg-white rounded border border-slate-200 space-y-1">
                              <div className="flex items-center gap-1 text-slate-700 font-bold text-[11px]">
                                <Warehouse className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="truncate">{defaultWh.split(' (')[0]}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 leading-tight truncate">
                                {defaultWh.split(' (')[1]?.replace(')', '') || targetBranch.name}
                              </div>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded text-[9px] font-mono border border-emerald-200">
                                <Lock className="w-2.5 h-2.5 text-emerald-600" /> Default WH
                              </span>
                            </div>
                          </td>

                          {/* 10. Purchase Purpose * & Business Justification with AUTO-OPEN ENLARGED POPUP ON TYPE/FOCUS */}
                          <td className="p-2 border-r border-slate-200 space-y-1.5 w-60">
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-bold text-slate-700">Purchase Purpose *</span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedEditor({
                                    lineIdx: idx,
                                    field: 'purchasePurpose',
                                    title: `Line #${idx + 1} Mandatory Purchase Purpose`,
                                    itemCode: line.itemCode,
                                    value: line.purchasePurpose
                                  })}
                                  className="text-[9px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-bold"
                                  title="Click to open enlarged view"
                                >
                                  <Maximize2 className="w-2.5 h-2.5" /> Enlarge
                                </button>
                              </div>
                              <input
                                type="text"
                                value={line.purchasePurpose}
                                onFocus={() => setExpandedEditor({
                                  lineIdx: idx,
                                  field: 'purchasePurpose',
                                  title: `Line #${idx + 1} Mandatory Purchase Purpose`,
                                  itemCode: line.itemCode,
                                  value: line.purchasePurpose
                                })}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = [...lines];
                                  updated[idx].purchasePurpose = val;
                                  setLines(updated);
                                  setExpandedEditor({
                                    lineIdx: idx,
                                    field: 'purchasePurpose',
                                    title: `Line #${idx + 1} Mandatory Purchase Purpose`,
                                    itemCode: line.itemCode,
                                    value: val
                                  });
                                }}
                                onDoubleClick={() => setExpandedEditor({
                                  lineIdx: idx,
                                  field: 'purchasePurpose',
                                  title: `Line #${idx + 1} Mandatory Purchase Purpose`,
                                  itemCode: line.itemCode,
                                  value: line.purchasePurpose
                                })}
                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                placeholder="Type or click to open enlarged view..."
                                title="Click or type to open in enlarged view popup"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-bold text-slate-400">Business Justification</span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedEditor({
                                    lineIdx: idx,
                                    field: 'businessJustification',
                                    title: `Line #${idx + 1} Business Justification`,
                                    itemCode: line.itemCode,
                                    value: line.businessJustification
                                  })}
                                  className="text-[9px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-bold"
                                  title="Click to open enlarged view"
                                >
                                  <Maximize2 className="w-2.5 h-2.5" /> Enlarge
                                </button>
                              </div>
                              <input
                                type="text"
                                value={line.businessJustification}
                                onFocus={() => setExpandedEditor({
                                  lineIdx: idx,
                                  field: 'businessJustification',
                                  title: `Line #${idx + 1} Business Justification`,
                                  itemCode: line.itemCode,
                                  value: line.businessJustification
                                })}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = [...lines];
                                  updated[idx].businessJustification = val;
                                  setLines(updated);
                                  setExpandedEditor({
                                    lineIdx: idx,
                                    field: 'businessJustification',
                                    title: `Line #${idx + 1} Business Justification`,
                                    itemCode: line.itemCode,
                                    value: val
                                  });
                                }}
                                onDoubleClick={() => setExpandedEditor({
                                  lineIdx: idx,
                                  field: 'businessJustification',
                                  title: `Line #${idx + 1} Business Justification`,
                                  itemCode: line.itemCode,
                                  value: line.businessJustification
                                })}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                placeholder="Type or click to open enlarged view..."
                                title="Click or type to open in enlarged view popup"
                              />
                            </div>
                          </td>

                          {/* 11. Item-wise Multiple File Attachments & Viewing */}
                          <td className="p-2 border-r border-slate-200 align-middle w-36">
                            <div className="space-y-1 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveAttachmentLineIdx(idx)}
                                className="w-full px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 flex items-center justify-center gap-1.5 text-[11px] transition shadow-2xs"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{attCount} Attached File(s)</span>
                              </button>
                              <div className="text-[9.5px] font-semibold text-slate-500">
                                {attCount > 0 ? (
                                  <span className="text-emerald-700 font-bold">Click to view & add</span>
                                ) : (
                                  <span className="text-slate-400">Click to upload files</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 12. Buyer Override Dropdown */}
                          <td className="p-2 border-r border-slate-200 w-44">
                            <select
                              value={line.assignedBuyer?.id || ''}
                              onChange={(e) => {
                                const buyer = eligibleBuyers.find(b => b.id === e.target.value) || null;
                                const updated = [...lines];
                                updated[idx].assignedBuyer = buyer;
                                setLines(updated);
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">{line.assignedBuyer ? line.assignedBuyer.buyerName : 'Select Buyer'}</option>
                              {eligibleBuyers.map(b => (
                                <option key={b.id} value={b.id}>{b.buyerName}</option>
                              ))}
                            </select>
                          </td>
                          
                          {/* 13. Action Delete */}
                          <td className="p-2 text-center align-middle w-14">
                            {lines.length > 1 && (
                              <button
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                                title="Remove item line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
          </>
          )}

          {/* CHARGE ITEMS TAB (Only rendered for Inventory PRs; hidden on Expense Requisition screen) */}
          {activeTab === 'CHARGES' && !isExpensePr && (
            <div className="space-y-4 min-w-0">
              {/* Header and Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200 min-w-0">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    <span>Charge Items</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {chargesSummary.applicableChargesCount} Applicable
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select a charge item belonging to this Company &amp; Branch, enter its amount, and add it to this requisition.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncMappedTariffs}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Reset to Mandatory Policy Charges
                  </button>
                </div>
              </div>

              {/* Searchable Company/Branch Charge Item Selector + Amount Input */}
              <PrMappedChargesSelector
                effectiveOptions={effectiveMappedCharges}
                selectedChargeItems={chargeItems}
                companyName={selectedCompany.name}
                branchName={targetBranch.name}
                currency={currency}
                referenceSubtotal={totalEstimatedValue}
                title="Add PR Charge Item"
                onAddChargeOption={handleAddMappedCharge}
                onAddMultipleOptions={handleAddMultipleMappedCharges}
                errorNotice={chargeSelectorError}
                onDismissError={() => setChargeSelectorError(null)}
              />

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Items Net Subtotal</div>
                  <div className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.itemsSubtotal, currency)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Applicable Charges</div>
                  <div className="text-sm font-extrabold text-indigo-700 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.applicableChargesBaseTotal, currency)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {chargesSummary.lineChargesCount
                      ? `Header ${formatChargeAmount(chargesSummary.headerChargesBaseTotal || 0, currency)} + Line ${formatChargeAmount(chargesSummary.lineChargesBaseTotal || 0, currency)}`
                      : `${chargesSummary.applicableChargesCount} items active`}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Est. Tax on Charges</div>
                  <div className="text-sm font-extrabold text-slate-700 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.applicableChargesTaxTotal, currency)}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-800">Total Landed PR Value</div>
                  <div className="text-base font-extrabold text-indigo-900 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.grandTotalWithCharges, currency)}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium">Items + Charges + Tax</div>
                </div>
              </div>

              {/* Table / Cards for Selected Charge Items */}
              {chargeItems.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No header charge items attached yet. Select a charge item above, enter the amount, and click Add Charge Item.
                </div>
              ) : !isDesktop ? (
                <div className="space-y-3 min-w-0">
                  {chargeItems.map((ci) => {
                    const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                    const isFixed = ci.applicability === 'AS_PER_FIXED_CHARGES';
                    const isApp = ci.applicability === 'APPLICABLE';
                    const isActuals = isApp && ci.chargeType === 'AT_ACTUALS';
                    return (
                      <div
                        key={ci.id}
                        className={`bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-2xs ${
                          isNotApp ? 'opacity-60 bg-slate-50/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-slate-900">{ci.chargeName}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {ci.chargeCode} · {ci.category}
                              {ci.chargeMasterVersion ? ` · Master v${ci.chargeMasterVersion}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-extrabold text-indigo-900">
                              {isNotApp ? 'Exempt' : isActuals ? '—' : formatChargeAmount(ci.totalWithTax || 0, currency)}
                            </span>
                          </div>
                        </div>

                        {/* Applicability segmented button */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleUpdateChargeApplicability(ci.id, 'APPLICABLE')}
                            className={`flex-1 py-1 text-[11px] font-bold rounded ${
                              isApp ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                          >
                            Applicable
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateChargeApplicability(ci.id, 'AS_PER_FIXED_CHARGES')}
                            className={`flex-1 py-1 text-[11px] font-bold rounded ${
                              isFixed ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                          >
                            Fixed Charges
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateChargeApplicability(ci.id, 'NOT_APPLICABLE')}
                            className={`flex-1 py-1 text-[11px] font-bold rounded ${
                              isNotApp ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600'
                            }`}
                          >
                            Exempt / N/A
                          </button>
                        </div>

                        {isApp && (
                          <div className={`grid ${isActuals ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-xs`}>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Pricing Type</label>
                              <select
                                value={ci.chargeType}
                                onChange={(e) => handleUpdateChargeType(ci.id, e.target.value as PRChargeType)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs"
                              >
                                <option value="FIXED">Fixed ({getCurrencySymbol(currency).trim()})</option>
                                <option value="PERCENTAGE">% of Items</option>
                                <option value="AT_ACTUALS">At Actuals</option>
                              </select>
                            </div>
                            {!isActuals && (
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-1">Rate / Amount</label>
                                <input
                                  type="number"
                                  value={ci.rateOrPercentage}
                                  onChange={(e) => handleUpdateChargeRate(ci.id, Number(e.target.value) || 0)}
                                  className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono text-right"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {isFixed && (
                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                            <span className="font-bold">Tariff Rate: </span>
                            {ci.chargeType === 'PERCENTAGE'
                              ? `${ci.rateOrPercentage}% (${ci.fixedChargeDescription || 'Standard'})`
                              : formatChargeAmount(ci.fixedChargeRate || ci.rateOrPercentage, currency)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[46vh]">
                    <table className="w-full text-left text-xs border-collapse min-w-[1160px]">
                      <thead>
                        <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                          <th className="p-2.5 text-center border-r border-slate-800 w-10">#</th>
                          <th className="p-2.5 border-r border-slate-800 w-48">Charge Item & Category</th>
                          <th className="p-2.5 border-r border-slate-800 w-56">Applicability</th>
                          <th className="p-2.5 border-r border-slate-800 w-44">Rate / Tariff Basis</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-24">Base Amount</th>
                          <th className="p-2.5 text-center border-r border-slate-800 w-16">GST %</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-24">Total with Tax</th>
                          <th className="p-2.5 border-r border-slate-800 w-36">Payee / Entity</th>
                          <th className="p-2.5 border-r border-slate-800 min-w-[160px]">Remarks</th>
                          <th className="p-2.5 text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {chargeItems.map((ci, idx) => {
                          const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                          const isFixed = ci.applicability === 'AS_PER_FIXED_CHARGES';
                          const isApp = ci.applicability === 'APPLICABLE';
                          const isActuals = isApp && ci.chargeType === 'AT_ACTUALS';

                          return (
                            <tr
                              key={ci.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isNotApp ? 'opacity-60 bg-slate-50/30' : ''
                              }`}
                            >
                              <td className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="font-bold text-slate-900">{ci.chargeName}</div>
                                <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-slate-600">{ci.chargeCode}</span>
                                  <span>·</span>
                                  <span className="text-indigo-600 font-semibold">{ci.category}</span>
                                  {ci.sapExpenseCode && (
                                    <span className="px-1 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono">
                                      SAP:{ci.sapExpenseCode} (GL:{ci.sapGlAccountCode || '—'})
                                    </span>
                                  )}
                                  {ci.chargeMasterVersion && (
                                    <span className="font-mono text-slate-500">
                                      · Master v{ci.chargeMasterVersion}
                                      {ci.mappingVersion ? `/Map v${ci.mappingVersion}` : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateChargeApplicability(ci.id, 'APPLICABLE')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                                      isApp
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Applicable
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateChargeApplicability(ci.id, 'AS_PER_FIXED_CHARGES')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                                      isFixed
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Fixed Charges
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateChargeApplicability(ci.id, 'NOT_APPLICABLE')}
                                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                                      isNotApp
                                        ? 'bg-slate-700 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    Exempt / N/A
                                  </button>
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                {isFixed ? (
                                  <div>
                                    <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold text-[11px]">
                                      {ci.chargeType === 'PERCENTAGE'
                                        ? `${ci.rateOrPercentage}% (${ci.fixedChargeDescription || 'Tariff'})`
                                        : formatChargeAmount(ci.fixedChargeRate || ci.rateOrPercentage, currency)}
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]" title={ci.fixedChargeDescription}>
                                      {ci.fixedChargeDescription}
                                    </div>
                                  </div>
                                ) : isApp ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      aria-label="Charge Type"
                                      value={ci.chargeType}
                                      onChange={(e) => handleUpdateChargeType(ci.id, e.target.value as PRChargeType)}
                                      className="p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800"
                                    >
                                      <option value="FIXED">Fixed ({getCurrencySymbol(currency).trim()})</option>
                                      <option value="PERCENTAGE">% of Items</option>
                                      <option value="AT_ACTUALS">At Actuals</option>
                                    </select>
                                    {!isActuals && (
                                      <input
                                        type="number"
                                        aria-label="Charge Rate or Percentage"
                                        value={ci.rateOrPercentage}
                                        onChange={(e) => handleUpdateChargeRate(ci.id, Number(e.target.value) || 0)}
                                        className="w-20 p-1 text-[11px] font-mono border border-slate-300 rounded bg-white text-right text-slate-900"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Not applicable for this PR</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                                {isNotApp || isActuals ? '—' : formatChargeAmount(ci.estimatedAmount || 0, currency)}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200">
                                {isNotApp || isActuals ? (
                                  '—'
                                ) : (
                                  <select
                                    aria-label="GST Rate"
                                    value={ci.gstRatePercent ?? 18}
                                    onChange={(e) => handleUpdateChargeGst(ci.id, Number(e.target.value))}
                                    className="p-1 text-[11px] border border-slate-300 rounded bg-white font-mono text-slate-800"
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-extrabold text-indigo-900 border-r border-slate-200">
                                {isNotApp || isActuals ? '—' : formatChargeAmount(ci.totalWithTax || 0, currency)}
                              </td>
                              <td className="p-2.5 border-r border-slate-200 text-center">
                                {isNotApp || isActuals ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <select
                                    aria-label="Payee Type"
                                    value={ci.payeeType || 'SUPPLIER'}
                                    onChange={(e) => handleUpdateChargePayee(ci.id, e.target.value)}
                                    className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800"
                                  >
                                    <option value="SUPPLIER">Supplier (Inclusive/Bill)</option>
                                    <option value="THIRD_PARTY_LOGISTICS">3PL Transporter</option>
                                    <option value="CUSTOMS_AUTHORITY">Customs & Port Authority</option>
                                    <option value="DIRECT_LABOR">Direct Labor</option>
                                    <option value="SERVICE_PROVIDER">Service Agency</option>
                                  </select>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <input
                                  type="text"
                                  aria-label="Charge Remarks"
                                  disabled={isNotApp}
                                  value={ci.remarks || ''}
                                  onChange={(e) => handleUpdateChargeRemarks(ci.id, e.target.value)}
                                  placeholder="Optional notes / scope..."
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleResetChargeToFixedTariff(ci.id)}
                                    className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
                                    title="Reset to approved tariff"
                                  >
                                    Reset
                                  </button>
                                  {ci.mandateStatus !== 'MANDATORY' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCharge(ci.id)}
                                      className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Remove optional charge"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Charge Items Table Footer */}
                  <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-4">
                      <span>Items Subtotal: <span className="font-mono text-slate-900">{formatChargeAmount(chargesSummary.itemsSubtotal, currency)}</span></span>
                      <span>Applicable Charges: <span className="font-mono text-indigo-700">{formatChargeAmount(chargesSummary.applicableChargesBaseTotal, currency)}</span></span>
                      <span>Tax on Charges: <span className="font-mono text-slate-600">{formatChargeAmount(chargesSummary.applicableChargesTaxTotal, currency)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Total Landed PR Value:</span>
                      <span className="text-indigo-800 font-mono font-extrabold text-base">{formatChargeAmount(chargesSummary.grandTotalWithCharges, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Line-Level Charge Items Breakdown */}
              {lines.some((l) => (l.lineCharges || []).length > 0) && (
                <div className="rounded-xl border border-amber-200 overflow-hidden shadow-2xs bg-white">
                  <div className="px-3.5 py-2.5 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-950">Line-Level Charge Items</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {chargesSummary.lineChargesCount || 0} Applicable ({formatChargeAmount(chargesSummary.lineChargesBaseTotal || 0, currency)})
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800">Attached directly to individual PR item lines</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[820px]">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold text-[11px]">
                          <th className="p-2 border-r border-slate-700 w-36">Item Line</th>
                          <th className="p-2 border-r border-slate-700">Charge Item & Category</th>
                          <th className="p-2 border-r border-slate-700 w-36">Applicability</th>
                          <th className="p-2 text-right border-r border-slate-700 w-28">Base Amount</th>
                          <th className="p-2 text-center border-r border-slate-700 w-16">GST %</th>
                          <th className="p-2 text-right border-r border-slate-700 w-28">Total with Tax</th>
                          <th className="p-2 text-center w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {lines.flatMap((line, lineIdx) =>
                          (line.lineCharges || []).map((ci) => {
                            const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                            const isActuals = ci.applicability === 'APPLICABLE' && ci.chargeType === 'AT_ACTUALS';
                            return (
                              <tr key={`${lineIdx}-${ci.id}`} className={isNotApp ? 'opacity-60 bg-slate-50/50' : 'hover:bg-amber-50/30'}>
                                <td className="p-2 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-800">
                                  Line #{lineIdx + 1} · {line.itemCode || 'N/A'}
                                </td>
                                <td className="p-2 border-r border-slate-200">
                                  <div className="font-bold text-slate-900">{ci.chargeName}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{ci.chargeCode} · {ci.category}</div>
                                </td>
                                <td className="p-2 border-r border-slate-200 text-[11px] font-semibold text-slate-700">
                                  {ci.applicability === 'AS_PER_FIXED_CHARGES'
                                    ? 'Fixed Charges'
                                    : isActuals
                                    ? 'Applicable · At Actuals'
                                    : ci.applicability === 'APPLICABLE'
                                    ? 'Applicable'
                                    : 'Exempt / N/A'}
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                                  {isNotApp || isActuals ? '—' : formatChargeAmount(ci.estimatedAmount || 0, currency)}
                                </td>
                                <td className="p-2 text-center font-mono text-slate-700 border-r border-slate-200">
                                  {isNotApp || isActuals ? '—' : `${ci.gstRatePercent ?? 0}%`}
                                </td>
                                <td className="p-2 text-right font-mono font-extrabold text-indigo-900 border-r border-slate-200">
                                  {isNotApp || isActuals ? '—' : formatChargeAmount(ci.totalWithTax || 0, currency)}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLineChargeSelectorError(null);
                                      setActiveChargeLineIdx(lineIdx);
                                    }}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold text-[10px] cursor-pointer"
                                  >
                                    Manage
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Approval Workflow & Conditional Budget Validation Gate */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              {isBudgetEnabled ? (
                <>
                  <div className="font-bold text-slate-800 text-xs">Mandatory Budget Validation Gate</div>
                  <div className="text-[11px] text-slate-600">
                    {isExpensePr ? (
                      <>
                        Expense Base: {formatChargeAmount(expenseFinancials.expenseBaseTotal, currency)} + Tax:{' '}
                        {formatChargeAmount(expenseFinancials.expenseTaxTotal, currency)} (Total Expense PR Value:{' '}
                        {formatChargeAmount(expenseFinancials.totalExpensePrValue, currency)})
                      </>
                    ) : (
                      <>
                        Items: {formatChargeAmount(totalEstimatedValue, currency)}
                        {chargesSummary.applicableChargesCount > 0 &&
                          ` + Charges: ${formatChargeAmount(chargesSummary.applicableChargesBaseTotal, currency)}${
                            chargesSummary.applicableChargesTaxTotal > 0
                              ? ` + Tax: ${formatChargeAmount(chargesSummary.applicableChargesTaxTotal, currency)}`
                              : ''
                          } (Total: ${formatChargeAmount(chargesSummary.grandTotalWithCharges, currency)})`}
                      </>
                    )}
                  </div>
                  <div className="text-[11px] font-bold mt-0.5 flex flex-wrap items-center gap-2">
                    <span>
                      Status:{' '}
                      <span className={budgetStatus === 'SUFFICIENT' ? 'text-emerald-600' : budgetStatus === 'INSUFFICIENT' ? 'text-rose-600' : 'text-amber-600'}>
                        {budgetStatus}
                      </span>
                    </span>
                    {budgetCheckMessage && (
                      <span className="font-normal text-slate-600">• {budgetCheckMessage}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-slate-800 text-xs">
                    PR Valuation &amp; Approval Workflow ({effectiveGovernancePolicy.policyVersion})
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {isExpensePr ? (
                      <>
                        Total Expense PR Value: {formatChargeAmount(expenseFinancials.totalExpensePrValue, currency)} (Base:{' '}
                        {formatChargeAmount(expenseFinancials.expenseBaseTotal, currency)} + Tax:{' '}
                        {formatChargeAmount(expenseFinancials.expenseTaxTotal, currency)})
                      </>
                    ) : (
                      <>
                        Landed PR Value: {formatChargeAmount(chargesSummary.grandTotalWithCharges, currency)}
                      </>
                    )}{' '}
                    • Approval Route:{' '}
                    {approvalWorkflowPlan.enabled
                      ? `${approvalWorkflowPlan.requiredLevels} Level(s) (${approvalWorkflowPlan.currentTier?.approverRole || 'Approver'})`
                      : 'Workflow Bypassed'}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCheckDuplicates}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
              >
                Check Duplicates
              </button>

              {isBudgetEnabled && (
                <button
                  type="button"
                  onClick={handleRunBudgetValidation}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1 text-xs cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" /> Run Budget Check
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Validation / Governance Error Banner (Single Non-Contradictory Alert) */}
        {formError && (
          <div
            role="alert"
            className="mx-4 mt-2 mb-1 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs shrink-0"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-bold">{formError}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss validation error"
                onClick={() => setFormError(null)}
                className="text-rose-600 hover:text-rose-900 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => void handleSubmit(true)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition text-xs cursor-pointer"
          >
            Save as Draft
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearDraftSessionKey();
                onClose();
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit(false)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs transition text-xs cursor-pointer"
            >
              Submit PR
            </button>
          </div>
        </div>
      </div>

      {/* DOUBLE CLICK POPUP EXPANDED TEXT INPUT EDITOR MODAL */}
      {expandedEditor && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Expanded Editor Header */}
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                  {expandedEditor.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Item Code: <strong className="font-mono text-white">{expandedEditor.itemCode}</strong> — Type detailed notes in this enlarged editor.
                </p>
              </div>
              <button
                onClick={() => setExpandedEditor(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Expanded Editor Text Area Body */}
            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Detailed Input Field Content
              </label>
              <textarea
                rows={9}
                value={expandedEditor.value}
                onChange={(e) => setExpandedEditor({ ...expandedEditor, value: e.target.value })}
                placeholder="Enter detailed content here..."
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                autoFocus
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Character Count: <strong className="text-slate-700">{expandedEditor.value.length}</strong> chars</span>
                <span className="italic text-slate-400">Press Save & Apply to update line item</span>
              </div>
            </div>

            {/* Expanded Editor Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setExpandedEditor(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const updated = [...lines];
                  const { lineIdx, field, value } = expandedEditor;
                  updated[lineIdx][field] = value;
                  setLines(updated);
                  setExpandedEditor(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs text-xs"
              >
                Save & Apply to Line
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM-WISE MULTIPLE FILE ATTACHMENTS MANAGEMENT MODAL */}
      {activeAttachmentLineIdx !== null && lines[activeAttachmentLineIdx] && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden">
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                  Item Line #{activeAttachmentLineIdx + 1} Attachments ({lines[activeAttachmentLineIdx].itemCode})
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Attach multiple drawings, specifications, quality certificates or vendor quotes for this specific item.
                </p>
              </div>
              <button
                onClick={() => setActiveAttachmentLineIdx(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Upload Input Area */}
              <div className="p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 text-center space-y-2">
                <Upload className="w-6 h-6 text-indigo-600 mx-auto" />
                <div className="font-bold text-slate-800">Upload Multiple Files for {lines[activeAttachmentLineIdx].itemCode}</div>
                <p className="text-[11px] text-slate-500">Supports PDF, CAD Drawings (PNG/DWG), Specifications (DOCX), and Quality Certificates up to 25MB.</p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer transition shadow-xs">
                  <Plus className="w-3.5 h-3.5" /> Select Files to Upload
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleFileUploadForLine(activeAttachmentLineIdx, e)}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Existing Attached Files List */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>Attached Files ({(lines[activeAttachmentLineIdx].lineAttachments || []).length}):</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(lines[activeAttachmentLineIdx].lineAttachments || []).map((att) => (
                    <div key={att.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-800 text-xs truncate">{att.fileName}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{att.fileSize}</span>
                            <span>•</span>
                            <span className="font-mono">{att.fileType}</span>
                            <span>•</span>
                            <span>Uploaded: {att.uploadedAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* VIEW FILE OPTION */}
                        <button
                          type="button"
                          onClick={() => setPreviewFile(att)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1 text-[11px] transition shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttachmentNotice(`Prepared "${att.fileName}" (${att.fileSize}) for download.`)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLineAttachment(activeAttachmentLineIdx, att.id)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {(lines[activeAttachmentLineIdx].lineAttachments || []).length === 0 && (
                    <div className="text-center py-6 text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                      No file attachments uploaded for this item line yet. Click above to upload.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveAttachmentLineIdx(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LINE-LEVEL CHARGE ITEMS MODAL */}
      {activeChargeLineIdx !== null && lines[activeChargeLineIdx] && (() => {
        const targetLine = lines[activeChargeLineIdx];
        const lineSub = getLineSubtotal(activeChargeLineIdx);
        const lineChgs = targetLine.lineCharges || [];
        const lineChgSummary = prChargeItemService.calculateRequisitionChargesSummary(lineChgs, lineSub);

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-70 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-[90vh]">
              <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    Line #{activeChargeLineIdx + 1} — Line-Level Charge Items ({targetLine.itemCode})
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {targetLine.description} · Qty: {targetLine.requestedQuantity} {targetLine.inventoryUom} · Line Subtotal:{' '}
                    <strong className="font-mono text-white">{formatChargeAmount(lineSub, currency)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close line charges modal"
                  onClick={() => setActiveChargeLineIdx(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
                <PrMappedChargesSelector
                  effectiveOptions={effectiveMappedCharges}
                  selectedChargeItems={lineChgs}
                  companyName={selectedCompany.name}
                  branchName={targetBranch.name}
                  currency={currency}
                  referenceSubtotal={lineSub}
                  title={`Add Charge Item to Line #${activeChargeLineIdx + 1}`}
                  onAddChargeOption={(opt, customAmount) =>
                    handleAddLineMappedCharge(activeChargeLineIdx, opt, customAmount)
                  }
                  errorNotice={lineChargeSelectorError}
                  onDismissError={() => setLineChargeSelectorError(null)}
                />

                {lineChgs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                    No charge items attached to Line #{activeChargeLineIdx + 1} yet. Select a charge item above, enter its amount, and click Add Charge Item.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                        <thead>
                          <tr className="bg-[#0B192C] text-white font-bold text-[11px] border-b border-slate-800">
                            <th className="p-2 text-center border-r border-slate-800 w-10">#</th>
                            <th className="p-2 border-r border-slate-800">Charge Item</th>
                            <th className="p-2 border-r border-slate-800 w-44">Pricing &amp; Amount</th>
                            <th className="p-2 text-right border-r border-slate-800 w-24">Base</th>
                            <th className="p-2 text-center border-r border-slate-800 w-20">GST %</th>
                            <th className="p-2 text-right border-r border-slate-800 w-28">Total</th>
                            <th className="p-2 border-r border-slate-800">Remarks</th>
                            <th className="p-2 text-center w-14">Del</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lineChgs.map((ci, cIdx) => {
                            const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                            const isActuals = ci.applicability === 'APPLICABLE' && ci.chargeType === 'AT_ACTUALS';
                            return (
                              <tr key={ci.id} className={isNotApp ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'}>
                                <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200">
                                  {cIdx + 1}
                                </td>
                                <td className="p-2 border-r border-slate-200">
                                  <div className="font-bold text-slate-900">{ci.chargeName}</div>
                                  <div className="text-[10px] font-mono text-indigo-700">
                                    {ci.chargeCode} · {ci.category}
                                  </div>
                                </td>
                                <td className="p-2 border-r border-slate-200">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      aria-label={`Line charge type ${ci.chargeCode}`}
                                      value={ci.chargeType}
                                      onChange={(e) =>
                                        handleUpdateLineChargeField(activeChargeLineIdx, ci.id, {
                                          applicability: 'APPLICABLE',
                                          chargeType: e.target.value as PRChargeType,
                                        })
                                      }
                                      className="p-1 text-[11px] border border-slate-300 rounded bg-white"
                                    >
                                      <option value="FIXED">Fixed</option>
                                      <option value="PERCENTAGE">%</option>
                                      <option value="AT_ACTUALS">Actual</option>
                                    </select>
                                    {!isActuals && (
                                      <input
                                        type="number"
                                        aria-label={`Line charge amount ${ci.chargeCode}`}
                                        value={ci.rateOrPercentage}
                                        onChange={(e) =>
                                          handleUpdateLineChargeField(activeChargeLineIdx, ci.id, {
                                            applicability: 'APPLICABLE',
                                            rateOrPercentage: Number(e.target.value) || 0,
                                          })
                                        }
                                        className="w-20 p-1 text-[11px] font-mono border border-slate-300 rounded bg-white text-right"
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                                  {isNotApp || isActuals ? '—' : formatChargeAmount(ci.estimatedAmount || 0, currency)}
                                </td>
                                <td className="p-2 text-center border-r border-slate-200">
                                  {isNotApp || isActuals ? (
                                    '—'
                                  ) : (
                                    <select
                                      aria-label={`Line charge GST ${ci.chargeCode}`}
                                      value={ci.gstRatePercent ?? 18}
                                      onChange={(e) =>
                                        handleUpdateLineChargeField(activeChargeLineIdx, ci.id, {
                                          gstRatePercent: Number(e.target.value),
                                        })
                                      }
                                      className="p-1 text-[11px] border border-slate-300 rounded bg-white font-mono"
                                    >
                                      <option value={0}>0%</option>
                                      <option value={5}>5%</option>
                                      <option value={12}>12%</option>
                                      <option value={18}>18%</option>
                                      <option value={28}>28%</option>
                                    </select>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono font-extrabold text-indigo-900 border-r border-slate-200">
                                  {isNotApp || isActuals ? '—' : formatChargeAmount(ci.totalWithTax || 0, currency)}
                                </td>
                                <td className="p-2 border-r border-slate-200">
                                  <input
                                    type="text"
                                    aria-label={`Line charge remarks ${ci.chargeCode}`}
                                    value={ci.remarks || ''}
                                    onChange={(e) =>
                                      handleUpdateLineChargeField(activeChargeLineIdx, ci.id, {
                                        remarks: e.target.value,
                                      })
                                    }
                                    placeholder="Optional notes..."
                                    className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    aria-label={`Remove line charge ${ci.chargeCode}`}
                                    onClick={() => handleRemoveLineCharge(activeChargeLineIdx, ci.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
                <div className="flex flex-wrap items-center gap-4 font-bold text-slate-700">
                  <span>
                    Line Material: <span className="font-mono text-slate-900">{formatChargeAmount(lineSub, currency)}</span>
                  </span>
                  <span>
                    Line Charges ({lineChgSummary.applicableChargesCount}):{' '}
                    <span className="font-mono text-indigo-700">
                      {formatChargeAmount(lineChgSummary.applicableChargesBaseTotal, currency)}
                    </span>
                  </span>
                  <span>
                    Tax on Charges:{' '}
                    <span className="font-mono text-slate-600">
                      {formatChargeAmount(lineChgSummary.applicableChargesTaxTotal, currency)}
                    </span>
                  </span>
                  <span>
                    Line Landed Total:{' '}
                    <span className="font-mono text-indigo-900 text-sm">
                      {formatChargeAmount(lineChgSummary.grandTotalWithCharges, currency)}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveChargeLineIdx(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DOCUMENT & DRAWING PREVIEW VIEWER MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs z-80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  Document Viewer — {previewFile.fileName}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Size: {previewFile.fileSize} | Type: {previewFile.fileType} | Uploaded: {previewFile.uploadedAt}
                </p>
              </div>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex flex-col items-center justify-center min-h-[340px] space-y-4">
              <div className="w-full max-w-xl bg-white p-6 rounded-2xl border border-slate-300 shadow-md space-y-4 text-center">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 inline-block text-indigo-600">
                  <FileText className="w-12 h-12 mx-auto" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-base">{previewFile.fileName}</h5>
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs mt-1">
                    Verified Technical File Preview
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
                  This document contains official technical specifications, drawing dimensions, material standards (IS 2062 Gr E250), and vendor compliance parameters attached to this Purchase Requisition item line.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {attachmentNotice || 'Status: Authoritative Attachment Verified'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAttachmentNotice(`Prepared "${previewFile.fileName}" for download.`)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download Copy
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* EXPANDED ITEM CODE SEARCH & SELECTOR EDITOR MODAL */}
      {expandedItemEditorIdx !== null && lines[expandedItemEditorIdx] && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header with Company & Branch Context */}
            <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                  Line #{expandedItemEditorIdx + 1} — Expanded Item Code & Master Search
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                  <span className="px-2 py-0.5 bg-slate-800 rounded font-bold text-slate-200 border border-slate-700 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-400" /> {selectedCompany.name}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 rounded font-bold border border-indigo-800/60 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-400" /> {targetBranch.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setExpandedItemEditorIdx(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & List Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between text-xs">
                  <span>Type to Filter Company & Branch Items</span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    💡 Click any item below to select & close
                  </span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-indigo-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Type item code, description or category to search..."
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition shadow-2xs"
                    autoFocus
                  />
                </div>
              </div>

              {/* Items List (Strictly Filtered by Eligible Categories Mapped to Selected PR Type) */}
              {(() => {
                const filtered = prTypeBranchItems.filter((item) => {
                  if (!itemSearchQuery.trim()) return true;
                  const q = itemSearchQuery.toLowerCase().trim();
                  return (
                    item.globalItemCode.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    (item.categoryCode || '').toLowerCase().includes(q)
                  );
                });

                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-500">
                      <span>Eligible Branch Items for {prType} ({filtered.length})</span>
                      <span className="text-indigo-600 font-mono text-[10px]">
                        Mapped Categories: {eligibleCategories.map((c) => c.code).join(', ') || 'None'}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {filtered.map((item) => {
                        const isCurrentlySelected = lines[expandedItemEditorIdx]?.itemCode === item.globalItemCode;
                        const whName = getDefaultWarehouse(item.globalItemCode, item.categoryCode || 'General');

                        return (
                          <div
                            key={item.id || item.globalItemCode}
                            onClick={() => {
                              const updated = [...lines];
                              const idx = expandedItemEditorIdx;
                              updated[idx].itemCode = item.globalItemCode;
                              updated[idx].description = item.description;
                              updated[idx].itemCategory = item.categoryCode || 'OT';
                              updated[idx].inventoryUom = item.inventoryUom || 'NOS';
                              updated[idx].defaultWarehouse = whName;
                              setLines(updated);
                              setExpandedItemEditorIdx(null);
                            }}
                            className={`p-3.5 rounded-xl border cursor-pointer space-y-1.5 transition shadow-2xs ${
                              isCurrentlySelected
                                ? 'bg-indigo-50/90 border-indigo-400 ring-1 ring-indigo-400'
                                : 'bg-white hover:bg-indigo-50/40 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-indigo-700 text-xs flex items-center gap-2">
                                <Box className="w-3.5 h-3.5 text-indigo-500" />
                                {item.globalItemCode}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px] border border-slate-200">
                                {item.categoryCode || 'OT'}
                              </span>
                            </div>

                            <div className="font-semibold text-slate-800 text-xs leading-snug">
                              {item.description}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                              <span className="flex items-center gap-1 font-bold text-slate-700">
                                <Lock className="w-3 h-3 text-slate-400" /> UOM: <span className="text-indigo-800 font-mono">{item.inventoryUom || 'NOS'}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-medium text-slate-600 truncate">
                                <Warehouse className="w-3 h-3 text-emerald-600" /> WH: <span className="text-slate-800 font-bold">{whName.split(' (')[0]}</span>
                              </span>
                              {isCurrentlySelected && (
                                <span className="ml-auto px-2 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[9px]">
                                  Current Selection
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {filtered.length === 0 && (
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 space-y-1 px-4">
                          <p className="font-bold text-slate-700">
                            {itemSearchQuery.trim()
                              ? `No eligible items match "${itemSearchQuery}" under PR Type ${prType}`
                              : `No active branch items exist for eligible category (${eligibleCategories.map((c) => c.display).join(', ') || 'None'}) under PR Type ${prType}.`}
                          </p>
                          <p className="text-[11px]">
                            Categories exclusively mapped to other PR Types are hidden automatically.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                Target PR Line: <strong className="text-slate-800">#{expandedItemEditorIdx + 1}</strong>
              </span>
              <button
                onClick={() => setExpandedItemEditorIdx(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition"
              >
                Close Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

