export type SimulationState =
  | 'IDLE'
  | 'RUNNING'
  | 'RISK_DETECTED'
  | 'RECOMMENDATION_READY'
  | 'APPLYING'
  | 'RECOVERING'
  | 'COMPLETED';

export type ShiftType = 'Shift A' | 'Shift B' | 'Shift C';
export type RobotStatus = 'IDLE' | 'MOVING' | 'LOADING' | 'UNLOADING' | 'CHARGING' | 'ERROR';
export type MachineStatus = 'RUNNING' | 'IDLE' | 'MAINTENANCE' | 'WARNING' | 'ERROR';
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ProductionModel {
  id: string;
  name: string;
  plannedQty: number;
  actualQty: number;
  taktTimeSec: number;
}

export interface MaterialBuffer {
  id: string; // e.g. MAT-004
  name: string;
  category: string;
  currentLevelPercent: number; // 0 - 100
  minimumSafetyPercent: number;
  consumptionRate: number; // units/min
  replenishmentRate: number; // units/min
  assignedMachine: string;
  status: 'NORMAL' | 'LOW' | 'CRITICAL';
}

export interface AMRResource {
  id: string;
  name: string;
  status: RobotStatus;
  battery: number;
  capacity: number;
  currentPosition: [number, number, number];
  targetPosition: [number, number, number];
  speed: number;
  currentTask: string | null;
  utilization: number;
  payload: string | null;
  assignedRoute: string;
  isActive: boolean;
}

export interface CellMachine {
  id: string;
  name: string;
  processType: string;
  status: MachineStatus;
  cycleProgress: number; // 0 - 100
  cycleTimeSec: number;
  unitsProduced: number;
  currentModel: string;
  requiredMaterial: string;
  position: [number, number, number];
}

export interface ScenarioMetrics {
  productionRate: number; // units/hour (e.g. 100 vs 120)
  materialDemandPercent: number; // e.g. 100% vs 120%
  logisticsTasksPerHour: number; // e.g. 20 vs 24
  amrUtilizationPercent: number; // e.g. 65% vs 82% -> 71%
  lineSideBufferPercent: number; // e.g. 80% vs 30% -> 78%
  shortageRiskPercent: number; // e.g. 8% vs 31% -> 11%
  downtimeMinutesPerHour: number; // e.g. 0 vs 6 -> 1 min
}

export type RiskLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface OperationsSnapshot {
  upstreamCapacity: number;
  upstreamUtilization: number;
  upstreamDelay: number;
  amrLines: Array<{ line: string; count: number; demand: number; capacity: number; utilization: number; delay: number }>;
  agvLines: Array<{ line: string; count: number; demand: number; capacity: number; utilization: number; delay: number }>;
  stagingSupplyLimited: boolean;
  unitsPerHour: number;
  materials: Array<{
    id: string;
    name: string;
    perUnit: number;
    tripQty: number;
    stock: number;
    line: string;
    consumptionPerHour: number;
    tripsPerHour: number;
    coverMinutes: number;
    effectiveCoverMinutes: number;
    level: RiskLevel;
  }>;
  tripsPerHour: number;
  transportCapacity: number;
  transportUtilization: number;
  delayMinutes: number;
  stagingPallets: number;
  bottlenecks: Array<{ id: string; name: string; utilization: number; level: RiskLevel }>;
  riskScore: number;
}

export interface AIRecommendation {
  id: string;
  priority: 'HIGH' | 'URGENT';
  title: string;
  description: string;
  actions: string[];
  expectedImpact: {
    shortageRiskDelta: number; // -20%
    amrUtilizationDelta: number; // -11%
    downtimeMinutesDelta: number; // -5 min
  };
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS' | 'ACTION';
  message: string;
  source: string;
}

export type ViewMode = '3D CELL VIEW' | 'PREDICTIVE' | 'WHAT-IF' | 'LOGISTICS FLOW';
