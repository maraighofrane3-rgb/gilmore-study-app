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

const BREAKS = [
  { label: '5m', min: 5 },
  { label: '15m', min: 15 },
  { label: '30m', min: 30 },
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

// ============================================
// 🕯️☕ SCENE — candle during focus, coffee during break
// ============================================
function CandleAndCoffee({ phase, coffeeEmpty, progress, isRunning }) {
  const melted = progress >= 1;
  const waxH = melted ? 0 : Math.max(16, Math.round(130 * (1 - progress)));
  const waxTop = 200 - waxH;
  const B = waxTop - 9;
  const flameOn = isRunning && !melted && phase === 'focus';
  const minY = Math.max(-6, B - (flameOn ? 62 : 14));

  return (
    <div className="flex items-end justify-center gap-16 select-none" aria-hidden="true">
      {/* 🕯️ CANDLE — only during focus */}
      {phase === 'focus' && (
        <div className="flex flex-col items-center">
          <svg width="150" height={240 - minY} viewBox={`0 ${minY} 150 ${240 - minY}`}>
            <defs>
              <linearGradient id="waxGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#DCCEAE" />
                <stop offset=".45" stopColor="#F7F0DE" />
                <stop offset="1" stopColor="#CDBD97" />
              </linearGradient>
              <linearGradient id="flameOuter" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#F2B23E" />
                <stop offset="1" stopColor="#C4711D" />
              </linearGradient>
              <linearGradient id="flameMid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FBD98A" />
                <stop offset="1" stopColor="#EFA93C" />
              </linearGradient>
              <radialGradient id="glowGrad">
                <stop offset="0" stopColor="#F6C866" stopOpacity=".5" />
                <stop offset="1" stopColor="#F6C866" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="brassGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E0B45C" />
                <stop offset="1" stopColor="#7E5D1C" />
              </linearGradient>
            </defs>

            {flameOn && <circle className="candle-glow" cx="75" cy={B - 18} r="40" fill="url(#glowGrad)" />}
            {flameOn && (
              <g fill="#F2C86B">
                <circle className="sparkle" cx="52" cy={B - 30} r="2" />
                <circle className="sparkle sparkle-2" cx="98" cy={B - 40} r="1.6" />
                <circle className="sparkle sparkle-3" cx="88" cy={B - 14} r="1.4" />
              </g>
            )}

            <g className={flameOn ? 'candle-flame' : 'opacity-0'} style={{ transformOrigin: `75px ${B}px` }}>
              <path d={`M75 ${B - 38} C83 ${B - 24} 88 ${B - 16} 88 ${B - 9} A13 13 0 0 1 62 ${B - 9} C62 ${B - 16} 67 ${B - 24} 75 ${B - 38} Z`} fill="url(#flameOuter)" />
              <path d={`M75 ${B - 26} C80 ${B - 17} 83 ${B - 12} 83 ${B - 7} A8 8 0 0 1 67 ${B - 7} C67 ${B - 12} 70 ${B - 17} 75 ${B - 26} Z`} fill="url(#flameMid)" />
              <path d={`M75 ${B - 14} C77.5 ${B - 9} 79 ${B - 6} 79 ${B - 4} A4 4 0 0 1 71 ${B - 4} C71 ${B - 6} 72.5 ${B - 9} 75 ${B - 14} Z`} fill="#FBF3DC" />
              <ellipse cx="75" cy={B - 3} rx="4.5" ry="2.5" fill="#7A9CC6" opacity=".55" />
            </g>

            {!melted && (
              <>
                <path d={`M75 ${waxTop} q1.5 -5 0 -9`} stroke="#3E2B20" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                {flameOn && <circle cx="75" cy={B} r="2" fill="#FF9C3F" />}
              </>
            )}

            {!melted && (
              <>
                <rect x="49" y={waxTop} width="52" height={waxH} rx="9" fill="url(#waxGrad)" />
                <rect x="57" y={waxTop + 8} width="6" height={Math.max(10, waxH - 26)} rx="3" fill="#FFFFFF" opacity=".28" />
                <ellipse cx="75" cy={waxTop + 1} rx="26" ry="6" fill="#EFE6CC" />
                <ellipse cx="75" cy={waxTop + 2} rx="19" ry="3.8" fill="#CDBD97" opacity=".7" />
                {flameOn && <ellipse cx="75" cy={waxTop + 2} rx="11" ry="2.4" fill="#F2C866" opacity=".55" />}
                {progress > 0.03 && (
                  <>
                    <path d={`M52 ${waxTop + 4} q-4 14 0 26 q4 -12 0 -26`} fill="#F7F0DE" />
                    <path d={`M98 ${waxTop + 6} q3.5 12 0 20 q-3.5 -8 0 -20`} fill="#DCCEAE" />
                    <path d={`M60 ${waxTop + 10} q-3 9 0 15 q3 -6 0 -15`} fill="#EFE6CC" />
                  </>
                )}
              </>
            )}

            {(progress > 0.1 || melted) && (
              <>
                <ellipse cx="75" cy="198" rx={melted ? 46 : 26 + progress * 14} ry={melted ? 6 : 4.5} fill="#EFE6CC" opacity=".95" />
                <ellipse cx="75" cy="197" rx={melted ? 30 : 16 + progress * 8} ry={melted ? 3.5 : 2.5} fill="#DCCEAE" opacity=".8" />
              </>
            )}

            {melted && (
              <g stroke="#B9AE9C" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path className="steam" d="M70 192c-4-5 4-7 0-13" />
                <path className="steam steam-2" d="M80 190c-4-5 4-7 0-13" />
              </g>
            )}

            <ellipse cx="75" cy="200" rx="32" ry="7" fill="url(#brassGrad)" />
            <rect x="67" y="202" width="16" height="10" rx="3" fill="#7E5D1C" />
            <ellipse cx="75" cy="206" rx="13" ry="3" fill="#E0B45C" opacity=".8" />
            <ellipse cx="75" cy="214" rx="38" ry="8" fill="url(#brassGrad)" />
            <ellipse cx="75" cy="213" rx="30" ry="5" fill="none" stroke="#5E4515" strokeWidth="1" opacity=".45" />
            <ellipse cx="75" cy="226" rx="48" ry="6" fill="#3B2314" opacity=".08" />
          </svg>
          <p className="font-body italic text-sm text-coffee-cream mt-2">
            {melted
              ? 'the candle gave everything — goal complete!'
              : progress === 0
              ? 'the wick is waiting'
              : `${Math.round(progress * 100)}% of today's goal burned`}
          </p>
        </div>
      )}

      {/* ☕ COFFEE — only during break */}
      {phase === 'break' && (
        <div className="flex flex-col items-center">
          <svg width="200" height="176" viewBox="0 0 200 176">
            <defs>
              <linearGradient id="cupGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8A3A1C" />
                <stop offset=".45" stopColor="#B4552D" />
                <stop offset="1" stopColor="#7E3418" />
              </linearGradient>
            </defs>

            {!coffeeEmpty && (
              <g stroke="#C89B7B" strokeWidth="4.5" strokeLinecap="round" fill="none" className={isRunning ? '' : 'opacity-0'}>
                <path className="steam" d="M76 62c-6-9 6-13 0-24c-5-9 5-13 0-22" />
                <path className="steam steam-2" d="M98 58c-6-10 6-14 0-26c-5-10 5-14 0-24" />
                <path className="steam steam-3" d="M120 62c-6-9 6-13 0-24c-5-9 5-13 0-22" />
              </g>
            )}

            <path d="M50 78h96c0 32-19 56-48 56s-48-24-48-56z" fill="url(#cupGrad)" />
            <ellipse cx="72" cy="96" rx="8" ry="20" fill="#FFFFFF" opacity=".14" />
            <path d="M146 84c17-2 24 8 22 17s-15 17-27 17" fill="none" stroke="#A0522D" strokeWidth="11" strokeLinecap="round" />
            <ellipse cx="98" cy="78" rx="48" ry="11" fill="#E8DCC3" />

            {coffeeEmpty ? (
              <>
                <ellipse cx="98" cy="78" rx="40" ry="8" fill="#E3D7BD" />
                <ellipse cx="98" cy="80" rx="30" ry="5.5" fill="#CDBD97" opacity=".8" />
                <path d="M80 82c5 2 12 3 24 2" stroke="#6B4423" strokeWidth="2" fill="none" opacity=".45" strokeLinecap="round" />
              </>
            ) : (
              <>
                <ellipse cx="98" cy="78" rx="40" ry="8" fill="#3B2314" />
                {isRunning && <ellipse cx="80" cy="76" rx="7" ry="2" fill="#E8A33D" opacity=".35" />}
                <path d="M98 82c-3-4-9-3.5-9 1c0 4 5 6 9 9c4-3 9-5 9-9c0-4.5-6-5-9-1z" fill="#E8DCC3" opacity=".9" />
              </>
            )}

            <ellipse cx="98" cy="140" rx="60" ry="12" fill="#F0EAD8" />
            <ellipse cx="98" cy="138" rx="38" ry="7" fill="#D9CDB0" />
            <g fill="#C89B3C">
              <ellipse cx="150" cy="138" rx="7" ry="3.5" />
              <rect x="155" y="136.5" width="16" height="3" rx="1.5" />
            </g>

            <rect x="56" y="149" width="84" height="8" rx="2" fill="#132A44" />
            <rect x="132" y="150.5" width="6" height="5" rx="1" fill="#F0EAD8" />
            <rect x="64" y="157" width="72" height="8" rx="2" fill="#A0522D" />
            <rect x="128" y="158.5" width="6" height="5" rx="1" fill="#F0EAD8" />

            <ellipse cx="98" cy="169" rx="70" ry="6" fill="#3B2314" opacity=".08" />
          </svg>
          <p className="font-body italic text-sm text-coffee-cream mt-2">
            {coffeeEmpty
              ? 'all gone — back to the desk'
              : isRunning
              ? 'steam rising — sip slowly'
              : "Luke's coffee, waiting for you"}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================
// 🏠 MAIN COMPONENT
// ============================================
export default function Focus() {
  const { user } = useAuth();
  const {
    timeLeft, isRunning, durationMin,
    start, pause, reset, changeDuration,
    selectedTaskId, setSelectedTaskId,
    selectedGoalId, setSelectedGoalId,
    selectedGoalTaskId, setSelectedGoalTaskId,
    completedAt, done,
    phase, coffeeEmpty, skipBreak,
  } = useFocusTimer();

  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalTasks, setGoalTasks] = useState([]);
  const [focusMode, setFocusMode] = useState('task');
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [weekDays, setWeekDays] = useState([]);
  const [dailyGoal, setDailyGoal] = useState(6);

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

  const switchToTask = () => {
    setFocusMode('task');
    setSelectedGoalId(null);
    setSelectedGoalTaskId(null);
  };
  const switchToGoal = () => {
    setFocusMode('goal');
    setSelectedTaskId(null);
    setSelectedGoalTaskId(null);
  };
  const handleGoalSelect = (goalId) => {
    setSelectedGoalId(goalId || null);
    setSelectedTaskId(null);
    setSelectedGoalTaskId(null);
  };

  const goalMinutes = dailyGoal * 60;
  const liveSeconds = phase === 'focus' && timeLeft < durationMin * 60 ? durationMin * 60 - timeLeft : 0;
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

      {/* Focus target — only during focus phase */}
      {phase === 'focus' && (
        <div className="max-w-xl mx-auto space-y-3">
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

          {focusMode === 'goal' && (
            <div className="space-y-3 animate-fade-in-up">
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
                          onClick={() => setSelectedGoalTaskId(selectedGoalTaskId === t.id ? null : t.id)}
                          className={`px-3 py-2 rounded-sm font-body text-xs border transition-all ${
                            selectedGoalTaskId === t.id
                              ? 'bg-maple-rust text-page-cream border-maple-rust shadow-sm'
                              : 'bg-page-cream text-library-ink border-coffee-cream/30 hover:border-maple-rust/50 hover:text-maple-rust'
                          }`}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedGoalTaskId && (
                    <div className="bg-page-cream/50 p-3 rounded-sm border-l-4 border-gilmore-gold">
                      <p className="font-label text-[0.6rem] uppercase tracking-wider text-gilmore-gold mb-0.5">
                        Focus on
                      </p>
                      <p className="font-display text-sm text-yale-blue">
                        {tasksOfSelectedGoal.find(t => t.id === selectedGoalTaskId)?.title}
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
      )}

      {/* Timer */}
      <div className="text-center pt-6 pb-0">
        <p className="font-display text-8xl md:text-9xl text-yale-blue tracking-tight">{formatHMS(timeLeft)}</p>
        <p className="font-label text-sm uppercase tracking-widest text-coffee-cream mt-2">
          {phase === 'focus' ? 'Focus Time' : coffeeEmpty ? 'Break Over' : 'Break Time'}
        </p>
      </div>

      {/* 🕯️☕ Scene — candle in focus, coffee in break */}
      <div className="-mt-10">
        <CandleAndCoffee
          phase={phase}
          coffeeEmpty={coffeeEmpty}
          progress={Math.min(1, totalSeconds / (goalMinutes * 60))}
          isRunning={isRunning}
        />
      </div>

      {/* Durations — focus or break options */}
      <div className="flex justify-center gap-2">
        {(phase === 'focus' ? DURATIONS : BREAKS).map(d => (
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
            className={`flex items-center gap-2 text-page-cream px-8 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider transition-all ${
              phase === 'focus' ? 'bg-maple-rust hover:bg-yale-blue' : 'bg-porch-sage hover:bg-maple-rust'
            }`}
          >
            <Play size={18} /> {timeLeft !== durationMin * 60 ? 'Resume' : phase === 'focus' ? 'Start Focus' : 'Start Break'}
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

        {phase === 'break' && !coffeeEmpty && (
          <button
            onClick={skipBreak}
            className="flex items-center gap-2 border border-coffee-cream/30 text-coffee-cream px-6 py-3.5 rounded-sm font-label text-sm uppercase tracking-wider hover:border-maple-rust hover:text-maple-rust transition-all"
          >
            Skip Break
          </button>
        )}
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