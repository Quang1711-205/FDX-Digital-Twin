import * as THREE from 'three';
import { STAGING_LAYOUT } from './FactoryFloor';


export interface Vehicle {
  fleetIndex: number;
  dockQueueDistance: number;
  m: THREE.Group;
  payload: THREE.Group;
  emptyPallet: THREE.Group;
  kind: 'AMR' | 'AGV';
  trafficGroup: string;
  cycleMinutes: number;
  handlingSeconds: number;
  points: THREE.Vector3[];
  lengths: number[];
  totalLength: number;
  distance: number;
  wait: number;
  deliveryDistance: number;
  phase: 'moving' | 'loading' | 'delivering';
  loaded: boolean;
  blocked: 'empty' | 'full' | null;
  trafficWaiting: boolean;
  seekingMaterial: boolean;
}

interface Material { id: string; name: string; line: string; perUnit?: number; tripQty?: number; stock?: number }
const MATERIAL_COLORS = [0xfb923c, 0xeab308, 0xa78bfa, 0x2dd4bf];

/** Viewport-only material loads; never feeds the forecasting engine or History. */
export interface StagingInventory {
  materials: Material[];
  stock: Record<string, number>;
  lines: Record<string, string>;
  tripQty: Record<string, number>;
  loadsPerTrip: number;
  warehouseStock: Record<string, number>;
  warehouseReplenished: Record<string, number>;
  inTransit: Record<string, number>;
  lineSideStock: Record<string, number>;
  lineSideCapacity: Record<string, number>;
  lineReserved: Record<string, number>;
  consumed: Record<string, number>;
  delivered: Record<string, number>;
  capacityByLine: Record<string, number>;
}

export function stagingCount(inventory: StagingInventory, line: string) {
  return Object.entries(inventory.stock).reduce((sum, [id, count]) => sum + (inventory.lines[id] === line ? count : 0), 0);
}

export function createStagingInventory(materials: Array<Material & { stock: number; tripQty: number }>, capacity: number, initialLoads: number, lineSideLoadsPerMaterial = 2, initialLineSideLoads = 1, loadsPerTrip = 1): StagingInventory {
  const inventory: StagingInventory = {
    materials: materials.map((material) => ({ ...material })),
    stock: Object.fromEntries(materials.map(material => [material.id, 0])),
    lines: Object.fromEntries(materials.map(material => [material.id, material.line])),
    tripQty: Object.fromEntries(materials.map(material => [material.id, material.tripQty])),
    loadsPerTrip,
    warehouseStock: Object.fromEntries(materials.map(material => [material.id, material.stock])),
    warehouseReplenished: Object.fromEntries(materials.map(material => [material.id, 0])),
    inTransit: Object.fromEntries(materials.map(material => [material.id, 0])),
    lineSideStock: Object.fromEntries(materials.map(material => [material.id, 0])),
    lineSideCapacity: Object.fromEntries(materials.map(material => [material.id, material.tripQty * loadsPerTrip * lineSideLoadsPerMaterial])),
    lineReserved: Object.fromEntries(materials.map(material => [material.id, 0])),
    consumed: Object.fromEntries(materials.map(material => [material.id, 0])),
    delivered: Object.fromEntries(materials.map(material => [material.id, 0])),
    capacityByLine: { A: Math.floor(capacity / 2), B: capacity - Math.floor(capacity / 2) }
  };
  for (const material of materials) {
    const initialQty = Math.min(material.stock, material.tripQty * loadsPerTrip * initialLineSideLoads);
    inventory.lineSideStock[material.id] = initialQty;
    inventory.warehouseStock[material.id] -= initialQty;
  }
  // Initial allocations are taken from the configured stock, never created implicitly.
  const activeMaterials = materials.filter(material => (material.perUnit ?? 0) > 0);
  for (let i = 0; i < Math.min(capacity, initialLoads); i++) {
    if (!activeMaterials.length) break;
    const material = activeMaterials[i % activeMaterials.length];
    if (stagingCount(inventory, material.line) < inventory.capacityByLine[material.line] && inventory.warehouseStock[material.id] >= material.tripQty) {
      inventory.stock[material.id]++;
      inventory.warehouseStock[material.id] -= material.tripQty;
    }
  }
  return inventory;
}

