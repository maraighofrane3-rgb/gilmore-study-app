import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import { Target, TrendingUp, BookOpen, Play, Pause, RotateCcw, CheckCircle  } from 'lucide-react';

const DURATIONS = [
  { label: '25m', min: 25 },
  { label: '45m', min: 45 },
  { label: '1h', min: 60 },
  { label: '2h', min: 120 },
];

function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(m) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem.toString().padStart(2, '0')}` : `${h}h`;
}

// 📈 Line chart geometry
const W = 700, H = 320;
const padL = 46, padR = 16, padT = 16, padB = 52;

export default function Focus() {
  const { user } = useAuth();
  const {
  timeLeft, isRunning, durationMin,
  start, pause, reset, changeDuration,
  selectedTaskId, setSelectedTaskId, completedAt, done,
} = useFocusTimer();

  const [tasks, setTasks] = useState([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [weekDays, setWeekDays] = useState([]);
  const [dailyGoal, setDailyGoal] = useState(6);

  useEffect(() => {
    if (user) fetchStats();
  }, [user, completedAt]);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const mondayISO = monday.toISOString().split('T')[0];

    const [tasksRes, todayRes, weekRes, profileRes] = await Promise.all([
      supabase.from('tasks').select('id, title').eq('user_id', user.id).eq('status', 'todo'),
      supabase.from('pomodoro_sessions').select('duration').eq('user_id', user.id).eq('completed', true).gte('created_at', `${today}T00:00:00`),
      supabase.from('pomodoro_sessions').select('duration, created_at').eq('user_id', user.id).eq('completed', true).gte('created_at', `${mondayISO}T00:00:00`),
      supabase.from('profiles').select('daily_goal_hours').eq('id', user.id).maybeSingle(),
    ]);

    setTasks(tasksRes.data || []);
    setTodayMinutes((todayRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    setWeekMinutes((weekRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    if (profileRes.data?.daily_goal_hours) setDailyGoal(profileRes.data.daily_goal_hours);

    // Build the 7-day series (Mon → Sun)
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: 0,
      });
    }
    (weekRes.data || []).forEach((s) => {
      const key = s.created_at.split('T')[0];
      const entry = days.find((x) => x.date === key);
      if (entry) entry.minutes += s.duration || 0;
    });
    setWeekDays(days);
  };

  const handleGoalChange = async (e) => {
    const v = Math.max(1, Math.min(16, Number(e.target.value) || 1));
    setDailyGoal(v);
    await supabase.from('profiles').update({ daily_goal_hours: v }).eq('id', user.id);
  };

  const goalMinutes = dailyGoal * 60;
   const liveSeconds = timeLeft < durationMin * 60 ? durationMin * 60 - timeLeft : 0;
  const totalSeconds = todayMinutes * 60 + liveSeconds;
  const percent = Math.min(100, Math.round((totalSeconds / (goalMinutes * 60)) * 100));
  const todayStr = new Date().toISOString().split('T')[0];

   // 📈 Fixed Y axis: 0 → 23h45, thin gridline every 45 min
  const MAX_Y = 23 * 60 + 45; // 23h45 in minutes
  const GRID_STEP = 45;
  const gridTicks = [];
  for (let t = 0; t < MAX_Y; t += GRID_STEP) gridTicks.push(t);
  gridTicks.push(MAX_Y); // top line exactly at 23h45

  const xFor = (i) => padL + (i * (W - padL - padR)) / 6;
  const yFor = (v) => H - padB - (Math.min(v, MAX_Y) / MAX_Y) * (H - padT - padB);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Daily Goal */}
      <div className="cozy-card p-6 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <Target size={22} className="text-maple-rust" />
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Daily Goal</p>
            <p className="font-display text-2xl text-yale-blue">{dailyGoal} hours</p>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
                    <p className="font-body text-sm text-coffee-cream mb-2 tabular-nums">
            {formatHMS(totalSeconds)} completed
          </p>
          <div className="w-full bg-coffee-cream/20 rounded-full h-2">
            <div className="h-2 rounded-full bg-maple-rust transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <p className="font-display text-xl text-maple-rust">{percent}%</p>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1" max="16" value={dailyGoal} onChange={handleGoalChange}
            className="w-16 p-2 text-center bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <span className="font-body text-xs text-coffee-cream">hours/day</span>
        </div>
      </div>

      {/* Task selector */}
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 bg-page-cream border border-coffee-cream/20 rounded-sm px-4 py-3">
          <BookOpen size={18} className="text-coffee-cream" />
          <select
            value={selectedTaskId || ''}
            onChange={(e) => setSelectedTaskId(e.target.value || null)}
            className="flex-1 bg-transparent focus:outline-none font-body text-sm text-library-ink"
          >
            <option value="">Select a task (optional)...</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      </div>

      {/* Timer */}
      <div className="text-center py-6">
        <p className="font-display text-8xl md:text-9xl text-yale-blue tracking-tight">{formatHMS(timeLeft)}</p>
        <p className="font-label text-sm uppercase tracking-widest text-coffee-cream mt-2">Focus Time</p>
      </div>

      {/* Durations */}
      <div className="flex justify-center gap-2">
        {DURATIONS.map(d => (
          <button
            key={d.min}
            onClick={() => changeDuration(d.min)}
            className={`px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider border transition-all ${
              durationMin === d.min
                ? 'bg-yale-blue text-page-cream border-yale-blue'
                : 'border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

          {/* Controls */}
      <div className="flex justify-center gap-3 flex-wrap">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex items-center gap-2 bg-yale-blue text-page-cream px-8 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:bg-maple-rust transition-all"
          >
            <Pause size={18} /> Pause
          </button>
        ) : (
          <button
            onClick={start}
            className="flex items-center gap-2 bg-maple-rust text-page-cream px-8 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:bg-yale-blue transition-all"
          >
            <Play size={18} /> {timeLeft !== durationMin * 60 ? 'Resume' : 'Start Focus'}
          </button>
        )}

        {/* ✅ Done: banks elapsed time even mid-session */}
        <button
          onClick={done}
          disabled={timeLeft === durationMin * 60}
          className="flex items-center gap-2 bg-porch-sage text-page-cream px-6 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle size={18} /> Done
        </button>

        <button
          onClick={reset}
          className="flex items-center gap-2 border border-coffee-cream/30 text-coffee-cream px-6 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:border-maple-rust hover:text-maple-rust transition-all"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* 📈 Weekly Progress — line chart (X: days, Y: time studied) */}
      <div className="cozy-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <TrendingUp size={22} className="text-porch-sage" />
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Weekly Progress</p>
            <p className="font-display text-2xl text-yale-blue">{(weekMinutes / 60).toFixed(1)} hours this week</p>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
          {/* Horizontal grid + Y labels */}
                   {/* Horizontal grid every 45m + Y labels every 3h (+ top 23h45) */}
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

          {/* Vertical grid + X labels (days) */}
          {weekDays.map((d, i) => (
            <g key={`v-${d.date}`}>
              <line x1={xFor(i)} y1={padT} x2={xFor(i)} y2={H - padB} stroke="var(--color-coffee-cream)" strokeOpacity="0.25" strokeWidth="1" />
                            <text
                x={xFor(i)}
                y={H - padB + 18}
                textAnchor="middle"
                fontSize="10"
                fontWeight={d.date === todayStr ? 'bold' : 'normal'}
                fill={d.date === todayStr ? 'var(--color-maple-rust)' : 'var(--color-coffee-cream)'}
              >
                {d.label}
              </text>
              <text
                x={xFor(i)}
                y={H - padB + 32}
                textAnchor="middle"
                fontSize="9"
                fontWeight={d.date === todayStr ? 'bold' : 'normal'}
                fill={d.date === todayStr ? 'var(--color-maple-rust)' : 'var(--color-porch-sage)'}
              >
                {formatMinutes(d.minutes)}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="var(--color-maple-rust)" strokeWidth="2" />

          {/* The line */}
          {weekDays.length > 0 && (
            <polyline
              points={weekDays.map((d, i) => `${xFor(i)},${yFor(d.minutes)}`).join(' ')}
              fill="none"
              stroke="var(--color-maple-rust)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots (today = gold & bigger) */}
          {weekDays.map((d, i) => (
            <circle
              key={`p-${d.date}`}
              cx={xFor(i)}
              cy={yFor(d.minutes)}
              r={d.date === todayStr ? 5.5 : 4}
              fill={d.date === todayStr ? 'var(--color-gilmore-gold)' : 'var(--color-maple-rust)'}
              stroke="var(--color-page-cream)"
              strokeWidth="1.5"
            >
              <title>{`${d.label} — ${formatMinutes(d.minutes)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}