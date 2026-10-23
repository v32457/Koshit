/**
 * KOSH INNOVATIONS — DOMAIN TYPE DEFINITIONS
 * Portal: My Kosh Innovations Global IT System
 */

export type UserRole =
  | 'PLATFORM_ADMIN'
  | 'ORG_ADMIN'
  | 'GLOBAL_ITEM_ADMIN'
  | 'ITEM_MAKER'
  | 'ITEM_CHECKER'
  | 'BRANCH_COORDINATOR'
  | 'MASTER_DATA_AUDITOR'
  | 'INTEGRATION_SERVICE_ACCOUNT'
  | 'READ_ONLY_USER';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  orgId: string;
  allowedBranchIds: string[]; // empty means all branches if global
  isGlobalScope: boolean;
  twoFactorEnabled: boolean;
  avatarUrl?: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
}

export interface Branch {
  id: string;
  orgId: string;
  code: string;
  name: string;
  city: string;
  state: string;
  plants: Plant[];
}

export interface Plant {
  id: string;
  branchId: string;
  code: string;
  name: string;
}

export interface ClassificationValue {
  code: string;
  name: string;
  display: string;
  isActive: boolean;
  description?: string;
}

export interface ClassificationDimension {
  key: 'category' | 'material' | 'type' | 'materialForm' | 'process' | 'colour' | 'manufacturer';
  label: string;
  values: ClassificationValue[];
}

export interface ItemCodeComponentConfig {
  id: string;
  name: string;
  sourceDimension:
    | 'category'
    | 'subcategory'
    | 'material'
    | 'type'
    | 'materialForm'
    | 'process'
    | 'colour'
    | 'grade'
    | 'manufacturer'
    | 'partModelNumber'
    | 'dimensions'
    | 'ratingSize'
    | 'specification'
    | 'fixed'
    | 'sequence';
  fixedText?: string;
  order: number;
  padding?: number;
  isRequired: boolean;
  enabled: boolean;
}

export interface ItemCodeRule {
  id: string;
  name: string;
  categoryCode?: string; // null means default
  components: ItemCodeComponentConfig[];
  separator: string;
  sequenceScope: 'GLOBAL' | 'CATEGORY' | 'BRANCH';
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  updatedAt: string;
  updatedBy: string;
}

export interface ItemDescriptionRule {
  id: string;
  categoryCode: string;
  templatePattern: string;
  separator: string;
  maxLength: number;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  updatedAt: string;
}

export type ItemStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED_FOR_CORRECTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SAP_PENDING'
  | 'SAP_CREATED'
  | 'SAP_FAILED';

