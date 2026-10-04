import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Lock, Palette, Clock, Save, CheckCircle, AlertTriangle, Trash2, Bell } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { requestNotificationPermission, sendNotification, MESSAGES } from '../lib/notifications';
import { ensureReminderRow, requestBrowserNotifications } from '../utils/reminders';

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'reminders', label: 'Reminders', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

// ✅ 1. Added 'custom' to the themes array
const THEMES = [
  { id: 'paper', label: 'Paper', tagline: 'Stars Hollow, autumn afternoon', swatch: ['#F3EAD8', '#132A44', '#A13D2B', '#C9A227'] },
  { id: 'midnight', label: 'Midnight', tagline: 'Reading under the blanket', swatch: ['#171B26', '#F5E6C8', '#E08659', '#D9B15C'] },
  { id: 'library', label: 'Library', tagline: 'Green lamp, worn leather chairs', swatch: ['#16211C', '#F0E4C4', '#C77B4D', '#C9A227'] },
  { id: 'cream', label: 'Cream', tagline: 'Sunlit morning at the counter', swatch: ['#FBF6EC', '#2F4F63', '#B85C3E', '#D4B15C'] },
  { id: 'harvard', label: 'Harvard', tagline: 'Crimson ink on ivory pages', swatch: ['#F7F2E9', '#7D1128', '#A51C30', '#A9822E'] },
  { id: 'vampire', label: 'Vampire', tagline: 'Bordeaux ink on midnight vellum', swatch: ['#121114', '#C6B3A0', '#8F2A3A', '#611220'] },
  { id: 'custom', label: 'Custom', tagline: 'Your own palette', swatch: ['#F3EAD8', '#132A44', '#A13D2B', '#C9A227'] },
];

