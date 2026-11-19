import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toMinorUnits,
  fromMinorUnits,
  calculateInventoryPrFinancials,
  calculateExpenseLineAmounts,
  calculateExpensePrFinancials,
} from '../services/prFinancialCalculator';
import { expenseCategoryService } from '../services/expenseCategoryService';
import { costCentreMasterService } from '../services/costCentreMasterService';
import { prTypeMasterService } from '../services/prTypeMasterService';
import { chargeMasterService } from '../services/chargeMasterService';
import { chargeMappingService } from '../services/chargeMappingService';
import { prChargeItemService } from '../services/prChargeItemService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { sapB1IntegrationService } from '../services/sapB1IntegrationService';
import { defaultPrGovernanceBackend } from '../../server/src/services/prGovernanceBackend';
import { defaultChargeEngineBackend } from '../../server/src/services/chargeEngineBackend';
import { User } from '../types';

const TEST_ADMIN_USER: User = {
  id: 'USR-ADMIN-01',
  fullName: 'Rajesh Sharma',
  email: 'rajesh@kosh.in',
  role: 'PLATFORM_ADMIN',
  orgId: 'co-kosh-01',
  department: 'Procurement',
  allowedBranchIds: ['br-pond-01', 'br-hosur-02'],
  isGlobalScope: true,
  twoFactorEnabled: false,
};

test('1. Decimal-safe integer minor-unit financial calculator for Inventory PR & Expense PR', () => {
  assert.equal(toMinorUnits(19.99, 'INR'), 1999);
  assert.equal(fromMinorUnits(1999, 'INR'), 19.99);

  // Tax-exclusive vs tax-inclusive expense line calculation
  const excl = calculateExpenseLineAmounts({
    amount: 10000,
    taxRatePercent: 18,
    taxInclusive: false,
    currency: 'INR',
  });
  assert.equal(excl.baseAmount, 10000);
  assert.equal(excl.taxAmount, 1800);
  assert.equal(excl.totalWithTax, 11800);

  const incl = calculateExpenseLineAmounts({
    amount: 11800,
    taxRatePercent: 18,
    taxInclusive: true,
    currency: 'INR',
  });
  assert.equal(incl.baseAmount, 10000);
  assert.equal(incl.taxAmount, 1800);
  assert.equal(incl.totalWithTax, 11800);

  // Inventory PR landed value formula:
  // Inventory Subtotal + Inventory Tax + Header Charges + Line Charges + Applicable Charge Tax = Total Landed PR Value
  const invFin = calculateInventoryPrFinancials({
    currency: 'INR',
    lines: [
      {
        requestedQuantity: 100,
        approximateUnitPrice: 250,
        taxRatePercent: 0,
        lineCharges: [
          {
            id: 'LC-1',
            chargeCode: 'CHG-UNLOAD',
            chargeName: 'Unloading Charges',
            category: 'HANDLING',
            applicability: 'APPLICABLE',
            chargeType: 'FIXED',
            calculationMethod: 'FIXED_AMOUNT',
            calculationBasis: 'LINE_AMOUNT',
            rateOrPercentage: 1500,
            estimatedAmount: 1500,
            gstRatePercent: 18,
            taxAmount: 270,
            totalWithTax: 1770,
          },
        ],
      },
    ],
    headerCharges: [
      {
        id: 'HC-1',
        chargeCode: 'CHG-FREIGHT',
        chargeName: 'Freight Charges',
        category: 'LOGISTICS',
        applicability: 'APPLICABLE',
        chargeType: 'FIXED',
        calculationMethod: 'FIXED_AMOUNT',
        calculationBasis: 'PR_TOTAL',
        rateOrPercentage: 3500,
        estimatedAmount: 3500,
        gstRatePercent: 5,
        taxAmount: 175,
        totalWithTax: 3675,
      },
    ],
  });

  assert.equal(invFin.inventorySubtotal, 25000);
  assert.equal(invFin.headerChargesBaseTotal, 3500);
  assert.equal(invFin.lineChargesBaseTotal, 1500);
  assert.equal(invFin.applicableChargesBaseTotal, 5000);
  assert.equal(invFin.applicableChargeTaxTotal, 445);
  assert.equal(invFin.totalLandedPrValue, 30445);

  const expFin = calculateExpensePrFinancials([
    { amount: 20000, taxPercent: 18, isTaxInclusive: false },
    { amount: 11800, taxPercent: 18, isTaxInclusive: true },
  ]);
  assert.equal(expFin.expenseBaseTotal, 30000);
  assert.equal(expFin.expenseTaxTotal, 5400);
  assert.equal(expFin.totalExpensePrValue, 35400);
});

