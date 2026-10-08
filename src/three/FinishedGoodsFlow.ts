import * as THREE from "three";
import { FINISHED_GOODS } from "../services/packing";

/** Downstream visual ledger: only receives products that leave a live conveyor. */
export function createFinishedGoodsFlow() {
  const group = new THREE.Group();
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const box = (
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = group,
  ) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
      );
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      materials.get(color),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  box(18, 0.15, 28, 0x183c45, 33, 0, 0);
  box(5, 0.04, 27, 0x435365, 22, 0.09, 0);
  box(7, 0.04, 27, 0x435365, 28, 0.09, 0);
  box(10, 0.04, 27, 0x294d6a, 37, 0.09, 0);

  const lines = ["A", "B"].map((line, index) => {
    const z = index === 0 ? -6 : 6;
    box(3, 1.1, 2, 0x64748b, 21.5, 0.6, z);
    box(2, 0.1, 1.6, 0xd6a76a, 21.5, 1.2, z);
    box(3.5, 0.3, 1.6, 0x475569, 20.2, 0.25, z);
    const product = box(0.65, 0.4, 0.65, 0x38bdf8, 21.5, 1.5, z);
    const worker = new THREE.Group();
    worker.position.set(21.5, 0.1, z + 1.6);
    group.add(worker);
    worker.userData.hoverLabel = `Nhân viên đóng gói · Line ${line}`;
    box(0.6, 0.8, 0.4, 0x2563eb, 0, 1.1, 0, worker);
    box(0.4, 0.4, 0.4, 0xf0c5a0, 0, 1.75, 0, worker);
    box(0.52, 0.12, 0.52, 0xfacc15, 0, 2, 0, worker);
    [-0.18, 0.18].forEach((x) =>
      box(0.2, 0.7, 0.25, 0x1e293b, x, 0.4, 0, worker),
    );
    const arms = [-0.42, 0.42].map((x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.4, 0);
      worker.add(pivot);
      box(0.18, 0.65, 0.18, 0x2563eb, 0, -0.3, 0, pivot);
      box(0.2, 0.18, 0.2, 0xf0c5a0, 0, -0.63, 0, pivot);
      return pivot;
    });
    const secondWorker = worker.clone(true);
    secondWorker.position.x += 1.1;
    secondWorker.visible = false;
    group.add(secondWorker);
    const secondArms = arms.map(
      (arm) => secondWorker.children[worker.children.indexOf(arm)],
    );
    box(1.9, 0.08, 4, 0x38bdf8, 19.6, 0.16, z - 2.5);
    const unpacked = Array.from({ length: 48 }, (_, i) =>
      box(
        0.5,
        0.4,
        0.5,
        0x38bdf8,
        19.15 + (i % 2) * 0.65,
        0.42 + Math.floor(i / 12) * 0.45,
        z - 4 + Math.floor((i % 12) / 2) * 0.55,
      ),
    );
    unpacked.forEach((mesh, i) => {
      mesh.name = `finished-unpacked-${line}-${i}`;
    });
    const vehicle = new THREE.Group();
    group.add(vehicle);
    vehicle.userData.hoverLabel = `AGV thành phẩm · Line ${line}`;
    box(1.6, 0.5, 1.2, 0x14b8a6, 0, 0.4, 0, vehicle);
    box(1.4, 0.12, 1.1, 0xd6a76a, 0, 0.72, 0, vehicle);
    [-0.6, 0.6].forEach((x) =>
      [-0.45, 0.45].forEach((wz) =>
        box(0.25, 0.3, 0.22, 0x111827, x, 0.2, wz, vehicle),
      ),
    );
    const cargo = box(1.1, 0.7, 0.85, 0xd97706, 0, 1.12, 0, vehicle);
    // Packed boxes remain on this pickup bay until the AGV returns.
    box(2, 0.08, 4, 0xfacc15, 23, 0.16, z - 2.5);
    const waiting = Array.from({ length: 12 }, (_, i) =>
      box(
        0.65,
        0.5,
        0.65,
        0xd97706,
        22.5 + (i % 2),
        0.48 + Math.floor(i / 8) * 0.5,
        z - 4 + Math.floor((i % 8) / 2) * 0.85,
      ),
    );
    waiting.forEach((mesh, i) => {
      mesh.name = `finished-waiting-${line}-${i}`;
    });
    const stored = Array.from({ length: 36 }, (_, i) =>
      box(
        0.85,
        0.6,
        0.85,
        0xd97706,
        34 + (i % 6),
        0.8 + Math.floor(i / 18) * 1.4,
        z - 2 + Math.floor((i % 18) / 6) * 1.5,
      ),
    );
    stored.forEach((mesh, i) => {
      mesh.name = `finished-stock-${line}-${i}`;
    });
    [0.4, 1.8].forEach((y) => box(7, 0.1, 5, 0x38bdf8, 36.5, y, z));
    [33, 40].forEach((x) =>
      [-2.5, 2.5].forEach((dz) =>
        box(0.12, 3.1, 0.12, 0x38bdf8, x, 1.55, z + dz),
      ),
    );
    // Enter the warehouse receiving bay through the aisle outside the racks.
    box(2.4, 0.08, 1.5, 0xfacc15, 33, 0.16, z + 3);
    const receiving = box(1.1, 0.7, 0.85, 0xd97706, 33, 0.57, z + 3);
    receiving.visible = false;
    receiving.name = `finished-receiving-${line}`;
    const points = [
      [23, z],
      [32, z],
      [32, z + 3],
      [23, z + 3],
      [23, z],
    ];
    const route = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        points.map(([x, pz]) => new THREE.Vector3(x, 0.15, pz)),
      ),
      new THREE.LineBasicMaterial({ color: 0x2dd4bf }),
    );
    group.add(route);
    return {
      line,
      z,
      product,
      arms,
      worker,
      workerCopies: [worker, secondWorker],
      workerArmSets: [arms, secondArms],
      workers: 1,
      unpacked,
      vehicle,
      cargo,
      receiving,
      waiting,
      stored,
      raw: 0,
      packed: 0,
      stock: 0,
      carried: 0,
      packTime: 0,
      dwell: 0,
      warehouseDwell: 0,
      phase: 0,
      pickupWait: 0,
    };
  });

  const reset = () => {
    lines.forEach((state) => {
      state.raw =
        state.packed =
        state.stock =
        state.carried =
        state.packTime =
        state.dwell =
        state.phase =
          0;
      state.pickupWait = 0;
      state.warehouseDwell = 0;
      state.vehicle.position.set(23, 0, state.z);
      state.vehicle.rotation.y = 0;
      state.product.visible = state.cargo.visible = false;
      state.receiving.visible = false;
      state.cargo.position.set(0, 1.12, 0);
      [...state.unpacked, ...state.waiting, ...state.stored].forEach((mesh) => {
        mesh.visible = false;
      });
    });
  };
  reset();
  const saveState = () =>
    lines.map((state) => ({
      line: state.line,
      workers: state.workers,
      raw: state.raw,
      packed: state.packed,
      stock: state.stock,
      carried: state.carried,
      packTime: state.packTime,
      dwell: state.dwell,
      warehouseDwell: state.warehouseDwell,
      phase: state.phase,
      pickupWait: state.pickupWait,
      position: state.vehicle.position.toArray(),
      rotation: state.vehicle.rotation.y,
    }));
  return {
    group,
    reset,
    saveState,
    restoreState: (saved: ReturnType<typeof saveState>) =>
      saved.forEach((item) => {
        const state = lines.find((line) => line.line === item.line);
        if (!state) return;
        Object.assign(state, {
          workers: item.workers,
          raw: item.raw,
          packed: item.packed,
          stock: item.stock,
          carried: item.carried,
          packTime: item.packTime,
          dwell: item.dwell,
          warehouseDwell: item.warehouseDwell,
          phase: item.phase,
          pickupWait: item.pickupWait,
        });
        state.vehicle.position.fromArray(item.position);
        state.vehicle.rotation.y = item.rotation;
      }),
    get hoverTargets() {
      return lines.flatMap((state) => [
        ...state.workerCopies.filter((worker) => worker.visible),
        state.vehicle,
      ]);
    },
    configure: (workersByLine: Record<string, number>) =>
      lines.forEach((state) => {
        state.workers = Math.max(0, Math.round(workersByLine[state.line] ?? 0));
        while (state.workerCopies.length < state.workers) {
          const index = state.workerCopies.length;
          const worker = state.worker.clone(true);
          worker.position.set(
            21.5 + (index % 2) * 1.1,
            0.1,
            state.z + (index % 4 < 2 ? 1.6 : -1.6),
          );
          worker.rotation.y = index % 4 < 2 ? 0 : Math.PI;
          group.add(worker);
          state.workerCopies.push(worker);
          state.workerArmSets.push(
            state.arms.map(
              (arm) => worker.children[state.worker.children.indexOf(arm)],
            ),
          );
        }
        state.workerCopies.forEach((worker, i) => {
          worker.visible = i < state.workers;
        });
      }),
    getStatus: () =>
      lines.map(({ line, workers, raw, packed, stock, carried }) => ({
        line,
        workers,
        raw,
        packed,
        stock,
        carried,
      })),
    receive: (line: string) => {
      const state = lines.find((item) => item.line === line);
      if (state) state.raw++;
    },
    update: (
      animationDt: number,
      simulationDt: number,
      speedsByLine: Record<string, number> = {},
    ) => {
      lines.forEach((state) => {
        if (state.raw > 0 && state.workers > 0) {
          state.packTime += simulationDt * state.workers;
          while (
            state.packTime >= FINISHED_GOODS.packingSecondsPerUnit &&
            state.raw > 0
          ) {
            state.raw--;
            state.packed++;
            state.packTime -= FINISHED_GOODS.packingSecondsPerUnit;
          }
        } else state.packTime = 0;
        state.product.visible = state.raw > 0;
        state.workerArmSets.flat().forEach((arm, i) => {
          arm.rotation.x =
            state.raw > 0 ? 0.8 + Math.sin(state.packTime * 0.5 + i) * 0.35 : 0;
        });
        state.pickupWait =
          state.phase === 0 && state.packed > 0
            ? state.pickupWait + simulationDt
            : 0;
        if (
          state.phase === 0 &&
          state.packed > 0 &&
          state.pickupWait >= FINISHED_GOODS.pickupWaitSeconds
        ) {
          state.carried = Math.min(
            FINISHED_GOODS.unitsPerAgvLoad,
            state.packed,
          );
          state.packed -= state.carried;
          state.phase = 1;
          state.pickupWait = 0;
        }
        const targets = [
          [23, state.z],
          [32, state.z],
          [32, state.z + 3],
          [23, state.z + 3],
          [23, state.z],
        ];
        const savedUnloadProgress =
          state.phase === 2 ? Math.min(1, state.warehouseDwell / 30) : 0;
        state.cargo.position.set(
          0,
          1.12 - 0.55 * savedUnloadProgress,
          -savedUnloadProgress,
        );
        let remaining = animationDt;
        const speed = Math.max(
          0,
          speedsByLine[state.line] ?? FINISHED_GOODS.agvSceneSpeed,
        );
        const simulatedSecondsPerAnimationSecond =
          animationDt > 0 ? simulationDt / animationDt : 0;
        // Carry unused frame time through waypoints; corners never cause a pause
        // or a cargo handoff. Only the warehouse receiving dock unloads goods.
        for (
          let transitions = 0;
          state.phase > 0 && remaining > 0 && transitions < 16;
          transitions++
        ) {
          const [x, z] = targets[state.phase];
          const delta = new THREE.Vector3(x, 0, z).sub(state.vehicle.position);
          const distance = delta.length();
          if (distance > 1e-8 && speed <= 0) break;
          const travelTime =
            distance > 1e-8 ? Math.min(remaining, distance / speed) : 0;
          if (delta.lengthSq() > 1e-8) {
            // The vehicle's long axis is local +X, rather than local +Z.
            const heading = Math.atan2(-delta.z, delta.x);
            const difference = Math.atan2(
              Math.sin(heading - state.vehicle.rotation.y),
              Math.cos(heading - state.vehicle.rotation.y),
            );
            state.vehicle.rotation.y +=
              Math.sign(difference) *
              Math.min(Math.abs(difference), travelTime * 12);
          }
          remaining -= travelTime;
          if (distance > speed * travelTime + 1e-8) {
            state.vehicle.position.add(
              delta.normalize().multiplyScalar(speed * travelTime),
            );
            break;
          }
          state.vehicle.position.set(x, 0, z);
          if (state.phase === 2) {
            const handlingTime = Math.min(
              remaining,
              (30 - state.warehouseDwell) /
                Math.max(simulatedSecondsPerAnimationSecond, 1e-8),
            );
            state.warehouseDwell +=
              handlingTime * simulatedSecondsPerAnimationSecond;
            remaining -= handlingTime;
            const progress = Math.min(1, state.warehouseDwell / 30);
            state.cargo.position.set(0, 1.12 - 0.55 * progress, -progress);
            if (progress >= 1) {
              state.stock += state.carried;
              state.carried = 0;
              state.warehouseDwell = 0;
              state.phase++;
            } else break;
          } else {
            state.phase = state.phase === 4 ? 0 : state.phase + 1;
          }
        }
        state.cargo.visible = state.carried > 0;
        state.receiving.visible = state.stock > 0;
        state.unpacked.forEach((mesh, i) => {
          mesh.visible = i < Math.max(0, state.raw - state.workers);
        });
        state.waiting.forEach((mesh, i) => {
          mesh.visible = i < state.packed;
        });
        state.stored.forEach((mesh, i) => {
          mesh.visible = i < state.stock;
        });
      });
    },
  };
}