export default function Settings() {
  const { user } = useAuth();
  // ✅ 2. Destructure customColors and setCustomColors
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [profile, setProfile] = useState({
    username: '', bio: '', theme: 'paper',
    default_pomodoro_duration: 25, default_daily_goal_hours: 2, 
    email_notifications: true,
    notifications_enabled: true
  });

  // 🔔 Reminder settings state
  const [remEnabled, setRemEnabled] = useState(true);
  const [remEmail, setRemEmail] = useState(true);
  const [remBrowser, setRemBrowser] = useState(false);
  const [remWake, setRemWake] = useState(9);
  const [remSleep, setRemSleep] = useState(21);

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
        notifications_enabled: data.notifications_enabled !== false
      });
    }

    // 🔔 Fetch reminder settings
    const { data: remData } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (remData) {
      setRemEnabled(remData.enabled);
      setRemEmail(remData.email_notifications);
      setRemBrowser(remData.browser_notifications);
      setRemWake(remData.wake_hour || 9);
      setRemSleep(remData.sleep_hour || 21);
    } else {
      // Create the row if it doesn't exist
      await ensureReminderRow();
    }

    setLoading(false);
  };

    const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const updates = {
      username: profile.username,
      bio: profile.bio,
      theme: profile.theme,
      default_pomodoro_duration: parseInt(profile.default_pomodoro_duration) || 25,
      default_daily_goal_hours: parseFloat(profile.default_daily_goal_hours) || 2,
      email_notifications: profile.email_notifications,
      notifications_enabled: profile.notifications_enabled,
      updated_at: new Date().toISOString()
    };

    // ✅ Sync custom colors to DB if 'custom' theme is active
    if (profile.theme === 'custom') {
      updates.custom_theme = customColors;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully across all your devices.' });
    }
    setSaving(false);
  };

  const saveReminderSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    const offset = -Math.round(new Date().getTimezoneOffset() / 60);
    const { error } = await supabase.from('reminder_settings').upsert({
      user_id: user.id,
      enabled: remEnabled,
      email_notifications: remEmail,
      browser_notifications: remBrowser,
      wake_hour: remWake,
      sleep_hour: remSleep,
      tz_offset: offset,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      setMessage({ type: 'error', text: `Failed to save reminders: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Reminder settings saved! You\'ll receive emails every 3 hours during your waking window.' });
    }
    setSaving(false);
  };

  const enableBrowserNotifs = async () => {
    const ok = await requestBrowserNotifications();
    if (ok) {
      setRemBrowser(true);
      setMessage({ type: 'success', text: 'Browser notifications enabled! You\'ll see local reminders while the app is open.' });
    } else {
      setMessage({ type: 'error', text: 'Permission denied. Enable notifications in your browser settings.' });
    }
  };

  const testReminder = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    const { error } = await supabase.functions.invoke('send-reminders', {
      body: { test: true, userId: user.id },
    });
    if (error) {
      setMessage({ type: 'error', text: `Test failed: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Test email sent! Check your inbox in the next minute.' });
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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Error deleting account:', err);
      setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handlePickTheme = async (id) => {
    setTheme(id);
    setProfile(prev => ({ ...prev, theme: id }));
    
    const { error } = await supabase
      .from('profiles')
      .update({ theme: id })
      .eq('id', user.id);
      
    if (error) {
      console.error('Failed to save theme to database:', error);
    }
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
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />} 
          {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
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

        <div className="flex-1 bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy">
          {activeTab === 'account' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <h2 className="font-display text-2xl text-yale-blue mb-4">Profile Information</h2>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Username</label>
                  <input
                    type="text" value={profile.username}
                    onChange={e => setProfile({...profile, username: e.target.value})}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile({...profile, bio: e.target.value})}
                    className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body h-24 resize-none transition-colors"
                    placeholder="Tell the world about your academic journey..."
                  />
                </div>
                <div>
                  <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Email</label>
                  <input type="email" value={user?.email || ''} disabled className="w-full p-3 bg-parchment/50 border border-coffee-cream/10 rounded-sm font-body text-coffee-cream/50 cursor-not-allowed" />
                </div>
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors disabled:opacity-50">
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>

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

          {activeTab === 'reminders' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-4">Study Reminders</h2>
              <p className="font-body text-sm text-coffee-cream mb-6">
                Get nudged every 3 hours during your waking window to keep your streak alive and your tasks moving.
              </p>

              <div className="space-y-4">
                <label className="flex items-center gap-3 font-body text-sm text-library-ink">
                  <input 
                    type="checkbox" 
                    checked={remEnabled} 
                    onChange={(e) => setRemEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-coffee-cream/30 text-maple-rust focus:ring-maple-rust/25"
                  />
                  <span className="font-medium">Enable reminders</span>
                </label>

                <label className="flex items-center gap-3 font-body text-sm text-library-ink">
                  <input 
                    type="checkbox" 
                    checked={remEmail} 
                    onChange={(e) => setRemEmail(e.target.checked)}
                    disabled={!remEnabled}
                    className="w-4 h-4 rounded border-coffee-cream/30 text-maple-rust focus:ring-maple-rust/25 disabled:opacity-50"
                  />
                  <span>Email reminders</span>
                </label>

                <label className="flex items-center gap-3 font-body text-sm text-library-ink">
                  <input 
                    type="checkbox" 
                    checked={remBrowser} 
                    onChange={async (e) => {
                      if (e.target.checked) {
                        const ok = await requestBrowserNotifications();
                        if (ok) setRemBrowser(true);
                      } else {
                        setRemBrowser(false);
                      }
                    }}
                    disabled={!remEnabled}
                    className="w-4 h-4 rounded border-coffee-cream/30 text-maple-rust focus:ring-maple-rust/25 disabled:opacity-50"
                  />
                  <span>Browser notifications (while app is open)</span>
                </label>
              </div>

              <div className="pt-6 border-t border-coffee-cream/20">
                <h3 className="font-display text-lg text-yale-blue mb-3">Waking Hours</h3>
                <p className="font-body text-sm text-coffee-cream mb-4">
                  We won't ping you outside these hours (your local time):
                </p>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">From</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="23" 
                      value={remWake} 
                      onChange={(e) => setRemWake(+e.target.value)}
                      disabled={!remEnabled}
                      className="w-20 p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body disabled:opacity-50"
                    />
                    <span className="ml-2 font-body text-sm text-coffee-cream">:00</span>
                  </div>
                  <span className="text-coffee-cream mt-6">to</span>
                  <div>
                    <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Until</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="24" 
                      value={remSleep} 
                      onChange={(e) => setRemSleep(+e.target.value)}
                      disabled={!remEnabled}
                      className="w-20 p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body disabled:opacity-50"
                    />
                    <span className="ml-2 font-body text-sm text-coffee-cream">:00</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-6">
                <button 
                  onClick={saveReminderSettings} 
                  disabled={saving} 
                  className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors disabled:opacity-50"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Reminder Settings'}
                </button>
                <button 
                  onClick={enableBrowserNotifs} 
                  disabled={remBrowser}
                  className="flex items-center gap-2 border border-yale-blue text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue hover:text-page-cream transition-colors disabled:opacity-50"
                >
                  <Bell size={16} /> {remBrowser ? 'Browser Enabled' : 'Enable Browser Notifications'}
                </button>
                <button 
                  onClick={testReminder} 
                  disabled={saving}
                  className="flex items-center gap-2 border border-porch-sage text-porch-sage px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-porch-sage hover:text-page-cream transition-colors disabled:opacity-50"
                >
                  <Bell size={16} /> Send Test Email
                </button>
              </div>

              <div className="pt-6 border-t border-coffee-cream/20">
                <p className="font-body text-xs text-coffee-cream italic">
                  📬 Emails include your current streak, today's goal progress, and pending tasks. If you've already won the day (all tasks done + goal met), we skip the email.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-4">Privacy & Security</h2>
              
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
                      await supabase.from('reminder_settings').update({ email_notifications: newValue }).eq('user_id', user.id);
                      if (error) {
                        setProfile(prev => ({ ...prev, email_notifications: !newValue }));
                        setMessage({ type: 'error', text: 'Failed to update preferences.' });
                      } else {
                        setMessage({ type: 'success', text: newValue ? 'Email reminders ON.' : 'Email reminders OFF — the 3h emails will stop.' });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-coffee-cream/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-page-cream after:border-coffee-cream/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-maple-rust"></div>
                </label>
              </div>

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
                      await supabase.from('reminder_settings').update({ browser_notifications: newValue }).eq('user_id', user.id);
                      if (error) {
                        setProfile(prev => ({ ...prev, notifications_enabled: !newValue }));
                        setMessage({ type: 'error', text: 'Failed to update preferences.' });
                      } else {
                        setRemBrowser(newValue);
                        setMessage({ type: 'success', text: newValue ? 'OS alerts ON while the app is open.' : 'OS alerts OFF.' });
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
                <button type="submit" disabled={saving} className="flex items-center gap-2 bg-yale-blue text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors disabled:opacity-50">
                  <Lock size={16} /> Update Password
                </button>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-1">Appearance</h2>
              <p className="font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-3">
                Select a theme
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTheme(t.id)}
                    className={`relative text-left p-4 rounded-sm border transition-all ${
                      theme === t.id
                        ? 'border-maple-rust shadow-cozy ring-2 ring-maple-rust/20'
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

              {theme === 'custom' && (
  <div className="mt-6 p-6 rounded-sm border border-maple-rust/30 bg-parchment/50 space-y-5">
    <div>
      <h3 className="font-display text-xl text-yale-blue">Main Colors</h3>
      <p className="font-body text-sm text-coffee-cream mt-1">
        Core interface colors
      </p>
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
      <ColorPicker label="Background" value={customColors.bg} onChange={(v) => setCustomColors(prev => ({ ...prev, bg: v }))} />
      <ColorPicker label="Surface" value={customColors.surface} onChange={(v) => setCustomColors(prev => ({ ...prev, surface: v }))} />
      <ColorPicker label="Text" value={customColors.text} onChange={(v) => setCustomColors(prev => ({ ...prev, text: v }))} />
      <ColorPicker label="Heading" value={customColors.heading} onChange={(v) => setCustomColors(prev => ({ ...prev, heading: v }))} />
      <ColorPicker label="Accent" value={customColors.accent} onChange={(v) => setCustomColors(prev => ({ ...prev, accent: v }))} />
    </div>

    {/* ✅ Sidebar Colors Section */}
    <div className="pt-6 border-t border-coffee-cream/20">
      <h3 className="font-display text-lg text-yale-blue mb-3">Sidebar Colors</h3>
      <p className="font-body text-sm text-coffee-cream mb-4">
        Customize the navigation sidebar independently
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <ColorPicker label="Sidebar BG" value={customColors.sidebarBg} onChange={(v) => setCustomColors(prev => ({ ...prev, sidebarBg: v }))} />
        <ColorPicker label="Sidebar Text" value={customColors.sidebarText} onChange={(v) => setCustomColors(prev => ({ ...prev, sidebarText: v }))} />
        <ColorPicker label="Sidebar Muted" value={customColors.sidebarMuted} onChange={(v) => setCustomColors(prev => ({ ...prev, sidebarMuted: v }))} />
        <ColorPicker label="Sidebar Accent" value={customColors.sidebarAccent} onChange={(v) => setCustomColors(prev => ({ ...prev, sidebarAccent: v }))} />
      </div>
    </div>
  </div>
)}

              <button 
                onClick={handleSaveProfile} 
                disabled={saving} 
                className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {activeTab === 'productivity' && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <h2 className="font-display text-2xl text-yale-blue mb-4">Productivity Defaults</h2>
              <div>
                <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Default Pomodoro Duration (minutes)</label>
                <input
                  type="number" min="5" max="120" value={profile.default_pomodoro_duration}
                  onChange={e => setProfile({...profile, default_pomodoro_duration: parseInt(e.target.value)})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
              </div>
              <div>
                <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1.5">Default Daily Focus Goal (hours)</label>
                <input
                  type="number" min="0.5" max="24" step="0.5" value={profile.default_daily_goal_hours}
                  onChange={e => setProfile({...profile, default_daily_goal_hours: parseFloat(e.target.value)})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
                />
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors disabled:opacity-50">
                <Save size={16} /> {saving ? 'Saving...' : 'Save Defaults'}
              </button>
            </form>
          )}
        </div>
      </div>

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

// ✅ 4. Reusable Color Picker Component
function ColorPicker({ label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream text-center">
        {label}
      </label>
      <div className="relative group">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-14 h-14 rounded-sm border-2 border-coffee-cream/20 cursor-pointer 
                     appearance-none bg-transparent p-0 
                     hover:border-maple-rust transition-colors"
          style={{ backgroundColor: value }}
        />
      </div>
      <span className="font-mono text-[0.6rem] text-coffee-cream">
        {value.toUpperCase()}
      </span>
    </div>
  );
}