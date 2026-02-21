import { useMemo } from "react";

/**
 * Donut chart SVG — affiche un pourcentage avec un arc coloré.
 * Props: value (0-100), size, strokeWidth, color, label
 */
export default function DonutChart({
  value = 0,
  size = 120,
  strokeWidth = 10,
  color = "var(--accent)",
  trackColor = "var(--border-default)",
  label,
  sub,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="donut-chart-center">
        <span className="donut-chart-value">{value.toFixed(1)}%</span>
        {label && <span className="donut-chart-label">{label}</span>}
        {sub && <span className="donut-chart-sub">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * Multi-segment donut chart — affiche plusieurs segments (ex: statuts).
 * Props: segments = [{ value, color, label }], size, strokeWidth
 */
export function MultiDonut({
  segments = [],
  size = 140,
  strokeWidth = 14,
  trackColor = "var(--border-default)",
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  const arcs = useMemo(() => {
    let currentOffset = 0;
    return segments.map((seg) => {
      const pct = total > 0 ? seg.value / total : 0;
      const length = pct * circumference;
      const gap = segments.length > 1 ? 2 : 0;
      const arc = {
        ...seg,
        dasharray: `${Math.max(length - gap, 0)} ${circumference - Math.max(length - gap, 0)}`,
        dashoffset: -currentOffset,
      };
      currentOffset += length;
      return arc;
    });
  }, [segments, circumference, total]);

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
          />
        ))}
      </svg>
      <div className="donut-chart-center">
        {children}
      </div>
    </div>
  );
}
