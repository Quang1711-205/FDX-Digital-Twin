import React from 'react';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';

export const CellFloor: React.FC = () => {
  return (
    <group position={[0, -0.01, 0]}>
      {/* Industrial Charcoal Base Floor Surface */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[4, 0, 0]}>
        <planeGeometry args={[56, 36]} />
        <meshStandardMaterial
          color={CELL_COLORS.floorCharcoal}
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      {/* Subtle Grid Overlay */}
      <gridHelper
        args={[56, 28, CELL_COLORS.floorGrid, CELL_COLORS.floorGrid]}
        position={[4, 0.01, 0]}
      />

      {/* Material Supermarket Floor Zone (Left: [-18 to -10]) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-14, 0.02, 5]}>
        <planeGeometry args={[12, 18]} />
        <meshBasicMaterial color="#1E293B" opacity={0.6} transparent />
      </mesh>
      <lineSegments position={[-14, 0.03, 5]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(12, 18)]} />
        <lineBasicMaterial color={CELL_COLORS.productionCyan} linewidth={2} />
      </lineSegments>

      {/* AMR Logistics Lane Highway (Center Belt Z: 0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.03, 0]}>
        <planeGeometry args={[52, 3.2]} />
        <meshStandardMaterial color="#0F172A" roughness={0.4} />
      </mesh>

      {/* Lane Edge Glow Lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.04, -1.6]}>
        <planeGeometry args={[52, 0.1]} />
        <meshBasicMaterial color={CELL_COLORS.logisticsGreen} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.04, 1.6]}>
        <planeGeometry args={[52, 0.1]} />
        <meshBasicMaterial color={CELL_COLORS.logisticsGreen} />
      </mesh>

      {/* AMR Charging Hub Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.03, -12]}>
        <planeGeometry args={[3.8, 3.8]} />
        <meshBasicMaterial color="#0284C7" opacity={0.4} transparent />
      </mesh>
      <lineSegments position={[-12, 0.04, -12]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(3.8, 3.8)]} />
        <lineBasicMaterial color={CELL_COLORS.glowBlue} linewidth={2} />
      </lineSegments>

      {/* Assembly Machines Safety Zone Stripe Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.025, -6]}>
        <planeGeometry args={[32.4, 9.4]} />
        <meshStandardMaterial color={CELL_COLORS.hazardYellow} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0.03, -6]}>
        <planeGeometry args={[32, 9]} />
        <meshStandardMaterial color="#0F172A" />
      </mesh>

      {/* Line-Side Buffer Markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, 0.03, -1.8]}>
        <planeGeometry args={[18, 2.2]} />
        <meshBasicMaterial color="#064E3B" opacity={0.5} transparent />
      </mesh>

      {/* Finished Goods Staging Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[24, 0.03, 8]}>
        <planeGeometry args={[11, 9]} />
        <meshBasicMaterial color="#064E3B" opacity={0.5} transparent />
      </mesh>
    </group>
  );
};
