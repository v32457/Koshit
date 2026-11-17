/**
 * KOSH INNOVATIONS — GLOBAL ITEM CODE GENERATION ENGINE
 * Declarative, configurable rule evaluator for global manufacturing master data.
 *
 * Architectural Rule:
 * - Global Item Code generation MUST NOT include or require Category.
 * - Global active rules operate purely on global dimensions (Item Type, Material, Material Form, Process, Colour, Brand, Spec, Sequence) with global sequence scope.
 */

import { ItemCodeRule } from '../types';

export interface CodeGenerationInput {
  subcategoryCode?: string;
  materialCode?: string;
  typeCode?: string;
  materialFormCode?: string;
  processCode?: string;
  colourCode?: string;
  gradeCode?: string;
  manufacturerCode?: string;
  partModelNumber?: string;
  dimensions?: string;
  ratingSize?: string;
  specification?: string;
  sequenceNumber?: number;
  [key: string]: any;
}

export interface CodeGenerationResult {
  code: string;
  isProvisional: boolean;
  length: number;
  componentsUsed: Array<{ name: string; value: string }>;
  errors: string[];
}

import { INITIAL_ITEM_CODE_RULES } from '../data/seedData';

/**
 * Evaluates an ItemCodeRule against user inputs and an atomic global sequence number.
 */
export function generateItemCode(
  rule: ItemCodeRule | null | undefined,
  input: CodeGenerationInput,
  isProvisional = false
): CodeGenerationResult {
  const effectiveRule = rule && Array.isArray(rule.components) ? rule : INITIAL_ITEM_CODE_RULES[0];
  const errors: string[] = [];
  const componentsUsed: Array<{ name: string; value: string }> = [];

  const activeComponents = [...(effectiveRule?.components || [])]
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order);

  const parts: string[] = [];

  for (const comp of activeComponents) {
    let partValue = '';

    switch (comp.sourceDimension) {
      case 'subcategory':
        partValue = input.subcategoryCode || '';
        break;
      case 'material':
        partValue = input.materialCode || '';
        break;
      case 'type':
        partValue = input.typeCode || '';
        break;
      case 'materialForm':
        partValue = input.materialFormCode || '';
        break;
      case 'process':
        partValue = input.processCode || '';
        break;
      case 'colour':
        partValue = input.colourCode || '';
        break;
      case 'grade':
        partValue = input.gradeCode || '';
        break;
      case 'manufacturer':
        partValue = input.manufacturerCode || '';
        break;
      case 'partModelNumber':
        partValue = input.partModelNumber || '';
        break;
      case 'dimensions':
        partValue = input.dimensions || '';
        break;
      case 'ratingSize':
        partValue = input.ratingSize || '';
        break;
      case 'specification':
        partValue = input.specification || '';
        break;
      case 'fixed':
        partValue = comp.fixedText || '';
        break;
      case 'sequence': {
        const padLen = comp.padding || 4;
        partValue = String(input.sequenceNumber).padStart(padLen, '0');
        break;
      }
      default:
        partValue = '';
    }

    if (comp.isRequired && !partValue) {
      errors.push(`Missing required component '${comp.name}' in rule '${effectiveRule?.name || 'Global Code Rule'}'`);
    }

    if (partValue) {
      parts.push(partValue.toUpperCase().trim());
      componentsUsed.push({ name: comp.name, value: partValue.toUpperCase().trim() });
    }
  }

  const generatedCode = parts.join(effectiveRule?.separator || '');

  const configuredMax =
    effectiveRule?.maxLength && effectiveRule.maxLength > 0 ? Math.min(50, effectiveRule.maxLength) : 50;
  if (generatedCode.length > configuredMax) {
    errors.push(
      `Generated Item Code (${generatedCode.length} chars) exceeds maximum allowed limit (${configuredMax} chars)`
    );
  }

  return {
    code: generatedCode,
    isProvisional,
    length: generatedCode.length,
    componentsUsed,
    errors,
  };
}
