import { ScenarioMetrics, AIRecommendation } from '../types';

export function calculateScenarioMetrics(
  volumePercent: number,
  amrCount: number,
  isMitigated: boolean
): ScenarioMetrics {
  const mult = volumePercent / 100;
  const productionRate = Math.round(100 * mult);
  const materialDemandPercent = volumePercent;
  const logisticsTasksPerHour = Math.round(20 * mult);

  // AMR utilization calculation
  const amrUtilizationPercent = Math.min(
    98,
    Math.max(40, Math.round((logisticsTasksPerHour / (amrCount * 0.48)) * 100))
  );

  // Line-side buffer level estimation
  let lineSideBufferPercent = 80;
  if (volumePercent === 120) {
    lineSideBufferPercent = isMitigated ? 78 : 30;
  } else if (volumePercent === 140) {
    lineSideBufferPercent = isMitigated ? 70 : 15;
  } else if (volumePercent === 110) {
    lineSideBufferPercent = isMitigated ? 82 : 55;
  } else if (volumePercent === 80) {
    lineSideBufferPercent = 92;
  }

  // Shortage risk calculation
  let shortageRiskPercent = 8;
  if (volumePercent === 120) {
    shortageRiskPercent = isMitigated ? 11 : 31;
  } else if (volumePercent === 140) {
    shortageRiskPercent = isMitigated ? 18 : 65;
  } else if (volumePercent === 110) {
    shortageRiskPercent = isMitigated ? 9 : 18;
  }

  // Downtime minutes calculation
  let downtimeMinutesPerHour = 0;
  if (volumePercent >= 120 && !isMitigated) {
    downtimeMinutesPerHour = volumePercent >= 140 ? 14 : 6;
  } else if (isMitigated) {
    downtimeMinutesPerHour = 1;
  }

  return {
    productionRate,
    materialDemandPercent,
    logisticsTasksPerHour,
    amrUtilizationPercent,
    lineSideBufferPercent,
    shortageRiskPercent,
    downtimeMinutesPerHour
  };
}

export function generatePredictiveRecommendation(
  volumePercent: number,
  amrCount: number
): AIRecommendation | null {
  if (volumePercent >= 120 && amrCount <= 5) {
    return {
      id: "REC-SURGE-120",
      priority: "HIGH",
      title: "Deploy AMR-06 & Elevate MAT-004 Replenishment Priority",
      description: `Production surge of +${volumePercent - 100}% is projected to create a 31% line-side shortage risk on MAT-004 (MOSFET Connectors) at Machine A02.`,
      actions: [
        "Activate standby robot AMR-06 from charging hub",
        "Assign MAT-004 priority pick task from Material Supermarket",
        "Increase Assembly Line A buffer replenishment dispatch rate"
      ],
      expectedImpact: {
        shortageRiskDelta: -20,
        amrUtilizationDelta: -11,
        downtimeMinutesDelta: -5
      }
    };
  }

  return null;
}
