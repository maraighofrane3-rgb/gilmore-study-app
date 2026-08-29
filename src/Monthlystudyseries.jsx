import { CalendarDays, Sprout } from 'lucide-react';

/**
 * MonthlyStudySeries — weekly line chart, DYNAMIC scale
 * X: weeks of the last 30 days + weekly total below
 * Y: auto-adapts from 5m steps up to 24h steps (168h week)
 */

const W = 760, H = 320;
const padL = 46, padR = 16, padT = 16, padB = 52;

function niceStepFor(rawMax) {
  const STEPS = [
    5, 10, 15, 30,
    60, 120, 180, 240, 360, 720,
    1440, 2880, 4320, 7200, 10080,
  ];
  for (const s of STEPS) {
    if (rawMax / s <= 8) return s;
  }
  return 10080;
}

function formatMinutes(m) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem.toString().padStart(2, '0')}` : `${h}h`;
}

function buildWeeks(data, days) {
  const today = new Date();
  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - (days - 1));
  const minutesByDate = new Map((data || []).map((d) => [d.date, d.minutes]));

  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const weekCount = Math.ceil(days / 7);
  const weeks = [];
  for (let w = weekCount - 1; w >= 0; w--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - w * 7);
    let minutes = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > today) break;
      if (d < windowStart) continue;
      minutes += minutesByDate.get(d.toISOString().slice(0, 10)) || 0;
    }
    weeks.push({
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      minutes,
      isCurrent: w === 0,
    });
  }
  return weeks;
}

export default function MonthlyStudySeries({ data, days = 30 }) {
  const weeks = buildWeeks(data, days);
  const activeWeeks = weeks.filter((w) => w.minutes > 0).length;
  const totalMinutes = weeks.reduce((s, w) => s + w.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // 📈 DYNAMIC: hit a new max → step grows + new gridlines added
  const rawMax = Math.max(5, ...weeks.map((w) => w.minutes));
  const step = niceStepFor(rawMax);
  const maxY = Math.max(step * Math.ceil(rawMax / step), step * 2);
  const gridTicks = [];
  for (let t = 0; t <= maxY; t += step) gridTicks.push(t);

  const xFor = (i) => padL + (i * (W - padL - padR)) / Math.max(1, weeks.length - 1);
  const yFor = (v) => H - padB - (Math.min(v, maxY) / maxY) * (H - padT - padB);

  return (
    <div className="cozy-card relative p-6 md:p-8">
      <Sprout size={22} strokeWidth={1.25} className="absolute top-6 right-6 text-porch-sage/25" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-1">
            Last {days} Days
          </p>
          <h2 className="font-display text-2xl font-semibold text-yale-blue flex items-center gap-2">
            <CalendarDays size={20} className="text-maple-rust" />
            Study Series
          </h2>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-2xl font-semibold text-yale-blue">
            {activeWeeks}
            <span className="text-sm text-coffee-cream font-body">/{weeks.length}</span>
          </p>
          <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
            active weeks &middot; {totalHours}h total
          </p>
        </div>
      </div>

      {/* 📈 Line chart */}
      <div className="overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" style={{ minWidth: 560 }}>
          {gridTicks.map((t) => (
            <g key={`h-${t}`}>
              <line x1={padL} y1={yFor(t)} x2={W - padR} y2={yFor(t)} stroke="var(--color-coffee-cream)" strokeOpacity={t === maxY ? 0.35 : 0.18} strokeWidth="1" />
              <text x={padL - 8} y={yFor(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-coffee-cream)">
                {formatMinutes(t)}
              </text>
            </g>
          ))}

          {weeks.map((w, i) => (
            <g key={`v-${i}`}>
              <line x1={xFor(i)} y1={padT} x2={xFor(i)} y2={H - padB} stroke="var(--color-coffee-cream)" strokeOpacity="0.15" strokeWidth="1" />
              <text x={xFor(i)} y={H - padB + 18} textAnchor="middle" fontSize="9" fontWeight={w.isCurrent ? 'bold' : 'normal'} fill={w.isCurrent ? 'var(--color-maple-rust)' : 'var(--color-coffee-cream)'}>
                {w.label}
              </text>
              <text x={xFor(i)} y={H - padB + 32} textAnchor="middle" fontSize="8" fontWeight={w.isCurrent ? 'bold' : 'normal'} fill={w.isCurrent ? 'var(--color-maple-rust)' : 'var(--color-porch-sage)'}>
                {formatMinutes(w.minutes)}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />

          <polyline
            points={weeks.map((w, i) => `${xFor(i)},${yFor(w.minutes)}`).join(' ')}
            fill="none" stroke="var(--color-maple-rust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />

          {weeks.map((w, i) => (
            <circle key={`p-${i}`} cx={xFor(i)} cy={yFor(w.minutes)} r={w.isCurrent ? 5 : 4}
              fill={w.isCurrent ? 'var(--color-gilmore-gold)' : 'var(--color-maple-rust)'}
              stroke="var(--color-page-cream)" strokeWidth="1.5">
              <title>{`Week of ${w.label} — ${w.minutes > 0 ? `${w.minutes} min` : 'No activity'}`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-coffee-cream/20">
        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          {weeks[0].label}
        </span>
        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          Today
        </span>
      </div>
    </div>
  );
}