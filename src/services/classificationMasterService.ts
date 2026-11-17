/**
 * KOSH INNOVATIONS — CLASSIFICATION & ATTRIBUTE MASTER ADMINISTRATION SERVICE
 *
 * Replaces static-only CLASSIFICATION_DIMENSIONS & alert() stub with real CRUD,
 * duplicate protection, soft-deactivation protecting referenced items, and audit trails.
 * Preserves existing seeded dimensions (Category, Type, Material, Form, Process, Colour, Manufacturer).
 */

import { ClassificationDimension, ClassificationValue } from '../types';
import { CLASSIFICATION_DIMENSIONS } from '../data/seedData';
import { EnterpriseAuditService } from './enterpriseAuditService';

const STORAGE_KEY_CLASSIFICATION_MASTER = 'kosh_classification_dimensions_v2';

let memoryDimensions: Record<string, ClassificationDimension> | null = null;

function cloneSeedDimensions(): Record<string, ClassificationDimension> {
  return JSON.parse(JSON.stringify(CLASSIFICATION_DIMENSIONS));
}

export const classificationMasterService = {
  resetForTesting(): void {
    memoryDimensions = cloneSeedDimensions();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_CLASSIFICATION_MASTER);
      } catch {
        // ignore
      }
    }
  },

  getAllDimensions(): Record<string, ClassificationDimension> {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CLASSIFICATION_MASTER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.category && parsed.material) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    if (!memoryDimensions) {
      memoryDimensions = cloneSeedDimensions();
    }
    return JSON.parse(JSON.stringify(memoryDimensions));
  },

  saveDimensions(dims: Record<string, ClassificationDimension>): void {
    memoryDimensions = JSON.parse(JSON.stringify(dims));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CLASSIFICATION_MASTER, JSON.stringify(dims));
      } catch {
        // ignore
      }
    }
  },

  getDimensionValues(dimensionKey: string, includeInactive = false): ClassificationValue[] {
    const dims = this.getAllDimensions();
    const dim = dims[dimensionKey];
    if (!dim) return [];
    return includeInactive ? [...dim.values] : dim.values.filter((v) => v.isActive !== false);
  },

  getCategoryByCode(code?: string): ClassificationValue | undefined {
    if (!code) return undefined;
    const norm = code.trim().toUpperCase();
    return this.getDimensionValues('category', true).find(
      (c) => c.code.toUpperCase() === norm
    );
  },

  getActiveCategories(): ClassificationValue[] {
    return this.getDimensionValues('category', false);
  },

  upsertDimensionValue(
    dimensionKey: string,
    payload: {
      code: string;
      name: string;
      display?: string;
      description?: string;
      isActive?: boolean;
      isEdit?: boolean;
    },
    actorName = 'Platform Admin',
    actorUserId = 'usr-admin-01'
  ): ClassificationValue {
    const dims = this.getAllDimensions();
    const dim = dims[dimensionKey];
    if (!dim) {
      throw new Error(`Unknown classification dimension "${dimensionKey}".`);
    }

    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();
    if (!code || !/^[A-Z0-9_-]{1,12}$/.test(code)) {
      throw new Error('Classification Code must be 1–12 uppercase alphanumeric characters.');
    }
    if (!name) {
      throw new Error('Classification Name is required.');
    }

    const display = (payload.display || `${name} (${code})`).trim();
    const existingIdx = dim.values.findIndex((v) => v.code.toUpperCase() === code);

    if (!payload.isEdit && existingIdx >= 0) {
      throw new Error(`Code "${code}" already exists in ${dim.label}.`);
    }

    const nextValue: ClassificationValue = {
      code,
      name,
      display,
      description: payload.description?.trim(),
      isActive: payload.isActive !== undefined ? payload.isActive : true,
    };

    if (existingIdx >= 0) {
      dim.values[existingIdx] = nextValue;
    } else {
      dim.values.unshift(nextValue);
    }

    dims[dimensionKey] = dim;
    this.saveDimensions(dims);

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'CLASSIFICATION_MASTER',
      entityId: `${dimensionKey}:${code}`,
      eventType: existingIdx >= 0 ? 'CLASSIFICATION_CODE_UPDATED' : 'CLASSIFICATION_CODE_CREATED',
      eventDescription: `${existingIdx >= 0 ? 'Updated' : 'Created'} ${dim.label} code ${code} (${name})`,
      changedByUserId: actorUserId,
      changedByName: actorName,
      changeReason: `Classification Master update on ${dimensionKey}`,
      newValue: nextValue,
    });

    return nextValue;
  },

  toggleDimensionValueStatus(
    dimensionKey: string,
    code: string,
    isActive: boolean,
    actorName = 'Platform Admin',
    actorUserId = 'usr-admin-01'
  ): ClassificationValue {
    const dims = this.getAllDimensions();
    const dim = dims[dimensionKey];
    if (!dim) throw new Error(`Unknown classification dimension "${dimensionKey}".`);
    const idx = dim.values.findIndex((v) => v.code.toUpperCase() === code.trim().toUpperCase());
    if (idx < 0) throw new Error(`Code "${code}" not found in ${dim.label}.`);

    const prev = dim.values[idx];
    const updated = { ...prev, isActive };
    dim.values[idx] = updated;
    dims[dimensionKey] = dim;
    this.saveDimensions(dims);

    EnterpriseAuditService.logEvent({
      companyId: 'co-kosh-01',
      entityType: 'CLASSIFICATION_MASTER',
      entityId: `${dimensionKey}:${updated.code}`,
      eventType: isActive ? 'CLASSIFICATION_CODE_ACTIVATED' : 'CLASSIFICATION_CODE_DEACTIVATED',
      eventDescription: `${isActive ? 'Activated' : 'Soft-deactivated'} ${dim.label} code ${updated.code}`,
      changedByUserId: actorUserId,
      changedByName: actorName,
      changeReason: 'Soft lifecycle toggle preserving existing item references',
      previousValue: { isActive: prev.isActive },
      newValue: { isActive },
    });

    return updated;
  },
};
