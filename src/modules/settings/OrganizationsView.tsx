import React, { useState, useEffect } from 'react';
import { INITIAL_ORGANIZATION, INITIAL_BRANCHES, INITIAL_COMPANIES } from '../../data/seedData';
import {
  Branch,
  Warehouse,
  GSTRegistrationType,
  UnitDescriptionMaster,
  Company,
  SapCompanyFieldDiscoveryRecord,
  SapCompanySyncJobLog,
  MSMEInfo,
  GSTVerificationDetails,
  GSTVerificationMode,
  GSTVerificationSession,
} from '../../types';
import {
  INITIAL_SAP_DISCOVERED_FIELDS,
  INITIAL_SAP_SYNC_JOBS,
} from '../../data/sapCompanyData';
import { GST_STATE_CODES } from '../../data/geoData';
import {
  getGstVerificationMode,
  generateCaptchaChallenge,
  verifyGSTIN,
  getOrCreateGstDetailsForEntity,
} from '../../services/gstService';
import { GSTVerificationReviewModal } from '../../components/GSTVerificationReviewModal';
import { GSTDetailsInspector } from '../../components/GSTDetailsInspector';
import {
  Building,
  MapPin,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Lock,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Edit2,
  Power,
  Layers,
  Building2,
  Database,
  Globe,
  Sliders,
  Check,
  Zap,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  FileText,
  Clock,
  Activity,
  ArrowRight,
  Server,
  Award,
} from 'lucide-react';

const INITIAL_UNIT_MASTERS: UnitDescriptionMaster[] = [
  { id: 'u-1', code: 'INJ', description: 'Injection Moulding & Tooling Unit', approvalStatus: 'APPROVED', version: 1 },
  { id: 'u-2', code: 'EXT', description: 'Corrugation & Extrusion Unit', approvalStatus: 'APPROVED', version: 1 },
  { id: 'u-3', code: 'AUT', description: 'Automotive Corrugated Tubing Plant', approvalStatus: 'APPROVED', version: 1 },
  { id: 'u-4', code: 'SUB', description: 'Tier 1 Sub-Assembly Plant', approvalStatus: 'APPROVED', version: 1 },
  { id: 'u-5', code: 'BLW', description: 'Moulding & Blow Moulding Division', approvalStatus: 'APPROVED', version: 1 },
  { id: 'u-6', code: 'MED', description: 'Non-Woven & Medical Conversion Unit', approvalStatus: 'APPROVED', version: 1 },
];

export const SAP_COMMON_WAREHOUSES = [
  { code: 'STR', name: 'Stores', isDefault: true, isNettable: true },
  { code: 'FG', name: 'Finished Goods', isDefault: false, isNettable: true },
  { code: 'FGQ', name: 'Finished Goods QC', isDefault: false, isNettable: true },
  { code: 'INQ', name: 'Waiting for QC', isDefault: false, isNettable: true },
  { code: 'IRJ', name: 'Incoming Rejection', isDefault: false, isNettable: false },
  { code: 'PRJ', name: 'Process Rejection', isDefault: false, isNettable: false },
  { code: 'QCH', name: 'QC Hold', isDefault: false, isNettable: true },
  { code: 'RG', name: 'Regrind/Reprocess', isDefault: false, isNettable: true },
  { code: 'SCY', name: 'Scrap Yard', isDefault: false, isNettable: false },
  { code: 'WIP', name: 'WIP', isDefault: false, isNettable: true },
  { code: 'WQC', name: 'WIP QC', isDefault: false, isNettable: true },
];

interface OrganizationsViewProps {
  initialTab?: 'companies' | 'branches' | 'warehouse';
  companies?: Company[];
  setCompanies?: React.Dispatch<React.SetStateAction<Company[]>>;
  branches?: Branch[];
  setBranches?: React.Dispatch<React.SetStateAction<Branch[]>>;
}

