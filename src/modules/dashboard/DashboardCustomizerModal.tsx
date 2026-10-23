import React, { useState } from 'react';
import {
  DashboardDefinition,
  DashboardWidgetConfig,
} from '../../types';
import {
  AVAILABLE_WIDGET_CATALOGUE,
  DATA_SOURCE_CATALOGUE,
} from '../../data/dashboardCatalogue';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  BookOpen,
  LayoutGrid,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface DashboardCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDashboard: DashboardDefinition;
  onSaveDashboard: (updated: DashboardDefinition) => void;
  onResetDefault: () => void;
}

export const DashboardCustomizerModal: React.FC<DashboardCustomizerModalProps> = ({
  isOpen,
  onClose,
  currentDashboard,
  onSaveDashboard,
  onResetDefault,
}) => {
  const [activeTab, setActiveTab] = useState<'LAYOUT' | 'CATALOGUE' | 'GLOSSARY'>('LAYOUT');
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>([...currentDashboard.widgets]);
  const [dashboardName, setDashboardName] = useState(currentDashboard.name);
  const [audienceScope, setAudienceScope] = useState(currentDashboard.audienceScope);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  // Move widget up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...widgets];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    // re-index order
    updated.forEach((w, idx) => (w.order = idx + 1));
    setWidgets(updated);
  };

  // Move widget down
  const handleMoveDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const updated = [...widgets];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    updated.forEach((w, idx) => (w.order = idx + 1));
    setWidgets(updated);
  };

  // Toggle widget enable
  const handleToggleEnable = (id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isEnabled: !w.isEnabled } : w))
    );
  };

  // Change grid span
  const handleChangeSpan = (id: string, span: 1 | 2 | 3 | 4 | 6 | 12) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, gridSpan: span } : w))
    );
  };

  // Change chart type
  const handleChangeChartType = (id: string, chartType: any) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, chartType } : w))
    );
  };

  // Remove widget
  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  // Add widget from catalogue
  const handleAddWidget = (candidate: DashboardWidgetConfig) => {
    if (widgets.some((w) => w.id === candidate.id)) return;
    const newWidget: DashboardWidgetConfig = {
      ...candidate,
      order: widgets.length + 1,
      isEnabled: true,
    };
    setWidgets([...widgets, newWidget]);
    setActiveTab('LAYOUT');
  };

  // Save changes
  const handleSave = () => {
    const updated: DashboardDefinition = {
      ...currentDashboard,
      name: dashboardName,
      audienceScope,
      version: currentDashboard.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Suresh Kumar (Platform Admin)',
      widgets: widgets.map((w, idx) => ({ ...w, order: idx + 1 })),
    };
    onSaveDashboard(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#0B192C] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/30 border border-blue-400/30 text-cyan-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Enterprise Dashboard Administration
                </h3>
                <span className="text-[10px] bg-blue-900 text-blue-200 border border-blue-700 px-2 py-0.5 rounded-full font-mono">
                  Version {currentDashboard.version}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Section 5: Config-Driven Dynamic Widgets, Chart Visualizers & Metric Governance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 bg-slate-50 border-b border-slate-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('LAYOUT')}
              className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'LAYOUT'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Active Widgets & Layout ({widgets.length})
            </button>

            <button
              onClick={() => setActiveTab('CATALOGUE')}
              className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'CATALOGUE'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              Widget Catalogue ({AVAILABLE_WIDGET_CATALOGUE.length})
            </button>

            <button
              onClick={() => setActiveTab('GLOSSARY')}
              className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'GLOSSARY'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Metric Glossary & Data Lineage
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onResetDefault}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-slate-200"
              title="Reset to corporate master layout"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Layout
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'LAYOUT' && (
            <div className="space-y-4">
              {/* Dashboard Metadata Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Dashboard Name
                  </label>
                  <input
                    type="text"
                    value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Audience Scope & RBAC Filtering
                  </label>
                  <select
                    value={audienceScope}
                    onChange={(e) => setAudienceScope(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ORG_DEFAULT">ORG_DEFAULT — Organization Wide Master</option>
                    <option value="ROLE_SCOPED">ROLE_SCOPED — Role Tailored</option>
                    <option value="BRANCH_SCOPED">BRANCH_SCOPED — Branch Filtered</option>
                    <option value="PERSONAL">PERSONAL — User Customized</option>
                  </select>
                </div>
              </div>

              {/* Widget List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                  <span>Arrange & Configure Active Widgets</span>
                  <span>12-Column Grid Span & Display Format</span>
                </div>

                <div className="space-y-2">
                  {widgets.map((widget, index) => {
                    const ds = DATA_SOURCE_CATALOGUE.find((d) => d.id === widget.dataSourceId);
                    return (
                      <div
                        key={widget.id}
                        className={`p-3 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                          widget.isEnabled
                            ? 'bg-white border-slate-200 shadow-xs'
                            : 'bg-slate-100/70 border-slate-200 opacity-60'
                        }`}
                      >
                        {/* Left: Reorder & Info */}
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handleMoveUp(index)}
                              disabled={index === 0}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(index)}
                              disabled={index === widgets.length - 1}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {widget.title}
                              </span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                                {widget.widgetType}
                              </span>
                              {widget.isMandatory && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                                  Mandatory
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Source: <span className="font-mono text-slate-700">{ds?.name || widget.dataSourceId}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Span, Chart Type, Toggle & Delete */}
                        <div className="flex items-center gap-3">
                          {/* Grid Span */}
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400 text-[10px] font-semibold">Width:</span>
                            <select
                              value={widget.gridSpan}
                              onChange={(e) => handleChangeSpan(widget.id, Number(e.target.value) as any)}
                              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium"
                            >
                              <option value={2}>2 Col (1/6 Width)</option>
                              <option value={3}>3 Col (1/4 Width)</option>
                              <option value={4}>4 Col (1/3 Width)</option>
                              <option value={6}>6 Col (Half Width)</option>
                              <option value={12}>12 Col (Full Width)</option>
                            </select>
                          </div>

                          {/* Supported Chart Types */}
                          {ds && ds.supportedChartTypes.length > 1 && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400 text-[10px] font-semibold">Type:</span>
                              <select
                                value={widget.chartType || 'card'}
                                onChange={(e) => handleChangeChartType(widget.id, e.target.value)}
                                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium capitalize"
                              >
                                {ds.supportedChartTypes.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Enable/Disable Toggle */}
                          <button
                            onClick={() => handleToggleEnable(widget.id)}
                            className={`px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
                              widget.isEnabled
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {widget.isEnabled ? 'Visible' : 'Hidden'}
                          </button>

                          {/* Delete */}
                          {!widget.isMandatory && (
                            <button
                              onClick={() => handleRemoveWidget(widget.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Remove widget"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CATALOGUE' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Widget Catalogue (Section 5.4 Compliance):</span>{' '}
                  Select pre-approved analytical modules to add to your operating dashboard. All widgets draw directly from validated Kosh Item Master and SAP telemetry data sources.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_WIDGET_CATALOGUE.map((item) => {
                  const isAlreadyAdded = widgets.some((w) => w.id === item.id);
                  const ds = DATA_SOURCE_CATALOGUE.find((d) => d.id === item.dataSourceId);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{item.title}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {item.widgetType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500">
                          Data Lineage: <span className="font-mono text-blue-700">{ds?.name}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          Default Span: {item.gridSpan} Cols
                        </span>
                        <button
                          onClick={() => handleAddWidget(item)}
                          disabled={isAlreadyAdded}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                            isAlreadyAdded
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                          }`}
                        >
                          {isAlreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" /> Add to Dashboard
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'GLOSSARY' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <span className="font-bold">Metric Governance & Calculation Lineage:</span> Per Section 5.3, no dashboard metric may be rendered without clear calculation semantics, authorization roles, and update frequency.
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Metric / Data Source</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Calculation Expression</th>
                      <th className="p-2.5">Supported Views</th>
                      <th className="p-2.5">Freshness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {DATA_SOURCE_CATALOGUE.map((ds) => (
                      <tr key={ds.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{ds.name}</div>
                          <div className="text-[11px] text-slate-500">{ds.description}</div>
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold">
                            {ds.category}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <code className="text-[11px] font-mono bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded">
                            {ds.metricDefinition}
                          </code>
                        </td>
                        <td className="p-2.5 capitalize text-slate-600">
                          {ds.supportedChartTypes.join(', ')}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">
                          {ds.freshnessSec}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Changes will take effect immediately and create Dashboard v{currentDashboard.version + 1}.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" /> Layout Saved!
                </>
              ) : (
                'Save & Publish Layout'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
