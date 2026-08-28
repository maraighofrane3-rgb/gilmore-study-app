import { CalendarDays, Sprout } from 'lucide-react';

/**
 * MonthlyStudySeries
 * -------------------
 * Replaces the old "Current Goals" panel on the dashboard with a
 * 30-day vertical bar chart (contribution-graph style) that shows
 * study *regularity* rather than a one-off goal percentage.
 *
 * Props:
 *  - data:  optional array of { date: 'YYYY-MM-DD', minutes: number },
 *           newest day last. If omitted (or shorter than `days`), a
 *           zero-filled skeleton for the trailing `days` days is used
 *           so the chart still looks intentional with no data yet.
 *  - days:  number of days to show (default 30).
 *
 * Usage in Dashboard.jsx:
 *   import MonthlyStudySeries from './MonthlyStudySeries';
 *   ...
 *   <MonthlyStudySeries data={studyLog} />   // instead of <CurrentGoals />
 */

// Builds a full `days`-length skeleton (today last) and overlays any
// real entries from `data` matched by date. This works whether `data`
// is empty, sparse (e.g. only days with sessions), or complete —
// unlike a naive length check, days with no activity simply stay at 0.
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

function getLevel(minutes, max) {
  if (minutes <= 0) return 0;
  const ratio = minutes / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

// Intensity scale reuses the existing porch-sage token — no new colors
// introduced, so it inherits each theme's palette automatically.
const LEVEL_STYLES = [
  'bg-transparent border border-coffee-cream/25',
  'bg-porch-sage/25',
  'bg-porch-sage/45',
  'bg-porch-sage/70',
  'bg-porch-sage',
];

function formatLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MonthlyStudySeries({ data, days = 30 }) {
  const series = buildSeries(data, days);
  const maxMinutes = Math.max(60, ...series.map((d) => d.minutes));
  const activeDays = series.filter((d) => d.minutes > 0).length;
  const totalMinutes = series.reduce((sum, d) => sum + d.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="cozy-card relative p-6 md:p-8">
      <Sprout
        size={22}
        strokeWidth={1.25}
        className="absolute top-6 right-6 text-porch-sage/25"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
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

      {/* Bars */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-end gap-1 h-40 min-w-[480px]">
          {series.map((d) => {
            const level = getLevel(d.minutes, maxMinutes);
            const heightPct =
              d.minutes > 0 ? Math.max(8, (d.minutes / maxMinutes) * 100) : 6;

            return (
              <div
                key={d.date}
                title={`${formatLabel(d.date)} — ${
                  d.minutes > 0 ? `${d.minutes} min` : 'No activity'
                }`}
                className="flex-1 flex flex-col justify-end group cursor-default"
              >
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80 ${LEVEL_STYLES[level]}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: date range + legend */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-coffee-cream/20">
        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          {formatLabel(series[0].date)}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mr-1">
            Less
          </span>
          {LEVEL_STYLES.map((cls, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
          ))}
          <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream ml-1">
            More
          </span>
        </div>

        <span className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
          {formatLabel(series[series.length - 1].date)}
        </span>
      </div>
    </div>
  );
}