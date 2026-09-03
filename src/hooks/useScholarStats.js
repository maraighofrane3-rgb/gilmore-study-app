import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const DAY = 86400000;
const toUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function useScholarStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ xp: 0, level: 1, currentStreak: 0, bestStreak: 0 });

  useEffect(() => {
    if (!user) return;
    let alive = true;

    const load = async () => {
      // Fetch sessions AND profile in parallel
      const [{ data: sessionsData }, { data: profileData }] = await Promise.all([
        supabase
          .from('pomodoro_sessions')
          .select('duration, created_at')
          .eq('user_id', user.id)
          .eq('completed', true),
        supabase
          .from('profiles')
          .select('daily_goal_hours')
          .eq('id', user.id)
          .maybeSingle()
      ]);

      const sessions = sessionsData || [];

      // 🌟 XP = 1 point per focused minute · level up every 100 XP
            const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const xp = Math.round((totalMinutes / 60) * 10); // 🌟 10 XP per hour of focus
      const level = Math.floor(xp / 100) + 1;          // level up every 100 XP (= 10h)

      // 🎯 Get the daily goal in minutes (default to 1 hour if missing)
      const dailyGoalMin = (profileData?.daily_goal_hours || 1) * 60;

      // 📅 Calculate total minutes studied PER DAY
      const dailyMinutes = {};
      sessions.forEach(s => {
        const day = s.created_at.slice(0, 10);
        dailyMinutes[day] = (dailyMinutes[day] || 0) + (s.duration || 0);
      });

      // 🔥 Filter ONLY the days where the daily goal was actually met
      const goalMetDays = Object.keys(dailyMinutes)
        .filter(day => dailyMinutes[day] >= dailyGoalMin)
        .map(toUTC)
        .sort((a, b) => a - b);

      // 🔗 Calculate best streak and current streak from goal-met days
      let best = 0;
      let run = 0;
      let prev = null;
      for (const t of goalMetDays) {
        run = prev !== null && t - prev === DAY ? run + 1 : 1;
        best = Math.max(best, run);
        prev = t;
      }

      // current streak only lives if the chain reaches today or yesterday
      const n = new Date();
      const todayUTC = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
      const last = goalMetDays.length ? goalMetDays[goalMetDays.length - 1] : null;
      const currentStreak = last !== null && (todayUTC - last === 0 || todayUTC - last === DAY) ? run : 0;

      if (alive) setStats({ xp, level, currentStreak, bestStreak: best });
    };

    load();
    return () => { alive = false; };
  }, [user]);

  return stats;
}