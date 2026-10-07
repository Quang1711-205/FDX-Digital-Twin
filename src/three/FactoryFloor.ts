import * as THREE from "three";

// Shared scene coordinates keep painted bays, material slots and vehicle stops aligned.
export const STAGING_LAYOUT = {
  amrLaneX: -8.8,
  amrDockX: -6.8,
  agvLaneX: 0.5,
  agvDockX: -1.4,
  dockZ: 3.8,
};
export function stagingSlot(index: number) {
  const slot = Math.floor(index / 2);
  const side = index % 2 === 0 ? -1 : 1;
  return { x: -5.2 + (slot % 3), z: side * (2.3 + Math.floor(slot / 3)) };
}

export function createFactoryFloor(capacity: number) {
  const group = new THREE.Group();
  const slab = (
    w: number,
    d: number,
    x: number,
    z: number,
    color: number,
    y = 0.065,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.014, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0.02,
      }),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const outline = (
    x: number,
    z: number,
    w: number,
    d: number,
    color: number,
  ) => {
    const points = [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
      [x - w / 2, z - d / 2],
    ];
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(
          points.map(([px, pz]) => new THREE.Vector3(px, 0.083, pz)),
        ),
        new THREE.LineBasicMaterial({ color }),
      ),
    );
  };
  const road = (left: number, right: number, top: number, bottom: number) => {
    slab(1.4, bottom - top + 1.4, left, (top + bottom) / 2, 0x243241);
    slab(1.4, bottom - top + 1.4, right, (top + bottom) / 2, 0x243241);
    slab(right - left, 1.4, (left + right) / 2, top, 0x243241);
    slab(right - left, 1.4, (left + right) / 2, bottom, 0x243241);
  };
  const paintText = (text: string, x: number, z: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#e8eff5";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 48);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.55),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.09, z);
    group.add(mesh);
  };
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(48, 0.22, 28),
    new THREE.MeshStandardMaterial({ color: 0x303b46, roughness: 0.95 }),
  );
  ground.position.y = -0.12;
  group.add(ground);
  // A continuous foundation; adjoining zone surfaces cover its full footprint.
  outline(0, 0, 47, 27, 0x70808c);
  road(-22, STAGING_LAYOUT.amrLaneX, -11.5, 11.5);
  for (const side of [-1, 1]) {
    road(
      STAGING_LAYOUT.agvLaneX,
      2.25,
      side < 0 ? -10 : 1.3,
      side < 0 ? -1.3 : 10,
    );
    const z = side * STAGING_LAYOUT.dockZ;
    for (const [x, color] of [
      [STAGING_LAYOUT.amrDockX, 0xa78bfa],
      [STAGING_LAYOUT.agvDockX, 0x60a5fa],
    ]) {
      slab(1.6, 4.8, x, z, 0x283d4b);
      outline(x, z, 1.6, 4.8, color);
      slab(1.4, 0.09, x, z + side * 0.9, 0xf8d66d, 0.088);
      paintText(
        `${x === STAGING_LAYOUT.amrDockX ? "AMR" : "AGV"} ${side < 0 ? "A" : "B"}`,
        x,
        z + side * 1.65,
      );
    }
    // Short entry/exit connections to the off-road stopping bays.
    for (const offset of [-1.8, 1.8]) slab(2, 1.4, -7.8, z + offset, 0x243241);
    for (const offset of [-2.2, 1.8])
      slab(1.9, 1.4, -0.45, z + side * offset, 0x243241);
    outline(-4.2, side * 3.8, 3.2, 4.2, 0xd4b862);
  }
  for (let i = 0; i < capacity; i++) {
    const { x, z } = stagingSlot(i);
    slab(0.88, 0.88, x, z, 0x384851);
    outline(x, z, 0.88, 0.88, 0xe2c66f);
  }
  return group;
}
