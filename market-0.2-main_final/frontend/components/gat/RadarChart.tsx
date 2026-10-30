import React from "react";

export interface RadarAxis {
  label: string;
  /** 0-100 */
  value: number;
}

interface RadarChartProps {
  axes: RadarAxis[];
  className?: string;
  ariaLabel?: string;
}

const SIZE = 300;
const CX = SIZE / 2;
const CY = 140;
const R = 88;

const point = (i: number, n: number, radius: number): [number, number] => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
};

/** Lightweight SVG radar (spider) chart - no charting dependency needed. */
export const RadarChart: React.FC<RadarChartProps> = ({ axes, className = "", ariaLabel }) => {
  const n = axes.length;
  if (n < 3) return null;

  const rings = [0.25, 0.5, 0.75, 1];
  const poly = axes.map((ax, i) => point(i, n, (Math.min(100, Math.max(0, ax.value)) / 100) * R).join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${SIZE} 280`}
      className={`w-full h-auto ${className}`}
      role="img"
      aria-label={ariaLabel || "Radar chart"}
    >
      {rings.map((r) => (
        <polygon
          key={r}
          points={axes.map((_, i) => point(i, n, R * r).join(",")).join(" ")}
          fill="none"
          stroke="#e2e8df"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, n, R);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#e2e8df" strokeWidth={1} />;
      })}

      <polygon points={poly} fill="#2A7C13" fillOpacity={0.22} stroke="#2A7C13" strokeWidth={2} strokeLinejoin="round" />

      {axes.map((ax, i) => {
        const [x, y] = point(i, n, (Math.min(100, Math.max(0, ax.value)) / 100) * R);
        return <circle key={`pt-${i}`} cx={x} cy={y} r={3.5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />;
      })}

      {axes.map((ax, i) => {
        const [x, y] = point(i, n, R + 16);
        const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
        const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
        return (
          <text
            key={`lbl-${i}`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={10.5}
            fontWeight={600}
            fill="#556b50"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
};
