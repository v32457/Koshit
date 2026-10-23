/**
 * KOSH INNOVATIONS — ITEM CODE GENERATION ENGINE
 * Declarative, configurable rule evaluator for manufacturing master data.
 */

import { ItemCodeRule } from '../types';

export interface CodeGenerationInput {
  categoryCode: string;
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
  sequenceNumber: number;
}

export interface CodeGenerationResult {
  code: string;
  isProvisional: boolean;
  length: number;
  componentsUsed: Array<{ name: string; value: string }>;
  errors: string[];
}

/**
 * Evaluates an ItemCodeRule against user inputs and an atomic sequence number.
 */
export function generateItemCode(
  rule: ItemCodeRule,
  input: CodeGenerationInput,
  isProvisional = false
): CodeGenerationResult {
  const errors: string[] = [];
  const componentsUsed: Array<{ name: string; value: string }> = [];

  // Sort components by configured order
  const activeComponents = [...rule.components]
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order);

  const parts: string[] = [];

  for (const comp of activeComponents) {
    let partValue = '';

    switch (comp.sourceDimension) {
      case 'category':
        partValue = input.categoryCode || '';
        break;
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
      errors.push(`Missing required component '${comp.name}' for category ${input.categoryCode}`);
    }

    if (partValue) {
      parts.push(partValue.toUpperCase().trim());
      componentsUsed.push({ name: comp.name, value: partValue.toUpperCase().trim() });
    }
  }

  const generatedCode = parts.join(rule.separator || '');

  // SAP Business One ItemCode field max constraint is 50 chars
  if (generatedCode.length > 50) {
    errors.push(`Generated Item Code (${generatedCode.length} chars) exceeds SAP Business One max limit (50 chars)`);
  }

  return {
    code: generatedCode,
    isProvisional,
    length: generatedCode.length,
    componentsUsed,
    errors,
  };
}
