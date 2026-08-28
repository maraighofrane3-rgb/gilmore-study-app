import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircle, Award, Timer, Hourglass, Compass, Map, 
  BookOpen, Library, Trophy, Lock, Sparkles, AlertCircle
} from 'lucide-react';

const iconMap = {
  CheckCircle, Award, Timer, Hourglass, Compass, Map, BookOpen, Library, Trophy
};

export default function Achievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [counts, setCounts] = useState({ tasks: 0, focus: 0, rabbitHoles: 0, books: 0 });
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null); // ✅ Pour afficher les erreurs

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const debug = { steps: [], errors: [] };

    try {
      // 1. Get all achievements
      const { data: allAchievements, error: achErr } = await supabase
        .from('achievements')
        .select('*');
      
      debug.steps.push(`achievements: ${allAchievements?.length || 0} rows`);
      if (achErr) {
        debug.errors.push(`achievements: ${achErr.message}`);
        console.error('ACH ERROR:', achErr);
      }
      
      // 2. Get unlocked achievements
      const { data: unlocked, error: unErr } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);
      
      debug.steps.push(`unlocked: ${unlocked?.length || 0} rows`);
      if (unErr) {
        debug.errors.push(`unlocked: ${unErr.message}`);
        console.error('UNLOCK ERROR:', unErr);
      }
      
      // 3. Get counts (SANS head:true qui pose problème)
      const [tasksRes, focusRes, rabbitRes, booksRes] = await Promise.all([
        supabase.from('tasks').select('id').eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('focus_sessions').select('id').eq('user_id', user.id).eq('completed', true),
        supabase.from('rabbit_holes').select('id').eq('user_id', user.id),
        supabase.from('books').select('id').eq('user_id', user.id)
      ]);

      const countsData = {
        tasks: tasksRes.data?.length || 0,
        focus: focusRes.data?.length || 0,
        rabbitHoles: rabbitRes.data?.length || 0,
        books: booksRes.data?.length || 0
      };
      
      debug.steps.push(`counts: ${JSON.stringify(countsData)}`);
      if (tasksRes.error) debug.errors.push(`tasks: ${tasksRes.error.message}`);
      if (focusRes.error) debug.errors.push(`focus: ${focusRes.error.message}`);
      if (rabbitRes.error) debug.errors.push(`rabbit: ${rabbitRes.error.message}`);
      if (booksRes.error) debug.errors.push(`books: ${booksRes.error.message}`);

      setAchievements(allAchievements || []);
      setUnlockedIds(unlocked?.map(a => a.achievement_id) || []);
      setCounts(countsData);
      setDebugInfo(debug);
    } catch (err) {
      console.error('Error fetching achievements:', err);
      setDebugInfo({ steps: [], errors: [err.message] });
    }
    setLoading(false);
  };

  const unlockAchievement = async (achievement) => {
    if (unlockedIds.includes(achievement.id)) return;

    const { error } = await supabase
      .from('user_achievements')
      .insert([{ user_id: user.id, achievement_id: achievement.id }]);

    if (!error) {
      setUnlockedIds([...unlockedIds, achievement.id]);
    } else {
      console.error('Unlock error:', error);
    }
  };

  const getProgress = (achievement) => {
    if (achievement.category === 'Tasks') return counts.tasks;
    if (achievement.category === 'Focus') return counts.focus;
    if (achievement.category === 'Rabbit Holes') return counts.rabbitHoles;
    if (achievement.category === 'Library') return counts.books;
    return 0;
  };

  const IconComponent = ({ name, size = 24, className }) => {
    const Icon = iconMap[name] || Trophy;
    return <Icon size={size} className={className} />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <p className="eyebrow mb-2">Your Journey</p>
        <h1 className="font-display text-4xl text-yale-blue">
          <span className="italic text-maple-rust">Achievements</span>.
        </h1>
        <p className="font-body text-coffee-cream mt-2">
          Milestones unlocked on your path of knowledge.
        </p>
      </div>

      {/* ✅ Debug panel visible only if there's an issue */}
      {debugInfo && debugInfo.errors.length > 0 && (
        <div className="bg-maple-rust/10 border border-maple-rust rounded-sm p-4">
          <h3 className="font-display text-maple-rust flex items-center gap-2 mb-2">
            <AlertCircle size={18} /> Debug Info
          </h3>
          <p className="font-body text-sm text-library-ink mb-2">
            <strong>Steps:</strong> {debugInfo.steps.join(' | ')}
          </p>
          <p className="font-body text-sm text-maple-rust">
            <strong>Errors:</strong> {debugInfo.errors.join(' | ')}
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-center text-coffee-cream italic py-10">Cataloging your honors...</p>
      ) : achievements.length === 0 ? (
        <div className="text-center text-coffee-cream italic py-10 bg-parchment/50 rounded-sm border border-coffee-cream/20">
          <Trophy size={48} className="mx-auto mb-3 opacity-30" />
          <p>No achievements found. Check the debug info above if visible.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {achievements.map((achievement, idx) => {
            const isUnlocked = unlockedIds.includes(achievement.id);
            const currentProgress = getProgress(achievement);
            const progressPercent = Math.min(100, (currentProgress / achievement.requirement_count) * 100);

            return (
              <div
                key={achievement.id}
                className={`relative p-6 rounded-sm border shadow-cozy transition-all animate-fade-in-up ${
                  isUnlocked 
                    ? 'bg-parchment border-gilmore-gold/50' 
                    : 'bg-parchment/50 border-coffee-cream/20 opacity-80'
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-full ${isUnlocked ? 'bg-gilmore-gold/20' : 'bg-coffee-cream/10'}`}>
                    <IconComponent 
                      name={achievement.icon_name} 
                      size={28} 
                      className={isUnlocked ? 'text-gilmore-gold' : 'text-coffee-cream/50'} 
                    />
                  </div>
                  {isUnlocked && (
                    <Sparkles size={16} className="text-gilmore-gold animate-pulse" />
                  )}
                </div>

                <h3 className={`font-display text-xl mb-1 ${isUnlocked ? 'text-yale-blue' : 'text-coffee-cream'}`}>
                  {achievement.title}
                </h3>
                <p className="font-body text-sm text-coffee-cream mb-4">
                  {achievement.description}
                </p>

                <div className="mt-auto">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
                      Progress
                    </span>
                    <span className="font-body text-xs text-library-ink font-bold">
                      {currentProgress} / {achievement.requirement_count}
                    </span>
                  </div>
                  <div className="w-full bg-coffee-cream/20 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        isUnlocked ? 'bg-gilmore-gold' : 'bg-maple-rust'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {!isUnlocked && currentProgress >= achievement.requirement_count && (
                  <button
                    onClick={() => unlockAchievement(achievement)}
                    className="absolute bottom-6 right-6 bg-maple-rust text-page-cream px-3 py-1.5 rounded-sm font-label text-[0.6rem] uppercase tracking-wider hover:bg-yale-blue transition-all flex items-center gap-1"
                  >
                    <Trophy size={12} /> Claim
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}