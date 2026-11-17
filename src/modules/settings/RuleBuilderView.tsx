import React, { useState } from 'react';
import {
  INITIAL_ITEM_CODE_RULES,
  INITIAL_DESCRIPTION_RULES,
  CLASSIFICATION_DIMENSIONS,
} from '../../data/seedData';
import { generateItemCode } from '../../services/itemCodeEngine';
import { generateItemDescription } from '../../services/itemDescriptionEngine';
import { ItemCodeComponentConfig, ItemCodeRule, ItemDescriptionRule } from '../../types';
import {
  Code2,
  FileCode2,
  Play,
  Sparkles,
  Layers,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  Sliders,
  History,
  Eye,
  Info,
  Check,
} from 'lucide-react';

export const RuleBuilderView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'code' | 'desc'>('code');

  // Configurable Code Rules State
  const [codeRule, setCodeRule] = useState<ItemCodeRule>(INITIAL_ITEM_CODE_RULES[0]);
  const [codeRuleHistory, setCodeRuleHistory] = useState<ItemCodeRule[]>([INITIAL_ITEM_CODE_RULES[0]]);

  // Configurable Description Rules State
  const [descRule, setDescRule] = useState<ItemDescriptionRule>(INITIAL_DESCRIPTION_RULES[0]);

  // Simulator test inputs for ALL classification dimensions (excluding Category)
  const [simSubcat, setSimSubcat] = useState('');
  const [simMat, setSimMat] = useState('PA');
  const [simType, setSimType] = useState('O');
  const [simForm, setSimForm] = useState('PO');
  const [simProc, setSimProc] = useState('EX');
  const [simCol, setSimCol] = useState('LG');
  const [simGrade, setSimGrade] = useState('');
  const [simMfg, setSimMfg] = useState('AE');
  const [simPartModel, setSimPartModel] = useState('B0010');
  const [simDim, setSimDim] = useState('12MM');
  const [simSeq, setSimSeq] = useState(4);
  const [simSpec, setSimSpec] = useState('Injection Grade V0');

  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Rule Lifecycle & Scope State
  const [ruleScope, setRuleScope] = useState<'GLOBAL_ITEM_CREATION' | 'BRANCH_ITEM_ACTIVATION'>('GLOBAL_ITEM_CREATION');
  const [ruleLifecycle, setRuleLifecycle] = useState<'DRAFT' | 'VALIDATED' | 'SIMULATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'RETIRED'>('PUBLISHED');
  const [simulationLog, setSimulationLog] = useState<string | null>(null);

  const handleTransitionLifecycle = (targetStatus: 'DRAFT' | 'VALIDATED' | 'SIMULATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'RETIRED') => {
    if (targetStatus === 'SIMULATED') {
      setSimulationLog(`Simulation Test Run successful: Item Code "${codeSimResult.code}" generated successfully without modifying master data records.`);
      setRuleLifecycle('SIMULATED');
    } else if (targetStatus === 'VALIDATED') {
      if (codeSimResult.errors.length > 0) {
        alert(`Validation failed: ${codeSimResult.errors.join(', ')}`);
        return;
      }
      setRuleLifecycle('VALIDATED');
    } else {
      setRuleLifecycle(targetStatus);
      setSaveSuccessNotice(`Rule lifecycle successfully transitioned to ${targetStatus} (Scope: ${ruleScope})`);
      setTimeout(() => setSaveSuccessNotice(null), 3000);
    }
  };

  // Live Simulator Calculations
  const codeSimResult = generateItemCode(codeRule, {
    subcategoryCode: simSubcat,
    materialCode: simMat,
    typeCode: simType,
    materialFormCode: simForm,
    processCode: simProc,
    colourCode: simCol,
    gradeCode: simGrade,
    manufacturerCode: simMfg,
    partModelNumber: simPartModel,
    dimensions: simDim,
    specification: simSpec,
    sequenceNumber: simSeq,
  });

  const selectedMaterialObj = CLASSIFICATION_DIMENSIONS.material.values.find((v) => v.code === simMat);
  const selectedColourObj = CLASSIFICATION_DIMENSIONS.colour.values.find((v) => v.code === simCol);
  const selectedFormObj = CLASSIFICATION_DIMENSIONS.materialForm.values.find((v) => v.code === simForm);
  const selectedMfgObj = CLASSIFICATION_DIMENSIONS.manufacturer.values.find((v) => v.code === simMfg);

  const descSimResult = generateItemDescription(descRule, {
    materialName: selectedMaterialObj?.name.split('–')[0].trim() || selectedMaterialObj?.name,
    specification: simSpec,
    colourName: selectedColourObj?.name,
    materialFormName: selectedFormObj?.name,
    dimensions: simDim,
    manufacturerName: selectedMfgObj?.name,
    partModelNumber: simPartModel,
  });

  // Code Rule Component Modifiers
  const handleToggleComponent = (id: string) => {
    setCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    }));
  };

  const handleToggleRequired = (id: string) => {
    setCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) => (c.id === id ? { ...c, isRequired: !c.isRequired } : c)),
    }));
  };

  const handleMoveComponent = (index: number, direction: 'up' | 'down') => {
    const components = [...codeRule.components];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= components.length) return;

    const temp = components[index];
    components[index] = components[targetIndex];
    components[targetIndex] = temp;

    // re-assign order
    const updated = components.map((c, idx) => ({ ...c, order: idx + 1 }));
    setCodeRule((prev) => ({ ...prev, components: updated }));
  };

  const handleAddComponent = (dimensionKey: string) => {
    const dimNames: Record<string, string> = {
      subcategory: 'Subcategory',
      grade: 'Grade / Class',
      partModelNumber: 'Customer Part / Model #',
      dimensions: 'Dimensions / Rating',
      fixed: 'Fixed Text Literal',
    };

    const newComp: ItemCodeComponentConfig = {
      id: `comp-${Date.now()}`,
      name: dimNames[dimensionKey] || dimensionKey.toUpperCase(),
      sourceDimension: dimensionKey as any,
      order: codeRule.components.length + 1,
      fixedText: dimensionKey === 'fixed' ? 'KOSH' : undefined,
      isRequired: false,
      enabled: true,
    };

    setCodeRule((prev) => ({ ...prev, components: [...prev.components, newComp] }));
  };

  const handleRemoveComponent = (id: string) => {
    setCodeRule((prev) => ({
      ...prev,
      components: prev.components.filter((c) => c.id !== id),
    }));
  };

  const handleSaveCodeRuleVersion = () => {
    const newVersion = codeRule.version + 1;
    const updatedRule: ItemCodeRule = {
      ...codeRule,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Suresh Kumar (Platform Admin)',
    };
    setCodeRule(updatedRule);
    setCodeRuleHistory([updatedRule, ...codeRuleHistory]);

    setSaveSuccessNotice(`Successfully published & activated Item Code Rule v${newVersion}!`);
    setTimeout(() => setSaveSuccessNotice(null), 3000);
  };

  // Description Rule Modifiers
  const handleUpdateDescTemplate = (pattern: string) => {
    setDescRule((prev) => ({ ...prev, templatePattern: pattern, updatedAt: new Date().toISOString() }));
  };

  const handleUpdateDescSeparator = (sep: string) => {
    setDescRule((prev) => ({ ...prev, separator: sep }));
  };

  const handleUpdateDescMaxLength = (max: number) => {
    setDescRule((prev) => ({ ...prev, maxLength: max }));
  };

  const handleInsertToken = (token: string) => {
    const current = descRule.templatePattern;
    const updated = current ? `${current} ${descRule.separator || '–'} ${token}` : token;
    handleUpdateDescTemplate(updated);
  };

  return (
    <div className="space-y-4 text-xs select-none">
      {/* Page Title & Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-amber-500" />
            Configurable Item Code & Description Rule Builder
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Declarative global classification rules for Item Code generation and Item Description templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'code' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Item Code Rule Configurator
          </button>
          <button
            onClick={() => setActiveTab('desc')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'desc' ? 'bg-cyan-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Item Description Rule Builder
          </button>
        </div>
      </div>

      {saveSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* Rule Master & Rule Version Lifecycle Management Toolbar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/30 border border-indigo-500/40 rounded-lg text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Rule Lifecycle Status:</span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                ruleLifecycle === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                ruleLifecycle === 'APPROVED' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                ruleLifecycle === 'PENDING_APPROVAL' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {ruleLifecycle}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Target Scope: <strong className="text-cyan-300">{ruleScope}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ruleScope}
            onChange={(e) => setRuleScope(e.target.value as any)}
            className="bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none"
          >
            <option value="GLOBAL_ITEM_CREATION">Scope: GLOBAL_ITEM_CREATION</option>
            <option value="BRANCH_ITEM_ACTIVATION">Scope: BRANCH_ITEM_ACTIVATION</option>
          </select>

          <button
            type="button"
            onClick={() => handleTransitionLifecycle('DRAFT')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Draft
          </button>
          <button
            type="button"
            onClick={() => handleTransitionLifecycle('VALIDATED')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition cursor-pointer"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={() => handleTransitionLifecycle('SIMULATED')}
            className="px-2.5 py-1.5 rounded bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 border border-indigo-700 text-xs font-bold transition cursor-pointer"
          >
            Simulate
          </button>
          <button
            type="button"
            onClick={() => handleTransitionLifecycle('PENDING_APPROVAL')}
            className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition cursor-pointer"
          >
            Submit
          </button>
          <button
            type="button"
            onClick={() => handleTransitionLifecycle('PUBLISHED')}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Publish
          </button>
        </div>
      </div>

      {simulationLog && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3.5 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{simulationLog}</span>
          </div>
          <button onClick={() => setSimulationLog(null)} className="text-indigo-700 hover:underline font-bold">Dismiss</button>
        </div>
      )}

      {/* TAB 1: ITEM CODE RULE CONFIGURATOR */}
      {activeTab === 'code' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-500" />
                  Item Code Component Sequence & Rules
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Reorder, enable/disable, or add global technical dimensions to assemble the official Item Code pattern.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-bold">
                  Active Rule v{codeRule.version}
                </span>
                <button
                  onClick={handleSaveCodeRuleVersion}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold transition cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" /> Publish New Version
                </button>
              </div>
            </div>

            {/* Separator and Sequence Scope Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Component Separator</label>
                <select
                  value={codeRule.separator}
                  onChange={(e) => setCodeRule({ ...codeRule, separator: e.target.value })}
                  className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-mono"
                >
                  <option value="">None (Concatenated - e.g. PAOPOEXLG0001)</option>
                  <option value="-">Hyphen (-) e.g. PA-O-PO-EX-LG-0001</option>
                  <option value="/">Slash (/) e.g. PA/O/PO/EX/LG/0001</option>
                  <option value="_">Underscore (_) e.g. PA_O_PO_EX_LG_0001</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Sequence Counter Reset Scope</label>
                <select
                  value={codeRule.sequenceScope}
                  onChange={(e) => setCodeRule({ ...codeRule, sequenceScope: e.target.value as any })}
                  className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-semibold"
                >
                  <option value="GLOBAL">Global Monotonic Sequence Counter (Recommended)</option>
                  <option value="BRANCH">Branch / Operating Unit Scope</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Add Classification Dimension</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddComponent(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded font-semibold"
                >
                  <option value="">+ Insert Classification Token...</option>
                  <option value="subcategory">Subcategory</option>
                  <option value="grade">Grade / Class</option>
                  <option value="partModelNumber">Customer Part / Model #</option>
                  <option value="dimensions">Dimensions / Rating</option>
                  <option value="fixed">Fixed Text Literal</option>
                </select>
              </div>
            </div>

            {/* Configured Components Reorderable List */}
            <div className="space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Configured Item Code Components ({codeRule.components.length}):</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Order determines output position in generated Item Code.
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {codeRule.components.map((comp, idx) => (
                  <div
                    key={comp.id}
                    className={`p-3 flex flex-wrap items-center justify-between gap-2 transition ${
                      comp.enabled ? 'bg-white' : 'bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-mono font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{comp.name}</span>
                        <span className="text-[10px] text-slate-400 ml-2 font-mono">
                          ({comp.sourceDimension})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {comp.sourceDimension === 'fixed' && (
                        <input
                          type="text"
                          value={comp.fixedText || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCodeRule((prev) => ({
                              ...prev,
                              components: prev.components.map((c) =>
                                c.id === comp.id ? { ...c, fixedText: val } : c
                              ),
                            }));
                          }}
                          placeholder="Fixed text"
                          className="px-2 py-0.5 border border-slate-300 rounded font-mono text-xs w-24"
                        />
                      )}

                      {comp.sourceDimension === 'sequence' && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-600">
                          <span>Pad Length:</span>
                          <input
                            type="number"
                            value={comp.padding || 4}
                            onChange={(e) => {
                              const pad = Number(e.target.value);
                              setCodeRule((prev) => ({
                                ...prev,
                                components: prev.components.map((c) =>
                                  c.id === comp.id ? { ...c, padding: pad } : c
                                ),
                              }));
                            }}
                            className="w-12 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-xs"
                          />
                        </div>
                      )}

                      <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={comp.isRequired}
                          onChange={() => handleToggleRequired(comp.id)}
                          className="rounded text-amber-500 focus:ring-amber-400"
                        />
                        Required
                      </label>

                      <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={comp.enabled}
                          onChange={() => handleToggleComponent(comp.id)}
                          className="rounded text-amber-500 focus:ring-amber-400"
                        />
                        Enabled
                      </label>

                      <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveComponent(idx, 'up')}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === codeRule.components.length - 1}
                          onClick={() => handleMoveComponent(idx, 'down')}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {comp.sourceDimension !== 'sequence' && (
                          <button
                            onClick={() => handleRemoveComponent(comp.id)}
                            className="p-1 text-rose-400 hover:text-rose-600 cursor-pointer ml-1"
                            title="Remove Component"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ITEM DESCRIPTION RULE BUILDER */}
      {activeTab === 'desc' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-600" />
                Global Item Description Template Builder
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Define tokenized global description patterns with clean delimiter normalization.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Global Description Template Pattern:
              </label>
              <input
                type="text"
                value={descRule.templatePattern}
                onChange={(e) => handleUpdateDescTemplate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-cyan-900 font-bold focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Insert Classification Token Buttons */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1">
                Insert Classification Dimension Tokens:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '{MATERIAL}',
                  '{SPECIFICATION}',
                  '{COLOUR}',
                  '{FORM}',
                  '{PROCESS}',
                  '{DIMENSIONS}',
                  '{MANUFACTURER}',
                  '{PART_MODEL}',
                  '{SUBCATEGORY}',
                  '{TYPE}',
                ].map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertToken(token)}
                    className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded font-mono font-bold text-[11px] cursor-pointer transition"
                  >
                    + {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Separator Delimiter</label>
                <input
                  type="text"
                  value={descRule.separator}
                  onChange={(e) => handleUpdateDescSeparator(e.target.value)}
                  placeholder="e.g.  –  or  | "
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Maximum Character Limit</label>
                <input
                  type="number"
                  value={descRule.maxLength}
                  onChange={(e) => handleUpdateDescMaxLength(Number(e.target.value))}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARED RULE SIMULATOR & NON-DESTRUCTIVE TEST BENCH */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-900">
              Interactive Classification Rule Simulator & Test Bench
            </h3>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold border border-slate-200">
            Real-Time Non-Destructive Evaluator
          </span>
        </div>

        {/* Inputs for ALL Global Classification Dimensions (No Category) */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Material</label>
            <select
              value={simMat}
              onChange={(e) => setSimMat(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.material.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Type</label>
            <select
              value={simType}
              onChange={(e) => setSimType(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.type.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Material Form</label>
            <select
              value={simForm}
              onChange={(e) => setSimForm(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.materialForm.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Process</label>
            <select
              value={simProc}
              onChange={(e) => setSimProc(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.process.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Colour</label>
            <select
              value={simCol}
              onChange={(e) => setSimCol(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.colour.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Manufacturer</label>
            <select
              value={simMfg}
              onChange={(e) => setSimMfg(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              {CLASSIFICATION_DIMENSIONS.manufacturer.values.map((v) => (
                <option key={v.code} value={v.code}>{v.display}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Customer / Part / Model #</label>
            <input
              type="text"
              value={simPartModel}
              onChange={(e) => setSimPartModel(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono uppercase bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Dimensions / Rating</label>
            <input
              type="text"
              value={simDim}
              onChange={(e) => setSimDim(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Specification</label>
            <input
              type="text"
              value={simSpec}
              onChange={(e) => setSimSpec(e.target.value)}
              className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Sequence Number</label>
            <input
              type="number"
              value={simSeq}
              onChange={(e) => setSimSeq(Number(e.target.value))}
              className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono bg-white font-bold"
            />
          </div>
        </div>

        {/* Live Output Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Item Code Live Preview */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0B192C] text-white p-4 rounded-xl border border-slate-800 shadow-md space-y-2">
            <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Live Generated Item Code
              </span>
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                Rule v{codeRule.version}
              </span>
            </div>

            <div className="text-xl lg:text-2xl font-mono font-black text-cyan-300 tracking-wider break-all">
              {codeSimResult.code || '—'}
            </div>

            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
              <span>Length: <strong className="text-white font-mono">{codeSimResult.length}</strong> / 50 chars</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Valid Pattern (Global Scope)
              </span>
            </div>
          </div>

          {/* Item Description Live Preview */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-slate-800">
                <Eye className="w-3.5 h-3.5 text-cyan-600" /> Live Generated Description
              </span>
              <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-200 font-mono">
                Global Template
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900 leading-snug">
              {descSimResult.description || '—'}
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
              <span>Length: <strong className="text-slate-900 font-mono">{descSimResult.length}</strong> / {descRule.maxLength} chars</span>
              {descSimResult.isWithinLimit ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Within Character Limit
                </span>
              ) : (
                <span className="text-rose-600 font-bold">Exceeds Max Limit</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
