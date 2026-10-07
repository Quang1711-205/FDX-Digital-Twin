import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { CircleCheck, Info, TriangleAlert, UsersRound } from "lucide-react";
import { createFinishedGoodsFlow } from "../three/FinishedGoodsFlow";
import { buildPackingScenarios, calculatePacking, FINISHED_GOODS } from "../services/packing";
import {
  createVehicle,
  animateVehicle,
  disposeObjects,
  createFlowRoutes,
  createStagingInventory,
  cloneStagingInventory,
  stagingCount,
  consumeLineSide,
} from "../three/LogisticsFleet";
import {
  createFactoryFloor,
  stagingSlot,
  STAGING_LAYOUT,
} from "../three/FactoryFloor";
import type { Vehicle, StagingInventory } from "../three/LogisticsFleet";
import { UiIcon } from "./DashboardUi";
import {
  FactoryOverview,
  TrendPanel,
  ResourceAllocation,
} from "./DashboardPanels";

// One editable demo configuration is the source for plans, BOM, resources and scenarios.
import DEMO from "../json/demo_config.json";
import {
  calculateOperationsSnapshot,
  resolveFleetScenario,
  allocateAmrCounts,
} from "../services/operationsEngine";

const P = DEMO.production;
const M = DEMO.materials.items;
const RS = DEMO.resources;
const OP = DEMO.operations.threshold;
const DEFAULT_SCENARIO = DEMO.demoScenarios.find(
  (scenario) => scenario.id === "stable",
)!;

function modelSequenceForMix(mix: Record<string, number>, count = 100) {
  const models = P.mix.map((item) => item.model);
  const total = models.reduce(
    (sum, model) => sum + Math.max(0, mix[model] ?? 0),
    0,
  );
  if (total <= 0) return P.sequence;
  const scores = Object.fromEntries(
    models.map((model) => [model, 0]),
  ) as Record<string, number>;
  const sequence: string[] = [];
  for (let index = 0; index < count; index++) {
    models.forEach((model) => {
      scores[model] += Math.max(0, mix[model] ?? 0);
    });
    const selected = models.reduce(
      (best, model) => (scores[model] > scores[best] ? model : best),
      models[0],
    );
    scores[selected] -= total;
    sequence.push(selected);
  }
  return sequence;
}

const COL = ["#22c55e", "#f59e0b", "#ef4444"];
const TXT = ["g", "a", "r"];

interface WhatIfOption {
  id: string;
  name: string;
  addAmr: number;
  addAgv: number;
  cost: number;
  targetLine?: string;
  productionPercent?: number;
  minProductionPercent?: number;
  addPackingByLine?: Record<string, number>;
}

interface RunMetrics {
  utilization: number;
  capacity: number;
  trips: number;
  delay: number;
  risk: number;
  criticalMaterials: number;
  warningMaterials: number;
  amrUtilization?: number;
  amrCapacity?: number;
  agvLines?: Array<{
    line: string;
    count: number;
    demand: number;
    capacity: number;
    utilization: number;
    delay: number;
  }>;
}

interface RunRecord {
  id: string;
  timestamp: string;
  scenarioId: string;
  name: string;
  productionPercent: number;
  before: RunMetrics;
  simulatedAfter: RunMetrics;
  actualUtilization: number | null;
  modelVersion?: number;
  dataSource?: string;
  assumptions?: {
    mix: Record<string, number>;
    bom: Record<string, Record<string, number>>;
    stocks: Record<string, number>;
    amrCycleMinutes: number;
    agvCycleMinutes: number;
    loadsPerTrip: number;
  };
  resourcesBefore?: { amr: number; agvByLine: Record<string, number>; packingWorkers?: Record<string, number> };
  resourcesAfter?: { amr: number; agvByLine: Record<string, number>; packingWorkers?: Record<string, number> };
  demoScenarioId?: string;
  demoScenarioName?: string;
  actualResult?: {
    simulatedMinutes: number;
    producedUnits: number;
    deliveredTrips: number;
    stagingByLine: Record<string, number>;
    lineSideByMaterial: Record<string, number>;
    lineRunning: Record<string, boolean>;
    warehouseReplenished: number;
  };
  cancelled?: boolean;
}

const RUN_HISTORY_KEY = "fdx-logistics-run-history-v1";
const RUN_HISTORY_LIMIT = 25;

