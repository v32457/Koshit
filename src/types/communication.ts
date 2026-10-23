import { UserRole, NotificationChannel, CommunicationPriority } from './index';

export type EmailProviderType = 'SMTP' | 'AWS_SES' | 'SENDGRID' | 'RESEND' | 'MAILGUN';
export type EmailTlsMode = 'STARTTLS' | 'IMPLICIT_TLS' | 'PLAIN';
export type EmailAuthMode = 'LOGIN_PASSWORD' | 'API_KEY' | 'OAUTH2_BEARER';

export interface EmailConfig {
  id: string;
  configName: string;
  providerType: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  tlsMode: EmailTlsMode;
  authMode: EmailAuthMode;
  username: string;
  isSecretConfigured: boolean;
  senderDisplayName: string;
  senderEmail: string;
  replyToEmail: string;
  allowedDomains: string[];
  connectionTimeoutSec: number;
  sendTimeoutSec: number;
  rateLimitPerSec: number;
  maxMessageSizeMb: number;
  defaultPriority: CommunicationPriority;
  testRecipientAllowlist: string[];
  isEnabled: boolean;
  environment: 'DEV' | 'UAT' | 'PROD';
  version: number;
  updatedAt: string;
  lastTestStatus: 'PASS' | 'FAIL' | 'NOT_TESTED';
  lastTestTimestamp?: string;
  lastTestDiagnostics?: string;
}

export interface EmailTemplateDetailed {
  id: string;
  code: string;
  name: string;
  businessPurpose: string;
  module: 'ITEMS' | 'REQUESTS' | 'APPROVALS' | 'SAP_INTEGRATION' | 'SECURITY' | 'SYSTEM';
  eventCode: string;
  language: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  availablePlaceholders: string[];
  version: number;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ACTIVE' | 'RETIRED';
  createdBy: string;
  modifiedBy: string;
  approvedBy?: string;
  updatedAt: string;
}

export interface WhatsAppTemplateDetailed {
  id: string;
  code: string;
  displayName: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  headerType?: 'NONE' | 'TEXT' | 'IMAGE';
  headerText?: string;
  bodyTemplate: string;
  footerText?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL'; label: string; url?: string }>;
  parameters: Array<{ index: number; sampleValue: string; variableKey: string }>;
  metaApprovalStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  internalApprovalStatus: 'APPROVED' | 'DRAFT' | 'IN_REVIEW';
  lastSyncTimestamp?: string;
  rejectionReason?: string;
  supportedModes: ('OFFICIAL_API' | 'USER_ASSISTED')[];
  version: number;
  updatedAt: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  eventCode: string;
  module: 'ITEMS' | 'REQUESTS' | 'APPROVALS' | 'SAP_INTEGRATION' | 'SECURITY' | 'SYSTEM';
  description: string;
  triggerCondition: string;
  priority: CommunicationPriority;
  recipientResolutionRule: 'ITEM_MAKER' | 'ITEM_CHECKER' | 'BRANCH_ADMIN' | 'SECURITY_ADMIN' | 'ALL_BRANCH_USERS';
  channels: {
    email: boolean;
    whatsApp: boolean;
    inPortal: boolean;
  };
  emailTemplateId?: string;
  whatsAppTemplateId?: string;
  isEnabled: boolean;
  updatedAt: string;
}

export type DeliveryStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'ACCEPTED_BY_PROVIDER'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface DetailedDeliveryQueueItem {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  recipientName: string;
  eventCode: string;
  subject: string;
  previewText: string;
  status: DeliveryStatus;
  priority: CommunicationPriority;
  retryCount: number;
  maxRetries: number;
  scheduledAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  errorMessage?: string;
  errorCode?: string;
  correlationId: string;
  idempotencyKey: string;
  providerReceiptId?: string;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  provider: 'EMAIL_RELAY' | 'WHATSAPP_META';
  eventType: 'message.delivered' | 'message.read' | 'message.bounced' | 'message.failed' | 'template.approved';
  messageId: string;
  recipient: string;
  timestamp: string;
  signatureStatus: 'VALID_HMAC_SHA256' | 'INVALID_SIGNATURE' | 'REPLAY_REJECTED';
  payloadSummary: string;
  rawPayload: Record<string, unknown>;
}

export interface RecipientConsentRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  branchName: string;
  emailConsent: boolean;
  whatsAppConsent: 'OPTED_IN' | 'OPTED_OUT' | 'PENDING';
  consentSource: 'EMPLOYEE_ONBOARDING' | 'USER_PORTAL_PREFERENCE' | 'EXPLICIT_OPTIN_SMS';
  consentUpdatedAt: string;
  isSuppressed: boolean;
  suppressionReason?: string;
}

export interface BroadcastCampaignDetailed {
  id: string;
  title: string;
  businessReason: string;
  targetScope: 'ALL_USERS' | 'SPECIFIC_ROLE' | 'SPECIFIC_BRANCH';
  targetRole?: UserRole;
  targetBranchId?: string;
  channels: NotificationChannel[];
  priority: CommunicationPriority;
  status: 'DRAFT' | 'IN_APPROVAL' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  emailTemplateId?: string;
  whatsAppTemplateId?: string;
  customMessage?: string;
  scheduledAt?: string;
  publishedAt?: string;
  completedAt?: string;
  createdBy: string;
  approvedBy?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
}
