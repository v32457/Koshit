import React, { useState, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  Building2,
  FileText,
  Activity,
  History,
  ShieldAlert,
  Camera,
  Layers,
} from 'lucide-react';
import { Company, Branch } from '../../types';
import { INITIAL_COMPANIES, INITIAL_BRANCHES } from '../../data/seedData';

export interface EquipmentRecord {
  id: string;
  equipmentId: string; // e.g. 'EQ-INJ-001'
  equipmentName: string; // e.g. '350T Injection Moulding Machine'
  category: 'MOULDING' | 'EXTRUSION' | 'CONVEYOR' | 'COMPRESSOR' | 'CHILLER' | 'PACKAGING';
  makeModel: string;
  serialNumber: string;
  location: string;
  department: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  operationalStatus: 'OPERATIONAL' | 'BREAKDOWN' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED';
  totalDowntimeHours: number;
  lastBreakdownDate?: string;
  preventiveMaintenanceScheduleRef?: string;
  nextPmDueDate?: string;
  activeWorkOrdersCount: number;
}

export const INITIAL_EQUIPMENT_RECORDS: EquipmentRecord[] = [
  {
    id: 'eq-001',
    equipmentId: 'EQ-INJ-350T-01',
    equipmentName: '350T High Precision Injection Moulding Machine',
    category: 'MOULDING',
    makeModel: 'ENGEL Victory 350',
    serialNumber: 'ENG-2023-8890',
    location: 'Bay A - Shop Floor 1',
    department: 'Production & Plant Operations',
    criticality: 'CRITICAL',
    operationalStatus: 'OPERATIONAL',
    totalDowntimeHours: 14.5,
    lastBreakdownDate: '2026-10-12',
    preventiveMaintenanceScheduleRef: 'PM-SCH-2026-Q4-01',
    nextPmDueDate: '2026-11-20',
    activeWorkOrdersCount: 1,
  },
  {
    id: 'eq-002',
    equipmentId: 'EQ-EXT-80MM-02',
    equipmentName: 'Twin Screw Extrusion Line 80mm',
    category: 'EXTRUSION',
    makeModel: 'KraussMaffei KMD 80',
    serialNumber: 'KM-2022-4412',
    location: 'Bay B - Extrusion Division',
    department: 'Production & Plant Operations',
    criticality: 'HIGH',
    operationalStatus: 'BREAKDOWN',
    totalDowntimeHours: 42.0,
    lastBreakdownDate: '2026-11-04',
    preventiveMaintenanceScheduleRef: 'PM-SCH-2026-Q4-08',
    nextPmDueDate: '2026-11-15',
    activeWorkOrdersCount: 2,
  },
  {
    id: 'eq-003',
    equipmentId: 'EQ-CHILL-50TR-01',
    equipmentName: 'Centralized Water Chiller Unit 50 TR',
    category: 'CHILLER',
    makeModel: 'Blue Star Industrial Chiller',
    serialNumber: 'BS-CH-2021-99',
    location: 'Utility Room 2',
    department: 'Maintenance & Engineering',
    criticality: 'CRITICAL',
    operationalStatus: 'OPERATIONAL',
    totalDowntimeHours: 8.0,
    lastBreakdownDate: '2026-09-02',
    preventiveMaintenanceScheduleRef: 'PM-SCH-2026-Q4-12',
    nextPmDueDate: '2026-11-30',
    activeWorkOrdersCount: 0,
  },
];