export function takeWarehouseLoad(inventory: StagingInventory, materialId: string) {
  const quantity = (inventory.tripQty[materialId] ?? 0) * inventory.loadsPerTrip;
  if (!quantity) return false;
  // Demo warehouse is continuously replenished; the replenishment is recorded as an inflow.
  if (inventory.warehouseStock[materialId] < quantity) {
    const replenishment = quantity - inventory.warehouseStock[materialId];
    inventory.warehouseStock[materialId] += replenishment;
    inventory.warehouseReplenished[materialId] += replenishment;
  }
  inventory.warehouseStock[materialId] -= quantity;
  inventory.inTransit[materialId] += quantity;
  return true;
}

export function cloneStagingInventory(source: StagingInventory): StagingInventory {
  return {
    ...source,
    materials: source.materials.map(material => ({ ...material })),
    stock: { ...source.stock }, lines: { ...source.lines }, tripQty: { ...source.tripQty },
    warehouseStock: { ...source.warehouseStock }, warehouseReplenished: { ...source.warehouseReplenished },
    inTransit: { ...source.inTransit }, lineSideStock: { ...source.lineSideStock },
    lineSideCapacity: { ...source.lineSideCapacity }, consumed: { ...source.consumed },
    lineReserved: { ...source.lineReserved },
    delivered: { ...source.delivered }, capacityByLine: { ...source.capacityByLine },
  };
}

export function deliverLineSideLoad(inventory: StagingInventory, materialId: string) {
  const quantity = (inventory.tripQty[materialId] ?? 0) * inventory.loadsPerTrip;
  if (!quantity || inventory.inTransit[materialId] + 1e-8 < quantity || inventory.lineSideStock[materialId] + quantity > inventory.lineSideCapacity[materialId]) return false;
  inventory.inTransit[materialId] = Math.max(0, inventory.inTransit[materialId] - quantity);
  inventory.lineSideStock[materialId] += quantity;
  inventory.lineReserved[materialId] = Math.max(0, inventory.lineReserved[materialId] - quantity);
  inventory.delivered[materialId] += quantity;
  return true;
}

export function chooseAmrMaterial(inventory: StagingInventory, line: string) {
  const candidates = inventory.materials.filter((material) => material.line === line && (material.tripQty ?? 0) > 0 && (material.perUnit ?? 0) > 0);
  candidates.sort((a, b) => {
    const coverA = (inventory.stock[a.id] * (inventory.tripQty[a.id] ?? 0) + inventory.lineSideStock[a.id]) / Math.max(a.perUnit ?? 1, 0.001);
    const coverB = (inventory.stock[b.id] * (inventory.tripQty[b.id] ?? 0) + inventory.lineSideStock[b.id]) / Math.max(b.perUnit ?? 1, 0.001);
    return coverA - coverB;
  });
  return candidates[0]?.id ?? null;
}

export function consumeLineSide(inventory: StagingInventory, materials: Array<{ id: string; line: string; consumptionPerHour: number }>, dtSeconds: number) {
  const canProduce: Record<string, boolean> = { A: true, B: true };
  for (const line of ['A', 'B']) {
    const required = materials.filter((material) => material.line === line && material.consumptionPerHour > 0);
    if (!required.length || required.some((material) => inventory.lineSideStock[material.id] <= 0)) {
      canProduce[line] = false;
      continue;
    }
    const secondsUntilEmpty = Math.min(...required.map((material) => inventory.lineSideStock[material.id] * 3600 / material.consumptionPerHour));
    const consumeSeconds = Math.min(dtSeconds, secondsUntilEmpty);
    for (const material of required) {
      const amount = material.consumptionPerHour * consumeSeconds / 3600;
      inventory.lineSideStock[material.id] = Math.max(0, inventory.lineSideStock[material.id] - amount);
      inventory.consumed[material.id] += amount;
    }
    if (secondsUntilEmpty < dtSeconds) canProduce[line] = false;
  }
  return canProduce;
}

