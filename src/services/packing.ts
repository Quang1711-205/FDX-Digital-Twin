import DEMO from '../json/demo_config.json';

export const FINISHED_GOODS = DEMO.resources.finishedGoods;

export function buildPackingScenarios<T extends {
  id: string; name: string; cost: number; addAmr: number; addAgv: number;
  addPackingByLine?: Record<string, number>; minProductionPercent?: number;
}>(options: T[], packing: ReturnType<typeof calculatePacking>, productionPercent: number, targetUtilization: number): T[] {
  const base = options.filter(option => !Object.values(option.addPackingByLine ?? {}).some(count => count > 0)
    && productionPercent >= (option.minProductionPercent ?? 0));
  const additions = Object.fromEntries(packing.lines.filter(line => line.backlogPerHour > 1e-6).map(line => [line.line,
    Math.max(0, Math.ceil(line.demand / (3600 / FINISHED_GOODS.packingSecondsPerUnit * targetUtilization)) - line.workers),
  ]));
  const count = Object.values(additions).reduce((sum, value) => sum + value, 0);
  if (!count) return base;
  const staffingName = Object.entries(additions).map(([line, value]) => `+${value} nhân viên đóng gói Line ${line}`).join(" ");
  return [...base, ...base.map(option => ({
    ...option,
    id: `${option.id}_packing_${Object.entries(additions).map(([line, value]) => `${line}${value}`).join('_')}`,
    name: option.addAmr || option.addAgv ? `${option.name} ${staffingName}` : staffingName,
    addPackingByLine: additions,
    cost: option.cost + count * FINISHED_GOODS.costPointsPerWorker,
  }))];
}

export function calculatePacking(unitsPerHour: number, mix: Record<string, number>, workersByLine: Record<string, number>) {
  const total = Object.values(mix).reduce((sum, value) => sum + Math.max(0, value), 0);
  const lines = ['A', 'B'].map(line => {
    const share = Object.entries(mix).reduce((sum, [model, value]) =>
      sum + ((DEMO.production.lineByModel as Record<string, string>)[model] === line ? Math.max(0, value) : 0), 0) / Math.max(total, 1);
    const demand = unitsPerHour * share;
    const workers = workersByLine[line] ?? 0;
    const capacity = workers * 3600 / FINISHED_GOODS.packingSecondsPerUnit;
    return { line, workers, demand, capacity, utilization: capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0, backlogPerHour: Math.max(0, demand - capacity) };
  });
  return { lines, utilization: Math.max(...lines.map(line => line.utilization)), backlogPerHour: lines.reduce((sum, line) => sum + line.backlogPerHour, 0) };
}
