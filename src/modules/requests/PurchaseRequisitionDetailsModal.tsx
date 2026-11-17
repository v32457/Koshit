/**
 * CIPPLATFORM - PURCHASE REQUISITION DETAILS, GOVERNANCE, EDIT, SHORT CLOSE, CANCEL & APPROVAL MODAL
 * Dynamically enforces Multi-Company / Multi-Branch PR Governance Policies:
 * - Header & Line-Level Locking (Converted lines locked; Approved headers immutable; Pending locked)
 * - Return for Correction & Resubmission under the same PR Number (creating a new approval cycle)
 * - Short Close & Cancellation with automated Uncommitted Budget Reconciliation & Release
 */

import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import {
  PurchaseRequisitionHeader,
  PRPriority,
  PRChargeItem,
  PRChargeApplicability,
  PRChargeType,
} from '../../types/purchaseRequisition';
import { EffectiveMappedChargeOption } from '../../types/chargeManagement';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { prGovernancePolicyService } from '../../services/prGovernancePolicyService';
import { prChargeItemService, formatChargeAmount, getCurrencySymbol } from '../../services/prChargeItemService';
import { PrMappedChargesSelector } from './PrMappedChargesSelector';
import { prRfqConversionService } from '../../services/prRfqConversionService';
import { inventoryValidationService } from '../../services/inventoryValidationService';
import { prAgingService } from '../../services/prAgingService';
import { rbacPermissionService } from '../../services/rbacPermissionService';
import { budgetControlService } from '../../services/budgetControlService';
import { financialYearService } from '../../services/financialYearService';
import { EnterpriseAuditService } from '../../services/enterpriseAuditService';
import {
  formatEstimatedValue,
  getExpectedDeliveryDate,
  getModifiedBy,
  getPrCurrency,
  isValidIsoDate,
} from '../../services/prGridConfigService';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  Edit3,
  Calendar,
  Coins,
  Save,
  Lock,
  Shield,
  Send,
  Archive,
  Ban,
  Package,
  AlertTriangle,
  History,
  RefreshCw,
  ArrowRightLeft,
  Clock,
  Building2,
  Printer,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  downloadPurchaseRequisitionPdf,
  printPurchaseRequisitionPdf,
  isPrStatusApproved,
  dataUriToPdfBlob,
} from '../../services/prPdfExportService';
import { EnterpriseModal } from '../../components/EnterpriseModal';

interface PurchaseRequisitionDetailsModalProps {
  pr: PurchaseRequisitionHeader;
  currentUser: User;
  onClose: () => void;
  onUpdated: () => void;
}

