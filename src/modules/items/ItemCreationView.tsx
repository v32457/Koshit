import React, { useState, useMemo } from 'react';
import { CLASSIFICATION_DIMENSIONS, INITIAL_ITEM_CODE_RULES, INITIAL_DESCRIPTION_RULES } from '../../data/seedData';
import { generateItemCode } from '../../services/itemCodeEngine';
import { generateItemDescription } from '../../services/itemDescriptionEngine';
import { GlobalItem, User, ItemCodeRule, ItemDescriptionRule } from '../../types';
import {
  FilePlus2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Send,
  X,
  Sparkles,
  Info,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Code,
  FileText,
  ChevronDown,
  ChevronUp,
  Settings2,
  Plus,
} from 'lucide-react';

import { ContextIndicatorBar } from '../../components/ContextIndicatorBar';
import { OperatingContext } from '../../services/operatingContextService';

interface ItemCreationViewProps {
  currentUser: User;
  operatingContext?: OperatingContext;
  globalItems?: GlobalItem[];
  onSaveDraft: (item: Partial<GlobalItem>) => void;
  onSubmitForApproval: (item: Partial<GlobalItem>) => void;
  onCancel: () => void;
}

export const ItemCreationView: React.FC<ItemCreationViewProps> = ({
  currentUser,
  operatingContext,
  globalItems = [],
  onSaveDraft,
  onSubmitForApproval,
  onCancel,
}) => {
  // Form State
  const [category, setCategory] = useState<string>('RM');
  const [material, setMaterial] = useState<string>('PA');
  const [type, setType] = useState<string>('O');
  const [materialForm, setMaterialForm] = useState<string>('PO');
  const [process, setProcess] = useState<string>('EX');
  const [colour, setColour] = useState<string>('LG');
  const [manufacturer, setManufacturer] = useState<string>('AE');
  const [dimensions, setDimensions] = useState<string>('12MM');
  const [partModelNumber, setPartModelNumber] = useState<string>('B0010');
  const [ratingSize, setRatingSize] = useState<string>('');
  const [specification, setSpecification] = useState<string>('Injection Grade V0');

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState<boolean | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // Interactive Classification Rule Builder State
  const [activeCodeRule, setActiveCodeRule] = useState<ItemCodeRule>(INITIAL_ITEM_CODE_RULES[0]);
  const [customDescPattern, setCustomDescPattern] = useState<string>('');
  const [descSeparator, setDescSeparator] = useState<string>(' – ');
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState<boolean>(true);
  const [activeRuleTab, setActiveRuleTab] = useState<'CODE' | 'DESC'>('CODE');

  // Dynamic Description Rule
  const activeDescRule = useMemo<ItemDescriptionRule>(() => {
    const defaultRule = INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === category);
    return {
      id: `desc-${category}`,
      categoryCode: category,
      templatePattern: customDescPattern || defaultRule?.templatePattern || '{MATERIAL} – {SPECIFICATION} – {COLOUR}',
      separator: descSeparator,
      maxLength: 150,
      version: 1,
      status: 'ACTIVE' as const,
      updatedAt: new Date().toISOString(),
    };
  }, [category, customDescPattern, descSeparator]);

  // Find Display Names for tokens
  const selectedMaterialObj = CLASSIFICATION_DIMENSIONS.material.values.find((v) => v.code === material);
  const selectedColourObj = CLASSIFICATION_DIMENSIONS.colour.values.find((v) => v.code === colour);
  const selectedFormObj = CLASSIFICATION_DIMENSIONS.materialForm.values.find((v) => v.code === materialForm);
  const selectedMfgObj = CLASSIFICATION_DIMENSIONS.manufacturer.values.find((v) => v.code === manufacturer);

  // Interactive Code Component Manipulation Handlers
  const handleToggleCodeComponent = (id: string) => {
    setActiveCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.id === id && !c.isRequired ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const handleMoveCodeComponent = (index: number, direction: 'UP' | 'DOWN') => {
    setActiveCodeRule((prev) => {
      const comps = [...prev.components];
      const targetIndex = direction === 'UP' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= comps.length) return prev;
      const temp = comps[index];
      comps[index] = comps[targetIndex];
      comps[targetIndex] = temp;
      const reordered = comps.map((c, idx) => ({ ...c, order: idx + 1 }));
      return { ...prev, components: reordered };
    });
  };

  const handleSetCodeSeparator = (sep: string) => {
    setActiveCodeRule((prev) => ({ ...prev, separator: sep }));
  };

  const handleSetSequencePadding = (padding: number) => {
    setActiveCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.sourceDimension === 'sequence' ? { ...c, padding } : c
      ),
    }));
  };

  const handleAddTokenToDesc = (token: string) => {
    const current = customDescPattern || activeDescRule.templatePattern;
    if (current.includes(token)) return;
    const updated = current ? `${current}${descSeparator}${token}` : token;
    setCustomDescPattern(updated);
  };

  const handleResetRules = () => {
    setActiveCodeRule(INITIAL_ITEM_CODE_RULES[0]);
    const defaultRule = INITIAL_DESCRIPTION_RULES.find((r) => r.categoryCode === category);
    setCustomDescPattern(defaultRule?.templatePattern || '{MATERIAL} – {SPECIFICATION} – {COLOUR}');
    setDescSeparator(' – ');
  };

  // Live Generated Provisional Item Code evaluated with dynamic activeCodeRule
  const generatedCodeResult = useMemo(() => {
    return generateItemCode(
      activeCodeRule,
      {
        categoryCode: category,
        materialCode: material,
        typeCode: type,
        materialFormCode: materialForm,
        processCode: process,
        colourCode: colour,
        manufacturerCode: manufacturer,
        sequenceNumber: 4, // Simulated next sequence
      },
      true // Provisional
    );
  }, [category, material, type, materialForm, process, colour, manufacturer, activeCodeRule]);

  // Live Generated Description evaluated with dynamic activeDescRule
  const generatedDescResult = useMemo(() => {
    return generateItemDescription(activeDescRule, {
      categoryCode: category,
      materialName: selectedMaterialObj?.name.split('–')[0].trim() || selectedMaterialObj?.name,
      specification: specification,
      colourName: selectedColourObj?.name,
      materialFormName: selectedFormObj?.name,
      dimensions: dimensions,
      manufacturerName: selectedMfgObj?.name,
      partModelNumber: partModelNumber,
      ratingSize: ratingSize,
    });
  }, [
    activeDescRule,
    category,
    selectedMaterialObj,
    specification,
    selectedColourObj,
    selectedFormObj,
    dimensions,
    selectedMfgObj,
    partModelNumber,
    ratingSize,
  ]);

  const handleValidate = () => {
    const errors: string[] = [];
    if (!category) errors.push('Category dimension selection is required.');
    if (!material) errors.push('Material dimension selection is required.');
    if (generatedCodeResult.errors && generatedCodeResult.errors.length > 0) {
      errors.push(...generatedCodeResult.errors);
    }
    if (!specification.trim()) {
      errors.push('Specification / Key Item Name is required.');
    }

    const codeMaxLength = 50;
    if (generatedCodeResult.length > codeMaxLength) {
      errors.push(`Generated Item Code length (${generatedCodeResult.length}) exceeds max limit of ${codeMaxLength} characters.`);
    }

    if (generatedDescResult.length > activeDescRule.maxLength) {
      errors.push(`Generated Item Description length (${generatedDescResult.length}) exceeds max limit of ${activeDescRule.maxLength} characters.`);
    }

    // Duplicate Item Code Collision Check
    if (globalItems && globalItems.length > 0) {
      const duplicate = globalItems.find(
        (i) => i.globalItemCode.toLowerCase() === generatedCodeResult.code.toLowerCase()
      );
      if (duplicate) {
        errors.push(`Duplicate Item Code Conflict: "${generatedCodeResult.code}" already exists in the Global Item Master database.`);
      }
    }

    setValidationErrors(errors);
    const isValid = errors.length === 0;
    setValidationSuccess(isValid);
    setIsValidationModalOpen(true);
    return isValid;
  };

  const handleSubmit = (actionType: 'DRAFT' | 'SUBMIT') => {
    if (actionType === 'SUBMIT') {
      const isValid = handleValidate();
      if (!isValid) return;
    }

    const payload: Partial<GlobalItem> = {
      globalItemCode: generatedCodeResult.code,
      isProvisionalCode: actionType === 'DRAFT',
      categoryCode: category,
      description: generatedDescResult.description,
      status: actionType === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
      attributes: {
        material,
        type,
        materialForm,
        process,
        colour,
        manufacturer,
        dimensions,
        partModelNumber,
        ratingSize,
        specification,
      },
      createdBy: currentUser.id,
      codeRuleVersion: activeCodeRule.version,
      descRuleVersion: activeDescRule.version,
    };

    if (actionType === 'DRAFT') {
      onSaveDraft(payload);
    } else {
      onSubmitForApproval(payload);
      setIsSubmittedSuccess(true);
      setIsValidationModalOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Operating Context Badge Indicator */}
      {operatingContext && <ContextIndicatorBar context={operatingContext} className="mb-1" />}

      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Item Creation Form</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              Rule Engine Active v1
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create global manufacturing master item with automated code and description generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit('DRAFT')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button
            onClick={handleValidate}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Validate Rules
          </button>
          <button
            onClick={() => handleSubmit('SUBMIT')}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Submit for Checker Approval
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {isSubmittedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">Item Successfully Submitted for Checker Approval!</div>
              <div className="text-xs text-emerald-700">
                Item Code: <strong className="font-mono">{generatedCodeResult.code}</strong> has entered the Checker Queue. Segregated maker-checker rules prevent self-approval.
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsSubmittedSuccess(false)}
            className="text-xs font-semibold underline text-emerald-800 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inline Validation Result Banners */}
      {validationSuccess === true && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-xs text-emerald-900">100% Rule Engine Validation Passed!</div>
              <div className="text-[11px] text-emerald-700">
                Generated Item Code <strong className="font-mono">{generatedCodeResult.code}</strong> and Description are fully compliant with active rules (v{activeCodeRule.version} / v{activeDescRule.version}).
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsValidationModalOpen(true)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-xs"
          >
            View Audit Report
          </button>
        </div>
      )}

      {validationSuccess === false && validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3.5 rounded-xl space-y-1 text-xs shadow-xs">
          <div className="font-bold flex items-center gap-1.5 text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Validation Requirements Failed ({validationErrors.length} Issue{validationErrors.length > 1 ? 's' : ''})
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700 pl-2">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Banner: Real-Time Live Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Item Code Live Preview */}
        <div className="bg-gradient-to-br from-slate-900 to-[#0B192C] text-white p-4 rounded-xl border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Generated Item Code
            </span>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Provisional Preview
            </span>
          </div>

          <div className="text-xl lg:text-2xl font-mono font-black text-cyan-300 tracking-wider py-1.5 break-all">
            {generatedCodeResult.code || '—'}
          </div>

          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-1 border-t border-slate-800 pt-2">
            <span>Length: <strong className="text-white font-mono">{generatedCodeResult.length}</strong> / 50 chars</span>
            <span>•</span>
            <span>Sequence Scope: <strong className="text-white">Category ({category})</strong></span>
            <span>•</span>
            <span className="text-slate-500 italic">Atomic counter assigned on approval</span>
          </div>
        </div>

        {/* Item Description Live Preview */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              Generated Item Description
            </span>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded">
              Pattern: {activeDescRule.templatePattern}
            </span>
          </div>

          <div className="text-sm lg:text-base font-semibold text-slate-900 py-1.5 min-h-[38px]">
            {generatedDescResult.description || <span className="text-slate-400 italic">Enter item fields below...</span>}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
            <span>Normalized: <strong className="text-slate-700 font-mono">{generatedDescResult.length}</strong> / {activeDescRule.maxLength} chars</span>
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Clean Delimiters
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Classification Rule Builder Accordion Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl border border-indigo-900/50 shadow-md text-white overflow-hidden">
        {/* Accordion Header */}
        <div
          onClick={() => setIsRuleBuilderOpen((prev) => !prev)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-amber-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Interactive Classification Rule Builder</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Live Sync Active
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Customize active code components, component order, separators, and description template tokens live.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleResetRules();
              }}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              Reset Defaults
            </button>
            <div className="text-slate-400 hover:text-white transition">
              {isRuleBuilderOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>

        {/* Expanded Rule Configuration Controls */}
        {isRuleBuilderOpen && (
          <div className="p-4 border-t border-indigo-900/60 bg-slate-950/60 space-y-4">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveRuleTab('CODE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeRuleTab === 'CODE'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Item Code Structure Rule
              </button>
              <button
                type="button"
                onClick={() => setActiveRuleTab('DESC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeRuleTab === 'DESC'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Item Description Pattern Rule
              </button>
            </div>

            {/* TAB 1: CODE RULE STRUCTURE */}
            {activeRuleTab === 'CODE' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    Toggle dimensions or use <ArrowUp className="w-3 h-3 text-cyan-400" /> / <ArrowDown className="w-3 h-3 text-cyan-400" /> arrows to reorder component sequence:
                  </span>

                  <div className="flex items-center gap-4">
                    {/* Separator Picker */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Separator:</span>
                      <select
                        value={activeCodeRule.separator}
                        onChange={(e) => handleSetCodeSeparator(e.target.value)}
                        className="bg-slate-800 text-cyan-300 font-mono text-xs border border-slate-700 rounded px-2 py-1 focus:outline-none"
                      >
                        <option value="">None (Concatenated)</option>
                        <option value="-">- (Hyphen)</option>
                        <option value="_">_ (Underscore)</option>
                        <option value="/">/ (Slash)</option>
                      </select>
                    </div>

                    {/* Sequence Padding Picker */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Seq Padding:</span>
                      <select
                        value={activeCodeRule.components.find((c) => c.sourceDimension === 'sequence')?.padding || 4}
                        onChange={(e) => handleSetSequencePadding(Number(e.target.value))}
                        className="bg-slate-800 text-cyan-300 font-mono text-xs border border-slate-700 rounded px-2 py-1 focus:outline-none"
                      >
                        <option value={3}>3 Digits (001)</option>
                        <option value={4}>4 Digits (0001)</option>
                        <option value={5}>5 Digits (00001)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Interactive Component Chips List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {activeCodeRule.components.map((comp, idx) => (
                    <div
                      key={comp.id}
                      className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition ${
                        comp.enabled
                          ? 'bg-slate-900 border-cyan-500/40 text-white shadow-xs'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <input
                          type="checkbox"
                          checked={comp.enabled}
                          disabled={comp.isRequired}
                          onChange={() => handleToggleCodeComponent(comp.id)}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="truncate">
                          <div className="font-bold flex items-center gap-1 text-slate-200">
                            <span>{comp.name}</span>
                            {comp.isRequired && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded">Req</span>
                            )}
                          </div>
                          <div className="text-[10px] text-cyan-400 font-mono">
                            Order {comp.order}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveCodeComponent(idx, 'UP')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Move Left/Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === activeCodeRule.components.length - 1}
                          onClick={() => handleMoveCodeComponent(idx, 'DOWN')}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          title="Move Right/Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: DESCRIPTION PATTERN RULE */}
            {activeRuleTab === 'DESC' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Template Pattern Input */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Description Template Pattern:
                    </label>
                    <input
                      type="text"
                      value={customDescPattern || activeDescRule.templatePattern}
                      onChange={(e) => setCustomDescPattern(e.target.value)}
                      placeholder="{MATERIAL} – {SPECIFICATION} – {COLOUR}"
                      className="w-full text-xs font-mono p-2 bg-slate-900 border border-slate-700 text-cyan-300 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Separator Picker */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">
                      Segment Separator:
                    </label>
                    <select
                      value={descSeparator}
                      onChange={(e) => setDescSeparator(e.target.value)}
                      className="w-full text-xs font-mono p-2 bg-slate-900 border border-slate-700 text-cyan-300 rounded-lg focus:outline-none"
                    >
                      <option value=" – "> – (En-Dash with spaces)</option>
                      <option value=" - "> - (Hyphen with spaces)</option>
                      <option value=", ">, (Comma with space)</option>
                      <option value=" | "> | (Pipe symbol)</option>
                    </select>
                  </div>
                </div>

                {/* Token Quick-Add Chips */}
                <div>
                  <span className="text-xs text-slate-400 font-medium block mb-1.5">
                    Click tokens to append to template pattern:
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
                      '{RATING_SIZE}',
                    ].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => handleAddTokenToDesc(token)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-900 text-cyan-300 border border-slate-700 text-[11px] font-mono transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-amber-400" />
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Structured Master Fields Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-6">
        <div>
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Core Classification Dimensions (Master Dropdowns)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                {CLASSIFICATION_DIMENSIONS.category.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>

            {/* Material */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Material <span className="text-rose-500">*</span>
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              >
                {CLASSIFICATION_DIMENSIONS.material.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— None —</option>
                {CLASSIFICATION_DIMENSIONS.type.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>

            {/* Material Form */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Material Form
              </label>
              <select
                value={materialForm}
                onChange={(e) => setMaterialForm(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— None —</option>
                {CLASSIFICATION_DIMENSIONS.materialForm.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>

            {/* Process */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Process
              </label>
              <select
                value={process}
                onChange={(e) => setProcess(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— None —</option>
                {CLASSIFICATION_DIMENSIONS.process.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>

            {/* Colour */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Colour
              </label>
              <select
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">— None —</option>
                {CLASSIFICATION_DIMENSIONS.colour.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Standard Item Specifications */}
        <div>
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
            Item Specifications & Dimensions (User Inputs)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {/* Specification / Key Specification */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Specification / Key Specification / Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={specification}
                onChange={(e) => setSpecification(e.target.value)}
                placeholder="e.g. Injection Grade V0, Corrugated Automotive Sleeve"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Merged Dimensions & Rating / Size / Thickness / GSM / Cavity / Capacity */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dimensions / Rating / Size / Thickness / GSM / Cavity / Capacity
              </label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => {
                  setDimensions(e.target.value);
                  setRatingSize(e.target.value);
                }}
                placeholder="e.g. 12MM, 25 x 40 x 120 mm, 10 Bar, 180 GSM, 4 Cavity, 2.5mm Wall"
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Separate Custom Specifications */}
        <div>
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">3</span>
            Separate Custom Specifications
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
            {/* Customer / Manufacturer / Brand (Master) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Customer / Manufacturer / Brand (Master)
              </label>
              <select
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs font-medium"
              >
                <option value="">— None —</option>
                {CLASSIFICATION_DIMENSIONS.manufacturer.values.map((v) => (
                  <option key={v.code} value={v.code}>{v.display}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Master-linked customer OEM or manufacturer identity.
              </p>
            </div>

            {/* Customer /Part / Model Number */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Customer / Part / Model Number
              </label>
              <input
                type="text"
                value={partModelNumber}
                onChange={(e) => setPartModelNumber(e.target.value)}
                placeholder="e.g. B0010, DIX001, DSNU-25"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs font-medium"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Customer-specific drawing, catalog part number, or equipment model.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Form Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-6 bg-slate-50 p-4 rounded-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit('DRAFT')}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
            <button
              onClick={handleValidate}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Validate Rules
            </button>
            <button
              onClick={() => handleSubmit('SUBMIT')}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-white" />
              Submit for Checker Approval
            </button>
          </div>
        </div>
      </div>

      {/* Rule Engine Validation Audit Modal */}
      {isValidationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base text-white">Rule Engine Validation Audit Report</h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Declarative Rule Evaluation v1.0.0 — Category: <span className="text-cyan-300 font-semibold">{category}</span>
                </p>
              </div>
              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Overall Status Box */}
              {validationSuccess ? (
                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-emerald-900">100% Rule Engine Validation Passed</div>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      All item code rules, description template parameters, character limits, and collision checks passed without any errors or warnings.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-rose-900">Validation Action Required</div>
                    <div className="text-xs text-rose-700 mt-0.5">
                      The rule evaluator identified {validationErrors.length} issue(s) that must be resolved before submission.
                    </div>
                  </div>
                </div>
              )}

              {/* Errors List if any */}
              {validationErrors.length > 0 && (
                <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-lg space-y-1 text-xs">
                  <div className="font-bold text-rose-800">Detected Issues:</div>
                  <ul className="list-disc list-inside space-y-1 text-rose-700 pl-1">
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rule Checklist Matrix */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                  <span>Audit Checkpoint</span>
                  <span>Evaluation Result</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {/* Check 1 */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">1. Mandatory Classification Dimensions</div>
                      <div className="text-[11px] text-slate-500">Category: {category || '—'} | Material: {material || '—'}</div>
                    </div>
                    {category && material ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">PASS</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">FAIL</span>
                    )}
                  </div>

                  {/* Check 2 */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">2. Item Code Pattern Evaluation</div>
                      <div className="text-[11px] text-slate-500">Rule Version {activeCodeRule.version} ({activeCodeRule.name})</div>
                    </div>
                    {generatedCodeResult.errors.length === 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">PASS</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">FAIL</span>
                    )}
                  </div>

                  {/* Check 3 */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">3. Item Code Length Limit</div>
                      <div className="text-[11px] text-slate-500">{generatedCodeResult.length} / 50 max allowed characters</div>
                    </div>
                    {generatedCodeResult.length <= 50 ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">PASS</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">EXCEEDED</span>
                    )}
                  </div>

                  {/* Check 4 */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">4. Item Description Template Rules</div>
                      <div className="text-[11px] text-slate-500">{generatedDescResult.length} / {activeDescRule.maxLength} max allowed characters</div>
                    </div>
                    {generatedDescResult.length <= activeDescRule.maxLength && specification.trim() ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">PASS</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">FAIL</span>
                    )}
                  </div>

                  {/* Check 5 */}
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">5. Master Database Code Collision Check</div>
                      <div className="text-[11px] text-slate-500">Evaluated against {globalItems.length} active master items</div>
                    </div>
                    {!globalItems.some(i => i.globalItemCode.toLowerCase() === generatedCodeResult.code.toLowerCase()) ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">PASS (UNIQUE)</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">COLLISION</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Generated Output Preview Box */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Validated Item Code Preview</span>
                  <div className="font-mono text-cyan-300 font-bold text-sm tracking-wider">{generatedCodeResult.code}</div>
                </div>
                <div className="border-t border-slate-800 pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Validated Item Description Preview</span>
                  <div className="text-slate-200 font-medium">{generatedDescResult.description}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setIsValidationModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Close Audit Report
              </button>

              {validationSuccess && (
                <button
                  onClick={() => handleSubmit('SUBMIT')}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Proceed & Submit for Checker Approval
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
