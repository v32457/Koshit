/**
 * KOSH INNOVATIONS — RFQ MANAGEMENT SERVICE
 * Manages RFQ Creation, Header/Lines, Supplier Invitations, Supplier Quotation Submissions,
 * Revision History, and Confidential Sealed Pricing logic.
 */

import {
  RfqHeader,
  RfqLineItem,
  RfqSupplierInvitation,
  SupplierQuotation,
  SupplierQuotationLine,
  RfqStatus,
} from '../types/rfqSourcing';
import {
  QuotationAccessAuditEntry,
  QuotationAttachmentVersion,
} from '../types/procurementFinanceGovernance';
import { INITIAL_BUSINESS_PARTNERS } from '../data/seedData';
import { uomConversionService } from './uomConversionService';
import { prRfqConversionService } from './prRfqConversionService';
import { financialYearService } from './financialYearService';
import { PurchaseRequisitionService } from './purchaseRequisitionService';
import { PurchaseOrganizationService } from './purchaseOrganizationService';
import { normalizeCompanyId, normalizeBranchId } from './prGovernancePolicyService';
import { inventoryValidationService } from './inventoryValidationService';

const STORAGE_KEY_RFQS = 'kosh_rfq_headers_v1';
const STORAGE_KEY_QUOTATIONS = 'kosh_supplier_quotations_v1';

let memoryRfqs: RfqHeader[] | null = null;
let memoryQuotations: SupplierQuotation[] | null = null;

