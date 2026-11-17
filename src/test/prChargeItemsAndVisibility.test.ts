import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewPrGovernancePolicyStrip } from '../services/prGovernancePolicyService';
import {
  prChargeItemService,
  formatChargeAmount,
  getCurrencySymbol,
} from '../services/prChargeItemService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import {
  generatePurchaseRequisitionPdf,
  clearImmutablePrPdfRepositoryForTests,
} from '../services/prPdfExportService';
import { INITIAL_USERS } from '../data/seedData';
import { PRChargeItem, PurchaseRequisitionHeader } from '../types/purchaseRequisition';

// Mock localStorage for node environment
if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] || null,
    length: storage.size,
  } as Storage;
}

test('canViewPrGovernancePolicyStrip restricts visibility strictly to Admin roles', () => {
  assert.equal(canViewPrGovernancePolicyStrip('PLATFORM_ADMIN'), true);
  assert.equal(canViewPrGovernancePolicyStrip('ORG_ADMIN'), true);
  assert.equal(canViewPrGovernancePolicyStrip({ role: 'PLATFORM_ADMIN' }), true);
  assert.equal(canViewPrGovernancePolicyStrip({ role: 'ORG_ADMIN' }), true);

  assert.equal(canViewPrGovernancePolicyStrip('ITEM_MAKER'), false);
  assert.equal(canViewPrGovernancePolicyStrip('ITEM_CHECKER'), false);
  assert.equal(canViewPrGovernancePolicyStrip('BRANCH_COORDINATOR'), false);
  assert.equal(canViewPrGovernancePolicyStrip('MASTER_DATA_AUDITOR'), false);
  assert.equal(canViewPrGovernancePolicyStrip('INTEGRATION_SERVICE_ACCOUNT'), false);
  assert.equal(canViewPrGovernancePolicyStrip('READ_ONLY_USER'), false);
  assert.equal(canViewPrGovernancePolicyStrip({ role: 'ITEM_MAKER' }), false);
  assert.equal(canViewPrGovernancePolicyStrip(null), false);
  assert.equal(canViewPrGovernancePolicyStrip(undefined), false);
});

test('prChargeItemService calculates Applicable, Fixed Charges, and Exempt charge items accurately', () => {
  const defaults = prChargeItemService.getDefaultChargeItems('INR', 100000);
  assert.ok(defaults.length >= 10, 'Should provide standard charge items including Loading, Unloading, Customs Duty, Freight');

  const loading = defaults.find((c: PRChargeItem) => c.chargeCode === 'CHG-LOAD');
  const unloading = defaults.find((c: PRChargeItem) => c.chargeCode === 'CHG-UNLOAD');
  const customs = defaults.find((c: PRChargeItem) => c.chargeCode === 'CHG-CUSTOMS');
  const inspection = defaults.find((c: PRChargeItem) => c.chargeCode === 'CHG-INSPECTION');

  assert.ok(loading && unloading && customs && inspection);
  assert.equal(loading.applicability, 'AS_PER_FIXED_CHARGES');
  assert.equal(loading.estimatedAmount, 1500);
  assert.equal(loading.taxAmount, 270); // 18% of 1500
  assert.equal(loading.totalWithTax, 1770);

  assert.equal(customs.applicability, 'APPLICABLE');
  assert.equal(customs.chargeType, 'PERCENTAGE');
  assert.equal(customs.estimatedAmount, 10000); // 10% of 100,000
  assert.equal(customs.taxAmount, 0);

  assert.equal(inspection.applicability, 'NOT_APPLICABLE');
  assert.equal(inspection.estimatedAmount, 0);
  assert.equal(inspection.totalWithTax, 0);

  // Switch Customs to custom Applicable FIXED 12500 and toggle Loading to NOT_APPLICABLE
  const customUpdated = prChargeItemService.calculateChargeItem(
    { ...customs, applicability: 'APPLICABLE', chargeType: 'FIXED', rateOrPercentage: 12500 },
    100000
  );
  assert.equal(customUpdated.estimatedAmount, 12500);
  assert.equal(customUpdated.isFixedChargeRule, false);

  const loadingExempt = prChargeItemService.calculateChargeItem(
    { ...loading, applicability: 'NOT_APPLICABLE' },
    100000
  );
  assert.equal(loadingExempt.estimatedAmount, 0);
  assert.equal(loadingExempt.totalWithTax, 0);

  // Reset Loading back to Fixed Tariff
  const loadingRestored = prChargeItemService.resetToFixedTariff(loadingExempt, 100000);
  assert.equal(loadingRestored.applicability, 'AS_PER_FIXED_CHARGES');
  assert.equal(loadingRestored.isFixedChargeRule, true);
  assert.equal(loadingRestored.estimatedAmount, 1500);

  // Create custom charge item and verify currency recalculation
  const customItem = prChargeItemService.createCustomChargeItem(
    {
      chargeName: 'Special Crane Rigging',
      category: 'HANDLING',
      applicability: 'APPLICABLE',
      chargeType: 'AT_ACTUALS',
      rateOrPercentage: 8000,
      gstRatePercent: 18,
    },
    100000,
    'INR'
  );
  assert.equal(customItem.estimatedAmount, 8000);
  assert.equal(customItem.taxAmount, 1440);
  assert.equal(customItem.totalWithTax, 9440);

  const recalculatedUsd = prChargeItemService.recalculateAllCharges(
    [loadingRestored, loadingExempt, customItem],
    200000,
    'USD'
  );
  assert.equal(recalculatedUsd.every((c: PRChargeItem) => c.currency === 'USD'), true);

  const summary = prChargeItemService.calculateRequisitionChargesSummary(
    [loadingRestored, loadingExempt, customItem],
    100000
  );
  assert.equal(summary.applicableChargesCount, 2);
  assert.equal(summary.applicableChargesBaseTotal, 9500); // 1500 + 8000
  assert.equal(summary.applicableChargesTaxTotal, 1710); // 270 + 1440
  assert.equal(summary.grandTotalWithCharges, 109500);
});

