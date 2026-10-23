import React, { useState } from 'react';
import { GlobalItem, User } from '../../types';
import { WorkflowInstance, WorkflowTask } from '../../types/approvalWorkflow';
import { INITIAL_WORKFLOW_INSTANCES } from '../../data/seedWorkflows';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Eye,
  UserPlus,
  Clock,
  Layers,
  Building2,
  GitCommit,
  CheckCircle,
  FileText,
  Boxes,
} from 'lucide-react';

interface ApprovalInboxViewProps {
  items: GlobalItem[];
  currentUser: User;
  onApproveItem: (itemId: string, remarks: string) => void;
  onRejectItem: (itemId: string, remarks: string) => void;
  onReturnItem: (itemId: string, remarks: string) => void;
}

export const ApprovalInboxView: React.FC<ApprovalInboxViewProps> = ({
  items,
  currentUser,
  onApproveItem,
  onRejectItem,
  onReturnItem,
}) => {
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>(INITIAL_WORKFLOW_INSTANCES);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [selectedItem, setSelectedItem] = useState<GlobalItem | null>(null);
  const [remarks, setRemarks] = useState('');
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE' | null>(null);
  const [delegateUser, setDelegateUser] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ITEM_MASTER' | 'BUSINESS_PARTNER'>('ALL');

  // Legacy item submissions queue
  const pendingLegacyItems = items.filter((i) => i.status === 'SUBMITTED' || i.status === 'UNDER_REVIEW');

  // Multi-level workflow pending tasks
  const pendingWorkflowTasks = workflowInstances
    .flatMap((inst) => inst.tasks)
    .filter((task) => task.status === 'PENDING');

  const filteredTasks = pendingWorkflowTasks.filter((task) => {
    if (activeTab === 'ITEM_MASTER') return task.moduleKey === 'ITEM_MASTER';
    if (activeTab === 'BUSINESS_PARTNER') return task.moduleKey === 'BUSINESS_PARTNER_MASTER';
    return true;
  });

  const handleWorkflowDecision = (
    taskId: string,
    decision: 'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE'
  ) => {
    if (!remarks.trim() && (decision === 'REJECT' || decision === 'RETURN' || decision === 'DELEGATE')) {
      alert('Mandatory justification comments required for Rejection, Return, or Delegation.');
      return;
    }

    setWorkflowInstances((prev) =>
      prev.map((inst) => {
        const hasTask = inst.tasks.some((t) => t.id === taskId);
        if (!hasTask) return inst;

        const task = inst.tasks.find((t) => t.id === taskId)!;

        let newStatus = inst.status;
        let newStageOrder = inst.currentStageOrder;

        if (decision === 'APPROVE') {
          if (inst.currentStageOrder < inst.totalStages) {
            newStageOrder += 1;
            newStatus = 'UNDER_REVIEW';
          } else {
            newStatus = 'APPROVED';
          }
        } else if (decision === 'REJECT') {
          newStatus = 'REJECTED';
        } else if (decision === 'RETURN') {
          newStatus = 'RETURNED';
        }

        const updatedTasks = inst.tasks.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : decision === 'RETURN' ? 'RETURNED' : 'DELEGATED',
              decidedAt: new Date().toISOString(),
              decidedBy: currentUser.fullName,
              decisionComments: remarks,
            } as WorkflowTask;
          }
          return t;
        });

        const newHistory = [
          ...inst.history,
          {
            id: `h-${Date.now()}`,
            stageName: task.stageName,
            actorName: currentUser.fullName,
            action: decision,
            timestamp: new Date().toISOString(),
            comments: remarks + (decision === 'DELEGATE' ? ` (Delegated to ${delegateUser})` : ''),
          },
        ];

        return {
          ...inst,
          currentStageOrder: newStageOrder,
          status: newStatus,
          tasks: updatedTasks,
          history: newHistory,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    // Also trigger item master handler if linked
    if (selectedTask?.moduleKey === 'ITEM_MASTER' && selectedTask.recordId) {
      if (decision === 'APPROVE') onApproveItem(selectedTask.recordId, remarks);
      else if (decision === 'REJECT') onRejectItem(selectedTask.recordId, remarks);
      else if (decision === 'RETURN') onReturnItem(selectedTask.recordId, remarks);
    }

    setSelectedTask(null);
    setActionType(null);
    setRemarks('');
    setDelegateUser('');
  };

  const handleLegacyAction = () => {
    if (!selectedItem || !actionType) return;
    if (!remarks.trim() && (actionType === 'REJECT' || actionType === 'RETURN')) {
      alert('Remarks are mandatory for Rejection or Returning for correction.');
      return;
    }

    if (actionType === 'APPROVE') {
      onApproveItem(selectedItem.id, remarks.trim() || 'Approved for global master catalog.');
    } else if (actionType === 'REJECT') {
      onRejectItem(selectedItem.id, remarks.trim());
    } else {
      onReturnItem(selectedItem.id, remarks.trim());
    }

    setSelectedItem(null);
    setActionType(null);
    setRemarks('');
  };

  const isSelfSubmission = selectedTask
    ? selectedTask.submitterId === currentUser.id
    : selectedItem?.createdBy === currentUser.id;

  const currentInstance = selectedTask
    ? workflowInstances.find((i) => i.id === selectedTask.instanceId)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-600" />
            Standardized Multi-Level Approval Inbox
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-module governance queue for Item Master, Business Partner Master, and enterprise workflows with strict maker-checker controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            {filteredTasks.length + pendingLegacyItems.length} Tasks Awaiting Decision
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> All Pending Tasks ({pendingWorkflowTasks.length + pendingLegacyItems.length})
        </button>
        <button
          onClick={() => setActiveTab('ITEM_MASTER')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ITEM_MASTER'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" /> Item Master Requests
        </button>
        <button
          onClick={() => setActiveTab('BUSINESS_PARTNER')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'BUSINESS_PARTNER'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> Business Partner Requests
        </button>
      </div>

      {/* Main Queue List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTasks.length === 0 && pendingLegacyItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-slate-700 text-sm">Approval Inbox Clear</div>
            <div>All submitted items and multi-level tasks have been reviewed and decided upon.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="p-3">Module & Record ID</th>
                  <th className="p-3">Workflow & Current Stage</th>
                  <th className="p-3">Record Title / Description</th>
                  <th className="p-3">Submitter & Branch</th>
                  <th className="p-3">SLA Due Date</th>
                  <th className="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Standardized Multi-Level Workflow Tasks */}
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3">
                      <span className="font-mono font-bold text-cyan-800 block">{task.recordId}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{task.moduleKey.replace('_', ' ')}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{task.stageName}</div>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold inline-block mt-0.5">
                        Assigned Role: {task.assignedRole}
                      </span>
                    </td>
                    <td className="p-3 text-slate-800 font-medium max-w-xs truncate">{task.recordTitle}</td>
                    <td className="p-3 text-slate-600">
                      <div className="font-semibold">{task.submitterName}</div>
                      <div className="text-[10px] text-slate-400">{task.branchName}</div>
                    </td>
                    <td className="p-3 text-amber-700 font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {task.slaDueDate.split('T')[0]}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setRemarks('');
                          setActionType(null);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        Inspect & Decision
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Legacy Direct Item Submissions */}
                {activeTab !== 'BUSINESS_PARTNER' &&
                  pendingLegacyItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition bg-amber-50/30">
                      <td className="p-3 font-mono font-bold text-cyan-800">
                        {item.globalItemCode}
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-sans">
                          Direct Legacy
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">Item Master Submission</td>
                      <td className="p-3 text-slate-800 font-medium max-w-xs truncate">{item.description}</td>
                      <td className="p-3 text-slate-600">
                        {item.approvalHistory[0]?.actorName || item.createdBy}
                      </td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{item.updatedAt.split('T')[0]}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setRemarks('');
                            setActionType(null);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs shadow-xs transition cursor-pointer"
                        >
                          Inspect Legacy Item
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Review Modal for Multi-Level Workflow Tasks */}
      {selectedTask && currentInstance && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Multi-Level Workflow Decision: {selectedTask.recordTitle}
                </h3>
                <p className="text-xs text-slate-300">
                  {selectedTask.moduleKey} • {selectedTask.stageName} • Submitter: {selectedTask.submitterName}
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
              {/* Maker-Checker Warning */}
              {isSelfSubmission && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold">Governance Conflict: Self-Approval Blocked</div>
                    <div className="text-[11px] text-rose-700">
                      You are the original submitter of this record. Server governance blocks submitters from approving their own workflow stages.
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Timeline */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <GitCommit className="w-4 h-4 text-blue-600" />
                  Approval Stage Timeline (Stage {currentInstance.currentStageOrder} of {currentInstance.totalStages})
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {currentInstance.history.map((h, idx) => (
                    <div key={h.id} className="flex-1 bg-emerald-100 border border-emerald-300 rounded p-2 text-[11px]">
                      <div className="font-bold text-emerald-900 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {h.stageName}
                      </div>
                      <div className="text-emerald-800 text-[10px] mt-0.5">{h.actorName} • {h.action}</div>
                      <div className="text-emerald-700 text-[9px] italic mt-0.5">"{h.comments}"</div>
                    </div>
                  ))}
                  <div className="flex-1 bg-amber-100 border border-amber-300 rounded p-2 text-[11px]">
                    <div className="font-bold text-amber-900 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      {selectedTask.stageName}
                    </div>
                    <div className="text-amber-800 text-[10px] mt-0.5">Assigned Role: {selectedTask.assignedRole}</div>
                    <div className="text-amber-700 text-[9px] mt-0.5">Pending Action</div>
                  </div>
                </div>
              </div>

              {/* Record Summary Details */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">RECORD ID</span>
                    <span className="font-mono font-bold text-slate-900">{selectedTask.recordId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BRANCH / LOCATION</span>
                    <span className="font-bold text-slate-900">{selectedTask.branchName}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">DESCRIPTION / HEADING</span>
                    <span className="font-semibold text-slate-900">{selectedTask.recordTitle}</span>
                  </div>
                </div>
              </div>

              {/* Action Selection & Comments */}
              <div className="space-y-3">
                <label className="block font-bold text-slate-800">
                  Approver Remarks & Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Provide detailed decision remarks for approval, rejection, or return..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />

                {actionType === 'DELEGATE' && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                    <label className="block font-bold text-indigo-900">
                      Delegate Approval Task To User:
                    </label>
                    <input
                      type="text"
                      value={delegateUser}
                      onChange={(e) => setDelegateUser(e.target.value)}
                      placeholder="Enter username or email address for delegate (e.g., srinivasan.m@kosh.com)..."
                      className="w-full p-2 border border-indigo-300 rounded text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel Review
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActionType('DELEGATE');
                    if (delegateUser) handleWorkflowDecision(selectedTask.id, 'DELEGATE');
                  }}
                  disabled={isSelfSubmission}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Delegate Task
                </button>

                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'RETURN')}
                  disabled={isSelfSubmission}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Return for Correction
                </button>

                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'REJECT')}
                  disabled={isSelfSubmission}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject Record
                </button>

                <button
                  onClick={() => handleWorkflowDecision(selectedTask.id, 'APPROVE')}
                  disabled={isSelfSubmission}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Stage Decision
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Review Modal for Legacy Items */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 font-mono">
                  Review Submission: {selectedItem.globalItemCode}
                </h3>
                <p className="text-xs text-slate-300">Category {selectedItem.categoryCode} • Created by {selectedItem.createdBy}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isSelfSubmission && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3 rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold">Segregated Duty Enforcement: Self-Approval Blocked</div>
                    <div className="text-[11px] text-rose-700">
                      You created this item draft. Per master governance rules, another authorized Checker must approve this submission.
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Item Description:</span>
                  <span className="font-bold text-slate-900 text-right">{selectedItem.description}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Checker Decision Remarks / Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Mandatory explanation for approval, return, or rejection..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setActionType(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 font-medium hover:bg-slate-200 rounded cursor-pointer"
              >
                Cancel Review
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActionType('RETURN');
                    handleLegacyAction();
                  }}
                  disabled={isSelfSubmission}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Return for Correction
                </button>
                <button
                  onClick={() => {
                    setActionType('REJECT');
                    handleLegacyAction();
                  }}
                  disabled={isSelfSubmission}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject Submission
                </button>
                <button
                  onClick={() => {
                    setActionType('APPROVE');
                    handleLegacyAction();
                  }}
                  disabled={isSelfSubmission}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Item Master
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