test('2. Mandatory Classification Rule & Conflict Detection (Charge Item vs EXPENSE PR)', () => {
  // Independent expense disguised as Charge Item on Inventory PR -> blocked
  const conflictCharge = expenseCategoryService.detectClassificationConflict({
    mechanism: 'INVENTORY_CHARGE_ITEM',
    code: 'EXP-LEGAL',
    description: 'Corporate Legal Retainer & Advisory Fee',
  });
  assert.equal(conflictCharge.conflict, true);
  assert.ok(conflictCharge.reason.includes('Independent expense/service = EXPENSE PR'));

  // Inventory-linked charge disguised as EXPENSE PR line -> blocked
  const conflictExpense = expenseCategoryService.detectClassificationConflict({
    mechanism: 'EXPENSE_PR_LINE',
    code: 'CHG-CUSTOMS',
    description: 'Customs Duty & Port Clearance Charges for imported material',
  });
  assert.equal(conflictExpense.conflict, true);
  assert.ok(conflictExpense.reason.includes('Inventory-linked expense = Charge Item'));
});

test('3. PR Type Master EXPENSE registration, readiness gate, and Expense Category SAP GL resolution', () => {
  prTypeMasterService.resetForTests(true);
  expenseCategoryService.resetToDefaults();

  const prTypes = prTypeMasterService.getPrTypes();
  const expenseType = prTypes.find((t) => t.code === 'EXPENSE');
  assert.ok(expenseType, 'EXPENSE PR Type must exist in PR Type Master');
  assert.equal(expenseType.isExpenseType, true);
  assert.equal(expenseType.applicableMechanism, 'EXPENSE');
  assert.equal(expenseType.status, 'ACTIVE');
  assert.equal(expenseType.approvalStatus, 'APPROVED');

  const readiness = expenseCategoryService.checkExpensePrReadiness('COMP-001', 'BR-001');
  assert.equal(readiness.ready, true);
  assert.ok(readiness.activeCategoryMappingsCount >= 10);
  assert.ok(readiness.activeSapGlMappingsCount >= 10);

  const eligibleCats = expenseCategoryService.getEligibleExpenseCategories('COMP-001', 'BR-001');
  assert.ok(eligibleCats.length >= 10);
  assert.ok(eligibleCats.every((c) => Boolean(c.sapGlAccountCode)));
});

