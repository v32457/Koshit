import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeMasterService } from '../services/chargeMasterService';
import { chargeMappingService } from '../services/chargeMappingService';
import { prChargeItemService } from '../services/prChargeItemService';
import { chargeManagementService } from '../services/chargeManagementService';
import { PurchaseRequisitionService } from '../services/purchaseRequisitionService';
import { INITIAL_USERS } from '../data/seedData';
import { User } from '../types';
import { EffectiveMappedChargeOption } from '../types/chargeManagement';

if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] || null,
    length: 0,
  } as Storage;
}

const adminUser = INITIAL_USERS[0]; // PLATFORM_ADMIN
const makerUser: User = {
  ...INITIAL_USERS[0],
  id: 'usr-maker-test',
  fullName: 'Test Item Maker',
  email: 'maker@kosh.com',
  role: 'ITEM_MAKER',
};

const adminActor = { id: adminUser.id, name: adminUser.fullName, user: adminUser };
const makerActor = { id: makerUser.id, name: makerUser.fullName, user: makerUser };

function resetAll() {
  localStorage.clear();
  chargeMasterService.resetForTesting();
  chargeMappingService.resetForTesting();
  chargeManagementService.resetForTesting();
}

test('Charge Master: centralized creation, duplicate active code prevention, deactivation & version bump', () => {
  resetAll();

  const created = chargeMasterService.createCharge(
    {
      chargeCode: 'CHG-COLD-CHAIN',
      chargeName: 'Cold Chain Reefer Surcharge',
      chargeDescription: 'Temperature-controlled transit surcharge',
      chargeCategory: 'LOGISTICS',
      defaultApplicationLevel: 'PR_HEADER',
      permittedApplicationLevels: ['PR_HEADER', 'PO_HEADER', 'SHIPMENT'],
      defaultCalculationMethod: 'FIXED_AMOUNT',
      defaultCalculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
      defaultRate: 6500,
      applicabilityRule: 'OPTIONAL',
      defaultCurrency: 'INR',
      defaultTaxMappingId: 'tax-dom-gst-18',
      defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
      defaultAllocationBasis: 'PROPORTIONAL_VALUE',
      chargeBearer: 'BUYER',
      recoverability: 'RECOVERABLE_INPUT_CREDIT',
      minimumCharge: 0,
      maximumCharge: 50000,
      roundingRule: 'HALF_UP',
      decimalPrecision: 2,
      calculationSequence: 80,
      effectiveFrom: '2025-04-01',
      isActive: true,
      createdBy: adminUser.fullName,
      modifiedBy: adminUser.fullName,
    },
    adminActor
  );

  assert.equal(created.chargeCode, 'CHG-COLD-CHAIN');
  assert.equal(created.versionNumber, 1);

  // Duplicate active charge code must be rejected
  assert.throws(
    () =>
      chargeMasterService.createCharge(
        {
          ...created,
          chargeName: 'Duplicate Cold Chain',
        },
        adminActor
      ),
    /Duplicate active Charge Code/i
  );

  // Updating increments versionNumber
  const updated = chargeMasterService.updateCharge(
    created.id,
    { defaultRate: 7200 },
    adminActor
  );
  assert.equal(updated.versionNumber, 2);
  assert.equal(updated.defaultRate, 7200);

  // Deactivating excludes from PR effective selection
  const deactivated = chargeMasterService.setChargeActiveStatus(created.id, false, adminActor);
  assert.equal(deactivated.isActive, false);
  const prOptionsAfterDeactivate = prChargeItemService.getEffectiveMappedChargesForPR(
    'co-kosh-01',
    'br-pond-01'
  );
  assert.equal(
    prOptionsAfterDeactivate.some((o: EffectiveMappedChargeOption) => o.chargeCode === 'CHG-COLD-CHAIN'),
    false
  );
});

