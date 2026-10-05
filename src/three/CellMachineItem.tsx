import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';
import { CellMachine } from '../types';

interface CellMachineItemProps {
  machine: CellMachine;
  isSelected: boolean;
  onClick: () => void;
}

export const CellMachineItem: React.FC<CellMachineItemProps> = ({
  machine,
  isSelected,
  onClick
}) => {
  const armRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.Mesh>(null);

  const statusColor =
    machine.status === 'RUNNING'
      ? CELL_COLORS.logisticsGreen
      : machine.status === 'WARNING'
      ? CELL_COLORS.warningYellow
      : CELL_COLORS.criticalRed;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (armRef.current) {
      armRef.current.position.y = 1.6 + Math.sin(t * 5) * 0.08;
      armRef.current.rotation.y = Math.sin(t * 2) * 0.4;
    }
  });

  return (
    <group
      position={machine.position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Selection Glow Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[2.0, 2.3, 32]} />
          <meshBasicMaterial color={CELL_COLORS.glowBlue} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Main Machine Enclosure Base */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.0, 2.8]} />
        <meshStandardMaterial
          color={isSelected ? '#1565C0' : CELL_COLORS.metalMedium}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Front Safety Enclosure Window */}
      <mesh position={[0, 1.4, 1.42]}>
        <boxGeometry args={[2.6, 1.1, 0.05]} />
        <meshStandardMaterial
          color={CELL_COLORS.productionCyan}
          transparent
          opacity={0.35}
          metalness={0.9}
        />
      </mesh>

      {/* Internal Robotic Assembly Tool */}
      <group ref={armRef} position={[0, 1.6, 0]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 0.7]} />
          <meshStandardMaterial color={CELL_COLORS.industrialOrange} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.35, 0.2]}>
          <boxGeometry args={[0.25, 0.12, 0.5]} />
          <meshStandardMaterial color={CELL_COLORS.metalDark} />
        </mesh>
      </group>

      {/* Status Tower Light */}
      <group position={[1.4, 2.2, 1.2]}>
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.4]} />
          <meshStandardMaterial color={CELL_COLORS.metalDark} />
        </mesh>
        <mesh ref={lightRef} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.22]} />
          <meshBasicMaterial color={statusColor} />
        </mesh>
      </group>

      {/* Control Panel Touchscreen */}
      <mesh position={[-1.3, 1.4, 1.45]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[0.5, 0.6, 0.06]} />
        <meshStandardMaterial color="#040D1A" />
      </mesh>
      <mesh position={[-1.3, 1.4, 1.49]} rotation={[0, -0.15, 0]}>
        <planeGeometry args={[0.42, 0.52]} />
        <meshBasicMaterial color={CELL_COLORS.productionCyan} />
      </mesh>

      {/* Floating 3D Machine Label */}
      <Html position={[0, 2.6, 0]} center distanceFactor={25}>
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow-lg cursor-pointer border transition-transform hover:scale-105 ${
            isSelected
              ? 'bg-cyan-950 text-cyan-300 border-cyan-400 scale-110'
              : 'bg-slate-900/90 text-slate-200 border-slate-700'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          {machine.id}: {machine.processType}
        </div>
      </Html>
    </group>
  );
};
