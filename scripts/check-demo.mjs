import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Compile the real modules in memory; no packages or generated files are needed.
const asUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const compile = async (path) =>
  ts.transpileModule(await readFile(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
const floor = asUrl(
  (await compile("src/three/FactoryFloor.ts")).replace(
    /from ['"]three['"]/g,
    `from "${import.meta.resolve("three")}"`,
  ),
);
const fleet = await import(
  asUrl(
    (await compile("src/three/LogisticsFleet.ts"))
      .replace(/from ['"]three['"]/g, `from "${import.meta.resolve("three")}"`)
      .replace(/from ['"]\.\/FactoryFloor['"]/g, `from "${floor}"`),
  )
);
const engine = await import(
  asUrl(await compile("src/services/operationsEngine.ts"))
);
const config = JSON.parse(await readFile("src/json/demo_config.json", "utf8"));
const materials = config.materials.items;
const scriptedCases = config.demoScenarios.filter(
  (scenario) => scenario.id !== "plan_change",
);
const planChange = config.demoScenarios.find(
  (scenario) => scenario.id === "plan_change",
);
assert.equal(
  scriptedCases.length,
  4,
  "the four existing demo cases remain separate",
);
assert.ok(
  planChange.whatIfs.every(
    (option) => option.productionDeltaPercent === undefined,
  ),
  "plan options keep the selected production target",
);
assert.ok(
  !planChange.whatIfs.some((option) =>
    /tăng kế hoạch|giảm kế hoạch/i.test(option.name),
  ),
  "production increase and decrease options are removed",
);
assert.ok(
  planChange.whatIfs.every((option) => option.id.startsWith("plan_")),
  "plan option IDs are separate from existing situations",
);
assert.equal(
  config.resources.staging.demoInitialLoads,
  12,
  "each what-if starts with a configured demo staging state",
);
for (const scenario of scriptedCases) {
  assert.ok(
    scenario.description &&
      scenario.risk.causes.length &&
      scenario.whatIfs.length,
    `${scenario.id}: demo inputs, risk and what-if options are present`,
  );
  assert.equal(
    scenario.whatIfs.filter((option) => option.forecast.recommended).length,
    1,
    `${scenario.id}: exactly one preset recommendation`,
  );
}
assert.equal(
  scriptedCases[1].productionPercent,
  120,
  "AMR bottleneck case increases the plan to 120%",
);
assert.deepEqual(
  scriptedCases[2].mix,
  { "ECU-A": 25, "Alternator-B": 25, "Sensor-C": 50 },
  "Line B case changes the product mix",
);
assert.equal(
  scriptedCases[3].resources.agvByLine.A,
  1,
  "AGV outage case starts with one Line A AGV",
);
const inputs = {
  unitsPerHour: config.production.unitsPerHour,
  productionFactor: 1,
  productionMix: Object.fromEntries(
    config.production.mix.map((item) => [item.model, item.pct]),
  ),
  amrCount: 7,
  agvByLine: { A: 2, B: 2 },
  amrTripsPerHour: 5,
  agvTripsPerHour: 10,
  loadsPerTrip: 1,
  materials,
  thresholds: config.operations.threshold,
  capacities: {
    dockTripsPerHour: 55,
    pickingTripsPerHour: 42,
    stagingPallets: 24,
    lineUnitsPerHour: 130,
  },
};
const base = engine.calculateOperationsSnapshot(inputs);
assert.ok(
  Math.abs(base.tripsPerHour - 30) < 1e-8,
  "default BOM preserves baseline demand",
);
const alternate = engine.calculateOperationsSnapshot({
  ...inputs,
  productionMix: { "ECU-A": 100, "Alternator-B": 0, "Sensor-C": 0 },
});
assert.notEqual(alternate.tripsPerHour, base.tripsPerHour);
assert.equal(alternate.materials[1].consumptionPerHour, 0);
assert.ok(
  engine.calculateOperationsSnapshot({ ...inputs, productionFactor: 1.2 })
    .tripsPerHour > base.tripsPerHour,
);

function conserved(inv) {
  for (const material of materials) {
    const id = material.id;
    const total =
      inv.warehouseStock[id] +
      inv.stock[id] * material.tripQty +
      inv.inTransit[id] +
      inv.lineSideStock[id] +
      inv.consumed[id];
    assert.ok(
      Math.abs(total - material.stock - (inv.warehouseReplenished[id] ?? 0)) <
        1e-6,
      `${id}: stock conserved including warehouse replenishment (${total})`,
    );
    for (const value of [
      inv.warehouseStock[id],
      inv.stock[id],
      inv.inTransit[id],
      inv.lineSideStock[id],
      inv.consumed[id],
    ])
      assert.ok(value >= -1e-8);
  }
}
for (const loads of [1, 2]) {
  const inv = fleet.createStagingInventory(base.materials, 24, 8, 2, 0, loads);
  conserved(inv);
  const id = materials[0].id;
  assert.equal(inv.lineSideStock[id], 0, "no line stock before delivery");
  assert.ok(fleet.transferStaging(inv, id, -1, loads));
  assert.equal(inv.lineSideStock[id], 0, "pickup does not credit line");
  assert.ok(fleet.deliverLineSideLoad(inv, id));
  conserved(inv);
  assert.ok(fleet.takeWarehouseLoad(inv, id));
  assert.ok(fleet.transferStaging(inv, id, 1, loads));
  conserved(inv);
  const preview = structuredClone(inv);
  const mainBefore = JSON.stringify(inv);
  fleet.transferStaging(preview, id, -1, loads);
  fleet.consumeLineSide(preview, base.materials, 600);
  assert.equal(
    JSON.stringify(inv),
    mainBefore,
    "isolated preview does not mutate main",
  );
  conserved(preview);
  assert.equal(
    fleet.deliverLineSideLoad(inv, id),
    false,
    "cannot deliver unowned cargo",
  );
}
const empty = fleet.createStagingInventory(
  base.materials.map((m) => ({ ...m, stock: 0 })),
  24,
  0,
  2,
  0,
);
assert.equal(
  fleet.takeWarehouseLoad(empty, materials[0].id),
  true,
  "demo warehouse replenishes a requested load",
);
assert.equal(
  empty.warehouseReplenished[materials[0].id],
  materials[0].tripQty,
  "replenishment is recorded as an inflow",
);
assert.equal(fleet.transferStaging(empty, materials[0].id, -1), false);
assert.deepEqual(fleet.consumeLineSide(empty, base.materials, 60), {
  A: false,
  B: false,
});
const full = fleet.createStagingInventory(base.materials, 2, 2, 2, 0);
assert.ok(fleet.takeWarehouseLoad(full, materials[0].id));
const fullBefore = JSON.stringify(full);
assert.equal(fleet.transferStaging(full, materials[0].id, 1), false);
assert.equal(
  JSON.stringify(full),
  fullBefore,
  "blocked unloading does not change stock",
);
conserved(full);
const inv = fleet.createStagingInventory(base.materials, 24, 17, 2, 1);
const previewCopy = fleet.cloneStagingInventory(inv);
fleet.takeWarehouseLoad(previewCopy, materials[0].id);
assert.notEqual(
  JSON.stringify(previewCopy),
  JSON.stringify(inv),
  "scenario preview gets an isolated copy of the starting ledger",
);
assert.equal(
  inv.warehouseReplenished[materials[0].id],
  0,
  "preview inventory changes do not affect the main ledger",
);
const vehicles = [
  ...Array.from({ length: 7 }, (_, i) =>
    fleet.createVehicle(
      i,
      "AMR",
      materials[i % 4],
      materials[i % 4].line === "A" ? -6 : 6,
      inv,
      12,
      15,
    ),
  ),
  ...["A", "B"].flatMap((line) =>
    materials
      .filter((m) => m.line === line)
      .map((m, i) =>
        fleet.createVehicle(i, "AGV", m, line === "A" ? -6 : 6, inv, 6, 15),
      ),
  ),
];
conserved(inv);
for (let second = 0; second < 3600; second++) {
  vehicles.forEach((v) => fleet.animateVehicle(v, 1, inv, vehicles));
  fleet.consumeLineSide(inv, base.materials, 1);
  conserved(inv);
}
assert.ok(Object.values(inv.consumed).some((value) => value > 0));
assert.ok(
  Object.values(inv.delivered).every((value) => value > 0),
  `AGVs deliver all four SKUs on both lines (${JSON.stringify(inv.delivered)})`,
);
vehicles.forEach((v) => fleet.disposeObjects(v.m));

// Continuous warehouse replenishment: AMRs must resume and deliver instead of remaining parked.
const replenished = fleet.createStagingInventory(base.materials, 24, 0, 2, 0);
for (const material of materials) replenished.warehouseStock[material.id] = 0;
const demoFleet = [
  ...Array.from({ length: 7 }, (_, i) =>
    fleet.createVehicle(
      i,
      "AMR",
      materials[i % 4],
      materials[i % 4].line === "A" ? -6 : 6,
      replenished,
      12,
      15,
      7,
    ),
  ),
  ...["A", "B"].flatMap((line) =>
    materials
      .filter((m) => m.line === line)
      .map((m, i) =>
        fleet.createVehicle(
          i,
          "AGV",
          m,
          line === "A" ? -6 : 6,
          replenished,
          6,
          15,
        ),
      ),
  ),
];
const startingDistances = demoFleet.map((vehicle) => vehicle.distance);
for (let frame = 0; frame < 120; frame++)
  demoFleet.forEach((vehicle) =>
    fleet.animateVehicle(vehicle, 0.1, replenished, demoFleet),
  );
assert.ok(
  Object.values(replenished.warehouseReplenished).some(
    (quantity) => quantity > 0,
  ),
  "warehouse replenishment keeps AMRs supplied",
);
for (let frame = 0; frame < 600; frame++) {
  for (const material of materials) {
    const quantity = material.tripQty * replenished.loadsPerTrip;
    replenished.warehouseStock[material.id] += quantity;
    replenished.warehouseReplenished[material.id] += quantity;
  }
  demoFleet.forEach((vehicle) =>
    fleet.animateVehicle(vehicle, 0.1, replenished, demoFleet),
  );
  fleet.consumeLineSide(replenished, base.materials, 6);
}
assert.ok(
  demoFleet
    .slice(0, 7)
    .some((vehicle, index) => vehicle.distance !== startingDistances[index]),
  "AMRs advance with continuous warehouse stock",
);
assert.ok(
  Object.values(replenished.delivered).some((value) => value > 0),
  "AMRs deliver from continuously replenished warehouse",
);
demoFleet.forEach((vehicle) => fleet.disposeObjects(vehicle.m));

for (const scenario of config.demoScenarios) {
  const snapshot = engine.calculateOperationsSnapshot({
    ...inputs,
    productionFactor: scenario.productionPercent / 100,
    productionMix: scenario.mix,
    amrCount: scenario.resources.amr,
    agvByLine: scenario.resources.agvByLine,
  });
  const ledger = fleet.createStagingInventory(
    snapshot.materials,
    24,
    config.resources.staging.demoInitialLoads,
    2,
    1,
  );
  const scenarioFleet = [
    ...Array.from({ length: scenario.resources.amr }, (_, index) =>
      fleet.createVehicle(
        index,
        "AMR",
        snapshot.materials[index % 4],
        snapshot.materials[index % 4].line === "A" ? -6 : 6,
        ledger,
        12,
        15,
        scenario.resources.amr,
      ),
    ),
    ...["A", "B"].flatMap((line) =>
      Array.from({ length: scenario.resources.agvByLine[line] }, (_, index) =>
        fleet.createVehicle(
          index,
          "AGV",
          snapshot.materials.filter((item) => item.line === line)[index % 2],
          line === "A" ? -6 : 6,
          ledger,
          6,
          15,
        ),
      ),
    ),
  ];
  for (let frame = 0; frame < 1200; frame++) {
    scenarioFleet.forEach((vehicle) =>
      fleet.animateVehicle(vehicle, 0.05, ledger, scenarioFleet),
    );
    fleet.consumeLineSide(ledger, snapshot.materials, 3);
    conserved(ledger);
  }
  assert.ok(
    Object.values(ledger.delivered).every((value) => value > 0),
    `${scenario.id}: both lines receive all material codes during a 60-second demo`,
  );
  scenarioFleet.forEach((vehicle) => fleet.disposeObjects(vehicle.m));
}
for (const [percent, amrCount, agvByLine] of [
  [110, 9, { A: 3, B: 2 }],
  [120, 9, { A: 3, B: 2 }],
]) {
  const snapshot = engine.calculateOperationsSnapshot({
    ...inputs,
    productionFactor: percent / 100,
    amrCount,
    agvByLine,
  });
  const amrByLine = engine.allocateAmrCounts(
    amrCount,
    Object.fromEntries(
      snapshot.agvLines.map((line) => [line.line, line.demand]),
    ),
  );
  const ledger = fleet.createStagingInventory(
    snapshot.materials,
    24,
    config.resources.staging.demoInitialLoads,
    config.resources.lineSideLoadsPerMaterial,
    config.resources.initialLineSideLoads,
  );
  const scenarioFleet = [
    ...["A", "B"].flatMap((line) =>
      Array.from({ length: amrByLine[line] }, (_, index) => {
        const lineMaterials = materials.filter(
          (material) => material.line === line,
        );
        return fleet.createVehicle(
          index,
          "AMR",
          lineMaterials[index % lineMaterials.length],
          line === "A" ? -6 : 6,
          ledger,
          config.resources.amr.cycleMinutes,
          config.resources.amr.handlingSeconds,
          amrByLine[line],
        );
      }),
    ),
    ...["A", "B"].flatMap((line) =>
      Array.from({ length: agvByLine[line] }, (_, index) => {
        const lineMaterials = materials.filter(
          (material) => material.line === line,
        );
        return fleet.createVehicle(
          index,
          "AGV",
          lineMaterials[index % lineMaterials.length],
          line === "A" ? -6 : 6,
          ledger,
          config.resources.agv.cycleMinutes,
          config.resources.agv.handlingSeconds,
          agvByLine[line],
        );
      }),
    ),
  ];
  const starvationEpisodes = { A: 0, B: 0 };
  let previousRunning = { A: true, B: true };
  for (let frame = 0; frame < 1200; frame++) {
    scenarioFleet.forEach((vehicle) =>
      fleet.animateVehicle(vehicle, 0.05, ledger, scenarioFleet),
    );
    const running = fleet.consumeLineSide(ledger, snapshot.materials, 3);
    for (const line of ["A", "B"]) {
      if (!running[line] && previousRunning[line]) starvationEpisodes[line]++;
      previousRunning[line] = running[line];
    }
  }
  assert.deepEqual(
    starvationEpisodes,
    { A: 0, B: 0 },
    `plan ${percent}%: recommended resources prevent line-side starvation for one simulated hour`,
  );
  scenarioFleet.forEach((vehicle) => fleet.disposeObjects(vehicle.m));
}
console.log(
  "PASS: four demo cases, 110%/120% plan delivery, stock conservation, isolated preview, replenishment and 1h simulation.",
);
