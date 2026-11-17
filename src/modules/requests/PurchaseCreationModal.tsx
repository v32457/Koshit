/**
 * CIPPLATFORM - PURCHASE REQUISITION CREATION MODAL
 * Phase 1 PR Module: Handles creation across MRP, Manual, Repair, and Maintenance with inventory UOM lock, duplicate warning, and mandatory budget validation.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { User, Branch, Department, GlobalItem } from '../../types';
import { INITIAL_BRANCHES, INITIAL_GLOBAL_ITEMS } from '../../data/seedData';
import { PRType, PRPriority, PurchaseRequisitionHeader, PurchaseRequisitionLine, PRChargeItem, PRChargeApplicability, PRChargeType } from '../../types/purchaseRequisition';
import { EffectiveMappedChargeOption } from '../../types/chargeManagement';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { BuyerService } from '../../services/buyerService';
import { BuyerAssignmentRecord } from '../../types/buyerAssignment';
import { getBranchActiveItems } from '../../utils/branchItemHelper';
import { isValidIsoDate } from '../../services/prGridConfigService';
import { prGovernancePolicyService, normalizeCompanyId } from '../../services/prGovernancePolicyService';
import { prTypeMasterService } from '../../services/prTypeMasterService';
import { prChargeItemService, formatChargeAmount, getCurrencySymbol } from '../../services/prChargeItemService';
import { PrMappedChargesSelector } from './PrMappedChargesSelector';
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
    return activeDepartments[0]?.departmentName || 'Production & Operations';
  });

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
  const [priority, setPriority] = useState<PRPriority>('NORMAL');
  const [currency, setCurrency] = useState<string>('INR');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryLocation, setDeliveryLocation] = useState('Hosur Plant Store - Bay 2');
  const [costCentre, setCostCentre] = useState('CC-PROD-101');
  const [equipmentId, setEquipmentId] = useState('');

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

  // Initial Item Selection from Branch Item Master
  const firstMasterItem = branchAvailableItems[0] || {
    globalItemCode: 'RMPAOPOEXLG0001',
    description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    categoryCode: 'RM',
    inventoryUom: 'KG'
  };

  // 4. Item lines state: Auto-driven by Branch Item Master (No manual text entry for Item Code, Description, or Warehouse)
  const [lines, setLines] = useState<Array<{
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
  }>>([
    {
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
      ]
    }
  ]);

  const [budgetStatus, setBudgetStatus] = useState<'NOT_VALIDATED' | 'SUFFICIENT' | 'INSUFFICIENT'>('NOT_VALIDATED');
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [duplicateOverrideJustification, setDuplicateOverrideJustification] = useState('');

  const totalEstimatedValue = lines.reduce((acc, l) => acc + (l.requestedQuantity * l.approximateUnitPrice), 0);

  // Dedicated Tab for Item Lines vs Charge Items (Loading, Unloading, Customs Duty, Freight, etc.)
  const [activeTab, setActiveTab] = useState<'LINES' | 'CHARGES'>('LINES');

  // Effective Mapped Charges for active Company & Branch scope
  const effectiveMappedCharges = useMemo(
    () => prChargeItemService.getEffectiveMappedChargesForPR(selectedCompany.id, targetBranch.id),
    [selectedCompany.id, targetBranch.id, governanceTick]
  );

  const [chargeSelectorError, setChargeSelectorError] = useState<string | null>(null);

  // Charge Items State: auto-populated strictly from Company/Branch Mandatory mapped charges
  const [chargeItems, setChargeItems] = useState<PRChargeItem[]>(() => {
    const initialMapped = prChargeItemService.getEffectiveMappedChargesForPR(
      selectedCompany.id,
      targetBranch.id
    );
    return initialMapped
      .filter((opt: EffectiveMappedChargeOption) => opt.applicability === 'MANDATORY')
      .map((opt: EffectiveMappedChargeOption) =>
        prChargeItemService.createPrChargeFromMappedOption(opt, 30000, 'INR')
      );
  });

  // Synchronize charge items when Company or Branch changes: retain valid mapped items and enforce mandatory charges
  useEffect(() => {
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
  }, [effectiveMappedCharges]);

  // Recalculate selected charge items cleanly when line total or currency changes
  useEffect(() => {
    setChargeItems((prev) =>
      prChargeItemService.recalculateSelectedChargesOnly(prev, totalEstimatedValue, currency)
    );
  }, [totalEstimatedValue, currency]);

  const chargesSummary = useMemo(() => {
    return prChargeItemService.calculateRequisitionChargesSummary(chargeItems, totalEstimatedValue);
  }, [chargeItems, totalEstimatedValue]);

  const handleUpdateChargeApplicability = (chargeId: string, applicability: PRChargeApplicability) => {
    setChargeItems((prev) =>
      prev.map((item) => {
        if (item.id === chargeId) {
          const updated = { ...item, applicability };
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
          const updated = { ...item, chargeType };
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

  const handleAddMappedCharge = (option: EffectiveMappedChargeOption) => {
    setChargeSelectorError(null);
    try {
      setChargeItems((prev) =>
        prChargeItemService.addMappedChargeToPrList(prev, option, totalEstimatedValue, currency)
      );
    } catch (err: any) {
      setChargeSelectorError(err?.message || 'Unable to add selected charge.');
    }
  };

  const handleAddMultipleMappedCharges = (options: EffectiveMappedChargeOption[]) => {
    setChargeSelectorError(null);
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

  // Revalidate buyers when context changes
  React.useEffect(() => {
    setLines(prev => prev.map(l => ({
      ...l,
      assignedBuyer: BuyerService.getDefaultBuyer(selectedCompany.id, targetBranch.id, l.itemCategory) || null
    })));
  }, [selectedCompany.id, targetBranch.id]);

  const handleAddLine = () => {
    const slNo = lines.length + 1;
    const selectedItem = branchAvailableItems[slNo % branchAvailableItems.length] || branchAvailableItems[0] || firstMasterItem;
    const itemCode = selectedItem.globalItemCode;
    const category = selectedItem.categoryCode || 'Spares';
    setLines([...lines, {
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
      ]
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
    if (totalEstimatedValue <= 500000) {
      setBudgetStatus('SUFFICIENT');
    } else {
      setBudgetStatus('INSUFFICIENT');
    }
  };

  const handleCheckDuplicates = () => {
    if (lines.length > 0) {
      const found = PurchaseRequisitionService.checkForDuplicates(lines[0].itemCode, selectedCompany.id, targetBranch.id);
      setDuplicates(found);
    }
  };

  const handleSubmit = (isDraft: boolean) => {
    if (!effectiveGovernancePolicy.activation.prModuleEnabled) {
      alert(
        `Purchase Requisition module is disabled for ${effectiveGovernancePolicy.companyCode} / ${effectiveGovernancePolicy.branchName}.`
      );
      return;
    }
    if (!isDraft && !effectiveGovernancePolicy.activation.prSubmissionEnabled) {
      alert('PR Submission is currently disabled under the active governance policy.');
      return;
    }

    // Validate Expected Delivery Date based on policy
    if (isDeliveryDateEnabled) {
      if (isDeliveryDateMandatory && !isDraft && (!expectedDeliveryDate || !expectedDeliveryDate.trim())) {
        alert('Expected Delivery Date is mandatory under active company policy.');
        return;
      }
      if (expectedDeliveryDate && expectedDeliveryDate.trim() && !isValidIsoDate(expectedDeliveryDate)) {
        alert('Please enter a valid Expected Delivery Date in YYYY-MM-DD format.');
        return;
      }
    }

    // Validate line-level purchase purpose
    const missingLinePurposeIdx = lines.findIndex((l) => !l.purchasePurpose || !l.purchasePurpose.trim());
    if (missingLinePurposeIdx !== -1) {
      alert(`Please enter a mandatory Purchase Purpose for Item Line #${missingLinePurposeIdx + 1}.`);
      return;
    }

    if (
      !isDraft &&
      effectiveGovernancePolicy.activation.budgetValidationEnabled &&
      effectiveGovernancePolicy.budget.mandatoryBudgetCheck &&
      budgetStatus !== 'SUFFICIENT'
    ) {
      alert('Mandatory budget validation must be completed and sufficient before submission.');
      return;
    }

    const formattedLines: PurchaseRequisitionLine[] = lines.map((l, i) => ({
      id: `line-${Date.now()}-${i}`,
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
      purchasePurpose: l.purchasePurpose,
      businessJustification: l.businessJustification,
      deliverySchedules: l.deliverySchedules.map((sch) => ({
        id: sch.id,
        lineId: `line-${Date.now()}-${i}`,
        deliveryDate: sch.deliveryDate || (isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : ''),
        quantity: sch.quantity
      })),
      lineAttachments: l.lineAttachments,
      assignedBuyer: l.assignedBuyer?.buyerName || 'Default Procurement Buyer',
      buyerStatus: 'PENDING_CONFIGURATION',
      status: 'ACTIVE'
    }));

    const newPr = PurchaseRequisitionService.createPR({
      prType,
      companyId: selectedCompany.id,
      companyCode: selectedCompany.code,
      branchId: targetBranch.id,
      branchCode: targetBranch.portalBranchCode || '001',
      branchName: targetBranch.name,
      department,
      costCentre,
      requesterId: currentUser.id,
      requesterName: currentUser.fullName,
      creatorId: currentUser.id,
      creatorName: currentUser.fullName,
      modifiedBy: currentUser.fullName,
      priority,
      status: isDraft ? 'DRAFT' : 'PENDING_MANAGER_APPROVAL',
      purchasePurpose: lines[0]?.purchasePurpose || 'General Procurement',
      businessJustification: lines[0]?.businessJustification || '',
      deliveryLocation,
      estimatedTotalValue: totalEstimatedValue,
      chargeItems,
      chargesTotalValue: chargesSummary.applicableChargesBaseTotal,
      grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
      currency,
      expectedDeliveryDate: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
      requiredBy: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
      budgetValidationStatus: budgetStatus === 'SUFFICIENT' ? 'SUFFICIENT' : 'NOT_VALIDATED',
      budgetSourceRef: 'BUDGET-FY26-Q3-ALLOCATION',
      erpStockStatus: 'FRESH',
      erpStockTimestamp: new Date().toISOString(),
      equipmentId: (prType === 'REPAIR' || prType === 'MAINTENANCE') ? equipmentId : undefined,
      duplicateOverrideJustification: duplicateOverrideJustification.trim() || undefined,
      lines: formattedLines,
      changeHistory: [],
      attachments: []
    });

    if (!isDraft) {
      PurchaseRequisitionService.submitPR(newPr.id);
    }

    onSuccess();
    onClose();
  };

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleClose = () => {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
          onClose();
      }
  };

  const handleSaveDraft = () => {
      // Create a minimal draft header based on current state
      const draft: any = {
          id: `draft-${Date.now()}`,
          prType,
          branchName: targetBranch.name,
          requesterName: currentUser.fullName,
          currency,
          expectedDeliveryDate: isDeliveryDateEnabled && expectedDeliveryDate ? expectedDeliveryDate : undefined,
          status: 'DRAFT',
          lines: lines,
          chargeItems,
          chargesTotalValue: chargesSummary.applicableChargesBaseTotal,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges
      };
      PurchaseRequisitionService.saveDraft(draft);
      alert("Draft saved successfully.");
      onClose();
  };

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
              <label className="block font-bold text-slate-700 mb-1">
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

          {/* Duplicate PR warning banner if checked (Requirement G) */}
          {duplicates.length > 0 && !duplicateAcknowledged && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl space-y-2 text-amber-900 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Duplicate PR Governance Warning:</span> Found {duplicates.length} open PR(s) with identical item code in {targetBranch.name}.
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!duplicateOverrideJustification.trim()) {
                      alert('Please enter a Duplicate Override Justification before acknowledging.');
                      return;
                    }
                    setDuplicateAcknowledged(true);
                  }}
                  className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded hover:bg-amber-500 text-xs cursor-pointer"
                >
                  Acknowledge & Record Justification
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-800 mb-1">
                  Mandatory Duplicate Override Justification *
                </label>
                <input
                  type="text"
                  placeholder="Enter business reason for creating a new PR despite existing open PR..."
                  value={duplicateOverrideJustification}
                  onChange={(e) => setDuplicateOverrideJustification(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {/* TABS: PR Item Lines vs Charge Items */}
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
              <span>PR Item Lines & Deliverables</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                {lines.length}
              </span>
            </button>

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
              <span>Charge Items (Loading, Customs, Freight & Landed Costs)</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  chargesSummary.applicableChargesCount > 0
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {chargesSummary.applicableChargesCount} Applicable
              </span>
            </button>
          </div>

          {activeTab === 'LINES' && (
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
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-2xs min-w-0"
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
                        <div className="flex items-center gap-2">
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
              <table className="w-full text-left text-xs border-collapse table-fixed min-w-[1584px]">
                <colgroup>
                  <col className="w-14" />
                  <col className="w-44" />
                  <col className="w-48" />
                  <col className="w-16" />
                  <col className="w-20" />
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-44" />
                  <col className="w-48" />
                  <col className="w-60" />
                  <col className="w-36" />
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
                    
                    const eligibleBuyers = BuyerService.getEligibleBuyers(selectedCompany.id, targetBranch.id, line.itemCategory);

                    return (
                      <React.Fragment key={idx}>
                        <tr className={`hover:bg-indigo-50/30 transition align-top ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>


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
                                  className="w-full pl-7 pr-2 py-1.5 bg-white border border-indigo-200 rounded font-mono font-bold text-indigo-700 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                                  title="Click or type to open expanded item code selector modal"
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200 truncate max-w-full">
                                  Cat: {line.itemCategory}
                                </span>
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

          {/* CHARGE ITEMS TAB (Loading, Unloading, Customs Duty, Freight, etc.) */}
          {activeTab === 'CHARGES' && (
            <div className="space-y-4 min-w-0">
              {/* Header and Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200 min-w-0">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    <span>Charge Items (Loading, Unloading, Customs Duty, Freight, etc.)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {chargesSummary.applicableChargesCount} Applicable
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Specify whether each non-inventory charge is Applicable (custom rate/percentage), As Per Fixed Charges tariff, or Exempt.
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

              {/* Searchable Company/Branch Effective Mapped Charges Selector */}
              <PrMappedChargesSelector
                effectiveOptions={effectiveMappedCharges}
                selectedChargeItems={chargeItems}
                companyName={selectedCompany.name}
                branchName={targetBranch.name}
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
                  <div className="text-[10px] text-slate-400">{chargesSummary.applicableChargesCount} items active</div>
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
                  <div className="text-[10px] text-indigo-600 font-medium">Items + Applicable Charges</div>
                </div>
              </div>

              {/* Table / Cards for Selected Charge Items */}
              {chargeItems.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No charge items attached to this requisition yet. Select active mapped charges from the catalog above.
                </div>
              ) : !isDesktop ? (
                <div className="space-y-3 min-w-0">
                  {chargeItems.map((ci) => {
                    const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                    const isFixed = ci.applicability === 'AS_PER_FIXED_CHARGES';
                    const isApp = ci.applicability === 'APPLICABLE';
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
                              {isNotApp ? 'Exempt' : formatChargeAmount(ci.totalWithTax || 0, currency)}
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
                          <div className="grid grid-cols-2 gap-2 text-xs">
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
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">Rate / Amount</label>
                              <input
                                type="number"
                                value={ci.rateOrPercentage}
                                onChange={(e) => handleUpdateChargeRate(ci.id, Number(e.target.value) || 0)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono text-right"
                              />
                            </div>
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
                    <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                      <thead>
                        <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                          <th className="p-2.5 text-center border-r border-slate-800 w-12">#</th>
                          <th className="p-2.5 border-r border-slate-800 w-64">Charge Item & Category</th>
                          <th className="p-2.5 border-r border-slate-800 w-64">Applicability</th>
                          <th className="p-2.5 border-r border-slate-800 w-56">Rate / Tariff Basis</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-28">Base Amount</th>
                          <th className="p-2.5 text-center border-r border-slate-800 w-24">GST %</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-32">Total with Tax</th>
                          <th className="p-2.5 border-r border-slate-800 w-44">Payee / Entity</th>
                          <th className="p-2.5 border-r border-slate-800">Remarks</th>
                          <th className="p-2.5 text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {chargeItems.map((ci, idx) => {
                          const isNotApp = ci.applicability === 'NOT_APPLICABLE';
                          const isFixed = ci.applicability === 'AS_PER_FIXED_CHARGES';
                          const isApp = ci.applicability === 'APPLICABLE';

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
                                    <input
                                      type="number"
                                      aria-label="Charge Rate or Percentage"
                                      value={ci.rateOrPercentage}
                                      onChange={(e) => handleUpdateChargeRate(ci.id, Number(e.target.value) || 0)}
                                      className="w-20 p-1 text-[11px] font-mono border border-slate-300 rounded bg-white text-right text-slate-900"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">Not applicable for this PR</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                                {isNotApp ? '—' : formatChargeAmount(ci.estimatedAmount || 0, currency)}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200">
                                {isNotApp ? (
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
                                {isNotApp ? '—' : formatChargeAmount(ci.totalWithTax || 0, currency)}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                <select
                                  aria-label="Payee Type"
                                  disabled={isNotApp}
                                  value={ci.payeeType || 'SUPPLIER'}
                                  onChange={(e) => handleUpdateChargePayee(ci.id, e.target.value)}
                                  className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="SUPPLIER">Supplier (Inclusive/Bill)</option>
                                  <option value="THIRD_PARTY_LOGISTICS">3PL Transporter</option>
                                  <option value="CUSTOMS_AUTHORITY">Customs & Port Authority</option>
                                  <option value="DIRECT_LABOR">Direct Labor</option>
                                  <option value="SERVICE_PROVIDER">Service Agency</option>
                                </select>
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
            </div>
          )}


          {/* Budget Validation Gate */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800 text-xs">Mandatory Budget Validation Gate</div>
              <div className="text-[11px] text-slate-600">
                Items: {formatChargeAmount(totalEstimatedValue, currency)}
                {chargesSummary.applicableChargesCount > 0 && ` + Charges: ${formatChargeAmount(chargesSummary.applicableChargesBaseTotal, currency)} (Total: ${formatChargeAmount(chargesSummary.grandTotalWithCharges, currency)})`}
              </div>
              <div className="text-[11px] font-bold mt-0.5">
                Status:{' '}
                <span className={budgetStatus === 'SUFFICIENT' ? 'text-emerald-600' : 'text-amber-600'}>
                  {budgetStatus}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCheckDuplicates}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs"
              >
                Check Duplicates
              </button>

              <button
                onClick={handleRunBudgetValidation}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1 text-xs"
              >
                <ShieldCheck className="w-4 h-4" /> Run Budget Check
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => handleSubmit(true)}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition text-xs"
          >
            Save as Draft
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs">
              Cancel
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={budgetStatus !== 'SUFFICIENT'}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs transition text-xs ${
                budgetStatus !== 'SUFFICIENT' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Submit PR (Manager L1)
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
                          onClick={() => alert(`Downloading file "${att.fileName}"...`)}
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
              <span className="text-xs text-slate-500 font-medium">Status: Authoritative Attachment Verified</span>
              <div className="flex gap-2">
                <button
                  onClick={() => alert(`Downloading ${previewFile.fileName}...`)}
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

              {/* Items List */}
              {(() => {
                const filtered = branchAvailableItems.filter((item) => {
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
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>Available Branch Items ({filtered.length})</span>
                      <span className="text-slate-400 italic">Showing active items for {targetBranch.shortName || 'Branch'}</span>
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
                              updated[idx].itemCategory = item.categoryCode || 'General';
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
                                {item.categoryCode || 'General'}
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
                        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 space-y-1">
                          <p className="font-bold text-slate-600">No items match "{itemSearchQuery}"</p>
                          <p className="text-[11px]">Try searching by item code prefix (e.g. RM, SPARE) or description keywords.</p>
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

