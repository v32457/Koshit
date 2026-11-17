/**
 * CIPPLATFORM — CENTRALIZED FINANCIAL YEAR, ACCOUNTING PERIOD, NUMBERING SERIES & YEAR-END CLOSING TYPES
 * Authoritative platform-wide types for Section 6 (Financial Year Management), Section 9 (Shared Platform Services),
 * and Section 11 (Historical Configuration Immutability & Transaction Snapshots).
 */

export type FiscalCalendarType = 'APRIL_MARCH' | 'JANUARY_DECEMBER' | 'JULY_JUNE' | 'CUSTOM';

export type PeriodFrequency = 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';

export type FinancialYearStatus =
  | 'DRAFT'
  | 'FUTURE'
  | 'ACTIVE'
  | 'CLOSING'
  | 'CLOSED'
  | 'ARCHIVED';

export type AccountingPeriodStatus =
  | 'FUTURE'
  | 'OPEN'
  | 'TEMPORARILY_LOCKED'
  | 'CLOSING'
  | 'CLOSED';

export interface FiscalCalendarConfig {
  id: string;
  code: string;
  name: string;
  calendarType: FiscalCalendarType;
  startMonth: number; // 1 = Jan, 4 = Apr, 7 = Jul, etc.
  startDay: number;   // 1
  defaultPeriodFrequency: PeriodFrequency;
  allowAdjustmentPeriods: boolean;
  version: number;
  createdAt: string;
  createdBy: string;
}

export interface AccountingPeriod {
  id: string;
  financialYearId: string;
  financialYearCode: string;
  companyId: string;
  periodNumber: number; // 1..12 (or 13/14 for adjustment periods)
  periodCode: string;   // e.g. '2026-04', 'FY2627-P01', 'FY2627-ADJ1'
  periodName: string;   // e.g. 'April 2026', 'Q1 (Apr-Jun 2026)', 'Year-End Audit Adjustment'
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD (handles leap years e.g. 2028-02-29)
  isAdjustmentPeriod: boolean;
  status: AccountingPeriodStatus;
  version: number;
  openedBy?: string;
  openedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  lockReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  reopenApprovalRef?: string;
  closedBy?: string;
  closedAt?: string;
  updatedAt: string;
}

export interface FinancialYearMaster {
  id: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  financialYearCode: string; // e.g. 'FY 2026-27' or 'FY 2026'
  financialYearName: string; // e.g. 'Financial Year 2026-27 (Apr-Mar)'
  fiscalCalendarId: string;
  fiscalCalendarType: FiscalCalendarType;
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  periodFrequency: PeriodFrequency;
  numberOfPeriods: number;
  includeAdjustmentPeriod: boolean;
  status: FinancialYearStatus;
  description: string;
  version: number;
  isDefaultActiveForCompany: boolean;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  closedBy?: string;
  closedAt?: string;
  updatedAt: string;
}

export type NumberingResetFrequency =
  | 'FY_RESET'
  | 'CALENDAR_YEAR_RESET'
  | 'MONTHLY_RESET'
  | 'CONTINUOUS';

export type NumberingDocumentType =
  | 'PR'
  | 'RFQ'
  | 'QUOTATION'
  | 'PO'
  | 'GRN'
  | 'SUPPLIER_INVOICE'
  | 'JOURNAL_ENTRY'
  | 'HOLIDAY_CALENDAR'
  | 'WORKDAY_CALENDAR';

export interface CentralizedNumberingSeriesConfig {
  id: string;
  companyId: string;
  branchId: string; // 'ALL' or specific branchId
  documentType: NumberingDocumentType;
  seriesCode: string;
  prefix: string;
  includeCompanyCode: boolean;
  includeBranchCode: boolean;
  includeFyCode: boolean;
  separator: string;
  runningNumberLength: number;
  resetFrequency: NumberingResetFrequency;
  allocationEvent: 'ON_DRAFT' | 'ON_SUBMISSION' | 'ON_APPROVAL';
  currentSequenceByPeriodKey: Record<string, number>;
  version: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  status: 'ACTIVE' | 'SUPERSEDED';
  updatedBy: string;
  updatedAt: string;
}

export interface NumberingAllocationSnapshot {
  documentNumber: string;
  seriesId: string;
  seriesVersion: number;
  documentType: NumberingDocumentType;
  companyId: string;
  branchId: string;
  financialYearId: string;
  financialYearCode: string;
  accountingPeriodCode: string;
  resetKeyUsed: string;
  sequenceNumber: number;
  allocatedAt: string;
}