export const INITIAL_RFQS: RfqHeader[] = [
  {
    id: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    title: 'Supply of Engineering Polymers & Corrugated Materials (Q4 FY26)',
    description: 'High-volume raw material sourcing for Puducherry & Hosur Injection Moulding Operations.',
    prReferences: ['PR-2026-0001'],
    rfqDate: '2026-11-05',
    responseDeadline: '2026-11-20',
    quotationValidityDays: 60,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Destination - Delivered at Plant Warehouse',
    paymentTerms: 'NET 60 Days after Receipt & Quality Inspection',
    incoterms: 'DDP - Delivered Duty Paid',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: true,
    status: 'QUOTATIONS_IN_PROGRESS',
    lines: [
      {
        id: 'rfq-line-001',
        rfqId: 'rfq-001',
        prLineId: 'pr-line-001',
        prNumber: 'PR-2026-0001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        category: 'Raw Materials',
        specifications: 'Injection Grade V0 flame retardant, UL94 certified, MFI 18-22 g/10min',
        manufacturerModelReq: 'BASF / Dupont Equivalent',
        quantityPurchUom: 20, // 20 BAGS (500 KG)
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        requiredDeliveryDate: '2026-12-01',
        targetWarehouse: 'PDY-STR',
        qualityRequirements: 'Mill Test Certificate, RoHS & REACH compliance required',
        warrantyMonths: 12,
        targetUnitPrice: 7200,
      },
    ],
    invitations: [
      {
        id: 'inv-001',
        rfqId: 'rfq-001',
        vendorId: 'bp-002',
        vendorCode: 'VEND-BASF-01',
        vendorName: 'BASF INDIA LIMITED',
        contactEmail: 'orders.india@basf.com',
        invitedAt: '2026-11-05T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-20',
      },
      {
        id: 'inv-002',
        rfqId: 'rfq-001',
        vendorId: 'bp-003',
        vendorCode: 'VEND-POLY-02',
        vendorName: 'POLYMER SOLUTIONS INDIA LTD',
        contactEmail: 'sales@polymersolutions.in',
        invitedAt: '2026-11-05T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-20',
      },
    ],
    createdAt: '2026-11-05T09:00:00Z',
    updatedAt: '2026-11-08T11:00:00Z',
  },
  {
    id: 'rfq-002',
    rfqNumber: 'RFQ-2026-0002',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    purchaseOrgId: 'po-kosh-01',
    title: 'Precision Fasteners & Heavy Assembly Bolts M8 (Draft Preparation)',
    description: 'High-tensile Grade 8.8 hex flange bolts for chassis assembly lines.',
    prReferences: ['PR-2026-0002'],
    rfqDate: '2026-11-09',
    responseDeadline: '2026-11-25',
    quotationValidityDays: 45,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Hosur Factory Gate',
    paymentTerms: 'NET 30 Days',
    incoterms: 'FCA',
    evaluationMethod: 'SINGLE_STAGE',
    sealedCommercialQuotations: true,
    status: 'DRAFT',
    lines: [
      {
        id: 'rfq-line-002',
        rfqId: 'rfq-002',
        prLineId: 'pr-line-002',
        prNumber: 'PR-2026-0002',
        itemCode: 'PKG-FASTENER-M8',
        description: 'M8 x 45mm High-Tensile Grade 8.8 Hex Flange Bolts',
        category: 'Packaging & Fasteners',
        specifications: 'DIN 6921 Grade 8.8 Geomet Zinc Flake coated, 720h salt spray test',
        quantityPurchUom: 50, // 50 BOX (5,000 EA)
        purchaseUom: 'BOX',
        inventoryUom: 'EA',
        conversionRatio: 100,
        requiredDeliveryDate: '2026-12-10',
        targetWarehouse: 'HSR-STR',
        qualityRequirements: 'IS 1367 Part 3 certified',
        warrantyMonths: 24,
        targetUnitPrice: 850,
      },
    ],
    invitations: [],
    createdAt: '2026-11-09T08:30:00Z',
    updatedAt: '2026-11-09T08:30:00Z',
  },
  {
    id: 'rfq-003',
    rfqNumber: 'RFQ-2026-0003',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-sriper-03',
    branchCode: '003',
    branchName: 'Sriperumbudur Electronics Facility',
    purchaseOrgId: 'po-kosh-01',
    title: 'High-Speed Pneumatic Solenoid Directional Control Valves',
    description: 'Automated conveyor sorting actuator components awaiting final approval.',
    prReferences: ['PR-2026-0004'],
    rfqDate: '2026-11-08',
    responseDeadline: '2026-11-28',
    quotationValidityDays: 60,
    buyerId: 'usr-buyer-02',
    buyerName: 'Priya Narayanan',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'Delivered at Sriperumbudur Cleanroom Receiving',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: true,
    status: 'PENDING_RELEASE_APPROVAL',
    lines: [
      {
        id: 'rfq-line-003',
        rfqId: 'rfq-003',
        prLineId: 'pr-line-004',
        prNumber: 'PR-2026-0004',
        itemCode: 'MAPALBL0003',
        description: 'Pneumatic Solenoid Valve – 5/2 Way Single Solenoid – 24V DC G1/4"',
        category: 'Maintenance & Spares',
        specifications: '5/2 Way Pilot Operated, 0.15 - 0.8 MPa Operating Pressure, IP65 Coil',
        quantityPurchUom: 15,
        purchaseUom: 'SET',
        inventoryUom: 'EA',
        conversionRatio: 1,
        requiredDeliveryDate: '2026-12-05',
        targetWarehouse: 'SRP-MRO',
        qualityRequirements: 'CE / RoHS certified, 10M cycle endurance test report',
        warrantyMonths: 18,
        targetUnitPrice: 3200,
      },
    ],
    invitations: [
      {
        id: 'inv-003',
        rfqId: 'rfq-003',
        vendorId: 'bp-004',
        vendorCode: 'VEND-FESTO-01',
        vendorName: 'FESTO CONTROLS INDIA PVT LTD',
        contactEmail: 'tenders@festo.in',
        invitedAt: '2026-11-08T14:00:00Z',
        invitationStatus: 'INVITED',
        responseDeadline: '2026-11-28',
      },
    ],
    createdAt: '2026-11-08T11:00:00Z',
    updatedAt: '2026-11-08T14:30:00Z',
  },
  {
    id: 'rfq-004',
    rfqNumber: 'RFQ-2026-0004',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pune-04',
    branchCode: '004',
    branchName: 'Pune Stamping & Tooling Plant',
    purchaseOrgId: 'po-kosh-01',
    title: 'Automotive Protective HDPE Corrugated Sleeves (Multi-PR Consolidated)',
    description: 'Consolidated packaging requirement pooled from PR-2026-0003 and PR-2026-0005.',
    prReferences: ['PR-2026-0003', 'PR-2026-0005'],
    rfqDate: '2026-11-06',
    responseDeadline: '2026-11-22',
    quotationValidityDays: 45,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Chakan MIDC, Pune',
    paymentTerms: 'NET 45 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: true,
    status: 'UNDER_TECHNICAL_EVALUATION',
    lines: [
      {
        id: 'rfq-line-004',
        rfqId: 'rfq-004',
        prLineId: 'pr-line-003',
        prNumber: 'PR-2026-0003',
        itemCode: 'FGHDMCRGY0002',
        description: 'HDPE Corrugated Protective Sleeve – 35mm OD – Industrial Grey',
        category: 'Finished Goods',
        specifications: 'High-density polyethylene extruded sleeve, UV stabilized, 100m roll',
        quantityPurchUom: 40,
        purchaseUom: 'ROLL',
        inventoryUom: 'MTR',
        conversionRatio: 100,
        requiredDeliveryDate: '2026-12-15',
        targetWarehouse: 'PUN-STR',
        qualityRequirements: 'IS 14887:2014 compliant',
        warrantyMonths: 12,
        targetUnitPrice: 1450,
      },
    ],
    invitations: [
      {
        id: 'inv-004',
        rfqId: 'rfq-004',
        vendorId: 'bp-005',
        vendorCode: 'VEND-NATIONAL-01',
        vendorName: 'NATIONAL POLYMERS CORP',
        contactEmail: 'bids@nationalpolymers.in',
        invitedAt: '2026-11-06T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-22',
      },
      {
        id: 'inv-005',
        rfqId: 'rfq-004',
        vendorId: 'bp-003',
        vendorCode: 'VEND-POLY-02',
        vendorName: 'POLYMER SOLUTIONS INDIA LTD',
        contactEmail: 'sales@polymersolutions.in',
        invitedAt: '2026-11-06T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-22',
      },
    ],
    createdAt: '2026-11-06T09:00:00Z',
    updatedAt: '2026-11-10T15:00:00Z',
  },
  {
    id: 'rfq-005',
    rfqNumber: 'RFQ-2026-0005',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    title: 'Raw Material Stainless Steel Alloy 316L Billets & Rods',
    description: 'Competitive bidding complete; commercial negotiations active for freight equalization.',
    prReferences: ['PR-2026-0001'],
    rfqDate: '2026-11-02',
    responseDeadline: '2026-11-16',
    quotationValidityDays: 30,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Puducherry Plant Warehouse',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: false,
    status: 'UNDER_NEGOTIATION',
    lines: [
      {
        id: 'rfq-line-005',
        rfqId: 'rfq-005',
        prLineId: 'pr-line-001-alt',
        prNumber: 'PR-2026-0001',
        itemCode: 'RM-ALLOY-316L',
        description: 'Stainless Steel Alloy 316L Round Bar – 50mm Diameter',
        category: 'Raw Materials',
        specifications: 'ASTM A276 Grade 316L Annealed & Pickled, Mill Test Certificate required',
        quantityPurchUom: 500,
        purchaseUom: 'KG',
        inventoryUom: 'KG',
        conversionRatio: 1,
        requiredDeliveryDate: '2026-12-01',
        targetWarehouse: 'PDY-STR',
        qualityRequirements: 'Positive Material Identification (PMI) Report with dispatch',
        warrantyMonths: 12,
        targetUnitPrice: 510,
      },
    ],
    invitations: [
      {
        id: 'inv-006',
        rfqId: 'rfq-005',
        vendorId: 'bp-006',
        vendorCode: 'VEND-JINDAL-01',
        vendorName: 'JINDAL STAINLESS ALLOY CORP',
        contactEmail: 'quotes@jindalstainless.com',
        invitedAt: '2026-11-02T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-16',
      },
      {
        id: 'inv-007',
        rfqId: 'rfq-005',
        vendorId: 'bp-007',
        vendorCode: 'VEND-STEEL-02',
        vendorName: 'BHARAT ALLOY SPECIAL STEELS LTD',
        contactEmail: 'sales@bharatalloy.in',
        invitedAt: '2026-11-02T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-16',
      },
    ],
    createdAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-10T16:00:00Z',
  },
  {
    id: 'rfq-006',
    rfqNumber: 'RFQ-2026-0006',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    title: 'Corrugated Heavy Duty 5-Ply Master Packaging Boxes',
    description: 'Fully evaluated and awarded to L1 Preferred Partner National Polymers.',
    prReferences: ['PR-2026-0002'],
    rfqDate: '2026-10-25',
    responseDeadline: '2026-11-10',
    quotationValidityDays: 60,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Puducherry Warehouse',
    paymentTerms: 'NET 45 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: false,
    status: 'AWARDED',
    lines: [
      {
        id: 'rfq-line-006',
        rfqId: 'rfq-006',
        prLineId: 'pr-line-002-box',
        prNumber: 'PR-2026-0002',
        itemCode: 'PKG-CARTON-5PLY',
        description: '5-Ply Corrugated Heavy Master Box 600x400x400mm',
        category: 'Packaging & Fasteners',
        specifications: 'Virgin Kraft Paper 180 GSM, Bursting Strength 14 kg/cm²',
        quantityPurchUom: 1000,
        purchaseUom: 'NOS',
        inventoryUom: 'NOS',
        conversionRatio: 1,
        requiredDeliveryDate: '2026-11-30',
        targetWarehouse: 'PDY-STR',
        qualityRequirements: 'ECT and BCT certified test reports',
        warrantyMonths: 6,
        targetUnitPrice: 85,
      },
    ],
    invitations: [
      {
        id: 'inv-008',
        rfqId: 'rfq-006',
        vendorId: 'bp-005',
        vendorCode: 'VEND-NATIONAL-01',
        vendorName: 'NATIONAL POLYMERS CORP',
        contactEmail: 'bids@nationalpolymers.in',
        invitedAt: '2026-10-25T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-10',
      },
    ],
    createdAt: '2026-10-25T09:00:00Z',
    updatedAt: '2026-11-09T14:00:00Z',
  },
  {
    id: 'rfq-007',
    rfqNumber: 'RFQ-2026-0007',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    purchaseOrgId: 'po-kosh-01',
    title: 'Dual-Source Sourcing of Mould Release Agents & Silicone Lubricants',
    description: 'Split vendor allocation awarded 60% BASF India and 40% Polymer Solutions.',
    prReferences: ['PR-2026-0003'],
    rfqDate: '2026-10-28',
    responseDeadline: '2026-11-12',
    quotationValidityDays: 45,
    buyerId: 'usr-buyer-02',
    buyerName: 'Priya Narayanan',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Hosur Factory',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: false,
    status: 'PARTIALLY_AWARDED',
    lines: [
      {
        id: 'rfq-line-007',
        rfqId: 'rfq-007',
        prLineId: 'pr-line-003-chem',
        prNumber: 'PR-2026-0003',
        itemCode: 'CHM-MRA-SILICONE',
        description: 'Silicone Mould Release Spray – Industrial Aerosol 500ml',
        category: 'Raw Materials',
        specifications: 'Non-CFC, high heat resistance up to 260°C, paintable grade',
        quantityPurchUom: 120,
        purchaseUom: 'CAN',
        inventoryUom: 'CAN',
        conversionRatio: 1,
        requiredDeliveryDate: '2026-12-05',
        targetWarehouse: 'HSR-STR',
        qualityRequirements: 'MSDS and batch certificate with each carton',
        warrantyMonths: 12,
        targetUnitPrice: 240,
      },
    ],
    invitations: [
      {
        id: 'inv-009',
        rfqId: 'rfq-007',
        vendorId: 'bp-002',
        vendorCode: 'VEND-BASF-01',
        vendorName: 'BASF INDIA LIMITED',
        contactEmail: 'orders.india@basf.com',
        invitedAt: '2026-10-28T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-12',
      },
      {
        id: 'inv-010',
        rfqId: 'rfq-007',
        vendorId: 'bp-003',
        vendorCode: 'VEND-POLY-02',
        vendorName: 'POLYMER SOLUTIONS INDIA LTD',
        contactEmail: 'sales@polymersolutions.in',
        invitedAt: '2026-10-28T10:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-11-12',
      },
    ],
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-11-09T18:00:00Z',
  },
  {
    id: 'rfq-008',
    rfqNumber: 'RFQ-2026-0008',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-hosur-02',
    branchCode: '002',
    branchName: 'Hosur Manufacturing Facility',
    purchaseOrgId: 'po-kosh-01',
    title: 'Obsolete Hydraulic Piston Spares (Authorized Direct Reversal)',
    description: 'Cancelled due to machine decommissioning. PR line allocation reversed in ledger.',
    prReferences: ['PR-2026-0006'],
    rfqDate: '2026-10-15',
    responseDeadline: '2026-10-30',
    quotationValidityDays: 30,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Hosur Factory',
    paymentTerms: 'NET 30 Days',
    incoterms: 'Ex-Works',
    evaluationMethod: 'SINGLE_STAGE',
    sealedCommercialQuotations: true,
    status: 'CANCELLED',
    lines: [
      {
        id: 'rfq-line-008',
        rfqId: 'rfq-008',
        prLineId: 'pr-line-006',
        prNumber: 'PR-2026-0006',
        itemCode: 'MRO-HYD-PISTON',
        description: 'Hydraulic Piston Assembly OEM Spare Part #HP-88',
        category: 'Maintenance & Spares',
        specifications: 'OEM replacement piston for 250T Injection Press',
        quantityPurchUom: 4,
        purchaseUom: 'SET',
        inventoryUom: 'SET',
        conversionRatio: 1,
        requiredDeliveryDate: '2026-11-15',
        targetWarehouse: 'HSR-MRO',
        targetUnitPrice: 18500,
      },
    ],
    invitations: [],
    createdAt: '2026-10-15T09:00:00Z',
    updatedAt: '2026-10-20T11:00:00Z',
  },
  {
    id: 'rfq-fy25-001',
    rfqNumber: 'RFQ-2025-0089',
    companyId: 'co-kosh-01',
    companyCode: 'KOSH-HQ',
    branchId: 'br-pond-01',
    branchCode: '001',
    branchName: 'Puducherry Main Plant & HQ',
    purchaseOrgId: 'po-kosh-01',
    title: 'Historical FY 2025-26 Q4 Virgin PC-ABS Polymer Sourcing',
    description: 'Closed FY 2025-26 awarded RFQ linked to PR-2025-0142 & PO-2025-0074.',
    prReferences: ['PR-2025-0142'],
    rfqDate: '2026-01-12',
    responseDeadline: '2026-01-16',
    quotationValidityDays: 45,
    buyerId: 'usr-buyer-01',
    buyerName: 'Vikram Singh',
    purchasingManagerId: 'usr-checker-03',
    purchasingManagerName: 'Venkatesh Iyer',
    currency: 'INR',
    deliveryTerms: 'FOR Puducherry Plant',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP',
    evaluationMethod: 'TWO_STAGE',
    sealedCommercialQuotations: false,
    status: 'AWARDED',
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accountingPeriodCode: '2026-01',
    lines: [
      {
        id: 'rfq-line-fy25-001',
        rfqId: 'rfq-fy25-001',
        prLineId: 'pr-line-fy25-001',
        prNumber: 'PR-2025-0142',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        category: 'Raw Materials',
        specifications: 'Injection Grade V0 flame retardant',
        quantityPurchUom: 30,
        purchaseUom: 'BAG',
        inventoryUom: 'KG',
        conversionRatio: 25,
        requiredDeliveryDate: '2026-01-20',
        targetWarehouse: 'PDY-STR',
        targetUnitPrice: 6800,
      },
    ],
    invitations: [
      {
        id: 'inv-fy25-001',
        rfqId: 'rfq-fy25-001',
        vendorId: 'bp-002',
        vendorCode: 'VEND-BASF-01',
        vendorName: 'BASF INDIA LIMITED',
        contactEmail: 'orders.india@basf.com',
        invitedAt: '2026-01-12T09:00:00Z',
        invitationStatus: 'SUBMITTED',
        responseDeadline: '2026-01-16',
      },
    ],
    createdAt: '2026-01-12T09:00:00Z',
    updatedAt: '2026-01-18T11:00:00Z',
  },
];

