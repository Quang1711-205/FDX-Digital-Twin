import { useEffect, useRef, useState } from "react";
import { Factory, Bot, Clock, Package, Users, Warehouse } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function SegmentedProgress({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div
      className="segmented-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
      aria-valuetext={`${value.toFixed(0)}%${value > 100 ? ", vượt công suất" : ""}`}
    >
      {Array.from({ length: 10 }, (_, index) => (
        <span key={index}>
          <i
            style={{
              width: `${Math.max(0, Math.min(100, (bounded - index * 10) * 10))}%`,
            }}
          />
        </span>
      ))}
    </div>
  );
}

type Material = {
  id: string;
  name: string;
  stock: number;
  eff: number;
  lvl: number;
  line: string;
};
type OverviewProps = {
  production: number;
  percent: number;
  utilization: number;
  delay: number;
  amr: number;
  amrMoving: number;
  agvByLine: Record<string, number>;
  agvMovingByLine: Record<string, number>;
  agvLoads: Array<{ line: string; utilization: number }>;
  operators: number;
  occupied: number;
  stagingCapacity: number;
  materials: Material[];
  attentionCount: number;
  producedUnits: number;
  lineRunning: Record<string, boolean>;
  deliveredTrips: number;
  warehouseReplenished: number;
};

export function FactoryOverview({
  production,
  percent,
  utilization,
  delay,
  amr,
  amrMoving,
  agvByLine,
  agvMovingByLine,
  agvLoads,
  operators,
  occupied,
  stagingCapacity,
  materials,
  attentionCount,
  producedUnits,
  lineRunning,
  deliveredTrips,
  warehouseReplenished,
}: OverviewProps) {
  const focus = [...materials].sort(
    (a, b) => b.lvl - a.lvl || a.eff - b.eff,
  )[0];
  return (
    <>
      <section className="dashboard-card overview-card">
        <div className="section-heading">
          <h2>Factory Overview</h2>
          <span className="live-badge">
            <i /> Demo
          </span>
        </div>
        <div className="overview-item">
          <span className="overview-icon red">
            <Factory size={21} />
          </span>
          <div>
            <div className="metric-label">Nhịp sản xuất mô phỏng</div>
            <div className="overview-value">
              {production.toFixed(0)}
              <span>sản phẩm/giờ</span>
            </div>
            <div className="progress-with-label">
              <div className="smooth-progress">
                <i style={{ width: `${Math.min(100, percent)}%` }} />
              </div>
              <b>{percent}%</b>
            </div>
            <p className="helper-text">
              Đã mô phỏng {producedUnits.toFixed(1)} sản phẩm · Line A{" "}
              {lineRunning.A ? "đang chạy" : "đang dừng"} · B{" "}
              {lineRunning.B ? "đang chạy" : "đang dừng"}
            </p>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon red">
            <Clock size={21} />
          </span>
          <div>
            <div className="metric-label">Ước tính giao trễ</div>
            <div className="overview-value">
              {delay.toFixed(0)}
              <span>phút</span>
              <small className={delay > 0 ? "a" : "g"}>
                {delay > 0 ? "Cần chú ý" : "Đúng tiến độ"}
              </small>
            </div>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon amber">
            <Bot size={21} />
          </span>
          <div>
            <div className="metric-label">Tải AMR Kho–Staging</div>
            <div className="overview-value">
              {(utilization * 100).toFixed(0)}
              <span>%</span>
              <small
                className={
                  utilization > 1 ? "r" : utilization > 0.9 ? "a" : "g"
                }
              >
                {utilization > 1
                  ? "Quá tải"
                  : utilization > 0.9
                    ? "Gần hết công suất"
                    : "Trong công suất"}
              </small>
            </div>
          </div>
        </div>
        <div className="overview-item">
          <span className="overview-icon red">
            <Package size={21} />
          </span>
          <div>
            <div className="metric-label">Nguy cơ thiếu vật tư</div>
            <div className="overview-value compact">
              {attentionCount && focus ? `Line ${focus.line}` : "Ổn định"}
              <small className={attentionCount ? "r" : "g"}>
                {attentionCount ? `${attentionCount} vật tư` : "An toàn"}
              </small>
            </div>
          </div>
        </div>
      </section>
      <section id="resource-summary" className="dashboard-card">
        <h2>Nguồn lực hiện có</h2>
        {/* <p className="section-description">
          AMR: Kho–Staging · AGV: Staging–Line · Đã giao{" "}
          {deliveredTrips.toFixed(0)} chuyến · Kho bổ sung{" "}
          {warehouseReplenished.toFixed(0)} pcs
        </p> */}
        <div className="resource-item">
          <span className="resource-icon">
            <Bot size={19} />
          </span>
          <div>
            <div className="resource-label">
              <b>AMR</b>
              <span>
                {amrMoving}/{amr} đang chạy
              </span>
            </div>
            <div className="smooth-progress">
              <i style={{ width: `${Math.min(100, utilization * 100)}%` }} />
            </div>
            <small>Tải dự báo {(utilization * 100).toFixed(0)}%</small>
          </div>
        </div>
        <div className="resource-item">
          <span className="resource-icon">
            <Bot size={19} />
          </span>
          <div>
            <div className="resource-label">
              <b>AGV</b>
              <span>
                A: {agvMovingByLine.A}/{agvByLine.A} · B: {agvMovingByLine.B}/
                {agvByLine.B} đang chạy
              </span>
            </div>
            <small>
              Tải dự báo{" "}
              {agvLoads
                .map(
                  (line) =>
                    `${line.line}: ${(line.utilization * 100).toFixed(0)}%`,
                )
                .join(" / ")}
            </small>
          </div>
        </div>
        <div className="resource-item">
          <span className="resource-icon">
            <Users size={19} />
          </span>
          <div className="resource-label">
            <b>Nhân sự</b>
            <span>{operators} người</span>
          </div>
        </div>
        <div className="resource-item">
          <span className="resource-icon">
            <Warehouse size={19} />
          </span>
          <div>
            <div className="resource-label">
              <b>Khu tập kết (3D)</b>
              <span>
                {occupied}/{stagingCapacity} pallet
              </span>
            </div>
            <div className="smooth-progress">
              <i
                style={{
                  width: `${stagingCapacity ? (occupied / stagingCapacity) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="dashboard-card material-card">
        <h2>Tình trạng vật tư chính</h2>
        <p className="section-description">
          Trong ngưỡng an toàn:{" "}
          <b className="g">
            {materials.length - attentionCount}/{materials.length}
          </b>
        </p>
        {materials.map((material) => (
          <div className="material-item" key={material.id}>
            <div>
              <span>{material.name}</span>
              <b>{Math.max(0, Math.floor(material.stock + 1e-9))} pcs</b>
            </div>
            <div className="material-cover">
              <i className={["g", "a", "r"][material.lvl]} />
              <span>
                Line {material.line} · còn đủ {material.eff.toFixed(0)} phút
              </span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

type Point = {
  time: number;
  production: number;
  utilization: number;
  delay: number;
};
export function TrendPanel({
  production,
  utilization,
  delay,
}: {
  production: number;
  utilization: number;
  delay: number;
}) {
  const latest = useRef({ production, utilization: utilization * 100, delay });
  latest.current = { production, utilization: utilization * 100, delay };
  const [points, setPoints] = useState<Point[]>(() => [
    { time: Date.now(), ...latest.current },
  ]);
  const [metric, setMetric] = useState<"production" | "utilization" | "delay">(
    "production",
  );
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setPoints((previous) => [
          ...previous.slice(-119),
          { time: Date.now(), ...latest.current },
        ]),
      2000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const labels = {
    production: "Sản lượng",
    utilization: "Tải AMR/AGV cao nhất",
    delay: "Giao trễ",
  };
  const unit = { production: "sp/giờ", utilization: "%", delay: "phút" }[
    metric
  ];
  return (
    <section id="trend-panel" className="dashboard-card trend-panel">
      <div className="section-heading">
        <h2>Biểu đồ xu hướng</h2>
        <div className="chart-tabs" aria-label="Chỉ số biểu đồ">
          {(["production", "utilization", "delay"] as const).map((key) => (
            <button
              key={key}
              aria-pressed={metric === key}
              className={key === metric ? "active" : ""}
              onClick={() => setMetric(key)}
            >
              {labels[key]}
            </button>
          ))}
        </div>
      </div>
      <p className="section-description">
        Sản lượng lấy từ ledger 3D; tải và giao trễ là dự báo demo · cập nhật 2
        giây · {unit}
      </p>
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="#e8edf5" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(time) =>
                new Date(time).toLocaleTimeString("vi-VN", { hour12: false })
              }
              tick={{ fontSize: 11, fill: "#637591" }}
              minTickGap={50}
            />
            <YAxis
              width={38}
              tick={{ fontSize: 11, fill: "#637591" }}
              domain={[0, "auto"]}
            />
            <Tooltip
              labelFormatter={(value) =>
                new Date(Number(value)).toLocaleTimeString("vi-VN")
              }
              formatter={(value) => [
                `${Number(value).toFixed(1)} ${unit}`,
                labels[metric],
              ]}
            />
            <Line
              type="stepAfter"
              dataKey={metric}
              stroke="#247af0"
              strokeWidth={2}
              dot={points.length === 1}
              isAnimationActive={false}
              name={labels[metric]}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function ResourceAllocation({
  utilization,
  occupied,
  stagingCapacity,
  amr,
  agvByLine,
  agvLoads,
  operators,
}: {
  utilization: number;
  occupied: number;
  stagingCapacity: number;
  amr: number;
  agvByLine: Record<string, number>;
  agvLoads: Array<{ line: string; utilization: number }>;
  operators: number;
}) {
  return (
    <section className="dashboard-card allocation-card">
      <h2>Phân bổ nguồn lực</h2>
      <p className="section-description">Tải và sức chứa hiện tại</p>
      <div className="allocation-row">
        <span>
          <Bot size={17} />
          AMR · {amr} robot
        </span>
        <SegmentedProgress value={utilization * 100} label="Tải vận chuyển" />
        <b>{(utilization * 100).toFixed(0)}%</b>
      </div>
      <div className="allocation-row">
        <span>
          <Warehouse size={17} />
          Khu tập kết
        </span>
        <SegmentedProgress
          value={stagingCapacity ? (occupied / stagingCapacity) * 100 : 0}
          label="Sức chứa khu tập kết"
        />
        <b>
          {occupied}/{stagingCapacity}
        </b>
      </div>
      <div className="allocation-static">
        <span>
          <Bot size={17} /> AGV A/B {agvByLine.A}/{agvByLine.B} ·{" "}
          {agvLoads
            .map((line) => `${(line.utilization * 100).toFixed(0)}%`)
            .join(" / ")}
        </span>
        <span>
          <Users size={17} /> {operators} nhân sự
        </span>
      </div>
    </section>
  );
}
