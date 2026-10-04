import { supabase } from '../lib/supabase';

// ✅ Create or update the settings row (auto-detects and updates timezone if user travels)
export async function ensureReminderRow() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return;
  
  const offset = -Math.round(new Date().getTimezoneOffset() / 60);
  
  await supabase
    .from('reminder_settings')
    .upsert(
      { user_id: data.user.id, tz_offset: offset }, 
      { onConflict: 'user_id' } // Removed ignoreDuplicates so timezone can update if they travel
    );
}

// ✅ Push today's numbers so the email has fresh content
export async function syncReminderSnapshot(stats) {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return;
  
  const day = new Date().toISOString().slice(0, 10);
  
  await supabase.from('reminder_snapshots').upsert({
    user_id: data.user.id,
    day,
    goal_hours: stats.goalHours || 0,
    focused_minutes: stats.focusedMinutes || 0,
    streak: stats.streak || 0,
    tasks_due: stats.tasksDue || 0,
    tasks_done: stats.tasksDone || 0,
    task_list: stats.taskList || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,day' });
}

// ✅ Browser notification permission helper
export async function requestBrowserNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  
  const p = await Notification.requestPermission();
  return p === 'granted';
}

// ✅ Show local notification (only while app is open, respects user settings & cooldown)
export async function maybeShowLocalReminder(stats) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // 🎚️ Respect the Privacy → "Study Reminders" master toggle
  const { data: who } = await supabase.auth.getUser();
  if (!who?.user) return;
  
  const { data: prof } = await supabase
    .from('profiles')
    .select('notifications_enabled')
    .eq('id', who.user.id)
    .maybeSingle();
    
  if (prof && prof.notifications_enabled === false) return;

  // 🎚️ Respect the specific browser notification toggle
  const { data: rem } = await supabase
    .from('reminder_settings')
    .select('browser_notifications')
    .eq('user_id', who.user.id)
    .maybeSingle();
    
  if (rem && rem.browser_notifications === false) return;

  // ⏱️ 3-Hour Cooldown to prevent spam
  const last = localStorage.getItem('rgw-last-reminder-toast');
  if (last && Date.now() - Number(last) < 3 * 3600e3) return;
  
  localStorage.setItem('rgw-last-reminder-toast', String(Date.now()));

  // 🔔 Fire the notification
  new Notification('📜 Your desk is waiting', {
    body: `${stats.tasksDue} tasks left · ${stats.goalHours}h goal · 🔥 ${stats.streak}-day streak`,
  });
}