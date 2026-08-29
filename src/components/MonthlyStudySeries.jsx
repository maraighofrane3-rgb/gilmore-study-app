import { CalendarDays, Sprout } from 'lucide-react';

/**
 * MonthlyStudySeries — 30-day LINE chart (same design as the Focus weekly graph)
 * X: days (date number + studied time below) · Y: 0 → 23h45 (gridline every 45m)
 */

const W = 760, H = 320;
const padL = 46, padR = 16, padT = 16, padB = 52;

function buildSeries(data, days) {
  const today = new Date();
  const minutesByDate = new Map((data || []).map((d) => [d.date, d.minutes]));
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr, minutes: minutesByDate.get(dateStr) || 0 };
  });
}

function formatMinutes(m) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem.toString().padStart(2, '0')}` : `${h}h`;
}

function formatLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MonthlyStudySeries({ data, days = 30 }) {
  const series = buildSeries(data, days);
  const activeDays = series.filter((d) => d.minutes > 0).length;
  const totalMinutes = series.reduce((sum, d) => sum + d.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const todayStr = new Date().toISOString().slice(0, 10);

  // 📈 Fixed Y axis: 0 → 23h45, thin gridline every 45 min
  const MAX_Y = 23 * 60 + 45;
  const GRID_STEP = 45;
  const gridTicks = [];
  for (let t = 0; t < MAX_Y; t += GRID_STEP) gridTicks.push(t);
  gridTicks.push(MAX_Y);

  const xFor = (i) => padL + (i * (W - padL - padR)) / (days - 1);
  const yFor = (v) => H - padB - (Math.min(v, MAX_Y) / MAX_Y) * (H - padT - padB);

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
            {activeDays}
            <span className="text-sm text-coffee-cream font-body">/{days}</span>
          </p>
          <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
            active days &middot; {totalHours}h total
          </p>
        </div>
      </div>

      {/* 📈 Line chart */}
      <div className="overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" style={{ minWidth: 640 }}>
          {/* Horizontal grid (every 45m) + Y labels every 3h + top 23h45 */}
          {gridTicks.map((t) => {
            const showLabel = t % 180 === 0 || t === MAX_Y;
            return (
              <g key={`h-${t}`}>
                <line
                  x1={padL} y1={yFor(t)} x2={W - padR} y2={yFor(t)}
                  stroke="var(--color-coffee-cream)"
                  strokeOpacity={t === MAX_Y ? 0.35 : 0.18}
                  strokeWidth="1"
                />
                {showLabel && (
                  <text x={padL - 8} y={yFor(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-coffee-cream)">
                    {formatMinutes(t)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vertical grid + X labels: day number + studied time below */}
          {series.map((d, i) => {
            const dt = new Date(`${d.date}T00:00:00`);
            const isToday = d.date === todayStr;
            const dayLabel = (i === 0 || dt.getDate() === 1)
              ? dt.toLocaleDateString('en-US', { month: 'short' })
              : dt.getDate();
            return (
              <g key={`v-${d.date}`}>
                <line
                  x1={xFor(i)} y1={padT} x2={xFor(i)} y2={H - padB}
                  stroke="var(--color-coffee-cream)" strokeOpacity="0.15" strokeWidth="1"
                />
                <text
                  x={xFor(i)} y={H - padB + 18} textAnchor="middle" fontSize="9"
                  fontWeight={isToday ? 'bold' : 'normal'}
                  fill={isToday ? 'var(--color-maple-rust)' : 'var(--color-coffee-cream)'}
                >
                  {dayLabel}
                </text>
                <text
                  x={xFor(i)} y={H - padB + 32} textAnchor="middle" fontSize="8"
                  fontWeight={isToday ? 'bold' : 'normal'}
                  fill={isToday ? 'var(--color-maple-rust)' : 'var(--color-porch-sage)'}
                >
                  {formatMinutes(d.minutes)}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />

          {/* The line */}
          <polyline
            points={series.map((d, i) => `${xFor(i)},${yFor(d.minutes)}`).join(' ')}
            fill="none"
            stroke="var(--color-maple-rust)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots (today = gold & bigger, hover = tooltip) */}
          {series.map((d, i) => (
            <circle
              key={`p-${d.date}`}
              cx={xFor(i)}
              cy={yFor(d.minutes)}
              r={d.date === todayStr ? 5 : 3}
              fill={d.date === todayStr ? 'var(--color-gilmore-gold)' : 'var(--color-maple-rust)'}
              stroke="var(--color-page-cream)"
              strokeWidth="1.5"
            >
              <title>{`${formatLabel(d.date)} — ${d.minutes > 0 ? `${d.minutes} min` : 'No activity'}`}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Footer: date range */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-coffee-cream/20">
        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          {formatLabel(series[0].date)}
        </span>
        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          {formatLabel(series[series.length - 1].date)}
        </span>
      </div>
    </div>
  );
}