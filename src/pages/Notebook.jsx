import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Feather, Trash2, Save, ArrowLeft, Tag, Search,
  CheckCircle, X, Calendar, FileText, Quote
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

// ============================================
// 🧠 MEMOIZED WRITING CARD
// ============================================

const WritingCard = memo(function WritingCard({ writing, index, onOpen, onDelete }) {
  const tags = writing.tags ? writing.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const preview = writing.content ? writing.content.substring(0, 150) : '';

  return (
    <div
      className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up group hover:border-maple-rust/50 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col"
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
      onClick={() => onOpen(writing)}
    >
      {/* Header: date + delete */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-1.5 text-coffee-cream/60">
          <Calendar size={11} />
          <span className="font-label text-[0.6rem] uppercase tracking-wider">
            {new Date(writing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(writing); }}
          className="text-coffee-cream/40 hover:text-maple-rust transition-colors p-1 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-display text-xl text-yale-blue mb-3 group-hover:text-maple-rust transition-colors line-clamp-2 leading-tight">
        {writing.title}
      </h3>

      {/* Content preview */}
      <p className="font-body text-sm text-coffee-cream italic mb-4 flex-1 line-clamp-3">
        {preview ? (
          <>
            <Quote size={10} className="inline mr-1 -mt-1 opacity-40" />
            {preview}...
          </>
        ) : (
          'No content yet...'
        )}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-4 border-t border-coffee-cream/10">
          {tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-porch-sage/10 border border-porch-sage/20 rounded-sm font-label text-[0.6rem] uppercase tracking-wider text-porch-sage"
            >
              <Tag size={9} />
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="font-label text-[0.6rem] text-coffee-cream/50 self-center">
              +{tags.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ============================================
// 🏠 MAIN COMPONENT
// ============================================

export default function Notebook() {
  const { user } = useAuth();
  const [writings, setWritings] = useState([]);
  const [selectedWriting, setSelectedWriting] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ title: '', content: '', tags: '' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const fetchWritings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('writings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setWritings(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWritings();
  }, [fetchWritings]);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // 🧮 MEMOIZED DERIVATIONS
  // ============================================

  const stats = useMemo(() => ({
    total: writings.length,
    totalWords: writings.reduce((sum, w) => sum + (w.content?.split(/\s+/).filter(Boolean).length || 0), 0),
  }), [writings]);

  const allTags = useMemo(() => {
    const tagCounts = {};
    writings.forEach(w => {
      if (w.tags) {
        w.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [writings]);

  const filteredWritings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return writings.filter(w => {
      const matchesSearch = q === '' ||
        w.title.toLowerCase().includes(q) ||
        (w.content || '').toLowerCase().includes(q);
      
      const matchesTag = activeTag === 'all' ||
        (w.tags && w.tags.toLowerCase().includes(activeTag.toLowerCase()));
      
      return matchesSearch && matchesTag;
    });
  }, [writings, searchQuery, activeTag]);

  // ============================================
  // ✍️ CRUD
  // ============================================

  const handleNew = useCallback(() => {
    setFormData({ title: '', content: '', tags: '' });
    setSelectedWriting(null);
    setIsEditing(true);
  }, []);

  const handleOpen = useCallback((writing) => {
    setFormData({
      title: writing.title,
      content: writing.content || '',
      tags: writing.tags || ''
    });
    setSelectedWriting(writing);
    setIsEditing(true);
  }, []);

  const handleSave = useCallback(async (e) => {
    e.preventDefault();

    try {
      if (selectedWriting) {
        const { error } = await supabase
          .from('writings')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', selectedWriting.id);
        if (error) throw error;
        showNotification('Entry updated! 📝');
      } else {
        const { data, error } = await supabase
          .from('writings')
          .insert([{ user_id: user.id, ...formData }])
          .select()
          .single();
        if (error) throw error;
        setSelectedWriting(data);
        showNotification('New entry saved! ✨');
      }
      setIsEditing(false);
      fetchWritings();
    } catch (err) {
      showNotification(`Failed to save: ${err.message}`, 'error');
    }
  }, [formData, selectedWriting, user, fetchWritings, showNotification]);

  const requestDelete = useCallback((writing) => {
    setDeleteTarget(writing);
  }, []);

  const confirmDelete = useCallback(async () => {
    const writing = deleteTarget;
    setDeleteTarget(null);
    if (!writing) return;

    setWritings(prev => prev.filter(w => w.id !== writing.id));
    const { error } = await supabase.from('writings').delete().eq('id', writing.id);
    if (error) {
      fetchWritings();
      showNotification('Failed to delete entry.', 'error');
    } else {
      if (selectedWriting?.id === writing.id) setIsEditing(false);
      showNotification(`"${writing.title}" removed.`);
    }
  }, [deleteTarget, selectedWriting, fetchWritings, showNotification]);

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
              <p className="eyebrow mb-2">Personal Reflections</p>
              <h1 className="font-display text-4xl text-yale-blue">
                The <span className="italic text-maple-rust">Notebook</span>.
              </h1>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors"
            >
              <Plus size={16} /> New Entry
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={16} className="text-yale-blue" />
                <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Total Entries</p>
              </div>
              <p className="font-display text-2xl text-yale-blue">{stats.total}</p>
            </div>
            <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <div className="flex items-center gap-2 mb-1">
                <Feather size={16} className="text-maple-rust" />
                <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Words Written</p>
              </div>
              <p className="font-display text-2xl text-maple-rust">{stats.totalWords.toLocaleString()}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-coffee-cream italic py-10 font-body">Sharpening quills...</p>
          ) : writings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <Feather className="mx-auto text-coffee-cream/30 mb-4" size={48} />
              <p className="font-body text-coffee-cream italic mb-4">
                The pages are blank. Write your first thought.
              </p>
              <button
                onClick={handleNew}
                className="inline-flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors"
              >
                <Plus size={16} /> Start Writing
              </button>
            </div>
          ) : (
            <>
              {/* Search + Tag Filter */}
              <div className="space-y-3 animate-fade-in-up">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by title or content..."
                    className="w-full pl-11 pr-4 py-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
                  />
                </div>

                {/* Tag chips */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setActiveTag('all')}
                      className={`px-3 py-1.5 rounded-sm font-label text-[0.6rem] uppercase tracking-wider transition-all ${
                        activeTag === 'all'
                          ? 'bg-maple-rust text-page-cream'
                          : 'border border-coffee-cream/20 text-coffee-cream hover:border-maple-rust/40 hover:text-maple-rust'
                      }`}
                    >
                      All ({writings.length})
                    </button>
                    {allTags.slice(0, 10).map(({ tag, count }) => (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-label text-[0.6rem] uppercase tracking-wider transition-all ${
                          activeTag === tag
                            ? 'bg-porch-sage/20 border border-porch-sage/40 text-porch-sage'
                            : 'border border-coffee-cream/20 text-coffee-cream hover:border-maple-rust/40 hover:text-maple-rust'
                        }`}
                      >
                        <Tag size={10} />
                        {tag}
                        <span className={`ml-0.5 ${activeTag === tag ? 'text-porch-sage' : 'text-coffee-cream/50'}`}>
                          ({count})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Writings grid */}
              {filteredWritings.length === 0 ? (
                <div className="text-center py-16 animate-fade-in-up">
                  <Search className="mx-auto text-coffee-cream/30 mb-4" size={48} />
                  <p className="font-body text-coffee-cream italic">
                    No entries match your search.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWritings.map((writing, idx) => (
                    <WritingCard
                      key={writing.id}
                      writing={writing}
                      index={idx}
                      onOpen={handleOpen}
                      onDelete={requestDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // ============================================
        // ✍️ EDIT VIEW
        // ============================================
        <div className="animate-fade-in-up space-y-6">
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust font-label text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Back to Notebook
          </button>

          <form onSubmit={handleSave} className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-6">
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-transparent border-b border-coffee-cream/30 pb-2 font-display text-3xl text-yale-blue focus:outline-none focus:border-maple-rust placeholder-coffee-cream/30 transition-colors"
              placeholder="Title of your entry..."
            />
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="w-full bg-transparent h-96 font-body text-lg text-library-ink leading-relaxed focus:outline-none resize-none placeholder-coffee-cream/30"
              placeholder="Start writing your thoughts..."
            />
            <div className="flex items-center gap-2 border-t border-coffee-cream/20 pt-4">
              <Tag size={16} className="text-porch-sage" />
              <input
                type="text"
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                className="flex-1 bg-transparent font-label text-xs uppercase tracking-wider text-coffee-cream focus:outline-none placeholder-coffee-cream/30"
                placeholder="Add tags (comma-separated, e.g., thoughts, essay, 3am)"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors"
              >
                <Save size={16} /> Save Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this entry?"
        message={
          <>
            "<span className="italic text-library-ink">{deleteTarget?.title}</span>" will be
            permanently removed from your notebook. This cannot be undone.
          </>
        }
        confirmLabel="Delete Entry"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}