import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Clock, ListChecks, ArrowRight, Target, Flame, Trophy } from 'lucide-react';
import DailyCoach from '../components/DailyCoach';

// ⚠️ Vérifie bien le chemin : si le fichier est dans src/components/, laisse '../components/MonthlyStudySeries'.
// S'il est directement dans src/, remplace par '../MonthlyStudySeries'.
import MonthlyStudySeries from '../components/Monthlystudyseries';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [pendingTasks, setPendingTasks] = useState(0);
  const [todayFocus, setTodayFocus] = useState(0);
  const [goals, setGoals] = useState([]);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [studyLog, setStudyLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [greeting] = useState(getGreeting);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().split('T')[0];

      const [tasksResult, focusResult, goalsResult, streakResult, monthlyFocusResult] = await Promise.all([
        supabase.from('tasks').select('id').eq('user_id', user.id).eq('status', 'todo'),
        
        supabase
          .from('pomodoro_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('created_at', `${today}T00:00:00`),
          
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(4),
          
        supabase
          .from('profiles')
          .select('current_streak, best_streak')
          .eq('id', user.id)
          .maybeSingle(), // ✅ Évite le crash si le profil n'existe pas encore
          
        supabase
          .from('pomodoro_sessions')
          .select('created_at, duration') // ✅ Utilise la vraie colonne 'duration'
          .eq('user_id', user.id)
          .eq('completed', true)
          .gte('created_at', `${thirtyDaysAgoISO}T00:00:00`),
      ]);

      if (!isMounted) return;

      if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
      if (focusResult.error) console.error('Error fetching focus sessions:', focusResult.error);
      if (goalsResult.error) console.error('Error fetching goals:', goalsResult.error);
      if (streakResult.error) console.error('Error fetching streak:', streakResult.error);
      if (monthlyFocusResult.error) console.error('Error fetching monthly focus:', monthlyFocusResult.error);

      setPendingTasks(tasksResult.data?.length ?? 0);
      setTodayFocus(focusResult.data?.length ?? 0);
      setGoals(goalsResult.data ?? []);
      setStreak({
        current: streakResult.data?.current_streak ?? 0,
        best: streakResult.data?.best_streak ?? 0,
      });

      // Agrège les minutes par jour pour le graphique
      const minutesByDay = {};
      (monthlyFocusResult.data ?? []).forEach((session) => {
        const day = session.created_at.split('T')[0];
        minutesByDay[day] = (minutesByDay[day] || 0) + (session.duration || 0);
      });
      
      setStudyLog(
        Object.entries(minutesByDay).map(([date, minutes]) => ({ date, minutes }))
      );

      setLoading(false);
    };

    fetchData();
    return () => { isMounted = false; };
  }, [user]);

  const firstName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Scholar';

  const stats = [
    { icon: Clock, label: "Today's Focus", value: todayFocus, unit: 'sessions completed', to: '/focus' },
    { icon: ListChecks, label: 'Tasks', value: pendingTasks, unit: 'pending', to: '/tasks' },
    { icon: Target, label: 'Goals', value: goals.length, unit: 'active goals', to: '/goals' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="eyebrow mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-3xl text-yale-blue">
            {greeting}, <span className="italic text-maple-rust">{firstName}</span>.
          </h1>
        </div>
        <button
          onClick={signOut}
          className="border border-maple-rust text-maple-rust px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust hover:text-page-cream transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* Daily Coach */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <DailyCoach />
      </div>

      {/* Corps : colonne gauche empilée + graphique à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex flex-col gap-4">
          {/* Streak */}
          <div className="cozy-card p-5 flex items-center justify-between">
            <div>
              <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mb-2">
                Current Streak
              </p>
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-maple-rust" />
                <span className="font-display text-2xl text-yale-blue">{streak.current}</span>
                <span className="font-body text-sm text-coffee-cream">day{streak.current !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mb-2">
                Personal Best
              </p>
              <div className="flex items-center justify-end gap-2">
                <span className="font-display text-2xl text-gilmore-gold">{streak.best}</span>
                <Trophy size={18} className="text-gilmore-gold" />
              </div>
            </div>
          </div>

          {/* Stats empilées */}
          {stats.map(({ icon: Icon, label, value, unit, to }) => (
            <Link
              to={to}
              key={label}
              className="cozy-card p-5 flex items-center gap-4 hover:border-maple-rust/40 group"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-porch-sage/15">
                <Icon size={18} className="text-porch-sage" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mb-0.5">
                  {label}
                </p>
                {loading ? (
                  <div className="h-7 w-10 rounded-sm bg-coffee-cream/15 animate-pulse" />
                ) : (
                  <p className="font-display text-2xl text-yale-blue leading-none">{value}</p>
                )}
                <p className="font-body text-xs text-coffee-cream mt-1">{unit}</p>
              </div>
              <ArrowRight size={16} className="text-maple-rust/60 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>

        {/* Séries d'étude du mois */}
        <div className="lg:col-span-2">
          <MonthlyStudySeries data={studyLog} />
        </div>
      </div>
    </div>
  );
}