test('4. Charge Master SAP Expense/GL fields, Approval Status gate, and PR Type filtering', () => {
  chargeMasterService.resetForTesting();
  chargeMappingService.resetForTesting();

  // Create a DRAFT charge master -> must NOT appear in effective PR charge options
  const draftCharge = chargeMasterService.createCharge(
    {
      chargeCode: 'CHG-TEST-DRAFT',
      chargeName: 'Unapproved Test Charge',
      chargeDescription: 'Draft charge for testing approval status filter',
      chargeCategory: 'OTHER',
      defaultApplicationLevel: 'PR_HEADER',
      permittedApplicationLevels: ['PR_HEADER', 'PR_LINE'],
      defaultCalculationMethod: 'FIXED_AMOUNT',
      defaultCalculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
      defaultRate: 500,
      applicabilityRule: 'OPTIONAL',
      defaultCurrency: 'INR',
      defaultTaxMappingId: 'tax-gst-18-itc',
      defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
      defaultAllocationBasis: 'PROPORTIONAL_VALUE',
      chargeBearer: 'BUYER',
      recoverability: 'RECOVERABLE_INPUT_CREDIT',
      roundingRule: 'HALF_UP',
      decimalPrecision: 2,
      calculationSequence: 99,
      effectiveFrom: '2025-01-01',
      isActive: true,
      applicablePrTypes: ['MANUAL'],
      sapExpenseCode: 'SAP-EXPD-99',
      sapGlAccountCode: '519900',
      taxCode: 'DOM-GST-18',
      approvalStatus: 'DRAFT',
      createdBy: 'Tester',
      modifiedBy: 'Tester',
    },
    { id: TEST_ADMIN_USER.id, name: TEST_ADMIN_USER.fullName, user: TEST_ADMIN_USER }
  );
  chargeMappingService.saveCompanyChargeMapping(
    {
      companyId: 'co-kosh-01',
      chargeMasterId: draftCharge.id,
      isEnabled: true,
      applicability: 'OPTIONAL',
      defaultCalculationMethod: 'FIXED_AMOUNT',
      calculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
      fixedTariffOrRate: 500,
      currency: 'INR',
      taxMappingId: 'tax-gst-18-itc',
      taxTreatment: 'DOMESTIC_GST_TAXABLE',
      taxRatePercent: 18,
      allocationBasis: 'PROPORTIONAL_VALUE',
      effectiveFrom: '2025-01-01',
      allowBranchOverride: true,
      centrallyControlledFields: [],
      requiresApproval: false,
      approvalStatus: 'DRAFT',
    },
    { id: TEST_ADMIN_USER.id, name: TEST_ADMIN_USER.fullName, user: TEST_ADMIN_USER }
  );

  const manualOptions = chargeMappingService.getEffectivePrChargeOptions('COMP-001', 'BR-001', {
    prType: 'MANUAL',
  });
  assert.equal(
    manualOptions.some((o) => o.chargeCode === 'CHG-TEST-DRAFT'),
    false,
    'Unapproved DRAFT Charge Master must never appear in PR Charge options'
  );
  assert.ok(
    manualOptions.every((o) => Boolean(o.sapExpenseCode) && Boolean(o.sapGlAccountCode)),
    'Approved charges must carry SAP Expense Code and SAP GL Account Code'
  );

  // EXPENSE PR Type must return zero Charge Item options
  const expenseChargeOptions = prChargeItemService.getEffectiveMappedChargesForPR(
    'COMP-001',
    'BR-001',
    { prType: 'EXPENSE' }
  );
  assert.equal(expenseChargeOptions.length, 0, 'EXPENSE PR must not expose Inventory Charge Items');
});

test('5. Header vs Line Duplicate Charge Governance Block', () => {
  const headerCharges = [
    {
      id: 'HC-DUP',
      chargeCode: 'CHG-LOAD',
      chargeName: 'Loading Charges',
      category: 'HANDLING' as const,
      applicability: 'APPLICABLE' as const,
      chargeType: 'FIXED' as const,
      rateOrPercentage: 1000,
      estimatedAmount: 1000,
    },
  ];
  const linesWithSameCharge = [
    {
      itemCode: 'RMPAOPOEXLG0004',
      lineCharges: [
        {
          id: 'LC-DUP',
          chargeCode: 'CHG-LOAD',
          chargeName: 'Loading Charges',
          category: 'HANDLING' as const,
          applicability: 'APPLICABLE' as const,
          chargeType: 'FIXED' as const,
          rateOrPercentage: 500,
          estimatedAmount: 500,
        },
      ],
    },
  ];

  const blocked = prChargeItemService.validateHeaderAndLineChargeDuplicates(
    headerCharges,
    linesWithSameCharge,
    false
  );
  assert.equal(blocked.valid, false);
  assert.equal(blocked.duplicateChargeCodes.includes('CHG-LOAD'), true);

  const allowedWhenPolicyOn = prChargeItemService.validateHeaderAndLineChargeDuplicates(
    headerCharges,
    linesWithSameCharge,
    true
  );
  assert.equal(allowedWhenPolicyOn.valid, true);
});

