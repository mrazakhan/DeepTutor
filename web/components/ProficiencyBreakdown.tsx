"use client";

import { useMemo } from "react";

const MIN_QUESTIONS_FOR_MASTERY = 5;

export interface ProficiencyDimension {
  label: string;
  correct: number;
  total: number;
  proficiency: number;
  mastered?: boolean;
}

interface Props {
  dimensions: ProficiencyDimension[];
  view?: "bars" | "radar";
  minForMastery?: number;
  compact?: boolean;
}

function colorForProficiency(p: number): string {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 50) return "bg-amber-500";
  return "bg-red-400";
}

function textColorForProficiency(p: number): string {
  if (p >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (p >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

// ── Horizontal Bar Breakdown ──
function BarBreakdown({ dimensions, minForMastery, compact }: {
  dimensions: ProficiencyDimension[];
  minForMastery: number;
  compact?: boolean;
}) {
  return (
    <div className={`space-y-${compact ? "2" : "3"}`}>
      {dimensions.map((d) => {
        const needMore = d.total < minForMastery;
        const remaining = minForMastery - d.total;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className={`${compact ? "text-[10px]" : "text-xs"} font-medium text-slate-600 dark:text-slate-300 truncate`}>
                {d.label}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {d.total > 0 ? (
                  <>
                    <span className={`${compact ? "text-[10px]" : "text-xs"} font-bold ${textColorForProficiency(d.proficiency)}`}>
                      {d.proficiency}%
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({d.correct}/{d.total})
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400">--</span>
                )}
              </div>
            </div>
            <div className={`${compact ? "h-1" : "h-1.5"} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
              {d.total > 0 && (
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colorForProficiency(d.proficiency)}`}
                  style={{ width: `${d.proficiency}%` }}
                />
              )}
            </div>
            {needMore && d.total > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {remaining} more question{remaining !== 1 ? "s" : ""} needed for mastery
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SVG Radar Chart ──
function RadarChart({ dimensions }: { dimensions: ProficiencyDimension[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 70;
  const levels = 4; // 25%, 50%, 75%, 100%

  const points = useMemo(() => {
    const n = dimensions.length;
    if (n < 3) return [];
    return dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (d.proficiency / 100) * radius;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        labelX: cx + (radius + 18) * Math.cos(angle),
        labelY: cy + (radius + 18) * Math.sin(angle),
        label: d.label,
        proficiency: d.proficiency,
      };
    });
  }, [dimensions, cx, cy, radius]);

  const n = dimensions.length;

  if (n < 3) {
    return <BarBreakdown dimensions={dimensions} minForMastery={MIN_QUESTIONS_FOR_MASTERY} />;
  }

  // Grid lines (concentric polygons)
  const gridPolygons = useMemo(() => {
    return Array.from({ length: levels }, (_, lvl) => {
      const r = ((lvl + 1) / levels) * radius;
      const pts = Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(" ");
      return pts;
    });
  }, [n, cx, cy, radius, levels]);

  // Axis lines
  const axes = useMemo(() => {
    return Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      return {
        x2: cx + radius * Math.cos(angle),
        y2: cy + radius * Math.sin(angle),
      };
    });
  }, [n, cx, cy, radius]);

  const dataPolygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="0.5"
          />
        ))}
        {/* Axes */}
        {axes.map((a, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={a.x2}
            y2={a.y2}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            strokeWidth="0.5"
          />
        ))}
        {/* Data polygon */}
        <polygon
          points={dataPolygon}
          fill="rgba(99, 102, 241, 0.15)"
          stroke="rgb(99, 102, 241)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="rgb(99, 102, 241)"
          />
        ))}
        {/* Labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={p.labelX}
            y={p.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-500 dark:fill-slate-400"
            fontSize="9"
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function ProficiencyBreakdown({
  dimensions,
  view = "bars",
  minForMastery = MIN_QUESTIONS_FOR_MASTERY,
  compact = false,
}: Props) {
  if (dimensions.length === 0) {
    return (
      <p className="text-xs text-slate-400 text-center py-2">
        No proficiency data yet. Complete some practice questions to see your breakdown.
      </p>
    );
  }

  if (view === "radar") {
    return <RadarChart dimensions={dimensions} />;
  }

  return <BarBreakdown dimensions={dimensions} minForMastery={minForMastery} compact={compact} />;
}
