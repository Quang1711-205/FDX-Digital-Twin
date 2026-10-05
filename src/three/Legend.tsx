import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export const Legend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="absolute bottom-4 right-4 z-10 font-mono text-[10px] select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/90 backdrop-blur-md border border-slate-800 text-slate-300 font-bold hover:bg-slate-900 transition-colors shadow-xl"
      >
        <Info className="w-3.5 h-3.5 text-cyan-400" />
        <span>3D LEGEND</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="mt-1.5 p-2.5 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl space-y-1.5 w-48 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Optimal / Normal Status</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Warning / High Buffer Load</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span>Critical Shortage Risk</span>
          </div>
          <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
            <div className="flex items-center gap-2 text-[9px] text-cyan-300">
              <span className="w-4 h-0.5 bg-cyan-400" />
              <span>Material Transit Flow</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-amber-300">
              <span className="w-4 h-0.5 bg-amber-400" />
              <span>AMR Logistics Route</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-emerald-300">
              <span className="w-4 h-0.5 bg-emerald-400" />
              <span>Assembly Line WIP</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
