import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import { Target, TrendingUp, BookOpen, Play, Pause, RotateCcw } from 'lucide-react';

const DURATIONS = [
  { label: '25m', min: 25 },
  { label: '45m', min: 45 },
  { label: '1h', min: 60 },
  { label: '2h', min: 120 },
];

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Focus() {
  const { user } = useAuth();
  const {
    timeLeft, isRunning, durationMin,
    start, pause, reset, changeDuration,
    selectedTaskId, setSelectedTaskId, completedAt,
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
      // ✅ Sélectionne aussi created_at pour construire le graphique jour par jour
      supabase.from('pomodoro_sessions').select('duration, created_at').eq('user_id', user.id).eq('completed', true).gte('created_at', `${mondayISO}T00:00:00`),
      supabase.from('profiles').select('daily_goal_hours').eq('id', user.id).maybeSingle(),
    ]);

    setTasks(tasksRes.data || []);
    setTodayMinutes((todayRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    setWeekMinutes((weekRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    if (profileRes.data?.daily_goal_hours) setDailyGoal(profileRes.data.daily_goal_hours);

    // 📊 Construit le tableau des 7 jours (Lun → Dim) avec les minutes de chaque jour
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
  const percent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));
  const maxDayMinutes = Math.max(60, ...weekDays.map((d) => d.minutes));
  const todayStr = new Date().toISOString().split('T')[0];

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
          <p className="font-body text-sm text-coffee-cream mb-2">
            {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m completed
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
        <p className="font-display text-8xl md:text-9xl text-yale-blue tracking-tight">{formatTime(timeLeft)}</p>
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
      <div className="flex justify-center gap-3">
        <button
          onClick={isRunning ? pause : start}
          className="flex items-center gap-2 bg-maple-rust text-page-cream px-8 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:bg-yale-blue transition-all"
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
          {isRunning ? 'Pause' : 'Start Focus'}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 border border-coffee-cream/30 text-coffee-cream px-6 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:border-maple-rust hover:text-maple-rust transition-all"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* ✅ Weekly progress + per-day graph */}
      <div className="cozy-card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <TrendingUp size={22} className="text-porch-sage" />
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Weekly Progress</p>
            <p className="font-display text-2xl text-yale-blue">{(weekMinutes / 60).toFixed(1)} hours this week</p>
          </div>
        </div>

        {/* 📊 One bar per day, Mon → Sun */}
        <div className="flex items-end gap-2">
          {weekDays.map((d) => {
            const heightPct = d.minutes > 0 ? Math.max(10, (d.minutes / maxDayMinutes) * 100) : 4;
            const isToday = d.date === todayStr;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-24 flex items-end">
                  <div
                    title={`${d.label} — ${d.minutes} min`}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      d.minutes > 0 ? 'bg-porch-sage' : 'bg-coffee-cream/20'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className={`font-label text-[0.6rem] uppercase tracking-wider ${isToday ? 'text-maple-rust font-bold' : 'text-coffee-cream'}`}>
                  {d.label}
                </span>
                {isToday && (
                  <span className="w-1 h-1 rounded-full bg-maple-rust" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}