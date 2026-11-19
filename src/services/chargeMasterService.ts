/**
 * KOSH INNOVATIONS — CENTRALIZED CHARGE MASTER, STATUTORY TAX MAPPINGS & RULE ENGINE
 * Manages Charge Master definitions across all categories, configurable applicability rules,
 * configurable statutory tax treatments (Domestic GST, Reverse Charge, Customs BCD+SWS, Import IGST),
 * and multi-currency exchange rates.
 */

import {
  ChargeMasterRecord,
  ChargeRuleRecord,
  ChargeRuleCondition,
  ChargeRuleEvaluationContext,
  ChargeApplicabilityStatus,
  StatutoryTaxMapping,
  ExchangeRateEntry,
  ChargeApplicationLevel,
} from '../types/chargeManagement';
import { EnterpriseAuditService } from './enterpriseAuditService';
import { validateChargeFormula } from './chargeFormulaEvaluator';
import { rbacPermissionService } from './rbacPermissionService';
import { User } from '../types';

const STORAGE_KEY_MASTER = 'kosh_charge_master_v1';
const STORAGE_KEY_RULES = 'kosh_charge_rules_v1';
const STORAGE_KEY_TAX_MAPPINGS = 'kosh_charge_tax_mappings_v1';
const STORAGE_KEY_FX_RATES = 'kosh_charge_fx_rates_v1';

export const ALL_CHARGE_APPLICATION_LEVELS: Array<{
  level: ChargeApplicationLevel;
  label: string;
  description: string;
}> = [
  { level: 'PR_HEADER', label: 'PR Header', description: 'Entire Purchase Requisition' },
  { level: 'PR_LINE', label: 'PR Line', description: 'Individual PR item' },
  { level: 'PO_HEADER', label: 'PO Header', description: 'Entire Purchase Order' },
  { level: 'PO_LINE', label: 'PO Line', description: 'Individual PO item' },
  { level: 'SHIPMENT', label: 'Shipment', description: 'Individual shipment/consignment' },
  { level: 'DELIVERY_SCHEDULE', label: 'Delivery Schedule', description: 'Individual delivery schedule' },
  { level: 'GRN', label: 'Goods Receipt (GRN)', description: 'Individual receipt transaction' },
  { level: 'QUANTITY_BASED', label: 'Quantity Based', description: 'Ordered or received quantity' },
  { level: 'TRANSPORT_TRIP', label: 'Transport / Trip', description: 'Individual transportation trip' },
  { level: 'INVOICE_LEVEL', label: 'Invoice Level', description: 'Supplier or service-provider invoice' },
];

/**
 * Configurable Statutory Tax Mapping Registry.
 * Tax rates & treatments reside in governance configuration rather than hardcoded in calculation logic.
 */
