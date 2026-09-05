import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import DailyCoach from '../components/DailyCoach';
import WeeklyChronicleModal from '../components/WeeklyChronicleModal';
import { requestNotificationPermission, sendNotification, MESSAGES } from '../lib/notifications';
import {
  Play, Plus, PenLine, Upload, CheckCircle, Circle,
  CalendarDays, ChevronRight, Mail,
} from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ☕ Tiny animated coffee for the greeting
function MiniCoffee() {
  return (
    <span className="inline-block align-baseline ml-2 transition-transform hover:-rotate-6" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 40 40">
        {/* steam */}
        <g stroke="#C89B7B" strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path className="steam" d="M15 14c-2-3 2-4 0-8" />
          <path className="steam steam-2" d="M22 13c-2-3 2-4 0-8" />
        </g>
        {/* cup */}
        <path d="M8 17h22c0 8-5 13-11 13S8 25 8 17z" fill="#B4552D" />
        <path d="M30 19c4-1 6 2 5 5s-4 4-7 4" fill="none" stroke="#A0522D" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="19" cy="17" rx="11" ry="3" fill="#E8DCC3" />
        <ellipse cx="19" cy="17" rx="8.5" ry="2" fill="#3B2314" />
        {/* saucer */}
        <ellipse cx="19" cy="32" rx="14" ry="3" fill="#F0EAD8" />
      </svg>
    </span>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { isRunning, timeLeft, durationMin, completedAt } = useFocusTimer();
  const [tasks, setTasks] = useState([]);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [goalHours, setGoalHours] = useState(6);
  const [loading, setLoading] = useState(true);
  
  // ✅ Fixed: Call the function instead of passing the reference
  const greeting = getGreeting(); 
  const [isChronicleOpen, setIsChronicleOpen] = useState(false);

  const today = new Date();
  const todayKey = keyOf(today);

    useEffect(() => {
    if (!user) return;
    let mounted = true;
    
    const loadData = async () => {
      // ✅ Added books and goals to the Promise.all
      const [tasksRes, sessionsRes, profileRes, booksRes, goalsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('pomodoro_sessions').select('duration').eq('user_id', user.id).eq('completed', true).gte('created_at', `${todayKey}T00:00:00`),
        supabase.from('profiles').select('daily_goal_hours').eq('id', user.id).maybeSingle(),
        supabase.from('books').select('*').eq('user_id', user.id).eq('status', 'reading'),
        supabase.from('goals').select('*').eq('user_id', user.id).neq('status', 'completed')
      ]);
      
      if (!mounted) return;
      
      setTasks(tasksRes.data || []);
      setTodayMinutes((sessionsRes.data || []).reduce((s, r) => s + (r.duration || 0), 0));
      setGoalHours(profileRes.data?.daily_goal_hours || 6);
      
      // ✅ Trigger the reminder checks
      checkReminders(tasksRes.data || [], booksRes.data || [], goalsRes.data || []);
      
      setLoading(false);
    };
    
    loadData();
    return () => { mounted = false; };
  }, [user, todayKey, completedAt]);

    const checkReminders = (tasks, books, goals) => {
    if (Notification.permission !== "granted") {
      requestNotificationPermission();
      return;
    }

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    // 1. No tasks for today?
    const todayTasks = tasks.filter(t => t.due_date === todayKey);
    if (todayTasks.length === 0) {
      sendNotification(MESSAGES.noTasks.title, MESSAGES.noTasks.body);
    }

    // 2. Book not updated in 2 days?
    const stalledBooks = books.filter(b => {
      if (!b.updated_at) return true;
      return new Date(b.updated_at) < twoDaysAgo;
    });
    if (stalledBooks.length > 0) {
      sendNotification(MESSAGES.bookStall.title, MESSAGES.bookStall.body);
    }

    // 3. Goals not updated in 2 days?
    const stalledGoals = goals.filter(g => {
      if (!g.updated_at) return true;
      return new Date(g.updated_at) < twoDaysAgo;
    });
    if (stalledGoals.length > 0) {
      sendNotification(MESSAGES.goalStall.title, MESSAGES.goalStall.body);
    }
  };

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

  const goalMinutes = goalHours * 60;
  const liveSeconds = timeLeft < durationMin * 60 ? durationMin * 60 - timeLeft : 0;
  const totalSeconds = todayMinutes * 60 + liveSeconds;
  const pct = Math.min(1, goalMinutes ? totalSeconds / (goalMinutes * 60) : 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  const daysUntil = (key) =>
    Math.round((new Date(`${key}T00:00:00`) - new Date(`${todayKey}T00:00:00`)) / 86400000);

  const firstName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Scholar';

  if (loading) return <div className="text-center py-20 text-coffee-cream italic font-body">Loading your study space...</div>;

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
            <MiniCoffee />
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
          
          {/* 📜 Weekly Chronicle Card */}
          <div className="cozy-card p-6 flex flex-col justify-between group hover:border-maple-rust/50 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-maple-rust/10 rounded-sm text-maple-rust">
                <Mail size={20} />
              </div>
            </div>
            <div>
              <h3 className="font-display text-lg text-library-ink mb-1">Weekly Chronicle</h3>
              <p className="font-body text-sm text-coffee-cream mb-4">
                Receive a personalized letter from the Dean reflecting on your week's scholarly pursuits.
              </p>
              <button 
                onClick={() => setIsChronicleOpen(true)}
                className="w-full bg-yale-blue/5 border border-yale-blue/20 text-yale-blue px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue hover:text-page-cream transition-all"
              >
                Read the Letter
              </button>
            </div>
          </div>

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

      {/* ✅ Weekly Chronicle Modal */}
      <WeeklyChronicleModal 
        isOpen={isChronicleOpen} 
        onClose={() => setIsChronicleOpen(false)} 
      />
    </div>
  );
}