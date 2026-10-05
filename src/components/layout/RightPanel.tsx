import React from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { Bot, Zap, ArrowRight, CheckCircle2, ShieldAlert, Cpu, Activity, Video } from 'lucide-react';

export const RightPanel: React.FC = () => {
  const selectedObject = useSimulationStore((state) => state.selectedObject);
  const simulationState = useSimulationStore((state) => state.simulationState);
  const simulationStepText = useSimulationStore((state) => state.simulationStepText);
  const activeRecommendation = useSimulationStore((state) => state.activeRecommendation);
  const applyRecommendation = useSimulationStore((state) => state.applyRecommendation);
  const productionVolumePercent = useSimulationStore((state) => state.productionVolumePercent);

  return (
    <aside className="w-72 bg-slate-950/90 backdrop-blur-md border-l border-slate-800 p-3 flex flex-col gap-3 z-20 overflow-y-auto select-none font-mono text-xs shadow-2xl">
      {/* Dynamic Telemetry / Selected Object Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
          <span className="text-cyan-400 font-bold flex items-center gap-1.5 uppercase text-[11px]">
            <Cpu className="w-3.5 h-3.5" />
            {selectedObject.type ? selectedObject.title : 'PREDICTIVE STATUS'}
          </span>
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
            {selectedObject.type || simulationState}
          </span>
        </div>

        {selectedObject.type === 'AMR' && selectedObject.data && (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Status</span>
              <span className="text-emerald-400 font-bold">{selectedObject.data.status}</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Current Task</span>
              <span className="text-amber-300 font-bold truncate max-w-[120px]">
                {selectedObject.data.currentTask || 'Idle'}
              </span>
            </div>
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Payload</span>
              <span className="text-cyan-300 font-bold">{selectedObject.data.payload || 'None'}</span>
            </div>
          </div>
        )}

        {selectedObject.type === 'MACHINE' && selectedObject.data && (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Process</span>
              <span className="text-cyan-300 font-bold">{selectedObject.data.processType}</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Cycle Time</span>
              <span className="text-slate-200 font-bold">{selectedObject.data.cycleTimeSec} sec</span>
            </div>
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Material Input</span>
              <span className="text-amber-300 font-bold truncate max-w-[110px]">
                {selectedObject.data.requiredMaterial}
              </span>
            </div>
          </div>
        )}

        {!selectedObject.type && (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between bg-slate-950 p-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Scenario Target</span>
              <span className="text-amber-400 font-bold">{productionVolumePercent}% Volume</span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 text-[10px] leading-relaxed">
              {simulationStepText}
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendation Card */}
      {activeRecommendation && (
        <div className="bg-amber-950/40 border border-amber-500/80 rounded-lg p-3 shadow-xl space-y-2">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase text-[11px]">
            <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>AI Predictive Action Plan</span>
          </div>

          <div className="text-xs font-bold text-slate-100">{activeRecommendation.title}</div>

          <div className="text-[10px] text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800 leading-relaxed">
            {activeRecommendation.description}
          </div>

          <ul className="space-y-1 text-[10px] text-slate-300 pl-3 list-disc">
            {activeRecommendation.actions.map((act, i) => (
              <li key={i}>{act}</li>
            ))}
          </ul>

          <button
            onClick={applyRecommendation}
            disabled={simulationState === 'APPLYING' || simulationState === 'COMPLETED'}
            className={`w-full py-2 px-3 rounded font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
              simulationState === 'COMPLETED'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/80 opacity-90 cursor-not-allowed text-[10px]'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs shadow-amber-500/20 active:scale-95'
            }`}
          >
            {simulationState === 'COMPLETED' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Recommendation Executed</span>
              </>
            ) : (
              <>
                <span>Apply AI Plan in 3D Scene</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Optical Sensor Camera Feed */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 shadow-lg flex-1">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
          <span className="text-slate-300 font-bold flex items-center gap-1.5 uppercase text-[10px]">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            CAM-02 (Machine A02 Buffer)
          </span>
          <span className="text-[9px] text-red-400 font-bold bg-red-950/60 px-1 py-0.2 rounded border border-red-800">
            REC
          </span>
        </div>

        <div className="relative aspect-video bg-slate-950 rounded border border-slate-800 overflow-hidden flex items-center justify-center text-[10px] text-cyan-400 text-center p-2">
          <div className="space-y-0.5 z-10">
            <div className="font-extrabold">LINE A BUFFER SENSOR</div>
            <div className="text-slate-500 text-[9px]">ECU ASSEMBLY CELL - ZONE C</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
