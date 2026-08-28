import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Feather, Trash2, Save, ArrowLeft, Tag } from 'lucide-react';

export default function Notebook() {
  const { user } = useAuth();
  const [writings, setWritings] = useState([]);
  const [selectedWriting, setSelectedWriting] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({ title: '', content: '', tags: '' });

  useEffect(() => {
    fetchWritings();
  }, [user]);

  const fetchWritings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('writings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setWritings(data || []);
    setLoading(false);
  };

  const handleNew = () => {
    setFormData({ title: '', content: '', tags: '' });
    setSelectedWriting(null);
    setIsEditing(true);
  };

  const handleEdit = (writing) => {
    setFormData({ title: writing.title, content: writing.content || '', tags: writing.tags || '' });
    setSelectedWriting(writing);
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    let error;

    if (selectedWriting) {
      const res = await supabase
        .from('writings')
        .update({ ...formData, updated_at: new Date() })
        .eq('id', selectedWriting.id);
      error = res.error;
    } else {
      const res = await supabase
        .from('writings')
        .insert([{ user_id: user.id, ...formData }])
        .select()
        .single();
      error = res.error;
      if (!res.error) setSelectedWriting(res.data);
    }

    if (!error) {
      setIsEditing(false);
      fetchWritings();
    }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('writings').delete().eq('id', id);
    if (!error) {
      setWritings(writings.filter(w => w.id !== id));
      if (selectedWriting?.id === id) setIsEditing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {!isEditing ? (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
            <div>
              <p className="eyebrow mb-2">Personal Reflections</p>
              <h1 className="font-display text-4xl text-yale-blue">
                The <span className="italic text-maple-rust">Notebook</span>.
              </h1>
            </div>
            <button 
              onClick={handleNew}
              className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust transition-colors"
            >
              <Plus size={16} /> New Entry
            </button>
          </div>

          {loading ? (
            <p className="text-center text-coffee-cream italic py-10">Sharpening quills...</p>
          ) : writings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <Feather className="mx-auto text-coffee-cream/30 mb-4" size={48} />
              <p className="font-body text-coffee-cream italic">The pages are blank. Write your first thought.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {writings.map((writing, i) => (
                <div key={writing.id} className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up group hover:border-maple-rust/50 transition-all cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => handleEdit(writing)}>
                  <h3 className="font-display text-2xl text-yale-blue mb-2 group-hover:text-maple-rust transition-colors">{writing.title}</h3>
                  <p className="font-body text-sm text-coffee-cream line-clamp-3 mb-4 italic">
                    {writing.content ? writing.content.substring(0, 150) + '...' : 'No content yet...'}
                  </p>
                  <div className="flex justify-between items-center pt-4 border-t border-coffee-cream/10">
                    <span className="font-ui text-[0.6rem] uppercase tracking-widest text-porch-sage">
                      {new Date(writing.created_at).toLocaleDateString()}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(writing.id); }} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="animate-fade-in-up space-y-6">
          <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust font-ui text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Notebook
          </button>
          
          <form onSubmit={handleSave} className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-6">
            <input 
              type="text" required value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full bg-transparent border-b border-coffee-cream/30 pb-2 font-display text-3xl text-yale-blue focus:outline-none focus:border-maple-rust placeholder-coffee-cream/30"
              placeholder="Title of your entry..."
            />
            <textarea 
              value={formData.content} 
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full bg-transparent h-96 font-body text-lg text-library-ink leading-relaxed focus:outline-none resize-none placeholder-coffee-cream/30"
              placeholder="Start writing your thoughts..."
            />
            <div className="flex items-center gap-2 border-t border-coffee-cream/20 pt-4">
              <Tag size={16} className="text-porch-sage" />
              <input 
                type="text" value={formData.tags} 
                onChange={e => setFormData({...formData, tags: e.target.value})}
                className="flex-1 bg-transparent font-ui text-xs uppercase tracking-widest text-coffee-cream focus:outline-none placeholder-coffee-cream/30"
                placeholder="Add tags (e.g., thoughts, essay, 3am)"
              />
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-yale-blue transition-colors">
                <Save size={16} /> Save Entry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}