export function transferStaging(inventory: StagingInventory, materialId: string, change: 1 | -1, loadCount = 1) {
  const line = inventory.lines[materialId];
  if (!line) return false;
  if (change === -1 && inventory.stock[materialId] < loadCount) return false;
  if (change === 1 && inventory.inTransit[materialId] + 1e-8 < inventory.tripQty[materialId] * loadCount) return false;
  if (change === 1 && stagingCount(inventory, line) + loadCount > inventory.capacityByLine[line]) return false;
  inventory.stock[materialId] += change * loadCount;
  if (change === -1) inventory.lineReserved[materialId] += inventory.tripQty[materialId] * loadCount;
  inventory.inTransit[materialId] += change === 1 ? -(inventory.tripQty[materialId] ?? 0) * loadCount : (inventory.tripQty[materialId] ?? 0) * loadCount;
  return true;
}

function box(parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 }));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

/** Visual waypoints use the active material's line; they are not task/ETA data. */
function route(line: string, binZ: number, kind: 'AMR' | 'AGV' = 'AGV') {
  const { amrLaneX, amrDockX, agvLaneX, agvDockX, dockZ } = STAGING_LAYOUT;
  const side = line === 'A' ? -1 : 1;
  const stopZ = side * dockZ;
  if (kind === 'AMR') return [
    [-22, 0], [-22, -11.5], [amrLaneX, -11.5],
    [amrLaneX, stopZ - 1.8], [amrDockX, stopZ - 1.8], [amrDockX, stopZ],
    [amrDockX, stopZ + 1.8], [amrLaneX, stopZ + 1.8],
    [amrLaneX, 11.5], [-22, 11.5], [-22, 0]
  ].map(([x, z]) => new THREE.Vector3(x, 0.12, z));
  return [
    [agvDockX, stopZ], [agvDockX, stopZ + side * 1.8], [agvLaneX, stopZ + side * 1.8],
    [agvLaneX, side * 10], [2.25, side * 10], [2.25, binZ],
    [2.25, side * 1.3], [agvLaneX, side * 1.3],
    [agvLaneX, stopZ - side * 2.2], [agvDockX, stopZ - side * 2.2], [agvDockX, stopZ]
  ].map(([x, z]) => new THREE.Vector3(x, 0.12, z));
}

