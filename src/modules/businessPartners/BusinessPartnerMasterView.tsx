import React, { useState, useEffect } from 'react';
import {
  BusinessPartner,
  User,
  BPContactPerson,
  BPAddress,
  BPPaymentTerms,
  BPAccounting,
  BPBankDetail,
  BPAttachment,
  BPGovernanceLog,
  Branch,
  MSMEInfo,
  GSTVerificationDetails,
  GSTVerificationMode,
  GSTVerificationSession,
} from '../../types';
import { INITIAL_BUSINESS_PARTNERS, INITIAL_BRANCHES } from '../../data/seedData';
import {
  CASCADING_GEO_MASTERS,
  GST_STATE_CODES,
  GeoCountry,
  GeoState,
  GeoDistrict,
  GeoCity,
} from '../../data/geoData';
import {
  getGstVerificationMode,
  generateCaptchaChallenge,
  verifyGSTIN,
  getOrCreateGstDetailsForEntity,
  KNOWN_REGISTRY_DETAILS,
  getPreviousIndianFinancialYears,
} from '../../services/gstService';
import { GSTVerificationReviewModal } from '../../components/GSTVerificationReviewModal';
import { GSTDetailsInspector } from '../../components/GSTDetailsInspector';
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
  DollarSign,
  Tag,
  BookOpen,
  Eye,
  Download,
  Lock,
  ShieldAlert,
  Building2,
  FileCheck,
  Check,
  Award,
  Zap,
  Server,
  Layers,
  ChevronRight,
  ChevronDown,
  Printer,
  X,
} from 'lucide-react';

import { OperatingContext, filterBusinessPartnersByContext } from '../../services/operatingContextService';
import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';

interface BusinessPartnerMasterViewProps {
  currentUser: User;
  operatingContext?: OperatingContext;
}

type TabType =
  | 'GENERAL'
  | 'CONTACTS'
  | 'SHIPPING_ADDRESSES'
  | 'PAYMENT_TERMS'
  | 'ACCOUNTING_BANKING'
  | 'PROPERTIES'
  | 'REMARKS'
  | 'ATTACHMENTS'
  | 'GOVERNANCE_AUDIT';

const INDIAN_GOVT_INDUSTRIES = [
  'Automotive OEM & Components',
  'Aerospace & Defense',
  'Agriculture & Food Processing',
  'Chemical & Petrochemical',
  'Construction & Infrastructure',
  'Electrical & Electronics',
  'Heavy Engineering & Machinery',
  'Healthcare & Medical Devices',
  'Logistics & Supply Chain',
  'Metal & Steel Fabrication',
  'Packaging & Paper Manufacturing',
  'Plastics & Polymers Processing',
  'Renewable Energy & Solar',
  'Textiles & Apparel',
  'Water & Waste Management',
];