export const PurchaseRequisitionDetailsModal: React.FC<PurchaseRequisitionDetailsModalProps> = ({
  pr,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const [remarks, setRemarks] = useState('');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [newPurpose, setNewPurpose] = useState(pr.purchasePurpose);
  const [newExpectedDeliveryDate, setNewExpectedDeliveryDate] = useState(
    getExpectedDeliveryDate(pr)
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Governance Closure Modal State ('SHORT_CLOSE' | 'CANCEL' | null)
  const [closureActionType, setClosureActionType] = useState<'SHORT_CLOSE' | 'CANCEL' | null>(null);
  const [closureReason, setClosureReason] = useState('');
  const [closureRemarks, setClosureRemarks] = useState('');
  const [selectedClosureLineIds, setSelectedClosureLineIds] = useState<string[]>(() =>
    pr.lines.map((l) => l.id)
  );
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  // Editable PR Header & Lines State
  const [editPriority, setEditPriority] = useState<PRPriority>(pr.priority);
  const [editDepartment, setEditDepartment] = useState<string>(pr.department);
  const [editCurrency, setEditCurrency] = useState<string>(getPrCurrency(pr));
  const [editExpectedDeliveryDate, setEditExpectedDeliveryDate] = useState<string>(
    getExpectedDeliveryDate(pr)
  );
  const [editPurpose, setEditPurpose] = useState<string>(pr.purchasePurpose);
  const [lines, setLines] = useState(pr.lines);
  const [activeTab, setActiveTab] = useState<'LINES' | 'CHARGES'>('LINES');
  const [chargeItems, setChargeItems] = useState<PRChargeItem[]>(() =>
    pr.chargeItems && pr.chargeItems.length > 0 ? pr.chargeItems : []
  );
  const [editError, setEditError] = useState<string | null>(null);

  // Authoritative Effective Policy & Line Conversion Summaries
  const effectivePolicy = useMemo(
    () => prGovernancePolicyService.getEffectivePolicy(pr.companyId, pr.branchId),
    [pr.companyId, pr.branchId]
  );

  const convertedQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of pr.lines) {
      const summary = prRfqConversionService.getSummaryForPrLine(
        line.id,
        line.requestedQuantity,
        line.inventoryUom,
        pr.prNumber,
        line.itemCode
      );
      map[line.id] = Math.max(
        summary.convertedQtyInvUom,
        Number(line.convertedRfqQuantity || 0) + Number(line.convertedPoQuantity || 0)
      );
    }
    return map;
  }, [pr]);

  const budgetRecon = useMemo(
    () => prGovernancePolicyService.calculateBudgetReconciliation(pr, convertedQtyMap),
    [pr, convertedQtyMap]
  );

  // Historical Financial Year / Closed Accounting Period Lock Guard (Requirement 10 & 11)
  const fyMutationGuard = useMemo(
    () =>
      financialYearService.evaluateHistoricalRecordMutationGuard({
        companyId: pr.companyId,
        financialYearId: pr.financialYearId,
        accountingPostingDate: pr.accountingPostingDate,
        documentDate: pr.createdAt?.slice(0, 10),
        actionLabel: 'Modify / Approve / Close PR',
      }),
    [pr.companyId, pr.financialYearId, pr.accountingPostingDate, pr.createdAt]
  );
  const isHistoricalLocked = !fyMutationGuard.allowed;

  // Part K & Part L Live Snapshots & Exception States
  const [governanceTick, setGovernanceTick] = useState(0);
  const [invExceptionReason, setInvExceptionReason] = useState('');
  const [bgtExceptionReason, setBgtExceptionReason] = useState('');

  const [partKTab, setPartKTab] = useState<'CONTEXT' | 'WAREHOUSE' | 'STOCK_AGING' | 'COMPANY_WIDE' | 'PR_AGING'>('WAREHOUSE');
  const [transferReason, setTransferReason] = useState('');

  const inventorySnapshot = useMemo(
    () =>
      pr.inventoryValidationSnapshot ||
      inventoryValidationService.validateTransactionInventory({
        prId: pr.id,
        prNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        stage: 'ON_PR_APPROVAL',
        validatedBy: currentUser.fullName,
        user: currentUser,
        lines: pr.lines.map((l) => ({
          id: l.id,
          itemCode: l.itemCode,
          description: l.description,
          itemCategory: l.itemCategory,
          inventoryUom: l.inventoryUom,
          requestedQuantity: l.requestedQuantity,
          originalRequestedQuantity: l.originalApprovedQuantity ?? l.requestedQuantity,
          defaultWarehouse: l.defaultWarehouse,
        })),
        transactionDate: pr.createdAt?.slice(0, 10),
      }),
    [pr, currentUser, governanceTick]
  );

  const prAgingEval = useMemo(
    () => prAgingService.evaluatePrAging(pr, { includeHistoricalClosed: true }),
    [pr, governanceTick]
  );

  const prTransfers = useMemo(
    () =>
      inventoryValidationService
        .getTransfers()
        .filter(
          (t) =>
            t.companyId === pr.companyId &&
            (t.prId === pr.id ||
              t.prNumber === pr.prNumber ||
              pr.lines.some((l) => l.itemCode === t.itemCode))
        ),
    [pr, governanceTick]
  );

  const canViewCrossBranchStock = useMemo(
    () => rbacPermissionService.hasPermission(currentUser, 'INVENTORY_CROSS_BRANCH_STOCK_VIEW'),
    [currentUser]
  );

  const budgetControlSnapshot = useMemo(
    () =>
      pr.budgetValidationSnapshot ||
      budgetControlService.validateBudgetAtStage({
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        sourceChainId: pr.prNumber,
        stage: 'PR_APPROVAL',
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        costCenter: pr.costCentre || 'CC-PROD-101',
        financialYear: pr.financialYearCode || pr.financialPeriod,
        proposedAmount: pr.estimatedTotalValue,
        validatedBy: currentUser.fullName,
        transactionDate: pr.createdAt?.slice(0, 10),
      }),
    [pr, currentUser.fullName, governanceTick]
  );

  const prAuditLogs = useMemo(
    () =>
      EnterpriseAuditService.getAuditLogs({ searchQuery: pr.prNumber }).filter(
        (l) => l.entityId === pr.id || l.entityId === pr.prNumber || l.relatedPrId === pr.id
      ),
    [pr.id, pr.prNumber, governanceTick]
  );

  // Evaluate governed action permissions
  const canEditHeader = prGovernancePolicyService.evaluatePrAction({
    action: 'EDIT_PR_HEADER',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canSubmitDraft = prGovernancePolicyService.evaluatePrAction({
    action: 'SUBMIT_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canResubmit = prGovernancePolicyService.evaluatePrAction({
    action: 'RESUBMIT_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canApprove = prGovernancePolicyService.evaluatePrAction({
    action: 'APPROVE_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canReturn = prGovernancePolicyService.evaluatePrAction({
    action: 'RETURN_FOR_CORRECTION',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canWithdraw = prGovernancePolicyService.evaluatePrAction({
    action: 'WITHDRAW_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canShortClose = prGovernancePolicyService.evaluatePrAction({
    action: 'SHORT_CLOSE_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const canCancel = prGovernancePolicyService.evaluatePrAction({
    action: 'CANCEL_PR',
    companyId: pr.companyId,
    branchId: pr.branchId,
    user: currentUser,
    pr,
  });

  const handleToggleMaximize = () => setIsMaximized(!isMaximized);
  const handleToggleMinimize = () => setIsMinimized(!isMinimized);

  const calculatedTotalValue = lines.reduce(
    (sum, l) => sum + (Number(l.requestedQuantity) || 0) * (Number(l.approximateUnitPrice) || 0),
    0
  );

  const effectiveMappedCharges = useMemo(
    () => prChargeItemService.getEffectiveMappedChargesForPR(pr.companyId, pr.branchId),
    [pr.companyId, pr.branchId, governanceTick]
  );

  const [chargeSelectorError, setChargeSelectorError] = useState<string | null>(null);

  const displayedChargeItems = useMemo(() => {
    if (isEditMode) {
      return chargeItems.length > 0
        ? prChargeItemService.recalculateSelectedChargesOnly(chargeItems, calculatedTotalValue, editCurrency)
        : [];
    }
    return pr.chargeItems && pr.chargeItems.length > 0 ? pr.chargeItems : [];
  }, [isEditMode, chargeItems, calculatedTotalValue, editCurrency, pr.chargeItems]);

  const chargesSummary = useMemo(() => {
    const subtotal = isEditMode ? calculatedTotalValue : pr.estimatedTotalValue;
    return prChargeItemService.calculateRequisitionChargesSummary(displayedChargeItems, subtotal);
  }, [displayedChargeItems, isEditMode, calculatedTotalValue, pr.estimatedTotalValue]);

  const handleUpdateChargeApplicability = (chargeId: string, applicability: PRChargeApplicability) => {
    setChargeItems((prev) =>
      prev.map((item) =>
        item.id === chargeId
          ? prChargeItemService.calculateChargeItem({ ...item, applicability }, calculatedTotalValue)
          : item
      )
    );
  };

  const handleUpdateChargeType = (chargeId: string, chargeType: PRChargeType) => {
    setChargeItems((prev) =>
      prev.map((item) =>
        item.id === chargeId
          ? prChargeItemService.calculateChargeItem({ ...item, chargeType }, calculatedTotalValue)
          : item
      )
    );
  };

  const handleUpdateChargeRate = (chargeId: string, rateOrPercentage: number) => {
    setChargeItems((prev) =>
      prev.map((item) =>
        item.id === chargeId
          ? prChargeItemService.calculateChargeItem({ ...item, rateOrPercentage }, calculatedTotalValue)
          : item
      )
    );
  };

  const handleUpdateChargeGst = (chargeId: string, gstRatePercent: number) => {
    setChargeItems((prev) =>
      prev.map((item) =>
        item.id === chargeId
          ? prChargeItemService.calculateChargeItem({ ...item, gstRatePercent }, calculatedTotalValue)
          : item
      )
    );
  };

  const handleUpdateChargePayee = (chargeId: string, payeeType: PRChargeItem['payeeType']) => {
    setChargeItems((prev) =>
      prev.map((item) => (item.id === chargeId ? { ...item, payeeType } : item))
    );
  };

  const handleUpdateChargeRemarks = (chargeId: string, remarksVal: string) => {
    setChargeItems((prev) =>
      prev.map((item) => (item.id === chargeId ? { ...item, remarks: remarksVal } : item))
    );
  };

  const handleResetChargeToFixedTariff = (chargeId: string) => {
    setChargeItems((prev) =>
      prev.map((item) =>
        item.id === chargeId
          ? prChargeItemService.resetToFixedTariff(item, calculatedTotalValue)
          : item
      )
    );
  };

  const handleSyncMandatoryCharges = () => {
    setChargeSelectorError(null);
    const mandatory = effectiveMappedCharges
      .filter((opt: EffectiveMappedChargeOption) => opt.applicability === 'MANDATORY')
      .map((opt: EffectiveMappedChargeOption) =>
        prChargeItemService.createPrChargeFromMappedOption(opt, calculatedTotalValue, editCurrency)
      );
    setChargeItems(mandatory);
  };

  const handleAddMappedCharge = (option: EffectiveMappedChargeOption) => {
    setChargeSelectorError(null);
    try {
      setChargeItems((prev) =>
        prChargeItemService.addMappedChargeToPrList(prev, option, calculatedTotalValue, editCurrency)
      );
    } catch (err: any) {
      setChargeSelectorError(err?.message || 'Unable to add charge.');
    }
  };

  const handleAddMultipleMappedCharges = (options: EffectiveMappedChargeOption[]) => {
    setChargeSelectorError(null);
    setChargeItems((prev) => {
      let next = prev;
      for (const opt of options) {
        try {
          next = prChargeItemService.addMappedChargeToPrList(next, opt, calculatedTotalValue, editCurrency);
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

  const handleSaveEdit = () => {
    setEditError(null);
    if (effectivePolicy.activation.expectedDeliveryDateEnabled) {
      if (effectivePolicy.activation.expectedDeliveryDateMandatory && (!editExpectedDeliveryDate || !editExpectedDeliveryDate.trim())) {
        setEditError('Expected Delivery Date is mandatory under active company policy.');
        return;
      }
      if (
        editExpectedDeliveryDate &&
        editExpectedDeliveryDate.trim() &&
        !isValidIsoDate(editExpectedDeliveryDate)
      ) {
        setEditError('Please enter a valid Expected Delivery Date in YYYY-MM-DD format.');
        return;
      }
    }

    try {
      const updatedLines = lines.map((l) => ({
        ...l,
        currency: editCurrency,
        estimatedTotalValue:
          (Number(l.requestedQuantity) || 0) * (Number(l.approximateUnitPrice) || 0),
      }));

      const finalCharges =
        displayedChargeItems.length > 0 ? displayedChargeItems : undefined;

      PurchaseRequisitionService.updatePR(
        pr.id,
        {
          priority: editPriority,
          department: editDepartment,
          currency: editCurrency,
          expectedDeliveryDate: effectivePolicy.activation.expectedDeliveryDateEnabled
            ? (editExpectedDeliveryDate || undefined)
            : (pr.expectedDeliveryDate || undefined),
          requiredBy: effectivePolicy.activation.expectedDeliveryDateEnabled
            ? (editExpectedDeliveryDate || pr.requiredBy)
            : pr.requiredBy,
          purchasePurpose: editPurpose,
          estimatedTotalValue: calculatedTotalValue,
          chargeItems: finalCharges,
          chargesTotalValue: chargesSummary.applicableChargesBaseTotal,
          grandTotalWithCharges: chargesSummary.grandTotalWithCharges,
          modifiedBy: currentUser.fullName,
          lines: updatedLines,
        },
        currentUser
      );

      setIsEditMode(false);
      onUpdated();
      onClose();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update PR.');
    }
  };

  const handleApprove = () => {
    try {
      if (effectivePolicy.approval.mandatoryApprovalRemarks && !remarks.trim()) {
        setActionFeedback({
          type: 'error',
          message: 'Approval remarks are mandatory under active governance policy.',
        });
        return;
      }
      const approvedPr = PurchaseRequisitionService.approvePR(
        pr.id,
        currentUser.fullName,
        currentUser.role,
        remarks,
        { actorUser: currentUser }
      );
      if (approvedPr && isPrStatusApproved(approvedPr.status)) {
        printPurchaseRequisitionPdf(approvedPr, { printedBy: currentUser.fullName });
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Approval failed.' });
    }
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      setActionFeedback({ type: 'error', message: 'Please provide rejection remarks.' });
      return;
    }
    PurchaseRequisitionService.rejectPR(pr.id, currentUser.fullName, remarks);
    onUpdated();
    onClose();
  };

  const handleReturn = () => {
    if (!remarks.trim()) {
      setActionFeedback({
        type: 'error',
        message: 'Mandatory Return Reason is required to return a PR for correction.',
      });
      return;
    }
    try {
      PurchaseRequisitionService.returnForCorrection(pr.id, remarks, currentUser.fullName);
      onUpdated();
      onClose();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Return failed.' });
    }
  };

  const handleResubmit = () => {
    const res = PurchaseRequisitionService.resubmitPR(
      pr.id,
      currentUser.fullName,
      remarks || 'Corrected and resubmitted under same PR number.',
      currentUser
    );
    if (!res.success) {
      setActionFeedback({ type: 'error', message: res.message });
      return;
    }
    onUpdated();
    onClose();
  };

  const handleSubmitDraft = () => {
    const res = PurchaseRequisitionService.submitPR(pr.id, currentUser);
    if (!res.success) {
      setActionFeedback({ type: 'error', message: res.message });
      return;
    }
    onUpdated();
    onClose();
  };

  const handleWithdraw = () => {
    const res = PurchaseRequisitionService.withdrawPR(
      pr.id,
      currentUser.fullName,
      remarks || 'Withdrawn by requester prior to approval',
      currentUser
    );
    if (!res.success) {
      setActionFeedback({ type: 'error', message: res.message });
      return;
    }
    onUpdated();
    onClose();
  };

  const handleExecuteClosure = () => {
    if (!closureActionType) return;
    if (closureActionType === 'SHORT_CLOSE') {
      const res = PurchaseRequisitionService.shortClosePR({
        prId: pr.id,
        lineIds: selectedClosureLineIds,
        reason: closureReason,
        remarks: closureRemarks,
        user: currentUser,
        convertedQtyByLineId: convertedQtyMap,
      });
      if (!res.success) {
        setActionFeedback({ type: 'error', message: res.message });
        return;
      }
    } else {
      const res = PurchaseRequisitionService.cancelPR({
        prId: pr.id,
        lineIds: selectedClosureLineIds,
        reason: closureReason,
        remarks: closureRemarks,
        user: currentUser,
        convertedQtyByLineId: convertedQtyMap,
      });
      if (!res.success) {
        setActionFeedback({ type: 'error', message: res.message });
        return;
      }
    }
    setClosureActionType(null);
    onUpdated();
    onClose();
  };

  const handleInitiateChange = () => {
    if (!changeReason.trim()) {
      setActionFeedback({ type: 'error', message: 'Please enter a mandatory change reason.' });
      return;
    }
    if (
      newExpectedDeliveryDate &&
      newExpectedDeliveryDate.trim() &&
      !isValidIsoDate(newExpectedDeliveryDate)
    ) {
      setActionFeedback({
        type: 'error',
        message: 'Please enter a valid Expected Delivery Date in YYYY-MM-DD format.',
      });
      return;
    }

    const deltas: Array<{ field: string; oldValue: any; newValue: any }> = [];
    if (newPurpose !== pr.purchasePurpose) {
      deltas.push({ field: 'purchasePurpose', oldValue: pr.purchasePurpose, newValue: newPurpose });
    }
    if (newExpectedDeliveryDate !== getExpectedDeliveryDate(pr)) {
      deltas.push({
        field: 'expectedDeliveryDate',
        oldValue: getExpectedDeliveryDate(pr),
        newValue: newExpectedDeliveryDate,
      });
    }

    PurchaseRequisitionService.initiateChangeRequest(
      pr.id,
      currentUser.id,
      currentUser.fullName,
      changeReason,
      deltas.length > 0
        ? deltas
        : [{ field: 'purchasePurpose', oldValue: pr.purchasePurpose, newValue: newPurpose }]
    );
    setShowChangeModal(false);
    onUpdated();
    onClose();
  };

  // Controlled Approved PR Line Amendment State (Requirement E)
  const [amendingLineId, setAmendingLineId] = useState<string | null>(null);
  const [amendQuantity, setAmendQuantity] = useState<number>(0);
  const [amendUnitPrice, setAmendUnitPrice] = useState<number>(0);
  const [amendDeliveryDate, setAmendDeliveryDate] = useState<string>('');
  const [amendPurpose, setAmendPurpose] = useState<string>('');
  const [amendReason, setAmendReason] = useState<string>('');

  // Versioned Supporting Documents & Attachments State (Requirement H)
  const [newAttachmentFileName, setNewAttachmentFileName] = useState<string>('');
  const [newAttachmentType, setNewAttachmentType] = useState<string>('application/pdf');
  const [newAttachmentSizeBytes, setNewAttachmentSizeBytes] = useState<number>(524288);

  const handleOpenLineAmendment = (line: PurchaseRequisitionHeader['lines'][number]) => {
    setAmendingLineId(line.id);
    setAmendQuantity(line.requestedQuantity);
    setAmendUnitPrice(line.approximateUnitPrice);
    setAmendDeliveryDate(
      line.deliverySchedules?.[0]?.deliveryDate || getExpectedDeliveryDate(pr) || ''
    );
    setAmendPurpose(line.purchasePurpose || pr.purchasePurpose);
    setAmendReason('');
  };

  const handleSubmitLineAmendment = () => {
    if (!amendingLineId) return;
    const res = PurchaseRequisitionService.submitApprovedLineAmendment({
      prId: pr.id,
      lineId: amendingLineId,
      amendmentReason: amendReason,
      proposedValues: {
        requestedQuantity: amendQuantity,
        approximateUnitPrice: amendUnitPrice,
        expectedDeliveryDate: amendDeliveryDate || undefined,
      },
      user: currentUser,
    });
    if (!res.success) {
      setActionFeedback({ type: 'error', message: res.message });
      return;
    }
    setAmendingLineId(null);
    setActionFeedback({ type: 'success', message: res.message });
    onUpdated();
  };

  const handleApproveAmendmentRecord = (amendmentId: string) => {
    try {
      PurchaseRequisitionService.approveLineAmendment({
        prId: pr.id,
        amendmentId,
        approver: currentUser,
        remarks: remarks || 'Approved controlled line amendment',
      });
      setActionFeedback({ type: 'success', message: 'Line amendment approved and applied.' });
      onUpdated();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Amendment approval failed.' });
    }
  };

  const handleUploadAttachment = () => {
    if (!newAttachmentFileName.trim()) {
      setActionFeedback({ type: 'error', message: 'Please enter a document file name.' });
      return;
    }
    try {
      const att = PurchaseRequisitionService.uploadPRAttachment({
        prId: pr.id,
        fileName: newAttachmentFileName.trim(),
        fileType: newAttachmentType,
        fileSizeBytes: newAttachmentSizeBytes,
        user: currentUser,
      });
      setNewAttachmentFileName('');
      setActionFeedback({
        type: 'success',
        message: `Uploaded ${att.fileName} (v${att.versionNumber}).`,
      });
      onUpdated();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Upload failed.' });
    }
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    try {
      const res = PurchaseRequisitionService.deletePRAttachment({
        prId: pr.id,
        attachmentId,
        user: currentUser,
      });
      setActionFeedback({ type: res.deleted ? 'success' : 'error', message: res.message });
      onUpdated();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Attachment deletion blocked.' });
    }
  };

  const handleRequestInventoryException = () => {
    try {
      const shortageLines = inventorySnapshot.lineResults.filter((l) => l.isShortage);
      const summary = shortageLines
        .map((l) => `${l.itemCode}: Shortage ${l.shortageQuantity} ${l.uom}`)
        .join('; ');
      inventoryValidationService.requestInventoryException({
        prId: pr.id,
        prNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        requestedById: currentUser.id,
        requestedByName: currentUser.fullName,
        exceptionReason: invExceptionReason || 'Urgent production continuity replenishment',
        shortageSummary: summary || 'Inventory policy variance',
      });
      setInvExceptionReason('');
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: 'Inventory validation exception request submitted for approval.',
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to request inventory exception.' });
    }
  };

  const handleApproveInventoryException = () => {
    try {
      inventoryValidationService.approveInventoryException({
        prId: pr.id,
        approvedById: currentUser.id,
        approvedByName: currentUser.fullName,
        approverRemarks: remarks || 'Authorized plant shortage exception approved',
        approverUser: currentUser,
      });
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: 'Inventory validation exception approved.',
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to approve inventory exception.' });
    }
  };

  const handleManualRevalidate = () => {
    try {
      const prs = PurchaseRequisitionService.getPurchaseRequisitions();
      const targetPr = prs.find((p) => p.id === pr.id);
      if (targetPr) {
        inventoryValidationService.revalidatePrAndAttachSnapshot(
          targetPr,
          'ON_PR_APPROVAL',
          currentUser.fullName,
          currentUser
        );
        PurchaseRequisitionService.savePurchaseRequisitions(prs);
      }
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: 'Revalidated stock availability & attached immutable stage snapshot.',
      });
      onUpdated();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Revalidation failed.' });
    }
  };

  const handleRequestCrossBranchTransfer = (
    itemCode: string,
    itemDescription: string,
    uom: string,
    sourceBranchId: string,
    sourceWarehouseCode: string,
    destinationWarehouseCode: string,
    qty: number
  ) => {
    try {
      const rec = inventoryValidationService.requestStockTransfer({
        companyId: pr.companyId,
        sourceBranchId,
        sourceWarehouseCode,
        destinationBranchId: pr.branchId,
        destinationWarehouseCode,
        prId: pr.id,
        prNumber: pr.prNumber,
        itemCode,
        itemDescription,
        uom,
        requestedQuantity: qty,
        reason: transferReason.trim() || `Replenish PR ${pr.prNumber} shortage for ${itemCode}`,
        requestedById: currentUser.id,
        requestedByName: currentUser.fullName,
        user: currentUser,
      });
      setTransferReason('');
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: `Cross-branch transfer ${rec.transferNumber} requested (${rec.requestedQuantity} ${rec.uom} from ${rec.sourceWarehouseCode} -> ${rec.destinationWarehouseCode}).`,
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Transfer request failed.' });
    }
  };

  const handleTransferLifecycle = (transferId: string, action: 'APPROVE' | 'DISPATCH' | 'RECEIVE') => {
    try {
      if (action === 'APPROVE') {
        inventoryValidationService.approveStockTransfer({
          transferId,
          approvedById: currentUser.id,
          approvedByName: currentUser.fullName,
          approverUser: currentUser,
        });
      } else if (action === 'DISPATCH') {
        inventoryValidationService.dispatchStockTransfer({
          transferId,
          dispatchedById: currentUser.id,
          dispatchedByName: currentUser.fullName,
        });
      } else {
        inventoryValidationService.receiveStockTransfer({
          transferId,
          receivedById: currentUser.id,
          receivedByName: currentUser.fullName,
        });
      }
      setGovernanceTick((t) => t + 1);
      setActionFeedback({ type: 'success', message: `Stock transfer updated (${action}).` });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || `Transfer ${action} failed.` });
    }
  };

  const handleRequestBudgetException = () => {
    try {
      budgetControlService.requestBudgetException({
        transactionType: 'PR',
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        companyId: pr.companyId,
        branchId: pr.branchId,
        department: pr.department,
        costCenter: pr.costCentre || 'CC-PROD-101',
        proposedAmount: pr.estimatedTotalValue,
        availableBudgetAtRequest: budgetControlSnapshot.availableBudget,
        shortfallAmount: budgetControlSnapshot.budgetShortfall,
        justification: bgtExceptionReason || 'Essential operational requirement exceeding period allocation',
        requestedById: currentUser.id,
        requestedByName: currentUser.fullName,
      });
      setBgtExceptionReason('');
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: 'Budget exception request submitted without modifying master budget.',
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to request budget exception.' });
    }
  };

  const handleApproveBudgetException = () => {
    try {
      budgetControlService.approveBudgetException({
        transactionId: pr.id,
        transactionNumber: pr.prNumber,
        approvedById: currentUser.id,
        approvedByName: currentUser.fullName,
        approvalRemarks: remarks || 'Authorized CFO/Finance Controller exception approval',
      });
      setGovernanceTick((t) => t + 1);
      setActionFeedback({
        type: 'success',
        message: 'Budget exception approved cleanly (master budget allocation unchanged).',
      });
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Failed to approve budget exception.' });
    }
  };

  const activeCurrency = isEditMode ? editCurrency : getPrCurrency(pr);
  const activeEstimatedValue = isEditMode ? calculatedTotalValue : pr.estimatedTotalValue;
  const resolvedExpectedDeliveryDate = isEditMode
    ? editExpectedDeliveryDate
    : getExpectedDeliveryDate(pr);

  return (
    <>
      <EnterpriseModal
        title={`PR Details: ${pr.prNumber}`}
        subtitle={`${pr.prType} Requisition | Status: ${pr.status} | Policy: ${
          pr.policyVersion || effectivePolicy.policyVersion
        } | Requested by ${pr.requesterName}`}
        isOpen={true}
        onClose={onClose}
        isMaximized={isMaximized}
        onToggleMaximize={handleToggleMaximize}
        isMinimized={isMinimized}
        onToggleMinimize={handleToggleMinimize}
      >
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {actionFeedback && (
            <div
              className={`p-3 rounded-xl border font-bold flex items-center justify-between ${
                actionFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
              }`}
            >
              <span>{actionFeedback.message}</span>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-slate-500 hover:text-slate-900 px-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Governance Audit & Edit Control Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-200 px-3.5 py-2.5 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 text-slate-700">
              <span>
                Created By:{' '}
                <strong className="text-slate-900">
                  {pr.creatorName || pr.requesterName}
                </strong>{' '}
                ({new Date(pr.createdAt).toLocaleDateString()})
              </span>
              <span>•</span>
              <span>
                Modified By: <strong className="text-slate-900">{getModifiedBy(pr)}</strong> (
                {new Date(pr.updatedAt).toLocaleDateString()})
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-white border border-indigo-200 font-mono font-bold text-[10px] text-indigo-700">
                Governed Policy: {pr.policyVersion || effectivePolicy.policyVersion} (
                {pr.policySnapshot?.resolutionSource || effectivePolicy.resolutionSource})
              </span>
              {(pr.financialYearCode || pr.financialPeriod) && (
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono font-bold text-[10px] text-slate-700">
                  FY: {pr.financialYearCode || pr.financialPeriod}
                </span>
              )}
              {pr.isDataQualityGap && (
                <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 font-bold text-[10px] text-rose-800">
                  Data-Quality Gap (Unassigned FY)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadPurchaseRequisitionPdf(pr, { printedBy: currentUser.fullName })}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs transition"
                title={
                  isPrStatusApproved(pr.status)
                    ? 'Download Official Approved PDF from Immutable PR Document Repository'
                    : 'Download PDF as Controlled Copy (Pending Approval)'
                }
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span>PDF Print</span>
                {isPrStatusApproved(pr.status) ? (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px]">
                    Approval History
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded font-bold text-[9px]">
                    Controlled Copy
                  </span>
                )}
              </button>

              {!isEditMode ? (
                canEditHeader.allowed && !isHistoricalLocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (chargeItems.length === 0) {
                        const mandatory = effectiveMappedCharges
                          .filter((opt: EffectiveMappedChargeOption) => opt.applicability === 'MANDATORY')
                          .map((opt: EffectiveMappedChargeOption) =>
                            prChargeItemService.createPrChargeFromMappedOption(
                              opt,
                              calculatedTotalValue,
                              editCurrency
                            )
                          );
                        if (mandatory.length > 0) setChargeItems(mandatory);
                      }
                      setIsEditMode(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />{' '}
                    {pr.status === 'RETURNED_FOR_CORRECTION' ? 'Correct Returned PR' : 'Edit PR'}
                  </button>
                ) : (
                  <span
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-300 rounded-lg font-bold text-[11px] flex items-center gap-1"
                    title={isHistoricalLocked ? fyMutationGuard.reason : canEditHeader.reason}
                  >
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>{isHistoricalLocked ? 'Closed FY Read-Only' : `Header Locked (${pr.status})`}</span>
                  </span>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditMode(false);
                      setEditPriority(pr.priority);
                      setEditDepartment(pr.department);
                      setEditCurrency(getPrCurrency(pr));
                      setEditExpectedDeliveryDate(getExpectedDeliveryDate(pr));
                      setEditPurpose(pr.purchasePurpose);
                      setLines(pr.lines);
                      setChargeItems(
                        pr.chargeItems && pr.chargeItems.length > 0 ? pr.chargeItems : []
                      );
                      setEditError(null);
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" /> Save PR Changes
                  </button>
                </>
              )}
            </div>
          </div>

          {editError && (
            <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg font-semibold text-xs">
              {editError}
            </div>
          )}

          {/* Historical FY / Closed Period Read-Only Banner */}
          {isHistoricalLocked && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl flex items-start gap-2.5 text-xs">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Historical Read-Only Lock Enforced</div>
                <p className="text-[11px] mt-0.5">{fyMutationGuard.reason}</p>
              </div>
            </div>
          )}

          {/* Budget Governance & Dual-Currency Uncommitted Reconciliation Summary Strip (Requirement F) */}
          {effectivePolicy.activation.budgetValidationEnabled && (
            <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-[10px]">
                <span className="font-bold text-indigo-300 uppercase tracking-wider">
                  Multi-Currency Budget Reservation & Historical FX Reconciliation
                </span>
                <span className="font-mono text-slate-300">
                  Preserved FX Rate: 1 {activeCurrency} = ₹{budgetRecon.exchangeRateUsed} (
                  {budgetRecon.exchangeRateRef} • {budgetRecon.exchangeRateDate})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Original PR Reservation
                  </span>
                  <span className="font-mono font-bold text-sm text-white block">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.originalReservation, activeCurrency)}
                  </span>
                  {activeCurrency !== 'INR' && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Reporting (INR): ₹
                      {formatEstimatedValue(budgetRecon.originalReservationReportingCurrency, 'INR')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Valid Commitments (RFQ/PO)
                  </span>
                  <span className="font-mono font-bold text-sm text-indigo-300 block">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.validOutstandingCommitments, activeCurrency)}
                  </span>
                  {activeCurrency !== 'INR' && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Reporting (INR): ₹
                      {formatEstimatedValue(budgetRecon.validCommitmentsReportingCurrency, 'INR')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Previously Released Budget
                  </span>
                  <span className="font-mono font-bold text-sm text-amber-300 block">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.previouslyReleasedAmount, activeCurrency)}
                  </span>
                  {activeCurrency !== 'INR' && (
                    <span className="font-mono text-[10px] text-slate-400">
                      Reporting (INR): ₹
                      {formatEstimatedValue(budgetRecon.previouslyReleasedReportingCurrency, 'INR')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Eligible Uncommitted Release
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-400 block">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.eligibleReleaseAmount, activeCurrency)}
                  </span>
                  {activeCurrency !== 'INR' && (
                    <span className="font-mono text-[10px] text-emerald-300">
                      Reporting (INR): ₹
                      {formatEstimatedValue(budgetRecon.eligibleReleaseReportingCurrency, 'INR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Top Control Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">Company</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                {pr.companyCode}
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">Branch</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                {pr.branchName}
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1 block">PR Type</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                {pr.prType}
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority</label>
              {isEditMode ? (
                <select
                  aria-label="Edit Priority"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as PRPriority)}
                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800 text-xs"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="URGENT">URGENT</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              ) : (
                <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                  {pr.priority}
                </div>
              )}
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              {isEditMode ? (
                <input
                  type="text"
                  aria-label="Edit Department"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800 text-xs"
                />
              ) : (
                <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">
                  {pr.department}
                </div>
              )}
            </div>
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                <Coins className="w-3.5 h-3.5 text-indigo-600" /> Currency
              </label>
              {isEditMode ? (
                <select
                  aria-label="Edit Currency"
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800 text-xs"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              ) : (
                <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-indigo-800 text-xs">
                  {activeCurrency}
                </div>
              )}
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Estimated Value</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-xs">
                {formatEstimatedValue(activeEstimatedValue, activeCurrency)}
                {chargesSummary.applicableChargesCount > 0 && (
                  <span className="ml-1.5 text-[10px] font-semibold text-indigo-700">
                    (+{formatChargeAmount(chargesSummary.applicableChargesBaseTotal, activeCurrency)} charges)
                  </span>
                )}
              </div>
            </div>
            {(effectivePolicy.activation.expectedDeliveryDateEnabled || Boolean(resolvedExpectedDeliveryDate)) && (
              <div>
                <label
                  htmlFor="pr-edit-expected-delivery-date"
                  className="font-bold text-slate-700 flex items-center gap-1 mb-1"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Expected Delivery Date
                  {!effectivePolicy.activation.expectedDeliveryDateEnabled && Boolean(resolvedExpectedDeliveryDate) && (
                    <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 ml-1">
                      Historical
                    </span>
                  )}
                  {effectivePolicy.activation.expectedDeliveryDateEnabled && effectivePolicy.activation.expectedDeliveryDateMandatory && isEditMode && (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                {isEditMode ? (
                  effectivePolicy.activation.expectedDeliveryDateEnabled ? (
                    <input
                      id="pr-edit-expected-delivery-date"
                      aria-label="Expected Delivery Date"
                      type="date"
                      value={editExpectedDeliveryDate}
                      onChange={(e) => setEditExpectedDeliveryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-bold text-slate-800 text-xs"
                    />
                  ) : (
                    <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-medium text-slate-600 text-xs">
                      {resolvedExpectedDeliveryDate || '—'} (Policy Disabled)
                    </div>
                  )
                ) : (
                  <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-xs">
                    {resolvedExpectedDeliveryDate || '—'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-1">Purchase Purpose</h4>
            {isEditMode ? (
              <input
                type="text"
                aria-label="Edit Purchase Purpose"
                value={editPurpose}
                onChange={(e) => setEditPurpose(e.target.value)}
                className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg font-medium text-slate-800"
              />
            ) : (
              <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {pr.purchasePurpose}
              </p>
            )}
          </div>

          {/* SEPARATE TABS: PR Item Lines vs Charge Items */}
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
              <Package className="w-3.5 h-3.5" />
              <span>PR Item Lines & Conversion Tracking</span>
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
              <span>Charge Items (Loading, Unloading, Customs Duty, Freight & Fixed Tariffs)</span>
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
              <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <span>PR Item Lines, Line-Level Conversion Tracking & Lock Status</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {lines.length} Line(s) Total
                    </span>
                  </h4>
                </div>
              </div>

              {/* ITEM LINES TABLE WITH LINE-LEVEL CONVERSION, LOCK STATUS & CONTROLLED AMENDMENT */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto max-h-[42vh]">
                  <table className="w-full text-left text-xs border-collapse min-w-[1480px]">
                    <thead>
                      <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                        <th className="p-2.5 text-center border-r border-slate-800">#</th>
                        <th className="p-2.5 border-r border-slate-800">Item Code & Category</th>
                        <th className="p-2.5 border-r border-slate-800">Description</th>
                        <th className="p-2.5 text-center border-r border-slate-800">UOM</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Orig Qty</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Converted</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Closed/Canc</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Remaining</th>
                        <th className="p-2.5 text-center border-r border-slate-800">Line Lock Status</th>
                        <th className="p-2.5 text-center border-r border-slate-800">Currency</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Unit Price</th>
                        <th className="p-2.5 text-right border-r border-slate-800">Subtotal</th>
                        <th className="p-2.5 border-r border-slate-800">Purpose & Buyer</th>
                        <th className="p-2.5 text-center">Controlled Amendment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lines.map((line, idx) => {
                        const lineCurrency = isEditMode ? editCurrency : line.currency || activeCurrency;
                        const lineSubtotal =
                          (Number(line.requestedQuantity) || 0) *
                          (Number(line.approximateUnitPrice) || 0);
                        const convQty = convertedQtyMap[line.id] || 0;
                        const lockInfo = prGovernancePolicyService.getLineLockStatus(line, convQty);
                        const canAmendUnconvertedLine =
                          !isHistoricalLocked &&
                          (pr.status === 'APPROVED_PENDING_BUYER' ||
                            pr.status === 'PENDING_REAPPROVAL') &&
                          effectivePolicy.editingAndLocking.unconvertedLineEditing &&
                          convQty === 0 &&
                          !lockInfo.isLockedForEdit;

                        return (
                          <tr
                            key={line.id || idx}
                            className={`hover:bg-indigo-50/30 transition align-top ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="p-2 text-center border-r border-slate-200 font-bold bg-slate-100 text-slate-700 font-mono">
                              #{idx + 1}
                            </td>
                            <td className="p-2 border-r border-slate-200">
                              <div className="font-bold text-indigo-700 text-xs">{line.itemCode}</div>
                              <div className="text-[10px] text-slate-500">Cat: {line.itemCategory}</div>
                            </td>
                            <td className="p-2 border-r border-slate-200 text-[11px] font-semibold text-slate-800">
                              {line.description}
                            </td>
                            <td className="p-2 text-center border-r border-slate-200 font-bold text-xs">
                              {line.inventoryUom}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-xs">
                              {isEditMode && !lockInfo.isLockedForEdit ? (
                                <input
                                  type="number"
                                  value={line.requestedQuantity}
                                  onChange={(e) => {
                                    const updated = [...lines];
                                    updated[idx] = {
                                      ...updated[idx],
                                      requestedQuantity: parseFloat(e.target.value) || 0,
                                    };
                                    setLines(updated);
                                  }}
                                  className="w-20 px-1.5 py-1 bg-white border border-indigo-300 rounded text-right font-bold"
                                />
                              ) : (
                                <div>
                                  <span>{lockInfo.originalQty}</span>
                                  {line.originalApprovedQuantity !== undefined &&
                                    line.originalApprovedQuantity !== line.requestedQuantity && (
                                      <div className="text-[9px] text-slate-400">
                                        Orig Appr: {line.originalApprovedQuantity}
                                      </div>
                                    )}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-indigo-700">
                              {lockInfo.convertedQty}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono text-slate-600">
                              {lockInfo.shortClosedQty + lockInfo.cancelledQty}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-emerald-700">
                              {lockInfo.remainingQty}
                            </td>
                            <td className="p-2 text-center border-r border-slate-200">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                  lockInfo.lockStatus === 'LOCKED'
                                    ? 'bg-slate-200 text-slate-800'
                                    : lockInfo.lockStatus === 'PARTIALLY_CONVERTED'
                                    ? 'bg-amber-100 text-amber-900'
                                    : lockInfo.lockStatus === 'SHORT_CLOSED'
                                    ? 'bg-purple-100 text-purple-900'
                                    : lockInfo.lockStatus === 'CANCELLED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {lockInfo.isLockedForEdit && <Lock className="w-2.5 h-2.5" />}
                                <span>{lockInfo.lockStatus}</span>
                              </span>
                            </td>
                            <td className="p-2 text-center border-r border-slate-200 font-mono font-bold text-xs text-slate-700">
                              {lineCurrency}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-xs">
                              {isEditMode && !lockInfo.isLockedForEdit ? (
                                <input
                                  type="number"
                                  value={line.approximateUnitPrice}
                                  onChange={(e) => {
                                    const updated = [...lines];
                                    updated[idx] = {
                                      ...updated[idx],
                                      approximateUnitPrice: parseFloat(e.target.value) || 0,
                                    };
                                    setLines(updated);
                                  }}
                                  className="w-24 px-1.5 py-1 bg-white border border-indigo-300 rounded text-right font-bold"
                                />
                              ) : (
                                formatEstimatedValue(line.approximateUnitPrice, lineCurrency)
                              )}
                            </td>
                            <td className="p-2 text-right border-r border-slate-200 font-mono font-bold text-xs text-indigo-700">
                              {formatEstimatedValue(lineSubtotal, lineCurrency)}
                            </td>
                            <td className="p-2 text-[10px] border-r border-slate-200">
                              <div className="font-bold text-slate-800">{line.purchasePurpose}</div>
                              <div className="text-indigo-700 font-semibold mt-0.5">
                                Buyer: {line.assignedBuyer || 'Default Buyer'}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              {canAmendUnconvertedLine ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenLineAmendment(line)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px] cursor-pointer"
                                >
                                  Amend Line
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  {convQty > 0 ? 'Converted (Locked)' : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SEPARATE CHARGE ITEMS TAB */}
          {activeTab === 'CHARGES' && (
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                    <Coins className="w-4 h-4 text-indigo-600" />
                    <span>Charge Items (Loading, Unloading, Customs Duty, Freight, etc.)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {chargesSummary.applicableChargesCount} Applicable
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isEditMode
                      ? 'Specify whether each charge is Applicable, As Per Fixed Charges tariff, or Exempt / N/A.'
                      : 'Non-inventory cost components and fixed charge tariffs attached to this Purchase Requisition.'}
                  </p>
                </div>

                {isEditMode && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncMandatoryCharges}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Reset to Mandatory Policy Charges
                    </button>
                  </div>
                )}
              </div>

              {isEditMode && (
                <PrMappedChargesSelector
                  effectiveOptions={effectiveMappedCharges}
                  selectedChargeItems={displayedChargeItems}
                  companyName={pr.companyId}
                  branchName={pr.branchName || pr.branchId}
                  onAddChargeOption={handleAddMappedCharge}
                  onAddMultipleOptions={handleAddMultipleMappedCharges}
                  errorNotice={chargeSelectorError}
                  onDismissError={() => setChargeSelectorError(null)}
                />
              )}

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Items Net Subtotal</div>
                  <div className="text-sm font-extrabold text-slate-800 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.itemsSubtotal, activeCurrency)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Applicable Charges</div>
                  <div className="text-sm font-extrabold text-indigo-700 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.applicableChargesBaseTotal, activeCurrency)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {chargesSummary.applicableChargesCount} items active
                  </div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">Est. Tax on Charges</div>
                  <div className="text-sm font-extrabold text-slate-700 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.applicableChargesTaxTotal, activeCurrency)}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-800">Total Landed PR Value</div>
                  <div className="text-base font-extrabold text-indigo-900 font-mono mt-0.5">
                    {formatChargeAmount(chargesSummary.grandTotalWithCharges, activeCurrency)}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium">
                    Items + Applicable Charges
                  </div>
                </div>
              </div>

              {displayedChargeItems.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                  <p className="font-bold text-slate-700 text-xs">
                    No charge items recorded on this Purchase Requisition.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {canEditHeader.allowed && !isHistoricalLocked
                      ? 'Click "Edit PR" above to configure Loading, Unloading, Customs Duty, Freight, or Fixed Charge tariffs.'
                      : 'Only inventory item lines were requested under this requisition.'}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto max-h-[42vh]">
                    <table className="w-full text-left text-xs border-collapse min-w-[1060px]">
                      <thead>
                        <tr className="bg-[#0B192C] text-white font-bold sticky top-0 z-10 border-b border-slate-800 text-[11px]">
                          <th className="p-2.5 text-center border-r border-slate-800 w-12">#</th>
                          <th className="p-2.5 border-r border-slate-800 w-60">Charge Item & Category</th>
                          <th className="p-2.5 border-r border-slate-800 w-60">Applicability</th>
                          <th className="p-2.5 border-r border-slate-800 w-52">Rate / Tariff Basis</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-28">Base Amount</th>
                          <th className="p-2.5 text-center border-r border-slate-800 w-20">GST %</th>
                          <th className="p-2.5 text-right border-r border-slate-800 w-32">Total with Tax</th>
                          <th className="p-2.5 border-r border-slate-800 w-40">Payee / Entity</th>
                          <th className="p-2.5 border-r border-slate-800">Remarks</th>
                          {isEditMode && <th className="p-2.5 text-center w-16">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {displayedChargeItems.map((ci: PRChargeItem, idx: number) => {
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
                                  {ci.snapshotLockedAt && (
                                    <span className="text-emerald-700 font-semibold">
                                      · Snapshot Locked
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                {isEditMode ? (
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
                                      onClick={() =>
                                        handleUpdateChargeApplicability(ci.id, 'AS_PER_FIXED_CHARGES')
                                      }
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
                                      onClick={() =>
                                        handleUpdateChargeApplicability(ci.id, 'NOT_APPLICABLE')
                                      }
                                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                                        isNotApp
                                          ? 'bg-slate-700 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      Exempt / N/A
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                      isFixed
                                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                        : isApp
                                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {isFixed
                                      ? 'As Per Fixed Charges'
                                      : isApp
                                      ? 'Applicable'
                                      : 'Exempt / N/A'}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                {isFixed ? (
                                  <div>
                                    <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold text-[11px]">
                                      {ci.chargeType === 'PERCENTAGE'
                                        ? `${ci.rateOrPercentage}% (${ci.fixedChargeDescription || 'Tariff'})`
                                        : formatChargeAmount(
                                            ci.fixedChargeRate || ci.rateOrPercentage,
                                            activeCurrency
                                          )}
                                    </span>
                                    <div
                                      className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]"
                                      title={ci.fixedChargeDescription}
                                    >
                                      {ci.fixedChargeDescription}
                                    </div>
                                  </div>
                                ) : isApp ? (
                                  isEditMode ? (
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        aria-label="Edit Charge Type"
                                        value={ci.chargeType}
                                        onChange={(e) =>
                                          handleUpdateChargeType(ci.id, e.target.value as PRChargeType)
                                        }
                                        className="p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800"
                                      >
                                        <option value="FIXED">
                                          Fixed ({getCurrencySymbol(activeCurrency).trim()})
                                        </option>
                                        <option value="PERCENTAGE">% of Items</option>
                                        <option value="AT_ACTUALS">At Actuals</option>
                                      </select>
                                      <input
                                        type="number"
                                        aria-label="Edit Charge Rate"
                                        value={ci.rateOrPercentage}
                                        onChange={(e) =>
                                          handleUpdateChargeRate(ci.id, Number(e.target.value) || 0)
                                        }
                                        className="w-20 p-1 text-[11px] font-mono border border-slate-300 rounded bg-white text-right text-slate-900"
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-mono font-semibold text-slate-800">
                                      {ci.chargeType === 'PERCENTAGE'
                                        ? `${ci.rateOrPercentage}% of Items`
                                        : ci.chargeType === 'AT_ACTUALS'
                                        ? `At Actuals (${formatChargeAmount(ci.rateOrPercentage, activeCurrency)})`
                                        : `Fixed ${formatChargeAmount(ci.rateOrPercentage, activeCurrency)}`}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">
                                    Not applicable
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                                {isNotApp
                                  ? '—'
                                  : formatChargeAmount(ci.estimatedAmount || 0, activeCurrency)}
                              </td>
                              <td className="p-2.5 text-center border-r border-slate-200 font-mono">
                                {isNotApp ? (
                                  '—'
                                ) : isEditMode ? (
                                  <select
                                    aria-label="Edit GST Rate"
                                    value={ci.gstRatePercent ?? 18}
                                    onChange={(e) =>
                                      handleUpdateChargeGst(ci.id, Number(e.target.value))
                                    }
                                    className="p-1 text-[11px] border border-slate-300 rounded bg-white font-mono text-slate-800"
                                  >
                                    <option value={0}>0%</option>
                                    <option value={5}>5%</option>
                                    <option value={12}>12%</option>
                                    <option value={18}>18%</option>
                                    <option value={28}>28%</option>
                                  </select>
                                ) : (
                                  `${ci.gstRatePercent ?? 0}%`
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-extrabold text-indigo-900 border-r border-slate-200">
                                {isNotApp
                                  ? '—'
                                  : formatChargeAmount(ci.totalWithTax || 0, activeCurrency)}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                {isEditMode ? (
                                  <select
                                    aria-label="Edit Payee Type"
                                    disabled={isNotApp}
                                    value={ci.payeeType || 'SUPPLIER'}
                                    onChange={(e) =>
                                      handleUpdateChargePayee(
                                        ci.id,
                                        e.target.value as PRChargeItem['payeeType']
                                      )
                                    }
                                    className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    <option value="SUPPLIER">Supplier (Inclusive/Bill)</option>
                                    <option value="THIRD_PARTY_LOGISTICS">3PL Transporter</option>
                                    <option value="CUSTOMS_AUTHORITY">Customs & Port Authority</option>
                                    <option value="DIRECT_LABOR">Direct Labor</option>
                                    <option value="SERVICE_PROVIDER">Service Agency</option>
                                  </select>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-700">
                                    {(ci.payeeType || 'SUPPLIER').replace(/_/g, ' ')}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 border-r border-slate-200">
                                {isEditMode ? (
                                  <input
                                    type="text"
                                    aria-label="Edit Charge Remarks"
                                    disabled={isNotApp}
                                    value={ci.remarks || ''}
                                    onChange={(e) =>
                                      handleUpdateChargeRemarks(ci.id, e.target.value)
                                    }
                                    placeholder="Optional notes / scope..."
                                    className="w-full p-1 text-[11px] border border-slate-300 rounded bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                ) : (
                                  <span className="text-[11px] text-slate-600">
                                    {ci.remarks || '—'}
                                  </span>
                                )}
                              </td>
                              {isEditMode && (
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
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Charge Items Table Footer */}
                  <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-4">
                      <span>
                        Items Subtotal:{' '}
                        <span className="font-mono text-slate-900">
                          {formatChargeAmount(chargesSummary.itemsSubtotal, activeCurrency)}
                        </span>
                      </span>
                      <span>
                        Applicable Charges:{' '}
                        <span className="font-mono text-indigo-700">
                          {formatChargeAmount(
                            chargesSummary.applicableChargesBaseTotal,
                            activeCurrency
                          )}
                        </span>
                      </span>
                      <span>
                        Tax on Charges:{' '}
                        <span className="font-mono text-slate-600">
                          {formatChargeAmount(
                            chargesSummary.applicableChargesTaxTotal,
                            activeCurrency
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Total Landed PR Value:</span>
                      <span className="text-indigo-800 font-mono font-extrabold text-base">
                        {formatChargeAmount(chargesSummary.grandTotalWithCharges, activeCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controlled Line Amendment History (Requirement E) */}
          {pr.amendmentHistory && pr.amendmentHistory.length > 0 && (
            <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>
                  Controlled Approved PR Line Amendment History ({pr.amendmentHistory.length})
                </span>
                <span className="text-[10px] text-amber-800 font-semibold">
                  Original approved quantities and unit prices are preserved for audit
                </span>
              </div>
              <div className="space-y-1.5">
                {pr.amendmentHistory.map((amd) => (
                  <div
                    key={amd.id}
                    className="p-2.5 bg-white rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px]">
                          Amendment v{amd.amendmentNumber} • {amd.itemCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            amd.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {amd.status}
                        </span>
                      </div>
                      <div className="text-slate-700">
                        Qty: <strong>{amd.originalValues.requestedQuantity}</strong> →{' '}
                        <strong className="text-indigo-700">{amd.proposedValues.requestedQuantity}</strong> | Unit
                        Price: <strong>{amd.originalValues.approximateUnitPrice}</strong> →{' '}
                        <strong className="text-indigo-700">{amd.proposedValues.approximateUnitPrice}</strong> |
                        Reason: <em>{amd.amendmentReason}</em>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {amd.status === 'PENDING_REAPPROVAL' && canApprove.allowed && (
                        <button
                          type="button"
                          onClick={() => handleApproveAmendmentRecord(amd.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          Approve Amendment
                        </button>
                      )}
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(amd.requestedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting Documents & Versioned Attachments (Requirement H) */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-800 text-xs">
                  Supporting Documents & Versioned Attachments (
                  {(pr.attachments || []).length})
                </h4>
                <p className="text-[10px] text-slate-500">
                  Max Size: {effectivePolicy.attachmentGovernance?.maxFileSizeMb ?? 25} MB | Allowed:{' '}
                  {(effectivePolicy.attachmentGovernance?.allowedFileTypes || ['PDF', 'PNG', 'DOCX']).join(', ')} | Deletion Lock on
                  Approved/Converted PRs
                </p>
              </div>
              {!isHistoricalLocked && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Document name (e.g. Vendor_Spec_v2.pdf)"
                    value={newAttachmentFileName}
                    onChange={(e) => setNewAttachmentFileName(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs w-52"
                  />
                  <button
                    type="button"
                    onClick={handleUploadAttachment}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs cursor-pointer"
                  >
                    Upload Versioned Doc
                  </button>
                </div>
              )}
            </div>

            {pr.attachments && pr.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pr.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 flex flex-wrap items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{att.fileName}</span>
                          <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded font-mono text-[9px]">
                            v{att.versionNumber || 1}
                          </span>
                          {att.isHistoricalApprovedVersion && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-bold text-[9px]">
                              {att.immutablePdfId ? 'Immutable Repo' : 'Approved Snapshot'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {typeof att.fileSize === 'number'
                            ? `${(att.fileSize / 1024).toFixed(1)} KB`
                            : att.fileSize}{' '}
                          • Uploaded by {att.uploadedBy}
                          {att.immutablePdfHash && (
                            <span className="ml-1.5 font-mono text-[9px] text-slate-400">
                              SHA256:{att.immutablePdfHash.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {att.url && (
                          <button
                            type="button"
                            onClick={() => {
                              const blob = dataUriToPdfBlob(att.url!);
                              const dlUrl = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = dlUrl;
                              link.download = att.fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              setTimeout(() => URL.revokeObjectURL(dlUrl), 3000);
                            }}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                            title="Download from Immutable Repository"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                        )}
                        {!isHistoricalLocked && !att.immutablePdfId && !att.isHistoricalApprovedVersion && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-bold text-[10px] cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Part K: Enhanced Inventory Availability, Cross-Branch, Dual Aging & Transfer Lifecycle (Subsections A–E) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-xs">
                  Part K — Inventory Availability, Cross-Branch & Dual Aging ({inventorySnapshot.enforcementMode.replace(/_/g, ' ')})
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isHistoricalLocked && (
                  <button
                    type="button"
                    onClick={handleManualRevalidate}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Revalidate Stock</span>
                  </button>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    inventorySnapshot.overallOutcome === 'SUFFICIENT_OR_CLEAR' ||
                    inventorySnapshot.overallOutcome === 'EXCEPTION_APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : inventorySnapshot.overallOutcome === 'BLOCKED_BY_POLICY' ||
                        inventorySnapshot.overallOutcome === 'PENDING_EXCEPTION_APPROVAL'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {inventorySnapshot.overallOutcome.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Subsections A-E Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
              {[
                { id: 'CONTEXT', label: 'A. Validation Context' },
                { id: 'WAREHOUSE', label: 'B. Warehouse-Level View' },
                { id: 'STOCK_AGING', label: 'C. Inventory Aging & Expiry' },
                { id: 'COMPANY_WIDE', label: 'D. Company-Wide & Transfers' },
                { id: 'PR_AGING', label: 'E. Separate PR Aging & History' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPartKTab(t.id as any)}
                  className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                    partKTab === t.id
                      ? 'bg-white text-indigo-800 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Subsection A: Validation Context */}
            {partKTab === 'CONTEXT' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Policy & Version</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {inventorySnapshot.policyId} ({inventorySnapshot.policyVersion || 'v1.0'})
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Validation Stage</div>
                  <div className="font-bold text-indigo-700 mt-0.5">{inventorySnapshot.stage}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Cross-Branch Mode</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {(inventorySnapshot.crossBranchMode || 'VISIBILITY_ONLY').replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-500">Validated By / At</div>
                  <div className="font-semibold text-slate-800 mt-0.5 truncate">
                    {inventorySnapshot.validatedBy} • {inventorySnapshot.validatedAt?.slice(0, 16).replace('T', ' ')}
                  </div>
                </div>
              </div>
            )}

            {/* Subsection B: Warehouse-Level View (Default) */}
            {partKTab === 'WAREHOUSE' && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-2">Item & Primary WH</th>
                        <th className="p-2 text-right">Physical</th>
                        <th className="p-2 text-right">Reserved</th>
                        <th className="p-2 text-right">Allocated</th>
                        <th className="p-2 text-right">Available</th>
                        <th className="p-2 text-right">QC / Blk / Exp</th>
                        <th className="p-2 text-right">Incoming</th>
                        <th className="p-2 text-right">In-Transit</th>
                        <th className="p-2 text-right">PR Qty</th>
                        <th className="p-2 text-right">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inventorySnapshot.lineResults.map((lr, i) => (
                        <tr key={`${lr.itemCode}-${i}`}>
                          <td className="p-2">
                            <div className="font-bold text-slate-900">{lr.itemCode}</div>
                            <div className="text-[10px] text-slate-500">
                              {lr.warehouseCode} • {lr.inventoryLocation}
                            </div>
                          </td>
                          <td className="p-2 text-right font-mono">{lr.physicalStock}</td>
                          <td className="p-2 text-right font-mono">{lr.reservedStock}</td>
                          <td className="p-2 text-right font-mono">{lr.allocatedStock}</td>
                          <td className="p-2 text-right font-mono font-bold text-indigo-700">{lr.availableStock}</td>
                          <td className="p-2 text-right font-mono text-slate-500">
                            {lr.qualityInspectionStock || 0}/{lr.blockedStock || 0}/{lr.expiredStock || 0}
                          </td>
                          <td className="p-2 text-right font-mono text-sky-700">{lr.incomingStock}</td>
                          <td className="p-2 text-right font-mono text-violet-700">{lr.stockInTransit || 0}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {lr.requiredPrQuantity} {lr.uom}
                          </td>
                          <td
                            className={`p-2 text-right font-mono font-bold ${
                              lr.shortageQuantity > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {lr.shortageQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Priority-ordered Warehouse Breakdowns */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Active Branch Warehouses (Ordered by Priority)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inventorySnapshot.lineResults.flatMap((lr) =>
                      (lr.warehouseBreakdowns || []).map((wh, wi) => (
                        <div
                          key={`${lr.itemCode}-${wh.warehouseCode}-${wi}`}
                          className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">
                              P{wh.warehousePriority} • {wh.warehouseCode} ({lr.itemCode})
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {wh.warehouseType || 'WAREHOUSE'} •{' '}
                              {wh.eligibleForLocalValidation ? 'Eligible' : wh.exclusionReason || 'Excluded'}
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-bold text-indigo-700">Avail: {wh.availableStock}</div>
                            <div className="text-[10px] text-slate-500">Phys: {wh.physicalStock}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subsection C: Inventory Aging & Expiry View */}
            {partKTab === 'STOCK_AGING' && (
              <div className="space-y-2.5 text-[11px]">
                {inventorySnapshot.lineResults.map((lr, idx) => {
                  const sa = lr.stockAgingSummary;
                  if (!sa) {
                    return (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-500">
                        {lr.itemCode}: No warehouse stock aging data available.
                      </div>
                    );
                  }
                  return (
                    <div key={`${lr.itemCode}-${idx}`} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {lr.itemCode} — Dispatch: {sa.recommendedIssueMethod} (
                          {sa.recommendedBatchSequence.join(' → ') || 'No Usable Lots'})
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                            Oldest Receipt: {sa.oldestReceiptDate}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                            Earliest Expiry: {sa.earliestExpiryDate}
                          </span>
                          {sa.hasExpiredStock && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                              Expired Excluded: {sa.expiredQuantity}
                            </span>
                          )}
                          {sa.hasNearExpiryWarning && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Near-Expiry: {sa.nearExpiryQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sa.bucketTotals.map((bk) => (
                          <span key={bk.key} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                            {bk.label}: <strong className="font-mono">{bk.quantity}</strong>
                          </span>
                        ))}
                        {sa.dataUnavailableQuantity > 0 && (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                            Data Unavailable: {sa.dataUnavailableQuantity}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Subsection D: Company-Wide View & Inter-Branch Transfers */}
            {partKTab === 'COMPANY_WIDE' && (
              <div className="space-y-3 text-[11px]">
                {!canViewCrossBranchStock && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      Cross-Branch Visibility Restricted: Your role lacks INVENTORY_CROSS_BRANCH_STOCK_VIEW. Only local branch stock is shown.
                    </span>
                  </div>
                )}

                {canViewCrossBranchStock && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Optional business reason for cross-branch stock transfer..."
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                      />
                    </div>
                    {inventorySnapshot.lineResults.map((lr, idx) => {
                      const cw = lr.companyWideSummary;
                      return (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                            <span className="flex items-center gap-1.5 text-slate-900">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                              {lr.itemCode} — Local Available: {lr.availableStock} | Other-Branch Visible:{' '}
                              {cw?.otherBranchVisibleStock ?? 0} | Transfer-Eligible:{' '}
                              {cw?.transferEligibleStock ?? 0}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                              Mode: {cw?.crossBranchPolicyMode || 'VISIBILITY_ONLY'}
                            </span>
                          </div>
                          {cw && cw.otherBranchRows.length > 0 ? (
                            <div className="space-y-1">
                              {cw.otherBranchRows.map((obw, oi) => (
                                <div
                                  key={oi}
                                  className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800">
                                      {obw.branchName} ({obw.warehouseCode})
                                    </span>{' '}
                                    <span className="text-[10px] text-slate-500">
                                      Available: <strong className="font-mono">{obw.availableStock}</strong>{' '}
                                      {obw.isCrossBranchTransferEligible ? '• Transfer Eligible' : '• Visibility Only'}
                                    </span>
                                  </div>
                                  {!isHistoricalLocked &&
                                    obw.isCrossBranchTransferEligible &&
                                    obw.availableStock > 0 &&
                                    lr.shortageQuantity > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRequestCrossBranchTransfer(
                                            lr.itemCode,
                                            lr.itemDescription,
                                            lr.uom,
                                            obw.branchId,
                                            obw.warehouseCode,
                                            lr.warehouseCode,
                                            Math.min(lr.shortageQuantity, obw.availableStock)
                                          )
                                        }
                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                      >
                                        <ArrowRightLeft className="w-3 h-3" />
                                        <span>
                                          Request Transfer ({Math.min(lr.shortageQuantity, obw.availableStock)})
                                        </span>
                                      </button>
                                    )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic">
                              No cross-branch visible warehouse balances in same company for {lr.itemCode}.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {prTransfers.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="font-bold text-slate-700">Inter-Branch Transfer Records</div>
                    {prTransfers.map((trf) => (
                      <div
                        key={trf.id}
                        className="p-2 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono font-bold text-indigo-700">{trf.transferNumber}</span>{' '}
                          <span className="font-semibold">
                            {trf.itemCode} ({trf.requestedQuantity} {trf.uom}): {trf.sourceWarehouseCode} →{' '}
                            {trf.destinationWarehouseCode}
                          </span>
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
                            {trf.status}
                          </span>
                        </div>
                        {!isHistoricalLocked && (
                          <div className="flex items-center gap-1.5">
                            {trf.status === 'REQUESTED' && (
                              <button
                                type="button"
                                onClick={() => handleTransferLifecycle(trf.id, 'APPROVE')}
                                className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {trf.status === 'APPROVED_PENDING_DISPATCH' && (
                              <button
                                type="button"
                                onClick={() => handleTransferLifecycle(trf.id, 'DISPATCH')}
                                className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Dispatch
                              </button>
                            )}
                            {trf.status === 'IN_TRANSIT' && (
                              <button
                                type="button"
                                onClick={() => handleTransferLifecycle(trf.id, 'RECEIVE')}
                                className="px-2 py-0.5 bg-teal-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Receive
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subsection E: Strictly Separate PR Aging View & Stage Snapshot History */}
            {partKTab === 'PR_AGING' && (
              <div className="space-y-3 text-[11px]">
                <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      PR Approval & Processing Aging (Independent Engine • Policy {prAgingEval.configVersion})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        prAgingEval.isEscalated || prAgingEval.slaStatus === 'BREACHED'
                          ? 'bg-rose-100 text-rose-800'
                          : prAgingEval.isExcludedDraft || prAgingEval.isTerminalClosed
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {prAgingEval.isExcludedDraft
                        ? 'Draft Excluded'
                        : prAgingEval.isTerminalClosed
                        ? `Terminal (${prAgingEval.prStatus})`
                        : `SLA: ${prAgingEval.slaStatus}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Submitted Date</span>
                      <strong className="font-mono">{prAgingEval.submittedDateDisplay}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Pending Age</span>
                      <strong className="font-mono">
                        {prAgingEval.totalPendingAgeDays !== null ? `${prAgingEval.totalPendingAgeDays} Days` : 'Excluded'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">PR Aging Bucket</span>
                      <strong>{prAgingEval.agingBucketLabel}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Stage SLA Due</span>
                      <strong className="font-mono">{prAgingEval.slaDueDateDisplay}</strong>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Current Stage: <strong>{prAgingEval.currentAgingStage}</strong> • Stage Age:{' '}
                    <strong>{prAgingEval.currentStageAgeDays ?? 'N/A'}</strong> d • {prAgingEval.remarks}
                  </div>
                </div>

                {/* Stage-Gated Validation History & Stock Deltas */}
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-700">
                    Stage-Gated Revalidation Snapshot & Stock Delta History ({(pr.inventoryValidationHistory || [inventorySnapshot]).length})
                  </div>
                  {(pr.inventoryValidationHistory && pr.inventoryValidationHistory.length > 0
                    ? [...pr.inventoryValidationHistory].reverse()
                    : [inventorySnapshot]
                  ).map((snap) => (
                    <div key={snap.snapshotId} className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          {snap.stage} — {snap.overallOutcome.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {snap.validatedBy} • {snap.validatedAt?.slice(0, 19).replace('T', ' ')}
                        </span>
                      </div>
                      {snap.deltasFromPrevious && snap.deltasFromPrevious.length > 0 && (
                        <div className="text-[10px] text-indigo-700 font-medium">
                          {snap.deltasFromPrevious.map((d) => `${d.itemCode}: ${d.summary}`).join(' • ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isHistoricalLocked &&
              inventorySnapshot.requiresExceptionApproval &&
              !inventorySnapshot.exceptionRecord && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Mandatory reason for Inventory Exception Approval..."
                    value={invExceptionReason}
                    onChange={(e) => setInvExceptionReason(e.target.value)}
                    className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleRequestInventoryException}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs cursor-pointer"
                  >
                    Request Inventory Exception
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveInventoryException}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs cursor-pointer"
                  >
                    Approve Exception
                  </button>
                </div>
              )}
          </div>

          {/* Part L: Budget Control Validation Snapshot & Exception Workflow */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-xs">
                  Part L — Budget Control Validation ({budgetControlSnapshot.costCenter} • {budgetControlSnapshot.enforcementMode.replace(/_/g, ' ')})
                </h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  budgetControlSnapshot.overallOutcome === 'SUFFICIENT' ||
                  budgetControlSnapshot.overallOutcome === 'EXCEPTION_APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : budgetControlSnapshot.overallOutcome === 'BLOCKED_INSUFFICIENT_BUDGET' ||
                      budgetControlSnapshot.overallOutcome === 'PENDING_EXCEPTION_APPROVAL'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {budgetControlSnapshot.overallOutcome.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">Approved Budget</div>
                <div className="font-mono font-bold text-slate-900">₹{budgetControlSnapshot.approvedBudget.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">Revised Budget</div>
                <div className="font-mono font-bold text-slate-900">₹{budgetControlSnapshot.revisedBudget.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">Committed</div>
                <div className="font-mono font-bold text-indigo-700">₹{budgetControlSnapshot.committedAmount.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">Actual Exp.</div>
                <div className="font-mono font-bold text-slate-800">₹{budgetControlSnapshot.actualExpenditure.toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-bold">Available</div>
                <div className="font-mono font-bold text-emerald-700">₹{budgetControlSnapshot.availableBudget.toLocaleString()}</div>
              </div>
              <div className={`p-2 rounded-lg border ${budgetControlSnapshot.budgetShortfall > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="text-[10px] text-slate-600 font-bold">Shortfall</div>
                <div className={`font-mono font-bold ${budgetControlSnapshot.budgetShortfall > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  ₹{budgetControlSnapshot.budgetShortfall.toLocaleString()}
                </div>
              </div>
            </div>

            {!isHistoricalLocked &&
              budgetControlSnapshot.budgetShortfall > 0 &&
              !budgetControlSnapshot.exceptionRecord && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Justification for Budget Exception Approval..."
                    value={bgtExceptionReason}
                    onChange={(e) => setBgtExceptionReason(e.target.value)}
                    className="flex-1 min-w-[200px] px-2.5 py-1.5 bg-white border border-amber-300 rounded text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleRequestBudgetException}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs cursor-pointer"
                  >
                    Request Budget Exception
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveBudgetException}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs cursor-pointer"
                  >
                    Approve Budget Exception
                  </button>
                </div>
              )}
          </div>

          {/* Approval Cycle History (Preserved across Return for Correction & Resubmission) */}
          {pr.approvalHistory && pr.approvalHistory.length > 0 && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>
                  Approval & Resubmission History (Cycle #{pr.approvalCycleCount || 1})
                </span>
                <span className="text-[10px] text-slate-500">
                  Same PR Number ({pr.prNumber}) retained across correction cycles
                </span>
              </div>
              <div className="space-y-1.5">
                {pr.approvalHistory.map((dec) => (
                  <div
                    key={dec.id}
                    className="p-2 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono font-bold text-[10px]">
                        Cycle #{dec.cycleNumber} • {dec.decision}
                      </span>
                      <span className="font-bold text-slate-800">{dec.actorName}</span>
                      <span className="text-slate-600">— {dec.remarks}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(dec.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Transaction Audit Trail */}
          {prAuditLogs.length > 0 && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                <span>Audit Trail ({prAuditLogs.length})</span>
              </div>
              <div className="space-y-1">
                {prAuditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-indigo-700">{log.eventType}</span>
                      <span className="text-slate-600"> — {log.eventDescription}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {log.changedByName} • {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks for approval / return / resubmission */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block font-bold text-slate-700">
              Governance Action / Approval / Return / Resubmission Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Enter remarks for approval, return for correction, resubmission, or withdrawal..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer Actions — Dynamically Controlled by Effective Company/Branch Governance Policy & FY Period Guard */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!isHistoricalLocked &&
              pr.status === 'APPROVED_PENDING_BUYER' &&
              effectivePolicy.editingAndLocking.unconvertedLineEditing && (
                <button
                  type="button"
                  onClick={() => setShowChangeModal(true)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Request Change
                </button>
              )}

            {!isHistoricalLocked && canShortClose.allowed && (
              <button
                type="button"
                onClick={() => {
                  setClosureActionType('SHORT_CLOSE');
                  setClosureReason('');
                  setClosureRemarks('');
                }}
                className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Archive className="w-3.5 h-3.5" /> Short Close PR
              </button>
            )}

            {!isHistoricalLocked && canCancel.allowed && (
              <button
                type="button"
                onClick={() => {
                  setClosureActionType('CANCEL');
                  setClosureReason('');
                  setClosureRemarks('');
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Ban className="w-3.5 h-3.5" /> Cancel PR
              </button>
            )}

            {!isHistoricalLocked && canWithdraw.allowed && (
              <button
                type="button"
                onClick={handleWithdraw}
                className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Withdraw PR
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isHistoricalLocked && canSubmitDraft.allowed && pr.status === 'DRAFT' && (
              <button
                type="button"
                onClick={handleSubmitDraft}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Send className="w-3.5 h-3.5" /> Submit PR for Approval
              </button>
            )}

            {!isHistoricalLocked && canResubmit.allowed && pr.status === 'RETURNED_FOR_CORRECTION' && (
              <button
                type="button"
                onClick={handleResubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Send className="w-3.5 h-3.5" /> Resubmit PR ({pr.prNumber})
              </button>
            )}

            {!isHistoricalLocked && canReturn.allowed && (
              <button
                type="button"
                onClick={handleReturn}
                className="px-3.5 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold rounded-lg flex items-center gap-1 cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Return for Correction
              </button>
            )}

            {!isHistoricalLocked && canApprove.allowed && effectivePolicy.approval.allowTerminalReject && (
              <button
                type="button"
                onClick={handleReject}
                className="px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg flex items-center gap-1 cursor-pointer text-xs"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            )}

            {!isHistoricalLocked && canApprove.allowed && (
              <button
                type="button"
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve PR
              </button>
            )}
          </div>
        </div>
      </EnterpriseModal>

      {/* CONTROLLED APPROVED PR LINE AMENDMENT MODAL (Requirement E) */}
      {amendingLineId && (
        <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Controlled Unconverted Line Amendment ({pr.prNumber})
              </h3>
              <button
                type="button"
                onClick={() => setAmendingLineId(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-600 text-[11px]">
              Original approved quantities and unit prices are preserved. Amending quantity or price
              routes this PR to <strong>PENDING_REAPPROVAL</strong> under active governance rules.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proposed Quantity *</label>
                <input
                  type="number"
                  value={amendQuantity}
                  onChange={(e) => setAmendQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Proposed Unit Price ({activeCurrency}) *
                </label>
                <input
                  type="number"
                  value={amendUnitPrice}
                  onChange={(e) => setAmendUnitPrice(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Proposed Expected Delivery
                </label>
                <input
                  type="date"
                  value={amendDeliveryDate}
                  onChange={(e) => setAmendDeliveryDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Proposed Purpose</label>
                <input
                  type="text"
                  value={amendPurpose}
                  onChange={(e) => setAmendPurpose(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mandatory Amendment Reason *
              </label>
              <textarea
                rows={2}
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                placeholder="Explain why this unconverted approved line requires amendment..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAmendingLineId(null)}
                className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitLineAmendment}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Submit Controlled Line Amendment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHORT CLOSE / CANCELLATION MODAL WITH BUDGET RECONCILIATION */}
      {closureActionType && (
        <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {closureActionType === 'SHORT_CLOSE' ? (
                  <>
                    <Archive className="w-4 h-4 text-purple-600" />
                    <span>Short Close Purchase Requisition ({pr.prNumber})</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 text-rose-600" />
                    <span>Cancel Purchase Requisition ({pr.prNumber})</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setClosureActionType(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-800">
                Automated Budget Reconciliation & Uncommitted Release Preview
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  Original Reservation:{' '}
                  <strong className="font-mono">
                    {activeCurrency} {formatEstimatedValue(budgetRecon.originalReservation, activeCurrency)}
                  </strong>
                </div>
                <div>
                  Protected Commitments:{' '}
                  <strong className="font-mono text-indigo-700">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.validOutstandingCommitments, activeCurrency)}
                  </strong>
                </div>
                <div>
                  Previously Released:{' '}
                  <strong className="font-mono">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.previouslyReleasedAmount, activeCurrency)}
                  </strong>
                </div>
                <div>
                  Eligible Release:{' '}
                  <strong className="font-mono text-emerald-700">
                    {activeCurrency}{' '}
                    {formatEstimatedValue(budgetRecon.eligibleReleaseAmount, activeCurrency)}
                  </strong>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mandatory {closureActionType === 'SHORT_CLOSE' ? 'Short Close' : 'Cancellation'}{' '}
                Reason *
              </label>
              <input
                type="text"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder={
                  closureActionType === 'SHORT_CLOSE'
                    ? 'e.g. Requirement fulfilled via alternate plant stock'
                    : 'e.g. Project scope revised prior to RFQ conversion'
                }
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mandatory Audit Remarks *
              </label>
              <textarea
                rows={2}
                value={closureRemarks}
                onChange={(e) => setClosureRemarks(e.target.value)}
                placeholder="Provide detailed audit remarks..."
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosureActionType(null)}
                className="px-3 py-1.5 bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteClosure}
                className={`px-4 py-1.5 text-white rounded-lg font-bold cursor-pointer ${
                  closureActionType === 'SHORT_CLOSE'
                    ? 'bg-purple-600 hover:bg-purple-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {closureActionType === 'SHORT_CLOSE'
                  ? 'Confirm Short Close & Release Budget'
                  : 'Confirm Cancellation & Release Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Request Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Initiate Approved PR Change</h3>
            <p className="text-xs text-slate-500">
              Changes to approved PRs trigger mandatory reapproval and version retention.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                New Purpose / Notes
              </label>
              <input
                type="text"
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={newExpectedDeliveryDate}
                onChange={(e) => setNewExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                Mandatory Change Reason *
              </label>
              <textarea
                rows={2}
                placeholder="Why is this change required?"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowChangeModal(false)}
                className="px-3 py-1.5 bg-slate-100 rounded text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateChange}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold cursor-pointer"
              >
                Submit Change & Reapprove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
