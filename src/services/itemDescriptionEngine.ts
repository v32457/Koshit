/**
 * KOSH INNOVATIONS — ITEM DESCRIPTION GENERATION ENGINE
 * Dynamic template parser with smart whitespace and delimiter normalization.
 */

import { ItemDescriptionRule } from '../types';

export interface DescriptionGenerationInput {
  categoryCode: string;
  subcategoryName?: string;
  typeName?: string;
  materialName?: string;
  materialFormName?: string;
  processName?: string;
  colourName?: string;
  gradeName?: string;
  manufacturerName?: string;
  partModelNumber?: string;
  dimensions?: string;
  ratingSize?: string;
  specification?: string;
  productName?: string;
}

export interface DescriptionGenerationResult {
  description: string;
  isWithinLimit: boolean;
  length: number;
  tokensReplaced: Record<string, string>;
  warnings: string[];
}

/**
 * Parses description template pattern and replaces tokens cleanly without dangling separators.
 */
export function generateItemDescription(
  rule: ItemDescriptionRule,
  input: DescriptionGenerationInput
): DescriptionGenerationResult {
  const warnings: string[] = [];
  const tokensReplaced: Record<string, string> = {};

  const tokenMap: Record<string, string | undefined> = {
    '{CATEGORY}': input.categoryCode,
    '{SUBCATEGORY}': input.subcategoryName,
    '{TYPE}': input.typeName,
    '{MATERIAL}': input.materialName,
    '{FORM}': input.materialFormName,
    '{PROCESS}': input.processName,
    '{COLOUR}': input.colourName,
    '{GRADE}': input.gradeName,
    '{MANUFACTURER}': input.manufacturerName,
    '{PART_MODEL}': input.partModelNumber,
    '{DIMENSIONS}': input.dimensions || input.ratingSize,
    '{RATING_SIZE}': input.ratingSize || input.dimensions,
    '{SPECIFICATION}': input.specification,
    '{PRODUCT_NAME}': input.productName,
  };

  const sep = rule.separator || ' – ';

  // Split template by separator into distinct segments
  const segments = rule.templatePattern.split(sep);
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

    // Only keep segment if it was resolved with real non-empty value
    if ((!hasToken && resolvedSeg.length > 0) || (hasToken && tokenHasValue && resolvedSeg.length > 0)) {
      populatedSegments.push(resolvedSeg);
    }
  }

  // Join non-empty segments
  let description = populatedSegments.join(sep);

  // Normalize excessive spaces and clean up
  description = description.replace(/\s+/g, ' ').trim();

  const maxLength = rule.maxLength || 200;
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
