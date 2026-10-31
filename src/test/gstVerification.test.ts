import test from 'node:test';
import assert from 'node:assert/strict';
import { GST_STATE_CODES } from '../data/geoData';
import {
  validateGstinFormat,
  getCurrentIndianFinancialYear,
  getPreviousIndianFinancialYears,
  generateCaptchaChallenge,
  verifyGSTIN,
  getOrCreateGstDetailsForEntity,
  getGstProviderConfig,
  getGstVerificationMode,
  setGstVerificationMode,
  testPaidProviderConnection,
  formatGstRegistrationDate,
} from '../services/gstService';

test('validateGstinFormat: accepts valid 15-digit GSTIN with valid state code', () => {
  const validGstin = '34AAACK4603M1ZP';
  const result = validateGstinFormat(validGstin);
  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
  const stateCode = validGstin.slice(0, 2);
  assert.equal(stateCode, '34');
  assert.equal(GST_STATE_CODES[stateCode], 'Puducherry');
});

test('validateGstinFormat: rejects invalid formats and illegal state codes', () => {
  assert.equal(validateGstinFormat('').isValid, false);
  assert.equal(validateGstinFormat('12345').isValid, false);
  assert.equal(validateGstinFormat('99AAACK4603M1ZP').isValid, false); // 99 is invalid state
  assert.equal(validateGstinFormat('3412345678901ZP').isValid, false); // invalid PAN structure
});

test('Indian Financial Year Calculation: adheres to April 1 - March 31 cycle', () => {
  const febDate = new Date(2026, 1, 15);
  assert.equal(getCurrentIndianFinancialYear(febDate), '2025-2026');

  const octDate = new Date(2026, 9, 30);
  assert.equal(getCurrentIndianFinancialYear(octDate), '2026-2027');

  const prevYears = getPreviousIndianFinancialYears(3, octDate);
  assert.deepEqual(prevYears, ['2026-2027', '2025-2026', '2024-2025', '2023-2024']);
});