test('6. End-to-End EXPENSE PR Creation, Strict Separation Enforcement, and Approval', () => {
  // Reject EXPENSE PR if inventory lines or Charge Items are attached
  assert.throws(() => {
    PurchaseRequisitionService.createPR(
      {
        companyId: 'co-kosh-01',
        companyCode: 'KOSH-HQ',
        branchId: 'br-pond-01',
        branchCode: '001',
        branchName: 'Pondicherry Main Plant & HQ',
        department: 'Finance',
        costCentre: 'CC-FIN-100',
        currency: 'INR',
        requesterId: TEST_ADMIN_USER.id,
        requesterName: TEST_ADMIN_USER.fullName,
        creatorId: TEST_ADMIN_USER.id,
        creatorName: TEST_ADMIN_USER.fullName,
        prType: 'EXPENSE',
        priority: 'NORMAL',
        status: 'DRAFT',
        requiredBy: '2026-12-15',
        purchasePurpose: 'Bad mixed expense PR',
        businessJustification: 'Testing mixed lines block',
        deliveryLocation: 'Pondicherry HQ',
        budgetValidationStatus: 'NOT_VALIDATED',
        erpStockStatus: 'CHECKED',
        estimatedTotalValue: 10000,
        lines: [
          {
            id: 'L1',
            prId: '',
            itemCode: 'RMPAOPOEXLG0004',
            description: 'Inventory Item',
            itemCategory: 'RM',
            inventoryUom: 'KG',
            requestedQuantity: 10,
            approximateUnitPrice: 100,
            currency: 'INR',
            estimatedTotalValue: 1000,
            deliverySchedules: [{ id: 'S1', lineId: 'L1', deliveryDate: '2026-12-15', quantity: 10 }],
            defaultWarehouse: 'WH-RM-01',
            purchasePurpose: 'Test',
            businessJustification: 'Test',
            assignedBuyer: 'Default',
            status: 'ACTIVE',
          },
        ],
        expenseLines: [
          expenseCategoryService.buildExpensePrLine({
            companyId: 'COMP-001',
            branchId: 'BR-001',
            expenseCategoryCode: 'EXP-AUDIT',
            description: 'Statutory Audit FY26',
            costCentre: 'CC-FIN-100',
            expectedServiceDate: '2026-12-15',
            amount: 50000,
            taxRatePercent: 18,
            purchasePurpose: 'Annual statutory audit',
            businessJustification: 'Required under Companies Act',
          }),
        ],
        changeHistory: [],
        attachments: [],
      },
      TEST_ADMIN_USER
    );
  }, /Inventory|EXPENSE/i);

  // Create valid EXPENSE PR with automatic Cost Centre determination and Service From / To Dates
  const expLine = expenseCategoryService.buildExpensePrLine({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    expenseCategoryCode: 'EXP-CONS',
    description: 'SAP HANA Process Optimization Consultancy',
    serviceFromDate: '2026-12-01',
    serviceToDate: '2026-12-20',
    amount: 40000,
    taxRatePercent: 18,
    taxInclusive: false,
    vendorSuggestion: 'Deloitte Touche Consulting',
    purchasePurpose: 'Plant Digital Supply Chain Advisory',
    businessJustification: 'Optimize procurement cycle SLA across branches',
  });

  const createdExpPr = PurchaseRequisitionService.createPR(
    {
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Pondicherry Main Plant & HQ',
      department: 'Production & Plant Operations',
      costCentre: expLine.costCentre,
      currency: 'INR',
      requesterId: TEST_ADMIN_USER.id,
      requesterName: TEST_ADMIN_USER.fullName,
      creatorId: TEST_ADMIN_USER.id,
      creatorName: TEST_ADMIN_USER.fullName,
      prType: 'EXPENSE',
      priority: 'NORMAL',
      status: 'DRAFT',
      requiredBy: '2026-12-20',
      expectedDeliveryDate: '2026-12-20',
      purchasePurpose: 'Plant Digital Supply Chain Advisory',
      businessJustification: 'Optimize procurement cycle SLA across branches',
      deliveryLocation: 'Pondicherry Main Plant & HQ',
      budgetValidationStatus: 'NOT_VALIDATED',
      erpStockStatus: 'CHECKED',
      estimatedTotalValue: 40000,
      lines: [],
      expenseLines: [expLine],
      changeHistory: [],
      attachments: [],
    },
    TEST_ADMIN_USER
  );

  assert.equal(createdExpPr.prType, 'EXPENSE');
  assert.equal(createdExpPr.procurementMechanism, 'EXPENSE');
  assert.equal(createdExpPr.lines.length, 0);
  assert.equal(createdExpPr.expenseLines?.length, 1);
  assert.equal(createdExpPr.expenseLines?.[0]?.serviceFromDate, '2026-12-01');
  assert.equal(createdExpPr.expenseLines?.[0]?.serviceToDate, '2026-12-20');
  assert.equal(createdExpPr.expenseLines?.[0]?.costCentre, 'CC-PROD-101');
  assert.equal(createdExpPr.expenseSubtotal, 40000);
  assert.equal(createdExpPr.expenseTaxTotal, 7200);
  assert.equal(createdExpPr.grandTotalWithCharges, 47200);
});