export const AssetEquipmentView: React.FC = () => {
  const [equipmentList, setEquipmentList] = useState<EquipmentRecord[]>(INITIAL_EQUIPMENT_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedEqDetails, setSelectedEqDetails] = useState<EquipmentRecord | null>(null);

  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      if (criticalityFilter !== 'ALL' && eq.criticality !== criticalityFilter) return false;
      if (statusFilter !== 'ALL' && eq.operationalStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          eq.equipmentId.toLowerCase().includes(q) ||
          eq.equipmentName.toLowerCase().includes(q) ||
          eq.makeModel.toLowerCase().includes(q) ||
          eq.location.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [equipmentList, criticalityFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-5 text-xs font-sans select-none">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Asset, Equipment & Maintenance Master Console
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Manage equipment criticality classification, breakdown severity, downtime tracking, preventive maintenance schedule validation, and emergency repair PR integration.
          </p>
        </div>

        <button
          onClick={() => alert('Add Equipment Modal opened.')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Register Equipment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Registered Machinery</span>
          <div className="text-xl font-bold text-slate-900 font-mono">{equipmentList.length} Units</div>
          <span className="text-[10px] text-slate-400">Plant shop floor assets</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Criticality Breakdown</span>
          <div className="text-xl font-bold text-rose-600 font-mono">
            {equipmentList.filter((e) => e.criticality === 'CRITICAL').length} Critical Units
          </div>
          <span className="text-[10px] text-slate-400">Requires emergency PR route</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Active Breakdown</span>
          <div className="text-xl font-bold text-amber-600 font-mono">
            {equipmentList.filter((e) => e.operationalStatus === 'BREAKDOWN').length} Machines
          </div>
          <span className="text-[10px] text-slate-400">Under repair work order</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-slate-500 font-bold uppercase text-[10px]">Total YTD Downtime</span>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {equipmentList.reduce((acc, e) => acc + e.totalDowntimeHours, 0)} Hours
          </div>
          <span className="text-[10px] text-slate-400">Captured downtime log</span>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="font-bold text-slate-700">Criticality:</span>
            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Criticality Levels</option>
              <option value="CRITICAL">CRITICAL (Emergency PR)</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs">
            <span className="font-bold text-slate-700">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 cursor-pointer focus:outline-hidden text-xs"
            >
              <option value="ALL">All Operational Statuses</option>
              <option value="OPERATIONAL">OPERATIONAL</option>
              <option value="BREAKDOWN">BREAKDOWN</option>
              <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
            </select>
          </div>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search equipment ID, model, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium"
          />
        </div>
      </div>

      {/* Equipment Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Equipment Master & Maintenance Schedule Registry ({filteredEquipment.length} Equipment Units)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px]">
                <th className="p-3">Equipment ID & Name</th>
                <th className="p-3">Make / Model & Serial</th>
                <th className="p-3">Location & Dept</th>
                <th className="p-3 text-center">Criticality</th>
                <th className="p-3 text-center">Operational Status</th>
                <th className="p-3 text-center font-mono">Downtime (Hrs)</th>
                <th className="p-3">PM Schedule Ref</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEquipment.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No equipment records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredEquipment.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-slate-900">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-indigo-800 rounded font-mono text-[10px] block w-fit mb-0.5">
                        {eq.equipmentId}
                      </span>
                      {eq.equipmentName}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {eq.makeModel}
                      <span className="block font-mono text-[10px] text-slate-500">S/N: {eq.serialNumber}</span>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {eq.location}
                      <span className="block text-[10px] text-slate-400">{eq.department}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          eq.criticality === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : eq.criticality === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {eq.criticality}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          eq.operationalStatus === 'OPERATIONAL'
                            ? 'bg-emerald-100 text-emerald-800'
                            : eq.operationalStatus === 'BREAKDOWN'
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {eq.operationalStatus}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {eq.totalDowntimeHours} h
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-600">
                      {eq.preventiveMaintenanceScheduleRef || 'N/A'}
                      <span className="block text-[10px] text-slate-400">Next PM: {eq.nextPmDueDate}</span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedEqDetails(eq)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-300 rounded font-bold text-[11px] cursor-pointer shadow-2xs"
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Equipment History Modal */}
      {selectedEqDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#0B192C] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm">{selectedEqDetails.equipmentName} ({selectedEqDetails.equipmentId})</h3>
                  <p className="text-xs text-slate-300">Make: {selectedEqDetails.makeModel} • S/N: {selectedEqDetails.serialNumber}</p>
                </div>
              </div>
              <button onClick={() => setSelectedEqDetails(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">Location:</span>
                  <span className="font-bold text-slate-900">{selectedEqDetails.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">Department:</span>
                  <span className="font-bold text-slate-900">{selectedEqDetails.department}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">Criticality Grade:</span>
                  <span className="font-bold text-rose-600">{selectedEqDetails.criticality}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">PM Schedule Ref:</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedEqDetails.preventiveMaintenanceScheduleRef}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  Recent Breakdown & Repair History
                </h4>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Breakdown Ref: BD-2026-10-12 (Catastrophic Hydraulic Leak)</span>
                    <span className="text-rose-600">Downtime: 14.5 Hours</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Replaced hydraulic seal assembly and high-pressure hose. Associated Repair PR: PR-2026-0042.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEqDetails(null)}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
