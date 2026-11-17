import React, { useMemo, useState } from 'react';
import {
  Coins,
  Layers,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Split,
  Receipt,
  ShieldCheck,
  Settings,
  Truck,
  History,
} from 'lucide-react';
import { User } from '../../types';
import {
  ChargeAllocationMethod,
  ChargeApplicationLevel,
  TransactionChargeItem,
} from '../../types/chargeManagement';
import { chargeManagementService } from '../../services/chargeManagementService';
import { chargeMasterService } from '../../services/chargeMasterService';
import { formatChargeAmount } from '../../services/prChargeItemService';
import { ChargeDetailsModal } from './ChargeDetailsModal';

interface ChargeManagementViewProps {
  currentUser: User;
  onNavigate?: (route: string) => void;
}

export const ChargeManagementView: React.FC<ChargeManagementViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'LANDED_COST' | 'RECON_AUDIT'>('LEDGER');
  const [searchQuery, setSearchQuery] = useState('');
  const [docFilter, setDocFilter] = useState<string>('ALL');
  const [selectedCharge, setSelectedCharge] = useState<TransactionChargeItem | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Quick Attach Charge Modal State
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachMasterCode, setAttachMasterCode] = useState('CHG-FREIGHT');
  const [attachDocType, setAttachDocType] = useState<TransactionChargeItem['sourceDocumentType']>('PO');
  const [attachDocNumber, setAttachDocNumber] = useState('PO-2026-0001');
  const [attachLevel, setAttachLevel] = useState<ChargeApplicationLevel>('PO_HEADER');
  const [attachRate, setAttachRate] = useState<number>(4500);
  const [attachMaterialValue, setAttachMaterialValue] = useState<number>(100000);
  const [attachRemarks, setAttachRemarks] = useState('');

  // Quick Allocation Modal State
  const [allocCharge, setAllocCharge] = useState<TransactionChargeItem | null>(null);
  const [allocMethod, setAllocMethod] = useState<ChargeAllocationMethod>('PROPORTIONAL_VALUE');

  const isAdmin = currentUser.role === 'PLATFORM_ADMIN' || currentUser.role === 'ORG_ADMIN';

  const summary = useMemo(
    () => chargeManagementService.getDashboardSummary('INR'),
    [refreshTick]
  );

  const allCharges = useMemo(
    () => chargeManagementService.getTransactionCharges(false),
    [refreshTick]
  );

  const activeMasters = useMemo(
    () => chargeMasterService.getCharges(false).filter((m) => m.isActive),
    [refreshTick]
  );

  const auditLogs = useMemo(
    () => chargeManagementService.getAuditLogs(),
    [refreshTick]
  );

  const reconciliations = useMemo(
    () => chargeManagementService.getReconciliations(),
    [refreshTick]
  );

  const shipments = useMemo(
    () => chargeManagementService.getShipments(),
    [refreshTick]
  );

  const filteredCharges = useMemo(() => {
    return allCharges.filter((c) => {
      if (docFilter !== 'ALL' && c.sourceDocumentType !== docFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          c.chargeCode.toLowerCase().includes(q) ||
          c.chargeName.toLowerCase().includes(q) ||
          c.sourceDocumentNumber.toLowerCase().includes(q) ||
          (c.supplierName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCharges, docFilter, searchQuery]);

  // Sample Landed Cost Breakdown for flagship PO & Shipment
  const sampleItemLanded = useMemo(
    () =>
      chargeManagementService.calculateItemWiseLandedCost({
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        sourceDocType: 'PO',
        sourceDocId: 'po-001',
        sourceDocNumber: 'PO-2026-0001',
        sourceLineId: 'pol-001',
        quantity: 12,
        uom: 'BAG',
        materialCost: 81600,
        currency: 'INR',
      }),
    [refreshTick]
  );

  const sampleShipmentLanded = useMemo(() => {
    if (shipments.length === 0) return null;
    try {
      return chargeManagementService.calculateShipmentLandedCost(shipments[0].id, 81600);
    } catch {
      return null;
    }
  }, [shipments, refreshTick]);

  const handleAttachCharge = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = chargeManagementService.addTransactionCharge(
        {
          chargeCodeOrId: attachMasterCode,
          sourceDocumentType: attachDocType,
          sourceDocumentId: attachDocNumber.toLowerCase(),
          sourceDocumentNumber: attachDocNumber,
          originPrId: attachDocType === 'PR' ? attachDocNumber.toLowerCase() : 'pr-001',
          originPrNumber: attachDocType === 'PR' ? attachDocNumber : 'PR-2026-0001',
          originPoId: attachDocType === 'PO' ? attachDocNumber.toLowerCase() : undefined,
          originPoNumber: attachDocType === 'PO' ? attachDocNumber : undefined,
          applicationLevel: attachLevel,
          rate: attachRate,
          materialValue: attachMaterialValue,
          totalPoMaterialValue: attachMaterialValue,
          quantity: 10,
          remarks: attachRemarks || `Attached from Charge Workbench by ${currentUser.fullName}`,
        },
        { id: currentUser.id, name: currentUser.fullName, user: currentUser }
      );
      setShowAttachModal(false);
      setAttachRemarks('');
      setRefreshTick((t) => t + 1);
      setBanner({
        type: 'success',
        msg: `Attached ${created.chargeCode} (${created.chargeName}) to ${created.sourceDocumentNumber} (${formatChargeAmount(created.totalWithTax, created.currency)} incl. tax).`,
      });
    } catch (err: any) {
      setBanner({ type: 'error', msg: err?.message || 'Failed to attach charge.' });
    }
  };

  const handleRunAllocation = () => {
    if (!allocCharge) return;
    try {
      const rec = chargeManagementService.allocateChargeToLines(
        {
          transactionChargeId: allocCharge.id,
          allocationMethod: allocMethod,
          targetLines: [
            {
              lineId: 'pol-001',
              itemCode: 'RMPAOPOEXLG0001',
              description: 'PC-ABS Injection Grade V0',
              materialValue: 60000,
              quantity: 10,
              weightKg: 250,
              volumeCbm: 1.2,
            },
            {
              lineId: 'pol-002',
              itemCode: 'RMPAOPOEXLG0004',
              description: 'Polyamide Resin Filler',
              materialValue: 40000,
              quantity: 5,
              weightKg: 125,
              volumeCbm: 0.8,
            },
          ],
        },
        { id: currentUser.id, name: currentUser.fullName, user: currentUser }
      );
      setAllocCharge(null);
      setRefreshTick((t) => t + 1);
      setBanner({
        type: 'success',
        msg: `Allocated ${formatChargeAmount(rec.allocatedTotalAmount, allocCharge.currency)} across ${rec.lines.length} lines using ${rec.allocationMethod} (Zero-drift residual: ${rec.roundingAdjustmentDelta}).`,
      });
    } catch (err: any) {
      setBanner({ type: 'error', msg: err?.message || 'Allocation failed.' });
    }
  };

  return (
    <div className="space-y-5 w-full max-w-none">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-indigo-600" />
            <span>Procurement Charge & Landed Cost Workbench</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track non-inventory procurement charges, zero-drift line allocations, statutory ITC vs landed capitalization, and estimated-to-actual reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && onNavigate && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('/settings/general/charge-master')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-600" />
                <span>Charge Master</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/settings/general/pr-charge-mapping')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>PR Charge Mapping</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowAttachModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Attach Transaction Charge</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
            banner.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="px-2 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Estimated Charges (PR)</div>
          <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
            {formatChargeAmount(summary.totalEstimatedCharges, summary.currency)}
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Approved Commitments (PO)</div>
          <div className="text-base font-extrabold font-mono text-indigo-700 mt-1">
            {formatChargeAmount(summary.totalApprovedCharges, summary.currency)}
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Actual Invoiced</div>
          <div className="text-base font-extrabold font-mono text-emerald-700 mt-1">
            {formatChargeAmount(summary.totalActualCharges, summary.currency)}
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Unallocated Pool</div>
          <div className="text-base font-extrabold font-mono text-amber-700 mt-1">
            {formatChargeAmount(summary.unallocatedChargesTotal, summary.currency)}
          </div>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500">Pending Approvals / Recon</div>
          <div className="text-base font-extrabold font-mono text-slate-900 mt-1">
            {summary.pendingApprovalCount} / {summary.pendingReconciliationCount}
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('LEDGER')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'LEDGER'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Transaction Charges Ledger ({allCharges.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('LANDED_COST')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'LANDED_COST'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Item & Shipment Landed Cost Rollup</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RECON_AUDIT')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
            activeTab === 'RECON_AUDIT'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Reconciliations & Audit Log ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: Transaction Charges Ledger */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Search transaction charges"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Charge Code, Name, PR/PO/Shipment #, or Supplier..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="charge-doc-filter" className="text-[11px] font-bold text-slate-600">
                Document:
              </label>
              <select
                id="charge-doc-filter"
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">All Documents</option>
                <option value="PR">Purchase Requisition (PR)</option>
                <option value="RFQ">RFQ</option>
                <option value="PO">Purchase Order (PO)</option>
                <option value="SHIPMENT">Shipment / Trip</option>
                <option value="GRN">Goods Receipt (GRN)</option>
                <option value="INVOICE">Vendor Invoice</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-[#0B192C] text-white text-[11px] font-bold">
                  <th className="p-3 border-r border-slate-800">Charge</th>
                  <th className="p-3 border-r border-slate-800">Source Document</th>
                  <th className="p-3 border-r border-slate-800">Level & Stage</th>
                  <th className="p-3 border-r border-slate-800">Method / Bearer</th>
                  <th className="p-3 text-right border-r border-slate-800">Base Amount</th>
                  <th className="p-3 text-right border-r border-slate-800">Tax (Rec / Non-Rec)</th>
                  <th className="p-3 text-right border-r border-slate-800">Allocation</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                      No matching transaction charges found.
                    </td>
                  </tr>
                ) : (
                  filteredCharges.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{c.chargeName}</div>
                        <div className="text-[10px] font-mono text-indigo-700">
                          {c.chargeCode} · {c.chargeCategory}
                        </div>
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-mono font-bold text-slate-800">
                          {c.sourceDocumentNumber}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {c.sourceDocumentType}
                          {c.supplierName ? ` · ${c.supplierName}` : ''}
                        </div>
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-800">
                          {c.applicationLevel.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-500">Stage: {c.lifecycleStage}</div>
                      </td>
                      <td className="p-3 border-r border-slate-200">
                        <div className="text-slate-800 font-medium">
                          {c.calculationMethod.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {c.chargeBearer.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                        {formatChargeAmount(c.chargeAmount, c.currency)}
                      </td>
                      <td className="p-3 text-right font-mono border-r border-slate-200">
                        <div className="text-emerald-700 font-bold">
                          Rec: {formatChargeAmount(c.taxBreakdown.recoverableTax, c.currency)}
                        </div>
                        <div className="text-[10px] text-amber-800">
                          Non-Rec: {formatChargeAmount(c.taxBreakdown.nonRecoverableTax, c.currency)}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono border-r border-slate-200">
                        <div className="font-bold text-slate-800">{c.allocationStatus}</div>
                        <div className="text-[10px] text-slate-500">
                          Rem: {formatChargeAmount(c.remainingUnallocatedAmount, c.currency)}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCharge(c)}
                            aria-label={`Inspect ${c.chargeCode} on ${c.sourceDocumentNumber}`}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAllocCharge(c);
                              setAllocMethod(c.allocationMethod);
                            }}
                            aria-label={`Allocate ${c.chargeCode}`}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Split className="w-3 h-3" />
                            <span>Allocate</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Item & Shipment Landed Cost Rollup */}
      {activeTab === 'LANDED_COST' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Item-Wise Landed Cost Progression ({sampleItemLanded.itemCode})
                </h3>
                <p className="text-[11px] text-slate-500">
                  {sampleItemLanded.description} · {sampleItemLanded.sourceDocNumber} ({sampleItemLanded.quantity}{' '}
                  {sampleItemLanded.uom})
                </p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2">Stage</th>
                    <th className="p-2 text-right">Material</th>
                    <th className="p-2 text-right">Charges</th>
                    <th className="p-2 text-right">Non-Rec Tax</th>
                    <th className="p-2 text-right">Landed Total</th>
                    <th className="p-2 text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {Object.values(sampleItemLanded.stages).map((st) => (
                    <tr key={st.stage}>
                      <td className="p-2 font-sans font-bold text-slate-800">{st.stage}</td>
                      <td className="p-2 text-right">
                        {formatChargeAmount(st.materialCost, sampleItemLanded.currency)}
                      </td>
                      <td className="p-2 text-right text-indigo-700 font-bold">
                        {formatChargeAmount(
                          st.directLineCharges + st.allocatedIndirectCharges,
                          sampleItemLanded.currency
                        )}
                      </td>
                      <td className="p-2 text-right text-amber-800">
                        {formatChargeAmount(st.nonRecoverableTaxes, sampleItemLanded.currency)}
                      </td>
                      <td className="p-2 text-right font-extrabold text-slate-900">
                        {formatChargeAmount(st.totalLandedCost, sampleItemLanded.currency)}
                      </td>
                      <td className="p-2 text-right text-indigo-900 font-bold">
                        {formatChargeAmount(st.landedUnitCost, sampleItemLanded.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500">
              Note: Recoverable Input Tax Credits (GST ITC) are strictly excluded from capitalized unit landed cost.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5">
              Shipment-Level Landed Cost Summary
            </h3>
            {sampleShipmentLanded ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-500">Shipment Reference</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {sampleShipmentLanded.shipmentNumber} ({sampleShipmentLanded.poNumber})
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200">
                    <div className="text-[10px] font-bold text-indigo-700">Total Shipment Landed Cost</div>
                    <div className="font-mono font-extrabold text-indigo-900 mt-0.5">
                      {formatChargeAmount(
                        sampleShipmentLanded.totalShipmentLandedCost,
                        sampleShipmentLanded.currency
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-[11px] p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600">Material Value in Shipment:</span>
                  <span className="text-right font-mono font-bold">
                    {formatChargeAmount(
                      sampleShipmentLanded.materialValueInShipment,
                      sampleShipmentLanded.currency
                    )}
                  </span>
                  <span className="text-slate-600">Direct Shipment Charges:</span>
                  <span className="text-right font-mono font-bold text-indigo-700">
                    {formatChargeAmount(
                      sampleShipmentLanded.shipmentDirectCharges,
                      sampleShipmentLanded.currency
                    )}
                  </span>
                  <span className="text-slate-600">Non-Recoverable Taxes:</span>
                  <span className="text-right font-mono font-bold text-amber-800">
                    {formatChargeAmount(
                      sampleShipmentLanded.nonRecoverableTaxes,
                      sampleShipmentLanded.currency
                    )}
                  </span>
                  <span className="text-slate-600">Recoverable ITC Excluded:</span>
                  <span className="text-right font-mono font-bold text-emerald-700">
                    {formatChargeAmount(
                      sampleShipmentLanded.recoverableInputTaxExcluded,
                      sampleShipmentLanded.currency
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No shipment records available yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Reconciliations & Audit */}
      {activeTab === 'RECON_AUDIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Invoice Variance Reconciliations ({reconciliations.length})
            </h3>
            {reconciliations.length === 0 ? (
              <p className="text-xs text-slate-500">
                No pending invoice variance reconciliations recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {reconciliations.map((r) => (
                  <div key={r.id} className="p-3 rounded-lg border border-slate-200 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>{r.invoiceNumber}</span>
                      <span className="font-mono">{r.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Approved: {r.approvedAmount} · Actual: {r.actualAmount} · Variance:{' '}
                      {r.varianceApprovedVsActual} ({r.variancePercent}%)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Charge Governance Audit Trail ({auditLogs.length})
            </h3>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                Actions such as attaching, allocating, overriding, or reconciling charges are logged here automatically.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {auditLogs.map((a) => (
                  <div key={a.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px]">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{a.action}</span>
                      <span className="font-mono text-slate-500">
                        {new Date(a.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5">{a.reason}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Actor: {a.actorName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attach Charge Modal */}
      {showAttachModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Attach Transaction Charge"
        >
          <form
            onSubmit={handleAttachCharge}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="bg-[#0B192C] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Attach Governed Charge to Transaction</h3>
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Charge Master Item</label>
                <select
                  value={attachMasterCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setAttachMasterCode(code);
                    const found = activeMasters.find((m) => m.chargeCode === code);
                    if (found) setAttachRate(found.defaultRate);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {activeMasters.map((m) => (
                    <option key={m.id} value={m.chargeCode}>
                      {m.chargeCode} — {m.chargeName} ({m.defaultCalculationMethod})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Document Type</label>
                  <select
                    value={attachDocType}
                    onChange={(e) => setAttachDocType(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PR">Purchase Requisition</option>
                    <option value="RFQ">RFQ</option>
                    <option value="PO">Purchase Order</option>
                    <option value="SHIPMENT">Shipment</option>
                    <option value="GRN">Goods Receipt</option>
                    <option value="INVOICE">Invoice</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Document Number</label>
                  <input
                    type="text"
                    value={attachDocNumber}
                    onChange={(e) => setAttachDocNumber(e.target.value)}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Application Level</label>
                  <select
                    value={attachLevel}
                    onChange={(e) => setAttachLevel(e.target.value as ChargeApplicationLevel)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PR_HEADER">PR Header</option>
                    <option value="PR_LINE">PR Line</option>
                    <option value="RFQ_LEVEL">RFQ Level</option>
                    <option value="PO_HEADER">PO Header</option>
                    <option value="PO_LINE">PO Line</option>
                    <option value="SHIPMENT_CONSIGNMENT_LEVEL">Shipment / Consignment</option>
                    <option value="GRN_RECEIPT_LEVEL">GRN / Receipt</option>
                    <option value="INVOICE_BILL_LEVEL">Invoice / Bill</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rate / Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={attachRate}
                    onChange={(e) => setAttachRate(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Material Value Basis</label>
                <input
                  type="number"
                  min={0}
                  value={attachMaterialValue}
                  onChange={(e) => setAttachMaterialValue(Number(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={attachRemarks}
                  onChange={(e) => setAttachRemarks(e.target.value)}
                  placeholder="Reason / scope..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Attach Charge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Allocate Modal */}
      {allocCharge && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Allocate Charge Across Lines"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#0B192C] text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Allocate {allocCharge.chargeCode} Across Lines</h3>
              <button
                type="button"
                onClick={() => setAllocCharge(null)}
                className="text-slate-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600">
                Charge Amount:{' '}
                <strong className="font-mono text-slate-900">
                  {formatChargeAmount(allocCharge.chargeAmount, allocCharge.currency)}
                </strong>
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Allocation Basis</label>
                <select
                  value={allocMethod}
                  onChange={(e) => setAllocMethod(e.target.value as ChargeAllocationMethod)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="PROPORTIONAL_VALUE">Proportional by Material Value</option>
                  <option value="PROPORTIONAL_QUANTITY">Proportional by Quantity</option>
                  <option value="PROPORTIONAL_WEIGHT">Proportional by Weight</option>
                  <option value="PROPORTIONAL_VOLUME">Proportional by Volume</option>
                  <option value="EQUAL_SPLIT">Equal Split</option>
                  <option value="DIRECT_LINE_ALLOCATION">Direct Line Allocation</option>
                </select>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAllocCharge(null)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunAllocation}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Execute Deterministic Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      <ChargeDetailsModal charge={selectedCharge} onClose={() => setSelectedCharge(null)} />
    </div>
  );
};