test('formatChargeAmount and getCurrencySymbol format multi-currency charges cleanly', () => {
  assert.equal(getCurrencySymbol('INR'), '₹');
  assert.equal(getCurrencySymbol('USD'), '$');
  assert.equal(getCurrencySymbol('EUR'), '€');
  assert.equal(getCurrencySymbol('GBP'), '£');
  assert.equal(formatChargeAmount(1500, 'USD'), '$1,500');
  assert.equal(formatChargeAmount(1500, 'INR'), '₹1,500');
});

test('PurchaseRequisitionService createPR and updatePR recalculate and persist chargeItems and landed totals', () => {
  const maker = INITIAL_USERS.find((u) => u.role === 'ITEM_MAKER') || INITIAL_USERS[0];
  const initialCharges = prChargeItemService.getDefaultChargeItems('INR', 60000);

  const created = PurchaseRequisitionService.createPR(
    {
      prType: 'MANUAL',
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Puducherry Main Plant & HQ',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: maker.id,
      requesterName: maker.fullName,
      creatorId: maker.id,
      creatorName: maker.fullName,
      priority: 'NORMAL',
      status: 'DRAFT',
      purchasePurpose: 'Charge Items Persistence Check',
      businessJustification: 'Verify loading, unloading, and customs charges persist',
      deliveryLocation: 'Puducherry Plant',
      estimatedTotalValue: 60000,
      chargeItems: initialCharges,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [
        {
          id: 'line-chg-1',
          prId: '',
          itemCode: 'RMPAOPOEXLG0004',
          description: 'PC-ABS - Injection Grade V0',
          itemCategory: 'Raw Materials',
          inventoryUom: 'KG',
          requestedQuantity: 400,
          approximateUnitPrice: 150,
          currency: 'INR',
          estimatedTotalValue: 60000,
          deliverySchedules: [
            { id: 'sch-chg-1', lineId: 'line-chg-1', deliveryDate: '2026-12-01', quantity: 400 },
          ],
          status: 'ACTIVE',
        },
      ],
      changeHistory: [],
      attachments: [],
    },
    maker
  );

  assert.ok(created.chargeItems && created.chargeItems.length >= 10);
  // Default active base charges for 60,000 items:
  // LOAD: 1500 + UNLOAD: 1500 + CUSTOMS (10% of 60000 = 6000) + FREIGHT: 4500 + INSURANCE (0.25% of 60000 = 150) + PACKAGING: 2000 = 15650
  assert.equal(created.chargesTotalValue, 15650);
  assert.equal(created.grandTotalWithCharges, 75650);

  // Update PR lines qty from 400 -> 800 (subtotal 120,000) and switch currency to USD
  const updated = PurchaseRequisitionService.updatePR(
    created.id,
    {
      currency: 'USD',
      estimatedTotalValue: 120000,
      lines: [
        {
          ...created.lines[0],
          requestedQuantity: 800,
          estimatedTotalValue: 120000,
        },
      ],
    },
    maker
  );

  assert.ok(updated);
  // Recalculated for 120,000 items:
  // LOAD: 1500 + UNLOAD: 1500 + CUSTOMS (10% = 12000) + FREIGHT: 4500 + INSURANCE (0.25% = 300) + PACKAGING: 2000 = 21800
  assert.equal(updated!.chargesTotalValue, 21800);
  assert.equal(updated!.grandTotalWithCharges, 141800);
  assert.equal(updated!.chargeItems![0].currency, 'USD');
});

