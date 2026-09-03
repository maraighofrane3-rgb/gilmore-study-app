import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  User, Flame, Trophy, BookOpen, ListChecks, Clock, PenLine,
  StickyNote, Target, TrendingUp, CalendarDays, Award, Timer, CheckCircle
} from 'lucide-react';
import { useScholarStats } from '../hooks/useScholarStats';

function formatMinutes(totalMin) {
  const totalSeconds = Math.round(totalMin * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function formatLong(totalMin) {
  const rounded = Math.round(totalMin);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m}m`;
}

export default function History() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [books, setBooks] = useState([]);
  const [writings, setWritings] = useState([]);
  const [notesCount, setNotesCount] = useState(0);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Live XP / level / streaks — computed from real sessions
  const { xp, level, currentStreak, bestStreak } = useScholarStats();

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [profileRes, sessionsRes, tasksRes, booksRes, writingsRes, notesRes, goalsRes] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).eq('completed', true),
          supabase.from('tasks').select('*').eq('user_id', user.id),
          supabase.from('books').select('*').eq('user_id', user.id),
          supabase.from('writings').select('*').eq('user_id', user.id),
          supabase.from('chapter_notes').select('id').eq('user_id', user.id),
          supabase.from('goals').select('*').eq('user_id', user.id),
        ]);

      setProfile(profileRes.data);
      setSessions(sessionsRes.data || []);
      setTasks(tasksRes.data || []);
      setBooks(booksRes.data || []);
      setWritings(writingsRes.data || []);
      setNotesCount(notesRes.data?.length ?? 0);
      setGoals(goalsRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <Timer size={32} className="animate-spin mx-auto text-coffee-cream mb-4" />
        <p className="font-body text-coffee-cream italic">Opening your scholar record...</p>
      </div>
    );
  }

  // ─── Computations ───────────────────────────────────────────
  const totalMinutes = sessions.reduce((s, r) => s + (r.duration || 0), 0);
  const avgSession = sessions.length ? Math.round(totalMinutes / sessions.length) : 0;

  const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'completed');
  const finishedBooks = books.filter((b) =>
    ['finished', 'completed', 'done', 'read'].includes((b.status || '').toLowerCase())
  );
  const completedGoals = goals.filter((g) =>
    ['completed', 'achieved', 'done'].includes((g.status || '').toLowerCase())
  );
  const totalWords = writings.reduce((s, w) => s + (w.word_count || 0), 0);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ranges = [[1, 7], [8, 14], [15, 21], [22, 28], [29, daysInMonth]];
  const weekBuckets = ranges.map(([from, to], i) => ({
    label: `W${i + 1}`,
    from, to,
    minutes: 0,
    isCurrent: now.getDate() >= from && now.getDate() <= to,
  }));
  sessions.forEach((s) => {
    const d = new Date(s.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const bucket = weekBuckets.find((w) => d.getDate() >= w.from && d.getDate() <= w.to);
      if (bucket) bucket.minutes += s.duration || 0;
    }
  });
  const maxWeekMinutes = Math.max(0, ...weekBuckets.map((w) => w.minutes));

  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  sessions.forEach((s) => { weekdayTotals[new Date(s.created_at).getDay()] += s.duration || 0; });
  const bestDayTotal = Math.max(...weekdayTotals);
  const bestDay = bestDayTotal > 0
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayTotals.indexOf(bestDayTotal)]
    : null;

  const recentDone = [...doneTasks]
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
    .slice(0, 5);

  const stats = [
    { icon: Clock, label: 'Total Focus Time', value: formatLong(totalMinutes) },
    { icon: Timer, label: 'Sessions Completed', value: sessions.length },
    { icon: TrendingUp, label: 'Avg Session', value: `${avgSession}m` },
    { icon: ListChecks, label: 'Tasks Done', value: `${doneTasks.length}/${tasks.length}` },
    { icon: BookOpen, label: 'Books Read', value: finishedBooks.length },
    { icon: PenLine, label: 'Writings', value: `${writings.length} · ${totalWords.toLocaleString()} words` },
    { icon: StickyNote, label: 'Notes Saved', value: notesCount },
    { icon: Target, label: 'Goals Achieved', value: `${completedGoals.length}/${goals.length}` },
  ];

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <p className="eyebrow mb-2">Scholar Record</p>
        <h1 className="font-display text-4xl text-yale-blue">
          The <span className="italic text-maple-rust">{profile?.username || 'Scholar'}</span> Archive.
        </h1>
      </div>

      {/* Profile banner */}
      <div className="cozy-card p-6 flex flex-wrap items-center gap-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-yale-blue/10">
          <User size={28} className="text-yale-blue" />
        </span>
        <div className="flex-1 min-w-[200px]">
          <h2 className="font-display text-2xl text-yale-blue">{profile?.username || 'Scholar'}</h2>
          <p className="font-body text-sm text-coffee-cream italic">
            {profile?.bio || 'A devoted student of Stars Hollow.'}
          </p>
          <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream mt-1">
            Member since{' '}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : '—'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {/* ✅ Level + XP — live from sessions */}
          <div className="text-center">
            <p className="font-display text-2xl text-gilmore-gold">Lv {level}</p>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">{xp} XP</p>
          </div>
          {/* ✅ Current streak — live */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Flame size={18} className="text-maple-rust" />
              <span className="font-display text-2xl text-yale-blue">{currentStreak}</span>
            </div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Current Streak</p>
          </div>
          {/* ✅ Best streak — live */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Trophy size={18} className="text-gilmore-gold" />
              <span className="font-display text-2xl text-yale-blue">{bestStreak}</span>
            </div>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Best Streak</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="cozy-card p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-porch-sage/15 mb-3">
              <Icon size={17} className="text-porch-sage" />
            </span>
            <p className="font-display text-xl text-yale-blue leading-none mb-1">{value}</p>
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">{label}</p>
          </div>
        ))}
      </div>

      {/* 📊 Weekly study time */}
      <div className="cozy-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-maple-rust" />
            <h3 className="font-display text-lg text-yale-blue">Study Time per Week — {monthName}</h3>
          </div>
          {bestDay && (
            <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream flex items-center gap-1">
              <Award size={14} className="text-gilmore-gold" /> Most productive: {bestDay}
            </p>
          )}
        </div>

        <div className="flex items-end gap-4 sm:gap-6 h-48 px-1">
          {weekBuckets.map((w, i) => {
            const heightPct =
              maxWeekMinutes > 0 ? Math.max(4, (w.minutes / maxWeekMinutes) * 100) : 4;

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                <span
                  className={`font-label text-[0.6rem] mb-2 tabular-nums ${
                    w.isCurrent ? 'text-maple-rust font-semibold' : 'text-coffee-cream'
                  }`}
                >
                  {formatMinutes(w.minutes)}
                </span>
                <div
                  title={`${w.label} — ${formatMinutes(w.minutes)}`}
                  className={`w-full max-w-[52px] rounded-t-sm transition-all duration-500 ease-out ${
                    w.isCurrent ? 'bg-gilmore-gold' : 'bg-maple-rust/75 group-hover:bg-maple-rust'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 sm:gap-6 px-1 pt-3 border-t border-coffee-cream/20">
          {weekBuckets.map((w, i) => (
            <span
              key={i}
              className={`flex-1 text-center font-label text-[0.6rem] uppercase tracking-wider-label ${
                w.isCurrent ? 'text-maple-rust font-semibold' : 'text-coffee-cream'
              }`}
            >
              {w.label}
            </span>
          ))}
        </div>
      </div>

      {/* Lists: tasks done + books read */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="cozy-card p-6 space-y-3">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <CheckCircle size={18} className="text-porch-sage" /> Recently Completed Tasks
          </h3>
          {recentDone.length === 0 ? (
            <p className="font-body text-sm text-coffee-cream italic py-4 text-center">No completed tasks yet.</p>
          ) : (
            recentDone.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-page-cream border border-coffee-cream/20 rounded-sm p-3">
                <span className="font-body text-sm text-library-ink">{t.title}</span>
                {t.category && (
                  <span className="font-label text-[0.6rem] uppercase tracking-wider text-porch-sage">{t.category}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="cozy-card p-6 space-y-3">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <BookOpen size={18} className="text-maple-rust" /> Books You've Read
          </h3>
          {finishedBooks.length === 0 ? (
            <p className="font-body text-sm text-coffee-cream italic py-4 text-center">No finished books yet — the library awaits.</p>
          ) : (
            finishedBooks.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-page-cream border border-coffee-cream/20 rounded-sm p-3">
                <span className="font-body text-sm text-library-ink italic">{b.title}</span>
                {b.author && <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">{b.author}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}