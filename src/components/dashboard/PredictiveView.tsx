import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useSimulationStore } from '../../store/simulationStore';
import { Activity } from 'lucide-react';

export const PredictiveView: React.FC = () => {
  const metrics = useSimulationStore((state) => state.metrics);
  const productionVolumePercent = useSimulationStore((state) => state.productionVolumePercent);

  const forecastData = [
    { time: '08:00', demand: 100, amrLoad: 65, risk: 8 },
    { time: '08:15', demand: 105, amrLoad: 68, risk: 10 },
    { time: '08:30', demand: 110, amrLoad: 72, risk: 14 },
    { time: '08:45 (NOW)', demand: productionVolumePercent, amrLoad: metrics.amrUtilizationPercent, risk: metrics.shortageRiskPercent },
    { time: '09:00', demand: productionVolumePercent, amrLoad: Math.min(99, metrics.amrUtilizationPercent + 4), risk: Math.min(99, metrics.shortageRiskPercent + 6) },
    { time: '09:15', demand: productionVolumePercent, amrLoad: metrics.amrUtilizationPercent, risk: metrics.shortageRiskPercent }
  ];

  return (
    <div className="w-full h-full bg-slate-950 p-6 flex flex-col gap-5 overflow-y-auto font-mono select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h1 className="text-base font-bold text-slate-100 uppercase tracking-wider">
            Predictive Cell Analytics & Shortage Forecast
          </h1>
        </div>
        <div className="text-xs text-amber-400 font-bold">
          Target: {productionVolumePercent}% Volume ({metrics.productionRate} units/h)
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748B" tick={{ fontSize: 11 }} domain={[0, 140]} />
            <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: '11px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="demand" stroke="#00AEEF" strokeWidth={2.5} name="Material Demand %" />
            <Line type="monotone" dataKey="amrLoad" stroke="#FF7A00" strokeWidth={2} name="AGV Load %" />
            <Line type="monotone" dataKey="risk" stroke="#FF4D4F" strokeWidth={2.5} name="Shortage Risk %" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
