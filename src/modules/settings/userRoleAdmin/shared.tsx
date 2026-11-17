import React from 'react';
import type { Branch, Company, User } from '../../../types';

export interface UserRoleAdminTabProps {
  currentUser: User;
  activeCompany: Company;
  activeBranch: Branch;
  companies: Company[];
  branches: Branch[];
  onNavigate?: (route: string) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
  refreshTick: number;
  triggerRefresh: () => void;
}

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const s = (status || '').toUpperCase();
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ASSOCIATED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    NOT_ASSOCIATED: 'bg-rose-100 text-rose-900 border-rose-300',
    PENDING_ACTIVATION: 'bg-sky-50 text-sky-700 border-sky-200',
    DEACTIVATED: 'bg-slate-100 text-slate-700 border-slate-300',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    NOT_VERIFIED: 'bg-slate-100 text-slate-600 border-slate-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
    CONSENT_GRANTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING_EMPLOYEE_CONSENT: 'bg-amber-50 text-amber-800 border-amber-200',
    CONSENT_DECLINED: 'bg-rose-50 text-rose-700 border-rose-200',
    CONSENT_WITHDRAWN: 'bg-orange-50 text-orange-800 border-orange-200',
    NOT_REQUIRED_OFFICIAL: 'bg-slate-100 text-slate-600 border-slate-200',
    INVITED: 'bg-sky-50 text-sky-700 border-sky-200',
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    PENDING_MANAGER: 'bg-amber-50 text-amber-800 border-amber-200',
    PENDING_DATA_OWNER: 'bg-amber-50 text-amber-800 border-amber-200',
    PENDING_SECURITY_ADMIN: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    EXPIRING_SOON: 'bg-amber-50 text-amber-800 border-amber-200',
    OPEN_WARNING: 'bg-amber-50 text-amber-800 border-amber-200',
    CLARIFICATION_REQUESTED: 'bg-amber-50 text-amber-800 border-amber-200',
    ESCALATED: 'bg-orange-50 text-orange-800 border-orange-200',
    EXCEPTION_APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    MODIFIED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    SUSPENDED: 'bg-orange-50 text-orange-800 border-orange-200',
    LOCKED: 'bg-rose-50 text-rose-700 border-rose-200',
    BLOCKED: 'bg-rose-50 text-rose-700 border-rose-200',
    REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
    REVOKED: 'bg-rose-50 text-rose-700 border-rose-200',
    CONFIRMED_INCIDENT: 'bg-rose-100 text-rose-900 border-rose-300',
    INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
    EXPIRED: 'bg-slate-100 text-slate-600 border-slate-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
    LOGGED_OUT: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const labels: Record<string, string> = {
    ASSOCIATED: 'Associated',
    NOT_ASSOCIATED: 'Not Associated',
    PENDING_ACTIVATION: 'Pending Activation',
    DEACTIVATED: 'Deactivated',
    NOT_REQUIRED_OFFICIAL: 'Not Required (Official)',
    PENDING_EMPLOYEE_CONSENT: 'Pending Employee Consent',
    CONSENT_GRANTED: 'Consent Granted',
    CONSENT_DECLINED: 'Consent Declined',
    CONSENT_WITHDRAWN: 'Consent Withdrawn',
    NOT_VERIFIED: 'Not Verified',
    VERIFIED: 'Verified',
    PENDING: 'Pending',
    FAILED: 'Failed',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
        styles[s] || 'bg-slate-100 text-slate-700 border-slate-200'
      }`}
    >
      {labels[s] || s.replace(/_/g, ' ')}
    </span>
  );
};

export const RiskTag: React.FC<{ level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'STANDARD' }> = ({ level }) => {
  const map: Record<string, string> = {
    STANDARD: 'bg-slate-100 text-slate-700 border-slate-200',
    LOW: 'bg-sky-50 text-sky-700 border-sky-200',
    MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
    HIGH: 'bg-orange-50 text-orange-800 border-orange-200',
    CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${map[level] || map.STANDARD}`}>
      {level}
    </span>
  );
};

export const ModalShell: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, maxWidth = 'max-w-2xl', children }) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4"
    >
      <div className={`bg-white rounded-xl border border-slate-200 shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded cursor-pointer"
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
};
