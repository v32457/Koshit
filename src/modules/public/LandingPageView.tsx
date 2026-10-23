import React from 'react';
import {
  ShieldCheck,
  Boxes,
  Users2,
  Workflow,
  Cpu,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building2,
  MessageSquare,
  Activity,
  FileCheck2,
  Layers,
  Server,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  ChevronRight,
  LogIn,
  LayoutDashboard,
  Sparkles,
  Database,
  Sliders,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';

interface LandingPageViewProps {
  isAuthenticated: boolean;
  onNavigateLogin: () => void;
  onNavigateDashboard: () => void;
  onNavigateRoute: (route: string) => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  isAuthenticated,
  onNavigateLogin,
  onNavigateDashboard,
  onNavigateRoute,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#0B192C]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div className="hidden sm:block border-l border-slate-700 pl-3">
              <p className="text-xs font-bold text-white tracking-wide">KOSH INNOVATIONS</p>
              <p className="text-[10px] text-cyan-400 font-medium">Global Master Governance System</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Platform Capabilities</a>
            <a href="#workflow" className="hover:text-white transition-colors">Governance Workflow</a>
            <a href="#security" className="hover:text-white transition-colors">Enterprise Security</a>
            <a href="#integration" className="hover:text-white transition-colors">SAP B1 Integration</a>
            <button onClick={() => onNavigateRoute('/support')} className="hover:text-white transition-colors cursor-pointer">Support</button>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onNavigateDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Open Dashboard</span>
              </button>
            ) : (
              <button
                onClick={onNavigateLogin}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-md transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B192C] via-slate-900 to-slate-950 pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-semibold mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kosh Innovations — Multi-Plant Master Governance System</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
            Centralized Enterprise <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">Master Data & SAP Governance</span>
          </h1>

          <p className="mt-6 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Standardized multi-level approval workflows, rule-driven Item Master generation, Business Partner validation with GST save gates, and real-time Service Layer synchronization for SAP Business One.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={onNavigateDashboard}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <span>Access Corporate Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onNavigateLogin}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-900/40 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Account Credentials</span>
              </button>
            )}

            <a
              href="#features"
              className="px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
            >
              Explore System Capabilities
            </a>
          </div>

          {/* Key Stat Cards */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-cyan-400">5 Plants</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Pondicherry HQ, Chennai, Hosur, Pune, Dehradun</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-blue-400">100% Rules</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Deterministic Item Code & Description Generation</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-emerald-400">GST Gate</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">Strict Verification Save Gate for Business Partners</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-bold text-purple-400">SAP B1</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">HANA Service Layer & Reconciled Sync Queue</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Overview Section */}
      <section id="features" className="py-16 sm:py-24 bg-slate-900/50 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Enterprise Architecture</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Integrated Master Data Management Modules
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Built specifically for Kosh Innovations manufacturing operations across injection moulding, corrugation, tooling, non-woven conversion, and assembly plants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-blue-950 border border-blue-800/50 text-blue-400 rounded-xl w-fit mb-4 group-hover:bg-blue-900 transition-colors">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Global Item Master & Rule Engine</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Centralized item definitions with rule-driven Global Item Code and Generated Description synthesis across Raw Materials (RM), Finished Goods (FG), Bought-Out (BO), Maintenance (MA), and 13 categories.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-emerald-950 border border-emerald-800/50 text-emerald-400 rounded-xl w-fit mb-4 group-hover:bg-emerald-900 transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Business Partner Master & GST Gate</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Complete Customer, Vendor/Supplier, and Lead management with GSTIN format verification, state-code mismatch save gate, contact persons, multi-address bill/ship structures, and payment terms.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-purple-950 border border-purple-800/50 text-purple-400 rounded-xl w-fit mb-4 group-hover:bg-purple-900 transition-colors">
                <Workflow className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Multi-Level Approval Workflows</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Sequential and parallel approval stages, maker-checker separation, quorum policy (ALL/ANY/N-of-M), conditional routing rules, SLA timers, delegations, and audit history.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-amber-950 border border-amber-800/50 text-amber-400 rounded-xl w-fit mb-4 group-hover:bg-amber-900 transition-colors">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Communication & WhatsApp Hub</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Centrally configured WhatsApp Business Platform sender (+91 98401 22320), verified recipient E.164 phone routing, email templates, delivery queues, webhooks, and consent governance.
              </p>
            </div>

            {/* Card 5 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-cyan-950 border border-cyan-800/50 text-cyan-400 rounded-xl w-fit mb-4 group-hover:bg-cyan-900 transition-colors">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">SAP Business One HANA Integration</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Service Layer connection profiles, mapping builder, automated scheduling, safe test harness, activation controls, idempotency locks, dead-letter recovery queues, and status reconciliation.
              </p>
            </div>

            {/* Card 6 */}
            <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all shadow-md group">
              <div className="p-3 bg-rose-950 border border-rose-800/50 text-rose-400 rounded-xl w-fit mb-4 group-hover:bg-rose-900 transition-colors">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Branch-Wise RBAC & Governance</h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Plant-scoped data isolation, temporary access grants, module enable/disable registry, user role administration, 2FA security policies, and immutable audit logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Governance Workflow Section */}
      <section id="workflow" className="py-16 sm:py-24 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest">End-to-End Control</h2>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Standardized Request-to-SAP Lifecycle
            </p>
            <p className="mt-3 text-sm text-slate-400">
              How master records move securely from initial draft creation to SAP Business One synchronization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center mb-3">1</span>
              <h4 className="text-sm font-bold text-white">Draft Creation</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Maker creates draft item or partner record. Category rules generate provisional code preview.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-cyan-600 text-white font-extrabold text-xs flex items-center justify-center mb-3">2</span>
              <h4 className="text-sm font-bold text-white">Automated Validation</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                System enforces uniqueness, field constraints, PAN/GST format checks, and duplicate detection.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center mb-3">3</span>
              <h4 className="text-sm font-bold text-white">Multi-Level Review</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Routed to authorized Checkers/Approvers per branch policy. Rejection requires mandatory reason.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center mb-3">4</span>
              <h4 className="text-sm font-bold text-white">Global Approval</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Permanent code allocated transactionally. Record approved for branch availability or SAP queue.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center mb-3">5</span>
              <h4 className="text-sm font-bold text-white">SAP Synchronization</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Durable outbox worker posts record to Service Layer, receiving CardCode/ItemCode confirmation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Compliance Section */}
      <section id="security" className="py-16 sm:py-24 bg-slate-900/50 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950 border border-purple-800/60 text-purple-300 text-xs font-semibold mb-4">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Enterprise Security Safeguards</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Zero-Trust Governance & Role Isolation
              </h2>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Kosh Innovations enforces strict server-validated RBAC, branch data isolation, and configurable email/WhatsApp two-factor authentication (2FA).
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Server-Side Authorization Enforcement</h4>
                    <p className="text-xs text-slate-400">All protected API routes validate token claims, branch assignments, and role permissions.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Maker-Checker Governance</h4>
                    <p className="text-xs text-slate-400">Item creators cannot approve their own item requests or bypass workflow stages.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Configurable 2FA Security</h4>
                    <p className="text-xs text-slate-400">Time-limited OTP verification for high-privilege administrative and checking actions.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Append-Only Audit Register</h4>
                    <p className="text-xs text-slate-400">Captures every login, approval, master change, rule update, and SAP job execution.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Security & RBAC Matrix Summary</h3>
                </div>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">v2.5.0 Policy</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-300 font-medium">Platform Admin</span>
                  <span className="text-cyan-400 font-mono text-[11px]">System Config, Modules, Security Policies</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-300 font-medium">Item Maker</span>
                  <span className="text-emerald-400 font-mono text-[11px]">Draft Creation, Branch Requests</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-300 font-medium">Item Checker / Approver</span>
                  <span className="text-purple-400 font-mono text-[11px]">Review, Approve, Reject, Return</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-300 font-medium">SAP Integration Specialist</span>
                  <span className="text-amber-400 font-mono text-[11px]">Profiles, Testing, Schedules, Activation</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-300 font-medium">Master Data Auditor</span>
                  <span className="text-blue-400 font-mono text-[11px]">Read-Only Governance & History Audit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Support Section */}
      <section id="support" className="py-16 sm:py-20 bg-slate-950 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 to-[#0B192C] border border-slate-800 rounded-3xl p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Need Help or Account Access?
                </h2>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                  My Kosh Innovations IT System accounts are provisioned directly by Organization Administrators. Self-service public signup is disabled in accordance with corporate security policy.
                </p>

                <div className="mt-6 space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Kosh Innovations Private Limited — Puducherry HQ & Main Plant</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>IT Governance Team: <strong className="text-white">support@koshinnovations.com</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>WhatsApp / Helpline: <strong className="text-white">+91 98401 22320</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                {isAuthenticated ? (
                  <button
                    onClick={onNavigateDashboard}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Go to Dashboard</span>
                  </button>
                ) : (
                  <button
                    onClick={onNavigateLogin}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Your Account</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigateRoute('/terms')}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Terms & Conditions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050D18] text-slate-400 py-12 text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800/80 pb-8">
            <div className="flex items-center gap-3">
              <BrandLogo size="md" />
              <div>
                <p className="text-sm font-bold text-white">KOSH INNOVATIONS</p>
                <p className="text-[11px] text-slate-400">My Kosh Innovations Global IT System</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-slate-400">
              <button onClick={() => onNavigateRoute('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
              <button onClick={() => onNavigateRoute('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
              <button onClick={() => onNavigateRoute('/support')} className="hover:text-white transition-colors cursor-pointer">Support</button>
              <a href="https://koshinnovations.com/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                <span>Corporate Website</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>© {new Date().getFullYear()} Kosh Innovations Pvt Ltd. All rights reserved. Confidential Internal System.</p>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">Build v2.5.0-PROD</span>
              <span className="text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>All Systems Operational</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
