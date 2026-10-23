import React from 'react';
import { INITIAL_ORGANIZATION, INITIAL_BRANCHES } from '../../data/seedData';
import { Building, MapPin, Factory, Plus } from 'lucide-react';

export const OrganizationsView: React.FC = () => {
  return (
    <div className="space-y-4 text-xs">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Organization, Branch & Plant Hierarchy
          </h2>
          <p className="text-slate-500 mt-0.5">
            Hierarchical multi-branch enterprise governance: Organization → Branches → Plants & Operating Units.
          </p>
        </div>

        <button
          onClick={() => alert('Add Branch/Plant modal: requires Branch Code, Name, Location, and Unit capabilities.')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Branch / Plant
        </button>
      </div>

      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-800">
        <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">Authoritative Organization</div>
        <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
          {INITIAL_ORGANIZATION.name}
          <span className="text-xs bg-blue-900/80 text-cyan-300 font-mono px-2 py-0.5 rounded border border-cyan-500/30">
            {INITIAL_ORGANIZATION.code}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INITIAL_BRANCHES.map((br) => (
          <div key={br.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                  {br.name}
                </div>
                <div className="text-[11px] text-slate-500">{br.city}, {br.state}</div>
              </div>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {br.code}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-2 space-y-1.5">
              <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                <Factory className="w-3.5 h-3.5 text-slate-400" />
                Operating Plants & Units ({br.plants.length}):
              </div>
              {br.plants.map((plt) => (
                <div key={plt.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                  <span className="font-medium text-slate-800">{plt.name}</span>
                  <span className="font-mono text-slate-500 font-bold">{plt.code}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