test('generatePurchaseRequisitionPdf removes diagonal watermark completely and prints Applicable Charge Items cleanly without column overflow', () => {
  clearImmutablePrPdfRepositoryForTests();
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    warnings.push(args.map(String).join(' '));
  };

  try {
    const chargeItems = prChargeItemService.getDefaultChargeItems('INR', 100000);
    const prWithCharges: PurchaseRequisitionHeader = {
      id: 'pr-pdf-chg-01',
      prNumber: 'PR-2526-0888',
      prType: 'MANUAL',
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      companyName: 'Kosh Innovations Pvt Ltd',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Pondicherry Main Plant & HQ',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: 'usr-1',
      requesterName: 'Rajesh Sharma',
      creatorId: 'usr-1',
      creatorName: 'Rajesh Sharma',
      priority: 'NORMAL',
      status: 'PENDING_MANAGER_APPROVAL',
      purchasePurpose: 'Import resin batch with customs duty and freight tariffs',
      businessJustification: 'Quarterly production buffer',
      deliveryLocation: 'Pondicherry Store',
      estimatedTotalValue: 100000,
      chargeItems,
      chargesTotalValue: 19750,
      grandTotalWithCharges: 119750,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      lines: [
        {
          id: 'line-1',
          prId: 'pr-pdf-chg-01',
          itemCode: 'RMPAOPOEXLG0004',
          description: 'PC-ABS - Injection Grade V0',
          itemCategory: 'Raw Materials',
          inventoryUom: 'KG',
          requestedQuantity: 500,
          approximateUnitPrice: 200,
          currency: 'INR',
          estimatedTotalValue: 100000,
          deliverySchedules: [
            { id: 'sch-1', lineId: 'line-1', deliveryDate: '2026-11-25', quantity: 500 },
          ],
          status: 'ACTIVE',
        },
      ],
      changeHistory: [],
      attachments: [],
      createdAt: '2026-11-15T09:00:00Z',
      updatedAt: '2026-11-15T09:00:00Z',
    };

    const doc = generatePurchaseRequisitionPdf(prWithCharges, {
      printedBy: 'Rajesh Sharma',
    });

    const totalPages = doc.getNumberOfPages();
    assert.ok(totalPages >= 1);

    const allStreams = Array.from({ length: totalPages }, (_, idx) =>
      ((doc as any).internal.pages[idx + 1] || []).join('\n')
    ).join('\n');

    // No watermark overlay
    assert.ok(
      !allStreams.includes('INTERNAL REVIEW ONLY'),
      'PDF must NOT contain diagonal watermark INTERNAL REVIEW ONLY'
    );
    assert.ok(
      !allStreams.includes('0.13 gs') && !allStreams.includes('/ca0.13'),
      'PDF must NOT contain translucent watermark graphics state'
    );

    // Applicable Charge Items table rendered cleanly
    assert.ok(
      allStreams.includes('APPLICABLE CHARGE ITEMS'),
      'PDF must render APPLICABLE CHARGE ITEMS section'
    );
    assert.ok(
      allStreams.includes('Loading Charges'),
      'PDF must include active Fixed Charge item Loading Charges'
    );
    assert.ok(
      allStreams.includes('Customs Duty & Import Tariff'),
      'PDF must include active Applicable item Customs Duty'
    );
    assert.ok(
      !allStreams.includes('Installation & Commissioning Charges'),
      'PDF must omit NOT_APPLICABLE charge items from Applicable Charge Items table'
    );
    assert.ok(
      allStreams.includes('Landed PR Total:'),
      'PDF summary must include Landed PR Total'
    );

    // Zero autoTable width warnings
    const widthWarnings = warnings.filter((w) => w.includes('could not fit page'));
    assert.equal(widthWarnings.length, 0, `Unexpected autoTable width warnings: ${widthWarnings.join('; ')}`);
  } finally {
    console.warn = origWarn;
  }
});
