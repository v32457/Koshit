/**
 * KOSH INNOVATIONS — VENDOR ITEM PRICE REGISTER SERVICE
 * Maintains active approved price agreements for RFQ-enabled companies and branches.
 * Stores approved Purchase UOM prices, allocation percentages, effective dates, MOQs, and lead times.
 */

import { VendorItemPriceAgreement } from '../types/rfqSourcing';

const STORAGE_KEY_PRICE_REGISTER = 'kosh_vendor_item_price_register_v1';

export const INITIAL_PRICE_REGISTER: VendorItemPriceAgreement[] = [
  {
    id: 'vpa-001',
    agreementNumber: 'VPA-2026-0001',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    purchaseOrgId: 'po-kosh-01',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    itemCode: 'RMPAOPOEXLG0001',
    description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    awardId: 'award-001',
    approvedUnitPricePurchUom: 6800, // ₹6,800 per BAG
    currency: 'INR',
    purchaseUom: 'BAG',
    inventoryUom: 'KG',
    conversionRatio: 25,
    moq: 5,
    effectiveFrom: '2026-11-10',
    effectiveTo: '2027-05-10',
    allocationPercent: 60,
    deliveryLeadTimeDays: 7,
    paymentTerms: 'NET 60 Days',
    taxConditions: '18% GST Extra, FOR Puducherry',
    status: 'ACTIVE',
    version: 1,
    approvedBy: 'Venkatesh Iyer (Purchasing Manager)',
    approvedAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'vpa-002',
    agreementNumber: 'VPA-2026-0002',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    purchaseOrgId: 'po-kosh-01',
    vendorId: 'bp-003',
    vendorCode: 'VEND-POLY-02',
    vendorName: 'POLYMER SOLUTIONS INDIA LTD',
    itemCode: 'RMPAOPOEXLG0001',
    description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    awardId: 'award-001',
    approvedUnitPricePurchUom: 7000, // ₹7,000 per BAG
    currency: 'INR',
    purchaseUom: 'BAG',
    inventoryUom: 'KG',
    conversionRatio: 25,
    moq: 10,
    effectiveFrom: '2026-11-10',
    effectiveTo: '2027-05-10',
    allocationPercent: 40,
    deliveryLeadTimeDays: 10,
    paymentTerms: 'NET 45 Days',
    taxConditions: '18% GST Extra, Freight Extra',
    status: 'ACTIVE',
    version: 1,
    approvedBy: 'Venkatesh Iyer (Purchasing Manager)',
    approvedAt: '2026-11-10T10:00:00Z',
  },
];

export const vendorPriceRegisterService = {
  getAgreements(): VendorItemPriceAgreement[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRICE_REGISTER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading price register:', err);
    }
    return INITIAL_PRICE_REGISTER;
  },

  saveAgreements(agreements: VendorItemPriceAgreement[]) {
    try {
      localStorage.setItem(STORAGE_KEY_PRICE_REGISTER, JSON.stringify(agreements));
    } catch (err) {
      console.error('Error saving price register:', err);
    }
  },

  getActiveAgreementsForItem(companyId: string, itemCode: string, branchId?: string): VendorItemPriceAgreement[] {
    const all = this.getAgreements();
    const today = new Date().toISOString().split('T')[0];

    return all.filter((a) => {
      if (a.status !== 'ACTIVE') return false;
      if (a.companyId !== companyId) return false;
      if (a.itemCode !== itemCode) return false;
      if (a.effectiveFrom && a.effectiveFrom > today) return false;
      if (a.effectiveTo && a.effectiveTo < today) return false;
      if (branchId && a.branchId !== 'ALL' && a.branchId !== branchId) return false;
      return true;
    });
  },

  addAgreement(newAgreement: VendorItemPriceAgreement): VendorItemPriceAgreement {
    const agreements = this.getAgreements();
    const updated = [newAgreement, ...agreements];
    this.saveAgreements(updated);
    return newAgreement;
  }
};
