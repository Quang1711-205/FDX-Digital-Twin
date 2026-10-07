import type { OperationsSnapshot, RiskLevel } from "../types";

export function resolveFleetScenario(
  amrCount: number,
  agvByLine: Record<string, number>,
  scenario: { addAmr: number; addAgv: number; targetLine?: string; addAgvByLine?: Record<string, number> },
  snapshot: OperationsSnapshot,
) {
  const targetLine =
    scenario.targetLine ??
    [...snapshot.agvLines].sort(
      (a, b) => b.utilization - a.utilization || a.line.localeCompare(b.line),
    )[0]?.line ??
    "A";
  return {
    amrCount: amrCount + scenario.addAmr,
    agvByLine: {
      ...agvByLine,
      ...Object.fromEntries(["A", "B"].map(line => [line,
        (agvByLine[line] ?? 0) + (scenario.addAgvByLine ? scenario.addAgvByLine[line] ?? 0 : line === targetLine ? scenario.addAgv : 0),
      ])),
    },
    targetLine,
  };
}

export function allocateAmrCounts(
  amrCount: number,
  demandByLine: Record<string, number>,
) {
  const counts: Record<string, number> = { A: 0, B: 0 };
  for (let index = 0; index < amrCount; index++) {
    const line = ["A", "B"].sort((a, b) => {
      const aLoad = counts[a]
        ? demandByLine[a] / counts[a]
        : demandByLine[a] > 0
          ? Infinity
          : 0;
      const bLoad = counts[b]
        ? demandByLine[b] / counts[b]
        : demandByLine[b] > 0
          ? Infinity
          : 0;
      return bLoad - aLoad || a.localeCompare(b);
    })[0];
    counts[line]++;
  }
  return counts;
}

export function sizeSupplyRecovery(snapshot: OperationsSnapshot, amrCount: number,
  agvByLine: Record<string, number>, amrRate: number, agvRate: number, knee: number) {
  const demand = Object.fromEntries(snapshot.agvLines.map(line => [line.line, line.demand]));
  let requiredAmr = amrCount;
  const upper = Math.max(amrCount, snapshot.amrLines.reduce((sum, line) => sum + Math.ceil(line.demand / (amrRate * knee)), 0) + 2);
  if (Number.isFinite(upper)) for (; requiredAmr < upper; requiredAmr++) {
    const counts = allocateAmrCounts(requiredAmr, demand);
    if (snapshot.amrLines.every(line => line.demand <= (counts[line.line] ?? 0) * amrRate * knee + 1e-6)) break;
  }
  return { addAmr: requiredAmr - amrCount,
    addAgvByLine: Object.fromEntries(snapshot.agvLines.map(line => [line.line,
      agvRate > 0 ? Math.max(0, Math.ceil(line.demand / (agvRate * knee)) - (agvByLine[line.line] ?? 0)) : 0,
    ])) };
}

export function isBottleneckResolved(snapshot: OperationsSnapshot,
  packing: { utilization: number; backlogPerHour: number }, knee: number) {
  return snapshot.materials.every(item => item.consumptionPerHour <= 0 || item.level === "NORMAL")
    && snapshot.bottlenecks.every(stage => stage.utilization <= 1 + 1e-6)
    && [...snapshot.amrLines, ...snapshot.agvLines].every(line => line.utilization <= knee + 1e-6)
    && packing.utilization <= knee + 1e-6 && packing.backlogPerHour <= 1e-6;
}

export interface OperationsInputs {
  unitsPerHour: number;
  productionFactor: number;
  productionMix: Record<string, number>;
  amrCount: number;
  agvByLine: Record<string, number>;
  agvTripsPerHour: number;
  amrTripsPerHour: number;
  loadsPerTrip: number;
  materials: Array<{
    id: string;
    name: string;
    perUnit: number;
    tripQty: number;
    stock: number;
    line: string;
    usageByModel?: Record<string, number>;
  }>;
  thresholds: { knee: number; delayK: number; red: number; amber: number };
  capacities: {
    dockTripsPerHour: number;
    pickingTripsPerHour: number;
    stagingPallets: number;
    lineUnitsPerHour: number;
  };
}

