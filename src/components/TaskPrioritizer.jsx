import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

export default function TaskPrioritizer({ tasks, onReorder }) {
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState('');

  const taskCount = tasks?.length ?? 0;

  const handlePrioritize = async () => {
    if (taskCount < 2) return;
    setLoading(true);
    setTip('');

    try {
      const tasksToSend = tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline }));

      const { data, error } = await supabase.functions.invoke('prioritize-tasks', {
        body: { tasks: tasksToSend }
      });

      if (error) {
        // supabase-js ne parse pas automatiquement le corps de la réponse en cas de statut non-2xx :
        // error.message reste générique ("Edge Function returned a non-2xx status code").
        // Le vrai message que l'edge function renvoie est dans error.context (la Response brute).
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          console.error('Edge Function error detail:', body?.error ?? body ?? error.message);
        } else {
          console.error('Edge Function invoke error:', error.message);
        }
        throw error;
      }

      setTip(data.top_tip);

      if (data.ordered_ids && onReorder) {
        const newOrder = data.ordered_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean);
        const missing = tasks.filter(t => !data.ordered_ids.includes(t.id));
        onReorder([...newOrder, ...missing]);
      }
    } catch (err) {
      setTip("The coach is busy. Try again in a moment.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-parchment border border-coffee-cream/20 rounded-sm shadow-cozy p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-gilmore-gold" />
          <h3 className="font-display text-lg text-yale-blue">Smart Prioritizer</h3>
        </div>
        {tip ? (
          <p className="font-body text-sm text-library-ink italic animate-fade-in-up">
            "{tip}"
          </p>
        ) : (
          <p className="font-body text-sm text-coffee-cream">
            Let AI analyze your deadlines and effort to sort your list.
          </p>
        )}
      </div>

      <button
        onClick={handlePrioritize}
        disabled={loading || taskCount < 2}
        className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Thinking...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Sort for Me
          </>
        )}
      </button>
    </div>
  );
}