import React, { useState, useEffect } from 'react';
import { GlobalItem, User } from '../../types';
import { BranchItemAvailabilityRecord } from '../../types/itemMasterGovernance';
import { WorkflowInstance, WorkflowTask } from '../../types/approvalWorkflow';
import { INITIAL_WORKFLOW_INSTANCES } from '../../data/seedWorkflows';
import { makerCheckerService } from '../../services/makerCheckerService';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Layers,
  Building2,
  GitCommit,
  Boxes,
  MapPin,
  Tag,
  ShieldAlert,
  ArrowRight,
  Info,
  Sliders,
  Warehouse,
  CheckSquare,
} from 'lucide-react';
import { useStandardDataGrid } from '../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../components/DataGridFooter';

interface ApprovalInboxViewProps {
  items: GlobalItem[];
  currentUser: User;
  onApproveItem: (itemId: string, remarks: string) => void;
  onRejectItem: (itemId: string, remarks: string) => void;
  onReturnItem: (itemId: string, remarks: string) => void;
  onApproveBranchItem?: (branchAvailabilityId: string, remarks: string) => void;
  onRejectBranchItem?: (branchAvailabilityId: string, remarks: string) => void;
  onReturnBranchItem?: (branchAvailabilityId: string, remarks: string) => void;
}

const INITIAL_PENDING_BRANCH_RECORDS: BranchItemAvailabilityRecord[] = [
  {
    id: 'br-pond-01_item-002',
    globalItemId: 'item-002',
    globalItemCode: 'FGHDMCRGY0002',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    companyName: 'Kosh Innovations Pvt Ltd',
    branchId: 'br-pond-01',
    branchCode: 'POND-01',
    branchName: 'Pondicherry Main Plant & HQ',
    categoryCode: 'FG',
    categoryName: 'Finished Goods (FG)',
    itemRole: 'MANUFACTURE',
    branchSpecificDescription: 'Pondicherry Molded Finished Assembly Casing',
    effectivePurchaseUom: 'NOS',
    effectiveInventoryUom: 'NOS',
    effectiveConversionFactor: 1,
    shelfLifeControlled: false,
    serialTrackingEnabled: true,
    serialPrefix: 'SN-POND',
    warrantyApplicable: true,
    warrantyDuration: 12,
    warrantyUnit: 'MONTHS',
    moq: 50,
    orderMultiple: 10,
    serviceControlEnabled: false,
    batchTrackingEnabled: true,
    lotTrackingEnabled: true,
    qualityInspectionRequired: true,
    inspectionType: 'PRE_DISPATCH',
    storageConditions: 'Ambient dry storage',
    regulatoryCompliance: 'ISO 9001:2015 & IATF 16949 compliant',
    warehouseConfigs: [
      {
        id: 'wh-pnd-01',
        warehouseId: 'wh-pnd-01',
        warehouseCode: 'WH-MAIN',
        warehouseName: 'Pondicherry Main FG Stores',
        isEligible: true,
        isPreferred: true,
        storageLocation: 'BIN-FG-A1',
        safetyStock: 100,
        reorderLevel: 250,
        maximumStock: 1000,
        replenishmentMethod: 'MIN_MAX',
        procurementLeadTimeDays: 7,
      },
    ],
    alternativeItems: [],
    attachments: [],
    barcodes: [],
    revisionHistory: [],
    isPurchaseEnabled: false,
    isInventoryEnabled: true,
    isStocked: true,
    isManufactured: true,
    isSalesPermitted: true,
    isActive: false,
    effectiveFrom: '2026-01-01',
    activationReason: 'New product line manufacturing activation for Pondicherry Plant 1',
    branchStatus: 'SUBMITTED',
    approvalStatus: 'PENDING',
    createdBy: 'usr-buyer-01',
    createdByName: 'Vikram Singh',
    createdAt: '2026-11-15T10:30:00Z',
    updatedBy: 'usr-buyer-01',
    updatedByName: 'Vikram Singh',
    updatedAt: '2026-11-15T10:30:00Z',
    approvalHistory: [
      {
        id: 'bappr-01',
        action: 'SUBMIT',
        actorId: 'usr-buyer-01',
        actorName: 'Vikram Singh',
        actorRole: 'ITEM_MAKER',
        timestamp: '2026-11-15T10:30:00Z',
        remarks: 'Submitted for branch operational activation review',
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
      },
    ],
  },
];

