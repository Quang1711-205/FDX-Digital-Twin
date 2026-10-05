import React from 'react';
import { Html } from '@react-three/drei';
import { CELL_COLORS } from './sceneConfig';
import { useSimulationStore } from '../store/simulationStore';

export const MaterialSupermarket: React.FC = () => {
  const setSelectedObject = useSimulationStore((state) => state.setSelectedObject);

  const racks = [
    { id: 'SUPERMARKET-RACK-1', pos: [-18, 0, 8] as [number, number, number], label: 'MAT-001 (ECU Housing)', color: '#1E88E5' },
    { id: 'SUPERMARKET-RACK-2', pos: [-14, 0, 8] as [number, number, number], label: 'MAT-002 (PCB Substrate)', color: '#00AEEF' },
    { id: 'SUPERMARKET-RACK-3', pos: [-18, 0, 3] as [number, number, number], label: 'MAT-004 (MOSFET Connector)', color: '#FF7A00' },
    { id: 'SUPERMARKET-RACK-4', pos: [-14, 0, 3] as [number, number, number], label: 'MAT-005 (Sealant Gasket)', color: '#00D084' }
  ];

  return (
    <group>
      {/* Supermarket Title Floating Badge */}
      <Html position={[-16, 4.5, 6]} center distanceFactor={28}>
        <div className="px-2.5 py-1 rounded bg-blue-950/90 border border-blue-500/80 text-blue-300 font-mono text-[11px] font-extrabold shadow-xl flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          MATERIAL SUPERMARKET
        </div>
      </Html>

      {racks.map((r) => (
        <group
          key={r.id}
          position={r.pos}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedObject({
              type: 'SUPERMARKET',
              id: r.id,
              title: `Material Supermarket: ${r.label}`,
              data: {
                location: 'Zone A Supermarket',
                material: r.label,
                capacity: '48 Totes',
                status: 'Stock Optimal'
              }
            });
          }}
        >
          {/* Metal Shelf Posts */}
          {[-1.2, 1.2].map((x, xi) =>
            [-0.6, 0.6].map((z, zi) => (
              <mesh key={`post-${xi}-${zi}`} position={[x, 1.2, z]}>
                <boxGeometry args={[0.1, 2.4, 0.1]} />
                <meshStandardMaterial color={CELL_COLORS.metalMedium} metalness={0.8} />
              </mesh>
            ))
          )}

          {/* Shelves */}
          {[0.6, 1.4, 2.2].map((y, level) => (
            <group key={`level-${level}`}>
              <mesh position={[0, y, 0]}>
                <boxGeometry args={[2.5, 0.08, 1.3]} />
                <meshStandardMaterial color={CELL_COLORS.metalLight} />
              </mesh>
              {/* Stacked Totes */}
              {[-0.8, 0, 0.8].map((tx, ti) => (
                <group key={`tote-${level}-${ti}`} position={[tx, y + 0.2, 0]}>
                  <mesh>
                    <boxGeometry args={[0.65, 0.32, 0.9]} />
                    <meshStandardMaterial color={r.color} roughness={0.3} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};
