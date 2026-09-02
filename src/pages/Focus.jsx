import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import { Target, TrendingUp, BookOpen, ListChecks, Play, Pause, RotateCcw, CheckCircle } from 'lucide-react';

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

function formatMinutes(totalMin) {
  const totalSeconds = Math.round(totalMin * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export default function Focus() {
  const { user } = useAuth();
  const {
    timeLeft, isRunning, durationMin,
    start, pause, reset, changeDuration,
    selectedTaskId, setSelectedTaskId,
    selectedGoalId, setSelectedGoalId,
    completedAt, done,
  } = useFocusTimer();

  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalTasks, setGoalTasks] = useState([]); // ✅ NEW: tasks linked to goals
  const [focusMode, setFocusMode] = useState('task');
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [weekDays, setWeekDays] = useState([]);
  const [dailyGoal, setDailyGoal] = useState(6);

  // ✅ Tasks of the currently selected goal (pending only)
  const tasksOfSelectedGoal = useMemo(
    () => goalTasks.filter(t => t.goal_id === selectedGoalId && !t.completed),
    [goalTasks, selectedGoalId]
  );

  useEffect(() => {
    if (user) fetchStats();
  }, [user, completedAt]);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const mondayISO = monday.toISOString().split('T')[0];

    const [tasksRes, goalsRes, goalTasksRes, todayRes, weekRes, profileRes] = await Promise.all([
      supabase.from('tasks').select('id, title').eq('user_id', user.id).eq('status', 'todo'),
      supabase.from('goals').select('id, title').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('goal_tasks').select('id, title, goal_id, completed').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('pomodoro_sessions').select('duration').eq('user_id', user.id).eq('completed', true).gte('created_at', `${today}T00:00:00`),
      supabase.from('pomodoro_sessions').select('duration, created_at').eq('user_id', user.id).eq('completed', true).gte('created_at', `${mondayISO}T00:00:00`),
      supabase.from('profiles').select('daily_goal_hours').eq('id', user.id).maybeSingle(),
    ]);

    setTasks(tasksRes.data || []);
    setGoals(goalsRes.data || []);
    setGoalTasks(goalTasksRes.data || []);
    setTodayMinutes((todayRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    setWeekMinutes((weekRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
    if (profileRes.data?.daily_goal_hours) setDailyGoal(profileRes.data.daily_goal_hours);

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

  // ✅ When switching mode or changing goal, clear the task selection
  const switchToTask = () => {
    setFocusMode('task');
    setSelectedGoalId(null);
  };
  const switchToGoal = () => {
    setFocusMode('goal');
    setSelectedTaskId(null);
  };
  const handleGoalSelect = (goalId) => {
    setSelectedGoalId(goalId || null);
    setSelectedTaskId(null); // reset task when goal changes
  };

  const goalMinutes = dailyGoal * 60;
  const liveSeconds = timeLeft < durationMin * 60 ? durationMin * 60 - timeLeft : 0;
  const totalSeconds = todayMinutes * 60 + liveSeconds;
  const percent = Math.min(100, Math.round((totalSeconds / (goalMinutes * 60)) * 100));
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDayMinutes = Math.max(0, ...weekDays.map((d) => d.minutes));

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

      {/* Focus target: task or goal */}
      <div className="max-w-xl mx-auto space-y-3">
        {/* Mode switch */}
        <div className="flex gap-2">
          <button
            onClick={switchToTask}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-sm font-label text-xs uppercase tracking-wider border transition-colors ${
              focusMode === 'task'
                ? 'bg-yale-blue text-page-cream border-yale-blue'
                : 'border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust'
            }`}
          >
            <ListChecks size={14} /> Task
          </button>
          <button
            onClick={switchToGoal}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-sm font-label text-xs uppercase tracking-wider border transition-colors ${
              focusMode === 'goal'
                ? 'bg-yale-blue text-page-cream border-yale-blue'
                : 'border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust'
            }`}
          >
            <Target size={14} /> Goal
          </button>
        </div>

        {/* TASK mode */}
        {focusMode === 'task' && (
          <div className="flex items-center gap-2 bg-page-cream border border-coffee-cream/20 rounded-sm px-4 py-3">
            <BookOpen size={18} className="text-coffee-cream shrink-0" />
            <select
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value || null)}
              className="flex-1 bg-transparent focus:outline-none font-body text-sm text-library-ink"
            >
              <option value="">Select a task (optional)...</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* GOAL mode — goal select + task chips bar */}
        {focusMode === 'goal' && (
          <div className="space-y-3 animate-fade-in-up">
            {/* Goal select */}
            <div className="flex items-center gap-2 bg-page-cream border border-coffee-cream/20 rounded-sm px-4 py-3">
              <Target size={18} className="text-coffee-cream shrink-0" />
              <select
                value={selectedGoalId || ''}
                onChange={(e) => handleGoalSelect(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none font-body text-sm text-library-ink"
              >
                <option value="">Select a goal...</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            {/* ✅ Task chips bar — appears right after a goal is selected */}
            {selectedGoalId && (
              <div className="space-y-2 animate-fade-in-up">
                <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream flex items-center gap-1.5">
                  <ListChecks size={12} className="text-maple-rust" />
                  Pick a specific task (optional):
                </p>

                {tasksOfSelectedGoal.length === 0 ? (
                  <p className="font-body text-xs text-coffee-cream/60 italic">
                    No pending tasks for this goal — you'll focus on the goal itself.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tasksOfSelectedGoal.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTaskId(selectedTaskId === t.id ? null : t.id)}
                        className={`px-3 py-2 rounded-sm font-body text-xs border transition-all ${
                          selectedTaskId === t.id
                            ? 'bg-maple-rust text-page-cream border-maple-rust shadow-sm'
                            : 'bg-page-cream text-library-ink border-coffee-cream/30 hover:border-maple-rust/50 hover:text-maple-rust'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}

                {/* Summary of what you're about to focus on */}
                {selectedTaskId && (
                  <div className="bg-page-cream/50 p-3 rounded-sm border-l-4 border-gilmore-gold">
                    <p className="font-label text-[0.6rem] uppercase tracking-wider text-gilmore-gold mb-0.5">
                      Focus on
                    </p>
                    <p className="font-display text-sm text-yale-blue">
                      {tasksOfSelectedGoal.find(t => t.id === selectedTaskId)?.title}
                    </p>
                    <p className="font-body text-xs text-coffee-cream italic">
                      from: {goals.find(g => g.id === selectedGoalId)?.title}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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

      {/* Weekly Progress */}
      <div className="cozy-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <TrendingUp size={22} className="text-porch-sage" />
          <div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Weekly Progress</p>
            <p className="font-display text-2xl text-yale-blue">{(weekMinutes / 60).toFixed(1)} hours this week</p>
          </div>
        </div>

        <div className="flex items-end gap-3 sm:gap-5 h-48 px-1">
          {weekDays.map((d) => {
            const isToday = d.date === todayStr;
            const heightPct =
              maxDayMinutes > 0 ? Math.max(4, (d.minutes / maxDayMinutes) * 100) : 4;

            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                <span
                  className={`font-label text-[0.6rem] mb-2 tabular-nums ${
                    isToday ? 'text-maple-rust font-semibold' : 'text-coffee-cream'
                  }`}
                >
                  {formatMinutes(d.minutes)}
                </span>
                <div
                  title={`${d.label} — ${formatMinutes(d.minutes)}`}
                  className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out ${
                    isToday
                      ? 'bg-gilmore-gold'
                      : 'bg-maple-rust/75 group-hover:bg-maple-rust'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 sm:gap-5 px-1 pt-3 border-t border-coffee-cream/20">
          {weekDays.map((d) => (
            <span
              key={d.date}
              className={`flex-1 text-center font-label text-[0.6rem] uppercase tracking-wider-label ${
                d.date === todayStr ? 'text-maple-rust font-semibold' : 'text-coffee-cream'
              }`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}