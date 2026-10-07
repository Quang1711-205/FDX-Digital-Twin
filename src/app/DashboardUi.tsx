import {
  Factory,
  Bot,
  Clock,
  Package,
  Sparkles,
  ChartNoAxesColumnIncreasing,
} from "lucide-react";

export function UiIcon({
  kind,
}: {
  kind: "factory" | "robot" | "clock" | "box" | "decision" | "chart";
}) {
  const Icon = {
    factory: Factory,
    robot: Bot,
    clock: Clock,
    box: Package,
    decision: Sparkles,
    chart: ChartNoAxesColumnIncreasing,
  }[kind];
  return <Icon size={19} strokeWidth={1.7} aria-hidden="true" />;
}