test('7. SAP Business One 10.0 HANA Service Layer Payload Generation & Reconciliation Guard', () => {
  sapB1IntegrationService.resetTraces();

  const expLine = expenseCategoryService.buildExpensePrLine({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    expenseCategoryCode: 'EXP-LEGAL',
    description: 'Patent & Trademark Filing Legal Services',
    serviceFromDate: '2026-12-05',
    serviceToDate: '2026-12-22',
    amount: 25000,
    taxRatePercent: 18,
    purchasePurpose: 'IP protection filing',
    businessJustification: 'Protect proprietary Kosh polymer formulation',
  });

  const expPr = PurchaseRequisitionService.createPR(
    {
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Pondicherry Main Plant & HQ',
      department: 'Production & Plant Operations',
      costCentre: expLine.costCentre,
      currency: 'INR',
      requesterId: TEST_ADMIN_USER.id,
      requesterName: TEST_ADMIN_USER.fullName,
      creatorId: TEST_ADMIN_USER.id,
      creatorName: TEST_ADMIN_USER.fullName,
      prType: 'EXPENSE',
      priority: 'NORMAL',
      status: 'APPROVED_PENDING_BUYER',
      requiredBy: '2026-12-22',
      expectedDeliveryDate: '2026-12-22',
      purchasePurpose: 'IP protection filing',
      businessJustification: 'Protect proprietary Kosh polymer formulation',
      deliveryLocation: 'Pondicherry Main Plant & HQ',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'CHECKED',
      estimatedTotalValue: 25000,
      lines: [],
      expenseLines: [expLine],
      changeHistory: [],
      attachments: [],
    },
    TEST_ADMIN_USER
  );

  // Verify SAP Service Layer payload for EXPENSE PR uses dDocument_Service, GL AccountCode, U_KoshServiceFromDate, U_KoshServiceToDate, and CostingCode without ItemCode
  const sapExpPayload = sapB1IntegrationService.buildSapPurchaseRequestPayload(expPr);
  assert.equal(sapExpPayload.DocType, 'dDocument_Service');
  assert.equal(sapExpPayload.DocumentLines.length, 1);
  const firstDocLine = sapExpPayload.DocumentLines[0] as any;
  assert.equal(firstDocLine.AccountCode, '610200');
  assert.equal(firstDocLine.CostingCode, 'CC-PROD-101');
  assert.equal(firstDocLine.U_KoshServiceFromDate, '2026-12-05');
  assert.equal(firstDocLine.U_KoshServiceToDate, '2026-12-22');
  assert.equal(firstDocLine.RequiredDate, '2026-12-22');
  assert.equal('ItemCode' in firstDocLine, false);

  // Simulate ambiguous Service Layer timeout -> status becomes REQUIRES_RECONCILIATION
  const timeoutRes = sapB1IntegrationService.postPrToSapServiceLayer(expPr, {
    actorName: TEST_ADMIN_USER.fullName,
    simulateMode: 'TIMEOUT_AMBIGUOUS',
  });
  assert.equal(timeoutRes.success, false);
  assert.equal(timeoutRes.trace.status, 'REQUIRES_RECONCILIATION');

  // Blind retry MUST be blocked while REQUIRES_RECONCILIATION is active
  const blockedRetry = sapB1IntegrationService.postPrToSapServiceLayer(expPr, {
    actorName: TEST_ADMIN_USER.fullName,
  });
  assert.equal(blockedRetry.success, false);
  assert.equal(blockedRetry.blockedByReconciliationGuard, true);

  // Reconcile state -> allow retry -> post succeeds and becomes INTEGRATED
  const reconciled = sapB1IntegrationService.reconcileSapIntegrationState({
    prId: expPr.id,
    prNumber: expPr.prNumber,
    resolution: 'CONFIRM_NOT_POSTED_ALLOW_RETRY',
    actorName: TEST_ADMIN_USER.fullName,
    remarks: 'Confirmed no orphan SAP PR exists in OPRQ via Service Layer.',
  });
  assert.equal(reconciled.success, true);

  const successPost = sapB1IntegrationService.postPrToSapServiceLayer(expPr, {
    actorName: TEST_ADMIN_USER.fullName,
  });
  assert.equal(successPost.success, true);
  assert.equal(successPost.trace.status, 'INTEGRATED');
  assert.ok(successPost.trace.sapPrDocEntry);
});

