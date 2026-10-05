import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_CAMERA_PRESETS } from './sceneConfig';
import { useSimulationStore } from '../store/simulationStore';

export const CameraControls: React.FC = () => {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraPreset = useSimulationStore((state) => state.cameraPreset);

  const targetPos = useRef(new THREE.Vector3(...CELL_CAMERA_PRESETS.OVERVIEW.position));
  const targetLookAt = useRef(new THREE.Vector3(...CELL_CAMERA_PRESETS.OVERVIEW.target));
  const isAnimating = useRef(false);

  useEffect(() => {
    const preset = CELL_CAMERA_PRESETS[cameraPreset as keyof typeof CELL_CAMERA_PRESETS];
    if (preset) {
      targetPos.current.set(...preset.position);
      targetLookAt.current.set(...preset.target);
      isAnimating.current = true;
    }
  }, [cameraPreset]);

  useFrame(() => {
    if (controlsRef.current && isAnimating.current) {
      camera.position.lerp(targetPos.current, 0.08);
      controlsRef.current.target.lerp(targetLookAt.current, 0.08);
      controlsRef.current.update();

      if (
        camera.position.distanceTo(targetPos.current) < 0.1 &&
        controlsRef.current.target.distanceTo(targetLookAt.current) < 0.1
      ) {
        isAnimating.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enableZoom
      enablePan
      minDistance={6}
      maxDistance={70}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minPolarAngle={0.1}
      target={[4, 0, 0]}
    />
  );
};
