import React from 'react';
import { useSimulationStore } from '../store/simulationStore';

export const Minimap: React.FC = () => {
  const amrs = useSimulationStore((state) => state.amrs);
  const machines = useSimulationStore((state) => state.machines);
  const selectedObject = useSimulationStore((state) => state.selectedObject);

  return (
    <div className="absolute bottom-4 left-4 w-40 h-28 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg p-2 z-10 font-mono text-[9px] shadow-2xl select-none">
      <div className="text-slate-400 font-bold uppercase tracking-wider text-[8px] mb-1 flex justify-between items-center">
        <span>CELL MINIMAP</span>
        <span className="text-cyan-400">2D RADAR</span>
      </div>

      <div className="w-full h-20 bg-slate-900 border border-slate-800/80 rounded relative overflow-hidden">
        {/* Supermarket Zone */}
        <div className="absolute left-1 top-2 w-7 h-14 border border-blue-500/40 bg-blue-950/30 rounded text-[7px] text-blue-400 p-0.5">
          SUP
        </div>

        {/* Assembly Line Machines */}
        {machines.map((m, i) => (
          <div
            key={m.id}
            className={`absolute w-3 h-3 rounded-xs text-[6px] font-bold flex items-center justify-center border ${
              selectedObject.type === 'MACHINE' && selectedObject.id === m.id
                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                : 'bg-emerald-950 text-emerald-300 border-emerald-700'
            }`}
            style={{
              left: `${35 + i * 11}%`,
              top: '25%'
            }}
          >
            A{i + 1}
          </div>
        ))}

        {/* Active AMRs */}
        {amrs.filter((a) => a.isActive).map((a, i) => (
          <div
            key={a.id}
            className="absolute w-2 h-2 rounded-full bg-amber-400 animate-pulse border border-slate-950"
            style={{
              left: `${20 + i * 14}%`,
              top: `${50 + (i % 2) * 15}%`
            }}
            title={a.id}
          />
        ))}

        {/* Finished Goods Zone */}
        <div className="absolute right-1 bottom-1 w-6 h-7 border border-emerald-500/40 bg-emerald-950/30 rounded text-[7px] text-emerald-400 p-0.5">
          OUT
        </div>
      </div>
    </div>
  );
};