export const ApprovalInboxView: React.FC<ApprovalInboxViewProps> = ({
  items,
  currentUser,
  onApproveItem,
  onRejectItem,
  onReturnItem,
  onApproveBranchItem,
  onRejectBranchItem,
  onReturnBranchItem,
}) => {
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>(INITIAL_WORKFLOW_INSTANCES);
  const [branchRecords, setBranchRecords] = useState<BranchItemAvailabilityRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branch_availability_records_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const arr = Object.values(parsed) as BranchItemAvailabilityRecord[];
          if (arr.length > 0) return arr;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_PENDING_BRANCH_RECORDS;
  });

  const [activeTab, setActiveTab] = useState<'ALL' | 'STAGE_1_GLOBAL' | 'STAGE_2_BRANCH' | 'BUSINESS_PARTNER'>('ALL');

  // Selected item inspection states
  const [selectedGlobalItem, setSelectedGlobalItem] = useState<GlobalItem | null>(null);
  const [selectedBranchItem, setSelectedBranchItem] = useState<BranchItemAvailabilityRecord | null>(null);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);

  const [remarks, setRemarks] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync branch records from backend API
  useEffect(() => {
    async function fetchBackendBranchItems() {
      try {
        const res = await fetch('/api/branch-items');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data) && json.data.length > 0) {
            setBranchRecords((prev) => {
              const map = new Map<string, BranchItemAvailabilityRecord>();
              prev.forEach((r) => map.set(r.id || `${r.branchId}_${r.globalItemId}`, r));
              json.data.forEach((r: any) => {
                const id = r.branchAvailabilityId || `${r.branchId}_${r.globalItemId}`;
                const existing = map.get(id);
                map.set(id, { ...existing, ...r, id });
              });
              return Array.from(map.values());
            });
          }
        }
      } catch {
        // use local
      }
    }
    fetchBackendBranchItems();
  }, []);

  // 1. STAGE 1 QUEUE: Pending Global Item Creations (SUBMITTED / UNDER_REVIEW)
  const pendingGlobalItems = items.filter(
    (i) => i.status === 'SUBMITTED' || i.status === 'UNDER_REVIEW'
  );

  // 2. STAGE 2 QUEUE: Pending Branch Item Activations (SUBMITTED / PENDING)
  const pendingBranchItems = branchRecords.filter(
    (b) => b.branchStatus === 'SUBMITTED' || b.approvalStatus === 'PENDING'
  );

  // 3. Multi-level workflow pending tasks (e.g., Business Partner requests)
  const pendingWorkflowTasks = workflowInstances
    .flatMap((inst) => inst.tasks)
    .filter((task) => task.status === 'PENDING');

  const pendingBusinessPartnerTasks = pendingWorkflowTasks.filter(
    (t) => t.moduleKey === 'BUSINESS_PARTNER_MASTER'
  );

  type UnifiedApprovalRow =
    | { kind: 'STAGE_1_GLOBAL'; id: string; sortDate: string; globalItem: GlobalItem }
    | { kind: 'STAGE_2_BRANCH'; id: string; sortDate: string; branchItem: BranchItemAvailabilityRecord }
    | { kind: 'WORKFLOW'; id: string; sortDate: string; task: WorkflowTask };

  const allRows: UnifiedApprovalRow[] = [
    // Stage 1 Items
    ...pendingGlobalItems.map((item) => ({
      kind: 'STAGE_1_GLOBAL' as const,
      id: `stage1-${item.id}`,
      sortDate: item.updatedAt || item.createdAt || '',
      globalItem: item,
    })),
    // Stage 2 Items
    ...pendingBranchItems.map((b) => ({
      kind: 'STAGE_2_BRANCH' as const,
      id: `stage2-${b.id || `${b.branchId}_${b.globalItemId}`}`,
      sortDate: b.updatedAt || b.createdAt || '',
      branchItem: b,
    })),
    // Other Workflow Tasks
    ...pendingWorkflowTasks
      .filter((t) => t.moduleKey !== 'ITEM_MASTER')
      .map((task) => ({
        kind: 'WORKFLOW' as const,
        id: `wf-${task.id}`,
        sortDate: task.submittedAt || task.slaDueDate || '',
        task,
      })),
  ];

  const filteredRows = allRows.filter((row) => {
    if (activeTab === 'STAGE_1_GLOBAL') return row.kind === 'STAGE_1_GLOBAL';
    if (activeTab === 'STAGE_2_BRANCH') return row.kind === 'STAGE_2_BRANCH';
    if (activeTab === 'BUSINESS_PARTNER') return row.kind === 'WORKFLOW';
    return true;
  });

  const {
    pagedData: paginatedRows,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords,
    totalPages,
    pageSizeOptions,
  } = useStandardDataGrid<UnifiedApprovalRow>({
    gridId: 'dual-checker-approval-inbox',
    userId: currentUser?.id,
    data: filteredRows,
    defaultSortField: 'sortDate',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: activeTab,
    getRowId: (r) => r.id,
  });

  // =========================================================================
  // STAGE 1 HANDLERS (GLOBAL CHECKER DECISION)
  // =========================================================================
  const handleStage1Decision = async (decision: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if (!selectedGlobalItem) return;
    if (!remarks.trim() && (decision === 'REJECT' || decision === 'RETURN')) {
      setActionNotice({ type: 'error', message: 'Mandatory justification comments required for Rejection or Return.' });
      return;
    }

    // Client-side maker !== checker check
    const authCheck = makerCheckerService.canApproveGlobalItem(selectedGlobalItem, currentUser);
    if (decision === 'APPROVE' && !authCheck.allowed) {
      setActionNotice({ type: 'error', message: authCheck.reason || 'Approval blocked.' });
      return;
    }

    setIsSubmittingAction(true);
    setActionNotice(null);

    try {
      if (decision === 'APPROVE') {
        const resp = await makerCheckerService.approveGlobalItem(
          selectedGlobalItem.id,
          currentUser,
          remarks.trim() || 'Approved for Global Item Master catalog'
        );
        if (!resp.success) {
          setActionNotice({ type: 'error', message: resp.error || 'Server approval failed.' });
          setIsSubmittingAction(false);
          return;
        }
        onApproveItem(selectedGlobalItem.id, remarks.trim() || 'Approved for Global Item Master catalog');
      } else if (decision === 'REJECT') {
        const resp = await makerCheckerService.rejectGlobalItem(
          selectedGlobalItem.id,
          currentUser,
          remarks.trim()
        );
        if (!resp.success) {
          setActionNotice({ type: 'error', message: resp.error || 'Server rejection failed.' });
          setIsSubmittingAction(false);
          return;
        }
        onRejectItem(selectedGlobalItem.id, remarks.trim());
      } else {
        onReturnItem(selectedGlobalItem.id, remarks.trim());
      }

      setSelectedGlobalItem(null);
      setRemarks('');
      setActionNotice({
        type: 'success',
        message: `Global Item [${selectedGlobalItem.globalItemCode}] successfully ${decision.toLowerCase()}d. Branch operational activations remain independent.`,
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Operation failed.' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // =========================================================================
  // STAGE 2 HANDLERS (BRANCH CHECKER DECISION)
  // =========================================================================
  const handleStage2Decision = async (decision: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if (!selectedBranchItem) return;
    if (!remarks.trim() && (decision === 'REJECT' || decision === 'RETURN')) {
      setActionNotice({ type: 'error', message: 'Mandatory justification comments required for Rejection or Return.' });
      return;
    }

    const branchIdKey = selectedBranchItem.id || `${selectedBranchItem.branchId}_${selectedBranchItem.globalItemId}`;

    // Client-side maker !== checker check
    const authCheck = makerCheckerService.canApproveBranchItem(selectedBranchItem, currentUser);
    if (decision === 'APPROVE' && !authCheck.allowed) {
      setActionNotice({ type: 'error', message: authCheck.reason || 'Approval blocked.' });
      return;
    }

    setIsSubmittingAction(true);
    setActionNotice(null);

    try {
      if (decision === 'APPROVE') {
        const resp = await makerCheckerService.approveBranchItem(
          branchIdKey,
          currentUser,
          remarks.trim() || 'Approved for branch procurement & inventory availability'
        );
        if (!resp.success) {
          setActionNotice({ type: 'error', message: resp.error || 'Server branch approval failed.' });
          setIsSubmittingAction(false);
          return;
        }

        const nextStatus = 'APPROVED';
        const updatedList = branchRecords.map((b) => {
          if (b.id === branchIdKey || `${b.branchId}_${b.globalItemId}` === branchIdKey) {
            return {
              ...b,
              branchStatus: nextStatus as any,
              approvalStatus: 'APPROVED' as any,
              isActive: true,
              approvedBy: currentUser.id,
              approvedByName: currentUser.fullName,
              approvedAt: new Date().toISOString(),
            };
          }
          return b;
        });
        setBranchRecords(updatedList);
        try {
          const map: Record<string, BranchItemAvailabilityRecord> = {};
          updatedList.forEach((r) => {
            map[r.id || `${r.branchId}_${r.globalItemId}`] = r;
          });
          localStorage.setItem('kosh_branch_availability_records_v2', JSON.stringify(map));
        } catch {}

        if (onApproveBranchItem) onApproveBranchItem(branchIdKey, remarks);
      } else if (decision === 'REJECT') {
        const resp = await makerCheckerService.rejectBranchItem(
          branchIdKey,
          currentUser,
          remarks.trim()
        );
        if (!resp.success) {
          setActionNotice({ type: 'error', message: resp.error || 'Server branch rejection failed.' });
          setIsSubmittingAction(false);
          return;
        }

        const nextStatus = 'REJECTED';
        const updatedList = branchRecords.map((b) => {
          if (b.id === branchIdKey || `${b.branchId}_${b.globalItemId}` === branchIdKey) {
            return {
              ...b,
              branchStatus: nextStatus as any,
              approvalStatus: 'REJECTED' as any,
              isActive: false,
            };
          }
          return b;
        });
        setBranchRecords(updatedList);
        try {
          const map: Record<string, BranchItemAvailabilityRecord> = {};
          updatedList.forEach((r) => {
            map[r.id || `${r.branchId}_${r.globalItemId}`] = r;
          });
          localStorage.setItem('kosh_branch_availability_records_v2', JSON.stringify(map));
        } catch {}

        if (onRejectBranchItem) onRejectBranchItem(branchIdKey, remarks);
      } else {
        if (onReturnBranchItem) onReturnBranchItem(branchIdKey, remarks);
      }

      setSelectedBranchItem(null);
      setRemarks('');
      setActionNotice({
        type: 'success',
        message: `Branch Item Activation for [${selectedBranchItem.branchName}] ${decision.toLowerCase()}d. Global Item identity remains unmodified.`,
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Operation failed.' });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // =========================================================================
  // WORKFLOW HANDLER (BUSINESS PARTNER)
  // =========================================================================
  const handleWorkflowDecision = (taskId: string, decision: 'APPROVE' | 'REJECT' | 'RETURN') => {
    if (!remarks.trim() && (decision === 'REJECT' || decision === 'RETURN')) {
      alert('Mandatory justification comments required.');
      return;
    }

    setWorkflowInstances((prev) =>
      prev.map((inst) => {
        const hasTask = inst.tasks.some((t) => t.id === taskId);
        if (!hasTask) return inst;
        return {
          ...inst,
          status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'RETURNED',
          tasks: inst.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'RETURNED',
                  decidedAt: new Date().toISOString(),
                  decidedBy: currentUser.fullName,
                  decisionComments: remarks,
                }
              : t
          ),
        };
      })
    );

    setSelectedTask(null);
    setRemarks('');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" />
            Dual-Stage Maker-Checker Approval Governance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict separation of duties: Stage 1 approves Global Technical Identity (no auto-activation), while Stage 2 activates Branch Operations (without modifying Global Master).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
            Stage 1: {pendingGlobalItems.length} Global Masters
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Stage 2: {pendingBranchItems.length} Branch Activations
          </span>
        </div>
      </div>

      {/* Segregated Stage Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> All Pending Tasks ({filteredRows.length})
        </button>

        <button
          onClick={() => setActiveTab('STAGE_1_GLOBAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'STAGE_1_GLOBAL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" /> Stage 1: Global Item Creation ({pendingGlobalItems.length})
        </button>

        <button
          onClick={() => setActiveTab('STAGE_2_BRANCH')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'STAGE_2_BRANCH'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" /> Stage 2: Branch Item Activation ({pendingBranchItems.length})
        </button>

        <button
          onClick={() => setActiveTab('BUSINESS_PARTNER')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'BUSINESS_PARTNER'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Business Partner Requests ({pendingBusinessPartnerTasks.length})
        </button>
      </div>

      {/* Main Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-slate-700 text-sm">Approval Queue Clear</div>
            <div>No items currently awaiting decision in this governance queue.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="p-3">Stage & Scope</th>
                  <th className="p-3">Identifier / Code</th>
                  <th className="p-3">Technical Description & Category</th>
                  <th className="p-3">Submitter (Maker)</th>
                  <th className="p-3">Segregated Duty Check</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((row) => {
                  if (row.kind === 'STAGE_1_GLOBAL') {
                    const isSelf = row.globalItem.createdBy === currentUser.id;
                    return (
                      <tr key={row.id} className="hover:bg-indigo-50/40 transition">
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Boxes className="w-3 h-3 text-indigo-600" /> Stage 1: Global Master
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">
                            Enterprise Catalog Identity
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {row.globalItem.globalItemCode}
                        </td>
                        <td className="p-3 text-slate-800 font-medium max-w-xs">
                          <div className="truncate font-semibold">{row.globalItem.description}</div>
                          <span className="text-[10px] text-slate-500">
                            UOM: {row.globalItem.defaultPurchaseUom || 'EA'} → {row.globalItem.defaultInventoryUom || 'EA'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          <div className="font-semibold">{row.globalItem.createdByName || row.globalItem.createdBy}</div>
                          <span className="text-[10px] text-slate-400">Maker ID: {row.globalItem.createdBy}</span>
                        </td>
                        <td className="p-3">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <ShieldAlert className="w-3 h-3 text-rose-600" /> Self-Created (Blocked)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Checker Eligible
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {row.sortDate ? row.sortDate.split('T')[0] : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedGlobalItem(row.globalItem);
                              setSelectedBranchItem(null);
                              setSelectedTask(null);
                              setRemarks('');
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            Inspect Stage 1
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  if (row.kind === 'STAGE_2_BRANCH') {
                    const isSelf = row.branchItem.createdBy === currentUser.id;
                    return (
                      <tr key={row.id} className="hover:bg-emerald-50/40 transition">
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <MapPin className="w-3 h-3 text-emerald-600" /> Stage 2: Branch Activation
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">
                            {row.branchItem.branchName}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {row.branchItem.globalItemCode}
                          <span className="block text-[10px] text-slate-400 font-sans">
                            Scope: {row.branchItem.branchCode}
                          </span>
                        </td>
                        <td className="p-3 text-slate-800 font-medium max-w-xs">
                          <div className="truncate font-semibold text-emerald-950">
                            {row.branchItem.branchSpecificDescription || 'Branch Availability Configuration'}
                          </div>
                          <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded border border-slate-200">
                            Category: {row.branchItem.categoryName} ({row.branchItem.categoryCode})
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">
                          <div className="font-semibold">{row.branchItem.createdByName || row.branchItem.createdBy}</div>
                          <span className="text-[10px] text-slate-400">Maker ID: {row.branchItem.createdBy}</span>
                        </td>
                        <td className="p-3">
                          {isSelf ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <ShieldAlert className="w-3 h-3 text-rose-600" /> Self-Created (Blocked)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Branch Checker Eligible
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {row.sortDate ? row.sortDate.split('T')[0] : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedBranchItem(row.branchItem);
                              setSelectedGlobalItem(null);
                              setSelectedTask(null);
                              setRemarks('');
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            Inspect Stage 2
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Kind: WORKFLOW (Business Partner)
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                          <Building2 className="w-3 h-3 text-amber-600" /> Partner Master
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{row.task.recordId}</td>
                      <td className="p-3 text-slate-800 font-medium max-w-xs truncate">{row.task.recordTitle}</td>
                      <td className="p-3 text-slate-600">
                        <div className="font-semibold">{row.task.submitterName}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                          Multi-Level
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {row.task.slaDueDate ? row.task.slaDueDate.split('T')[0] : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedTask(row.task);
                            setSelectedGlobalItem(null);
                            setSelectedBranchItem(null);
                            setRemarks('');
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          Inspect Task
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DataGridFooter
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={totalRecords}
        pageSizeOptions={pageSizeOptions}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        defaultSortNotice="Default Sort: Submission Date (Newest First)"
      />

      {/* ========================================================================= */}
      {/* MODAL 1: STAGE 1 GLOBAL ITEM CREATION INSPECTION MODAL                      */}
      {/* ========================================================================= */}
      {selectedGlobalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-indigo-950 text-white p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded uppercase tracking-wider">
                    Stage 1: Global Item Creation
                  </span>
                  <span className="text-xs text-indigo-300 font-mono font-bold">
                    {selectedGlobalItem.globalItemCode}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white mt-1">
                  Global Checker Approval Decision
                </h3>
              </div>
              <button
                onClick={() => setSelectedGlobalItem(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Invariant Policy Notice */}
              <div className="bg-blue-50 border border-blue-200 text-blue-950 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Architectural Boundary Enforcement: </span>
                  Global Item Approval cataloges technical master identity only. In accordance with enterprise governance, Global Approval does <strong>NOT</strong> auto-activate any branch. Branch-level procurement and inventory availability must be configured and approved separately in Stage 2.
                </div>
              </div>

              {/* Segregated Duty Warning if maker === checker */}
              {selectedGlobalItem.createdBy === currentUser.id && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Segregation of Duties Enforcement: Self-Approval Blocked</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      You are recorded as the creator/maker of this Global Item ({selectedGlobalItem.createdBy}). Enterprise master governance strictly forbids submitters from approving their own item master records. An independent authorized Checker must sign off.
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Identity Card */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  Global Technical Identity (Category-Free Master Catalog)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">GLOBAL ITEM CODE</span>
                    <span className="font-mono font-bold text-slate-900">{selectedGlobalItem.globalItemCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">MATERIAL</span>
                    <span className="font-semibold text-slate-900">{selectedGlobalItem.attributes?.material || 'PA'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PROCESS</span>
                    <span className="font-semibold text-slate-900">{selectedGlobalItem.attributes?.process || 'EX'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-400 block text-[10px]">DESCRIPTION</span>
                    <span className="font-bold text-slate-900">{selectedGlobalItem.description}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DEFAULT PURCHASE UOM</span>
                    <span className="font-bold text-indigo-900">{selectedGlobalItem.defaultPurchaseUom || 'EA'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DEFAULT INVENTORY UOM</span>
                    <span className="font-bold text-indigo-900">{selectedGlobalItem.defaultInventoryUom || 'EA'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CONVERSION FACTOR</span>
                    <span className="font-mono font-bold text-indigo-900">
                      {selectedGlobalItem.defaultUomConversion?.conversionFactor || 1.0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Maker Audit Info */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white flex items-center justify-between text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">CREATED BY (MAKER)</span>
                  <span className="font-bold text-slate-800">
                    {selectedGlobalItem.createdByName || selectedGlobalItem.createdBy} ({selectedGlobalItem.createdBy})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SUBMISSION DATE</span>
                  <span className="font-mono text-slate-700">{selectedGlobalItem.createdAt?.split('T')[0] || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CURRENT STATUS</span>
                  <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {selectedGlobalItem.status}
                  </span>
                </div>
              </div>

              {/* Justification & Comments */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Global Checker Decision Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Mandatory comments for approval justification, rejection, or return for correction..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setSelectedGlobalItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel Review
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStage1Decision('RETURN')}
                  disabled={isSubmittingAction || selectedGlobalItem.createdBy === currentUser.id}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Return for Correction
                </button>
                <button
                  onClick={() => handleStage1Decision('REJECT')}
                  disabled={isSubmittingAction || selectedGlobalItem.createdBy === currentUser.id}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject Global Item
                </button>
                <button
                  onClick={() => handleStage1Decision('APPROVE')}
                  disabled={isSubmittingAction || selectedGlobalItem.createdBy === currentUser.id}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Global Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STAGE 2 BRANCH ITEM ACTIVATION INSPECTION MODAL                   */}
      {/* ========================================================================= */}
      {selectedBranchItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-emerald-950 text-white p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded uppercase tracking-wider">
                    Stage 2: Branch Item Activation
                  </span>
                  <span className="text-xs text-emerald-300 font-mono font-bold">
                    {selectedBranchItem.branchName}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white mt-1">
                  Branch Checker Activation Decision
                </h3>
              </div>
              <button
                onClick={() => setSelectedBranchItem(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Invariant Policy Notice */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Architectural Boundary Enforcement: </span>
                  Branch Activation approval activates procurement and inventory use for <strong>{selectedBranchItem.branchName} ONLY</strong>. In accordance with enterprise governance, Branch Item Approval does <strong>NOT</strong> modify parent Global Item identity in Global Item Master.
                </div>
              </div>

              {/* Segregated Duty Warning if maker === checker */}
              {selectedBranchItem.createdBy === currentUser.id && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Segregation of Duties Enforcement: Self-Approval Blocked</div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      You are recorded as the creator/maker of this Branch Activation ({selectedBranchItem.createdBy}). Branch governance strictly requires an independent Branch Checker to review and approve this activation.
                    </div>
                  </div>
                </div>
              )}

              {/* Branch Scope & Category Assignment */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Target Branch Scope & Category Assignment
                  </div>
                  <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                    Ref: {selectedBranchItem.globalItemCode}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">COMPANY</span>
                    <span className="font-semibold text-slate-900">{selectedBranchItem.companyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BRANCH LOCATION</span>
                    <span className="font-bold text-slate-900">{selectedBranchItem.branchName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BRANCH CATEGORY</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                      {selectedBranchItem.categoryName} ({selectedBranchItem.categoryCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">OPERATIONAL ROLE</span>
                    <span className="font-bold text-slate-900">{selectedBranchItem.itemRole}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PURCHASE ENABLED</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.isPurchaseEnabled ? 'Yes (Permitted)' : 'No (Blocked)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">INVENTORY ENABLED</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.isInventoryEnabled ? 'Yes (Stocked)' : 'No (Non-Stocked)'}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-slate-400 block text-[10px]">BRANCH SPECIFIC DESCRIPTION</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.branchSpecificDescription || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch Operational Compliance Snapshot */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-slate-600" />
                  Branch Operational Controls & Compliance
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-700">
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">MOQ / ORDER MULTIPLE</span>
                    <span className="font-bold text-slate-900">
                      {selectedBranchItem.moq || 1} / {selectedBranchItem.orderMultiple || 1}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">SHELF LIFE</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.shelfLifeControlled
                        ? `${selectedBranchItem.shelfLifeDuration} ${selectedBranchItem.shelfLifeUnit}`
                        : 'Not Controlled'}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">SERIAL / BATCH TRACKING</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.serialTrackingEnabled ? 'Serial' : ''}
                      {selectedBranchItem.batchTrackingEnabled ? ' Batch' : ''}
                      {!selectedBranchItem.serialTrackingEnabled && !selectedBranchItem.batchTrackingEnabled ? 'None' : ''}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[9px]">QUALITY INSPECTION</span>
                    <span className="font-semibold text-slate-900">
                      {selectedBranchItem.qualityInspectionRequired
                        ? selectedBranchItem.inspectionType || 'Required'
                        : 'Exempt'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Justification & Comments */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Branch Checker Decision Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Mandatory comments for branch activation sign-off, rejection, or return for correction..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setSelectedBranchItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel Review
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStage2Decision('RETURN')}
                  disabled={isSubmittingAction || selectedBranchItem.createdBy === currentUser.id}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Return for Correction
                </button>
                <button
                  onClick={() => handleStage2Decision('REJECT')}
                  disabled={isSubmittingAction || selectedBranchItem.createdBy === currentUser.id}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject Activation
                </button>
                <button
                  onClick={() => handleStage2Decision('APPROVE')}
                  disabled={isSubmittingAction || selectedBranchItem.createdBy === currentUser.id}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Branch Activation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BUSINESS PARTNER WORKFLOW TASK MODAL                             */}
      {/* ========================================================================= */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 font-mono">
                  Review Task: {selectedTask.recordTitle}
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedTask.moduleKey} • Submitter: {selectedTask.submitterName}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Record ID:</span>
                  <span className="font-bold text-slate-900 font-mono">{selectedTask.recordId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Task Stage:</span>
                  <span className="font-bold text-slate-900">{selectedTask.stageName}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Checker Remarks / Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Decision remarks..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'RETURN')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition cursor-pointer"
                >
                  Return
                </button>
                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'REJECT')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'APPROVE')}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
