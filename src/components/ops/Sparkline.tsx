/* eslint-disable react-refresh/only-export-components */
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  width = 96,
  height = 20,
  className,
  color = "currentColor",
  fill = true,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  fill?: boolean;
}) {
  if (!data.length) {
    return <span className={cn("font-mono text-text-dim text-[10px]", className)}>—</span>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = fill
    ? `${path} L${(pts[pts.length - 1]?.[0] ?? 0).toFixed(1)},${height} L0,${height} Z`
    : "";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
      role="img"
      aria-label="trend"
    >
      {fill && <path d={area} fill={color} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  );
}

/** Unicode block-character sparkline for pure-text contexts (status bar, tables). */
export function blockSpark(values: number[]): string {
  if (!values.length) return "";
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v) => blocks[Math.min(7, Math.max(0, Math.floor(((v - min) / span) * 7)))])
    .join("");
}
