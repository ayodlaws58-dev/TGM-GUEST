"use client";

import { useState } from "react";

/** Clean axis ticks (0, 1, 2… or 0, 5, 10…) with at most ~4 intervals. */
function niceTicks(max: number): number[] {
  const safeMax = Math.max(max, 1);
  const rough = safeMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? magnitude * 10;
  const top = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return ticks;
}

export type ColumnDatum = { key: string | number; label: string; value: number; detail?: string };

/** Single-series column chart: hairline grid, capped rounded columns, per-column tooltip. */
export function ColumnChart({ data, unit = "visitor", ariaLabel }: { data: ColumnDatum[]; unit?: string; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const peakValue = Math.max(0, ...data.map((d) => d.value));
  const peakIndex = peakValue > 0 ? data.findIndex((d) => d.value === peakValue) : -1;
  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const activeDatum = active === null ? null : data[active];

  return <div className="vchart" role="group" aria-label={ariaLabel}>
    <div className="vchart-y" aria-hidden="true">
      {[...ticks].reverse().map((tick) => <span key={tick}>{tick}</span>)}
    </div>
    <div className="vchart-plot">
      <div className="vchart-grid" aria-hidden="true">
        {ticks.map((tick) => <i key={tick} style={{ bottom: `${tick / top * 100}%` }} />)}
      </div>
      <div className="vchart-cols" onPointerLeave={() => setActive(null)}>
        {data.map((datum, index) => {
          const height = datum.value > 0 ? Math.max(datum.value / top * 100, 3) : 0;
          return <button
            type="button"
            key={datum.key}
            className={`vchart-col ${active === index ? "active" : ""} ${datum.value === 0 ? "empty" : ""}`}
            aria-label={`${datum.detail ?? datum.label}: ${plural(datum.value)}`}
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            <span className="vchart-bar" style={{ height: `${height}%` }}>
              {index === peakIndex && active === null && <span className="vchart-peak">{datum.value}</span>}
            </span>
          </button>;
        })}
        {activeDatum && active !== null && <div
          className={`chart-tooltip ${active > data.length / 2 ? "flip" : ""}`}
          style={{ left: `${(active + 0.5) / data.length * 100}%`, bottom: `${Math.min(activeDatum.value / top * 100, 82)}%` }}
          role="status"
        >
          <strong>{plural(activeDatum.value)}</strong>
          <span>{activeDatum.detail ?? activeDatum.label}</span>
        </div>}
      </div>
      <div className="vchart-x" aria-hidden="true">
        {data.map((datum, index) => <span key={datum.key} className={data.length > 8 && index % 2 === 1 ? "minor" : ""}>{datum.label}</span>)}
      </div>
    </div>
  </div>;
}

export type DonutSegment = { key: string; label: string; value: number; className: string };

/** Part-to-whole ring with a 2px surface gap between segments and a centred headline. */
export function DonutChart({ segments, centerValue, centerLabel }: { segments: DonutSegment[]; centerValue: number | string; centerLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.filter((segment) => segment.value > 0).length > 1 ? 2.5 : 0;
  let offset = 0;
  const activeSegment = segments.find((segment) => segment.key === active);

  return <div className="donut-chart">
    <svg viewBox="0 0 100 100" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
      <circle className="donut-track" cx="50" cy="50" r={radius} />
      {total > 0 && segments.map((segment) => {
        if (segment.value <= 0) return null;
        const length = segment.value / total * circumference;
        const dash = Math.max(length - gap, 0.01);
        const circle = <circle
          key={segment.key}
          className={`donut-seg ${segment.className} ${active && active !== segment.key ? "dim" : ""}`}
          cx="50" cy="50" r={radius}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          onPointerEnter={() => setActive(segment.key)}
          onPointerLeave={() => setActive(null)}
        />;
        offset += length;
        return circle;
      })}
    </svg>
    <div className="donut-chart-center" aria-hidden="true">
      <strong>{activeSegment ? activeSegment.value : centerValue}</strong>
      <span>{activeSegment ? activeSegment.label.toLowerCase() : centerLabel}</span>
    </div>
  </div>;
}

/** Status legend rows: swatch, name, count and share of the total. */
export function ShareLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return <div className="share-legend">
    {segments.map((segment) => <div key={segment.key}>
      <span className="legend-name"><i className={segment.className} />{segment.label}</span>
      <span className="share-legend-value"><strong>{segment.value}</strong><small>{total ? Math.round(segment.value / total * 100) : 0}%</small></span>
    </div>)}
  </div>;
}

/** Ranked horizontal bars, scaled to the largest value, value at the bar tip. */
export function RankedBars({ rows, total, unit = "visit" }: { rows: [string, number][]; total: number; unit?: string }) {
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return <ol className="ranked-bars">
    {rows.map(([label, value]) => {
      const share = total ? Math.round(value / total * 100) : 0;
      return <li key={label} title={`${label}: ${value} ${unit}${value === 1 ? "" : "s"} (${share}%)`}>
        <span className="ranked-label">{label}</span>
        <span className="ranked-track"><i style={{ width: `${Math.max(value / max * 100, 2)}%` }} /><b>{value}</b></span>
        <span className="ranked-share">{share}%</span>
      </li>;
    })}
  </ol>;
}