export function calculateOperationsSnapshot(
  input: OperationsInputs,
): OperationsSnapshot {
  const unitsPerHour = input.unitsPerHour * input.productionFactor;
  const mixTotal = Object.values(input.productionMix).reduce(
    (sum, share) => sum + Math.max(0, share),
    0,
  );
  const normalizedMix =
    mixTotal > 0
      ? Object.fromEntries(
          Object.entries(input.productionMix).map(([model, share]) => [
            model,
            Math.max(0, share) / mixTotal,
          ]),
        )
      : {};
  const materials = input.materials.map((material) => {
    const perUnit = material.usageByModel
      ? Object.entries(normalizedMix).reduce(
          (sum, [model, share]) =>
            sum + share * (material.usageByModel?.[model] ?? 0),
          0,
        )
      : material.perUnit;
    const consumptionPerHour = perUnit * unitsPerHour;
    const tripsPerHour =
      consumptionPerHour / (material.tripQty * input.loadsPerTrip);
    const coverMinutes =
      consumptionPerHour > 0
        ? (material.stock / consumptionPerHour) * 60
        : Infinity;
    return {
      ...material,
      perUnit,
      consumptionPerHour,
      tripsPerHour,
      coverMinutes,
    };
  });

  const tripsPerHour = materials.reduce(
    (sum, material) => sum + material.tripsPerHour,
    0,
  );
  const ratio = (demand: number, capacity: number) =>
    capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0;
  const lineDemand = Object.fromEntries(
    ["A", "B"].map((line) => [
      line,
      materials
        .filter((material) => material.line === line)
        .reduce((sum, material) => sum + material.tripsPerHour, 0),
    ]),
  );
  const amrCountsByLine = allocateAmrCounts(input.amrCount, lineDemand);
  const upstreamCapacity = input.amrCount * input.amrTripsPerHour;
  const amrLines = ["A", "B"].map((line) => {
    const demand = lineDemand[line];
    const count = amrCountsByLine[line];
    const capacity = count * input.amrTripsPerHour;
    const utilization = ratio(demand, capacity);
    const delay =
      Math.max(0, utilization - input.thresholds.knee) *
      input.thresholds.delayK;
    return { line, count, demand, capacity, utilization, delay };
  });
  const upstreamUtilization = Math.max(
    ...amrLines.map((line) => line.utilization),
  );
  const upstreamDelay = Math.max(...amrLines.map((line) => line.delay));
  const agvLines = ["A", "B"].map((line) => {
    const demand = lineDemand[line];
    const count = input.agvByLine[line] ?? 0;
    const capacity = count * input.agvTripsPerHour;
    const utilization = ratio(demand, capacity);
    const delay =
      Math.max(0, utilization - input.thresholds.knee) *
      input.thresholds.delayK;
    return { line, count, demand, capacity, utilization, delay };
  });
  const agvUtilization = Math.max(...agvLines.map((line) => line.utilization));
  const amrUtilization = Math.max(...amrLines.map((line) => line.utilization));
  const transportUtilization = Math.max(amrUtilization, agvUtilization);
  const transportCapacity =
    transportUtilization > 0
      ? tripsPerHour / transportUtilization
      : Math.min(
          upstreamCapacity,
          agvLines.reduce((sum, line) => sum + line.capacity, 0),
        );
  const delayMinutes =
    upstreamDelay + Math.max(...agvLines.map((line) => line.delay));

  const materialRisks = materials.map((material) => {
    const effectiveCoverMinutes =
      material.coverMinutes -
      (amrLines.find((line) => line.line === material.line)?.delay ?? 0) -
      (agvLines.find((line) => line.line === material.line)?.delay ?? 0);
    const level: RiskLevel =
      effectiveCoverMinutes < input.thresholds.red
        ? "CRITICAL"
        : effectiveCoverMinutes < input.thresholds.amber
          ? "WARNING"
          : "NORMAL";
    return { ...material, effectiveCoverMinutes, level };
  });

  // An occupancy estimate, not a measured queue or a time-stepped inventory ledger.
  const inflow = Math.min(tripsPerHour, upstreamCapacity);
  const outflow = agvLines.reduce(
    (sum, line) => sum + Math.min(line.demand, line.capacity),
    0,
  );
  const stagingPallets = Math.min(
    input.capacities.stagingPallets,
    Math.round(
      8 + Math.min(upstreamUtilization, 1) * 10 + Math.max(0, inflow - outflow),
    ),
  );
  const bottlenecks: OperationsSnapshot["bottlenecks"] = [
    {
      id: "warehouse",
      name: "1. Kho vật tư",
      utilization: tripsPerHour / input.capacities.dockTripsPerHour,
    },
    {
      id: "picking",
      name: "2. AMR lấy vật tư tới khu tập kết",
      utilization: Math.max(
        tripsPerHour / input.capacities.pickingTripsPerHour,
        amrUtilization,
      ),
    },
    {
      id: "staging",
      name: "3. Khu tập kết vật tư",
      utilization: stagingPallets / input.capacities.stagingPallets,
    },
    { id: "transport", 
      name: "4. AGV A/B", utilization: agvUtilization 
    },
    {
      id: "line",
      name: "5. Dây chuyền A/B",
      utilization: unitsPerHour / input.capacities.lineUnitsPerHour,
    },
  ].map((stage) => ({
    ...stage,
    level:
      stage.utilization > 1
        ? "CRITICAL"
        : stage.utilization > 0.9
          ? "WARNING"
          : "NORMAL",
  }));

  const riskScore = materialRisks.reduce(
    (sum, material) =>
      sum +
      (material.level === "CRITICAL"
        ? 2
        : material.level === "WARNING"
          ? 1
          : 0),
    0,
  );

  return {
    unitsPerHour,
    materials: materialRisks,
    tripsPerHour,
    transportCapacity,
    transportUtilization,
    delayMinutes,
    stagingPallets,
    bottlenecks,
    riskScore,
    upstreamCapacity,
    upstreamUtilization,
    upstreamDelay,
    amrLines,
    agvLines,
    stagingSupplyLimited: amrLines.some((line) => line.demand > line.capacity),
  };
}

// Plan recommendations must meet the selected output before comparing risk/cost.
export function selectRecommendedScenario<
  T extends {
    id: string;
    score: number;
    cost: number;
    order: number;
    res: OperationsSnapshot;
  },
>(scenarios: T[], targetUnitsPerHour?: number): T | undefined {
  const candidates =
    targetUnitsPerHour === undefined
      ? scenarios
      : scenarios.filter(
          (scenario) =>
            Math.abs(scenario.res.unitsPerHour - targetUnitsPerHour) < 1e-6,
        );
  const overloaded = (scenario: T) =>
    scenario.res.bottlenecks.some((stage) => stage.utilization > 1 + 1e-6);
  return [...candidates].sort(
    (a, b) =>
      (targetUnitsPerHour === undefined
        ? 0
        : Number(overloaded(a)) - Number(overloaded(b))) ||
      b.score - a.score ||
      a.cost - b.cost ||
      a.order - b.order,
  )[0];
}
