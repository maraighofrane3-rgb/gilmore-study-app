import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, RefreshCw, BookOpen } from 'lucide-react';

export default function DailyCoach() {
  const [coachData, setCoachData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCoach = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('get-daily-coach');
      if (error) throw error;
      setCoachData(data);
    } catch (err) {
      setError('The mentor is resting. Try again later.');
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoach();
  }, []);

  return (
    <div className="bg-parchment border border-coffee-cream/20 rounded-sm shadow-cozy p-6 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <BookOpen size={80} className="text-yale-blue" />
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gilmore-gold" />
            <h3 className="font-display text-xl text-yale-blue">Daily Mentor</h3>
          </div>
          <button 
            onClick={fetchCoach} 
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-coffee-cream/10 transition-colors disabled:opacity-50"
            title="Get new advice"
          >
            <RefreshCw size={16} className={`text-coffee-cream ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-coffee-cream/10 rounded w-3/4"></div>
            <div className="h-3 bg-coffee-cream/10 rounded w-full"></div>
            <div className="h-3 bg-coffee-cream/10 rounded w-5/6"></div>
          </div>
        ) : error ? (
          <p className="font-body text-sm text-maple-rust italic">{error}</p>
        ) : (
          <div className="space-y-4">
            <p className="font-display text-lg text-yale-blue leading-tight">
              {coachData.greeting}
            </p>
            
            <div className="bg-page-cream/50 p-3 rounded-sm border-l-2 border-maple-rust">
              <p className="font-body text-sm text-library-ink leading-relaxed">
                {coachData.tip}
              </p>
            </div>

            <div className="pt-2 border-t border-coffee-cream/10">
              <p className="font-body text-sm italic text-coffee-cream">
                "{coachData.quote}"
              </p>
              <p className="font-label text-[0.65rem] uppercase tracking-wider-label text-coffee-cream mt-1">
                — {coachData.author}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}