import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Lock, Palette, Clock, Save, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { requestNotificationPermission, sendNotification, MESSAGES } from '../lib/notifications';

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'productivity', label: 'Productivity', icon: Clock },
];

const THEMES = [
  { id: 'paper', label: 'Paper', tagline: 'Stars Hollow, autumn afternoon', swatch: ['#F3EAD8', '#132A44', '#A13D2B', '#C9A227'] },
  { id: 'midnight', label: 'Midnight', tagline: 'Reading under the blanket', swatch: ['#171B26', '#F5E6C8', '#E08659', '#D9B15C'] },
  { id: 'library', label: 'Library', tagline: 'Green lamp, worn leather chairs', swatch: ['#16211C', '#F0E4C4', '#C77B4D', '#C9A227'] },
  { id: 'cream', label: 'Cream', tagline: 'Sunlit morning at the counter', swatch: ['#FBF6EC', '#2F4F63', '#B85C3E', '#D4B15C'] },
  { id: 'harvard', label: 'Harvard', tagline: 'Crimson ink on ivory pages', swatch: ['#F7F2E9', '#7D1128', '#A51C30', '#A9822E'] },
];

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // ✅ États pour la suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ✅ Fixed: Added missing comma and notifications_enabled
  const [profile, setProfile] = useState({
    username: '', bio: '', theme: 'paper',
    default_pomodoro_duration: 25, default_daily_goal_hours: 2, 
    email_notifications: true,
    notifications_enabled: true
  });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile({
        username: data.username || '',
        bio: data.bio || '',
        theme: data.theme || 'paper',
        default_pomodoro_duration: data.default_pomodoro_duration || 25,
        default_daily_goal_hours: data.default_daily_goal_hours || 2,
        email_notifications: data.email_notifications !== false,
        notifications_enabled: data.notifications_enabled !== false // ✅ Added
      });
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
    }
    setSaving(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: passwordData.password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setPasswordData({ password: '', confirmPassword: '' });
    }
    setSaving(false);
  };

  // ✅ Suppression du compte via Edge Function
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      
      await supabase.auth.signOut();
      window.location.href = '/'; // Redirection propre vers l'accueil
    } catch (err) {
      console.error('Error deleting account:', err);
      setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePickTheme = (id) => {
    setTheme(id);
    setProfile(prev => ({ ...prev, theme: id }));
  };

  if (loading) return <div className="text-center py-20 text-coffee-cream italic font-body">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <p className="eyebrow mb-2">Customize Your Study</p>
        <h1 className="font-display text-4xl text-yale-blue">
          <span className="italic text-maple-rust">Settings</span>.
        </h1>
      </div>

      {message.text && (
        <div className={`p-4 rounded-sm border flex items-center gap-2 font-label text-xs ${
          message.type === 'success' ? 'bg-porch-sage/10 border-porch-sage/30 text-porch-sage' : 'bg-maple-rust/10 border-maple-rust/30 text-maple-rust'
        }`}>
          <CheckCircle size={16} /> {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="md:w-48 shrink-0">
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMessage({ type: '', text: '' }); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm font-body text-sm transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-yale-blue text-page-cream'
                      : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
                  }`}
                >
                  <Icon size={18} /> {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy">

          {activeTab === 'account' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <h2 className="font-display text-2xl text-yale-blue mb-4">Profile Information</h2>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-1.5">Username</label>
                  <input
                    type="text" value={profile.username}
                    onChange={e => setProfile({...profile, username: e.target.value})}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-1.5">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile({...profile, bio: e.target.value})}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body h-24 resize-none transition-colors"
                    placeholder="Tell the world about your academic journey..."
                  />
                </div>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-1.5">Email</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full p-3 bg-parchment/50 border border-coffee-cream/10 rounded-sm font-body text-coffee-cream/50 cursor-not-allowed" />
                </div>
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-colors disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>

              {/* 🚨 DANGER ZONE */}
              <div className="mt-12 pt-8 border-t border-coffee-cream/20">
                <h3 className="font-display text-xl text-maple-rust flex items-center gap-2 mb-2">
                  <AlertTriangle size={20} /> Danger Zone
                </h3>
                <p className="font-body text-sm text-coffee-cream/80 mb-4">
                  Once you delete your account, there is no going back. All your books, notes, goals, and focus sessions will be permanently erased from the library.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 bg-maple-rust/10 border border-maple-rust/30 text-maple-rust px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all"
                >
                  <Trash2 size={14} />
                  Delete my account permanently
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-4">Privacy & Security</h2>
              
              {/* ✅ Email Notifications Toggle */}
              <div className="flex items-center justify-between p-4 bg-parchment rounded-sm border border-coffee-cream/10">
                <div>
                  <h3 className="font-body text-library-ink font-medium">Email Notifications</h3>
                  <p className="font-label text-[0.65rem] text-coffee-cream mt-1">
                    Receive weekly summaries and goal reminders.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.email_notifications}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      setProfile(prev => ({ ...prev, email_notifications: newValue }));
                      const { error } = await supabase.from('profiles').update({ email_notifications: newValue }).eq('id', user.id);
                      if (error) {
                        setProfile(prev => ({ ...prev, email_notifications: !newValue }));
                        setMessage({ type: 'error', text: 'Failed to update preferences.' });
                      } else {
                        setMessage({ type: 'success', text: 'Preferences saved.' });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-coffee-cream/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-page-cream after:border-coffee-cream/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maple-rust"></div>
                </label>
              </div>

              {/* ✅ OS Study Reminders Toggle */}
              <div className="flex items-center justify-between p-4 bg-parchment rounded-sm border border-coffee-cream/10">
                <div>
                  <h3 className="font-body text-library-ink font-medium">Study Reminders</h3>
                  <p className="font-label text-[0.65rem] text-coffee-cream mt-1">
                    Get OS alerts for tasks, books, and goals.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.notifications_enabled}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      if (newValue) {
                        const granted = await requestNotificationPermission();
                        if (!granted) {
                          setMessage({ type: 'error', text: 'Notification permission denied by browser.' });
                          return;
                        }
                      }
                      setProfile(prev => ({ ...prev, notifications_enabled: newValue }));
                      const { error } = await supabase.from('profiles').update({ notifications_enabled: newValue }).eq('id', user.id);
                      if (error) {
                        setProfile(prev => ({ ...prev, notifications_enabled: !newValue }));
                        setMessage({ type: 'error', text: 'Failed to update preferences.' });
                      } else {
                        setMessage({ type: 'success', text: 'Preferences saved.' });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-coffee-cream/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-page-cream after:border-coffee-cream/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maple-rust"></div>
                </label>
              </div>

              <form onSubmit={handleChangePassword} className="pt-6 border-t border-coffee-cream/20 space-y-4">
                <h3 className="font-display text-xl text-yale-blue">Change Password</h3>
                <input
                  type="password" required placeholder="New Password" value={passwordData.password}
                  onChange={e => setPasswordData({...passwordData, password: e.target.value})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
                <input
                  type="password" required placeholder="Confirm New Password" value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-yale-blue text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-colors disabled:opacity-50">
                  <Lock size={16} /> Update Password
                </button>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-1">Appearance</h2>
              <p className="font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-3">
                Select a theme
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTheme(t.id)}
                    className={`relative text-left p-4 rounded-sm border transition-all ${
                      theme === t.id
                        ? 'border-maple-rust shadow-cozy'
                        : 'border-coffee-cream/20 hover:border-maple-rust/40'
                    }`}
                    style={{ backgroundColor: t.swatch[0] }}
                  >
                    {theme === t.id && (
                      <CheckCircle size={16} className="absolute top-3 right-3" style={{ color: t.swatch[2] }} />
                    )}
                    <div className="flex gap-1.5 mb-4">
                      {t.swatch.slice(1).map((c, i) => (
                        <span key={i} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="font-display text-base" style={{ color: t.swatch[1] }}>{t.label}</p>
                    <p className="font-body text-xs italic mt-0.5 opacity-70" style={{ color: t.swatch[1] }}>{t.tagline}</p>
                  </button>
                ))}
              </div>

              <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-colors disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {activeTab === 'productivity' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-4">Productivity Defaults</h2>
              <div>
                <label className="block font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-1.5">Default Pomodoro Duration (minutes)</label>
                <input
                  type="number" min="5" max="120" value={profile.default_pomodoro_duration}
                  onChange={e => setProfile({...profile, default_pomodoro_duration: parseInt(e.target.value)})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
              </div>
              <div>
                <label className="block font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mb-1.5">Default Daily Focus Goal (hours)</label>
                <input
                  type="number" min="0.5" max="24" step="0.5" value={profile.default_daily_goal_hours}
                  onChange={e => setProfile({...profile, default_daily_goal_hours: parseFloat(e.target.value)})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-colors disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving...' : 'Save Defaults'}
              </button>
            </form>
          )}

        </div>
      </div>

      {/* ✅ Modal de confirmation pour la suppression */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Are you absolutely sure?"
        message={
          <p className="font-body text-sm text-library-ink">
            This action cannot be undone. This will permanently delete your account, along with all your <span className="italic font-semibold">books, notes, projects, and focus history</span>.
          </p>
        }
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={isDeleting ? "Deleting..." : "Yes, delete everything"}
        cancelText="Keep my account"
      />
    </div>
  );
}