/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PHASE 10 — PURCHASE REQUISITION-ALIGNED GLOBAL ITEM CREATION VIEW
 * Features:
 * - PR-aligned header, breadcrumbs, and compact 6-point contextual summary strip
 * - 8 numbered expandable/collapsible sections preserving all state when collapsed:
 *   1. Core Global Classification Dimensions (Material, Item Type, Material Form, Process, Colour)
 *   2. Technical Specifications & Physical Dimensions
 *   3. Manufacturer, Brand & Customer Part References
 *   4. Global UOM & Conversion Governance
 *   5. Global Item Code Rule & Structure Configuration
 *   6. Global Item Description Rule & Template Configuration
 *   7. Global Technical Attachments & Engineering Documentation
 *   8. Global Duplicate Detection & 14-Checkpoint Rule Audit Summary
 * - Sticky / consistent footer actions: Cancel, Save Draft, Validate Rules, Submit for Checker Approval
 */

import React, { useState, useMemo } from 'react';
import {
  CLASSIFICATION_DIMENSIONS,
  INITIAL_ITEM_CODE_RULES,
  INITIAL_DESCRIPTION_RULES,
} from '../../data/seedData';
import { generateItemCode } from '../../services/itemCodeEngine';
import { generateItemDescription } from '../../services/itemDescriptionEngine';
import {
  GlobalItem,
  User,
  ItemCodeRule,
  ItemDescriptionRule,
  BuyerAssignmentRecord,
  RoundingRule,
} from '../../types';
import { uomConversionService } from '../../services/uomConversionService';
import {
  evaluateGlobalItemCreationAudit,
  checkLocalDuplicates,
} from '../../services/itemRuleAndAuditService';
import {
  FilePlus2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Save,
  Send,
  X,
  Sparkles,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Code,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Paperclip,
  Scale,
  Factory,
  Layers,
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

interface GlobalEngineeringAttachment {
  id: string;
  documentType: 'DATASHEET' | 'ENGINEERING_DRAWING' | 'MATERIAL_SPEC' | 'TEST_PROTOCOL';
  fileName: string;
  version: string;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
}

export const ItemCreationView: React.FC<ItemCreationViewProps> = ({
  currentUser,
  operatingContext,
  globalItems = [],
  onSaveDraft,
  onSubmitForApproval,
  onCancel,
}) => {
  // Expandable/Collapsible State for all 8 Required Sections
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
    8: true,
  });

  const toggleSection = (secNum: number) => {
    setExpandedSections((prev) => ({ ...prev, [secNum]: !prev[secNum] }));
  };

  const expandAllSections = () => {
    setExpandedSections({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true });
  };

  const collapseAllSections = () => {
    setExpandedSections({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
      8: false,
    });
  };

  // Section 1: Core Global Classification Dimensions (Zero Category Dependency)
  const [material, setMaterial] = useState<string>('PA');
  const [type, setType] = useState<string>('O');
  const [materialForm, setMaterialForm] = useState<string>('PO');
  const [process, setProcess] = useState<string>('EX');
  const [colour, setColour] = useState<string>('LG');

  // Section 2: Technical Specifications & Dimensions
  const [specification, setSpecification] = useState<string>('Injection Grade V0');
  const [dimensions, setDimensions] = useState<string>('12MM');
  const [ratingSize, setRatingSize] = useState<string>('12MM');

  // Section 3: Manufacturer, Brand & Customer Part References
  const [manufacturer, setManufacturer] = useState<string>('AE');
  const [partModelNumber, setPartModelNumber] = useState<string>('B0010');
  const [assignedBuyer] = useState<BuyerAssignmentRecord | null>(null);

  // Section 4: Global UOM & Conversion Governance
  const [purchaseUom, setPurchaseUom] = useState<string>('KG');
  const [inventoryUom, setInventoryUom] = useState<string>('KG');
  const [conversionNumerator, setConversionNumerator] = useState<number>(1);
  const [conversionDenominator, setConversionDenominator] = useState<number>(1);
  const [decimalPrecision, setDecimalPrecision] = useState<number>(3);
  const [roundingRule, setRoundingRule] = useState<RoundingRule>('NONE');
  const [densityFactor, setDensityFactor] = useState<number>(1.0);

  // Section 5 & 6: Global Item Code & Description Rules
  const [activeCodeRule, setActiveCodeRule] = useState<ItemCodeRule>(INITIAL_ITEM_CODE_RULES[0]);
  const [customDescPattern, setCustomDescPattern] = useState<string>('');
  const [descSeparator, setDescSeparator] = useState<string>(' – ');

  // Section 7: Global Technical Attachments & Engineering Documentation
  const [attachments, setAttachments] = useState<GlobalEngineeringAttachment[]>([
    {
      id: 'att-init-1',
      documentType: 'DATASHEET',
      fileName: 'Global_Material_Technical_Datasheet_v1.pdf',
      version: 'v1.0',
      description: 'Baseline global polymer/material engineering datasheet',
      uploadedBy: currentUser.fullName,
      uploadedAt: new Date().toISOString().slice(0, 10),
    },
  ]);
  const [newAttType, setNewAttType] =
    useState<GlobalEngineeringAttachment['documentType']>('ENGINEERING_DRAWING');
  const [newAttFileName, setNewAttFileName] = useState('');
  const [newAttVersion, setNewAttVersion] = useState('v1.0');
  const [newAttDesc, setNewAttDesc] = useState('');

  // Validation & Audit State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState<boolean | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState<boolean>(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  const touchModified = () => {
    setLastModifiedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const uomMasterList = useMemo(() => uomConversionService.getUoms(false), []);

  const uomValidation = useMemo(() => {
    return uomConversionService.validateUomConversion({
      purchaseUom,
      inventoryUom,
      numerator: conversionNumerator,
      denominator: conversionDenominator,
      densityFactor,
      requiresDensityBasis: true,
      decimalPrecision,
    });
  }, [
    purchaseUom,
    inventoryUom,
    conversionNumerator,
    conversionDenominator,
    densityFactor,
    decimalPrecision,
  ]);

  // Dynamic Description Rule
  const activeDescRule = useMemo<ItemDescriptionRule>(() => {
    const defaultRule = INITIAL_DESCRIPTION_RULES[0];
    return {
      id: 'desc-global',
      categoryCode: 'GLOBAL',
      templatePattern:
        customDescPattern ||
        defaultRule?.templatePattern ||
        '{MATERIAL} – {SPECIFICATION} – {COLOUR}',
      separator: descSeparator,
      maxLength: 150,
      version: 1,
      status: 'ACTIVE' as const,
      updatedAt: new Date().toISOString(),
    };
  }, [customDescPattern, descSeparator]);

  const materialDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).MATERIAL;
  const typeDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).ITEM_TYPE;
  const formDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).FORM;
  const processDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).PROCESS;
  const colourDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).COLOUR;
  const mfgDim = (CLASSIFICATION_DIMENSIONS as Record<string, any>).MANUFACTURER;

  const selectedMaterialObj = materialDim?.values?.find((v: any) => v.code === material);
  const selectedColourObj = colourDim?.values?.find((v: any) => v.code === colour);
  const selectedFormObj = formDim?.values?.find((v: any) => v.code === materialForm);
  const selectedMfgObj = mfgDim?.values?.find((v: any) => v.code === manufacturer);

  // Interactive Code Component Manipulation Handlers
  const handleToggleCodeComponent = (id: string) => {
    touchModified();
    setActiveCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.id === id && !c.isRequired ? { ...c, enabled: !c.enabled } : c
      ),
    }));
  };

  const handleMoveCodeComponent = (index: number, direction: 'UP' | 'DOWN') => {
    touchModified();
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
    touchModified();
    setActiveCodeRule((prev) => ({ ...prev, separator: sep }));
  };

  const handleSetSequencePadding = (padding: number) => {
    touchModified();
    setActiveCodeRule((prev) => ({
      ...prev,
      components: prev.components.map((c) =>
        c.sourceDimension === 'sequence' ? { ...c, padding } : c
      ),
    }));
  };

  const handleAddTokenToDesc = (token: string) => {
    touchModified();
    const current = customDescPattern || activeDescRule.templatePattern;
    if (current.includes(token)) return;
    const updated = current ? `${current}${descSeparator}${token}` : token;
    setCustomDescPattern(updated);
  };

  const handleResetRules = () => {
    touchModified();
    setActiveCodeRule(INITIAL_ITEM_CODE_RULES[0]);
    const defaultRule = INITIAL_DESCRIPTION_RULES[0];
    setCustomDescPattern(
      defaultRule?.templatePattern || '{MATERIAL} – {SPECIFICATION} – {COLOUR}'
    );
    setDescSeparator(' – ');
  };

  const handleAddAttachment = () => {
    if (!newAttFileName.trim()) return;
    touchModified();
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        documentType: newAttType,
        fileName: newAttFileName.trim(),
        version: newAttVersion.trim() || 'v1.0',
        description: newAttDesc.trim() || 'Global engineering specification attachment',
        uploadedBy: currentUser.fullName,
        uploadedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewAttFileName('');
    setNewAttDesc('');
  };

  const handleRemoveAttachment = (id: string) => {
    touchModified();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Live Generated Provisional Item Code
  const generatedCodeResult = useMemo(() => {
    return generateItemCode(
      activeCodeRule,
      {
        MATERIAL: material,
        ITEM_TYPE: type,
        FORM: materialForm,
        PROCESS: process,
        COLOUR: colour,
        MANUFACTURER: manufacturer,
        materialCode: material,
        typeCode: type,
        materialFormCode: materialForm,
        processCode: process,
        colourCode: colour,
        manufacturerCode: manufacturer,
        sequenceNumber: 4,
      },
      true
    );
  }, [material, type, materialForm, process, colour, manufacturer, activeCodeRule]);

  // Live Generated Description
  const generatedDescResult = useMemo(() => {
    return generateItemDescription(activeDescRule, {
      MATERIAL: selectedMaterialObj?.label || material,
      SPECIFICATION: specification,
      COLOUR: selectedColourObj?.label || colour,
      FORM: selectedFormObj?.label || materialForm,
      DIMENSIONS: dimensions,
      MANUFACTURER: selectedMfgObj?.label || manufacturer,
      PART_MODEL: partModelNumber,
      RATING_SIZE: ratingSize,
      materialName: selectedMaterialObj?.label || material,
      specification,
      colourName: selectedColourObj?.label || colour,
      materialFormName: selectedFormObj?.label || materialForm,
      dimensions,
      manufacturerName: selectedMfgObj?.label || manufacturer,
      partModelNumber,
      ratingSize,
    });
  }, [
    activeDescRule,
    selectedMaterialObj,
    material,
    specification,
    selectedColourObj,
    colour,
    selectedFormObj,
    materialForm,
    dimensions,
    selectedMfgObj,
    manufacturer,
    partModelNumber,
    ratingSize,
  ]);

  // Live Duplicate Detection & 14-Checkpoint Global Audit Report
  const duplicateCheckResult = useMemo(() => {
    return checkLocalDuplicates(
      {
        globalItemCode: generatedCodeResult.code,
        description: generatedDescResult.description,
        attributes: {
          MATERIAL: material,
          ITEM_TYPE: type,
          FORM: materialForm,
          PROCESS: process,
          COLOUR: colour,
          MANUFACTURER: manufacturer,
          SPECIFICATION: specification,
          DIMENSIONS: dimensions,
          PART_MODEL: partModelNumber,
        },
      },
      globalItems
    );
  }, [
    generatedCodeResult.code,
    generatedDescResult.description,
    material,
    type,
    materialForm,
    process,
    colour,
    manufacturer,
    specification,
    dimensions,
    partModelNumber,
    globalItems,
  ]);

  const globalAuditReport = useMemo(() => {
    return evaluateGlobalItemCreationAudit(
      {
        entityId: 'DRAFT-NEW-ITEM',
        globalItemCode: generatedCodeResult.code,
        description: generatedDescResult.description,
        attributes: {
          MATERIAL: material,
          ITEM_TYPE: type,
          FORM: materialForm,
          PROCESS: process,
          COLOUR: colour,
          MANUFACTURER: manufacturer,
          SPECIFICATION: specification,
          DIMENSIONS: dimensions,
          PART_MODEL: partModelNumber,
        },
        defaultPurchaseUom: purchaseUom,
        defaultInventoryUom: inventoryUom,
        conversionFactor: uomValidation.normalizedFactor,
        conversionNumerator,
        conversionDenominator,
        conversionPrecision: decimalPrecision,
        roundingRule,
        codeRuleVersion: activeCodeRule.version,
        descRuleVersion: activeDescRule.version,
      },
      globalItems,
      currentUser.fullName
    );
  }, [
    generatedCodeResult.code,
    generatedDescResult.description,
    material,
    type,
    materialForm,
    process,
    colour,
    manufacturer,
    specification,
    dimensions,
    partModelNumber,
    purchaseUom,
    inventoryUom,
    uomValidation.normalizedFactor,
    conversionNumerator,
    conversionDenominator,
    decimalPrecision,
    roundingRule,
    activeCodeRule.version,
    activeDescRule.version,
    globalItems,
    currentUser.fullName,
  ]);

  const handleValidate = () => {
    const errors: string[] = [];
    if (!material) errors.push('Material dimension selection is required.');
    if (generatedCodeResult.errors && generatedCodeResult.errors.length > 0) {
      errors.push(...generatedCodeResult.errors);
    }
    if (!specification.trim()) {
      errors.push('Specification / Key Item Name is required.');
    }
    if (generatedCodeResult.length > 50) {
      errors.push(
        `Generated Item Code length (${generatedCodeResult.length}) exceeds max limit of 50 characters.`
      );
    }
    if (generatedDescResult.length > activeDescRule.maxLength) {
      errors.push(
        `Generated Item Description length (${generatedDescResult.length}) exceeds max limit of ${activeDescRule.maxLength} characters.`
      );
    }
    if (!uomValidation.valid) {
      errors.push(...uomValidation.errors);
    }
    if (!globalAuditReport.canSubmit) {
      errors.push(...globalAuditReport.errors.map((e: any) => (typeof e === 'string' ? e : e.message)));
    }

    setValidationErrors(Array.from(new Set(errors)));
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
      description: generatedDescResult.description,
      status: actionType === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
      attributes: {
        MATERIAL: material,
        ITEM_TYPE: type,
        FORM: materialForm,
        PROCESS: process,
        COLOUR: colour,
        MANUFACTURER: manufacturer,
        DIMENSIONS: dimensions,
        PART_MODEL: partModelNumber,
        RATING_SIZE: ratingSize,
        SPECIFICATION: specification,
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
      defaultPurchaseUom: purchaseUom,
      defaultInventoryUom: inventoryUom,
      defaultUomConversion: {
        fromUomCode: purchaseUom,
        toUomCode: inventoryUom,
        numerator: conversionNumerator,
        denominator: conversionDenominator,
        conversionFactor: uomValidation.normalizedFactor,
        decimalPrecision,
        roundingRule,
        densityFactor,
        isActive: true,
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
    <div className="space-y-4 text-xs pb-8">
      {operatingContext && <ContextIndicatorBar context={operatingContext} compact />}

      {/* PR-Aligned Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold mb-0.5">
            <span>Item Master Governance</span>
            <span>/</span>
            <span>Global Item Master</span>
            <span>/</span>
            <span className="text-indigo-600 font-bold">Create Global Item</span>
          </div>
          <div className="flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-900">
              Create Global Item Master Record
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Global Monotonic Rule v{activeCodeRule.version}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Define global technical identity, UOM conversion baseline, and rule-governed item code/description (8 Structured Sections).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expandAllSections}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Expand All (8)
          </button>
          <button
            type="button"
            onClick={collapseAllSections}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Collapse All
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Validate Rules</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('SUBMIT')}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for Checker Approval</span>
          </button>
        </div>
      </div>

      {/* Compact 6-Point Contextual Summary Strip (Phase 10 Requirement) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            1. Creation Status
          </span>
          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
            {isSubmittedSuccess ? 'SUBMITTED' : 'DRAFT IN PROGRESS'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-900 text-white border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-cyan-400 block">
            2. Provisional Global Code
          </span>
          <span className="font-mono font-bold text-xs text-amber-300 truncate block mt-0.5">
            {generatedCodeResult.code || '—'}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            3. Branch Applicability
          </span>
          <span className="font-bold text-indigo-700 text-[11px] block mt-0.5 truncate">
            Global Scope Only (Stage 1)
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            4. Validation Status
          </span>
          <span
            className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              globalAuditReport.overallResult === 'PASS' && uomValidation.valid
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : globalAuditReport.overallResult === 'WARNING' && uomValidation.valid
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {uomValidation.valid ? globalAuditReport.overallResult : 'UOM ERROR'} (
            {globalAuditReport.checkpoints.filter((c) => c.status === 'PASS').length}/14)
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            5. Approval Workflow
          </span>
          <span className="font-bold text-slate-800 text-[11px] block mt-0.5">
            Dual Maker-Checker (Stage 1)
          </span>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            6. Last Modified Info
          </span>
          <span className="font-medium text-slate-700 text-[11px] block mt-0.5 truncate">
            {currentUser.fullName} • {lastModifiedAt}
          </span>
        </div>
      </div>

      {/* Live Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-slate-900 to-[#0B192C] text-white p-3.5 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Generated Global Item Code
            </span>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              Provisional Preview
            </span>
          </div>
          <div className="text-lg lg:text-xl font-mono font-black text-cyan-300 tracking-wider py-1 break-all">
            {generatedCodeResult.code || '—'}
          </div>
          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-1.5">
            <span>
              Length: <strong className="text-white font-mono">{generatedCodeResult.length}</strong> / 50
            </span>
            <span>•</span>
            <span>
              Scope: <strong className="text-white">GLOBAL MONOTONIC</strong>
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              Live Normalized Item Description
            </span>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded">
              Pattern: {activeDescRule.templatePattern}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 py-1 min-h-[30px]">
            {generatedDescResult.description || '—'}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>
              Length: <strong className="text-slate-700 font-mono">{generatedDescResult.length}</strong> / {activeDescRule.maxLength}
            </span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Zero Category Tokens
            </span>
          </div>
        </div>
      </div>

      {/* Inline Validation / Submission Alerts */}
      {isSubmittedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-xs">
                Global Item Submitted for Stage 1 Checker Approval!
              </div>
              <div className="text-[11px] text-emerald-700">
                Item Code <strong className="font-mono">{generatedCodeResult.code}</strong> is queued in the Dual Approval Inbox.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSubmittedSuccess(false)}
            className="text-xs font-bold underline text-emerald-800 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {validationSuccess === false && validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 p-3.5 rounded-xl space-y-1 text-xs">
          <div className="font-bold flex items-center gap-1.5 text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            Validation Requirements Failed ({validationErrors.length} Issue
            {validationErrors.length > 1 ? 's' : ''})
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700 pl-2">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: CORE GLOBAL CLASSIFICATION DIMENSIONS
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(1)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 1: Core Global Classification Dimensions
              </h3>
              <p className="text-[11px] text-slate-500">
                Material, Item Type, Material Form, Process, and Colour (Global identity only — no Category).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              {material ? 'Configured' : 'Required'}
            </span>
            {expandedSections[1] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[1] && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Material <span className="text-rose-500">*</span>
              </label>
              <select
                value={material}
                onChange={(e) => {
                  touchModified();
                  setMaterial(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                {(materialDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Item Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => {
                  touchModified();
                  setType(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="">— Select Item Type —</option>
                {(typeDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Material Form <span className="text-rose-500">*</span>
              </label>
              <select
                value={materialForm}
                onChange={(e) => {
                  touchModified();
                  setMaterialForm(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="">— Select Material Form —</option>
                {(formDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Process</label>
              <select
                value={process}
                onChange={(e) => {
                  touchModified();
                  setProcess(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="">— None —</option>
                {(processDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Colour</label>
              <select
                value={colour}
                onChange={(e) => {
                  touchModified();
                  setColour(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="">— None —</option>
                {(colourDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 2: TECHNICAL SPECIFICATIONS & PHYSICAL DIMENSIONS
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(2)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              2
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 2: Technical Specifications & Physical Dimensions
              </h3>
              <p className="text-[11px] text-slate-500">
                Engineering specification, grade, physical dimensions, rating, thickness, GSM, or capacity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                specification.trim()
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {specification.trim() ? 'Valid' : 'Specification Required'}
            </span>
            {expandedSections[2] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[2] && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Specification / Key Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={specification}
                onChange={(e) => {
                  touchModified();
                  setSpecification(e.target.value);
                }}
                placeholder="e.g. Injection Grade V0, Corrugated Automotive Sleeve"
                className={`w-full text-xs p-2 border rounded-lg font-medium ${
                  !specification.trim()
                    ? 'border-rose-400 bg-rose-50/30'
                    : 'border-slate-300 bg-white'
                }`}
              />
              {!specification.trim() && (
                <p className="text-[11px] text-rose-600 font-semibold mt-1">
                  Specification is mandatory for Global Item Creation.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Physical Dimensions <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => {
                  touchModified();
                  setDimensions(e.target.value);
                }}
                placeholder="e.g. 12MM, 2000x1000x3mm"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Rating / Size / Thickness / GSM / Capacity
              </label>
              <input
                type="text"
                value={ratingSize}
                onChange={(e) => {
                  touchModified();
                  setRatingSize(e.target.value);
                }}
                placeholder="e.g. 10 Bar, 180 GSM, 4 Cavity, 2.5mm Wall"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 3: MANUFACTURER, BRAND & CUSTOMER PART REFERENCES
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(3)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              3
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 3: Manufacturer, Brand & Customer Part References
              </h3>
              <p className="text-[11px] text-slate-500">
                OEM Manufacturer / Brand identity, MPN / Customer Part Number, and baseline buyer routing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-indigo-600" />
            {expandedSections[3] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[3] && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Customer / Manufacturer / Brand (Master)
              </label>
              <select
                value={manufacturer}
                onChange={(e) => {
                  touchModified();
                  setManufacturer(e.target.value);
                }}
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                <option value="">— None —</option>
                {(mfgDim?.values || []).map((v: any) => (
                  <option key={v.code} value={v.code}>
                    {v.code} – {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Customer / Manufacturer Part / Model Number
              </label>
              <input
                type="text"
                value={partModelNumber}
                onChange={(e) => {
                  touchModified();
                  setPartModelNumber(e.target.value);
                }}
                placeholder="e.g. B0010, DIX001, DSNU-25"
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Default Global Sourcing Buyer Reference
              </label>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                {assignedBuyer
                  ? assignedBuyer.buyerName
                  : 'Governed per Branch Activation (Section C)'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 4: GLOBAL UOM & CONVERSION GOVERNANCE
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(4)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              4
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 4: Global UOM & Conversion Governance
              </h3>
              <p className="text-[11px] text-slate-500">
                Mandatory Default Purchase UOM, Default Inventory / Base UOM, exact conversion arithmetic, precision, and rounding rule.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                uomValidation.valid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              1 {purchaseUom} = {uomValidation.normalizedFactor} {inventoryUom} (
              {uomValidation.valid ? 'VALID' : 'INVALID'})
            </span>
            {expandedSections[4] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[4] && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Default Purchase UOM <span className="text-rose-500">*</span>
                </label>
                <select
                  value={purchaseUom}
                  onChange={(e) => {
                    touchModified();
                    setPurchaseUom(e.target.value);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  {uomMasterList.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code} — {u.name} [{u.dimension}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Default Inventory / Base UOM <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inventoryUom}
                  onChange={(e) => {
                    touchModified();
                    setInventoryUom(e.target.value);
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-xs"
                >
                  {uomMasterList.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code} — {u.name} [{u.dimension}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Conversion Numerator
                </label>
                <input
                  type="number"
                  value={conversionNumerator}
                  onChange={(e) => {
                    touchModified();
                    setConversionNumerator(Number(e.target.value) || 1);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Conversion Denominator
                </label>
                <input
                  type="number"
                  value={conversionDenominator}
                  onChange={(e) => {
                    touchModified();
                    setConversionDenominator(Number(e.target.value) || 1);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">
                    Effective Conversion Factor
                  </span>
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    1 {purchaseUom} = {uomValidation.normalizedFactor} {inventoryUom}
                  </span>
                </div>
                <Scale className="w-4 h-4 text-indigo-600" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Decimal Precision
                </label>
                <select
                  value={decimalPrecision}
                  onChange={(e) => {
                    touchModified();
                    setDecimalPrecision(Number(e.target.value));
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                >
                  <option value={0}>0 Decimals</option>
                  <option value={2}>2 Decimals</option>
                  <option value={3}>3 Decimals</option>
                  <option value={4}>4 Decimals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Rounding Rule
                </label>
                <select
                  value={roundingRule}
                  onChange={(e) => {
                    touchModified();
                    setRoundingRule(e.target.value as RoundingRule);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-xs"
                >
                  <option value="NONE">None (Exact)</option>
                  <option value="NEAREST">Nearest</option>
                  <option value="ROUND_UP">Round Up</option>
                  <option value="ROUND_DOWN">Round Down</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Density Factor (Mass/Vol Basis)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={densityFactor}
                  onChange={(e) => {
                    touchModified();
                    setDensityFactor(Number(e.target.value) || 1.0);
                  }}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
                />
              </div>
            </div>

            {uomValidation.errors.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs space-y-0.5">
                <div className="font-bold">UOM Conversion Governance Errors:</div>
                {uomValidation.errors.map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 5: GLOBAL ITEM CODE RULE & STRUCTURE CONFIGURATION
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(5)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              5
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 5: Global Item Code Rule & Structure Configuration
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure active global dimensions, segment order, separator, and Global Monotonic sequence padding.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {generatedCodeResult.code}
            </span>
            {expandedSections[5] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[5] && (
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-slate-600 font-medium">
                Toggle optional dimensions or reorder segments using Up/Down arrows:
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Separator:</span>
                  <select
                    value={activeCodeRule.separator}
                    onChange={(e) => handleSetCodeSeparator(e.target.value)}
                    className="bg-slate-50 text-indigo-800 font-mono font-bold text-xs border border-slate-300 rounded px-2 py-1"
                  >
                    <option value="">None (Concatenated)</option>
                    <option value="-">- (Hyphen)</option>
                    <option value="_">_ (Underscore)</option>
                    <option value="/">/ (Slash)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Seq Padding:</span>
                  <select
                    value={
                      activeCodeRule.components.find((c) => c.sourceDimension === 'sequence')
                        ?.padding || 4
                    }
                    onChange={(e) => handleSetSequencePadding(Number(e.target.value))}
                    className="bg-slate-50 text-indigo-800 font-mono font-bold text-xs border border-slate-300 rounded px-2 py-1"
                  >
                    <option value={3}>3 Digits (001)</option>
                    <option value={4}>4 Digits (0001)</option>
                    <option value={5}>5 Digits (00001)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleResetRules}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Rule
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {activeCodeRule.components.map((comp, idx) => (
                <div
                  key={comp.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition ${
                    comp.enabled
                      ? 'bg-indigo-50/40 border-indigo-200 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <input
                      type="checkbox"
                      checked={comp.enabled}
                      disabled={comp.isRequired}
                      onChange={() => handleToggleCodeComponent(comp.id)}
                      className="rounded border-slate-300 text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="truncate">
                      <div className="font-bold flex items-center gap-1">
                        <span>{comp.name}</span>
                        {comp.isRequired && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 rounded">
                            Req
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-indigo-600 font-mono">
                        Order {comp.order}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCodeComponent(idx, 'UP')}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === activeCodeRule.components.length - 1}
                      onClick={() => handleMoveCodeComponent(idx, 'DOWN')}
                      className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 6: GLOBAL ITEM DESCRIPTION RULE & TEMPLATE CONFIGURATION
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(6)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              6
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 6: Global Item Description Rule & Template Configuration
              </h3>
              <p className="text-[11px] text-slate-500">
                Standardized description template tokens and clean segment delimiter normalization.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 max-w-xs truncate">
              {generatedDescResult.description}
            </span>
            {expandedSections[6] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[6] && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description Template Pattern
                </label>
                <input
                  type="text"
                  value={customDescPattern || activeDescRule.templatePattern}
                  onChange={(e) => {
                    touchModified();
                    setCustomDescPattern(e.target.value);
                  }}
                  placeholder="{MATERIAL} – {SPECIFICATION} – {COLOUR}"
                  className="w-full text-xs font-mono p-2 bg-slate-50 border border-slate-300 text-indigo-900 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Segment Separator
                </label>
                <select
                  value={descSeparator}
                  onChange={(e) => {
                    touchModified();
                    setDescSeparator(e.target.value);
                  }}
                  className="w-full text-xs font-mono p-2 bg-slate-50 border border-slate-300 text-slate-800 rounded-lg font-bold"
                >
                  <option value=" – "> – (En-Dash with spaces)</option>
                  <option value=" - "> - (Hyphen with spaces)</option>
                  <option value=", ">, (Comma with space)</option>
                  <option value=" | "> | (Pipe symbol)</option>
                </select>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block mb-1.5">
                Click global dimension tokens to append to description pattern:
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
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-indigo-600" />
                    {token}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 7: GLOBAL TECHNICAL ATTACHMENTS & ENGINEERING DOCUMENTATION
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(7)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              7
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 7: Global Technical Attachments & Engineering Documentation
              </h3>
              <p className="text-[11px] text-slate-500">
                Attach controlled engineering drawings, material datasheets, and global test protocols.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
              {attachments.length} Document(s)
            </span>
            {expandedSections[7] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[7] && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Type</label>
                <select
                  value={newAttType}
                  onChange={(e) => setNewAttType(e.target.value as any)}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  <option value="DATASHEET">Technical Datasheet</option>
                  <option value="ENGINEERING_DRAWING">Engineering Drawing</option>
                  <option value="MATERIAL_SPEC">Material Specification</option>
                  <option value="TEST_PROTOCOL">Global Test Protocol</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Controlled Document File Reference
                </label>
                <input
                  type="text"
                  value={newAttFileName}
                  onChange={(e) => setNewAttFileName(e.target.value)}
                  placeholder="e.g. DWG_PA66_SLEEVE_REV2.pdf"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Revision / Version</label>
                <input
                  type="text"
                  value={newAttVersion}
                  onChange={(e) => setNewAttVersion(e.target.value)}
                  placeholder="v1.0"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" /> Attach Document
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-2.5 bg-white flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                      {att.documentType}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{att.fileName}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({att.version})</span>
                    <span className="text-slate-500 text-[11px]">{att.description}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SECTION 8: GLOBAL DUPLICATE DETECTION & 14-CHECKPOINT RULE AUDIT
         ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(8)}
          className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
              8
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Section 8: Global Duplicate Detection & 14-Checkpoint Rule Audit Summary
              </h3>
              <p className="text-[11px] text-slate-500">
                Real-time collision analysis across 7 technical vectors and 14-checkpoint Global Creation Audit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                duplicateCheckResult.hasHardConflict
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : duplicateCheckResult.hasPotentialWarning
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {duplicateCheckResult.hasHardConflict
                ? 'HARD DUPLICATE CONFLICT'
                : duplicateCheckResult.hasPotentialWarning
                  ? 'POTENTIAL SIMILARITY WARNING'
                  : 'NO DUPLICATES DETECTED'}
            </span>
            {expandedSections[8] ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {expandedSections[8] && (
          <div className="p-4 space-y-4">
            {/* Duplicate Detection Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                duplicateCheckResult.hasHardConflict
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : duplicateCheckResult.hasPotentialWarning
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {duplicateCheckResult.hasHardConflict ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                ) : duplicateCheckResult.hasPotentialWarning ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    7-Vector Global Duplicate Detection:{' '}
                    {duplicateCheckResult.hasHardConflict
                      ? `${duplicateCheckResult.hardConflicts.length} Hard Conflict(s) Blocking Submission`
                      : duplicateCheckResult.hasPotentialWarning
                        ? `${duplicateCheckResult.potentialWarnings.length} Potential Similarity Warning(s)`
                        : `Verified Unique Across ${globalItems.length} Global Master Records`}
                  </div>
                  <div className="text-[11px] opacity-85">
                    Checked vectors: Global Item Code, Exact Technical Identity, Manufacturer, MPN, Customer Part No, Technical Specs, and Description similarity.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleValidate}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg font-bold text-xs shrink-0 cursor-pointer"
              >
                Open Full Audit Modal
              </button>
            </div>

            {/* 14-Checkpoint Compact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {globalAuditReport.checkpoints.map((cp, idx) => (
                <div
                  key={cp.checkpointKey}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">
                      <span className="font-mono text-[10px] text-slate-400 mr-1">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      {cp.checkpointLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{cp.message}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      cp.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : cp.status === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {cp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Consistent PR-Style Sticky Footer Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-3 sticky bottom-2 z-20">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Validate Rules</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('SUBMIT')}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-white" />
            <span>Submit for Checker Approval</span>
          </button>
        </div>
      </div>

      {/* Rule Engine Validation Audit Modal */}
      {isValidationModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base text-white">
                    14-Checkpoint Global Item Creation Audit Report
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Audit ID: {globalAuditReport.auditId} — Rule Engine v{activeCodeRule.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsValidationModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {validationSuccess ? (
                <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-sm text-emerald-900">
                      100% Rule Engine Validation Passed
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      All 14 Global Item Creation checkpoints, UOM conversion rules, and duplicate checks passed.
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

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                  <span>14-Checkpoint Audit Matrix</span>
                  <span>Result</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs max-h-64 overflow-y-auto">
                  {globalAuditReport.checkpoints.map((cp, idx) => (
                    <div key={cp.checkpointKey} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-800">
                          {idx + 1}. {cp.checkpointLabel}
                        </div>
                        <div className="text-[11px] text-slate-500">{cp.message}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cp.status === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cp.status === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {cp.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsValidationModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Close Audit Report
              </button>

              {validationSuccess && (
                <button
                  type="button"
                  onClick={() => handleSubmit('SUBMIT')}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Proceed & Submit for Checker Approval</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
