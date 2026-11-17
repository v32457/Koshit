/**
 * KOSH INNOVATIONS — CUSTOM SPECIFICATIONS SERVICE
 * Persists Customer, Manufacturer, Brand (CMB) and Customer Part/Model references
 * to the service/storage layer instead of component-local state.
 */

import { CustomerManufacturerBrandMaster, CustomerPartModelReference } from '../types';
import { INITIAL_CUSTOM_SPECIFICATIONS, INITIAL_CUSTOMER_PART_MODEL_REFS } from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_CMB = 'kosh_cmb_master_v1';
const STORAGE_KEY_PARTS = 'kosh_customer_part_refs_v1';

export const customSpecificationsService = {
  getCmbList(): CustomerManufacturerBrandMaster[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CMB);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // fall through
      }
    }
    return INITIAL_CUSTOM_SPECIFICATIONS;
  },

  saveCmbList(list: CustomerManufacturerBrandMaster[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CMB, JSON.stringify(list));
      } catch {
        // ignore
      }
    }
  },

  getPartModelList(): CustomerPartModelReference[] {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PARTS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // fall through
      }
    }
    return INITIAL_CUSTOMER_PART_MODEL_REFS;
  },

  savePartModelList(list: CustomerPartModelReference[]): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PARTS, JSON.stringify(list));
      } catch {
        // ignore
      }
    }
  },

  upsertCmb(
    form: { id?: string; code: string; name: string; entityType: 'CUSTOMER' | 'MANUFACTURER' | 'BRAND'; description?: string },
    currentUser: { id: string; fullName: string }
  ): CustomerManufacturerBrandMaster[] {
    const list = this.getCmbList();
    const code = form.code.toUpperCase().trim();
    const name = form.name.toUpperCase().trim();

    if (form.id) {
      const updated = list.map((c) =>
        c.id === form.id
          ? {
              ...c,
              name,
              entityType: form.entityType,
              displayLabel: `${name} (${code})`,
              description: form.description,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.fullName,
            }
          : c
      );
      this.saveCmbList(updated);
      return updated;
    } else {
      if (list.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
        throw new Error(`Master entity code "${code}" already exists.`);
      }
      const newRecord: CustomerManufacturerBrandMaster = {
        id: `cmb-${Date.now()}`,
        code,
        name,
        entityType: form.entityType,
        displayLabel: `${name} (${code})`,
        description: form.description,
        isActive: true,
        referencedItemCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      };
      const updated = [newRecord, ...list];
      this.saveCmbList(updated);
      return updated;
    }
  },

  toggleCmbStatus(id: string): CustomerManufacturerBrandMaster[] {
    const list = this.getCmbList();
    const updated = list.map((c) => (c.id === id ? { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() } : c));
    this.saveCmbList(updated);
    return updated;
  },

  upsertPartModel(
    form: { id?: string; customerPartNumber: string; customerId?: string; manufacturerBrandId?: string; globalItemId?: string; description?: string },
    currentUser: { id: string; fullName: string },
    cmbList: CustomerManufacturerBrandMaster[],
    globalItems: any[]
  ): CustomerPartModelReference[] {
    const list = this.getPartModelList();
    const customerPartNumber = form.customerPartNumber.trim().toUpperCase();
    const matchedCust = cmbList.find((c) => c.id === form.customerId);
    const matchedMfg = cmbList.find((c) => c.id === form.manufacturerBrandId);
    const matchedItem = globalItems.find((i) => i.id === form.globalItemId);

    if (form.id) {
      const updated = list.map((p) =>
        p.id === form.id
          ? {
              ...p,
              customerPartNumber,
              customerId: form.customerId,
              customerName: matchedCust?.name,
              manufacturerBrandId: form.manufacturerBrandId,
              manufacturerBrandName: matchedMfg?.name,
              globalItemId: form.globalItemId,
              globalItemCode: matchedItem?.globalItemCode,
              description: form.description,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.fullName,
            }
          : p
      );
      this.savePartModelList(updated);
      return updated;
    } else {
      const newRef: CustomerPartModelReference = {
        id: `cpm-${Date.now()}`,
        customerPartNumber,
        customerId: form.customerId,
        customerName: matchedCust?.name,
        manufacturerBrandId: form.manufacturerBrandId,
        manufacturerBrandName: matchedMfg?.name,
        globalItemId: form.globalItemId,
        globalItemCode: matchedItem?.globalItemCode,
        description: form.description,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      };
      const updated = [newRef, ...list];
      this.savePartModelList(updated);
      return updated;
    }
  },

  togglePartModelStatus(id: string): CustomerPartModelReference[] {
    const list = this.getPartModelList();
    const updated = list.map((p) => (p.id === id ? { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() } : p));
    this.savePartModelList(updated);
    return updated;
  },
};