export function createVehicle(index: number, kind: 'AMR' | 'AGV', material: Material, binZ: number, inventory?: StagingInventory, cycleMinutes = 12, handlingSeconds = 15, fleetSize = kind === 'AMR' ? 7 : 2): Vehicle {
  const m = new THREE.Group();
  m.name = `${kind}-${kind === 'AGV' ? `${material.line}-` : ''}${String(index + 1).padStart(2, '0')}`;
  m.userData = { vehicleType: kind, materialId: material.id, line: material.line };

  box(m, kind === 'AGV' ? [1.8, 0.38, 1.1] : [1.45, 0.38, 1.05], [0, 0.34, 0], kind === 'AGV' ? 0xfacc15 : 0x2563eb);
  for (const x of [-0.52, 0.52]) for (const z of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.2, z);
    m.add(wheel);
  }
  box(m, [0.85, 0.1, 0.9], [0, 0.6, 0], 0x94a3b8);
  if (kind === 'AMR') {
    const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x075985 }));
    sensor.position.set(-0.55, 0.65, 0);
    m.add(sensor);
  } else {
    box(m, [0.18, 0.08, 0.8], [-0.72, 0.57, 0], 0x111827);
    box(m, [0.18, 0.08, 0.8], [0.72, 0.57, 0], 0x111827);
  }
  const loadPosition: [number, number, number] = [0.12, 0.88, 0];
  const payload = new THREE.Group();
  payload.position.set(...loadPosition);
  const colorIndex = Number(material.id.replace(/\D/g, '')) - 1;
  box(payload, [0.78, 0.54, 0.78], [0, 0, 0], MATERIAL_COLORS[colorIndex % MATERIAL_COLORS.length] ?? MATERIAL_COLORS[0]);
  box(payload, [0.8, 0.06, 0.8], [0, 0.27, 0], 0xe2e8f0); // tote lid
  m.add(payload);
  const emptyPallet = new THREE.Group();
  emptyPallet.position.set(loadPosition[0], 0.68, 0);
  for (const z of [-0.3, 0, 0.3]) box(emptyPallet, [0.85, 0.08, 0.2], [0, 0, z], 0x94a3b8);
  m.add(emptyPallet);
  const points = route(material.line, binZ, kind);
  const lengths = points.slice(1).map((point, i) => point.distanceTo(points[i]));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const distance = (lengths[0] + index * 7.3 + (kind === 'AGV' ? 4 : 0)) % totalLength;
  const deliveryDistance = lengths.slice(0, 5).reduce((sum, length) => sum + length, 0);
  const vehicle: Vehicle = { fleetIndex: index, dockQueueDistance: Math.max(0, totalLength - index * 3.4), m, payload, emptyPallet, kind, trafficGroup: kind === 'AMR' ? 'AMR' : `AGV-${material.line}`, cycleMinutes, handlingSeconds, points, lengths, totalLength, distance, wait: 0, deliveryDistance, phase: 'moving', loaded: distance < deliveryDistance, blocked: null, trafficWaiting: false, seekingMaterial: false };
  if (inventory && kind === 'AGV') {
    // Stagger AGVs over the line route so added vehicles do not queue on one dock segment.
    vehicle.distance = index * totalLength / Math.max(1, fleetSize);
    vehicle.loaded = false;
    vehicle.phase = index === 0 ? 'loading' : 'moving';
        vehicle.wait = index === 0 ? handlingSeconds / 60 : 0;
  } else if (inventory && kind === 'AMR') {
    // Start empty. The AMR reserves inventory only when it reaches the warehouse pickup.
    vehicle.loaded = false;
    vehicle.seekingMaterial = false;
    // Spread the AMR fleet around its loop so the shared warehouse lane starts as a convoy, not a pile.
    vehicle.distance = index * totalLength / Math.max(1, fleetSize);
    vehicle.phase = 'moving';
  }
  placeVehicle(vehicle);
  return vehicle;
}

function placeVehicle(v: Vehicle) {
  let remaining = v.distance;
  let segment = 0;
  while (segment < v.lengths.length - 1 && remaining > v.lengths[segment]) remaining -= v.lengths[segment++];
  const from = v.points[segment], to = v.points[segment + 1];
  const fraction = v.lengths[segment] > 0 ? remaining / v.lengths[segment] : 0;
  v.m.position.lerpVectors(from, to, fraction);
  v.m.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
  v.payload.visible = v.loaded;
  v.emptyPallet.visible = !v.loaded && v.phase !== 'loading';
  v.m.userData.activity = v.phase === 'loading' ? (v.kind === 'AMR' ? 'Nhận hàng tại kho/Picking' : 'Nhận hàng tại Staging') : v.phase === 'delivering' ? (v.kind === 'AMR' ? 'Dỡ hàng tại Staging' : 'Giao vật tư tại chuyền') : v.loaded ? 'Cấp vật tư' : 'Trả pallet rỗng';
  if (v.blocked) v.m.userData.activity = v.blocked === 'empty' ? 'Chờ vật tư tại Staging' : 'Chờ chỗ trống tại Staging';
  if (v.trafficWaiting) v.m.userData.activity = 'Chờ xe phía trước / bến nhận hàng';
}

