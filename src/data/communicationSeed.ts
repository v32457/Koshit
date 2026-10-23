import {
  CommunicationTemplate,
  InPortalNotification,
  BroadcastAnnouncement,
  DeliveryQueueItem,
  WhatsAppConfig,
  WhatsAppTemplate,
  WhatsAppManualWorkItem,
} from '../types';

export const INITIAL_EMAIL_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'tmpl-item-submitted',
    code: 'EMAIL_ITEM_SUBMITTED',
    name: 'Item Submitted For Checker Review',
    channel: 'EMAIL',
    eventCode: 'ITEM_SUBMITTED',
    subject: '[Kosh Portal] Review Required: Item {item_code} Submitted by {maker_name}',
    bodyContent: `Dear {recipient_display_name},

A new item creation request has been submitted for your review and approval:

- Item Code: {item_code}
- Category: {item_category}
- Description: {item_description}
- Submitted By: {maker_name}
- Operating Branch: {branch_name}
- Submission Timestamp: {timestamp}

Please log in to the Kosh Global Item Portal to inspect the technical attributes and approve or return the item:
{portal_url}/approvals

Regards,
Kosh Innovations Global Master Governance Team`,
    availablePlaceholders: [
      '{recipient_display_name}',
      '{item_code}',
      '{item_category}',
      '{item_description}',
      '{maker_name}',
      '{branch_name}',
      '{timestamp}',
      '{portal_url}',
    ],
    status: 'ACTIVE',
    version: 2,
    updatedAt: '2026-10-20T10:30:00Z',
  },
  {
    id: 'tmpl-item-approved',
    code: 'EMAIL_ITEM_APPROVED',
    name: 'Item Approved & Queued for SAP B1',
    channel: 'EMAIL',
    eventCode: 'ITEM_APPROVED',
    subject: '[Kosh Portal] Approved: Item {item_code} has been authorized',
    bodyContent: `Dear {recipient_display_name},

Congratulations. Your item creation request has been reviewed and approved by {checker_name}:

- Item Code: {item_code}
- Description: {item_description}
- Approval Status: AUTHORIZED FOR SAP INTEGRATION
- Approved By: {checker_name}
- Timestamp: {timestamp}

The item has entered the SAP B1 HANA Service Layer synchronization batch.

Access your item details here:
{portal_url}/items

Regards,
Kosh Innovations Global Master Governance Team`,
    availablePlaceholders: [
      '{recipient_display_name}',
      '{item_code}',
      '{item_description}',
      '{checker_name}',
      '{timestamp}',
      '{portal_url}',
    ],
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-10-18T14:15:00Z',
  },
  {
    id: 'tmpl-item-returned',
    code: 'EMAIL_ITEM_RETURNED',
    name: 'Item Returned For Maker Correction',
    channel: 'EMAIL',
    eventCode: 'ITEM_RETURNED',
    subject: '[Kosh Portal] Action Required: Item {item_code} Returned by Reviewer',
    bodyContent: `Dear {recipient_display_name},

Your item creation request has been returned by {checker_name} for the following reason:

"{rejection_reason}"

- Item Code: {item_code}
- Description: {item_description}
- Action Required: Please review the remarks, amend attributes, and resubmit.

Edit your request here:
{portal_url}/requests

Regards,
Kosh Innovations Global Master Governance Team`,
    availablePlaceholders: [
      '{recipient_display_name}',
      '{item_code}',
      '{item_description}',
      '{checker_name}',
      '{rejection_reason}',
      '{portal_url}',
    ],
    status: 'ACTIVE',
    version: 3,
    updatedAt: '2026-10-21T09:00:00Z',
  },
  {
    id: 'tmpl-sap-sync-alert',
    code: 'EMAIL_SAP_SYNC_ALERT',
    name: 'SAP B1 Service Layer Sync Alert',
    channel: 'EMAIL',
    eventCode: 'SAP_SYNC_FAILED',
    subject: '[CRITICAL ALERT] SAP Service Layer Sync Failure for Batch #{batch_id}',
    bodyContent: `ATTENTION: IT Platform & Item Governance Administrators,

A SAP B1 HANA Service Layer synchronization batch failed:

- Batch ID: {batch_id}
- Failed Item Code: {item_code}
- Error Code: {error_code}
- Error Description: {error_message}
- Environment: {environment}
- Timestamp: {timestamp}

Immediate intervention required in the Integration Recovery Queue:
{portal_url}/integration/monitor

Regards,
SAP Service Layer Automated Monitor`,
    availablePlaceholders: [
      '{batch_id}',
      '{item_code}',
      '{error_code}',
      '{error_message}',
      '{environment}',
      '{timestamp}',
      '{portal_url}',
    ],
    status: 'ACTIVE',
    version: 2,
    updatedAt: '2026-10-15T11:20:00Z',
  },
  {
    id: 'tmpl-2fa-otp',
    code: 'EMAIL_2FA_OTP',
    name: 'Two-Factor Authentication One-Time Passcode',
    channel: 'EMAIL',
    eventCode: 'TWO_FACTOR_OTP',
    subject: '[Kosh Innovations] Your Security Verification Code is {otp_code}',
    bodyContent: `Dear {recipient_display_name},

Your one-time security verification passcode for the Kosh Global Item Master Portal is:

  {otp_code}

This code is valid for 10 minutes. Do not share this code with anyone.

If you did not initiate this request, contact Kosh IT Security immediately at security@koshinnovations.com.

Regards,
Kosh Innovations IT Security`,
    availablePlaceholders: ['{recipient_display_name}', '{otp_code}'],
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-09-01T08:00:00Z',
  },
];

