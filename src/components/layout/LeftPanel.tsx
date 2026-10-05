import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { Cpu, Bot, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';

export const LeftPanel: React.FC = () => {
  const metrics = useSimulationStore((state) => state.metrics);
  const productionVolumePercent = useSimulationStore((state) => state.productionVolumePercent);
  const mat004BufferPercent = useSimulationStore((state) => state.mat004BufferPercent);
  const amrs = useSimulationStore((state) => state.amrs);
  const activeAmrs = amrs.filter((a) => a.isActive).length;

  return (
    <aside className="w-60 bg-slate-950/90 backdrop-blur-md border-r border-slate-800 p-3 flex flex-col gap-3 z-20 overflow-y-auto select-none font-mono text-xs shadow-2xl">
      {/* Production Rate Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-cyan-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Cpu className="w-3.5 h-3.5" /> Cell Output
          </span>
          <span className="text-slate-400 text-[10px]">{productionVolumePercent}% Vol</span>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-2xl font-black text-white">{metrics.productionRate}</span>
          <span className="text-slate-400 text-[10px]">units/hour</span>
        </div>
      </div>

      {/* Line-Side Buffer Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-emerald-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Activity className="w-3.5 h-3.5" /> Line A Buffer
          </span>
          <span
            className={`font-bold text-[10px] px-1.5 py-0.2 rounded border ${
              mat004BufferPercent <= 35
                ? 'bg-red-950 text-red-300 border-red-500'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            MAT-004
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">Buffer Stock</span>
            <span className={`font-bold ${mat004BufferPercent <= 35 ? 'text-red-400' : 'text-emerald-400'}`}>
              {mat004BufferPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                mat004BufferPercent <= 35
                  ? 'bg-red-500 shadow-md shadow-red-500/50'
                  : mat004BufferPercent <= 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${mat004BufferPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* AMR Fleet Load Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-amber-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Bot className="w-3.5 h-3.5" /> AMR Fleet Load
          </span>
          <span className="text-slate-300 font-extrabold">{activeAmrs} Active</span>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-slate-400">AGV Utilization</span>
            <span className={`font-bold ${metrics.amrUtilizationPercent > 80 ? 'text-amber-400' : 'text-slate-200'}`}>
              {metrics.amrUtilizationPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.amrUtilizationPercent > 80 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${metrics.amrUtilizationPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Shortage Risk Pill */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
          {metrics.shortageRiskPercent > 20 ? (
            <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <span>Line Starvation Risk</span>
        </div>
        <div className="pt-1 flex items-baseline justify-between">
          <span
            className={`text-xl font-extrabold ${
              metrics.shortageRiskPercent > 20 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {metrics.shortageRiskPercent}%
          </span>
          <span className="text-[10px] text-slate-400">
            {metrics.downtimeMinutesPerHour > 0 ? `${metrics.downtimeMinutesPerHour}m downtime/h` : 'Nominal'}
          </span>
        </div>
      </div>
    </aside>
  );
};