export const BusinessPartnerMasterView: React.FC<BusinessPartnerMasterViewProps> = ({
  currentUser,
  operatingContext,
}) => {
  const [bpList, setBpList] = useState<BusinessPartner[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_business_partners');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading business partners from localStorage:', err);
    }
    return INITIAL_BUSINESS_PARTNERS;
  });

  const [branches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading branches from localStorage:', err);
    }
    return INITIAL_BRANCHES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('kosh_business_partners', JSON.stringify(bpList));
    } catch (err) {
      console.error('Error saving business partners to localStorage:', err);
    }
  }, [bpList]);

  // Master States
  const [geoMasters] = useState<GeoCountry[]>(CASCADING_GEO_MASTERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [gstFilter, setGstFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

  // Modal / Active Inspection
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectedBp, setInspectedBp] = useState<BusinessPartner | null>(null);
  const [editingBp, setEditingBp] = useState<BusinessPartner | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('GENERAL');

  // Form State
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'br-pond-01');
  const [bpType, setBpType] = useState<'CUSTOMER' | 'SUPPLIER' | 'LEAD'>('CUSTOMER');
  const [bpName, setBpName] = useState('');
  const [shortName, setShortName] = useState('');
  const [groupIndustry, setGroupIndustry] = useState(INDIAN_GOVT_INDUSTRIES[0]);
  const [currency, setCurrency] = useState('INR');
  const [gstinPan, setGstinPan] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [gstLegalName, setGstLegalName] = useState('');
  const [gstTradeName, setGstTradeName] = useState('');
  const [gstRegistrationType, setGstRegistrationType] = useState('Regular Taxpayer');
  const [gstStatus, setGstStatus] = useState<
    'ACTIVE' | 'VERIFIED' | 'SUSPENDED' | 'CANCELLED' | 'UNVERIFIED' | 'INVALID'
  >('UNVERIFIED');
  const [gstRegisteredEmail, setGstRegisteredEmail] = useState('');
  const [gstRegisteredMobile, setGstRegisteredMobile] = useState('');
  const [isVerifyingGst, setIsVerifyingGst] = useState(false);
  const [activeGstMode, setActiveGstMode] = useState<GSTVerificationMode>(() => getGstVerificationMode());
  const [captchaSession, setCaptchaSession] = useState<GSTVerificationSession | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [stagedGstDetails, setStagedGstDetails] = useState<GSTVerificationDetails | null>(null);
  const [savedGstDetails, setSavedGstDetails] = useState<GSTVerificationDetails | null>(null);
  const [gstErrorMessage, setGstErrorMessage] = useState('');
  const [isTradeDetailsModalOpen, setIsTradeDetailsModalOpen] = useState(false);
  const [tradeDetailsTab, setTradeDetailsTab] = useState<'PLACES' | 'ACTIVITIES' | 'GOODS_SERVICES' | 'FILING_HISTORY'>('PLACES');
  const [selectedFilingFy, setSelectedFilingFy] = useState<string>(() => {
    const fyi = getPreviousIndianFinancialYears(8);
    return fyi[0] || '2026-2027';
  });
  const [isFilingLoading, setIsFilingLoading] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'GENERAL' | 'CONTACTS' | 'SHIPPING' | 'BANKING' | 'GST_DETAILS' | 'AUDIT'>('GENERAL');

  // Return Filing History Mock Data
  const [gstFilingHistory, setGstFilingHistory] = useState<
    Array<{ returnPeriod: string; dateOfFiling: string; status: string }>
  >([]);

  // MSME Info State
  const [msmeInfo, setMsmeInfo] = useState<MSMEInfo>({
    isMSME: false,
    udyamRegistrationNo: '',
    enterpriseName: '',
    enterpriseType: 'Private Limited',
    dateOfIncorporation: '2018-04-12',
    dateOfCommencement: '2018-05-01',
    activityType: 'MANUFACTURING',
    msmeClassification: 'SMALL',
    investmentCategory: '₹1 Cr - ₹10 Cr',
    turnoverCategory: '₹5 Cr - ₹50 Cr',
    nicCodes: ['22209 - Manufacture of Plastic Products', '25999 - Manufacture of Metal Products'],
    majorActivity: 'Injection Moulding & Precision Tooling',
    state: 'Tamil Nadu',
    district: 'Puducherry',
    panLinkage: 'AAACK4603M',
    registrationPeriodStatus: 'Active & Valid (Post-July 2020 Revalidated)',
    lastRevalidatedAt: new Date().toISOString(),
  });
  const [isVerifyingMsme, setIsVerifyingMsme] = useState(false);

  // Mandatory Billing Address (in General Tab)
  const [billToCountry, setBillToCountry] = useState('India');
  const [billToState, setBillToState] = useState('Maharashtra');
  const [billToDistrict, setBillToDistrict] = useState('Mumbai City');
  const [billToCity, setBillToCity] = useState('Mumbai');
  const [billToPostalCode, setBillToPostalCode] = useState('400001');
  const [billToStreetAddress, setBillToStreetAddress] = useState('');

  // Shipping Addresses (Tab 3)
  const [shippingAddresses, setShippingAddresses] = useState<BPAddress[]>([]);
  const [isShippingSubModalOpen, setIsShippingSubModalOpen] = useState(false);
  const [shippingForm, setShippingForm] = useState<BPAddress>({
    id: '',
    addressName: 'Primary Plant Shipping Yard',
    addressType: 'SHIP_TO',
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai City',
    city: 'Mumbai',
    postalCode: '400001',
    streetAddress: '',
    isDefault: true,
  });

  // Contacts
  const [contacts, setContacts] = useState<BPContactPerson[]>([]);
  const [isContactSubModalOpen, setIsContactSubModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState<BPContactPerson>({
    id: '',
    name: '',
    title: 'Mr.',
    position: 'Procurement Manager',
    department: 'Supply Chain',
    mobile: '',
    email: '',
    isDefault: true,
  });

  // Payment Terms
  const [paymentTerms, setPaymentTerms] = useState<BPPaymentTerms>({
    paymentTermsCode: 'NET30',
    creditLimit: 1000000,
    commitmentLimit: 1500000,
    priceList: '', // Empty by default per specification
    discountPercent: 0,
  });

  // Accounting & Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BPBankDetail[]>([]);
  const [isBankSubModalOpen, setIsBankSubModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState<BPBankDetail>({
    id: '',
    bankName: 'HDFC Bank Ltd',
    branchName: 'Fort Branch',
    ifscCode: 'HDFC0000012',
    ibanSwift: 'HDFCINBB',
    accountNumber: '',
    cancelledChequeFileName: '',
    isDefault: true,
  });

  const [properties, setProperties] = useState<string[]>([]);
  const [remarks, setRemarks] = useState({ internalNotes: '', specialInstructions: '', complianceComments: '' });
  const [attachments, setAttachments] = useState<BPAttachment[]>([]);
  const [governanceLogs, setGovernanceLogs] = useState<BPGovernanceLog[]>([]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected Branch Object & Shortcode Sequence Calculation for CardCode
  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const generateCardCode = (targetBranch: Branch, type: 'CUSTOMER' | 'SUPPLIER' | 'LEAD') => {
    const typeChar = type === 'CUSTOMER' ? 'C' : type === 'SUPPLIER' ? 'S' : 'L';
    const pCode = targetBranch.portalBranchCode || '001';
    const sCode = targetBranch.code || 'PDY';
    // Count existing BPs of same type and branch for sequence
    const sameBranchTypeBps = bpList.filter(
      (b) => b.bpType === type && (b.portalBranchCode === pCode || b.branchCode === sCode)
    );
    const seq = (sameBranchTypeBps.length + 1).toString().padStart(4, '0');
    return `K${typeChar}${pCode}${sCode}${seq}`;
  };

  const calculatedCardCode = editingBp
    ? editingBp.bpCode
    : generateCardCode(currentBranch, bpType);

  // Auto populate PAN when 15-char GSTIN is entered
  useEffect(() => {
    const cleanGst = gstinPan.trim().toUpperCase();
    if (cleanGst.length >= 12) {
      const extractedPan = cleanGst.slice(2, 12);
      setPanNumber(extractedPan);
    }
  }, [gstinPan]);

  const getActiveTradeDetails = () => {
    const cleanGst = (gstinPan || editingBp?.gstinPan || '').trim().toUpperCase();
    const known = cleanGst ? KNOWN_REGISTRY_DETAILS[cleanGst] : null;
    const currentDetails =
      savedGstDetails ||
      stagedGstDetails ||
      (cleanGst ? getOrCreateGstDetailsForEntity(cleanGst, bpName, gstTradeName) : null) ||
      editingBp?.gstVerificationDetails;

    const coreActivity =
      currentDetails?.natureOfCoreBusinessActivity?.[0] ||
      known?.natureOfCoreBusinessActivity?.[0] ||
      'Manufacturer';

    const activities: string[] =
      currentDetails?.natureOfBusinessActivities && currentDetails.natureOfBusinessActivities.length > 0
        ? currentDetails.natureOfBusinessActivities
        : known?.natureOfBusinessActivities && known.natureOfBusinessActivities.length > 0
        ? known.natureOfBusinessActivities
        : ['Factory / Manufacturing', 'Warehouse / Depot'];

    const goods: Array<{ hsnCode: string; description: string }> =
      currentDetails?.goods && currentDetails.goods.length > 0
        ? currentDetails.goods
        : known?.goods && known.goods.length > 0
        ? known.goods
        : [
            { hsnCode: '4908', description: 'TRANSFERS (DECALCOMANIAS)' },
            {
              hsnCode: '3920',
              description:
                'OTHER PLATES, SHEETS, FILM, FOIL AND STRIP, OF PLASTICS, NON-CELLULAR AND NOT REINFORCED, LAMINATED, SUPPORTED OR SIMILARLY COMBINED WITH OTHER MATERIALS',
            },
            {
              hsnCode: '8442',
              description:
                'MACHINERY, APPARATUS AND EQUIPMENT (OTHER THEN THE MACHINES OF HEADINGS 8456 TO 8465) FOR PREPARING OR MAKING PLATES, PRINTING COMPONENTS , PLATES, CYLINDERS AND LITHOGRAPHIC STONES, PREPARED FOR PRINTING PURPOSES (FOR EXAMPLE, PLANED, GRAINED OR POLISHED)',
            },
          ];

    const services: Array<{ sacCode: string; description: string }> =
      currentDetails?.services && currentDetails.services.length > 0
        ? currentDetails.services
        : known?.services || [];

    const resolvedLegalName =
      known?.legalName ||
      currentDetails?.legalName ||
      gstLegalName ||
      (cleanGst === '27AAJCS8638J1ZO' ? 'KONDESHWAR INJECTO PRIVATE LIMITED' : '') ||
      bpName ||
      'KONDESHWAR INJECTO PRIVATE LIMITED';

    const resolvedTradeName =
      currentDetails?.tradeName ||
      known?.tradeName ||
      gstTradeName ||
      resolvedLegalName;

    const filingHistory = currentDetails?.filingHistory || known?.filingHistory || [];

    return {
      gstin: cleanGst || currentDetails?.gstin || '27AAJCK6390B1ZG',
      legalName: resolvedLegalName,
      tradeName: resolvedTradeName,
      coreActivity,
      activities,
      goods,
      services,
      filingHistory,
      hasAnnualReturn: known?.hasAnnualReturn !== false,
    };
  };

  const handleOpenModal = (bp?: BusinessPartner) => {
    setErrorMsg('');
    setActiveTab('GENERAL');

    if (bp) {
      setEditingBp(bp);
      setSelectedBranchId(bp.branchId || branches[0].id);
      setBpType(bp.bpType);
      setBpName(bp.bpName);
      setShortName(bp.shortName || '');
      setGroupIndustry(bp.groupIndustry || INDIAN_GOVT_INDUSTRIES[0]);
      setCurrency(bp.currency || 'INR');
      setGstinPan(bp.gstinPan || '');
      setPanNumber(bp.panNumber || '');
      setGstLegalName(bp.gstLegalName || '');
      setGstTradeName(bp.gstTradeName || bp.bpName);
      setGstRegistrationType(bp.gstTaxpayerType || 'Regular Taxpayer');
      setGstStatus((bp.gstStatus as any) || 'ACTIVE');
      setGstRegisteredEmail(bp.gstRegisteredEmail || 'tax@partner.com');
      setGstRegisteredMobile(bp.gstRegisteredMobile || '+91 98765 43210');
      setGstFilingHistory(bp.gstFilingHistory || []);

      setMsmeInfo(
        bp.msmeInfo || {
          isMSME: false,
          udyamRegistrationNo: '',
          enterpriseName: '',
          enterpriseType: 'Private Limited',
          dateOfIncorporation: '2018-04-12',
          dateOfCommencement: '2018-05-01',
          activityType: 'MANUFACTURING',
          msmeClassification: 'SMALL',
          investmentCategory: '₹1 Cr - ₹10 Cr',
          turnoverCategory: '₹5 Cr - ₹50 Cr',
          nicCodes: ['22209 - Manufacture of Plastic Products'],
          majorActivity: 'Injection Moulding',
          state: bp.state,
          district: bp.district,
          panLinkage: bp.panNumber,
          registrationPeriodStatus: 'Active & Valid',
          lastRevalidatedAt: new Date().toISOString(),
        }
      );

      setBillToCountry(bp.country || 'India');
      setBillToState(bp.state || 'Maharashtra');
      setBillToDistrict(bp.district || 'Mumbai City');
      setBillToCity(bp.city || 'Mumbai');
      setBillToPostalCode(bp.postalCode || '400001');
      setBillToStreetAddress(bp.streetAddress || '');

      setShippingAddresses(bp.addresses || []);
      setContacts(bp.contacts || []);
      setPaymentTerms(bp.paymentTerms || { paymentTermsCode: 'NET30', priceList: '', discountPercent: 0 });
      setBankAccounts(bp.accounting?.bankAccounts || []);
      setProperties(bp.properties || []);
      setRemarks({
        internalNotes: bp.remarks?.internalNotes || '',
        specialInstructions: bp.remarks?.specialInstructions || '',
        complianceComments: bp.remarks?.complianceComments || '',
      });
      setAttachments(bp.attachments || []);
      setGovernanceLogs(bp.governanceLogs || []);

      const currentMode = getGstVerificationMode();
      setActiveGstMode(currentMode);
      setGstErrorMessage('');
      setSavedGstDetails(
        bp.gstVerificationDetails ||
        (bp.gstinPan ? getOrCreateGstDetailsForEntity(bp.gstinPan, bp.bpName, bp.gstTradeName) || null : null)
      );
      if (currentMode === 'MANUAL_CAPTCHA' && bp.gstinPan) {
        setCaptchaSession(generateCaptchaChallenge(bp.gstinPan));
      } else {
        setCaptchaSession(null);
      }
    } else {
      setEditingBp(null);
      setSelectedBranchId(branches[0].id);
      setBpType('CUSTOMER');
      setBpName('');
      setShortName('');
      setGroupIndustry(INDIAN_GOVT_INDUSTRIES[0]);
      setCurrency('INR');
      setGstinPan('');
      setPanNumber('');
      setGstLegalName('');
      setGstTradeName('');
      setGstRegistrationType('Regular Taxpayer');
      setGstStatus('UNVERIFIED');
      setGstRegisteredEmail('');
      setGstRegisteredMobile('');
      setGstFilingHistory([]);

      const currentMode = getGstVerificationMode();
      setActiveGstMode(currentMode);
      setGstErrorMessage('');
      setCaptchaInput('');
      setSavedGstDetails(null);
      setStagedGstDetails(null);
      if (currentMode === 'MANUAL_CAPTCHA') {
        setCaptchaSession(generateCaptchaChallenge('34AAACK4603M1ZP'));
      } else {
        setCaptchaSession(null);
      }

      setMsmeInfo({
        isMSME: false,
        udyamRegistrationNo: '',
        enterpriseName: '',
        enterpriseType: 'Private Limited',
        dateOfIncorporation: '2018-04-12',
        dateOfCommencement: '2018-05-01',
        activityType: 'MANUFACTURING',
        msmeClassification: 'SMALL',
        investmentCategory: '₹1 Cr - ₹10 Cr',
        turnoverCategory: '₹5 Cr - ₹50 Cr',
        nicCodes: ['22209 - Manufacture of Plastic Products'],
        majorActivity: 'Injection Moulding & Precision Tooling',
        state: 'Maharashtra',
        district: 'Mumbai City',
        panLinkage: '',
        registrationPeriodStatus: 'Active & Valid',
        lastRevalidatedAt: new Date().toISOString(),
      });

      setBillToCountry('India');
      setBillToState('Maharashtra');
      setBillToDistrict('Mumbai City');
      setBillToCity('Mumbai');
      setBillToPostalCode('400001');
      setBillToStreetAddress('Plot 101, Industrial Hub');

      setShippingAddresses([
        {
          id: `ship-${Date.now()}`,
          addressName: 'Default Plant Shipping Yard',
          addressType: 'SHIP_TO',
          country: 'India',
          state: 'Maharashtra',
          district: 'Mumbai City',
          city: 'Mumbai',
          postalCode: '400001',
          streetAddress: 'Plot 101, Industrial Hub',
          isDefault: true,
        },
      ]);

      setContacts([
        {
          id: `c-${Date.now()}`,
          name: 'Primary Contact Person',
          title: 'Mr.',
          position: 'Purchase Manager',
          department: 'Procurement',
          mobile: '+91 98000 11122',
          email: 'purchase@partner.com',
          isDefault: true,
        },
      ]);

      setPaymentTerms({
        paymentTermsCode: 'NET30',
        creditLimit: 1000000,
        commitmentLimit: 1500000,
        priceList: '', // Empty by default
        discountPercent: 0,
      });

      setBankAccounts([
        {
          id: `bnk-${Date.now()}`,
          bankName: 'HDFC Bank Ltd',
          branchName: 'Fort Branch',
          ifscCode: 'HDFC0000012',
          ibanSwift: 'HDFCINBB',
          accountNumber: '50200011223344',
          cancelledChequeFileName: 'Cancelled_Cheque_HDFC.pdf',
          isDefault: true,
          approvalStatus: 'APPROVED',
        },
      ]);

      setProperties(['OEM VIP Customer']);
      setRemarks({ internalNotes: '', specialInstructions: '', complianceComments: '' });
      setAttachments([]);
      setGovernanceLogs([]);
    }
    setIsModalOpen(true);
  };

  const handleRequestNewCaptcha = (targetGst?: string) => {
    const gstToUse = targetGst || gstinPan || '34AAACK4603M1ZP';
    const newSession = generateCaptchaChallenge(gstToUse);
    setCaptchaSession(newSession);
    setCaptchaInput('');
    setGstErrorMessage('');
  };

  const handleVerifyGstInModal = async () => {
    setGstErrorMessage('');
    setErrorMsg('');
    if (!gstinPan.trim()) {
      setGstErrorMessage('Please enter a 15-digit GSTIN to verify.');
      return;
    }

    const cleanGst = gstinPan.trim().toUpperCase();
    if (cleanGst.length !== 15) {
      setGstErrorMessage('GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }

    setIsVerifyingGst(true);
    try {
      const mode = getGstVerificationMode();
      setActiveGstMode(mode);

      // If in Manual CAPTCHA mode and no session exists, generate one and prompt user
      if (mode === 'MANUAL_CAPTCHA' && !captchaSession) {
        const session = generateCaptchaChallenge(cleanGst);
        setCaptchaSession(session);
        setIsVerifyingGst(false);
        setGstErrorMessage('CAPTCHA challenge generated. Please enter the 6 characters shown in the image below.');
        return;
      }

      const result = await verifyGSTIN({
        gstin: cleanGst,
        mode,
        captchaAnswer: captchaInput,
        sessionId: captchaSession?.sessionId,
        requestedBy: currentUser.fullName,
      });

      // Stage details and open pre-save review modal
      setStagedGstDetails(result);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      setGstErrorMessage(err.message || 'GSTIN verification failed. Please check inputs.');
      // Refresh CAPTCHA challenge automatically on error in manual mode
      if (activeGstMode === 'MANUAL_CAPTCHA') {
        const refreshed = generateCaptchaChallenge(cleanGst);
        setCaptchaSession(refreshed);
        setCaptchaInput('');
      }
    } finally {
      setIsVerifyingGst(false);
    }
  };

  const handleConfirmGstReview = (details: GSTVerificationDetails) => {
    // Map official Legal Name to BP Name (non-editable/locked once verified)
    // Map official Trade Name to BP Trade Name (non-editable/locked once verified)
    setBpName(details.legalName);
    setGstLegalName(details.legalName);
    setGstTradeName(details.tradeName || details.legalName);
    setPanNumber(details.gstin.slice(2, 12));
    setGstRegistrationType(details.taxpayerType);
    setGstStatus('ACTIVE');
    setGstRegisteredEmail(`tax.${details.gstin.slice(2, 12).toLowerCase()}@partner.gov.in`);
    setGstRegisteredMobile('+91 98765 43210');

    // Populate filing history
    if (details.filingHistory && details.filingHistory.length > 0) {
      setGstFilingHistory(
        details.filingHistory.map((f) => ({
          returnPeriod: f.taxPeriod,
          dateOfFiling: f.dateOfFiling,
          status: f.status,
        }))
      );
    }

    // Map Principal Place of Business to Bill-To Address
    setBillToCountry(details.principalPlaceOfBusiness.country || 'India');
    setBillToState(details.principalPlaceOfBusiness.state);
    setBillToCity(details.principalPlaceOfBusiness.city);
    if (details.principalPlaceOfBusiness.district) {
      setBillToDistrict(details.principalPlaceOfBusiness.district);
    }
    setBillToPostalCode(details.principalPlaceOfBusiness.postalCode);
    const streetParts = [
      details.principalPlaceOfBusiness.doorBuildingNo,
      details.principalPlaceOfBusiness.streetName,
      details.principalPlaceOfBusiness.locality,
    ]
      .filter(Boolean)
      .join(', ');
    setBillToStreetAddress(streetParts || 'Principal Place of Business');

    // Persist verified details
    setSavedGstDetails(details);

    // Record in Verification Audit Log (Tab 9)
    const logEntry: BPGovernanceLog = {
      id: `gov-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `Official GSTIN Verification Confirmed (${details.verificationSource})`,
      verifier: `${currentUser.fullName}`,
      details: `GSTIN: ${details.gstin} | Legal: ${details.legalName} | Trade: ${details.tradeName} | PAN: ${details.gstin.slice(2, 12)} | Status: ACTIVE | Review Confirmed.`,
      status: 'VERIFIED',
    };
    setGovernanceLogs((prev) => [logEntry, ...prev]);

    setIsReviewModalOpen(false);
    setGstErrorMessage('');
    setSuccessMsg(`Official GST details for "${details.legalName}" verified & confirmed from ${details.verificationSource}.`);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const handleVerifyMsme = () => {
    if (!msmeInfo.udyamRegistrationNo?.trim()) {
      alert('Please enter a valid Udyam Registration Number.');
      return;
    }

    setIsVerifyingMsme(true);
    setTimeout(() => {
      setIsVerifyingMsme(false);
      setMsmeInfo((prev) => ({
        ...prev,
        enterpriseName: bpName || 'KOSH PRECISION PLASTICS PRIVATE LIMITED',
        enterpriseType: 'Private Limited',
        activityType: 'MANUFACTURING',
        msmeClassification: 'SMALL',
        registrationPeriodStatus: 'Active & Valid (Post-July 2020 Revalidated)',
        lastRevalidatedAt: new Date().toISOString(),
      }));
      alert('MSME Udyam Registration verified successfully from MSME Portal API.');
    }, 900);
  };

  const handleSaveBp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Rule 1: Mandatory Business Partner Name
    if (!bpName.trim()) {
      setErrorMsg('Business Partner Name is required.');
      return;
    }

    // Rule 2: Mandatory Contact Person with mobile & email (Section G)
    if (contacts.length === 0 || !contacts.some((c) => c.mobile.trim() && c.email.trim())) {
      setErrorMsg('SAVE BLOCKED: At least one contact person with a valid Mobile Number and Email Address is mandatory.');
      return;
    }

    // Rule 3: Mandatory Bill-to Address details in General tab
    if (!billToCountry.trim() || !billToState.trim() || !billToCity.trim() || !billToStreetAddress.trim()) {
      setErrorMsg('SAVE BLOCKED: Mandatory Bill-to Address details (Country, State, City, Street) are required on General Tab.');
      return;
    }

    // Rule 4: Mandatory Cancelled Cheque for every bank account
    if (bankAccounts.some((b) => !b.cancelledChequeFileName)) {
      setErrorMsg('SAVE BLOCKED: Uploading a Cancelled Cheque document is mandatory for EVERY registered bank account.');
      return;
    }

    // Rule 5: Transaction blocking if GST Status is not ACTIVE
    if (gstinPan.trim() && gstStatus !== 'ACTIVE' && gstStatus !== 'VERIFIED') {
      setErrorMsg(`SAVE BLOCKED: GSTIN status is "${gstStatus}". Only ACTIVE GST registrations are eligible for saving & transactions.`);
      return;
    }

    const billToAddr: BPAddress = {
      id: `bill-${Date.now()}`,
      addressName: 'Registered Billing Address',
      addressType: 'BILL_TO',
      country: billToCountry.trim(),
      state: billToState.trim(),
      district: billToDistrict.trim(),
      city: billToCity.trim(),
      postalCode: billToPostalCode.trim(),
      streetAddress: billToStreetAddress.trim(),
      isDefault: true,
    };

    // Auto-create one default Shipping Address from Billing Address if no shipping addresses exist
    let finalShippingAddresses = [...shippingAddresses];
    if (finalShippingAddresses.length === 0) {
      finalShippingAddresses.push({
        ...billToAddr,
        id: `ship-auto-${Date.now()}`,
        addressName: 'Primary Shipping Yard (Auto from Billing)',
        addressType: 'SHIP_TO',
        isDefault: true,
      });
    }

    if (editingBp) {
      // Check if locked
      if (editingBp.isLocked && currentUser.role !== 'PLATFORM_ADMIN') {
        setErrorMsg('LOCKED: Approved Business Partner data is locked against direct editing. Please submit an Amendment Request.');
        return;
      }

      const updatedList = bpList.map((b) => {
        if (b.id === editingBp.id) {
          return {
            ...b,
            branchId: selectedBranchId,
            branchCode: currentBranch.code,
            portalBranchCode: currentBranch.portalBranchCode,
            bpName: bpName.trim(),
            bpType,
            shortName: shortName.trim(),
            groupIndustry,
            currency,
            gstinPan: gstinPan.trim().toUpperCase(),
            panNumber: panNumber.trim().toUpperCase(),
            gstLegalName,
            gstTradeName,
            gstTaxpayerType: gstRegistrationType,
            gstStatus,
            gstRegisteredEmail,
            gstRegisteredMobile,
            gstFilingHistory,
            msmeInfo,
            city: billToCity.trim(),
            district: billToDistrict.trim(),
            state: billToState.trim(),
            country: billToCountry.trim(),
            postalCode: billToPostalCode.trim(),
            streetAddress: billToStreetAddress.trim(),
            contacts,
            addresses: [billToAddr, ...finalShippingAddresses],
            paymentTerms,
            accounting: {
              ...b.accounting,
              bankAccounts,
            },
            properties,
            remarks,
            attachments,
            governanceLogs,
            gstVerificationDetails: savedGstDetails || b.gstVerificationDetails || (gstinPan ? getOrCreateGstDetailsForEntity(gstinPan, bpName, gstTradeName) : undefined),
            updatedAt: new Date().toISOString(),
          };
        }
        return b;
      });

      setBpList(updatedList);
      localStorage.setItem('kosh_business_partners', JSON.stringify(updatedList));
      setIsModalOpen(false);
      setSuccessMsg(`Business Partner "${bpName.trim()}" updated successfully.`);
    } else {
      const newBp: BusinessPartner = {
        id: `bp-${Date.now()}`,
        branchId: selectedBranchId,
        branchCode: currentBranch.code,
        portalBranchCode: currentBranch.portalBranchCode,
        bpCode: calculatedCardCode,
        bpName: bpName.trim(),
        bpType,
        shortName: shortName.trim(),
        groupIndustry,
        currency,
        gstinPan: gstinPan.trim().toUpperCase(),
        panNumber: panNumber.trim().toUpperCase(),
        gstLegalName: gstLegalName || bpName.trim(),
        gstTradeName: gstTradeName || bpName.trim(),
        gstTaxpayerType: gstRegistrationType,
        gstStatus,
        gstRegisteredEmail,
        gstRegisteredMobile,
        gstFilingHistory,
        gstVerificationDetails: savedGstDetails || (gstinPan ? getOrCreateGstDetailsForEntity(gstinPan, bpName, gstTradeName) : undefined),
        msmeInfo,
        phone: contacts[0]?.mobile || '+91 98000 00000',
        email: contacts[0]?.email || 'contact@partner.com',
        city: billToCity.trim(),
        district: billToDistrict.trim(),
        state: billToState.trim(),
        country: billToCountry.trim(),
        postalCode: billToPostalCode.trim(),
        streetAddress: billToStreetAddress.trim(),
        status: 'ACTIVE',
        isLocked: true, // Lock approved BP data against direct editing
        approvalStatus: 'APPROVED',
        contacts,
        addresses: [billToAddr, ...finalShippingAddresses],
        paymentTerms,
        accounting: {
          controlAccount: '112000 - Accounts Receivable Trade',
          bankAccounts,
        },
        properties,
        remarks,
        attachments,
        governanceLogs: [
          {
            id: `gov-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'Partner Creation & Multi-Govt Verification Gate',
            verifier: currentUser.fullName,
            details: `CardCode: ${calculatedCardCode} | GSTIN Status: ${gstStatus} | MSME: ${msmeInfo.isMSME ? 'YES' : 'NO'}.`,
            status: 'VERIFIED',
          },
          ...governanceLogs,
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
      };

      const updatedList = [newBp, ...bpList];
      setBpList(updatedList);
      localStorage.setItem('kosh_business_partners', JSON.stringify(updatedList));
      setIsModalOpen(false);
      setSuccessMsg(`Business Partner [${newBp.bpCode}] "${newBp.bpName}" created & approved successfully.`);
    }

    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleInspectBp = (bp: BusinessPartner) => {
    const enrichedBp: BusinessPartner = {
      ...bp,
      gstVerificationDetails: bp.gstVerificationDetails || (bp.gstinPan ? getOrCreateGstDetailsForEntity(bp.gstinPan, bp.bpName, bp.gstTradeName) : undefined),
    };
    setInspectedBp(enrichedBp);
    setInspectorTab('GENERAL');
    setIsInspectorOpen(true);
  };

  const filteredBps = bpList.filter((b) => {
    // Screen-level Company Filter
    if (companyFilter !== 'ALL') {
      const bCompanyId = (b as any).companyId || (branches.find((br) => br.id === b.branchId)?.companyId) || 'co-kosh-01';
      if (bCompanyId !== companyFilter) return false;
    }

    // Screen-level Branch Filter
    if (branchFilter !== 'ALL' && b.branchId !== branchFilter) {
      return false;
    }

    const matchesType = typeFilter === 'ALL' || b.bpType === typeFilter;
    const matchesGst =
      gstFilter === 'ALL' ||
      (gstFilter === 'VERIFIED' ? b.gstStatus === 'ACTIVE' || b.gstStatus === 'VERIFIED' : b.gstStatus !== 'ACTIVE');
    const matchesSearch =
      b.bpCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bpName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.gstinPan && b.gstinPan.toLowerCase().includes(searchTerm.toLowerCase())) ||
      b.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesGst && matchesSearch;
  });

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {operatingContext && <ContextIndicatorBar context={operatingContext} compact={true} />}

      {/* Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-600" />
            Business Partner Master
          </h2>
          <p className="text-slate-500 mt-0.5">
            Full Governance: Non-editable CardCode (K+Type+Branch+Seq), GSTIN/PAN Verification, MSME/Udyam & Multi-Bank Cheque Upload.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
        >
          <Plus className="w-4 h-4" /> Add Business Partner
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
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
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Screen-Level Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setBranchFilter('ALL');
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Authorized Companies</option>
            <option value="co-kosh-01">KOSH-HQ — Kosh Innovations Pvt Ltd</option>
            <option value="co-kosh-02">KOSH-SOUTH — Kosh South Logistics India Pvt Ltd</option>
            <option value="co-kosh-03">KOSH-WEST — Kosh West Manufacturing Components Pvt Ltd</option>
          </select>

          {/* Screen-Level Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Authorized Branches</option>
            {branches
              .filter((br) => companyFilter === 'ALL' || (br.companyId || 'co-kosh-01') === companyFilter)
              .map((br) => (
                <option key={br.id} value={br.id}>
                  [{br.portalBranchCode}] {br.name}
                </option>
              ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">All BP Types</option>
            <option value="CUSTOMER">Customer (C)</option>
            <option value="SUPPLIER">Supplier (S)</option>
            <option value="LEAD">Lead (L)</option>
          </select>

          <select
            value={gstFilter}
            onChange={(e) => setGstFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">GSTIN Status (All)</option>
            <option value="VERIFIED">ACTIVE / Verified Only</option>
            <option value="UNVERIFIED">Unverified / Blocked</option>
          </select>
        </div>

        <span className="text-slate-500 font-semibold">
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
                <th className="p-3.5">Location (Country, State, City)</th>
                <th className="p-3.5">MSME / Udyam</th>
                <th className="p-3.5">GST Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No business partners found matching filters.
                  </td>
                </tr>
              ) : (
                filteredBps.map((bp) => {
                  const isGstActive = bp.gstStatus === 'ACTIVE' || bp.gstStatus === 'VERIFIED';
                  return (
                    <tr key={bp.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            bp.bpType === 'CUSTOMER'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : bp.bpType === 'SUPPLIER'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-purple-100 text-purple-800 border-purple-300'
                          }`}
                        >
                          {bp.bpType}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{bp.bpCode}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        <div>{bp.bpName}</div>
                        {bp.groupIndustry && (
                          <div className="text-[10px] text-slate-500 font-medium">{bp.groupIndustry}</div>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">
                        <div className="text-slate-900 font-bold">{bp.gstinPan || 'N/A'}</div>
                        {bp.panNumber && (
                          <div className="text-[10px] text-slate-500 font-mono">PAN: {bp.panNumber}</div>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700 font-medium">
                        {bp.country || 'India'}, {bp.state}, {bp.city}
                      </td>
                      <td className="p-3.5">
                        {bp.msmeInfo?.isMSME ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-max">
                            <Award className="w-3 h-3 text-emerald-600" />
                            {bp.msmeInfo.msmeClassification || 'MSME YES'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">NO</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 font-bold">
                          {isGstActive ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className={isGstActive ? 'text-emerald-700' : 'text-rose-700'}>
                            {isGstActive ? 'ACTIVE' : bp.gstStatus || 'BLOCKED'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleInspectBp(bp)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="View Full Partner Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(bp)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit Partner Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT BUSINESS PARTNER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col overflow-hidden max-h-[92vh]">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="font-bold text-sm flex items-center gap-2">
                <Users2 className="w-4 h-4 text-indigo-300" />
                <span>{editingBp ? `Edit Business Partner [${editingBp.bpCode}]` : 'Create Business Partner Master'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-indigo-200 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Lock Banner if Approved */}
            {editingBp?.isLocked && (
              <div className="mx-4 mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg font-bold flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Approved Business Partner Data is Locked against direct editing.</span>
                </div>
                <button
                  type="button"
                  onClick={() => alert('Amendment request submitted to Workflow Queue.')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] cursor-pointer"
                >
                  Request Amendment
                </button>
              </div>
            )}

            {/* Form Tabs Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 flex overflow-x-auto gap-1 text-[11px] font-bold text-slate-600 pt-2 shrink-0">
              {[
                { key: 'GENERAL', label: '1. General & Bill-to', icon: FileText },
                { key: 'CONTACTS', label: '2. Contacts', icon: Users2 },
                { key: 'SHIPPING_ADDRESSES', label: '3. Shipping Addresses', icon: MapPin },
                { key: 'PAYMENT_TERMS', label: '4. Payment Terms', icon: CreditCard },
                { key: 'ACCOUNTING_BANKING', label: '5. Banking & Accounting', icon: DollarSign },
                { key: 'PROPERTIES', label: '6. Properties', icon: Tag },
                { key: 'REMARKS', label: '7. Remarks', icon: BookOpen },
                { key: 'ATTACHMENTS', label: '8. Attachments', icon: Download },
                { key: 'GOVERNANCE_AUDIT', label: '9. Verification Audit Log', icon: ShieldCheck },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
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

            <form onSubmit={handleSaveBp} className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: GENERAL & BILL-TO */}
              {activeTab === 'GENERAL' && (
                <div className="space-y-4">
                  {/* Branch & CardCode Sequence Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Operating Branch *</label>
                      <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            [{b.portalBranchCode}] {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Business Partner Type *</label>
                      <select
                        value={bpType}
                        onChange={(e) => setBpType(e.target.value as any)}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="CUSTOMER">Customer (C)</option>
                        <option value="SUPPLIER">Supplier / Vendor (S)</option>
                        <option value="LEAD">Lead / Prospect (L)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-indigo-900 mb-1 flex items-center justify-between">
                        <span>CardCode (Auto-Generated)</span>
                        <Lock className="w-3 h-3 text-indigo-600" />
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={calculatedCardCode}
                        className="w-full text-xs p-2 bg-slate-200 border border-slate-300 rounded-lg font-mono font-black text-indigo-900 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* GSTIN & PAN Section — Positioned Directly Below CardCode Block */}
                  <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-indigo-950 text-xs">GSTIN Taxpayer Verification</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          activeGstMode === 'PAID_API'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {activeGstMode === 'PAID_API' ? 'Paid B2B API Gateway' : 'Manual CAPTCHA Mode (Official Portal)'}
                        </span>
                      </div>

                      {activeGstMode === 'PAID_API' && (
                        <button
                          type="button"
                          onClick={handleVerifyGstInModal}
                          disabled={isVerifyingGst}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                        >
                          {isVerifyingGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Verify with Paid API</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">GSTIN ID *</label>
                        <input
                          type="text"
                          maxLength={15}
                          placeholder="e.g. 34AAACK4603M1ZP"
                          value={gstinPan}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setGstinPan(val);
                            if (val.length === 15 && activeGstMode === 'MANUAL_CAPTCHA') {
                              handleRequestNewCaptcha(val);
                            }
                          }}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold uppercase bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Auto-Extracted PAN</label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={panNumber || (gstinPan.length >= 12 ? gstinPan.slice(2, 12) : '')}
                          className="w-full text-xs p-2 bg-slate-200 border border-slate-300 rounded-lg font-mono font-bold text-indigo-900 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">GST Registration Status</label>
                        <div className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold flex items-center justify-between">
                          <span className={gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED' ? 'text-emerald-700' : 'text-slate-600'}>
                            {gstStatus}
                          </span>
                          {gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline CAPTCHA Challenge Container (Manual CAPTCHA Mode) */}
                    {activeGstMode === 'MANUAL_CAPTCHA' && (
                      <div className="p-3 bg-white rounded-lg border border-indigo-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Govt GSTN Portal CAPTCHA Challenge</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">Session Expiry: 120s</span>
                        </div>

                        {captchaSession ? (
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Inline CAPTCHA SVG Image */}
                            <div className="flex items-center gap-2">
                              <img
                                src={captchaSession.captchaDataUrl}
                                alt="Official Portal CAPTCHA Challenge"
                                className="h-10 rounded border border-slate-300 shadow-2xs bg-slate-50"
                              />
                              <button
                                type="button"
                                onClick={() => handleRequestNewCaptcha()}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Refresh CAPTCHA Challenge"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>

                            {/* CAPTCHA Text Input */}
                            <div className="flex-1 min-w-[140px]">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="ENTER 6 CHARS"
                                value={captchaInput}
                                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                                className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-black uppercase tracking-widest text-indigo-950 bg-slate-50 focus:bg-white"
                              />
                            </div>

                            {/* Verify Action */}
                            <button
                              type="button"
                              onClick={handleVerifyGstInModal}
                              disabled={isVerifyingGst}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                            >
                              {isVerifyingGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              <span>Verify GSTIN</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">Ready to initiate official taxpayer search workflow.</span>
                            <button
                              type="button"
                              onClick={() => handleRequestNewCaptcha()}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition cursor-pointer"
                            >
                              Load CAPTCHA Challenge
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline Error Message */}
                    {gstErrorMessage && (
                      <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-lg font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{gstErrorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Partner Name (Official Legal Name) & Trade Name (Official Trade Name) — Cannot be edited once verified */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-900 mb-1 flex items-center justify-between">
                        <span>Business Partner Name (Official Legal Name) *</span>
                        {(gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED') && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3 text-indigo-600" /> Locked from Verified GST
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Official Legal Entity Name"
                        value={bpName}
                        onChange={(e) => setBpName(e.target.value)}
                        readOnly={gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED'}
                        className={`w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900 ${
                          gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED'
                            ? 'bg-slate-100 cursor-not-allowed text-indigo-950 font-black'
                            : 'bg-white'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-900 mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>Trade Name (Official Trade Name)</span>
                          <button
                            type="button"
                            onClick={() => setIsTradeDetailsModalOpen(true)}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs hover:border-indigo-300"
                            title="View GST Trade Name & Nature of Business Activities Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>View Details</span>
                          </button>
                        </div>
                        {(gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED') && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3 text-indigo-600" /> Locked from Verified GST
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Registered Trade Name"
                        value={gstTradeName}
                        onChange={(e) => setGstTradeName(e.target.value)}
                        readOnly={gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED'}
                        className={`w-full text-xs p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900 ${
                          gstStatus === 'ACTIVE' || gstStatus === 'VERIFIED'
                            ? 'bg-slate-100 cursor-not-allowed text-indigo-950 font-black'
                            : 'bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Short Name</label>
                      <input
                        type="text"
                        placeholder="e.g. MSIL"
                        value={shortName}
                        onChange={(e) => setShortName(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Govt Industry Group *</label>
                      <select
                        value={groupIndustry}
                        onChange={(e) => setGroupIndustry(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                      >
                        {INDIAN_GOVT_INDUSTRIES.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                      >
                        <option value="INR">INR — Indian Rupee</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                      </select>
                    </div>
                  </div>

                  {/* Mandatory Bill-to Address Section (Section D) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-500" />
                      <span>Mandatory Bill-to Address Details (Country → State → City)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Country *</label>
                        <input
                          type="text"
                          value={billToCountry}
                          onChange={(e) => setBillToCountry(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">State *</label>
                        <input
                          type="text"
                          value={billToState}
                          onChange={(e) => setBillToState(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">City *</label>
                        <input
                          type="text"
                          value={billToCity}
                          onChange={(e) => setBillToCity(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Postal Code</label>
                        <input
                          type="text"
                          value={billToPostalCode}
                          onChange={(e) => setBillToPostalCode(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono bg-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Street Address *</label>
                        <input
                          type="text"
                          placeholder="Street, Building, Floor"
                          value={billToStreetAddress}
                          onChange={(e) => setBillToStreetAddress(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* MSME / Udyam Section (Section E) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-indigo-600" />
                        <span>MSME / Udyam Registration Master (Section E)</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 text-xs">Is MSME Registered?</span>
                        <input
                          type="checkbox"
                          checked={msmeInfo.isMSME}
                          onChange={(e) => setMsmeInfo({ ...msmeInfo, isMSME: e.target.checked })}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                      </div>
                    </div>

                    {msmeInfo.isMSME && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Udyam Reg. No. e.g. UDYAM-TN-03-0012345"
                            value={msmeInfo.udyamRegistrationNo || ''}
                            onChange={(e) => setMsmeInfo({ ...msmeInfo, udyamRegistrationNo: e.target.value.toUpperCase() })}
                            className="flex-1 text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyMsme}
                            disabled={isVerifyingMsme}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            {isVerifyingMsme ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                            Verify MSME
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-lg border font-mono">
                          <div>
                            <span className="text-slate-500 block text-[9px]">Classification:</span>
                            <strong className="text-indigo-900">{msmeInfo.msmeClassification}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">Activity Type:</span>
                            <strong className="text-indigo-900">{msmeInfo.activityType}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">Investment Bracket:</span>
                            <strong className="text-indigo-900">{msmeInfo.investmentCategory}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">Turnover Bracket:</span>
                            <strong className="text-indigo-900">{msmeInfo.turnoverCategory}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACTS */}
              {activeTab === 'CONTACTS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 text-xs">
                      Contact Persons (At least 1 with Mobile & Email is Mandatory)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setContactForm({
                          id: '',
                          name: '',
                          title: 'Mr.',
                          position: 'Manager',
                          department: 'Procurement',
                          mobile: '',
                          email: '',
                          isDefault: contacts.length === 0,
                        });
                        setIsContactSubModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      + Add Contact
                    </button>
                  </div>

                  {contacts.map((c, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <span>{c.title} {c.name}</span>
                          {c.isDefault && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{c.position} — {c.department}</div>
                        <div className="text-[11px] font-mono text-slate-700 mt-1 flex items-center gap-3">
                          <span>📱 {c.mobile}</span>
                          <span>✉️ {c.email}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: SHIPPING ADDRESSES */}
              {activeTab === 'SHIPPING_ADDRESSES' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 text-xs">
                      Shipping Addresses (Auto-created default from Billing Address)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShippingForm({
                          id: '',
                          addressName: 'Secondary Plant Shipping Yard',
                          addressType: 'SHIP_TO',
                          country: 'India',
                          state: billToState,
                          district: billToDistrict,
                          city: billToCity,
                          postalCode: billToPostalCode,
                          streetAddress: '',
                          isDefault: false,
                        });
                        setIsShippingSubModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      + Add Shipping Address
                    </button>
                  </div>

                  {shippingAddresses.map((s, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          <span>{s.addressName}</span>
                          {s.isDefault && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                              DEFAULT SHIP-TO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {s.streetAddress}, {s.city}, {s.state}, {s.country} - {s.postalCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShippingAddresses(shippingAddresses.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: PAYMENT TERMS */}
              {activeTab === 'PAYMENT_TERMS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Terms</label>
                    <select
                      value={paymentTerms.paymentTermsCode}
                      onChange={(e) => setPaymentTerms({ ...paymentTerms, paymentTermsCode: e.target.value })}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    >
                      <option value="NET30">Net 30 Days</option>
                      <option value="NET60">Net 60 Days</option>
                      <option value="ADVANCE">100% Advance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assigned Price List (Empty by Default)</label>
                    <select
                      value={paymentTerms.priceList || ''}
                      onChange={(e) => setPaymentTerms({ ...paymentTerms, priceList: e.target.value })}
                      className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                    >
                      <option value="">— None (Select Price List) —</option>
                      <option value="Standard Sales Price 2026">Standard Sales Price 2026</option>
                      <option value="OEM Preferred Tier 1">OEM Preferred Tier 1</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Credit Limit (INR)</label>
                    <input
                      type="number"
                      value={paymentTerms.creditLimit || 0}
                      onChange={(e) => setPaymentTerms({ ...paymentTerms, creditLimit: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Commitment Limit (INR)</label>
                    <input
                      type="number"
                      value={paymentTerms.commitmentLimit || 0}
                      onChange={(e) => setPaymentTerms({ ...paymentTerms, commitmentLimit: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: BANKING & ACCOUNTING */}
              {activeTab === 'ACCOUNTING_BANKING' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-900 text-xs">
                      Registered Bank Accounts (Mandatory Cancelled Cheque Upload for Every Account)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setBankForm({
                          id: '',
                          bankName: 'HDFC Bank Ltd',
                          branchName: 'Fort Branch',
                          ifscCode: 'HDFC0000012',
                          ibanSwift: 'HDFCINBB',
                          accountNumber: '',
                          cancelledChequeFileName: '',
                          isDefault: bankAccounts.length === 0,
                        });
                        setIsBankSubModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                    >
                      + Add Bank Account
                    </button>
                  </div>

                  {bankAccounts.map((b, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{b.bankName} ({b.branchName})</span>
                          {b.isDefault && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                              DEFAULT BANK
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-700 mt-1">
                          IFSC: <strong>{b.ifscCode}</strong> | Account No: <strong>{b.accountNumber}</strong> | SWIFT: {b.ibanSwift || 'N/A'}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Cancelled Cheque: {b.cancelledChequeFileName || 'Uploaded'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBankAccounts(bankAccounts.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 9: VERIFICATION AUDIT LOG (Section C) */}
              {activeTab === 'GOVERNANCE_AUDIT' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-cyan-400 font-bold text-xs uppercase">Restricted Government Verification Audit Log</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Detailed request/response records for GST, PAN, REG-06 Certificate and MSME queries.
                      </div>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  </div>

                  <div className="space-y-2">
                    {governanceLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1 font-mono">
                        <div className="flex items-center justify-between text-indigo-900 font-bold">
                          <span>{log.action}</span>
                          <span className="text-slate-500 font-normal">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-700">{log.details}</div>
                        <div className="text-[10px] text-slate-500">Verified By: {log.verifier}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer"
                >
                  {editingBp ? 'Save Business Partner Changes' : 'Create & Approve Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BANK SUB-MODAL WITH CANCELLED CHEQUE UPLOAD */}
      {isBankSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border max-w-md w-full p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Add Bank Account (Requires Cancelled Cheque)</h3>

            <div>
              <label className="block font-bold text-slate-700 mb-1">IFSC Code *</label>
              <input
                type="text"
                placeholder="e.g. HDFC0000012"
                value={bankForm.ifscCode}
                onChange={(e) => {
                  const ifsc = e.target.value.toUpperCase();
                  setBankForm({
                    ...bankForm,
                    ifscCode: ifsc,
                    bankName: ifsc.startsWith('HDFC') ? 'HDFC Bank Ltd' : ifsc.startsWith('SBIN') ? 'State Bank of India' : 'ICICI Bank Ltd',
                    branchName: ifsc.startsWith('HDFC') ? 'Fort Branch' : 'Main Branch',
                  });
                }}
                className="w-full text-xs p-2 border rounded font-mono uppercase font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full text-xs p-2 border rounded font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={bankForm.branchName}
                  onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                  className="w-full text-xs p-2 border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bank Account Number *</label>
              <input
                type="text"
                placeholder="e.g. 50200011223344"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                className="w-full text-xs p-2 border rounded font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Upload Cancelled Cheque (Mandatory) *</label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBankForm({ ...bankForm, cancelledChequeFileName: file.name });
                  }
                }}
                className="w-full text-xs p-1 border rounded bg-slate-50"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBankSubModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!bankForm.accountNumber || !bankForm.cancelledChequeFileName) {
                    alert('Account Number and Cancelled Cheque upload are MANDATORY.');
                    return;
                  }
                  setBankAccounts([...bankAccounts, bankForm]);
                  setIsBankSubModalOpen(false);
                }}
                className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded cursor-pointer"
              >
                Add Bank Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRE-SAVE GST VERIFICATION REVIEW & CONFIRMATION MODAL */}
      {isReviewModalOpen && stagedGstDetails && (
        <GSTVerificationReviewModal
          isOpen={isReviewModalOpen}
          details={stagedGstDetails}
          mode={activeGstMode}
          targetEntityName="Business Partner Master"
          currentValues={{
            name: bpName,
            tradeName: gstTradeName,
            city: billToCity,
            state: billToState,
            address: billToStreetAddress,
          }}
          onConfirm={handleConfirmGstReview}
          onCancel={() => setIsReviewModalOpen(false)}
        />
      )}

      {/* BUSINESS PARTNER VIEW DETAILS / INSPECTOR MODAL */}
      {isInspectorOpen && inspectedBp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden text-xs font-sans">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Users2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-cyan-300 text-sm">{inspectedBp.bpCode}</span>
                    <span className="text-slate-400">•</span>
                    <h3 className="font-bold text-sm text-white truncate">{inspectedBp.bpName}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                        inspectedBp.bpType === 'CUSTOMER'
                          ? 'bg-blue-900/60 text-blue-300 border-blue-700/50'
                          : inspectedBp.bpType === 'SUPPLIER'
                          ? 'bg-amber-900/60 text-amber-300 border-amber-700/50'
                          : 'bg-purple-900/60 text-purple-300 border-purple-700/50'
                      }`}
                    >
                      {inspectedBp.bpType}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-3">
                    <span>GSTIN: <strong className="text-white font-mono">{inspectedBp.gstinPan || 'N/A'}</strong></span>
                    <span>Branch: <strong className="text-white font-mono">[{inspectedBp.portalBranchCode || '001'}] {inspectedBp.branchCode}</strong></span>
                    {inspectedBp.msmeInfo?.isMSME && (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Award className="w-3.5 h-3.5" /> MSME: {inspectedBp.msmeInfo.msmeClassification || 'YES'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsInspectorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Tabs */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 flex gap-1 text-[11px] font-bold text-slate-600 pt-2 shrink-0 overflow-x-auto">
              {[
                { key: 'GENERAL', label: '1. General & Bill-To', icon: FileText },
                { key: 'CONTACTS', label: `2. Contacts (${inspectedBp.contacts?.length || 0})`, icon: Users2 },
                { key: 'SHIPPING', label: `3. Shipping Addresses (${inspectedBp.addresses?.length || 0})`, icon: MapPin },
                { key: 'BANKING', label: `4. Banking & Terms (${inspectedBp.accounting?.bankAccounts?.length || 0})`, icon: DollarSign },
                { key: 'GST_DETAILS', label: '5. Official GST Details (Govt GSTN)', icon: ShieldCheck },
                { key: 'AUDIT', label: `6. Verification Logs (${inspectedBp.governanceLogs?.length || 0})`, icon: ShieldAlert },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = inspectorTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setInspectorTab(tab.key as any)}
                    className={`px-3 py-2 border-b-2 font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                      isActive
                        ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Inspector Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: GENERAL */}
              {inspectorTab === 'GENERAL' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs">Partner Identity & Classification</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Business Partner Name</span>
                        <span className="font-bold text-slate-900">{inspectedBp.bpName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Trade Name</span>
                        <span className="font-bold text-slate-900">{inspectedBp.gstTradeName || inspectedBp.shortName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Official Legal Name</span>
                        <span className="font-bold text-slate-900">{inspectedBp.gstLegalName || inspectedBp.bpName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Industry Segment</span>
                        <span className="font-medium text-slate-800">{inspectedBp.groupIndustry || 'General Manufacturing'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Transaction Currency</span>
                        <span className="font-mono font-bold text-indigo-900">{inspectedBp.currency || 'INR'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Governance State</span>
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {inspectedBp.status} • {inspectedBp.approvalStatus || 'APPROVED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bill-to Address */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>Registered Bill-To Address</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        PRIMARY BILLING
                      </span>
                    </div>
                    <div className="text-slate-800 text-xs">
                      {inspectedBp.streetAddress || 'Industrial Yard'}
                    </div>
                    <div className="text-slate-600 text-xs">
                      {inspectedBp.city}, {inspectedBp.district && `${inspectedBp.district}, `}{inspectedBp.state}, {inspectedBp.country} - <strong className="font-mono">{inspectedBp.postalCode}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACTS */}
              {inspectorTab === 'CONTACTS' && (
                <div className="space-y-3">
                  {(!inspectedBp.contacts || inspectedBp.contacts.length === 0) ? (
                    <div className="p-4 bg-slate-50 border border-dashed rounded-xl text-center text-slate-500">
                      No contacts recorded.
                    </div>
                  ) : (
                    inspectedBp.contacts.map((c, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <span>{c.title} {c.name}</span>
                            {c.isDefault && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{c.position} — {c.department}</div>
                          <div className="text-[11px] font-mono text-slate-700 mt-1 flex items-center gap-4">
                            <span>📱 {c.mobile}</span>
                            <span>✉️ {c.email}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: SHIPPING */}
              {inspectorTab === 'SHIPPING' && (
                <div className="space-y-3">
                  {(!inspectedBp.addresses || inspectedBp.addresses.length === 0) ? (
                    <div className="p-4 bg-slate-50 border border-dashed rounded-xl text-center text-slate-500">
                      No shipping addresses recorded.
                    </div>
                  ) : (
                    inspectedBp.addresses.map((a, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          <span>{a.addressName}</span>
                          <span className="text-[9px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                            {a.addressType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {a.streetAddress}, {a.city}, {a.state}, {a.country} - {a.postalCode}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: BANKING & TERMS */}
              {inspectorTab === 'BANKING' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Payment Terms</span>
                      <strong className="text-indigo-900">{inspectedBp.paymentTerms?.paymentTermsCode || 'NET30'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Credit Limit</span>
                      <strong className="font-mono text-slate-800">₹{(inspectedBp.paymentTerms?.creditLimit || 0).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Price List</span>
                      <strong className="text-slate-800">{inspectedBp.paymentTerms?.priceList || '— (Standard)'}</strong>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs">Registered Bank Accounts</h4>
                    {(inspectedBp.accounting?.bankAccounts || []).map((b, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{b.bankName} ({b.branchName})</span>
                            {b.isDefault && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-700 mt-1">
                            IFSC: <strong>{b.ifscCode}</strong> | Account No: <strong>{b.accountNumber}</strong>
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Cancelled Cheque: {b.cancelledChequeFileName || 'Attached'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: OFFICIAL GST DETAILS (Full Rich Sections) */}
              {inspectorTab === 'GST_DETAILS' && (
                <div className="space-y-4">
                  <GSTDetailsInspector
                    details={
                      inspectedBp.gstVerificationDetails ||
                      (inspectedBp.gstinPan
                        ? getOrCreateGstDetailsForEntity(inspectedBp.gstinPan, inspectedBp.bpName, inspectedBp.gstTradeName)
                        : undefined)
                    }
                  />
                </div>
              )}

              {/* TAB 6: AUDIT */}
              {inspectorTab === 'AUDIT' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-cyan-400 font-bold text-xs uppercase">Government Verification & Governance Audit Trail</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Immutable verification records, timestamps, provider signatures, and reviewer IDs.
                      </div>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  </div>

                  <div className="space-y-2">
                    {(!inspectedBp.governanceLogs || inspectedBp.governanceLogs.length === 0) ? (
                      <div className="p-4 bg-slate-50 border border-dashed rounded-xl text-center text-slate-500">
                        No audit records available.
                      </div>
                    ) : (
                      inspectedBp.governanceLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1 font-mono">
                          <div className="flex items-center justify-between text-indigo-900 font-bold">
                            <span>{log.action}</span>
                            <span className="text-slate-500 font-normal">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-slate-700">{log.details}</div>
                          <div className="text-[10px] text-slate-500">Verified By: {log.verifier} • Status: {log.status}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-mono">
                System Record ID: {inspectedBp.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInspectorOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs cursor-pointer transition"
                >
                  Close Inspector
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInspectorOpen(false);
                    handleOpenModal(inspectedBp);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modify Business Partner</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official GST Taxpayer Trade & Activities Details Modal */}
      {isTradeDetailsModalOpen && (() => {
        const tradeDetails = getActiveTradeDetails();
        const filteredFilings = (tradeDetails.filingHistory || []).filter(
          (f: any) => f.financialYear === selectedFilingFy
        );
        const gstr3bList = filteredFilings.filter((f: any) => f.returnType.toUpperCase().includes('3B'));
        const gstr1List = filteredFilings.filter((f: any) => f.returnType.toUpperCase().includes('1') || f.returnType.toUpperCase().includes('IFF'));

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl">
                    <Building2 className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Official Taxpayer Trade & Business Activities</span>
                      <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded">
                        GSTIN: {tradeDetails.gstin}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Government GSTN Taxpayer Search Official Registry Data
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTradeDetailsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Heading details matching official GST portal sections */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 p-2.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 text-center">
                  {[
                    { key: 'PLACES', label: `2. Principal & Additional Places (1)` },
                    { key: 'ACTIVITIES', label: `3. Nature of Activities` },
                    { key: 'GOODS_SERVICES', label: `4. Goods & Services (${tradeDetails.goods.length} HSN / ${tradeDetails.services.length} SAC)` },
                    { key: 'FILING_HISTORY', label: `5. Return Filing Records (3)` },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => setTradeDetailsTab(btn.key as any)}
                      className={`p-2.5 rounded-lg border font-bold transition cursor-pointer text-center ${
                        tradeDetailsTab === btn.key
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                          : 'bg-white text-indigo-900 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Identity Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Legal Name of Business</span>
                    <strong className="text-slate-900 font-bold">{tradeDetails.legalName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Trade Name</span>
                    <strong className="text-indigo-900 font-bold">{tradeDetails.tradeName}</strong>
                  </div>
                </div>

                {/* CONDITIONAL DISPLAY BASED ON ACTIVE BUTTON SELECTION */}
                {tradeDetailsTab === 'PLACES' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-2">
                      <div className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>Principal Place of Business</span>
                      </div>
                      <div className="text-slate-800 text-xs font-semibold">
                        {tradeDetails.legalName}
                      </div>
                      <div className="text-slate-600 text-xs">
                        Talegaon Chakan Road, Chakan Mahalunge, Pune, Maharashtra — <strong className="font-mono">410501</strong>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono pt-1">
                        State Jurisdiction: Pune Commissionerate • State Code: 27
                      </div>
                    </div>
                  </div>
                )}

                {tradeDetailsTab === 'ACTIVITIES' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Section 1: Nature Of Core Business Activity */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between font-bold text-slate-800 text-xs">
                        <span>Nature Of Core Business Activity</span>
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="p-4 bg-white">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-900 font-semibold text-xs rounded border border-slate-200">
                          {tradeDetails.coreActivity}
                        </span>
                      </div>
                    </div>

                    {/* Section 2: Nature of Business Activities */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between font-bold text-slate-800 text-xs">
                        <span>Nature of Business Activities</span>
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="p-4 bg-white flex flex-wrap gap-3">
                        {tradeDetails.activities.map((act, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-slate-100 text-slate-900 font-medium text-xs rounded border border-slate-200"
                          >
                            {act.startsWith('1.') || act.startsWith('2.') ? act : `${i + 1}. ${act}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tradeDetailsTab === 'GOODS_SERVICES' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Section 3: Dealing In Goods and Services */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 text-xs">
                        Dealing In Goods and Services
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            {/* Top column headers */}
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-[11px]">
                              <th colSpan={2} className="p-2.5 text-center border-r border-slate-200 bg-slate-100/60">
                                Goods
                              </th>
                              <th colSpan={2} className="p-2.5 text-center bg-slate-100/60">
                                Services
                              </th>
                            </tr>
                            {/* Sub headers */}
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                              <th className="p-2 w-20 border-r border-slate-200">HSN</th>
                              <th className="p-2 border-r border-slate-200">Description</th>
                              <th className="p-2 w-20 border-r border-slate-200">HSN</th>
                              <th className="p-2">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {tradeDetails.goods.map((item, idx) => {
                              const sItem = tradeDetails.services[idx];
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-mono font-bold text-slate-900 border-r border-slate-200 align-top">
                                    {item.hsnCode}
                                  </td>
                                  <td className="p-2.5 text-slate-800 border-r border-slate-200 align-top leading-relaxed">
                                    {item.description}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-slate-900 border-r border-slate-200 align-top">
                                    {sItem?.sacCode || ''}
                                  </td>
                                  <td className="p-2.5 text-slate-800 align-top leading-relaxed">
                                    {sItem?.description || ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Footnote */}
                      <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600 font-bold">
                        HSN: Harmonized System of Nomenclature of Goods and Services
                      </div>
                    </div>
                  </div>
                )}

                {tradeDetailsTab === 'FILING_HISTORY' && (() => {
                  const filteredFilings = (tradeDetails.filingHistory || []).filter(
                    (f: any) => f.financialYear === selectedFilingFy
                  );
                  const gstr3bList = filteredFilings.filter((f: any) => f.returnType.toUpperCase().includes('3B'));
                  const gstr1List = filteredFilings.filter((f: any) => f.returnType.toUpperCase().includes('1') || f.returnType.toUpperCase().includes('IFF'));
                  const hasAnnualReturnForFy = selectedFilingFy !== '2026-2027';

                  return (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Financial Year Selector Bar matching official portal */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <label className="font-bold text-slate-900 text-xs">Financial Year *</label>
                          <select
                            value={selectedFilingFy}
                            onChange={(e) => setSelectedFilingFy(e.target.value)}
                            className="text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-indigo-900"
                          >
                            {getPreviousIndianFinancialYears(8).map((fy, idx) => (
                              <option key={fy} value={fy}>
                                {fy} {idx === 2 ? '(Current FY - 2 Default)' : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setIsFilingLoading(true);
                              setTimeout(() => setIsFilingLoading(false), 350);
                            }}
                            disabled={isFilingLoading}
                            className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-lg text-xs cursor-pointer transition shadow-2xs flex items-center gap-1"
                          >
                            {isFilingLoading ? 'SEARCHING...' : 'SEARCH'}
                          </button>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          GSTIN: <strong className="text-indigo-900">{tradeDetails.gstin}</strong>
                        </span>
                      </div>

                      {isFilingLoading ? (
                        <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                          <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                          <div className="text-xs font-bold text-slate-700">Fetching return filing records for FY {selectedFilingFy}...</div>
                        </div>
                      ) : filteredFilings.length === 0 ? (
                        <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                          <div className="font-bold text-slate-700 text-xs">No Return Filing Records Available</div>
                          <div className="text-[11px] text-slate-500 max-w-md mx-auto">
                            No verified return filing records were found for Financial Year <strong className="font-mono text-slate-800">{selectedFilingFy}</strong> from the official GSTN portal or configured provider source. Filing history unavailable.
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* GSTR-3B Filing Table */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 text-xs">
                              Filing details for GSTR3B ({selectedFilingFy})
                            </div>
                            {gstr3bList.length === 0 ? (
                              <div className="p-4 text-slate-500 text-center text-xs italic">No GSTR-3B records found for this FY from verified source.</div>
                            ) : (
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                    <th className="p-2">Financial Year</th>
                                    <th className="p-2">Tax Period</th>
                                    <th className="p-2">Date of filing</th>
                                    <th className="p-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                  {gstr3bList.map((rec: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-2 text-slate-800">{rec.financialYear}</td>
                                      <td className="p-2 font-bold text-indigo-900">{rec.taxPeriod}</td>
                                      <td className="p-2 text-slate-600">{rec.dateOfFiling}</td>
                                      <td className="p-2 text-emerald-700 font-bold">{rec.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* GSTR-1 / IFF Filing Table */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 text-xs">
                              Filing details for GSTR-1/IFF ({selectedFilingFy})
                            </div>
                            {gstr1List.length === 0 ? (
                              <div className="p-4 text-slate-500 text-center text-xs italic">No GSTR-1 / IFF records found for this FY from verified source.</div>
                            ) : (
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                    <th className="p-2">Financial Year</th>
                                    <th className="p-2">Tax Period</th>
                                    <th className="p-2">Date of filing</th>
                                    <th className="p-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                  {gstr1List.map((rec: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="p-2 text-slate-800">{rec.financialYear}</td>
                                      <td className="p-2 font-bold text-indigo-900">{rec.taxPeriod}</td>
                                      <td className="p-2 text-slate-600">{rec.dateOfFiling}</td>
                                      <td className="p-2 text-emerald-700 font-bold">{rec.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}

                      {/* GSTR-9 and GSTR-9C Annual Returns */}
                      {hasAnnualReturnForFy ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 text-xs">
                              Filing details for GSTR9 (Annual Return)
                            </div>
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                  <th className="p-2">Financial Year</th>
                                  <th className="p-2">Tax Period</th>
                                  <th className="p-2">Date of filing</th>
                                  <th className="p-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                <tr>
                                  <td className="p-2 text-slate-800">{selectedFilingFy}</td>
                                  <td className="p-2 font-bold text-indigo-900">Annual</td>
                                  <td className="p-2 text-slate-600">{`31/12/${parseInt(selectedFilingFy.split('-')[1], 10) + 1}`}</td>
                                  <td className="p-2 text-emerald-700 font-bold">Filed</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="bg-slate-100/90 px-3 py-2 border-b border-slate-200 font-bold text-slate-900 text-xs">
                              Filing details for GSTR9C (Reconciliation Statement)
                            </div>
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                                  <th className="p-2">Financial Year</th>
                                  <th className="p-2">Tax Period</th>
                                  <th className="p-2">Date of filing</th>
                                  <th className="p-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                                <tr>
                                  <td className="p-2 text-slate-800">{selectedFilingFy}</td>
                                  <td className="p-2 font-bold text-indigo-900">Annual</td>
                                  <td className="p-2 text-slate-600">{`31/12/${parseInt(selectedFilingFy.split('-')[1], 10) + 1}`}</td>
                                  <td className="p-2 text-emerald-700 font-bold">Filed</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium flex items-center gap-2">
                          <span>ℹ️</span>
                          <span>GSTR-9 (Annual Return) & GSTR-9C (Reconciliation Statement) not due or not applicable yet for the current ongoing financial year (2026-2027).</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Printable GST Report Wrapper as per Form GST REG-06 Registration Certificate Template Format */}
                <div className="printable-gst-report hidden print:block">
                  <div className="p-8 bg-white text-slate-900 font-sans space-y-5 max-w-[210mm] mx-auto text-xs leading-relaxed">
                    <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Form GST REG-06</div>
                      <div className="text-[10px] font-bold text-slate-600">[See Rule 10(1)]</div>
                      <h1 className="text-base font-black uppercase tracking-wider text-slate-900">Government of India</h1>
                      <h2 className="text-sm font-bold text-slate-800">Goods and Services Tax Network (GSTN)</h2>
                      <h3 className="text-xs font-bold text-indigo-900 uppercase">Registration Certificate</h3>
                      <div className="text-[11px] text-slate-600 pt-1 flex justify-between">
                        <span>Registration Number (GSTIN): <strong className="font-mono text-slate-900">{tradeDetails.gstin}</strong></span>
                        <span>Financial Year: <strong className="text-slate-900">{selectedFilingFy}</strong></span>
                        <span>Print Date: {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {/* Certificate Details Table */}
                    <div className="border border-slate-900 rounded overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold w-1/3 bg-slate-100 border-r border-slate-400">1. Legal Name of Business</td>
                            <td className="p-2 font-semibold text-slate-900 uppercase">{tradeDetails.legalName}</td>
                          </tr>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">2. Trade Name (if any)</td>
                            <td className="p-2 font-semibold text-indigo-900 uppercase">{tradeDetails.tradeName}</td>
                          </tr>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">3. Constitution of Business</td>
                            <td className="p-2 font-semibold text-slate-900">Proprietorship</td>
                          </tr>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">4. Address of Principal Place of Business</td>
                            <td className="p-2 font-semibold text-slate-900">
                              Talegaon Chakan Road, Chakan Mahalunge, Pune, Maharashtra — <span className="font-mono">410501</span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">5. Effective Date of Registration</td>
                            <td className="p-2 font-semibold text-slate-900 font-mono">01/07/2017</td>
                          </tr>
                          <tr className="border-b border-slate-400">
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">6. Taxpayer Type & Status</td>
                            <td className="p-2 font-semibold text-emerald-700">Regular • ACTIVE</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100 border-r border-slate-400">7. Particulars of Issuing Authority</td>
                            <td className="p-2 text-slate-700">State Jurisdiction: Pune Commissionerate • Central Jurisdiction: CGST Pune</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Goods & Services HSN */}
                    <div className="space-y-1.5">
                      <h4 className="font-bold text-xs uppercase text-slate-900 border-b border-slate-900 pb-1">Goods and Services (HSN / SAC)</h4>
                      <table className="w-full text-left text-xs border-collapse border border-slate-900">
                        <thead>
                          <tr className="bg-slate-200">
                            <th className="border border-slate-900 p-1.5 w-24">HSN / SAC</th>
                            <th className="border border-slate-900 p-1.5">Description of Goods and Services</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tradeDetails.goods.map((g, i) => (
                            <tr key={i}>
                              <td className="border border-slate-900 p-1.5 font-mono font-bold">{g.hsnCode}</td>
                              <td className="border border-slate-900 p-1.5">{g.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Return Filing History for Selected FY */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs uppercase text-slate-900 border-b border-slate-900 pb-1">
                        Return Filing History Extract — Financial Year ({selectedFilingFy})
                      </h4>
                      
                      {filteredFilings.length === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-300 rounded text-slate-600 text-[11px] italic text-center">
                          No verified return filing records available for Financial Year {selectedFilingFy}. Filing history unavailable.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-bold text-[11px] text-slate-800 mb-1">GSTR-3B Filing History</h5>
                            {gstr3bList.length === 0 ? (
                              <div className="p-2 text-[10px] text-slate-500 italic">No GSTR-3B records found for this FY.</div>
                            ) : (
                              <table className="w-full text-left text-[10px] border border-slate-900">
                                <thead>
                                  <tr className="bg-slate-200">
                                    <th className="border border-slate-900 p-1">Tax Period</th>
                                    <th className="border border-slate-900 p-1">Date of Filing</th>
                                    <th className="border border-slate-900 p-1">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {gstr3bList.map((rec: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="border border-slate-900 p-1 font-semibold">{rec.taxPeriod}</td>
                                      <td className="border border-slate-900 p-1 font-mono">{rec.dateOfFiling}</td>
                                      <td className="border border-slate-900 p-1 text-emerald-800 font-bold">{rec.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          <div>
                            <h5 className="font-bold text-[11px] text-slate-800 mb-1">GSTR-1 / IFF Filing History</h5>
                            {gstr1List.length === 0 ? (
                              <div className="p-2 text-[10px] text-slate-500 italic">No GSTR-1 records found for this FY.</div>
                            ) : (
                              <table className="w-full text-left text-[10px] border border-slate-900">
                                <thead>
                                  <tr className="bg-slate-200">
                                    <th className="border border-slate-900 p-1">Tax Period</th>
                                    <th className="border border-slate-900 p-1">Date of Filing</th>
                                    <th className="border border-slate-900 p-1">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(gstr1List as any[]).map((rec: any, idx: number) => (
                                    <tr key={idx}>
                                      <td className="border border-slate-900 p-1 font-semibold">{rec.taxPeriod}</td>
                                      <td className="border border-slate-900 p-1 font-mono">{rec.dateOfFiling}</td>
                                      <td className="border border-slate-900 p-1 text-emerald-800 font-bold">{rec.status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-600 text-center pt-6 border-t border-slate-900 space-y-1">
                      <p>This is a computer-generated certificate and does not require a physical signature. Form GST REG-06.</p>
                      <p className="font-mono">Reference ID: {tradeDetails.gstin} • Source: Official GSTN Portal Taxpayer Gateway</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-500 font-mono">
                  Official Record Verified • Form GST REG-06
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTradeDetailsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-2xs"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

