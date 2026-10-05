import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { Layers, ArrowRight, Truck, Package } from 'lucide-react';

export const LogisticsFlowView: React.FC = () => {
  const amrs = useSimulationStore((state) => state.amrs);

  return (
    <div className="w-full h-full bg-slate-950 p-6 flex flex-col gap-5 font-mono select-none overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
          <Truck className="w-5 h-5 text-cyan-400" />
          <span>PRODUCTION CELL LOGISTICS MILKRUN FLOW</span>
        </div>
        <span className="text-xs text-slate-400">Automotive ECU Assembly Logistics</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {amrs.map((a) => (
          <div key={a.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-cyan-400">{a.id}: {a.name}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${a.isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                {a.isActive ? a.status : 'STANDBY'}
              </span>
            </div>
            <div className="text-slate-300">Route: {a.assignedRoute}</div>
            <div className="text-amber-300">Payload: {a.payload || 'Empty'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