test('8. Backend Governance & Charge Engine Parity for EXPENSE PR and Header/Line Duplicate Charge Guard', () => {
  // Backend Charge Engine marks 0 charges effective for EXPENSE PR Type
  const backendExpenseCharges = defaultChargeEngineBackend
    .resolveEffectiveMappings('co-kosh-01', 'br-pond-01', undefined, 'EXPENSE')
    .filter((c) => c.isEffectiveNow);
  assert.equal(backendExpenseCharges.length, 0);

  // Backend PR Governance validates EXPENSE PR with valid expense lines including serviceFromDate & serviceToDate
  const backendVal = defaultPrGovernanceBackend.validatePr({
    action: 'SUBMIT',
    pr: {
      id: 'PR-EXP-BACKEND-1',
      prNumber: 'PR-2026-9901',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      prType: 'EXPENSE',
      department: 'Production & Plant Operations',
      costCentre: 'CC-PROD-101',
      currency: 'INR',
      estimatedTotalValue: 30000,
      grandTotalWithCharges: 35400,
      lines: [],
      expenseLines: [
        {
          id: 'EL-1',
          expenseCategoryCode: 'EXP-CONS',
          expenseDescription: 'Management Advisory Service',
          costCentre: 'CC-PROD-101',
          serviceFromDate: '2026-12-01',
          serviceToDate: '2026-12-20',
          amount: 30000,
          taxPercent: 18,
          purchasePurpose: 'Process audit',
          businessJustification: 'ISO compliance readiness',
          sapGlAccountCode: '610100',
        },
      ],
    },
    actorUser: {
      id: TEST_ADMIN_USER.id,
      role: TEST_ADMIN_USER.role,
    },
  });
  assert.equal(backendVal.allowed, true);
  assert.equal(backendVal.errors.length, 0);
});

test('9. Service From Date and Service To Date Mandatory Validation (Service To Date >= Service From Date)', () => {
  // 1. Missing Service From Date or Service To Date must fail validation
  const missingDatesVal = expenseCategoryService.validateExpenseLinesForPr({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    expenseLines: [
      {
        expenseCategoryCode: 'EXP-CONS',
        expenseDescription: 'IT Governance Advisory',
        serviceFromDate: '',
        serviceToDate: '',
        amount: 20000,
        purchasePurpose: 'Governance audit',
        businessJustification: 'Compliance requirement',
      },
    ],
  });
  assert.equal(missingDatesVal.valid, false);
  assert.ok(missingDatesVal.errors.some((e) => /Service From Date is mandatory/i.test(e)));
  assert.ok(missingDatesVal.errors.some((e) => /Service To Date is mandatory/i.test(e)));

  // 2. Service To Date earlier than Service From Date must fail validation in frontend & backend
  const invertedDatesVal = expenseCategoryService.validateExpenseLinesForPr({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    expenseLines: [
      {
        expenseCategoryCode: 'EXP-CONS',
        expenseDescription: 'IT Governance Advisory',
        serviceFromDate: '2026-12-25',
        serviceToDate: '2026-12-10',
        amount: 20000,
        purchasePurpose: 'Governance audit',
        businessJustification: 'Compliance requirement',
      },
    ],
  });
  assert.equal(invertedDatesVal.valid, false);
  assert.ok(
    invertedDatesVal.errors.some((e) =>
      /Service To Date.*cannot be earlier than Service From Date/i.test(e)
    )
  );

  const backendInvertedVal = defaultPrGovernanceBackend.validatePr({
    action: 'SUBMIT',
    pr: {
      id: 'PR-EXP-DATE-ERR',
      prNumber: 'PR-2026-9902',
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      prType: 'EXPENSE',
      department: 'Production & Plant Operations',
      costCentre: 'CC-PROD-101',
      lines: [],
      expenseLines: [
        {
          id: 'EL-ERR-1',
          expenseCategoryCode: 'EXP-CONS',
          expenseDescription: 'IT Governance Advisory',
          costCentre: 'CC-PROD-101',
          serviceFromDate: '2026-12-25',
          serviceToDate: '2026-12-10',
          amount: 20000,
          purchasePurpose: 'Governance audit',
          businessJustification: 'Compliance requirement',
        },
      ],
    },
  });
  assert.equal(backendInvertedVal.allowed, false);
  assert.ok(
    backendInvertedVal.errors.some((e) =>
      /Service To Date.*cannot be earlier than Service From Date/i.test(e)
    )
  );
});

