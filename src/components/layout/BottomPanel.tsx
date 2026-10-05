import React, { useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { Sliders, Play, Layers, Package, Truck, History, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const BottomPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'WHAT-IF' | 'PRODUCTION_FLOW' | 'MATERIALS' | 'LOGISTICS' | 'EVENTS'>('WHAT-IF');

  const productionVolumePercent = useSimulationStore((state) => state.productionVolumePercent);
  const setProductionVolume = useSimulationStore((state) => state.setProductionVolume);
  const runWhatIfSimulation = useSimulationStore((state) => state.runWhatIfSimulation);
  const simulationState = useSimulationStore((state) => state.simulationState);
  const metrics = useSimulationStore((state) => state.metrics);
  const eventLog = useSimulationStore((state) => state.eventLog);
  const buffers = useSimulationStore((state) => state.buffers);
  const amrs = useSimulationStore((state) => state.amrs);

  return (
    <footer
      className={`bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 flex flex-col z-30 select-none font-mono text-xs shadow-2xl transition-all duration-300 ${
        isExpanded ? 'h-48' : 'h-9'
      }`}
    >
      {/* Bottom Tabs & Collapse Bar */}
      <div className="h-9 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[
            { id: 'WHAT-IF', label: 'WHAT-IF SIMULATION', icon: Sliders },
            { id: 'PRODUCTION_FLOW', label: 'CELL FLOW', icon: Layers },
            { id: 'MATERIALS', label: 'LINE-SIDE BUFFERS', icon: Package, count: buffers.length },
            { id: 'LOGISTICS', label: 'AMR FLEET', icon: Truck, count: amrs.filter((a) => a.isActive).length },
            { id: 'EVENTS', label: 'EVENT LOG', icon: History, count: eventLog.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`px-3 py-1 rounded-t font-bold transition-all flex items-center gap-1.5 border-t border-x ${
                  isActive
                    ? 'bg-slate-950 text-cyan-400 border-slate-700 shadow-md'
                    : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="ml-1 text-[9px] bg-slate-800 text-slate-300 px-1 py-0.2 rounded">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Collapse / Expand Toggle Button */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400">
            State: <span className="text-emerald-400 font-bold">{simulationState}</span>
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={isExpanded ? 'Collapse Bottom Panel' : 'Expand Bottom Panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Tab Body Content */}
      {isExpanded && (
        <div className="flex-1 p-3 overflow-y-auto">
          {/* ================= WHAT-IF SIMULATION TAB ================= */}
          {activeTab === 'WHAT-IF' && (
            <div className="grid grid-cols-12 gap-4 h-full">
              {/* Left Controls (4 cols) */}
              <div className="col-span-4 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Surge Target Controls</span>
                  </div>

                  <div>
                    <div className="grid grid-cols-5 gap-1 text-[10px] pt-1">
                      {[80, 100, 110, 120, 140].map((vol) => (
                        <button
                          key={vol}
                          onClick={() => setProductionVolume(vol)}
                          className={`py-1 rounded font-bold transition-all border ${
                            productionVolumePercent === vol
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {vol}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={runWhatIfSimulation}
                  disabled={simulationState === 'RUNNING'}
                  className={`w-full py-2 rounded text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                    simulationState === 'RUNNING'
                      ? 'bg-amber-950 text-amber-400 border border-amber-700 animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{simulationState === 'RUNNING' ? 'SIMULATING...' : 'RUN WHAT-IF SIMULATION'}</span>
                </button>
              </div>

              {/* Right Before -> After 3-Step Comparison Cards (8 cols) */}
              <div className="col-span-8 grid grid-cols-3 gap-2 text-[11px]">
                {/* Step 1: Baseline */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">1. BASELINE (100%)</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Output:</span>
                      <span className="text-slate-200 font-bold">100 u/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">AMR Load:</span>
                      <span className="text-emerald-400 font-bold">65%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Buffer Stock:</span>
                      <span className="text-emerald-400 font-bold">80%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shortage Risk:</span>
                      <span className="text-emerald-400 font-bold">8%</span>
                    </div>
                  </div>
                </div>

                {/* Step 2: +20% Surge */}
                <div className={`p-2.5 rounded-lg border space-y-1.5 ${productionVolumePercent >= 120 && simulationState !== 'COMPLETED' ? 'bg-red-950/40 border-red-500' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>2. SURGE (+20%)</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Output:</span>
                      <span className="text-slate-200 font-bold">120 u/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">AMR Load:</span>
                      <span className="text-amber-400 font-bold">82%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Buffer Stock:</span>
                      <span className="text-red-400 font-extrabold">30% (Critical)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shortage Risk:</span>
                      <span className="text-red-400 font-extrabold">31%</span>
                    </div>
                  </div>
                </div>

                {/* Step 3: AI Mitigated */}
                <div className={`p-2.5 rounded-lg border space-y-1.5 ${simulationState === 'COMPLETED' ? 'bg-emerald-950/40 border-emerald-500' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>3. AI MITIGATION</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Output:</span>
                      <span className="text-slate-200 font-bold">120 u/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">AMR Load:</span>
                      <span className="text-cyan-400 font-bold">71%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Buffer Stock:</span>
                      <span className="text-emerald-400 font-bold">78%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shortage Risk:</span>
                      <span className="text-emerald-400 font-extrabold">11%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= PRODUCTION CELL FLOW TAB ================= */}
          {activeTab === 'PRODUCTION_FLOW' && (
            <div className="flex items-center justify-between gap-1.5 h-full text-[10px] overflow-x-auto">
              {[
                { step: 'SUPERMARKET', desc: 'Raw Totes', color: 'border-blue-500/80 bg-blue-950/40 text-blue-300' },
                { step: 'AMR MILKRUN', desc: 'AGV Highway', color: 'border-cyan-500/80 bg-cyan-950/40 text-cyan-300' },
                { step: 'LINE-SIDE BUFFER', desc: 'Line A Racks', color: 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300' },
                { step: 'ASSEMBLY CELL', desc: 'Machine A01 - A03', color: 'border-amber-500/80 bg-amber-950/40 text-amber-300' },
                { step: 'WIP CONVEYOR', desc: 'PCB Transit', color: 'border-slate-600 bg-slate-900/60 text-slate-300' },
                { step: 'QUALITY TEST', desc: 'AOI & EOL Test', color: 'border-purple-500/80 bg-purple-950/40 text-purple-300' },
                { step: 'FINISHED GOODS', desc: 'ECU Outbound', color: 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300' }
              ].map((st, i) => (
                <React.Fragment key={i}>
                  <div className={`flex-1 p-2 rounded border ${st.color} space-y-0.5 min-w-[110px]`}>
                    <div className="font-extrabold text-[9px]">{st.step}</div>
                    <div className="text-[8px] text-slate-400">{st.desc}</div>
                  </div>
                  {i < 6 && <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ================= LINE-SIDE BUFFERS TAB ================= */}
          {activeTab === 'MATERIALS' && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              {buffers.map((b) => (
                <div key={b.id} className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200 text-[11px]">{b.id}</span>
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                        b.currentLevelPercent <= 35
                          ? 'bg-red-950 text-red-300 border-red-500'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">{b.name}</div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>Stock: {b.currentLevelPercent}%</span>
                    <span>Safety: {b.minimumSafetyPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= LOGISTICS TAB ================= */}
          {activeTab === 'LOGISTICS' && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              {amrs.map((a) => (
                <div key={a.id} className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-400 text-[11px]">{a.id}: {a.name}</span>
                    <span
                      className={`text-[9px] font-bold px-1 py-0.2 rounded border ${
                        a.isActive
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {a.isActive ? a.status : 'STANDBY'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">Task: {a.currentTask || 'Charging'}</div>
                  <div className="text-[10px] text-amber-300">Payload: {a.payload || 'Empty'}</div>
                </div>
              ))}
            </div>
          )}

          {/* ================= EVENT LOG TAB ================= */}
          {activeTab === 'EVENTS' && (
            <div className="space-y-1 text-xs">
              {eventLog.map((evt) => (
                <div key={evt.id} className="flex items-center gap-2 p-1 rounded bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 font-bold text-[10px]">{evt.timestamp}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                      evt.type === 'CRITICAL'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : evt.type === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {evt.type}
                  </span>
                  <span className="text-slate-400 text-[9px] uppercase font-bold">[{evt.source}]</span>
                  <span className="text-slate-200 text-[10px] flex-1 truncate">{evt.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </footer>
  );
};
