import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';
import { useSimulationStore } from '../store/simulationStore';

export const LineSideBuffer: React.FC = () => {
  const mat004BufferPercent = useSimulationStore((state) => state.mat004BufferPercent);
  const simulationState = useSimulationStore((state) => state.simulationState);
  const setSelectedObject = useSimulationStore((state) => state.setSelectedObject);

  const riskBeaconRef = useRef<THREE.Group>(null);

  const isCritical = mat004BufferPercent <= 35;
  const isWarning = mat004BufferPercent > 35 && mat004BufferPercent <= 60;

  const mat004Color = isCritical
    ? CELL_COLORS.criticalRed
    : isWarning
    ? CELL_COLORS.warningYellow
    : CELL_COLORS.logisticsGreen;

  useFrame((state) => {
    if (riskBeaconRef.current && (isCritical || isWarning)) {
      const t = state.clock.getElapsedTime();
      riskBeaconRef.current.position.y = 3.2 + Math.sin(t * 5) * 0.25;
      riskBeaconRef.current.rotation.y += 0.03;
    }
  });

  return (
    <group position={[4, 0, -1.8]}>
      {/* Buffer Zone Title */}
      <Html position={[0, 3.8, 0]} center distanceFactor={26}>
        <div className="px-2 py-0.5 rounded bg-slate-950/90 border border-emerald-500/80 text-emerald-300 font-mono text-[10px] font-bold tracking-wider shadow-lg flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          LINE-SIDE SUPERMARKET (LINE A BUFFER)
        </div>
      </Html>

      {/* Racks & Visible Inventory Totes */}
      <group position={[0, 0, 0]}>
        {/* Rack Stand Base */}
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[14, 0.15, 1.2]} />
          <meshStandardMaterial color={CELL_COLORS.metalMedium} metalness={0.7} />
        </mesh>

        {/* Individual Material Buffer Bins */}
        {[
          { id: 'MAT-001', name: 'MAT-001 Housing', level: 85, x: -5, color: CELL_COLORS.productionBlue },
          { id: 'MAT-002', name: 'MAT-002 PCB', level: 80, x: -1.8, color: CELL_COLORS.productionCyan },
          { id: 'MAT-004', name: 'MAT-004 MOSFET', level: mat004BufferPercent, x: 1.8, color: mat004Color },
          { id: 'MAT-005', name: 'MAT-005 Sealant', level: 90, x: 5, color: CELL_COLORS.logisticsGreen }
        ].map((item) => (
          <group
            key={item.id}
            position={[item.x, 0.5, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedObject({
                type: 'BUFFER',
                id: item.id,
                title: `Line-Side Buffer: ${item.name}`,
                data: {
                  material: item.name,
                  levelPercent: `${item.level}%`,
                  assignedMachine: 'Machine A02',
                  status: item.level <= 35 ? 'CRITICAL STARVATION RISK' : 'NORMAL'
                }
              });
            }}
          >
            {/* Tote Bin Box */}
            <mesh position={[0, 0.3, 0]}>
              <boxGeometry args={[1.6, 0.45, 0.9]} />
              <meshStandardMaterial color={item.color} roughness={0.3} />
            </mesh>

            {/* Glowing 3D Inventory Bar Indicator */}
            <group position={[0, 0.7, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.6, 0.1, 0.15]} />
                <meshStandardMaterial color={CELL_COLORS.metalDark} />
              </mesh>
              <mesh position={[(item.level / 100 - 1) * 0.8, 0, 0.02]}>
                <boxGeometry args={[(item.level / 100) * 1.58, 0.12, 0.16]} />
                <meshBasicMaterial color={item.color} />
              </mesh>
            </group>

            {/* 3D Label Tag */}
            <Html position={[0, 1.1, 0]} center distanceFactor={22}>
              <div
                className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold flex items-center gap-1 border shadow-md ${
                  item.level <= 35
                    ? 'bg-red-950 text-red-200 border-red-500 animate-bounce'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                <span>{item.id}</span>
                <span className="font-bold">{item.level}%</span>
              </div>
            </Html>
          </group>
        ))}
      </group>

      {/* Floating 3D Risk Beacon (Visible when MAT-004 is Critical or Warning!) */}
      {(isCritical || isWarning) && (
        <group ref={riskBeaconRef} position={[1.8, 3.2, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.7, 1.4, 16]} />
            <meshBasicMaterial color={mat004Color} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>

          {/* Floating Callout Card */}
          <Html position={[0, 2.0, 0]} center distanceFactor={22}>
            <div className="px-3 py-1.5 rounded-lg bg-red-950/95 border-2 border-red-500 text-red-200 font-mono text-xs font-black flex items-center gap-2 shadow-2xl animate-bounce">
              <span className="text-base">⚠</span>
              <div>
                <div className="text-[9px] uppercase tracking-wider opacity-80">Predictive Risk Alert</div>
                <div>MAT-004 SHORTAGE ({mat004BufferPercent}%)</div>
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
