import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileText, Lightbulb, Quote, BookOpen, Trash2 } from 'lucide-react';

export default function BookDetail({ book, onBack }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (book) fetchNotes();
  }, [book]);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('book_notes')
      .select('*')
      .eq('book_id', book.id)
      .order('created_at', { ascending: false });
    
    if (!error) setNotes(data || []);
    setLoading(false);
  };

  const deleteNote = async (id) => {
    const { error } = await supabase
      .from('book_notes')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setNotes(notes.filter(n => n.id !== id));
    }
  };

  const categories = [
    { id: 'all', label: 'All Notes', icon: BookOpen },
    { id: 'summary', label: 'Summaries', icon: FileText },
    { id: 'explanation', label: 'Explanations', icon: Lightbulb },
    { id: 'quotes', label: 'Quotes', icon: Quote },
  ];

  const filteredNotes = notes.filter(note => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'summary') return note.ai_summary;
    if (activeCategory === 'explanation') return note.ai_explanation;
    if (activeCategory === 'quotes') return note.ai_quotes;
    return true;
  });

  const getNoteContent = (note) => {
    if (activeCategory === 'summary' || (!activeCategory || activeCategory === 'all') && note.ai_summary) {
      return { type: 'summary', content: note.ai_summary, icon: FileText, label: 'Summary' };
    }
    if (activeCategory === 'explanation' || (!activeCategory || activeCategory === 'all') && note.ai_explanation) {
      return { type: 'explanation', content: note.ai_explanation, icon: Lightbulb, label: 'Explanation' };
    }
    if (activeCategory === 'quotes' || (!activeCategory || activeCategory === 'all') && note.ai_quotes) {
      return { type: 'quotes', content: note.ai_quotes, icon: Quote, label: 'Quotes' };
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-sm hover:bg-coffee-cream/10 transition-colors"
        >
          <ArrowLeft size={20} className="text-coffee-cream" />
        </button>
        <div>
          <h1 className="font-display text-3xl text-yale-blue">{book.title}</h1>
          <p className="font-body text-sm text-coffee-cream italic">by {book.author}</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2">
        {categories.map(cat => {
          const Icon = cat.icon;
          const count = cat.id === 'all' 
            ? notes.length 
            : notes.filter(n => n[`ai_${cat.id}`]).length;
          
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label transition-all ${
                activeCategory === cat.id
                  ? 'bg-yale-blue text-page-cream'
                  : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
              }`}
            >
              <Icon size={14} />
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes Display */}
      {loading ? (
        <p className="text-center text-coffee-cream italic py-10 font-body">Loading notes...</p>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">No notes in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note, idx) => {
            const noteData = getNoteContent(note);
            if (!noteData) return null;
            
            const Icon = noteData.icon;
            
            return (
              <div
                key={note.id}
                className="bg-parchment border border-coffee-cream/20 rounded-sm shadow-cozy p-5 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gilmore-gold" />
                    <span className="font-label text-xs uppercase tracking-wider-label text-coffee-cream">
                      {noteData.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs text-coffee-cream/60">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-coffee-cream/40 hover:text-maple-rust transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {note.original_text && (
                  <div className="mb-4 p-3 bg-page-cream/50 border-l-2 border-coffee-cream/30 rounded-sm">
                    <p className="font-body text-xs text-coffee-cream italic line-clamp-3">
                      "{note.original_text}"
                    </p>
                  </div>
                )}

                <div className={`p-4 rounded-sm ${
                  noteData.type === 'quotes' 
                    ? 'bg-gilmore-gold/10 border-l-4 border-gilmore-gold' 
                    : noteData.type === 'explanation'
                    ? 'bg-porch-sage/10 border-l-4 border-porch-sage'
                    : 'bg-yale-blue/5 border-l-4 border-yale-blue'
                }`}>
                  <p className={`font-body text-sm leading-relaxed whitespace-pre-wrap ${
                    noteData.type === 'quotes' ? 'italic text-coffee-cream' : 'text-library-ink'
                  }`}>
                    {noteData.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}