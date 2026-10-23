/**
 * KOSH INNOVATIONS — MODULE REGISTRY & MODULE BUILDER TYPES
 */

export type ModuleLifecycleStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'PUBLISHED'
  | 'ENABLED'
  | 'DISABLED'
  | 'DEGRADED'
  | 'ARCHIVED';

export type ModuleDependencyType = 'ITEM_MASTER_ONLY' | 'BUSINESS_PARTNER_MASTER_ONLY' | 'SHARED' | 'PLATFORM_ADMIN_ONLY';

export interface ModulePageConfig {
  id: string;
  pageKey: string;
  displayName: string;
  description: string;
  routeKey: string;
  parentPageKey?: string;
  templateType: 'LIST_SEARCH' | 'DETAIL_INSPECTOR' | 'CREATE_FORM' | 'APPROVAL_INBOX' | 'SETTINGS' | 'INTEGRATION';
  displayOrder: number;
  isEnabled: boolean;
  requiredPermission: string;
}

export interface ModuleFieldConfig {
  id: string;
  fieldKey: string;
  displayLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'SELECT' | 'DATE' | 'BOOLEAN' | 'LOOKUP';
  isRequired: boolean;
  isReadOnly: boolean;
  isSearchable: boolean;
  isFilterable: boolean;
  displayOrder: number;
}

export interface ModuleRegistryItem {
  id: string;
  moduleKey: string; // e.g. 'ITEM_MASTER', 'BUSINESS_PARTNER_MASTER'
  displayName: string;
  description: string;
  iconKey: string;
  navigationGroup: string;
  displayOrder: number;
  ownerTeam: string;
  ownerUser: string;
  version: number;
  isEnabled: boolean;
  lifecycleStatus: ModuleLifecycleStatus;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
  dependencies: string[]; // dependent module keys or shared services
  pages: ModulePageConfig[];
  fields: ModuleFieldConfig[];
  activeJobCount: number;
  pausedJobCount: number;
}

export interface ModuleAuditEvent {
  id: string;
  moduleId: string;
  moduleKey: string;
  actorUserId: string;
  actorUserName: string;
  eventType: 'ENABLE' | 'DISABLE' | 'PUBLISH_VERSION' | 'ROLLBACK' | 'UPDATE_CONFIG';
  previousState: boolean;
  newState: boolean;
  reason: string;
  timestamp: string;
  impactedJobCount: number;
}

export interface BPContactPerson {
  id: string;
  name: string;
  title?: string;
  position?: string;
  department?: string;
  mobile: string;
  email: string;
  isDefault: boolean;
}

export interface BPAddress {
  id: string;
  addressName: string;
  addressType: 'BILL_TO' | 'SHIP_TO';
  country: string;
  state: string;
  district: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  isDefault: boolean;
}

export interface BPPaymentTerms {
  paymentTermsCode: string; // 'NET15' | 'NET30' | 'NET60' | 'IMMEDIATE' | 'ADV_50' | 'COD'
  creditLimit: number;
  commitmentLimit: number;
  priceList: string;
  discountPercent: number;
}

export interface BPAccounting {
  controlAccount: string;
  downPaymentAccount: string;
  bankName: string;
  accountNumber: string;
  ifscIban: string;
  withholdingTaxAllowed: boolean;
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
  status: 'VERIFIED' | 'FAILED' | 'WARNING';
}

export interface BusinessPartner {
  id: string;
  bpCode: string;
  bpName: string;
  bpType: 'CUSTOMER' | 'SUPPLIER' | 'LEAD';
  foreignName?: string;
  groupIndustry?: string;
  currency?: string;
  gstinPan: string;
  panNumber?: string;
  gstStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'EXEMPT';
  phone: string;
  email: string;
  website?: string;
  salesperson?: string;
  city: string;
  state: string;
  country?: string;
  district?: string;
  postalCode?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL';
  sapSyncStatus: 'SYNCED' | 'PENDING' | 'FAILED';
  sapBpCode?: string;
  contacts?: BPContactPerson[];
  addresses?: BPAddress[];
  paymentTerms?: BPPaymentTerms;
  accounting?: BPAccounting;
  properties?: string[]; // array of property flag names
  remarks?: {
    internalNotes?: string;
    specialInstructions?: string;
    complianceComments?: string;
  };
  attachments?: BPAttachment[];
  governanceLogs?: BPGovernanceLog[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

