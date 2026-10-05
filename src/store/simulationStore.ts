import { create } from 'zustand';
import {
  SimulationState,
  ScenarioMetrics,
  AMRResource,
  CellMachine,
  MaterialBuffer,
  AIRecommendation,
  EventLogEntry,
  ViewMode
} from '../types';

import {
  calculateScenarioMetrics,
  generatePredictiveRecommendation
} from '../services/simulationEngine';

export interface SelectedObjectState {
  type: 'AMR' | 'MACHINE' | 'BUFFER' | 'SUPERMARKET' | 'RISK' | null;
  id: string | null;
  title?: string;
  data?: any;
}

interface SimulationStore {
  // State Machine
  simulationState: SimulationState;
  simulationStepText: string;
  toastMessage: string | null;

  // View & Camera
  viewMode: ViewMode;
  cameraPreset: string;
  selectedObject: SelectedObjectState;

  // Simulation Parameters
  productionVolumePercent: number; // 80, 100, 110, 120, 140
  amrCount: number; // 5 to 7
  stagingCapacityBonus: number;

  // Real-Time Calculated Metrics
  metrics: ScenarioMetrics;
  mat004BufferPercent: number; // 80 -> 30 -> 78
  activeRecommendation: AIRecommendation | null;

  // Domain Objects
  amrs: AMRResource[];
  machines: CellMachine[];
  buffers: MaterialBuffer[];
  eventLog: EventLogEntry[];

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: string) => void;
  setSelectedObject: (obj: SelectedObjectState) => void;
  setProductionVolume: (vol: number) => void;
  setAmrCount: (count: number) => void;
  
  // State Machine Handlers
  runWhatIfSimulation: () => void;
  applyRecommendation: () => void;
  resetDemo: () => void;
  addEventLog: (entry: Omit<EventLogEntry, 'id'>) => void;
}

const initialAMRs: AMRResource[] = [
  {
    id: 'AMR-01',
    name: 'Supermarket Runner-1',
    status: 'MOVING',
    battery: 92,
    capacity: 250,
    currentPosition: [-16, 0, 12],
    targetPosition: [-16, 0, 0],
    speed: 1.6,
    currentTask: 'Supermarket Pick MAT-001',
    utilization: 68,
    payload: 'MAT-001 Tote',
    assignedRoute: 'Supermarket Loop',
    isActive: true
  },
  {
    id: 'AMR-02',
    name: 'Line A Replenisher-2',
    status: 'MOVING',
    battery: 88,
    capacity: 250,
    currentPosition: [-6, 0, 0],
    targetPosition: [8, 0, -4],
    speed: 1.8,
    currentTask: 'Line A Buffer Delivery',
    utilization: 74,
    payload: 'MAT-002 Tote',
    assignedRoute: 'Line A Buffer Loop',
    isActive: true
  },
  {
    id: 'AMR-03',
    name: 'Line B Replenisher-3',
    status: 'MOVING',
    battery: 85,
    capacity: 250,
    currentPosition: [8, 0, 6],
    targetPosition: [-16, 0, 6],
    speed: 1.5,
    currentTask: 'Line B Buffer Delivery',
    utilization: 62,
    payload: 'MAT-003 Tote',
    assignedRoute: 'Line B Buffer Loop',
    isActive: true
  },
  {
    id: 'AMR-04',
    name: 'WIP Shuttle-4',
    status: 'MOVING',
    battery: 79,
    capacity: 300,
    currentPosition: [16, 0, -4],
    targetPosition: [22, 0, 0],
    speed: 1.4,
    currentTask: 'WIP to Quality Inspection',
    utilization: 58,
    payload: 'PCB Sub-Assembly',
    assignedRoute: 'WIP Transport Loop',
    isActive: true
  },
  {
    id: 'AMR-05',
    name: 'Finished Goods Shuttle-5',
    status: 'MOVING',
    battery: 94,
    capacity: 400,
    currentPosition: [24, 0, 4],
    targetPosition: [28, 0, 10],
    speed: 1.6,
    currentTask: 'Finished ECU to Outbound',
    utilization: 60,
    payload: 'Finished ECU Pallet',
    assignedRoute: 'Outbound Loop',
    isActive: true
  },
  {
    id: 'AMR-06',
    name: 'Standby Surge AMR-06',
    status: 'CHARGING',
    battery: 100,
    capacity: 300,
    currentPosition: [-12, 0, -12],
    targetPosition: [-12, 0, -12],
    speed: 2.2,
    currentTask: null,
    utilization: 0,
    payload: null,
    assignedRoute: 'Charging Hub',
    isActive: false
  }
];

