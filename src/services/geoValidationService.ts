/**
 * AUTHORITATIVE GEOGRAPHICAL VALIDATION ENGINE
 * Cross-checks PIN codes, Cities, Districts, and States across India.
 * Prevents fabricated, mismatched, or contradictory geographical records.
 */

// Standard State Code to Full State Name Mapping
export const INDIAN_STATE_PREFIX_MAP: Record<string, { stateName: string; gstCode: string; pinPrefixes: string[] }> = {
  AP: { stateName: 'Andhra Pradesh', gstCode: '37', pinPrefixes: ['51', '52', '53'] },
  AR: { stateName: 'Arunachal Pradesh', gstCode: '12', pinPrefixes: ['79'] },
  AS: { stateName: 'Assam', gstCode: '18', pinPrefixes: ['78'] },
  BR: { stateName: 'Bihar', gstCode: '10', pinPrefixes: ['80', '81', '82', '83', '84', '85'] },
  CH: { stateName: 'Chandigarh', gstCode: '04', pinPrefixes: ['16'] },
  CG: { stateName: 'Chhattisgarh', gstCode: '22', pinPrefixes: ['49'] },
  DD: { stateName: 'Daman & Diu', gstCode: '26', pinPrefixes: ['39'] },
  DL: { stateName: 'Delhi', gstCode: '07', pinPrefixes: ['11'] },
  GA: { stateName: 'Goa', gstCode: '30', pinPrefixes: ['403'] },
  GJ: { stateName: 'Gujarat', gstCode: '24', pinPrefixes: ['36', '37', '38', '39'] },
  HR: { stateName: 'Haryana', gstCode: '06', pinPrefixes: ['12', '13'] },
  HP: { stateName: 'Himachal Pradesh', gstCode: '02', pinPrefixes: ['17'] },
  JK: { stateName: 'Jammu & Kashmir', gstCode: '01', pinPrefixes: ['18', '19'] },
  JH: { stateName: 'Jharkhand', gstCode: '20', pinPrefixes: ['81', '82', '83'] },
  KA: { stateName: 'Karnataka', gstCode: '29', pinPrefixes: ['56', '57', '58', '59'] },
  KL: { stateName: 'Kerala', gstCode: '32', pinPrefixes: ['67', '68', '69'] },
  LA: { stateName: 'Ladakh', gstCode: '38', pinPrefixes: ['194'] },
  LD: { stateName: 'Lakshadweep', gstCode: '31', pinPrefixes: ['682'] },
  MP: { stateName: 'Madhya Pradesh', gstCode: '23', pinPrefixes: ['45', '46', '47', '48'] },
  MH: { stateName: 'Maharashtra', gstCode: '27', pinPrefixes: ['40', '41', '42', '43', '44'] },
  MN: { stateName: 'Manipur', gstCode: '14', pinPrefixes: ['795'] },
  ML: { stateName: 'Meghalaya', gstCode: '17', pinPrefixes: ['793', '794'] },
  MZ: { stateName: 'Mizoram', gstCode: '15', pinPrefixes: ['796'] },
  NL: { stateName: 'Nagaland', gstCode: '13', pinPrefixes: ['797'] },
  OD: { stateName: 'Odisha', gstCode: '21', pinPrefixes: ['75', '76', '77'] },
  PY: { stateName: 'Puducherry', gstCode: '34', pinPrefixes: ['605'] },
  PB: { stateName: 'Punjab', gstCode: '03', pinPrefixes: ['14', '15'] },
  RJ: { stateName: 'Rajasthan', gstCode: '08', pinPrefixes: ['30', '31', '32', '33', '34'] },
  SK: { stateName: 'Sikkim', gstCode: '11', pinPrefixes: ['737'] },
  TN: { stateName: 'Tamil Nadu', gstCode: '33', pinPrefixes: ['60', '61', '62', '63', '64'] },
  TS: { stateName: 'Telangana', gstCode: '36', pinPrefixes: ['50'] },
  TR: { stateName: 'Tripura', gstCode: '16', pinPrefixes: ['799'] },
  UP: { stateName: 'Uttar Pradesh', gstCode: '09', pinPrefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28'] },
  UK: { stateName: 'Uttarakhand', gstCode: '05', pinPrefixes: ['24', '26'] },
  WB: { stateName: 'West Bengal', gstCode: '19', pinPrefixes: ['70', '71', '72', '73', '74'] },
};

// Known Major Cities to State Mapping
export const MAJOR_CITIES_STATE_MAP: Record<string, string> = {
  chennai: 'Tamil Nadu',
  madras: 'Tamil Nadu',
  coimbatore: 'Tamil Nadu',
  hosur: 'Tamil Nadu',
  madurai: 'Tamil Nadu',
  salem: 'Tamil Nadu',
  tiruchirappalli: 'Tamil Nadu',
  mumbai: 'Maharashtra',
  bombay: 'Maharashtra',
  pune: 'Maharashtra',
  nagpur: 'Maharashtra',
  nashik: 'Maharashtra',
  aurangabad: 'Maharashtra',
  'chhatrapati sambhajinagar': 'Maharashtra',
  chakan: 'Maharashtra',
  sanaswadi: 'Maharashtra',
  bhosari: 'Maharashtra',
  thane: 'Maharashtra',
  'navi mumbai': 'Maharashtra',
  bengaluru: 'Karnataka',
  bangalore: 'Karnataka',
  mysuru: 'Karnataka',
  mangaluru: 'Karnataka',
  ahmedabad: 'Gujarat',
  sanand: 'Gujarat',
  vadodara: 'Gujarat',
  surat: 'Gujarat',
  halol: 'Gujarat',
  puducherry: 'Puducherry',
  pondicherry: 'Puducherry',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  hyderabad: 'Telangana',
  kolkata: 'West Bengal',
  jaipur: 'Rajasthan',
  lucknow: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  noida: 'Uttar Pradesh',
  gurugram: 'Haryana',
  gurgaon: 'Haryana',
  chandigarh: 'Chandigarh',
  dehradun: 'Uttarakhand',
};

export interface GeoValidationResult {
  isValid: boolean;
  error?: string;
  contradictionType?: 'PIN_STATE_MISMATCH' | 'CITY_STATE_MISMATCH' | 'IDENTIFIER_STATE_MISMATCH' | 'GENERAL_CONTRADICTION';
  details?: {
    pin?: string;
    city?: string;
    state?: string;
    identifierState?: string;
    expectedState?: string;
  };
}

/**
 * Validates a PIN code against state name and city name.
 */
export function validateIndianPostalCode(
  postalCode: string,
  stateName: string,
  cityName?: string
): GeoValidationResult {
  const cleanPin = (postalCode || '').trim().replace(/\D/g, '');
  const cleanState = (stateName || '').trim().toLowerCase();
  const cleanCity = (cityName || '').trim().toLowerCase();

  if (!cleanPin || cleanPin.length !== 6) {
    return {
      isValid: false,
      error: `Invalid Indian PIN code format: "${postalCode}". PIN code must be exactly 6 digits.`,
      contradictionType: 'GENERAL_CONTRADICTION',
    };
  }

  // 1. PIN Code 600001 specific check: Chennai GPO, Tamil Nadu
  if (cleanPin.startsWith('600') && cleanState.includes('maharashtra')) {
    return {
      isValid: false,
      error: `CRITICAL GEOGRAPHICAL CONTRADICTION: PIN code ${cleanPin} belongs to Chennai, Tamil Nadu. It cannot belong to state ${stateName}.`,
      contradictionType: 'PIN_STATE_MISMATCH',
      details: { pin: cleanPin, city: cityName, state: stateName, expectedState: 'Tamil Nadu' },
    };
  }

  // 2. State to PIN range check
  for (const [code, info] of Object.entries(INDIAN_STATE_PREFIX_MAP)) {
    if (info.stateName.toLowerCase() === cleanState) {
      const matchesPrefix = info.pinPrefixes.some((prefix) => cleanPin.startsWith(prefix));
      if (!matchesPrefix) {
        // Special case: Goa shares 403 with Maharashtra 40-44
        if (code === 'MH' && cleanPin.startsWith('403')) {
          return {
            isValid: false,
            error: `PIN code ${cleanPin} belongs to Goa, not Maharashtra.`,
            contradictionType: 'PIN_STATE_MISMATCH',
            details: { pin: cleanPin, state: stateName, expectedState: 'Goa' },
          };
        }
        return {
          isValid: false,
          error: `Geographical Contradiction: PIN code ${cleanPin} is not valid for state ${info.stateName} (expected prefixes: ${info.pinPrefixes.join(', ')}).`,
          contradictionType: 'PIN_STATE_MISMATCH',
          details: { pin: cleanPin, state: stateName, expectedState: info.stateName },
        };
      }
      break;
    }
  }

  // 3. City to State cross-check
  if (cleanCity && MAJOR_CITIES_STATE_MAP[cleanCity]) {
    const expectedState = MAJOR_CITIES_STATE_MAP[cleanCity];
    if (cleanState && !cleanState.includes(expectedState.toLowerCase())) {
      return {
        isValid: false,
        error: `Geographical Contradiction: City "${cityName}" is located in ${expectedState}, not ${stateName}.`,
        contradictionType: 'CITY_STATE_MISMATCH',
        details: { city: cityName, state: stateName, expectedState },
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates Udyam identifier state code against returned enterprise address.
 * e.g. UDYAM-MH-26-0287071 must have Maharashtra state.
 */
export function validateUdyamGeographicalConsistency(params: {
  udyamRegistrationNo: string;
  addressState: string;
  addressCity?: string;
  postalCode?: string;
}): GeoValidationResult {
  const { udyamRegistrationNo, addressState, addressCity, postalCode } = params;
  const parts = udyamRegistrationNo.toUpperCase().split('-');

  if (parts.length >= 2) {
    const statePrefix = parts[1]; // e.g. 'MH', 'TN', 'GJ'
    const stateInfo = INDIAN_STATE_PREFIX_MAP[statePrefix];

    if (stateInfo) {
      const cleanAddressState = (addressState || '').trim().toLowerCase();
      const expectedState = stateInfo.stateName.toLowerCase();

      if (!cleanAddressState.includes(expectedState)) {
        return {
          isValid: false,
          error: `Geographical Contradiction: Udyam Registration Number "${udyamRegistrationNo}" has state prefix "${statePrefix}" (${stateInfo.stateName}), but returned address indicates state "${addressState}".`,
          contradictionType: 'IDENTIFIER_STATE_MISMATCH',
          details: {
            identifierState: stateInfo.stateName,
            state: addressState,
            city: addressCity,
            pin: postalCode,
            expectedState: stateInfo.stateName,
          },
        };
      }
    }
  }

  // Cross-check postal code and city
  if (postalCode) {
    const pinCheck = validateIndianPostalCode(postalCode, addressState, addressCity);
    if (!pinCheck.isValid) {
      return pinCheck;
    }
  }

  return { isValid: true };
}
