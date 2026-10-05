import React from 'react';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';

export const CellIndustrialDetails: React.FC = () => {
  return (
    <group>
      {/* Overhead Structural Pillars */}
      {[-24, 0, 24].map((x, i) =>
        [-16, 16].map((z, j) => (
          <mesh key={`pillar-${i}-${j}`} position={[x, 8, z]}>
            <boxGeometry args={[0.8, 16, 0.8]} />
            <meshStandardMaterial color={CELL_COLORS.metalMedium} metalness={0.7} />
          </mesh>
        ))
      )}

      {/* Overhead Lighting Trusses */}
      {[-12, 12].map((x, i) => (
        <group key={`truss-${i}`} position={[x, 14, 0]}>
          <mesh>
            <boxGeometry args={[0.4, 0.4, 36]} />
            <meshStandardMaterial color={CELL_COLORS.metalLight} />
          </mesh>
          {/* Overhead Fluorescent Light Strips */}
          {[-12, -4, 4, 12].map((z, j) => (
            <mesh key={`light-${j}`} position={[0, -0.3, z]}>
              <boxGeometry args={[0.6, 0.1, 3.5]} />
              <meshBasicMaterial color="#E0F7FA" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Machine Safety Fencing Wire Mesh Boundaries */}
      <group position={[10, 1.0, -11]}>
        <mesh>
          <boxGeometry args={[34, 2.0, 0.05]} />
          <meshStandardMaterial color={CELL_COLORS.hazardYellow} wireframe />
        </mesh>
      </group>

      {/* Barcode & RFID Scanner Posts at Quality Inspection */}
      <group position={[20, 1.2, -2]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 2.4]} />
          <meshStandardMaterial color={CELL_COLORS.metalDark} />
        </mesh>
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[0.3, 0.2, 0.2]} />
          <meshBasicMaterial color={CELL_COLORS.productionCyan} />
        </mesh>
      </group>

      {/* Operator Workstation Tables with Monitors */}
      <group position={[-16, 0, -6]}>
        {/* Table */}
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[2.0, 0.9, 1.0]} />
          <meshStandardMaterial color={CELL_COLORS.metalMedium} />
        </mesh>
        {/* Monitor */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.05]} />
          <meshBasicMaterial color="#00AEEF" />
        </mesh>
      </group>
    </group>
  );
};