test('Charge Master & Mapping RBAC: non-admin user cannot mutate master or company/branch mappings', () => {
  resetAll();

  assert.throws(
    () =>
      chargeMasterService.createCharge(
        {
          chargeCode: 'CHG-UNAUTH',
          chargeName: 'Unauthorized Charge',
          chargeDescription: 'Should fail RBAC',
          chargeCategory: 'OTHER',
          defaultApplicationLevel: 'PR_HEADER',
          permittedApplicationLevels: ['PR_HEADER'],
          defaultCalculationMethod: 'FIXED_AMOUNT',
          defaultCalculationBasis: 'MATERIAL_LINE_VALUE',
          defaultRate: 100,
          applicabilityRule: 'OPTIONAL',
          defaultCurrency: 'INR',
          defaultTaxMappingId: 'tax-dom-gst-18',
          defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
          defaultAllocationBasis: 'PROPORTIONAL_VALUE',
          chargeBearer: 'BUYER',
          recoverability: 'RECOVERABLE_INPUT_CREDIT',
          roundingRule: 'HALF_UP',
          decimalPrecision: 2,
          calculationSequence: 99,
          effectiveFrom: '2025-04-01',
          isActive: true,
          createdBy: makerUser.fullName,
          modifiedBy: makerUser.fullName,
        },
        makerActor
      ),
    /Authorization Denied/i
  );

  const loadMaster = chargeMasterService.getChargeByIdOrCode('CHG-LOAD')!;
  assert.throws(
    () =>
      chargeMappingService.saveCompanyChargeMapping(
        {
          companyId: 'co-kosh-01',
          chargeMasterId: loadMaster.id,
          isEnabled: true,
          applicability: 'OPTIONAL',
          defaultCalculationMethod: 'FIXED_AMOUNT',
          fixedTariffOrRate: 1999,
          currency: 'INR',
          taxTreatment: 'DOMESTIC_GST_TAXABLE',
          allocationBasis: 'PROPORTIONAL_VALUE',
          effectiveFrom: '2025-04-01',
        },
        makerActor
      ),
    /Authorization Denied/i
  );
});