export interface GlobalItem {
  id: string;
  globalItemCode: string;
  isProvisionalCode: boolean;
  categoryCode: string;
  description: string;
  status: ItemStatus;
  attributes: {
    material?: string;
    type?: string;
    materialForm?: string;
    process?: string;
    colour?: string;
    manufacturer?: string;
    dimensions?: string;
    partModelNumber?: string;
    ratingSize?: string;
    specification?: string;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  codeRuleVersion: number;
  descRuleVersion: number;
  approvalHistory: ApprovalActionRecord[];
  branchAvailability: BranchAvailabilitySetting[];
  sapSyncInfo?: {
    sapItemCode?: string;
    companyDb?: string;
    syncedAt?: string;
    syncStatus: 'SYNCED' | 'PENDING' | 'FAILED';
    lastError?: string;
  };
}

export interface BranchAvailabilitySetting {
  branchId: string;
  isStocked: boolean;
  isPurchased: boolean;
  isManufactured: boolean;
  isActive: boolean;
  activatedAt?: string;
}

export interface ApprovalActionRecord {
  id: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN';
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
  remarks: string;
  previousStatus: ItemStatus;
  newStatus: ItemStatus;
}

export interface SapIntegrationProfile {
  id: string;
  name: string;
  description: string;
  environment: 'DEV' | 'UAT' | 'PROD';
  serviceLayerUrl: string;
  companyDb: string;
  authMethod: 'BASIC' | 'TOKEN' | 'SESSION';
  credentialVaultRef: string;
  timeoutSeconds: number;
  maxRetries: number;
  batchSize: number;
  tlsVerify: boolean;
  status: 'DRAFT' | 'CONFIG_VALIDATED' | 'TEST_REQUIRED' | 'TEST_PASSED' | 'APPROVAL_REQUIRED' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED';
  version: number;
  updatedAt: string;
}

export interface SapScheduleConfig {
  id: string;
  profileId: string;
  scheduleType: 'MANUAL' | 'ONE_TIME' | 'RECURRING' | 'INTERVAL';
  cronExpression?: string;
  intervalMinutes?: number;
  timezone: string; // 'Asia/Kolkata'
  isEnabled: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
}

export interface SapTestResult {
  id: string;
  testId: string;
  name: string;
  category: string;
  durationMs: number;
  result: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_RUN';
  details: string;
  executedAt: string;
  correlationId: string;
  correctiveAction?: string;
}

export interface AuditLogEntry {
  id: string;
  correlationId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityName: string;
  entityId: string;
  timestamp: string;
  details: Record<string, any>;
  ipAddress: string;
}

export interface PageAcceptanceRecord {
  key: string;
  route: string;
  displayName: string;
  status: 'Not Started' | 'In Progress' | 'Pending Review' | 'Changes Requested' | 'Accepted';
  decisionDate?: string;
  userDecision?: 'Accept' | 'Reject';
  rejectionReason?: string;
  changesMade?: string;
  testsRun?: string;
  acceptedVersion?: string;
  dependencies?: string;
}

// ==========================================
// SECTION 5: CONFIGURABLE DASHBOARD DOMAIN
// ==========================================

export type WidgetType =
  | 'KPI_METRIC'
  | 'TREND_CHART'
  | 'BAR_CHART'
  | 'DONUT_CHART'
  | 'DATA_TABLE'
  | 'STATUS_SUMMARY'
  | 'ACTIVITY_FEED'
  | 'BRANCH_SUMMARY'
  | 'SAP_HEALTH'
  | 'SHORTCUTS';

export interface DashboardWidgetConfig {
  id: string;
  widgetType: WidgetType;
  title: string;
  description?: string;
  dataSourceId: string;
  chartType?: 'card' | 'line' | 'bar' | 'donut' | 'table';
  gridSpan: 1 | 2 | 3 | 4 | 6 | 8 | 12; // 12-col layout
  order: number;
  isEnabled: boolean;
  isMandatory?: boolean;
  refreshIntervalSec?: number;
  filterDefaults?: Record<string, any>;
}

export interface DashboardDefinition {
  id: string;
  name: string;
  audienceScope: 'ORG_DEFAULT' | 'ROLE_SCOPED' | 'BRANCH_SCOPED' | 'PERSONAL';
  targetRole?: UserRole;
  targetBranchId?: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  updatedAt: string;
  updatedBy: string;
  widgets: DashboardWidgetConfig[];
}

export interface DataSourceDefinition {
  id: string;
  name: string;
  description: string;
  category: 'ITEMS' | 'WORKFLOW' | 'SAP' | 'BRANCH' | 'AUDIT';
  metricDefinition: string;
  aggregationMethod: 'COUNT' | 'SUM' | 'AVG' | 'STATUS_GROUP';
  allowedRoles: UserRole[];
  supportedChartTypes: Array<'card' | 'line' | 'bar' | 'donut' | 'table'>;
  freshnessSec: number;
}

// ==========================================
// SECTION 6: COMMUNICATION & NOTIFICATION
// ==========================================

export type NotificationChannel = 'IN_PORTAL' | 'EMAIL' | 'WHATSAPP';
export type CommunicationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CommunicationTemplate {
  id: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  eventCode: string;
  subject: string;
  bodyContent: string;
  availablePlaceholders: string[]; // e.g. ['{recipient_display_name}', '{item_code}', '{request_status}']
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  version: number;
  updatedAt: string;
}

export interface InPortalNotification {
  id: string;
  userId: string;
  category: 'WORKFLOW' | 'SAP_SYNC' | 'SECURITY' | 'ANNOUNCEMENT';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkRoute?: string;
  priority: CommunicationPriority;
}

export interface BroadcastAnnouncement {
  id: string;
  title: string;
  message: string;
  targetScope: 'ALL_USERS' | 'SPECIFIC_ROLE' | 'SPECIFIC_BRANCH';
  targetRole?: UserRole;
  targetBranchId?: string;
  channels: NotificationChannel[];
  priority: CommunicationPriority;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED';
  publishedAt?: string;
  publishedBy: string;
  acknowledgedCount: number;
  totalRecipients: number;
}

export interface DeliveryQueueItem {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  eventCode: string;
  subject: string;
  status: 'QUEUED' | 'PROCESSING' | 'ACCEPTED_BY_PROVIDER' | 'DELIVERED' | 'FAILED';
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  correlationId: string;
}

// ==========================================
// SECTION 7: CONFIGURABLE WHATSAPP INTEGRATION
// ==========================================

export type WhatsAppMode = 'OFF' | 'OFFICIAL_API' | 'USER_ASSISTED';

export interface WhatsAppConfig {
  mode: WhatsAppMode;
  businessAccountId: string;
  phoneNumberId: string;
  senderNumber: string; // e.g. '+914132223344'
  secretVaultRef: string;
  webhookUrl: string;
  webhookVerifyTokenRef: string;
  apiVersion: string; // 'v21.0'
  environment: 'DEV' | 'UAT' | 'PROD';
  rateLimitPerSec: number;
  updatedAt: string;
  lastTestStatus: 'PASS' | 'FAIL' | 'NOT_TESTED';
  lastTestTimestamp?: string;
}

export interface WhatsAppTemplate {
  id: string;
  code: string;
  displayName: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string; // 'en_US'
  bodyTemplate: string;
  metaApprovalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  supportedModes: WhatsAppMode[];
}

export interface WhatsAppManualWorkItem {
  id: string;
  eventCode: string;
  recipientPhone: string;
  recipientName: string;
  renderedMessage: string;
  status: 'PREPARED' | 'USER_OPENED_WHATSAPP' | 'USER_CONFIRMED_SENT' | 'DISCARDED';
  preparedAt: string;
  updatedAt?: string;
  operatorId: string;
  operatorNotes?: string;
}

export type EntityType = 'CUSTOMER' | 'MANUFACTURER' | 'BRAND';

export interface CustomerManufacturerBrandMaster {
  id: string;
  code: string;
  name: string;
  entityType: EntityType;
  displayLabel: string;
  description?: string;
  isActive: boolean;
  referencedItemCount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CustomerPartModelReference {
  id: string;
  customerPartNumber: string;
  customerId?: string;
  customerName?: string;
  manufacturerBrandId?: string;
  manufacturerBrandName?: string;
  globalItemId?: string;
  globalItemCode?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export * from './communication';
export * from './moduleRegistry';
export * from './approvalWorkflow';

