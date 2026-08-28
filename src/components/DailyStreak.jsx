import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Trophy } from 'lucide-react';

export default function DailyStreak() {
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkInAndUpdate();
  }, []);

  const checkInAndUpdate = async () => {
    try {
      // 1. Call the magic Postgres function to update the streak for today
      await supabase.rpc('check_in_user');

      // 2. Fetch the updated streak data
      const { data, error } = await supabase
        .from('user_streaks')
        .select('current_streak, longest_streak')
        .single();

      if (!error && data) {
        setStreak({ current: data.current_streak, longest: data.longest_streak });
      }
    } catch (err) {
      console.error('Streak update error:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-pulse">
        <div className="h-6 bg-coffee-cream/20 rounded w-1/3 mb-2"></div>
        <div className="h-10 bg-coffee-cream/20 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy flex items-center justify-between animate-fade-in-up">
      <div>
        <p className="font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-1">
          Current Streak
        </p>
        <div className="flex items-baseline gap-2">
          <Flame size={32} className="text-maple-rust" />
          <span className="font-display text-4xl text-yale-blue">
            {streak.current} <span className="text-lg text-coffee-cream font-body">days</span>
          </span>
        </div>
      </div>

      <div className="text-right">
        <p className="font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-1">
          Personal Best
        </p>
        <div className="flex items-center justify-end gap-2">
          <span className="font-display text-2xl text-gilmore-gold">{streak.longest}</span>
          <Trophy size={20} className="text-gilmore-gold" />
        </div>
      </div>
    </div>
  );
}