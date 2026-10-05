import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';
import { AMRResource } from '../types';

interface AMRRobotProps {
  amr: AMRResource;
  waypoints: [number, number, number][];
  isSelected: boolean;
  onClick: () => void;
}

export const AMRRobot: React.FC<AMRRobotProps> = ({
  amr,
  waypoints,
  isSelected,
  onClick
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const currentWaypointIdx = useRef(0);
  const progress = useRef(0);

  const statusColor =
    amr.status === 'MOVING'
      ? CELL_COLORS.logisticsGreen
      : amr.status === 'LOADING' || amr.status === 'UNLOADING'
      ? CELL_COLORS.warningYellow
      : amr.status === 'ERROR'
      ? CELL_COLORS.criticalRed
      : CELL_COLORS.productionCyan;

  useFrame((_, delta) => {
    if (!groupRef.current || waypoints.length < 2) return;

    const moveSpeed = (amr.speed || 1.5) * 0.4;
    const currentPoint = waypoints[currentWaypointIdx.current];
    const nextIdx = (currentWaypointIdx.current + 1) % waypoints.length;
    const nextPoint = waypoints[nextIdx];

    const dx = nextPoint[0] - currentPoint[0];
    const dz = nextPoint[2] - currentPoint[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.01) {
      progress.current += (delta * moveSpeed) / dist;

      if (progress.current >= 1) {
        progress.current = 0;
        currentWaypointIdx.current = nextIdx;
      } else {
        const curX = currentPoint[0] + dx * progress.current;
        const curZ = currentPoint[2] + dz * progress.current;
        groupRef.current.position.set(curX, 0.25, curZ);

        const targetAngle = Math.atan2(dx, dz);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          targetAngle,
          0.1
        );
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={amr.currentPosition}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color={CELL_COLORS.glowBlue} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Main AMR Metallic Body Chassis */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.4, 0.4, 1.8]} />
        <meshStandardMaterial
          color={isSelected ? '#1565C0' : CELL_COLORS.metalMedium}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Beveled Side Bumper */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.5, 0.15, 1.9]} />
        <meshStandardMaterial color={CELL_COLORS.metalDark} />
      </mesh>

      {/* Status LED Perimeter Ring */}
      <mesh ref={ringRef} position={[0, 0.42, 0]}>
        <boxGeometry args={[1.42, 0.06, 1.82]} />
        <meshBasicMaterial color={statusColor} transparent opacity={0.9} />
      </mesh>

      {/* Top Payload Lift Table */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 24]} />
        <meshStandardMaterial color={CELL_COLORS.industrialOrange} metalness={0.6} />
      </mesh>

      {/* Carried Payload Tote */}
      {amr.payload && (
        <group position={[0, 0.8, 0]}>
          <mesh>
            <boxGeometry args={[0.9, 0.5, 0.9]} />
            <meshStandardMaterial color={CELL_COLORS.productionBlue} roughness={0.3} />
          </mesh>
          <mesh position={[0.46, 0, 0]}>
            <planeGeometry args={[0.02, 0.3]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
        </group>
      )}

      {/* Floating 3D AMR Label */}
      <Html position={[0, amr.payload ? 1.6 : 1.1, 0]} center distanceFactor={25}>
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow-lg cursor-pointer transition-all border ${
            isSelected
              ? 'bg-cyan-950 text-cyan-300 border-cyan-400 scale-110'
              : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:border-cyan-500'
          }`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: statusColor }}
          />
          {amr.id}
          {amr.payload && <span className="text-amber-400">📦</span>}
        </div>
      </Html>
    </group>
  );
};