test('Company & Branch Mapping: inheritance, authorized branch override, central field lock enforcement, and revert', () => {
  resetAll();

  const freightMaster = chargeMasterService.getChargeByIdOrCode('CHG-FREIGHT')!;
  const insuranceMaster = chargeMasterService.getChargeByIdOrCode('CHG-INSURANCE')!;

  // 1. Branch inherits company authoritative mapping by default (co-kosh-01 / br-pond-01)
  const pondOptions = chargeMappingService.getEffectivePrChargeOptions('co-kosh-01', 'br-pond-01');
  const pondFreight = pondOptions.find((o) => o.chargeCode === 'CHG-FREIGHT');
  assert.ok(pondFreight);
  assert.equal(pondFreight.sourceScope, 'COMPANY_INHERITED');
  assert.equal(pondFreight.rate, 4500);

  // 2. Authorized branch override on permitted field (rate) works and does not leak to another branch
  const pondOverride = chargeMappingService.saveBranchChargeOverride(
    {
      companyId: 'co-kosh-01',
      branchId: 'br-pond-01',
      chargeMasterId: freightMaster.id,
      isEnabled: true,
      applicability: 'MANDATORY',
      defaultCalculationMethod: 'FIXED_AMOUNT',
      fixedTariffOrRate: 5100,
      currency: 'INR',
      taxMappingId: 'tax-dom-gta-rcm-5',
      taxTreatment: 'DOMESTIC_GST_RCM',
      allocationBasis: 'PROPORTIONAL_VALUE',
      effectiveFrom: '2025-04-01',
      remarks: 'Pondicherry local haul adjustment',
    },
    adminActor
  );
  assert.equal(pondOverride.isBranchOverride, true);
  assert.equal(pondOverride.fixedTariffOrRate, 5100);

  const pondAfterOverride = chargeMappingService
    .getEffectivePrChargeOptions('co-kosh-01', 'br-pond-01')
    .find((o) => o.chargeCode === 'CHG-FREIGHT');
  assert.equal(pondAfterOverride?.rate, 5100);
  assert.equal(pondAfterOverride?.sourceScope, 'BRANCH_OVERRIDE');

  // 3. Branch override attempting to change centrally controlled field (taxTreatment on CHG-FREIGHT) must throw
  assert.throws(
    () =>
      chargeMappingService.saveBranchChargeOverride(
        {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          chargeMasterId: freightMaster.id,
          isEnabled: true,
          applicability: 'MANDATORY',
          defaultCalculationMethod: 'FIXED_AMOUNT',
          fixedTariffOrRate: 5100,
          currency: 'INR',
          taxMappingId: 'tax-exempt',
          taxTreatment: 'EXEMPT_ZERO_RATED',
          allocationBasis: 'PROPORTIONAL_VALUE',
          effectiveFrom: '2025-04-01',
        },
        adminActor
      ),
    /centrally controlled/i
  );

  // 4. Branch override when allowBranchOverride is false (CHG-INSURANCE) must throw
  assert.throws(
    () =>
      chargeMappingService.saveBranchChargeOverride(
        {
          companyId: 'co-kosh-01',
          branchId: 'br-pond-01',
          chargeMasterId: insuranceMaster.id,
          isEnabled: true,
          applicability: 'OPTIONAL',
          defaultCalculationMethod: 'PERCENTAGE',
          fixedTariffOrRate: 0.5,
          currency: 'INR',
          taxMappingId: 'tax-dom-gst-18',
          taxTreatment: 'DOMESTIC_GST_TAXABLE',
          allocationBasis: 'PROPORTIONAL_VALUE',
          effectiveFrom: '2025-04-01',
        },
        adminActor
      ),
    /prohibits branch overrides/i
  );

  // 5. Reverting branch override restores company authoritative inheritance
  const reverted = chargeMappingService.revertBranchChargeOverride(
    'co-kosh-01',
    'br-pond-01',
    freightMaster.id,
    adminActor
  );
  assert.equal(reverted, true);

  const pondAfterRevert = chargeMappingService
    .getEffectivePrChargeOptions('co-kosh-01', 'br-pond-01')
    .find((o) => o.chargeCode === 'CHG-FREIGHT');
  assert.equal(pondAfterRevert?.sourceScope, 'COMPANY_INHERITED');
  assert.equal(pondAfterRevert?.rate, 4500);
});

