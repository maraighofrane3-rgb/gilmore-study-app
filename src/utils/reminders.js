import { supabase } from '../lib/supabase';

// Create the settings row once (auto-detect timezone)
export async function ensureReminderRow() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return;
  const offset = -Math.round(new Date().getTimezoneOffset() / 60);
  await supabase
    .from('reminder_settings')
    .upsert({ user_id: data.user.id, tz_offset: offset }, { onConflict: 'user_id', ignoreDuplicates: true });
}

// Push today's numbers so the email has fresh content
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

// 🔔 Browser notification (only while the app is open)
export async function requestBrowserNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

export function maybeShowLocalReminder(stats) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const last = localStorage.getItem('rgw-last-reminder-toast');
  if (last && Date.now() - Number(last) < 3 * 3600e3) return;
  localStorage.setItem('rgw-last-reminder-toast', String(Date.now()));
  new Notification('📜 Your desk is waiting', {
    body: `${stats.tasksDue} tasks left · ${stats.goalHours}h goal · 🔥 ${stats.streak}-day streak`,
  });
}