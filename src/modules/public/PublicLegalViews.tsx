import React from 'react';
import { ShieldCheck, ArrowLeft, Building2, Lock, FileText } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface PublicLegalPageProps {
  onNavigateHome: () => void;
  onNavigateLogin: () => void;
}

export const PrivacyPolicyView: React.FC<PublicLegalPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-[#0B192C] border-b border-slate-800 h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <span className="text-sm font-bold text-white">Kosh Innovations Privacy Policy</span>
        </div>
        <div className="flex gap-3 text-xs">
          <button onClick={onNavigateHome} className="text-slate-300 hover:text-white cursor-pointer">
            Public Home
          </button>
          <button onClick={onNavigateLogin} className="text-cyan-400 hover:underline cursor-pointer font-bold">
            Sign In
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 space-y-6 text-xs text-slate-300 leading-relaxed">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">Corporate Data Privacy Policy</h1>
          <p className="text-slate-400 mt-1">My Kosh Innovations Global IT System — Effective October 2026</p>
        </div>

        <section className="space-y-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>1. Scope and Authorized Use</span>
          </h2>
          <p>
            This system is restricted exclusively to authorized employees, contractors, partners, and administrators of Kosh Innovations Private Limited. All business data, item specifications, GST records, partner details, and SAP synchronization records stored within this system are confidential corporate assets.
          </p>
        </section>

        <section className="space-y-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>2. Data Collection and Security Measures</span>
          </h2>
          <p>
            We process user login activity, role actions, branch assignments, 2FA security tokens, and SAP transaction audit logs to maintain data integrity and security compliance. Credentials are protected using server-side Argon2id hashing and encryption.
          </p>
        </section>

        <section className="space-y-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span>3. Contact Corporate Administrator</span>
          </h2>
          <p>
            For privacy queries or access permissions, contact the Kosh IT Compliance Desk at <strong className="text-white">support@koshinnovations.com</strong> or call <strong className="text-white">+91 98401 22320</strong> (Puducherry HQ).
          </p>
        </section>
      </main>
    </div>
  );
};

export const TermsOfServiceView: React.FC<PublicLegalPageProps> = ({
  onNavigateHome,
  onNavigateLogin,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-[#0B192C] border-b border-slate-800 h-16 flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <span className="text-sm font-bold text-white">Kosh Innovations Terms of Service</span>
        </div>
        <div className="flex gap-3 text-xs">
          <button onClick={onNavigateHome} className="text-slate-300 hover:text-white cursor-pointer">
            Public Home
          </button>
          <button onClick={onNavigateLogin} className="text-cyan-400 hover:underline cursor-pointer font-bold">
            Sign In
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 space-y-6 text-xs text-slate-300 leading-relaxed">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">System Terms of Governance & Service</h1>
          <p className="text-slate-400 mt-1">My Kosh Innovations Global IT System — Version 2.5</p>
        </div>

        <section className="space-y-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>1. Governance & Compliance Requirements</span>
          </h2>
          <p>
            All item creations, Business Partner additions, approval decisions, and SAP Service Layer transactions must comply with Kosh Innovations master data rules and maker-checker policies. Self-approval and unauthorized role escalations are strictly prohibited.
          </p>
        </section>

        <section className="space-y-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>2. Audit and Tamper-Evident Logs</span>
          </h2>
          <p>
            All user sessions and operations are audited. Attempts to bypass branch isolation or alter master rules without authorized workflow approval will trigger security alerts to Platform Administrators.
          </p>
        </section>
      </main>
    </div>
  );
};