test('PR Charge Selection: mapped auto-population, duplicate blocking, tax math, and historical snapshot immutability', () => {
  resetAll();

  const options = prChargeItemService.getEffectiveMappedChargesForPR('co-kosh-01', 'br-pond-01');
  const freightOpt = options.find((o: EffectiveMappedChargeOption) => o.chargeCode === 'CHG-FREIGHT')!;
  const loadOpt = options.find((o: EffectiveMappedChargeOption) => o.chargeCode === 'CHG-LOAD')!;
  assert.ok(freightOpt);
  assert.ok(loadOpt);

  // Add mapped charges to PR list
  let prCharges = prChargeItemService.addMappedChargeToPrList([], freightOpt, 100000, 'INR');
  prCharges = prChargeItemService.addMappedChargeToPrList(prCharges, loadOpt, 100000, 'INR');
  assert.equal(prCharges.length, 2);

  // Check snapshot metadata populated from Master + Mapping
  assert.equal(prCharges[0].chargeCode, 'CHG-FREIGHT');
  assert.equal(prCharges[0].chargeMasterVersion, 1);
  assert.equal(prCharges[0].estimatedAmount, 4500);
  assert.equal(prCharges[1].chargeCode, 'CHG-LOAD');
  assert.equal(prCharges[1].estimatedAmount, 1500);

  // Duplicate charge selection must be rejected
  assert.throws(
    () => prChargeItemService.addMappedChargeToPrList(prCharges, freightOpt, 100000, 'INR'),
    /Duplicate charge selection blocked/i
  );

  // Create and submit PR (non-draft auto-locks chargeSnapshots)
  const createdPr = PurchaseRequisitionService.createPR(
    {
      companyId: 'co-kosh-01',
      companyCode: 'KOSH-HQ',
      branchId: 'br-pond-01',
      branchCode: '001',
      branchName: 'Pondicherry Main Plant & HQ',
      prType: 'MANUAL',
      priority: 'NORMAL',
      department: 'Production',
      costCentre: 'CC-PROD-101',
      requesterId: adminUser.id,
      requesterName: adminUser.fullName,
      creatorId: adminUser.id,
      creatorName: adminUser.fullName,
      purchasePurpose: 'Charge governance snapshot immutability verification',
      businessJustification: 'Verify snapshot lock protection',
      deliveryLocation: 'Puducherry Plant',
      estimatedTotalValue: 100000,
      currency: 'INR',
      budgetValidationStatus: 'SUFFICIENT',
      erpStockStatus: 'FRESH',
      status: 'PENDING_MANAGER_APPROVAL',
      chargeItems: prCharges,
      changeHistory: [],
      attachments: [],
      lines: [
        {
          id: 'line-snap-1',
          prId: '',
          itemCode: 'RMPAOPOEXLG0001',
          description: 'PC-ABS Resin',
          itemCategory: 'RM',
          inventoryUom: 'KG',
          requestedQuantity: 100,
          approximateUnitPrice: 1000,
          estimatedTotalValue: 100000,
          currency: 'INR',
          deliverySchedules: [
            { id: 'sch-snap-1', lineId: 'line-snap-1', deliveryDate: '2026-12-01', quantity: 100 },
          ],
          status: 'ACTIVE',
        },
      ],
    },
    adminUser
  );

  assert.ok(createdPr.chargeItems?.[0].snapshotLockedAt);
  assert.equal(createdPr.chargeItems?.[0].estimatedAmount, 4500);

  // Now admin changes Company mapping rate for CHG-FREIGHT to 9900 AND updates Master default rate
  const freightMaster = chargeMasterService.getChargeByIdOrCode('CHG-FREIGHT')!;
  chargeMasterService.updateCharge(freightMaster.id, { defaultRate: 8800 }, adminActor);
  chargeMappingService.saveCompanyChargeMapping(
    {
      companyId: 'co-kosh-01',
      chargeMasterId: freightMaster.id,
      isEnabled: true,
      applicability: 'MANDATORY',
      defaultCalculationMethod: 'FIXED_AMOUNT',
      fixedTariffOrRate: 9900,
      currency: 'INR',
      taxMappingId: 'tax-dom-gta-rcm-5',
      taxTreatment: 'DOMESTIC_GST_RCM',
      allocationBasis: 'PROPORTIONAL_VALUE',
      effectiveFrom: '2025-04-01',
      allowBranchOverride: true,
      centrallyControlledFields: ['taxTreatment', 'allocationBasis'],
    },
    adminActor
  );

  // Historical submitted PR snapshot MUST remain 4500 (immutable!)
  const reloadedPr = PurchaseRequisitionService.getPurchaseRequisitions().find(
    (p) => p.id === createdPr.id
  )!;
  assert.equal(reloadedPr.chargeItems?.[0].estimatedAmount, 4500);
  assert.equal(reloadedPr.chargeItems?.[0].rateOrPercentage, 4500);
  assert.equal(reloadedPr.chargeItems?.[0].chargeMasterVersion, 1);

  // While new PR creation picks up the updated mapping rate (9900) and Master v2
  const newPrFreightOpt = prChargeItemService
    .getEffectiveMappedChargesForPR('co-kosh-01', 'br-pond-01')
    .find((o: EffectiveMappedChargeOption) => o.chargeCode === 'CHG-FREIGHT')!;
  assert.equal(newPrFreightOpt.rate, 9900);
  assert.equal(newPrFreightOpt.chargeMasterVersion, 2);
});