export function animateVehicle(v: Vehicle, dt: number, inventory?: StagingInventory, fleet: Vehicle[] = []) {
  v.trafficWaiting = false;
  if (v.phase !== 'moving' || v.wait > 0) {
    v.wait = Math.max(0, v.wait - dt);
    if (v.wait === 0) {
      if (inventory && v.kind === 'AGV' && v.phase === 'loading') {
        const candidates = inventory.materials.filter(material => material.line === v.m.userData.line && (material.perUnit ?? 0) > 0 && inventory.stock[material.id] >= inventory.loadsPerTrip && inventory.lineSideStock[material.id] + inventory.lineReserved[material.id] + inventory.tripQty[material.id] * inventory.loadsPerTrip <= inventory.lineSideCapacity[material.id]);
        candidates.sort((a, b) => inventory.lineSideStock[a.id] / Math.max(a.perUnit ?? 1, .001) - inventory.lineSideStock[b.id] / Math.max(b.perUnit ?? 1, .001));
        const selected = candidates[0];
        if (selected) {
          v.m.userData.materialId = selected.id;
          const materialIndex = inventory.materials.findIndex(material => material.id === selected.id);
          const binZ = (selected.line === 'A' ? -6 : 6) + (materialIndex % 2 ? 1.9 : -1.9);
          v.points = route(selected.line, binZ, 'AGV');
          v.lengths = v.points.slice(1).map((point, index) => point.distanceTo(v.points[index]));
          v.totalLength = v.lengths.reduce((sum, length) => sum + length, 0);
          v.deliveryDistance = v.lengths.slice(0, 5).reduce((sum, length) => sum + length, 0);
          const crate = v.payload.children.find(object => object instanceof THREE.Mesh) as THREE.Mesh | undefined;
          if (crate && !Array.isArray(crate.material)) (crate.material as THREE.MeshStandardMaterial).color.setHex(MATERIAL_COLORS[materialIndex % MATERIAL_COLORS.length]);
        } else {
          // Wait at the actual staging dock until an AMR delivers an eligible load.
          v.blocked = 'empty';
          v.seekingMaterial = true;
          v.phase = 'loading';
          v.wait = 0.5;
          v.distance = v.dockQueueDistance;
          placeVehicle(v);
          return;
        }
      }
      if (inventory && v.kind === 'AMR' && v.phase === 'loading') {
        const wasWaitingForWarehouse = v.blocked === 'empty';
        const selected = chooseAmrMaterial(inventory, v.m.userData.line);
        if (!selected || !takeWarehouseLoad(inventory, selected)) {
          v.blocked = 'empty';
          v.seekingMaterial = true;
          // Queue AMRs on separate points before the warehouse dock.
          v.distance = v.dockQueueDistance;
          placeVehicle(v);
          return;
        }
        v.m.userData.materialId = selected;
        v.seekingMaterial = false;
        // A queued AMR resumes from the warehouse pickup point, not from its queue slot
        // near the end of the loop; otherwise it skips the staging drop-off indefinitely.
        if (wasWaitingForWarehouse) v.distance = 0;
        const crate = v.payload.children.find((object) => object instanceof THREE.Mesh) as THREE.Mesh | undefined;
        if (crate?.material && !Array.isArray(crate.material)) {
          const index = Number(selected.replace(/\D/g, '')) - 1;
          (crate.material as THREE.MeshStandardMaterial).color.setHex(MATERIAL_COLORS[index % MATERIAL_COLORS.length] ?? MATERIAL_COLORS[0]);
        }
      }
      if (inventory && v.kind === 'AGV' && v.phase === 'loading') {
        if (!transferStaging(inventory, v.m.userData.materialId, -1, inventory.loadsPerTrip)) {
          // It waits at the dock and retries after the staging stock changes.
          v.blocked = 'empty';
          v.seekingMaterial = true;
          v.phase = 'loading';
          v.wait = 0.5;
          v.distance = v.dockQueueDistance;
          placeVehicle(v);
          return;
        }
        if (v.blocked === 'empty') v.distance = 0;
      }
      if (inventory && v.kind === 'AMR' && v.phase === 'delivering' && !transferStaging(inventory, v.m.userData.materialId, 1, inventory.loadsPerTrip)) {
        v.blocked = 'full';
        placeVehicle(v);
        return;
      }
      if (inventory && v.kind === 'AGV' && v.phase === 'delivering' && !deliverLineSideLoad(inventory, v.m.userData.materialId)) {
        v.blocked = 'full';
        placeVehicle(v);
        return;
      }
      if (v.phase === 'loading') v.loaded = true;
      if (v.phase === 'loading' && v.kind === 'AGV') v.seekingMaterial = false;
      if (v.phase === 'delivering') v.loaded = false;
      v.blocked = null;
      v.phase = 'moving';
      v.wait = 0;
    }
  }
  else {
    // Configured demo cycle includes travel and two handling stops in simulated time.
    // At 1× playback, one wall-clock second represents one simulated minute.
    const serviceTime = v.handlingSeconds * 2 / 60;
    const travelSeconds = Math.max(0.1, v.cycleMinutes - serviceTime);
    const speed = v.totalLength / travelSeconds;
    const next = v.distance + speed * dt;
    // Inspect the proposed footprint, including corners and off-road dock entry.
    // The fleet's current positions also include stationary loading/unloading vehicles.
    const previousDistance = v.distance;
    const targetDistance = Math.min(next, v.loaded && previousDistance < v.deliveryDistance ? v.deliveryDistance : v.totalLength);
    let allowedAdvance = targetDistance - previousDistance;
    const minimumGap = 0.8;
    for (const other of fleet) {
      if (other === v || other.trafficGroup !== v.trafficGroup) continue;
      const progress = v.distance / v.totalLength;
      const otherProgress = other.distance / other.totalLength;
      const gapProgress = (otherProgress - progress + 1) % 1;
      const gapDistance = gapProgress * v.totalLength;
      if (gapProgress > 0 && gapProgress < 0.5 && gapDistance < allowedAdvance + minimumGap) {
        allowedAdvance = Math.min(allowedAdvance, Math.max(0, gapDistance - minimumGap));
      }
    }
    if (allowedAdvance + 1e-6 < targetDistance - previousDistance) {
      v.trafficWaiting = true;
      v.distance = previousDistance + allowedAdvance;
      placeVehicle(v);
      return;
    }
    v.distance = targetDistance;
    placeVehicle(v);
    if (v.loaded && previousDistance < v.deliveryDistance && next >= v.deliveryDistance) {
      v.distance = v.deliveryDistance;
      v.phase = 'delivering';
      v.wait = v.handlingSeconds / 60;
    } else if (next >= v.totalLength) {
      v.distance = 0;
      v.phase = 'loading';
      v.loaded = false;
      v.wait = v.handlingSeconds / 60;
    } else {
      v.distance = next;
    }
  }
  placeVehicle(v);
}