const initialMachines: CellMachine[] = [
  {
    id: 'MACHINE-A01',
    name: 'A01 High-Speed PCB Surface Mount',
    processType: 'SMD Surface Mount',
    status: 'RUNNING',
    cycleProgress: 65,
    cycleTimeSec: 12,
    unitsProduced: 480,
    currentModel: 'MOD-ECU-01',
    requiredMaterial: 'MAT-002 PCB Substrate',
    position: [-4, 0, -6]
  },
  {
    id: 'MACHINE-A02',
    name: 'A02 Component Solder & Connector Fastener',
    processType: 'Connector Fastening',
    status: 'RUNNING',
    cycleProgress: 40,
    cycleTimeSec: 15,
    unitsProduced: 465,
    currentModel: 'MOD-ECU-01',
    requiredMaterial: 'MAT-004 MOSFET Connector',
    position: [4, 0, -6]
  },
  {
    id: 'MACHINE-A03',
    name: 'A03 Housing Seal & Die-Cast Lock',
    processType: 'Housing Assembly',
    status: 'RUNNING',
    cycleProgress: 80,
    cycleTimeSec: 14,
    unitsProduced: 460,
    currentModel: 'MOD-ECU-01',
    requiredMaterial: 'MAT-001 Die-Cast Housing',
    position: [12, 0, -6]
  },
  {
    id: 'MACHINE-A04',
    name: 'A04 Automated Optical Quality Inspection',
    processType: 'AOI Vision Test',
    status: 'RUNNING',
    cycleProgress: 25,
    cycleTimeSec: 10,
    unitsProduced: 455,
    currentModel: 'MOD-ECU-01',
    requiredMaterial: 'WIP Sub-Assembly',
    position: [20, 0, -6]
  },
  {
    id: 'MACHINE-A05',
    name: 'A05 End-of-Line Functional Electrical Test',
    processType: 'EOL Functional Test',
    status: 'RUNNING',
    cycleProgress: 90,
    cycleTimeSec: 16,
    unitsProduced: 450,
    currentModel: 'MOD-ECU-01',
    requiredMaterial: 'Tested PCB Unit',
    position: [24, 0, 2]
  }
];

