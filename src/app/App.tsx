import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { UiIcon } from './DashboardUi';
import { FactoryOverview, TrendPanel, ResourceAllocation } from './DashboardPanels';

// Import mock data from src/json/
import P from '../json/production_plan.json';
import materialsData from '../json/materials.json';
import RS from '../json/logistics_resources.json';
import operationsData from '../json/operations.json';
import simulationsData from '../json/simulations.json';
import { calculateOperationsSnapshot } from '../services/operationsEngine';

const M = materialsData.items;
const OP = operationsData.threshold;
const SC = simulationsData.scenarios;

const COL = ['#22c55e', '#f59e0b', '#ef4444'];
const TXT = ['g', 'a', 'r'];

interface RunMetrics {
  utilization: number;
  capacity: number;
  trips: number;
  delay: number;
  risk: number;
  criticalMaterials: number;
  warningMaterials: number;
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
}

const RUN_HISTORY_KEY = 'fdx-logistics-run-history-v1';
const RUN_HISTORY_LIMIT = 25;

function readRunHistory(): RunRecord[] {
  try {
    const saved = localStorage.getItem(RUN_HISTORY_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is RunRecord =>
      !!record && typeof record === 'object' &&
      typeof record.id === 'string' && typeof record.timestamp === 'string' &&
      typeof record.name === 'string' && typeof record.productionPercent === 'number' &&
      !!record.before && !!record.simulatedAfter
    ).slice(0, RUN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export const App: React.FC = () => {
  const [f, setF] = useState<number>(1);
  const [amr, setAmr] = useState<number>(RS.amr.available);
  const [extra, setExtra] = useState<number>(0);
  const [sel, setSel] = useState<string>('s1');
  const [previewScenarioId, setPreviewScenarioId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(readRunHistory);
  const [done, setDone] = useState<RunRecord | null>(() => runHistory[0] ?? null);
  const [actualUtilInput, setActualUtilInput] = useState('');
  const [userSelected, setUserSelected] = useState<boolean>(false);
  const [executionLocked, setExecutionLocked] = useState(() => runHistory.length > 0);
  const executionLockRef = useRef(runHistory.length > 0);
  const [expandedLeftSection, setExpandedLeftSection] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLElement | null>(null);
  const [activeHeaderSection, setActiveHeaderSection] = useState('#stage');
  const historyDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  useEffect(() => {
    const syncHeaderSection = () => {
      const hash = window.location.hash;
      if (['#stage', '#comparison-panel', '#trend-panel', '#resource-summary'].includes(hash)) setActiveHeaderSection(hash);
    };
    syncHeaderSection();
    window.addEventListener('hashchange', syncHeaderSection);
    return () => window.removeEventListener('hashchange', syncHeaderSection);
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

  const padsRef = useRef<Record<string, THREE.Mesh> | null>(null);
  const binsRef = useRef<THREE.Mesh[]>([]);
  const stagingPalletsRef = useRef<THREE.Mesh[]>([]);
  const prodsRef = useRef<THREE.Mesh[]>([]);
  const moversRef = useRef<Array<{ m: THREE.Mesh; x0: number; x1: number; dir: number; x: number }>>([]);
  const amrsRef = useRef<Array<{ m: THREE.Group; l: THREE.Mesh; fk: boolean; z: number; x: number; dir: number; wait: number }>>([]);

  const labelElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Build one typed operations snapshot for the current state or a what-if scenario.
  const calc = (addA = 0, xt = 0, currentF = f, currentAmr = amr, currentExtra = extra) => {
    const snapshot = calculateOperationsSnapshot({
      unitsPerHour: P.unitsPerHour,
      productionFactor: currentF,
      amrCount: currentAmr + addA,
      extraTrips: currentExtra + xt,
      amrTripsPerHour: RS.amr.tripsPerHour,
      materials: M,
      thresholds: OP,
      capacities: {
        dockTripsPerHour: RS.warehouse.dockCapacity,
        pickingTripsPerHour: RS.picking.capacity,
        stagingPallets: RS.staging.pallets,
        lineUnitsPerHour: RS.line.capacityUnits
      }
    });
    return {
      units: snapshot.unitsPerHour,
      items: snapshot.materials.map(item => ({ ...item, cons: item.consumptionPerHour, trips: item.tripsPerHour, cover: item.coverMinutes, eff: item.effectiveCoverMinutes, lvl: item.level === 'CRITICAL' ? 2 : item.level === 'WARNING' ? 1 : 0 })),
      trips: snapshot.tripsPerHour,
      cap: snapshot.transportCapacity,
      util: snapshot.transportUtilization,
      delay: snapshot.delayMinutes,
      risk: snapshot.riskScore,
      bottlenecks: snapshot.bottlenecks,
      stagingPallets: snapshot.stagingPallets
    };
  };

  const currentCalc = useMemo(() => calc(0, 0, f, amr, extra), [f, amr, extra]);

  const scenariosWithRes = useMemo(() => {
    return SC.map((scenario, order) => {
      const res = calc(scenario.addAmr, scenario.extraTrips, f, amr, extra);
      const criticalMaterials = res.items.filter(item => item.lvl === 2).length;
      const warningMaterials = res.items.filter(item => item.lvl === 1).length;
      return {
        ...scenario,
        res,
        order,
        criticalMaterials,
        warningMaterials,
        score: res.risk * 8 + scenario.cost
      };
    });
  }, [f, amr, extra]);

  // Lowest score wins; ties prefer lower cost and then the configured scenario order.
  const rec = useMemo(() => [...scenariosWithRes]
    .sort((a, b) => a.score - b.score || a.cost - b.cost || a.order - b.order)[0]?.id ?? SC[0].id,
  [scenariosWithRes]);

  const selectedSel = userSelected ? sel : rec;

  // Preview is a presentation state; the committed inputs and history stay separate.
  const previewScenario = scenariosWithRes.find(scenario => scenario.id === previewScenarioId);
  const viewportState = useMemo(() => ({
    snapshot: previewScenario?.res ?? currentCalc,
    amrCount: amr + (previewScenario?.addAmr ?? 0),
    extraTrips: extra + (previewScenario?.extraTrips ?? 0)
  }), [previewScenario, currentCalc, amr, extra]);
  const viewportStateRef = useRef(viewportState);
  useEffect(() => {
    viewportStateRef.current = viewportState;
    // A previous congested state must not leave vehicles waiting in the new preview.
    amrsRef.current.forEach(vehicle => { vehicle.wait = 0; });
  }, [viewportState]);

  const alreadyExecutedForCurrentState = executionLocked;

  useEffect(() => {
    try {
      localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(runHistory.slice(0, RUN_HISTORY_LIMIT)));
    } catch {
      // The current session still works when browser storage is unavailable or full.
    }
  }, [runHistory]);

  // These geometries/materials belong only to the generated vehicle groups.
  const clearAmrs = () => {
    amrsRef.current.forEach(vehicle => {
      vehicle.m.removeFromParent();
      vehicle.m.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
    });
    amrsRef.current = [];
  };

  // Restore the original visible transport fleet, including preview additions.
  const buildAmr = (currentAmrCount: number) => {
    if (!sceneRef.current) return;
    clearAmrs();

    const mat = (c: number, e?: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.15, emissive: e || 0 });

    for (let i = 0; i < currentAmrCount + RS.forklift; i++) {
      const fk = i >= currentAmrCount;
      const g = new THREE.Group();
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(fk ? 1.5 : 1, 0.4, fk ? 0.9 : 0.7),
        mat(fk ? 0xfacc15 : 0x3b82f6, fk ? 0x4d3b00 : 0x0c3b8e)
      );
      const l = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.5, 0.5),
        mat(0xf97316)
      );
      l.position.y = 0.45;
      g.add(b, l);
      sceneRef.current.add(g);

      const binZ = binsRef.current[i % 4]?.userData.z ?? 0;
      const z = fk ? [0.9, 2, 3.1][(i - currentAmrCount) % 3] : binZ + (i >> 2) * 0.55;

      const x = -5.1 + (i % 7) * 1.15;
      g.position.set(x, 0.35, z);
      g.userData.vehicleType = fk ? 'FORKLIFT' : 'AMR';
      amrsRef.current.push({
        m: g,
        l,
        fk,
        z,
        x,
        dir: 1,
        wait: 0
      });
    }
  };


  // Rebuild only when the visible AMR count changes, preserving the camera.
  useEffect(() => {
    buildAmr(viewportState.amrCount);
  }, [viewportState.amrCount]);

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
      cam.position.set(
        dist * Math.sin(ph) * Math.sin(th),
        dist * Math.cos(ph),
        dist * Math.sin(ph) * Math.cos(th)
      );
      cam.lookAt(0, 0, 0);
    };
    setCam();
    resetCameraRef.current = () => {
      thRef.current = 0.7;
      phRef.current = 0.95;
      distRef.current = 48;
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
        emissive: e || 0
      });

    const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z);
      S.add(m);
      return m;
    };

    box(48, 0.2, 28, 0x18243b, 0, -0.1, 0);
    const grid = new THREE.GridHelper(48, 48, 0x3b82f6, 0x1e293b);
    grid.position.y = 0.02;
    S.add(grid);

    const pads = {
      wh: box(9, 0.05, 22, 0x224a75, -16.5, 0.03, 0),
      pk: box(5, 0.05, 12, 0x2d4878, -9.5, 0.03, 0),
      st: box(5, 0.05, 10, 0x735716, -4, 0.03, 0),
      tr: box(5, 0.05, 22, 0x243552, 1, 0.03, 0),
      la: box(14, 0.05, 6, 0x48305c, 12, 0.03, -6),
      lb: box(14, 0.05, 6, 0x1f5947, 12, 0.03, 6)
    };
    padsRef.current = pads;

    // 1 warehouse racks
    const RX = [-19.5, -17, -14.5];
    const cart = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat(0xf97316), RX.length * 15 * 3);
    const dObj = new THREE.Object3D();
    let k = 0;
    RX.forEach(x => {
      for (let l = 0; l < 3; l++) {
        box(1.3, 0.08, 18, 0x38bdf8, x, 0.35 + l * 1.1, 0);
        for (let i = 0; i < 15; i++) {
          dObj.position.set(x, 0.8 + l * 1.1, -8.4 + i * 1.2);
          dObj.updateMatrix();
          cart.setMatrixAt(k++, dObj.matrix);
        }
      }
      [-9, 9].forEach(z => box(0.1, 3.6, 0.1, 0x38bdf8, x, 1.8, z));
    });
    S.add(cart);

    // 2 picking / kitting tables
    [-4, 4].forEach(z => {
      box(3.2, 0.8, 1.3, 0x64748b, -9.5, 0.4, z);
      for (let i = 0; i < 4; i++) box(0.55, 0.4, 0.55, 0x38bdf8, -10.5 + i * 0.7, 1, z);
    });

    // Show the calculated staging occupancy while keeping the configured capacity fixed.
    stagingPalletsRef.current = Array.from({ length: RS.staging.pallets }, (_, i) => {
      const pallet = box(0.72, 0.55, 0.72, 0xd97706, -5.55 + (i % 5) * 0.86, 0.31, -4.2 + Math.floor(i / 5) * 0.9);
      pallet.visible = i < viewportState.snapshot.stagingPallets;
      return pallet;
    });

    // 4 transport lane markings
    box(5, 0.02, 0.12, 0xfacc15, 1, 0.05, 0);
    [-1.5, 3.5].forEach(x => box(0.1, 0.02, 20, 0xfacc15, x, 0.05, 0));

    // 5 lines + line-side bins
    const LZ: Record<string, number> = { A: -6, B: 6 };
    const prods: THREE.Mesh[] = [];
    const modelColors: Record<string, number> = { 'ECU-A': 0x38bdf8, 'Alternator-B': 0xf97316, 'Sensor-C': 0x22c55e };
    const sequence: string[] = P.sequence;
    ['A', 'B'].forEach((L: string) => {
      box(14, 0.5, 1.6, 0x475569, 12, 0.3, LZ[L]);
      for (let i = 0; i < 6; i++) {
        const model = sequence[(i + (L === 'B' ? 1 : 0)) % sequence.length];
        const p = box(0.8, 0.5, 0.8, modelColors[model] ?? 0x38bdf8, 5 + i * 2.2, 0.8, LZ[L]);
        p.userData = { L, x: 5 + i * 2.2 };
        prods.push(p);
      }
    });
    prodsRef.current = prods;

    const bins = M.map((m, i) => {
      const z = LZ[m.line] + (i % 2 ? 1.9 : -1.9);
      const b = box(1.5, 1, 1.5, 0x22c55e, 4, 0.6, z);
      b.userData.z = z;
      return b;
    });
    binsRef.current = bins;

    // flow movers
    const mv: Array<{ m: THREE.Mesh; x0: number; x1: number; dir: number; x: number }> = [];
    const addMovers = (n: number, x0: number, x1: number, z: number, dir: number, c: number, w: number, h: number, dd: number, y: number) => {
      for (let i = 0; i < n; i++) {
        const m = box(w, h, dd, c, 0, y, z);
        mv.push({ m, x0, x1, dir, x: x0 + ((x1 - x0) * i) / n });
      }
    };
    addMovers(6, -13.5, -5.5, 0, 1, 0xf97316, 0.8, 0.5, 0.8, 0.4);
    [-11.5, 11.5].forEach(z => {
      box(38, 0.02, 0.2, 0x94a3b8, -0.5, 0.05, z);
      addMovers(7, 18, -19.5, z, -1, 0x94a3b8, 1, 0.15, 0.8, 0.12);
    });
    moversRef.current = mv;

    const arr = (x: number, z: number, c: number) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), mat(c, c));
      m.rotation.z = -Math.PI / 2;
      m.position.set(x, 0.5, z);
      S.add(m);
    };
    [-11.6, -7, -1.8, 5.2].forEach(x => arr(x, 1.8, 0x00f0ff));
    [-19.5, -9, 0, 9, 18].forEach(x => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 3), mat(0x94a3b8, 0x222222));
      m.rotation.z = Math.PI / 2;
      m.position.set(x, 0.4, 11.5);
      S.add(m);
    });

    // Build initial AMRs
    buildAmr(viewportState.amrCount);

    const resize = () => {
      if (!stageRef.current || !rendererRef.current || !camRef.current) return;
      const s = stageRef.current;
      if (!s.clientWidth || !s.clientHeight) return;
      rendererRef.current.setSize(s.clientWidth, s.clientHeight, false);
      camRef.current.aspect = s.clientWidth / s.clientHeight;
      camRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', resize);
    const viewportObserver = new ResizeObserver(resize);
    if (stageRef.current) viewportObserver.observe(stageRef.current);
    resize();

    // Orbit pointers
    let drag = false;
    let lx = 0;
    let ly = 0;

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
      if (!drag) return;
      thRef.current -= (e.clientX - lx) * 0.006;
      phRef.current = Math.max(0.2, Math.min(1.45, phRef.current - (e.clientY - ly) * 0.005));
      lx = e.clientX;
      ly = e.clientY;
      setCam();
    };
    cv.onwheel = (e: WheelEvent) => {
      e.preventDefault();
      distRef.current = Math.max(15, Math.min(70, distRef.current + e.deltaY * 0.03));
      setCam();
    };

    // Label 3D projection targets
    const fixedLabels = [
      { id: 'l1', v: new THREE.Vector3(-16.5, 4.2, -11.5) },
      { id: 'l2', v: new THREE.Vector3(-9.5, 2, -6.5) },
      { id: 'l3', v: new THREE.Vector3(-4, 2, -4.8) },
      { id: 'l4', v: new THREE.Vector3(1, 2, -11.5) },
      { id: 'l5', v: new THREE.Vector3(12, 2, -8) },
      { id: 'l6', v: new THREE.Vector3(12, 2, 8) },
      { id: 'l7', v: new THREE.Vector3(-1, 1, 12.3) }
    ];

    const proj = () => {
      if (!cv || !camRef.current) return;
      const w = cv.clientWidth;
      const h = cv.clientHeight;

      fixedLabels.forEach(fl => {
        const el = labelElementsRef.current[fl.id];
        if (el) {
          const v = fl.v.clone().project(camRef.current!);
          el.style.display = v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15 ? 'none' : '';
          el.style.left = `${((v.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      });

      binsRef.current.forEach((b, idx) => {
        const el = labelElementsRef.current[`bin_${idx}`];
        if (el) {
          const v = new THREE.Vector3(4, 2, b.userData.z).project(camRef.current!);
          el.style.display = v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.15 || Math.abs(v.y) > 1.15 ? 'none' : '';
          el.style.left = `${((v.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      });
    };

    // Animation Loop
    const clock = new THREE.Clock();
    let animId: number;

    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.05);

      // Simulation animation tick
      const c = viewportStateRef.current.snapshot;
      const sp = 2.4 * Math.min(1, 1 / c.util);

      amrsRef.current.forEach(a => {
        const v = a.fk ? sp * 0.65 : sp;
        if (a.wait > 0) {
          a.wait -= dt;
        } else {
          a.x += a.dir * v * dt;
          if (a.x > 3.2) {
            a.dir = -1;
            a.l.visible = false;
          }
          if (a.x < -5.5) {
            a.dir = 1;
            a.l.visible = true;
            a.wait = c.util > 1 ? (c.util - 1) * 12 : 0.3;
          }
        }
        a.m.position.set(a.x, 0.35, a.z);
        a.m.rotation.y = a.dir > 0 ? 0 : Math.PI;
      });

      moversRef.current.forEach(o => {
        o.x += o.dir * 1.5 * fRef.current * dt;
        if ((o.x - o.x1) * o.dir > 0) o.x = o.x0;
        o.m.position.x = o.x;
      });

      prodsRef.current.forEach(p => {
        p.userData.x += dt * 1.2 * fRef.current;
        if (p.userData.x > 18.5) p.userData.x = 5;
        p.position.x = p.userData.x;
      });

      R.render(S, cam);
      proj();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      viewportObserver.disconnect();
      cancelAnimationFrame(animId);
      clearAmrs();
      resetCameraRef.current = null;
      cv.onpointerdown = null;
      cv.onpointerup = null;
      cv.onpointermove = null;
      cv.onwheel = null;
      S.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            if ('map' in material && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      S.clear();
      sceneRef.current = null;
      R.dispose();
    };
  }, []);

  // Sync state values with refs for animation loop
  const fRef = useRef(f);

  useEffect(() => {
    fRef.current = f;
  }, [f]);


  // Update pad and bin emissive/color highlights on calculation updates
  useEffect(() => {
    if (!padsRef.current) return;
    const c = viewportState.snapshot;
    const st = c.bottlenecks.map((stage, index) => [
      ['① ', '② ', '③ ', '④ ', '⑤ '][index] + stage.name,
      stage.utilization,
      ['wh', 'pk', 'st', 'tr', 'la'][index],
      stage.level === 'CRITICAL' ? 2 : stage.level === 'WARNING' ? 1 : 0
    ] as const);

    st.forEach(x => {
      const L = x[3];
      const targetPads = x[2] === 'la' ? [padsRef.current?.la, padsRef.current?.lb] : [padsRef.current?.[x[2]]];
      targetPads.forEach(p => {
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
    stagingPalletsRef.current.forEach((pallet, index) => {
      pallet.visible = index < c.stagingPallets;
    });
  }, [viewportState.snapshot]);

  // Handle actions
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreviewScenarioId(null);
    const val = Number(e.target.value) / 100;
    setF(val);
    setUserSelected(false);
    executionLockRef.current = false;
    setExecutionLocked(false);
  };

  const handleSelectScenario = (id: string) => {
    setPreviewScenarioId(null);
    setSel(id);
    setUserSelected(true);
  };

  const handlePreviewScenario = (id: string) => {
    if (!scenariosWithRes.some(scenario => scenario.id === id)) return;
    setSel(id);
    setUserSelected(true);
    setPreviewScenarioId(id);
    stageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const handleApprove = () => {
    if (executionLockRef.current) return;
    const s = scenariosWithRes.find(x => x.id === selectedSel);
    if (!s) return;
    setPreviewScenarioId(null);
    const before = currentCalc;
    const after = calc(0, 0, f, amr + s.addAmr, extra + s.extraTrips);
    const toRunMetrics = (result: typeof currentCalc): RunMetrics => ({
      utilization: result.util,
      capacity: result.cap,
      trips: result.trips,
      delay: result.delay,
      risk: result.risk,
      criticalMaterials: result.items.filter(item => item.lvl === 2).length,
      warningMaterials: result.items.filter(item => item.lvl === 1).length
    });
    const record: RunRecord = {
      id: `${Date.now()}-${s.id}`,
      timestamp: new Date().toISOString(),
      scenarioId: s.id,
      name: s.name,
      productionPercent: Math.round(f * 100),
      before: toRunMetrics(before),
      simulatedAfter: toRunMetrics(after),
      actualUtilization: null
    };

    executionLockRef.current = true;
    setExecutionLocked(true);
    setAmr(amr + s.addAmr);
    setExtra(extra + s.extraTrips);
    setDone(record);
    setRunHistory(previous => [record, ...previous].slice(0, RUN_HISTORY_LIMIT));
    setActualUtilInput('');
    setUserSelected(true);
  };

  const handleRecordActual = () => {
    if (!done || actualUtilInput === '') return;
    const actualUtilization = Number(actualUtilInput) / 100;
    if (!Number.isFinite(actualUtilization) || actualUtilization < 0 || actualUtilization > 2) return;
    const updated = { ...done, actualUtilization };
    setDone(updated);
    setRunHistory(previous => previous.map(run => run.id === done.id ? updated : run));
  };

  const handleStartNewEvaluation = () => {
    setPreviewScenarioId(null);
    executionLockRef.current = false;
    setExecutionLocked(false);
    setUserSelected(false);
    setActualUtilInput('');
  };

  const handleReset = () => {
    setPreviewScenarioId(null);
    setAmr(RS.amr.available);
    setExtra(0);
    executionLockRef.current = false;
    setExecutionLocked(false);
    setDone(null);
    setUserSelected(false);
    setActualUtilInput('');
  };

  // Helper calculation variables for UI rendering
  const c = currentCalc;
  const viewportCalc = viewportState.snapshot;
  const transportLevel = viewportCalc.bottlenecks.find(stage => stage.id === 'transport')?.level ?? 'NORMAL';
  const viewportLoadLevel = transportLevel === 'CRITICAL' ? 2 : transportLevel === 'WARNING' ? 1 : 0;
  const pct = Math.round(f * 100);
  const occ = c.stagingPallets;
  const lv = (u: number) => (u > 1 ? 2 : u > 0.9 ? 1 : 0);

  const st = c.bottlenecks.map((stage, index) => [
    ['① ', '② ', '③ ', '④ ', '⑤ '][index] + stage.name,
    stage.utilization,
    ['wh', 'pk', 'st', 'tr', 'la'][index]
  ] as const);

  const mx = Math.max(...st.map(x => x[1]));
  const bottleneckItem = st.find(x => x[1] === mx);
  const bottleneckLevel = lv(bottleneckItem?.[1] ?? 0);
  const bottleneckStatus = (bottleneckItem?.[1] ?? 0) > 1
    ? 'Vượt công suất'
    : (bottleneckItem?.[1] ?? 0) > 0.9 ? 'Gần hết công suất' : 'Còn trong công suất';
  const criticalMaterialCount = c.items.filter(item => item.lvl === 2).length;
  const warningMaterialCount = c.items.filter(item => item.lvl === 1).length;
  const attentionItems = c.items.filter(item => item.lvl > 0);
  const lineSideLevel = criticalMaterialCount > 0 ? 2 : warningMaterialCount > 0 ? 1 : 0;

  const recScenario = SC.find(s => s.id === rec);
  const selectedEvaluation = scenariosWithRes.find(s => s.id === selectedSel);
  const priorityMaterial = [...c.items].sort((a, b) => b.lvl - a.lvl || a.eff - b.eff)[0];

  const toggleLeftSection = (section: string) => {
    setExpandedLeftSection(current => current === section ? null : section);
  };

  return (
    <>
      <header className="app-header">
        <div className="dashboard-brand"><b>DENSO</b><div><h1>Logistics Digital Twin</h1><small>Giám sát logistics & hỗ trợ quyết định</small></div></div>

        <nav className="header-nav" aria-label="Điều hướng dashboard">
          {[['Overview', '#stage'], ['Simulation', '#comparison-panel'], ['Analysis', '#trend-panel'], ['Resources', '#resource-summary']].map(([label, target]) => <a key={target} href={target} className={!isHistoryOpen && activeHeaderSection === target ? 'active' : ''} aria-current={!isHistoryOpen && activeHeaderSection === target ? 'location' : undefined} onClick={() => setActiveHeaderSection(target)}>{label}</a>)}
          <button type="button" className={isHistoryOpen ? 'active' : ''} aria-haspopup="dialog" aria-expanded={isHistoryOpen} aria-controls="run-history" onClick={() => { if (historyDialogRef.current && !historyDialogRef.current.open) { historyDialogRef.current.showModal(); setIsHistoryOpen(true); } }}>History</button>
        </nav>

        <div className="header-controls">
        <div className="header-context">
          <span className="simulation-badge"><i /> Mô phỏng đang chạy</span>
          <span>{P.shift}</span>
        </div>

        <div className="sl">
          <label htmlFor="f">Kế hoạch</label>
          <input
            id="f"
            type="range"
            min="100"
            max="120"
            step="5"
            value={pct}
            onChange={handleSliderChange}
          />
          <div className="big" id="fv" style={{ color: pct > 100 ? '#f59e0b' : '' }}>
            {pct}%
          </div>
        </div>
        </div>
      </header>

      <main className="app-main">
        <aside className="side-panel side-panel-left">
          <FactoryOverview production={c.units} percent={pct} utilization={c.util} delay={c.delay} amr={amr} attentionCount={attentionItems.length} forklift={RS.forklift} operators={RS.operators} occupied={occ} stagingCapacity={RS.staging.pallets} materials={c.items} />
          <details className="left-secondary"><summary>Chi tiết kế hoạch & công đoạn</summary>
          <section className={`card bottleneck-summary ${TXT[bottleneckLevel]}`} aria-label="Công đoạn tải cao nhất">
            <div className="compact-card-label">Tải cao nhất</div>
            <strong>{bottleneckItem ? bottleneckItem[0] : 'Chưa có dữ liệu'}</strong>
            <div className="bottleneck-summary-bottom">
              <span>{(bottleneckItem?.[1] ?? 0) > 1 ? 'Vượt công suất' : (bottleneckItem?.[1] ?? 0) > 0.9 ? 'Gần hết công suất' : 'Trong mức bình thường'}</span>
              <b>{((bottleneckItem?.[1] ?? 0) * 100).toFixed(0)}%</b>
            </div>
          </section>

          <section className="card panel-disclosure">
            <button className="disclosure-toggle" aria-expanded={expandedLeftSection === 'plan'} onClick={() => toggleLeftSection('plan')}>
              <span>Kế hoạch</span><small>{P.shift} · {P.mix.length} mẫu</small><i>{expandedLeftSection === 'plan' ? '−' : '+'}</i>
            </button>
            {expandedLeftSection === 'plan' && <div className="disclosure-content" id="plan">
              <div className="row"><span>Sản lượng</span><b>{c.units.toFixed(0)} sản phẩm/giờ</b></div>
              <div className="mix-list">
                {P.mix.map((m, i) => (
                  <div className="mix-item" key={i}>
                    <div><span>{m.model}</span><b>{m.pct}%</b></div>
                    <div className="mix-track"><i style={{ width: `${m.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>}
          </section>

          <section className="card panel-disclosure">
            <button className="disclosure-toggle" aria-expanded={expandedLeftSection === 'flow'} onClick={() => toggleLeftSection('flow')}>
              <span>5 công đoạn</span><small>{bottleneckStatus}</small><i>{expandedLeftSection === 'flow' ? '−' : '+'}</i>
            </button>
            {expandedLeftSection === 'flow' && <div className="disclosure-content flow-detail" id="flow">
              {st.map((x, i) => (
                <div className="flow-stage" key={i}>
                  <div className="flow-stage-heading">
                    <span>{x[0]}{x[1] === mx ? ' · Cao nhất' : ''}</span>
                    <b className={TXT[lv(x[1])]}>{(x[1] * 100).toFixed(0)}%</b>
                  </div>
                  <div className="flow-track"><i style={{ width: `${Math.min(100, x[1] * 100)}%`, background: COL[lv(x[1])] }} /></div>
                </div>
              ))}
              <div className="row"><span>Đường đi</span><b>{operationsData.route?.replace('Staging', 'Khu tập kết').replace('Line-Side', 'Dây chuyền') || '—'}</b></div>
              <div className="row"><span>Thời gian giao trễ</span><b>{c.delay.toFixed(0)} phút</b></div>
            </div>}
          </section>

          </details>
        </aside>

        <div className="center-panel">
        <section id="stage" ref={stageRef}>
          <canvas id="c" ref={canvasRef}></canvas>
          <div className="viewport-toolbar"><span className="viewport-title"><UiIcon kind="box" /> 3D Digital Twin</span><span className="viewport-location">Nhà máy DENSO · Line A & B</span><button onClick={() => resetCameraRef.current?.()} title="Khôi phục góc nhìn ban đầu">Đặt lại góc nhìn</button></div>
          <div className="hint">Kéo chuột: xoay · Cuộn: zoom</div>
          {previewScenario && <div className="viewport-preview-status" role="status"><div><b>Đang xem thử: {previewScenario.name}</b><small>{viewportState.amrCount} AMR · {RS.forklift} xe nâng · chưa áp dụng</small></div><button onClick={() => setPreviewScenarioId(null)}>Về hiện trạng</button></div>}

          {/* 3D Label Overlays */}
          <div className="lb z" ref={el => { labelElementsRef.current['l1'] = el; }}>① KHO LINH KIỆN</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l2'] = el; }}>② PICKING / KITTING</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l3'] = el; }}>③ STAGING</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l4'] = el; }}>④ TRANSPORT · AMR/Forklift{viewportState.extraTrips > 0 && <span className="viewport-label-extra">Bổ sung {viewportState.extraTrips} chuyến/giờ</span>}</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l5'] = el; }}>⑤ LINE A</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l6'] = el; }}>⑤ LINE B</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l7'] = el; }}>↺ EMPTY RETURN → KHO</div>

          {viewportCalc.items.map((i, n) => (
            <div
              key={n}
              className="lb"
              style={{ borderColor: COL[i.lvl] }}
              ref={el => { labelElementsRef.current[`bin_${n}`] = el; }}
            >
              {i.name}: {i.eff.toFixed(0)}p
            </div>
          ))}

          <div className="scene-summary" aria-label="Tóm tắt quyết định">
            <div><small>Kế hoạch</small><b>{viewportCalc.units.toFixed(0)} sp/giờ · {pct}%</b></div>
            <div><small>Nhu cầu</small><b>{viewportCalc.trips.toFixed(1)} chuyến/giờ</b></div>
            <div><small>Năng lực</small><b>{viewportCalc.cap.toFixed(0)} chuyến/giờ</b></div>
            <div><small>Tải robot · trễ</small><b className={TXT[viewportLoadLevel]}>{(viewportCalc.util * 100).toFixed(0)}% · {viewportCalc.delay.toFixed(0)} phút</b></div>
          </div>
        </section>


      <section ref={comparisonRef} id="comparison-panel" tabIndex={-1} className="comparison-panel" aria-labelledby="comparison-title">
        <div className="comparison-header"><div><h2 id="comparison-title"><UiIcon kind="chart" /> So sánh kịch bản (What-if Analysis)</h2><p>Kế hoạch {pct}% · chọn phương án để xem dự báo ở panel phải</p></div><span className="comparison-context">Trạng thái mô phỏng hiện tại</span></div>
        <div className="scenario-table-scroll"><table className="scenario-table"><thead><tr><th scope="col">Kịch bản</th><th scope="col">Năng lực<small>chuyến/giờ</small></th><th scope="col">Tải AMR<small>%</small></th><th scope="col">Sản lượng<small>sp/giờ</small></th><th scope="col">Giao trễ<small>phút</small></th><th scope="col">Chi phí<small>điểm</small></th><th scope="col">Đánh giá<small>điểm thấp hơn tốt hơn</small></th></tr></thead><tbody>{scenariosWithRes.map(item => <tr key={item.id} className={item.id === selectedSel ? 'selected' : ''}><th scope="row"><button onClick={() => handleSelectScenario(item.id)} aria-pressed={item.id === selectedSel}><UiIcon kind={item.addAmr ? 'robot' : item.extraTrips ? 'box' : 'clock'} /><span>{item.name}{item.id === rec && <small className="g">Khuyến nghị</small>}</span></button></th><td>{item.res.cap.toFixed(0)}</td><td className={TXT[lv(item.res.util)]}>{(item.res.util * 100).toFixed(0)}%</td><td>{item.res.units.toFixed(0)}</td><td className={item.res.delay > 0 ? 'r' : 'g'}>{item.res.delay.toFixed(0)}</td><td>+{item.cost}</td><td><b>{item.score}</b>{item.id === selectedSel && <small className="table-selection">Đang chọn</small>}</td></tr>)}</tbody></table></div>
        <div className="comparison-footer"><span>Đang chọn: <b>{selectedEvaluation?.name}</b></span><span>Điểm thấp hơn được ưu tiên · chi phí quy đổi theo mô hình</span></div>
      </section>
          <div className="analytics-row"><TrendPanel production={c.units} utilization={c.util} delay={c.delay} /><ResourceAllocation utilization={c.util} occupied={occ} stagingCapacity={RS.staging.pallets} amr={amr} forklift={RS.forklift} operators={RS.operators} /></div>
        </div>
        <aside className="side-panel side-panel-right">
          <div className="section-heading"><h2>AI Insights</h2><span className="insight-model">Theo mô hình</span></div>
          <span className={`line-badge ${TXT[lineSideLevel]}`}>{priorityMaterial && attentionItems.length ? `Line ${priorityMaterial.line}` : 'Line A & B'}</span>
          <section id="risk" className={`insight-alert ${attentionItems.length ? 'attention' : 'safe'}`}>
            <h3><UiIcon kind="box" />{attentionItems.length && priorityMaterial ? `Nguy cơ thiếu ${priorityMaterial.name} tại Line ${priorityMaterial.line}` : 'Vật tư tại chuyền ổn định'}</h3>
            <dl className="insight-facts"><div><dt>Thời gian còn đủ dùng</dt><dd>{priorityMaterial?.eff.toFixed(0) ?? '—'} phút</dd></div><div><dt>Vật tư cần chú ý</dt><dd>{attentionItems.length}/{c.items.length}</dd></div></dl>
            <h4>Cơ sở dự báo</h4><ul><li>Tải vận chuyển {(c.util * 100).toFixed(0)}%; giao trễ {c.delay.toFixed(0)} phút.</li><li>Nhu cầu {c.trips.toFixed(1)} / năng lực {c.cap.toFixed(0)} chuyến/giờ.</li>{priorityMaterial && <li>{priorityMaterial.name}: tồn kho {priorityMaterial.stock} pcs, ban đầu đủ {priorityMaterial.cover.toFixed(0)} phút.</li>}</ul>
          </section>
          <section id="rec" className="insight-recommendation">
            <div className="section-heading"><h2>Đề xuất phương án</h2><span className="model-badge">Dựa trên mô phỏng</span></div>
            {selectedEvaluation && <div className="recommendation-box">
              <div className="section-heading"><h3>{selectedEvaluation.name}</h3><span className={selectedSel === rec ? 'recommendation-badge' : 'selection-badge'}>{selectedSel === rec ? 'Khuyến nghị' : 'Đang chọn'}</span></div>
              <p className="section-description">{selectedEvaluation.addAmr ? `Bổ sung ${selectedEvaluation.addAmr} AMR vào mô phỏng.` : selectedEvaluation.extraTrips ? `Bổ sung ${selectedEvaluation.extraTrips} chuyến/giờ bằng xe nâng.` : 'Tiếp tục với nguồn lực hiện tại.'}</p>
              <dl className="recommendation-metrics"><div><dt><UiIcon kind="robot" />Năng lực vận chuyển</dt><dd>{c.cap.toFixed(0)} → {selectedEvaluation.res.cap.toFixed(0)} chuyến/h</dd></div><div><dt><UiIcon kind="chart" />Tải vận chuyển</dt><dd>{(c.util * 100).toFixed(0)}% → {(selectedEvaluation.res.util * 100).toFixed(0)}%</dd></div><div><dt><UiIcon kind="clock" />Thời gian giao trễ</dt><dd>{c.delay.toFixed(0)} → {selectedEvaluation.res.delay.toFixed(0)} phút</dd></div><div><dt><UiIcon kind="box" />Vật tư cần chú ý</dt><dd>{attentionItems.length} → {selectedEvaluation.criticalMaterials + selectedEvaluation.warningMaterials}</dd></div><div><dt>Chi phí bổ sung</dt><dd>+{selectedEvaluation.cost} điểm</dd></div></dl>
              <div className="decision-actions"><button id="comparison-button" onClick={() => handlePreviewScenario(selectedEvaluation.id)}>Xem mô phỏng</button><button id="ap" className="s" disabled={alreadyExecutedForCurrentState} onClick={handleApprove}>{alreadyExecutedForCurrentState ? 'Đã áp dụng' : 'Áp dụng'}</button></div>
            </div>}
            {selectedSel !== rec && <p className="helper-text">Mô hình khuyến nghị: <b>{recScenario?.name}</b></p>}
          </section>
          <section className="insight-alternatives"><h3>Các phương án khác</h3>{scenariosWithRes.filter(item => item.id !== selectedSel).map(item => <div className="alternative-row" key={item.id}><span className="alternative-icon"><UiIcon kind={item.addAmr ? 'robot' : item.extraTrips ? 'box' : 'clock'} /></span><div><b>{item.name}</b><p>{item.res.cap.toFixed(0)} chuyến/h · {(item.res.util * 100).toFixed(0)}% tải · {item.res.delay.toFixed(0)} phút trễ</p><small>+{item.cost} điểm{item.id === rec ? ' · Khuyến nghị' : ''}</small></div><button className="s" onClick={() => handlePreviewScenario(item.id)}>Xem</button></div>)}</section>
          <div className="insight-history"><div className="decision-secondary-actions">{done && executionLocked && <button className="s" onClick={handleStartNewEvaluation}>Đánh giá vòng mới</button>}<button className="s" id="rs" onClick={handleReset}>Reset</button></div>
            {done && <details id="act" className="run-result">
              <summary>Kết quả mô phỏng gần nhất</summary>
              {done && (
                <>
                  <b className="g">Lần mô phỏng gần nhất: {done.name} · kế hoạch {done.productionPercent}%</b>
                  <div style={{ color: 'var(--m)' }}>
                    Trước áp dụng: {(done.before.utilization * 100).toFixed(0)}% tải, {done.before.capacity.toFixed(0)} chuyến/giờ, {done.before.delay.toFixed(0)} phút trễ.<br />
                    Sau mô phỏng: {(done.simulatedAfter.utilization * 100).toFixed(0)}% tải, {done.simulatedAfter.capacity.toFixed(0)} chuyến/giờ, {done.simulatedAfter.delay.toFixed(0)} phút trễ; {done.simulatedAfter.criticalMaterials} vật tư nguy cơ, {done.simulatedAfter.warningMaterials} cảnh báo.<br />
                    Đây là kết quả mô phỏng, chưa phải số đo thực tế.
                  </div>
                  <div className="actual-feedback">
                    <label htmlFor="actual-util">Tải AMR thực tế sau áp dụng (%)</label>
                    <input
                      id="actual-util"
                      type="number"
                      min="0"
                      max="200"
                      step="1"
                      value={actualUtilInput}
                      placeholder={done.actualUtilization === null ? 'Chưa có số đo' : (done.actualUtilization * 100).toFixed(0)}
                      onChange={event => setActualUtilInput(event.target.value)}
                    />
                    <button className="s" onClick={handleRecordActual} disabled={actualUtilInput === ''}>Ghi nhận</button>
                    {done.actualUtilization !== null && <small>
                      Đã ghi nhận { (done.actualUtilization * 100).toFixed(0) }%. Sai lệch so với dự báo mô phỏng: {((done.actualUtilization - done.simulatedAfter.utilization) * 100).toFixed(0)} điểm phần trăm.
                    </small>}
                  </div>
                </>
              )}
            </details>}
          </div>
        </aside>
      </main>

      <dialog ref={historyDialogRef} id="run-history" className="history-dialog" aria-labelledby="history-title" onClose={() => setIsHistoryOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) historyDialogRef.current?.close(); } }}>
        <div className="dashboard-card">
          <div className="section-heading"><div><h2 id="history-title">History</h2><p className="section-description">{runHistory.length} lần mô phỏng đã ghi nhận · mới nhất trước</p></div><button className="s" onClick={() => historyDialogRef.current?.close()} aria-label="Đóng History">Đóng ×</button></div>
          {runHistory.length === 0 ? <p className="history-empty">Chưa có lịch sử chạy. Áp dụng một phương án trong dashboard để ghi nhận kết quả mô phỏng.</p> : <div className="history-table-scroll"><table className="scenario-table history-table"><thead><tr><th scope="col">Thời gian</th><th scope="col">Phương án</th><th scope="col">Kế hoạch</th><th scope="col">Tải trước → sau</th><th scope="col">Giao trễ trước → sau</th><th scope="col">Tải đo thực tế</th></tr></thead><tbody>{runHistory.map(run => <tr key={run.id}><td>{new Date(run.timestamp).toLocaleString('vi-VN')}</td><th scope="row">{run.name}</th><td>{run.productionPercent}%</td><td>{(run.before.utilization * 100).toFixed(0)}% → {(run.simulatedAfter.utilization * 100).toFixed(0)}%</td><td>{run.before.delay.toFixed(0)} → {run.simulatedAfter.delay.toFixed(0)} phút</td><td>{run.actualUtilization !== null ? `${(run.actualUtilization * 100).toFixed(0)}%` : 'Chưa ghi nhận'}</td></tr>)}</tbody></table></div>}
        </div>
      </dialog>

    </>
  );
};

export default App;
