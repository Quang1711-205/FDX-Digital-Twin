export const CELL_COLORS = {
  bgDark: '#0B0F17',
  floorCharcoal: '#111827',
  floorSecondary: '#1F2937',
  metalDark: '#1E293B',
  metalMedium: '#334155',
  metalLight: '#475569',
  industrialOrange: '#FF7A00',
  hazardYellow: '#F59E0B',
  productionBlue: '#2563EB',
  productionCyan: '#06B6D4',
  logisticsGreen: '#10B981',
  warningYellow: '#F59E0B',
  criticalRed: '#EF4444',
  glowBlue: '#38BDF8',
  floorGrid: '#1E293B'
};

export const CELL_CAMERA_PRESETS = {
  OVERVIEW: { position: [4, 22, 28] as [number, number, number], target: [4, 0, 0] as [number, number, number] },
  MATERIAL: { position: [-16, 10, 14] as [number, number, number], target: [-16, 0, 4] as [number, number, number] },
  'LINE A': { position: [4, 9, 5] as [number, number, number], target: [4, 0, -4] as [number, number, number] },
  MACHINES: { position: [10, 12, 10] as [number, number, number], target: [10, 0, -4] as [number, number, number] },
  'FINISHED GOODS': { position: [24, 10, 14] as [number, number, number], target: [24, 0, 6] as [number, number, number] },
  LOGISTICS: { position: [0, 18, 16] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  RISK: { position: [4, 8, 2] as [number, number, number], target: [4, 0, -2] as [number, number, number] }
};
