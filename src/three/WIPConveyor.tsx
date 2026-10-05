import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CELL_COLORS } from './sceneConfig';

interface WIPConveyorProps {
  position: [number, number, number];
  length?: number;
  rotationY?: number;
  speed?: number;
}

export const WIPConveyor: React.FC<WIPConveyorProps> = ({
  position,
  length = 8,
  rotationY = 0,
  speed = 1.0
}) => {
  const item1Ref = useRef<THREE.Group>(null);
  const item2Ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const move = delta * speed * 1.6;
    if (item1Ref.current) {
      item1Ref.current.position.x += move;
      if (item1Ref.current.position.x > length / 2) {
        item1Ref.current.position.x = -length / 2;
      }
    }
    if (item2Ref.current) {
      item2Ref.current.position.x += move;
      if (item2Ref.current.position.x > length / 2) {
        item2Ref.current.position.x = -length / 2;
      }
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Roller Bed */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[length, 0.16, 0.8]} />
        <meshStandardMaterial color={CELL_COLORS.metalMedium} metalness={0.8} />
      </mesh>

      {/* Guide Rails */}
      <mesh position={[0, 0.52, -0.38]}>
        <boxGeometry args={[length, 0.08, 0.04]} />
        <meshStandardMaterial color={CELL_COLORS.industrialOrange} />
      </mesh>
      <mesh position={[0, 0.52, 0.38]}>
        <boxGeometry args={[length, 0.08, 0.04]} />
        <meshStandardMaterial color={CELL_COLORS.industrialOrange} />
      </mesh>

      {/* Moving WIP PCB Board Models */}
      <group ref={item1Ref} position={[-length / 3, 0.52, 0]}>
        {/* PCB Board */}
        <mesh>
          <boxGeometry args={[0.5, 0.04, 0.4]} />
          <meshStandardMaterial color="#005522" roughness={0.3} />
        </mesh>
        {/* Chips */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.2, 0.03, 0.2]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      <group ref={item2Ref} position={[length / 4, 0.52, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.04, 0.4]} />
          <meshStandardMaterial color="#005522" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.2, 0.03, 0.2]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>
    </group>
  );
};
