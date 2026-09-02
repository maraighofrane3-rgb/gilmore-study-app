import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Compass, Trash2, Save, ArrowLeft, BookOpen, Link as LinkIcon,
  Sparkles, Loader2, Search, CheckCircle, Clock, X, Eye, EyeOff,
  Target, Feather, Rocket, Telescope, Brain, Scroll, Cpu, Globe,
  Calendar, Quote
} from 'lucide-react';

// ============================================
// 🎨 CONSTANTS
// ============================================

const CATEGORIES = [
  { id: 'All', icon: Globe, color: 'text-coffee-cream' },
  { id: 'General', icon: Feather, color: 'text-coffee-cream' },
  { id: 'Astronomy', icon: Telescope, color: 'text-yale-blue' },
  { id: 'Philosophy', icon: Brain, color: 'text-maple-rust' },
  { id: 'History', icon: Scroll, color: 'text-gilmore-gold' },
  { id: 'Science', icon: Rocket, color: 'text-porch-sage' },
  { id: 'Literature', icon: BookOpen, color: 'text-yale-blue' },
  { id: 'Technology', icon: Cpu, color: 'text-maple-rust' },
];

const STATUSES = [
  { id: 'all', label: 'All', icon: Eye, color: 'text-coffee-cream' },
  { id: 'exploring', label: 'Exploring', icon: Compass, color: 'text-gilmore-gold' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-porch-sage' },
  { id: 'abandoned', label: 'Abandoned', icon: EyeOff, color: 'text-coffee-cream/60' },
];

const EMPTY_FORM = {
  title: '',
  starting_question: '',
  discoveries: '',
  sources: '',
  related_questions: '',
  category: 'General',
  status: 'exploring'
};

// ============================================
// 🧠 MEMOIZED CARD
// ============================================

const HoleCard = memo(function HoleCard({ hole, index, onOpen, onDelete }) {
  const category = CATEGORIES.find(c => c.id === hole.category) || CATEGORIES[1];
  const CategoryIcon = category.icon;
  const StatusIcon = STATUSES.find(s => s.id === hole.status)?.icon || Compass;

  const relatedCount = hole.related_questions
    ? hole.related_questions.split('\n').filter(q => q.trim()).length
    : 0;

  return (
    <div
      className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up group hover:border-maple-rust/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col"
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
      onClick={() => onOpen(hole)}
    >
      {/* Top: status + category */}
      <div className="flex justify-between items-start mb-4">
        <div className={`flex items-center gap-1.5 font-label text-[0.6rem] uppercase tracking-wider ${STATUSES.find(s => s.id === hole.status)?.color}`}>
          <StatusIcon size={11} />
          {hole.status}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(hole); }}
          className="text-coffee-cream/40 hover:text-maple-rust transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-display text-xl text-yale-blue mb-3 group-hover:text-maple-rust transition-colors line-clamp-2 leading-tight">
        {hole.title}
      </h3>

      {/* Question */}
      <p className="font-body text-sm text-coffee-cream italic mb-4 line-clamp-3 flex-1">
        <Quote size={10} className="inline mr-1 -mt-1 opacity-40" />
        {hole.starting_question}
      </p>

      {/* Footer: category + meta */}
      <div className="flex items-center justify-between pt-4 border-t border-coffee-cream/10">
        <div className={`flex items-center gap-1.5 ${category.color}`}>
          <CategoryIcon size={12} />
          <span className="font-label text-[0.6rem] uppercase tracking-wider">{hole.category}</span>
        </div>
        <div className="flex items-center gap-3 font-label text-[0.6rem] text-coffee-cream/60 uppercase tracking-wider">
          {relatedCount > 0 && (
            <span className="flex items-center gap-1">
              <Target size={10} /> {relatedCount}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(hole.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 🏠 MAIN COMPONENT
// ============================================

export default function RabbitHoles() {
  const { user } = useAuth();
  const [holes, setHoles] = useState([]);
  const [selectedHole, setSelectedHole] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('all');

  // AI modal
  const [showAIInput, setShowAIInput] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiCategory, setAiCategory] = useState('General');

  // Notifications
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notifTimer = useRef(null);

  const showNotification = useCallback((message, type = 'success') => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification({ show: true, message, type });
    notifTimer.current = setTimeout(
      () => setNotification({ show: false, message: '', type: 'success' }),
      3000
    );
  }, []);

  // ============================================
  // 🔄 DATA FETCHING
  // ============================================

  const fetchHoles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rabbit_holes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setHoles(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchHoles();
  }, [user, fetchHoles]);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // 🧮 MEMOIZED DERIVATIONS
  // ============================================

  const stats = useMemo(() => {
    return {
      total: holes.length,
      exploring: holes.filter(h => h.status === 'exploring').length,
      completed: holes.filter(h => h.status === 'completed').length,
    };
  }, [holes]);

  const categoryCounts = useMemo(() => {
    const counts = { All: holes.length };
    for (const cat of CATEGORIES) {
      if (cat.id !== 'All') counts[cat.id] = holes.filter(h => h.category === cat.id).length;
    }
    return counts;
  }, [holes]);

  const filteredHoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return holes.filter(h => {
      const matchesCategory = activeCategory === 'All' || h.category === activeCategory;
      const matchesStatus = activeStatus === 'all' || h.status === activeStatus;
      const matchesSearch = q === '' ||
        h.title.toLowerCase().includes(q) ||
        h.starting_question.toLowerCase().includes(q) ||
        (h.category || '').toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [holes, searchQuery, activeCategory, activeStatus]);

  // ============================================
  // 🤖 AI GENERATION
  // ============================================

  const handleGenerateWithAI = async () => {
    if (!aiQuestion.trim()) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-rabbit-hole', {
        body: { question: aiQuestion, category: aiCategory }
      });

      if (error) throw error;

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
      setSelectedHole(null);
      showNotification('AI generated a beautiful rabbit hole! 🐇');
    } catch (error) {
      console.error('AI Generation Error:', error);
      showNotification(`Failed to generate: ${error.message}`, 'error');
    }
    setGenerating(false);
  };

  // ============================================
  // ✍️ CRUD
  // ============================================

  const handleNew = () => {
    setFormData(EMPTY_FORM);
    setSelectedHole(null);
    setIsEditing(true);
    setShowAIInput(false);
  };

  const handleOpen = (hole) => {
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

    try {
      if (selectedHole) {
        const { error } = await supabase
          .from('rabbit_holes')
          .update(formData)
          .eq('id', selectedHole.id);
        if (error) throw error;
        showNotification('Exploration saved!');
      } else {
        const { data, error } = await supabase
          .from('rabbit_holes')
          .insert([{ user_id: user.id, ...formData }])
          .select()
          .single();
        if (error) throw error;
        setSelectedHole(data);
        showNotification('New rabbit hole created! 🕳️');
      }
      setIsEditing(false);
      fetchHoles();
    } catch (err) {
      showNotification(`Failed to save: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (hole) => {
    if (!confirm(`Remove "${hole.title}"?`)) return;
    const { error } = await supabase.from('rabbit_holes').delete().eq('id', hole.id);
    if (!error) {
      setHoles(prev => prev.filter(h => h.id !== hole.id));
      if (selectedHole?.id === hole.id) setIsEditing(false);
      showNotification('Rabbit hole removed.');
    }
  };

  const handleStatusChange = async (hole, newStatus) => {
    setHoles(prev => prev.map(h => h.id === hole.id ? { ...h, status: newStatus } : h));
    const { error } = await supabase
      .from('rabbit_holes')
      .update({ status: newStatus })
      .eq('id', hole.id);

    if (error) {
      setHoles(prev => prev.map(h => h.id === hole.id ? { ...h, status: hole.status } : h));
      showNotification('Failed to update status.', 'error');
    } else {
      showNotification(`"${hole.title}" → ${newStatus}`);
    }
  };

  // ============================================
  // 🎨 RENDER
  // ============================================

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
          notification.type === 'error'
            ? 'bg-maple-rust text-page-cream border-maple-rust'
            : 'bg-porch-sage text-page-cream border-porch-sage'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          <span className="font-body text-sm">{notification.message}</span>
        </div>
      )}

      {!isEditing ? (
        <>
          {/* Header */}
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
                className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all"
              >
                <Sparkles size={16} /> Generate with AI
              </button>
              <button
                onClick={handleNew}
                className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all"
              >
                <Plus size={16} /> New
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
            <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <div className="flex items-center gap-2 mb-1">
                <Compass size={16} className="text-yale-blue" />
                <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Total</p>
              </div>
              <p className="font-display text-2xl text-yale-blue">{stats.total}</p>
            </div>
            <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <div className="flex items-center gap-2 mb-1">
                <Compass size={16} className="text-gilmore-gold" />
                <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Exploring</p>
              </div>
              <p className="font-display text-2xl text-gilmore-gold">{stats.exploring}</p>
            </div>
            <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-porch-sage" />
                <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Completed</p>
              </div>
              <p className="font-display text-2xl text-porch-sage">{stats.completed}</p>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="space-y-3 animate-fade-in-up">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by title, question, or category..."
                className="w-full pl-11 pr-4 py-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
              />
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2">
              {STATUSES.map(s => {
                const Icon = s.icon;
                const count = s.id === 'all' ? holes.length : holes.filter(h => h.status === s.id).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveStatus(s.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
                      activeStatus === s.id
                        ? 'bg-yale-blue text-page-cream'
                        : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
                    }`}
                  >
                    <Icon size={14} />
                    {s.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const count = categoryCounts[c.id] || 0;
                const isActive = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-label text-[0.6rem] uppercase tracking-wider transition-all ${
                      isActive
                        ? 'bg-maple-rust/10 border border-maple-rust/40 text-maple-rust'
                        : 'border border-coffee-cream/20 text-coffee-cream hover:border-maple-rust/40 hover:text-maple-rust'
                    }`}
                  >
                    <Icon size={12} />
                    {c.id}
                    <span className={`ml-0.5 ${isActive ? 'text-maple-rust' : 'text-coffee-cream/50'}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Holes grid */}
          {loading ? (
            <p className="text-center text-coffee-cream italic py-10 font-body">Following the trail...</p>
          ) : filteredHoles.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <Compass className="mx-auto text-coffee-cream/30 mb-4" size={48} />
              <p className="font-body text-coffee-cream italic mb-4">
                {holes.length === 0
                  ? 'No rabbit holes yet. What are you curious about today?'
                  : 'No holes match your filters.'}
              </p>
              {holes.length === 0 && (
                <button
                  onClick={() => setShowAIInput(true)}
                  className="inline-flex items-center gap-2 bg-gilmore-gold text-yale-blue px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all"
                >
                  <Sparkles size={16} /> Let AI suggest one
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHoles.map((hole, i) => (
                <HoleCard
                  key={hole.id}
                  hole={hole}
                  index={i}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        // ============================================
        // ✍️ EDIT / DETAIL VIEW
        // ============================================
        <div className="animate-fade-in-up space-y-6">
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust font-label text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Back to Rabbit Holes
          </button>

          <form onSubmit={handleSave} className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-6">
            {/* Title + Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-transparent border-b border-coffee-cream/30 pb-2 font-display text-3xl text-yale-blue focus:outline-none focus:border-maple-rust placeholder-coffee-cream/30 transition-colors"
                  placeholder="Title of your exploration..."
                />
              </div>
              <div>
                <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
                >
                  {CATEGORIES.filter(c => c.id !== 'All').map(c => (
                    <option key={c.id} value={c.id}>{c.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Starting Question */}
            <div>
              <label className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">
                <Quote size={14} /> The Starting Question
              </label>
              <textarea
                value={formData.starting_question}
                onChange={e => setFormData({ ...formData, starting_question: e.target.value })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body italic text-library-ink transition-colors"
                placeholder="e.g., Why do black holes evaporate?"
                rows={2}
              />
            </div>

            {/* AI-generated research path */}
            {formData.related_questions && (
              <div className="bg-gilmore-gold/5 border-l-4 border-gilmore-gold p-5 rounded-sm">
                <h4 className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-gilmore-gold mb-3">
                  <Sparkles size={14} /> Research Path (AI)
                </h4>
                <ul className="space-y-2">
                  {formData.related_questions.split('\n').filter(q => q.trim()).map((q, i) => (
                    <li key={i} className="flex items-start gap-2 font-body text-sm text-library-ink">
                      <span className="text-maple-rust mt-1">→</span>
                      <span>{q.replace(/^[0-9.\-]+\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Discoveries + Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">
                  <BookOpen size={14} /> Discoveries & Notes
                </label>
                <textarea
                  value={formData.discoveries}
                  onChange={e => setFormData({ ...formData, discoveries: e.target.value })}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-40 resize-y transition-colors"
                  placeholder="What have you learned so far?"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">
                  <LinkIcon size={14} /> Sources & References
                </label>
                <textarea
                  value={formData.sources}
                  onChange={e => setFormData({ ...formData, sources: e.target.value })}
                  className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-40 resize-y transition-colors"
                  placeholder="Books, articles, videos, or links..."
                />
              </div>
            </div>

            {/* Related questions (editable raw) */}
            <details className="group">
              <summary className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-coffee-cream mb-1 cursor-pointer hover:text-maple-rust transition-colors">
                <Target size={14} /> Edit Related Questions
                <span className="ml-auto text-[0.6rem] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <textarea
                value={formData.related_questions}
                onChange={e => setFormData({ ...formData, related_questions: e.target.value })}
                className="mt-2 w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-24 resize-y transition-colors"
                placeholder="One question per line..."
              />
            </details>

            {/* Footer: status + save */}
            <div className="flex justify-between items-center pt-4 border-t border-coffee-cream/20">
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="bg-parchment border border-coffee-cream/20 rounded-sm px-3 py-2 font-label text-xs uppercase tracking-wider text-coffee-cream focus:outline-none transition-colors"
              >
                <option value="exploring">🟡 Exploring</option>
                <option value="completed">🟢 Completed</option>
                <option value="abandoned">⚪ Abandoned</option>
              </select>

              <button
                type="submit"
                className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all"
              >
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
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Your Question</label>
              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-library-ink h-24 resize-none transition-colors"
                placeholder="e.g., Why do black holes evaporate?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerateWithAI();
                  }
                }}
              />
              <p className="font-label text-[0.6rem] text-coffee-cream mt-1">Press Ctrl+Enter to generate</p>
            </div>

            <div>
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Category</label>
              <select
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
              >
                {CATEGORIES.filter(c => c.id !== 'All').map(c => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowAIInput(false); setAiQuestion(''); }}
                className="flex-1 px-4 py-2.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateWithAI}
                disabled={generating || !aiQuestion.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? <><Loader2 size={16} className="animate-spin" /> Thinking...</> : <><Sparkles size={16} /> Generate</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}