export const INITIAL_IN_PORTAL_NOTIFICATIONS: InPortalNotification[] = [
  {
    id: 'notif-1',
    userId: 'u-admin-1',
    category: 'WORKFLOW',
    title: 'Item MAPALBL0003 Pending Approval',
    message: 'Submitted by Karthik Raja (Pondicherry Plant). Requires Checker verification before SAP sync.',
    isRead: false,
    createdAt: '2026-10-22T08:15:00Z',
    linkRoute: '/approvals',
    priority: 'HIGH',
  },
  {
    id: 'notif-2',
    userId: 'u-admin-1',
    category: 'SAP_SYNC',
    title: 'SAP HANA Batch Scheduled',
    message: 'Item FGHDMCRGY0002 approved and queued for 15:00 IST automated Service Layer push.',
    isRead: false,
    createdAt: '2026-10-22T07:45:00Z',
    linkRoute: '/integration/monitor',
    priority: 'MEDIUM',
  },
  {
    id: 'notif-3',
    userId: 'u-admin-1',
    category: 'SAP_SYNC',
    title: 'Item RMPAOPOEXLG0001 Synced Successfully',
    message: 'Service Layer confirmed DocEntry #48192 in SAP B1 HANA database (Pondicherry company DB).',
    isRead: true,
    createdAt: '2026-10-21T16:20:00Z',
    linkRoute: '/items',
    priority: 'LOW',
  },
  {
    id: 'notif-4',
    userId: 'u-admin-1',
    category: 'SECURITY',
    title: 'Email 2FA Verification Policy Active',
    message: 'All administrative and checker roles require OTP verification for master updates.',
    isRead: true,
    createdAt: '2026-10-20T12:00:00Z',
    linkRoute: '/settings/general',
    priority: 'MEDIUM',
  },
  {
    id: 'notif-5',
    userId: 'u-admin-1',
    category: 'ANNOUNCEMENT',
    title: 'SAP B1 HANA Maintenance Window',
    message: 'Scheduled downtime on Saturday 23:00 to 01:00 IST for HANA database index optimization.',
    isRead: false,
    createdAt: '2026-10-22T06:00:00Z',
    linkRoute: '/settings/organizations',
    priority: 'HIGH',
  },
];

