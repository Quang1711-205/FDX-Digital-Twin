import React from 'react';
import { Html } from '@react-three/drei';

export const FactoryLabels: React.FC = () => {
  const zones = [
    { label: 'ZONE A — RAW MATERIAL', pos: [-24, 4.5, -8] as [number, number, number], color: 'border-blue-500/60 bg-blue-950/80 text-blue-300' },
    { label: 'ZONE B — STORAGE', pos: [-12, 5.5, 0] as [number, number, number], color: 'border-cyan-500/60 bg-cyan-950/80 text-cyan-300' },
    { label: 'ZONE C — ASSEMBLY', pos: [14, 5.5, -6] as [number, number, number], color: 'border-amber-500/60 bg-amber-950/80 text-amber-300' },
    { label: 'ZONE D — STAGING', pos: [18, 4.5, 10] as [number, number, number], color: 'border-emerald-500/60 bg-emerald-950/80 text-emerald-300' },
    { label: 'ZONE E — OUTBOUND', pos: [-26, 4.5, 6] as [number, number, number], color: 'border-slate-500/60 bg-slate-900/80 text-slate-300' }
  ];

  return (
    <group>
      {zones.map((z, i) => (
        <Html key={`zone-label-${i}`} position={z.pos} center distanceFactor={32}>
          <div className={`px-2.5 py-1 rounded border text-[11px] font-mono font-bold tracking-wider backdrop-blur-md shadow-xl flex items-center gap-1.5 ${z.color}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            {z.label}
          </div>
        </Html>
      ))}
    </group>
  );
};
