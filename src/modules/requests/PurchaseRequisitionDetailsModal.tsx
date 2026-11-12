/**
 * CIPPLATFORM - PURCHASE REQUISITION DETAILS & APPROVAL MODAL
 * Phase 1 PR Module: Displays PR details, item lines, delivery schedules, change history, and approval actions.
 */

import React, { useState } from 'react';
import { User } from '../../types';
import { PurchaseRequisitionHeader } from '../../types/purchaseRequisition';
import { PurchaseRequisitionService } from '../../services/purchaseRequisitionService';
import { X, CheckCircle2, XCircle, RotateCcw, FileText, ShieldCheck, Box, Edit3, Trash2, Minimize2, Maximize2, Minimize } from 'lucide-react';
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleToggleMaximize = () => setIsMaximized(!isMaximized);
  const handleToggleMinimize = () => setIsMinimized(!isMinimized);
  const [lines, setLines] = useState(pr.lines); // NEW STATE

  const handleApprove = () => {
    PurchaseRequisitionService.approvePR(pr.id, currentUser.fullName, currentUser.role, remarks);
    onUpdated();
    onClose();
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      alert('Please provide rejection remarks.');
      return;
    }
    PurchaseRequisitionService.rejectPR(pr.id, currentUser.fullName, remarks);
    onUpdated();
    onClose();
  };

  const handleReturn = () => {
    if (!remarks.trim()) {
      alert('Please provide return-for-correction remarks.');
      return;
    }
    PurchaseRequisitionService.returnForCorrection(pr.id, remarks);
    onUpdated();
    onClose();
  };

  const handleInitiateChange = () => {
    if (!changeReason.trim()) {
      alert('Please enter a mandatory change reason.');
      return;
    }
    // Update lines or purpose here
    PurchaseRequisitionService.initiateChangeRequest(pr.id, currentUser.id, currentUser.fullName, changeReason, [
      { field: 'purchasePurpose', oldValue: pr.purchasePurpose, newValue: newPurpose }
    ]);
    setShowChangeModal(false);
    onUpdated();
    onClose();
  };

  return (
    <>
      <EnterpriseModal
        title={`PR Details: ${pr.prNumber}`}
        subtitle={`${pr.prType} Requisition | Status: ${pr.status} | Requested by ${pr.requesterName}`}
        isOpen={true}
        onClose={onClose}
        isMaximized={isMaximized}
        onToggleMaximize={handleToggleMaximize}
        isMinimized={isMinimized}
        onToggleMinimize={handleToggleMinimize}
      >
        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Top Control Panel: Company, Branch, PR Type, Priority, Department */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">Company</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">{pr.companyCode}</div>
            </div>
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">Branch</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">{pr.branchName}</div>
            </div>
            <div>
              <label className="font-bold text-slate-700 mb-1">PR Type</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">{pr.prType}</div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">{pr.priority}</div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <div className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800 text-xs">{pr.department}</div>
            </div>
          </div>


          <div>
            <h4 className="font-bold text-slate-800 mb-1">Purchase Purpose</h4>
            <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">{pr.purchasePurpose}</p>
          </div>

          {/* Item Lines Section Header */}
          <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200">
            <div>
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <span>PR Item Lines & Default Warehouses</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {lines.length} Line(s) Total
                </span>
              </h4>
            </div>
          </div>

          {/* SINGLE VIEW HIGH-DENSITY ITEM LINES TABLE WITH FIXED LAYOUT & PRECISE ALIGNMENT */}
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
                    <th className="p-2.5 text-right border-r border-slate-800">Unit Price (₹)</th>
                    <th className="p-2.5 text-right border-r border-slate-800">Subtotal (₹)</th>
                    <th className="p-2.5 border-r border-slate-800">Delivery Schedule Splits</th>
                    <th className="p-2.5 border-r border-slate-800">Default Warehouse (Item-Based)</th>
                    <th className="p-2.5 border-r border-slate-800">Purchase Purpose & Business Justification</th>
                    <th className="p-2.5 border-r border-slate-800">Item Attachments & Files</th>
                    <th className="p-2.5 border-r border-slate-800">Assigned Buyer (Override)</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lines.map((line, idx) => {
                    const totalScheduledQty = line.deliverySchedules.reduce((sum, s) => sum + (s.quantity || 0), 0);
                    
                    return (
                      <tr key={idx} className={`hover:bg-indigo-50/30 transition align-top ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-2 text-center border-r border-slate-200 font-bold bg-slate-100 text-slate-700 font-mono w-14">
                          <span className="px-1.5 py-1 bg-slate-200 rounded text-[11px] block border border-slate-300">#{idx + 1}</span>
                        </td>
                        <td className="p-2 border-r border-slate-200 w-44">
                          <div className="font-bold text-indigo-700 text-xs">{line.itemCode}</div>
                          <div className="text-[10px] text-slate-500">Cat: {line.itemCategory}</div>
                        </td>
                        <td className="p-2 border-r border-slate-200 w-48 text-[11px] font-semibold text-slate-800">{line.description}</td>
                        <td className="p-2 text-center border-r border-slate-200 font-bold text-xs w-16">{line.inventoryUom}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-bold text-xs w-20">{line.requestedQuantity}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-bold text-xs w-24">₹{line.approximateUnitPrice.toLocaleString('en-IN')}</td>
                        <td className="p-2 text-right border-r border-slate-200 font-bold text-xs w-28 text-indigo-700">₹{(line.requestedQuantity * line.approximateUnitPrice).toLocaleString('en-IN')}</td>
                        <td className="p-2 border-r border-slate-200 text-[10px] w-44 space-y-1">
                           {line.deliverySchedules.map((sch, i) => (
                             <div key={i} className="flex justify-between bg-slate-100 px-1 rounded">
                               <span>{sch.deliveryDate}</span>
                               <span className="font-bold">{sch.quantity}</span>
                             </div>
                           ))}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-[10px] w-48">{line.defaultWarehouse || 'WH-GEN-01'}</td>
                        <td className="p-2 border-r border-slate-200 text-[10px] w-60">
                          <div className="font-bold">Purpose:</div> {line.purchasePurpose}
                          <div className="font-bold mt-1">Justification:</div> {line.businessJustification}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-[10px] w-36">
                          {(line.lineAttachments || []).length} File(s)
                        </td>
                        <td className="p-2 border-r border-slate-200 text-[11px] font-bold text-indigo-700 w-44">{line.assignedBuyer || 'Default Buyer'}</td>
                        <td className="p-2 text-center w-14">
                           <button className="text-slate-400 hover:text-indigo-600"><FileText className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks for approval / return */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block font-bold text-slate-700">Approval / Review Remarks</label>
            <textarea
              rows={2}
              placeholder="Enter remarks for approval, rejection, or return..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setShowChangeModal(true)}
            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg flex items-center gap-1.5"
          >
            <Edit3 className="w-4 h-4" /> Request Change
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReturn}
              className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-800 font-bold rounded-lg flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" /> Return for Correction
            </button>
            <button
              onClick={handleReject}
              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg flex items-center gap-1"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={handleApprove}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve PR
            </button>
          </div>
        </div>
      </EnterpriseModal>

      {/* Change Request Modal */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Initiate Approved PR Change</h3>
            <p className="text-xs text-slate-500">
              Changes to approved PRs trigger mandatory reapproval and version retention.
            </p>
            <div>
              <label className="block font-bold text-slate-700 mb-1">New Purpose / Notes</label>
              <input
                type="text"
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mandatory Change Reason *</label>
              <textarea
                rows={2}
                placeholder="Why is this change required?"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowChangeModal(false)} className="px-3 py-1.5 bg-slate-100 rounded text-xs font-bold">
                Cancel
              </button>
              <button onClick={handleInitiateChange} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold">
                Submit Change & Reapprove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