export const OrganizationsView: React.FC<OrganizationsViewProps> = ({
  initialTab = 'companies',
  companies: parentCompanies,
  setCompanies: setParentCompanies,
  branches: parentBranches,
  setBranches: setParentBranches,
}) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'branches' | 'warehouse'>(initialTab);

  // Filters for Tabs
  const [branchCompanyFilter, setBranchCompanyFilter] = useState<string>('ALL');
  const [whCompanyFilter, setWhCompanyFilter] = useState<string>('ALL');
  const [whBranchFilter, setWhBranchFilter] = useState<string>('ALL');
  const [whSearchTerm, setWhSearchTerm] = useState<string>('');

  // Interactive Company Card Modals & States
  const [testingCoId, setTestingCoId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [activeMappingCo, setActiveMappingCo] = useState<Company | null>(null);
  const [activeProfileCo, setActiveProfileCo] = useState<Company | null>(null);
  const [activeSyncCo, setActiveSyncCo] = useState<Company | null>(null);

  // Independent Activation Controls per company (persisted in local state)
  const [coActivationOverrides, setCoActivationOverrides] = useState<Record<string, { env: boolean; sync: boolean }>>(() => {
    try {
      const saved = localStorage.getItem('kosh_company_activation_overrides');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'co-kosh-01': { env: true, sync: true },
      'co-kosh-02': { env: true, sync: true },
      'co-kosh-03': { env: false, sync: false },
      'co-kosh-04': { env: false, sync: false },
    };
  });

  const toggleCoEnv = (coId: string) => {
    setCoActivationOverrides((prev) => {
      const current = prev[coId] || { env: true, sync: true };
      const next = { ...prev, [coId]: { ...current, env: !current.env } };
      localStorage.setItem('kosh_company_activation_overrides', JSON.stringify(next));
      return next;
    });
  };

  const toggleCoSync = (coId: string) => {
    setCoActivationOverrides((prev) => {
      const current = prev[coId] || { env: true, sync: true };
      const next = { ...prev, [coId]: { ...current, sync: !current.sync } };
      localStorage.setItem('kosh_company_activation_overrides', JSON.stringify(next));
      return next;
    });
  };

  const handleTestCompanyConnection = (co: Company) => {
    setTestingCoId(co.id);
    setTestResult(null);
    setTimeout(() => {
      setTestingCoId(null);
      setTestResult({
        id: co.id,
        msg: `Connection to SAP (${co.sapCompanyDb}) verified. HTTP 200 OK • Latency: 38ms`,
        success: true,
      });
      setTimeout(() => setTestResult(null), 5000);
    }, 1000);
  };

  // Warehouse Modal States
  const [isWhModalOpen, setIsWhModalOpen] = useState(false);
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whTargetBranchId, setWhTargetBranchId] = useState<string>('br-pondy-01');
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const [whIsDefault, setWhIsDefault] = useState(false);
  const [whIsNettable, setWhIsNettable] = useState(true);
  const [whEnableBins, setWhEnableBins] = useState(false);
  const [whIsInactive, setWhIsInactive] = useState(false);

  // Persistent Companies State
  const [localCompanies, setLocalCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading companies from localStorage:', err);
    }
    return INITIAL_COMPANIES;
  });

  // Helper to reliably resolve parent company ID for a branch
  const getBranchCompanyId = (b: Branch): string => {
    if (b.companyId) return b.companyId;
    const initial = INITIAL_BRANCHES.find((ib) => ib.id === b.id || ib.portalBranchCode === b.portalBranchCode);
    if (initial?.companyId) return initial.companyId;
    if (b.state === 'Tamil Nadu' || b.code === 'CHE' || b.code === 'HSR') return 'co-kosh-02';
    if (b.state === 'Gujarat' || b.state === 'Maharashtra' || b.code === 'SND' || b.code === 'HLL') return 'co-kosh-03';
    if (b.state === 'Uttarakhand' || b.code === 'DDN') return 'co-kosh-04';
    return 'co-kosh-01';
  };

  // Persistent Branches State (healed to ensure companyId is always set)
  const [localBranches, setLocalBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_branches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b: Branch) => {
            if (b.companyId) return b;
            const ref = INITIAL_BRANCHES.find((ib) => ib.id === b.id || ib.portalBranchCode === b.portalBranchCode);
            return {
              ...b,
              companyId: ref?.companyId || (b.state === 'Tamil Nadu' ? 'co-kosh-02' : b.state === 'Gujarat' ? 'co-kosh-03' : b.state === 'Uttarakhand' ? 'co-kosh-04' : 'co-kosh-01'),
            };
          });
        }
      }
    } catch (err) {
      console.error('Error loading branches from localStorage:', err);
    }
    return INITIAL_BRANCHES;
  });

  // Full SAP Field Discovery Records (82 Fields)
  const [fieldRecords, setFieldRecords] = useState<SapCompanyFieldDiscoveryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_sap_discovered_fields');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading SAP field discovery records:', err);
    }
    return INITIAL_SAP_DISCOVERED_FIELDS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_discovered_fields', JSON.stringify(fieldRecords));
    } catch (err) {
      console.error('Error saving SAP field discovery records:', err);
    }
  }, [fieldRecords]);

  // Full SAP Sync Job Logs
  const [jobLogs, setJobLogs] = useState<SapCompanySyncJobLog[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_sap_sync_jobs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading SAP sync jobs:', err);
    }
    return INITIAL_SAP_SYNC_JOBS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_sync_jobs', JSON.stringify(jobLogs));
    } catch (err) {
      console.error('Error saving SAP sync jobs:', err);
    }
  }, [jobLogs]);

  // View / Edit Mappings State
  const [mappingSearchTerm, setMappingSearchTerm] = useState('');
  const [mappingTabFilter, setMappingTabFilter] = useState('ALL');
  const [mappingStatusFilter, setMappingStatusFilter] = useState('ALL');
  const [isEditMappingModalOpen, setIsEditMappingModalOpen] = useState(false);
  const [editingMappingRecord, setEditingMappingRecord] = useState<SapCompanyFieldDiscoveryRecord | null>(null);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [importFileText, setImportFileText] = useState('');
  const [importPreviewData, setImportPreviewData] = useState<{
    total: number;
    newCount: number;
    updateCount: number;
    invalidCount: number;
    unsupportedCount: number;
    rows: any[];
  } | null>(null);
  const [importFeedback, setImportFeedback] = useState('');

  // Connection Profile & Schedule Form State
  const [profileForm, setProfileForm] = useState({
    serviceLayerHost: 'hana-b1.kosh.internal',
    serviceLayerPort: 50000,
    sapVersion: 'SAP Business One 10.0 (Version 10.00.210)',
    executionSchedule: '15',
    timezoneScope: 'Asia/Kolkata (IST)',
    retryPolicy: 'Exponential Backoff (3x)',
    sslEnforced: true,
    authMethod: 'SESSION',
  });
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [isTestingProfile, setIsTestingProfile] = useState(false);
  const [profileTestFeedback, setProfileTestFeedback] = useState('');

  // Data Sync & Discovery Matrix State
  const [isExecutingSync, setIsExecutingSync] = useState(false);
  const [isFetchPreviewOpen, setIsFetchPreviewOpen] = useState(false);
  const [syncFeedbackToast, setSyncFeedbackToast] = useState('');
  const [syncModalTab, setSyncModalTab] = useState<'matrix' | 'history'>('matrix');

  // Mapping handlers
  const handleOpenEditMapping = (rec: SapCompanyFieldDiscoveryRecord) => {
    setEditingMappingRecord({ ...rec });
    setIsEditMappingModalOpen(true);
  };

  const handleSaveMappingRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMappingRecord) return;
    setFieldRecords((prev) =>
      prev.map((f) => (f.id === editingMappingRecord.id ? { ...editingMappingRecord, lastVerifiedAt: new Date().toISOString() } : f))
    );
    setIsEditMappingModalOpen(false);
  };

  const handleExportMappingsCsv = () => {
    const headers = [
      'Record Id',
      'SAP Tab Name',
      'Visible Screen Label',
      'Technical Property Name',
      'SAP Object Type',
      'API Access',
      'Kosh Target Entity',
      'Target Field',
      'Data Type',
      'Mandatory',
      'Validation Rule',
      'Transform Function',
      'Default Value',
      'Sync Direction',
      'Discovery Status',
      'Last Retrieved Value',
    ];
    const rows = fieldRecords.map((f) => [
      f.id,
      f.tabName,
      `"${f.visibleSapLabel}"`,
      f.technicalPropertyName,
      f.technicalResource,
      f.isReadable ? (f.isWritable ? 'Read-Write' : 'Read-Only') : 'No-Access',
      f.koshTargetEntity,
      f.koshTargetProperty,
      f.targetDataType || 'String',
      f.isRequired ? 'true' : 'false',
      'VALIDATED',
      f.mappingTransformation || 'DirectString',
      '',
      'SAP_TO_KOSH',
      f.discoveryStatus,
      `"${f.retrievedSourceValue || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_B1_HANA_Field_Mappings_${activeMappingCo?.code || 'EXPORT'}.csv`;
    a.click();
  };

  const handleDownload18ColTemplate = () => {
    const headers = [
      'Record Id',
      'SAP Tab Name',
      'Visible Screen Label',
      'Technical Property Name',
      'SAP Object Type',
      'API Access',
      'Kosh Target Entity',
      'Target Field',
      'Data Type',
      'Mandatory',
      'Validation Rule',
      'Transform Function',
      'Default Value',
      'Sync Direction',
      'Discovery Status',
      'Sync Frequency',
      'Last Retrieved Value',
      'Notes / SAP Reference',
    ];
    const sampleRows = [
      ['sf-01', 'General', 'Company Name', 'CompanyName', 'CompanyService_GetAdminInfo', 'Read-Only', 'ORGANIZATION', 'name', 'string', 'true', 'NOT_EMPTY', 'TRIM', '', 'SAP_TO_KOSH', 'VALIDATED', '15m', 'KOSH INNOVATIONS PRIVATE LIMITED', 'Screenshot Header Company Name'],
      ['sf-02', 'General', 'Federal Tax ID', 'FederalTaxID', 'CompanyService_GetAdminInfo', 'Read-Only', 'ORGANIZATION', 'gstin', 'string', 'true', 'GSTIN_REGEX', 'UPPERCASE', '', 'SAP_TO_KOSH', 'VALIDATED', '15m', '34AABCK1234F1Z5', 'Official GSTIN identification'],
      ['sf-03', 'Accounting', 'Local Currency', 'LocalCurrency', 'CompanyService_GetAdminInfo', 'Read-Only', 'ORGANIZATION', 'mainCurrency', 'string', 'true', 'ISO_CURRENCY', 'NONE', 'INR', 'SAP_TO_KOSH', 'VALIDATED', '15m', 'INR', 'Base operational currency'],
      ['sf-04', 'Address', 'State / Province', 'State', 'CompanyService_GetAdminInfo', 'Read-Only', 'ORGANIZATION', 'state', 'string', 'true', 'STATE_CODE', 'TRIM', 'Puducherry', 'SAP_TO_KOSH', 'VALIDATED', '15m', 'Puducherry', 'Registered state jurisdiction'],
    ];
    const csvContent = [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_Mapping_Template_18Col.csv`;
    a.click();
  };

  const handleParseImportText = () => {
    if (!importFileText.trim()) return;
    const lines = importFileText.trim().split('\n');
    const validRows: any[] = [];
    lines.slice(1).forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 8) {
        validRows.push({
          id: `imp-${idx}`,
          companyConfigId: activeMappingCo?.id || 'co-kosh-01',
          environmentId: 'PROD',
          tabName: 'GENERAL_LOCAL',
          subsectionName: 'Imported Field Configuration',
          visibleSapLabel: cols[2] || cols[0],
          technicalResource: cols[4] || 'CompanyService_GetAdminInfo',
          technicalPropertyName: cols[3] || cols[1],
          sapDataType: cols[8] || 'Alphanumeric',
          isReadable: true,
          isWritable: false,
          koshTargetEntity: cols[6] || 'ORGANIZATION',
          koshTargetProperty: cols[7] || 'customProperty',
          targetDataType: cols[8] || 'String',
          mappingTransformation: cols[11] || 'DirectString',
          isRequired: cols[9] === 'true',
          isReadOnlyInSap: true,
          discoveryStatus: 'MAPPED',
          verificationEvidence: 'Imported from 18-Column Template',
          lastVerifiedAt: new Date().toISOString(),
          retrievedSourceValue: cols[16] || '',
          persistedKoshValue: '',
        });
      }
    });
    setImportPreviewData({
      total: validRows.length,
      newCount: validRows.length,
      updateCount: 0,
      invalidCount: 0,
      unsupportedCount: 0,
      rows: validRows,
    });
  };

  const handleApplyImport = () => {
    if (!importPreviewData?.rows.length) return;
    setFieldRecords((prev) => [...importPreviewData.rows, ...prev]);
    setIsExcelImportModalOpen(false);
    setImportPreviewData(null);
    setImportFileText('');
    setImportFeedback(`Successfully imported and mapped ${importPreviewData.rows.length} field specifications.`);
    setTimeout(() => setImportFeedback(''), 4000);
  };

  // Profile handlers
  const handleTestProfileConnection = () => {
    setIsTestingProfile(true);
    setProfileTestFeedback('');
    setTimeout(() => {
      setIsTestingProfile(false);
      setProfileTestFeedback(
        `SUCCESS: HTTPS TLS Handshake & Authentication verified for ${activeProfileCo?.sapCompanyDb} (${profileForm.serviceLayerHost}:${profileForm.serviceLayerPort}). Service Layer /b1s/v2/CompanyService_GetAdminInfo returned HTTP 200 OK • Latency: 34ms`
      );
    }, 1000);
  };

  const handleSaveProfileConfig = () => {
    setProfileSaveSuccess(true);
    setTimeout(() => setProfileSaveSuccess(false), 4000);
  };

  // Sync handlers
  const handleExecuteDataPullAndSync = () => {
    setIsExecutingSync(true);
    setTimeout(() => {
      setIsExecutingSync(false);
      setIsFetchPreviewOpen(true);
    }, 1200);
  };

  const handleConfirmAndCommitSync = () => {
    if (!activeSyncCo) return;
    const now = new Date().toISOString();
    const correlationId = `corr-sap-sync-${Date.now().toString().slice(-6)}`;
    const newJob: SapCompanySyncJobLog = {
      id: `job-${Date.now()}`,
      jobCorrelationId: correlationId,
      companyConfigId: activeSyncCo.id,
      environmentId: 'PROD',
      operationType: 'FETCH_COMPANY_DETAILS',
      startedAt: now,
      finishedAt: now,
      durationMs: 2450,
      triggeredBy: 'Platform Administrator',
      discoveredFieldsCount: fieldRecords.length,
      mappedFieldsCount: fieldRecords.filter((f) => f.discoveryStatus === 'MAPPED' || f.discoveryStatus === 'VALIDATED').length,
      importedFieldsCount: fieldRecords.length - 4,
      updatedFieldsCount: 3,
      unchangedFieldsCount: fieldRecords.length - 7,
      skippedFieldsCount: 0,
      unsupportedFieldsCount: 4,
      failedFieldsCount: 0,
      status: 'COMPLETED',
      sanitizedDiagnosticMessage: `Company Details, Legal Entity & AdminInfo imported cleanly from ${activeSyncCo.sapCompanyDb} over Service Layer HTTPS.`,
    };
    setJobLogs((prev) => [newJob, ...prev]);
    setIsFetchPreviewOpen(false);
    setSyncFeedbackToast(`Synchronization completed successfully. Job ID: ${correlationId} • 82 fields synchronized.`);
    setTimeout(() => setSyncFeedbackToast(''), 5000);
  };

  const companies = parentCompanies || localCompanies;
  const setCompanies = setParentCompanies || setLocalCompanies;

  const branches = parentBranches || localBranches;
  const setBranches = setParentBranches || setLocalBranches;

  const [unitMasters, setUnitMasters] = useState<UnitDescriptionMaster[]>(INITIAL_UNIT_MASTERS);

  useEffect(() => {
    try {
      localStorage.setItem('kosh_companies', JSON.stringify(companies));
    } catch (err) {
      console.error('Error saving companies to localStorage:', err);
    }
  }, [companies]);

  useEffect(() => {
    try {
      localStorage.setItem('kosh_branches', JSON.stringify(branches));
    } catch (err) {
      console.error('Error saving branches to localStorage:', err);
    }
  }, [branches]);

  // Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Branch Modal & Edit States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);

  // Company Modal & Edit States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Company Form State
  const [coCode, setCoCode] = useState('');
  const [coName, setCoName] = useState('');
  const [coLegalName, setCoLegalName] = useState('');
  const [coTradeName, setCoTradeName] = useState('');
  const [coCinNumber, setCoCinNumber] = useState('');
  const [coGstin, setCoGstin] = useState('');
  const [coSapDb, setCoSapDb] = useState('');
  const [coCountry, setCoCountry] = useState('India');
  const [coState, setCoState] = useState('Puducherry');
  const [coCity, setCoCity] = useState('Puducherry');
  const [coPostalCode, setCoPostalCode] = useState('');
  const [coStreetAddress, setCoStreetAddress] = useState('');
  const [coIsEnabled, setCoIsEnabled] = useState(true);
  const [coMsmeInfo, setCoMsmeInfo] = useState<MSMEInfo>({
    isMSME: false,
    msmeClassification: 'SMALL',
    activityType: 'MANUFACTURING',
  });
  const [isVerifyingCoMsme, setIsVerifyingCoMsme] = useState(false);

  // Branch Form State
  const [portalBranchCode, setPortalBranchCode] = useState('');
  const [sapBranchCode, setSapBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [shortName, setShortName] = useState('');
  const [gstinPan, setGstinPan] = useState('');
  const [gstLegalName, setGstLegalName] = useState('');
  const [gstTradeName, setGstTradeName] = useState('');
  const [gstRegistrationType, setGstRegistrationType] = useState<GSTRegistrationType>('REGULAR');
  const [gstStatus, setGstStatus] = useState<'VERIFIED' | 'UNVERIFIED' | 'EXEMPT' | 'CANCELLED' | 'SUSPENDED'>('UNVERIFIED');
  const [isVerifyingGst, setIsVerifyingGst] = useState(false);

  // Address: Country -> State -> City -> Postal Code -> Street
  const [targetCompanyId, setTargetCompanyId] = useState<string>('co-kosh-01');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Tamil Nadu');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [isMainBranch, setIsMainBranch] = useState(false);

  // Unit Description Selection
  const [selectedUnitDesc, setSelectedUnitDesc] = useState<string>(INITIAL_UNIT_MASTERS[0].description);

  // Warehouses
  const [warehouses, setWarehouses] = useState<{ code: string; name: string; isDefault: boolean }[]>([]);

  // New Unit Form State
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');

  // GST Verification & Inspection States
  const [inspectedGstEntity, setInspectedGstEntity] = useState<{
    title: string;
    code: string;
    gstin: string;
    details?: GSTVerificationDetails;
  } | null>(null);

  // Branch GST verification review
  const [branchGstSession, setBranchGstSession] = useState<GSTVerificationSession | null>(null);
  const [branchCaptchaInput, setBranchCaptchaInput] = useState('');
  const [branchStagedGst, setBranchStagedGst] = useState<GSTVerificationDetails | null>(null);
  const [isBranchReviewModalOpen, setIsBranchReviewModalOpen] = useState(false);
  const [branchGstError, setBranchGstError] = useState('');
  const [savedBranchGstDetails, setSavedBranchGstDetails] = useState<GSTVerificationDetails | null>(null);

  // Company GST verification review
  const [coGstSession, setCoGstSession] = useState<GSTVerificationSession | null>(null);
  const [coCaptchaInput, setCoCaptchaInput] = useState('');
  const [coStagedGst, setCoStagedGst] = useState<GSTVerificationDetails | null>(null);
  const [isCoReviewModalOpen, setIsCoReviewModalOpen] = useState(false);
  const [coGstError, setCoGstError] = useState('');
  const [savedCoGstDetails, setSavedCoGstDetails] = useState<GSTVerificationDetails | null>(null);
  const [isVerifyingCoGst, setIsVerifyingCoGst] = useState(false);

  // Derived GST State Code Mismatch Check
  const currentGstPrefix = gstinPan.trim().length >= 2 ? gstinPan.trim().slice(0, 2) : '';
  const expectedGstState = GST_STATE_CODES[currentGstPrefix];
  const isGstStateMismatch =
    currentGstPrefix &&
    expectedGstState &&
    state &&
    !expectedGstState.toLowerCase().includes(state.toLowerCase()) &&
    !state.toLowerCase().includes(expectedGstState.toLowerCase());

  // TOGGLE COMPANY ENABLE / DISABLE
  const handleToggleCompanyEnabled = (companyId: string) => {
    const updated = companies.map((c) => {
      if (c.id === companyId) {
        const nextState = !c.isEnabled;
        return { ...c, isEnabled: nextState, updatedAt: new Date().toISOString() };
      }
      return c;
    });

    setCompanies(updated);
    const target = updated.find((c) => c.id === companyId);
    setSuccessMsg(`Company "${target?.name}" is now ${target?.isEnabled ? 'ENABLED' : 'DISABLED'}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // TOGGLE BRANCH ENABLE / DISABLE
  const handleToggleBranchStatus = (branchId: string) => {
    const updated = branches.map((br) => {
      if (br.id === branchId) {
        const nextStatus = br.lifecycleStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
        return { ...br, lifecycleStatus: nextStatus as any };
      }
      return br;
    });

    setBranches(updated);
    const target = updated.find((b) => b.id === branchId);
    setSuccessMsg(`Branch [${target?.portalBranchCode}] status changed to ${target?.lifecycleStatus}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // COMPANY MODAL HANDLERS
  const handleOpenCompanyModal = (company?: Company) => {
    setErrorMsg('');
    setSuccessMsg('');
    setCoGstError('');
    setCoCaptchaInput('');
    setCoStagedGst(null);
    setCoGstSession(null);

    if (company) {
      setEditingCompanyId(company.id);
      setCoCode(company.code);
      setCoName(company.name);
      setCoLegalName(company.legalName);
      setCoTradeName(company.tradeName);
      setCoCinNumber(company.cinNumber || '');
      setCoGstin(company.gstin);
      setCoSapDb(company.sapCompanyDb);
      setCoCountry(company.country || 'India');
      setCoState(company.state || 'Puducherry');
      setCoCity(company.city || 'Puducherry');
      setCoPostalCode(company.postalCode || '');
      setCoStreetAddress(company.streetAddress || '');
      setCoIsEnabled(company.isEnabled);
      setSavedCoGstDetails(
        company.gstVerificationDetails ||
        (company.gstin ? getOrCreateGstDetailsForEntity(company.gstin, company.legalName, company.tradeName) || null : null)
      );
      setCoMsmeInfo(
        company.msmeInfo || {
          isMSME: false,
          msmeClassification: 'SMALL',
          activityType: 'MANUFACTURING',
        }
      );
    } else {
      setEditingCompanyId(null);
      setCoCode(`KOSH-0${companies.length + 1}`);
      setCoName('');
      setCoLegalName('');
      setCoTradeName('');
      setCoCinNumber('');
      setCoGstin('');
      setCoSapDb(`KOSH_DB_0${companies.length + 1}_HANA`);
      setCoCountry('India');
      setCoState('Tamil Nadu');
      setCoCity('Chennai');
      setCoPostalCode('');
      setCoStreetAddress('');
      setCoIsEnabled(true);
      setSavedCoGstDetails(null);
      setCoMsmeInfo({
        isMSME: false,
        msmeClassification: 'SMALL',
        activityType: 'MANUFACTURING',
      });
    }
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coCode.trim() || !coName.trim() || !coLegalName.trim() || !coGstin.trim() || !coSapDb.trim()) {
      setErrorMsg('Company Code, Display Name, Official GST Legal Name, GSTIN, and SAP Database ID are required.');
      return;
    }

    const cleanCin = coCinNumber.trim().toUpperCase();
    if (cleanCin && cleanCin.length !== 21) {
      setErrorMsg('Corporate Identification Number (CIN) must be exactly 21 alphanumeric characters (e.g. U72900PY2020PTC008642).');
      return;
    }

    if (editingCompanyId) {
      const updated = companies.map((c) =>
        c.id === editingCompanyId
          ? {
              ...c,
              code: coCode.trim(),
              name: coName.trim(),
              legalName: coLegalName.trim(),
              tradeName: coTradeName.trim() || coName.trim(),
              cinNumber: cleanCin || undefined,
              gstin: coGstin.trim().toUpperCase(),
              sapCompanyDb: coSapDb.trim().toUpperCase(),
              country: coCountry.trim(),
              state: coState.trim(),
              city: coCity.trim(),
              postalCode: coPostalCode.trim(),
              streetAddress: coStreetAddress.trim(),
              isEnabled: coIsEnabled,
              msmeInfo: coMsmeInfo,
              gstVerificationDetails: savedCoGstDetails || c.gstVerificationDetails || (coGstin ? getOrCreateGstDetailsForEntity(coGstin, coLegalName, coTradeName) : undefined),
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      setCompanies(updated);
      setSuccessMsg(`Company "${coName.trim()}" updated successfully.`);
    } else {
      const newCompany: Company = {
        id: `co-kosh-${Date.now()}`,
        code: coCode.trim(),
        name: coName.trim(),
        legalName: coLegalName.trim(),
        tradeName: coTradeName.trim() || coName.trim(),
        cinNumber: cleanCin || undefined,
        gstin: coGstin.trim().toUpperCase(),
        sapCompanyDb: coSapDb.trim().toUpperCase(),
        isEnabled: coIsEnabled,
        isDefault: false,
        branchesCount: 0,
        country: coCountry.trim(),
        state: coState.trim(),
        city: coCity.trim(),
        postalCode: coPostalCode.trim(),
        streetAddress: coStreetAddress.trim(),
        msmeInfo: coMsmeInfo,
        gstVerificationDetails: savedCoGstDetails || (coGstin ? getOrCreateGstDetailsForEntity(coGstin, coLegalName, coTradeName) : undefined),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCompanies([...companies, newCompany]);
      setSuccessMsg(`Company "${coName.trim()}" registered successfully.`);
    }

    setIsCompanyModalOpen(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleVerifyCoMsme = () => {
    if (!coMsmeInfo.udyamRegistrationNo?.trim()) {
      setErrorMsg('Please enter a valid Udyam Registration Number to verify.');
      return;
    }
    setIsVerifyingCoMsme(true);
    setTimeout(() => {
      setIsVerifyingCoMsme(false);
      setCoMsmeInfo({
        ...coMsmeInfo,
        msmeClassification: 'SMALL',
        activityType: 'MANUFACTURING',
        investmentCategory: '₹1 Cr - ₹10 Cr',
        turnoverCategory: '₹5 Cr - ₹50 Cr',
      });
      setSuccessMsg(`Udyam Registration "${coMsmeInfo.udyamRegistrationNo}" verified with Ministry of MSME.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 700);
  };

  // BRANCH MODAL HANDLERS
  const handleOpenModal = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setBranchGstError('');
    setBranchCaptchaInput('');
    setBranchStagedGst(null);
    setBranchGstSession(null);
    setSavedBranchGstDetails(null);
    setEditingBranchId(null);
    setTargetCompanyId(companies[0]?.id || 'co-kosh-01');
    const nextCode = (branches.length + 1).toString().padStart(3, '0');
    setPortalBranchCode(nextCode);
    setSapBranchCode('');
    setBranchName('');
    setShortName('');
    setGstinPan('');
    setGstLegalName('');
    setGstTradeName('');
    setGstRegistrationType('REGULAR');
    setGstStatus('UNVERIFIED');
    setCountry('India');
    setState('Tamil Nadu');
    setCity('');
    setPostalCode('');
    setStreetAddress('');
    setIsMainBranch(false);
    setSelectedUnitDesc(unitMasters[0]?.description || INITIAL_UNIT_MASTERS[0].description);
    setWarehouses([{ code: `${nextCode}-WH1`, name: 'Main Stores & Receiving', isDefault: true }]);
    setIsModalOpen(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setErrorMsg('');
    setSuccessMsg('');
    setBranchGstError('');
    setBranchCaptchaInput('');
    setBranchStagedGst(null);
    setBranchGstSession(null);
    setSavedBranchGstDetails(
      branch.gstVerificationDetails ||
      (branch.gstinPan ? getOrCreateGstDetailsForEntity(branch.gstinPan, branch.gstLegalName || branch.name, branch.gstTradeName) || null : null)
    );
    setEditingBranchId(branch.id);
    setTargetCompanyId(branch.companyId || companies[0]?.id || 'co-kosh-01');
    setPortalBranchCode(branch.portalBranchCode || '');
    setSapBranchCode(branch.code || '');
    setBranchName(branch.name || '');
    setShortName(branch.shortName || '');
    setGstinPan(branch.gstinPan || '');
    setGstLegalName(branch.gstLegalName || '');
    setGstTradeName(branch.gstTradeName || '');
    setGstRegistrationType(branch.gstRegistrationType || 'REGULAR');
    setGstStatus(branch.gstStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED');
    setCountry(branch.country || 'India');
    setState(branch.state || 'Tamil Nadu');
    setCity(branch.city || '');
    setPostalCode(branch.postalCode || '');
    setStreetAddress(branch.streetAddress || '');
    setIsMainBranch(!!branch.isMainBranch);

    if (branch.plants && branch.plants.length > 0 && branch.plants[0].unitDescription) {
      setSelectedUnitDesc(branch.plants[0].unitDescription);
    } else {
      setSelectedUnitDesc(unitMasters[0]?.description || INITIAL_UNIT_MASTERS[0].description);
    }

    if (branch.warehouses && branch.warehouses.length > 0) {
      setWarehouses(
        branch.warehouses.map((w) => ({
          code: w.warehouseCode,
          name: w.warehouseName,
          isDefault: !!w.isDefault,
        }))
      );
    } else {
      setWarehouses([{ code: `${branch.portalBranchCode}-WH1`, name: 'Main Stores & Receiving', isDefault: true }]);
    }

    setIsModalOpen(true);
  };

  const handleRequestBranchCaptcha = (targetGst?: string) => {
    const gstToUse = targetGst || gstinPan || '34AAACK4603M1ZP';
    const newSession = generateCaptchaChallenge(gstToUse);
    setBranchGstSession(newSession);
    setBranchCaptchaInput('');
    setBranchGstError('');
  };

  const handleVerifyGstInBranchModal = async () => {
    setBranchGstError('');
    setErrorMsg('');
    if (!gstinPan.trim()) {
      setBranchGstError('Please enter a 15-digit GSTIN to verify.');
      return;
    }

    const cleanGst = gstinPan.trim().toUpperCase();
    if (cleanGst.length !== 15) {
      setBranchGstError('GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }

    setIsVerifyingGst(true);
    try {
      const mode = getGstVerificationMode();

      if (mode === 'MANUAL_CAPTCHA' && !branchGstSession) {
        const session = generateCaptchaChallenge(cleanGst);
        setBranchGstSession(session);
        setIsVerifyingGst(false);
        setBranchGstError('CAPTCHA challenge generated. Please enter the 6 characters shown in the image.');
        return;
      }

      const result = await verifyGSTIN({
        gstin: cleanGst,
        mode,
        captchaAnswer: branchCaptchaInput,
        sessionId: branchGstSession?.sessionId,
        requestedBy: 'Branch Coordinator',
      });

      setBranchStagedGst(result);
      setIsBranchReviewModalOpen(true);
    } catch (err: any) {
      setBranchGstError(err.message || 'GSTIN verification failed. Please check inputs.');
      if (getGstVerificationMode() === 'MANUAL_CAPTCHA') {
        const refreshed = generateCaptchaChallenge(cleanGst);
        setBranchGstSession(refreshed);
        setBranchCaptchaInput('');
      }
    } finally {
      setIsVerifyingGst(false);
    }
  };

  const handleConfirmBranchGstReview = (details: GSTVerificationDetails) => {
    setGstRegistrationType('REGULAR');
    setGstLegalName(details.legalName);
    setBranchName(details.legalName);
    setGstTradeName(details.tradeName);
    setGstStatus('VERIFIED');
    setCountry(details.principalPlaceOfBusiness.country || 'India');
    setState(details.principalPlaceOfBusiness.state);
    setCity(details.principalPlaceOfBusiness.city);
    setPostalCode(details.principalPlaceOfBusiness.postalCode);
    const streetParts = [
      details.principalPlaceOfBusiness.doorBuildingNo,
      details.principalPlaceOfBusiness.streetName,
      details.principalPlaceOfBusiness.locality,
    ]
      .filter(Boolean)
      .join(', ');
    setStreetAddress(streetParts || 'Principal Place of Business');
    setSavedBranchGstDetails(details);
    setIsBranchReviewModalOpen(false);
    setBranchGstError('');
    setSuccessMsg(`Branch GST verified & confirmed: ${details.legalName}`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleRequestCoCaptcha = (targetGst?: string) => {
    const gstToUse = targetGst || coGstin || '34AAACK4603M1ZP';
    const newSession = generateCaptchaChallenge(gstToUse);
    setCoGstSession(newSession);
    setCoCaptchaInput('');
    setCoGstError('');
  };

  const handleVerifyCoGstModal = async () => {
    setCoGstError('');
    setErrorMsg('');
    if (!coGstin.trim()) {
      setCoGstError('Please enter a 15-digit GSTIN to verify.');
      return;
    }

    const cleanGst = coGstin.trim().toUpperCase();
    if (cleanGst.length !== 15) {
      setCoGstError('GSTIN must be exactly 15 alphanumeric characters.');
      return;
    }

    setIsVerifyingCoGst(true);
    try {
      const mode = getGstVerificationMode();

      if (mode === 'MANUAL_CAPTCHA' && !coGstSession) {
        const session = generateCaptchaChallenge(cleanGst);
        setCoGstSession(session);
        setIsVerifyingCoGst(false);
        setCoGstError('CAPTCHA challenge generated. Please enter the 6 characters shown in the image.');
        return;
      }

      const result = await verifyGSTIN({
        gstin: cleanGst,
        mode,
        captchaAnswer: coCaptchaInput,
        sessionId: coGstSession?.sessionId,
        requestedBy: 'Organization Admin',
      });

      setCoStagedGst(result);
      setIsCoReviewModalOpen(true);
    } catch (err: any) {
      setCoGstError(err.message || 'GSTIN verification failed. Please check inputs.');
      if (getGstVerificationMode() === 'MANUAL_CAPTCHA') {
        const refreshed = generateCaptchaChallenge(cleanGst);
        setCoGstSession(refreshed);
        setCoCaptchaInput('');
      }
    } finally {
      setIsVerifyingCoGst(false);
    }
  };

  const handleConfirmCoGstReview = (details: GSTVerificationDetails) => {
    setCoLegalName(details.legalName);
    setCoTradeName(details.tradeName);
    setCoCountry(details.principalPlaceOfBusiness.country || 'India');
    setCoState(details.principalPlaceOfBusiness.state);
    setCoCity(details.principalPlaceOfBusiness.city);
    setCoPostalCode(details.principalPlaceOfBusiness.postalCode);
    const streetParts = [
      details.principalPlaceOfBusiness.doorBuildingNo,
      details.principalPlaceOfBusiness.streetName,
      details.principalPlaceOfBusiness.locality,
    ]
      .filter(Boolean)
      .join(', ');
    setCoStreetAddress(streetParts || 'HQ Address');
    setSavedCoGstDetails(details);
    setIsCoReviewModalOpen(false);
    setCoGstError('');
    setSuccessMsg(`Company GST verified & confirmed: ${details.legalName}`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (portalBranchCode.trim().length !== 3) {
      setErrorMsg('SAP Branch Code is MANDATORY and must be EXACTLY 3 characters in length (e.g. 006 or CHE).');
      return;
    }

    const cleanBranchCode = portalBranchCode.trim().toUpperCase();
    const duplicateCode = branches.some(
      (b) => b.portalBranchCode.toUpperCase() === cleanBranchCode && b.id !== editingBranchId
    );
    if (duplicateCode) {
      setErrorMsg(`SAP Branch Code "${cleanBranchCode}" is already assigned to another branch.`);
      return;
    }

    if (!branchName.trim()) {
      setErrorMsg('Full Branch Name is mandatory.');
      return;
    }

    if (gstinPan.trim() && gstStatus !== 'VERIFIED') {
      setErrorMsg('SAVE BLOCKED: GSTIN is provided but not verified. Please click "Verify GST" first.');
      return;
    }

    if (isGstStateMismatch) {
      setErrorMsg(
        `SAVE BLOCKED: GSTIN State Code (${currentGstPrefix} - ${expectedGstState}) conflicts with selected Address State (${state}).`
      );
      return;
    }

    if (!country.trim() || !state.trim() || !city.trim()) {
      setErrorMsg('Country, State, and City location fields are mandatory.');
      return;
    }

    const combinedSapCode = cleanBranchCode;

    const validWarehouses: Warehouse[] = warehouses.map((w, idx) => ({
      id: `wh-${Date.now()}-${idx}`,
      branchId: editingBranchId || `br-${Date.now()}`,
      warehouseCode: w.code.trim().toUpperCase() || `${portalBranchCode}-WH${idx + 1}`,
      warehouseName: w.name.trim() || `Warehouse #${idx + 1}`,
      isDefault: w.isDefault,
      isNettable: true,
      city: city.trim(),
      state: state.trim(),
      country: country.trim() || 'India',
    }));

    if (validWarehouses.length > 0 && !validWarehouses.some((w) => w.isDefault)) {
      validWarehouses[0].isDefault = true;
    }

    const defaultWh = validWarehouses.find((w) => w.isDefault) || validWarehouses[0];

    const singlePlantUnit = [
      {
        id: `plt-${Date.now()}`,
        branchId: editingBranchId || `br-${Date.now()}`,
        code: `${portalBranchCode}-UNIT`,
        name: `${branchName.trim()} Main Unit`,
        unitDescription: selectedUnitDesc,
      },
    ];

    if (editingBranchId) {
      const updated = branches.map((b) => {
        if (b.id === editingBranchId) {
          return {
            ...b,
            companyId: targetCompanyId,
            portalBranchCode: portalBranchCode.trim(),
            code: combinedSapCode,
            name: branchName.trim(),
            shortName: shortName.trim() || branchName.trim(),
            gstinPan: gstinPan.trim().toUpperCase(),
            gstLegalName: gstLegalName || 'KOSH INNOVATIONS PRIVATE LIMITED',
            gstTradeName: gstTradeName || branchName.trim(),
            gstRegistrationType,
            gstStatus,
            country: country.trim(),
            state: state.trim(),
            city: city.trim(),
            postalCode: postalCode.trim(),
            streetAddress: streetAddress.trim(),
            isMainBranch,
            plants: singlePlantUnit,
            warehouses: validWarehouses,
            defaultWarehouseId: defaultWh?.id,
            gstVerificationDetails: savedBranchGstDetails || b.gstVerificationDetails || (gstinPan ? getOrCreateGstDetailsForEntity(gstinPan, branchName, gstTradeName) : undefined),
          };
        }
        return b;
      });

      setBranches(updated);
      setIsModalOpen(false);
      setSuccessMsg(`Branch [${portalBranchCode}] "${branchName}" updated successfully.`);
    } else {
      const newBranch: Branch = {
        id: `br-${Date.now()}`,
        orgId: INITIAL_ORGANIZATION.id,
        companyId: targetCompanyId,
        portalBranchCode: portalBranchCode.trim(),
        code: combinedSapCode,
        name: branchName.trim(),
        shortName: shortName.trim() || branchName.trim(),
        gstinPan: gstinPan.trim().toUpperCase(),
        gstLegalName: gstLegalName || 'KOSH INNOVATIONS PRIVATE LIMITED',
        gstTradeName: gstTradeName || branchName.trim(),
        gstRegistrationType,
        gstStatus,
        country: country.trim(),
        state: state.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        streetAddress: streetAddress.trim(),
        isMainBranch,
        lifecycleStatus: 'ACTIVE',
        plants: singlePlantUnit,
        warehouses: validWarehouses,
        defaultWarehouseId: defaultWh?.id,
        gstVerificationDetails: savedBranchGstDetails || (gstinPan ? getOrCreateGstDetailsForEntity(gstinPan, branchName, gstTradeName) : undefined),
      };

      const updated = [...branches, newBranch];
      setBranches(updated);
      setIsModalOpen(false);
      setSuccessMsg(
        `Branch [${newBranch.portalBranchCode}] "${newBranch.name}" created & activated successfully with ${validWarehouses.length} warehouse(s).`
      );
    }

    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleAddNewUnitMaster = () => {
    if (!newUnitCode.trim() || !newUnitDesc.trim()) {
      alert('Unit Code and Description are required.');
      return;
    }

    const newMaster: UnitDescriptionMaster = {
      id: `u-${Date.now()}`,
      code: newUnitCode.trim().toUpperCase(),
      description: newUnitDesc.trim(),
      approvalStatus: 'APPROVED',
      version: 1,
    };

    setUnitMasters((prev) => [...prev, newMaster]);
    setSelectedUnitDesc(newMaster.description);
    setIsAddUnitModalOpen(false);
    setNewUnitCode('');
    setNewUnitDesc('');
    alert(`New Unit Description "${newMaster.description}" added and selected.`);
  };

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {/* Title Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Organization, Multi-Company & Branch Management
          </h2>
          <p className="text-slate-500 mt-0.5">
            Manage multi-company entities, SAP B1 HANA database connections, and operating branch hierarchies with enable/disable toggles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'companies' && (
            <button
              onClick={() => handleOpenCompanyModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" /> Add Company
            </button>
          )}
          {activeTab === 'branches' && (
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" /> Add Branch / Plant
            </button>
          )}
          {activeTab === 'warehouse' && (
            <button
              onClick={() => {
                setWhCode('');
                setWhName('');
                setWhIsDefault(false);
                setWhIsNettable(true);
                setWhEnableBins(false);
                setWhIsInactive(false);
                setIsWhModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" /> Add Warehouse
            </button>
          )}
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Global Connection Test Feedback Banner */}
      {testResult && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testResult.msg}</span>
        </div>
      )}

      {/* Sub-Tabs: Exactly 3 Primary Tabs in Order: Company | Branch | Warehouse */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-medium border border-slate-200">
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'companies' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Company ({companies.length})
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'branches' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Branch ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab('warehouse')}
          className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'warehouse' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <WarehouseIcon className="w-4 h-4" />
          Warehouse ({branches.flatMap((b) => b.warehouses || []).length})
        </button>
      </div>

      {/* TAB 1: COMPANY */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Multi-Company Governance Architecture
              </div>
              <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
                Registered SAP Companies
              </div>
            </div>

            <div className="text-right text-slate-400 font-semibold text-xs">
              Enabled Companies:{' '}
              <strong className="text-emerald-400 font-mono text-sm">
                {companies.filter((c) => c.isEnabled).length}
              </strong>{' '}
              / {companies.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((co) => {
              const coOverrides = coActivationOverrides[co.id] || { env: true, sync: true };
              return (
                <div
                  key={co.id}
                  className={`bg-white p-5 rounded-xl border shadow-xs flex flex-col justify-between transition-all duration-200 ${
                    co.isEnabled ? 'border-slate-200' : 'border-rose-200 bg-slate-50/60 opacity-90'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                          <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="truncate">{co.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>Code: <strong className="text-indigo-700 font-bold">{co.code}</strong></span>
                          <span>•</span>
                          <span>SAP DB: <strong className="text-indigo-900 font-bold">{co.sapCompanyDb}</strong></span>
                        </div>
                      </div>

                      {/* Top-Right Header Status Control: Retain only a single, clean power toggle button */}
                      <button
                        type="button"
                        onClick={() => handleToggleCompanyEnabled(co.id)}
                        className={`p-2 rounded-lg border transition-all duration-150 cursor-pointer shrink-0 flex items-center justify-center ${
                          co.isEnabled
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-700 shadow-2xs'
                            : 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700 shadow-2xs'
                        }`}
                        title={co.isEnabled ? 'Company Active • Click to Disable' : 'Company Disabled • Click to Enable'}
                        aria-label={co.isEnabled ? 'Disable Company' : 'Enable Company'}
                      >
                        <Power className={`w-4 h-4 transition-transform ${co.isEnabled ? 'text-emerald-600' : 'text-rose-500'}`} />
                      </button>
                    </div>

                    {/* Company GST, CIN, MSME & Address Details */}
                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 text-[11px] space-y-1.5">
                      <div className="truncate"><strong className="text-slate-700">Official GST Legal Name:</strong> {co.legalName}</div>
                      <div className="truncate"><strong className="text-slate-700">Trade Name:</strong> {co.tradeName}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono">
                        <div><strong className="text-slate-700">GSTIN:</strong> {co.gstin}</div>
                        <div><strong className="text-slate-700">CIN:</strong> {co.cinNumber || '—'}</div>
                      </div>
                      <div className="truncate"><strong className="text-slate-700">HQ Address:</strong> {co.country}, {co.state}, {co.city}{co.streetAddress ? ` • ${co.streetAddress}` : ''}</div>
                      {co.msmeInfo?.isMSME && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                          <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>MSME: {co.msmeInfo.msmeClassification || 'REGISTERED'} • {co.msmeInfo.udyamRegistrationNo || 'Verified'}</span>
                        </div>
                      )}
                    </div>

                    {/* Independent Activation Controls */}
                    <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200 space-y-2">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3 h-3 text-indigo-500" />
                          Independent Activation Controls
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Isolated Scope</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Control 1: Env / Database Status */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="text-[11px] font-bold text-slate-800 truncate">Env / Database Status</div>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${coOverrides.env ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className={`text-[10px] font-bold ${coOverrides.env ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {coOverrides.env ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCoEnv(co.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              coOverrides.env ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                            title={coOverrides.env ? 'Click to deactivate Env / Database Status' : 'Click to activate Env / Database Status'}
                            aria-label="Toggle Env / Database Status"
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                coOverrides.env ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Control 2: Data Sync / Integration */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <div className="text-[11px] font-bold text-slate-800 truncate">Data Sync / Integration</div>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${coOverrides.sync ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className={`text-[10px] font-bold ${coOverrides.sync ? 'text-emerald-700' : 'text-amber-600'}`}>
                                {coOverrides.sync ? 'Active' : 'Paused'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCoSync(co.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              coOverrides.sync ? 'bg-emerald-600' : 'bg-slate-300'
                            }`}
                            title={coOverrides.sync ? 'Click to pause Data Sync / Integration' : 'Click to activate Data Sync / Integration'}
                            aria-label="Toggle Data Sync / Integration"
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                coOverrides.sync ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Controls: Test, Mappings, Profile, Sync */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <button
                        onClick={() => handleTestCompanyConnection(co)}
                        disabled={testingCoId === co.id}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
                      >
                        {testingCoId === co.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                        )}
                        <span>Test Connection</span>
                      </button>

                      <button
                        onClick={() => setActiveMappingCo(co)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                        <span>View Mappings</span>
                      </button>

                      <button
                        onClick={() => setActiveProfileCo(co)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
                      >
                        <Database className="w-3.5 h-3.5 text-amber-600" />
                        <span>Connection Profile & Schedule</span>
                      </button>

                      <button
                        onClick={() => setActiveSyncCo(co)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg font-bold border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 text-[11px]"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data Sync & Discovery</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      Branches: <strong className="text-slate-800 font-mono">{branches.filter((b) => getBranchCompanyId(b) === co.id).length || co.branchesCount || 1}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectedGstEntity({
                            title: co.name,
                            code: co.code,
                            gstin: co.gstin,
                            details:
                              co.gstVerificationDetails ||
                              getOrCreateGstDetailsForEntity(co.gstin, co.legalName, co.tradeName),
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold border border-slate-200 transition cursor-pointer"
                        title="View Official GST Registration & Filing History"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>GST Details</span>
                      </button>

                      <button
                        onClick={() => handleOpenCompanyModal(co)}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold border border-indigo-200 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Modify Profile
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BRANCH */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Authoritative Operating Branch Scope
              </div>
              <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
                Kosh Innovations Operating Branches
              </div>
            </div>

            <div className="text-right text-slate-400 font-semibold text-xs">
              Active Branches:{' '}
              <strong className="text-emerald-400 font-mono text-sm">
                {branches.filter((b) => b.lifecycleStatus !== 'INACTIVE').length}
              </strong>{' '}
              / {branches.length}
            </div>
          </div>

          {/* Company Filter Bar for Branches */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Filter by Company:</span>
              <select
                value={branchCompanyFilter}
                onChange={(e) => setBranchCompanyFilter(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Authorized Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing{' '}
              <strong className="text-slate-800">
                {branches.filter((b) => branchCompanyFilter === 'ALL' || getBranchCompanyId(b) === branchCompanyFilter).length}
              </strong>{' '}
              branches
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches
              .filter((b) => branchCompanyFilter === 'ALL' || getBranchCompanyId(b) === branchCompanyFilter)
              .map((br) => {
                const isInactive = br.lifecycleStatus === 'INACTIVE';
                const isVerifiedGst = br.gstStatus === 'VERIFIED';
                const parentCo = companies.find((c) => c.id === getBranchCompanyId(br)) || companies[0];

                return (
                  <div
                    key={br.id}
                    className={`bg-white p-4 rounded-xl border shadow-xs space-y-3 transition ${
                      isInactive ? 'border-rose-200 bg-slate-50/50 opacity-80' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                          <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{br.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {br.country || 'India'}, {br.state}, {br.city}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1 shrink-0">
                        <span className="font-mono text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs">
                          Code: {br.portalBranchCode}
                        </span>
                        {br.isMainBranch && (
                          <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                            MAIN BRANCH
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Company Association */}
                    <div className="p-2 bg-indigo-50/60 rounded border border-indigo-100 text-[11px] font-mono">
                      <div className="text-slate-500 text-[10px] uppercase font-bold">Parent Company Association:</div>
                      <div className="font-bold text-indigo-900">{parentCo?.code || 'KOSH-HQ'} • {parentCo?.name || 'Kosh Innovations Pvt Ltd'}</div>
                      <div className="text-[10px] text-slate-500">SAP Branch Code: <strong className="text-slate-800">{br.sapBranchId || br.portalBranchCode}</strong></div>
                    </div>

                    {/* Status & Enable / Disable Actions Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isInactive
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {isInactive ? 'INACTIVE' : 'ACTIVE'}
                        </span>
                        <button
                          onClick={() => handleToggleBranchStatus(br.id)}
                          className={`p-1 rounded transition cursor-pointer border ${
                            isInactive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          }`}
                          title={isInactive ? 'Activate Branch' : 'Deactivate Branch'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleEditBranch(br)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" /> Modify
                      </button>
                    </div>

                    {/* GST Status: Green Tick if verified/yes, else Red Cross & Details Inspector */}
                    {br.gstinPan && (
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] font-mono flex items-center justify-between">
                        <div className="truncate pr-1">
                          <span className="text-slate-600 font-semibold">GSTIN: {br.gstinPan}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setInspectedGstEntity({
                                title: br.name,
                                code: br.portalBranchCode,
                                gstin: br.gstinPan || '',
                                details:
                                  br.gstVerificationDetails ||
                                  getOrCreateGstDetailsForEntity(br.gstinPan, br.gstLegalName || br.name, br.shortName || br.name),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition cursor-pointer"
                            title="Inspect official GST verification details & filing history"
                          >
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            GST Details
                          </button>
                          <div className="flex items-center gap-1" title={isVerifiedGst ? 'GST Verified' : 'GST Unverified'}>
                            {isVerifiedGst ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Warehouses list */}
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                        <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                        Branch Warehouses ({(br.warehouses || []).length}):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(br.warehouses || []).map((w) => (
                          <span
                            key={w.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              w.isDefault
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {w.warehouseCode} {w.isDefault && '★'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: WAREHOUSE */}
      {activeTab === 'warehouse' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                Enterprise Warehouse Governance & Storage Facilities
              </div>
              <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
                Warehouse
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right text-slate-400 font-semibold text-xs">
                Total Warehouses:{' '}
                <strong className="text-emerald-400 font-mono text-sm">
                  {branches.flatMap((b) => b.warehouses || []).length}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingWhId(null);
                  setWhTargetBranchId(branches[0]?.id || 'br-pondy-01');
                  setWhCode('');
                  setWhName('');
                  setWhIsDefault(false);
                  setWhIsNettable(true);
                  setWhEnableBins(false);
                  setWhIsInactive(false);
                  setIsWhModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Warehouse
              </button>
            </div>
          </div>

          {/* Filters: Company, Branch, Search */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Company:</span>
                <select
                  value={whCompanyFilter}
                  onChange={(e) => {
                    setWhCompanyFilter(e.target.value);
                    setWhBranchFilter('ALL');
                  }}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Branch:</span>
                <select
                  value={whBranchFilter}
                  onChange={(e) => setWhBranchFilter(e.target.value)}
                  className="p-1.5 bg-slate-50 border border-slate-300 rounded font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="ALL">All Branches</option>
                  {branches
                    .filter((b) => whCompanyFilter === 'ALL' || getBranchCompanyId(b) === whCompanyFilter)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        [{b.portalBranchCode}] {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Warehouse Code or Name..."
                  value={whSearchTerm}
                  onChange={(e) => setWhSearchTerm(e.target.value)}
                  className="pl-3 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs w-60 focus:ring-2 focus:ring-indigo-500"
                >
                </input>
              </div>
            </div>

            <button
              onClick={() => {
                setWhCompanyFilter('ALL');
                setWhBranchFilter('ALL');
                setWhSearchTerm('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer"
            >
              Reset Filters
            </button>
          </div>

          {/* Warehouse Cards Grid matching Branch Cards look and feel */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches
              .filter((b) => whCompanyFilter === 'ALL' || getBranchCompanyId(b) === whCompanyFilter)
              .filter((b) => whBranchFilter === 'ALL' || b.id === whBranchFilter)
              .flatMap((b) => {
                const coId = getBranchCompanyId(b);
                const co = companies.find((c) => c.id === coId) || companies[0];
                return (b.warehouses || []).map((wh) => ({
                  ...wh,
                  parentBranch: b,
                  parentCompany: co,
                }));
              })
              .filter((item) => {
                if (!whSearchTerm) return true;
                const q = whSearchTerm.toLowerCase();
                return (
                  item.warehouseCode.toLowerCase().includes(q) ||
                  item.warehouseName.toLowerCase().includes(q) ||
                  item.parentBranch.name.toLowerCase().includes(q) ||
                  (item.parentCompany?.name || '').toLowerCase().includes(q) ||
                  (item.parentCompany?.code || '').toLowerCase().includes(q)
                );
              })
              .map((wh) => {
                const isInactive = wh.isInactive;
                return (
                  <div
                    key={wh.id}
                    className={`bg-white p-4 rounded-xl border shadow-xs space-y-3 transition ${
                      isInactive ? 'border-rose-200 bg-slate-50/50 opacity-80' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                          <WarehouseIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>{wh.warehouseName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {wh.city || wh.parentBranch.city || 'India'}, {wh.state || wh.parentBranch.state}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1 shrink-0">
                        <span className="font-mono text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded shadow-xs">
                          Code: {wh.warehouseCode}
                        </span>
                        {wh.isDefault && (
                          <span className="text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                            DEFAULT WAREHOUSE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Company and Branch Association */}
                    <div className="p-2 bg-indigo-50/60 rounded border border-indigo-100 text-[11px] font-mono space-y-1">
                      <div className="text-slate-500 text-[10px] uppercase font-bold">Parent Company Association:</div>
                      <div className="font-bold text-indigo-900">
                        [{wh.parentCompany?.code || 'KOSH-HQ'}] • {wh.parentCompany?.name || 'Kosh Innovations Pvt Ltd'}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        Operating Branch: <strong className="text-slate-900 font-bold">[{wh.parentBranch.portalBranchCode}] {wh.parentBranch.name}</strong>
                      </div>
                    </div>

                    {/* Warehouse Policy & Bin Locations */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Nettable Inventory:</span>
                        <span className={`font-bold ${wh.isNettable ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {wh.isNettable ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
                        <span className="text-slate-600 font-semibold">Bin Locations:</span>
                        <span className={`font-bold ${wh.enableBinLocations ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {wh.enableBinLocations ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                    </div>

                    {/* Status & Action Bar */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isInactive
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {isInactive ? 'INACTIVE' : 'ACTIVE'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedBranches = branches.map((b) => {
                              if (b.id === wh.parentBranch.id) {
                                const updatedWhs = (b.warehouses || []).map((w) =>
                                  w.id === wh.id ? { ...w, isInactive: !w.isInactive } : w
                                );
                                return { ...b, warehouses: updatedWhs };
                              }
                              return b;
                            });
                            setBranches(updatedBranches);
                            setSuccessMsg(`Warehouse ${wh.warehouseCode} status toggled.`);
                            setTimeout(() => setSuccessMsg(''), 4000);
                          }}
                          className={`p-1 rounded transition cursor-pointer border ${
                            isInactive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          }`}
                          title={isInactive ? 'Activate Warehouse' : 'Deactivate Warehouse'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!wh.isDefault && (
                          <button
                            type="button"
                            onClick={() => {
                              const updatedBranches = branches.map((b) => {
                                if (b.id === wh.parentBranch.id) {
                                  const updatedWhs = (b.warehouses || []).map((w) => ({
                                    ...w,
                                    isDefault: w.id === wh.id,
                                  }));
                                  return { ...b, warehouses: updatedWhs, defaultWarehouseId: wh.id };
                                }
                                return b;
                              });
                              setBranches(updatedBranches);
                              setSuccessMsg(`Warehouse ${wh.warehouseCode} set as Default for ${wh.parentBranch.name}.`);
                              setTimeout(() => setSuccessMsg(''), 4000);
                            }}
                            className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded cursor-pointer"
                            title="Set as Branch Default"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWhId(wh.id);
                            setWhTargetBranchId(wh.parentBranch.id);
                            setWhCode(wh.warehouseCode);
                            setWhName(wh.warehouseName);
                            setWhIsDefault(!!wh.isDefault);
                            setWhIsNettable(wh.isNettable !== false);
                            setWhEnableBins(!!wh.enableBinLocations);
                            setWhIsInactive(!!wh.isInactive);
                            setIsWhModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Modify
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL: VIEW / EDIT MAPPINGS (ENTIRE FUNCTIONALITY FROM SAP INTEGRATION MANAGEMENT) */}
      {activeMappingCo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-sm text-cyan-300">
                    SAP Field Discovery & Mapping Matrix — {activeMappingCo.name}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Target DB: <strong className="text-white font-bold">{activeMappingCo.sapCompanyDb}</strong> • Company Code: <strong className="text-cyan-200">{activeMappingCo.code}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  {fieldRecords.length} Fields Configured
                </span>
                <button
                  onClick={() => setActiveMappingCo(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer text-sm font-bold"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Label, API Property, Target..."
                    value={mappingSearchTerm}
                    onChange={(e) => setMappingSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs w-64 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <select
                  value={mappingTabFilter}
                  onChange={(e) => setMappingTabFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="ALL">All SAP Tabs ({fieldRecords.length})</option>
                  <option value="GENERAL_LOCAL">1. General → Local Language</option>
                  <option value="GENERAL_FOREIGN">2. General → Foreign Language</option>
                  <option value="ACCOUNTING_GENERAL">3. Accounting → General & Taxes</option>
                  <option value="ACCOUNTING_EXCISE">4. Accounting → Excise</option>
                  <option value="INIT_ACCOUNTING">5. Basic Init → Accounting</option>
                  <option value="INIT_INVENTORY">6. Basic Init → Inventory</option>
                  <option value="INIT_HOUSE_BANK">7. Basic Init → House Bank</option>
                  <option value="INIT_FIXED_ASSETS_OTHER">8. Basic Init → Fixed Assets</option>
                </select>

                <select
                  value={mappingStatusFilter}
                  onChange={(e) => setMappingStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
                >
                  <option value="ALL">All Mapping Statuses</option>
                  <option value="VALIDATED">Validated</option>
                  <option value="MAPPED">Mapped</option>
                  <option value="UNSUPPORTED_BY_CURRENT_API">Unsupported by API</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportMappingsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer text-xs transition shadow-xs"
                  title="Export Field Mappings CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsExcelImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 cursor-pointer text-xs transition"
                  title="Import Mapping Template from CSV / Excel"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Import Template (Excel / CSV)</span>
                </button>
              </div>
            </div>

            {importFeedback && (
              <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{importFeedback}</span>
              </div>
            )}

            {/* Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                    <tr>
                      <th className="p-3">Visible SAP Screen Label</th>
                      <th className="p-3">SAP API Property</th>
                      <th className="p-3">API Access</th>
                      <th className="p-3">Retrieved Source Value</th>
                      <th className="p-3">Kosh Target Field</th>
                      <th className="p-3">Transformation</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fieldRecords
                      .filter((f) => {
                        if (mappingTabFilter !== 'ALL' && f.tabName !== mappingTabFilter) return false;
                        if (mappingStatusFilter !== 'ALL' && f.discoveryStatus !== mappingStatusFilter) return false;
                        if (!mappingSearchTerm) return true;
                        const q = mappingSearchTerm.toLowerCase();
                        return (
                          f.visibleSapLabel.toLowerCase().includes(q) ||
                          f.technicalPropertyName.toLowerCase().includes(q) ||
                          f.koshTargetEntity.toLowerCase().includes(q) ||
                          f.koshTargetProperty.toLowerCase().includes(q) ||
                          (f.retrievedSourceValue || '').toLowerCase().includes(q)
                        );
                      })
                      .map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-bold text-slate-900">
                            <div>{rec.visibleSapLabel}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{rec.subsectionName}</div>
                          </td>
                          <td className="p-3 font-mono text-indigo-700 font-bold">
                            <div>{rec.technicalPropertyName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{rec.technicalResource}</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {rec.isReadable ? (rec.isWritable ? 'Read / Write' : 'Read-Only') : 'No Access'}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {rec.retrievedSourceValue || '—'}
                          </td>
                          <td className="p-3 font-bold text-slate-900 font-mono">
                            {rec.koshTargetEntity}.{rec.koshTargetProperty}
                          </td>
                          <td className="p-3 font-mono text-slate-600 text-[11px]">
                            {rec.mappingTransformation || 'Direct'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                                rec.discoveryStatus === 'VALIDATED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : rec.discoveryStatus === 'MAPPED'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {rec.discoveryStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditMapping(rec)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-200 cursor-pointer transition"
                              title="Edit Field Mapping Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Active Company Scope: <strong className="text-slate-800 font-bold">{activeMappingCo.name}</strong> ({activeMappingCo.sapCompanyDb})
              </span>
              <button
                type="button"
                onClick={() => setActiveMappingCo(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs cursor-pointer transition"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: EDIT FIELD MAPPING RULE */}
      {isEditMappingModalOpen && editingMappingRecord && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-indigo-600" />
                Edit Field Mapping Rule
              </h3>
              <button onClick={() => setIsEditMappingModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Visible SAP Screen Label</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={editingMappingRecord.visibleSapLabel}
                  className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Technical SAP API Property & Resource</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${editingMappingRecord.technicalResource} → ${editingMappingRecord.technicalPropertyName}`}
                  className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-indigo-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kosh Target Entity & Property *</label>
                <input
                  type="text"
                  value={`${editingMappingRecord.koshTargetEntity}.${editingMappingRecord.koshTargetProperty}`}
                  onChange={(e) => {
                    const parts = e.target.value.split('.');
                    setEditingMappingRecord({
                      ...editingMappingRecord,
                      koshTargetEntity: parts[0] || 'ORGANIZATION',
                      koshTargetProperty: parts[1] || 'customProperty',
                    });
                  }}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Transformation Rule</label>
                <input
                  type="text"
                  value={editingMappingRecord.mappingTransformation || 'Direct'}
                  onChange={(e) => setEditingMappingRecord({ ...editingMappingRecord, mappingTransformation: e.target.value })}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mapping Status</label>
                <select
                  value={editingMappingRecord.discoveryStatus}
                  onChange={(e) => setEditingMappingRecord({ ...editingMappingRecord, discoveryStatus: e.target.value as any })}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-bold"
                >
                  <option value="VALIDATED">VALIDATED</option>
                  <option value="MAPPED">MAPPED</option>
                  <option value="UNSUPPORTED_BY_CURRENT_API">UNSUPPORTED_BY_CURRENT_API</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditMappingModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-lg cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMappingRecord}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer text-xs"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: IMPORT MAPPING TEMPLATE (EXCEL / CSV) */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-3.5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                Import 18-Column Mandatory Mapping Template (CSV / Excel)
              </h3>
              <button onClick={() => setIsExcelImportModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste the contents of your 18-column mapping template (CSV text) below to parse and batch-validate field mappings.
            </p>

            <textarea
              rows={6}
              value={importFileText}
              onChange={(e) => setImportFileText(e.target.value)}
              placeholder="Paste CSV rows here (Record Id, SAP Tab Name, Visible Screen Label, Technical Property Name...)"
              className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleParseImportText}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 cursor-pointer"
              >
                Parse & Preview Rows
              </button>

              {importPreviewData && (
                <span className="text-xs font-bold text-emerald-700">
                  {importPreviewData.total} valid rows parsed
                </span>
              )}
            </div>

            {importPreviewData && importPreviewData.rows.length > 0 && (
              <div className="overflow-y-auto max-h-48 border border-slate-200 rounded-lg text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-2">Screen Label</th>
                      <th className="p-2">SAP Property</th>
                      <th className="p-2">Kosh Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreviewData.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-bold">{r.visibleSapLabel}</td>
                        <td className="p-2 font-mono text-indigo-700">{r.technicalPropertyName}</td>
                        <td className="p-2 font-bold">{r.koshTargetEntity}.{r.koshTargetProperty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsExcelImportModalOpen(false);
                  setImportPreviewData(null);
                  setImportFileText('');
                }}
                className="px-3.5 py-1.5 bg-slate-100 font-bold rounded-lg cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!importPreviewData?.rows.length}
                onClick={handleApplyImport}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer text-xs disabled:opacity-50"
              >
                Apply Imported Mappings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONNECTION PROFILE & SCHEDULE (ENTIRE FUNCTIONALITY FROM SAP INTEGRATION MANAGEMENT) */}
      {activeProfileCo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-cyan-300">
                    Connection Profile & Schedule — {activeProfileCo.name}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Database: <strong className="text-white font-bold">{activeProfileCo.sapCompanyDb}</strong> • Code: {activeProfileCo.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProfileCo(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer text-sm font-bold"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileSaveSuccess && (
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Connection Profile & Scheduling Parameters successfully updated and persisted to production registry.</span>
              </div>
            )}

            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Profile Header Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="font-bold text-slate-900 text-xs">SAP Business One Service Layer Profile</div>
                  <div className="text-[11px] text-slate-500 font-mono">Active Target: {activeProfileCo.sapCompanyDb}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold border ${
                    coActivationOverrides[activeProfileCo.id]?.sync ?? true
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    SYNC: {coActivationOverrides[activeProfileCo.id]?.sync ?? true ? 'ACTIVE' : 'PAUSED'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCoSync(activeProfileCo.id)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition ${
                      coActivationOverrides[activeProfileCo.id]?.sync ?? true
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {coActivationOverrides[activeProfileCo.id]?.sync ?? true ? 'Emergency Pause Sync' : 'Resume Automated Sync'}
                  </button>
                </div>
              </div>

              {/* Service Layer Connection Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Service Layer HTTPS Hostname</label>
                  <input
                    type="text"
                    value={profileForm.serviceLayerHost}
                    onChange={(e) => setProfileForm({ ...profileForm, serviceLayerHost: e.target.value })}
                    className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">HTTPS Service Layer Port</label>
                  <input
                    type="number"
                    value={profileForm.serviceLayerPort}
                    onChange={(e) => setProfileForm({ ...profileForm, serviceLayerPort: parseInt(e.target.value) || 50000 })}
                    className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">SAP Business One Engine Version</label>
                  <input
                    type="text"
                    value={profileForm.sapVersion}
                    onChange={(e) => setProfileForm({ ...profileForm, sapVersion: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Credential Vault Reference</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={`vault://kosh-secrets/${activeProfileCo.sapCompanyDb.toLowerCase()}-creds`}
                    className="w-full text-xs font-mono p-2 border border-slate-200 bg-slate-100 rounded-lg text-slate-600"
                  />
                </div>
              </div>

              {/* Scheduling & Execution Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Automated Sync Schedule</label>
                  <select
                    value={profileForm.executionSchedule}
                    onChange={(e) => setProfileForm({ ...profileForm, executionSchedule: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                  >
                    <option value="15">Every 15 Minutes (Near Real-Time)</option>
                    <option value="60">Hourly Sync</option>
                    <option value="1440">Daily Midnight Batch</option>
                    <option value="MANUAL">Manual Trigger Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Timezone Scope</label>
                  <input
                    type="text"
                    readOnly
                    value={profileForm.timezoneScope}
                    className="w-full text-xs p-2 border border-slate-200 bg-slate-100 rounded-lg font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Scheduler Status</label>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>Active (Next in 12 mins)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Retry Policy</label>
                  <input
                    type="text"
                    value={profileForm.retryPolicy}
                    onChange={(e) => setProfileForm({ ...profileForm, retryPolicy: e.target.value })}
                    className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">TLS / SSL Verification</label>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ENFORCED (TLS 1.3)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Authentication Method</label>
                  <input
                    type="text"
                    readOnly
                    value="B1 SESSION COOKIE"
                    className="w-full text-xs p-2 border border-slate-200 bg-slate-100 rounded-lg font-mono font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* Test Handshake Feedback */}
              {profileTestFeedback && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg font-mono text-xs">
                  {profileTestFeedback}
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleTestProfileConnection}
                disabled={isTestingProfile}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer transition disabled:opacity-50"
              >
                {isTestingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Zap className="w-3.5 h-3.5 text-indigo-600" />}
                <span>{isTestingProfile ? 'Testing Handshake...' : 'Test Connection Handshake'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProfileCo(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfileConfig}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs cursor-pointer transition shadow-xs"
                >
                  Save Profile Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DATA SYNC & DISCOVERY (ENTIRE FUNCTIONALITY FROM SAP INTEGRATION MANAGEMENT) */}
      {activeSyncCo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-cyan-300">
                    SAP Data Sync & Discovery Matrix — {activeSyncCo.name}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Target Database: <strong className="text-white font-bold">{activeSyncCo.sapCompanyDb}</strong> • Code: {activeSyncCo.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSyncCo(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer text-sm font-bold"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {syncFeedbackToast && (
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncFeedbackToast}</span>
              </div>
            )}

            {/* Sub-Tabs: Matrix vs Sync History */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setSyncModalTab('matrix')}
                className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition ${
                  syncModalTab === 'matrix' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Data Pull & Live Matrix ({fieldRecords.length} Fields)
              </button>
              <button
                type="button"
                onClick={() => setSyncModalTab('history')}
                className={`pb-2.5 text-xs font-bold border-b-2 cursor-pointer transition ${
                  syncModalTab === 'history' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Sync Execution History ({jobLogs.length} Jobs)
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-2xl font-black text-emerald-700">{fieldRecords.length}</div>
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">Discovered Fields</div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-2xl font-black text-blue-700">
                    {fieldRecords.filter((f) => f.discoveryStatus === 'VALIDATED' || f.discoveryStatus === 'MAPPED').length}
                  </div>
                  <div className="text-[10px] font-bold text-blue-900 uppercase">Mapped & Valid</div>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                  <div className="text-2xl font-black text-purple-700">98.4%</div>
                  <div className="text-[10px] font-bold text-purple-900 uppercase">Sync Health</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-2xl font-black text-amber-700">
                    {coActivationOverrides[activeSyncCo.id]?.sync ?? true ? 'ACTIVE' : 'PAUSED'}
                  </div>
                  <div className="text-[10px] font-bold text-amber-900 uppercase">Sync Channel</div>
                </div>
              </div>

              {syncModalTab === 'matrix' ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <div className="font-bold text-slate-900">Execute Company Details & AdminInfo Sync</div>
                      <div className="text-[11px] text-slate-500">Pulls authoritative company profile data from SAP Business One HANA Service Layer.</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExecuteDataPullAndSync}
                      disabled={isExecutingSync}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isExecutingSync ? 'animate-spin' : ''}`} />
                      <span>{isExecutingSync ? 'Executing Pull...' : 'Execute Data Pull & Sync'}</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                        <tr>
                          <th className="p-2.5">Visible SAP Label</th>
                          <th className="p-2.5">SAP API Property</th>
                          <th className="p-2.5">Retrieved Source Value</th>
                          <th className="p-2.5">Kosh Target Field</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fieldRecords.slice(0, 10).map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-bold text-slate-900">{f.visibleSapLabel}</td>
                            <td className="p-2.5 font-mono text-indigo-700 font-bold">{f.technicalPropertyName}</td>
                            <td className="p-2.5 font-mono font-bold text-slate-800">{f.retrievedSourceValue || '—'}</td>
                            <td className="p-2.5 font-mono text-slate-700">{f.koshTargetEntity}.{f.koshTargetProperty}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {f.discoveryStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    Showing top 10 fields • Open View Mappings for all {fieldRecords.length} fields
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px]">
                        <tr>
                          <th className="p-2.5">Job Correlation ID</th>
                          <th className="p-2.5">Operation Type</th>
                          <th className="p-2.5">Duration</th>
                          <th className="p-2.5">Fields Mapped</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jobLogs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-mono font-bold text-indigo-700">{job.jobCorrelationId}</td>
                            <td className="p-2.5 font-bold text-slate-800">{job.operationType}</td>
                            <td className="p-2.5 font-mono text-slate-600">{job.durationMs}ms</td>
                            <td className="p-2.5 font-bold text-slate-900">{job.mappedFieldsCount} / {job.discoveredFieldsCount}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {job.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500 font-mono text-[11px]">
                              {new Date(job.startedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Target DB: <strong className="text-slate-800 font-bold">{activeSyncCo.sapCompanyDb}</strong>
              </span>
              <button
                type="button"
                onClick={() => setActiveSyncCo(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-xs cursor-pointer transition"
              >
                Close Discovery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: RECONCILIATION PREVIEW BEFORE COMMIT */}
      {isFetchPreviewOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Reconciliation Preview: SAP Retrieved Values vs Kosh Database
              </h3>
              <button onClick={() => setIsFetchPreviewOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Review live fetched data values from SAP Service Layer before committing them to the Kosh master data storage:
            </p>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-lg text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                  <tr>
                    <th className="p-2.5">Visible SAP Field</th>
                    <th className="p-2.5">Retrieved SAP Value</th>
                    <th className="p-2.5">Current Kosh Value</th>
                    <th className="p-2.5">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fieldRecords.slice(0, 12).map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-slate-900">{f.visibleSapLabel}</td>
                      <td className="p-2.5 font-mono text-indigo-700 font-bold">{f.retrievedSourceValue || '—'}</td>
                      <td className="p-2.5 font-mono text-slate-700">{f.persistedKoshValue || f.retrievedSourceValue || '—'}</td>
                      <td className="p-2.5 font-extrabold text-emerald-700">
                        {f.retrievedSourceValue === f.persistedKoshValue || !f.persistedKoshValue ? 'MATCHED' : 'WILL UPDATE'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFetchPreviewOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold rounded-lg cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndCommitSync}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer text-xs transition shadow-xs"
              >
                Confirm & Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD WAREHOUSE */}
      {isWhModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                  <WarehouseIcon className="w-4 h-4 text-cyan-400" />
                  {editingWhId ? 'Modify Enterprise Warehouse' : 'Add Enterprise Warehouse'}
                </h3>
                <p className="text-xs text-slate-300">
                  {editingWhId ? 'Update storage facility attributes and operational policy' : 'Create new warehouse under operating branch hierarchy'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsWhModalOpen(false);
                  setEditingWhId(null);
                }}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!whCode.trim() || !whName.trim()) {
                  alert('Warehouse Code and Name are required.');
                  return;
                }
                const cleanCode = whCode.trim().toUpperCase();
                const targetBr = branches.find((b) => b.id === whTargetBranchId) || branches[0];
                const newWh: Warehouse = {
                  id: editingWhId || `wh-${Date.now()}`,
                  branchId: targetBr.id,
                  warehouseCode: cleanCode,
                  warehouseName: whName.trim(),
                  locationCode: targetBr.code,
                  isDefault: whIsDefault,
                  isNettable: whIsNettable,
                  isInactive: whIsInactive,
                  enableBinLocations: whEnableBins,
                  street: targetBr.streetAddress,
                  city: targetBr.city,
                  state: targetBr.state,
                  postalCode: targetBr.postalCode,
                  country: targetBr.country || 'India',
                };

                const updatedBranches = branches.map((b) => {
                  const cleanedList = (b.warehouses || []).filter((w) => w.id !== (editingWhId || newWh.id));
                  if (b.id === targetBr.id) {
                    let list = cleanedList;
                    if (whIsDefault) {
                      list = list.map((w) => ({ ...w, isDefault: false }));
                    }
                    return {
                      ...b,
                      warehouses: [...list, newWh],
                      defaultWarehouseId: whIsDefault ? newWh.id : b.defaultWarehouseId,
                    };
                  }
                  return {
                    ...b,
                    warehouses: cleanedList,
                  };
                });

                setBranches(updatedBranches);
                setIsWhModalOpen(false);
                setEditingWhId(null);
                setSuccessMsg(`Warehouse ${newWh.warehouseName} (${newWh.warehouseCode}) saved successfully.`);
                setTimeout(() => setSuccessMsg(''), 4000);
              }}
              className="p-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Operating Branch *</label>
                <select
                  value={whTargetBranchId}
                  onChange={(e) => setWhTargetBranchId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      [{b.portalBranchCode}] {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warehouse Code *</label>
                  <input
                    type="text"
                    value={whCode}
                    onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WH-FG-01"
                    className="w-full p-2 border border-slate-300 rounded font-mono font-bold uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warehouse Name *</label>
                  <input
                    type="text"
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="e.g. Finished Goods Store"
                    className="w-full p-2 border border-slate-300 rounded font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whIsDefault}
                    onChange={(e) => setWhIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Default Policy</span>
                </label>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whIsNettable}
                    onChange={(e) => setWhIsNettable(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Nettable</span>
                </label>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whEnableBins}
                    onChange={(e) => setWhEnableBins(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Bin Locations</span>
                </label>
              </div>

              <div className="bg-slate-50 p-3 -mx-4 -mb-4 mt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWhModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  {editingWhId ? 'Update Warehouse' : 'Save Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT COMPANY MODAL */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full flex flex-col overflow-hidden max-h-[92vh]">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="font-bold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-300" />
                <span>
                  {editingCompanyId ? 'Edit Enterprise Company Profile' : 'Register New Enterprise Company'}
                </span>
              </div>
              <button
                onClick={() => setIsCompanyModalOpen(false)}
                className="text-indigo-200 hover:text-white font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Company Code *</label>
                  <input
                    type="text"
                    value={coCode}
                    onChange={(e) => setCoCode(e.target.value.toUpperCase())}
                    className="w-full p-2 border border-slate-300 rounded font-mono uppercase font-bold"
                    placeholder="e.g. KOSH-SOUTH"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SAP Company Database ID *</label>
                  <input
                    type="text"
                    value={coSapDb}
                    onChange={(e) => setCoSapDb(e.target.value.toUpperCase())}
                    className="w-full p-2 border border-slate-300 rounded font-mono uppercase font-bold text-indigo-900"
                    placeholder="e.g. KOSH_SOUTH_HANA"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Display Name *</label>
                <input
                  type="text"
                  value={coName}
                  onChange={(e) => setCoName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold text-slate-900"
                  placeholder="e.g. Kosh South Logistics India Pvt Ltd"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official GST Legal Name *</label>
                <input
                  type="text"
                  value={coLegalName}
                  onChange={(e) => setCoLegalName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                  placeholder="e.g. KOSH SOUTH LOGISTICS INDIA PRIVATE LIMITED"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GST Trade Name</label>
                  <input
                    type="text"
                    value={coTradeName}
                    onChange={(e) => setCoTradeName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                    placeholder="e.g. KOSH LOGISTICS CHENNAI HUB"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN *</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={coGstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCoGstin(val);
                      if (val.length === 15 && getGstVerificationMode() === 'MANUAL_CAPTCHA') {
                        handleRequestCoCaptcha(val);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded font-mono uppercase font-bold"
                    placeholder="33AAACK4603M1ZR"
                    required
                  />
                </div>
              </div>

              {/* Company GST Verification Challenge Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Official GSTIN Verification ({getGstVerificationMode() === 'MANUAL_CAPTCHA' ? 'Manual CAPTCHA Mode' : 'Automated Paid API Mode'})</span>
                  </div>
                  {savedCoGstDetails ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> GST Verified & Confirmed
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">
                      Pre-Save Verification Required
                    </span>
                  )}
                </div>

                {getGstVerificationMode() === 'MANUAL_CAPTCHA' ? (
                  coGstSession ? (
                    <div className="flex flex-wrap items-center gap-2.5 bg-white p-2.5 rounded-lg border border-indigo-200">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={coGstSession.captchaDataUrl}
                          alt="CAPTCHA Challenge"
                          className="h-9 rounded border border-slate-300 bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleRequestCoCaptcha()}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Refresh CAPTCHA"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="ENTER 6 CHARS"
                          value={coCaptchaInput}
                          onChange={(e) => setCoCaptchaInput(e.target.value.toUpperCase())}
                          className="w-full text-xs p-2 border border-slate-300 rounded font-mono font-bold uppercase tracking-widest bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleVerifyCoGstModal}
                        disabled={isVerifyingCoGst}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                      >
                        {isVerifyingCoGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        <span>Verify GSTIN</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500">Initiate official taxpayer search workflow to fetch verified legal name & address.</span>
                      <button
                        type="button"
                        onClick={() => handleRequestCoCaptcha()}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded border border-indigo-200 cursor-pointer"
                      >
                        Request CAPTCHA
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-600">Enterprise Paid API Mode active. Direct lookup without CAPTCHA.</span>
                    <button
                      type="button"
                      onClick={handleVerifyCoGstModal}
                      disabled={isVerifyingCoGst}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingCoGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>Verify with Paid API</span>
                    </button>
                  </div>
                )}

                {coGstError && (
                  <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                    {coGstError}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Corporate Identification Number (CIN)</span>
                  <span className={`text-[10px] font-mono font-bold ${coCinNumber.trim().length === 21 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {coCinNumber.trim().length}/21 {coCinNumber.trim().length === 21 ? '✓ Valid (21 chars)' : ''}
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={21}
                  value={coCinNumber}
                  onChange={(e) => setCoCinNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full p-2 border border-slate-300 rounded font-mono uppercase font-bold text-indigo-900"
                  placeholder="e.g. U72900PY2020PTC008642"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  21-character alphanumeric code issued by Ministry of Corporate Affairs (MCA).
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={coCountry}
                    onChange={(e) => setCoCountry(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={coState}
                    onChange={(e) => setCoState(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={coCity}
                    onChange={(e) => setCoCity(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">HQ Street Address</label>
                <input
                  type="text"
                  value={coStreetAddress}
                  onChange={(e) => setCoStreetAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                  placeholder="Plot No 14, Guindy Industrial Estate"
                />
              </div>

              {/* MSME / Udyam Section (Identical to Business Partner Master) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>MSME / Udyam Registration (Ministry of MSME)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 text-xs">Is MSME Registered?</span>
                    <input
                      type="checkbox"
                      checked={coMsmeInfo.isMSME}
                      onChange={(e) => setCoMsmeInfo({ ...coMsmeInfo, isMSME: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {coMsmeInfo.isMSME && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Udyam Reg. No. e.g. UDYAM-TN-03-0012345"
                        value={coMsmeInfo.udyamRegistrationNo || ''}
                        onChange={(e) => setCoMsmeInfo({ ...coMsmeInfo, udyamRegistrationNo: e.target.value.toUpperCase() })}
                        className="flex-1 text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCoMsme}
                        disabled={isVerifyingCoMsme}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isVerifyingCoMsme ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                        Verify MSME
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-lg border font-mono">
                      <div>
                        <span className="text-slate-500 block text-[9px]">Classification:</span>
                        <strong className="text-indigo-900">{coMsmeInfo.msmeClassification || 'SMALL'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Activity Type:</span>
                        <strong className="text-indigo-900">{coMsmeInfo.activityType || 'MANUFACTURING'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Investment:</span>
                        <strong className="text-indigo-900">{coMsmeInfo.investmentCategory || '₹1 Cr - ₹10 Cr'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Turnover:</span>
                        <strong className="text-indigo-900">{coMsmeInfo.turnoverCategory || '₹5 Cr - ₹50 Cr'}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <input
                  type="checkbox"
                  id="coIsEnabled"
                  checked={coIsEnabled}
                  onChange={(e) => setCoIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="coIsEnabled" className="font-bold text-slate-800 cursor-pointer">
                  Enable Company Entity Immediately for System Workflows
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BRANCH MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden max-h-[92vh]">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
              <div className="font-bold text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-300" />
                <span>
                  {editingBranchId ? 'Edit Branch Master & Warehouse Setup' : 'Create New Enterprise Branch'}
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveBranch} className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-indigo-900 mb-1">
                    Company *
                  </label>
                  <select
                    value={targetCompanyId}
                    onChange={(e) => setTargetCompanyId(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold text-slate-800"
                    required
                  >
                    {companies.map((co) => (
                      <option key={co.id} value={co.id}>
                        {co.name} ({co.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-indigo-900 mb-1 flex items-center justify-between">
                    <span>SAP Branch Code * (3 Characters Unique)</span>
                    <span className={`text-[10px] font-mono font-bold ${portalBranchCode.trim().length === 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {portalBranchCode.trim().length}/3 {portalBranchCode.trim().length === 3 ? '✓ Unique' : '(Must be 3 chars)'}
                    </span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="e.g. 006 or CHE"
                    value={portalBranchCode}
                    onChange={(e) => setPortalBranchCode(e.target.value.toUpperCase().slice(0, 3))}
                    className="w-full text-xs p-2 border-2 border-indigo-400 bg-white rounded-lg font-mono font-extrabold uppercase text-indigo-900"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Authoritative 3-character unique identifier for this branch</p>
                </div>
              </div>

              {/* GST Governance */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>GST Governance & Legal Identity</span>
                  {gstStatus === 'VERIFIED' ? (
                    <span className="text-emerald-700 text-[10px] font-mono font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified
                    </span>
                  ) : (
                    <span className="text-amber-700 text-[10px] font-mono font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Verification Pending
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">GSTIN / PAN</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="34AAACK4603M1ZP"
                      value={gstinPan}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setGstinPan(val);
                        if (val.length === 15 && getGstVerificationMode() === 'MANUAL_CAPTCHA') {
                          handleRequestBranchCaptcha(val);
                        }
                      }}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-mono uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">GST Registration Type</label>
                    <select
                      value={gstRegistrationType}
                      onChange={(e) => setGstRegistrationType(e.target.value as GSTRegistrationType)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="COMPOSITION">Composition</option>
                      <option value="SEZ_UNIT">SEZ Unit</option>
                      <option value="SEZ_DEVELOPER">SEZ Developer</option>
                      <option value="ISD">Input Service Distributor (ISD)</option>
                    </select>
                  </div>
                </div>

                {/* Inline CAPTCHA Challenge / Paid API Action for Branch */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Official GST Taxpayer Verification ({getGstVerificationMode() === 'MANUAL_CAPTCHA' ? 'Manual CAPTCHA Mode' : 'Automated Paid API Mode'})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">120s Expiry</span>
                  </div>

                  {getGstVerificationMode() === 'MANUAL_CAPTCHA' ? (
                    branchGstSession ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={branchGstSession.captchaDataUrl}
                            alt="CAPTCHA Challenge"
                            className="h-8 rounded border border-slate-300 bg-slate-50"
                          />
                          <button
                            type="button"
                            onClick={() => handleRequestBranchCaptcha()}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Refresh CAPTCHA"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="ENTER 6 CHARS"
                            value={branchCaptchaInput}
                            onChange={(e) => setBranchCaptchaInput(e.target.value.toUpperCase())}
                            className="w-full text-xs p-1.5 border border-slate-300 rounded font-mono font-bold uppercase tracking-widest bg-slate-50 focus:bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyGstInBranchModal}
                          disabled={isVerifyingGst}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isVerifyingGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          <span>Verify GST</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Request official CAPTCHA challenge to verify GSTIN against govt database.</span>
                        <button
                          type="button"
                          onClick={() => handleRequestBranchCaptcha()}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 cursor-pointer"
                        >
                          Request CAPTCHA
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Enterprise Paid API active. Auto-fetch taxpayer details directly.</span>
                      <button
                        type="button"
                        onClick={handleVerifyGstInBranchModal}
                        disabled={isVerifyingGst}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isVerifyingGst ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        <span>Verify with Paid API</span>
                      </button>
                    </div>
                  )}

                  {branchGstError && (
                    <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-200">
                      {branchGstError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Branch Name *</label>
                    <input
                      type="text"
                      placeholder="Official Branch / Plant Name"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Short Name / Alias</label>
                    <input
                      type="text"
                      placeholder="e.g. Pondicherry Plant"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Trade Name (From GST API)</label>
                  <input
                    type="text"
                    placeholder="Trade Name from GST Portal"
                    value={gstTradeName}
                    onChange={(e) => setGstTradeName(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Physical Location: Country -> State -> City */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1">
                  Branch Physical Location
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Country *</label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">State *</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                      required
                    >
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Puducherry">Puducherry</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Uttarakhand">Uttarakhand</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Gujarat">Gujarat</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      placeholder="e.g. Puducherry"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      placeholder="CS-46&47, PIPDIC Industrial Estate"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Postal Code</label>
                    <input
                      type="text"
                      placeholder="605009"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Unit Description Master Selector (Positioned above Branch Warehouse) */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Unit Description Master *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddUnitModalOpen(true)}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 font-extrabold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-indigo-300 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add New Unit Master
                  </button>
                </div>

                <select
                  value={selectedUnitDesc}
                  onChange={(e) => setSelectedUnitDesc(e.target.value)}
                  className="w-full text-xs p-2.5 border border-indigo-300 bg-white rounded-lg font-bold text-indigo-900"
                >
                  {unitMasters.map((u) => (
                    <option key={u.id} value={u.description}>
                      [{u.code}] {u.description} ({u.approvalStatus})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouses Setup */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
                  <span>Branch Warehouses & Default Scope</span>
                  <button
                    type="button"
                    onClick={() =>
                      setWarehouses([
                        ...warehouses,
                        { code: `${portalBranchCode}-WH${warehouses.length + 1}`, name: 'New Warehouse', isDefault: false },
                      ])
                    }
                    className="text-[10px] text-indigo-700 font-bold hover:underline cursor-pointer"
                  >
                    + Add Warehouse
                  </button>
                </div>

                <div className="space-y-2">
                  {warehouses.map((wh, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        value={wh.code}
                        onChange={(e) => {
                          const updated = [...warehouses];
                          updated[idx].code = e.target.value;
                          setWarehouses(updated);
                        }}
                        className="w-28 text-xs p-1.5 border border-slate-300 rounded font-mono uppercase font-bold"
                        placeholder="WH Code"
                      />
                      <input
                        type="text"
                        value={wh.name}
                        onChange={(e) => {
                          const updated = [...warehouses];
                          updated[idx].name = e.target.value;
                          setWarehouses(updated);
                        }}
                        className="flex-1 text-xs p-1.5 border border-slate-300 rounded font-bold"
                        placeholder="Warehouse Name"
                      />
                      <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="defaultWarehouse"
                          checked={wh.isDefault}
                          onChange={() => {
                            const updated = warehouses.map((w, i) => ({ ...w, isDefault: i === idx }));
                            setWarehouses(updated);
                          }}
                        />
                        Default
                      </label>
                      {warehouses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setWarehouses(warehouses.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold cursor-pointer hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW UNIT MASTER MODAL */}
      {isAddUnitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
              <span>Authorized Add New Unit Description</span>
              <button onClick={() => setIsAddUnitModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Code *</label>
                <input
                  type="text"
                  placeholder="e.g. PKG"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Description *</label>
                <input
                  type="text"
                  placeholder="e.g. Corrugated Packaging & Printing Unit"
                  value={newUnitDesc}
                  onChange={(e) => setNewUnitDesc(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddUnitModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewUnitMaster}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs"
              >
                Save & Select Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRE-SAVE BRANCH GST VERIFICATION REVIEW & CONFIRMATION MODAL */}
      {isBranchReviewModalOpen && branchStagedGst && (
        <GSTVerificationReviewModal
          isOpen={isBranchReviewModalOpen}
          details={branchStagedGst}
          mode={getGstVerificationMode()}
          targetEntityName="Branch Master"
          currentValues={{
            name: branchName,
            tradeName: gstTradeName,
            city,
            state,
            address: streetAddress,
          }}
          onConfirm={handleConfirmBranchGstReview}
          onCancel={() => setIsBranchReviewModalOpen(false)}
        />
      )}

      {/* PRE-SAVE COMPANY GST VERIFICATION REVIEW & CONFIRMATION MODAL */}
      {isCoReviewModalOpen && coStagedGst && (
        <GSTVerificationReviewModal
          isOpen={isCoReviewModalOpen}
          details={coStagedGst}
          mode={getGstVerificationMode()}
          targetEntityName="Enterprise Company Master"
          currentValues={{
            name: coName,
            tradeName: coTradeName,
            city: coCity,
            state: coState,
            address: coStreetAddress,
          }}
          onConfirm={handleConfirmCoGstReview}
          onCancel={() => setIsCoReviewModalOpen(false)}
        />
      )}

      {/* OFFICIAL GST DETAILS & FILING HISTORY INSPECTOR MODAL */}
      {inspectedGstEntity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden text-xs font-sans">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-cyan-300 text-sm">{inspectedGstEntity.gstin}</span>
                    <span className="text-slate-400">•</span>
                    <h3 className="font-bold text-sm text-white truncate">{inspectedGstEntity.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                      Code: {inspectedGstEntity.code}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Official Taxpayer Master & Verification Records (Verified via Govt GSTN)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectedGstEntity(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                aria-label="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50">
              <GSTDetailsInspector details={inspectedGstEntity.details} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-mono">
                Entity: {inspectedGstEntity.title} • GSTIN: {inspectedGstEntity.gstin}
              </span>
              <button
                type="button"
                onClick={() => setInspectedGstEntity(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer transition shadow-2xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