export function disposeObjects(root: THREE.Object3D) {
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      if (!(object instanceof THREE.Sprite)) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        const textured = material as THREE.MeshStandardMaterial;
        textured.map?.dispose();
        material.dispose();
      });
    }
  });
}

export function createFlowRoutes() {
  const group = new THREE.Group();
  const draw = (points: number[][], color: number) => {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x,z]) => new THREE.Vector3(x, 0.1, z))), new THREE.LineBasicMaterial({ color })));
  };
  draw([[-22,-11.5],[-8.8,-11.5],[-8.8,11.5],[-22,11.5],[-22,-11.5]],0xa78bfa);
  for (const side of [-1,1]) {
    const z = side * STAGING_LAYOUT.dockZ;
    draw([[-8.8,z-1.8],[-6.8,z-1.8],[-6.8,z+1.8],[-8.8,z+1.8]],0xa78bfa);
    const color = side < 0 ? 0x60a5fa : 0x2dd4bf;
    draw([[0.5,side*1.3],[0.5,side*10],[2.25,side*10],[2.25,side*1.3],[0.5,side*1.3]],color);
    draw([[0.5,z-side*2.2],[-1.4,z-side*2.2],[-1.4,z+side*1.8],[0.5,z+side*1.8]],color);
  }
  return group;
}
