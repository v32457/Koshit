import React, { useState } from 'react';
import { CertificateConfig } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface CertificateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  configs: CertificateConfig[];
  onSave: (configs: CertificateConfig[]) => void;
}

export const CertificateConfigModal: React.FC<CertificateConfigModalProps> = ({
  isOpen,
  onClose,
  configs,
  onSave,
}) => {
  const [localConfigs, setLocalConfigs] = useState<CertificateConfig[]>(configs);

  if (!isOpen) return null;

  const handleAdd = () => {
    const newConfig: CertificateConfig = {
      id: `cert-${Date.now()}`,
      code: 'NEW',
      name: 'New Certificate',
      description: '',
      isMandatory: false,
      validityRequired: false,
      issuingAuthority: '',
      applicableScope: 'Item',
      status: 'ACTIVE',
    };
    setLocalConfigs([...localConfigs, newConfig]);
  };

  const handleDelete = (id: string) => {
    setLocalConfigs(localConfigs.filter((c) => c.id !== id));
  };

  const handleUpdate = (id: string, field: keyof CertificateConfig, value: any) => {
    setLocalConfigs(
      localConfigs.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
          <h3 className="font-bold text-sm">Configure Quality Inspection Certificates</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer">
              <Plus className="w-4 h-4" /> Add Certificate
            </button>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5 text-center">Mandatory</th>
                    <th className="p-2.5 text-center">Scope</th>
                    <th className="p-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {localConfigs.map((c) => (
                    <tr key={c.id}>
                      <td className="p-2"><input type="text" value={c.code} onChange={(e) => handleUpdate(c.id, 'code', e.target.value)} className="w-full p-1 border rounded" /></td>
                      <td className="p-2"><input type="text" value={c.name} onChange={(e) => handleUpdate(c.id, 'name', e.target.value)} className="w-full p-1 border rounded" /></td>
                      <td className="p-2 text-center"><input type="checkbox" checked={c.isMandatory} onChange={(e) => handleUpdate(c.id, 'isMandatory', e.target.checked)} /></td>
                      <td className="p-2">
                        <select value={c.applicableScope} onChange={(e) => handleUpdate(c.id, 'applicableScope', e.target.value)} className="w-full p-1 border rounded">
                            <option value="Company">Company</option>
                            <option value="Branch">Branch</option>
                            <option value="Category">Category</option>
                            <option value="Item">Item</option>
                        </select>
                      </td>
                      <td className="p-2"><button onClick={() => handleDelete(c.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
        <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 border rounded">Cancel</button>
            <button onClick={() => {onSave(localConfigs); onClose();}} className="px-3 py-1.5 bg-emerald-600 text-white rounded">Save Certificates</button>
        </div>
      </div>
    </div>
  );
};
