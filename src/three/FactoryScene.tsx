import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CELL_COLORS, CELL_CAMERA_PRESETS } from './sceneConfig';
import { CellFloor } from './CellFloor';
import { MaterialSupermarket } from './MaterialSupermarket';
import { LineSideBuffer } from './LineSideBuffer';
import { CellMachineItem } from './CellMachineItem';
import { WIPConveyor } from './WIPConveyor';
import { CellRobotFleet } from './CellRobotFleet';
import { FinishedGoodsArea } from './FinishedGoodsArea';
import { CellIndustrialDetails } from './CellIndustrialDetails';
import { CameraControls } from './CameraControls';
import { FlowOverlay } from './FlowOverlay';
import { Minimap } from './Minimap';
import { Legend } from './Legend';
import { useSimulationStore } from '../store/simulationStore';
import { Compass, RotateCcw, Maximize2, Eye } from 'lucide-react';

export const FactoryScene: React.FC = () => {
  const setCameraPreset = useSimulationStore((state) => state.setCameraPreset);
  const cameraPreset = useSimulationStore((state) => state.cameraPreset);
  const setSelectedObject = useSimulationStore((state) => state.setSelectedObject);
  const machines = useSimulationStore((state) => state.machines);
  const selectedObject = useSimulationStore((state) => state.selectedObject);
  const simulationState = useSimulationStore((state) => state.simulationState);

  const [showFlow, setShowFlow] = useState(true);

  const presets = Object.keys(CELL_CAMERA_PRESETS);

  return (
    <div className="relative w-full h-full bg-[#0B0F17] overflow-hidden select-none">
      {/* R3F Canvas */}
      <Canvas
        shadows
        camera={{ position: [4, 22, 28], fov: 42 }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedObject({ type: null, id: null });
          }
        }}
      >
        <color attach="background" args={[CELL_COLORS.bgDark]} />
        <fog attach="fog" args={[CELL_COLORS.bgDark, 30, 80]} />

        {/* Enhanced Bright Industrial Lighting */}
        <ambientLight intensity={0.75} color="#BAE6FD" />
        <directionalLight
          position={[20, 35, 20]}
          intensity={1.6}
          color="#F0F9FF"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-16, 12, 6]} intensity={2.2} color={CELL_COLORS.productionCyan} distance={30} />
        <pointLight position={[4, 12, -6]} intensity={2.8} color={CELL_COLORS.industrialOrange} distance={35} />

        <Suspense fallback={null}>
          <CellFloor />
          <MaterialSupermarket />
          <LineSideBuffer />

          {/* Assembly Machines (A01 - A05) */}
          {machines.map((m) => (
            <CellMachineItem
              key={m.id}
              machine={m}
              isSelected={selectedObject.type === 'MACHINE' && selectedObject.id === m.id}
              onClick={() =>
                setSelectedObject({
                  type: 'MACHINE',
                  id: m.id,
                  title: `${m.id}: ${m.name}`,
                  data: m
                })
              }
            />
          ))}

          {/* Interconnecting WIP Conveyors */}
          <WIPConveyor position={[0, 0, -6]} length={4} speed={1.2} />
          <WIPConveyor position={[8, 0, -6]} length={4} speed={1.2} />
          <WIPConveyor position={[16, 0, -6]} length={4} speed={1.2} />
          <WIPConveyor position={[22, 0, -2]} length={6} rotationY={Math.PI / 2} speed={1.0} />

          <CellRobotFleet />
          <FinishedGoodsArea />
          <CellIndustrialDetails />

          {/* Flow Direction Overlay */}
          <FlowOverlay visible={showFlow} hasRisk={simulationState === 'RISK_DETECTED' || simulationState === 'RECOMMENDATION_READY'} />
        </Suspense>

        <CameraControls />
      </Canvas>

      {/* Floating Camera Presets Bar (Top Left) */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800 p-1.5 rounded-lg shadow-2xl z-10 font-mono">
        <Compass className="w-4 h-4 text-cyan-400 ml-1 mr-1" />
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">
          Views:
        </span>
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => setCameraPreset(preset)}
            className={`px-2 py-1 rounded text-xs font-bold transition-all ${
              cameraPreset === preset
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Viewport Action Controls (Top Right: Reset, Fit Cell, Show Flow) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10 font-mono text-xs">
        <button
          onClick={() => setShowFlow(!showFlow)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-bold transition-all shadow-xl ${
            showFlow
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500/80'
              : 'bg-slate-950/85 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>SHOW FLOW</span>
        </button>

        <button
          onClick={() => setCameraPreset('OVERVIEW')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 font-bold hover:bg-slate-900 transition-colors shadow-xl"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>RESET VIEW</span>
        </button>

        <button
          onClick={() => setCameraPreset('OVERVIEW')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 font-bold hover:bg-slate-900 transition-colors shadow-xl"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>FIT CELL</span>
        </button>
      </div>

      {/* 2D Minimap & Legend Overlays */}
      <Minimap />
      <Legend />
    </div>
  );
};
