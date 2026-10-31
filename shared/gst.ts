export interface GstAddressDetails {
  buildingNumber: string | null;
  buildingName: string | null;
  floor: string | null;
  street: string | null;
  locality: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  landmark: string | null;
  pincode: string | null;
}

export interface GstTaxpayerProfile {
  gstin: string;
  legalName: string;
  tradeName: string | null;
  status: string;
  taxpayerType: string | null;
  registrationDate: string | null;
  cancellationDate: string | null;
  stateCode: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  blockStatus: string | null;
  addressDetails: GstAddressDetails | null;
}

export interface GstVerificationResult {
  provider: string;
  endpoint: string;
  retrievedAt: string;
  gstin: string;
  creditsRemaining: number | null;
  profile: GstTaxpayerProfile;
}

export interface GstVerificationRecord extends GstVerificationResult {
  persisted: boolean;
  persistenceError?: string;
}

export interface GstFilingRecord {
  returnType: string;
  returnPeriod: string;
  filingStatus: string;
  filingDate: string | null;
  arn: string | null;
}

export interface GstFilingHistoryResult {
  provider: string;
  endpoint: string;
  retrievedAt: string;
  gstin: string;
  financialYear: string;
  creditsRemaining: number | null;
  returns: GstFilingRecord[];
}

export interface GstFilingHistoryRecord extends GstFilingHistoryResult {
  persisted: boolean;
  persistenceError?: string;
}

export interface GstApiErrorBody {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}
