/**
 * KOSH INNOVATIONS — GLOBAL ITEM DESCRIPTION GENERATION ENGINE
 * Dynamic template parser with smart whitespace and delimiter normalization.
 *
 * Architectural Rule:
 * - Global Item Description generation is scoped by Global Item Type / standard technical
 *   attributes and does NOT require Category.
 */

import { ItemDescriptionRule } from '../types';

export interface DescriptionGenerationInput {
  categoryCode?: string; // Legacy optional compatibility only
  subcategoryName?: string;
  typeName?: string;
  materialName?: string;
  materialFormName?: string;
  processName?: string;
  colourName?: string;
  gradeName?: string;
  manufacturerName?: string;
  brandName?: string;
  partModelNumber?: string;
  dimensions?: string;
  ratingSize?: string;
  specification?: string;
  productName?: string;
  [key: string]: any;
}

export interface DescriptionGenerationResult {
  description: string;
  isWithinLimit: boolean;
  length: number;
  tokensReplaced: Record<string, string>;
  warnings: string[];
}

import { INITIAL_DESCRIPTION_RULES } from '../data/seedData';

/**
 * Parses description template pattern and replaces tokens cleanly without dangling separators.
 */
export function generateItemDescription(
  rule: ItemDescriptionRule | null | undefined,
  input: DescriptionGenerationInput
): DescriptionGenerationResult {
  const effectiveRule = rule && rule.templatePattern ? rule : INITIAL_DESCRIPTION_RULES[0];
  const warnings: string[] = [];
  const tokensReplaced: Record<string, string> = {};

  const tokenMap: Record<string, string | undefined> = {
    '{SUBCATEGORY}': input.subcategoryName || input.SUBCATEGORY,
    '{TYPE}': input.typeName || input.TYPE || input.ITEM_TYPE,
    '{MATERIAL}': input.materialName || input.MATERIAL,
    '{FORM}': input.materialFormName || input.FORM,
    '{PROCESS}': input.processName || input.PROCESS,
    '{COLOUR}': input.colourName || input.COLOUR,
    '{GRADE}': input.gradeName || input.GRADE,
    '{MANUFACTURER}': input.manufacturerName || input.MANUFACTURER,
    '{BRAND}': input.brandName || input.BRAND,
    '{PART_MODEL}': input.partModelNumber || input.PART_MODEL,
    '{DIMENSIONS}': input.dimensions || input.DIMENSIONS || input.ratingSize || input.RATING_SIZE,
    '{RATING_SIZE}': input.ratingSize || input.RATING_SIZE || input.dimensions || input.DIMENSIONS,
    '{SPECIFICATION}': input.specification || input.SPECIFICATION,
    '{PRODUCT_NAME}': input.productName || input.PRODUCT_NAME,
  };

  const sep = effectiveRule?.separator || ' – ';
  const segments = (effectiveRule?.templatePattern || '{MATERIAL} – {SPECIFICATION} – {COLOUR}').split(sep);
  const populatedSegments: string[] = [];

  for (const seg of segments) {
    let resolvedSeg = seg;
    let hasToken = false;
    let tokenHasValue = false;

    for (const [token, value] of Object.entries(tokenMap)) {
      if (resolvedSeg.includes(token)) {
        hasToken = true;
        if (value && value.trim().length > 0) {
          tokenHasValue = true;
          resolvedSeg = resolvedSeg.replace(token, value.trim());
          tokensReplaced[token] = value.trim();
        } else {
          resolvedSeg = resolvedSeg.replace(token, '');
        }
      }
    }

    resolvedSeg = resolvedSeg.trim();

    if ((!hasToken && resolvedSeg.length > 0) || (hasToken && tokenHasValue && resolvedSeg.length > 0)) {
      populatedSegments.push(resolvedSeg);
    }
  }

  let description = populatedSegments.join(sep);
  description = description.replace(/\s+/g, ' ').trim();

  const maxLength = effectiveRule?.maxLength || 200;
  const isWithinLimit = description.length <= maxLength;

  if (!isWithinLimit) {
    warnings.push(`Description length (${description.length}) exceeds configured maximum of ${maxLength} chars.`);
  }

  return {
    description,
    isWithinLimit,
    length: description.length,
    tokensReplaced,
    warnings,
  };
}
