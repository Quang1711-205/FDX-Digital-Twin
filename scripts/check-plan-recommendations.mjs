import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('src/services/operationsEngine.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { calculateOperationsSnapshot, resolveFleetScenario, selectRecommendedScenario } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const config = JSON.parse(await readFile('src/json/demo_config.json', 'utf8'));
const plan = config.demoScenarios.find(scenario => scenario.id === 'plan_change');
const inputs = {
  unitsPerHour: config.production.unitsPerHour,
  productionMix: plan.mix,
  amrCount: plan.resources.amr,
  agvByLine: plan.resources.agvByLine,
  amrTripsPerHour: 60 / config.resources.amr.cycleMinutes,
  agvTripsPerHour: 60 / config.resources.agv.cycleMinutes,
  loadsPerTrip: config.resources.agv.loadsPerTrip,
  materials: config.materials.items,
  thresholds: config.operations.threshold,
  capacities: {
    dockTripsPerHour: config.resources.warehouse.dockCapacity,
    pickingTripsPerHour: config.resources.picking.capacity,
    stagingPallets: config.resources.staging.pallets,
    lineUnitsPerHour: config.resources.line.capacityUnits,
  },
};
function evaluate(percent, overrides = {}) {
  const currentInputs = { ...inputs, productionFactor: percent / 100, ...overrides };
  const baseline = calculateOperationsSnapshot(currentInputs);
  const options = plan.whatIfs.filter(option => percent >= (option.minProductionPercent ?? 0)).flatMap((option, order) => {
    const outputPercent = option.productionPercent ?? percent;
    const resources = resolveFleetScenario(currentInputs.amrCount, currentInputs.agvByLine, option, baseline);
    const res = calculateOperationsSnapshot({ ...currentInputs, ...resources, productionFactor: outputPercent / 100 });
    return [{ ...option, order, resources, res, score: res.riskScore * 8 + option.cost }];
  });
  return { baseline, options, recommended: selectRecommendedScenario(options, baseline.unitsPerHour) };
}
for (const [percent, expectedId, expectedAmr, expectedUtil] of [[110, 'plan_both', 8, .825], [120, 'plan_amr2_agv', 9, .8]]) {
  const { baseline, options, recommended } = evaluate(percent);
  assert.equal(recommended.id, expectedId);
  assert.ok(Math.abs(recommended.res.unitsPerHour - percent) < 1e-6, 'recommendation preserves production');
  assert.equal(recommended.resources.amrCount, expectedAmr);
  assert.deepEqual(recommended.resources.agvByLine, { A: 3, B: 2 });
  assert.ok(Math.abs(recommended.res.transportUtilization - expectedUtil) < 1e-6);
  assert.equal(recommended.res.delayMinutes, 0);
  assert.equal(recommended.res.riskScore, 0);
  assert.ok(recommended.res.delayMinutes < baseline.delayMinutes);
  assert.ok(!options.some(option => ['plan_reduce', 'plan_increase'].includes(option.id)), 'production change options are removed');
  assert.equal(options.some(option => option.id === 'plan_amr2_agv'), percent > 110);
  const next = evaluate(percent, { amrCount: recommended.resources.amrCount, agvByLine: recommended.resources.agvByLine });
  assert.equal(next.recommended.id, 'plan_keep', 'no further vehicles recommended after application');
  console.log(percent + '%: ' + recommended.id + ', ' + (recommended.res.transportUtilization * 100).toFixed(1) + '% load, zero delay, target preserved');
}
for (const percent of [80, 90, 100, 105, 110, 115, 120]) {
  for (const overrides of [{}, { materials: inputs.materials.map(material => ({ ...material, stock: 1 })) }, { productionMix: { 'ECU-A': 25, 'Alternator-B': 25, 'Sensor-C': 50 } }]) {
    const { recommended } = evaluate(percent, overrides);
    assert.ok(Math.abs(recommended.res.unitsPerHour - percent) < 1e-6, 'changed inputs never recommend a different plan');
  }
}
const { options } = evaluate(120);
const keep = options.find(option => option.id === 'plan_keep');
const feasible = options.find(option => option.id === 'plan_both');
assert.equal(selectRecommendedScenario([{ ...keep, score: 0 }, { ...feasible, score: 100 }], 120).id, feasible.id, 'resolve overload before comparing scores');
assert.equal(selectRecommendedScenario([{ ...keep, score: 0 }, { ...feasible, score: 100 }]).id, keep.id, 'other demo cases retain original scoring');
console.log('Plan recommendation checks passed');
