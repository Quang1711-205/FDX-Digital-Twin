import React from 'react';
import { AMRRobot } from './AMRRobot';
import { useSimulationStore } from '../store/simulationStore';

const ROUTE_WAYPOINTS: Record<string, [number, number, number][]> = {
  'AMR-01': [
    [-18, 0, 8],
    [-18, 0, 0],
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, -8],
    [0, 0, -8],
    [-18, 0, -8]
  ],
  'AMR-02': [
    [-5, 0, -10],
    [0, 0, -10],
    [12, 0, -10],
    [12, 0, -5],
    [0, 0, -5],
    [-5, 0, -5]
  ],
  'AMR-03': [
    [-22, 0, -8],
    [-22, 0, 0],
    [-15, 0, 0],
    [-15, 0, -8]
  ],
  'AMR-04': [
    [5, 0, 5],
    [18, 0, 5],
    [18, 0, 2],
    [5, 0, 2]
  ],
  'AMR-05': [
    [18, 0, -6],
    [20, 0, 0],
    [20, 0, 10],
    [16, 0, 10]
  ],
  'AMR-06': [
    [0, 0, 12],
    [2, 0, 12],
    [2, 0, 14],
    [0, 0, 14]
  ],
  'AMR-07': [
    [0, 0, 10],
    [0, 0, -10],
    [12, 0, -10],
    [14, 0, -8],
    [5, 0, 0]
  ]
};

export const RobotFleet: React.FC = () => {
  const amrs = useSimulationStore((state) => state.amrs);
  const selectedObject = useSimulationStore((state) => state.selectedObject);
  const setSelectedObject = useSimulationStore((state) => state.setSelectedObject);

  return (
    <group>
      {amrs.map((robot) => {
        const waypoints = ROUTE_WAYPOINTS[robot.id] || [
          [robot.currentPosition[0], robot.currentPosition[1], robot.currentPosition[2]],
          [robot.currentPosition[0] + 5, robot.currentPosition[1], robot.currentPosition[2] + 5]
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