const initialBuffers: MaterialBuffer[] = [
  {
    id: 'MAT-001',
    name: 'Aluminum ECU Housing',
    category: 'Structural',
    currentLevelPercent: 85,
    minimumSafetyPercent: 25,
    consumptionRate: 1.6,
    replenishmentRate: 1.8,
    assignedMachine: 'MACHINE-A03',
    status: 'NORMAL'
  },
  {
    id: 'MAT-002',
    name: 'SMD PCB Substrate',
    category: 'Electronics',
    currentLevelPercent: 80,
    minimumSafetyPercent: 30,
    consumptionRate: 3.2,
    replenishmentRate: 3.5,
    assignedMachine: 'MACHINE-A01',
    status: 'NORMAL'
  },
  {
    id: 'MAT-004',
    name: 'MOSFET Connector Module',
    category: 'Power Module',
    currentLevelPercent: 80,
    minimumSafetyPercent: 35,
    consumptionRate: 2.1,
    replenishmentRate: 1.9,
    assignedMachine: 'MACHINE-A02',
    status: 'NORMAL'
  },
  {
    id: 'MAT-005',
    name: 'Automotive Sealant Gasket',
    category: 'Seals',
    currentLevelPercent: 90,
    minimumSafetyPercent: 20,
    consumptionRate: 1.2,
    replenishmentRate: 1.5,
    assignedMachine: 'MACHINE-A03',
    status: 'NORMAL'
  }
];

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  simulationState: 'IDLE',
  simulationStepText: 'System Normal (100% Volume)',
  toastMessage: null,

  viewMode: '3D CELL VIEW',
  cameraPreset: 'PRODUCTION CELL',
  selectedObject: { type: null, id: null },

  productionVolumePercent: 100,
  amrCount: 5,
  stagingCapacityBonus: 0,

  metrics: calculateScenarioMetrics(100, 5, false),
  mat004BufferPercent: 80,
  activeRecommendation: null,

  amrs: initialAMRs,
  machines: initialMachines,
  buffers: initialBuffers,

  eventLog: [
    {
      id: 'EVT-001',
      timestamp: '08:00:00',
      type: 'INFO',
      message: 'DENSO Automotive ECU Assembly Cell initialized.',
      source: 'Digital Twin Core'
    },
    {
      id: 'EVT-002',
      timestamp: '08:05:00',
      type: 'INFO',
      message: 'Baseline Shift Plan active at 100 units/hour target (5 AMRs).',
      source: 'Cell Controller'
    }
  ],

  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setSelectedObject: (obj) => set({ selectedObject: obj }),
  setProductionVolume: (vol) => set({ productionVolumePercent: vol }),
  setAmrCount: (count) => set({ amrCount: count }),

  addEventLog: (entry) =>
    set((state) => ({
      eventLog: [{ id: `EVT-${Date.now()}`, ...entry }, ...state.eventLog]
    })),

  // ================= STATE MACHINE WHAT-IF SIMULATION =================
  runWhatIfSimulation: () => {
    const state = get();
    const targetVol = state.productionVolumePercent;
    const currentAmrs = state.amrs.filter((a) => a.isActive).length;

    set({
      simulationState: 'RUNNING',
      simulationStepText: `Applying Production Volume Scenario (${targetVol}%)...`
    });

    state.addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'ACTION',
      message: `Starting What-If Simulation: Production Volume set to ${targetVol}%.`,
      source: 'What-If Engine'
    });

    // Step 1 (t=1.2s): Demand & Consumption Increase
    setTimeout(() => {
      set({
        simulationStepText: 'Recalculating Material Consumption & Replenishment Demand...'
      });
    }, 1200);

    // Step 2 (t=2.5s): AGV Workload & Buffer Depletion
    setTimeout(() => {
      const isHighSurge = targetVol >= 120;
      const newBuffer = isHighSurge ? 30 : 55;
      const newMetrics = calculateScenarioMetrics(targetVol, currentAmrs, false);

      set((s) => ({
        simulationStepText: 'Evaluating AMR Fleet Capacity & Buffer Depletion Rates...',
        mat004BufferPercent: newBuffer,
        metrics: newMetrics,
        buffers: s.buffers.map((b) =>
          b.id === 'MAT-004'
            ? { ...b, currentLevelPercent: newBuffer, status: isHighSurge ? 'CRITICAL' : 'LOW' }
            : b
        )
      }));
    }, 2500);

    // Step 3 (t=4.0s): Detect Bottleneck & Generate Recommendation
    setTimeout(() => {
      const rec = generatePredictiveRecommendation(targetVol, currentAmrs);

      set({
        simulationState: rec ? 'RISK_DETECTED' : 'COMPLETED',
        simulationStepText: rec
          ? `LINE-SIDE SHORTAGE RISK DETECTED ON MAT-004 (${targetVol}% Vol)`
          : 'Simulation Completed (Optimal Cadence)',
        activeRecommendation: rec
      });

      if (rec) {
        set({ simulationState: 'RECOMMENDATION_READY' });
        state.addEventLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'CRITICAL',
          message: `Predictive Risk Alert: MAT-004 Buffer Depletion Risk at Machine A02. AI Recommendation generated.`,
          source: 'Predictive Co-Pilot'
        });
      } else {
        state.addEventLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'SUCCESS',
          message: `Simulation Completed: No critical material shortage risks detected.`,
          source: 'What-If Engine'
        });
      }
    }, 4200);
  },

  // ================= EXECUTE AI RECOMMENDATION =================
  applyRecommendation: () => {
    const state = get();
    const rec = state.activeRecommendation;
    if (!rec) return;

    set({
      simulationState: 'APPLYING',
      simulationStepText: 'Activating Standby AMR-06 & Rerouting MAT-004 Delivery...'
    });

    state.addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'ACTION',
      message: `Applying Recommendation: Deploying AMR-06 to MAT-004 priority route.`,
      source: 'Fleet Controller'
    });

    // Step 1: Deploy AMR-06 in 3D Scene
    setTimeout(() => {
      set((s) => ({
        amrCount: 6,
        amrs: s.amrs.map((a) =>
          a.id === 'AMR-06'
            ? {
                ...a,
                isActive: true,
                status: 'MOVING',
                currentTask: 'URGENT MAT-004 Replenishment',
                payload: 'MAT-004 Priority Tote',
                currentPosition: [-12, 0, -12],
                targetPosition: [4, 0, -6]
              }
            : a
        ),
        simulationState: 'RECOVERING',
        simulationStepText: 'AMR-06 In-Transit. Buffer Level Recovering...'
      }));
    }, 1500);

    // Step 2 (t=3.5s): Buffer recovers & Risk drops
    setTimeout(() => {
      const targetVol = state.productionVolumePercent;
      const mitigatedMetrics = calculateScenarioMetrics(targetVol, 6, true);

      set((s) => ({
        mat004BufferPercent: 78,
        amrCount: 6,
        metrics: mitigatedMetrics,
        simulationState: 'COMPLETED',
        simulationStepText: 'Recommendation Applied. Buffer Recovered & Risk Mitigated.',
        toastMessage: 'Recommendation Applied! AMR-06 deployed & MAT-004 buffer restored to 78%.',
        buffers: s.buffers.map((b) =>
          b.id === 'MAT-004'
            ? { ...b, currentLevelPercent: 78, status: 'NORMAL' }
            : b
        )
      }));

      state.addEventLog({
        timestamp: new Date().toLocaleTimeString(),
        type: 'SUCCESS',
        message: `Recommendation Executed: MAT-004 buffer restored to 78%. Shortage risk dropped to 11%.`,
        source: 'Cell Controller'
      });

      setTimeout(() => set({ toastMessage: null }), 4000);
    }, 3800);
  },

  // ================= RESET DEMO =================
  resetDemo: () => {
    set({
      simulationState: 'IDLE',
      simulationStepText: 'System Normal (100% Volume)',
      productionVolumePercent: 100,
      amrCount: 5,
      mat004BufferPercent: 80,
      metrics: calculateScenarioMetrics(100, 5, false),
      activeRecommendation: null,
      amrs: initialAMRs,
      machines: initialMachines,
      buffers: initialBuffers,
      selectedObject: { type: null, id: null }
    });

    get().addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: 'Demo state reset to Baseline 100% production parameters.',
      source: 'System Core'
    });
  }
}));