export interface PostingDateValidationResult {
  allowed: boolean;
  documentDate: string;
  accountingPostingDate: string;
  companyId: string;
  financialYearId?: string;
  financialYearCode?: string;
  financialYearStatus?: FinancialYearStatus;
  accountingPeriodId?: string;
  accountingPeriodCode?: string;
  accountingPeriodName?: string;
  accountingPeriodStatus?: AccountingPeriodStatus;
  rejectionReason?: string;
  snapshot: FinancialYearTransactionSnapshot;
}

export interface FinancialYearTransactionSnapshot {
  snapshotId: string;
  capturedAt: string;
  companyId: string;
  branchId?: string;
  documentDate: string;
  accountingPostingDate: string;
  financialYearId: string;
  financialYearCode: string;
  financialYearVersion: number;
  fiscalCalendarId: string;
  fiscalCalendarType: FiscalCalendarType;
  fyStartDate: string;
  fyEndDate: string;
  accountingPeriodId: string;
  accountingPeriodCode: string;
  accountingPeriodVersion: number;
  periodStatusAtProcessing: AccountingPeriodStatus;
  numberingSeriesId?: string;
  numberingSeriesVersion?: number;
}

export type YearEndChecklistItemCode =
  | 'OPEN_ACCOUNTING_PERIODS'
  | 'UNPOSTED_JOURNALS'
  | 'OUTSTANDING_SUPPLIER_INVOICES'
  | 'OUTSTANDING_CUSTOMER_INVOICES'
  | 'BANK_RECONCILIATION'
  | 'INVENTORY_VALUATION'
  | 'PENDING_GRN_INVOICE_MISMATCHES'
  | 'PENDING_PAYMENT_TRANSACTIONS'
  | 'BUDGET_COMMITMENTS_RECONCILIATION'
  | 'FIXED_ASSET_DEPRECIATION'
  | 'STATUTORY_TAX_POSTINGS'
  | 'TRIAL_BALANCE_VERIFICATION'
  | 'SUSPENSE_ACCOUNT_CLEARANCE';

export interface YearEndChecklistValidationItem {
  code: YearEndChecklistItemCode;
  title: string;
  category: 'FINANCE' | 'PROCUREMENT' | 'INVENTORY' | 'BUDGET' | 'STATUTORY';
  status: 'PASSED' | 'WARNING' | 'BLOCKING_ISSUE';
  openItemsCount: number;
  details: string;
  responsibleRole: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface YearEndClosingTransitionRecord {
  id: string;
  idempotencyKey: string;
  companyId: string;
  sourceFinancialYearId: string;
  sourceFinancialYearCode: string;
  targetFinancialYearId: string;
  targetFinancialYearCode: string;
  status: 'DRAFT_CHECKLIST' | 'PENDING_APPROVAL' | 'COMPLETED' | 'REJECTED';
  checklistItems: YearEndChecklistValidationItem[];
  transitionSummary: {
    openPurchaseOrdersRolledOver: number;
    openPrCommitmentsRolledOver: number;
    outstandingGrnsRolledOver: number;
    budgetCarryForwardAuthorized: boolean;
    budgetCarryForwardAmountInr: number;
    budgetCarryForwardApprovalRef?: string;
    openingBalanceJournalNumber: string;
    closingBalanceJournalNumber: string;
    inventoryClosingValuationInr: number;
    payablesCarriedForwardInr: number;
    receivablesCarriedForwardInr: number;
  };
  initiatedBy: string;
  initiatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  auditEvidenceRef: string;
}

export type HistoricalFyFilterSelection = 'ALL' | string;

export interface ResolvedTransactionFyResult {
  status: 'MATCHED' | 'UNASSIGNABLE';
  financialYearId?: string;
  financialYearCode?: string;
  financialYearStatus?: FinancialYearStatus;
  matchedBy:
    | 'EXPLICIT_ID'
    | 'EXPLICIT_CODE'
    | 'POSTING_DATE'
    | 'DOCUMENT_DATE'
    | 'UNASSIGNABLE';
  effectiveDate?: string;
  gapReason?: string;
}

export interface FinancialYearDataQualityGap {
  recordId: string;
  documentNumber: string;
  entityType: string;
  companyId: string;
  branchId?: string;
  dateAttempted?: string;
  gapReason: string;
}

export interface FinancialYearFilterResult<T> {
  filteredRecords: T[];
  dataQualityGaps: FinancialYearDataQualityGap[];
  selectedFy: FinancialYearMaster | null;
  isAllFinancialYears: boolean;
  allFinancialYearsAuthorized: boolean;
  isHistoricalReadOnly: boolean;
  totalBeforeFyFilter: number;
}

