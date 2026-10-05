import React from 'react';
import { AMRRobot } from './AMRRobot';
import { useSimulationStore } from '../store/simulationStore';

const CELL_AMR_WAYPOINTS: Record<string, [number, number, number][]> = {
  'AMR-01': [
    [-16, 0, 8],
    [-16, 0, 0],
    [-10, 0, 0],
    [-10, 0, 8]
  ],
  'AMR-02': [
    [-6, 0, 0],
    [4, 0, 0],
    [4, 0, -4],
    [-6, 0, -4]
  ],
  'AMR-03': [
    [8, 0, 6],
    [16, 0, 6],
    [16, 0, 0],
    [8, 0, 0]
  ],
  'AMR-04': [
    [16, 0, -4],
    [22, 0, -4],
    [22, 0, 0],
    [16, 0, 0]
  ],
  'AMR-05': [
    [24, 0, 2],
    [24, 0, 10],
    [28, 0, 10],
    [28, 0, 2]
  ],
  'AMR-06': [
    [-12, 0, -12], // Starts at Charging Hub
    [-16, 0, 0],   // Supermarket
    [4, 0, 0],     // Highway
    [4, 0, -4],    // Line-side Buffer Delivery!
    [-12, 0, -4]
  ]
};

export const CellRobotFleet: React.FC = () => {
  const amrs = useSimulationStore((state) => state.amrs);
  const selectedObject = useSimulationStore((state) => state.selectedObject);
  const setSelectedObject = useSimulationStore((state) => state.setSelectedObject);

  return (
    <group>
      {amrs.filter((a) => a.isActive).map((robot) => {
        const waypoints = CELL_AMR_WAYPOINTS[robot.id] || [
          [robot.currentPosition[0], robot.currentPosition[1], robot.currentPosition[2]],
          [robot.currentPosition[0] + 4, robot.currentPosition[1], robot.currentPosition[2] + 4]
        ];

        const isSelected = selectedObject.type === 'AMR' && selectedObject.id === robot.id;

        return (
          <AMRRobot
            key={robot.id}
            amr={robot}
            waypoints={waypoints}
            isSelected={isSelected}
            onClick={() =>
              setSelectedObject({
                type: 'AMR',
                id: robot.id,
                title: robot.name,
                data: robot
              })
            }
          />
        );
      })}
    </group>
  );
};
