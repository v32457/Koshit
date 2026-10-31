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

export interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string;
  tradeName: string;
  cinNumber?: string; // 21-character alphanumeric Corporate Identification Number
  gstin: string;
  sapCompanyDb: string;
  isEnabled: boolean;
  isDefault?: boolean;
  branchesCount?: number;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  streetAddress?: string;
  msmeInfo?: MSMEInfo;
  gstVerificationDetails?: GSTVerificationDetails;
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  gstin?: string;
  sapCompanyDb?: string;
  isEnabled?: boolean;
}

export type GSTRegistrationType =
  | 'REGULAR'
  | 'COMPOSITION'
  | 'SEZ_UNIT'
  | 'SEZ_DEVELOPER'
  | 'ISD'
  | 'UN_BODY';

export type GSTVerificationMode = 'PAID_API' | 'MANUAL_CAPTCHA';

export type GSTVerificationStatus =
  | 'NOT_VERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'MANUAL_REVIEW_REQUIRED';

export interface GSTProviderConfig {
  providerName: 'CLEAR_TAX' | 'MASTERS_INDIA' | 'IRIS_GST' | 'GOVT_DIRECT_SANDBOX' | 'CUSTOM_REST';
  endpointUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  timeoutSeconds: number;
  isActive: boolean;
  lastTestedAt?: string;
  testStatus?: 'SUCCESS' | 'FAILED' | 'UNTESTED';
  lastError?: string;
}

export interface GSTVerificationSession {
  sessionId: string;
  gstin: string;
  captchaDataUrl: string; // inline SVG/image data URL
  captchaText?: string;   // internal answer for server-authoritative mock
  createdAt: number;
  expiresAt: number;
}

export interface GSTOfficeAddress {
  id: string;
  type: 'PRINCIPAL' | 'ADDITIONAL' | 'ADMINISTRATIVE' | 'OTHER';
  doorBuildingNo?: string;
  streetName?: string;
  locality?: string;
  city: string;
  district?: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  addressPurpose?: string;
}

export interface GSTGoodsItem {
  hsnCode: string;
  description: string;
}

export interface GSTServicesItem {
  sacCode: string;
  description: string;
}

export interface GSTFilingFrequency {
  financialYear: string;
  returnType: 'GSTR-1' | 'GSTR-3B' | 'CMP-08' | 'GSTR-9';
  frequency: 'Monthly' | 'Quarterly' | 'Annually';
}

export interface GSTFilingRecord {
  financialYear: string;
  returnType: string;
  taxPeriod: string;
  dateOfFiling: string;
  status: 'FILED' | 'NOT_FILED' | 'PENDING' | 'OVERDUE';
  arn?: string;
}

export interface GSTVerificationDetails {
  gstin: string;
  requestedGstin?: string;
  correlationId?: string;
  legalName: string;
  tradeName: string;
  taxpayerType: string;
  registrationStatus: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PROVISIONAL' | 'INACTIVE';
  registrationDate: string;
  constitutionOfBusiness?: string | null;
  principalPlaceOfBusiness: GSTOfficeAddress;
  additionalPlacesOfBusiness: GSTOfficeAddress[];
  natureOfCoreBusinessActivity?: string[] | null;
  natureOfBusinessActivities?: string[] | null;
  goods: GSTGoodsItem[];
  services: GSTServicesItem[];
  filingFrequencyCurrentFY: GSTFilingFrequency[];
  filingHistory: GSTFilingRecord[];
  verificationTimestamp: string;
  verificationSource: string; // e.g. 'Govt GSTN Portal (Official Taxpayer Search)' | 'ClearTax GST Provider API'
  verificationOutcome: 'VERIFIED' | 'FAILED' | 'MANUAL_REVIEW_REQUIRED';
  verifiedBy?: string;
  rawResponseSummary?: string;
}

export type BranchLifecycleStatus =
  | 'DRAFT'
  | 'VALIDATION'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'INACTIVE';