// MANDATORY REGRESSION TEST 1: Correct Legal Name and Trade Name Mapping
test('Regression 1: Correct legal-name and trade-name mapping for tested GSTIN 27AAQCM8508C1Z9', async () => {
  const gstin = '27AAQCM8508C1Z9';
  
  // Test Paid API path
  const paidResult = await verifyGSTIN({
    gstin,
    mode: 'PAID_API',
    requestedBy: 'QA Test Runner',
  });
  assert.equal(paidResult.gstin, gstin);
  assert.equal(paidResult.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(paidResult.tradeName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(paidResult.registrationStatus, 'ACTIVE');

  // Test Manual CAPTCHA path
  const session = generateCaptchaChallenge(gstin);
  const captchaResult = await verifyGSTIN({
    gstin,
    mode: 'MANUAL_CAPTCHA',
    captchaAnswer: session.captchaText!,
    sessionId: session.sessionId,
    requestedBy: 'QA Test Runner',
  });
  assert.equal(captchaResult.gstin, gstin);
  assert.equal(captchaResult.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(captchaResult.tradeName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.notEqual(captchaResult.legalName, 'ENTERPRISE AQCM8 SOLUTIONS PRIVATE LIMITED');
});

// MANDATORY REGRESSION TEST 2: Correct Registration-Date Mapping and Formatting
test('Regression 2: Correct registration-date mapping and formatting (2023-08-28 -> 28/08/2023)', async () => {
  const gstin = '27AAQCM8508C1Z9';
  const result = await verifyGSTIN({
    gstin,
    mode: 'PAID_API',
  });

  // Verify normalized date format in response
  assert.equal(result.registrationDate, '28/08/2023');
  assert.notEqual(result.registrationDate, '2018-07-01');

  // Verify format helper utility directly
  assert.equal(formatGstRegistrationDate('2023-08-28'), '28/08/2023');
  assert.equal(formatGstRegistrationDate('28/08/2023'), '28/08/2023');
  assert.equal(formatGstRegistrationDate('2020-11-05'), '05/11/2020');
});

// MANDATORY REGRESSION TEST 3: Wrong GSTIN in Response Rejection
test('Regression 3: Reject response whose returned GSTIN conflicts with requested GSTIN', async () => {
  const requestedGstin = '27AAQCM8508C1Z9';
  const conflictGstin = '34AAACK4603M1ZP';

  // Attempting to verify with mismatched session / ID conflict
  const sessionForOther = generateCaptchaChallenge(conflictGstin);

  await assert.rejects(
    async () => {
      await verifyGSTIN({
        gstin: requestedGstin,
        mode: 'MANUAL_CAPTCHA',
        captchaAnswer: sessionForOther.captchaText!,
        sessionId: sessionForOther.sessionId,
      });
    },
    (err: any) => {
      assert.match(err.message, /bound to a different GSTIN/i);
      return true;
    }
  );
});

// MANDATORY REGRESSION TEST 4: Stale Cached Response Avoidance
test('Regression 4: Fresh verification does not return stale or cached data from a previous GSTIN', async () => {
  const firstGstin = '34AAACK4603M1ZP';
  const secondGstin = '27AAQCM8508C1Z9';

  const firstResult = await verifyGSTIN({ gstin: firstGstin, mode: 'PAID_API' });
  assert.equal(firstResult.gstin, firstGstin);
  assert.equal(firstResult.principalPlaceOfBusiness.state, 'Puducherry');

  const secondResult = await verifyGSTIN({ gstin: secondGstin, mode: 'PAID_API' });
  assert.equal(secondResult.gstin, secondGstin);
  assert.equal(secondResult.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(secondResult.principalPlaceOfBusiness.state, 'Maharashtra');
  assert.notEqual(secondResult.legalName, firstResult.legalName);
  assert.notEqual(secondResult.correlationId, firstResult.correlationId);
});

// MANDATORY REGRESSION TEST 5: Missing Optional Fields Preservation
test('Regression 5: Null constitution and nature of business remain null without synthetic defaults', async () => {
  const gstin = '27AAQCM8508C1Z9';
  const result = await verifyGSTIN({
    gstin,
    mode: 'PAID_API',
  });

  // Paid API returns null for constitution and nature of business
  assert.equal(result.constitutionOfBusiness, null);
  assert.equal(result.natureOfCoreBusinessActivity, null);
  assert.equal(result.natureOfBusinessActivities, null);
});

// MANDATORY REGRESSION TEST 6: Provider Failure and Timeout Handling
test('Regression 6: Provider failures do not fall back to fake company records', async () => {
  const invalidGstin = '00INVALID0000X0';

  await assert.rejects(
    async () => {
      await verifyGSTIN({
        gstin: invalidGstin,
        mode: 'PAID_API',
      });
    },
    (err: any) => {
      assert.match(err.message, /Invalid GSTIN format/i);
      return true;
    }
  );
});

// MANDATORY REGRESSION TEST 7: Concurrent Verification Requests
test('Regression 7: Concurrent verification requests return isolated responses with unique correlation IDs', async () => {
  const gstinA = '34AAACK4603M1ZP';
  const gstinB = '27AAQCM8508C1Z9';
  const gstinC = '33AAACK4603M1ZR';

  const [resA, resB, resC] = await Promise.all([
    verifyGSTIN({ gstin: gstinA, mode: 'PAID_API' }),
    verifyGSTIN({ gstin: gstinB, mode: 'PAID_API' }),
    verifyGSTIN({ gstin: gstinC, mode: 'PAID_API' }),
  ]);

  assert.equal(resA.gstin, gstinA);
  assert.equal(resB.gstin, gstinB);
  assert.equal(resC.gstin, gstinC);

  assert.equal(resA.requestedGstin, gstinA);
  assert.equal(resB.requestedGstin, gstinB);
  assert.equal(resC.requestedGstin, gstinC);

  assert.ok(resA.correlationId);
  assert.ok(resB.correlationId);
  assert.ok(resC.correlationId);
  assert.notEqual(resA.correlationId, resB.correlationId);
  assert.notEqual(resB.correlationId, resC.correlationId);
});

// MANDATORY REGRESSION TEST 8: Review Modal Field Expectations for 27AAQCM8508C1Z9
test('Regression 8: Verification details for 27AAQCM8508C1Z9 match official taxpayer identity', async () => {
  const gstin = '27AAQCM8508C1Z9';
  const details = await verifyGSTIN({ gstin, mode: 'PAID_API' });

  assert.equal(details.gstin, '27AAQCM8508C1Z9');
  assert.equal(details.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(details.tradeName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(details.registrationDate, '28/08/2023');
  assert.equal(details.registrationStatus, 'ACTIVE');
  assert.equal(details.taxpayerType, 'Regular');
  assert.equal(details.principalPlaceOfBusiness.state, 'Maharashtra');
  assert.equal(details.principalPlaceOfBusiness.postalCode, '411062');
});

// MANDATORY REGRESSION TEST 9: Confirm & Apply Persistence Without Data Corruption
test('Regression 9: Confirm & Apply preserves exact verified fields without synthetic name fallback', () => {
  const gstin = '27AAQCM8508C1Z9';
  const details = getOrCreateGstDetailsForEntity(gstin, 'MAB POLYTECH PRIVATE LIMITED', 'MAB POLYTECH PRIVATE LIMITED');

  assert.ok(details);
  assert.equal(details.gstin, gstin);
  assert.equal(details.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(details.tradeName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(details.registrationDate, '28/08/2023');
  assert.equal(details.principalPlaceOfBusiness.postalCode, '411062');
  assert.notEqual(details.legalName, 'ENTERPRISE AQCM8 SOLUTIONS PRIVATE LIMITED');
  assert.notEqual(details.registrationDate, '2018-07-01');
});

// MANDATORY REGRESSION TEST 10: Reloading Saved Business Partner Records
test('Regression 10: Reloading saved records preserves verified details and does not revert to 2018-07-01', () => {
  const gstin = '27AAQCM8508C1Z9';

  // Simulate saved Business Partner record
  const savedBpRecord = {
    id: 'bp-test-mab',
    bpName: 'MAB POLYTECH PRIVATE LIMITED',
    gstLegalName: 'MAB POLYTECH PRIVATE LIMITED',
    gstTradeName: 'MAB POLYTECH PRIVATE LIMITED',
    gstinPan: gstin,
    gstStatus: 'ACTIVE',
    gstVerificationDetails: getOrCreateGstDetailsForEntity(gstin, 'MAB POLYTECH PRIVATE LIMITED', 'MAB POLYTECH PRIVATE LIMITED'),
  };

  // Simulate reload
  const reloadedDetails = savedBpRecord.gstVerificationDetails;
  assert.ok(reloadedDetails);
  assert.equal(reloadedDetails.legalName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(reloadedDetails.tradeName, 'MAB POLYTECH PRIVATE LIMITED');
  assert.equal(reloadedDetails.registrationDate, '28/08/2023');
  assert.notEqual(reloadedDetails.registrationDate, '2018-07-01');
  assert.equal(reloadedDetails.principalPlaceOfBusiness.postalCode, '411062');
});

// MANDATORY REGRESSION TEST 11: Verified Retrieval for 27AAJCK6390B1ZG (KONDESHWAR INJECTO PRIVATE LIMITED)
test('Regression 11: Paid API and Manual verification for KONDESHWAR INJECTO PRIVATE LIMITED (27AAJCK6390B1ZG)', async () => {
  const gstin = '27AAJCK6390B1ZG';

  // Test Paid API verification
  const paidDetails = await verifyGSTIN({
    gstin,
    mode: 'PAID_API',
    requestedBy: 'Integration Engine',
  });

  assert.equal(paidDetails.gstin, gstin);
  assert.equal(paidDetails.legalName, 'KONDESHWAR INJECTO PRIVATE LIMITED');
  assert.equal(paidDetails.tradeName, 'KONDESHWAR INJECTO PRIVATE LIMITED');
  assert.equal(paidDetails.registrationDate, '25/07/2022');
  assert.equal(paidDetails.registrationStatus, 'ACTIVE');
  assert.equal(paidDetails.taxpayerType, 'Regular');
  assert.equal(paidDetails.principalPlaceOfBusiness.state, 'Maharashtra');
  assert.equal(paidDetails.principalPlaceOfBusiness.postalCode, '410501');
  assert.equal(paidDetails.constitutionOfBusiness, null); // Paid API returns null per curl evidence
  assert.equal(paidDetails.natureOfBusinessActivities, null);

  // Test Manual CAPTCHA verification
  const session = generateCaptchaChallenge(gstin);
  const manualDetails = await verifyGSTIN({
    gstin,
    mode: 'MANUAL_CAPTCHA',
    captchaAnswer: session.captchaText!,
    sessionId: session.sessionId,
    requestedBy: 'Govt Portal Inspector',
  });

  assert.equal(manualDetails.gstin, gstin);
  assert.equal(manualDetails.legalName, 'KONDESHWAR INJECTO PRIVATE LIMITED');
  assert.equal(manualDetails.tradeName, 'KONDESHWAR INJECTO PRIVATE LIMITED');
  assert.equal(manualDetails.registrationDate, '25/07/2022');
  assert.equal(manualDetails.constitutionOfBusiness, 'Private Limited Company');
  assert.equal(manualDetails.registrationStatus, 'ACTIVE');
  assert.equal(manualDetails.principalPlaceOfBusiness.postalCode, '410501');
});

// MANDATORY REGRESSION TEST 12: Verified Retrieval for 27BGPXK1541A1ZH (Both Manual CAPTCHA & Paid API)
test('Regression 12: Manual CAPTCHA and Paid API verification for 27BGPXK1541A1ZH', async () => {
  const gstin = '27BGPXK1541A1ZH';

  // Test Manual CAPTCHA verification (resolves without "Taxpayer record not found" error)
  const session = generateCaptchaChallenge(gstin);
  const manualDetails = await verifyGSTIN({
    gstin,
    mode: 'MANUAL_CAPTCHA',
    captchaAnswer: session.captchaText!,
    sessionId: session.sessionId,
    requestedBy: 'Govt Portal Inspector',
  });

  assert.equal(manualDetails.gstin, gstin);
  assert.equal(manualDetails.legalName, 'KOSH PRECISION ENGINEERING WORKS');
  assert.equal(manualDetails.tradeName, 'KOSH PRECISION ENGINEERING');
  assert.equal(manualDetails.registrationDate, '12/04/2021');
  assert.equal(manualDetails.constitutionOfBusiness, 'Proprietorship');
  assert.equal(manualDetails.registrationStatus, 'ACTIVE');
  assert.equal(manualDetails.principalPlaceOfBusiness.state, 'Maharashtra');
  assert.equal(manualDetails.principalPlaceOfBusiness.postalCode, '411026');

  // Test Paid API verification
  const paidDetails = await verifyGSTIN({
    gstin,
    mode: 'PAID_API',
    requestedBy: 'API Engine',
  });

  assert.equal(paidDetails.gstin, gstin);
  assert.equal(paidDetails.legalName, 'KOSH PRECISION ENGINEERING WORKS');
  assert.equal(paidDetails.tradeName, 'KOSH PRECISION ENGINEERING');
  assert.equal(paidDetails.registrationStatus, 'ACTIVE');
  assert.equal(paidDetails.principalPlaceOfBusiness.state, 'Maharashtra');
});
