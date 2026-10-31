import React, { useState } from 'react';
import {
  BusinessPartner,
  User,
  BPContactPerson,
  BPAddress,
  BPPaymentTerms,
  BPAccounting,
  BPAttachment,
  BPGovernanceLog,
} from '../../types';
import type {
  GstFilingHistoryRecord,
  GstVerificationRecord,
  GstVerificationResult,
} from '../../../shared/gst';
import {
  getAvailableFinancialYears,
  getIndianFinancialYear,
} from '../../../shared/financialYear';
import { isValidGstin, normalizeGstin } from '../../../shared/gstin';
import { fetchGstFilingHistory, verifyGstinOnServer } from '../../services/gstService';
import { printGstData } from '../../services/gstPrint';
import { normalizeStoredPartners, isStoredVerification } from '../../services/gstVerificationState';
import { INITIAL_BUSINESS_PARTNERS } from '../../data/seedData';
import {
  CASCADING_GEO_MASTERS,
  GST_STATE_CODES,
  SAP_B1_PROPERTIES,
  GeoCountry,
  GeoState,
  GeoDistrict,
  GeoCity,
} from '../../data/geoData';
import {
  Users2,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Building,
  Edit2,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  FileText,
  CreditCard,
  Briefcase,
  AlertTriangle,
  Upload,
  Trash2,
  Globe,
  DollarSign,
  Tag,
  CheckSquare,
  Square,
  BookOpen,
  Eye,
  Download,
  Lock,
  ShieldAlert,
  Printer,
} from 'lucide-react';

interface BusinessPartnerMasterViewProps {
  currentUser: User;
}

type PageNotice = {
  kind: 'success' | 'error' | 'warning';
  text: string;
};

const VERIFICATION_LOG_ACTION = 'GSTIN verified via third-party provider';

