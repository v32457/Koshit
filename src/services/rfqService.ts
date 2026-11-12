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
import { INITIAL_BUSINESS_PARTNERS } from '../data/seedData';
import { uomConversionService } from './uomConversionService';

const STORAGE_KEY_RFQS = 'kosh_rfq_headers_v1';
const STORAGE_KEY_QUOTATIONS = 'kosh_supplier_quotations_v1';

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
      { id: 'att-q1', fileName: 'BASF_Technical_Datasheet_V0.pdf', fileSize: 1048576, uploadedAt: '2026-11-07T14:00:00Z' },
    ],
    submittedAt: '2026-11-07T14:00:00Z',
    submittedBy: 'Dr. Amitav Banerjee (BASF)',
    isSealed: true,
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
      { id: 'att-q2', fileName: 'PSI_Moisture_Deviation_Note.pdf', fileSize: 524288, uploadedAt: '2026-11-08T10:00:00Z' },
    ],
    submittedAt: '2026-11-08T10:00:00Z',
    submittedBy: 'Siddharth Varma (PSI)',
    isSealed: true,
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
  },
];

import { prRfqConversionService } from './prRfqConversionService';

export const rfqService = {
  getRfqs(): RfqHeader[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RFQS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading RFQs:', err);
    }
    return INITIAL_RFQS;
  },

  saveRfqs(rfqs: RfqHeader[]) {
    try {
      localStorage.setItem(STORAGE_KEY_RFQS, JSON.stringify(rfqs));
    } catch (err) {
      console.error('Error saving RFQs:', err);
    }
  },

  getQuotations(): SupplierQuotation[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUOTATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading quotations:', err);
    }
    return INITIAL_QUOTATIONS;
  },

  saveQuotations(quotations: SupplierQuotation[]) {
    try {
      localStorage.setItem(STORAGE_KEY_QUOTATIONS, JSON.stringify(quotations));
    } catch (err) {
      console.error('Error saving quotations:', err);
    }
  },

  getRfqById(id: string): RfqHeader | undefined {
    return this.getRfqs().find(r => r.id === id || r.rfqNumber === id);
  },

  getQuotationsForRfq(rfqId: string): SupplierQuotation[] {
    return this.getQuotations().filter(q => q.rfqId === rfqId || q.rfqNumber === rfqId);
  },

  createRfq(newRfq: Partial<RfqHeader>): RfqHeader {
    const rfqs = this.getRfqs();
    const count = rfqs.length + 1;
    const rfqNumber = `RFQ-2026-${String(count).padStart(4, '0')}`;
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
            companyId: newRfq.companyId,
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
      companyId: newRfq.companyId || 'co-kosh-01',
      companyCode: newRfq.companyCode || 'KOSH-HQ',
      branchId: newRfq.branchId || 'br-pond-01',
      branchCode: newRfq.branchCode || '001',
      branchName: newRfq.branchName || 'HQ Plant',
      purchaseOrgId: newRfq.purchaseOrgId || 'po-kosh-01',
      title: newRfq.title || 'New Sourcing RFQ',
      description: newRfq.description || '',
      prReferences: newRfq.prReferences || [],
      rfqDate: new Date().toISOString().split('T')[0],
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
      status: newRfq.status || 'RELEASED',
      lines: createdLines,
      invitations: newRfq.invitations || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [created, ...rfqs];
    this.saveRfqs(updatedList);
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
    return this.updateRfqStatus(rfqId, status);
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
    const updated = [quotation, ...quots];
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

    return quotation;
  }
};