export const INITIAL_BROADCAST_ANNOUNCEMENTS: BroadcastAnnouncement[] = [
  {
    id: 'bc-1',
    title: 'Quarterly Global Item Master Code Freeze & HANA Maintenance',
    message: 'Please be advised that SAP B1 HANA Service Layer synchronization will be paused this Saturday from 23:00 to 01:00 IST for maintenance. Draft creation remains operational.',
    targetScope: 'ALL_USERS',
    channels: ['IN_PORTAL', 'EMAIL'],
    priority: 'HIGH',
    status: 'PUBLISHED',
    publishedAt: '2026-10-22T06:00:00Z',
    publishedBy: 'Suresh Kumar (Platform Admin)',
    acknowledgedCount: 24,
    totalRecipients: 32,
  },
  {
    id: 'bc-2',
    title: 'Strict Revision on Raw Material (RM) Sub-Category Naming',
    message: 'Effective immediately, all Raw Material items must include grade and surface finish attributes per updated ISO 9001 quality specifications.',
    targetScope: 'SPECIFIC_ROLE',
    targetRole: 'ITEM_MAKER',
    channels: ['IN_PORTAL', 'EMAIL', 'WHATSAPP'],
    priority: 'MEDIUM',
    status: 'PUBLISHED',
    publishedAt: '2026-10-21T09:30:00Z',
    publishedBy: 'Ananya Sharma (Global Item Admin)',
    acknowledgedCount: 8,
    totalRecipients: 10,
  },
];

export const INITIAL_DELIVERY_QUEUE: DeliveryQueueItem[] = [
  {
    id: 'dq-101',
    channel: 'EMAIL',
    recipient: 'checker.pondicherry@koshinnovations.com',
    eventCode: 'ITEM_SUBMITTED',
    subject: '[Kosh Portal] Review Required: Item MAPALBL0003 Submitted by Karthik Raja',
    status: 'DELIVERED',
    retryCount: 0,
    lastAttemptAt: '2026-10-22T08:15:30Z',
    correlationId: 'req-49102-email-01',
  },
  {
    id: 'dq-102',
    channel: 'EMAIL',
    recipient: 'maker.chennai@koshinnovations.com',
    eventCode: 'ITEM_APPROVED',
    subject: '[Kosh Portal] Approved: Item FGHDMCRGY0002 has been authorized',
    status: 'DELIVERED',
    retryCount: 0,
    lastAttemptAt: '2026-10-22T07:46:12Z',
    correlationId: 'req-49098-email-02',
  },
  {
    id: 'dq-103',
    channel: 'WHATSAPP',
    recipient: '+919840123456',
    eventCode: 'ITEM_SUBMITTED',
    subject: 'WhatsApp Alert: MAPALBL0003 Review Required',
    status: 'ACCEPTED_BY_PROVIDER',
    retryCount: 0,
    lastAttemptAt: '2026-10-22T08:16:00Z',
    correlationId: 'req-49102-wa-01',
  },
  {
    id: 'dq-104',
    channel: 'EMAIL',
    recipient: 'sap.admin@koshinnovations.com',
    eventCode: 'SAP_SYNC_FAILED',
    subject: '[CRITICAL ALERT] SAP Service Layer Sync Failure for Batch #BATCH-20261021-01',
    status: 'FAILED',
    retryCount: 3,
    lastAttemptAt: '2026-10-21T18:45:10Z',
    errorMessage: 'SMTP 421 4.7.0 Connection rate limit reached; queued for backoff retry',
    correlationId: 'sap-sync-err-8821',
  },
];

export const INITIAL_WHATSAPP_CONFIG: WhatsAppConfig = {
  mode: 'USER_ASSISTED', // Safe, compliant mode by default with live toggle
  businessAccountId: 'WABA-KOSH-INNOVATIONS-91413',
  phoneNumberId: 'PHID-914132223344',
  senderNumber: '+914132223344',
  secretVaultRef: 'vault://secrets/meta-wa-cloud-api-token',
  webhookUrl: 'https://my.koshinnovations.com/api/webhooks/whatsapp',
  webhookVerifyTokenRef: 'vault://secrets/meta-wa-verify-token',
  apiVersion: 'v21.0',
  environment: 'PROD',
  rateLimitPerSec: 10,
  updatedAt: '2026-10-20T11:00:00Z',
  lastTestStatus: 'PASS',
  lastTestTimestamp: '2026-10-22T08:00:00Z',
};

