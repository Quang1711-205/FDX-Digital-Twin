import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { ViewMode } from '../../types';
import { Layers, Sliders, Activity, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const viewMode = useSimulationStore((state) => state.viewMode);
  const setViewMode = useSimulationStore((state) => state.setViewMode);
  const productionVolumePercent = useSimulationStore((state) => state.productionVolumePercent);
  const simulationState = useSimulationStore((state) => state.simulationState);
  const resetDemo = useSimulationStore((state) => state.resetDemo);
  const metrics = useSimulationStore((state) => state.metrics);

  const navItems: ViewMode[] = ['3D CELL VIEW', 'LOGISTICS FLOW', 'PREDICTIVE', 'WHAT-IF'];

  return (
    <header className="h-13 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 px-4 flex items-center justify-between z-30 select-none shadow-xl font-mono">
      {/* Title Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-black text-base tracking-wider">
          <span className="text-red-500 font-extrabold text-lg">DENSO</span>
          <span className="text-slate-600 font-light">|</span>
          <span className="text-slate-100 font-bold text-xs tracking-widest uppercase">
            Predictive Logistics Digital Twin
          </span>
          <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-[9px] font-extrabold ml-1">
            ECU CELL
          </span>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-bold">LIVE</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300">Shift A</span>
        </div>
      </div>

      {/* Center Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
        {navItems.map((item) => {
          const isActive = viewMode === item;
          return (
            <button
              key={item}
              onClick={() => setViewMode(item)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {item === '3D CELL VIEW' && <Layers className="w-3.5 h-3.5" />}
              {item === 'WHAT-IF' && <Sliders className="w-3.5 h-3.5 text-amber-400" />}
              {item === 'PREDICTIVE' && <Activity className="w-3.5 h-3.5" />}
              {item}
            </button>
          );
        })}
      </div>

      {/* Right Metrics & Reset */}
      <div className="flex items-center gap-3">
        <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded text-xs">
          <span className="text-slate-400">Target Volume: </span>
          <span
            className={`font-bold ${
              productionVolumePercent > 100 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {productionVolumePercent}% ({metrics.productionRate} u/h)
          </span>
        </div>

        <div
          className={`px-2.5 py-1 rounded text-xs font-bold border ${
            metrics.shortageRiskPercent > 20
              ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
              : 'bg-emerald-950 text-emerald-300 border-emerald-800'
          }`}
        >
          SHORTAGE RISK: {metrics.shortageRiskPercent}%
        </div>

        <button
          onClick={resetDemo}
          title="Reset Demo Scenario"
          className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