export const INITIAL_STATUTORY_TAX_MAPPINGS: StatutoryTaxMapping[] = [
  {
    id: 'tax-dom-gst-18',
    taxCode: 'DOM-GST-18',
    taxName: 'Domestic GST (Standard 18% Input Credit Eligible)',
    procurementScope: 'DOMESTIC',
    treatmentType: 'DOMESTIC_GST_TAXABLE',
    ratePercent: 18,
    surchargePercent: 0,
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    recoverableSharePercent: 100,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'Standard IGST/CGST+SGST on domestic logistics, loading, packing, and service invoices.',
    updatedBy: 'Tax Governance Officer',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tax-dom-gta-rcm-5',
    taxCode: 'DOM-GTA-RCM-5',
    taxName: 'Domestic GTA Freight (5% Reverse Charge RCM)',
    procurementScope: 'DOMESTIC',
    treatmentType: 'DOMESTIC_GST_RCM',
    ratePercent: 5,
    surchargePercent: 0,
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    recoverableSharePercent: 100,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'Goods Transport Agency freight under Reverse Charge Mechanism with eligible input credit.',
    updatedBy: 'Tax Governance Officer',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tax-dom-gst-exempt',
    taxCode: 'DOM-EXEMPT-0',
    taxName: 'Exempt / Zero Statutory Tax (0%)',
    procurementScope: 'BOTH',
    treatmentType: 'EXEMPT_ZERO_RATED',
    ratePercent: 0,
    surchargePercent: 0,
    recoverability: 'NON_RECOVERABLE',
    recoverableSharePercent: 0,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'Direct labor / municipal toll / tax-exempt statutory charges.',
    updatedBy: 'Tax Governance Officer',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tax-imp-bcd-sws',
    taxCode: 'IMP-BCD-10-SWS-10',
    taxName: 'Import Basic Customs Duty + Social Welfare Surcharge (Non-Recoverable)',
    procurementScope: 'IMPORT',
    treatmentType: 'IMPORT_CUSTOMS_BCD_SWS',
    ratePercent: 10,
    surchargePercent: 10, // 10% SWS calculated on BCD amount (not double-counted)
    recoverability: 'NON_RECOVERABLE',
    recoverableSharePercent: 0,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'Statutory import duty (BCD) + SWS; non-recoverable and capitalized into landed inventory cost.',
    updatedBy: 'Import Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tax-imp-igst-18',
    taxCode: 'IMP-IGST-18',
    taxName: 'Import IGST on Assessable Value + Duty (18% Recoverable ITC)',
    procurementScope: 'IMPORT',
    treatmentType: 'IMPORT_IGST',
    ratePercent: 18,
    surchargePercent: 0,
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    recoverableSharePercent: 100,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'IGST paid on Bill of Entry; recoverable input credit excluded from landed inventory valuation.',
    updatedBy: 'Import Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'tax-dom-nonrec-18',
    taxCode: 'DOM-GST-NR-18',
    taxName: 'Blocked Credit GST (18% Non-Recoverable)',
    procurementScope: 'DOMESTIC',
    treatmentType: 'DOMESTIC_GST_TAXABLE',
    ratePercent: 18,
    surchargePercent: 0,
    recoverability: 'NON_RECOVERABLE',
    recoverableSharePercent: 0,
    effectiveFrom: '2025-04-01',
    isActive: true,
    description: 'Section 17(5) blocked input credit GST capitalized into item landed cost.',
    updatedBy: 'Tax Governance Officer',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

export const INITIAL_EXCHANGE_RATES: ExchangeRateEntry[] = [
  { id: 'fx-inr-inr', fromCurrency: 'INR', toCurrency: 'INR', rate: 1, effectiveDate: '2026-04-01', sourceRef: 'PARITY' },
  { id: 'fx-usd-inr', fromCurrency: 'USD', toCurrency: 'INR', rate: 84.5, effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
  { id: 'fx-eur-inr', fromCurrency: 'EUR', toCurrency: 'INR', rate: 91.2, effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
  { id: 'fx-gbp-inr', fromCurrency: 'GBP', toCurrency: 'INR', rate: 107.8, effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
  { id: 'fx-jpy-inr', fromCurrency: 'JPY', toCurrency: 'INR', rate: 0.55, effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
  { id: 'fx-inr-usd', fromCurrency: 'INR', toCurrency: 'USD', rate: Number((1 / 84.5).toFixed(6)), effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
  { id: 'fx-inr-eur', fromCurrency: 'INR', toCurrency: 'EUR', rate: Number((1 / 91.2).toFixed(6)), effectiveDate: '2026-11-01', sourceRef: 'RBI-FBIL-2026-11' },
];

export const INITIAL_CHARGE_MASTER: ChargeMasterRecord[] = [
  {
    id: 'cm-load',
    chargeCode: 'CHG-LOAD',
    chargeName: 'Loading Charges',
    chargeDescription: 'Labor and material-handling equipment loading tariff at origin dock.',
    chargeCategory: 'HANDLING',
    defaultApplicationLevel: 'PR_LINE',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'DELIVERY_SCHEDULE', 'GRN', 'QUANTITY_BASED'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'NET_QUANTITY',
    defaultRate: 1500,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_QUANTITY',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 0,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 10,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-unload',
    chargeCode: 'CHG-UNLOAD',
    chargeName: 'Unloading Charges',
    chargeDescription: 'Plant receiving bay unloading & dock labor charges per delivery/GRN.',
    chargeCategory: 'HANDLING',
    defaultApplicationLevel: 'DELIVERY_SCHEDULE',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'DELIVERY_SCHEDULE', 'GRN', 'SHIPMENT', 'QUANTITY_BASED'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'RECEIVED_QUANTITY',
    defaultRate: 1500,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_QUANTITY',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 0,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 20,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-freight',
    chargeCode: 'CHG-FREIGHT',
    chargeName: 'Freight Charges',
    chargeDescription: 'Domestic line-haul or international sea/air freight charges.',
    chargeCategory: 'LOGISTICS',
    defaultApplicationLevel: 'PO_HEADER',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'DELIVERY_SCHEDULE', 'GRN', 'QUANTITY_BASED', 'TRANSPORT_TRIP', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
    defaultRate: 4500,
    applicabilityRule: 'MANDATORY',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gta-rcm-5',
    defaultTaxTreatment: 'DOMESTIC_GST_RCM',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 0,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 30,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-transport-trip',
    chargeCode: 'CHG-TRIP',
    chargeName: 'Transportation Trip Charges',
    chargeDescription: 'Dedicated vehicle / trip-based transportation fee.',
    chargeCategory: 'LOGISTICS',
    defaultApplicationLevel: 'TRANSPORT_TRIP',
    permittedApplicationLevels: ['TRANSPORT_TRIP', 'SHIPMENT', 'PO_HEADER', 'GRN', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PER_KM',
    defaultCalculationBasis: 'DISTANCE',
    defaultRate: 42,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gta-rcm-5',
    defaultTaxTreatment: 'DOMESTIC_GST_RCM',
    defaultAllocationBasis: 'PROPORTIONAL_WEIGHT',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 1200,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 35,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-handling',
    chargeCode: 'CHG-HANDLING',
    chargeName: 'Handling Charges',
    chargeDescription: 'Warehouse / dock / receipt handling charges.',
    chargeCategory: 'HANDLING',
    defaultApplicationLevel: 'GRN',
    permittedApplicationLevels: ['PO_LINE', 'GRN', 'SHIPMENT', 'PR_HEADER', 'PR_LINE', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PER_UNIT',
    defaultCalculationBasis: 'RECEIVED_QUANTITY',
    defaultRate: 50,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'DIRECT_LINE_ALLOCATION',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 40,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-packing',
    chargeCode: 'CHG-PACKAGING',
    chargeName: 'Packing Charges',
    chargeDescription: 'Export crating, palletization, and moisture-barrier packaging.',
    chargeCategory: 'PACKAGING',
    defaultApplicationLevel: 'PR_HEADER',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
    defaultRate: 2000,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 45,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-customs-duty',
    chargeCode: 'CHG-CUSTOMS',
    chargeName: 'Customs Duty (BCD + SWS)',
    chargeDescription: 'Import Basic Customs Duty & Social Welfare Surcharge assessed on CIF customs value.',
    chargeCategory: 'IMPORT_CUSTOMS',
    defaultApplicationLevel: 'SHIPMENT',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'SHIPMENT', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PERCENTAGE',
    defaultCalculationBasis: 'MATERIAL_LINE_VALUE',
    defaultRate: 10,
    applicabilityRule: 'CONDITIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-imp-bcd-sws',
    defaultTaxTreatment: 'IMPORT_CUSTOMS_BCD_SWS',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'NON_RECOVERABLE',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 50,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-customs-clearance',
    chargeCode: 'CHG-CHA',
    chargeName: 'Customs Clearance & Broker Charges',
    chargeDescription: 'CHA filing, Bill of Entry processing, and port clearance agency fee.',
    chargeCategory: 'IMPORT_CUSTOMS',
    defaultApplicationLevel: 'SHIPMENT',
    permittedApplicationLevels: ['PR_HEADER', 'PO_HEADER', 'SHIPMENT', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'NUMBER_OF_SHIPMENTS',
    defaultRate: 8500,
    applicabilityRule: 'CONDITIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 55,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-port-thc',
    chargeCode: 'CHG-PORT-THC',
    chargeName: 'Port & Terminal Handling Charges (THC)',
    chargeDescription: 'Container terminal handling, CFS wharfage, and port documentation charges.',
    chargeCategory: 'IMPORT_CUSTOMS',
    defaultApplicationLevel: 'SHIPMENT',
    permittedApplicationLevels: ['SHIPMENT', 'PO_HEADER', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PER_SHIPMENT',
    defaultCalculationBasis: 'NUMBER_OF_SHIPMENTS',
    defaultRate: 12000,
    applicabilityRule: 'CONDITIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_VOLUME',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 60,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-import-igst',
    chargeCode: 'CHG-IMP-IGST',
    chargeName: 'Import IGST Assessment',
    chargeDescription: 'Statutory IGST levied at customs clearance (Input Credit Recoverable).',
    chargeCategory: 'IMPORT_CUSTOMS',
    defaultApplicationLevel: 'SHIPMENT',
    permittedApplicationLevels: ['SHIPMENT', 'PO_HEADER', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PERCENTAGE',
    defaultCalculationBasis: 'MATERIAL_LINE_VALUE',
    defaultRate: 18,
    applicabilityRule: 'CONDITIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-imp-igst-18',
    defaultTaxTreatment: 'IMPORT_IGST',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 65,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-demurrage',
    chargeCode: 'CHG-DEMURRAGE',
    chargeName: 'Demurrage & Detention Charges',
    chargeDescription: 'Port container retention / detention charges calculated per overdue day.',
    chargeCategory: 'IMPORT_CUSTOMS',
    defaultApplicationLevel: 'SHIPMENT',
    permittedApplicationLevels: ['SHIPMENT', 'INVOICE_LEVEL', 'GRN'],
    defaultCalculationMethod: 'PER_DAY',
    defaultCalculationBasis: 'NUMBER_OF_DAYS',
    defaultRate: 2500,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-nonrec-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'NON_RECOVERABLE',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 70,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-insurance',
    chargeCode: 'CHG-INSURANCE',
    chargeName: 'Transit & Marine Cargo Insurance',
    chargeDescription: 'All-risk inland transit or international marine cargo insurance premium.',
    chargeCategory: 'INSURANCE',
    defaultApplicationLevel: 'PO_HEADER',
    permittedApplicationLevels: ['PR_HEADER', 'PO_HEADER', 'SHIPMENT', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'PERCENTAGE',
    defaultCalculationBasis: 'TOTAL_PO_MATERIAL_VALUE',
    defaultRate: 0.25,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'PROPORTIONAL_VALUE',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 250,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 75,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-inspection',
    chargeCode: 'CHG-INSPECTION',
    chargeName: 'Inspection & Metallurgical Testing Charges',
    chargeDescription: 'NABL third-party pre-dispatch inspection, NDT & laboratory testing.',
    chargeCategory: 'QUALITY_COMPLIANCE',
    defaultApplicationLevel: 'PR_LINE',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'GRN', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'FIXED_AMOUNT',
    defaultCalculationBasis: 'MANUAL_ALLOCATION',
    defaultRate: 3000,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'EQUAL_ALLOCATION' as any,
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 80,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-installation',
    chargeCode: 'CHG-INSTALLATION',
    chargeName: 'Installation & Commissioning Charges',
    chargeDescription: 'OEM field engineer site erection, calibration, and commissioning.',
    chargeCategory: 'SERVICE',
    defaultApplicationLevel: 'PO_LINE',
    permittedApplicationLevels: ['PR_HEADER', 'PR_LINE', 'PO_HEADER', 'PO_LINE', 'INVOICE_LEVEL'],
    defaultCalculationMethod: 'ACTUAL_COST',
    defaultCalculationBasis: 'ACTUAL_INVOICE_AMOUNT',
    defaultRate: 5000,
    applicabilityRule: 'OPTIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gst-18',
    defaultTaxTreatment: 'DOMESTIC_GST_TAXABLE',
    defaultAllocationBasis: 'DIRECT_LINE_ALLOCATION',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 90,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
  {
    id: 'cm-formula-weight-haul',
    chargeCode: 'CHG-HEAVY-HAUL',
    chargeName: 'Weight & Distance Heavy Haulage Formula Charge',
    chargeDescription: 'Configurable formula-driven surcharge for heavy raw-material tonnage over long distance.',
    chargeCategory: 'LOGISTICS',
    defaultApplicationLevel: 'QUANTITY_BASED',
    permittedApplicationLevels: ['PR_HEADER', 'PO_HEADER', 'SHIPMENT', 'TRANSPORT_TRIP', 'QUANTITY_BASED'],
    defaultCalculationMethod: 'FORMULA_BASED',
    defaultCalculationBasis: 'GROSS_WEIGHT',
    defaultRate: 18,
    defaultFormulaExpression: 'max(1000, round(weightMt * distanceKm * rate, 2))',
    applicabilityRule: 'CONDITIONAL',
    defaultCurrency: 'INR',
    defaultTaxMappingId: 'tax-dom-gta-rcm-5',
    defaultTaxTreatment: 'DOMESTIC_GST_RCM',
    defaultAllocationBasis: 'PROPORTIONAL_WEIGHT',
    chargeBearer: 'BUYER',
    recoverability: 'RECOVERABLE_INPUT_CREDIT',
    minimumCharge: 1000,
    maximumCharge: 150000,
    roundingRule: 'HALF_UP',
    decimalPrecision: 2,
    calculationSequence: 95,
    effectiveFrom: '2025-04-01',
    isActive: true,
    isSystemSeeded: true,
    createdBy: 'System Governance',
    createdDate: '2026-04-01T00:00:00Z',
    modifiedBy: 'System Governance',
    modifiedDate: '2026-04-01T00:00:00Z',
  },
];

// Normalize defaultAllocationBasis on cm-inspection so TypeScript strict union matches EQUAL_DISTRIBUTION
INITIAL_CHARGE_MASTER.find((c) => c.id === 'cm-inspection')!.defaultAllocationBasis = 'EQUAL_DISTRIBUTION';

const DEFAULT_SAP_CHARGE_META: Record<
  string,
  { sapExpenseCode: string; sapExpenseName: string; sapGlAccountCode: string; taxCode: string }
> = {
  'CHG-LOAD': {
    sapExpenseCode: 'SAP-EXP-LOAD-01',
    sapExpenseName: 'Loading & Material Handling Expense',
    sapGlAccountCode: '520110',
    taxCode: 'DOM-GST-18',
  },
  'CHG-UNLOAD': {
    sapExpenseCode: 'SAP-EXP-UNLOAD-02',
    sapExpenseName: 'Unloading & Receiving Bay Expense',
    sapGlAccountCode: '520120',
    taxCode: 'DOM-GST-18',
  },
  'CHG-FREIGHT': {
    sapExpenseCode: 'SAP-EXP-FREIGHT-03',
    sapExpenseName: 'Inward Freight & Carriage Expense',
    sapGlAccountCode: '520100',
    taxCode: 'DOM-GTA-RCM-5',
  },
  'CHG-TRIP': {
    sapExpenseCode: 'SAP-EXP-TRIP-04',
    sapExpenseName: 'Dedicated Trip Transport Expense',
    sapGlAccountCode: '520130',
    taxCode: 'DOM-GTA-RCM-5',
  },
  'CHG-HANDLING': {
    sapExpenseCode: 'SAP-EXP-HANDL-05',
    sapExpenseName: 'Warehouse & Terminal Handling Expense',
    sapGlAccountCode: '520140',
    taxCode: 'DOM-GST-18',
  },
  'CHG-PACKAGING': {
    sapExpenseCode: 'SAP-EXP-PACK-06',
    sapExpenseName: 'Packing & Crating Expense',
    sapGlAccountCode: '520150',
    taxCode: 'DOM-GST-18',
  },
  'CHG-CUSTOMS': {
    sapExpenseCode: 'SAP-EXP-CUST-07',
    sapExpenseName: 'Import Basic Customs Duty & SWS',
    sapGlAccountCode: '520200',
    taxCode: 'IMP-BCD-10-SWS-10',
  },
  'CHG-CHA': {
    sapExpenseCode: 'SAP-EXP-CHA-08',
    sapExpenseName: 'Customs Clearance & CHA Agency Expense',
    sapGlAccountCode: '520210',
    taxCode: 'DOM-GST-18',
  },
  'CHG-PORT-THC': {
    sapExpenseCode: 'SAP-EXP-THC-09',
    sapExpenseName: 'Port & Terminal Handling Expense',
    sapGlAccountCode: '520220',
    taxCode: 'DOM-GST-18',
  },
  'CHG-IMP-IGST': {
    sapExpenseCode: 'SAP-EXP-IGST-10',
    sapExpenseName: 'Import IGST Clearing Account',
    sapGlAccountCode: '520230',
    taxCode: 'IMP-IGST-18',
  },
  'CHG-DEMURRAGE': {
    sapExpenseCode: 'SAP-EXP-DEMUR-11',
    sapExpenseName: 'Port Detention & Demurrage Expense',
    sapGlAccountCode: '520240',
    taxCode: 'DOM-GST-NR-18',
  },
  'CHG-INSURANCE': {
    sapExpenseCode: 'SAP-EXP-INS-12',
    sapExpenseName: 'Transit & Marine Cargo Insurance',
    sapGlAccountCode: '520300',
    taxCode: 'DOM-GST-18',
  },
  'CHG-INSPECTION': {
    sapExpenseCode: 'SAP-EXP-INSP-13',
    sapExpenseName: 'Pre-Dispatch Quality Inspection Expense',
    sapGlAccountCode: '520400',
    taxCode: 'DOM-GST-18',
  },
  'CHG-INSTALLATION': {
    sapExpenseCode: 'SAP-EXP-INST-14',
    sapExpenseName: 'Equipment Installation & Commissioning Expense',
    sapGlAccountCode: '520500',
    taxCode: 'DOM-GST-18',
  },
  'CHG-HEAVY-HAUL': {
    sapExpenseCode: 'SAP-EXP-HAUL-15',
    sapExpenseName: 'Heavy Haulage Surcharge Expense',
    sapGlAccountCode: '520160',
    taxCode: 'DOM-GTA-RCM-5',
  },
};

for (const item of INITIAL_CHARGE_MASTER) {
  const sapMeta = DEFAULT_SAP_CHARGE_META[item.chargeCode] || {
    sapExpenseCode: `SAP-EXP-${item.chargeCode.replace(/[^A-Z0-9]/g, '')}`,
    sapExpenseName: item.chargeName,
    sapGlAccountCode: '520900',
    taxCode: 'DOM-GST-18',
  };
  item.applicablePrTypes = item.applicablePrTypes || ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'];
  item.sapExpenseCode = item.sapExpenseCode || sapMeta.sapExpenseCode;
  item.sapExpenseName = item.sapExpenseName || sapMeta.sapExpenseName;
  item.sapGlAccountCode = item.sapGlAccountCode || sapMeta.sapGlAccountCode;
  item.taxCode = item.taxCode || sapMeta.taxCode;
  item.approvalStatus = item.approvalStatus || 'APPROVED';
  item.approvedBy = item.approvedBy || 'Vikramaditya Rao (Org Admin)';
  item.approvedAt = item.approvedAt || '2026-04-01T00:05:00Z';
}

export const INITIAL_CHARGE_RULES: ChargeRuleRecord[] = [
  {
    id: 'crule-import-customs-mand',
    ruleCode: 'RULE-IMP-CUSTOMS',
    ruleName: 'Import Procurement Mandatory Customs & Clearance Charges',
    chargeMasterId: 'cm-customs-duty',
    chargeCode: 'CHG-CUSTOMS',
    targetApplicability: 'MANDATORY',
    targetApplicationLevels: ['SHIPMENT', 'PO_HEADER'],
    priority: 10,
    logicalOperator: 'AND',
    conditions: [
      { id: 'cond-imp-1', field: 'procurementType', operator: 'EQUALS', value: 'IMPORT' },
    ],
    requiresExplicitConfirmationIfConditional: true,
    allowMandatoryBypassWithException: true,
    isActive: true,
    effectiveFrom: '2025-04-01',
    createdBy: 'Trade Compliance Lead',
    createdAt: '2026-04-01T00:00:00Z',
    updatedBy: 'Trade Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'crule-import-cha',
    ruleCode: 'RULE-IMP-CHA',
    ruleName: 'Import Procurement Customs Broker & Port Clearance',
    chargeMasterId: 'cm-customs-clearance',
    chargeCode: 'CHG-CHA',
    targetApplicability: 'MANDATORY',
    targetApplicationLevels: ['SHIPMENT'],
    priority: 15,
    logicalOperator: 'AND',
    conditions: [
      { id: 'cond-cha-1', field: 'procurementType', operator: 'EQUALS', value: 'IMPORT' },
    ],
    requiresExplicitConfirmationIfConditional: false,
    allowMandatoryBypassWithException: true,
    isActive: true,
    effectiveFrom: '2025-04-01',
    createdBy: 'Trade Compliance Lead',
    createdAt: '2026-04-01T00:00:00Z',
    updatedBy: 'Trade Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'crule-import-igst',
    ruleCode: 'RULE-IMP-IGST',
    ruleName: 'Import IGST Assessment Rule',
    chargeMasterId: 'cm-import-igst',
    chargeCode: 'CHG-IMP-IGST',
    targetApplicability: 'MANDATORY',
    targetApplicationLevels: ['SHIPMENT'],
    priority: 16,
    logicalOperator: 'AND',
    conditions: [
      { id: 'cond-igst-1', field: 'procurementType', operator: 'EQUALS', value: 'IMPORT' },
    ],
    requiresExplicitConfirmationIfConditional: false,
    allowMandatoryBypassWithException: true,
    isActive: true,
    effectiveFrom: '2025-04-01',
    createdBy: 'Trade Compliance Lead',
    createdAt: '2026-04-01T00:00:00Z',
    updatedBy: 'Trade Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'crule-dom-freight-ddp-exempt',
    ruleCode: 'RULE-DOM-DDP-FREIGHT',
    ruleName: 'DDP Incoterms Freight Included by Supplier (Not Applicable Separate)',
    chargeMasterId: 'cm-freight',
    chargeCode: 'CHG-FREIGHT',
    targetApplicability: 'NOT_APPLICABLE',
    targetApplicationLevels: ['PO_HEADER'],
    priority: 5,
    logicalOperator: 'AND',
    conditions: [
      { id: 'cond-ddp-1', field: 'incoterms', operator: 'EQUALS', value: 'DDP' },
    ],
    requiresExplicitConfirmationIfConditional: false,
    allowMandatoryBypassWithException: true,
    isActive: true,
    effectiveFrom: '2025-04-01',
    createdBy: 'Procurement Governance Lead',
    createdAt: '2026-04-01T00:00:00Z',
    updatedBy: 'Procurement Governance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'crule-high-value-insurance',
    ruleCode: 'RULE-INS-HIGHVAL',
    ruleName: 'Mandatory Transit Insurance Above 50,000 Material Value',
    chargeMasterId: 'cm-insurance',
    chargeCode: 'CHG-INSURANCE',
    targetApplicability: 'CONDITIONAL',
    targetApplicationLevels: ['PO_HEADER', 'SHIPMENT'],
    priority: 20,
    logicalOperator: 'AND',
    conditions: [
      { id: 'cond-ins-1', field: 'materialValue', operator: 'GREATER_OR_EQUAL', value: 50000 },
    ],
    requiresExplicitConfirmationIfConditional: true,
    allowMandatoryBypassWithException: true,
    isActive: true,
    effectiveFrom: '2025-04-01',
    createdBy: 'Risk & Compliance Lead',
    createdAt: '2026-04-01T00:00:00Z',
    updatedBy: 'Risk & Compliance Lead',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

let memMaster: ChargeMasterRecord[] | null = null;
let memRules: ChargeRuleRecord[] | null = null;
let memTaxMappings: StatutoryTaxMapping[] | null = null;
let memFxRates: ExchangeRateEntry[] | null = null;

function evaluateCondition(cond: ChargeRuleCondition, ctx: ChargeRuleEvaluationContext): boolean {
  const rawVal = (ctx as any)[cond.field];
  if (rawVal === undefined || rawVal === null) return false;

  switch (cond.operator) {
    case 'EQUALS':
      return String(rawVal).toUpperCase() === String(cond.value).toUpperCase();
    case 'NOT_EQUALS':
      return String(rawVal).toUpperCase() !== String(cond.value).toUpperCase();
    case 'IN': {
      const list = Array.isArray(cond.value)
        ? cond.value.map((v) => String(v).toUpperCase())
        : String(cond.value)
            .split(',')
            .map((v) => v.trim().toUpperCase());
      return list.includes(String(rawVal).toUpperCase());
    }
    case 'GREATER_THAN':
      return Number(rawVal) > Number(cond.value);
    case 'GREATER_OR_EQUAL':
      return Number(rawVal) >= Number(cond.value);
    case 'LESS_THAN':
      return Number(rawVal) < Number(cond.value);
    case 'LESS_OR_EQUAL':
      return Number(rawVal) <= Number(cond.value);
    default:
      return false;
  }
}

export const chargeMasterService = {
  resetForTesting(): void {
    memMaster = JSON.parse(JSON.stringify(INITIAL_CHARGE_MASTER));
    memRules = JSON.parse(JSON.stringify(INITIAL_CHARGE_RULES));
    memTaxMappings = JSON.parse(JSON.stringify(INITIAL_STATUTORY_TAX_MAPPINGS));
    memFxRates = JSON.parse(JSON.stringify(INITIAL_EXCHANGE_RATES));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_MASTER);
      localStorage.removeItem(STORAGE_KEY_RULES);
      localStorage.removeItem(STORAGE_KEY_TAX_MAPPINGS);
      localStorage.removeItem(STORAGE_KEY_FX_RATES);
    }
  },

  getCharges(includeInactive = true): ChargeMasterRecord[] {
    let list: ChargeMasterRecord[] | null = null;
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_MASTER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        }
      } catch {}
    }
    if (!list) {
      if (!memMaster) memMaster = JSON.parse(JSON.stringify(INITIAL_CHARGE_MASTER));
      list = memMaster!;
    }
    const normalized = list.map((c) => {
      const sapMeta = DEFAULT_SAP_CHARGE_META[c.chargeCode] || {
        sapExpenseCode: `SAP-EXP-${c.chargeCode.replace(/[^A-Z0-9]/g, '')}`,
        sapExpenseName: c.chargeName,
        sapGlAccountCode: '520900',
        taxCode: 'DOM-GST-18',
      };
      return {
        ...c,
        versionNumber: c.versionNumber || 1,
        applicablePrTypes: c.applicablePrTypes || ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
        sapExpenseCode: c.sapExpenseCode || sapMeta.sapExpenseCode,
        sapExpenseName: c.sapExpenseName || sapMeta.sapExpenseName,
        sapGlAccountCode: c.sapGlAccountCode || sapMeta.sapGlAccountCode,
        taxCode: c.taxCode || sapMeta.taxCode,
        approvalStatus: c.approvalStatus || 'APPROVED',
      };
    });
    return includeInactive
      ? normalized
      : normalized.filter((c) => c.isActive && (!c.approvalStatus || c.approvalStatus === 'APPROVED'));
  },

  saveCharges(charges: ChargeMasterRecord[]): void {
    memMaster = JSON.parse(JSON.stringify(charges));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(charges));
      } catch {}
    }
  },

  getChargeByIdOrCode(idOrCode: string): ChargeMasterRecord | undefined {
    const upper = idOrCode.trim().toUpperCase();
    return this.getCharges(true).find(
      (c) => c.id === idOrCode || c.chargeCode.toUpperCase() === upper
    );
  },

  createCharge(
    payload: Omit<ChargeMasterRecord, 'id' | 'createdDate' | 'modifiedDate'>,
    actor: { id: string; name: string; user?: User }
  ): ChargeMasterRecord {
    if (actor.user && actor.user.role !== 'PLATFORM_ADMIN' && actor.user.role !== 'ORG_ADMIN') {
      if (!rbacPermissionService.hasPermission(actor.user, 'CHARGE_MASTER_MANAGE')) {
        throw new Error(
          `Authorization Denied: User "${actor.user.fullName}" (${actor.user.role}) cannot create Charge Master records.`
        );
      }
    }
    const code = payload.chargeCode.trim().toUpperCase();
    if (!code) throw new Error('Charge Code is mandatory.');
    if (!payload.chargeName.trim()) throw new Error('Charge Name is mandatory.');

    const existing = this.getCharges(true);
    if (existing.some((c) => c.isActive && c.chargeCode.toUpperCase() === code)) {
      throw new Error(`Duplicate active Charge Code "${code}" is prohibited.`);
    }

    if (payload.defaultCalculationMethod === 'FORMULA_BASED') {
      const check = validateChargeFormula(payload.defaultFormulaExpression || '');
      if (!check.valid) {
        throw new Error(`Invalid Charge Formula: ${check.error}`);
      }
    }

    if (
      payload.minimumCharge !== undefined &&
      payload.maximumCharge !== undefined &&
      payload.minimumCharge > payload.maximumCharge
    ) {
      throw new Error('Minimum Charge cannot exceed Maximum Charge.');
    }

    const now = new Date().toISOString();
    const sapMeta = DEFAULT_SAP_CHARGE_META[code] || {
      sapExpenseCode: `SAP-EXP-${code.replace(/[^A-Z0-9]/g, '')}`,
      sapExpenseName: payload.chargeName.trim(),
      sapGlAccountCode: '520900',
      taxCode: 'DOM-GST-18',
    };
    const record: ChargeMasterRecord = {
      ...payload,
      id: `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chargeCode: code,
      versionNumber: 1,
      applicablePrTypes: payload.applicablePrTypes || ['MANUAL', 'MRP', 'REPAIR', 'MAINTENANCE', 'CAPEX_ASSET'],
      sapExpenseCode: payload.sapExpenseCode || sapMeta.sapExpenseCode,
      sapExpenseName: payload.sapExpenseName || sapMeta.sapExpenseName,
      sapGlAccountCode: payload.sapGlAccountCode || sapMeta.sapGlAccountCode,
      taxCode: payload.taxCode || sapMeta.taxCode,
      approvalStatus: payload.approvalStatus || 'APPROVED',
      createdBy: actor.name,
      createdDate: now,
      modifiedBy: actor.name,
      modifiedDate: now,
    };

    const next = [record, ...existing];
    this.saveCharges(next);

    EnterpriseAuditService.logEvent({
      companyId: 'ALL',
      entityType: 'CHARGE_GOVERNANCE',
      entityId: record.id,
      eventType: 'CHARGE_MASTER_CREATED',
      eventDescription: `Created Charge Master record ${record.chargeCode} (${record.chargeName})`,
      newValue: { chargeName: record.chargeName, category: record.chargeCategory, isActive: record.isActive, versionNumber: 1 },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: `Created Charge Master record ${record.chargeCode}`,
    });

    return record;
  },

  updateCharge(
    id: string,
    updates: Partial<ChargeMasterRecord>,
    actor: { id: string; name: string; user?: User }
  ): ChargeMasterRecord {
    if (actor.user && actor.user.role !== 'PLATFORM_ADMIN' && actor.user.role !== 'ORG_ADMIN') {
      if (!rbacPermissionService.hasPermission(actor.user, 'CHARGE_MASTER_MANAGE')) {
        throw new Error(
          `Authorization Denied: User "${actor.user.fullName}" (${actor.user.role}) cannot modify Charge Master records.`
        );
      }
    }
    const list = this.getCharges(true);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Charge Master "${id}" not found.`);

    const current = list[idx];
    const nextCode = (updates.chargeCode || current.chargeCode).trim().toUpperCase();
    const willBeActive = updates.isActive ?? current.isActive;

    if (
      willBeActive &&
      list.some((c, i) => i !== idx && c.isActive && c.chargeCode.toUpperCase() === nextCode)
    ) {
      throw new Error(`Duplicate active Charge Code "${nextCode}" is prohibited.`);
    }

    if (updates.defaultCalculationMethod === 'FORMULA_BASED' || updates.defaultFormulaExpression !== undefined) {
      const expr = updates.defaultFormulaExpression ?? current.defaultFormulaExpression ?? '';
      if ((updates.defaultCalculationMethod ?? current.defaultCalculationMethod) === 'FORMULA_BASED') {
        const check = validateChargeFormula(expr);
        if (!check.valid) throw new Error(`Invalid Charge Formula: ${check.error}`);
      }
    }

    const nextVersion = (current.versionNumber || 1) + 1;
    const updated: ChargeMasterRecord = {
      ...current,
      ...updates,
      chargeCode: nextCode,
      versionNumber: nextVersion,
      modifiedBy: actor.name,
      modifiedDate: new Date().toISOString(),
    };

    const next = [...list];
    next[idx] = updated;
    this.saveCharges(next);

    EnterpriseAuditService.logEvent({
      companyId: 'ALL',
      entityType: 'CHARGE_GOVERNANCE',
      entityId: updated.id,
      eventType: 'CHARGE_MASTER_UPDATED',
      eventDescription: `Updated Charge Master ${updated.chargeCode} to v${nextVersion}`,
      previousValue: { defaultRate: current.defaultRate, isActive: current.isActive, versionNumber: current.versionNumber || 1 },
      newValue: { defaultRate: updated.defaultRate, isActive: updated.isActive, versionNumber: nextVersion },
      changedByUserId: actor.id,
      changedByName: actor.name,
      changeReason: `Updated Charge Master ${updated.chargeCode} to v${nextVersion}`,
    });

    return updated;
  },

  setChargeActiveStatus(
    id: string,
    isActive: boolean,
    actor: { id: string; name: string; user?: User }
  ): ChargeMasterRecord {
    const existing = this.getCharges(true).find((c) => c.id === id);
    if (isActive && existing && existing.approvalStatus && existing.approvalStatus !== 'APPROVED') {
      throw new Error(
        `Charge Master "${existing.chargeCode}" cannot be activated while approval status is ${existing.approvalStatus}.`
      );
    }
    return this.updateCharge(id, { isActive }, actor);
  },

  approveChargeMaster(
    id: string,
    checker: { id: string; name: string; user?: User },
    activateImmediately = true
  ): ChargeMasterRecord {
    const existing = this.getCharges(true).find((c) => c.id === id);
    if (!existing) throw new Error(`Charge Master "${id}" not found.`);
    if (existing.modifiedBy && existing.modifiedBy === checker.name && existing.approvalStatus === 'PENDING_APPROVAL') {
      throw new Error('Maker-Checker Violation: The user who submitted this Charge Master cannot approve it.');
    }
    const now = new Date().toISOString();
    return this.updateCharge(
      id,
      {
        approvalStatus: 'APPROVED',
        approvedBy: checker.name,
        approvedAt: now,
        isActive: activateImmediately ? true : existing.isActive,
      },
      checker
    );
  },

  getTaxMappings(): StatutoryTaxMapping[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TAX_MAPPINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memTaxMappings) {
      memTaxMappings = JSON.parse(JSON.stringify(INITIAL_STATUTORY_TAX_MAPPINGS));
    }
    return memTaxMappings!;
  },

  saveTaxMappings(mappings: StatutoryTaxMapping[]): void {
    memTaxMappings = JSON.parse(JSON.stringify(mappings));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_TAX_MAPPINGS, JSON.stringify(mappings));
      } catch {}
    }
  },

  upsertTaxMapping(mapping: StatutoryTaxMapping): StatutoryTaxMapping {
    const list = this.getTaxMappings();
    const idx = list.findIndex((t) => t.id === mapping.id || t.taxCode === mapping.taxCode);
    const next = [...list];
    if (idx >= 0) next[idx] = mapping;
    else next.unshift(mapping);
    this.saveTaxMappings(next);
    return mapping;
  },

  getTaxMappingById(id: string): StatutoryTaxMapping {
    const list = this.getTaxMappings();
    return list.find((t) => t.id === id || t.taxCode === id) || list[0];
  },

  getExchangeRates(): ExchangeRateEntry[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_FX_RATES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memFxRates) {
      memFxRates = JSON.parse(JSON.stringify(INITIAL_EXCHANGE_RATES));
    }
    return memFxRates!;
  },

  saveExchangeRates(rates: ExchangeRateEntry[]): void {
    memFxRates = JSON.parse(JSON.stringify(rates));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_FX_RATES, JSON.stringify(rates));
      } catch {}
    }
  },

  getExchangeRate(fromCurrency: string, toCurrency: string): number {
    const from = (fromCurrency || 'INR').toUpperCase();
    const to = (toCurrency || 'INR').toUpperCase();
    if (from === to) return 1;
    const rates = this.getExchangeRates();
    const direct = rates.find((r) => r.fromCurrency === from && r.toCurrency === to);
    if (direct) return direct.rate;
    const inverse = rates.find((r) => r.fromCurrency === to && r.toCurrency === from);
    if (inverse && inverse.rate > 0) return Number((1 / inverse.rate).toFixed(6));
    // Triangulate via INR
    const toInr = rates.find((r) => r.fromCurrency === from && r.toCurrency === 'INR')?.rate;
    const fromInrToTarget = rates.find((r) => r.fromCurrency === 'INR' && r.toCurrency === to)?.rate;
    if (toInr && fromInrToTarget) return Number((toInr * fromInrToTarget).toFixed(6));
    return 1;
  },

  getRules(): ChargeRuleRecord[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_RULES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (!memRules) {
      memRules = JSON.parse(JSON.stringify(INITIAL_CHARGE_RULES));
    }
    return memRules!;
  },

  saveRules(rules: ChargeRuleRecord[]): void {
    memRules = JSON.parse(JSON.stringify(rules));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
      } catch {}
    }
  },

  createRule(rule: Omit<ChargeRuleRecord, 'id' | 'createdAt' | 'updatedAt'>): ChargeRuleRecord {
    const now = new Date().toISOString();
    const newRule: ChargeRuleRecord = {
      ...rule,
      id: `crule-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.saveRules([newRule, ...this.getRules()]);
    return newRule;
  },

  /**
   * Evaluates applicability for a given Charge Master record against transaction context.
   */
  evaluateApplicability(
    chargeMaster: ChargeMasterRecord,
    ctx: ChargeRuleEvaluationContext,
    applicationLevel?: ChargeApplicationLevel
  ): {
    applicability: ChargeApplicabilityStatus;
    matchedRule?: ChargeRuleRecord;
    requiresConfirmation: boolean;
  } {
    const txDate = ctx.transactionDate || new Date().toISOString().split('T')[0];

    if (!chargeMaster.isActive || (chargeMaster.approvalStatus && chargeMaster.approvalStatus !== 'APPROVED')) {
      return { applicability: 'NOT_APPLICABLE', requiresConfirmation: false };
    }
    if (ctx.prType && ctx.prType.toUpperCase() === 'EXPENSE') {
      return { applicability: 'NOT_APPLICABLE', requiresConfirmation: false };
    }
    if (
      ctx.prType &&
      chargeMaster.applicablePrTypes &&
      chargeMaster.applicablePrTypes.length > 0 &&
      !chargeMaster.applicablePrTypes.includes(ctx.prType as any)
    ) {
      return { applicability: 'NOT_APPLICABLE', requiresConfirmation: false };
    }
    if (chargeMaster.effectiveFrom && txDate < chargeMaster.effectiveFrom) {
      return { applicability: 'NOT_APPLICABLE', requiresConfirmation: false };
    }
    if (chargeMaster.effectiveTo && txDate > chargeMaster.effectiveTo) {
      return { applicability: 'NOT_APPLICABLE', requiresConfirmation: false };
    }

    const rules = this.getRules()
      .filter(
        (r) =>
          r.isActive &&
          (r.chargeMasterId === chargeMaster.id || r.chargeCode === chargeMaster.chargeCode) &&
          (!r.effectiveFrom || txDate >= r.effectiveFrom) &&
          (!r.effectiveTo || txDate <= r.effectiveTo) &&
          (!applicationLevel ||
            r.targetApplicationLevels.length === 0 ||
            r.targetApplicationLevels.includes(applicationLevel))
      )
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      if (rule.conditions.length === 0) {
        return {
          applicability: rule.targetApplicability,
          matchedRule: rule,
          requiresConfirmation:
            rule.targetApplicability === 'CONDITIONAL' && rule.requiresExplicitConfirmationIfConditional,
        };
      }
      const matched =
        rule.logicalOperator === 'AND'
          ? rule.conditions.every((c) => evaluateCondition(c, ctx))
          : rule.conditions.some((c) => evaluateCondition(c, ctx));

      if (matched) {
        return {
          applicability: rule.targetApplicability,
          matchedRule: rule,
          requiresConfirmation:
            rule.targetApplicability === 'CONDITIONAL' && rule.requiresExplicitConfirmationIfConditional,
        };
      }
    }

    return {
      applicability: chargeMaster.applicabilityRule,
      requiresConfirmation: chargeMaster.applicabilityRule === 'CONDITIONAL',
    };
  },

  retrieveApplicableCharges(
    ctx: ChargeRuleEvaluationContext,
    applicationLevel?: ChargeApplicationLevel
  ): Array<{
    chargeMaster: ChargeMasterRecord;
    applicability: ChargeApplicabilityStatus;
    matchedRule?: ChargeRuleRecord;
    requiresConfirmation: boolean;
  }> {
    const masters = this.getCharges(false);
    return masters
      .filter((m) => !applicationLevel || m.permittedApplicationLevels.includes(applicationLevel))
      .map((m) => ({
        chargeMaster: m,
        ...this.evaluateApplicability(m, ctx, applicationLevel),
      }))
      .sort((a, b) => a.chargeMaster.calculationSequence - b.chargeMaster.calculationSequence);
  },
};
