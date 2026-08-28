import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User, BookOpen, Target, Clock, Trophy, Save } from 'lucide-react';

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalPomodoros: 0,
    totalBooks: 0,
    activeGoals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ username: '', bio: '' });

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error) {
      setProfile(data);
      setFormData({ username: data.username || '', bio: data.bio || '' });
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    // Total Tasks
    const { count: totalTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: completedTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    // Total Pomodoros
    const { count: totalPomodoros } = await supabase
      .from('pomodoro_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Total Books
    const { count: totalBooks } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Active Goals
    const { count: activeGoals } = await supabase
      .from('goals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');

    setStats({
      totalTasks: totalTasks || 0,
      completedTasks: completedTasks || 0,
      totalPomodoros: totalPomodoros || 0,
      totalBooks: totalBooks || 0,
      activeGoals: activeGoals || 0,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .update({ username: formData.username, bio: formData.bio })
      .eq('id', user.id);

    if (!error) {
      setEditing(false);
      fetchProfile();
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-coffee-cream italic">Loading your profile...</div>;
  }

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <p className="eyebrow mb-2">Your Journey</p>
          <h1 className="font-display text-4xl text-yale-blue">
            Profile & <span className="italic text-maple-rust">Statistics</span>.
          </h1>
        </div>
        <button
          onClick={signOut}
          className="border border-maple-rust text-maple-rust px-4 py-2 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust hover:text-page-cream transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-yale-blue rounded-full flex items-center justify-center text-page-cream shrink-0">
            <User size={40} />
          </div>
          <div className="flex-1">
            {!editing ? (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-display text-3xl text-yale-blue mb-1">
                      {profile?.username || 'Scholar'}
                    </h2>
                    <p className="text-coffee-cream text-sm font-ui">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-maple-rust font-ui text-xs uppercase tracking-widest hover:underline"
                  >
                    Edit Profile
                  </button>
                </div>
                {profile?.bio && (
                  <p className="font-body text-library-ink mt-4 italic">{profile.bio}</p>
                )}
              </>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
                  />
                </div>
                <div>
                  <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body h-24 resize-none"
                    placeholder="Tell us about your academic journey..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-yale-blue transition-colors"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-6 py-2.5 border border-coffee-cream/30 rounded-sm font-ui text-xs uppercase tracking-widest text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="text-porch-sage" size={24} />
            <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Books</h3>
          </div>
          <p className="font-display text-4xl text-yale-blue">{stats.totalBooks}</p>
          <p className="text-xs text-coffee-cream mt-1">in your library</p>
        </div>

        <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="text-porch-sage" size={24} />
            <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Focus</h3>
          </div>
          <p className="font-display text-4xl text-yale-blue">{stats.totalPomodoros}</p>
          <p className="text-xs text-coffee-cream mt-1">pomodoro sessions</p>
        </div>

        <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-3 mb-3">
            <Target className="text-porch-sage" size={24} />
            <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Goals</h3>
          </div>
          <p className="font-display text-4xl text-yale-blue">{stats.activeGoals}</p>
          <p className="text-xs text-coffee-cream mt-1">active syllabi</p>
        </div>

        <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy md:col-span-3">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="text-maple-rust" size={24} />
            <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Task Completion</h3>
          </div>
          <div className="flex items-end gap-4">
            <p className="font-display text-4xl text-yale-blue">{completionRate}%</p>
            <p className="text-sm text-coffee-cream mb-1">
              {stats.completedTasks} of {stats.totalTasks} tasks completed
            </p>
          </div>
          <div className="w-full h-3 bg-parchment rounded-full overflow-hidden mt-3 border border-coffee-cream/10">
            <div
              className="h-full bg-gradient-to-r from-maple-rust to-yale-blue transition-all duration-1000"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
