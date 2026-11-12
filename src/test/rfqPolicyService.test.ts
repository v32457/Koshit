import test from 'node:test';
import assert from 'node:assert';
import { rfqPolicyService } from '../services/rfqPolicyService.ts';
import { RfqPolicyConfig } from '../types/rfqSourcing.ts';

test('RFQ Policy Service - Company and Branch Scope, Inheritance, and Overrides', async (t) => {
  const companyId = 'co-test-01';
  const branchId = 'br-test-01';

  await t.test('1. Company-level RFQ enablement returns correct policy mode', () => {
    const config: RfqPolicyConfig = {
      id: 'pol-co-test',
      companyId,
      companyCode: 'TEST-HQ',
      branchId: 'ALL',
      branchCode: 'ALL',
      branchName: 'All Branches',
      policyMode: 'RFQ_ENABLED',
      isInheritedFromCompany: false,
      allowBranchOverride: true,
      minSupplierInvitations: 3,
      maxSupplierInvitations: 10,
      defaultQuotationValidityDays: 30,
      evaluationType: 'TWO_STAGE',
      sealedCommercialQuotations: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Test Admin',
    };
    rfqPolicyService.updatePolicy(config);

    const activePolicy = rfqPolicyService.getEffectivePolicy(companyId);
    assert.strictEqual(activePolicy.policyMode, 'RFQ_ENABLED');
    assert.strictEqual(rfqPolicyService.isRfqMandatory(companyId), true);
    assert.strictEqual(rfqPolicyService.isRfqEnabled(companyId), true);
    assert.strictEqual(rfqPolicyService.isPriceBookMandatory(companyId), false);
  });

  await t.test('2. Branch without override inherits company policy', () => {
    const branchPolicy = rfqPolicyService.getEffectivePolicy(companyId, branchId);
    assert.strictEqual(branchPolicy.policyMode, 'RFQ_ENABLED');
    assert.strictEqual(rfqPolicyService.hasBranchOverride(companyId, branchId), false);
  });

  await t.test('3. Authorized branch override with RFQ_DISABLED and Purchase Price Book', () => {
    const branchConfig: RfqPolicyConfig = {
      id: 'pol-br-test',
      companyId,
      companyCode: 'TEST-HQ',
      branchId,
      branchCode: '001',
      branchName: 'Test Branch 1',
      policyMode: 'RFQ_DISABLED',
      isInheritedFromCompany: false,
      allowBranchOverride: false,
      minSupplierInvitations: 0,
      maxSupplierInvitations: 0,
      defaultQuotationValidityDays: 0,
      evaluationType: 'SINGLE_STAGE',
      sealedCommercialQuotations: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Branch Manager',
    };
    rfqPolicyService.updatePolicy(branchConfig);

    assert.strictEqual(rfqPolicyService.hasBranchOverride(companyId, branchId), true);
    const effectiveBranchPolicy = rfqPolicyService.getEffectivePolicy(companyId, branchId);
    assert.strictEqual(effectiveBranchPolicy.policyMode, 'RFQ_DISABLED');
    assert.strictEqual(rfqPolicyService.isRfqEnabled(companyId, branchId), false);
    assert.strictEqual(rfqPolicyService.isPriceBookMandatory(companyId, branchId), true);
    assert.strictEqual(rfqPolicyService.isRfqEnabled(companyId), true);
  });

  await t.test('4. RFQ_OPTIONAL mode with direct procurement exemptions', () => {
    const branchConfig: RfqPolicyConfig = {
      id: 'pol-br-test-2',
      companyId,
      companyCode: 'TEST-HQ',
      branchId,
      branchCode: '001',
      branchName: 'Test Branch 1',
      policyMode: 'RFQ_OPTIONAL',
      isInheritedFromCompany: false,
      allowBranchOverride: false,
      allowDirectExemptions: true,
      directProcurementExemptionLimit: 50000,
      directExemptionRequiresApproval: true,
      minSupplierInvitations: 2,
      maxSupplierInvitations: 8,
      defaultQuotationValidityDays: 15,
      evaluationType: 'SINGLE_STAGE',
      sealedCommercialQuotations: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Branch Manager',
    };
    rfqPolicyService.updatePolicy(branchConfig);

    const effective = rfqPolicyService.getEffectivePolicy(companyId, branchId);
    assert.strictEqual(effective.policyMode, 'RFQ_OPTIONAL');
    assert.strictEqual(rfqPolicyService.isRfqEnabled(companyId, branchId), true);
    assert.strictEqual(rfqPolicyService.isRfqMandatory(companyId, branchId), false);
    assert.strictEqual(effective.allowDirectExemptions, true);
    assert.strictEqual(effective.directProcurementExemptionLimit, 50000);
  });

  await t.test('5. Revert branch override to company inheritance', () => {
    const reverted = rfqPolicyService.revertBranchToInheritance(companyId, branchId);
    assert.ok(reverted);
    assert.strictEqual(reverted.isInheritedFromCompany, true);
    assert.strictEqual(rfqPolicyService.hasBranchOverride(companyId, branchId), false);

    const effective = rfqPolicyService.getEffectivePolicy(companyId, branchId);
    assert.strictEqual(effective.policyMode, 'RFQ_ENABLED');
  });
});
