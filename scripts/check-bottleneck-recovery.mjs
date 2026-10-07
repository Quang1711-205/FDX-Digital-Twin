import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const config = JSON.parse(await readFile('src/json/demo_config.json', 'utf8'));
const compiled = ts.transpileModule(await readFile('src/services/operationsEngine.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { calculateOperationsSnapshot: calc, sizeSupplyRecovery, resolveFleetScenario, isBottleneckResolved } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const resources = config.resources;
for (const scenario of config.demoScenarios) for (const percent of [110, 120]) {
  const input = {
    unitsPerHour: config.production.unitsPerHour, productionFactor: percent / 100,
    productionMix: scenario.mix, amrCount: scenario.resources.amr, agvByLine: scenario.resources.agvByLine,
    amrTripsPerHour: 60 / resources.amr.cycleMinutes, agvTripsPerHour: 60 / resources.agv.cycleMinutes,
    loadsPerTrip: resources.agv.loadsPerTrip, materials: config.materials.items,
    thresholds: config.operations.threshold,
    capacities: { dockTripsPerHour: resources.warehouse.dockCapacity, pickingTripsPerHour: resources.picking.capacity,
      stagingPallets: resources.staging.pallets, lineUnitsPerHour: resources.line.capacityUnits },
  };
  const before = calc(input);
  const recovery = sizeSupplyRecovery(before, input.amrCount, input.agvByLine, input.amrTripsPerHour, input.agvTripsPerHour, input.thresholds.knee);
  const fleet = resolveFleetScenario(input.amrCount, input.agvByLine, { ...recovery, addAgv: Object.values(recovery.addAgvByLine).reduce((a,b)=>a+b,0) }, before);
  const replenishedMaterials = input.materials.map(item => {
    const demand = before.materials.find(material => material.id === item.id).consumptionPerHour;
    return { ...item, stock: Math.max(item.stock, Math.ceil(demand * (input.thresholds.amber + 1) / 60)) };
  });
  const after = calc({ ...input, materials: replenishedMaterials, amrCount: fleet.amrCount, agvByLine: fleet.agvByLine });
  const total = Object.values(scenario.mix).reduce((a,b)=>a+b,0);
  const loads = ['A','B'].map(line => {
    const demand = after.unitsPerHour * Object.entries(scenario.mix).reduce((sum,[model,share]) => sum + (config.production.lineByModel[model] === line ? share : 0),0) / total;
    const rate = 3600 / resources.finishedGoods.packingSecondsPerUnit;
    const workers = Math.max(resources.finishedGoods.workersByLine[line], Math.ceil(demand / (rate * input.thresholds.knee)));
    return { utilization: demand / (workers * rate), backlogPerHour: Math.max(0, demand - workers * rate) };
  });
  const packing = { utilization: Math.max(...loads.map(line=>line.utilization)), backlogPerHour: loads.reduce((sum,line)=>sum+line.backlogPerHour,0) };
  assert.equal(after.unitsPerHour, before.unitsPerHour);
  const fixedStageOverloaded = after.bottlenecks.some(stage => ['warehouse','picking','line'].includes(stage.id) && stage.utilization > 1 + 1e-6);
  assert.equal(isBottleneckResolved(after, packing, input.thresholds.knee), !fixedStageOverloaded, `${scenario.id} ${percent}%`);
  const noStock = calc({ ...input, amrCount: fleet.amrCount, agvByLine: fleet.agvByLine, materials: input.materials.map(item=>({...item,stock:0})) });
  assert.equal(isBottleneckResolved(noStock, packing, input.thresholds.knee), false, 'Extra vehicles must not hide missing stock');
}
console.log('PASS: recovery resolves adjustable bottlenecks at 110%/120%, preserves output, and rejects missing stock or fixed-stage overload');
