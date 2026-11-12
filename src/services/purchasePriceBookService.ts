/**
 * KOSH INNOVATIONS — PURCHASE PRICE BOOK SERVICE
 * Manages tiered quantity pricing, percentage/fixed discounts, contract pricing,
 * and validity governance for companies/branches where RFQ is disabled.
 */

import { PurchasePriceBook, PurchasePriceBookLine } from '../types/rfqSourcing';

const STORAGE_KEY_PRICE_BOOKS = 'kosh_purchase_price_books_v1';

export const INITIAL_PRICE_BOOKS: PurchasePriceBook[] = [
  {
    id: 'pb-001',
    priceBookNumber: 'PB-2026-0001',
    companyId: 'co-kosh-04',
    companyCode: 'KOSH-NORTH',
    branchId: 'br-ddun-05',
    branchCode: 'DDN',
    purchaseOrgId: 'po-kosh-01',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    status: 'APPROVED',
    lines: [
      {
        id: 'pb-line-001',
        priceBookId: 'pb-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        purchaseUom: 'BAG',
        baseUnitPricePurchUom: 7500,
        moq: 1,
        tiers: [
          { id: 'tier-1', minQtyPurchUom: 1, maxQtyPurchUom: 9, unitPricePurchUom: 7500 },
          { id: 'tier-2', minQtyPurchUom: 10, maxQtyPurchUom: 49, unitPricePurchUom: 7100 },
          { id: 'tier-3', minQtyPurchUom: 50, maxQtyPurchUom: 99999, unitPricePurchUom: 6700 },
        ],
        discountRules: [
          { id: 'disc-1', discountType: 'PERCENTAGE', discountValue: 2.0, description: 'Prompt Payment Discount 2%' },
          { id: 'disc-2', discountType: 'CONTRACT_PROMO', discountValue: 100, description: 'Contract Rebate ₹100/BAG' },
        ],
        taxConditions: '18% GST Extra',
        freightConditions: 'Free Delivery at Dehradun Plant for orders > 10 BAGS',
        status: 'ACTIVE',
      },
    ],
    updatedAt: '2026-10-15T08:00:00Z',
    updatedBy: 'Platform Admin',
  },
];

export const purchasePriceBookService = {
  getPriceBooks(): PurchasePriceBook[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRICE_BOOKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading price books:', err);
    }
    return INITIAL_PRICE_BOOKS;
  },

  savePriceBooks(books: PurchasePriceBook[]) {
    try {
      localStorage.setItem(STORAGE_KEY_PRICE_BOOKS, JSON.stringify(books));
    } catch (err) {
      console.error('Error saving price books:', err);
    }
  },

  getPriceBookLineForItem(companyId: string, itemCode: string, qtyPurchUom: number, branchId?: string): { line: PurchasePriceBookLine; unitPrice: number; priceBookNumber: string } | null {
    const books = this.getPriceBooks();
    const today = new Date().toISOString().split('T')[0];

    const activeBook = books.find((pb) => {
      if (pb.status !== 'APPROVED') return false;
      if (pb.companyId !== companyId) return false;
      if (pb.effectiveFrom && pb.effectiveFrom > today) return false;
      if (pb.effectiveTo && pb.effectiveTo < today) return false;
      if (branchId && pb.branchId !== 'ALL' && pb.branchId !== branchId) return false;
      return true;
    });

    if (!activeBook) return null;

    const line = activeBook.lines.find((l) => l.itemCode === itemCode && l.status === 'ACTIVE');
    if (!line) return null;

    // Determine quantity tier
    let unitPrice = line.baseUnitPricePurchUom;
    if (line.tiers && line.tiers.length > 0) {
      const applicableTier = line.tiers.find(
        (t) => qtyPurchUom >= t.minQtyPurchUom && qtyPurchUom <= t.maxQtyPurchUom
      );
      if (applicableTier) {
        unitPrice = applicableTier.unitPricePurchUom;
      }
    }

    return {
      line,
      unitPrice,
      priceBookNumber: activeBook.priceBookNumber,
    };
  },

  savePriceBook(book: PurchasePriceBook): PurchasePriceBook {
    const books = this.getPriceBooks();
    const existingIdx = books.findIndex(b => b.id === book.id);
    let updatedList: PurchasePriceBook[];
    if (existingIdx >= 0) {
      books[existingIdx] = book;
      updatedList = books;
    } else {
      updatedList = [book, ...books];
    }
    this.savePriceBooks(updatedList);
    return book;
  }
};
