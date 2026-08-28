import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Compass, Trash2, Save, ArrowLeft, BookOpen, Link as LinkIcon, Sparkles, Loader2 } from 'lucide-react';

export default function RabbitHoles() {
  const { user } = useAuth();
  const [holes, setHoles] = useState([]);
  const [selectedHole, setSelectedHole] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    starting_question: '',
    discoveries: '',
    sources: '',
    related_questions: '',
    category: 'General',
    status: 'exploring'
  });

  // AI Generation modal state
  const [showAIInput, setShowAIInput] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiCategory, setAiCategory] = useState('General');

  useEffect(() => {
    fetchHoles();
  }, [user]);

  const fetchHoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rabbit_holes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setHoles(data || []);
    setLoading(false);
  };

  const handleGenerateWithAI = async () => {
    if (!aiQuestion.trim()) return;
    
    setGenerating(true);
    try {
      // Call the Supabase Edge Function we just built!
      const { data, error } = await supabase.functions.invoke('generate-rabbit-hole', {
        body: { question: aiQuestion, category: aiCategory }
      });

      if (error) throw error;

      // Pre-fill the form with the beautiful AI-generated content
      setFormData({
        title: data.title || `Exploring: ${aiQuestion}`,
        starting_question: data.starting_question || aiQuestion,
        discoveries: data.discoveries || '',
        sources: data.sources || '',
        related_questions: data.related_questions || '',
        category: aiCategory,
        status: 'exploring'
      });

      setShowAIInput(false);
      setAiQuestion('');
      setIsEditing(true);
    } catch (error) {
      console.error('AI Generation Error:', error);
      alert(`Failed to generate: ${error.message}`);
    }
    setGenerating(false);
  };

  const handleNew = () => {
    setFormData({
      title: '',
      starting_question: '',
      discoveries: '',
      sources: '',
      related_questions: '',
      category: 'General',
      status: 'exploring'
    });
    setSelectedHole(null);
    setIsEditing(true);
    setShowAIInput(false);
  };

  const handleEdit = (hole) => {
    setFormData({
      title: hole.title,
      starting_question: hole.starting_question,
      discoveries: hole.discoveries || '',
      sources: hole.sources || '',
      related_questions: hole.related_questions || '',
      category: hole.category || 'General',
      status: hole.status || 'exploring'
    });
    setSelectedHole(hole);
    setIsEditing(true);
    setShowAIInput(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let error;

    if (selectedHole) {
      const res = await supabase.from('rabbit_holes').update(formData).eq('id', selectedHole.id);
      error = res.error;
    } else {
      const res = await supabase.from('rabbit_holes').insert([{ user_id: user.id, ...formData }]).select().single();
      error = res.error;
      if (!res.error) setSelectedHole(res.data);
    }

    if (!error) {
      setIsEditing(false);
      fetchHoles();
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('rabbit_holes').delete().eq('id', id);
    if (!error) {
      setHoles(holes.filter(h => h.id !== id));
      if (selectedHole?.id === id) setIsEditing(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'exploring') return 'text-porch-sage';
    if (status === 'completed') return 'text-yale-blue';
    return 'text-coffee-cream/50';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!isEditing ? (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
            <div>
              <p className="eyebrow mb-2">Deep Dives</p>
              <h1 className="font-display text-4xl text-yale-blue">
                The <span className="italic text-maple-rust">Rabbit Holes</span>.
              </h1>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAIInput(true)}
                className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-5 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust hover:text-page-cream transition-all duration-300"
              >
                <Sparkles size={16} /> Generate with AI
              </button>
              <button 
                onClick={handleNew}
                className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust transition-all duration-300"
              >
                <Plus size={16} /> New Rabbit Hole
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-coffee-cream italic py-10">Following the trail...</p>
          ) : holes.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <Compass className="mx-auto text-coffee-cream/30 mb-4" size={48} />
              <p className="font-body text-coffee-cream italic mb-4">No rabbit holes yet. What are you curious about today?</p>
              <button 
                onClick={() => setShowAIInput(true)}
                className="inline-flex items-center gap-2 bg-gilmore-gold text-yale-blue px-6 py-3 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust hover:text-page-cream transition-all duration-300"
              >
                <Sparkles size={16} /> Let AI suggest one
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {holes.map((hole, i) => (
                <div 
                  key={hole.id} 
                  className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up group hover:border-maple-rust/50 transition-all duration-300 cursor-pointer" 
                  style={{ animationDelay: `${i * 0.05}s` }} 
                  onClick={() => handleEdit(hole)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`font-ui text-[0.6rem] uppercase tracking-widest ${getStatusColor(hole.status)}`}>
                      {hole.status}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(hole.id); }} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-display text-2xl text-yale-blue mb-2 group-hover:text-maple-rust transition-colors">{hole.title}</h3>
                  <p className="font-body text-sm text-coffee-cream italic mb-4 line-clamp-2">"{hole.starting_question}"</p>
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-coffee-cream/10">
                    <span className="font-ui text-[0.6rem] uppercase tracking-widest text-porch-sage">
                      {hole.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="animate-fade-in-up space-y-6">
          <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust font-ui text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Rabbit Holes
          </button>
          
          <form onSubmit={handleSave} className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <input 
                  type="text" required value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-transparent border-b border-coffee-cream/30 pb-2 font-display text-3xl text-yale-blue focus:outline-none focus:border-maple-rust placeholder-coffee-cream/30 transition-colors"
                  placeholder="Title of your exploration..."
                />
              </div>
              <div>
                <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Category</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
                >
                  <option>General</option>
                  <option>Astronomy</option>
                  <option>Philosophy</option>
                  <option>History</option>
                  <option>Science</option>
                  <option>Literature</option>
                  <option>Technology</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">The Starting Question</label>
              <textarea 
                value={formData.starting_question} 
                onChange={e => setFormData({...formData, starting_question: e.target.value})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body italic text-library-ink transition-colors"
                placeholder="e.g., Why do black holes evaporate?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">
                  <BookOpen size={14} /> Discoveries & Notes
                </label>
                <textarea 
                  value={formData.discoveries} 
                  onChange={e => setFormData({...formData, discoveries: e.target.value})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-40 resize-none transition-colors"
                  placeholder="What have you learned so far?"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">
                  <LinkIcon size={14} /> Sources & References
                </label>
                <textarea 
                  value={formData.sources} 
                  onChange={e => setFormData({...formData, sources: e.target.value})}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-40 resize-none transition-colors"
                  placeholder="Books, articles, videos, or links..."
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">
                <Compass size={14} /> Related Questions to Explore
              </label>
              <textarea 
                value={formData.related_questions} 
                onChange={e => setFormData({...formData, related_questions: e.target.value})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-24 resize-none transition-colors"
                placeholder="e.g., What is Hawking radiation? How does quantum field theory relate?"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-coffee-cream/20">
              <select 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value})}
                className="bg-parchment border border-coffee-cream/20 rounded-sm px-3 py-2 font-ui text-xs uppercase tracking-widest text-coffee-cream focus:outline-none transition-colors"
              >
                <option value="exploring">🟡 Exploring</option>
                <option value="completed">🟢 Completed</option>
                <option value="abandoned">⚪ Abandoned</option>
              </select>
              
              <button type="submit" className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-yale-blue transition-all duration-300">
                <Save size={16} /> Save Exploration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Generation Modal */}
      {showAIInput && (
        <div className="fixed inset-0 bg-library-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy max-w-lg w-full space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gilmore-gold/20 rounded-sm">
                <Sparkles size={24} className="text-gilmore-gold" />
              </div>
              <div>
                <h2 className="font-display text-2xl text-yale-blue">AI Rabbit Hole Generator</h2>
                <p className="font-body text-sm text-coffee-cream">What are you curious about today?</p>
              </div>
            </div>

            <div>
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Your Question</label>
              <textarea 
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-library-ink h-24 resize-none transition-colors"
                placeholder="e.g., Why do black holes evaporate? or What is the philosophy of stoicism?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerateWithAI();
                  }
                }}
              />
              <p className="font-ui text-[0.6rem] text-coffee-cream mt-1">Press Ctrl+Enter (or Cmd+Enter) to generate</p>
            </div>

            <div>
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Category</label>
              <select 
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
              >
                <option>General</option>
                <option>Astronomy</option>
                <option>Philosophy</option>
                <option>History</option>
                <option>Science</option>
                <option>Literature</option>
                <option>Technology</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setShowAIInput(false); setAiQuestion(''); }}
                className="flex-1 px-4 py-2.5 border border-coffee-cream/30 rounded-sm font-ui text-xs uppercase tracking-widest text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-all duration-300"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateWithAI}
                disabled={generating || !aiQuestion.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust hover:text-page-cream transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}