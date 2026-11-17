/**
 * CIPPLATFORM — END-TO-END TESTS FOR:
 * 1. Financial Year-Based Holiday, Weekly Off & Workday Calendar Management (Zero Shift Management)
 * 2. Centralized Financial Year, Accounting Period, Numbering Series & Year-End Closing Engine
 * 3. Cross-Module Integration Guards (PR, RFQ, PO, GRN->Inventory, Supplier Invoice Matching)
 * 4. Mandatory Historical Financial Year View, Filtering, RBAC & Data-Quality Gap Transparency
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { financialYearService } from '../services/financialYearService';
import {
  HolidayService,
  WeeklyOffService,
  CalendarExceptionService,
  CalendarValidationService,
  CalendarVersionService,
  WorkdayCalendarService,
  registerWorkdayScheduleExtension,
} from '../services/workdayCalendarService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { rfqService } from '../services/rfqService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { goodsReceiptService } from '../services/goodsReceiptService';
import { invoiceMatchingService } from '../services/invoiceMatchingService';
import { inventoryValidationService } from '../services/inventoryValidationService';
import { User } from '../types';

const ADMIN_USER: User = {
  id: 'usr-admin-01',
  fullName: 'Rajesh Sharma',
  email: 'rajesh@kosh.in',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01', 'br-chen-02'],
  isGlobalScope: true,
  twoFactorEnabled: false,
};

const BUYER_LIMITED_USER: User = {
  id: 'usr-buyer-02',
  fullName: 'Karthik Buyer',
  email: 'karthik@kosh.in',
  role: 'BRANCH_COORDINATOR',
  orgId: 'co-kosh-01',
  allowedBranchIds: ['br-pond-01'],
  isGlobalScope: false,
  twoFactorEnabled: false,
};

// ============================================================================
// SECTION A: SCOPE REVISION — STRICT ZERO SHIFT MANAGEMENT VERIFICATION
// ============================================================================

test('Scope Revision: Zero Shift Management tables, services, or APIs exist in Workday Calendar deliverables', () => {
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'server/src/migrations/006_create_financial_year_and_workday_calendar.sql'),
    'utf8'
  );
  assert.equal(/CREATE TABLE[^;]*shift/i.test(migrationSql), false);
  assert.equal(/holiday_masters/.test(migrationSql), true);
  assert.equal(/weekly_off_patterns/.test(migrationSql), true);
  assert.equal(/workday_calendars/.test(migrationSql), true);

  const serviceSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/workdayCalendarService.ts'),
    'utf8'
  );
  assert.equal(/ShiftMasterService|ShiftAssignmentService|ShiftRotationService/i.test(serviceSrc), false);
});

// ============================================================================
// SECTION B: FINANCIAL YEAR ENGINE, PERIOD CONTROLS, NUMBERING & YEAR-END
// ============================================================================

test('FY Engine: Supports April-March, Calendar Jan-Dec, Leap Year Feb 29, and Rejects Overlapping FYs', () => {
  financialYearService.resetForTesting();

  // Default seeded Indian FY 2026-27 (April-March)
  const years = financialYearService.getFinancialYears('co-kosh-01');
  const fy2627 = years.find((y) => y.financialYearCode === 'FY 2026-27');
  assert.ok(fy2627);
  assert.equal(fy2627.startDate, '2026-04-01');
  assert.equal(fy2627.endDate, '2027-03-31');

  const fy2627Periods = financialYearService.getAccountingPeriods(fy2627.id);
  assert.equal(fy2627Periods.filter((p) => !p.isAdjustmentPeriod).length, 12);

  // Overlapping FY for same company must throw
  assert.throws(() => {
    financialYearService.createFinancialYear({
      companyId: 'co-kosh-01',
      financialYearCode: 'FY 2026-OVLP',
      financialYearName: 'Overlapping FY',
      fiscalCalendarType: 'APRIL_MARCH',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      periodFrequency: 'MONTHLY',
      createdBy: 'Admin',
    });
  }, /overlap/i);

  // Create future Leap Year Calendar FY (Jan-Dec 2032) for company 2 and verify Feb has 29 days
  const leapCalFy = financialYearService.createFinancialYear({
    companyId: 'co-kosh-02',
    financialYearCode: 'CY 2032',
    financialYearName: 'Calendar Year 2032 (Leap Year)',
    fiscalCalendarType: 'JANUARY_DECEMBER',
    startDate: '2032-01-01',
    endDate: '2032-12-31',
    periodFrequency: 'MONTHLY',
    includeAdjustmentPeriod: false,
    status: 'FUTURE',
    createdBy: 'Finance Admin',
  });
  const leapPeriods = financialYearService.getAccountingPeriods(leapCalFy.id);
  const feb2032 = leapPeriods.find((p) => p.periodCode === '2032-02');
  assert.ok(feb2032);
  assert.equal(feb2032.startDate, '2032-02-01');
  assert.equal(feb2032.endDate, '2032-02-29');
});

test('FY Accounting Period Controls: Locked/Closed periods reject postings, Reopen requires reason & ref, Closed FY cannot reopen', () => {
  financialYearService.resetForTesting();

  const years = financialYearService.getFinancialYears('co-kosh-01');
  const fy2627 = years.find((y) => y.financialYearCode === 'FY 2026-27')!;
  const fy2526 = years.find((y) => y.financialYearCode === 'FY 2025-26')!;
  const periods2627 = financialYearService.getAccountingPeriods(fy2627.id);
  const octPeriod = periods2627.find((p) => p.periodCode === '2026-10')!;

  // Open Oct period first to ensure known state, then temporarily lock
  financialYearService.updateAccountingPeriodStatus({
    periodId: octPeriod.id,
    targetStatus: 'TEMPORARILY_LOCKED',
    actorName: 'Controller',
    reason: 'Month-end physical stock verification',
  });

  const lockedPostCheck = financialYearService.validateAndCapturePostingSnapshot({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    documentDate: '2026-10-10',
    accountingPostingDate: '2026-10-15',
  });
  assert.equal(lockedPostCheck.allowed, false);
  assert.match(lockedPostCheck.rejectionReason || '', /TEMPORARILY_LOCKED/);

  // Reopen without approval ref -> must throw
  assert.throws(() => {
    financialYearService.updateAccountingPeriodStatus({
      periodId: octPeriod.id,
      targetStatus: 'OPEN',
      actorName: 'Controller',
      reason: 'Need emergency journal',
    });
  }, /mandatory reason and authorized approval reference/i);

  // Reopen with approval ref -> allowed
  const reopened = financialYearService.updateAccountingPeriodStatus({
    periodId: octPeriod.id,
    targetStatus: 'OPEN',
    actorName: 'CFO Approver',
    reason: 'Authorized variance adjustment',
    approvalReference: 'AUTH-REOPEN-102',
  });
  assert.equal(reopened.status, 'OPEN');

  // Cannot reopen period under permanently CLOSED FY 2025-26
  const closedPeriods = financialYearService.getAccountingPeriods(fy2526.id);
  assert.throws(() => {
    financialYearService.updateAccountingPeriodStatus({
      periodId: closedPeriods[0].id,
      targetStatus: 'OPEN',
      actorName: 'CFO Approver',
      reason: 'Attempt historical reopen',
      approvalReference: 'AUTH-999',
    });
  }, /permanently CLOSED/i);
});

test('FY Numbering Series & Year-End Closing: Resets sequence per FY and executes 13-point closing idempotently', () => {
  financialYearService.resetForTesting();

  // Separate posting dates in different FYs yield FY-specific sequence keys
  const num2627 = financialYearService.allocateDocumentNumber({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    documentType: 'PO',
    postingDate: '2026-05-12',
  });
  const num2728 = financialYearService.allocateDocumentNumber({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    documentType: 'PO',
    postingDate: '2027-04-05',
  });
  assert.equal(num2627.financialYearCode, 'FY 2026-27');
  assert.equal(num2728.financialYearCode, 'FY 2027-28');
  assert.equal(num2728.sequenceNumber, 1);

  // Distinct Document Date vs Accounting Posting Date snapshot (Cross-FY PO scenario)
  const crossFySnap = financialYearService.validateAndCapturePostingSnapshot({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    documentDate: '2026-03-22',
    accountingPostingDate: '2026-04-12',
  });
  assert.equal(crossFySnap.allowed, true);
  assert.equal(crossFySnap.snapshot.financialYearCode, 'FY 2026-27');
  assert.equal(crossFySnap.snapshot.documentDate, '2026-03-22');
  assert.equal(crossFySnap.snapshot.accountingPostingDate, '2026-04-12');

  // Year-End Closing: budget carry-forward without approval ref rejected
  const years = financialYearService.getFinancialYears('co-kosh-01');
  const fy2627 = years.find((y) => y.financialYearCode === 'FY 2026-27')!;
  const fy2728 = years.find((y) => y.financialYearCode === 'FY 2027-28')!;

  assert.throws(() => {
    financialYearService.generateYearEndChecklist({
      companyId: 'co-kosh-01',
      sourceFinancialYearId: fy2627.id,
      targetFinancialYearId: fy2728.id,
      initiatedBy: 'Controller One',
      authorizeBudgetCarryForward: true,
      budgetCarryForwardAmountInr: 250000,
    });
  }, /explicit authorization reference/i);

  const yec = financialYearService.generateYearEndChecklist({
    companyId: 'co-kosh-01',
    sourceFinancialYearId: fy2627.id,
    targetFinancialYearId: fy2728.id,
    initiatedBy: 'Controller One',
    idempotencyKey: 'test-yec-2627-2728',
  });
  assert.equal(yec.checklistItems.length, 13);

  // Duplicate idempotencyKey returns identical record
  const yecDup = financialYearService.generateYearEndChecklist({
    companyId: 'co-kosh-01',
    sourceFinancialYearId: fy2627.id,
    targetFinancialYearId: fy2728.id,
    initiatedBy: 'Controller One',
    idempotencyKey: 'test-yec-2627-2728',
  });
  assert.equal(yecDup.id, yec.id);

  // Maker-Checker self-approval blocked
  assert.throws(() => {
    financialYearService.approveAndExecuteYearEndClosing({
      closingRecordId: yec.id,
      approvedBy: 'Controller One',
    });
  }, /Maker-Checker Violation/i);

  const completed = financialYearService.approveAndExecuteYearEndClosing({
    closingRecordId: yec.id,
    approvedBy: 'CFO Two',
  });
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(
    financialYearService.getFinancialYears('co-kosh-01').find((y) => y.id === fy2627.id)?.status,
    'CLOSED'
  );
  assert.equal(
    financialYearService.getFinancialYears('co-kosh-01').find((y) => y.id === fy2728.id)?.status,
    'ACTIVE'
  );

  financialYearService.resetForTesting();
});

// ============================================================================
// SECTION C: WORKDAY CALENDAR ENGINE (HOLIDAYS, WEEKLY OFF, CONFLICTS, VERSIONS)
// ============================================================================

test('Workday Calendar: Holiday categories, Weekly Off patterns, Overlap Conflict Policies, Exceptions & Versioning', () => {
  financialYearService.resetForTesting();
  const fy2627 = financialYearService.getDefaultFinancialYearForCompany('co-kosh-01');

  // Weekly Off patterns verification
  const sunOnly = WeeklyOffService.getPatterns('co-kosh-01').find((p) => p.patternType === 'SUNDAY_ONLY')!;
  const secondFourthSat = WeeklyOffService.getPatterns('co-kosh-01').find(
    (p) => p.patternType === 'SECOND_AND_FOURTH_SATURDAY_SUNDAY'
  )!;
  const firstThirdSat = WeeklyOffService.getPatterns('co-kosh-01').find(
    (p) => p.patternType === 'FIRST_AND_THIRD_SATURDAY_SUNDAY'
  )!;
  const rotational = WeeklyOffService.getPatterns('co-kosh-02').find(
    (p) => p.patternType === 'ROTATIONAL_WEEKLY_OFF'
  )!;

  // 2026-04-04 = 1st Sat, 2026-04-11 = 2nd Sat, 2026-04-05 = Sunday
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-05', sunOnly), true);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-11', sunOnly), false);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-04', firstThirdSat), true);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-11', firstThirdSat), false);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-11', secondFourthSat), true);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-04', secondFourthSat), false);
  // Rotational: anchor 2026-04-01, 6 working + 1 off -> 2026-04-07 is 7th day (off)
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-06', rotational), false);
  assert.equal(WeeklyOffService.isDateWeeklyOff('2026-04-07', rotational), true);

  // Holiday calendar generation for FY 2026-27 includes Deepavali on Sunday 2026-11-08 & Half-Day Ayudha Pooja
  const holCal = HolidayService.generateFinancialYearHolidayCalendar({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    financialYearId: fy2627.id,
    createdBy: 'HR Maker',
  });
  const deepavali = holCal.entries.find((e) => e.date === '2026-11-08');
  assert.ok(deepavali, 'Deepavali 2026-11-08 included in FY 2026-27 calendar');
  const halfDay = holCal.entries.find((e) => e.date === '2026-10-20');
  assert.ok(halfDay && halfDay.dayWeight === 0.5);

  // Initialize initial published v1 calendar for co-kosh-01 / br-pond-01
  WorkdayCalendarService.getWorkdayCalendars({ companyId: 'co-kosh-01', branchId: 'br-pond-01' });

  // Conflict policy 1: NO_AUTOMATIC_COMPENSATORY_OFF prevents double counting of 2026-11-08
  const conflictsDetect = CalendarValidationService.detectHolidayWeeklyOffConflicts({
    holidayCalendar: holCal,
    weeklyOffPattern: sunOnly,
    conflictPolicy: 'NO_AUTOMATIC_COMPENSATORY_OFF',
  });
  assert.ok(conflictsDetect.some((c) => c.date === '2026-11-08'));

  const calAbsorb = WorkdayCalendarService.generateWorkdayCalendar({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    financialYearId: fy2627.id,
    holidayCalendarId: holCal.id,
    weeklyOffPatternId: sunOnly.id,
    conflictPolicy: 'NO_AUTOMATIC_COMPENSATORY_OFF',
    nonShiftDailyHoursPolicy: 8,
    createdBy: 'HR Maker',
    modificationReason: 'Test absorb overlap without double counting',
  });
  const nov8 = calAbsorb.entries.find((e) => e.date === '2026-11-08')!;
  assert.equal(nov8.status, 'HOLIDAY_AND_WEEKLY_OFF_OVERLAP');
  assert.equal(calAbsorb.summary.overlapConflictCount >= 1, true);
  assert.equal(
    calAbsorb.summary.totalCalendarDays,
    calAbsorb.summary.totalWorkingDays +
      calAbsorb.summary.totalHolidays +
      calAbsorb.summary.totalWeeklyOffs +
      calAbsorb.summary.halfWorkingDays +
      calAbsorb.summary.specialWorkingDays +
      calAbsorb.summary.shutdownDays
  );

  // Conflict policy 2: SUBSTITUTE_NEXT_WORKING_DAY substitutes Monday 2026-11-09
  const calSub = WorkdayCalendarService.generateWorkdayCalendar({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    financialYearId: fy2627.id,
    holidayCalendarId: holCal.id,
    weeklyOffPatternId: sunOnly.id,
    conflictPolicy: 'SUBSTITUTE_NEXT_WORKING_DAY',
    nonShiftDailyHoursPolicy: 8,
    createdBy: 'HR Maker',
    modificationReason: 'Test substitute holiday on Monday',
  });
  const nov9 = calSub.entries.find((e) => e.date === '2026-11-09')!;
  assert.equal(nov9.status, 'SUBSTITUTE_HOLIDAY');
  assert.equal(nov9.isWorkingDay, false);

  // Calendar Exception + Compensatory Off + Maker-Checker
  const exc = CalendarExceptionService.requestCalendarException({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    financialYearId: fy2627.id,
    financialYearCode: fy2627.financialYearCode,
    targetDate: '2026-12-06', // Sunday
    exceptionType: 'SPECIAL_WORKING_DAY_ON_WEEKLY_OFF',
    originalDayStatus: 'WEEKLY_OFF',
    overrideDayStatus: 'SPECIAL_WORKING_DAY',
    grantsCompensatoryOff: true,
    reason: 'Urgent export dispatch customer run',
    requestedBy: 'Plant Supervisor',
  });

  assert.throws(() => {
    CalendarExceptionService.approveCalendarException({
      exceptionId: exc.id,
      approvedBy: 'Plant Supervisor',
      decision: 'APPROVE',
    });
  }, /Maker-Checker Violation/i);

  CalendarExceptionService.approveCalendarException({
    exceptionId: exc.id,
    approvedBy: 'Plant Director',
    decision: 'APPROVE',
  });

  const compOffs = CalendarExceptionService.getCompensatoryOffs('co-kosh-01', 'br-pond-01');
  assert.ok(compOffs.some((c) => c.earnedOnDate === '2026-12-06' && c.creditDays === 1));

  // Ensure initial published calendar exists so publishing calExc supersedes prior published version
  WorkdayCalendarService.getWorkdayCalendars({ companyId: 'co-kosh-01', branchId: 'br-pond-01' });

  // Versioning & Maker-Checker Publish + Extension Provider Hook
  registerWorkdayScheduleExtension((ctx) =>
    ctx.date === '2026-04-01' ? { dailyHoursOverride: 9.5 } : null
  );
  const calExc = WorkdayCalendarService.generateWorkdayCalendar({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    plantCode: 'PLT-PDY-INJ',
    financialYearId: fy2627.id,
    holidayCalendarId: holCal.id,
    weeklyOffPatternId: sunOnly.id,
    conflictPolicy: 'NO_AUTOMATIC_COMPENSATORY_OFF',
    nonShiftDailyHoursPolicy: 8,
    createdBy: 'HR Maker',
    modificationReason: 'Apply special working day & schedule hook',
  });
  registerWorkdayScheduleExtension(null);

  assert.equal(calExc.entries.find((e) => e.date === '2026-12-06')?.status, 'SPECIAL_WORKING_DAY');
  assert.equal(calExc.entries.find((e) => e.date === '2026-04-01')?.scheduledWorkingHours, 9.5);

  WorkdayCalendarService.submitWorkdayCalendarForApproval({
    workdayCalendarId: calExc.id,
    submittedBy: 'HR Maker',
  });
  assert.throws(() => {
    WorkdayCalendarService.approveAndPublishWorkdayCalendar({
      workdayCalendarId: calExc.id,
      approvedBy: 'HR Maker',
    });
  }, /Maker-Checker Violation/i);

  const published = WorkdayCalendarService.approveAndPublishWorkdayCalendar({
    workdayCalendarId: calExc.id,
    approvedBy: 'HR Director',
  });
  assert.equal(published.status, 'PUBLISHED');
  const versions = CalendarVersionService.getVersions('co-kosh-01', 'br-pond-01', fy2627.id);
  assert.ok(versions.some((v) => v.status === 'SUPERSEDED'));
  assert.ok(versions.some((v) => v.status === 'PUBLISHED' && v.workdayCalendarId === published.id));
});

// ============================================================================
// SECTION D: CROSS-MODULE INTEGRATION & HISTORICAL FY FILTERING / READ-ONLY
// ============================================================================

test('Cross-Module Integration: RFQ cross-company & cross-PurchaseOrg consolidation blocked; GRN & Invoice reject closed FY posting dates', () => {
  financialYearService.resetForTesting();
  inventoryValidationService.resetForTesting();

  // Cross-Company RFQ Consolidation guard
  assert.throws(() => {
    rfqService.createRfq({
      companyId: 'co-kosh-02',
      purchaseOrgId: 'po-kosh-01',
      prReferences: ['PR-2026-0001'],
      rfqDate: '2026-05-01',
      title: 'Invalid Cross-Company Consolidation',
    } as any);
  }, /Cross-Company RFQ Consolidation Prohibited/i);

  // Cross-Purchase-Organization RFQ Consolidation guard
  assert.throws(() => {
    rfqService.createRfq({
      companyId: 'co-kosh-01',
      purchaseOrgId: 'po-kosh-99',
      prReferences: ['PR-2026-0001'],
      rfqDate: '2026-05-01',
      title: 'Invalid Cross-Org Consolidation',
    } as any);
  }, /Cross-Purchase-Organization RFQ Consolidation Prohibited/i);

  // GRN Posting Date into CLOSED FY 2025-26 rejected
  assert.throws(() => {
    goodsReceiptService.postGoodsReceipt(
      {
        companyId: 'co-kosh-01',
        branchId: 'br-pond-01',
        poNumber: 'PO-2026-0001',
        receiptDate: '2026-03-15',
        accountingPostingDate: '2026-03-15',
      },
      [{ itemCode: 'RMPAOPOEXLG0001', receivedQtyPurchUom: 5 }]
    );
  }, /closed|prohibited/i);

  // Invoice Matching Posting Date into CLOSED FY 2025-26 rejected
  assert.throws(() => {
    invoiceMatchingService.submitAndMatchSupplierInvoice({
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      vendorId: 'bp-002',
      poNumber: 'PO-2026-0001',
      supplierInvoiceNumber: 'SINV-BLOCKED-2025',
      invoiceDate: '2026-03-20',
      accountingPostingDate: '2026-03-20',
      createdBy: 'AP Clerk',
      lines: [
        {
          itemCode: 'RMPAOPOEXLG0001',
          description: 'Test Line',
          uom: 'BAG',
          invoicedQuantity: 1,
          unitPrice: 10000,
          taxPercent: 18,
        },
      ],
    });
  }, /closed|prohibited/i);
});

test('Historical FY Filtering & Immutability: FY 2025-26 seed documents, Cross-FY PO-2025-0099, Data-Quality Gap PR-LEGACY-0009, All-FY RBAC, and Mutation Lock', () => {
  financialYearService.resetForTesting();

  const prs = PurchaseRequisitionService.getPurchaseRequisitions();
  const rfqs = rfqService.getRfqs();
  const pos = purchaseOrderService.getPOs();
  const grns = goodsReceiptService.getReceipts();
  const invs = invoiceMatchingService.getInvoices();

  // 1. Authorized Admin can use ALL, Limited Buyer cannot
  assert.equal(financialYearService.isUserAuthorizedForAllFinancialYears(ADMIN_USER), true);
  assert.equal(financialYearService.isUserAuthorizedForAllFinancialYears(BUYER_LIMITED_USER), false);

  // Non-authorized user passing 'ALL' falls back to active FY 2026-27
  const buyerAllAttempt = financialYearService.filterTransactionsByFinancialYear({
    records: pos,
    selectedFyId: 'ALL',
    companyId: 'co-kosh-01',
    currentUser: BUYER_LIMITED_USER,
    entityType: 'PURCHASE_ORDER',
    getRecordId: (p) => p.id,
    getDocumentNumber: (p) => p.poNumber,
    getCompanyId: (p) => p.companyId,
    getBranchId: (p) => p.branchId,
    getFinancialYearId: (p) => p.financialYearId,
    getFinancialYearCode: (p) => p.financialYearCode,
    getAccountingPostingDate: (p) => p.accountingPostingDate,
    getDocumentDate: (p) => p.poDate,
  });
  assert.equal(buyerAllAttempt.isAllFinancialYears, false);
  assert.equal(buyerAllAttempt.selectedFy?.financialYearCode, 'FY 2026-27');

  // 2. Cross-FY PO-2025-0099 (poDate 2026-03-22, accountingPostingDate 2026-04-12) must appear in FY 2026-27, NOT FY 2025-26
  const fy2627Pos = financialYearService.filterTransactionsByFinancialYear({
    records: pos,
    selectedFyId: 'fy-co-kosh-01-2026-27',
    companyId: 'co-kosh-01',
    currentUser: ADMIN_USER,
    entityType: 'PURCHASE_ORDER',
    getRecordId: (p) => p.id,
    getDocumentNumber: (p) => p.poNumber,
    getCompanyId: (p) => p.companyId,
    getBranchId: (p) => p.branchId,
    getFinancialYearId: (p) => p.financialYearId,
    getFinancialYearCode: (p) => p.financialYearCode,
    getAccountingPostingDate: (p) => p.accountingPostingDate,
    getDocumentDate: (p) => p.poDate,
  });
  assert.ok(fy2627Pos.filteredRecords.some((p) => p.poNumber === 'PO-2025-0099'));
  assert.equal(fy2627Pos.isHistoricalReadOnly, false);

  // 3. Historical FY 2025-26 returns historical documents & sets isHistoricalReadOnly = true
  const fy2526Prs = financialYearService.filterTransactionsByFinancialYear({
    records: prs,
    selectedFyId: 'fy-co-kosh-01-2025-26',
    companyId: 'co-kosh-01',
    currentUser: ADMIN_USER,
    entityType: 'PURCHASE_REQUISITION',
    getRecordId: (p) => p.id,
    getDocumentNumber: (p) => p.prNumber,
    getCompanyId: (p) => p.companyId,
    getBranchId: (p) => p.branchId,
    getFinancialYearId: (p) => p.financialYearId,
    getFinancialYearCode: (p) => p.financialYearCode,
    getAccountingPostingDate: (p) => p.accountingPostingDate,
    getDocumentDate: (p) => p.documentDate || p.createdAt?.slice(0, 10),
  });
  assert.equal(fy2526Prs.isHistoricalReadOnly, true);
  assert.ok(fy2526Prs.filteredRecords.some((p) => p.prNumber === 'PR-2025-0142'));
  assert.ok(
    fy2526Prs.dataQualityGaps.some((g) => g.documentNumber === 'PR-LEGACY-0009'),
    'PR-LEGACY-0009 is transparently surfaced in dataQualityGaps instead of fabricating an FY match'
  );
  assert.equal(
    fy2526Prs.filteredRecords.some((p) => p.prNumber === 'PR-LEGACY-0009'),
    false
  );

  // Historical FY 2025-26 RFQ, PO, GRN, Invoice presence checks
  assert.ok(
    financialYearService
      .filterTransactionsByFinancialYear({
        records: rfqs,
        selectedFyId: 'fy-co-kosh-01-2025-26',
        companyId: 'co-kosh-01',
        currentUser: ADMIN_USER,
        entityType: 'RFQ',
        getRecordId: (r) => r.id,
        getDocumentNumber: (r) => r.rfqNumber,
        getCompanyId: (r) => r.companyId,
        getBranchId: (r) => r.branchId,
        getFinancialYearId: (r) => r.financialYearId,
        getFinancialYearCode: (r) => r.financialYearCode,
        getDocumentDate: (r) => r.rfqDate,
      })
      .filteredRecords.some((r) => r.rfqNumber === 'RFQ-2025-0089')
  );

  assert.ok(
    financialYearService
      .filterTransactionsByFinancialYear({
        records: pos,
        selectedFyId: 'fy-co-kosh-01-2025-26',
        companyId: 'co-kosh-01',
        currentUser: ADMIN_USER,
        entityType: 'PURCHASE_ORDER',
        getRecordId: (p) => p.id,
        getDocumentNumber: (p) => p.poNumber,
        getCompanyId: (p) => p.companyId,
        getBranchId: (p) => p.branchId,
        getFinancialYearId: (p) => p.financialYearId,
        getFinancialYearCode: (p) => p.financialYearCode,
        getAccountingPostingDate: (p) => p.accountingPostingDate,
        getDocumentDate: (p) => p.poDate,
      })
      .filteredRecords.some((p) => p.poNumber === 'PO-2025-0074')
  );

  assert.ok(
    financialYearService
      .filterTransactionsByFinancialYear({
        records: grns,
        selectedFyId: 'fy-co-kosh-01-2025-26',
        companyId: 'co-kosh-01',
        currentUser: ADMIN_USER,
        entityType: 'GOODS_RECEIPT',
        getRecordId: (g) => g.id,
        getDocumentNumber: (g) => g.grnNumber,
        getCompanyId: (g) => g.companyId,
        getBranchId: (g) => g.branchId,
        getFinancialYearId: (g) => g.financialYearId,
        getFinancialYearCode: (g) => g.financialYearCode,
        getAccountingPostingDate: (g) => g.accountingPostingDate,
        getDocumentDate: (g) => g.receiptDate,
      })
      .filteredRecords.some((g) => g.grnNumber === 'GRN-2025-0061')
  );

  assert.ok(
    financialYearService
      .filterTransactionsByFinancialYear({
        records: invs,
        selectedFyId: 'fy-co-kosh-01-2025-26',
        companyId: 'co-kosh-01',
        currentUser: ADMIN_USER,
        entityType: 'SUPPLIER_INVOICE',
        getRecordId: (i) => i.id,
        getDocumentNumber: (i) => i.internalInvoiceNumber,
        getCompanyId: (i) => i.companyId,
        getBranchId: (i) => i.branchId,
        getFinancialYearId: (i) => i.financialYearId,
        getFinancialYearCode: (i) => i.financialYearCode,
        getAccountingPostingDate: (i) => i.accountingPostingDate,
        getDocumentDate: (i) => i.invoiceDate,
      })
      .filteredRecords.some((i) => i.internalInvoiceNumber === 'INV-REG-2025-0088')
  );

  // 4. Historical Read-Only Mutation Guard rejects edits/approvals on closed FY records even for Platform Admin
  const prHist = prs.find((p) => p.prNumber === 'PR-2025-0142')!;
  const guard = financialYearService.evaluateHistoricalRecordMutationGuard({
    companyId: prHist.companyId,
    financialYearId: prHist.financialYearId,
    accountingPostingDate: prHist.accountingPostingDate,
    documentDate: prHist.documentDate,
    actionLabel: 'Amend PR Quantity',
  });
  assert.equal(guard.allowed, false);
  assert.match(guard.reason || '', /Read-Only Lock|CLOSED/i);
});
