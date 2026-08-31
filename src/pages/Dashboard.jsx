import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import DailyCoach from '../components/DailyCoach';
import {
  Play, Plus, PenLine, Upload, ArrowRight, CheckCircle, Circle,
  BookOpen, CalendarDays, ChevronRight,
} from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Real elapsed time, live — e.g. "0:45:12". Storage may hold fractional
// minutes (see FocusTimerContext.done()); this formats seconds exactly.
function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { isRunning, timeLeft, durationMin, completedAt } = useFocusTimer();
  const [tasks, setTasks] = useState([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [goalHours, setGoalHours] = useState(6);
  const [loading, setLoading] = useState(true);
  const [greeting] = useState(getGreeting);
  const [lastChapter, setLastChapter] = useState(null);

  const today = new Date();
  const todayKey = keyOf(today);

  // 📖 "Continue studying" memory
  useEffect(() => {
    try {
      const raw = localStorage.getItem('rgw-last-chapter');
      if (raw) setLastChapter(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const loadData = async () => {
      const [tasksRes, sessionsRes, profileRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('pomodoro_sessions').select('duration').eq('user_id', user.id).eq('completed', true).gte('created_at', `${todayKey}T00:00:00`),
        supabase.from('profiles').select('daily_goal_hours').eq('id', user.id).maybeSingle(),
      ]);
      if (!mounted) return;
      setTasks(tasksRes.data || []);
      setTodayMinutes((sessionsRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
      setGoalHours(profileRes.data?.daily_goal_hours || 6);
      setLoading(false);
    };
    loadData();
    return () => { mounted = false; };
    // re-fetch whenever a focus session gets banked (Done/natural completion),
    // even if we never left the Dashboard.
  }, [user, todayKey, completedAt]);

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
  };

  const todayTasks = tasks.filter((t) => t.due_date === todayKey).slice(0, 5);

  const plus7 = new Date(today);
  plus7.setDate(today.getDate() + 7);
  const upcoming = tasks
    .filter((t) => t.status !== 'done' && t.due_date && t.due_date > todayKey && t.due_date <= keyOf(plus7))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  // Live progress: banked minutes (from Supabase) + whatever's elapsed in
  // the CURRENT running/paused session (from FocusTimerContext), so the
  // ring and the time both move in real time — not just after "Done".
  const goalMinutes = goalHours * 60;
  const liveSeconds = timeLeft < durationMin * 60 ? durationMin * 60 - timeLeft : 0;
  const totalSeconds = todayMinutes * 60 + liveSeconds;
  const pct = Math.min(1, goalMinutes ? totalSeconds / (goalMinutes * 60) : 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  const daysUntil = (key) =>
    Math.round((new Date(`${key}T00:00:00`) - new Date(`${todayKey}T00:00:00`)) / 86400000);

  const firstName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Scholar';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="eyebrow mb-1">
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-3xl text-yale-blue">
            {greeting}, <span className="italic text-maple-rust">{firstName}</span>.
          </h1>
        </div>
        <button
          onClick={signOut}
          className="border border-maple-rust text-maple-rust px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* Daily Coach */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <DailyCoach />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {/* ── Left: today's engine ── */}
        <div className="space-y-6">
          {/* Focus ring */}
          <div className="cozy-card p-6 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Today's Focus</p>
              {isRunning && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maple-rust opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-maple-rust" />
                </span>
              )}
            </div>
            <div className="relative">
              <svg viewBox="0 0 120 120" className="w-28 h-28">
                <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-coffee-cream)" strokeOpacity="0.25" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r={R} fill="none"
                  stroke="var(--color-maple-rust)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-xl text-yale-blue">{Math.round(pct * 100)}%</span>
              </div>
            </div>
            <div>
              <p className="font-display text-lg text-yale-blue tabular-nums leading-none">
                {formatHMS(totalSeconds)}
              </p>
              <p className="font-body text-xs text-coffee-cream mt-1">of {goalHours}h goal</p>
            </div>
            <Link
              to="/focus"
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all"
            >
              <Play size={14} /> {isRunning ? 'Continue Focus' : 'Start Focus'}
            </Link>
          </div>

          {/* Quick actions */}
          <div className="cozy-card p-6 space-y-3">
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <Link to={`/tasks/${todayKey}`} className="flex items-center justify-center gap-2 p-3 rounded-sm border border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust font-label text-[0.6rem] uppercase tracking-wider transition-colors">
                <Plus size={14} /> Add Task
              </Link>
              <Link to="/notebook" className="flex items-center justify-center gap-2 p-3 rounded-sm border border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust font-label text-[0.6rem] uppercase tracking-wider transition-colors">
                <PenLine size={14} /> New Note
              </Link>
              <Link to="/study-materials" className="flex items-center justify-center gap-2 p-3 rounded-sm border border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust font-label text-[0.6rem] uppercase tracking-wider transition-colors">
                <Upload size={14} /> Import PDF
              </Link>
              <Link to="/tasks" className="flex items-center justify-center gap-2 p-3 rounded-sm border border-coffee-cream/30 text-coffee-cream hover:border-maple-rust hover:text-maple-rust font-label text-[0.6rem] uppercase tracking-wider transition-colors">
                <CalendarDays size={14} /> Calendar
              </Link>
            </div>
          </div>
        </div>

        {/* ── Right: now & next ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Continue studying */}
          {lastChapter && (
            <div className="cozy-card p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <BookOpen size={20} className="text-maple-rust shrink-0" />
                <div className="min-w-0">
                  <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Continue studying</p>
                  <p className="font-display text-lg text-yale-blue truncate">{lastChapter.title}</p>
                </div>
              </div>
              <Link
                to={`/study-materials/${lastChapter.materialId}/chapters/${lastChapter.chapterId}`}
                className="flex items-center gap-2 shrink-0 text-maple-rust font-label text-xs uppercase tracking-wider hover:gap-3 transition-all"
              >
                Resume <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Today's plan */}
          <div className="cozy-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-yale-blue">Today's Plan</h3>
              <Link to={`/tasks/${todayKey}`} className="flex items-center gap-1 text-maple-rust font-label text-xs uppercase tracking-wider hover:gap-2 transition-all">
                Plan the day <ChevronRight size={14} />
              </Link>
            </div>
            {todayTasks.length === 0 ? (
              <p className="font-body text-sm text-coffee-cream italic py-4 text-center">
                Nothing planned yet — a blank page full of possibilities.
              </p>
            ) : (
              todayTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-page-cream border border-coffee-cream/20 rounded-sm p-3">
                  <button onClick={() => toggleTask(t)} className={t.status === 'done' ? 'text-porch-sage' : 'text-coffee-cream hover:text-porch-sage transition-colors'}>
                    {t.status === 'done' ? <CheckCircle size={18} /> : <Circle size={18} />}
                  </button>
                  <span className={`font-body text-sm ${t.status === 'done' ? 'line-through text-coffee-cream' : 'text-library-ink'}`}>
                    {t.title}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Next 7 days */}
          <div className="cozy-card p-6 space-y-3">
            <h3 className="font-display text-lg text-yale-blue">
              On the Horizon <span className="font-body text-xs text-coffee-cream italic">(next 7 days)</span>
            </h3>
            {upcoming.length === 0 ? (
              <p className="font-body text-sm text-coffee-cream italic py-4 text-center">
                No deadlines ahead. Enjoy the quiet, or plan your week.
              </p>
            ) : (
              upcoming.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-page-cream border border-coffee-cream/20 rounded-sm p-3">
                  <span className="font-body text-sm text-library-ink">{t.title}</span>
                  <span className="font-label text-[0.6rem] uppercase tracking-wider text-maple-rust shrink-0 ml-3">
                    {daysUntil(t.due_date) === 1 ? 'tomorrow' : `in ${daysUntil(t.due_date)} days`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}