export interface Warehouse {
  id: string;
  branchId: string;
  warehouseCode: string; // e.g. 'HSR-FG', 'HSR-STR'
  warehouseName: string; // e.g. 'Hosur-Finished Goods'
  locationCode?: string;
  isInactive?: boolean;
  isDropShip?: boolean;
  isNettable?: boolean;
  isExciseable?: boolean;
  isExternal?: boolean;
  enableBinLocations?: boolean;
  isDefault?: boolean;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Branch {
  id: string;
  orgId: string;
  companyId?: string;
  portalBranchCode: string; // Mandatory, unique, numeric, exactly 3 digits e.g. '001'
  code: string; // Foreign/Short code e.g. 'POND-01'
  name: string;
  shortName?: string;
  gstinPan?: string;
  gstLegalName?: string;
  gstTradeName?: string;
  gstRegistrationType?: GSTRegistrationType;
  gstStatus?: 'VERIFIED' | 'UNVERIFIED' | 'EXEMPT' | 'CANCELLED' | 'SUSPENDED' | 'FAILED';
  gstEffectiveDate?: string;
  streetAddress?: string;
  streetNo?: string;
  block?: string;
  buildingFloor?: string;
  postalCode?: string;
  city: string;
  district?: string;
  state: string;
  country?: string;
  sapBranchId?: string;
  sapRegistrationNo?: string;
  isMainBranch?: boolean;
  lifecycleStatus: BranchLifecycleStatus;
  plants: Plant[];
  warehouses: Warehouse[];
  defaultWarehouseId?: string;
  gstVerificationDetails?: GSTVerificationDetails;
}

export interface Plant {
  id: string;
  branchId: string;
  code: string;
  name: string;
  unitDescription?: string;
}

export interface UnitDescriptionMaster {
  id: string;
  code: string;
  description: string;
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL';
  version: number;
}

export interface FieldConfigurationRule {
  id: string;
  entityName: 'BRANCH' | 'WAREHOUSE' | 'ITEM' | 'BUSINESS_PARTNER';
  tabName: string;
  fieldKey: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'SELECT' | 'CHECKBOX' | 'DATE';
  isVisible: boolean;
  isRequired: boolean;
  isReadOnly: boolean;
  fieldOrder: number;
  sapMappingKey?: string;
  applicableRoles?: UserRole[];
  mappedUserIds?: string[];
  version: number;
  updatedAt: string;
  updatedBy: string;
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

export interface BranchItemClassification {
  id: string;
  globalItemId: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  categoryCode: string; // e.g. 'FG' in Pondicherry, 'RM' in Chennai for SAME global item
  categoryName: string;
  itemRole: 'STOCK' | 'PURCHASE' | 'MANUFACTURE' | 'SALES';
  isStocked: boolean;
  isPurchased: boolean;
  isManufactured: boolean;
  isSalesPermitted: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL';
  effectiveFrom?: string;
  effectiveTo?: string;
  sapItemCode?: string;
  branchSpecificDescription?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BPContactPerson {
  id: string;
  name: string;
  title?: string;
  position?: string;
  department?: string;
  mobile: string;
  email: string;
  isDefault?: boolean;
}

export interface BPAddress {
  id: string;
  addressName: string;
  addressType: 'BILL_TO' | 'SHIP_TO';
  country: string;
  state: string;
  district?: string;
  city: string;
  postalCode?: string;
  streetAddress: string;
  gstinPan?: string;
  gstStatus?: 'ACTIVE' | 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'EXEMPT';
  isDefault?: boolean;
}

export interface BPBankDetail {
  id: string;
  bankName: string;
  branchName?: string;
  ifscCode: string;
  ibanSwift?: string;
  accountNumber: string;
  cancelledChequeFileName?: string;
  isDefault?: boolean;
  approvalStatus?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
}

export interface BPPaymentTerms {
  paymentTermsCode: string;
  creditLimit?: number;
  commitmentLimit?: number;
  priceList?: string;
  discountPercent?: number;
}

export interface BPAccounting {
  controlAccount?: string;
  downPaymentAccount?: string;
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  ifscIban?: string;
  swiftCode?: string;
  bankAccounts?: BPBankDetail[];
  withholdingTaxAllowed?: boolean;
  tdsCategory?: string;
}

export interface BPAttachment {
  id: string;
  docType: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface BPGovernanceLog {
  id: string;
  timestamp: string;
  action: string;
  verifier: string;
  details: string;
  status: string;
}

export interface MSMEInfo {
  isMSME: boolean;
  udyamRegistrationNo?: string;
  enterpriseName?: string;
  enterpriseType?: string;
  dateOfIncorporation?: string;
  dateOfCommencement?: string;
  activityType?: 'MANUFACTURING' | 'SERVICES' | 'BOTH';
  msmeClassification?: 'MICRO' | 'SMALL' | 'MEDIUM';
  investmentCategory?: string;
  turnoverCategory?: string;
  nicCodes?: string[];
  majorActivity?: string;
  state?: string;
  district?: string;
  panLinkage?: string;
  registrationPeriodStatus?: string;
  lastRevalidatedAt?: string;
}

export interface BusinessPartner {
  id: string;
  branchId?: string;
  branchCode?: string;
  portalBranchCode?: string;
  bpCode: string; // Non-editable CardCode e.g. KC001PDY0001
  bpName: string;
  bpType: 'CUSTOMER' | 'SUPPLIER' | 'LEAD';
  shortName?: string;
  foreignName?: string;
  groupIndustry?: string;
  currency?: string;
  gstinPan?: string;
  panNumber?: string;
  gstStatus?: 'ACTIVE' | 'VERIFIED' | 'SUSPENDED' | 'CANCELLED' | 'INVALID' | 'PENDING' | 'UNVERIFIED' | 'VERIFICATION_FAILED' | 'VERIFICATION_UNAVAILABLE' | 'STALE' | 'EXEMPT';
  gstLegalName?: string;
  gstTradeName?: string;
  gstTaxpayerType?: string;
  gstFilingHistory?: Array<{ returnPeriod: string; dateOfFiling: string; status: string }>;
  gstRegisteredEmail?: string;
  gstRegisteredMobile?: string;
  gstVerificationDetails?: GSTVerificationDetails;
  msmeInfo?: MSMEInfo;
  phone: string;
  email: string;
  website?: string;
  salesperson?: string;
  city: string;
  district?: string;
  state: string;
  country: string;
  postalCode?: string;
  streetAddress?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_APPROVAL';
  sapSyncStatus?: 'SYNCED' | 'PENDING' | 'FAILED';
  sapBpCode?: string;
  contacts: BPContactPerson[];
  addresses: BPAddress[];
  paymentTerms?: BPPaymentTerms;
  accounting?: BPAccounting;
  properties?: string[];
  remarks?: {
    internalNotes?: string;
    specialInstructions?: string;
    complianceComments?: string;
  };
  attachments?: BPAttachment[];
  governanceLogs?: BPGovernanceLog[];
  isLocked?: boolean;
  approvalStatus?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
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

export type MappingDiscoveryStatus =
  | 'DISCOVERED'
  | 'MAPPED'
  | 'VALIDATED'
  | 'UNSUPPORTED_BY_CURRENT_API'
  | 'REQUIRES_FURTHER_INVESTIGATION'
  | 'NOT_APPLICABLE'
  | 'MAPPING_ERROR';

export type SapRegistrationRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONFIG_REQUIRED';

export interface SapCompanyRegistrationRequest {
  id: string;
  requestNumber: string;
  companyCode: string;
  companyDisplayName: string;
  legalName: string;
  gstin: string;
  sapCompanyDb: string;
  environmentId: 'DEV' | 'UAT' | 'PROD';
  httpsHostname: string;
  serviceLayerPort: number;
  requestedByEmail: string;
  requestedByName: string;
  requestedAt: string;
  status: SapRegistrationRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  configId?: string;
  notes?: string;
}

export interface SapCompanyRegistryConfig {
  id: string;
  companyDbName: string;
  companyDisplayName: string;
  environmentId: 'DEV' | 'UAT' | 'PROD';
  environmentName: string;
  serviceLayerUrl: string;
  httpsHostname: string;
  serviceLayerPort: number;
  sapVersion?: string;
  authMethod: 'SESSION' | 'BASIC' | 'TOKEN';
  credentialVaultRef: string;
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'TEST_REQUIRED';
  lastConnectedAt?: string;
  isEnvironmentActive: boolean;
  isCompanyActive: boolean;
  isCompanyDetailsSyncActive: boolean;
  lastSuccessfulImportAt?: string;
  createdAt: string;
  updatedAt: string;
  requestId?: string;
}

export interface SapCompanyFieldDiscoveryRecord {
  id: string;
  companyConfigId: string;
  environmentId: 'DEV' | 'UAT' | 'PROD';
  tabName:
    | 'GENERAL_LOCAL'
    | 'GENERAL_FOREIGN'
    | 'ACCOUNTING_GENERAL'
    | 'ACCOUNTING_EXCISE'
    | 'INIT_ACCOUNTING'
    | 'INIT_INVENTORY'
    | 'INIT_HOUSE_BANK'
    | 'INIT_FIXED_ASSETS_OTHER';
  subsectionName: string;
  visibleSapLabel: string;
  technicalResource: string;
  technicalPropertyName: string;
  sapDataType: 'Alphanumeric' | 'Numeric' | 'Date' | 'Amount' | 'Rate' | 'Flag/Enum' | 'Memo';
  fieldLength?: number;
  precisionScale?: string;
  isReadable: boolean;
  isWritable: boolean;
  koshTargetEntity: string;
  koshTargetProperty: string;
  targetDataType: string;
  mappingTransformation?: string;
  isRequired: boolean;
  isReadOnlyInSap: boolean;
  discoveryStatus: MappingDiscoveryStatus;
  verificationEvidence?: string;
  lastVerifiedAt: string;
  retrievedSourceValue?: string;
  persistedKoshValue?: string;
}

export interface SapCompanySyncJobLog {
  id: string;
  jobCorrelationId: string;
  companyConfigId: string;
  environmentId: 'DEV' | 'UAT' | 'PROD';
  operationType: 'FETCH_COMPANY_DETAILS' | 'FIELD_DISCOVERY' | 'MAPPING_RECONCILIATION' | 'CONNECTION_TEST';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: string;
  discoveredFieldsCount: number;
  mappedFieldsCount: number;
  importedFieldsCount: number;
  updatedFieldsCount: number;
  unchangedFieldsCount: number;
  skippedFieldsCount: number;
  unsupportedFieldsCount: number;
  failedFieldsCount: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';
  sanitizedDiagnosticMessage: string;
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
  companyId?: string;
  branchId?: string;
  environmentId?: string;
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

