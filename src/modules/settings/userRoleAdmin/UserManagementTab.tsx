import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Lock,
  Unlock,
  KeyRound,
  UserX,
  UserCheck,
  Edit3,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Phone,
  Eye,
  EyeOff,
  History,
  Send,
  CheckCircle2,
  PowerOff,
  Power,
} from 'lucide-react';
import type { User, UserRole } from '../../../types';
import type {
  AuthenticationMethod,
  BulkUserImportRowPreview,
  DataScopeLevel,
  ManagedUserType,
  MobileNumberType,
} from '../../../types/userRoleAdmin';
import { userRoleAdminService } from '../../../services/userRoleAdminService';
import { COUNTRY_DIAL_CODES, mobileConsentService } from '../../../services/mobileConsentService';
import { exportService } from '../../../services/exportService';
import { useStandardDataGrid } from '../../../hooks/useStandardDataGrid';
import { DataGridFooter } from '../../../components/DataGridFooter';
import { ModalShell, StatusTag, UserRoleAdminTabProps } from './shared';

const DATA_SCOPE_OPTIONS: Array<{ value: DataScopeLevel; label: string }> = [
  { value: 'BRANCH_RECORDS', label: 'Branch Records' },
  { value: 'DEPARTMENT_RECORDS', label: 'Department Records' },
  { value: 'COMPANY_RECORDS', label: 'Company Records' },
  { value: 'PURCHASE_ORG_RECORDS', label: 'Purchase Org Records' },
  { value: 'ALL_AUTHORIZED_RECORDS', label: 'All Authorized Records' },
  { value: 'OWN_RECORDS', label: 'Own Records Only' },
  { value: 'READ_ONLY_RECORDS', label: 'Read-Only Records' },
];

