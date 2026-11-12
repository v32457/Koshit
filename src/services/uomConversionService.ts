/**
 * KOSH INNOVATIONS — DUAL UOM GOVERNANCE ENGINE
 * Enforces mandatory UOM mapping:
 * Item Master: Defines Inventory UOM & Purchase UOM & Conversion Ratio.
 * PR: Inventory UOM
 * RFQ, Quotations, RFQ Award, Price Book, PO: Purchase UOM
 * Goods Receipt: Purchase UOM input converted to Inventory UOM for inventory balances.
 */

import { GlobalItem } from '../types';

export interface UomConversionSnapshot {
  itemCode: string;
  inventoryUom: string;
  purchaseUom: string;
  conversionRatio: number; // 1 Purchase UOM = X Inventory UOM (e.g. 1 BOX = 10 EA)
}

// Known default conversion ratios for system items
const ITEM_UOM_MAP: Record<string, UomConversionSnapshot> = {
  'RMPAOPOEXLG0001': {
    itemCode: 'RMPAOPOEXLG0001',
    inventoryUom: 'KG',
    purchaseUom: 'BAG', // 1 BAG = 25 KG
    conversionRatio: 25,
  },
  'FGHDMCRGY0002': {
    itemCode: 'FGHDMCRGY0002',
    inventoryUom: 'EA',
    purchaseUom: 'BOX', // 1 BOX = 50 EA
    conversionRatio: 50,
  },
  'MAPALBL0003': {
    itemCode: 'MAPALBL0003',
    inventoryUom: 'EA',
    purchaseUom: 'SET', // 1 SET = 1 EA
    conversionRatio: 1,
  },
};

export const uomConversionService = {
  getUomSnapshot(itemCode: string, itemObj?: GlobalItem): UomConversionSnapshot {
    if (ITEM_UOM_MAP[itemCode]) {
      return ITEM_UOM_MAP[itemCode];
    }

    if (itemObj) {
      const invUom = itemObj.inventoryUom || itemObj.procurementControls?.inventoryUom || 'EA';
      // Default heuristics based on item category or code
      const purchUom = itemObj.categoryCode === 'RM' ? 'BAG' : itemObj.categoryCode === 'FG' ? 'BOX' : 'EA';
      const ratio = purchUom === 'BAG' ? 25 : purchUom === 'BOX' ? 10 : 1;
      return {
        itemCode,
        inventoryUom: invUom,
        purchaseUom: purchUom,
        conversionRatio: ratio,
      };
    }

    return {
      itemCode,
      inventoryUom: 'EA',
      purchaseUom: 'BOX',
      conversionRatio: 10,
    };
  },

  convertInvToPurchQty(itemCode: string, qtyInvUom: number, itemObj?: GlobalItem): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj);
    if (snapshot.conversionRatio <= 0) return qtyInvUom;
    return Number((qtyInvUom / snapshot.conversionRatio).toFixed(4));
  },

  convertPurchToInvQty(itemCode: string, qtyPurchUom: number, itemObj?: GlobalItem): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj);
    return Number((qtyPurchUom * snapshot.conversionRatio).toFixed(4));
  },

  convertPricePurchToInv(itemCode: string, unitPricePurchUom: number, itemObj?: GlobalItem): number {
    const snapshot = this.getUomSnapshot(itemCode, itemObj);
    if (snapshot.conversionRatio <= 0) return unitPricePurchUom;
    return Number((unitPricePurchUom / snapshot.conversionRatio).toFixed(2));
  }
};