export const INITIAL_QUOTATIONS: SupplierQuotation[] = [
  {
    id: 'quot-001',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    revisionNumber: 1,
    quotationNumber: 'QT-BASF-2026-88',
    quotationDate: '2026-11-07',
    validUntil: '2027-01-07',
    currency: 'INR',
    paymentTerms: 'NET 60 Days after receipt',
    incoterms: 'FOR Puducherry Plant',
    totalQuotedValue: 136000,
    totalLandedValue: 142800,
    technicalComplianceStatus: 'PASS',
    lines: [
      {
        id: 'qline-001',
        quotationId: 'quot-001',
        rfqLineId: 'rfq-line-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        quotedQuantityPurchUom: 20,
        purchaseUom: 'BAG',
        unitPricePurchUom: 6800, // ₹6,800 / BAG (₹272 / KG)
        currency: 'INR',
        gstPercent: 18,
        gstAmount: 24480,
        freightAmount: 2000,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: 2.0,
        discountAmount: 2720,
        netLineTotal: 133280,
        landedUnitPricePurchUom: 7140,
        moq: 5,
        deliveryLeadTimeDays: 7,
        technicalCompliance: 'COMPLIANT',
      },
    ],
    attachments: [
      { id: 'att-q1', fileName: 'BASF_Technical_Datasheet_V0.pdf', fileSize: 1048576, uploadedAt: '2026-11-07T14:00:00Z', category: 'TECHNICAL', versionNumber: 1 },
    ],
    submittedAt: '2026-11-07T14:00:00Z',
    submittedBy: 'Dr. Amitav Banerjee (BASF)',
    isSealed: true,
    submissionChannel: 'PORTAL',
    unifiedStatus: 'ACCEPTED',
    originalSubmissionTimestamp: '2026-11-07T14:00:00Z',
    verificationStatus: 'VERIFIED_PORTAL',
    isLateSubmission: false,
    isDuplicateEmail: false,
    isEvaluationReady: true,
    sealedOpeningTime: '2026-11-20T18:00:00Z',
    attachmentVersionHistory: [
      {
        versionNumber: 1,
        attachmentId: 'att-q1',
        fileName: 'BASF_Technical_Datasheet_V0.pdf',
        fileSize: 1048576,
        fileType: 'application/pdf',
        category: 'TECHNICAL',
        uploadedAt: '2026-11-07T14:00:00Z',
        uploadedBy: 'Dr. Amitav Banerjee (BASF)',
      },
    ],
    accessHistory: [],
    clarifications: [],
  },
  {
    id: 'quot-002',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-0001',
    vendorId: 'bp-003',
    vendorCode: 'VEND-POLY-02',
    vendorName: 'POLYMER SOLUTIONS INDIA LTD',
    revisionNumber: 1,
    quotationNumber: 'QT-PSI-2026-104',
    quotationDate: '2026-11-08',
    validUntil: '2027-01-08',
    currency: 'INR',
    paymentTerms: 'NET 45 Days after receipt',
    incoterms: 'Ex-Works Bengaluru',
    totalQuotedValue: 140000,
    totalLandedValue: 149500,
    technicalComplianceStatus: 'PASS_WITH_WARNINGS',
    lines: [
      {
        id: 'qline-002',
        quotationId: 'quot-002',
        rfqLineId: 'rfq-line-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        quotedQuantityPurchUom: 20,
        purchaseUom: 'BAG',
        unitPricePurchUom: 7000, // ₹7,000 / BAG (₹280 / KG)
        currency: 'INR',
        gstPercent: 18,
        gstAmount: 25200,
        freightAmount: 4300,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: 0,
        discountAmount: 0,
        netLineTotal: 140000,
        landedUnitPricePurchUom: 7475,
        moq: 10,
        deliveryLeadTimeDays: 10,
        technicalCompliance: 'DEVIATION',
        technicalDeviations: 'Moisture content 0.04% (Spec requires <= 0.02%). Pre-drying mandatory.',
      },
    ],
    attachments: [
      { id: 'att-q2', fileName: 'PSI_Moisture_Deviation_Note.pdf', fileSize: 524288, uploadedAt: '2026-11-08T10:00:00Z', category: 'TECHNICAL', versionNumber: 1 },
      { id: 'att-q2-em', fileName: 'PSI_Commercial_Offer_Signed.pdf', fileSize: 642000, uploadedAt: '2026-11-08T10:00:00Z', category: 'EMAIL_ORIGINAL', versionNumber: 1 },
    ],
    submittedAt: '2026-11-08T10:00:00Z',
    submittedBy: 'Siddharth Varma (PSI - via Inbound Email)',
    isSealed: true,
    submissionChannel: 'EMAIL',
    unifiedStatus: 'UNDER_VERIFICATION',
    originalSubmissionTimestamp: '2026-11-08T10:00:00Z',
    verificationStatus: 'PENDING_BUYER_VERIFICATION',
    isLateSubmission: false,
    isDuplicateEmail: false,
    isEvaluationReady: false,
    sealedOpeningTime: '2026-11-20T18:00:00Z',
    emailEvidence: {
      emailMessageId: '<msg-20261108-psi-104@polymersolutions.in>',
      rfqEmailReference: 'RFQ-2026-0001+VEND-POLY-02@inbound.kosh.in',
      senderEmail: 'sales@polymersolutions.in',
      verifiedVendorEmail: true,
      emailSubject: 'RE: [RFQ-2026-0001] Quotation QT-PSI-2026-104 for PC-ABS Injection Grade V0',
      emailBodyExcerpt: 'Please find attached our technical compliance sheet and commercial offer QT-PSI-2026-104 for 20 BAG of PC-ABS.',
      receivedTimestamp: '2026-11-08T10:00:00Z',
      rawAttachmentFileNames: ['PSI_Moisture_Deviation_Note.pdf', 'PSI_Commercial_Offer_Signed.pdf'],
    },
    attachmentVersionHistory: [
      {
        versionNumber: 1,
        attachmentId: 'att-q2',
        fileName: 'PSI_Moisture_Deviation_Note.pdf',
        fileSize: 524288,
        fileType: 'application/pdf',
        category: 'TECHNICAL',
        uploadedAt: '2026-11-08T10:00:00Z',
        uploadedBy: 'sales@polymersolutions.in',
      },
      {
        versionNumber: 1,
        attachmentId: 'att-q2-em',
        fileName: 'PSI_Commercial_Offer_Signed.pdf',
        fileSize: 642000,
        fileType: 'application/pdf',
        category: 'EMAIL_ORIGINAL',
        uploadedAt: '2026-11-08T10:00:00Z',
        uploadedBy: 'sales@polymersolutions.in',
      },
    ],
    accessHistory: [],
    clarifications: [],
  },
  {
    id: 'quot-003',
    rfqId: 'rfq-004',
    rfqNumber: 'RFQ-2026-0004',
    vendorId: 'bp-005',
    vendorCode: 'VEND-NATIONAL-01',
    vendorName: 'NATIONAL POLYMERS CORP',
    revisionNumber: 1,
    quotationNumber: 'QT-NPC-2026-44',
    quotationDate: '2026-11-09',
    validUntil: '2026-12-31',
    currency: 'INR',
    paymentTerms: 'NET 45 Days',
    incoterms: 'FOR Pune Chakan',
    totalQuotedValue: 54000,
    totalLandedValue: 57240,
    technicalComplianceStatus: 'PASS',
    lines: [
      {
        id: 'qline-003',
        quotationId: 'quot-003',
        rfqLineId: 'rfq-line-004',
        itemCode: 'FGHDMCRGY0002',
        description: 'HDPE Corrugated Protective Sleeve – 35mm OD – Industrial Grey',
        quotedQuantityPurchUom: 40,
        purchaseUom: 'ROLL',
        unitPricePurchUom: 1350,
        currency: 'INR',
        gstPercent: 18,
        gstAmount: 9720,
        freightAmount: 1500,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: 0,
        discountAmount: 0,
        netLineTotal: 54000,
        landedUnitPricePurchUom: 1431,
        moq: 10,
        deliveryLeadTimeDays: 8,
        technicalCompliance: 'COMPLIANT',
      },
    ],
    attachments: [],
    submittedAt: '2026-11-09T11:00:00Z',
    submittedBy: 'K. Ramanathan (National Polymers)',
    isSealed: true,
    submissionChannel: 'PORTAL',
    unifiedStatus: 'ACCEPTED',
    originalSubmissionTimestamp: '2026-11-09T11:00:00Z',
    verificationStatus: 'VERIFIED_PORTAL',
    isLateSubmission: false,
    isDuplicateEmail: false,
    isEvaluationReady: true,
    accessHistory: [],
    clarifications: [],
  },
  {
    id: 'quot-004',
    rfqId: 'rfq-005',
    rfqNumber: 'RFQ-2026-0005',
    vendorId: 'bp-006',
    vendorCode: 'VEND-JINDAL-01',
    vendorName: 'JINDAL STAINLESS ALLOY CORP',
    revisionNumber: 1,
    quotationNumber: 'QT-JINDAL-2026-77',
    quotationDate: '2026-11-05',
    validUntil: '2026-12-05',
    currency: 'INR',
    paymentTerms: 'NET 60 Days',
    incoterms: 'FOR Puducherry Plant',
    totalQuotedValue: 247500,
    totalLandedValue: 262350,
    technicalComplianceStatus: 'PASS',
    lines: [
      {
        id: 'qline-004',
        quotationId: 'quot-004',
        rfqLineId: 'rfq-line-005',
        itemCode: 'RM-ALLOY-316L',
        description: 'Stainless Steel Alloy 316L Round Bar – 50mm Diameter',
        quotedQuantityPurchUom: 500,
        purchaseUom: 'KG',
        unitPricePurchUom: 495,
        currency: 'INR',
        gstPercent: 18,
        gstAmount: 44550,
        freightAmount: 6000,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: 1.0,
        discountAmount: 2475,
        netLineTotal: 245025,
        landedUnitPricePurchUom: 524.7,
        moq: 100,
        deliveryLeadTimeDays: 12,
        technicalCompliance: 'COMPLIANT',
      },
    ],
    attachments: [],
    submittedAt: '2026-11-05T15:00:00Z',
    submittedBy: 'Rajiv Mehra (Jindal Stainless)',
    isSealed: false,
    submissionChannel: 'EMAIL',
    unifiedStatus: 'ACCEPTED',
    originalSubmissionTimestamp: '2026-11-05T15:00:00Z',
    verificationStatus: 'BUYER_VERIFIED',
    isLateSubmission: false,
    isDuplicateEmail: false,
    isEvaluationReady: true,
    emailEvidence: {
      emailMessageId: '<msg-20261105-jindal-77@jindalstainless.com>',
      rfqEmailReference: 'RFQ-2026-0005+VEND-JINDAL-01@inbound.kosh.in',
      senderEmail: 'quotes@jindalstainless.com',
      verifiedVendorEmail: true,
      emailSubject: 'Quotation QT-JINDAL-2026-77 against RFQ-2026-0005 (SS 316L Round Bar)',
      emailBodyExcerpt: 'Attached formal commercial quotation for 500 KG ASTM A276 Grade 316L.',
      receivedTimestamp: '2026-11-05T15:00:00Z',
      rawAttachmentFileNames: ['QT_JINDAL_2026_77.pdf'],
      extractedByBuyerId: 'usr-buyer-01',
      extractedByBuyerName: 'Vikram Singh',
      verifiedAt: '2026-11-05T16:30:00Z',
      verificationRemarks: 'Verified email origin and line unit price against attached PDF.',
    },
    accessHistory: [],
    clarifications: [],
  },
  {
    id: 'quot-fy25-001',
    rfqId: 'rfq-fy25-001',
    rfqNumber: 'RFQ-2025-0089',
    vendorId: 'bp-002',
    vendorCode: 'VEND-BASF-01',
    vendorName: 'BASF INDIA LIMITED',
    revisionNumber: 1,
    quotationNumber: 'QT-BASF-2025-412',
    quotationDate: '2026-01-14',
    validUntil: '2026-03-14',
    currency: 'INR',
    paymentTerms: 'NET 60 Days',
    incoterms: 'DDP Puducherry Plant',
    totalQuotedValue: 204000,
    totalLandedValue: 204000,
    technicalComplianceStatus: 'PASS',
    lines: [
      {
        id: 'qline-fy25-001',
        quotationId: 'quot-fy25-001',
        rfqLineId: 'rfq-line-fy25-001',
        itemCode: 'RMPAOPOEXLG0001',
        description: 'PC-ABS – Injection Grade V0 – Light Grey – Powder',
        quotedQuantityPurchUom: 30,
        purchaseUom: 'BAG',
        unitPricePurchUom: 6800,
        currency: 'INR',
        gstPercent: 18,
        gstAmount: 36720,
        freightAmount: 0,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: 0,
        discountAmount: 0,
        netLineTotal: 204000,
        landedUnitPricePurchUom: 6800,
        moq: 5,
        deliveryLeadTimeDays: 5,
        technicalCompliance: 'COMPLIANT',
      },
    ],
    attachments: [],
    submittedAt: '2026-01-14T11:30:00Z',
    submittedBy: 'Dr. Amitav Banerjee (BASF)',
    isSealed: false,
    submissionChannel: 'PORTAL',
    unifiedStatus: 'ACCEPTED',
    originalSubmissionTimestamp: '2026-01-14T11:30:00Z',
    verificationStatus: 'VERIFIED_PORTAL',
    isLateSubmission: false,
    isDuplicateEmail: false,
    isEvaluationReady: true,
    financialYearId: 'fy-co-kosh-01-2025-26',
    financialYearCode: 'FY 2025-26',
    accessHistory: [],
    clarifications: [],
  },
];