function stripPersistence(
  record: GstVerificationRecord,
): GstVerificationResult {
  const {
    persisted: _persisted,
    persistenceError: _persistenceError,
    ...verification
  } = record;
  return verification;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type TabType =
  | 'GENERAL'
  | 'CONTACTS'
  | 'ADDRESSES'
  | 'PAYMENT_TERMS'
  | 'ACCOUNTING'
  | 'PROPERTIES'
  | 'REMARKS'
  | 'ATTACHMENTS'
  | 'GOVERNANCE';

export const BusinessPartnerMasterView: React.FC<BusinessPartnerMasterViewProps> = ({
  currentUser,
}) => {
  const [bpList, setBpList] = useState<BusinessPartner[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_business_partners');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeStoredPartners(parsed as BusinessPartner[]);
        }
      }
    } catch (err) {
      console.error('Error loading business partners from localStorage:', err);
    }
    return INITIAL_BUSINESS_PARTNERS;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('kosh_business_partners', JSON.stringify(bpList));
    } catch (err) {
      console.error('Error saving business partners to localStorage:', err);
    }
  }, [bpList]);

  // Dynamic Geographic Masters State (Supports Add / Request Missing Geography)
  const [geoMasters, setGeoMasters] = useState<GeoCountry[]>(CASCADING_GEO_MASTERS);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [gstFilter, setGstFilter] = useState('ALL');

  // Active Modal & Tab State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectedBp, setInspectedBp] = useState<BusinessPartner | null>(null);
  const [editingBp, setEditingBp] = useState<BusinessPartner | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');

  // Master Form State
  const [bpForm, setBpForm] = useState<Partial<BusinessPartner>>({});
  const [contacts, setContacts] = useState<BPContactPerson[]>([]);
  const [addresses, setAddresses] = useState<BPAddress[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<BPPaymentTerms>({
    paymentTermsCode: 'NET30',
    creditLimit: 1000000,
    commitmentLimit: 1500000,
    priceList: 'Standard Sales Price 2026',
    discountPercent: 0,
  });
  const [accounting, setAccounting] = useState<BPAccounting>({
    controlAccount: '112000 - Accounts Receivable Trade (Hidden)',
    downPaymentAccount: '112500 - Customer Down Payment Advance',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '',
    ifscIban: '',
    withholdingTaxAllowed: false,
    tdsCategory: '194C - Payments to Contractors',
  });
  const [properties, setProperties] = useState<string[]>([]);
  const [remarks, setRemarks] = useState({
    internalNotes: '',
    specialInstructions: '',
    complianceComments: '',
  });
  const [attachments, setAttachments] = useState<BPAttachment[]>([]);
  const [governanceLogs, setGovernanceLogs] = useState<BPGovernanceLog[]>([]);

  // Strict GST Verification & Legal Name Match State
  const [gstLegalName, setGstLegalName] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<string>('');
  const [gstExceptionApproved, setGstExceptionApproved] = useState<boolean>(false);
  const [gstExceptionReason, setGstExceptionReason] = useState<string>('');

  // Cascading Address Sub-Form State for Address Tab inside Modal
  const [isAddressSubModalOpen, setIsAddressSubModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<BPAddress>({
    id: '',
    addressName: 'Primary Billing Office',
    addressType: 'BILL_TO',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai City',
    city: 'Mumbai',
    postalCode: '400001',
    streetAddress: '',
    isDefault: true,
  });

  // Contact Sub-Form State
  const [isContactSubModalOpen, setIsContactSubModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState<BPContactPerson>({
    id: '',
    name: '',
    title: 'Mr.',
    position: 'Procurement Manager',
    department: 'Supply Chain',
    mobile: '',
    email: '',
    isDefault: false,
  });

  // Manage Missing Geography Sub-Modal State
  const [isGeoSubModalOpen, setIsGeoSubModalOpen] = useState(false);
  const [geoLevelToAdd, setGeoLevelToAdd] = useState<'COUNTRY' | 'STATE' | 'DISTRICT' | 'CITY' | 'POSTAL'>('CITY');
  const [newGeoName, setNewGeoName] = useState('');
  const [newGeoCode, setNewGeoCode] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<PageNotice | null>(null);

  // Filing history is loaded only from the verified provider endpoint.
  const [filingYear, setFilingYear] = useState<string>(() => getIndianFinancialYear());
  const [filingHistory, setFilingHistory] =
    useState<GstFilingHistoryRecord | null>(null);
  const [filingHistoryError, setFilingHistoryError] = useState('');
  const [isLoadingFilings, setIsLoadingFilings] = useState(false);

  const availableFinancialYears = getAvailableFinancialYears();

  // Keep the inspector in sync when a table-level re-verification updates the list.
  React.useEffect(() => {
    if (!inspectedBp) return;
    const current = bpList.find((partner) => partner.id === inspectedBp.id);
    if (current && current !== inspectedBp) setInspectedBp(current);
  }, [bpList, inspectedBp]);

  // Helper getters for Cascading Location Selection using dynamic geoMasters
  const selectedCountryObj: GeoCountry | undefined = geoMasters.find(
    (c) => c.countryName === addressForm.country
  );
  const availableStates: GeoState[] = selectedCountryObj ? selectedCountryObj.states : [];

  const selectedStateObj: GeoState | undefined = availableStates.find(
    (s) => s.stateName === addressForm.state
  );
  const availableDistricts: GeoDistrict[] = selectedStateObj ? selectedStateObj.districts : [];

  const selectedDistrictObj: GeoDistrict | undefined = availableDistricts.find(
    (d) => d.districtName === addressForm.district
  );
  const availableCities: GeoCity[] = selectedDistrictObj ? selectedDistrictObj.cities : [];

  const selectedCityObj: GeoCity | undefined = availableCities.find(
    (c) => c.cityName === addressForm.city
  );
  const availablePostalCodes: string[] = selectedCityObj ? selectedCityObj.postalCodes : [];

  // State Code Mismatch calculation
  const currentGst = bpForm.gstinPan || '';
  const currentGstStateCode = currentGst.length >= 2 ? currentGst.slice(0, 2) : '';
  const currentPrimaryAddress = addresses.find((a) => a.isDefault) || addresses[0];
  const selectedStateName = currentPrimaryAddress ? currentPrimaryAddress.state : bpForm.state;
  const expectedGstStateName = GST_STATE_CODES[currentGstStateCode];
  const isGstStateMismatch =
    currentGstStateCode &&
    expectedGstStateName &&
    selectedStateName &&
    !expectedGstStateName.toLowerCase().includes(selectedStateName.toLowerCase()) &&
    !selectedStateName.toLowerCase().includes(expectedGstStateName.toLowerCase());

  // Open Modal for Create / Edit
  const handleOpenModal = (bp?: BusinessPartner) => {
    setErrorMsg('');
    setActiveTab('GENERAL');
    setGstLegalName('');
    setVerificationFeedback('');
    setGstExceptionApproved(false);
    setGstExceptionReason('');
    setPageNotice(null);
    setFilingHistory(null);
    setFilingHistoryError('');
    setIsLoadingFilings(false);
    setFilingYear(getIndianFinancialYear());

    if (bp) {
      const verification = bp.gstVerification;
      const isVerifiedWithProvider =
        bp.gstStatus === 'VERIFIED' && isStoredVerification(verification);

      setEditingBp(bp);
      setBpForm({
        bpCode: bp.bpCode,
        bpName: bp.bpName,
        bpType: bp.bpType,
        foreignName: bp.foreignName || '',
        groupIndustry: bp.groupIndustry || 'Automotive OEM',
        currency: bp.currency || 'INR',
        gstinPan: bp.gstinPan || '',
        panNumber: bp.panNumber || '',
        phone: bp.phone || '',
        email: bp.email || '',
        website: bp.website || '',
        salesperson: bp.salesperson || currentUser.fullName,
        city: bp.city || '',
        state: bp.state || '',
        country: bp.country || 'India',
        district: bp.district || '',
        postalCode: bp.postalCode || '',
        status: bp.status,
        gstStatus: isVerifiedWithProvider
          ? 'VERIFIED'
          : bp.gstStatus === 'EXEMPT'
          ? 'EXEMPT'
          : 'UNVERIFIED',
        gstVerification: isVerifiedWithProvider ? verification : undefined,
      });
      if (isVerifiedWithProvider && verification) {
        setGstLegalName(verification.profile.legalName);
        setVerificationFeedback(
          `Verified via ${verification.provider} on ${formatTimestamp(
            verification.retrievedAt,
          )}. Registration status: ${verification.profile.status}.`,
        );
      }
      setContacts(bp.contacts || []);
      setAddresses(
        bp.addresses || [
          {
            id: `addr-${Date.now()}`,
            addressName: 'Registered Corporate Office',
            addressType: 'BILL_TO',
            country: bp.country || 'India',
            state: bp.state || 'Maharashtra',
            district: bp.district || 'Mumbai City',
            city: bp.city || 'Mumbai',
            postalCode: bp.postalCode || '400001',
            streetAddress: 'Main Office Complex',
            isDefault: true,
          },
        ]
      );
      setPaymentTerms(
        bp.paymentTerms || {
          paymentTermsCode: 'NET30',
          creditLimit: 1000000,
          commitmentLimit: 1500000,
          priceList: 'Standard Sales Price 2026',
          discountPercent: 0,
        }
      );
      setAccounting(
        bp.accounting || {
          controlAccount: '112000 - Accounts Receivable Trade (Hidden)',
          downPaymentAccount: '112500 - Customer Down Payment Advance',
          bankName: 'HDFC Bank Ltd',
          accountNumber: '',
          ifscIban: '',
          withholdingTaxAllowed: false,
          tdsCategory: '194C - Payments to Contractors',
        }
      );
      setProperties(bp.properties || []);
      setRemarks({
        internalNotes: bp.remarks?.internalNotes || '',
        specialInstructions: bp.remarks?.specialInstructions || '',
        complianceComments: bp.remarks?.complianceComments || '',
      });
      setAttachments(bp.attachments || []);
      setGovernanceLogs(bp.governanceLogs || []);
    } else {
      setEditingBp(null);
      const defaultCode = `BP-${Date.now().toString().slice(-4)}`;
      setBpForm({
        bpCode: defaultCode,
        bpName: '',
        bpType: 'CUSTOMER',
        foreignName: '',
        groupIndustry: 'Automotive OEM',
        currency: 'INR',
        gstinPan: '',
        panNumber: '',
        phone: '+91 ',
        email: '',
        website: '',
        salesperson: currentUser.fullName,
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        district: 'Mumbai City',
        postalCode: '400001',
        status: 'ACTIVE',
        gstStatus: 'UNVERIFIED',
        gstVerification: undefined,
      });
      setContacts([
        {
          id: `c-${Date.now()}`,
          name: 'Primary Contact Person',
          title: 'Mr.',
          position: 'Purchase Manager',
          department: 'Procurement',
          mobile: '+91 98000 00000',
          email: 'contact@partner.com',
          isDefault: true,
        },
      ]);
      setAddresses([
        {
          id: `addr-${Date.now()}`,
          addressName: 'Registered Corporate Office',
          addressType: 'BILL_TO',
          country: 'India',
          state: 'Maharashtra',
          district: 'Mumbai City',
          city: 'Mumbai',
          postalCode: '400001',
          streetAddress: 'Plot 100, MIDC Industrial Hub',
          isDefault: true,
        },
      ]);
      setPaymentTerms({
        paymentTermsCode: 'NET30',
        creditLimit: 1000000,
        commitmentLimit: 1500000,
        priceList: 'Standard Sales Price 2026',
        discountPercent: 0,
      });
      setAccounting({
        controlAccount: '112000 - Accounts Receivable Trade (Hidden)',
        downPaymentAccount: '112500 - Customer Down Payment Advance',
        bankName: 'HDFC Bank Ltd',
        accountNumber: '50200099887766',
        ifscIban: 'HDFC0000012',
        withholdingTaxAllowed: true,
        tdsCategory: '194C - Payments to Contractors',
      });
      setProperties(['VIP Account']);
      setRemarks({
        internalNotes: 'Created via Master Data Portal',
        specialInstructions: 'Standard Delivery Rules Apply',
        complianceComments: 'Documents verified',
      });
      setAttachments([]);
      setGovernanceLogs([]);
    }
    setIsModalOpen(true);
  };

  // Reset GST verification state if critical fields change
  const handleBpNameChange = (val: string) => {
    setBpForm((prev) => ({
      ...prev,
      bpName: val,
      gstStatus: 'UNVERIFIED',
      gstVerification: undefined,
    }));
    setGstLegalName('');
    setVerificationFeedback('');
  };

  const handleGstinChange = (val: string) => {
    setBpForm((prev) => ({
      ...prev,
      gstinPan: val,
      gstStatus: 'UNVERIFIED',
      gstVerification: undefined,
    }));
    setGstLegalName('');
    setVerificationFeedback('');
    setFilingHistory(null);
    setFilingHistoryError('');
  };

  // Open Inspector
  const handleInspectBp = (bp: BusinessPartner) => {
    setInspectedBp(bp);
    setActiveTab('GENERAL');
    setIsInspectorOpen(true);
  };

  // Save Business Partner (WITH STRICT SAVE GATE & STATE MISMATCH CHECK)
  const handleSaveBp = () => {
    if (!bpForm.bpCode?.trim() || !bpForm.bpName?.trim()) {
      setErrorMsg('BP CardCode and Business Partner Name are required.');
      return;
    }

    // STATE MISMATCH CHECK (DEFECT FIX ENFORCEMENT)
    if (isGstStateMismatch && !gstExceptionApproved) {
      setErrorMsg(
        `SAVE BLOCKED: GSTIN State Code (${currentGstStateCode} - ${expectedGstStateName}) does not match Primary Address State (${selectedStateName}). Please correct State or check "Approve Multi-State GST Exception" with justification.`
      );
      setBpForm((prev) => ({ ...prev, gstStatus: 'FAILED' }));
      return;
    }

    // STRICT SAVE GATE ENFORCEMENT
    if (bpForm.gstStatus !== 'VERIFIED' && bpForm.gstStatus !== 'EXEMPT') {
      setErrorMsg(
        'SAVE BLOCKED: Business Partner GSTIN must be verified before saving. Please run "Verify GST" in Tab 1 or Tab 9.'
      );
      return;
    }

    // Default primary address values from address list
    const primaryAddress = addresses.find((a) => a.isDefault) || addresses[0];
    const city = primaryAddress ? primaryAddress.city : bpForm.city || 'Mumbai';
    const state = primaryAddress ? primaryAddress.state : bpForm.state || 'Maharashtra';
    const country = primaryAddress ? primaryAddress.country : bpForm.country || 'India';
    const district = primaryAddress ? primaryAddress.district : bpForm.district || 'Mumbai City';
    const postalCode = primaryAddress ? primaryAddress.postalCode : bpForm.postalCode || '400001';

    if (editingBp) {
      setBpList((prev) =>
        prev.map((b) =>
          b.id === editingBp.id
            ? {
                ...b,
                bpCode: bpForm.bpCode!.toUpperCase().trim(),
                bpName: bpForm.bpName!.toUpperCase().trim(),
                bpType: bpForm.bpType || 'CUSTOMER',
                foreignName: bpForm.foreignName,
                groupIndustry: bpForm.groupIndustry,
                currency: bpForm.currency,
                gstinPan: bpForm.gstinPan?.toUpperCase().trim() || '',
                panNumber: bpForm.panNumber?.toUpperCase().trim() || '',
                phone: bpForm.phone || '',
                email: bpForm.email || '',
                website: bpForm.website,
                salesperson: bpForm.salesperson,
                city,
                state,
                country,
                district,
                postalCode,
                status: bpForm.status || 'ACTIVE',
                gstStatus: bpForm.gstVerification
                  ? 'VERIFIED'
                  : bpForm.gstStatus === 'EXEMPT'
                  ? 'EXEMPT'
                  : 'UNVERIFIED',
                gstVerification: bpForm.gstVerification,
                contacts,
                addresses,
                paymentTerms,
                accounting,
                properties,
                remarks,
                attachments,
                governanceLogs,
                updatedAt: new Date().toISOString(),
              }
            : b
        )
      );
    } else {
      if (bpList.some((b) => b.bpCode.toLowerCase() === bpForm.bpCode!.trim().toLowerCase())) {
        setErrorMsg(`BP Code "${bpForm.bpCode}" already exists.`);
        return;
      }

      const newBp: BusinessPartner = {
        id: `bp-${Date.now()}`,
        bpCode: bpForm.bpCode!.toUpperCase().trim(),
        bpName: bpForm.bpName!.toUpperCase().trim(),
        bpType: bpForm.bpType || 'CUSTOMER',
        foreignName: bpForm.foreignName,
        groupIndustry: bpForm.groupIndustry,
        currency: bpForm.currency,
        gstinPan: bpForm.gstinPan?.toUpperCase().trim() || '',
        panNumber: bpForm.panNumber?.toUpperCase().trim() || '',
        gstStatus: bpForm.gstVerification
          ? 'VERIFIED'
          : bpForm.gstStatus === 'EXEMPT'
          ? 'EXEMPT'
          : 'UNVERIFIED',
        gstVerification: bpForm.gstVerification,
        phone: bpForm.phone || '',
        email: bpForm.email || '',
        website: bpForm.website,
        salesperson: bpForm.salesperson || currentUser.fullName,
        city,
        state,
        country,
        district,
        postalCode,
        status: bpForm.status || 'ACTIVE',
        sapSyncStatus: 'PENDING',
        contacts,
        addresses,
        paymentTerms,
        accounting,
        properties,
        remarks,
        attachments,
        governanceLogs: bpForm.gstVerification
          ? [
              {
                id: `gov-${Date.now()}`,
                timestamp: bpForm.gstVerification.retrievedAt,
                action: VERIFICATION_LOG_ACTION,
                verifier: currentUser.fullName,
                details: `GSTIN ${bpForm.gstVerification.gstin} verified via ${
                  bpForm.gstVerification.provider
                }. Provider legal name: ${
                  bpForm.gstVerification.profile.legalName
                }. Registration status: ${
                  bpForm.gstVerification.profile.status
                }.${
                  gstExceptionApproved
                    ? ` Multi-state exception approved: ${gstExceptionReason}`
                    : ''
                }`,
                status: 'VERIFIED',
              },
            ]
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
      };
      setBpList([newBp, ...bpList]);
    }

    setIsModalOpen(false);
  };

  const loadFilingHistory = async (gstin: string, financialYear: string) => {
    const normalized = normalizeGstin(gstin);

    setFilingYear(financialYear);
    setFilingHistory(null);
    setFilingHistoryError('');
    setIsLoadingFilings(true);

    try {
      const result = await fetchGstFilingHistory(normalized, financialYear);
      setFilingHistory(result);

      if (!result.persisted) {
        setPageNotice({
          kind: 'warning',
          text: `Filing history was retrieved from the provider but ${
            result.persistenceError ?? 'could not be saved to the database.'
          }`,
        });
      }
    } catch (error) {
      setFilingHistoryError(
        error instanceof Error
          ? error.message
          : 'GST filing history could not be retrieved.',
      );
    } finally {
      setIsLoadingFilings(false);
    }
  };

  // Table Level Verification Handler
  const handleVerifyGst = async (id: string, customGstin?: string) => {
    const partner = bpList.find((entry) => entry.id === id);
    const targetGst = normalizeGstin(customGstin ?? partner?.gstinPan ?? '');

    if (!targetGst) {
      setPageNotice({
        kind: 'error',
        text: 'This Business Partner has no GSTIN to verify.',
      });
      return;
    }

    if (!isValidGstin(targetGst)) {
      const now = new Date().toISOString();
      setBpList((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                gstStatus: 'FAILED',
                gstVerification: undefined,
                updatedAt: now,
              }
            : entry,
        ),
      );
      setPageNotice({
        kind: 'error',
        text: `GSTIN ${targetGst} has an invalid format or check digit. No provider request was made.`,
      });
      return;
    }

    setVerifyingId(id);
    setPageNotice(null);

    try {
      const record = await verifyGstinOnServer(targetGst);
      const verification = stripPersistence(record);
      const logEntry: BPGovernanceLog = {
        id: `gov-${Date.now()}`,
        timestamp: verification.retrievedAt,
        action: VERIFICATION_LOG_ACTION,
        verifier: currentUser.fullName,
        details: `GSTIN ${verification.gstin} verified via ${verification.provider}. Provider legal name: ${verification.profile.legalName}. Registration status: ${verification.profile.status}.`,
        status: 'VERIFIED',
      };

      setBpList((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                gstinPan: targetGst,
                gstStatus: 'VERIFIED',
                gstVerification: verification,
                updatedAt: new Date().toISOString(),
                governanceLogs: [logEntry, ...(entry.governanceLogs || [])],
              }
            : entry,
        ),
      );

      setPageNotice(
        record.persisted
          ? {
              kind: 'success',
              text: `GSTIN ${targetGst} verified via ${verification.provider}.`,
            }
          : {
              kind: 'warning',
              text: `GSTIN ${targetGst} was verified via ${verification.provider}, but ${
                record.persistenceError ?? 'the result could not be saved.'
              }`,
            },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'GST verification failed.';
      const now = new Date().toISOString();

      setBpList((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                gstStatus: 'FAILED',
                gstVerification: undefined,
                updatedAt: now,
              }
            : entry,
        ),
      );
      setPageNotice({
        kind: 'error',
        text: `GST verification failed for ${targetGst}: ${message}`,
      });
    } finally {
      setVerifyingId(null);
    }
  };

  // Form verification handler. A VERIFIED status is only ever set from a
  // validated provider response returned by the Koshit API.
  const handleVerifyGstInModal = async () => {
    setErrorMsg('');
    setPageNotice(null);

    if (!bpForm.gstinPan?.trim()) {
      setErrorMsg('Please enter a GSTIN number to verify.');
      return;
    }

    const gstin = normalizeGstin(bpForm.gstinPan);

    if (!isValidGstin(gstin)) {
      setBpForm((prev) => ({
        ...prev,
        gstStatus: 'FAILED',
        gstVerification: undefined,
      }));
      setGstLegalName('');
      setVerificationFeedback(
        'Invalid GSTIN format or check digit. No provider request was made.',
      );
      setErrorMsg(
        'VERIFICATION FAILED: The GSTIN format or check digit is invalid. Save is blocked.',
      );
      return;
    }

    if (isGstStateMismatch && !gstExceptionApproved) {
      setBpForm((prev) => ({
        ...prev,
        gstStatus: 'FAILED',
        gstVerification: undefined,
      }));
      setVerificationFeedback(
        `GST State Code Mismatch Error: GSTIN starts with State Code ${currentGstStateCode} (${expectedGstStateName}), but Primary Address State is ${selectedStateName}. Save is BLOCKED.`,
      );
      setErrorMsg(
        `SAVE BLOCKED: GSTIN State Code (${currentGstStateCode} - ${expectedGstStateName}) does not match Primary Address State (${selectedStateName}). Check Exception or correct State.`,
      );
      return;
    }

    setVerifyingId('MODAL');

    try {
      const record = await verifyGstinOnServer(gstin);
      const verification = stripPersistence(record);
      const logEntry: BPGovernanceLog = {
        id: `gov-${Date.now()}`,
        timestamp: verification.retrievedAt,
        action: VERIFICATION_LOG_ACTION,
        verifier: currentUser.fullName,
        details: `GSTIN ${verification.gstin} verified via ${
          verification.provider
        }. Provider legal name: ${
          verification.profile.legalName
        }. Registration status: ${verification.profile.status}.${
          gstExceptionApproved
            ? ` Multi-state exception approved: ${gstExceptionReason}`
            : ''
        }`,
        status: 'VERIFIED',
      };

      setBpForm((prev) => ({
        ...prev,
        gstinPan: gstin,
        gstStatus: 'VERIFIED',
        gstVerification: verification,
      }));
      setGstLegalName(verification.profile.legalName);
      setVerificationFeedback(
        `Verified via ${verification.provider} on ${formatTimestamp(
          verification.retrievedAt,
        )}. Provider legal name: ${
          verification.profile.legalName
        }. Registration status: ${verification.profile.status}.`,
      );
      setGovernanceLogs((prev) => [logEntry, ...prev]);
      setPageNotice(
        record.persisted
          ? {
              kind: 'success',
              text: `GSTIN ${gstin} verified via ${verification.provider}.`,
            }
          : {
              kind: 'warning',
              text: `GSTIN ${gstin} was verified via ${verification.provider}, but ${
                record.persistenceError ?? 'the result could not be saved.'
              }`,
            },
      );

      await loadFilingHistory(gstin, filingYear);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'GST verification failed.';

      setBpForm((prev) => ({
        ...prev,
        gstStatus: 'FAILED',
        gstVerification: undefined,
      }));
      setGstLegalName('');
      setVerificationFeedback(message);
      setErrorMsg(`GST verification failed: ${message}`);
      setPageNotice({ kind: 'error', text: message });
    } finally {
      setVerifyingId(null);
    }
  };

  // Property Toggle Handler
  const toggleProperty = (propName: string) => {
    if (properties.includes(propName)) {
      setProperties(properties.filter((p) => p !== propName));
    } else {
      setProperties([...properties, propName]);
    }
  };

  // Address Cascading Handlers
  const handleCountryChange = (countryName: string) => {
    const country = geoMasters.find((c) => c.countryName === countryName);
    const firstState = country?.states[0];
    const firstDistrict = firstState?.districts[0];
    const firstCity = firstDistrict?.cities[0];
    const firstPostal = firstCity?.postalCodes[0] || '000000';

    setAddressForm({
      ...addressForm,
      country: countryName,
      state: firstState ? firstState.stateName : '',
      district: firstDistrict ? firstDistrict.districtName : '',
      city: firstCity ? firstCity.cityName : '',
      postalCode: firstPostal,
    });
  };

  const handleStateChange = (stateName: string) => {
    const stateObj = availableStates.find((s) => s.stateName === stateName);
    const firstDistrict = stateObj?.districts[0];
    const firstCity = firstDistrict?.cities[0];
    const firstPostal = firstCity?.postalCodes[0] || '000000';

    setAddressForm({
      ...addressForm,
      state: stateName,
      district: firstDistrict ? firstDistrict.districtName : '',
      city: firstCity ? firstCity.cityName : '',
      postalCode: firstPostal,
    });
  };

  const handleDistrictChange = (districtName: string) => {
    const districtObj = availableDistricts.find((d) => d.districtName === districtName);
    const firstCity = districtObj?.cities[0];
    const firstPostal = firstCity?.postalCodes[0] || '000000';

    setAddressForm({
      ...addressForm,
      district: districtName,
      city: firstCity ? firstCity.cityName : '',
      postalCode: firstPostal,
    });
  };

  const handleCityChange = (cityName: string) => {
    const cityObj = availableCities.find((c) => c.cityName === cityName);
    const firstPostal = cityObj?.postalCodes[0] || '000000';

    setAddressForm({
      ...addressForm,
      city: cityName,
      postalCode: firstPostal,
    });
  };

  // Open Manage Missing Geography Sub-Modal
  const handleOpenAddMissingGeoModal = (
    level: 'COUNTRY' | 'STATE' | 'DISTRICT' | 'CITY' | 'POSTAL'
  ) => {
    setGeoLevelToAdd(level);
    setNewGeoName('');
    setNewGeoCode('');
    setIsGeoSubModalOpen(true);
  };

  // Save Missing Geography Master Value
  const handleSaveMissingGeo = () => {
    if (!newGeoName.trim()) {
      alert('Please enter a name for the missing geographic value.');
      return;
    }

    const name = newGeoName.trim();
    const code = newGeoCode.trim().toUpperCase() || name.slice(0, 3).toUpperCase();

    const updatedGeo = [...geoMasters];

    if (geoLevelToAdd === 'COUNTRY') {
      updatedGeo.push({
        countryCode: code,
        countryName: name,
        states: [
          {
            stateName: `${name} Central State`,
            districts: [
              {
                districtName: `${name} Central District`,
                cities: [{ cityName: `${name} Capital`, postalCodes: ['100001'] }],
              },
            ],
          },
        ],
      });
      setGeoMasters(updatedGeo);
      handleCountryChange(name);
    } else if (geoLevelToAdd === 'STATE') {
      const countryIdx = updatedGeo.findIndex((c) => c.countryName === addressForm.country);
      if (countryIdx !== -1) {
        updatedGeo[countryIdx].states.push({
          stateName: name,
          stateCode: code,
          districts: [
            {
              districtName: `${name} Main District`,
              cities: [{ cityName: `${name} City`, postalCodes: ['200001'] }],
            },
          ],
        });
        setGeoMasters(updatedGeo);
        handleStateChange(name);
      }
    } else if (geoLevelToAdd === 'DISTRICT') {
      const countryIdx = updatedGeo.findIndex((c) => c.countryName === addressForm.country);
      if (countryIdx !== -1) {
        const stateIdx = updatedGeo[countryIdx].states.findIndex(
          (s) => s.stateName === addressForm.state
        );
        if (stateIdx !== -1) {
          updatedGeo[countryIdx].states[stateIdx].districts.push({
            districtName: name,
            cities: [{ cityName: `${name} Town`, postalCodes: ['300001'] }],
          });
          setGeoMasters(updatedGeo);
          handleDistrictChange(name);
        }
      }
    } else if (geoLevelToAdd === 'CITY') {
      const countryIdx = updatedGeo.findIndex((c) => c.countryName === addressForm.country);
      if (countryIdx !== -1) {
        const stateIdx = updatedGeo[countryIdx].states.findIndex(
          (s) => s.stateName === addressForm.state
        );
        if (stateIdx !== -1) {
          const distIdx = updatedGeo[countryIdx].states[stateIdx].districts.findIndex(
            (d) => d.districtName === addressForm.district
          );
          if (distIdx !== -1) {
            updatedGeo[countryIdx].states[stateIdx].districts[distIdx].cities.push({
              cityName: name,
              postalCodes: [code || '400001'],
            });
            setGeoMasters(updatedGeo);
            handleCityChange(name);
          }
        }
      }
    } else if (geoLevelToAdd === 'POSTAL') {
      setAddressForm({ ...addressForm, postalCode: code || name });
    }

    setIsGeoSubModalOpen(false);
  };

  // Save Address Sub-Modal
  const handleSaveAddress = () => {
    if (!addressForm.addressName.trim() || !addressForm.streetAddress.trim()) {
      alert('Address Name and Street Address are required.');
      return;
    }

    if (addressForm.isDefault) {
      setAddresses(addresses.map((a) => ({ ...a, isDefault: false })));
    }

    if (addressForm.id) {
      setAddresses((prev) => prev.map((a) => (a.id === addressForm.id ? { ...addressForm } : a)));
    } else {
      setAddresses((prev) => [...prev, { ...addressForm, id: `addr-${Date.now()}` }]);
    }

    setIsAddressSubModalOpen(false);
  };

  // Save Contact Sub-Modal
  const handleSaveContact = () => {
    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      alert('Contact Name and Email are required.');
      return;
    }

    if (contactForm.isDefault) {
      setContacts(contacts.map((c) => ({ ...c, isDefault: false })));
    }

    if (contactForm.id) {
      setContacts((prev) => prev.map((c) => (c.id === contactForm.id ? { ...contactForm } : c)));
    } else {
      setContacts((prev) => [...prev, { ...contactForm, id: `c-${Date.now()}` }]);
    }

    setIsContactSubModalOpen(false);
  };

  // Simulated Document Upload
  const handleSimulatedUpload = (docType: string) => {
    const fileName = `${bpForm.bpCode || 'BP'}_${docType.replace(/\s+/g, '_')}.pdf`;
    const newAtt: BPAttachment = {
      id: `att-${Date.now()}`,
      docType,
      fileName,
      fileSizeBytes: Math.floor(Math.random() * 1500000) + 200000,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.fullName,
    };
    setAttachments([newAtt, ...attachments]);
  };

  const filteredBps = bpList.filter((b) => {
    const matchesType = typeFilter === 'ALL' || b.bpType === typeFilter;
    const matchesGst =
      gstFilter === 'ALL' ||
      (gstFilter === 'VERIFIED' ? b.gstStatus === 'VERIFIED' : b.gstStatus !== 'VERIFIED');
    const matchesSearch =
      b.bpCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bpName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.gstinPan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesGst && matchesSearch;
  });

  const isSaveDisabled = Boolean(
    (bpForm.gstStatus !== 'VERIFIED' && bpForm.gstStatus !== 'EXEMPT') ||
    (isGstStateMismatch && !gstExceptionApproved)
  );

  const handlePrintGst = (partner: BusinessPartner) => {
    const verification = partner.gstVerification;

    if (partner.gstStatus !== 'VERIFIED' || !verification) {
      setPageNotice({
        kind: 'error',
        text: 'GST data cannot be printed until the GSTIN has been verified by the provider.',
      });
      return;
    }

    const matchingHistory =
      filingHistory &&
      filingHistory.gstin === verification.gstin &&
      filingHistory.financialYear === filingYear
        ? filingHistory
        : null;

    try {
      printGstData({
        businessPartner: partner,
        verification,
        filingHistory: matchingHistory
          ? {
              financialYear: matchingHistory.financialYear,
              retrievedAt: matchingHistory.retrievedAt,
              returns: matchingHistory.returns,
            }
          : null,
      });
    } catch (error) {
      setPageNotice({
        kind: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'The GST printout could not be opened.',
      });
    }
  };

  const renderFilingHistoryPanel = (gstin: string) => {
    const normalized = normalizeGstin(gstin);
    const matchingResult =
      filingHistory && filingHistory.gstin === normalized ? filingHistory : null;

    return (
      <div className="border rounded-xl p-3 bg-white space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="font-bold text-slate-900 text-xs">
              GST filing history (third-party provider)
            </h5>
            <p className="text-[10px] text-slate-500">
              Loaded on demand. An empty result stays empty; a provider failure
              is shown as a failure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filingYear}
              onChange={(event) => {
                setFilingYear(event.target.value);
                setFilingHistory(null);
                setFilingHistoryError('');
              }}
              className="text-xs p-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold"
            >
              {availableFinancialYears.map((year) => (
                <option key={year} value={year}>
                  FY {year}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadFilingHistory(normalized, filingYear)}
              disabled={isLoadingFilings || !normalized}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingFilings ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Load returns
            </button>
          </div>
        </div>

        {filingHistoryError ? (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-semibold flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Filing history unavailable: {filingHistoryError}</span>
          </div>
        ) : isLoadingFilings ? (
          <p className="text-slate-500 italic">Retrieving filing history…</p>
        ) : !matchingResult ? (
          <p className="text-slate-400 italic">
            Select a financial year and load returns to view provider data.
          </p>
        ) : matchingResult.returns.length === 0 ? (
          <p className="text-slate-500 italic">
            The provider returned no filing records for FY{' '}
            {matchingResult.financialYear}.
          </p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                  <th className="p-2">Return type</th>
                  <th className="p-2">Return period</th>
                  <th className="p-2">Filing status</th>
                  <th className="p-2">Filing date</th>
                  <th className="p-2">ARN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchingResult.returns.map((record) => (
                  <tr
                    key={`${record.returnType}-${record.returnPeriod}`}
                    className="text-[11px] text-slate-700"
                  >
                    <td className="p-2 font-semibold">{record.returnType}</td>
                    <td className="p-2 font-mono">{record.returnPeriod}</td>
                    <td className="p-2">{record.filingStatus}</td>
                    <td className="p-2">{record.filingDate || 'Unavailable'}</td>
                    <td className="p-2 font-mono">{record.arn || 'Unavailable'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {matchingResult && (
          <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Source: {matchingResult.provider}</span>
            <span>Retrieved: {formatTimestamp(matchingResult.retrievedAt)}</span>
            {matchingResult.creditsRemaining !== null && (
              <span>Provider credits remaining: {matchingResult.creditsRemaining}</span>
            )}
            {!matchingResult.persisted && (
              <span className="text-amber-700 font-bold">
                Not saved: {matchingResult.persistenceError}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 text-xs select-none font-sans">
      {/* Title Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-600" />
            Business Partner Master
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Full SAP Business One 9-Tab BP Interface: Customers, Suppliers/Vendors, Leads,
            Geographic Cascading & third-party GSTIN verification before save.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Business Partner
        </button>
      </div>

      {pageNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-start justify-between gap-3 ${
            pageNotice.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : pageNotice.kind === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{pageNotice.text}</span>
          <button
            type="button"
            onClick={() => setPageNotice(null)}
            className="font-bold opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search CardCode, Name, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All BP Types</option>
            <option value="CUSTOMER">Customer (CUST)</option>
            <option value="SUPPLIER">Supplier / Vendor (VEND)</option>
            <option value="LEAD">Lead / Prospect</option>
          </select>

          <select
            value={gstFilter}
            onChange={(e) => setGstFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">GSTIN Status (All)</option>
            <option value="VERIFIED">GSTIN Verified</option>
            <option value="UNVERIFIED">Unverified / Pending</option>
          </select>
        </div>

        <span className="text-slate-500 font-medium">
          Showing <strong>{filteredBps.length}</strong> of <strong>{bpList.length}</strong> Business Partners
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3.5">BP Type</th>
                <th className="p-3.5">BP CardCode</th>
                <th className="p-3.5">Business Partner Name</th>
                <th className="p-3.5">GSTIN / PAN</th>
                <th className="p-3.5">Primary Location</th>
                <th className="p-3.5">SAP Status</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No business partners found matching filters.
                  </td>
                </tr>
              ) : (
                filteredBps.map((bp) => (
                  <tr key={bp.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          bp.bpType === 'CUSTOMER'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : bp.bpType === 'SUPPLIER'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {bp.bpType}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-indigo-700">{bp.bpCode}</td>
                    <td className="p-3.5 font-bold text-slate-900">
                      <div>{bp.bpName}</div>
                      {bp.groupIndustry && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          {bp.groupIndustry}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-800 font-semibold">{bp.gstinPan || '—'}</span>
                        {bp.gstStatus === 'VERIFIED' ? (
                          <span
                            className="text-emerald-600 flex items-center gap-0.5"
                            title={
                              bp.gstVerification
                                ? `GSTIN verified via ${bp.gstVerification.provider} on ${formatTimestamp(
                                    bp.gstVerification.retrievedAt,
                                  )}`
                                : 'GSTIN status is not backed by provider data'
                            }
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            disabled={verifyingId === bp.id}
                            onClick={() => handleVerifyGst(bp.id)}
                            className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer font-bold flex items-center gap-1"
                          >
                            {verifyingId === bp.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              'Verify GST'
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div>
                        {bp.city}, {bp.state}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bp.phone}</div>
                    </td>
                    <td className="p-3.5">
                      {bp.sapSyncStatus === 'SYNCED' ? (
                        <span className="text-emerald-700 font-mono text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {bp.sapBpCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-mono">Pending Sync</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {bp.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleInspectBp(bp)}
                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                        title="View Full SAP Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(bp)}
                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                        title="Edit Business Partner"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MULTI-TAB INSPECTOR MODAL */}
      {isInspectorOpen && inspectedBp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Building className="w-6 h-6 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    {inspectedBp.bpName}
                    <span className="font-mono text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">
                      {inspectedBp.bpCode}
                    </span>
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    BP Type: <strong>{inspectedBp.bpType}</strong> | Group:{' '}
                    {inspectedBp.groupIndustry || 'OEM'} | SAP Sync:{' '}
                    <strong>{inspectedBp.sapSyncStatus}</strong> ({inspectedBp.sapBpCode || 'N/A'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 flex overflow-x-auto gap-1 text-[11px] font-bold text-slate-600 pt-2">
              {[
                { key: 'GENERAL', label: '1. General', icon: FileText },
                { key: 'CONTACTS', label: '2. Contacts', icon: Users2 },
                { key: 'ADDRESSES', label: '3. Addresses (Cascading)', icon: MapPin },
                { key: 'PAYMENT_TERMS', label: '4. Payment Terms', icon: CreditCard },
                { key: 'ACCOUNTING', label: '5. Accounting', icon: DollarSign },
                { key: 'PROPERTIES', label: '6. Properties (Flags)', icon: Tag },
                { key: 'REMARKS', label: '7. Remarks', icon: BookOpen },
                { key: 'ATTACHMENTS', label: '8. Attachments', icon: Download },
                { key: 'GOVERNANCE', label: '9. Governance & GST', icon: ShieldCheck },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as TabType)}
                    className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                      isActive
                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                        : 'border-transparent hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      CardCode / BP Code
                    </span>
                    <span className="font-mono font-bold text-indigo-700 text-sm">
                      {inspectedBp.bpCode}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg col-span-2">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      Business Partner Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{inspectedBp.bpName}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      Foreign Name
                    </span>
                    <span className="font-semibold text-slate-800">
                      {inspectedBp.foreignName || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      Industry / Group
                    </span>
                    <span className="font-semibold text-slate-800">
                      {inspectedBp.groupIndustry || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      Account Currency
                    </span>
                    <span className="font-bold text-slate-800">{inspectedBp.currency || 'INR'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg font-mono">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      GSTIN / Federal Tax ID
                    </span>
                    <span className="font-bold text-slate-900">
                      {inspectedBp.gstinPan || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg font-mono">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      PAN Number
                    </span>
                    <span className="font-bold text-slate-900">
                      {inspectedBp.panNumber || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-lg">
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                      Account Salesperson
                    </span>
                    <span className="font-semibold text-slate-800">
                      {inspectedBp.salesperson || '—'}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'CONTACTS' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs">Registered Contact Persons</h4>
                  {!inspectedBp.contacts || inspectedBp.contacts.length === 0 ? (
                    <p className="text-slate-400 italic">No contact persons registered.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {inspectedBp.contacts.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 border rounded-xl bg-slate-50 space-y-1 relative"
                        >
                          {c.isDefault && (
                            <span className="absolute top-2 right-2 text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                              DEFAULT CONTACT
                            </span>
                          )}
                          <div className="font-bold text-slate-900 text-xs">
                            {c.title} {c.name}
                          </div>
                          <div className="text-slate-500 font-medium">
                            {c.position} ({c.department})
                          </div>
                          <div className="text-slate-600 flex items-center gap-3 pt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {c.mobile}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {c.email}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ADDRESSES' && (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-medium text-[11px]">
                    <strong>Strict Cascading Field Hierarchy Applied:</strong> 1. Country → 2. State
                    / Province → 3. District → 4. City → 5. Postal Code.
                  </div>
                  {!inspectedBp.addresses || inspectedBp.addresses.length === 0 ? (
                    <p className="text-slate-400 italic">No addresses defined.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {inspectedBp.addresses.map((a) => (
                        <div
                          key={a.id}
                          className="p-3.5 border rounded-xl bg-slate-50 space-y-1.5 relative"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{a.addressName}</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                                a.addressType === 'BILL_TO'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {a.addressType === 'BILL_TO' ? 'BILL TO' : 'SHIP TO'}
                            </span>
                          </div>
                          <div className="text-slate-700">{a.streetAddress}</div>
                          <div className="text-slate-500 font-medium text-[11px]">
                            {a.city}, {a.district && `${a.district}, `}
                            {a.state}, {a.country} –{' '}
                            <span className="font-mono font-bold text-indigo-700">
                              {a.postalCode}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'PAYMENT_TERMS' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border rounded-xl space-y-1">
                    <span className="text-slate-400 uppercase text-[10px] font-bold">
                      Payment Terms Code
                    </span>
                    <div className="font-bold text-slate-900 text-sm">
                      {inspectedBp.paymentTerms?.paymentTermsCode || 'NET30'}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 border rounded-xl space-y-1">
                    <span className="text-slate-400 uppercase text-[10px] font-bold">
                      Assigned Price List
                    </span>
                    <div className="font-bold text-slate-900 text-sm">
                      {inspectedBp.paymentTerms?.priceList || 'Standard Price List'}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 border rounded-xl space-y-1">
                    <span className="text-slate-400 uppercase text-[10px] font-bold">
                      Credit Limit (₹)
                    </span>
                    <div className="font-mono font-bold text-emerald-700 text-sm">
                      ₹ {(inspectedBp.paymentTerms?.creditLimit || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 border rounded-xl space-y-1">
                    <span className="text-slate-400 uppercase text-[10px] font-bold">
                      Commitment Limit (₹)
                    </span>
                    <div className="font-mono font-bold text-indigo-700 text-sm">
                      ₹ {(inspectedBp.paymentTerms?.commitmentLimit || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ACCOUNTING' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border rounded-xl">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">
                      Down Payment Intermediary Account
                    </span>
                    <span className="font-bold text-slate-900 font-mono">
                      {inspectedBp.accounting?.downPaymentAccount || '112500 - Customer Advance'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border rounded-xl">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">
                      Bank Name & Account No.
                    </span>
                    <span className="font-bold text-slate-900">
                      {inspectedBp.accounting?.bankName || 'N/A'} –{' '}
                      {inspectedBp.accounting?.accountNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 border rounded-xl">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">
                      IFSC / SWIFT / IBAN
                    </span>
                    <span className="font-mono font-bold text-indigo-700">
                      {inspectedBp.accounting?.ifscIban || 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'PROPERTIES' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900">SAP B1 Property Flags (64 Flags)</h4>
                  <div className="flex flex-wrap gap-2">
                    {inspectedBp.properties && inspectedBp.properties.length > 0 ? (
                      inspectedBp.properties.map((p) => (
                        <span
                          key={p}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-xs"
                        >
                          ✓ {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No property flags assigned.</span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'REMARKS' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="font-bold text-slate-700 block mb-1">Internal Notes</span>
                    <p className="text-slate-600">
                      {inspectedBp.remarks?.internalNotes || 'No internal notes provided.'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="font-bold text-slate-700 block mb-1">
                      Special Handling Instructions
                    </span>
                    <p className="text-slate-600">
                      {inspectedBp.remarks?.specialInstructions || 'None.'}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'ATTACHMENTS' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900">Uploaded Compliance Documents</h4>
                  {!inspectedBp.attachments || inspectedBp.attachments.length === 0 ? (
                    <p className="text-slate-400 italic">No attachments uploaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {inspectedBp.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            <div>
                              <div className="font-bold text-slate-900">{att.fileName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Type: {att.docType} | Size:{' '}
                                {(att.fileSizeBytes / 1024).toFixed(0)} KB | Uploaded:{' '}
                                {new Date(att.uploadedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold text-[10px]">
                            Verified Doc
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'GOVERNANCE' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-400 uppercase font-bold">
                        Current GSTIN status
                      </div>
                      <div className="text-sm font-bold flex items-center gap-2 mt-0.5">
                        <span>{inspectedBp.gstinPan || 'No GSTIN'}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inspectedBp.gstStatus === 'VERIFIED'
                              ? 'bg-emerald-500 text-white'
                              : inspectedBp.gstStatus === 'FAILED'
                              ? 'bg-rose-500 text-white'
                              : 'bg-amber-500 text-slate-900'
                          }`}
                        >
                          {inspectedBp.gstStatus}
                        </span>
                      </div>
                      {inspectedBp.gstVerification && (
                        <p className="text-[10px] text-slate-300 mt-1">
                          Source: {inspectedBp.gstVerification.provider} | Retrieved:{' '}
                          {formatTimestamp(inspectedBp.gstVerification.retrievedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintGst(inspectedBp)}
                        disabled={!inspectedBp.gstVerification}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Printer className="w-3.5 h-3.5" /> Print GST data
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleVerifyGst(inspectedBp.id)}
                        disabled={verifyingId === inspectedBp.id}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            verifyingId === inspectedBp.id ? 'animate-spin' : ''
                          }`}
                        />
                        Re-verify via provider
                      </button>
                    </div>
                  </div>

                  {inspectedBp.gstVerification ? (
                    <div className="border rounded-xl p-3 bg-white">
                      <h5 className="font-bold text-slate-900 text-xs">
                        Provider verification record
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Provider legal name
                          </span>
                          <span className="font-bold text-slate-900">
                            {inspectedBp.gstVerification.profile.legalName}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Registration status
                          </span>
                          <span className="font-bold text-slate-900">
                            {inspectedBp.gstVerification.profile.status}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Taxpayer type
                          </span>
                          <span className="font-semibold text-slate-800">
                            {inspectedBp.gstVerification.profile.taxpayerType ||
                              'Unavailable'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Trade name
                          </span>
                          <span className="font-semibold text-slate-800">
                            {inspectedBp.gstVerification.profile.tradeName ||
                              'Unavailable'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Registration date
                          </span>
                          <span className="font-semibold text-slate-800">
                            {inspectedBp.gstVerification.profile.registrationDate ||
                              'Unavailable'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            State code
                          </span>
                          <span className="font-semibold text-slate-800">
                            {inspectedBp.gstVerification.profile.stateCode ||
                              'Unavailable'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg col-span-1 md:col-span-2">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Registered address
                          </span>
                          <span className="font-semibold text-slate-800">
                            {[
                              inspectedBp.gstVerification.profile.address,
                              inspectedBp.gstVerification.profile.city,
                              inspectedBp.gstVerification.profile.pincode,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'Unavailable'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Provider credits remaining
                          </span>
                          <span className="font-semibold text-slate-800">
                            {inspectedBp.gstVerification.creditsRemaining ?? 'Unavailable'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Third-party data from {inspectedBp.gstVerification.provider}.
                        This is not an official GST certificate or government document.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl font-semibold">
                      No provider verification record is stored for this Business
                      Partner. Run a verification to retrieve GST data.
                    </div>
                  )}

                  {inspectedBp.gstinPan &&
                    renderFilingHistoryPanel(inspectedBp.gstinPan)}

                  <div className="border rounded-xl p-3 bg-white space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs">
                      Verification activity
                    </h5>
                    {!inspectedBp.governanceLogs || inspectedBp.governanceLogs.length === 0 ? (
                      <p className="text-slate-400 italic">No verification logs recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {inspectedBp.governanceLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-2.5 bg-slate-50 border rounded-lg text-slate-700 space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-bold text-[11px]">
                              <span>{log.action}</span>
                              <span className="text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{log.details}</p>
                            <div className="text-[10px] text-indigo-600 font-semibold">
                              Verified By: {log.verifier}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsInspectorOpen(false)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MULTI-TAB MODAL WITH STRICT SAVE GATE & STATE MISMATCH CHECK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-300" />
                  {editingBp
                    ? `Edit Business Partner: ${editingBp.bpCode}`
                    : 'Create New Business Partner (SAP B1 9-Tab Form)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 flex overflow-x-auto gap-1 text-[11px] font-bold text-slate-600 pt-2">
              {[
                { key: 'GENERAL', label: '1. General', icon: FileText },
                { key: 'CONTACTS', label: '2. Contacts', icon: Users2 },
                { key: 'ADDRESSES', label: '3. Addresses (Cascading)', icon: MapPin },
                { key: 'PAYMENT_TERMS', label: '4. Payment Terms', icon: CreditCard },
                { key: 'ACCOUNTING', label: '5. Accounting', icon: DollarSign },
                { key: 'PROPERTIES', label: '6. Properties (Flags)', icon: Tag },
                { key: 'REMARKS', label: '7. Remarks', icon: BookOpen },
                { key: 'ATTACHMENTS', label: '8. Attachments', icon: Download },
                { key: 'GOVERNANCE', label: '9. Governance & GST', icon: ShieldCheck },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as TabType)}
                    className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                      isActive
                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-xs'
                        : 'border-transparent hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: GENERAL */}
              {activeTab === 'GENERAL' && (
                <div className="space-y-4">
                  {/* GST STATE MISMATCH RED ALERT & EXCEPTION CHECKBOX */}
                  {isGstStateMismatch && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl space-y-2">
                      <div className="font-bold flex items-center gap-2 text-xs text-rose-800">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>DEFECT FIX: GST State Code Mismatch Error — Save Blocked!</span>
                      </div>
                      <p className="text-[11px]">
                        The entered GSTIN begins with State Code <strong>{currentGstStateCode} ({expectedGstStateName})</strong>, but the selected primary address state is <strong>{selectedStateName}</strong>. Save is strictly BLOCKED until resolved or an authorized exception is filed.
                      </p>

                      <div className="pt-2 border-t border-rose-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="gstExCheck"
                            checked={gstExceptionApproved}
                            onChange={(e) => setGstExceptionApproved(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                          <label htmlFor="gstExCheck" className="font-bold text-rose-900 text-xs cursor-pointer">
                            Approve Multi-State GST Registration Exception (Requires Governance Reason)
                          </label>
                        </div>

                        {gstExceptionApproved && (
                          <input
                            type="text"
                            placeholder="Enter mandatory exception reason e.g. Shared multi-state OEM registration..."
                            value={gstExceptionReason}
                            onChange={(e) => setGstExceptionReason(e.target.value)}
                            className="w-full text-xs p-2 border border-rose-300 rounded-lg bg-white font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* GST VERIFICATION STATUS BANNER (STRICT SAVE GATE) */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      bpForm.gstStatus === 'VERIFIED' && (!isGstStateMismatch || gstExceptionApproved)
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {bpForm.gstStatus === 'VERIFIED' && (!isGstStateMismatch || gstExceptionApproved) ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span>
                            GST Verification State:{' '}
                            {bpForm.gstStatus === 'VERIFIED' && (!isGstStateMismatch || gstExceptionApproved)
                              ? 'VERIFIED ✓ (SAVE ENABLED)'
                              : isGstStateMismatch && !gstExceptionApproved
                              ? 'STATE CODE MISMATCH ✕ (SAVE BLOCKED)'
                              : 'NOT VERIFIED (SAVE BLOCKED)'}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5">
                          {verificationFeedback ||
                            'Run "Verify GST" to retrieve GSTIN details from the configured third-party provider before saving.'}
                        </p>
                        {bpForm.gstVerification && (
                          <div className="text-[10px] mt-1 text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>
                              Source: {bpForm.gstVerification.provider}
                            </span>
                            <span>
                              Retrieved:{' '}
                              {formatTimestamp(bpForm.gstVerification.retrievedAt)}
                            </span>
                            <span>
                              Registration status:{' '}
                              {bpForm.gstVerification.profile.status}
                            </span>
                          </div>
                        )}
                        {gstLegalName && (
                          <div className="text-[10px] font-bold font-mono mt-1 text-slate-800">
                            GST Legal Name: {gstLegalName}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyGstInModal}
                      disabled={verifyingId === 'MODAL'}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs text-xs"
                    >
                      {verifyingId === 'MODAL' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      Verify GST
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Business Partner Type *
                      </label>
                      <select
                        value={bpForm.bpType}
                        onChange={(e) => setBpForm({ ...bpForm, bpType: e.target.value as any })}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="CUSTOMER">Customer (CUST)</option>
                        <option value="SUPPLIER">Supplier / Vendor (VEND)</option>
                        <option value="LEAD">Lead / Prospect</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">BP CardCode *</label>
                      <input
                        type="text"
                        placeholder="e.g. CUST-TATA-01"
                        value={bpForm.bpCode}
                        onChange={(e) => setBpForm({ ...bpForm, bpCode: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                      />
                    </div>

                    {/* THIRD-PARTY PROVIDER LEGAL NAME (READ-ONLY) */}
                    <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Provider Legal Name</span>
                        </label>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          <span>Third-party provider value (read-only)</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={
                          gstLegalName ||
                          bpForm.gstVerification?.profile.legalName ||
                          'Not verified — provider legal name will appear here'
                        }
                        className="w-full text-xs p-2.5 bg-slate-200/80 border border-slate-300 rounded-lg uppercase font-extrabold text-slate-900 cursor-not-allowed select-none shadow-inner"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <span>🔒</span>
                        <span>
                          Retrieved from the configured third-party GST provider.
                          This is not an official GST certificate or government document.
                        </span>
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-bold text-slate-700 mb-1">
                        Business Partner Display Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TATA MOTORS LIMITED"
                        value={bpForm.bpName}
                        onChange={(e) => handleBpNameChange(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase font-bold text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Changing partner display name invalidates GST verification state.
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Foreign Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Tata Motors India OEM"
                        value={bpForm.foreignName}
                        onChange={(e) => setBpForm({ ...bpForm, foreignName: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Industry / Group
                      </label>
                      <select
                        value={bpForm.groupIndustry}
                        onChange={(e) => setBpForm({ ...bpForm, groupIndustry: e.target.value })}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg"
                      >
                        <option value="Automotive OEM">Automotive OEM</option>
                        <option value="Chemicals & Polymers">Chemicals & Polymers</option>
                        <option value="Electronics & Electricals">Electronics & Electricals</option>
                        <option value="Construction & Infrastructure">
                          Construction & Infrastructure
                        </option>
                        <option value="Packaging & Extrusion">Packaging & Extrusion</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        GSTIN / Federal Tax ID *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 27AAACT2727Q1ZW"
                        value={bpForm.gstinPan}
                        onChange={(e) => handleGstinChange(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase font-bold"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        15-digit GSTIN (State Code + PAN + Entity + Z + Checksum).
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">PAN Number</label>
                      <input
                        type="text"
                        placeholder="e.g. AAACT2727Q"
                        value={bpForm.panNumber}
                        onChange={(e) => setBpForm({ ...bpForm, panNumber: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={bpForm.phone}
                        onChange={(e) => setBpForm({ ...bpForm, phone: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Primary Email</label>
                      <input
                        type="email"
                        value={bpForm.email}
                        onChange={(e) => setBpForm({ ...bpForm, email: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Salesperson / Manager
                      </label>
                      <input
                        type="text"
                        value={bpForm.salesperson}
                        onChange={(e) => setBpForm({ ...bpForm, salesperson: e.target.value })}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Status</label>
                      <select
                        value={bpForm.status}
                        onChange={(e) => setBpForm({ ...bpForm, status: e.target.value as any })}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACT PERSONS */}
              {activeTab === 'CONTACTS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">Contact Persons List</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setContactForm({
                          id: '',
                          name: '',
                          title: 'Mr.',
                          position: 'Purchase Manager',
                          department: 'Procurement',
                          mobile: '',
                          email: '',
                          isDefault: contacts.length === 0,
                        });
                        setIsContactSubModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Contact
                    </button>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-slate-400 italic">No contact persons added yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border rounded-xl overflow-hidden">
                      {contacts.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 bg-slate-50 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>
                                {c.title} {c.name}
                              </span>
                              {c.isDefault && (
                                <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {c.position} ({c.department}) | Mobile: {c.mobile} | Email: {c.email}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setContacts(contacts.filter((x) => x.id !== c.id))}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ADDRESSES WITH GEOGRAPHIC CASCADING */}
              {activeTab === 'ADDRESSES' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-center justify-between">
                    <div>
                      <strong className="block font-bold">Geographic Cascading Structure:</strong>
                      <span className="text-[11px]">
                        Field Order: 1. Country → 2. State/Province → 3. District → 4. City → 5.
                        Postal Code
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressForm({
                          id: '',
                          addressName: 'Secondary Plant Office',
                          addressType: 'SHIP_TO',
                          country: 'India',
                          state: 'Maharashtra',
                          district: 'Pune',
                          city: 'Chakan',
                          postalCode: '410501',
                          streetAddress: '',
                          isDefault: addresses.length === 0,
                        });
                        setIsAddressSubModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 text-white rounded font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Address
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-3.5 border rounded-xl bg-slate-50 space-y-1 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{addr.addressName}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              addr.addressType === 'BILL_TO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {addr.addressType}
                          </span>
                        </div>
                        <p className="text-slate-700 text-xs">{addr.streetAddress}</p>
                        <div className="text-[11px] text-slate-500 font-medium">
                          1. {addr.country} → 2. {addr.state} → 3. {addr.district} → 4. {addr.city}{' '}
                          → 5. <span className="font-mono font-bold">{addr.postalCode}</span>
                        </div>
                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAddressForm({ ...addr });
                              setIsAddressSubModalOpen(true);
                            }}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                          >
                            Edit Address
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddresses(addresses.filter((a) => a.id !== addr.id))}
                            className="text-[10px] text-rose-600 font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: PAYMENT TERMS */}
              {activeTab === 'PAYMENT_TERMS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Payment Terms Code
                    </label>
                    <select
                      value={paymentTerms.paymentTermsCode}
                      onChange={(e) =>
                        setPaymentTerms({ ...paymentTerms, paymentTermsCode: e.target.value })
                      }
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    >
                      <option value="IMMEDIATE">Immediate Cash</option>
                      <option value="NET15">Net 15 Days</option>
                      <option value="NET30">Net 30 Days</option>
                      <option value="NET60">Net 60 Days</option>
                      <option value="ADV_50">50% Advance / 50% Delivery</option>
                      <option value="COD">Cash On Delivery (COD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Assigned Price List
                    </label>
                    <select
                      value={paymentTerms.priceList}
                      onChange={(e) =>
                        setPaymentTerms({ ...paymentTerms, priceList: e.target.value })
                      }
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                    >
                      <option value="Standard Sales Price 2026">Standard Sales Price 2026</option>
                      <option value="OEM Contract Price 2026">OEM Contract Price 2026</option>
                      <option value="Distributor Price List">Distributor Price List</option>
                      <option value="Raw Material Purchase List">Raw Material Purchase List</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Credit Limit (₹)</label>
                    <input
                      type="number"
                      value={paymentTerms.creditLimit}
                      onChange={(e) =>
                        setPaymentTerms({
                          ...paymentTerms,
                          creditLimit: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Commitment Limit (₹)
                    </label>
                    <input
                      type="number"
                      value={paymentTerms.commitmentLimit}
                      onChange={(e) =>
                        setPaymentTerms({
                          ...paymentTerms,
                          commitmentLimit: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Early Payment Discount %
                    </label>
                    <input
                      type="number"
                      value={paymentTerms.discountPercent}
                      onChange={(e) =>
                        setPaymentTerms({
                          ...paymentTerms,
                          discountPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: ACCOUNTING (CONTROL ACCOUNT HIDDEN AS REQUESTED) */}
              {activeTab === 'ACCOUNTING' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Control Account Hidden as requested ("hide contol accojunt in accounting") */}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Down Payment Advance Account
                    </label>
                    <input
                      type="text"
                      value={accounting.downPaymentAccount}
                      onChange={(e) =>
                        setAccounting({ ...accounting, downPaymentAccount: e.target.value })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={accounting.bankName}
                      onChange={(e) => setAccounting({ ...accounting, bankName: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accounting.accountNumber}
                      onChange={(e) =>
                        setAccounting({ ...accounting, accountNumber: e.target.value })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      IFSC / IBAN / SWIFT
                    </label>
                    <input
                      type="text"
                      value={accounting.ifscIban}
                      onChange={(e) => setAccounting({ ...accounting, ifscIban: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="whtCheck"
                      checked={accounting.withholdingTaxAllowed}
                      onChange={(e) =>
                        setAccounting({ ...accounting, withholdingTaxAllowed: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <label htmlFor="whtCheck" className="font-bold text-slate-800">
                      Withholding Tax / TDS Deduction Applicable
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 6: PROPERTIES */}
              {activeTab === 'PROPERTIES' && (
                <div className="space-y-3">
                  <p className="text-slate-500 font-medium">
                    Select active property classification flags for this Business Partner (SAP B1
                    64 Flags):
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {SAP_B1_PROPERTIES.map((prop) => {
                      const isChecked = properties.includes(prop);
                      return (
                        <button
                          key={prop}
                          type="button"
                          onClick={() => toggleProperty(prop)}
                          className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[11px]">{prop}</span>
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 7: REMARKS */}
              {activeTab === 'REMARKS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Internal Notes</label>
                    <textarea
                      rows={3}
                      value={remarks.internalNotes}
                      onChange={(e) => setRemarks({ ...remarks, internalNotes: e.target.value })}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      placeholder="Enter internal finance or sales notes..."
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Special Handling & Shipping Instructions
                    </label>
                    <textarea
                      rows={3}
                      value={remarks.specialInstructions}
                      onChange={(e) =>
                        setRemarks({ ...remarks, specialInstructions: e.target.value })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                      placeholder="e.g. Barcode label requirements, Gate timing..."
                    />
                  </div>
                </div>
              )}

              {/* TAB 8: ATTACHMENTS */}
              {activeTab === 'ATTACHMENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {['GST Certificate', 'PAN Copy', 'Cancelled Cheque', 'MSME Certificate'].map(
                      (doc) => (
                        <button
                          key={doc}
                          type="button"
                          onClick={() => handleSimulatedUpload(doc)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer text-xs"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload {doc}
                        </button>
                      )
                    )}
                  </div>

                  {attachments.length === 0 ? (
                    <p className="text-slate-400 italic">No attachments uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{att.fileName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Doc: {att.docType} | Size: {(att.fileSizeBytes / 1024).toFixed(0)} KB
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments(attachments.filter((x) => x.id !== att.id))
                            }
                            className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9: GOVERNANCE & GST VERIFICATION */}
              {activeTab === 'GOVERNANCE' && (
                <div className="space-y-4">
                  {/* Warning banner if State Code Mismatch */}
                  {isGstStateMismatch && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 space-y-2">
                      <div className="font-bold flex items-center gap-2 text-xs text-rose-800">
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>GSTIN State Code Mismatch Failure!</span>
                      </div>
                      <p className="text-[11px]">
                        The GSTIN entered starts with State Code{' '}
                        <strong>{currentGstStateCode}</strong> ({expectedGstStateName}), but the
                        primary address state selected is <strong>{selectedStateName}</strong>.
                        Save is BLOCKED until resolved or an authorized exception is filed.
                      </p>
                    </div>
                  )}

                  <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">
                        GSTIN verification via third-party provider
                      </div>
                      <div className="font-mono font-bold text-sm text-indigo-300 mt-0.5">
                        {bpForm.gstinPan || 'NO GSTIN ENTERED'}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-1">
                        Source: gstinapi.in. Not an official government portal or certificate.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleVerifyGstInModal}
                      disabled={verifyingId === 'MODAL'}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingId === 'MODAL' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      Verify GSTIN via provider
                    </button>
                  </div>

                  {bpForm.gstVerification && (
                    <div className="border rounded-xl p-3 bg-white">
                      <h5 className="font-bold text-slate-900 text-xs">
                        Provider verification record
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-[11px]">
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Provider legal name
                          </span>
                          <span className="font-bold text-slate-900">
                            {bpForm.gstVerification.profile.legalName}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Registration status
                          </span>
                          <span className="font-bold text-slate-900">
                            {bpForm.gstVerification.profile.status}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Source
                          </span>
                          <span className="font-semibold text-slate-800">
                            {bpForm.gstVerification.provider}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 border rounded-lg">
                          <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                            Retrieved at
                          </span>
                          <span className="font-semibold text-slate-800">
                            {formatTimestamp(bpForm.gstVerification.retrievedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {bpForm.gstinPan && renderFilingHistoryPanel(bpForm.gstinPan)}

                  <div className="border rounded-xl p-3 bg-white space-y-2">
                    <h5 className="font-bold text-slate-900 text-xs">Recorded verification logs</h5>
                    {governanceLogs.length === 0 ? (
                      <p className="text-slate-400 italic">No verification logs yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {governanceLogs.map((log) => (
                          <div
                            key={log.id}
                            className="p-2.5 bg-slate-50 border rounded-lg text-slate-700 space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-bold text-[11px]">
                              <span>{log.action}</span>
                              <span className="text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px]">{log.details}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (WITH STRICT SAVE GATE) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs font-bold">
                {isSaveDisabled ? (
                  <span className="text-rose-600 flex items-center gap-1 font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    {isGstStateMismatch && !gstExceptionApproved
                      ? 'Save Blocked: GST State Mismatch (Correct state or check exception)'
                      : 'Save Blocked: Click "Verify GST" first'}
                  </span>
                ) : (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Save (GST Verified)
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaveDisabled}
                  onClick={handleSaveBp}
                  className={`px-5 py-1.5 rounded-lg font-bold shadow-xs cursor-pointer ${
                    isSaveDisabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  Save Business Partner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASCADING ADDRESS SUB-MODAL WITH MANAGE MISSING GEOGRAPHY ACTIONS */}
      {isAddressSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <h4 className="font-bold text-slate-900 border-b pb-2 text-sm flex items-center justify-between">
              <span>Cascading Address Entry</span>
              <button
                onClick={() => setIsAddressSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Address Label *</label>
                <input
                  type="text"
                  placeholder="e.g. Registered HQ, Chakan Factory Gate 2"
                  value={addressForm.addressName}
                  onChange={(e) => setAddressForm({ ...addressForm, addressName: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address Type *</label>
                <select
                  value={addressForm.addressType}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, addressType: e.target.value as any })
                  }
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  <option value="BILL_TO">Bill To Address</option>
                  <option value="SHIP_TO">Ship To Address</option>
                </select>
              </div>

              {/* STRICT CASCADING GEOGRAPHIC HIERARCHY WITH MANAGE MISSING ACTIONS */}
              <div className="p-3 bg-slate-50 border rounded-xl space-y-3">
                <div className="text-[10px] font-bold text-indigo-700 uppercase">
                  Cascading Selection Order: Country → State → District → City → Postal Code
                </div>

                {/* Level 1: Country */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">1. Country *</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddMissingGeoModal('COUNTRY')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Can't find? Add Country
                    </button>
                  </div>
                  <select
                    value={addressForm.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {geoMasters.map((c) => (
                      <option key={c.countryCode} value={c.countryName}>
                        {c.countryName} ({c.countryCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 2: State / Province */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">2. State / Province *</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddMissingGeoModal('STATE')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Can't find? Add State
                    </button>
                  </div>
                  <select
                    value={addressForm.state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {availableStates.map((s) => (
                      <option key={s.stateName} value={s.stateName}>
                        {s.stateName} {s.stateCode ? `(GST Code: ${s.stateCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 3: District */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">3. District *</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddMissingGeoModal('DISTRICT')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Can't find? Add District
                    </button>
                  </div>
                  <select
                    value={addressForm.district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {availableDistricts.map((d) => (
                      <option key={d.districtName} value={d.districtName}>
                        {d.districtName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 4: City / Town */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">4. City / Town *</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddMissingGeoModal('CITY')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Can't find? Add City
                    </button>
                  </div>
                  <select
                    value={addressForm.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {availableCities.map((c) => (
                      <option key={c.cityName} value={c.cityName}>
                        {c.cityName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level 5: Postal Code */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">5. Postal Code / PIN Code *</label>
                    <button
                      type="button"
                      onClick={() => handleOpenAddMissingGeoModal('POSTAL')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Can't find? Add Postal Code
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={addressForm.postalCode}
                      onChange={(e) =>
                        setAddressForm({ ...addressForm, postalCode: e.target.value })
                      }
                      className="w-1/2 text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    >
                      {availablePostalCodes.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or enter custom PIN"
                      value={addressForm.postalCode}
                      onChange={(e) =>
                        setAddressForm({ ...addressForm, postalCode: e.target.value })
                      }
                      className="w-1/2 text-xs p-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Street Address *</label>
                <textarea
                  rows={2}
                  placeholder="Building name, plot number, street..."
                  value={addressForm.streetAddress}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, streetAddress: e.target.value })
                  }
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultAddr"
                  checked={addressForm.isDefault}
                  onChange={(e) =>
                    setAddressForm({ ...addressForm, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="defaultAddr" className="font-bold text-slate-800">
                  Set as Default Address
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsAddressSubModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAddress}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE MISSING GEOGRAPHY VALUE SUB-MODAL */}
      {isGeoSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h4 className="font-bold text-slate-900 border-b pb-2 text-sm flex items-center justify-between">
              <span>
                Add Missing Geographic Master: {geoLevelToAdd}
              </span>
              <button
                onClick={() => setIsGeoSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </h4>

            <div className="space-y-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-[11px]">
                Parent Location Context:{' '}
                <strong>
                  {addressForm.country}
                  {geoLevelToAdd !== 'COUNTRY' && ` → ${addressForm.state}`}
                  {(geoLevelToAdd === 'CITY' || geoLevelToAdd === 'POSTAL') &&
                    ` → ${addressForm.district}`}
                </strong>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Name for Missing {geoLevelToAdd} *
                </label>
                <input
                  type="text"
                  placeholder={`e.g. New ${geoLevelToAdd}`}
                  value={newGeoName}
                  onChange={(e) => setNewGeoName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Code / Short Identifier (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. State Code or PIN code"
                  value={newGeoCode}
                  onChange={(e) => setNewGeoCode(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsGeoSubModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMissingGeo}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Add & Select Value
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT SUB-MODAL */}
      {isContactSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h4 className="font-bold text-slate-900 border-b pb-2 text-sm flex items-center justify-between">
              <span>Add / Edit Contact Person</span>
              <button
                onClick={() => setIsContactSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </h4>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Title</label>
                  <select
                    value={contactForm.title}
                    onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Position / Designation</label>
                <input
                  type="text"
                  value={contactForm.position}
                  onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={contactForm.department}
                  onChange={(e) => setContactForm({ ...contactForm, department: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={contactForm.mobile}
                  onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Direct Email *</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultContact"
                  checked={contactForm.isDefault}
                  onChange={(e) => setContactForm({ ...contactForm, isDefault: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="defaultContact" className="font-bold text-slate-800">
                  Set as Default Contact Person
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsContactSubModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
              >
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
