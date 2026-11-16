// Small line chart of scores over time (plain SVG, no chart library).

export function ScoreChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-slate-500">Review at least two repos to see your trend.</p>;
  }
  const W = 600;
  const H = 180;
  const pad = { l: 32, r: 12, t: 12, b: 24 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Score trend over time">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-white/10" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-slate-500">
            {v}
          </text>
        </g>
      ))}
      <path d={`${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="rgb(129 140 248 / 0.12)" />
      <path d={path} fill="none" stroke="rgb(129 140 248)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="4" fill="rgb(129 140 248)">
          <title>
            {p.label}: {p.value}
          </title>
        </circle>
      ))}
    </svg>
  );
}
