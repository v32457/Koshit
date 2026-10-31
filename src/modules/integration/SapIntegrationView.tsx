import React, { useState, useEffect } from 'react';
import {
  SapCompanyRegistryConfig,
  SapCompanyFieldDiscoveryRecord,
  SapCompanySyncJobLog,
  SapCompanyRegistrationRequest,
  MappingDiscoveryStatus,
  User,
} from '../../types';
import {
  INITIAL_SAP_COMPANIES,
  INITIAL_SAP_DISCOVERED_FIELDS,
  INITIAL_SAP_SYNC_JOBS,
  INITIAL_SAP_REGISTRATION_REQUESTS,
} from '../../data/sapCompanyData';
import {
  Cpu,
  PlayCircle,
  Power,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Database,
  ArrowRight,
  Sliders,
  AlertOctagon,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  Edit2,
  Lock,
  Layers,
  Server,
  Globe,
  CheckSquare,
  Square,
  Clock,
  Activity,
  Zap,
  Building2,
  Plus,
  FileCheck,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';

import { OperatingContext } from '../../services/operatingContextService';
import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';

interface SapIntegrationViewProps {
  currentUser: User;
  operatingContext?: OperatingContext;
  activeTab?: 'companies' | 'requests' | 'profiles' | 'sync' | 'mapping' | 'fetch' | 'history' | 'testing' | 'activate' | 'monitor';
}

export const SapIntegrationView: React.FC<SapIntegrationViewProps> = ({
  currentUser,
  operatingContext,
  activeTab: initialTab = 'companies',
}) => {
  const [tab, setTab] = useState<
    'companies' | 'requests' | 'profiles' | 'sync' | 'mapping' | 'fetch' | 'history' | 'testing' | 'activate' | 'monitor'
  >(initialTab);

  // Persistence State
  const [companies, setCompanies] = useState<SapCompanyRegistryConfig[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_sap_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading SAP companies:', err);
    }
    return INITIAL_SAP_COMPANIES;
  });

  const [registrationRequests, setRegistrationRequests] = useState<SapCompanyRegistrationRequest[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_sap_registration_requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading SAP registration requests:', err);
    }
    return INITIAL_SAP_REGISTRATION_REQUESTS;
  });

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

  const [jobLogs, setJobLogs] = useState<SapCompanySyncJobLog[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_sap_sync_jobs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading SAP job logs:', err);
    }
    return INITIAL_SAP_SYNC_JOBS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_companies', JSON.stringify(companies));
    } catch (err) {
      console.error('Error saving SAP companies:', err);
    }
  }, [companies]);

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_registration_requests', JSON.stringify(registrationRequests));
    } catch (err) {
      console.error('Error saving SAP registration requests:', err);
    }
  }, [registrationRequests]);

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_discovered_fields', JSON.stringify(fieldRecords));
    } catch (err) {
      console.error('Error saving SAP discovered fields:', err);
    }
  }, [fieldRecords]);

  useEffect(() => {
    try {
      localStorage.setItem('kosh_sap_sync_jobs', JSON.stringify(jobLogs));
    } catch (err) {
      console.error('Error saving SAP sync jobs:', err);
    }
  }, [jobLogs]);

  // Excel / CSV Template Import & Validation States (18 Mandatory Columns)
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

  // Modal & Form States for Registration Workflow
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isReviewRequestModalOpen, setIsReviewRequestModalOpen] = useState(false);
  const [selectedReqForReview, setSelectedReqForReview] = useState<SapCompanyRegistrationRequest | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const [newReqForm, setNewReqForm] = useState({
    companyCode: '',
    companyDisplayName: '',
    legalName: '',
    gstin: '',
    sapCompanyDb: '',
    environmentId: 'PROD' as 'DEV' | 'UAT' | 'PROD',
    httpsHostname: '',
    serviceLayerPort: 50000,
    notes: '',
  });

  const handleCreateRegistrationRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const reqId = `req-sap-${Date.now().toString().slice(-4)}`;
    const newReq: SapCompanyRegistrationRequest = {
      id: reqId,
      requestNumber: `REQ-SAP-2026-${Math.floor(100 + Math.random() * 900)}`,
      companyCode: newReqForm.companyCode,
      companyDisplayName: newReqForm.companyDisplayName,
      legalName: newReqForm.legalName,
      gstin: newReqForm.gstin,
      sapCompanyDb: newReqForm.sapCompanyDb,
      environmentId: newReqForm.environmentId,
      httpsHostname: newReqForm.httpsHostname || `sap-${newReqForm.companyCode.toLowerCase()}.koshinnovations.internal`,
      serviceLayerPort: newReqForm.serviceLayerPort || 50000,
      requestedByEmail: currentUser.email,
      requestedByName: currentUser.fullName,
      requestedAt: new Date().toISOString(),
      status: 'UNDER_REVIEW',
      notes: newReqForm.notes,
    };

    setRegistrationRequests([newReq, ...registrationRequests]);
    setIsNewRequestModalOpen(false);
    setNewReqForm({
      companyCode: '',
      companyDisplayName: '',
      legalName: '',
      gstin: '',
      sapCompanyDb: '',
      environmentId: 'PROD',
      httpsHostname: '',
      serviceLayerPort: 50000,
      notes: '',
    });
    alert(`SAP Company Registration Request ${newReq.requestNumber} submitted successfully and sent to Global Kosh Admin for review.`);
  };

  const handleApproveRegistrationRequest = (req: SapCompanyRegistrationRequest) => {
    // 1. Mark request approved
    const now = new Date().toISOString();
    const configId = `kosh-sap-co-${Date.now().toString().slice(-4)}`;

    setRegistrationRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? {
              ...r,
              status: 'APPROVED',
              reviewedBy: currentUser.fullName,
              reviewedAt: now,
              configId,
            }
          : r
      )
    );

    // 2. Provision or enable Company Config in SAP Registry
    const existing = companies.find((c) => c.companyDbName === req.sapCompanyDb);
    if (!existing) {
      const newConfig: SapCompanyRegistryConfig = {
        id: configId,
        companyDbName: req.sapCompanyDb,
        companyDisplayName: req.companyDisplayName,
        environmentId: req.environmentId,
        environmentName: `${req.environmentId} Cluster`,
        serviceLayerUrl: `https://${req.httpsHostname}:${req.serviceLayerPort}/b1s/v2`,
        httpsHostname: req.httpsHostname,
        serviceLayerPort: req.serviceLayerPort,
        sapVersion: 'SAP Business One 10.0 for SAP HANA (Version 10.00.210)',
        authMethod: 'SESSION',
        credentialVaultRef: `vault://kosh-secrets/${req.sapCompanyDb.toLowerCase()}-creds`,
        connectionStatus: 'CONNECTED',
        lastConnectedAt: now,
        isEnvironmentActive: true,
        isCompanyActive: true,
        isCompanyDetailsSyncActive: true,
        createdAt: now,
        updatedAt: now,
        requestId: req.id,
      };
      setCompanies((prev) => [newConfig, ...prev]);
    } else {
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                isEnvironmentActive: true,
                isCompanyActive: true,
                isCompanyDetailsSyncActive: true,
                connectionStatus: 'CONNECTED',
                updatedAt: now,
              }
            : c
        )
      );
    }

    setIsReviewRequestModalOpen(false);
    setSelectedReqForReview(null);
    alert(`Registration Request ${req.requestNumber} APPROVED by Global Kosh Admin. SAP Company ${req.sapCompanyDb} is now active in Company Registry.`);
  };

  const handleRejectRegistrationRequest = (req: SapCompanyRegistrationRequest) => {
    if (!rejectionNotes.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }

    const now = new Date().toISOString();
    setRegistrationRequests((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? {
              ...r,
              status: 'REJECTED',
              reviewedBy: currentUser.fullName,
              reviewedAt: now,
              rejectionReason: rejectionNotes,
            }
          : r
      )
    );

    setIsReviewRequestModalOpen(false);
    setSelectedReqForReview(null);
    setRejectionNotes('');
    alert(`Registration Request ${req.requestNumber} REJECTED.`);
  };

  // Selected Context
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || 'kosh-sap-co-01');
  const activeCompany = companies.find((c) => c.id === selectedCompanyId) || companies[0];

  // Mapping Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTabFilter, setSelectedTabFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isEditMappingModalOpen, setIsEditMappingModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SapCompanyFieldDiscoveryRecord | null>(null);
  const [isFetchPreviewOpen, setIsFetchPreviewOpen] = useState(false);

  // Diagnostic / Testing State
  const [testingCompanyId, setTestingCompanyId] = useState<string | null>(null);
  const [testResultFeedback, setTestResultFeedback] = useState<string>('');
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  // Independent Activation Controls (Section 4)
  const handleToggleEnvironmentActive = (coId: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === coId) {
          const nextVal = !c.isEnvironmentActive;
          return { ...c, isEnvironmentActive: nextVal, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );
  };

  const handleToggleCompanyActive = (coId: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === coId) {
          const nextVal = !c.isCompanyActive;
          return { ...c, isCompanyActive: nextVal, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );
  };

  const handleToggleCompanyDetailsSyncActive = (coId: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === coId) {
          const nextVal = !c.isCompanyDetailsSyncActive;
          return { ...c, isCompanyDetailsSyncActive: nextVal, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );
  };

  // Test Connection Handler (Section 5)
  const handleTestConnection = (co: SapCompanyRegistryConfig) => {
    setTestingCompanyId(co.id);
    setTestResultFeedback('');

    setTimeout(() => {
      setTestingCompanyId(null);
      if (!co.isEnvironmentActive || !co.isCompanyActive) {
        setTestResultFeedback(
          `CONNECTION BLOCKED: Environment or Company is currently INACTIVE. Enable activation controls first.`
        );
        return;
      }

      setCompanies((prev) =>
        prev.map((c) => (c.id === co.id ? { ...c, connectionStatus: 'CONNECTED', lastConnectedAt: new Date().toISOString() } : c))
      );

      setTestResultFeedback(
        `SUCCESS: HTTPS TLS Handshake & Authentication verified for ${co.companyDbName} (${co.httpsHostname}:${co.serviceLayerPort}). Service Layer /b1s/v2/CompanyService_GetAdminInfo returned HTTP 200 OK.`
      );
    }, 1000);
  };

  // Fetch Company Details Action (Section 9)
  const handleTriggerFetchCompanyDetails = () => {
    if (!activeCompany.isEnvironmentActive || !activeCompany.isCompanyActive || !activeCompany.isCompanyDetailsSyncActive) {
      alert(
        'FETCH BLOCKED: All three activation controls (Environment, Company, and Company Details Sync) MUST be ACTIVE before executing a fetch job.'
      );
      return;
    }

    setIsFetchingDetails(true);
    setTimeout(() => {
      setIsFetchingDetails(false);
      setIsFetchPreviewOpen(true);
    }, 1200);
  };

  const handleConfirmAndImportFetch = () => {
    const now = new Date().toISOString();
    const correlationId = `corr-sap-sync-${Date.now().toString().slice(-6)}`;

    // Update Companies last import
    setCompanies((prev) =>
      prev.map((c) => (c.id === activeCompany.id ? { ...c, lastSuccessfulImportAt: now } : c))
    );

    // Create Sync Job Record
    const newJob: SapCompanySyncJobLog = {
      id: `job-${Date.now()}`,
      jobCorrelationId: correlationId,
      companyConfigId: activeCompany.id,
      environmentId: activeCompany.environmentId,
      operationType: 'FETCH_COMPANY_DETAILS',
      startedAt: now,
      finishedAt: now,
      durationMs: 2450,
      triggeredBy: currentUser.fullName,
      discoveredFieldsCount: fieldRecords.length,
      mappedFieldsCount: fieldRecords.filter((f) => f.discoveryStatus === 'MAPPED' || f.discoveryStatus === 'VALIDATED').length,
      importedFieldsCount: fieldRecords.length - 4,
      updatedFieldsCount: 2,
      unchangedFieldsCount: fieldRecords.length - 6,
      skippedFieldsCount: 0,
      unsupportedFieldsCount: 4,
      failedFieldsCount: 0,
      status: 'COMPLETED',
      sanitizedDiagnosticMessage: `Company Details & AdminInfo imported cleanly from ${activeCompany.companyDbName} over Service Layer HTTPS.`,
    };

    setJobLogs([newJob, ...jobLogs]);
    setIsFetchPreviewOpen(false);
    alert(`Company Details Fetch & Reconciliation Completed Successfully. Job ID: ${correlationId}`);
  };

  // Edit Mapping Record
  const handleOpenEditMapping = (rec: SapCompanyFieldDiscoveryRecord) => {
    setEditingRecord(rec);
    setIsEditMappingModalOpen(true);
  };

  const handleSaveMappingRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setFieldRecords((prev) =>
      prev.map((f) => (f.id === editingRecord.id ? { ...editingRecord, lastVerifiedAt: new Date().toISOString() } : f))
    );
    setIsEditMappingModalOpen(false);
  };

  // Download 18-Column Mandatory Excel / CSV Mapping Template
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
    a.download = `SAP_B1_HANA_Mapping_Template_18Col.csv`;
    a.click();
  };

  // Export 18-Column Complete Field Mappings CSV
  const handleExport18ColTemplate = () => {
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
    const rows = fieldRecords.map((r) => [
      r.id,
      r.tabName,
      r.visibleSapLabel,
      r.technicalPropertyName,
      r.technicalResource || 'CompanyService_GetAdminInfo',
      r.isReadOnlyInSap ? 'Read-Only' : 'Read/Write',
      r.koshTargetEntity,
      r.koshTargetProperty,
      r.targetDataType || r.sapDataType || 'string',
      r.isRequired ? 'true' : 'false',
      'VALIDATED',
      r.mappingTransformation || 'NONE',
      '',
      'SAP_TO_KOSH',
      r.discoveryStatus,
      '15m',
      r.retrievedSourceValue || '',
      r.verificationEvidence || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_B1_Company_Field_Mappings_18Col_${activeCompany.companyDbName}.csv`;
    a.click();
  };

  // Dry-Run Validation on Uploaded Text/CSV
  const handleRunValidationPreview = (text: string) => {
    setImportFileText(text);
    const lines = text.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      alert('CSV file does not contain enough data rows.');
      return;
    }

    const dataLines = lines.slice(1);
    let newCount = 0;
    let updateCount = 0;
    let invalidCount = 0;
    let unsupportedCount = 0;

    const parsedRows = dataLines.map((line, idx) => {
      // Split by comma ignoring commas inside quotes
      const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim());
      const recId = cells[0] || `rec-imported-${idx + 1}`;
      const sapTab = cells[1] || 'General';
      const screenLabel = cells[2] || '';
      const techProp = cells[3] || '';
      const koshEntity = cells[6] || 'ORGANIZATION';
      const targetField = cells[7] || '';

      const isInvalid = !screenLabel || !techProp;
      const isUnsupported = techProp.toLowerCase().includes('unknown') || techProp.toLowerCase().includes('custom_udf');

      const existingMatch = fieldRecords.find(
        (f) => f.technicalPropertyName.toLowerCase() === techProp.toLowerCase() || f.visibleSapLabel.toLowerCase() === screenLabel.toLowerCase()
      );

      if (isInvalid) {
        invalidCount++;
      } else if (isUnsupported) {
        unsupportedCount++;
      } else if (existingMatch) {
        updateCount++;
      } else {
        newCount++;
      }

      return {
        id: existingMatch ? existingMatch.id : recId,
        tabName: sapTab,
        visibleSapLabel: screenLabel,
        technicalPropertyName: techProp,
        sapObjectType: cells[4] || 'CompanyService_GetAdminInfo',
        apiAccess: (cells[5] || 'Read-Only') as any,
        koshTargetEntity: koshEntity,
        koshTargetProperty: targetField,
        dataType: cells[8] || 'string',
        isMandatory: cells[9] === 'true',
        validationRule: cells[10] || 'NONE',
        transformFunction: cells[11] || 'NONE',
        defaultValue: cells[12] || '',
        syncDirection: (cells[13] || 'SAP_TO_KOSH') as any,
        discoveryStatus: (cells[14] || 'VALIDATED') as any,
        retrievedSourceValue: cells[16] || '',
        notes: cells[17] || 'Imported via 18-column Excel template',
        actionType: isInvalid ? 'INVALID' : isUnsupported ? 'UNSUPPORTED' : existingMatch ? 'UPDATE' : 'NEW',
      };
    });

    setImportPreviewData({
      total: parsedRows.length,
      newCount,
      updateCount,
      invalidCount,
      unsupportedCount,
      rows: parsedRows,
    });
  };

  // Commit Verified Mappings to State, LocalStorage & Audit Log
  const handleCommitImportMappings = () => {
    if (!importPreviewData) return;

    const validRows = importPreviewData.rows.filter((r) => r.actionType === 'NEW' || r.actionType === 'UPDATE');
    const updatedMap = new Map<string, SapCompanyFieldDiscoveryRecord>();

    // Seed existing
    fieldRecords.forEach((f) => updatedMap.set(f.technicalPropertyName.toLowerCase(), f));

    // Overwrite or add
    validRows.forEach((r) => {
      const existing = updatedMap.get(r.technicalPropertyName.toLowerCase());
      const mergedRecord: SapCompanyFieldDiscoveryRecord = {
        id: existing ? existing.id : `sf-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
        companyConfigId: activeCompany.id,
        environmentId: activeCompany.environmentId,
        tabName: (existing?.tabName || 'GENERAL_LOCAL') as any,
        subsectionName: existing?.subsectionName || 'General Administration',
        visibleSapLabel: r.visibleSapLabel,
        technicalResource: r.sapObjectType || 'CompanyService_GetAdminInfo',
        technicalPropertyName: r.technicalPropertyName,
        sapDataType: (existing?.sapDataType || 'Alphanumeric') as any,
        fieldLength: existing?.fieldLength || 100,
        isReadable: true,
        isWritable: false,
        koshTargetEntity: r.koshTargetEntity,
        koshTargetProperty: r.koshTargetProperty,
        targetDataType: r.dataType,
        mappingTransformation: r.transformFunction,
        isRequired: r.isMandatory,
        isReadOnlyInSap: true,
        discoveryStatus: r.discoveryStatus,
        lastVerifiedAt: new Date().toISOString(),
        retrievedSourceValue: r.retrievedSourceValue || (existing ? existing.retrievedSourceValue : ''),
        persistedKoshValue: existing?.persistedKoshValue || '',
        verificationEvidence: r.notes,
      };
      updatedMap.set(r.technicalPropertyName.toLowerCase(), mergedRecord);
    });

    const newRecordsList = Array.from(updatedMap.values());
    setFieldRecords(newRecordsList);
    localStorage.setItem('kosh_sap_discovered_fields', JSON.stringify(newRecordsList));

    // Create Audit Job Log Entry
    const auditJob: SapCompanySyncJobLog = {
      id: `job-import-${Date.now()}`,
      jobCorrelationId: `corr-tmpl-import-${Date.now().toString().slice(-6)}`,
      companyConfigId: activeCompany.id,
      environmentId: activeCompany.environmentId,
      operationType: 'MAPPING_RECONCILIATION',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1420,
      triggeredBy: currentUser.fullName,
      discoveredFieldsCount: newRecordsList.length,
      mappedFieldsCount: newRecordsList.filter((f) => f.discoveryStatus === 'MAPPED' || f.discoveryStatus === 'VALIDATED').length,
      importedFieldsCount: validRows.length,
      updatedFieldsCount: importPreviewData.updateCount,
      unchangedFieldsCount: newRecordsList.length - validRows.length,
      skippedFieldsCount: importPreviewData.invalidCount,
      unsupportedFieldsCount: importPreviewData.unsupportedCount,
      failedFieldsCount: 0,
      status: 'COMPLETED',
      sanitizedDiagnosticMessage: `Excel 18-Column Template committed successfully. ${importPreviewData.newCount} new fields created, ${importPreviewData.updateCount} fields updated.`,
    };

    setJobLogs([auditJob, ...jobLogs]);
    setIsExcelImportModalOpen(false);
    setImportPreviewData(null);
    setImportFeedback(`Successfully imported and committed ${validRows.length} mappings into SAP B1 HANA registry.`);
    setTimeout(() => setImportFeedback(''), 6000);
  };

  // Export JSON Mappings
  const handleExportMappingsJson = () => {
    const jsonStr = JSON.stringify(fieldRecords, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_B1_Company_Field_Mappings_${activeCompany.companyDbName}.json`;
    a.click();
  };

  // Filtered Field Records
  const filteredFieldRecords = fieldRecords.filter((rec) => {
    const matchesTab = selectedTabFilter === 'ALL' || rec.tabName === selectedTabFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || rec.discoveryStatus === selectedStatusFilter;
    const matchesSearch =
      rec.visibleSapLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.technicalPropertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.koshTargetEntity.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {operatingContext && <ContextIndicatorBar context={operatingContext} compact={true} />}

      {/* Section 1: Page Header with Requested 3 Buttons: Fetch Company Details, Import Mapping Template, Export Mapping Template */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            SAP Integration Management (B1 HANA)
          </h2>
          <p className="text-slate-500 mt-0.5">
            Multi-Company Architecture, Company Details Discovery, 82 Screenshot Field Mappings & Service Layer Sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerFetchCompanyDetails}
            disabled={isFetchingDetails}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingDetails ? 'animate-spin' : ''}`} />
            {isFetchingDetails ? 'Fetching SAP Details...' : 'Fetch Company Details'}
          </button>

          <button
            onClick={() => {
              setImportPreviewData(null);
              setIsExcelImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold border border-slate-300 shadow-xs cursor-pointer transition"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Import Mapping Template</span>
          </button>

          <button
            onClick={handleExport18ColTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold border border-slate-300 shadow-xs cursor-pointer transition"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Mapping Template</span>
          </button>
        </div>
      </div>

      {importFeedback && (
        <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{importFeedback}</span>
        </div>
      )}

      {testResultFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
            testResultFeedback.startsWith('SUCCESS')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{testResultFeedback}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-medium border border-slate-200 flex-wrap">
        <button
          onClick={() => setTab('companies')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'companies' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-cyan-600" />
          Multi-Company Directory ({companies.length})
        </button>

        <button
          onClick={() => setTab('requests')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'requests' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5 text-amber-500" />
          Registration Requests ({registrationRequests.filter((r) => r.status === 'UNDER_REVIEW').length} Pending)
        </button>

        <button
          onClick={() => setTab('profiles')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'profiles' ? 'bg-white text-indigo-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-indigo-600" />
          Connection Profiles & Schedules
        </button>

        <button
          onClick={() => setTab('sync')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
            tab === 'sync' || tab === 'mapping' || tab === 'fetch' || tab === 'history'
              ? 'bg-white text-indigo-700 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
          Data Sync & Discovery Matrix ({fieldRecords.length})
        </button>
      </div>

      {/* TAB 1: COMPANY REGISTRY & INDEPENDENT ACTIVATION CONTROLS */}
      {tab === 'companies' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companies.map((co) => {
              const isFullyActive = co.isEnvironmentActive && co.isCompanyActive && co.isCompanyDetailsSyncActive;
              return (
                <div key={co.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{co.companyDisplayName}</div>
                      <div className="text-[11px] font-mono text-indigo-700 font-bold mt-0.5">{co.companyDbName}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                        {co.environmentId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleCompanyActive(co.id)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                          co.isCompanyActive
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 shadow-2xs'
                            : 'bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100 shadow-2xs'
                        }`}
                        title={co.isCompanyActive ? 'Company Active • Click to Disable' : 'Company Disabled • Click to Enable'}
                        aria-label="Toggle Company Active"
                      >
                        <Power className={`w-3.5 h-3.5 ${co.isCompanyActive ? 'text-emerald-600' : 'text-rose-500'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px] font-mono space-y-1">
                    <div>Endpoint: {co.httpsHostname}:{co.serviceLayerPort}</div>
                    <div>Version: {co.sapVersion || '10.0 HANA'}</div>
                    <div className="flex items-center gap-1 font-bold text-emerald-700 mt-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Status: {co.connectionStatus}
                    </div>
                  </div>

                  {/* Independent Activation Controls */}
                  <div className="p-2.5 bg-slate-100/70 rounded-lg border border-slate-200 space-y-2">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3 h-3 text-indigo-500" />
                        Independent Activation Controls
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Isolated Scope</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                      {/* Control 1: Env / Database Status */}
                      <div className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-800 truncate">Env / Database Status</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${co.isEnvironmentActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className={`text-[10px] font-bold ${co.isEnvironmentActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {co.isEnvironmentActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleEnvironmentActive(co.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            co.isEnvironmentActive ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          title={co.isEnvironmentActive ? 'Click to deactivate Env / Database Status' : 'Click to activate Env / Database Status'}
                          aria-label="Toggle Env / Database Status"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              co.isEnvironmentActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Control 2: Data Sync / Integration */}
                      <div className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <div className="text-[11px] font-bold text-slate-800 truncate">Data Sync / Integration</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${co.isCompanyDetailsSyncActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className={`text-[10px] font-bold ${co.isCompanyDetailsSyncActive ? 'text-emerald-700' : 'text-amber-600'}`}>
                              {co.isCompanyDetailsSyncActive ? 'Active' : 'Paused'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleCompanyDetailsSyncActive(co.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            co.isCompanyDetailsSyncActive ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          title={co.isCompanyDetailsSyncActive ? 'Click to pause Data Sync / Integration' : 'Click to activate Data Sync / Integration'}
                          aria-label="Toggle Data Sync / Integration"
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              co.isCompanyDetailsSyncActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleTestConnection(co)}
                        disabled={testingCompanyId === co.id}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-800 border border-slate-200 font-bold rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1 transition"
                      >
                        {testingCompanyId === co.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-indigo-600" />}
                        <span>Test Connection</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCompanyId(co.id);
                          setTab('mapping');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-800 border border-slate-200 font-bold rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-600" />
                        <span>View / Edit Mappings</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCompanyId(co.id);
                          setTab('profiles');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-800 border border-slate-200 font-bold rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1 transition"
                      >
                        <Database className="w-3.5 h-3.5 text-amber-600" />
                        <span>Connection Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedCompanyId(co.id);
                          setTab('sync');
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-800 border border-slate-200 font-bold rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data Sync & Matrix</span>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCompanyId(co.id);
                        setImportPreviewData(null);
                        setIsExcelImportModalOpen(true);
                      }}
                      className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] border border-indigo-200 cursor-pointer flex items-center justify-center gap-1.5 transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Import Mapping Template (Excel / CSV)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: REGISTRATION REQUESTS & APPROVALS (STEPS 1-8) */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-500" />
                SAP Company Registration Requests & Approval Workflow
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Company Administrators submit registration requests. Global Kosh Admin reviews and approves prior to connection setup.
              </p>
            </div>

            <button
              onClick={() => setIsNewRequestModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer text-xs"
            >
              <Plus className="w-4 h-4" />
              New Registration Request
            </button>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                    <th className="p-3.5">Req #</th>
                    <th className="p-3.5">Company & DB Name</th>
                    <th className="p-3.5">Legal Name / GSTIN</th>
                    <th className="p-3.5">Environment & Host</th>
                    <th className="p-3.5">Requested By</th>
                    <th className="p-3.5">Request Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrationRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono font-bold text-indigo-700">{req.requestNumber}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{req.companyDisplayName}</div>
                        <div className="text-[10px] font-mono text-indigo-800 font-bold">{req.sapCompanyDb}</div>
                      </td>
                      <td className="p-3.5 text-slate-700">
                        <div className="font-medium">{req.legalName}</div>
                        <div className="text-[10px] font-mono text-slate-500">GSTIN: {req.gstin || 'N/A'}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border">
                          {req.environmentId}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {req.httpsHostname}:{req.serviceLayerPort}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-700">
                        <div>{req.requestedByName}</div>
                        <div className="text-[10px] text-slate-400">{new Date(req.requestedAt).toLocaleDateString()}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : req.status === 'UNDER_REVIEW'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {req.status === 'UNDER_REVIEW' ? (
                          <button
                            onClick={() => {
                              setSelectedReqForReview(req);
                              setIsReviewRequestModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold rounded cursor-pointer text-xs"
                          >
                            Review & Approve
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CREATION & SCHEDULING (PROFILES) */}
      {tab === 'profiles' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">SAP Business One HANA Connection & Scheduling Profile</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${activeCompany.isCompanyDetailsSyncActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                    SYNC: {activeCompany.isCompanyDetailsSyncActive ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  Select target company database profile, Service Layer connection parameters, and automated synchronization triggers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleCompanyDetailsSyncActive(activeCompany.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition ${
                    activeCompany.isCompanyDetailsSyncActive
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {activeCompany.isCompanyDetailsSyncActive ? 'Emergency Suspend Sync' : 'Enable Automated Sync'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Target SAP Company Database</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full text-xs p-2.5 border-2 border-indigo-400 bg-white rounded-lg font-mono font-extrabold text-indigo-900"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.environmentId}] {c.companyDbName} — {c.companyDisplayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Profile Display Name</label>
                <input
                  type="text"
                  readOnly
                  value={`${activeCompany.companyDisplayName} Connection Profile`}
                  className="w-full text-xs p-2.5 border border-slate-300 bg-slate-100 rounded-lg font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Environment Scope</label>
                <input
                  type="text"
                  readOnly
                  value={`${activeCompany.environmentId} — ${activeCompany.environmentName}`}
                  className="w-full text-xs p-2.5 border border-slate-300 bg-slate-100 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Layer Base URL Endpoint</label>
                <input
                  type="text"
                  readOnly
                  value={activeCompany.serviceLayerUrl}
                  className="w-full text-xs p-2.5 border border-slate-300 bg-slate-100 rounded-lg font-mono font-bold text-indigo-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Credential Vault Secret Reference</label>
                <input
                  type="text"
                  readOnly
                  value={activeCompany.credentialVaultRef}
                  className="w-full text-xs p-2.5 border border-slate-300 bg-slate-100 rounded-lg font-mono text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Execution Schedule</label>
                <select className="w-full text-xs p-2 border border-slate-300 bg-white rounded-lg font-bold">
                  <option value="15">Every 15 Minutes (Near Real-Time)</option>
                  <option value="60">Hourly Sync</option>
                  <option value="1440">Daily Midnight Batch</option>
                  <option value="MANUAL">Manual Trigger Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Timezone Scope</label>
                <input
                  type="text"
                  readOnly
                  value="Asia/Kolkata (IST)"
                  className="w-full text-xs p-2 border border-slate-300 bg-slate-100 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Scheduler Status</label>
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active (Next run in 12 mins)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONSOLIDATED DATA SYNC & FIELD DISCOVERY MATRIX */}
      {tab === 'sync' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                SAP Data Sync & Discovery Matrix ({fieldRecords.length} Fields)
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Execute Service Layer data pulls (Company Details, Business Partners, Warehouses, Items) and verify field mapping status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMappingsJson}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Export Matrix
              </button>

              <button
                onClick={handleTriggerFetchCompanyDetails}
                disabled={isFetchingDetails}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs cursor-pointer text-xs transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingDetails ? 'animate-spin' : ''}`} />
                {isFetchingDetails ? 'Fetching Details...' : 'Execute Data Pull & Sync'}
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Label or API Property..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:outline-none font-medium"
                />
              </div>

              <select
                value={selectedTabFilter}
                onChange={(e) => setSelectedTabFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
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
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Mapping Statuses</option>
                <option value="VALIDATED">Validated</option>
                <option value="MAPPED">Mapped</option>
                <option value="UNSUPPORTED_BY_CURRENT_API">Unsupported by API</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                    <th className="p-3.5">Visible SAP Screen Label</th>
                    <th className="p-3.5">SAP API Property</th>
                    <th className="p-3.5">API Access</th>
                    <th className="p-3.5">Retrieved Source Value</th>
                    <th className="p-3.5">Kosh Target Field</th>
                    <th className="p-3.5">Transformation</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFieldRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-slate-900">
                        <div>{rec.visibleSapLabel}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{rec.subsectionName}</div>
                      </td>
                      <td className="p-3.5 font-mono text-indigo-700 font-bold">
                        <div>{rec.technicalPropertyName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{rec.technicalResource}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                          {rec.isReadable ? (rec.isWritable ? 'Read / Write' : 'Read-Only') : 'No Access'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {rec.retrievedSourceValue || '—'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {rec.koshTargetEntity}.{rec.koshTargetProperty}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {rec.mappingTransformation || 'Direct'}
                      </td>
                      <td className="p-3.5">
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
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenEditMapping(rec)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
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
        </div>
      )}

      {/* TAB 2: FIELD DISCOVERY & MAPPING MATRIX */}
      {tab === 'mapping' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Label or API Property..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedTabFilter}
                  onChange={(e) => setSelectedTabFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
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
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VALIDATED">Validated</option>
                  <option value="MAPPED">Mapped</option>
                  <option value="UNSUPPORTED_BY_CURRENT_API">Unsupported by API</option>
                </select>
              </div>

              <button
                onClick={handleExport18ColTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer text-xs"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                    <th className="p-3.5">Visible SAP Screen Label</th>
                    <th className="p-3.5">SAP Technical Field / API Property</th>
                    <th className="p-3.5">API Access</th>
                    <th className="p-3.5">Retrieved Source Value</th>
                    <th className="p-3.5">Kosh Target Field</th>
                    <th className="p-3.5">Transformation</th>
                    <th className="p-3.5">Mapping Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFieldRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-slate-900">
                        <div>{rec.visibleSapLabel}</div>
                        <div className="text-[10px] text-slate-500 font-normal">{rec.subsectionName}</div>
                      </td>
                      <td className="p-3.5 font-mono text-indigo-700 font-bold">
                        <div>{rec.technicalPropertyName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{rec.technicalResource}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                          {rec.isReadable ? (rec.isWritable ? 'Read / Write' : 'Read-Only') : 'No Access'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {rec.retrievedSourceValue || '—'}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {rec.koshTargetEntity}.{rec.koshTargetProperty}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600">
                        {rec.mappingTransformation || 'Direct'}
                      </td>
                      <td className="p-3.5">
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
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenEditMapping(rec)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer"
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
        </div>
      )}

      {/* TAB 3: FETCH & RECONCILIATION PREVIEW */}
      {tab === 'fetch' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">SAP Company Details Fetch & Reconciliation</h3>
              <p className="text-slate-500">
                Queries Service Layer `/b1s/v2/CompanyService_GetAdminInfo` and compares retrieved values with Kosh database records.
              </p>
            </div>

            <button
              onClick={handleTriggerFetchCompanyDetails}
              disabled={isFetchingDetails}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingDetails ? 'animate-spin' : ''}`} />
              {isFetchingDetails ? 'Fetching Details...' : 'Execute Details Fetch'}
            </button>
          </div>

          <div className="p-3 bg-slate-50 border rounded-xl space-y-2 font-mono">
            <div className="font-bold text-slate-900 text-xs">Active Target Scope:</div>
            <div>Company: <strong className="text-indigo-900">{activeCompany.companyDisplayName}</strong> ({activeCompany.companyDbName})</div>
            <div>Environment: <strong className="text-indigo-900">{activeCompany.environmentName}</strong></div>
            <div>Last Sync: {activeCompany.lastSuccessfulImportAt ? new Date(activeCompany.lastSuccessfulImportAt).toLocaleString() : 'Never'}</div>
          </div>
        </div>
      )}

      {/* TAB 4: SYNC EXECUTION HISTORY */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">Sync Execution Logs & Audit History</h3>
            <p className="text-slate-500">Correlation ID tracking, field metric counts, and sanitized Service Layer execution reports.</p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                  <th className="p-3.5">Correlation ID</th>
                  <th className="p-3.5">Operation</th>
                  <th className="p-3.5">Target Company</th>
                  <th className="p-3.5">Discovered / Mapped / Imported</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">{log.jobCorrelationId}</td>
                    <td className="p-3.5 font-bold text-slate-900">{log.operationType}</td>
                    <td className="p-3.5 font-mono text-slate-700">{log.companyConfigId}</td>
                    <td className="p-3.5 font-mono font-bold">
                      {log.discoveredFieldsCount} Discovered / {log.mappedFieldsCount} Mapped / {log.importedFieldsCount} Imported
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW REGISTRATION REQUEST MODAL (STEP 2) */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateRegistrationRequest} className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Submit SAP Company Registration Request
              </h3>
              <button type="button" onClick={() => setIsNewRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Short Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KOSH-CHN"
                  value={newReqForm.companyCode}
                  onChange={(e) => setNewReqForm({ ...newReqForm, companyCode: e.target.value.toUpperCase() })}
                  className="w-full text-xs p-2 border rounded font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">SAP Database Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KOSH_CHN_HANA"
                  value={newReqForm.sapCompanyDb}
                  onChange={(e) => setNewReqForm({ ...newReqForm, sapCompanyDb: e.target.value.toUpperCase() })}
                  className="w-full text-xs p-2 border rounded font-mono font-bold text-indigo-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Display Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kosh Chennai Automotive Components Unit"
                value={newReqForm.companyDisplayName}
                onChange={(e) => setNewReqForm({ ...newReqForm, companyDisplayName: e.target.value })}
                className="w-full text-xs p-2 border rounded font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Legal Name</label>
                <input
                  type="text"
                  placeholder="KOSH INNOVATIONS PRIVATE LIMITED"
                  value={newReqForm.legalName}
                  onChange={(e) => setNewReqForm({ ...newReqForm, legalName: e.target.value })}
                  className="w-full text-xs p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  placeholder="33AAACK4603M1ZC"
                  value={newReqForm.gstin}
                  onChange={(e) => setNewReqForm({ ...newReqForm, gstin: e.target.value.toUpperCase() })}
                  className="w-full text-xs p-2 border rounded font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Environment *</label>
                <select
                  value={newReqForm.environmentId}
                  onChange={(e) => setNewReqForm({ ...newReqForm, environmentId: e.target.value as any })}
                  className="w-full text-xs p-2 border rounded font-bold"
                >
                  <option value="PROD">PROD</option>
                  <option value="UAT">UAT</option>
                  <option value="DEV">DEV</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">HTTPS Hostname</label>
                <input
                  type="text"
                  placeholder="sap-chn.koshinnovations.internal"
                  value={newReqForm.httpsHostname}
                  onChange={(e) => setNewReqForm({ ...newReqForm, httpsHostname: e.target.value })}
                  className="w-full text-xs p-2 border rounded font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Justification</label>
              <textarea
                rows={2}
                placeholder="Business rationale for adding this company database integration..."
                value={newReqForm.notes}
                onChange={(e) => setNewReqForm({ ...newReqForm, notes: e.target.value })}
                className="w-full text-xs p-2 border rounded"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsNewRequestModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded cursor-pointer"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REVIEW & APPROVE REGISTRATION REQUEST MODAL (STEP 3) */}
      {isReviewRequestModalOpen && selectedReqForReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Global Admin Approval — {selectedReqForReview.requestNumber}
              </h3>
              <button onClick={() => setIsReviewRequestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1 font-mono">
              <div>Company Name: <strong className="text-slate-900">{selectedReqForReview.companyDisplayName}</strong></div>
              <div>SAP DB Name: <strong className="text-indigo-900">{selectedReqForReview.sapCompanyDb}</strong></div>
              <div>Legal Name / GSTIN: {selectedReqForReview.legalName} ({selectedReqForReview.gstin || 'N/A'})</div>
              <div>Environment & Endpoint: {selectedReqForReview.environmentId} ({selectedReqForReview.httpsHostname}:{selectedReqForReview.serviceLayerPort})</div>
              <div>Requested By: {selectedReqForReview.requestedByName} ({selectedReqForReview.requestedByEmail})</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason (Required only if rejecting)</label>
              <textarea
                rows={2}
                placeholder="Specify reason if rejecting registration request..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                className="w-full text-xs p-2 border rounded"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => handleRejectRegistrationRequest(selectedReqForReview)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Reject Request
              </button>

              <button
                onClick={() => handleApproveRegistrationRequest(selectedReqForReview)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Approve & Provision Company
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FIELD MAPPING MODAL */}
      {isEditMappingModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Edit Field Mapping Rule</h3>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Visible SAP Screen Label</label>
              <input type="text" readOnly disabled value={editingRecord.visibleSapLabel} className="w-full text-xs p-2 bg-slate-100 border rounded font-bold" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Technical SAP API Property</label>
              <input type="text" readOnly disabled value={editingRecord.technicalPropertyName} className="w-full text-xs p-2 bg-slate-100 border rounded font-mono font-bold text-indigo-800" />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Kosh Target Entity & Property *</label>
              <input
                type="text"
                value={`${editingRecord.koshTargetEntity}.${editingRecord.koshTargetProperty}`}
                onChange={(e) => {
                  const parts = e.target.value.split('.');
                  setEditingRecord({
                    ...editingRecord,
                    koshTargetEntity: parts[0] || 'BRANCH',
                    koshTargetProperty: parts[1] || 'customProperty',
                  });
                }}
                className="w-full text-xs p-2 border rounded font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transformation Rule</label>
              <input
                type="text"
                value={editingRecord.mappingTransformation || 'Direct'}
                onChange={(e) => setEditingRecord({ ...editingRecord, mappingTransformation: e.target.value })}
                className="w-full text-xs p-2 border rounded font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setIsEditMappingModalOpen(false)} className="px-3 py-1.5 bg-slate-100 font-bold rounded cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveMappingRecord} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded cursor-pointer">
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FETCH & RECONCILIATION PREVIEW MODAL */}
      {isFetchPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border max-w-3xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">
              Reconciliation Preview: SAP Retrieved Values vs Kosh Database
            </h3>

            <div className="overflow-y-auto flex-1 border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b font-bold text-slate-600">
                    <th className="p-2.5">Visible SAP Field</th>
                    <th className="p-2.5">Retrieved SAP Value</th>
                    <th className="p-2.5">Current Kosh Value</th>
                    <th className="p-2.5">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fieldRecords.map((f) => (
                    <tr key={f.id}>
                      <td className="p-2.5 font-bold text-slate-900">{f.visibleSapLabel}</td>
                      <td className="p-2.5 font-mono text-indigo-700 font-bold">{f.retrievedSourceValue || '—'}</td>
                      <td className="p-2.5 font-mono text-slate-700">{f.persistedKoshValue || '—'}</td>
                      <td className="p-2.5 font-extrabold text-emerald-700">
                        {f.retrievedSourceValue === f.persistedKoshValue ? 'MATCHED' : 'WILL UPDATE'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsFetchPreviewOpen(false)} className="px-4 py-2 bg-slate-100 font-bold rounded cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmAndImportFetch} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded cursor-pointer">
                Confirm & Persist Import
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EXCEL / CSV MAPPING TEMPLATE IMPORT & DRY-RUN VALIDATION MODAL */}
      {isExcelImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  Excel Mapping Template Import & Dry-Run Validation (18 Mandatory Columns)
                </h3>
                <p className="text-xs text-slate-300">
                  Target Company: <strong className="text-white font-mono">{activeCompany.companyDisplayName}</strong> ({activeCompany.companyDbName})
                </p>
              </div>
              <button
                onClick={() => setIsExcelImportModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Template Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-indigo-900">
                <div>
                  <div className="font-bold">18 Mandatory Columns Specification:</div>
                  <div className="text-[10px] font-mono text-indigo-700 mt-0.5">
                    Record Id, SAP Tab Name, Visible Screen Label, Technical Property Name, SAP Object Type, API Access, Kosh Target Entity, Target Field, Data Type, Mandatory, Validation Rule, Transform Function, Default Value, Sync Direction, Discovery Status, Sync Frequency, Last Retrieved Value, Notes
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownload18ColTemplate}
                    className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-800 hover:bg-indigo-100 rounded-lg font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Download Blank Template (.csv)</span>
                  </button>

                  <button
                    onClick={() => {
                      const sample = `Record Id,SAP Tab Name,Visible Screen Label,Technical Property Name,SAP Object Type,API Access,Kosh Target Entity,Target Field,Data Type,Mandatory,Validation Rule,Transform Function,Default Value,Sync Direction,Discovery Status,Sync Frequency,Last Retrieved Value,Notes / SAP Reference
sf-new-01,General,Parent Company Group,ParentCompanyGroup,CompanyService_GetAdminInfo,Read-Only,ORGANIZATION,parentGroup,string,false,NONE,TRIM,KOSH-GLOBAL,SAP_TO_KOSH,VALIDATED,15m,Kosh Innovations Group,Corporate Parent Grouping
sf-new-02,Tax,PAN Number,PANNumber,CompanyService_GetAdminInfo,Read-Only,ORGANIZATION,pan,string,true,PAN_REGEX,UPPERCASE,,SAP_TO_KOSH,VALIDATED,15m,AABCK1234F,Permanent Account Number
sf-01,General,Company Name,CompanyName,CompanyService_GetAdminInfo,Read-Only,ORGANIZATION,name,string,true,NOT_EMPTY,TRIM,,SAP_TO_KOSH,VALIDATED,15m,KOSH INNOVATIONS PRIVATE LIMITED,Official Company Title
sf-invalid-01,General,,UnknownProperty,CompanyService_GetAdminInfo,Read-Only,ORGANIZATION,invalid,,false,NONE,NONE,,,UNSUPPORTED,15m,,Missing label test`;
                      handleRunValidationPreview(sample);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Load Sample Batch
                  </button>
                </div>
              </div>

              {/* File Upload & Text Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Upload Template File or Paste 18-Column CSV / Text:
                  </label>
                  <label className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-xs cursor-pointer flex items-center gap-1.5 transition">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Choose CSV / Excel File</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            handleRunValidationPreview(content);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={importFileText}
                  onChange={(e) => handleRunValidationPreview(e.target.value)}
                  placeholder="Paste CSV text here..."
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dry-Run Validation Summary */}
              {importPreviewData && (
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-2 text-center font-bold">
                    <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                      <div className="text-base text-slate-800">{importPreviewData.total}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Total Rows</div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="text-base text-emerald-700">+{importPreviewData.newCount}</div>
                      <div className="text-[10px] text-emerald-800 uppercase">New Mappings</div>
                    </div>
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-base text-blue-700">↻ {importPreviewData.updateCount}</div>
                      <div className="text-[10px] text-blue-800 uppercase">Updates</div>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-base text-amber-700">⚠ {importPreviewData.unsupportedCount}</div>
                      <div className="text-[10px] text-amber-800 uppercase">Unsupported</div>
                    </div>
                    <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                      <div className="text-base text-rose-700">✕ {importPreviewData.invalidCount}</div>
                      <div className="text-[10px] text-rose-800 uppercase">Invalid Rows</div>
                    </div>
                  </div>

                  {/* Dry-Run Validation Preview Grid */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2">SAP Screen Label</th>
                          <th className="p-2">Technical Property Name</th>
                          <th className="p-2">Target Field</th>
                          <th className="p-2">Data Type</th>
                          <th className="p-2 text-right">Dry-Run Decision</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreviewData.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/80">
                            <td className="p-2 font-bold text-slate-900">{row.visibleSapLabel || '—'}</td>
                            <td className="p-2 font-mono text-indigo-700">{row.technicalPropertyName || '—'}</td>
                            <td className="p-2 font-mono text-slate-700">{row.koshTargetProperty || '—'}</td>
                            <td className="p-2 text-slate-600">{row.dataType}</td>
                            <td className="p-2 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                  row.actionType === 'NEW'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : row.actionType === 'UPDATE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : row.actionType === 'UNSUPPORTED'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {row.actionType}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 text-xs">
                {importPreviewData
                  ? `${importPreviewData.newCount + importPreviewData.updateCount} valid records will be committed to HANA registry.`
                  : 'Awaiting template upload or text input.'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsExcelImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!importPreviewData || (importPreviewData.newCount === 0 && importPreviewData.updateCount === 0)}
                  onClick={handleCommitImportMappings}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-bold cursor-pointer text-xs shadow-xs"
                >
                  Commit Mappings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
