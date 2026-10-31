import React, { useState } from 'react';
import { FieldConfigurationRule, UserRole } from '../../types';
import {
  Sliders,
  ShieldCheck,
  Save,
  Plus,
  AlertTriangle,
  RotateCcw,
  Search,
  Edit2,
  Trash2,
  X,
  Users,
  CheckCircle2,
  Eye,
  Lock,
  Layers,
} from 'lucide-react';

const ALL_SYSTEM_ROLES: { role: UserRole; label: string }[] = [
  { role: 'PLATFORM_ADMIN', label: 'Platform Admin' },
  { role: 'ORG_ADMIN', label: 'Org Admin' },
  { role: 'GLOBAL_ITEM_ADMIN', label: 'Global Item Admin' },
  { role: 'ITEM_MAKER', label: 'Item Maker' },
  { role: 'ITEM_CHECKER', label: 'Item Checker' },
  { role: 'BRANCH_COORDINATOR', label: 'Branch Coordinator' },
  { role: 'MASTER_DATA_AUDITOR', label: 'Master Data Auditor' },
  { role: 'READ_ONLY_USER', label: 'Read-Only User' },
];

const INITIAL_FIELD_RULES: FieldConfigurationRule[] = [
  {
    id: 'fld-1',
    entityName: 'BRANCH',
    tabName: 'General',
    fieldKey: 'portalBranchCode',
    label: 'Portal Branch Code (3 Digits)',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: true,
    fieldOrder: 1,
    sapMappingKey: 'N/A (Portal Only)',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_COORDINATOR'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-2',
    entityName: 'BRANCH',
    tabName: 'General',
    fieldKey: 'name',
    label: 'Branch Name',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 2,
    sapMappingKey: 'BPLName',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_COORDINATOR'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-3',
    entityName: 'BRANCH',
    tabName: 'GST Governance',
    fieldKey: 'gstinPan',
    label: 'GSTIN / Federal Tax ID',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 3,
    sapMappingKey: 'GSTRegnNo',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'MASTER_DATA_AUDITOR'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-4',
    entityName: 'BRANCH',
    tabName: 'GST Governance',
    fieldKey: 'gstLegalName',
    label: 'Official GST Legal Name',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: true,
    fieldOrder: 4,
    sapMappingKey: 'TaxLegalName',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-5',
    entityName: 'WAREHOUSE',
    tabName: 'Warehouse Setup',
    fieldKey: 'warehouseCode',
    label: 'Warehouse Code',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 1,
    sapMappingKey: 'WhsCode',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_COORDINATOR'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-6',
    entityName: 'WAREHOUSE',
    tabName: 'Warehouse Setup',
    fieldKey: 'warehouseName',
    label: 'Warehouse Name',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 2,
    sapMappingKey: 'WhsName',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN', 'BRANCH_COORDINATOR'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-7',
    entityName: 'ITEM',
    tabName: 'Branch Availability',
    fieldKey: 'defaultWarehouseId',
    label: 'Assigned Branch Warehouse',
    fieldType: 'SELECT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 1,
    sapMappingKey: 'DfltWhs',
    applicableRoles: ['PLATFORM_ADMIN', 'GLOBAL_ITEM_ADMIN', 'ITEM_MAKER'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
  {
    id: 'fld-8',
    entityName: 'BUSINESS_PARTNER',
    tabName: 'General Information',
    fieldKey: 'cardCode',
    label: 'BP Code',
    fieldType: 'TEXT',
    isVisible: true,
    isRequired: true,
    isReadOnly: false,
    fieldOrder: 1,
    sapMappingKey: 'CardCode',
    applicableRoles: ['PLATFORM_ADMIN', 'ORG_ADMIN'],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Admin',
  },
];

export const FieldConfigurationsView: React.FC = () => {
  const [fieldRules, setFieldRules] = useState<FieldConfigurationRule[]>(() => {
    try {
      const saved = localStorage.getItem('kosh_field_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Error loading field rules from localStorage:', err);
    }
    return INITIAL_FIELD_RULES;
  });

  const [activeEntity, setActiveEntity] = useState<'BRANCH' | 'WAREHOUSE' | 'ITEM' | 'BUSINESS_PARTNER'>('BRANCH');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form Fields
  const [tabName, setTabName] = useState('General');
  const [fieldKey, setFieldKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<'TEXT' | 'NUMBER' | 'SELECT' | 'CHECKBOX' | 'DATE'>('TEXT');
  const [isVisible, setIsVisible] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [fieldOrder, setFieldOrder] = useState<number>(1);
  const [sapMappingKey, setSapMappingKey] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [mappedUserIds, setMappedUserIds] = useState('');

  const handleOpenAddModal = () => {
    setErrorMsg('');
    setEditingRuleId(null);
    setTabName('General');
    setFieldKey('');
    setLabel('');
    setFieldType('TEXT');
    setIsVisible(true);
    setIsRequired(false);
    setIsReadOnly(false);
    const existingCount = fieldRules.filter((r) => r.entityName === activeEntity).length;
    setFieldOrder(existingCount + 1);
    setSapMappingKey('');
    setSelectedRoles([]);
    setMappedUserIds('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: FieldConfigurationRule) => {
    setErrorMsg('');
    setEditingRuleId(rule.id);
    setTabName(rule.tabName);
    setFieldKey(rule.fieldKey);
    setLabel(rule.label);
    setFieldType(rule.fieldType);
    setIsVisible(rule.isVisible);
    setIsRequired(rule.isRequired);
    setIsReadOnly(rule.isReadOnly);
    setFieldOrder(rule.fieldOrder);
    setSapMappingKey(rule.sapMappingKey || '');
    setSelectedRoles(rule.applicableRoles || []);
    setMappedUserIds((rule.mappedUserIds || []).join(', '));
    setIsModalOpen(true);
  };

  const handleDeleteRule = (id: string) => {
    const target = fieldRules.find((r) => r.id === id);
    if (!target) return;

    if (window.confirm(`Are you sure you want to delete field configuration rule for "${target.label}"?`)) {
      const updated = fieldRules.filter((r) => r.id !== id);
      setFieldRules(updated);
      localStorage.setItem('kosh_field_rules', JSON.stringify(updated));
      setSuccessMsg(`Deleted field rule "${target.label}".`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleToggleRule = (id: string, prop: 'isVisible' | 'isRequired' | 'isReadOnly') => {
    const updated = fieldRules.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          [prop]: !r[prop],
          version: r.version + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Platform Admin',
        };
      }
      return r;
    });

    setFieldRules(updated);
    localStorage.setItem('kosh_field_rules', JSON.stringify(updated));
  };

  const handleSaveRuleForm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fieldKey.trim() || !label.trim() || !tabName.trim()) {
      setErrorMsg('Tab Section, Field Key, and Field Label are required.');
      return;
    }

    const cleanUserIds = mappedUserIds
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (editingRuleId) {
      // Update existing rule
      const updated = fieldRules.map((r) => {
        if (r.id === editingRuleId) {
          return {
            ...r,
            tabName: tabName.trim(),
            fieldKey: fieldKey.trim(),
            label: label.trim(),
            fieldType,
            isVisible,
            isRequired,
            isReadOnly,
            fieldOrder,
            sapMappingKey: sapMappingKey.trim() || undefined,
            applicableRoles: selectedRoles,
            mappedUserIds: cleanUserIds.length > 0 ? cleanUserIds : undefined,
            version: r.version + 1,
            updatedAt: new Date().toISOString(),
            updatedBy: 'Platform Admin',
          };
        }
        return r;
      });

      setFieldRules(updated);
      localStorage.setItem('kosh_field_rules', JSON.stringify(updated));
      setIsModalOpen(false);
      setSuccessMsg(`Updated rule for "${label.trim()}".`);
    } else {
      // Create new rule
      const newRule: FieldConfigurationRule = {
        id: `fld-${Date.now()}`,
        entityName: activeEntity,
        tabName: tabName.trim(),
        fieldKey: fieldKey.trim(),
        label: label.trim(),
        fieldType,
        isVisible,
        isRequired,
        isReadOnly,
        fieldOrder,
        sapMappingKey: sapMappingKey.trim() || undefined,
        applicableRoles: selectedRoles,
        mappedUserIds: cleanUserIds.length > 0 ? cleanUserIds : undefined,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Platform Admin',
      };

      const updated = [...fieldRules, newRule];
      setFieldRules(updated);
      localStorage.setItem('kosh_field_rules', JSON.stringify(updated));
      setIsModalOpen(false);
      setSuccessMsg(`Created new field rule for "${newRule.label}".`);
    }

    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all field rules to default factory configuration?')) {
      setFieldRules(INITIAL_FIELD_RULES);
      localStorage.setItem('kosh_field_rules', JSON.stringify(INITIAL_FIELD_RULES));
      setSuccessMsg('Reset all field configuration rules to system defaults.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleRoleCheckboxToggle = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  // Filter rules by Entity, Search, and Role
  const filteredRules = fieldRules
    .filter((r) => r.entityName === activeEntity)
    .filter((r) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.label.toLowerCase().includes(q) ||
        r.fieldKey.toLowerCase().includes(q) ||
        r.tabName.toLowerCase().includes(q) ||
        (r.sapMappingKey && r.sapMappingKey.toLowerCase().includes(q))
      );
    })
    .filter((r) => {
      if (roleFilter === 'ALL') return true;
      if (!r.applicableRoles || r.applicableRoles.length === 0) return true;
      return r.applicableRoles.includes(roleFilter as UserRole);
    })
    .sort((a, b) => a.fieldOrder - b.fieldOrder);

  return (
    <div className="space-y-4 text-xs font-sans select-none">
      {/* Title Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Field & Validation Configuration Engine
          </h2>
          <p className="text-slate-500 mt-0.5">
            100% Declarative Field Governance: Add, Edit, Delete, Toggle Visibility/Required/Read-Only & Role/User Mapping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs cursor-pointer transition"
          >
            <Plus className="w-4 h-4" /> Add Field Rule
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Entity Selector Tabs & Search / Role Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['BRANCH', 'WAREHOUSE', 'ITEM', 'BUSINESS_PARTNER'] as const).map((ent) => (
              <button
                key={ent}
                onClick={() => setActiveEntity(ent)}
                className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition ${
                  activeEntity === ent
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {ent.replace('_', ' ')} CONFIG
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search Field, Key, or Section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-60 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="ALL">All Mapped Roles</option>
                {ALL_SYSTEM_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Field Rules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[11px]">
                <th className="p-3.5">Order</th>
                <th className="p-3.5">Tab Section</th>
                <th className="p-3.5">Field Key / Label</th>
                <th className="p-3.5">Visibility</th>
                <th className="p-3.5">Required</th>
                <th className="p-3.5">Read-Only</th>
                <th className="p-3.5">SAP Field Mapping</th>
                <th className="p-3.5">Role / User Mappings</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                    No field configuration rules found for {activeEntity.replace('_', ' ')}. Click "Add Field Rule" above to create one.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-500">#{rule.fieldOrder}</td>
                    <td className="p-3.5 font-bold text-slate-700">{rule.tabName}</td>
                    <td className="p-3.5 font-bold text-slate-900">
                      <div>{rule.label}</div>
                      <div className="text-[10px] font-mono text-indigo-600">{rule.fieldKey} ({rule.fieldType})</div>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleRule(rule.id, 'isVisible')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          rule.isVisible ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.isVisible ? 'VISIBLE' : 'HIDDEN'}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleRule(rule.id, 'isRequired')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          rule.isRequired ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {rule.isRequired ? 'MANDATORY' : 'OPTIONAL'}
                      </button>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleRule(rule.id, 'isReadOnly')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          rule.isReadOnly ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {rule.isReadOnly ? 'READ ONLY' : 'EDITABLE'}
                      </button>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 font-semibold">
                      {rule.sapMappingKey || 'N/A'}
                    </td>
                    <td className="p-3.5">
                      {rule.applicableRoles && rule.applicableRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {rule.applicableRoles.map((r) => (
                            <span key={r} className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold italic">All System Roles</span>
                      )}
                      {rule.mappedUserIds && rule.mappedUserIds.length > 0 && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Users: {rule.mappedUserIds.join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(rule)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT RULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="font-bold text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-300" />
                <span>{editingRuleId ? 'Edit Field Configuration Rule' : 'Add New Field Configuration Rule'}</span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-indigo-200 hover:text-white font-bold cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveRuleForm} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Entity Target</label>
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={activeEntity.replace('_', ' ')}
                    className="w-full text-xs p-2 bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tab Section Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. General / GST Governance"
                    value={tabName}
                    onChange={(e) => setTabName(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Key *</label>
                  <input
                    type="text"
                    placeholder="e.g. gstinPan"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. Official GSTIN ID"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Field Type</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as any)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="SELECT">Select Dropdown</option>
                    <option value="CHECKBOX">Checkbox</option>
                    <option value="DATE">Date</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    min={1}
                    value={fieldOrder}
                    onChange={(e) => setFieldOrder(parseInt(e.target.value) || 1)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">SAP Field Mapping</label>
                  <input
                    type="text"
                    placeholder="e.g. GSTRegnNo"
                    value={sapMappingKey}
                    onChange={(e) => setSapMappingKey(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono font-bold uppercase"
                  />
                </div>
              </div>

              {/* Behavior Flags */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Visible</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Mandatory</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReadOnly}
                    onChange={(e) => setIsReadOnly(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-slate-800 text-xs">Read-Only</span>
                </label>
              </div>

              {/* User Roles Mapping */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <label className="block font-bold text-slate-900 text-xs">
                  Applicable User Roles Mapping (Select target roles for this rule)
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {ALL_SYSTEM_ROLES.map((r) => (
                    <label key={r.role} className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(r.role)}
                        onChange={() => handleRoleCheckboxToggle(r.role)}
                        className="w-3.5 h-3.5 text-indigo-600 rounded"
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* User IDs Mapping */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Specific User Mapping (Comma-separated User IDs)
                </label>
                <input
                  type="text"
                  placeholder="e.g. usr-admin-01, usr-checker-02"
                  value={mappedUserIds}
                  onChange={(e) => setMappedUserIds(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg font-mono text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 cursor-pointer"
                >
                  Save Field Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
