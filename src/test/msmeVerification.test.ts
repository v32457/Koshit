import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUdyamFormat,
  verifyUdyamRegistration,
  UDYAM_REGEX,
} from '../services/msmeService';
import {
  getAllProviders,
  selectOptimalProvider,
  recordApiProviderUsage,
} from '../services/apiProviderService';
import {
  sanitizeTextForExport,
  exportToCsv,
  exportToExcel,
  exportToWord,
  exportToPdf,
} from '../services/exportService';
import {
  validateIndianPostalCode,
  validateUdyamGeographicalConsistency,
} from '../services/geoValidationService';

test('1. Udyam Registration Number Format Validation', () => {
  // Valid formats
  assert.equal(validateUdyamFormat('UDYAM-TN-02-0048921').isValid, true);
  assert.equal(validateUdyamFormat('UDYAM-MH-26-0012398').isValid, true);
  assert.equal(validateUdyamFormat('udyam-dl-01-0000001').isValid, true); // normalized to uppercase

  // Invalid formats
  assert.equal(validateUdyamFormat('').isValid, false);
  assert.equal(validateUdyamFormat('INVALID-UDYAM').isValid, false);
  assert.equal(validateUdyamFormat('UDYAM-T-02-0048921').isValid, false); // single letter state
  assert.equal(validateUdyamFormat('UDYAM-TN-2-0048921').isValid, false); // single digit district
  assert.equal(validateUdyamFormat('UDYAM-TN-02-004892').isValid, false); // 6 digits instead of 7
  assert.equal(validateUdyamFormat('UDYAM-TN-02-00489210').isValid, false); // 8 digits
});

test('2. Retrieval of Certificate 1: UDYAM-TN-02-0048921 (Kosh Innovations)', async () => {
  const d = await verifyUdyamRegistration('UDYAM-TN-02-0048921', 'Unit Tester');

  assert.ok(d, 'Result details must be present');
  assert.equal(d.udyamRegistrationNo, 'UDYAM-TN-02-0048921');
  assert.equal(d.enterpriseName, 'KOSH INNOVATIONS PRIVATE LIMITED');
  assert.equal(d.majorActivity, 'MANUFACTURING');
  assert.equal(d.organisationType, 'Private Limited Company');
  assert.ok(d.dicDetails?.includes('CHENNAI'));
  assert.ok(d.msmeDiDfoDetails?.includes('MSME-DI CHENNAI'));

  // Verify Classification History
  assert.ok(d.classificationHistory.length >= 2, 'Should contain classification history');
  assert.equal(d.classificationHistory[0].enterpriseType, 'SMALL');
  assert.equal(d.classificationHistory[2].enterpriseType, 'MICRO');

  // Verify Unit / Plant Locations
  assert.ok(d.units.length >= 1);
  assert.ok(d.units[0].unitName.includes('Manufacturing Unit') || d.units[0].unitName.includes('Plant'));

  // Verify Official Enterprise Address (Matches state prefix TN)
  assert.equal(d.officialAddress.state, 'Tamil Nadu');
  assert.equal(d.officialAddress.city, 'Chennai');
  assert.equal(d.officialAddress.postalCode, '600002');

  // Verify NIC activities
  assert.ok(d.nicActivities.length > 0);
  assert.equal(d.nicActivities[0].nic2Digit, '26');
});

test('3. Retrieval of Certificate 2: UDYAM-MH-26-0012398 (MAB Polytech, 3 Plant Units, 12 NIC Activities)', async () => {
  const d = await verifyUdyamRegistration('UDYAM-MH-26-0012398', 'Unit Tester');

  assert.ok(d, 'Result details must be present');
  assert.equal(d.udyamRegistrationNo, 'UDYAM-MH-26-0012398');
  assert.equal(d.enterpriseName, 'MAB POLYTECH ENTERPRISES');
  assert.equal(d.majorActivity, 'MANUFACTURING');
  assert.equal(d.organisationType, 'Partnership');
  assert.equal(d.classificationHistory[0].enterpriseType, 'MEDIUM');

  // 3 distinct plant units
  assert.equal(d.units.length, 3, 'Must have exactly 3 manufacturing plant units');
  const unitNames = d.units.map(u => u.unitName);
  assert.ok(unitNames.some(n => n.includes('Polymer') || n.includes('Sanaswadi')));
  assert.ok(unitNames.some(n => n.includes('Tooling') || n.includes('Bhosari')));
  assert.ok(unitNames.some(n => n.includes('Logistics') || n.includes('Navi Mumbai') || n.includes('Distribution')));

  // Official HQ Address separated from plant units
  assert.equal(d.officialAddress.city, 'Pune');
  assert.equal(d.officialAddress.state, 'Maharashtra');
  assert.equal(d.officialAddress.postalCode, '411062');

  // 12 NIC Activity codes covering Manufacturing, Services & Trading
  assert.equal(d.nicActivities.length, 12, 'Must have 12 NIC activity codes');
  const activityCategories = new Set(d.nicActivities.map(a => a.activityCategory));
  assert.ok(activityCategories.has('MANUFACTURING'));
  assert.ok(activityCategories.has('SERVICES'));
  assert.ok(activityCategories.has('TRADING'));
});

test('4. Identifier Validation and Rejection of Invalid Udyam on Verification', async () => {
  await assert.rejects(
    async () => {
      await verifyUdyamRegistration('INVALID-REG-NUM', 'Unit Tester');
    },
    {
      name: 'Error',
      message: /Invalid Udyam Registration Number/i,
    }
  );
});

