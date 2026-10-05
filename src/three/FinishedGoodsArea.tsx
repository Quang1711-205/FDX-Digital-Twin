import React from 'react';
import { Html } from '@react-three/drei';
import { CELL_COLORS } from './sceneConfig';

export const FinishedGoodsArea: React.FC = () => {
  return (
    <group position={[24, 0, 8]}>
      <Html position={[0, 3.5, 0]} center distanceFactor={26}>
        <div className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 font-mono text-[10px] font-extrabold shadow-xl flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          FINISHED GOODS & OUTBOUND STAGING
        </div>
      </Html>

      {/* Finished Pallets */}
      {[-3, 0, 3].map((x, i) =>
        [-2, 2].map((z, j) => (
          <group key={`pallet-${i}-${j}`} position={[x, 0.3, z]}>
            {/* Wooden Pallet */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.6, 0.16, 1.6]} />
              <meshStandardMaterial color="#5D4037" />
            </mesh>
            {/* Packed ECU Containers */}
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[1.4, 0.8, 1.4]} />
              <meshStandardMaterial color={CELL_COLORS.productionBlue} metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0.71, 0.5, 0]}>
              <planeGeometry args={[0.02, 0.3]} />
              <meshBasicMaterial color="#00F0FF" />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
};