export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'wa-tmpl-approval-alert',
    code: 'kosh_item_approval_alert',
    displayName: 'Item Review Pending Alert',
    category: 'UTILITY',
    language: 'en_US',
    bodyTemplate: 'Hello {{1}}, a new item creation request {{2}} ({3}) has been submitted by {{4}} and is awaiting your review in the Kosh Portal. Please visit: {{5}}',
    metaApprovalStatus: 'APPROVED',
    supportedModes: ['OFFICIAL_API', 'USER_ASSISTED'],
  },
  {
    id: 'wa-tmpl-item-authorized',
    code: 'kosh_item_authorized_alert',
    displayName: 'Item Authorization Notice',
    category: 'UTILITY',
    language: 'en_US',
    bodyTemplate: 'Hello {{1}}, your item {{2}} has been approved by {{3}} and queued for SAP B1 HANA synchronization.',
    metaApprovalStatus: 'APPROVED',
    supportedModes: ['OFFICIAL_API', 'USER_ASSISTED'],
  },
  {
    id: 'wa-tmpl-broadcast-urgent',
    code: 'kosh_urgent_maintenance_notice',
    displayName: 'Urgent Maintenance & Policy Broadcast',
    category: 'UTILITY',
    language: 'en_US',
    bodyTemplate: 'Urgent notice from Kosh Innovations IT: {{1}}. For questions, contact helpdesk@koshinnovations.com.',
    metaApprovalStatus: 'APPROVED',
    supportedModes: ['OFFICIAL_API', 'USER_ASSISTED'],
  },
];

export const INITIAL_WHATSAPP_WORK_ITEMS: WhatsAppManualWorkItem[] = [
  {
    id: 'wi-101',
    eventCode: 'ITEM_SUBMITTED',
    recipientPhone: '+919840123456',
    recipientName: 'Ramesh Balasubramanian (Item Checker)',
    renderedMessage: 'Hello Ramesh Balasubramanian, Item MAPALBL0003 (Machine Parts Aluminium Blue) was submitted by Karthik Raja and awaits your approval in the Kosh Master Portal: https://my.koshinnovations.com/approvals',
    status: 'PREPARED',
    preparedAt: '2026-10-22T08:15:00Z',
    operatorId: 'Suresh Kumar',
  },
  {
    id: 'wi-102',
    eventCode: 'ITEM_APPROVED',
    recipientPhone: '+919443123456',
    recipientName: 'Karthik Raja (Item Maker)',
    renderedMessage: 'Hello Karthik Raja, your item FGHDMCRGY0002 has been authorized by Ramesh Balasubramanian and is queued for SAP B1 HANA batch push.',
    status: 'USER_CONFIRMED_SENT',
    preparedAt: '2026-10-22T07:46:00Z',
    updatedAt: '2026-10-22T07:48:30Z',
    operatorId: 'Suresh Kumar',
    operatorNotes: 'Sent via WhatsApp Web. User acknowledged in 2 mins.',
  },
  {
    id: 'wi-103',
    eventCode: 'BROADCAST',
    recipientPhone: '+919884567890',
    recipientName: 'Ananya Sharma (Global Item Admin)',
    renderedMessage: 'Kosh IT Broadcast: Quarterly Global Item Master Code Freeze & HANA Maintenance scheduled for Saturday 23:00 to 01:00 IST.',
    status: 'USER_OPENED_WHATSAPP',
    preparedAt: '2026-10-22T06:10:00Z',
    updatedAt: '2026-10-22T06:12:15Z',
    operatorId: 'Suresh Kumar',
  },
];