export const rfqService = {
  resetForTesting(): void {
    memoryRfqs = JSON.parse(JSON.stringify(INITIAL_RFQS));
    memoryQuotations = JSON.parse(JSON.stringify(INITIAL_QUOTATIONS));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_RFQS);
      localStorage.removeItem(STORAGE_KEY_QUOTATIONS);
    }
  },

  generateRfqEmailReference(rfqNumber: string, vendorCode: string): string {
    const cleanRfq = (rfqNumber || 'RFQ').replace(/[^A-Za-z0-9-]/g, '');
    const cleanVendor = (vendorCode || 'VENDOR').replace(/[^A-Za-z0-9-]/g, '');
    return `${cleanRfq}+${cleanVendor}@inbound.kosh.in`;
  },

  getRfqs(): RfqHeader[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_RFQS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error('Error loading RFQs:', err);
      }
    }
    if (!memoryRfqs) {
      memoryRfqs = JSON.parse(JSON.stringify(INITIAL_RFQS));
    }
    return memoryRfqs!;
  },

  saveRfqs(rfqs: RfqHeader[]) {
    memoryRfqs = JSON.parse(JSON.stringify(rfqs));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_RFQS, JSON.stringify(rfqs));
      } catch (err) {
        console.error('Error saving RFQs:', err);
      }
    }
  },

  getQuotations(): SupplierQuotation[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_QUOTATIONS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.error('Error loading quotations:', err);
      }
    }
    if (!memoryQuotations) {
      memoryQuotations = JSON.parse(JSON.stringify(INITIAL_QUOTATIONS));
    }
    return memoryQuotations!;
  },

  saveQuotations(quotations: SupplierQuotation[]) {
    memoryQuotations = JSON.parse(JSON.stringify(quotations));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));
      } catch (err) {
        console.error('Error saving quotations:', err);
      }
    }
  },

  getRfqById(id: string): RfqHeader | undefined {
    return this.getRfqs().find(r => r.id === id || r.rfqNumber === id);
  },

  getQuotationsForRfq(rfqId: string): SupplierQuotation[] {
    return this.getQuotations().filter(q => q.rfqId === rfqId || q.rfqNumber === rfqId);
  },

  /**
   * M2. Supplier Portal Access Scoping:
   * Suppliers must ONLY access their own RFQ invitations and their own submitted quotations.
   * Rejects any attempt by a supplier to access an RFQ they were not invited to.
   */
  getSupplierPortalWorkspace(params: {
    vendorId: string;
    targetRfqId?: string;
  }): {
    authorizedRfqs: RfqHeader[];
    ownQuotations: SupplierQuotation[];
  } {
    const rfqs = this.getRfqs();
    const allQuotations = this.getQuotations();

    if (params.targetRfqId) {
      const targetRfq = rfqs.find(
        (r) => r.id === params.targetRfqId || r.rfqNumber === params.targetRfqId
      );
      if (!targetRfq) {
        throw new Error(`RFQ ${params.targetRfqId} not found.`);
      }
      const isInvited = targetRfq.invitations.some((inv) => inv.vendorId === params.vendorId);
      if (!isInvited) {
        throw new Error(
          `Unauthorized Supplier Access Blocked: Supplier '${params.vendorId}' is not invited to RFQ ${targetRfq.rfqNumber}.`
        );
      }
    }

    const authorizedRfqs = rfqs
      .filter((r) => r.invitations.some((inv) => inv.vendorId === params.vendorId))
      .map((r) => ({
        ...r,
        // Scope invitations array so the supplier only sees their own invitation
        invitations: r.invitations.filter((inv) => inv.vendorId === params.vendorId),
      }));

    // Strictly filter quotations to only the supplier's own quotations
    const ownQuotations = allQuotations.filter((q) => q.vendorId === params.vendorId);

    return { authorizedRfqs, ownQuotations };
  },

  /**
   * M2 & M5. Submits a quotation via the Supplier Portal (new or revised).
   * Preserves all previous revisions as separate auditable records.
   */
  submitPortalQuotation(params: {
    rfqId: string;
    vendorId: string;
    quotationNumber: string;
    quotationDate?: string;
    validUntil: string;
    currency?: string;
    paymentTerms: string;
    incoterms: string;
    submittedBy: string;
    submittedAt?: string;
    lines: Array<{
      rfqLineId: string;
      itemCode: string;
      description: string;
      quotedQuantityPurchUom: number;
      purchaseUom: string;
      unitPricePurchUom: number;
      gstPercent: number;
      freightAmount?: number;
      discountPercent?: number;
      moq?: number;
      deliveryLeadTimeDays: number;
      technicalCompliance?: 'COMPLIANT' | 'DEVIATION' | 'NON_COMPLIANT';
      technicalDeviations?: string;
    }>;
    attachments?: Array<{
      id?: string;
      fileName: string;
      fileSize: number;
      category?: 'TECHNICAL' | 'COMMERCIAL' | 'COMPLIANCE';
    }>;
  }): SupplierQuotation {
    const rfqs = this.getRfqs();
    const rfq = rfqs.find((r) => r.id === params.rfqId || r.rfqNumber === params.rfqId);
    if (!rfq) {
      throw new Error(`RFQ ${params.rfqId} not found.`);
    }

    const invitation = rfq.invitations.find((inv) => inv.vendorId === params.vendorId);
    if (!invitation) {
      throw new Error(
        `Unauthorized Portal Submission Blocked: Supplier '${params.vendorId}' is not an invited vendor on ${rfq.rfqNumber}.`
      );
    }

    const quots = this.getQuotations();
    const existingVendorQuots = quots.filter(
      (q) => q.rfqId === rfq.id && q.vendorId === params.vendorId
    );
    const maxRevision = existingVendorQuots.reduce(
      (max, q) => Math.max(max, q.revisionNumber || 1),
      0
    );
    const nextRevision = maxRevision + 1;

    // Mark previous revisions as superseded without overwriting their data
    if (existingVendorQuots.length > 0) {
      for (const prev of existingVendorQuots) {
        if (!prev.supersededByRevision) {
          prev.supersededByRevision = nextRevision;
          prev.unifiedStatus = 'REVISED';
        }
      }
    }

    const nowIso = params.submittedAt || new Date().toISOString();
    const submitDateStr = nowIso.split('T')[0];
    const isLate = Boolean(rfq.responseDeadline && submitDateStr > rfq.responseDeadline);

    const quotationId = `quot-portal-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const curr = params.currency || rfq.currency || 'INR';

    let totalQuotedValue = 0;
    let totalLandedValue = 0;
    let hasDeviation = false;
    let hasFail = false;

    const formattedLines: SupplierQuotationLine[] = params.lines.map((l, idx) => {
      const gross = l.quotedQuantityPurchUom * l.unitPricePurchUom;
      const discPct = l.discountPercent || 0;
      const discountAmount = Number(((gross * discPct) / 100).toFixed(2));
      const netLineTotal = Number((gross - discountAmount).toFixed(2));
      const gstAmount = Number(((netLineTotal * (l.gstPercent || 0)) / 100).toFixed(2));
      const freightAmount = Number(l.freightAmount || 0);
      const lineLandedTotal = netLineTotal + gstAmount + freightAmount;
      const landedUnitPricePurchUom =
        l.quotedQuantityPurchUom > 0
          ? Number((lineLandedTotal / l.quotedQuantityPurchUom).toFixed(2))
          : l.unitPricePurchUom;

      totalQuotedValue += netLineTotal;
      totalLandedValue += lineLandedTotal;

      const compliance = l.technicalCompliance || 'COMPLIANT';
      if (compliance === 'DEVIATION') hasDeviation = true;
      if (compliance === 'NON_COMPLIANT') hasFail = true;

      return {
        id: `qline-${Date.now()}-${idx}`,
        quotationId,
        rfqLineId: l.rfqLineId,
        itemCode: l.itemCode,
        description: l.description,
        quotedQuantityPurchUom: l.quotedQuantityPurchUom,
        purchaseUom: l.purchaseUom,
        unitPricePurchUom: l.unitPricePurchUom,
        currency: curr,
        gstPercent: l.gstPercent,
        gstAmount,
        freightAmount,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: discPct,
        discountAmount,
        netLineTotal,
        landedUnitPricePurchUom,
        moq: l.moq || 1,
        deliveryLeadTimeDays: l.deliveryLeadTimeDays,
        technicalCompliance: compliance,
        technicalDeviations: l.technicalDeviations,
      };
    });

    const prevAttachHistory: QuotationAttachmentVersion[] =
      existingVendorQuots.length > 0
        ? [...(existingVendorQuots[0].attachmentVersionHistory || [])]
        : [];

    const newAttachments = (params.attachments || []).map((a, idx) => {
      const attId = a.id || `att-${Date.now()}-${idx}`;
      prevAttachHistory.push({
        versionNumber: nextRevision,
        attachmentId: attId,
        fileName: a.fileName,
        fileSize: a.fileSize,
        fileType: 'application/pdf',
        category: a.category || 'COMMERCIAL',
        uploadedAt: nowIso,
        uploadedBy: params.submittedBy,
      });
      return {
        id: attId,
        fileName: a.fileName,
        fileSize: a.fileSize,
        uploadedAt: nowIso,
        category: a.category || 'COMMERCIAL',
        versionNumber: nextRevision,
      };
    });

    const createdQuotation: SupplierQuotation = {
      id: quotationId,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      vendorId: invitation.vendorId,
      vendorCode: invitation.vendorCode,
      vendorName: invitation.vendorName,
      revisionNumber: nextRevision,
      quotationNumber: params.quotationNumber,
      quotationDate: params.quotationDate || submitDateStr,
      validUntil: params.validUntil,
      currency: curr,
      paymentTerms: params.paymentTerms,
      incoterms: params.incoterms,
      totalQuotedValue: Number(totalQuotedValue.toFixed(2)),
      totalLandedValue: Number(totalLandedValue.toFixed(2)),
      technicalComplianceStatus: hasFail
        ? 'FAIL'
        : hasDeviation
        ? 'PASS_WITH_WARNINGS'
        : 'PASS',
      lines: formattedLines,
      attachments: newAttachments,
      submittedAt: nowIso,
      submittedBy: params.submittedBy,
      isSealed: rfq.sealedCommercialQuotations,
      submissionChannel: 'PORTAL',
      unifiedStatus: isLate ? 'LATE_SUBMISSION' : 'ACCEPTED',
      originalSubmissionTimestamp:
        existingVendorQuots[existingVendorQuots.length - 1]?.originalSubmissionTimestamp || nowIso,
      verificationStatus: 'VERIFIED_PORTAL',
      isLateSubmission: isLate,
      isDuplicateEmail: false,
      isEvaluationReady: !isLate,
      sealedOpeningTime: rfq.sealedOpeningTime || `${rfq.responseDeadline}T18:00:00Z`,
      attachmentVersionHistory: prevAttachHistory,
      accessHistory: [],
      clarifications: [],
    };

    invitation.invitationStatus = 'SUBMITTED';
    if (rfq.status === 'RELEASED') rfq.status = 'QUOTATIONS_IN_PROGRESS';
    this.saveRfqs(rfqs);

    quots.unshift(createdQuotation);
    this.saveQuotations(quots);
    return createdQuotation;
  },

  /**
   * M3 & M5. Ingests an Email-Based Supplier Quotation.
   * - Validates registered supplier email address
   * - Generates/verifies RFQ-specific email reference
   * - Stores original email metadata & attachments as quotation evidence
   * - Detects duplicate email submissions
   * - Detects late email submissions
   * - Requires buyer verification before accepting extracted quotation data for evaluation
   * - Never overwrites verified quotation data without creating a new quotation revision
   */
  ingestInboundEmailQuotation(params: {
    rfqId: string;
    senderEmail: string;
    emailMessageId: string;
    emailSubject: string;
    emailBodyExcerpt: string;
    receivedTimestamp?: string;
    quotationNumber: string;
    validUntil: string;
    paymentTerms: string;
    incoterms: string;
    rawAttachmentFileNames: string[];
    lines: Array<{
      rfqLineId: string;
      itemCode: string;
      description: string;
      quotedQuantityPurchUom: number;
      purchaseUom: string;
      unitPricePurchUom: number;
      gstPercent: number;
      freightAmount?: number;
      discountPercent?: number;
      deliveryLeadTimeDays: number;
      technicalCompliance?: 'COMPLIANT' | 'DEVIATION' | 'NON_COMPLIANT';
    }>;
  }): {
    quotation: SupplierQuotation;
    isDuplicateEmail: boolean;
    isLateSubmission: boolean;
  } {
    const rfqs = this.getRfqs();
    const rfq = rfqs.find((r) => r.id === params.rfqId || r.rfqNumber === params.rfqId);
    if (!rfq) {
      throw new Error(`RFQ ${params.rfqId} not found.`);
    }

    const normalizedEmail = (params.senderEmail || '').trim().toLowerCase();
    const matchedInvitation = rfq.invitations.find(
      (inv) => inv.contactEmail.trim().toLowerCase() === normalizedEmail
    );
    if (!matchedInvitation) {
      throw new Error(
        `Unregistered Supplier Email Rejected: '${params.senderEmail}' does not match any invited supplier email for ${rfq.rfqNumber}.`
      );
    }

    const quots = this.getQuotations();
    // Duplicate email detection (same emailMessageId OR same quotationNumber + senderEmail already ingested)
    const duplicateMatch = quots.find(
      (q) =>
        q.rfqId === rfq.id &&
        q.vendorId === matchedInvitation.vendorId &&
        q.submissionChannel === 'EMAIL' &&
        (q.emailEvidence?.emailMessageId === params.emailMessageId ||
          (q.quotationNumber === params.quotationNumber &&
            q.emailEvidence?.emailSubject === params.emailSubject))
    );

    if (duplicateMatch) {
      duplicateMatch.isDuplicateEmail = true;
      this.saveQuotations(quots);
      return {
        quotation: duplicateMatch,
        isDuplicateEmail: true,
        isLateSubmission: Boolean(duplicateMatch.isLateSubmission),
      };
    }

    const existingVendorQuots = quots.filter(
      (q) => q.rfqId === rfq.id && q.vendorId === matchedInvitation.vendorId
    );
    const maxRevision = existingVendorQuots.reduce(
      (max, q) => Math.max(max, q.revisionNumber || 1),
      0
    );
    const nextRevision = maxRevision + 1;

    // Never overwrite verified quotation data; mark earlier revision as superseded when a new revision arrives
    for (const prev of existingVendorQuots) {
      if (!prev.supersededByRevision) {
        prev.supersededByRevision = nextRevision;
      }
    }

    const receivedIso = params.receivedTimestamp || new Date().toISOString();
    const receivedDateStr = receivedIso.split('T')[0];
    const isLate = Boolean(rfq.responseDeadline && receivedDateStr > rfq.responseDeadline);

    const rfqEmailReference =
      matchedInvitation.rfqEmailReference ||
      this.generateRfqEmailReference(rfq.rfqNumber, matchedInvitation.vendorCode);

    const quotationId = `quot-email-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    let totalQuotedValue = 0;
    let totalLandedValue = 0;

    const formattedLines: SupplierQuotationLine[] = params.lines.map((l, idx) => {
      const gross = l.quotedQuantityPurchUom * l.unitPricePurchUom;
      const discPct = l.discountPercent || 0;
      const discountAmount = Number(((gross * discPct) / 100).toFixed(2));
      const netLineTotal = Number((gross - discountAmount).toFixed(2));
      const gstAmount = Number(((netLineTotal * (l.gstPercent || 0)) / 100).toFixed(2));
      const freightAmount = Number(l.freightAmount || 0);
      const lineLandedTotal = netLineTotal + gstAmount + freightAmount;
      const landedUnitPricePurchUom =
        l.quotedQuantityPurchUom > 0
          ? Number((lineLandedTotal / l.quotedQuantityPurchUom).toFixed(2))
          : l.unitPricePurchUom;

      totalQuotedValue += netLineTotal;
      totalLandedValue += lineLandedTotal;

      return {
        id: `qline-em-${Date.now()}-${idx}`,
        quotationId,
        rfqLineId: l.rfqLineId,
        itemCode: l.itemCode,
        description: l.description,
        quotedQuantityPurchUom: l.quotedQuantityPurchUom,
        purchaseUom: l.purchaseUom,
        unitPricePurchUom: l.unitPricePurchUom,
        currency: rfq.currency || 'INR',
        gstPercent: l.gstPercent,
        gstAmount,
        freightAmount,
        insuranceAmount: 0,
        otherCharges: 0,
        discountPercent: discPct,
        discountAmount,
        netLineTotal,
        landedUnitPricePurchUom,
        moq: 1,
        deliveryLeadTimeDays: l.deliveryLeadTimeDays,
        technicalCompliance: l.technicalCompliance || 'COMPLIANT',
      };
    });

    const attachments = (params.rawAttachmentFileNames || []).map((fileName, idx) => ({
      id: `att-em-${Date.now()}-${idx}`,
      fileName,
      fileSize: 512000,
      uploadedAt: receivedIso,
      category: 'EMAIL_ORIGINAL' as const,
      versionNumber: nextRevision,
    }));

    const attachmentVersionHistory: QuotationAttachmentVersion[] = attachments.map((a) => ({
      versionNumber: nextRevision,
      attachmentId: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      fileType: 'application/pdf',
      category: 'EMAIL_ORIGINAL',
      uploadedAt: receivedIso,
      uploadedBy: params.senderEmail,
    }));

    const created: SupplierQuotation = {
      id: quotationId,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      vendorId: matchedInvitation.vendorId,
      vendorCode: matchedInvitation.vendorCode,
      vendorName: matchedInvitation.vendorName,
      revisionNumber: nextRevision,
      quotationNumber: params.quotationNumber,
      quotationDate: receivedDateStr,
      validUntil: params.validUntil,
      currency: rfq.currency || 'INR',
      paymentTerms: params.paymentTerms,
      incoterms: params.incoterms,
      totalQuotedValue: Number(totalQuotedValue.toFixed(2)),
      totalLandedValue: Number(totalLandedValue.toFixed(2)),
      technicalComplianceStatus: 'PASS',
      lines: formattedLines,
      attachments,
      submittedAt: receivedIso,
      submittedBy: `${matchedInvitation.vendorName} (${params.senderEmail})`,
      isSealed: rfq.sealedCommercialQuotations,
      submissionChannel: 'EMAIL',
      unifiedStatus: isLate ? 'LATE_SUBMISSION' : 'UNDER_VERIFICATION',
      originalSubmissionTimestamp:
        existingVendorQuots[existingVendorQuots.length - 1]?.originalSubmissionTimestamp ||
        receivedIso,
      verificationStatus: 'PENDING_BUYER_VERIFICATION',
      isLateSubmission: isLate,
      isDuplicateEmail: false,
      isEvaluationReady: false, // Must be verified by Buyer first!
      sealedOpeningTime: rfq.sealedOpeningTime || `${rfq.responseDeadline}T18:00:00Z`,
      emailEvidence: {
        emailMessageId: params.emailMessageId,
        rfqEmailReference,
        senderEmail: params.senderEmail,
        verifiedVendorEmail: true,
        emailSubject: params.emailSubject,
        emailBodyExcerpt: params.emailBodyExcerpt,
        receivedTimestamp: receivedIso,
        rawAttachmentFileNames: params.rawAttachmentFileNames,
      },
      attachmentVersionHistory,
      accessHistory: [],
      clarifications: [],
    };

    matchedInvitation.invitationStatus = 'SUBMITTED';
    matchedInvitation.rfqEmailReference = rfqEmailReference;
    this.saveRfqs(rfqs);

    quots.unshift(created);
    this.saveQuotations(quots);

    return {
      quotation: created,
      isDuplicateEmail: false,
      isLateSubmission: isLate,
    };
  },

  /**
   * M3. Buyer Verification of Email-Submitted Quotation.
   */
  verifyEmailQuotationByBuyer(params: {
    quotationId: string;
    buyerId: string;
    buyerName: string;
    decision: 'ACCEPT' | 'REJECT';
    verificationRemarks: string;
  }): SupplierQuotation {
    const quots = this.getQuotations();
    const target = quots.find((q) => q.id === params.quotationId);
    if (!target) {
      throw new Error(`Quotation ${params.quotationId} not found.`);
    }

    const nowIso = new Date().toISOString();
    if (params.decision === 'ACCEPT') {
      target.verificationStatus = 'BUYER_VERIFIED';
      target.unifiedStatus = target.isLateSubmission ? 'LATE_SUBMISSION' : 'ACCEPTED';
      target.isEvaluationReady = !target.isLateSubmission;
    } else {
      target.verificationStatus = 'REJECTED_BY_BUYER';
      target.unifiedStatus = 'REJECTED';
      target.isEvaluationReady = false;
    }

    if (target.emailEvidence) {
      target.emailEvidence.extractedByBuyerId = params.buyerId;
      target.emailEvidence.extractedByBuyerName = params.buyerName;
      target.emailEvidence.verifiedAt = nowIso;
      target.emailEvidence.verificationRemarks = params.verificationRemarks;
    }

    target.accessHistory = [
      ...(target.accessHistory || []),
      {
        id: `qacc-${Date.now()}`,
        quotationId: target.id,
        rfqId: target.rfqId,
        actorId: params.buyerId,
        actorName: params.buyerName,
        actorRole: 'BUYER',
        action: 'BUYER_VERIFY',
        accessAllowed: true,
        timestamp: nowIso,
      },
    ];

    this.saveQuotations(quots);
    return target;
  },

  /**
   * M4. Sealed Quotation Confidentiality & Access Audit Logging.
   * Restricts commercial quotation access before the configured opening time,
   * and prevents unauthorized suppliers from viewing other suppliers' quotations.
   */
  accessCommercialQuotation(params: {
    quotationId: string;
    actorId: string;
    actorName: string;
    actorRole: 'BUYER' | 'PURCHASING_MANAGER' | 'SUPPLIER' | 'EVALUATOR';
    supplierVendorId?: string;
    currentTimestamp?: string;
  }): {
    accessAllowed: boolean;
    denialReason?: string;
    quotation?: SupplierQuotation;
    auditEntry: QuotationAccessAuditEntry;
  } {
    const quots = this.getQuotations();
    const target = quots.find((q) => q.id === params.quotationId);
    if (!target) {
      throw new Error(`Quotation ${params.quotationId} not found.`);
    }

    const rfq = this.getRfqById(target.rfqId);
    const evalTime = params.currentTimestamp || new Date().toISOString();

    let accessAllowed = true;
    let denialReason: string | undefined;

    // 1. Check Supplier Isolation: Suppliers can only view their own quotation
    if (params.actorRole === 'SUPPLIER') {
      if (!params.supplierVendorId || params.supplierVendorId !== target.vendorId) {
        accessAllowed = false;
        denialReason = `Unauthorized Supplier Access: Vendor '${params.supplierVendorId || 'UNKNOWN'}' cannot access quotation belonging to '${target.vendorId}'.`;
      }
    }

    // 2. Check Sealed Quotation Opening Time for Internal Evaluators/Buyers
    if (accessAllowed && params.actorRole !== 'SUPPLIER' && (target.isSealed || rfq?.sealedCommercialQuotations)) {
      const openingTime =
        target.sealedOpeningTime ||
        rfq?.sealedOpeningTime ||
        (rfq?.responseDeadline ? `${rfq.responseDeadline}T18:00:00Z` : undefined);

      if (openingTime && evalTime < openingTime) {
        accessAllowed = false;
        denialReason = `Sealed Quotation Locked: Commercial pricing for ${target.quotationNumber} cannot be opened before configured opening time (${openingTime}).`;
      }
    }

    const auditEntry: QuotationAccessAuditEntry = {
      id: `qacc-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      quotationId: target.id,
      rfqId: target.rfqId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      vendorIdScope: params.supplierVendorId,
      action: 'VIEW_COMMERCIAL_PRICING',
      accessAllowed,
      denialReason,
      timestamp: evalTime,
    };

    target.accessHistory = [...(target.accessHistory || []), auditEntry];
    this.saveQuotations(quots);

    return {
      accessAllowed,
      denialReason,
      quotation: accessAllowed ? target : undefined,
      auditEntry,
    };
  },

  /**
   * M2. Clarification request / response thread on a quotation.
   */
  addClarificationMessage(params: {
    quotationId: string;
    senderRole: 'BUYER' | 'SUPPLIER';
    senderName: string;
    message: string;
  }): SupplierQuotation {
    const quots = this.getQuotations();
    const target = quots.find((q) => q.id === params.quotationId);
    if (!target) {
      throw new Error(`Quotation ${params.quotationId} not found.`);
    }
    target.clarifications = [
      ...(target.clarifications || []),
      {
        id: `clar-${Date.now()}`,
        quotationId: target.id,
        rfqId: target.rfqId,
        senderRole: params.senderRole,
        senderName: params.senderName,
        message: params.message,
        timestamp: new Date().toISOString(),
      },
    ];
    this.saveQuotations(quots);
    return target;
  },

  createRfq(newRfq: Partial<RfqHeader>): RfqHeader {
    const rfqs = this.getRfqs();
    const targetCompanyId = normalizeCompanyId(newRfq.companyId || 'co-kosh-01');
    const rfqDate = newRfq.rfqDate || new Date().toISOString().split('T')[0];

    // GAP-005: Same-Company & Same-Purchase-Organization Consolidation Guard
    const referencedPrNums = Array.from(
      new Set([
        ...(newRfq.prReferences || []),
        ...((newRfq.lines || []).map((l) => l.prNumber).filter(Boolean) as string[]),
      ])
    );

    if (referencedPrNums.length > 0) {
      const allPrs = PurchaseRequisitionService.getPurchaseRequisitions();
      const matchedPrs = allPrs.filter(
        (p) => referencedPrNums.includes(p.prNumber) || referencedPrNums.includes(p.id)
      );

      if (matchedPrs.length > 0) {
        const companyIds = Array.from(new Set(matchedPrs.map((p) => normalizeCompanyId(p.companyId))));
        if (companyIds.some((c) => c !== targetCompanyId) || companyIds.length > 1) {
          throw new Error(
            `Cross-Company RFQ Consolidation Prohibited: Cannot combine PRs across different companies (${companyIds.join(', ')}) into a single RFQ.`
          );
        }

        const resolvedPurchaseOrgs = new Set<string>();
        const activeOrgs = PurchaseOrganizationService.getOrganizations().filter(
          (o) => o.status === 'ACTIVE'
        );
        for (const p of matchedPrs) {
          const explicitOrg = (p as any).purchaseOrganizationId || (p as any).purchaseOrgId;
          if (explicitOrg) {
            resolvedPurchaseOrgs.add(explicitOrg);
          } else {
            const pCo = normalizeCompanyId(p.companyId);
            const resolved = PurchaseOrganizationService.resolveAssignmentRule({
              companyId: pCo,
              branchId: normalizeBranchId(p.branchId),
              itemCategory: p.lines[0]?.itemCategory,
            });
            const orgIdFromRule =
              resolved?.rule?.purchaseOrganizationId ||
              activeOrgs.find((o) => normalizeCompanyId(o.companyId) === pCo)?.id;
            if (orgIdFromRule) {
              resolvedPurchaseOrgs.add(orgIdFromRule);
            }
          }
        }
        if (newRfq.purchaseOrgId && resolvedPurchaseOrgs.size > 0 && !resolvedPurchaseOrgs.has(newRfq.purchaseOrgId)) {
          throw new Error(
            `Cross-Purchase-Organization RFQ Consolidation Prohibited: PR Purchase Organization (${Array.from(resolvedPurchaseOrgs).join(', ')}) does not match RFQ Purchase Org (${newRfq.purchaseOrgId}).`
          );
        }
        if (resolvedPurchaseOrgs.size > 1) {
          throw new Error(
            `Cross-Purchase-Organization RFQ Consolidation Prohibited: Cannot consolidate PRs belonging to different Purchase Organizations (${Array.from(resolvedPurchaseOrgs).join(', ')}).`
          );
        }
      }
    }

    // Financial Year & Accounting Period Gate
    const fyCheck = financialYearService.validateAndCapturePostingSnapshot({
      companyId: targetCompanyId,
      branchId: newRfq.branchId,
      documentDate: rfqDate,
      accountingPostingDate: rfqDate,
      allowFuturePeriodForPlanning: newRfq.status === 'DRAFT',
    });
    if (!fyCheck.allowed && newRfq.rfqDate) {
      throw new Error(fyCheck.rejectionReason || `RFQ creation blocked for date ${rfqDate}.`);
    }

    const count = rfqs.length + 1;
    const rfqNumber =
      newRfq.rfqNumber ||
      `RFQ-${rfqDate.slice(0, 4)}-${String(count).padStart(4, '0')}`;
    const rfqId = `rfq-${Date.now()}`;

    const createdLines: RfqLineItem[] = (newRfq.lines || []).map((line, index) => ({
      ...line,
      id: line.id || `rfq-line-${Date.now()}-${index}`,
      rfqId,
    }));

    // Perform atomic PR-to-RFQ line conversion validation across all lines
    const conversionExecutions: Array<() => void> = [];

    for (const line of createdLines) {
      if (line.prLineId) {
        const ratio = line.conversionRatio || 1;
        const requestedPurchQty = line.quantityPurchUom || 0;
        const requestedInvQty = requestedPurchQty * ratio;

        const summary = prRfqConversionService.getSummaryForPrLine(
          line.prLineId,
          undefined,
          line.inventoryUom,
          line.prNumber,
          line.itemCode
        );

        if (summary.conversionStatus === 'FULLY_CONVERTED' || summary.remainingQtyInvUom <= 0) {
          throw new Error(`This PR line has already been fully converted to RFQ. No additional conversion is permitted. (${line.prNumber} / ${line.itemCode})`);
        }

        if (requestedInvQty > summary.remainingQtyInvUom + 0.0001) {
          throw new Error(
            `Requested quantity (${requestedInvQty} ${line.inventoryUom}) exceeds the remaining unconverted quantity (${summary.remainingQtyInvUom} ${line.inventoryUom}) for PR line ${line.prNumber}.`
          );
        }

        conversionExecutions.push(() => {
          prRfqConversionService.recordConversion({
            prId: line.prLineId,
            prNumber: line.prNumber || 'PR-REF',
            prLineId: line.prLineId,
            itemCode: line.itemCode,
            rfqId,
            rfqNumber,
            rfqLineId: line.id,
            convertQtyInvUom: requestedInvQty,
            convertQtyPurchUom: requestedPurchQty,
            prInvUom: line.inventoryUom || 'EA',
            rfqPurchUom: line.purchaseUom || 'EA',
            conversionRatio: ratio,
            userId: newRfq.buyerId || 'usr-buyer-01',
            userName: newRfq.buyerName || 'Vikram Singh',
            companyId: targetCompanyId,
            branchId: newRfq.branchId,
          });
        });
      }
    }

    // Execute recorded conversion entries
    conversionExecutions.forEach(exec => exec());

    const created: RfqHeader = {
      id: rfqId,
      rfqNumber,
      companyId: targetCompanyId,
      companyCode: newRfq.companyCode || 'KOSH-HQ',
      branchId: newRfq.branchId || 'br-pond-01',
      branchCode: newRfq.branchCode || '001',
      branchName: newRfq.branchName || 'HQ Plant',
      purchaseOrgId: newRfq.purchaseOrgId || 'po-kosh-01',
      title: newRfq.title || 'New Sourcing RFQ',
      description: newRfq.description || '',
      prReferences: newRfq.prReferences || [],
      rfqDate,
      responseDeadline: newRfq.responseDeadline || '2026-12-15',
      quotationValidityDays: newRfq.quotationValidityDays || 30,
      buyerId: newRfq.buyerId || 'usr-buyer-01',
      buyerName: newRfq.buyerName || 'Vikram Singh',
      purchasingManagerId: newRfq.purchasingManagerId || 'usr-checker-03',
      purchasingManagerName: newRfq.purchasingManagerName || 'Venkatesh Iyer',
      currency: newRfq.currency || 'INR',
      deliveryTerms: newRfq.deliveryTerms || 'FOR Destination',
      paymentTerms: newRfq.paymentTerms || 'NET 60 Days',
      incoterms: newRfq.incoterms || 'DDP',
      evaluationMethod: newRfq.evaluationMethod || 'TWO_STAGE',
      sealedCommercialQuotations: newRfq.sealedCommercialQuotations ?? true,
      sealedOpeningTime: newRfq.sealedOpeningTime || `${newRfq.responseDeadline || '2026-12-15'}T18:00:00Z`,
      status: newRfq.status || 'RELEASED',
      financialYearId: fyCheck.snapshot.financialYearId,
      financialYearCode: fyCheck.snapshot.financialYearCode,
      accountingPeriodCode: fyCheck.snapshot.accountingPeriodCode,
      fySnapshot: fyCheck.snapshot,
      lines: createdLines,
      invitations: (newRfq.invitations || []).map((inv) => ({
        ...inv,
        rfqEmailReference:
          inv.rfqEmailReference || this.generateRfqEmailReference(rfqNumber, inv.vendorCode),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [created, ...rfqs];
    this.saveRfqs(updatedList);

    // Part K: Stage-gated revalidation at ON_RFQ_CREATION for linked PRs
    if (referencedPrNums.length > 0) {
      const allPrs = PurchaseRequisitionService.getPurchaseRequisitions();
      let mutated = false;
      for (const pr of allPrs) {
        if (referencedPrNums.includes(pr.prNumber) || referencedPrNums.includes(pr.id)) {
          const effInv = inventoryValidationService.getEffectivePolicy({
            companyId: pr.companyId,
            branchId: pr.branchId,
            warehouseCode: pr.lines[0]?.defaultWarehouse,
            itemCategory: pr.lines[0]?.itemCategory,
          });
          if (effInv.isEnabled && effInv.revalidationStages?.includes('ON_RFQ_CREATION')) {
            inventoryValidationService.revalidatePrAndAttachSnapshot(
              pr,
              'ON_RFQ_CREATION',
              created.buyerName
            );
            mutated = true;
          }
        }
      }
      if (mutated) {
        PurchaseRequisitionService.savePurchaseRequisitions(allPrs);
      }
    }

    return created;
  },

  updateRfq(rfqId: string, updates: Partial<RfqHeader>): RfqHeader | null {
    const rfqs = this.getRfqs();
    const idx = rfqs.findIndex(r => r.id === rfqId || r.rfqNumber === rfqId);
    if (idx !== -1) {
      rfqs[idx] = {
        ...rfqs[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveRfqs(rfqs);
      return rfqs[idx];
    }
    return null;
  },

  updateRfqStatus(rfqId: string, status: RfqStatus, cancelledBy: string = 'Purchasing Admin', reason: string = 'RFQ Cancelled'): RfqHeader | null {
    const rfqs = this.getRfqs();
    const target = rfqs.find(r => r.id === rfqId || r.rfqNumber === rfqId);
    if (target) {
      const prevStatus = target.status;
      target.status = status;
      target.updatedAt = new Date().toISOString();
      this.saveRfqs(rfqs);

      // Handle explicit conversion quantity reversal on cancellation
      if (status === 'CANCELLED' && prevStatus !== 'CANCELLED') {
        const records = prRfqConversionService.getRecords();
        const rfqRecords = records.filter(r => (r.rfqId === target.id || r.rfqNumber === target.rfqNumber) && r.status === 'ACTIVE');
        rfqRecords.forEach(rec => {
          prRfqConversionService.reverseConversion(rec.id, cancelledBy, reason, target.companyId);
        });
      }

      return target;
    }
    return null;
  },

  submitForApproval(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'PENDING_RELEASE_APPROVAL');
  },

  approveRfq(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'RELEASED');
  },

  rejectRfq(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'CANCELLED');
  },

  returnRfq(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'DRAFT');
  },

  releaseRfq(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'QUOTATIONS_IN_PROGRESS');
  },

  startNegotiation(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'UNDER_NEGOTIATION');
  },

  awardRfq(rfqId: string, awardType: 'FULL' | 'PARTIAL' = 'FULL'): RfqHeader | null {
    const status: RfqStatus = awardType === 'FULL' ? 'AWARDED' : 'PARTIALLY_AWARDED';
    const updated = this.updateRfqStatus(rfqId, status);
    if (updated) {
      const refs = Array.from(
        new Set([
          ...(updated.prReferences || []),
          ...(updated.lines.map((l) => l.prNumber).filter(Boolean) as string[]),
        ])
      );
      if (refs.length > 0) {
        const allPrs = PurchaseRequisitionService.getPurchaseRequisitions();
        let mutated = false;
        for (const pr of allPrs) {
          if (refs.includes(pr.prNumber) || refs.includes(pr.id)) {
            const effInv = inventoryValidationService.getEffectivePolicy({
              companyId: pr.companyId,
              branchId: pr.branchId,
              warehouseCode: pr.lines[0]?.defaultWarehouse,
              itemCategory: pr.lines[0]?.itemCategory,
            });
            if (effInv.isEnabled && effInv.revalidationStages?.includes('ON_RFQ_AWARD')) {
              inventoryValidationService.revalidatePrAndAttachSnapshot(
                pr,
                'ON_RFQ_AWARD',
                updated.buyerName || 'Procurement Buyer'
              );
              mutated = true;
            }
          }
        }
        if (mutated) {
          PurchaseRequisitionService.savePurchaseRequisitions(allPrs);
        }
      }
    }
    return updated;
  },

  closeRfq(rfqId: string): RfqHeader | null {
    return this.updateRfqStatus(rfqId, 'CLOSED');
  },

  extendDeadline(rfqId: string, newDeadline: string): RfqHeader | null {
    const rfqs = this.getRfqs();
    const target = rfqs.find(r => r.id === rfqId || r.rfqNumber === rfqId);
    if (target) {
      target.responseDeadline = newDeadline;
      target.updatedAt = new Date().toISOString();
      this.saveRfqs(rfqs);
      return target;
    }
    return null;
  },

  inviteSupplier(rfqId: string, invitation: { vendorId: string; vendorCode: string; vendorName: string; contactEmail: string }): RfqHeader | null {
    const rfqs = this.getRfqs();
    const target = rfqs.find(r => r.id === rfqId || r.rfqNumber === rfqId);
    if (target) {
      const existing = target.invitations.find(i => i.vendorId === invitation.vendorId);
      if (!existing) {
        target.invitations.push({
          id: `inv-${Date.now()}`,
          rfqId: target.id,
          vendorId: invitation.vendorId,
          vendorCode: invitation.vendorCode,
          vendorName: invitation.vendorName,
          contactEmail: invitation.contactEmail,
          rfqEmailReference: this.generateRfqEmailReference(target.rfqNumber, invitation.vendorCode),
          invitedAt: new Date().toISOString(),
          invitationStatus: 'INVITED',
          responseDeadline: target.responseDeadline,
        });
        target.updatedAt = new Date().toISOString();
        this.saveRfqs(rfqs);
      }
      return target;
    }
    return null;
  },

  submitQuotation(quotation: SupplierQuotation): SupplierQuotation {
    const quots = this.getQuotations();
    const enriched: SupplierQuotation = {
      ...quotation,
      submissionChannel: quotation.submissionChannel || 'PORTAL',
      unifiedStatus: quotation.unifiedStatus || 'ACCEPTED',
      originalSubmissionTimestamp: quotation.originalSubmissionTimestamp || quotation.submittedAt,
      verificationStatus: quotation.verificationStatus || 'VERIFIED_PORTAL',
      isEvaluationReady: quotation.isEvaluationReady ?? true,
    };
    const updated = [enriched, ...quots];
    this.saveQuotations(updated);

    // Auto-update invitation status
    const rfqs = this.getRfqs();
    const rfq = rfqs.find(r => r.id === quotation.rfqId);
    if (rfq) {
      const inv = rfq.invitations.find((i: RfqSupplierInvitation) => i.vendorId === quotation.vendorId);
      if (inv) inv.invitationStatus = 'SUBMITTED';
      if (rfq.status === 'RELEASED') rfq.status = 'QUOTATIONS_IN_PROGRESS';
      this.saveRfqs(rfqs);
    }

    return enriched;
  }
};
