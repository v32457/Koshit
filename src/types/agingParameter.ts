/**
 * KOSH INNOVATIONS — AGING PARAMETER MASTER TYPES
 */

export type AgingBasis = 'DOCUMENT_DATE' | 'DUE_DATE' | 'POSTING_DATE';

export interface AgingBucketRange {
  bucketIndex: number; // 0 = Current, 1 = Bucket 1, etc.
  bucketName: string; // e.g. "Current", "Bucket 1", "Bucket 2"
  label: string;      // e.g. "1–30 Days"
  fromDays: number;   // e.g. 1
  toDays: number;     // e.g. 30
}

export type ApplicableModuleKey =
  | 'AP_AGING'
  | 'AR_AGING'
  | 'VENDOR_OUTSTANDING'
  | 'CUSTOMER_OUTSTANDING'
  | 'PURCHASE_ORDER_AGING'
  | 'SALES_ORDER_AGING'
  | 'GRN_PENDING_AGING'
  | 'INVOICE_PENDING_AGING'
  | 'PAYMENT_DUE_REPORTS';

export interface AgingParameterConfig {
  id: string;
  code: string;                // e.g. "AGE-STD-01" (Must be unique)
  name: string;                // e.g. "Standard Enterprise 180-Day Aging"
  description: string;         // Purpose or business context
  companyId: string;           // Organizational scope company
  branchId: string;            // Organizational scope branch ('ALL' or branchId)
  agingBasis: AgingBasis;      // DOCUMENT_DATE / DUE_DATE / POSTING_DATE
  buckets: AgingBucketRange[]; // Exactly 7 bucket definitions
  status: 'ACTIVE' | 'INACTIVE';
  isDefault: boolean;          // Default configuration for the scope
  applicableModules: ApplicableModuleKey[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export const INTEGRATED_MODULES_LIST: { key: ApplicableModuleKey; label: string; group: string }[] = [
  { key: 'AP_AGING', label: 'Accounts Payable Aging', group: 'Finance & AP' },
  { key: 'AR_AGING', label: 'Accounts Receivable Aging', group: 'Finance & AR' },
  { key: 'VENDOR_OUTSTANDING', label: 'Vendor Outstanding Reports', group: 'Procurement' },
  { key: 'CUSTOMER_OUTSTANDING', label: 'Customer Outstanding Reports', group: 'Sales & Distribution' },
  { key: 'PURCHASE_ORDER_AGING', label: 'Purchase Order Aging', group: 'Procurement' },
  { key: 'SALES_ORDER_AGING', label: 'Sales Order Aging', group: 'Sales & Distribution' },
  { key: 'GRN_PENDING_AGING', label: 'GRN Pending Aging', group: 'Inventory Stores' },
  { key: 'INVOICE_PENDING_AGING', label: 'Invoice Pending Aging', group: 'Finance & AP' },
  { key: 'PAYMENT_DUE_REPORTS', label: 'Payment Due Reports', group: 'Treasury' },
];
