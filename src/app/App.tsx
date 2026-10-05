import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';

// Import mock data from src/json/
import P from '../json/production_plan.json';
import materialsData from '../json/materials.json';
import RS from '../json/logistics_resources.json';
import operationsData from '../json/operations.json';
import simulationsData from '../json/simulations.json';
import recommendationsData from '../json/recommendations.json';
import AC from '../json/actual_results.json';

const M = materialsData.items;
const OP = operationsData.threshold;
const SC = simulationsData.scenarios;
const RC = recommendationsData as Record<string, { reason: string; kpi: string }>;

const COL = ['#22c55e', '#f59e0b', '#ef4444'];
const TXT = ['g', 'a', 'r'];

interface DoneState {
  scenarioId: string;
  name: string;
  predictedUtil: number;
}

export const App: React.FC = () => {
  const [f, setF] = useState<number>(1);
  const [amr, setAmr] = useState<number>(RS.amr.available);
  const [extra, setExtra] = useState<number>(0);
  const [sel, setSel] = useState<string>('s1');
  const [done, setDone] = useState<DoneState | null>(null);
  const [userSelected, setUserSelected] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const thRef = useRef<number>(0.7);
  const phRef = useRef<number>(0.95);
  const distRef = useRef<number>(48);

  const padsRef = useRef<Record<string, THREE.Mesh> | null>(null);
  const binsRef = useRef<THREE.Mesh[]>([]);
  const prodsRef = useRef<THREE.Mesh[]>([]);
  const moversRef = useRef<Array<{ m: THREE.Mesh; x0: number; x1: number; dir: number; x: number }>>([]);
  const amrsRef = useRef<Array<{ m: THREE.Group; l: THREE.Mesh; fk: boolean; z: number; x: number; dir: number; wait: number }>>([]);

  const labelElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Calculation function
  const calc = (addA = 0, xt = 0, currentF = f, currentAmr = amr, currentExtra = extra) => {
    const units = P.unitsPerHour * currentF;
    const items = M.map(m => {
      const cons = m.perUnit * units;
      const trips = cons / m.tripQty;
      return { ...m, cons, trips, cover: (m.stock / cons) * 60, eff: 0, lvl: 0 };
    });
    const trips = items.reduce((s, i) => s + i.trips, 0);
    const cap = (currentAmr + addA) * RS.amr.tripsPerHour + currentExtra + xt;
    const util = trips / cap;
    const delay = Math.max(0, util - OP.knee) * OP.delayK;
    items.forEach(i => {
      i.eff = i.cover - delay;
      i.lvl = i.eff < OP.red ? 2 : i.eff < OP.amber ? 1 : 0;
    });
    const risk = items.reduce((s, i) => s + (i.lvl === 2 ? 2 : i.lvl), 0);
    return { units, items, trips, cap, util, delay, risk };
  };

  const currentCalc = useMemo(() => calc(0, 0, f, amr, extra), [f, amr, extra]);

  // Determine best scenario
  const rec = useMemo(() => {
    let b = SC[0].id;
    let bs = 1e9;
    SC.forEach(s => {
      const c = calc(s.addAmr, s.extraTrips, f, amr, extra);
      const sc = c.risk * 8 + s.cost;
      if (sc < bs) {
        bs = sc;
        b = s.id;
      }
    });
    return b;
  }, [f, amr, extra]);

  // Selected scenario handling
  const selectedSel = (!done && !userSelected) ? rec : sel;

  const scenariosWithRes = useMemo(() => {
    return SC.map(s => ({
      ...s,
      res: calc(s.addAmr, s.extraTrips, f, amr, extra)
    }));
  }, [f, amr, extra]);

  // Build AMRs in 3D scene
  const buildAmr = (currentAmrCount: number) => {
    if (!sceneRef.current) return;
    amrsRef.current.forEach(a => sceneRef.current?.remove(a.m));
    amrsRef.current = [];

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

      amrsRef.current.push({
        m: g,
        l,
        fk,
        z,
        x: -5.5 + Math.random() * 8,
        dir: 1,
        wait: 0
      });
    }
  };

  // Re-build AMRs when amr count changes
  useEffect(() => {
    buildAmr(amr);
  }, [amr]);

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

    // 3 staging pallets
    for (let i = 0; i < 8; i++) {
      box(1.1, 0.6, 1.1, 0xd97706, -5.2 + (i % 4) * 1.1, 0.4, -3.2 + Math.floor(i / 4) * 1.3);
    }

    // 4 transport lane markings
    box(5, 0.02, 0.12, 0xfacc15, 1, 0.05, 0);
    [-1.5, 3.5].forEach(x => box(0.1, 0.02, 20, 0xfacc15, x, 0.05, 0));

    // 5 lines + line-side bins
    const LZ: Record<string, number> = { A: -6, B: 6 };
    const prods: THREE.Mesh[] = [];
    ['A', 'B'].forEach((L: string) => {
      box(14, 0.5, 1.6, 0x475569, 12, 0.3, LZ[L]);
      for (let i = 0; i < 6; i++) {
        const p = box(0.8, 0.5, 0.8, 0x38bdf8, 5 + i * 2.2, 0.8, LZ[L]);
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
    buildAmr(amr);

    const resize = () => {
      if (!stageRef.current || !rendererRef.current || !camRef.current) return;
      const s = stageRef.current;
      rendererRef.current.setSize(s.clientWidth, s.clientHeight, false);
      camRef.current.aspect = s.clientWidth / s.clientHeight;
      camRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', resize);
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
          el.style.display = v.z > 1 ? 'none' : '';
          el.style.left = `${((v.x + 1) / 2) * w}px`;
          el.style.top = `${((1 - v.y) / 2) * h}px`;
        }
      });

      binsRef.current.forEach((b, idx) => {
        const el = labelElementsRef.current[`bin_${idx}`];
        if (el) {
          const v = new THREE.Vector3(4, 2, b.userData.z).project(camRef.current!);
          el.style.display = v.z > 1 ? 'none' : '';
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
      const c = calc(0, 0, fRef.current, amrRef.current, extraRef.current);
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
      cancelAnimationFrame(animId);
      R.dispose();
    };
  }, []);

  // Sync state values with refs for animation loop
  const fRef = useRef(f);
  const amrRef = useRef(amr);
  const extraRef = useRef(extra);

  useEffect(() => {
    fRef.current = f;
  }, [f]);

  useEffect(() => {
    amrRef.current = amr;
  }, [amr]);

  useEffect(() => {
    extraRef.current = extra;
  }, [extra]);

  // Update pad and bin emissive/color highlights on calculation updates
  useEffect(() => {
    if (!padsRef.current) return;
    const c = currentCalc;
    const occ = Math.min(RS.staging.pallets, Math.round(8 + c.util * 10));
    const lv = (u: number) => (u > 1 ? 2 : u > 0.9 ? 1 : 0);
    const st = [
      ['① Kho (xuất)', c.trips / RS.warehouse.dockCapacity, 'wh'],
      ['② Picking/Kitting', c.trips / RS.picking.capacity, 'pk'],
      ['③ Staging', occ / RS.staging.pallets, 'st'],
      ['④ Transport', c.util, 'tr'],
      ['⑤ Line A/B', c.units / RS.line.capacityUnits, 'la']
    ] as const;

    st.forEach(x => {
      const L = lv(x[1]);
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
  }, [currentCalc]);

  // Handle actions
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) / 100;
    setF(val);
    setUserSelected(false);
  };

  const handleSelectScenario = (id: string) => {
    setSel(id);
    setUserSelected(true);
  };

  const handleApprove = () => {
    const s = scenariosWithRes.find(x => x.id === selectedSel);
    if (!s) return;
    const c = s.res;
    setAmr(prev => prev + s.addAmr);
    setExtra(prev => prev + s.extraTrips);
    setDone({
      scenarioId: s.id,
      name: s.name,
      predictedUtil: c.util
    });
    setUserSelected(true);
  };

  const handleReset = () => {
    setAmr(RS.amr.available);
    setExtra(0);
    setDone(null);
    setUserSelected(false);
  };

  // Helper calculation variables for UI rendering
  const c = currentCalc;
  const pct = Math.round(f * 100);
  const uc = c.util > 1 ? 2 : c.util > 0.85 ? 1 : 0;
  const occ = Math.min(RS.staging.pallets, Math.round(8 + c.util * 10));
  const lv = (u: number) => (u > 1 ? 2 : u > 0.9 ? 1 : 0);

  const st = [
    ['① Kho (xuất)', c.trips / RS.warehouse.dockCapacity, 'wh'],
    ['② Picking/Kitting', c.trips / RS.picking.capacity, 'pk'],
    ['③ Staging', occ / RS.staging.pallets, 'st'],
    ['④ Transport', c.util, 'tr'],
    ['⑤ Line A/B', c.units / RS.line.capacityUnits, 'la']
  ] as const;

  const mx = Math.max(...st.map(x => x[1]));
  const bottleneckItem = st.find(x => x[1] === mx);

  const recScenario = SC.find(s => s.id === rec);
  const recInfo = RC[rec];

  return (
    <>
      <header>
        <h1>
          <b>DENSO</b> <span>Logistics Digital Twin</span>
        </h1>

        <div className="sl">
          <span>Sản lượng kế hoạch</span>
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
      </header>

      <main>
        <aside>
          <div className="card">
            <h3>Kế hoạch sản xuất</h3>
            <div id="plan">
              <div className="row"><span>Sản lượng/giờ</span><b>{c.units.toFixed(0)}</b></div>
              <div className="row"><span>Ca</span><b>{P.shift}</b></div>
              {P.mix.map((m, i) => (
                <div className="row" key={i}><span>{m.model}</span><b>{m.pct}%</b></div>
              ))}
              <div className="row"><span>Tuyến</span><b>{operationsData.route || ''}</b></div>
            </div>
          </div>

          <div className="card">
            <h3>Luồng vật chất (5 khâu)</h3>
            <div id="flow">
              {st.map((x, i) => (
                <div className="row" key={i}>
                  <span>{x[0]}{x[1] === mx && mx > 0.9 ? ' ⚠' : ''}</span>
                  <b className={TXT[lv(x[1])]}>{(x[1] * 100).toFixed(0)}%</b>
                </div>
              ))}
              <div className="bar"></div>
              <div className="row"><span>Nút thắt</span><b>{bottleneckItem ? bottleneckItem[0] : ''}</b></div>
              <div className="row">
                <span>Vòng hoàn</span>
                <b>{f > 1 ? `pallet rỗng ↑ ${Math.round((f - 1) * 100)}%` : 'bình thường'}</b>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Tải logistics</h3>
            <div id="kpi">
              <div className="row"><span>Chuyến/giờ cần</span><b>{c.trips.toFixed(1)}</b></div>
              <div className="row"><span>Năng lực</span><b>{c.cap.toFixed(0)}</b></div>
              <div className="row">
                <span>Áp lực AMR</span>
                <b className={TXT[uc]}>{(c.util * 100).toFixed(0)}%</b>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.min(100, c.util * 100)}%`, background: COL[uc] }}></i>
              </div>
              <div className="row"><span>Trễ ước tính</span><b>{c.delay.toFixed(0)} phút</b></div>
            </div>
          </div>

          <div className="card">
            <h3>Tài nguyên</h3>
            <div id="res">
              <div className="row"><span>AMR</span><b>{amr}</b></div>
              <div className="row"><span>Forklift</span><b>{RS.forklift}</b></div>
              <div className="row"><span>Nhân sự</span><b>{RS.operators}</b></div>
              <div className="row">
                <span>Staging</span>
                <b>{Math.min(24, Math.round(8 + c.util * 10))}/{RS.staging.pallets} pallet</b>
              </div>
            </div>
          </div>
        </aside>

        <section id="stage" ref={stageRef}>
          <canvas id="c" ref={canvasRef}></canvas>
          <div className="hint">Kéo chuột: xoay · Cuộn: zoom</div>

          {/* 3D Label Overlays */}
          <div className="lb z" ref={el => { labelElementsRef.current['l1'] = el; }}>① KHO LINH KIỆN</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l2'] = el; }}>② PICKING / KITTING</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l3'] = el; }}>③ STAGING</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l4'] = el; }}>④ TRANSPORT · AMR/Forklift</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l5'] = el; }}>⑤ LINE A</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l6'] = el; }}>⑤ LINE B</div>
          <div className="lb z" ref={el => { labelElementsRef.current['l7'] = el; }}>↺ EMPTY RETURN → KHO</div>

          {c.items.map((i, n) => (
            <div
              key={n}
              className="lb"
              style={{ borderColor: COL[i.lvl] }}
              ref={el => { labelElementsRef.current[`bin_${n}`] = el; }}
            >
              {i.name}: {i.eff.toFixed(0)}p
            </div>
          ))}

          <div id="chain">
            <div>
              <small>Sản lượng</small>
              <b>{(pct > 100 ? '+' : '') + (pct - 100)}%</b>
            </div>
            <div>
              <small>Nhu cầu vật tư</small>
              <b>{c.units.toFixed(0)} u/h</b>
            </div>
            <div>
              <small>Workload</small>
              <b>{c.trips.toFixed(0)} chuyến/h</b>
            </div>
            <div>
              <small>AMR</small>
              <b style={{ color: COL[uc] }}>{(c.util * 100).toFixed(0)}%</b>
            </div>
            <div>
              <small>Line-Side</small>
              <b style={{ color: COL[c.risk >= 4 ? 2 : c.risk > 0 ? 1 : 0] }}>
                {['An toàn', 'Cảnh báo', 'Nguy cơ'][c.risk >= 4 ? 2 : c.risk > 0 ? 1 : 0]}
              </b>
            </div>
            <div>
              <small>AI đề xuất</small>
              <b>{recScenario ? recScenario.name : ''}</b>
            </div>
          </div>
        </section>

        <aside>
          <div className="card">
            <h3>Rủi ro Line-Side</h3>
            <div id="risk">
              {c.items.map((i, n) => (
                <div className="row" key={n}>
                  <span>
                    <i className="dot" style={{ background: COL[i.lvl] }}></i>
                    {i.name} · Line {i.line}
                  </span>
                  <b className={TXT[i.lvl]}>{i.eff.toFixed(0)}p</b>
                </div>
              ))}
              <div className="row">
                <span>Còn lại trước khi hết hàng (sau trễ)</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>What-if &amp; AI Recommendation</h3>
            <table id="sc">
              <thead>
                <tr>
                  <th>Phương án</th>
                  <th>AMR</th>
                  <th>Risk</th>
                  <th>Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {scenariosWithRes.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => handleSelectScenario(s.id)}
                    className={`${s.id === selectedSel ? 'sel' : ''} ${s.id === rec ? 'rc' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{s.name}</td>
                    <td>{(s.res.util * 100).toFixed(0)}%</td>
                    <td className={TXT[s.res.risk >= 4 ? 2 : s.res.risk > 0 ? 1 : 0]}>{s.res.risk}</td>
                    <td>+{s.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div id="rec" style={{ marginTop: '8px' }}>
              <b>Gợi ý AI: {recScenario ? recScenario.name : ''}</b>
              <div style={{ color: 'var(--m)' }}>
                {recInfo?.reason}<br />
                {recInfo?.kpi}
              </div>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <button id="ap" onClick={handleApprove}>Phê duyệt &amp; Thực thi</button>
              <button className="s" id="rs" onClick={handleReset}>Reset</button>
            </div>

            <div id="act" style={{ marginTop: '8px' }}>
              {done && (
                <>
                  <b className="g">Đã thực thi: {done.name}</b>
                  <div style={{ color: 'var(--m)' }}>
                    Dự báo áp lực {(done.predictedUtil * 100).toFixed(0)}% → Thực tế {((done.predictedUtil + AC.utilDelta) * 100).toFixed(0)}%<br />
                    {AC.note}
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </main>
    </>
  );
};

export default App;