export const UserManagementTab: React.FC<UserRoleAdminTabProps> = ({
  currentUser,
  companies,
  branches,
  onNotify,
  refreshTick,
  triggerRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [associationFilter, setAssociationFilter] = useState<'ALL' | 'ASSOCIATED' | 'NOT_ASSOCIATED'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');

  const [revealedUserIds, setRevealedUserIds] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [notAssocTarget, setNotAssocTarget] = useState<User | null>(null);
  const [reassocTarget, setReassocTarget] = useState<User | null>(null);
  const [historyTarget, setHistoryTarget] = useState<User | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [otpChallenge, setOtpChallenge] = useState<{
    userId: string;
    previewOtpCode: string;
    codeInput: string;
    message?: string;
  } | null>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    countryCode: '+91',
    mobilePhone: '',
    mobileNumberType: 'OFFICIAL' as MobileNumberType,
    employeeId: '',
    designation: 'Procurement Executive',
    department: 'Procurement',
    userType: 'EMPLOYEE' as ManagedUserType,
    authMethod: 'PASSWORD_EMAIL_2FA' as AuthenticationMethod,
    role: 'ITEM_MAKER' as UserRole,
    defaultCompanyId: companies[0]?.id || 'co-kosh-01',
    defaultBranchId: branches[0]?.id || 'br-pond-01',
    isGlobalScope: false,
    twoFactorEnabled: true,
    creationMode: 'MANUAL' as 'MANUAL' | 'EMPLOYEE_LINKED' | 'INVITED',
    initialPassword: '',
    reason: 'New employee onboarding',
  });

  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    designation: '',
    department: '',
    countryCode: '+91',
    mobilePhone: '',
    mobileNumberType: 'OFFICIAL' as MobileNumberType,
    employeeId: '',
    defaultCompanyId: '',
    defaultBranchId: '',
    twoFactorEnabled: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [requirePwdChange, setRequirePwdChange] = useState(true);
  const [resetReason, setResetReason] = useState('Administrator initiated password reset');

  const [notAssocDate, setNotAssocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notAssocReason, setNotAssocReason] = useState('');
  const [notAssocRef, setNotAssocRef] = useState('');

  const [reassocForm, setReassocForm] = useState({
    effectiveDate: new Date().toISOString().slice(0, 10),
    companyId: companies[0]?.id || 'co-kosh-01',
    branchId: branches[0]?.id || 'br-pond-01',
    employeeId: '',
    employeeRelationshipValidated: false,
    roleId: '',
    dataScopeLevel: 'BRANCH_RECORDS' as DataScopeLevel,
    approvalReference: '',
    approvedByName: '',
    reason: '',
    activateAccount: true,
  });

  const [importCsvText, setImportCsvText] = useState(
    'username,email,firstName,lastName,userType,employeeId,defaultCompanyCode,defaultBranchCode,roleCode,countryCode,mobilePhone,mobileNumberType\n' +
      'ananya.buyer,ananya.buyer@koshinnovations.com,Ananya,Iyer,EMPLOYEE,EMP-309,KOSH-HQ,PDY,ITEM_MAKER,+91,9840123499,OFFICIAL\n' +
      'arjun.audit,arjun.audit@koshinnovations.com,Arjun,Nair,EMPLOYEE,EMP-310,KOSH-SOUTH,CHE,MASTER_DATA_AUDITOR,+91,9840123588,PERSONAL'
  );
  const [importPreview, setImportPreview] = useState<BulkUserImportRowPreview[] | null>(null);

  const roles = useMemo(() => userRoleAdminService.getRoles(), [refreshTick]);
  const allUsers = useMemo(() => userRoleAdminService.getUsers(), [refreshTick]);
  const createMobilePolicy = useMemo(
    () => mobileConsentService.getCompanyMobilePolicy(createForm.defaultCompanyId),
    [createForm.defaultCompanyId, refreshTick]
  );
  const editMobilePolicy = useMemo(
    () => mobileConsentService.getCompanyMobilePolicy(editForm.defaultCompanyId || 'GLOBAL'),
    [editForm.defaultCompanyId, refreshTick]
  );

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allUsers.filter((u) => {
      const assoc = u.employeeAssociationStatus || 'ASSOCIATED';
      if (associationFilter !== 'ALL' && assoc !== associationFilter) return false;
      if (statusFilter !== 'ALL' && (u.status || 'ACTIVE') !== statusFilter) return false;
      if (typeFilter !== 'ALL' && (u.userType || 'EMPLOYEE') !== typeFilter) return false;
      if (companyFilter !== 'ALL' && u.defaultCompanyId !== companyFilter) return false;
      if (q) {
        const hay = `${u.username || ''} ${u.fullName} ${u.email} ${u.employeeId || ''} ${u.department || ''} ${u.role} ${
          u.mobileNumberType !== 'PERSONAL' ? u.mobilePhone || '' : ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allUsers, search, associationFilter, statusFilter, typeFilter, companyFilter]);

  const grid = useStandardDataGrid({
    gridId: 'ura-user-master',
    userId: currentUser.id,
    data: filteredUsers,
    defaultSortField: 'createdAt',
    defaultSortDirection: 'desc',
    tieBreakerField: 'id',
    filterSignature: `${search}|${associationFilter}|${statusFilter}|${typeFilter}|${companyFilter}`,
  });

  const actor = { id: currentUser.id, name: currentUser.fullName };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = userRoleAdminService.createUser(createForm, actor);
      onNotify(
        `User '${created.fullName}' (${created.status}) created.${
          created.mobileNumberType === 'PERSONAL'
            ? ' Personal mobile consent request dispatched to employee.'
            : ''
        }`,
        'success'
      );
      setShowCreateModal(false);
      setCreateForm({
        ...createForm,
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        mobilePhone: '',
        mobileNumberType: 'OFFICIAL',
        employeeId: '',
        initialPassword: '',
      });
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setOtpChallenge(null);
    setEditForm({
      firstName: u.firstName || u.fullName.split(' ')[0] || '',
      lastName: u.lastName || u.fullName.split(' ').slice(1).join(' ') || '',
      email: u.email,
      designation: u.designation || '',
      department: u.department || '',
      countryCode: u.countryCode || '+91',
      mobilePhone: u.mobilePhone || '',
      mobileNumberType: u.mobileNumberType || 'OFFICIAL',
      employeeId: u.employeeId || '',
      defaultCompanyId: u.defaultCompanyId || companies[0]?.id || 'co-kosh-01',
      defaultBranchId: u.defaultBranchId || branches[0]?.id || 'br-pond-01',
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const updated = userRoleAdminService.updateUser(editingUser.id, editForm, actor, 'User Master profile update');
      onNotify(
        `Updated user '${updated.fullName}'.${
          updated.mobileNumberType === 'PERSONAL' && updated.mobileConsentStatus === 'PENDING_EMPLOYEE_CONSENT'
            ? ' Employee consent confirmation is pending.'
            : ''
        }`,
        'success'
      );
      setEditingUser(null);
      setOtpChallenge(null);
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleStartOtpInEdit = (userId: string) => {
    try {
      const res = mobileConsentService.initiateMobileOtp(userId, actor);
      setOtpChallenge({
        userId,
        previewOtpCode: res.previewOtpCode,
        codeInput: '',
        message: `OTP sent to ${res.maskedNumber}. Verification remains strictly independent from Personal Mobile Consent.`,
      });
      const latest = userRoleAdminService.getUserById(userId);
      if (latest) setEditingUser(latest);
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleConfirmOtpInEdit = () => {
    if (!otpChallenge) return;
    try {
      const res = mobileConsentService.confirmMobileOtp(otpChallenge.userId, otpChallenge.codeInput, actor);
      setEditingUser(res.user);
      triggerRefresh();
      if (res.verified) {
        onNotify(res.message, 'success');
        setOtpChallenge(null);
      } else {
        onNotify(res.message, 'error');
      }
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleToggleLock = (u: User) => {
    try {
      if (u.status === 'LOCKED') {
        userRoleAdminService.unlockUser(u.id, 'Administrator unlocked account', actor);
        onNotify(`Account '${u.fullName}' unlocked.`, 'success');
      } else {
        userRoleAdminService.lockUser(u.id, 'Administrator security lock', actor);
        onNotify(`Account '${u.fullName}' locked and active sessions revoked.`, 'info');
      }
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleToggleActivation = (u: User) => {
    try {
      if (u.status === 'DEACTIVATED') {
        userRoleAdminService.reactivateUser(u.id, 'Administrator reactivated account', actor);
        onNotify(`Account '${u.fullName}' reactivated.`, 'success');
      } else {
        userRoleAdminService.deactivateUser(u.id, 'Administrator deactivated account', actor);
        onNotify(`Account '${u.fullName}' deactivated and active sessions revoked.`, 'info');
      }
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      const res = userRoleAdminService.resetUserPassword(resetTarget.id, newPassword, actor, requirePwdChange, resetReason);
      onNotify(res.message, 'success');
      setResetTarget(null);
      setNewPassword('');
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleMarkNotAssociated = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notAssocTarget) return;
    try {
      userRoleAdminService.markEmployeeNotAssociated(
        notAssocTarget.id,
        {
          effectiveDate: notAssocDate,
          reason: notAssocReason,
          approvalReference: notAssocRef || undefined,
        },
        actor
      );
      onNotify(
        `Marked '${notAssocTarget.fullName}' as Not Associated. Access revoked per offboarding policy; historical records preserved.`,
        'success'
      );
      setNotAssocTarget(null);
      setNotAssocReason('');
      setNotAssocRef('');
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const openReassociate = (u: User) => {
    const activeRoles = roles.filter((r) => r.status === 'ACTIVE' && !r.isSuperAdmin);
    const defaultRole = activeRoles.find((r) => r.roleCode === 'READ_ONLY_USER') || activeRoles[0] || roles[0];
    setReassocTarget(u);
    setReassocForm({
      effectiveDate: new Date().toISOString().slice(0, 10),
      companyId: u.defaultCompanyId || companies[0]?.id || 'co-kosh-01',
      branchId: u.defaultBranchId || branches[0]?.id || 'br-pond-01',
      employeeId: u.employeeId || '',
      employeeRelationshipValidated: false,
      roleId: defaultRole?.id || '',
      dataScopeLevel: 'BRANCH_RECORDS',
      approvalReference: '',
      approvedByName: '',
      reason: '',
      activateAccount: true,
    });
  };

  const handleReassociate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassocTarget) return;
    try {
      const updated = userRoleAdminService.reassociateEmployee(
        reassocTarget.id,
        {
          effectiveDate: reassocForm.effectiveDate,
          companyId: reassocForm.companyId,
          branchId: reassocForm.branchId,
          employeeId: reassocForm.employeeId,
          employeeRelationshipValidated: reassocForm.employeeRelationshipValidated,
          roleId: reassocForm.roleId,
          scope: { dataScopeLevel: reassocForm.dataScopeLevel },
          approvalReference: reassocForm.approvalReference,
          approvedByName: reassocForm.approvedByName,
          reason: reassocForm.reason,
          activateAccount: reassocForm.activateAccount,
        },
        actor
      );
      onNotify(
        `Authorized Reassociation completed for '${updated.fullName}'. Only the newly approved role was provisioned; prior revoked roles remain revoked.`,
        'success'
      );
      setReassocTarget(null);
      triggerRefresh();
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handlePreviewImport = () => {
    try {
      const lines = importCsvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        onNotify('Provide a CSV header row plus at least one data row.', 'error');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || '';
        });
        return {
          username: obj.username || '',
          email: obj.email || '',
          firstName: obj.firstName || '',
          lastName: obj.lastName || '',
          userType: (obj.userType as ManagedUserType) || 'EMPLOYEE',
          employeeId: obj.employeeId || undefined,
          defaultCompanyCode: obj.defaultCompanyCode || 'KOSH-HQ',
          defaultBranchCode: obj.defaultBranchCode || 'PDY',
          roleCode: obj.roleCode || 'READ_ONLY_USER',
          countryCode: obj.countryCode || undefined,
          mobilePhone: obj.mobilePhone || undefined,
          mobileNumberType: (obj.mobileNumberType as MobileNumberType) || undefined,
          mobileConsentStatus: (obj.mobileConsentStatus as any) || undefined,
        };
      });
      setImportPreview(userRoleAdminService.previewBulkUserImport(rows));
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  const handleCommitImport = () => {
    if (!importPreview) return;
    const res = userRoleAdminService.commitBulkUserImport(importPreview, actor);
    onNotify(
      `Bulk import completed: ${res.createdCount} pending activation/created, ${res.failedCount} rejected.`,
      res.createdCount > 0 ? 'success' : 'error'
    );
    setShowImportModal(false);
    setImportPreview(null);
    triggerRefresh();
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    exportService.executeExport(format, {
      title: 'Enterprise User Master Directory',
      subtitle: 'CIPPlatform Authoritative User Registry (Personal Mobiles Masked by Policy)',
      filenamePrefix: 'user_master',
      headers: [
        'Username',
        'Full Name',
        'Email',
        'User Type',
        'Employee ID',
        'Mobile Number',
        'Mobile Type',
        'Mobile Verified',
        'Personal Consent',
        'Employee Association',
        'Account Status',
        'Role',
        'Company',
        'Branch',
      ],
      rows: grid.allSortedData.map((u) => {
        const mob = mobileConsentService.formatMobileForViewer(u, currentUser, false);
        return [
          u.username || u.id,
          u.fullName,
          u.email,
          u.userType || 'EMPLOYEE',
          u.employeeId || '-',
          mob.display,
          u.mobileNumberType || '-',
          u.mobileVerificationStatus || 'NOT_VERIFIED',
          u.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL',
          u.employeeAssociationStatus || 'ASSOCIATED',
          u.status || 'ACTIVE',
          u.role,
          u.defaultCompanyId || '-',
          u.defaultBranchId || '-',
        ];
      }),
    });
    onNotify(`Exported ${grid.allSortedData.length} user record(s) as ${format.toUpperCase()}.`, 'info');
  };

  const historyAssoc = useMemo(
    () => (historyTarget ? userRoleAdminService.getAssociationHistory(historyTarget.id) : []),
    [historyTarget, refreshTick]
  );
  const historyNumbers = useMemo(
    () => (historyTarget ? mobileConsentService.getNumberHistory(historyTarget.id) : []),
    [historyTarget, refreshTick]
  );
  const historyConsent = useMemo(
    () => (historyTarget ? mobileConsentService.getConsentEvidence(historyTarget.id) : []),
    [historyTarget, refreshTick]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">User Master &amp; Employee Association Lifecycle</h3>
            <p className="text-[11px] text-slate-500">
              Manage employee onboarding, Official vs Personal mobile consent, account status, and Associated / Not Associated lifecycle with full audit preservation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Bulk Import
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> XLSX
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" /> Create / Invite User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username, name, email, employee ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <select
            aria-label="Filter by Employee Association"
            value={associationFilter}
            onChange={(e) => setAssociationFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Association Statuses</option>
            <option value="ASSOCIATED">Associated</option>
            <option value="NOT_ASSOCIATED">Not Associated</option>
          </select>
          <select
            aria-label="Filter by Account Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="PENDING_ACTIVATION">Pending Activation</option>
            <option value="ACTIVE">Active</option>
            <option value="LOCKED">Locked</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
          <select
            aria-label="Filter by User Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All User Types</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="ADMINISTRATOR">ADMINISTRATOR</option>
            <option value="SUPPLIER_USER">SUPPLIER_USER</option>
            <option value="CUSTOMER_USER">CUSTOMER_USER</option>
            <option value="CONTRACTOR">CONTRACTOR</option>
            <option value="SERVICE_ACCOUNT">SERVICE_ACCOUNT</option>
          </select>
          <select
            aria-label="Filter by Company"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                <th className="p-3">User / Identity</th>
                <th className="p-3">Type &amp; Employee</th>
                <th className="p-3">Primary Role</th>
                <th className="p-3">Org Context</th>
                <th className="p-3">Mobile Contact &amp; Consent</th>
                <th className="p-3">Employee Association</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.pagedData.map((u) => {
                const comp = companies.find((c) => c.id === u.defaultCompanyId);
                const br = branches.find((b) => b.id === u.defaultBranchId);
                const assocStatus = u.employeeAssociationStatus || 'ASSOCIATED';
                const isAssociated = assocStatus === 'ASSOCIATED';
                const isRevealed = Boolean(revealedUserIds[u.id]);
                const canReveal =
                  u.mobileNumberType === 'PERSONAL' &&
                  Boolean(u.mobilePhone) &&
                  mobileConsentService.canViewUnmaskedPersonalMobile(currentUser, u.id);
                const mobDisplay = mobileConsentService.formatMobileForViewer(u, currentUser, isRevealed);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 align-top">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        @{u.username || u.id} • {u.email}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{u.userType || 'EMPLOYEE'}</div>
                      <div className="text-[11px] text-slate-500">
                        {u.employeeId ? `${u.employeeId} • ` : ''}
                        {u.department || '-'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-indigo-700">{u.role}</div>
                      <div className="text-[11px] text-slate-500">{u.designation || '-'}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{comp?.code || u.defaultCompanyId || 'GLOBAL'}</div>
                      <div className="text-[11px] text-slate-500">
                        {u.isGlobalScope ? 'Global All Branches' : br?.code || u.defaultBranchId || '-'}
                      </div>
                    </td>
                    <td className="p-3 space-y-1">
                      {u.mobilePhone ? (
                        <>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
                            <span>{mobDisplay.display}</span>
                            {canReveal && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedUserIds((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                                }
                                title={isRevealed ? 'Mask personal mobile number' : 'Reveal personal mobile number'}
                                className="p-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                u.mobileNumberType === 'PERSONAL'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {u.mobileNumberType === 'PERSONAL' ? 'Personal Mobile' : 'Official Mobile'}
                            </span>
                            <StatusTag status={u.mobileVerificationStatus || 'NOT_VERIFIED'} />
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusTag status={u.mobileConsentStatus || 'NOT_REQUIRED_OFFICIAL'} />
                          </div>
                          {u.mobileConsentTimestamp && (
                            <div className="text-[10px] text-slate-500 tabular-nums">
                              {new Date(u.mobileConsentTimestamp).toLocaleDateString()} • {u.mobileConsentVersion || 'v2.0'}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400">No mobile registered</span>
                      )}
                    </td>
                    <td className="p-3 space-y-1">
                      <StatusTag status={assocStatus} />
                      {u.associationEndDate && !isAssociated && (
                        <div className="text-[10px] text-rose-700 font-medium tabular-nums">
                          Ended: {u.associationEndDate}
                        </div>
                      )}
                      {u.reassociatedAt && isAssociated && (
                        <div className="text-[10px] text-emerald-700 font-medium tabular-nums">
                          Reassociated: {new Date(u.reassociatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusTag status={u.status || 'ACTIVE'} />
                      {u.failedLoginAttempts && u.failedLoginAttempts > 0 ? (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5 tabular-nums">
                          {u.failedLoginAttempts} failed login(s)
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1 max-w-[260px]">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Edit User"
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 inline mr-0.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetTarget(u);
                            setNewPassword('');
                          }}
                          title="Password"
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3 inline mr-0.5" /> Password
                        </button>

                        {isAssociated && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleLock(u)}
                              className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                            >
                              {u.status === 'LOCKED' ? (
                                <>
                                  <Unlock className="w-3 h-3 inline mr-0.5 text-emerald-600" /> Unlock
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 inline mr-0.5 text-amber-600" /> Lock
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActivation(u)}
                              className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                            >
                              {u.status === 'DEACTIVATED' ? (
                                <>
                                  <Power className="w-3 h-3 inline mr-0.5 text-emerald-600" /> Reactivate
                                </>
                              ) : (
                                <>
                                  <PowerOff className="w-3 h-3 inline mr-0.5 text-slate-600" /> Deactivate
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNotAssocTarget(u);
                                setNotAssocReason('');
                                setNotAssocRef('');
                              }}
                              className="px-2 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-[11px] font-semibold text-rose-700 cursor-pointer"
                            >
                              <UserX className="w-3 h-3 inline mr-0.5" /> Mark as Not Associated
                            </button>
                          </>
                        )}

                        {!isAssociated && (
                          <button
                            type="button"
                            onClick={() => openReassociate(u)}
                            className="px-2 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-800 cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3 inline mr-0.5" /> Reassociate
                          </button>
                        )}

                        {u.status === 'PENDING_ACTIVATION' && (
                          <button
                            type="button"
                            onClick={() => {
                              userRoleAdminService.resendInvitation(u.id, actor);
                              onNotify(`Resent invitation to ${u.email}.`, 'info');
                              triggerRefresh();
                            }}
                            className="px-2 py-1 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[11px] font-semibold text-sky-700 cursor-pointer"
                          >
                            <Mail className="w-3 h-3 inline mr-0.5" /> Resend Invite
                          </button>
                        )}

                        {isAssociated &&
                          u.mobileNumberType === 'PERSONAL' &&
                          u.mobileConsentStatus === 'PENDING_EMPLOYEE_CONSENT' && (
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  const res = mobileConsentService.requestPersonalMobileConsent(u, actor);
                                  onNotify(
                                    res.channelLimitationWarning ||
                                      `Personal mobile consent request resent via ${res.channel}.`,
                                    res.dispatched ? 'info' : 'error'
                                  );
                                  triggerRefresh();
                                } catch (err: any) {
                                  onNotify(err.message, 'error');
                                }
                              }}
                              className="px-2 py-1 rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-800 cursor-pointer"
                            >
                              <Send className="w-3 h-3 inline mr-0.5" /> Resend Consent
                            </button>
                          )}

                        <button
                          type="button"
                          onClick={() => setHistoryTarget(u)}
                          title="Association & Mobile Consent History"
                          className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          <History className="w-3 h-3 inline mr-0.5" /> History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {grid.pagedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 font-semibold">
                    No matching users found for the active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataGridFooter
        currentPage={grid.currentPage}
        totalPages={grid.totalPages}
        pageSize={grid.pageSize}
        totalRecords={grid.totalRecords}
        onPageChange={grid.setCurrentPage}
        onPageSizeChange={grid.setPageSize}
        pageSizeOptions={grid.pageSizeOptions}
        defaultSortNotice="Sorted Newest First"
      />

      {/* CREATE / INVITE USER MODAL */}
      {showCreateModal && (
        <ModalShell
          title="Onboard Enterprise User"
          subtitle="Supports Manual Creation, Employee-Linked Onboarding, Email Invitation, and Mobile Number Consent Governance."
          onClose={() => setShowCreateModal(false)}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Onboarding Mode</label>
                <select
                  value={createForm.creationMode}
                  onChange={(e) => setCreateForm({ ...createForm, creationMode: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="MANUAL">Manual Creation (Active)</option>
                  <option value="EMPLOYEE_LINKED">Employee-Linked Account</option>
                  <option value="INVITED">Invite via Email (Pending Activation)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">User Type *</label>
                <select
                  value={createForm.userType}
                  onChange={(e) => setCreateForm({ ...createForm, userType: e.target.value as ManagedUserType })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                  <option value="EXTERNAL_USER">External User</option>
                  <option value="SUPPLIER_USER">Supplier Portal User</option>
                  <option value="CUSTOMER_USER">Customer Portal User</option>
                  <option value="CONTRACTOR">Temporary Contractor</option>
                  <option value="SERVICE_ACCOUNT">Service / Integration Account</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Baseline Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.roleCode}>
                      {r.roleCode} — {r.roleName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Username *</label>
                <input
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="e.g. meera.finance"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Corporate Email *</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="meera.finance@koshinnovations.com"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* CONTACT INFORMATION & MOBILE NUMBER MANAGEMENT */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  Contact Information &amp; Mobile Governance
                </div>
                <span className="text-[11px] text-slate-500">
                  {createMobilePolicy.isMobileMandatoryOnOnboarding
                    ? 'Mobile Mandatory by Company Policy'
                    : 'Mobile Optional by Company Policy'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country Code *</label>
                  <select
                    aria-label="Country Code"
                    value={createForm.countryCode}
                    onChange={(e) => setCreateForm({ ...createForm, countryCode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    {COUNTRY_DIAL_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.iso} — {c.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Mobile Number {createMobilePolicy.isMobileMandatoryOnOnboarding ? '*' : '(E.164 digits)'}
                  </label>
                  <input
                    required={createMobilePolicy.isMobileMandatoryOnOnboarding}
                    value={createForm.mobilePhone}
                    onChange={(e) => setCreateForm({ ...createForm, mobilePhone: e.target.value })}
                    placeholder="e.g. 9840123456"
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number Type *</label>
                  <select
                    aria-label="Mobile Number Type"
                    value={createForm.mobileNumberType}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, mobileNumberType: e.target.value as MobileNumberType })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="OFFICIAL">Official Mobile Number</option>
                    {createMobilePolicy.allowPersonalMobile && (
                      <option value="PERSONAL">Personal Mobile Number</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Verified Status:</span>
                  <StatusTag status="NOT_VERIFIED" />
                  <span className="text-slate-500">OTP verification runs independently from consent.</span>
                </div>
              </div>

              {createForm.mobileNumberType === 'PERSONAL' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                      Personal Mobile Consent (System Controlled)
                    </span>
                    <StatusTag status="PENDING_EMPLOYEE_CONSENT" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Method</div>
                      <div className="font-bold text-slate-800">Employee confirmation</div>
                    </div>
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Version</div>
                      <div className="font-mono font-bold text-slate-800">
                        {createMobilePolicy.activeConsentVersion}
                      </div>
                    </div>
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Date &amp; Time</div>
                      <div className="font-semibold text-slate-700">System generated on employee action</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Governance enforcement: Administrators cannot grant Personal Mobile Consent on behalf of an employee. Upon saving, the system dispatches an In-Portal &amp; Corporate Email consent request. SMS/WhatsApp organizational messaging remains blocked until the employee explicitly grants consent.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                <input
                  required
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                <input
                  required
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee ID</label>
                <input
                  value={createForm.employeeId}
                  onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                  placeholder="e.g. EMP-204"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <input
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Company *</label>
                <select
                  value={createForm.defaultCompanyId}
                  onChange={(e) => setCreateForm({ ...createForm, defaultCompanyId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Branch *</label>
                <select
                  value={createForm.defaultBranchId}
                  onChange={(e) => setCreateForm({ ...createForm, defaultBranchId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {createForm.creationMode !== 'INVITED' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Initial Password (Salted SHA-256 Stored • Optional for quick accounts)
                </label>
                <input
                  type="password"
                  value={createForm.initialPassword}
                  onChange={(e) => setCreateForm({ ...createForm, initialPassword: e.target.value })}
                  placeholder="Min 10 chars, upper, lower, digit, special char"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.twoFactorEnabled}
                  onChange={(e) => setCreateForm({ ...createForm, twoFactorEnabled: e.target.checked })}
                />
                Enforce Multi-Factor Authentication (2FA)
              </label>
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.isGlobalScope}
                  onChange={(e) => setCreateForm({ ...createForm, isGlobalScope: e.target.checked })}
                />
                Company-Wide Branch Visibility
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                {createForm.creationMode === 'INVITED' ? 'Send Invitation' : 'Create User Account'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <ModalShell
          title={`Edit User — ${editingUser.fullName}`}
          subtitle={`Username: @${editingUser.username} • Association: ${
            editingUser.employeeAssociationStatus || 'ASSOCIATED'
          } • Account: ${editingUser.status}`}
          onClose={() => {
            setEditingUser(null);
            setOtpChallenge(null);
          }}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">First Name *</label>
                <input
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Last Name *</label>
                <input
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Corporate Email *</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Employee ID</label>
                <input
                  value={editForm.employeeId}
                  onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <input
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Designation</label>
                <input
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Contact Information & Mobile OTP */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  Contact Information &amp; Mobile Verification
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusTag status={editingUser.mobileVerificationStatus || 'NOT_VERIFIED'} />
                  {editingUser.mobilePhone && (
                    <button
                      type="button"
                      onClick={() => handleStartOtpInEdit(editingUser.id)}
                      className="px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700 cursor-pointer"
                    >
                      Trigger Mobile OTP
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Country Code *</label>
                  <select
                    value={editForm.countryCode}
                    onChange={(e) => setEditForm({ ...editForm, countryCode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  >
                    {COUNTRY_DIAL_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.iso})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    value={editForm.mobilePhone}
                    onChange={(e) => setEditForm({ ...editForm, mobilePhone: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number Type</label>
                  <select
                    value={editForm.mobileNumberType}
                    onChange={(e) =>
                      setEditForm({ ...editForm, mobileNumberType: e.target.value as MobileNumberType })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="OFFICIAL">Official Mobile Number</option>
                    {editMobilePolicy.allowPersonalMobile && (
                      <option value="PERSONAL">Personal Mobile Number</option>
                    )}
                  </select>
                </div>
              </div>

              {otpChallenge && otpChallenge.userId === editingUser.id && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-indigo-900">
                      OTP Verification Challenge — Preview Code:{' '}
                      <code className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200">
                        {otpChallenge.previewOtpCode}
                      </code>
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800">{otpChallenge.message}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpChallenge.codeInput}
                      onChange={(e) =>
                        setOtpChallenge({ ...otpChallenge, codeInput: e.target.value })
                      }
                      placeholder="Enter 6-digit OTP"
                      className="w-40 p-1.5 border border-indigo-300 rounded bg-white font-mono text-center tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmOtpInEdit}
                      className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                    >
                      Verify OTP
                    </button>
                  </div>
                </div>
              )}

              {editForm.mobileNumberType === 'PERSONAL' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-900">Personal Mobile Consent (Read-Only)</span>
                    <StatusTag status={editingUser.mobileConsentStatus || 'PENDING_EMPLOYEE_CONSENT'} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Method</div>
                      <div className="font-bold text-slate-800">Employee confirmation</div>
                    </div>
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Version</div>
                      <div className="font-mono font-bold text-slate-800">
                        {editingUser.mobileConsentVersion || editMobilePolicy.activeConsentVersion}
                      </div>
                    </div>
                    <div className="bg-white/90 border border-amber-200 rounded p-2">
                      <div className="text-slate-500 font-semibold">Consent Date &amp; Time</div>
                      <div className="font-semibold text-slate-700 tabular-nums">
                        {editingUser.mobileConsentTimestamp
                          ? new Date(editingUser.mobileConsentTimestamp).toLocaleString()
                          : 'Pending employee action'}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    Changing the mobile number or switching from Official to Personal resets consent to Pending Employee Consent and archives the prior number.
                  </p>
                </div>
              )}
            </div>

            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.twoFactorEnabled}
                onChange={(e) => setEditForm({ ...editForm, twoFactorEnabled: e.target.checked })}
              />
              Two-Factor Authentication Enabled
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setOtpChallenge(null);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTarget && (
        <ModalShell
          title={`Reset Password — ${resetTarget.fullName}`}
          subtitle="Enforces enterprise password complexity, history non-reuse, and salted SHA-256 hashing."
          onClose={() => setResetTarget(null)}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handlePasswordReset} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">New Password *</label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 10 chars, upper, lower, number, special char"
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Audit Reason *</label>
              <input
                required
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={requirePwdChange}
                onChange={(e) => setRequirePwdChange(e.target.checked)}
              />
              Force Password Change on Next Login
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                Rotate Password Hash
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* MARK AS NOT ASSOCIATED MODAL */}
      {notAssocTarget && (
        <ModalShell
          title={`Mark Employee as Not Associated — ${notAssocTarget.fullName}`}
          subtitle="Non-destructive lifecycle transition: preserves user profile, employee history, transactions, approvals, and audit records."
          onClose={() => setNotAssocTarget(null)}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleMarkNotAssociated} className="space-y-3 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  Marking <strong>{notAssocTarget.fullName}</strong> as <strong>Not Associated</strong> applies the configured offboarding policy:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Revokes all active sessions and disables portal login (Account Status → Deactivated).</li>
                  <li>Revokes active/pending organizational role assignments, temporary access, and delegations.</li>
                  <li>Permanently preserves historical transactions, approvals, consent evidence, and audit logs.</li>
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Association End Date *</label>
                <input
                  required
                  type="date"
                  value={notAssocDate}
                  onChange={(e) => setNotAssocDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">HR / Approval Reference</label>
                <input
                  value={notAssocRef}
                  onChange={(e) => setNotAssocRef(e.target.value)}
                  placeholder="e.g. HR-EXIT-2026-44"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mandatory Reason (min 5 characters) *</label>
              <textarea
                required
                minLength={5}
                value={notAssocReason}
                onChange={(e) => setNotAssocReason(e.target.value)}
                placeholder="e.g. Employee resignation effective end of month, exit clearance completed..."
                className="w-full p-2 border border-slate-300 rounded-lg h-20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNotAssocTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                Confirm Not Associated
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* AUTHORIZED REASSOCIATION MODAL */}
      {reassocTarget && (
        <ModalShell
          title={`Authorized Reassociation — ${reassocTarget.fullName}`}
          subtitle="Transitions Employee Association from Not Associated to Associated under explicit HR and security approval."
          onClose={() => setReassocTarget(null)}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleReassociate} className="space-y-3 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong>Least-Privilege Safeguard:</strong> Reassociation never automatically restores previously revoked roles, temporary grants, or permissions. Only the explicitly approved role and organizational scope below will be provisioned.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective Date *</label>
                <input
                  required
                  type="date"
                  value={reassocForm.effectiveDate}
                  onChange={(e) => setReassocForm({ ...reassocForm, effectiveDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Validated Employee ID *</label>
                <input
                  required
                  value={reassocForm.employeeId}
                  onChange={(e) => setReassocForm({ ...reassocForm, employeeId: e.target.value })}
                  placeholder="e.g. EMP-4099"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reassocForm.employeeRelationshipValidated}
                    onChange={(e) =>
                      setReassocForm({ ...reassocForm, employeeRelationshipValidated: e.target.checked })
                    }
                  />
                  HR Relationship Validated *
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Company *</label>
                <select
                  value={reassocForm.companyId}
                  onChange={(e) => setReassocForm({ ...reassocForm, companyId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Branch *</label>
                <select
                  value={reassocForm.branchId}
                  onChange={(e) => setReassocForm({ ...reassocForm, branchId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {branches
                    .filter((b) => !reassocForm.companyId || b.companyId === reassocForm.companyId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Explicitly Approved Role *</label>
                <select
                  required
                  value={reassocForm.roleId}
                  onChange={(e) => setReassocForm({ ...reassocForm, roleId: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {roles
                    .filter((r) => r.status === 'ACTIVE')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roleCode} — {r.roleName}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Approved Data Scope Level *</label>
                <select
                  value={reassocForm.dataScopeLevel}
                  onChange={(e) =>
                    setReassocForm({ ...reassocForm, dataScopeLevel: e.target.value as DataScopeLevel })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {DATA_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Approval Reference *</label>
                <input
                  required
                  value={reassocForm.approvalReference}
                  onChange={(e) => setReassocForm({ ...reassocForm, approvalReference: e.target.value })}
                  placeholder="e.g. HR-REHIRE-2026-11"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Approved By (Approver Name) *</label>
                <input
                  required
                  value={reassocForm.approvedByName}
                  onChange={(e) => setReassocForm({ ...reassocForm, approvedByName: e.target.value })}
                  placeholder="e.g. Rajesh Sharma (VP Operations)"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mandatory Reassociation Reason *</label>
              <textarea
                required
                minLength={5}
                value={reassocForm.reason}
                onChange={(e) => setReassocForm({ ...reassocForm, reason: e.target.value })}
                placeholder="Document business justification and HR validation summary..."
                className="w-full p-2 border border-slate-300 rounded-lg h-16"
              />
            </div>

            <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={reassocForm.activateAccount}
                onChange={(e) => setReassocForm({ ...reassocForm, activateAccount: e.target.checked })}
              />
              Enable Login Account (Set Account Status to Active upon Reassociation)
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassocTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete Authorized Reassociation
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* LIFECYCLE & MOBILE CONTACT HISTORY MODAL */}
      {historyTarget && (
        <ModalShell
          title={`Lifecycle & Mobile Contact History — ${historyTarget.fullName}`}
          subtitle={`@${historyTarget.username} • Current Association: ${
            historyTarget.employeeAssociationStatus || 'ASSOCIATED'
          } • Account: ${historyTarget.status}`}
          onClose={() => setHistoryTarget(null)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Employee Association &amp; Reassociation Audit Trail</h4>
              {historyAssoc.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                  No association status transitions recorded for this user.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Transition</th>
                        <th className="p-2">Effective Date</th>
                        <th className="p-2">Actor / Approver</th>
                        <th className="p-2">Approval Ref</th>
                        <th className="p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyAssoc.map((h) => (
                        <tr key={h.id}>
                          <td className="p-2 tabular-nums text-slate-500">
                            {new Date(h.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2">
                            <StatusTag status={h.previousStatus} /> → <StatusTag status={h.newStatus} />
                          </td>
                          <td className="p-2 tabular-nums">{h.effectiveDate}</td>
                          <td className="p-2">
                            <div className="font-semibold text-slate-800">{h.changedByName}</div>
                            {h.approvedByName && (
                              <div className="text-[10px] text-slate-500">Approved: {h.approvedByName}</div>
                            )}
                          </td>
                          <td className="p-2 font-mono">{h.approvalReference || '-'}</td>
                          <td className="p-2 text-slate-700">{h.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Personal Mobile Consent Evidence Ledger</h4>
              {historyConsent.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                  No personal mobile consent evidence records for this user.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2">Ref</th>
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Action &amp; Status</th>
                        <th className="p-2">Version / Method</th>
                        <th className="p-2">Purposes</th>
                        <th className="p-2">Actor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyConsent.map((ev) => (
                        <tr key={ev.id}>
                          <td className="p-2 font-mono">{ev.evidenceReference}</td>
                          <td className="p-2 tabular-nums text-slate-500">
                            {new Date(ev.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2">
                            <div className="font-semibold">{ev.action}</div>
                            <StatusTag status={ev.consentStatus} />
                          </td>
                          <td className="p-2">
                            {ev.consentVersion} • {ev.consentMethod}
                          </td>
                          <td className="p-2">{ev.approvedPurposes.join(', ') || '-'}</td>
                          <td className="p-2">{ev.actorName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Archived Mobile Number History</h4>
              {historyNumbers.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                  No archived prior mobile numbers for this user.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-2">Archived At</th>
                        <th className="p-2">Number (Masked)</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Prior Verification / Consent</th>
                        <th className="p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyNumbers.map((nh) => (
                        <tr key={nh.id}>
                          <td className="p-2 tabular-nums text-slate-500">
                            {new Date(nh.archivedAt).toLocaleString()}
                          </td>
                          <td className="p-2 font-mono">
                            {nh.mobileNumberType === 'PERSONAL'
                              ? mobileConsentService.maskMobileNumber(nh.countryCode, nh.mobileNumber)
                              : `${nh.countryCode} ${nh.mobileNumber}`}
                          </td>
                          <td className="p-2">{nh.mobileNumberType}</td>
                          <td className="p-2 space-x-1">
                            <StatusTag status={nh.verificationStatus} />
                            <StatusTag status={nh.consentStatus} />
                          </td>
                          <td className="p-2">{nh.archivedReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* BULK IMPORT PREVIEW & COMMIT MODAL */}
      {showImportModal && (
        <ModalShell
          title="Bulk User Import (Validation Preview & Controlled Commit)"
          subtitle="Validates E.164 mobile numbers, enforces Personal Mobile Consent employee-only rule, and blocks unauthorized PLATFORM_ADMIN bulk provisioning."
          onClose={() => {
            setShowImportModal(false);
            setImportPreview(null);
          }}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">CSV Batch Input</label>
              <textarea
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-[11px] h-32"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handlePreviewImport}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
              >
                Validate &amp; Preview Batch
              </button>
            </div>

            {importPreview && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="font-bold text-slate-800">
                  Validation Preview: {importPreview.filter((r) => r.isValid).length} valid /{' '}
                  {importPreview.filter((r) => !r.isValid).length} invalid
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                        <th className="p-2">Row</th>
                        <th className="p-2">Username</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Mobile &amp; Type</th>
                        <th className="p-2">Company / Branch</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importPreview.map((r) => (
                        <tr key={r.rowNumber}>
                          <td className="p-2 font-mono">{r.rowNumber}</td>
                          <td className="p-2 font-mono font-bold">{r.username}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2 font-mono">
                            {r.mobilePhone ? `${r.countryCode || '+91'} ${r.mobilePhone} (${r.mobileNumberType})` : '-'}
                          </td>
                          <td className="p-2">
                            {r.defaultCompanyCode} / {r.defaultBranchCode}
                          </td>
                          <td className="p-2 font-mono">{r.roleCode}</td>
                          <td className="p-2">
                            {r.isValid ? (
                              <div>
                                <span className="text-emerald-700 font-bold">Valid</span>
                                {r.warnings.length > 0 && (
                                  <div className="text-[10px] text-amber-700">{r.warnings.join(' ')}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-rose-700 font-bold">{r.errors.join(' ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={importPreview.filter((r) => r.isValid).length === 0}
                    onClick={handleCommitImport}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Commit Valid Rows ({importPreview.filter((r) => r.isValid).length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}
    </div>
  );
};
