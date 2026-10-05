import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';

interface FlowOverlayProps {
  visible: boolean;
  hasRisk: boolean;
}

export const FlowOverlay: React.FC<FlowOverlayProps> = ({ visible, hasRisk }) => {
  const partGroupRef = useRef<THREE.Group>(null);

  // Material Flow Curve (Supermarket -> Line-side Buffer)
  const matCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-16, 0.15, 6),
    new THREE.Vector3(-16, 0.15, 0),
    new THREE.Vector3(4, 0.15, 0),
    new THREE.Vector3(4, 0.15, -1.8)
  ]);

  // Production Flow Curve (Machines A01 -> A05 -> Finished Goods)
  const prodCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4, 0.15, -6),
    new THREE.Vector3(4, 0.15, -6),
    new THREE.Vector3(12, 0.15, -6),
    new THREE.Vector3(20, 0.15, -6),
    new THREE.Vector3(24, 0.15, 2),
    new THREE.Vector3(24, 0.15, 8)
  ]);

  useFrame((state) => {
    if (partGroupRef.current && visible) {
      const t = state.clock.getElapsedTime() * 0.5;
      partGroupRef.current.children.forEach((child, i) => {
        const progress = (t + i * 0.2) % 1;
        const curve = i < 4 ? matCurve : prodCurve;
        const pos = curve.getPoint(progress);
        child.position.copy(pos);
      });
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Material Flow Tube */}
      <mesh>
        <tubeGeometry args={[matCurve, 48, 0.08, 8, false]} />
        <meshBasicMaterial color={CELL_COLORS.productionCyan} transparent opacity={0.65} />
      </mesh>

      {/* Production Flow Tube */}
      <mesh>
        <tubeGeometry args={[prodCurve, 64, 0.08, 8, false]} />
        <meshBasicMaterial
          color={hasRisk ? CELL_COLORS.criticalRed : CELL_COLORS.logisticsGreen}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Animated Moving Particles */}
      <group ref={partGroupRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`flow-particle-${i}`}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshBasicMaterial
              color={i < 4 ? CELL_COLORS.glowBlue : CELL_COLORS.logisticsGreen}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};
