import React from 'react';
import { Building2, MapPin, ShieldCheck, AlertTriangle, RefreshCw, Globe, Database } from 'lucide-react';
import { OperatingContext } from '../services/operatingContextService';

interface ContextIndicatorBarProps {
  context: OperatingContext;
  onResetContext?: () => void;
  compact?: boolean;
  className?: string;
}

export const ContextIndicatorBar: React.FC<ContextIndicatorBarProps> = ({
  context,
  onResetContext,
  compact = false,
}) => {
  const { activeCompany, activeBranch, environmentId, isValidContext, contextErrorMessage } = context;

  if (!isValidContext || !activeCompany || !activeBranch) {
    return (
      <div className="bg-rose-900/90 text-white p-3 rounded-xl border border-rose-700 shadow-md flex items-center justify-between gap-3 text-xs mb-4">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0" />
          <div>
            <span className="font-bold text-rose-200">Operating Context Warning: </span>
            <span>{contextErrorMessage || 'Active company or branch is invalid or disabled.'}</span>
          </div>
        </div>

        {onResetContext && (
          <button
            onClick={onResetContext}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-rose-900 hover:bg-rose-100 rounded-lg font-bold shadow-xs transition cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset to Default HQ Context
          </button>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-mono shadow-xs mb-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="flex items-center gap-1 text-cyan-300 font-bold truncate">
            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            [{activeCompany.code}] {activeCompany.name}
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-amber-300 font-bold truncate">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            [{activeBranch.portalBranchCode}] {activeBranch.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[10px]">
          <span className="bg-indigo-900/80 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-700/60 font-mono">
            SAP DB: {activeCompany.sapCompanyDb}
          </span>
          <span className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/80 font-bold">
            ENV: {environmentId}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xs border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs mb-4">
      <div className="flex items-center gap-4">
        {/* Company Info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider leading-none">
              Active Company Context
            </div>
            <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1.5">
              <span>{activeCompany.name}</span>
              <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700">
                {activeCompany.code}
              </span>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        {/* Branch Info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-950 text-amber-400 border border-amber-800/60 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider leading-none">
              Active Operating Branch
            </div>
            <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1.5">
              <span className="font-mono text-cyan-300">[{activeBranch.portalBranchCode}]</span>
              <span>{activeBranch.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SAP DB & Environment Badges */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700 font-mono text-[11px] text-slate-300">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>SAP DB: <strong>{activeCompany.sapCompanyDb}</strong></span>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 font-bold text-[11px]">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>ENV: {environmentId}</span>
        </div>
      </div>
    </div>
  );
};
