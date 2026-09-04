import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, ScrollText, Loader2 } from 'lucide-react';

export default function WeeklyChronicleModal({ isOpen, onClose }) {
  const [letter, setLetter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchChronicle = async () => {
    setIsLoading(true);
    setError('');
    setLetter('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-weekly-report');
      if (error) throw error;
      setLetter(data.letter);
    } catch (err) {
      console.error('Error fetching chronicle:', err);
      setError('The Dean is currently unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-library-ink/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-parchment rounded-sm shadow-2xl border border-coffee-cream/30 overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-coffee-cream/20 bg-page-cream/50">
          <div className="flex items-center gap-3">
            <ScrollText size={24} className="text-maple-rust" />
            <h2 className="font-display text-2xl text-yale-blue">The Weekly Chronicle</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-coffee-cream/10 rounded-full transition-colors text-coffee-cream">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={32} className="text-maple-rust animate-spin" />
              <p className="font-body italic text-coffee-cream">The Dean is reviewing your records...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-maple-rust/10 border border-maple-rust/30 rounded-sm text-maple-rust font-body text-sm">
              {error}
            </div>
          )}

          {!isLoading && !letter && !error && (
            <div className="text-center py-12 space-y-6">
              <p className="font-body text-library-ink/80 leading-relaxed">
                Welcome to your weekly review. The Dean of Stars Hollow Academy has prepared a personalized letter reflecting on your scholarly pursuits over the past seven days.
              </p>
              <button
                onClick={fetchChronicle}
                className="bg-maple-rust text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors shadow-cozy"
              >
                 Open the Dean's Letter
              </button>
            </div>
          )}

          {letter && (
            <div className="space-y-6 animate-fade-in-up">
              {/* The Letter Text */}
              <div className="font-body text-library-ink text-lg leading-relaxed whitespace-pre-line">
                {letter}
              </div>
              
              {/* Action Button */}
              <div className="pt-6 border-t border-coffee-cream/20 flex justify-center">
                <button
                  onClick={fetchChronicle}
                  className="text-maple-rust font-label text-xs uppercase tracking-wider hover:text-yale-blue transition-colors flex items-center gap-2"
                >
                  <ScrollText size={14} /> Request a new reflection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}