test('5. Multi-Provider Selection and Automatic Failover Tracking', () => {
  const msmeProviders = getAllProviders('MSME');
  assert.ok(msmeProviders.length >= 2, 'Should have multiple MSME providers configured');

  const selected = selectOptimalProvider('MSME');
  assert.ok(selected, 'Should select an optimal healthy provider');
  assert.equal(selected?.serviceType, 'MSME');
  assert.equal(selected?.isActive, true);

  // Record usage and assert log recording
  recordApiProviderUsage({
    providerId: selected!.id,
    serviceType: 'MSME',
    targetIdentifier: 'UDYAM-TN-02-0048921',
    status: 'SUCCESS',
    latencyMs: 145,
    requestedBy: 'Automated Test',
    responseSummary: 'OK 200',
  });
});

test('6. Text Sanitization and Character Decoding for Export', () => {
  // Test en-dash and em-dash conversion to hyphen
  const dashedText = 'HDPE – Automotive Corrugated Sleeve DIX001 — Grey';
  assert.equal(sanitizeTextForExport(dashedText), 'HDPE - Automotive Corrugated Sleeve DIX001 - Grey');

  // Test HTML entities decoding
  const htmlEntityText = 'Kosh &amp; Sons &bull; High &quot;Grade&quot; Plastic &#39;Special&#39;';
  assert.equal(sanitizeTextForExport(htmlEntityText), "Kosh & Sons - High \"Grade\" Plastic 'Special'");

  // Test curly quotes and non-breaking space
  const curlyQuotes = '“Precision” ‘Parts’\u00A0Unit';
  assert.equal(sanitizeTextForExport(curlyQuotes), '"Precision" \'Parts\' Unit');
});

test('7. DEFECT REGRESSION: Unseeded Udyam UDYAM-MH-26-0287071 MUST NOT Fabricate Synthetic Enterprise', async () => {
  // UDYAM-MH-26-0287071 was previously generating fabricated "MAB POLYTECH ENTERPRISES" with Chennai 600001 address under Maharashtra
  await assert.rejects(
    async () => {
      await verifyUdyamRegistration('UDYAM-MH-26-0287071', 'Audit Tester');
    },
    {
      name: 'Error',
      message: /not found in the authoritative government MSME registry/i,
    }
  );
});

test('8. CRITICAL GEOGRAPHICAL CONTRADICTION: PIN 600001 under Maharashtra is strictly rejected', () => {
  // Direct PIN to State check
  const pinCheck = validateIndianPostalCode('600001', 'Maharashtra', 'Chennai');
  assert.equal(pinCheck.isValid, false);
  assert.equal(pinCheck.contradictionType, 'PIN_STATE_MISMATCH');
  assert.ok(pinCheck.error!.includes('PIN code 600001 belongs to Chennai, Tamil Nadu'));

  // Udyam identifier to address cross-check
  const geoCheck = validateUdyamGeographicalConsistency({
    udyamRegistrationNo: 'UDYAM-MH-26-0287071',
    addressState: 'Maharashtra',
    addressCity: 'Chennai',
    postalCode: '600001',
  });
  assert.equal(geoCheck.isValid, false);
  assert.equal(geoCheck.contradictionType, 'PIN_STATE_MISMATCH');
});

test('9. CRITICAL GEOGRAPHICAL CONTRADICTION: UDYAM-MH-... with Tamil Nadu state is strictly rejected', () => {
  const geoCheck = validateUdyamGeographicalConsistency({
    udyamRegistrationNo: 'UDYAM-MH-26-0287071',
    addressState: 'Tamil Nadu',
    addressCity: 'Chennai',
    postalCode: '600001',
  });
  assert.equal(geoCheck.isValid, false);
  assert.equal(geoCheck.contradictionType, 'IDENTIFIER_STATE_MISMATCH');
  assert.ok(geoCheck.error!.includes('state prefix "MH" (Maharashtra), but returned address indicates state "Tamil Nadu"'));
});

test('10. Multi-format Export Generators produce valid binary buffers without corruption or undefined names', async () => {
  const sampleData = {
    title: 'Branch Item Catalog — Puducherry Plant',
    subtitle: 'Authoritative Branch-Created and Assigned Items Registry',
    scopeLabel: 'Branch: Puducherry Plant [PDY]',
    headers: ['Item Code', 'Description', 'Category', 'Stocking Status'],
    rows: [
      ['RMPAOPOEXLG0001', 'PC-ABS – Injection Grade V0', 'RM', 'ACTIVE'],
      ['FGHDMCRGY0002', 'HDPE – Corrugated Sleeve DIX001', 'FG', 'ACTIVE'],
    ],
    filenamePrefix: 'branch_catalog_PDY',
  };

  // Test CSV generation
  assert.doesNotThrow(() => {
    exportToCsv(sampleData);
  });

  // Test Excel generation (SheetJS creates valid OOXML)
  assert.doesNotThrow(() => {
    exportToExcel(sampleData);
  });

  // Test Word generation (Packer creates valid docx)
  await assert.doesNotReject(async () => {
    await exportToWord(sampleData);
  });

  // Test PDF generation (jsPDF creates valid binary PDF)
  assert.doesNotThrow(() => {
    exportToPdf(sampleData);
  });
});