test('10. Automatic Cost Centre Determination: Single Mapping, Multiple Cost Centres Selection, and Employee Default Priority', () => {
  // 1. Multiple Cost Centres mapped to Pondicherry -> Production & Plant Operations (3 valid Cost Centres)
  const multiDetermination = costCentreMasterService.resolveCostCentresForContext({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    userId: 'usr-maker-02',
  });
  assert.equal(multiDetermination.valid, true);
  assert.equal(multiDetermination.eligibleCostCentres.length, 3);
  assert.deepEqual(
    multiDetermination.eligibleCostCentres.map((c) => c.code),
    ['CC-PROD-01', 'CC-PROD-101', 'CC-IT-01']
  );
  // Employee default for usr-maker-02 is CC-PROD-01
  assert.equal(multiDetermination.defaultCostCentreCode, 'CC-PROD-01');
  assert.equal(multiDetermination.resolutionSource, 'EMPLOYEE_DEFAULT');

  // 2. Selecting another valid Cost Centre (CC-IT-01) from the mapped dropdown is accepted and preserved
  const selectedSecondCcVal = expenseCategoryService.validateExpenseLinesForPr({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Production & Plant Operations',
    userId: 'usr-maker-02',
    expenseLines: [
      {
        expenseCategoryCode: 'EXP-TRAIN',
        expenseDescription: 'CNC Operator Safety Training Program',
        costCentre: 'CC-IT-01',
        serviceFromDate: '2026-12-01',
        serviceToDate: '2026-12-05',
        amount: 35000,
        purchasePurpose: 'Shopfloor safety certification',
        businessJustification: 'Annual ISO 45001 training compliance',
      },
    ],
  });
  assert.equal(selectedSecondCcVal.valid, true);
  assert.equal(selectedSecondCcVal.normalizedLines[0].costCentre, 'CC-IT-01');

  // 3. Employee default Cost Centre priority for Central Inventory & Stores user usr-buyer-01 (default: CC-PROC-02)
  const buyerDetermination = costCentreMasterService.resolveCostCentresForContext({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Central Inventory & Stores',
    userId: 'usr-buyer-01',
  });
  assert.equal(buyerDetermination.valid, true);
  assert.equal(buyerDetermination.defaultCostCentreCode, 'CC-PROC-02');
  assert.equal(buyerDetermination.resolutionSource, 'EMPLOYEE_DEFAULT');

  // 4. Single Cost Centre mapped to Quality Assurance & Metallurgy (CC-QA-301)
  const singleDetermination = costCentreMasterService.resolveCostCentresForContext({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Quality Assurance & Metallurgy',
  });
  assert.equal(singleDetermination.valid, true);
  assert.equal(singleDetermination.eligibleCostCentres.length, 1);
  assert.equal(singleDetermination.defaultCostCentreCode, 'CC-QA-301');
});

test('11. Missing Cost Centre Mapping Scenario Blocks Submission and Never Assumes or Creates a Fallback Cost Centre', () => {
  const unmappedDetermination = costCentreMasterService.resolveCostCentresForContext({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Unmapped Experimental Aerospace Division',
  });
  assert.equal(unmappedDetermination.valid, false);
  assert.equal(unmappedDetermination.eligibleCostCentres.length, 0);
  assert.equal(unmappedDetermination.defaultCostCentreCode, '');
  assert.equal(unmappedDetermination.resolutionSource, 'NONE_MAPPED');
  assert.match(unmappedDetermination.validationMessage || '', /No valid Cost Centre mapping exists/i);

  // Validation must fail and never assume a fallback Cost Centre
  const unmappedLineVal = expenseCategoryService.validateExpenseLinesForPr({
    companyId: 'co-kosh-01',
    branchId: 'br-pond-01',
    department: 'Unmapped Experimental Aerospace Division',
    expenseLines: [
      {
        expenseCategoryCode: 'EXP-CONS',
        expenseDescription: 'Aerospace Feasibility Study',
        serviceFromDate: '2026-12-01',
        serviceToDate: '2026-12-15',
        amount: 60000,
        purchasePurpose: 'Feasibility study',
        businessJustification: 'Board exploratory mandate',
      },
    ],
  });
  assert.equal(unmappedLineVal.valid, false);
  assert.equal(unmappedLineVal.normalizedLines[0].costCentre, '');
  assert.ok(
    unmappedLineVal.errors.some((e) => /No valid Cost Centre mapping exists/i.test(e))
  );
});
