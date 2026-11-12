import React, { useState } from 'react';
import {
  Layers,
  FileText,
  TrendingUp,
  Award,
  BookOpen,
  ShoppingBag,
  PackageCheck,
  CheckCircle2,
  Clock,
  Building,
  Brain,
  Search,
  Plus,
  BarChart3,
  Sliders,
  DollarSign,
  Zap,
} from 'lucide-react';
import { User } from '../../types';
import { rfqPolicyService } from '../../services/rfqPolicyService';
import { futureRfqFloatingService } from '../../services/futureRfqFloatingService';
import { rfqService } from '../../services/rfqService';
import { vendorPriceRegisterService } from '../../services/vendorPriceRegisterService';
import { purchasePriceBookService } from '../../services/purchasePriceBookService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { localLlmService } from '../../services/localLlmService';

interface ProcurementDashboardViewProps {
  currentUser: User;
  onNavigate: (route: string) => void;
}

export const ProcurementDashboardView: React.FC<ProcurementDashboardViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [selectedCompany] = useState('co-kosh-01');
  const rfqPolicy = rfqPolicyService.getEffectivePolicy(selectedCompany);
  const demandItems = futureRfqFloatingService.getDemandItems();
  const rfqs = rfqService.getRfqs();
  const priceAgreements = vendorPriceRegisterService.getAgreements();
  const priceBooks = purchasePriceBookService.getPriceBooks();
  const pos = purchaseOrderService.getPOs();
  const regModels = localLlmService.getRegisteredModels();

  const activeDemandCount = demandItems.filter(d => d.sourcingStatus === 'APPROVED_PR' || d.sourcingStatus === 'SCHEDULED').length;
  const activeRfqCount = rfqs.filter(r => r.status === 'RELEASED' || r.status === 'QUOTATIONS_IN_PROGRESS' || r.status === 'UNDER_TECHNICAL_EVALUATION').length;
  const pendingPoApprovalCount = pos.filter(p => p.status === 'PENDING_APPROVAL').length;
  const activeLlmCount = regModels.filter(m => m.status === 'RUNNING').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Layers className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Enterprise RFQ & Sourcing Control Tower</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                  Live System
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Central Sourcing Governance • Dual UOM • Local AI Examiner • Multi-Vendor Allocation
              </p>
            </div>
          </div>
        </div>

        {/* Policy Status Badge */}
        <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 p-3 rounded-xl">
          <Building className="w-5 h-5 text-indigo-400" />
          <div className="text-xs">
            <div className="text-slate-400 font-medium">Operating Context Policy</div>
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <span className={`w-2 h-2 rounded-full ${rfqPolicy.policyMode === 'RFQ_ENABLED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>
                {rfqPolicy.policyMode === 'RFQ_ENABLED'
                  ? 'RFQ MANDATORY (Award Price Register)'
                  : rfqPolicy.policyMode === 'RFQ_OPTIONAL'
                  ? 'RFQ OPTIONAL / HYBRID (With Exemptions)'
                  : 'RFQ DISABLED (Price Book)'}
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigate('/settings/general/rfq')}
            className="ml-2 px-2.5 py-1 text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
          >
            Configure
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('/procurement/future-floating')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Future RFQ Demand</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{activeDemandCount}</span>
            <span className="text-xs text-blue-600 font-medium">PR Demand Queue</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">PR lines queued for sourcing floating</p>
        </div>

        <div
          onClick={() => onNavigate('/procurement/rfqs')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-indigo-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active RFQs</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{activeRfqCount}</span>
            <span className="text-xs text-indigo-600 font-medium">{rfqs.length} Total RFQs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Quotations & evaluation in progress</p>
        </div>

        <div
          onClick={() => onNavigate('/procurement/purchase-orders')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-amber-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending PO Approvals</span>
            <ShoppingBag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{pendingPoApprovalCount}</span>
            <span className="text-xs text-amber-600 font-medium">Split Allocations</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">PO approval queue with override audit</p>
        </div>

        <div
          onClick={() => onNavigate('/settings/local-llm')}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:border-emerald-300 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Local AI Runtimes</span>
            <Brain className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{activeLlmCount}</span>
            <span className="text-xs text-emerald-600 font-medium">Local Examiner</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active registered LLM inference models</p>
        </div>
      </div>

      {/* Main Sourcing Navigation Hub */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span>Procurement & Sourcing Subsystem Modules</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('/procurement/future-floating')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition">
              <Clock className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Future RFQ Floating</div>
              <div className="text-[11px] text-slate-500">PR Demand Sourcing & Price Benchmark</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/rfqs')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-purple-100 text-purple-700 rounded-lg group-hover:scale-105 transition">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Create & Manage RFQs</div>
              <div className="text-[11px] text-slate-500">RFQs & Supplier Invitations</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/quotations')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-cyan-100 text-cyan-700 rounded-lg group-hover:scale-105 transition">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Supplier Quotations</div>
              <div className="text-[11px] text-slate-500">Submissions & Sealed Prices</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/comparative-statement')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition">
              <BarChart3 className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Comparative Statement</div>
              <div className="text-[11px] text-slate-500">Landed Cost & Evaluated Score</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/price-register')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-teal-100 text-teal-700 rounded-lg group-hover:scale-105 transition">
              <Award className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Vendor Item Price Register</div>
              <div className="text-[11px] text-slate-500">Approved RFQ Award Agreements</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/price-book')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-amber-100 text-amber-700 rounded-lg group-hover:scale-105 transition">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Purchase Price Book</div>
              <div className="text-[11px] text-slate-500">Tiered Pricing & Discounts</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/purchase-orders')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg group-hover:scale-105 transition">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Purchase Orders & Allocations</div>
              <div className="text-[11px] text-slate-500">Split Allocations & Overrides</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/goods-receipt')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition">
              <PackageCheck className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Goods Receipt & UOM</div>
              <div className="text-[11px] text-slate-500">Purch UOM to Inv UOM Posting</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/settings/general/rfq')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-slate-200 text-slate-700 rounded-lg group-hover:scale-105 transition">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">RFQ Policy Configuration</div>
              <div className="text-[11px] text-slate-500">General Settings → RFQ (Company & Branch)</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/settings/local-llm')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-indigo-100 text-indigo-700 rounded-lg group-hover:scale-105 transition">
              <Brain className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Local LLM Management</div>
              <div className="text-[11px] text-slate-500">Download, Register & Deploy</div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('/procurement/reports')}
            className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl transition text-left group"
          >
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600">Procurement Reports & Audit</div>
              <div className="text-[11px] text-slate-500">Excel / CSV / PDF Exports</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
