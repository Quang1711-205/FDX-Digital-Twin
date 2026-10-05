import type { OperationsSnapshot, RiskLevel } from '../types';

export interface OperationsInputs {
  unitsPerHour: number;
  productionFactor: number;
  amrCount: number;
  extraTrips: number;
  amrTripsPerHour: number;
  materials: Array<{
    id: string;
    name: string;
    perUnit: number;
    tripQty: number;
    stock: number;
    line: string;
  }>;
  thresholds: { knee: number; delayK: number; red: number; amber: number };
  capacities: {
    dockTripsPerHour: number;
    pickingTripsPerHour: number;
    stagingPallets: number;
    lineUnitsPerHour: number;
  };
}

export function calculateOperationsSnapshot(input: OperationsInputs): OperationsSnapshot {
  const unitsPerHour = input.unitsPerHour * input.productionFactor;
  const materials = input.materials.map((material) => {
    const consumptionPerHour = material.perUnit * unitsPerHour;
    const tripsPerHour = consumptionPerHour / material.tripQty;
    const coverMinutes = (material.stock / consumptionPerHour) * 60;
    return { ...material, consumptionPerHour, tripsPerHour, coverMinutes };
  });

  const tripsPerHour = materials.reduce((sum, material) => sum + material.tripsPerHour, 0);
  const transportCapacity = input.amrCount * input.amrTripsPerHour + input.extraTrips;
  const transportUtilization = tripsPerHour / transportCapacity;
  const delayMinutes = Math.max(0, transportUtilization - input.thresholds.knee) * input.thresholds.delayK;

  const materialRisks = materials.map((material) => {
    const effectiveCoverMinutes = material.coverMinutes - delayMinutes;
    const level: RiskLevel = effectiveCoverMinutes < input.thresholds.red
      ? 'CRITICAL'
      : effectiveCoverMinutes < input.thresholds.amber ? 'WARNING' : 'NORMAL';
    return { ...material, effectiveCoverMinutes, level };
  });

  const stagingPallets = Math.min(input.capacities.stagingPallets, Math.round(8 + transportUtilization * 10));
  const bottlenecks: OperationsSnapshot['bottlenecks'] = [
    { id: 'warehouse', name: 'Kho (xuất)', utilization: tripsPerHour / input.capacities.dockTripsPerHour },
    { id: 'picking', name: 'Picking/Kitting', utilization: tripsPerHour / input.capacities.pickingTripsPerHour },
    { id: 'staging', name: 'Staging', utilization: stagingPallets / input.capacities.stagingPallets },
    { id: 'transport', name: 'Vận chuyển', utilization: transportUtilization },
    { id: 'line', name: 'Line A/B', utilization: unitsPerHour / input.capacities.lineUnitsPerHour }
  ].map((stage) => ({
    ...stage,
    level: stage.utilization > 1 ? 'CRITICAL' : stage.utilization > 0.9 ? 'WARNING' : 'NORMAL'
  }));

  const riskScore = materialRisks.reduce((sum, material) =>
    sum + (material.level === 'CRITICAL' ? 2 : material.level === 'WARNING' ? 1 : 0), 0);

  return {
    unitsPerHour,
    materials: materialRisks,
    tripsPerHour,
    transportCapacity,
    transportUtilization,
    delayMinutes,
    stagingPallets,
    bottlenecks,
    riskScore
  };
}
