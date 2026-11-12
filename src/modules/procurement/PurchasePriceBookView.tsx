import React, { useState } from 'react';
import { BookOpen, Search, Plus, Layers, ShieldCheck, Tag } from 'lucide-react';
import { purchasePriceBookService } from '../../services/purchasePriceBookService';
import { PurchasePriceBook } from '../../types/rfqSourcing';

export const PurchasePriceBookView: React.FC = () => {
  const [books] = useState<PurchasePriceBook[]>(() => purchasePriceBookService.getPriceBooks());
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = books.filter(b =>
    b.priceBookNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            <span>Purchase Price Book & Tiered Quantity Pricing</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Approved price books, quantity breaks, base unit prices, and discount rules for RFQ-disabled companies and branches.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-lg text-amber-900 text-xs font-semibold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Mandatory Source when RFQ Disabled</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Price Books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Price Books Cards / Tables */}
      {filtered.map((book) => (
        <div key={book.id} className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-bold text-amber-600">{book.priceBookNumber}</span>
              <h2 className="text-sm font-bold text-slate-900">{book.vendorName} ({book.vendorCode})</h2>
            </div>
            <div className="text-xs text-slate-500">
              Validity: <strong>{book.effectiveFrom} to {book.effectiveTo}</strong>
            </div>
          </div>

          {book.lines.map((line) => (
            <div key={line.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">{line.itemCode}</span> — {line.description}
                </div>
                <div className="font-bold text-amber-700">
                  Base Price: ₹{line.baseUnitPricePurchUom.toLocaleString()} / {line.purchaseUom}
                </div>
              </div>

              {/* Quantity Tiers */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Quantity Tier Pricing</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {line.tiers.map((t) => (
                    <div key={t.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Qty {t.minQtyPurchUom} - {t.maxQtyPurchUom >= 99999 ? '∞' : t.maxQtyPurchUom} {line.purchaseUom}:</span>
                      <span className="font-bold text-slate-900">₹{t.unitPricePurchUom.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Rules */}
              <div className="space-y-1 pt-1">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Configured Discounts</div>
                <div className="flex flex-wrap gap-2">
                  {line.discountRules.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100/80 border border-amber-200 text-amber-900 rounded-lg font-semibold text-[11px]">
                      <Tag className="w-3 h-3 text-amber-600" />
                      <span>{d.description}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
