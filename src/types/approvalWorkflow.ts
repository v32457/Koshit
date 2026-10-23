/**
 * KOSH INNOVATIONS — STANDARDIZED MULTI-LEVEL APPROVAL WORKFLOW TYPES
 */

export type WorkflowStatus = 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'RETIRED' | 'SUPERSEDED';
export type StageType = 'SEQUENTIAL' | 'PARALLEL' | 'CONDITIONAL' | 'REVIEW_ONLY';
export type ApprovalPolicy = 'ALL' | 'ANY' | 'QUORUM';
export type DecisionAction = 'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE' | 'REASSIGN';

export interface ApproverRule {
  id: string;
  type: 'NAMED_USER' | 'ROLE' | 'TEAM' | 'BRANCH_ROLE';
  targetId: string;
  targetName: string;
}

export interface RoutingCondition {
  id: string;
  fieldKey: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN_LIST';
  value: string;
}

export interface WorkflowStageDefinition {
  id: string;
  order: number;
  name: string;
  stageType: StageType;
  policy: ApprovalPolicy;
  quorumCount?: number;
  approvers: ApproverRule[];
  conditions?: RoutingCondition[];
  slaHours: number;
  reminderIntervalHours: number;
  escalationRole?: string;
  requireComments: boolean;
  allowDelegation: boolean;
}

export interface WorkflowDefinition {
  id: string;
  workflowKey: string;
  displayName: string;
  description: string;
  moduleKey: 'ITEM_MASTER' | 'BUSINESS_PARTNER_MASTER' | 'SHARED' | string;
  targetOperation: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';
  branchId?: string; // empty means global
  version: number;
  status: WorkflowStatus;
  stages: WorkflowStageDefinition[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  stageId: string;
  stageName: string;
  moduleKey: string;
  recordId: string;
  recordTitle: string;
  branchName: string;
  submitterName: string;
  submitterId: string;
  submittedAt: string;
  assignedRole: string;
  assignedUserIds: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'DELEGATED';
  policy: ApprovalPolicy;
  decisionBy?: string;
  decisionAt?: string;
  remarks?: string;
  slaDueDate: string;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowKey: string;
  version: number;
  moduleKey: string;
  recordId: string;
  recordTitle: string;
  submitterId: string;
  submitterName: string;
  branchId: string;
  branchName: string;
  currentStageOrder: number;
  totalStages: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  tasks: WorkflowTask[];
  history: Array<{
    id: string;
    stageName: string;
    actorName: string;
    action: string;
    timestamp: string;
    comments: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