function readRunHistory(): RunRecord[] {
  try {
    const saved = localStorage.getItem(RUN_HISTORY_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (record): record is RunRecord =>
          !!record &&
          typeof record === "object" &&
          typeof record.id === "string" &&
          typeof record.timestamp === "string" &&
          typeof record.name === "string" &&
          typeof record.productionPercent === "number" &&
          !!record.before &&
          !!record.simulatedAfter,
      )
      .map((record) =>
        record.modelVersion === 4 && !record.actualResult
          ? { ...record, cancelled: true }
          : record,
      )
      .slice(0, RUN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export const App: React.FC = () => {
  const [f, setF] = useState<number>(1);
  const [amr, setAmr] = useState<number>(RS.amr.available);
  const [packingWorkers, setPackingWorkers] = useState<Record<string, number>>({ ...FINISHED_GOODS.workersByLine });
  const [agvByLine, setAgvByLine] = useState<Record<string, number>>({
    ...RS.agv.byLine,
  });
  const [mix, setMix] = useState<Record<string, number>>(
    Object.fromEntries(P.mix.map((item) => [item.model, item.pct])),
  );
  const [bom, setBom] = useState<Record<string, Record<string, number>>>(
    Object.fromEntries(M.map((item) => [item.id, { ...item.usageByModel }])),
  );
  const [materialStocks, setMaterialStocks] = useState<Record<string, number>>(
    Object.fromEntries(M.map((item) => [item.id, item.stock])),
  );
  const [amrCycleMinutes, setAmrCycleMinutes] = useState(RS.amr.cycleMinutes);
  const [agvCycleMinutes, setAgvCycleMinutes] = useState(RS.agv.cycleMinutes);
  const [loadsPerTrip, setLoadsPerTrip] = useState(RS.agv.loadsPerTrip);
  const [activeDemoScenarioId, setActiveDemoScenarioId] = useState(
    DEFAULT_SCENARIO.id,
  );
  const [liveMetrics, setLiveMetrics] = useState<{
    productionPerHour: number;
    producedUnits: number;
    deliveredTrips: number;
    stagingLoads: number;
    stagingByLine: Record<string, number>;
    lineSideByMaterial: Record<string, number>;
    lineRunning: Record<string, boolean>;
    warehouseReplenished: number;
    amrMoving: number;
    agvMovingByLine: Record<string, number>;
  }>({
    productionPerHour: 0,
    producedUnits: 0,
    deliveredTrips: 0,
    stagingLoads: 0,
    stagingByLine: { A: 0, B: 0 },
    lineSideByMaterial: {},
    lineRunning: { A: false, B: false },
    warehouseReplenished: 0,
    amrMoving: 0,
    agvMovingByLine: { A: 0, B: 0 },
  });
  const [sel, setSel] = useState<string>("s1");
  const [previewScenarioId, setPreviewScenarioId] = useState<string | null>(
    null,
  );
  const [scenarioDetailsId, setScenarioDetailsId] = useState<string | null>(
    null,
  );
  const [runHistory, setRunHistory] = useState<RunRecord[]>(readRunHistory);
  const [done, setDone] = useState<RunRecord | null>(
    () => runHistory[0] ?? null,
  );
  const [actualUtilInput, setActualUtilInput] = useState("");
  const [userSelected, setUserSelected] = useState<boolean>(false);
  const [executionLocked, setExecutionLocked] = useState(
    () => runHistory[0]?.modelVersion === 4 && !runHistory[0]?.cancelled,
  );
  const executionLockRef = useRef(
    runHistory[0]?.modelVersion === 4 && !runHistory[0]?.cancelled,
  );
  const [expandedLeftSection, setExpandedLeftSection] = useState<string | null>(
    null,
  );
  const comparisonRef = useRef<HTMLElement | null>(null);
  const [activeHeaderSection, setActiveHeaderSection] = useState("#stage");
  const historyDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  useEffect(() => {
    const syncHeaderSection = () => {
      const hash = window.location.hash;
      if (
        [
          "#stage",
          "#comparison-panel",
          "#trend-panel",
          "#resource-summary",
        ].includes(hash)
      )
        setActiveHeaderSection(hash);
    };
    syncHeaderSection();
    window.addEventListener("hashchange", syncHeaderSection);
    return () => window.removeEventListener("hashchange", syncHeaderSection);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const thRef = useRef<number>(0.7);
  const phRef = useRef<number>(0.95);
  const distRef = useRef<number>(48);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const cameraTargetRef = useRef(new THREE.Vector3());
  const cameraViewRef = useRef<((view: string) => void) | null>(null);
  const [cameraView, setCameraView] = useState("overview");
  // 1× demo playback advances one simulated minute per wall-clock second.
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const simulationSpeedRef = useRef(1);

  const padsRef = useRef<Record<string, THREE.Mesh> | null>(null);
  const binsRef = useRef<THREE.Mesh[]>([]);
  const stagingPalletsRef = useRef<THREE.Mesh[]>([]);
  const stagingInventoryRef = useRef<StagingInventory | null>(null);
  const prodsRef = useRef<THREE.Mesh[]>([]);
  const amrsRef = useRef<Vehicle[]>([]);
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const lineProductionAllowedRef = useRef<Record<string, boolean>>({
    A: true,
    B: true,
  });
  const pendingRunRef = useRef<{ id: string; simulatedSeconds: number } | null>(
    null,
  );

  const labelElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const finishedGoodsRef = useRef<ReturnType<typeof createFinishedGoodsFlow> | null>(null);

  // Build one typed operations snapshot for the current state or a what-if scenario.
  const calc = (
    currentF = f,
    currentAmr = amr,
    currentAgv = agvByLine,
    currentMix = mix,
    currentBom = bom,
    currentStocks = materialStocks,
    currentAmrCycle = amrCycleMinutes,
    currentAgvCycle = agvCycleMinutes,
    currentLoadsPerTrip = loadsPerTrip,
    currentPackingWorkers = packingWorkers,
  ) => {
    const snapshot = calculateOperationsSnapshot({
      unitsPerHour: P.unitsPerHour,
      productionFactor: currentF,
      productionMix: currentMix,
      amrCount: currentAmr,
      agvByLine: currentAgv,
      agvTripsPerHour: 60 / currentAgvCycle,
      amrTripsPerHour: 60 / currentAmrCycle,
      loadsPerTrip: currentLoadsPerTrip,
      materials: M.map((item) => ({
        ...item,
        stock: currentStocks[item.id] ?? item.stock,
        usageByModel: currentBom[item.id] ?? item.usageByModel,
      })),
      thresholds: OP,
      capacities: {
        dockTripsPerHour: RS.warehouse.dockCapacity,
        pickingTripsPerHour: RS.picking.capacity,
        stagingPallets: RS.staging.pallets,
        lineUnitsPerHour: RS.line.capacityUnits,
      },
    });
    return {
      ...snapshot,
      packing: calculatePacking(snapshot.unitsPerHour, currentMix, currentPackingWorkers),
      units: snapshot.unitsPerHour,
      items: snapshot.materials.map((item) => ({
        ...item,
        cons: item.consumptionPerHour,
        trips: item.tripsPerHour,
        cover: item.coverMinutes,
        eff: item.effectiveCoverMinutes,
        lvl: item.level === "CRITICAL" ? 2 : item.level === "WARNING" ? 1 : 0,
      })),
      trips: snapshot.tripsPerHour,
      cap: snapshot.transportCapacity,
      util: snapshot.transportUtilization,
      delay: snapshot.delayMinutes,
      risk: snapshot.riskScore,
      bottlenecks: snapshot.bottlenecks,
      stagingPallets: snapshot.stagingPallets,
    };
  };

  const currentCalc = useMemo(
    () =>
      calc(
        f,
        amr,
        agvByLine,
        mix,
        bom,
        materialStocks,
        amrCycleMinutes,
        agvCycleMinutes,
        loadsPerTrip,
      ),
    [
      f,
      amr,
      agvByLine,
      mix,
      bom,
      materialStocks,
      amrCycleMinutes,
      agvCycleMinutes,
      loadsPerTrip,
      packingWorkers,
    ],
  );

  const activeDemoScenario =
    DEMO.demoScenarios.find(
      (scenario) => scenario.id === activeDemoScenarioId,
    ) ?? DEFAULT_SCENARIO;
  const SC = useMemo(() => buildPackingScenarios<WhatIfOption>(
    activeDemoScenario.whatIfs, currentCalc.packing, Math.round(f * 100), OP.knee,
  ), [activeDemoScenario.whatIfs, currentCalc.packing, f]);

  const scenariosWithRes = useMemo(() => {
    return SC.filter(
      (scenario) => Math.round(f * 100) >= (scenario.minProductionPercent ?? 0),
    ).map((scenario, order) => {
      const fleetResources = resolveFleetScenario(
        amr,
        agvByLine,
        scenario,
        currentCalc,
      );
      const resources = { ...fleetResources, packingWorkers: Object.fromEntries(
        ["A", "B"].map(line => [line, (packingWorkers[line] ?? 0) + (scenario.addPackingByLine?.[line] ?? 0)]),
      ) };
      const productionFactor =
        "productionPercent" in scenario && scenario.productionPercent
          ? scenario.productionPercent / 100
          : f;
      const modeled = calc(
        productionFactor,
        resources.amrCount,
        resources.agvByLine,
        mix, bom, materialStocks, amrCycleMinutes, agvCycleMinutes, loadsPerTrip,
        resources.packingWorkers,
      );
      // Recalculate every option from the same current plan, mix, BOM and stock.
      // What-if options compare fleet changes against the same production target.
      const criticalMaterials = modeled.items.filter(
        (item) => item.lvl === 2,
      ).length;
      const warningMaterials = modeled.items.filter(
        (item) => item.lvl === 1,
      ).length;
      // Score the improvement against the current plan: eliminating delays
      // and material risk matters more than reducing estimated resource cost.
      const maxCost = Math.max(0, ...SC.map((option) => option.cost));
      const improvementScore = (baseline: number, value: number) =>
        baseline > 0
          ? Math.max(0, Math.min(100, 100 * (1 - value / baseline)))
          : value <= 0
            ? 100
            : 0;
      const delayScore = improvementScore(currentCalc.delay, modeled.delay);
      const riskScore = improvementScore(currentCalc.risk, modeled.risk);
      const costScore =
        maxCost === 0
          ? 100
          : Math.max(0, Math.min(100, 100 * (1 - scenario.cost / maxCost)));
      const score = Math.round(
        (delayScore * 0.55 + riskScore * 0.3 + costScore * 0.15) / Math.max(1, modeled.packing.utilization),
      );
      const forecast = {
        capacity: modeled.cap,
        utilization: modeled.util,
        delay: modeled.delay,
        critical: criticalMaterials,
        warning: warningMaterials,
        score,
        recommended: false,
      };
      return {
        ...scenario,
        name: scenario.name,
        isBaseline:
          !("productionPercent" in scenario) &&
          scenario.addAmr === 0 &&
          scenario.addAgv === 0 &&
          !Object.values(scenario.addPackingByLine ?? {}).some(count => count > 0),
        forecast,
        resources,
        res: modeled,
        order,
        criticalMaterials,
        warningMaterials,
        score,
      };
    });
  }, [
    SC,
    f,
    amr,
    agvByLine,
    currentCalc,
    mix,
    bom,
    materialStocks,
    amrCycleMinutes,
    agvCycleMinutes,
    loadsPerTrip,
    packingWorkers,
  ]);

  // Recommend the highest-scoring option that keeps each AMR and AGV line within the modeled knee.
  const rec = useMemo(() => {
    const feasible = scenariosWithRes.filter((scenario) =>
      scenario.res.packing.utilization <= OP.knee + 1e-6 && [...scenario.res.amrLines, ...scenario.res.agvLines].every(
        (line) => line.utilization <= OP.knee + 1e-6,
      ),
    );
    const resolved = scenariosWithRes.filter(scenario => scenario.res.packing.backlogPerHour <= 1e-6 &&
      [...scenario.res.amrLines, ...scenario.res.agvLines].every(line => line.utilization <= 1 + 1e-6));
    const candidates = feasible.length ? feasible : resolved.length ? resolved : scenariosWithRes;
    return (
      [...candidates].sort(
        (a, b) => ((!feasible.length && !resolved.length)
          ? Math.max(a.res.util, a.res.packing.utilization) - Math.max(b.res.util, b.res.packing.utilization) : 0)
          || b.score - a.score || a.cost - b.cost || a.order - b.order,
      )[0]?.id ?? SC[0].id
    );
  }, [scenariosWithRes, SC]);

  const selectedSel = userSelected && scenariosWithRes.some(scenario => scenario.id === sel) ? sel : rec;
  const rankedScenarios = useMemo(() => [...scenariosWithRes].sort((a, b) =>
    Number(b.isBaseline) - Number(a.isBaseline) ||
    b.score - a.score || a.cost - b.cost || a.order - b.order,
  ), [scenariosWithRes]);

  // Preview is a presentation state; the committed inputs and history stay separate.
  const previewScenario = scenariosWithRes.find(
    (scenario) => scenario.id === previewScenarioId,
  );
  useEffect(() => {
    if (previewScenarioId && !previewScenario) {
      setPreviewScenarioId(null);
      setUserSelected(false);
    }
  }, [previewScenarioId, previewScenario]);
  const viewportState = useMemo(
    () => ({
      snapshot: previewScenario?.res ?? currentCalc,
      amrCount: previewScenario?.resources.amrCount ?? amr,
      agvByLine: previewScenario?.resources.agvByLine ?? agvByLine,
      packingWorkers: previewScenario?.resources.packingWorkers ?? packingWorkers,
      amrCycleMinutes,
      agvCycleMinutes,
      loadsPerTrip,
    }),
    [
      previewScenario,
      packingWorkers,
      currentCalc,
      amr,
      agvByLine,
      amrCycleMinutes,
      agvCycleMinutes,
      loadsPerTrip,
    ],
  );
  const viewportStateRef = useRef(viewportState);
  useEffect(() => {
    viewportStateRef.current = viewportState;
  }, [viewportState]);

  const alreadyExecutedForCurrentState = executionLocked;

  useEffect(() => {
    try {
      localStorage.setItem(
        RUN_HISTORY_KEY,
        JSON.stringify(runHistory.slice(0, RUN_HISTORY_LIMIT)),
      );
    } catch {
      // The current session still works when browser storage is unavailable or full.
    }
  }, [runHistory]);

  const clearAmrs = () => {
    amrsRef.current.forEach((vehicle) => {
      vehicle.m.removeFromParent();
      disposeObjects(vehicle.m);
    });
    amrsRef.current = [];
  };

  const fleetFor = (state: typeof viewportState) => {
    const amrByLine = allocateAmrCounts(
      state.amrCount,
      Object.fromEntries(
        state.snapshot.agvLines.map((line) => [line.line, line.demand]),
      ),
    );
    return [
      ...["A", "B"].flatMap((line) =>
        Array.from({ length: amrByLine[line] }, (_, index) => {
          const lineMaterials = M.filter((material) => material.line === line);
          return {
            index,
            kind: "AMR" as const,
            material: lineMaterials[index % lineMaterials.length],
          };
        }),
      ),
      ...["A", "B"].flatMap((line) =>
        Array.from({ length: state.agvByLine[line] ?? 0 }, (_, index) => ({
          index,
          kind: "AGV" as const,
          material: M.filter((material) => material.line === line)[
            index % M.filter((material) => material.line === line).length
          ],
        })),
      ),
    ];
  };
  const buildAmr = (state: typeof viewportState) => {
    if (!sceneRef.current) return;
    clearAmrs();
    fleetFor(state).forEach(({ index, kind, material }) => {
      const materialIndex = M.findIndex((item) => item.id === material.id);
      const binZ =
        binsRef.current[materialIndex]?.userData.z ??
        (material.line === "A" ? -6 : 6);
      const vehicle = createVehicle(
        index,
        kind,
        material,
        binZ,
        stagingInventoryRef.current ?? undefined,
        kind === "AMR" ? state.amrCycleMinutes : state.agvCycleMinutes,
        RS[kind === "AMR" ? "amr" : "agv"].handlingSeconds,
        kind === "AMR" ? state.amrCount : (state.agvByLine[material.line] ?? 0),
      );
      sceneRef.current!.add(vehicle.m);
      amrsRef.current.push(vehicle);
    });
  };

  const resetVisualStaging = (
    state: typeof viewportState,
    sourceInventory?: StagingInventory,
  ) => {
    stagingInventoryRef.current = sourceInventory
      ? cloneStagingInventory(sourceInventory)
      : createStagingInventory(
          state.snapshot.items.map((item) => ({
            ...item,
            usageByModel: bom[item.id] ?? {},
          })),
          RS.staging.pallets,
          RS.staging.demoInitialLoads,
          RS.lineSideLoadsPerMaterial,
          RS.initialLineSideLoads,
          state.loadsPerTrip,
        );
    if (sourceInventory) {
      const inventory = stagingInventoryRef.current;
      Object.keys(inventory.inTransit).forEach((id) => {
        inventory.warehouseStock[id] += inventory.inTransit[id];
        inventory.inTransit[id] = 0;
        inventory.lineReserved[id] = 0;
      });
    }
    buildAmr(state);
  };
  const savedMainSceneRef = useRef<{
    inventory: StagingInventory;
    fleet: Vehicle[];
    finishedGoods?: ReturnType<ReturnType<typeof createFinishedGoodsFlow>["saveState"]>;
  } | null>(null);
  // Plan/forecast updates are live; only a different situation resets the scene.
  const sceneConfigKey = activeDemoScenarioId;
  const previousSceneConfigRef = useRef(sceneConfigKey);
  const previousPreviewRef = useRef<string | null>(null);
  const previousFleetKeyRef = useRef(JSON.stringify([amr, agvByLine]));
  const restoreMainScene = () => {
    const saved = savedMainSceneRef.current;
    if (!saved || !sceneRef.current) return;
    clearAmrs();
    stagingInventoryRef.current = saved.inventory;
    amrsRef.current = saved.fleet;
    saved.fleet.forEach((vehicle) => sceneRef.current!.add(vehicle.m));
    if (saved.finishedGoods) finishedGoodsRef.current?.restoreState(saved.finishedGoods);
    savedMainSceneRef.current = null;
  };
  useEffect(() => {
    if (!sceneRef.current) return;
    const configChanged = previousSceneConfigRef.current !== sceneConfigKey;
    const fleetKey = JSON.stringify([amr, agvByLine]);
    if (configChanged) {
      restoreMainScene();
      finishedGoodsRef.current?.reset();
      resetVisualStaging(viewportState);
      if (!pendingRunRef.current) {
        executionLockRef.current = false;
        setExecutionLocked(false);
      }
    } else if (previewScenarioId && previousPreviewRef.current !== previewScenarioId) {
      if (!savedMainSceneRef.current && stagingInventoryRef.current) {
        savedMainSceneRef.current = {
          inventory: stagingInventoryRef.current,
          fleet: amrsRef.current,
          finishedGoods: finishedGoodsRef.current?.saveState(),
        };
        amrsRef.current.forEach((vehicle) => vehicle.m.removeFromParent());
        amrsRef.current = [];
      }
      if (savedMainSceneRef.current?.finishedGoods) finishedGoodsRef.current?.restoreState(savedMainSceneRef.current.finishedGoods);
      resetVisualStaging(viewportState, savedMainSceneRef.current?.inventory);
    } else if (!previewScenarioId && previousPreviewRef.current) {
      restoreMainScene();
    }
    if (!previewScenarioId && previousFleetKeyRef.current !== fleetKey) {
      const inventory = stagingInventoryRef.current;
      if (inventory) {
        // Return cargo from retired vehicles before rebuilding; never create extra stock.
        Object.keys(inventory.inTransit).forEach((id) => {
          inventory.warehouseStock[id] += inventory.inTransit[id];
          inventory.inTransit[id] = 0;
          inventory.lineReserved[id] = 0;
        });
        buildAmr(viewportState);
      }
    }
    previousSceneConfigRef.current = sceneConfigKey;
    previousPreviewRef.current = previewScenarioId;
    previousFleetKeyRef.current = fleetKey;
  }, [viewportState, previewScenarioId, sceneConfigKey]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) return;

    const cv = canvasRef.current;
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    rendererRef.current = R;
    const S = new THREE.Scene();
    S.background = new THREE.Color(0x0c1629);
    S.fog = new THREE.Fog(0x0c1629, 65, 140);
    sceneRef.current = S;

    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camRef.current = cam;

    const setCam = () => {
      const th = thRef.current;
      const ph = phRef.current;
      const dist = distRef.current;
      cam.position
        .set(
          dist * Math.sin(ph) * Math.sin(th),
          dist * Math.cos(ph),
          dist * Math.sin(ph) * Math.cos(th),
        )
        .add(cameraTargetRef.current);
      cam.lookAt(cameraTargetRef.current);
    };
    setCam();
    resetCameraRef.current = () => {
      cameraTargetRef.current.set(9, 0, 0);
      setCameraView("overview");
      thRef.current = 0.7;
      phRef.current = 0.95;
      distRef.current = Math.max(70, 85 / cam.aspect);
      setCam();
    };
    cameraViewRef.current = (view) => {
      if (view === "overview") return resetCameraRef.current?.();
      const views: Record<string, [number, number, number]> = {
        warehouse: [-16.5, 0, 26],
        staging: [-4, 0, 23],
        lineA: [9, -6, 27],
        lineB: [9, 6, 27],
      };
      const preset = views[view];
      if (!preset) return;
      cameraTargetRef.current.set(preset[0], 0, preset[1]);
      thRef.current = 0.7;
      phRef.current = 0.85;
      distRef.current = preset[2];
      setCam();
    };

    // High brightness lights
    S.add(new THREE.AmbientLight(0xffffff, 1.2));

    const dl1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dl1.position.set(-15, 40, 20);
    S.add(dl1);

    const dl2 = new THREE.DirectionalLight(0xa5c4ff, 0.8);
    dl2.position.set(25, 30, -20);
    S.add(dl2);

    const hl = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.6);
    S.add(hl);

    const mat = (c: number, e?: number) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.35,
        metalness: 0.15,
        emissive: e || 0,
      });

    const box = (
      w: number,
      h: number,
      d: number,
      c: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z);
      S.add(m);
      return m;
    };

    S.add(createFactoryFloor(RS.staging.pallets));

    const pads = {
      // Adjacent zones tile the entire 48 × 28 factory floor without empty strips.
      wh: box(12, 0.05, 28, 0x224a75, -18, 0.03, 0),
      pk: box(5, 0.05, 28, 0x2d4878, -9.5, 0.03, 0),
      st: box(6.2, 0.05, 28, 0x514a30, -3.9, 0.03, 0),
      tr: box(5, 0.05, 28, 0x243552, 1.7, 0.03, 0),
      la: box(19.8, 0.05, 14, 0x48305c, 14.1, 0.03, -7),
      lb: box(19.8, 0.05, 14, 0x1f5947, 14.1, 0.03, 7),
    };
    padsRef.current = pads;

    // 1 warehouse racks
    const RX = [-19.5, -17, -14.5];
    const cart = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.9),
      mat(0xf97316),
      RX.length * 15 * 3,
    );
    const dObj = new THREE.Object3D();
    let k = 0;
    RX.forEach((x) => {
      for (let l = 0; l < 3; l++) {
        box(1.3, 0.08, 18, 0x38bdf8, x, 0.35 + l * 1.1, 0);
        for (let i = 0; i < 15; i++) {
          dObj.position.set(x, 0.8 + l * 1.1, -8.4 + i * 1.2);
          dObj.updateMatrix();
          cart.setMatrixAt(k++, dObj.matrix);
        }
      }
      [-9, 9].forEach((z) => box(0.1, 3.6, 0.1, 0x38bdf8, x, 1.8, z));
    });
    S.add(cart);

    // 2 picking / kitting tables
    [-4, 4].forEach((z) => {
      box(3.2, 0.8, 1.3, 0x64748b, -11.3, 0.4, z);
      for (let i = 0; i < 4; i++)
        box(0.55, 0.4, 0.55, 0x38bdf8, -12.3 + i * 0.7, 1, z);
    });

    // Show the calculated staging occupancy while keeping the configured capacity fixed.
    stagingPalletsRef.current = Array.from(
      { length: RS.staging.pallets },
      (_, i) => {
        const { x, z } = stagingSlot(i);
        const pallet = box(0.72, 0.55, 0.72, 0xd97706, x, 0.36, z);
        pallet.visible = i < viewportState.snapshot.stagingPallets;
        return pallet;
      },
    );

    // 5 lines + line-side bins
    const LZ: Record<string, number> = { A: -6, B: 6 };
    const prods: THREE.Mesh[] = [];
    const modelColors: Record<string, number> = {
      "ECU-A": 0x38bdf8,
      "Alternator-B": 0x7dd3fc,
      "Sensor-C": 0x0ea5e9,
    };
    const sequence = modelSequenceForMix(mix);
    ["A", "B"].forEach((L: string) => {
      const lineSequence = sequence.filter(
        (model) =>
          (DEMO.production.lineByModel as Record<string, string>)[model] === L,
      );
      box(14, 0.5, 1.6, 0x475569, 12, 0.3, LZ[L]);
      for (let i = 0; i < 6; i++) {
        const model =
          lineSequence[i % Math.max(1, lineSequence.length)] ?? "ECU-A";
        const p: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> =
          box(
            0.8,
            0.5,
            0.8,
            modelColors[model] ?? 0x38bdf8,
            5 + i * 2.2,
            0.8,
            LZ[L],
          );
        if (model === "Alternator-B") {
          p.geometry.dispose();
          p.geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12);
        } else if (model === "Sensor-C") p.scale.setScalar(0.7);
        p.userData = { L, model, x: 5 };
        p.visible = false;
        prods.push(p);
      }
    });
    prodsRef.current = prods;
    const finishedGoods = createFinishedGoodsFlow();
    finishedGoodsRef.current = finishedGoods;
    S.add(finishedGoods.group);

    const bins = M.map((m, i) => {
      const z = LZ[m.line] + (i % 2 ? 1.9 : -1.9);
      const b = box(1.5, 1, 1.5, 0x22c55e, 4, 0.6, z);
      b.userData.z = z;
      return b;
    });
    binsRef.current = bins;

    S.add(createFlowRoutes());

    // Build initial AMRs
    resetVisualStaging(viewportState);

    let initialResize = true;
    const resize = () => {
      if (!stageRef.current || !rendererRef.current || !camRef.current) return;
      const s = stageRef.current;
      if (!s.clientWidth || !s.clientHeight) return;
      rendererRef.current.setSize(s.clientWidth, s.clientHeight, false);
      camRef.current.aspect = s.clientWidth / s.clientHeight;
      camRef.current.updateProjectionMatrix();
      if (initialResize) {
        initialResize = false;
        resetCameraRef.current?.();
      }
    };

    window.addEventListener("resize", resize);
    const viewportObserver = new ResizeObserver(resize);
    if (stageRef.current) viewportObserver.observe(stageRef.current);
    resize();

    // Orbit pointers
    let drag = false;
    let lx = 0;
    let ly = 0;
    const hoverPointer = new THREE.Vector2();
    const hoverRaycaster = new THREE.Raycaster();
    let pointerInside = false;
    const hoverTooltip = document.createElement("div");
    hoverTooltip.className = "lb z";
    hoverTooltip.style.display = "none";
    hoverTooltip.style.pointerEvents = "none";
    stageRef.current.appendChild(hoverTooltip);

    cv.onpointerdown = (e: PointerEvent) => {
      drag = true;
      lx = e.clientX;
      ly = e.clientY;
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointerup = () => {
      drag = false;
    };
    cv.onpointermove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      hoverPointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1);
      pointerInside = true;
      if (!drag) return;
      thRef.current -= (e.clientX - lx) * 0.006;
      phRef.current = Math.max(
        0.2,
        Math.min(1.45, phRef.current - (e.clientY - ly) * 0.005),
      );
      lx = e.clientX;
      ly = e.clientY;
      setCam();
    };
    cv.onpointerleave = () => { pointerInside = false; };
    cv.onwheel = (e: WheelEvent) => {
      e.preventDefault();
      distRef.current = Math.max(
        18,
        Math.min(110, distRef.current + e.deltaY * 0.03),
      );
      setCam();
    };

    // Label 3D projection targets
    const fixedLabels = [
      { id: "l1", v: new THREE.Vector3(-16.5, 4.2, -11.5) },
      { id: "l2", v: new THREE.Vector3(-11.3, 2, -6.5) },
      { id: "l3", v: new THREE.Vector3(-4, 2, -4.8) },
      { id: "l4", v: new THREE.Vector3(1, 2, -11.5) },
      { id: "l5", v: new THREE.Vector3(12, 2, -8) },
      { id: "l6", v: new THREE.Vector3(12, 2, 8) },
      { id: "finishedPacking", v: new THREE.Vector3(22, 4.2, -12) },
      { id: "finishedWarehouse", v: new THREE.Vector3(37, 4.2, -10) },
      { id: "stagingA", v: new THREE.Vector3(-4.2, 1.5, -6.3) },
      { id: "stagingB", v: new THREE.Vector3(-4.2, 1.5, 6.3) },
      ...["A", "B"].flatMap((line) => {
        const z = (line === "A" ? -1 : 1) * STAGING_LAYOUT.dockZ;
        return [
          {
            id: `amrDock${line}`,
            v: new THREE.Vector3(STAGING_LAYOUT.amrDockX, 0.7, z),
          },
          {
            id: `agvDock${line}`,
            v: new THREE.Vector3(STAGING_LAYOUT.agvDockX, 0.7, z),
          },
        ];
      }),
    ];

    const proj = () => {
      if (!cv || !camRef.current) return;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      let hovered: THREE.Object3D | null = null;
      const hoverTargets = [...amrsRef.current.map(vehicle => vehicle.m), ...finishedGoods.hoverTargets];
      if (pointerInside && !drag) {
        S.updateMatrixWorld(true);
        hoverRaycaster.setFromCamera(hoverPointer, camRef.current!);
        const hit = hoverRaycaster.intersectObjects(hoverTargets, true).find(item => item.object instanceof THREE.Mesh && item.object.visible);
        let object = hit?.object ?? null;
        while (object && !hoverTargets.includes(object as THREE.Group)) object = object.parent;
        hovered = object;
      }
      hoverTooltip.style.display = hovered?.userData.hoverLabel ? "" : "none";
      if (hovered?.userData.hoverLabel) {
        hoverTooltip.textContent = hovered.userData.hoverLabel;
        const anchor = hovered.position.clone().add(new THREE.Vector3(0, 2.6, 0)).project(camRef.current!);
        hoverTooltip.style.left = `${((anchor.x + 1) / 2) * w}px`;
        hoverTooltip.style.top = `${((1 - anchor.y) / 2) * h}px`;
      }

      fixedLabels.forEach((fl) => {
        const el = labelElementsRef.current[fl.id];
        if (el) {
          const v = fl.v.clone().project(camRef.current!);
          el.style.display =
            (!/^l[1-6]$/.test(fl.id) && !fl.id.startsWith("finished")) || v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15
              ? "none"
              : "";
          el.style.left = `${((v.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      });

      binsRef.current.forEach((b, idx) => {
        const el = labelElementsRef.current[`bin_${idx}`];
        if (el) {
          const v = new THREE.Vector3(4, 2, b.userData.z).project(
            camRef.current!,
          );
          el.style.display = "none";
          el.style.left = `${((v.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      });
      amrsRef.current.forEach((vehicle, index) => {
        const el = labelElementsRef.current[`vehicle_${index}`];
        if (!el) return;
        const anchor = vehicle.m.position
          .clone()
          .add(new THREE.Vector3(0, 1.8, 0));
        const v = anchor.project(camRef.current!);
        el.style.display =
          hovered !== vehicle.m || v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1
            ? "none"
            : "";
        el.style.left = `${((v.x + 1) / 2) * w}px`;
        el.style.top = `${((1 - v.y) / 2) * h}px`;
        el.title =
          vehicle.blocked === "empty"
            ? vehicle.kind === "AMR"
              ? "Chờ kiện tại kho"
              : "Chờ đúng kiện tại Staging"
            : vehicle.blocked === "full"
              ? vehicle.kind === "AMR"
                ? "Staging đầy"
                : "Line-side đầy"
              : vehicle.seekingMaterial
                ? "Đang chạy vòng tìm đúng mã vật tư"
                : vehicle.trafficWaiting
                  ? "Chờ xe cùng tuyến"
                  : `${vehicle.m.userData.activity} · Line ${vehicle.m.userData.line}`;
        el.textContent = `${vehicle.m.name}${vehicle.trafficWaiting ? " · Chờ xe cùng tuyến" : vehicle.blocked ? (vehicle.blocked === "empty" ? (vehicle.kind === "AMR" ? " · Chờ kho" : " · Chờ hàng") : vehicle.kind === "AMR" ? " · Staging đầy" : " · Line-side đầy") : vehicle.seekingMaterial ? " · Tìm đúng mã hàng" : ""}`;
      });
    };

    // Animation Loop
    const clock = new THREE.Clock();
    let animId: number;
    let ledgerRefresh = 0;
    let lastLedger: StagingInventory | null = null;
    let outputCredit: Record<string, number> = { A: 0, B: 0 };
    let producedSinceRefresh = 0;
    let simSecondsSinceRefresh = 0;
    let totalProduced = 0;
    let statusRefresh = 0;

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const animationDt = dt * simulationSpeedRef.current;
      const simulationDt = animationDt * 60;
      finishedGoods.configure(viewportStateRef.current.packingWorkers);
      simSecondsSinceRefresh += simulationDt;
      statusRefresh += dt;

      // Simulation animation tick
      const c = viewportStateRef.current.snapshot;

      amrsRef.current.forEach((vehicle) =>
        animateVehicle(
          vehicle,
          animationDt,
          stagingInventoryRef.current ?? undefined,
          amrsRef.current,
        ),
      );
      const inventory = stagingInventoryRef.current;
      if (inventory) {
        ledgerRefresh += dt;
        if (ledgerRefresh >= 0.5) {
          ledgerRefresh = 0;
          for (const material of c.items) {
            const values: Record<string, number> = {
              warehouse: inventory.warehouseStock[material.id],
              replenished: inventory.warehouseReplenished[material.id],
              transit: inventory.inTransit[material.id],
              staging: inventory.stock[material.id] * material.tripQty,
              line: inventory.lineSideStock[material.id],
              consumed: inventory.consumed[material.id],
            };
            values.total =
              values.warehouse +
              values.transit +
              values.staging +
              values.line +
              values.consumed;
            Object.entries(values).forEach(([field, value]) => {
              const cell = document.getElementById(
                `ledger-${material.id}-${field}`,
              );
              if (cell) cell.textContent = value.toFixed(1);
            });
          }
        }
        if (inventory !== lastLedger) {
          lastLedger = inventory;
          outputCredit = { A: 0, B: 0 };
          producedSinceRefresh = 0;
          simSecondsSinceRefresh = 0;
          totalProduced = 0;
          prodsRef.current.forEach((product) => {
            product.visible = false;
            product.userData.x = 5;
          });
        }
        const consumedBefore = { ...inventory.consumed };
        lineProductionAllowedRef.current = consumeLineSide(
          inventory,
          c.items,
          simulationDt,
        );
        for (const line of ["A", "B"]) {
          const material = c.items.find(
            (item) => item.line === line && item.consumptionPerHour > 0,
          );
          const share =
            Object.entries(mixRef.current).reduce(
              (sum, [model, pct]) =>
                sum +
                ((DEMO.production.lineByModel as Record<string, string>)[
                  model
                ] === line
                  ? pct
                  : 0),
              0,
            ) / 100;
          if (material) {
            const produced =
              ((inventory.consumed[material.id] - consumedBefore[material.id]) /
                material.consumptionPerHour) *
              c.unitsPerHour *
              share;
            outputCredit[line] += produced;
            producedSinceRefresh += produced;
            totalProduced += produced;
          }
          while (outputCredit[line] >= 1) {
            const slot = prodsRef.current.find(
              (product) => product.userData.L === line && !product.visible,
            );
            if (!slot) break;
            slot.visible = true;
            slot.userData.x = 5;
            outputCredit[line] -= 1;
          }
        }
        ["A", "B"].forEach((line) => {
          const label = labelElementsRef.current[line === "A" ? "l5" : "l6"];
          if (!label) return;
          const running = lineProductionAllowedRef.current[line];
          label.textContent = running
            ? `LINE ${line} · ĐANG CHẠY`
            : `LINE ${line} · DỪNG: THIẾU VẬT TƯ`;
          label.classList.toggle("line-starved", !running);
        });
        const contents = Object.fromEntries(
          ["A", "B"].map((line) => [
            line,
            M.filter((material) => material.line === line).flatMap((material) =>
              Array.from(
                { length: inventory.stock[material.id] },
                () => material.id,
              ),
            ),
          ]),
        );
        stagingPalletsRef.current.forEach((pallet, index) => {
          const id =
            contents[index % 2 === 0 ? "A" : "B"][Math.floor(index / 2)];
          pallet.visible = !!id;
          if (id)
            (pallet.material as THREE.MeshStandardMaterial).color.setHex(
              [0xfb923c, 0xeab308, 0xa78bfa, 0x2dd4bf][
                M.findIndex((material) => material.id === id)
              ],
            );
        });
        binsRef.current.forEach((bin, index) => {
          const material = c.items[index];
          if (!material) return;
          const current = inventory.lineSideStock[material.id] ?? 0;
          const capacity = inventory.lineSideCapacity[material.id] ?? 1;
          const fill = Math.max(0, Math.min(1, current / capacity));
          bin.scale.y = Math.max(0.08, fill);
          bin.position.y = 0.08 + bin.scale.y * 0.5;
          const color =
            fill <= 0.15 ? 0xef4444 : fill <= 0.4 ? 0xf59e0b : 0x22c55e;
          (bin.material as THREE.MeshStandardMaterial).color.setHex(color);
          const label = labelElementsRef.current[`bin_${index}`];
          if (label) {
            label.textContent = `${material.name}: ${current.toFixed(0)}/${capacity} pcs · Line-side`;
            label.style.borderColor =
              fill <= 0.15 ? COL[2] : fill <= 0.4 ? COL[1] : COL[0];
          }
        });
        ["A", "B"].forEach((line) => {
          const label = labelElementsRef.current[`staging${line}`];
          if (label) {
            const waiting = amrsRef.current.filter(
              (vehicle) =>
                vehicle.kind === "AMR" &&
                vehicle.m.userData.line === line &&
                vehicle.blocked === "full",
            ).length;
            label.textContent = `STAGING ${line}: ${stagingCount(inventory, line)}/${inventory.capacityByLine[line]} kiện${waiting ? ` · ${waiting} xe chờ` : ""}`;
            label.title =
              "Tồn kiện trong animation; không phải số liệu dự báo. AMR dỡ hàng / AGV nhận hàng.";
          }
        });
        if (statusRefresh >= 0.5) {
          statusRefresh = 0;
          const stagingByLine = {
            A: stagingCount(inventory, "A"),
            B: stagingCount(inventory, "B"),
          };
          const amrMoving = amrsRef.current.filter(
            (vehicle) =>
              vehicle.kind === "AMR" &&
              vehicle.phase === "moving" &&
              !vehicle.blocked,
          ).length;
          const agvMovingByLine = Object.fromEntries(
            ["A", "B"].map((line) => [
              line,
              amrsRef.current.filter(
                (vehicle) =>
                  vehicle.kind === "AGV" &&
                  vehicle.m.userData.line === line &&
                  vehicle.phase === "moving" &&
                  !vehicle.blocked,
              ).length,
            ]),
          );
          setLiveMetrics({
            productionPerHour:
              simSecondsSinceRefresh > 0
                ? (producedSinceRefresh * 3600) / simSecondsSinceRefresh
                : 0,
            producedUnits: totalProduced,
            deliveredTrips: inventory.materials.reduce(
              (sum, material) =>
                sum +
                inventory.delivered[material.id] /
                  Math.max(1, inventory.tripQty[material.id]),
              0,
            ),
            stagingLoads: stagingByLine.A + stagingByLine.B,
            stagingByLine,
            lineSideByMaterial: { ...inventory.lineSideStock },
            lineRunning: { ...lineProductionAllowedRef.current },
            warehouseReplenished: Object.values(
              inventory.warehouseReplenished,
            ).reduce((sum, value) => sum + value, 0),
            amrMoving,
            agvMovingByLine,
          });
          producedSinceRefresh = 0;
          simSecondsSinceRefresh = 0;
        }
        if (pendingRunRef.current) {
          pendingRunRef.current.simulatedSeconds += simulationDt;
          if (pendingRunRef.current.simulatedSeconds >= 3600) {
            const runId = pendingRunRef.current.id;
            const actualResult = {
              simulatedMinutes: Math.round(
                pendingRunRef.current.simulatedSeconds / 60,
              ),
              producedUnits: totalProduced,
              deliveredTrips: inventory.materials.reduce(
                (sum, material) =>
                  sum +
                  inventory.delivered[material.id] /
                    Math.max(1, inventory.tripQty[material.id]),
                0,
              ),
              stagingByLine: {
                A: stagingCount(inventory, "A"),
                B: stagingCount(inventory, "B"),
              },
              lineSideByMaterial: { ...inventory.lineSideStock },
              lineRunning: { ...lineProductionAllowedRef.current },
              warehouseReplenished: Object.values(
                inventory.warehouseReplenished,
              ).reduce((sum, value) => sum + value, 0),
            };
            setRunHistory((previous) =>
              previous.map((run) =>
                run.id === runId ? { ...run, actualResult } : run,
              ),
            );
            setDone((previous) =>
              previous?.id === runId ? { ...previous, actualResult } : previous,
            );
            pendingRunRef.current = null;
          }
        }
      }

      prodsRef.current.forEach((p) => {
        if (!p.visible) return;
        p.userData.x += animationDt * 2.2 * (c.unitsPerHour / P.unitsPerHour);
        if (p.userData.x > 18.5) {
          p.visible = false;
          finishedGoods.receive(p.userData.L);
        }
        p.position.x = p.userData.x;
      });
      const outboundSpeeds = Object.fromEntries(["A", "B"].map(line => {
        const supplyAgv = amrsRef.current.find(vehicle => vehicle.kind === "AGV" && vehicle.m.userData.line === line);
        return [line, supplyAgv
          ? supplyAgv.totalLength / Math.max(0.1, supplyAgv.cycleMinutes - supplyAgv.handlingSeconds * 2 / 60)
          : FINISHED_GOODS.agvSceneSpeed];
      }));
      finishedGoods.update(animationDt, simulationDt, outboundSpeeds);
      const packingLabel = labelElementsRef.current["finishedPacking"]?.querySelector("small");
      if (packingLabel) {
        const status = finishedGoods.getStatus();
        packingLabel.textContent = status.map(line => `${line.line}: ${line.raw} chờ · ${line.workers} NV`).join(" / ");
        packingLabel.style.color = status.some(line => line.raw > 0) ? "#f59e0b" : "#5eead4";
      }

      R.render(S, cam);
      proj();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      viewportObserver.disconnect();
      cancelAnimationFrame(animId);
      clearAmrs();
      savedMainSceneRef.current?.fleet.forEach((vehicle) =>
        disposeObjects(vehicle.m),
      );
      savedMainSceneRef.current = null;
      resetCameraRef.current = null;
      cameraViewRef.current = null;
      cv.onpointerdown = null;
      cv.onpointerup = null;
      cv.onpointermove = null;
      cv.onpointerleave = null;
      hoverTooltip.remove();
      cv.onwheel = null;
      disposeObjects(S);
      S.clear();
      finishedGoodsRef.current = null;
      sceneRef.current = null;
      R.dispose();
    };
  }, []);

  useEffect(() => {
    const schedule = modelSequenceForMix(mix);
    const modelColors: Record<string, number> = {
      "ECU-A": 0x38bdf8,
      "Alternator-B": 0x7dd3fc,
      "Sensor-C": 0x0ea5e9,
    };
    ["A", "B"].forEach((line) => {
      const lineModels = schedule.filter(
        (model) =>
          (DEMO.production.lineByModel as Record<string, string>)[model] ===
          line,
      );
      const products = prodsRef.current.filter(
        (product) => product.userData.L === line,
      );
      products.forEach((product, index) => {
        const model = lineModels.length
          ? lineModels[index % lineModels.length]
          : null;
        product.visible = false;
        if (!model || product.userData.model === model) return;
        product.geometry.dispose();
        product.geometry =
          model === "Alternator-B"
            ? new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12)
            : new THREE.BoxGeometry(0.8, 0.5, 0.8);
        product.scale.setScalar(model === "Sensor-C" ? 0.7 : 1);
        (product.material as THREE.MeshStandardMaterial).color.setHex(
          modelColors[model] ?? modelColors["ECU-A"],
        );
        product.userData.model = model;
      });
    });
  }, [mix]);

  // Update pad and bin emissive/color highlights on calculation updates
  useEffect(() => {
    if (!padsRef.current) return;
    const c = viewportState.snapshot;
    const st = c.bottlenecks.map(
      (stage, index) =>
        [
          stage.name,
          stage.utilization,
          ["wh", "pk", "st", "tr", "la"][index],
          stage.level === "CRITICAL" ? 2 : stage.level === "WARNING" ? 1 : 0,
        ] as const,
    );

    st.forEach((x) => {
      const L = x[3];
      const targetPads =
        x[2] === "la"
          ? [padsRef.current?.la, padsRef.current?.lb]
          : [padsRef.current?.[x[2]]];
      targetPads.forEach((p) => {
        if (p && p.material) {
          (p.material as THREE.MeshStandardMaterial).emissive
            .set(COL[L])
            .multiplyScalar(L ? 0.3 : 0.06);
        }
      });
    });

    c.items.forEach((i, n) => {
      const bin = binsRef.current[n];
      if (bin && bin.material) {
        const mat = bin.material as THREE.MeshStandardMaterial;
        mat.color.set(COL[i.lvl]);
        mat.emissive.set(COL[i.lvl]).multiplyScalar(i.lvl ? 0.35 : 0.1);
      }
    });
  }, [viewportState.snapshot]);

  // Handle actions
  const handleDemoScenarioChange = (id: string) => {
    if (pendingRunRef.current) return;
    const scenario = DEMO.demoScenarios.find((item) => item.id === id);
    if (!scenario) return;
    restoreMainScene();
    const nextMix = { ...scenario.mix };
    const nextAgv = { ...scenario.resources.agvByLine };
    const nextFactor = scenario.productionPercent / 100;
    setPreviewScenarioId(null);
    setActiveDemoScenarioId(id);
    setF(nextFactor);
    setMix(nextMix);
    setAmr(scenario.resources.amr);
    setPackingWorkers({ ...FINISHED_GOODS.workersByLine });
    setAgvByLine(nextAgv);
    setLiveMetrics({
      productionPerHour: 0,
      producedUnits: 0,
      deliveredTrips: 0,
      stagingLoads: 0,
      stagingByLine: { A: 0, B: 0 },
      lineSideByMaterial: {},
      lineRunning: { A: false, B: false },
      warehouseReplenished: 0,
      amrMoving: 0,
      agvMovingByLine: { A: 0, B: 0 },
    });
    setDone(null);
    setActualUtilInput("");
    setUserSelected(false);
    executionLockRef.current = false;
    setExecutionLocked(false);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (pendingRunRef.current) return;
    setPreviewScenarioId(null);
    const val = Number(e.target.value) / 100;
    setF(val);
    setUserSelected(false);
    executionLockRef.current = false;
    setExecutionLocked(false);
  };

  const handleSelectScenario = (id: string) => {
    if (pendingRunRef.current) return;
    if (!scenariosWithRes.some((scenario) => scenario.id === id)) return;
    setSel(id);
    setUserSelected(true);
    setPreviewScenarioId(id);
    stageRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const handleApprove = () => {
    if (executionLockRef.current) return;
    const s = scenariosWithRes.find((x) => x.id === selectedSel);
    if (!s) return;
    setPreviewScenarioId(null);
    const before =
      scenariosWithRes.find((option) => option.isBaseline)?.res ?? currentCalc;
    const appliedFactor = s.res.unitsPerHour / P.unitsPerHour;
    const after = s.res;
    restoreMainScene();
    resetVisualStaging({
      snapshot: after,
      amrCount: s.resources.amrCount,
      agvByLine: s.resources.agvByLine,
      packingWorkers: s.resources.packingWorkers,
      amrCycleMinutes,
      agvCycleMinutes,
      loadsPerTrip,
    });
    const toRunMetrics = (result: typeof currentCalc): RunMetrics => ({
      utilization: result.util,
      capacity: result.cap,
      trips: result.trips,
      delay: result.delay,
      risk: result.risk,
      criticalMaterials: result.items.filter((item) => item.lvl === 2).length,
      warningMaterials: result.items.filter((item) => item.lvl === 1).length,
      amrUtilization: result.upstreamUtilization,
      amrCapacity: result.upstreamCapacity,
      agvLines: result.agvLines,
    });
    const record: RunRecord = {
      id: `${Date.now()}-${s.id}`,
      timestamp: new Date().toISOString(),
      scenarioId: s.id,
      name: `${activeDemoScenario.name} · ${s.name}`,
      demoScenarioId: activeDemoScenario.id,
      demoScenarioName: activeDemoScenario.name,
      productionPercent: Math.round(appliedFactor * 100),
      before: toRunMetrics(before),
      simulatedAfter: toRunMetrics(after),
      modelVersion: 4,
      dataSource: "demo-assumptions",
      assumptions: {
        mix: { ...mix },
        bom: structuredClone(bom),
        stocks: { ...materialStocks },
        amrCycleMinutes,
        agvCycleMinutes,
        loadsPerTrip,
      },
      resourcesBefore: { amr, agvByLine: { ...agvByLine }, packingWorkers: { ...packingWorkers } },
      resourcesAfter: {
        amr: s.resources.amrCount,
        agvByLine: { ...s.resources.agvByLine },
        packingWorkers: { ...s.resources.packingWorkers },
      },
      actualUtilization: null,
    };

    executionLockRef.current = true;
    setExecutionLocked(true);
    pendingRunRef.current = { id: record.id, simulatedSeconds: 0 };
    setF(appliedFactor);
    setAmr(s.resources.amrCount);
    setPackingWorkers(s.resources.packingWorkers);
    setAgvByLine(s.resources.agvByLine);
    setLiveMetrics({
      productionPerHour: 0,
      producedUnits: 0,
      deliveredTrips: 0,
      stagingLoads: 0,
      stagingByLine: { A: 0, B: 0 },
      lineSideByMaterial: {},
      lineRunning: { A: false, B: false },
      warehouseReplenished: 0,
      amrMoving: 0,
      agvMovingByLine: { A: 0, B: 0 },
    });
    setDone(record);
    setRunHistory((previous) =>
      [record, ...previous].slice(0, RUN_HISTORY_LIMIT),
    );
    setActualUtilInput("");
    setUserSelected(true);
  };

  const handleRecordActual = () => {
    if (!done || actualUtilInput === "") return;
    const actualUtilization = Number(actualUtilInput) / 100;
    if (
      !Number.isFinite(actualUtilization) ||
      actualUtilization < 0 ||
      actualUtilization > 2
    )
      return;
    const updated = { ...done, actualUtilization };
    setDone(updated);
    setRunHistory((previous) =>
      previous.map((run) => (run.id === done.id ? updated : run)),
    );
  };

  const handleStartNewEvaluation = () => {
    if (pendingRunRef.current) return;
    restoreMainScene();
    resetVisualStaging({
      snapshot: currentCalc,
      amrCount: amr,
      agvByLine,
      packingWorkers,
      amrCycleMinutes,
      agvCycleMinutes,
      loadsPerTrip,
    });
    setPreviewScenarioId(null);
    executionLockRef.current = false;
    setExecutionLocked(false);
    setUserSelected(false);
    setActualUtilInput("");
  };

  const handleReset = () => {
    const pendingId = pendingRunRef.current?.id;
    if (pendingId)
      setRunHistory((previous) =>
        previous.map((run) =>
          run.id === pendingId ? { ...run, cancelled: true } : run,
        ),
      );
    pendingRunRef.current = null;
    restoreMainScene();
    const resetMix = Object.fromEntries(
      P.mix.map((item) => [item.model, item.pct]),
    );
    finishedGoodsRef.current?.reset();
    const resetBom = Object.fromEntries(
      M.map((item) => [item.id, { ...item.usageByModel }]),
    );
    const resetStocks = Object.fromEntries(
      M.map((item) => [item.id, item.stock]),
    );
    const resetSnapshot = calc(
      1,
      RS.amr.available,
      RS.agv.byLine,
      resetMix,
      resetBom,
      resetStocks,
      RS.amr.cycleMinutes,
      RS.agv.cycleMinutes,
      RS.agv.loadsPerTrip,
      FINISHED_GOODS.workersByLine,
    );
    resetVisualStaging({
      snapshot: resetSnapshot,
      amrCount: RS.amr.available,
      agvByLine: { ...RS.agv.byLine },
      packingWorkers: { ...FINISHED_GOODS.workersByLine },
      amrCycleMinutes: RS.amr.cycleMinutes,
      agvCycleMinutes: RS.agv.cycleMinutes,
      loadsPerTrip: RS.agv.loadsPerTrip,
    });
    setPreviewScenarioId(null);
    setActiveDemoScenarioId(DEFAULT_SCENARIO.id);
    setAmr(RS.amr.available);
    setPackingWorkers({ ...FINISHED_GOODS.workersByLine });
    setAgvByLine({ ...RS.agv.byLine });
    setMix(resetMix);
    setBom(resetBom);
    setMaterialStocks(resetStocks);
    setAmrCycleMinutes(RS.amr.cycleMinutes);
    setAgvCycleMinutes(RS.agv.cycleMinutes);
    setLoadsPerTrip(RS.agv.loadsPerTrip);
    setF(1);
    setLiveMetrics({
      productionPerHour: 0,
      producedUnits: 0,
      deliveredTrips: 0,
      stagingLoads: 0,
      stagingByLine: { A: 0, B: 0 },
      lineSideByMaterial: {},
      lineRunning: { A: false, B: false },
      warehouseReplenished: 0,
      amrMoving: 0,
      agvMovingByLine: { A: 0, B: 0 },
    });
    executionLockRef.current = false;
    setExecutionLocked(false);
    setDone(null);
    setUserSelected(false);
    setActualUtilInput("");
  };

  // Helper calculation variables for UI rendering
  const c = currentCalc;
  const viewportCalc = viewportState.snapshot;
  const displayedOperators = Object.values(viewportState.packingWorkers).reduce((sum, count) => sum + count, 0);
  const liveMaterials = viewportCalc.items.map((item) => {
    const stock = liveMetrics.lineSideByMaterial[item.id] ?? 0;
    const eff =
      item.consumptionPerHour > 0 ? (stock / item.consumptionPerHour) * 60 : 0;
    return { ...item, stock, eff, lvl: stock <= 0 ? 2 : eff < 8 ? 1 : 0 };
  });
  const transportLevel =
    viewportCalc.util > 1
      ? "CRITICAL"
      : viewportCalc.util > 0.9
        ? "WARNING"
        : "NORMAL";
  const viewportLoadLevel =
    transportLevel === "CRITICAL" ? 2 : transportLevel === "WARNING" ? 1 : 0;
  const pct = Math.round(f * 100);
  const occ = c.stagingPallets;
  const lv = (u: number) => (u > 1 ? 2 : u > 0.9 ? 1 : 0);

  const st = c.bottlenecks.map(
    (stage, index) =>
      [
        stage.name,
        stage.utilization,
        ["wh", "pk", "st", "tr", "la"][index],
      ] as const,
  );

  const mx = Math.max(...st.map((x) => x[1]));
  const bottleneckItem = st.find((x) => x[1] === mx);
  const bottleneckLevel = lv(bottleneckItem?.[1] ?? 0);
  const bottleneckStatus =
    (bottleneckItem?.[1] ?? 0) > 1
      ? "Vượt công suất"
      : (bottleneckItem?.[1] ?? 0) > 0.9
        ? "Gần hết công suất"
        : "Còn trong công suất";
  const recScenario = scenariosWithRes.find((s) => s.id === rec);
  const selectedEvaluation = scenariosWithRes.find((s) => s.id === selectedSel);
  const scenarioDetails = scenariosWithRes.find(
    (s) => s.id === scenarioDetailsId,
  );
  const baselineEvaluation = scenariosWithRes.find(
    (option) => option.isBaseline,
  );
  const demoRiskMaterial = M.find(
    (material) => material.id === activeDemoScenario.risk.materialId,
  );
  const displayedRisk =
    activeDemoScenarioId === "plan_change"
      ? {
          ...activeDemoScenario.risk,
          delayMinutes: currentCalc.delay,
          causes: [
            `Kế hoạch ${Math.round(f * 100)}%: ${currentCalc.unitsPerHour.toFixed(0)} sản phẩm/giờ, cần ${currentCalc.trips.toFixed(0)} chuyến/giờ.`,
            `AMR Kho–Staging: ${(currentCalc.upstreamUtilization * 100).toFixed(0)}% tải.`,
            ...currentCalc.agvLines.map(
              (line) =>
                `AGV Line ${line.line}: ${(line.utilization * 100).toFixed(0)}% tải.`,
            ),
          ],
        }
      : activeDemoScenario.risk;
  const toggleLeftSection = (section: string) => {
    setExpandedLeftSection((current) => (current === section ? null : section));
  };

  const updateMixShare = (model: string, rawValue: number) => {
    if (pendingRunRef.current) return;
    const value = Math.max(0, Math.min(100, Math.round(rawValue || 0)));
    const otherModels = P.mix
      .map((item) => item.model)
      .filter((item) => item !== model);
    const oldTotal = otherModels.reduce(
      (sum, item) => sum + (mix[item] ?? 0),
      0,
    );
    const remaining = 100 - value;
    const next: Record<string, number> = { ...mix, [model]: value };
    let assigned = 0;
    otherModels.forEach((item, index) => {
      const share =
        index === otherModels.length - 1
          ? remaining - assigned
          : oldTotal > 0
            ? Math.round((remaining * (mix[item] ?? 0)) / oldTotal)
            : Math.floor(remaining / otherModels.length);
      next[item] = share;
      assigned += share;
    });
    setMix(next);
    setPreviewScenarioId(null);
  };

  const updateBomUsage = (
    materialId: string,
    model: string,
    rawValue: number,
  ) => {
    if (pendingRunRef.current) return;
    const value = Number.isFinite(rawValue)
      ? Math.max(0, Math.min(10000, rawValue))
      : 0;
    setBom((previous) => ({
      ...previous,
      [materialId]: { ...previous[materialId], [model]: value },
    }));
    setPreviewScenarioId(null);
  };

  const updateMaterialStock = (materialId: string, rawValue: number) => {
    if (pendingRunRef.current) return;
    const value = Number.isFinite(rawValue)
      ? Math.max(0, Math.round(rawValue))
      : 0;
    setMaterialStocks((previous) => ({ ...previous, [materialId]: value }));
    setPreviewScenarioId(null);
  };

  return (
    <>
      <header className="app-header">
        <div className="dashboard-brand">
          <b>DENSO</b>
          <div>
            <h1>Logistics Forecasting</h1>
            <small>Dự đoán điểm nghẽn và đề xuất đối sách</small>
          </div>
        </div>

        <nav className="header-nav" aria-label="Điều hướng dashboard">
          {[
            ["Tổng quan", "#stage"],
            ["Mô phỏng", "#comparison-panel"],
            ["Phân tích", "#trend-panel"],
            ["Nguồn lực", "#resource-summary"],
          ].map(([label, target]) => (
            <a
              key={target}
              href={target}
              className={
                !isHistoryOpen && activeHeaderSection === target ? "active" : ""
              }
              aria-current={
                !isHistoryOpen && activeHeaderSection === target
                  ? "location"
                  : undefined
              }
              onClick={() => setActiveHeaderSection(target)}
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            className={isHistoryOpen ? "active" : ""}
            aria-haspopup="dialog"
            aria-expanded={isHistoryOpen}
            aria-controls="run-history"
            onClick={() => {
              if (historyDialogRef.current && !historyDialogRef.current.open) {
                historyDialogRef.current.showModal();
                setIsHistoryOpen(true);
              }
            }}
          >
            Lịch sử
          </button>
        </nav>

        <div className="header-controls">
          <div className="header-context">
            <span className="demo-assumption-badge" title={DEMO.label}>
              DEMO · GIẢ ĐỊNH
            </span>
            <span className="simulation-badge">
              <i /> Mô phỏng đang chạy
            </span>
            <span>{P.shift}</span>
          </div>

          <div className="sl">
            <label htmlFor="f">Kế hoạch</label>
            <input
              id="f"
              type="range"
              min="80"
              max="120"
              step="5"
              value={pct}
              title="Điều chỉnh sản lượng mục tiêu; nhu cầu vật tư, tải dự báo và nhịp mô phỏng cập nhật theo kế hoạch."
              onChange={handleSliderChange}
            />
            <div
              className="big"
              id="fv"
              style={{ color: pct > 100 ? "#f59e0b" : "" }}
            >
              {pct}%
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <aside className="side-panel side-panel-left">
          <FactoryOverview
            production={liveMetrics.productionPerHour}
            percent={
              viewportCalc.unitsPerHour
                ? Math.round(
                    (liveMetrics.productionPerHour /
                      viewportCalc.unitsPerHour) *
                      100,
                  )
                : 0
            }
            utilization={viewportCalc.upstreamUtilization}
            delay={viewportCalc.delay}
            amr={viewportState.amrCount}
            amrMoving={liveMetrics.amrMoving}
            attentionCount={liveMaterials.filter((item) => item.lvl > 0).length}
            agvByLine={viewportState.agvByLine}
            agvMovingByLine={liveMetrics.agvMovingByLine}
            agvLoads={viewportCalc.agvLines}
            operators={displayedOperators}
            occupied={liveMetrics.stagingLoads}
            stagingCapacity={RS.staging.pallets}
            materials={liveMaterials}
            producedUnits={liveMetrics.producedUnits}
            lineRunning={liveMetrics.lineRunning}
            deliveredTrips={liveMetrics.deliveredTrips}
            warehouseReplenished={liveMetrics.warehouseReplenished}
          />
          <details className="left-secondary">
            <summary>Chi tiết kế hoạch & công đoạn</summary>
            <section
              className={`card bottleneck-summary ${TXT[bottleneckLevel]}`}
              aria-label="Công đoạn tải cao nhất"
            >
              <div className="compact-card-label">Mức tải cao nhất</div>
              <strong>
                {bottleneckItem ? bottleneckItem[0] : "Chưa có dữ liệu"}
              </strong>
              <div className="bottleneck-summary-bottom">
                <span>
                  {(bottleneckItem?.[1] ?? 0) > 1
                    ? "Vượt công suất"
                    : (bottleneckItem?.[1] ?? 0) > 0.9
                      ? "Gần hết công suất"
                      : "Trong mức bình thường"}
                </span>
                <b>{((bottleneckItem?.[1] ?? 0) * 100).toFixed(0)}%</b>
              </div>
            </section>

            <section className="card panel-disclosure">
              <button
                className="disclosure-toggle"
                aria-expanded={expandedLeftSection === "plan"}
                onClick={() => toggleLeftSection("plan")}
              >
                <span>Kế hoạch</span>
                <small>
                  {P.shift} · {P.mix.length} mẫu
                </small>
                <i>{expandedLeftSection === "plan" ? "−" : "+"}</i>
              </button>
              {expandedLeftSection === "plan" && (
                <div className="disclosure-content" id="plan">
                  <div className="row">
                    <span>Sản lượng</span>
                    <b>{c.units.toFixed(0)} sản phẩm/giờ</b>
                  </div>
                  <div className="mix-list">
                    {P.mix.map((m, i) => (
                      <div className="mix-item" key={i}>
                        <div>
                          <span>{m.model}</span>
                          <b>{mix[m.model] ?? 0}%</b>
                        </div>
                        <div className="mix-track">
                          <i style={{ width: `${mix[m.model] ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <details className="material-ledger">
                    <summary>Sổ vật tư mô phỏng · pcs</summary>
                    <p>
                      Kho + đang vận chuyển + staging + line-side + đã tiêu thụ
                      = tồn ban đầu + lượng kho demo bổ sung. Preview có sổ
                      riêng.
                    </p>
                    <div className="ledger-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Vật tư</th>
                            <th>Kho</th>
                            <th>Kho bổ sung</th>
                            <th>Trên xe</th>
                            <th>Staging</th>
                            <th>Line-side</th>
                            <th>Tiêu thụ</th>
                            <th>Tổng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {M.map((material) => (
                            <tr key={material.id}>
                              <th>{material.name}</th>
                              {[
                                "warehouse",
                                "replenished",
                                "transit",
                                "staging",
                                "line",
                                "consumed",
                                "total",
                              ].map((field) => (
                                <td
                                  key={field}
                                  id={`ledger-${material.id}-${field}`}
                                >
                                  —
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  <div className="demo-assumptions-editor">
                    <div className="assumption-block">
                      <div className="assumption-heading">
                        <b>Mix sản phẩm</b>
                        <small>
                          tổng 100% · chỉnh một mẫu sẽ phân bổ lại phần còn lại
                        </small>
                      </div>
                      <div className="mix-input-grid">
                        {P.mix.map((item) => (
                          <label key={item.model}>
                            <span>{item.model}</span>
                            <div>
                              <input
                                aria-label={`Tỷ lệ ${item.model}`}
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={mix[item.model] ?? 0}
                                onChange={(event) =>
                                  updateMixShare(
                                    item.model,
                                    Number(event.target.value),
                                  )
                                }
                              />
                              <b>%</b>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="assumption-block">
                      <div className="assumption-heading">
                        <b>BOM demo · pcs/sản phẩm</b>
                        <small>{DEMO.materials.bomNote}</small>
                      </div>
                      <div className="bom-model-head">
                        <span>Vật tư / tồn kho</span>
                        {P.mix.map((item) => (
                          <span key={item.model}>{item.model}</span>
                        ))}
                      </div>
                      {M.map((material) => (
                        <div className="bom-edit-row" key={material.id}>
                          <div className="bom-material-name">
                            <b>{material.name}</b>
                            <label>
                              Tồn khởi tạo{" "}
                              <input
                                aria-label={`Tồn khởi tạo ${material.name}`}
                                type="number"
                                min="0"
                                step="1"
                                value={materialStocks[material.id] ?? 0}
                                onChange={(event) =>
                                  updateMaterialStock(
                                    material.id,
                                    Number(event.target.value),
                                  )
                                }
                              />{" "}
                              pcs
                            </label>
                          </div>
                          {P.mix.map((item) => (
                            <label className="bom-value" key={item.model}>
                              <span>{item.model}</span>
                              <input
                                aria-label={`${material.name} trong BOM ${item.model}`}
                                title={`Vật tư thuộc Line ${material.line}; model phải cùng line trong cấu hình demo`}
                                disabled={
                                  (
                                    DEMO.production.lineByModel as Record<
                                      string,
                                      string
                                    >
                                  )[item.model] !== material.line
                                }
                                type="number"
                                min="0"
                                max="10000"
                                step="0.1"
                                value={bom[material.id]?.[item.model] ?? 0}
                                onChange={(event) =>
                                  updateBomUsage(
                                    material.id,
                                    item.model,
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="assumption-block cycle-edit-grid">
                      <label>
                        Chu kỳ AMR · phút
                        <input
                          disabled={!!pendingRunRef.current}
                          type="number"
                          min="1"
                          max="240"
                          step="1"
                          value={amrCycleMinutes}
                          onChange={(event) => {
                            setAmrCycleMinutes(
                              Math.max(1, Number(event.target.value) || 1),
                            );
                            setPreviewScenarioId(null);
                          }}
                        />
                      </label>
                      <label>
                        Chu kỳ AGV · phút
                        <input
                          disabled={!!pendingRunRef.current}
                          type="number"
                          min="1"
                          max="240"
                          step="1"
                          value={agvCycleMinutes}
                          onChange={(event) => {
                            setAgvCycleMinutes(
                              Math.max(1, Number(event.target.value) || 1),
                            );
                            setPreviewScenarioId(null);
                          }}
                        />
                      </label>
                      <label>
                        Kiện/chuyến AMR & AGV
                        <input
                          disabled={!!pendingRunRef.current}
                          type="number"
                          min="1"
                          max="2"
                          value={loadsPerTrip}
                          onChange={(event) => {
                            setLoadsPerTrip(
                              Math.max(
                                1,
                                Math.min(2, Number(event.target.value) || 1),
                              ),
                            );
                            setPreviewScenarioId(null);
                          }}
                        />
                      </label>
                      <small>
                        Năng lực được tính bằng 60 ÷ chu kỳ. Các số liệu là giả
                        định demo.
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="card panel-disclosure">
              <button
                className="disclosure-toggle"
                aria-expanded={expandedLeftSection === "flow"}
                onClick={() => toggleLeftSection("flow")}
              >
                <span>Theo dõi quy trình</span>
                <small>{bottleneckStatus}</small>
                <i>{expandedLeftSection === "flow" ? "−" : "+"}</i>
              </button>
              {expandedLeftSection === "flow" && (
                <div className="disclosure-content flow-detail" id="flow">
                  {st.map((x, i) => (
                    <div className="flow-stage" key={i}>
                      <div className="flow-stage-heading">
                        <span>{x[0]}</span>
                        <b className={TXT[lv(x[1])]}>
                          {(x[1] * 100).toFixed(0)}%
                        </b>
                      </div>
                      <div className="flow-track">
                        <i
                          style={{
                            width: `${Math.min(100, x[1] * 100)}%`,
                            background: COL[lv(x[1])],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="row">
                    <span>Thời gian giao trễ</span>
                    <b>{c.delay.toFixed(0)} phút</b>
                  </div>
                </div>
              )}
            </section>
          </details>
        </aside>

        <div className="center-panel">
          <section id="stage" ref={stageRef}>
            <canvas id="c" ref={canvasRef}></canvas>
            <div className="viewport-toolbar">
              <span className="viewport-title">
                <UiIcon kind="box" /> 3D Digital Twin
              </span>
              <span className="viewport-location">
                Nhà máy DENSO · Line A & B
              </span>
              <div className="viewport-controls">
                <label
                  className="viewport-scenario"
                  title="Kịch bản demo nạp sẵn; số liệu forecast là giả định để trình diễn."
                >
                  Tình huống
                  <select
                    aria-label="Chọn tình huống demo"
                    value={activeDemoScenarioId}
                    disabled={executionLocked && !done?.actualResult}
                    onChange={(event) =>
                      handleDemoScenarioChange(event.target.value)
                    }
                  >
                    {DEMO.demoScenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                </label>
                <select
                  aria-label="Góc nhìn nhà máy"
                  value={cameraView}
                  onChange={(event) => {
                    setCameraView(event.target.value);
                    cameraViewRef.current?.(event.target.value);
                  }}
                >
                  <option value="overview">Toàn cảnh</option>
                  <option value="warehouse">Kho</option>
                  <option value="staging">Staging</option>
                  <option value="lineA">Line A</option>
                  <option value="lineB">Line B</option>
                </select>
                <label
                  className="viewport-speed"
                  title="1× = một phút mô phỏng mỗi giây thực; xe chạy theo nhịp demo cố định."
                >
                  Tốc độ
                  <select
                    aria-label="Tốc độ mô phỏng"
                    value={simulationSpeed}
                    onChange={(event) => {
                      const speed = Number(event.target.value);
                      simulationSpeedRef.current = speed;
                      setSimulationSpeed(speed);
                    }}
                  >
                    <option value={1}>1× · demo</option>
                    <option value={2}>2×</option>
                    <option value={4}>4×</option>
                    <option value={8}>8×</option>
                  </select>
                </label>
              </div>
              <button
                onClick={() => resetCameraRef.current?.()}
                title="Khôi phục góc nhìn ban đầu"
              >
                Đặt lại góc nhìn
              </button>
            </div>
            <div className="hint">Kéo chuột: xoay · Cuộn: zoom</div>
            {previewScenario && (
              <div className="viewport-preview-status" role="status">
                <div>
                  <b>Đang xem thử: {previewScenario.name}</b>
                  <small>
                    {viewportState.amrCount} AMR ·{" "}
                    {Object.values(viewportState.agvByLine).reduce(
                      (sum, count) => sum + count,
                      0,
                    )}{" "}
                    AGV · chưa áp dụng
                  </small>
                </div>
                <button onClick={() => setPreviewScenarioId(null)}>
                  Về hiện trạng
                </button>
              </div>
            )}

            {/* 3D Label Overlays */}
            {[
              ["warehouse", "l1", "KHO LINH KIỆN"],
              ["picking", "l2", "PICKING / KITTING"],
              ["staging", "l3", "STAGING"],
              ["transport", "l4", "VẬN CHUYỂN"],
            ].map(([id, labelId, title]) => {
              const stage = viewportCalc.bottlenecks.find(
                (item) => item.id === id,
              );
              const color =
                COL[
                  stage?.level === "CRITICAL"
                    ? 2
                    : stage?.level === "WARNING"
                      ? 1
                      : 0
                ];
              return (
                <div
                  key={id}
                  className="lb z stage-label"
                  style={{ borderColor: color }}
                  ref={(el) => {
                    labelElementsRef.current[labelId] = el;
                  }}
                >
                  {title}
                  <small style={{ color }}>
                    {((stage?.utilization ?? 0) * 100).toFixed(0)}% tải
                    {stage?.level === "CRITICAL"
                      ? " · Quá tải"
                      : stage?.level === "WARNING"
                        ? " · Cảnh báo"
                        : ""}
                  </small>
                  {id === "transport" && (
                    <span className="viewport-label-extra">
                      A: {viewportState.agvByLine.A} AGV / B:{" "}
                      {viewportState.agvByLine.B} AGV
                    </span>
                  )}
                </div>
              );
            })}
            {[
              ["finishedPacking", "ĐÓNG GÓI THÀNH PHẨM"],
              ["finishedWarehouse", "KHO THÀNH PHẨM"],
            ].map(([id, title]) => (
              <div key={id} className="lb z stage-label"
                style={{ borderColor: "#5eead4" }}
                ref={(el) => { labelElementsRef.current[id] = el; }}>
                {title}
                {id === "finishedPacking" && <small style={{ color: "#5eead4" }}>Hàng chờ đóng gói</small>}
              </div>
            ))}
            <div
              className="lb z"
              ref={(el) => {
                labelElementsRef.current["l5"] = el;
              }}
            >
              ⑤ LINE A
            </div>
            <div
              className="lb z"
              ref={(el) => {
                labelElementsRef.current["l6"] = el;
              }}
            >
              ⑤ LINE B
            </div>
            <div
              className="lb z"
              ref={(el) => {
                labelElementsRef.current["stagingA"] = el;
              }}
            >
              STAGING A · Nhận hàng / trả rỗng
            </div>
            <div
              className="lb z"
              ref={(el) => {
                labelElementsRef.current["stagingB"] = el;
              }}
            >
              STAGING B · Nhận hàng / trả rỗng
            </div>

            {cameraView === "staging" &&
              ["A", "B"].map((line) => (
                <React.Fragment key={`dock-${line}`}>
                  <div
                    className="lb"
                    ref={(el) => {
                      labelElementsRef.current[`amrDock${line}`] = el;
                    }}
                  >
                    AMR · Dỡ hàng {line}
                  </div>
                  <div
                    className="lb"
                    ref={(el) => {
                      labelElementsRef.current[`agvDock${line}`] = el;
                    }}
                  >
                    AGV · Nhận hàng {line}
                  </div>
                </React.Fragment>
              ))}

            {viewportCalc.items.map((i, n) => (
              <div
                key={n}
                className="lb"
                style={{ borderColor: COL[i.lvl] }}
                ref={(el) => {
                  labelElementsRef.current[`bin_${n}`] = el;
                }}
              >
                Line {i.line} · {i.name}: {i.eff.toFixed(0)}p
              </div>
            ))}

            {fleetFor(viewportState).map(
              ({ index, kind, material }, fleetIndex) => (
                <div
                  key={`${kind}-${material.line}-${index}`}
                  className={`lb vehicle-label ${kind === "AGV" ? "agv-label" : "amr-label"}`}
                  title={`${material.name} · Line ${material.line}`}
                  ref={(el) => {
                    labelElementsRef.current[`vehicle_${fleetIndex}`] = el;
                  }}
                >
                  {kind}-{kind === "AGV" ? `${material.line}-` : ""}
                  {String(index + 1).padStart(2, "0")}
                </div>
              ),
            )}
            <details className="scene-legend" open>
              <summary>Chú giải</summary>
              <div>
                <i className="legend-amr" />
                AMR <b>{viewportState.amrCount}</b>
              </div>
              <div>
                <i style={{ background: "#facc15" }} />
                AGV{" "}
                <b>
                  {Object.values(viewportState.agvByLine).reduce(
                    (sum, count) => sum + count,
                    0,
                  )}
                </b>
              </div>
              <div>
                <i className="legend-package" />
                Kiện vật tư
              </div>
              <div>
                <i className="legend-buffer" />
                Thùng vật tư tại chuyền
              </div>
              <div>
                <i className="legend-product" />
                Sản phẩm trên chuyền
              </div>
              <div>
                <i style={{ background: "#a78bfa" }} />
                AMR: Kho–Staging
              </div>
              <div>
                <i className="legend-delivery" />
                AGV: Line A
              </div>
              <div>
                <i className="legend-line-b" />
                AGV: Line B
              </div>
              <p>
                <span className="g">●</span> Bình thường{" "}
                <span className="a">●</span> Cảnh báo{" "}
                <span className="r">●</span> Nguy cơ
              </p>
            </details>

            <div className="scene-summary" aria-label="Tóm tắt quyết định">
              <div>
                <small>Kế hoạch</small>
                <b>
                  {viewportCalc.units.toFixed(0)} sp/giờ · {pct}%
                </b>
              </div>
              <div>
                <small>Nhu cầu</small>
                <b>{viewportCalc.trips.toFixed(0)} chuyến/giờ</b>
              </div>
              <div>
                <small>Năng lực hai chặng</small>
                <b
                  title={`AMR ${viewportCalc.upstreamCapacity} · AGV A/B ${viewportCalc.agvLines.map((line) => line.capacity).join("/")}`}
                >
                  {viewportCalc.cap.toFixed(0)} chuyến/giờ
                </b>
              </div>
              <div>
                <small>Mức tải cao nhất · trễ</small>
                <b className={TXT[viewportLoadLevel]}>
                  {(viewportCalc.util * 100).toFixed(0)}% ·{" "}
                  {viewportCalc.delay.toFixed(0)} phút
                </b>
              </div>
            </div>
          </section>

          <section
            ref={comparisonRef}
            id="comparison-panel"
            tabIndex={-1}
            className="comparison-panel"
            aria-labelledby="comparison-title"
          >
            <div className="comparison-header">
              <div>
                <h2 id="comparison-title">
                  <UiIcon kind="chart" /> So sánh kịch bản (What-if Analysis)
                </h2>
              </div>
              <span className="comparison-context">
                <p>Kế hoạch {pct}% · chọn kịch bản để xem mô phỏng và dự báo</p>
              </span>
            </div>
            <div className="scenario-table-scroll">
              <table className="scenario-table">
                <thead>
                  <tr>
                    <th scope="col">Kịch bản</th>
                    <th scope="col">Năng lực</th>
                    <th scope="col">Mức tải cao nhất</th>
                    <th scope="col">Sản lượng</th>
                    <th scope="col">Tải đóng gói</th>
                    <th scope="col">Chờ đóng gói/giờ</th>
                    <th scope="col">Giao trễ (phút)</th>
                    <th scope="col">Chi phí nguồn lực</th>
                    <th scope="col">Đánh giá</th>
                    <th scope="col">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedScenarios.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className={item.id === selectedSel ? "selected" : ""}>
                        <th scope="row">
                          <button
                            onClick={() => handleSelectScenario(item.id)}
                            aria-pressed={item.id === selectedSel}
                          >
                            <UiIcon
                              kind={
                                item.addAmr
                                  ? "robot"
                                  : item.addAgv
                                    ? "box"
                                    : "clock"
                              }
                            />
                            <span>
                              {item.name}
                              {item.id === rec && (
                                <small className="g">Khuyến nghị</small>
                              )}
                            </span>
                          </button>
                        </th>
                        <td>{item.res.cap.toFixed(0)}</td>
                        <td className={TXT[lv(item.res.util)]}>
                          {(item.res.util * 100).toFixed(0)}%
                        </td>
                        <td>{item.res.units.toFixed(0)}</td>
                        <td className={item.res.packing.utilization > 1 ? "r" : "g"}>
                          {(item.res.packing.utilization * 100).toFixed(0)}%
                        </td>
                        <td className={item.res.packing.backlogPerHour > 0 ? "r" : "g"}>
                          {item.res.packing.backlogPerHour.toFixed(0)}
                        </td>
                        <td className={item.res.delay > 0 ? "r" : "g"}>
                          {item.res.delay.toFixed(0)}
                        </td>
                        <td>+{item.cost}</td>
                        <td>
                          <b>{item.score}</b>
                          {item.id === selectedSel && (
                            <small className="table-selection">Đang chọn</small>
                          )}
                        </td>
                        <td>
                          <button
                            className="s scenario-details-button"
                            onClick={() => setScenarioDetailsId(item.id)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="comparison-footer">
              <span>
                Đang chọn: <b>{selectedEvaluation?.name}</b>
              </span>
              <span>
                Ưu tiên phương án trong ngưỡng tải AMR/AGV · sau đó so sánh điểm
              </span>
            </div>
            {scenarioDetails && (
              <div
                className="scenario-modal-backdrop"
                onClick={() => setScenarioDetailsId(null)}
              >
                <section
                  className="scenario-detail-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="scenario-detail-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="section-heading">
                    <h2 id="scenario-detail-title">
                      Chi tiết: {scenarioDetails.name}
                    </h2>
                    <button
                      type="button"
                      className="s"
                      onClick={() => setScenarioDetailsId(null)}
                      aria-label="Đóng chi tiết"
                    >
                      Đóng ×
                    </button>
                  </div>
                  <p className="section-description">
                    So sánh nguồn lực hiện tại với phương án đã chọn.
                  </p>
                  <div className="scenario-detail-table-scroll">
                    <table className="scenario-detail-table">
                      <thead>
                        <tr>
                          <th>Nguồn lực</th>
                          <th>Hiện tại</th>
                          <th>Sau khi áp dụng</th>
                          <th>Thay đổi</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>AMR Kho–Staging</th>
                          <td>{amr}</td>
                          <td>{scenarioDetails.resources.amrCount}</td>
                          <td>
                            {scenarioDetails.resources.amrCount - amr > 0
                              ? "+"
                              : ""}
                            {scenarioDetails.resources.amrCount - amr}
                          </td>
                        </tr>
                        {["A", "B"].map((line) => {
                          const before = agvByLine[line] ?? 0;
                          const after =
                            scenarioDetails.resources.agvByLine[line] ?? 0;
                          return (
                            <tr key={line}>
                              <th>AGV Line {line}</th>
                              <td>{before}</td>
                              <td>{after}</td>
                              <td>
                                {after - before > 0 ? "+" : ""}
                                {after - before}
                              </td>
                            </tr>
                          );
                        })}
                        {["A", "B"].map(line => (
                          <tr key={`packing-${line}`}>
                            <th>Nhân viên đóng gói Line {line}</th>
                            <td>{packingWorkers[line]}</td>
                            <td>{scenarioDetails.resources.packingWorkers[line]}</td>
                            <td>+{scenarioDetails.resources.packingWorkers[line] - packingWorkers[line]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="scenario-detail-output">
                    Sản lượng mục tiêu: {currentCalc.unitsPerHour.toFixed(0)} →{" "}
                    {scenarioDetails.res.unitsPerHour.toFixed(0)} sản phẩm/giờ (
                    {Math.round(
                      (currentCalc.unitsPerHour / P.unitsPerHour) * 100,
                    )}
                    % →{" "}
                    {Math.round(
                      (scenarioDetails.res.unitsPerHour / P.unitsPerHour) * 100,
                    )}
                    %).
                  </p>
                </section>
              </div>
            )}
          </section>
          <div className="analytics-row">
            <TrendPanel
              production={liveMetrics.productionPerHour}
              utilization={viewportCalc.util}
              delay={viewportCalc.delay}
            />
            <ResourceAllocation
              utilization={viewportCalc.upstreamUtilization}
              occupied={liveMetrics.stagingLoads}
              stagingCapacity={RS.staging.pallets}
              amr={viewportState.amrCount}
              agvByLine={viewportState.agvByLine}
              agvLoads={viewportCalc.agvLines}
              operators={displayedOperators}
            />
          </div>
        </div>
        <aside className="side-panel side-panel-right">
          <div className="section-heading">
            <h2>Cảnh báo điểm nghẽn</h2>
            <span className="insight-model">Kịch bản demo nạp sẵn</span>
          </div>
          <span
            className={`line-badge ${TXT[displayedRisk.delayMinutes > 0 ? 1 : 0]}`}
          >
            Line {displayedRisk.line}
          </span>
          {/* <p className="section-description">
            {activeDemoScenario.description} Số forecast là giả định demo.
          </p> */}
          <section
            id="risk"
            className={`insight-alert ${displayedRisk.delayMinutes > 0 ? "attention" : "safe"}`}
          >
            <h3>
              <UiIcon kind="box" />
              {demoRiskMaterial
                ? `Nguy cơ thiếu ${demoRiskMaterial.name} tại Line ${displayedRisk.line}`
                : activeDemoScenario.name}
            </h3>
            <dl className="insight-facts">
              <div>
                <dt>Thời gian giao trễ dự báo</dt>
                <dd>
                  {Math.max(0, Math.round(displayedRisk.delayMinutes))} phút (dự
                  báo)
                </dd>
              </div>
              <div>
                <dt>Độ tin cậy</dt>
                <dd>{displayedRisk.confidence}%</dd>
              </div>
            </dl>
            <h4>Cơ sở dự báo</h4>
            <ul>
              {displayedRisk.causes.map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          </section>
          <section id="rec" className="insight-recommendation">
            <section className="packing-status" aria-labelledby="packing-status-title">
              <div className="packing-status-heading">
                <h3 id="packing-status-title">Nhân lực đóng gói</h3>
                <span className={`packing-status-badge ${viewportCalc.packing.backlogPerHour > 0 ? "is-blocked" : "is-clear"}`}>
                  {viewportCalc.packing.backlogPerHour > 0
                    ? <><TriangleAlert size={14} aria-hidden="true" /> Có điểm nghẽn</>
                    : <><CircleCheck size={14} aria-hidden="true" /> Không có điểm nghẽn</>}
                </span>
              </div>
              {viewportCalc.packing.lines.map(line => {
                const blocked = line.backlogPerHour > 0;
                const loadText = Number.isFinite(line.utilization) ? `${(line.utilization * 100).toFixed(0)}%` : "Không có nhân viên";
                return (
                  <article key={line.line} className={`packing-line-card ${blocked ? "is-blocked" : "is-clear"}`}>
                    <div className="packing-line-heading">
                      <strong>Line {line.line}</strong>
                      <div className="packing-line-actions">
                        <span><UsersRound size={15} aria-hidden="true" /> {line.workers} nhân viên</span>
                        <div className="packing-info">
                          <button type="button" className="packing-info-button"
                            aria-label={`Chi tiết tình trạng đóng gói Line ${line.line}`}
                            aria-describedby={`packing-info-${line.line}`}>
                            <Info size={16} aria-hidden="true" />
                          </button>
                          <div id={`packing-info-${line.line}`} role="tooltip" className="packing-info-tooltip">
                            <strong>{blocked ? "Thiếu nhân lực đóng gói" : "Đủ nhân lực đóng gói"}</strong>
                            <span>{blocked
                              ? `Hàng chờ tăng ${line.backlogPerHour.toFixed(0)} sản phẩm/giờ`
                              : line.utilization >= 1 - 1e-6 ? "Đáp ứng kế hoạch, đang dùng hết công suất" : "Đáp ứng kế hoạch, không phát sinh tồn do thiếu nhân lực"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="packing-line-load">
                      <span>Mức sử dụng nhân lực</span>
                      <strong>{loadText}</strong>
                    </div>
                    <div className="packing-load-track" role="progressbar" aria-label={`Tải đóng gói Line ${line.line}`}
                      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, line.utilization * 100))}
                      aria-valuetext={loadText}>
                      <span style={{ width: `${Math.min(100, Math.max(0, line.utilization * 100))}%` }} />
                    </div>
                    <div className="packing-line-capacity">
                      <span>Nhu cầu <b>{line.demand.toFixed(0)}</b></span>
                      <span>Năng lực <b>{line.capacity.toFixed(0)}</b></span>
                      <small>sản phẩm/giờ</small>
                    </div>
                  </article>
                );
              })}
            </section>
            <div className="section-heading">
              <h2>Đề xuất phương án</h2>
              <span className="model-badge">Tính theo đầu vào hiện tại</span>
            </div>
            {/* <p className="score-explanation">
              Các lựa chọn được nạp sẵn; tải, trễ và rủi ro tính lại theo kế
              hoạch, Model Mix, BOM và nguồn lực hiện tại. Điểm 0–100 = 55% mức giảm giao trễ + 30% mức giảm rủi ro vật tư + 15% điểm tiết kiệm chi phí,
              tính so với kế hoạch hiện tại. Điểm cao hơn tốt hơn. Khuyến nghị ưu tiên phương án mỗi line
              AMR/AGV không vượt 85% tải; nếu không có phương án đạt, dùng điểm cao nhất. Áp dụng chỉ đổi trạng thái mô phỏng.
            </p> */}
            {selectedEvaluation && (
              <div className="recommendation-box">
                <div className="section-heading">
                  <h3>{selectedEvaluation.name}</h3>
                  <span
                    className={
                      selectedSel === rec
                        ? "recommendation-badge"
                        : "selection-badge"
                    }
                  >
                    {selectedSel === rec ? "Khuyến nghị" : "Đang chọn"}
                  </span>
                </div>
                <p className="section-description">
                  {selectedEvaluation.addAmr ||
                  selectedEvaluation.addAgv ||
                  selectedEvaluation.res.unitsPerHour !==
                    currentCalc.unitsPerHour
                    ? `${selectedEvaluation.addAmr ? `+${selectedEvaluation.addAmr} AMR Kho–Staging. ` : ""}${selectedEvaluation.addAgv ? `+${selectedEvaluation.addAgv} AGV cấp Line ${selectedEvaluation.resources.targetLine}. ` : ""}${selectedEvaluation.res.unitsPerHour !== currentCalc.unitsPerHour ? `Sản lượng về ${Math.round((selectedEvaluation.res.unitsPerHour / P.unitsPerHour) * 100)}%.` : ""}`
                    : "Giữ nguyên nguồn lực cấp vật tư hiện tại."}
                </p>
                {Object.entries(selectedEvaluation.addPackingByLine ?? {}).map(([line, count]) => (
                  <p key={line} className="section-description">+{count} nhân viên đóng gói Line {line} · {packingWorkers[line]} → {selectedEvaluation.resources.packingWorkers[line]} người.</p>
                ))}
                <dl className="recommendation-metrics">
                  <div>
                    <dt>
                      <UiIcon kind="robot" />
                      Năng lực vận chuyển
                    </dt>
                    <dd>
                      {c.cap.toFixed(0)} →{" "}
                      {selectedEvaluation.res.cap.toFixed(0)} chuyến/h
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <UiIcon kind="chart" />
                      Mức tải cao nhất AMR/AGV
                    </dt>
                    <dd>
                      {(c.util * 100).toFixed(0)}% →{" "}
                      {(selectedEvaluation.res.util * 100).toFixed(0)}%
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <UiIcon kind="clock" />
                      Thời gian giao trễ
                    </dt>
                    <dd>
                      {c.delay.toFixed(0)} →{" "}
                      {selectedEvaluation.res.delay.toFixed(0)} phút
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <UiIcon kind="box" />
                      Vật tư dự báo cần chú ý
                    </dt>
                    <dd>
                      {(baselineEvaluation?.criticalMaterials ?? 0) +
                        (baselineEvaluation?.warningMaterials ?? 0)}{" "}
                      →{" "}
                      {selectedEvaluation.criticalMaterials +
                        selectedEvaluation.warningMaterials}
                    </dd>
                  </div>
                  <div>
                    <dt>Chi phí bổ sung</dt>
                    <dd>+{selectedEvaluation.cost} điểm</dd>
                  </div>
                </dl>
                <div className="decision-actions">
                  <button
                    id="ap"
                    className="s"
                    disabled={alreadyExecutedForCurrentState}
                    onClick={handleApprove}
                  >
                    {alreadyExecutedForCurrentState
                      ? "Đã áp dụng"
                      : "Áp dụng vào mô phỏng"}
                  </button>
                </div>
              </div>
            )}
            {selectedSel !== rec && (
              <p className="helper-text">
                Mô hình khuyến nghị: <b>{recScenario?.name}</b>
              </p>
            )}
          </section>
          <p className="score-explanation">
            Năng lực: chuyến/giờ 
            <br></br>Mức tải cao nhất: AMR/AGV (%)
            <br></br>Sản lượng: sản phẩm/giờ
            <br></br>Đánh giá: điểm 0–100, điểm cao hơn tốt hơn.
            <br></br>Điểm giảm khi nhân viên đóng gói quá tải; khuyến nghị xét cả nguồn lực cấp vật tư và đóng gói.
          </p>
          <div className="insight-history">
            <div className="decision-secondary-actions">
              {done && executionLocked && (
                <button
                  className="s"
                  disabled={!done.actualResult}
                  onClick={handleStartNewEvaluation}
                >
                  Đánh giá vòng mới
                </button>
              )}
              <button className="s" id="rs" onClick={handleReset}>
                Reset
              </button>
            </div>
            {done && (
              <details id="act" className="run-result">
                <summary>Kết quả mô phỏng gần nhất</summary>
                {done && (
                  <>
                    <b className="g">
                      Lần mô phỏng gần nhất: {done.name} · kế hoạch{" "}
                      {done.productionPercent}%
                    </b>
                    <div style={{ color: "var(--m)" }}>
                      Trước áp dụng:{" "}
                      {(done.before.utilization * 100).toFixed(0)}% tải,{" "}
                      {done.before.capacity.toFixed(0)} chuyến/giờ,{" "}
                      {done.before.delay.toFixed(0)} phút trễ.
                      <br />
                      Dự báo sau áp dụng:{" "}
                      {(done.simulatedAfter.utilization * 100).toFixed(0)}% tải,{" "}
                      {done.simulatedAfter.capacity.toFixed(0)} chuyến/giờ,{" "}
                      {done.simulatedAfter.delay.toFixed(0)} phút trễ;{" "}
                      {done.simulatedAfter.criticalMaterials} vật tư nguy cơ,{" "}
                      {done.simulatedAfter.warningMaterials} cảnh báo.
                      <br />
                      Kết quả tính toán demo. Giá trị đo thủ công chỉ lưu đối
                      chiếu, chưa cập nhật mô hình dự báo.
                    </div>
                    {done.actualResult ? (
                      <p className="helper-text">
                        Kết quả 3D sau {done.actualResult.simulatedMinutes} phút
                        mô phỏng: {done.actualResult.producedUnits.toFixed(1)}{" "}
                        sản phẩm, {done.actualResult.deliveredTrips.toFixed(0)}{" "}
                        chuyến giao; staging A/B{" "}
                        {done.actualResult.stagingByLine.A}/
                        {done.actualResult.stagingByLine.B} kiện. Đây là kết quả
                        mô phỏng, không phải số đo nhà máy.
                      </p>
                    ) : (
                      <p className="helper-text">
                        {done.cancelled
                          ? "Lượt demo đã dừng trước khi ghi kết quả."
                          : "Đang chạy lượt demo 60 phút mô phỏng; kết quả 3D sẽ được ghi tự động."}
                      </p>
                    )}
                    <div className="actual-feedback">
                      <label htmlFor="actual-util">
                        {(done.modelVersion ?? 1) >= 2
                          ? "Tải đo thủ công AMR/AGV (%)"
                          : "Tải AMR thực tế (mô hình cũ, %)"}{" "}
                      </label>
                      <input
                        id="actual-util"
                        type="number"
                        min="0"
                        max="200"
                        step="1"
                        value={actualUtilInput}
                        placeholder={
                          done.actualUtilization === null
                            ? "Chưa có số đo"
                            : (done.actualUtilization * 100).toFixed(0)
                        }
                        onChange={(event) =>
                          setActualUtilInput(event.target.value)
                        }
                      />
                      <button
                        className="s"
                        onClick={handleRecordActual}
                        disabled={actualUtilInput === ""}
                      >
                        Ghi nhận
                      </button>
                      {done.actualUtilization !== null && (
                        <small>
                          Đã ghi nhận{" "}
                          {(done.actualUtilization * 100).toFixed(0)}%. Sai lệch
                          so với dự báo mô phỏng:{" "}
                          {(
                            (done.actualUtilization -
                              done.simulatedAfter.utilization) *
                            100
                          ).toFixed(0)}{" "}
                          điểm phần trăm.
                        </small>
                      )}
                    </div>
                  </>
                )}
              </details>
            )}
          </div>
        </aside>
      </main>

      <dialog
        ref={historyDialogRef}
        id="run-history"
        className="history-dialog"
        aria-labelledby="history-title"
        onClose={() => setIsHistoryOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              historyDialogRef.current?.close();
          }
        }}
      >
        <div className="dashboard-card">
          <div className="section-heading">
            <div>
              <h2 id="history-title">History</h2>
              <p className="section-description">
                {runHistory.length} lần mô phỏng đã ghi nhận · mới nhất trước
              </p>
            </div>
            <button
              className="s"
              onClick={() => historyDialogRef.current?.close()}
              aria-label="Đóng History"
            >
              Đóng ×
            </button>
          </div>
          {runHistory.length === 0 ? (
            <p className="history-empty">
              Chưa có lịch sử chạy. Áp dụng một phương án trong dashboard để ghi
              nhận kết quả mô phỏng.
            </p>
          ) : (
            <div className="history-table-scroll">
              <table className="scenario-table history-table">
                <thead>
                  <tr>
                    <th scope="col">Thời gian</th>
                    <th scope="col">Phương án</th>
                    <th scope="col">Kế hoạch</th>
                    <th scope="col">Dự báo tải trước → sau</th>
                    <th scope="col">Dự báo trễ trước → sau</th>
                    <th scope="col">Kết quả mô phỏng</th>
                    <th scope="col">Tải nhập thủ công</th>
                  </tr>
                </thead>
                <tbody>
                  {runHistory.map((run) => (
                    <tr key={run.id}>
                      <td>{new Date(run.timestamp).toLocaleString("vi-VN")}</td>
                      <th scope="row">
                        {run.name}
                        <small>
                          {run.actualResult
                            ? `Kết quả mô phỏng: ${run.actualResult.producedUnits.toFixed(1)} sản phẩm · ${run.actualResult.deliveredTrips.toFixed(0)} chuyến giao`
                            : run.cancelled
                              ? "Đã dừng trước khi có kết quả"
                              : "Đang chờ kết quả mô phỏng"}
                        </small>
                        {(run.modelVersion ?? 1) < 3 && (
                          <small>Mô hình cũ</small>
                        )}
                        {run.dataSource === "demo-assumptions" && (
                          <small>Dự báo mô phỏng · giả định demo</small>
                        )}
                        {run.assumptions && (
                          <details>
                            <summary>Giả định khi chạy</summary>
                            <small>
                              Mix:{" "}
                              {Object.entries(run.assumptions.mix)
                                .map(([model, share]) => `${model} ${share}%`)
                                .join(" · ")}
                            </small>
                            <small>
                              Chu kỳ AMR/AGV: {run.assumptions.amrCycleMinutes}/
                              {run.assumptions.agvCycleMinutes} phút ·{" "}
                              {run.assumptions.loadsPerTrip} kiện/chuyến
                            </small>
                          </details>
                        )}
                        {run.resourcesAfter && (
                          <small>
                            AMR {run.resourcesBefore?.amr} →{" "}
                            {run.resourcesAfter.amr} · AGV A/B{" "}
                            {run.resourcesBefore?.agvByLine.A}/
                            {run.resourcesBefore?.agvByLine.B} →{" "}
                            {run.resourcesAfter.agvByLine.A}/
                            {run.resourcesAfter.agvByLine.B}
                          </small>
                        )}
                        {run.resourcesAfter?.packingWorkers && (
                          <small>Nhân viên đóng gói A/B: {run.resourcesBefore?.packingWorkers?.A}/{run.resourcesBefore?.packingWorkers?.B} → {run.resourcesAfter.packingWorkers.A}/{run.resourcesAfter.packingWorkers.B}</small>
                        )}
                      </th>
                      <td>{run.productionPercent}%</td>
                      <td>
                        {(run.before.utilization * 100).toFixed(0)}% →{" "}
                        {(run.simulatedAfter.utilization * 100).toFixed(0)}%
                      </td>
                      <td>
                        {run.before.delay.toFixed(0)} →{" "}
                        {run.simulatedAfter.delay.toFixed(0)} phút
                      </td>
                      <td>
                        {run.actualResult
                          ? `${run.actualResult.producedUnits.toFixed(1)} sp · ${run.actualResult.deliveredTrips.toFixed(0)} chuyến`
                          : run.cancelled
                            ? "Đã dừng"
                            : "Đang chạy / chưa ghi"}
                      </td>
                      <td>
                        {run.actualUtilization !== null
                          ? `${(run.actualUtilization * 100).toFixed(0)}%`
                          : "Chưa ghi nhận"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
};

export default App;
