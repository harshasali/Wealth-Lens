import React, { useMemo, useState, useId } from 'react';

// Area + line SVG chart. series: [{ name, color, points: [{x, y}], fill? }]
export default function LineChart({ series, height = 280, yFormat = (v) => v.toFixed(0) }) {
  const [hover, setHover] = useState(null);
  const uid = useId().replace(/[:]/g, '');
  const W = 720;
  const H = height;
  const padL = 64, padR = 18, padT = 18, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const { xs, yMin, yMax } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const xs = Array.from(new Set(all.map((p) => p.x))).sort((a, b) => a - b);
    const ys = all.map((p) => p.y);
    let yMin = Math.min(...ys, 0);
    let yMax = Math.max(...ys, 1);
    if (yMin === yMax) yMax = yMin + 1;
    const pad = (yMax - yMin) * 0.10;
    return { xs, yMin: yMin - pad, yMax: yMax + pad };
  }, [series]);

  if (xs.length === 0) return <div className="text-white/40 text-sm">No data</div>;

  const xMin = xs[0], xMax = xs[xs.length - 1];
  const sx = (x) => padL + ((x - xMin) / Math.max(1, xMax - xMin)) * innerW;
  const sy = (y) => padT + innerH - ((y - yMin) / (yMax - yMin)) * innerH;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`g-${uid}-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="rgba(255,255,255,0.06)" />
            <text x={padL - 10} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="rgba(245,241,232,0.5)">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {xs.map((x) => (
          <text key={x} x={sx(x)} y={H - 12} textAnchor="middle" fontSize="11" fill="rgba(245,241,232,0.5)">
            {x}
          </text>
        ))}

        {series.map((s, i) => {
          const pts = s.points.slice().sort((a, b) => a.x - b.x);
          const linePath = pts.map((p, j) => `${j === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
          const areaPath =
            `${linePath} L ${sx(pts[pts.length - 1].x)} ${sy(yMin)} L ${sx(pts[0].x)} ${sy(yMin)} Z`;
          return (
            <g key={s.name}>
              {s.fill !== false && (
                <path d={areaPath} fill={`url(#g-${uid}-${i})`} />
              )}
              <path d={linePath} fill="none" stroke={s.color} strokeWidth="2.5"
                    strokeDasharray={s.dashed ? '5 5' : undefined}
                    strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, j) => (
                <circle key={j} cx={sx(p.x)} cy={sy(p.y)} r={hover === p.x ? 4 : 0} fill={s.color} />
              ))}
            </g>
          );
        })}

        {hover != null && (
          <line x1={sx(hover)} x2={sx(hover)} y1={padT} y2={padT + innerH} stroke="rgba(245,184,74,0.45)" strokeDasharray="3 3" />
        )}
        <rect
          x={padL} y={padT} width={innerW} height={innerH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * innerW + padL;
            const x = Math.round(xMin + ((px - padL) / innerW) * (xMax - xMin));
            setHover(x);
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-3 text-xs">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-2" style={{ color: 'rgba(245,241,232,0.8)' }}>
            <span className="dot" style={{ background: s.color }} />
            <span className="tracking-wide">{s.name}</span>
            {hover != null && (
              <span className="font-semibold" style={{ color: s.color }}>
                {yFormat(s.points.find((p) => p.x === hover)?.y ?? 0)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
