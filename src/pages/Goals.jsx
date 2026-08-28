import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Target, Trash2, ArrowUp, BookOpen } from 'lucide-react';

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Learning',
    target_value: 10,
    deadline: ''
  });

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setGoals(data || []);
    setLoading(false);
  };

      const handleAddGoal = async (e) => {
    e.preventDefault();
    
    // Fix: Convert empty deadline to null
    const goalData = {
      user_id: user.id,
      title: newGoal.title,
      description: newGoal.description,
      category: newGoal.category,
      target_value: newGoal.target_value,
      current_value: 0,
      status: 'active',
      deadline: newGoal.deadline || null  // <-- This fixes the error!
    };

    const { data, error } = await supabase
      .from('goals')
      .insert([goalData])
      .select()
      .single();

    if (error) {
      alert("Database Error: " + error.message);
      console.error(error);
      return;
    }

    setGoals([data, ...goals]);
    setIsAdding(false);
    setNewGoal({ title: '', description: '', category: 'Learning', target_value: 10, deadline: '' });
  };
  
  const incrementProgress = async (goal, amount) => {
    const newValue = Math.min(goal.current_value + amount, goal.target_value);
    const newStatus = newValue >= goal.target_value ? 'completed' : 'active';

    const { error } = await supabase
      .from('goals')
      .update({ current_value: newValue, status: newStatus })
      .eq('id', goal.id);

    if (!error) {
      setGoals(goals.map(g => g.id === goal.id ? { ...g, current_value: newValue, status: newStatus } : g));
    }
  };

  const deleteGoal = async (id) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) setGoals(goals.filter(g => g.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
        <div>
          <p className="eyebrow mb-2">The Syllabus</p>
          <h1 className="font-display text-4xl text-yale-blue">
            Long-term <span className="italic text-maple-rust">Goals</span>.
          </h1>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-maple-rust transition-colors"
        >
          <Plus size={16} /> {isAdding ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      {/* Add Goal Form */}
      {isAdding && (
        <form onSubmit={handleAddGoal} className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Title</label>
              <input 
                type="text" required value={newGoal.title} 
                onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
                placeholder="e.g., Learn Astrophysics"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Description</label>
              <textarea 
                value={newGoal.description} 
                onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body h-20 resize-none"
                placeholder="What do you want to achieve?"
              />
            </div>
            <div>
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Category</label>
              <select 
                value={newGoal.category} 
                onChange={e => setNewGoal({...newGoal, category: e.target.value})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              >
                <option>Learning</option>
                <option>Reading</option>
                <option>Project</option>
                <option>Habit</option>
              </select>
            </div>
            <div>
              <label className="block font-ui text-xs uppercase tracking-widest text-coffee-cream mb-1">Target (Sessions/Units)</label>
              <input 
                type="number" required min="1" value={newGoal.target_value} 
                onChange={e => setNewGoal({...newGoal, target_value: parseInt(e.target.value)})}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-maple-rust text-page-cream py-3 rounded-sm font-ui text-xs uppercase tracking-widest hover:bg-yale-blue transition-colors mt-2">
            Add to Syllabus
          </button>
        </form>
      )}

      {/* Goals List */}
      {loading ? (
        <p className="text-center text-coffee-cream italic">Consulting the syllabus...</p>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <Target className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">No goals yet. Add your first syllabus item to begin your journey.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal, i) => {
            const percent = (goal.current_value / goal.target_value) * 100;
            return (
              <div key={goal.id} className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="eyebrow text-porch-sage">{goal.category}</span>
                    <h3 className={`font-display text-2xl ${goal.status === 'completed' ? 'text-porch-sage line-through' : 'text-yale-blue'}`}>
                      {goal.title}
                    </h3>
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
                
                {goal.description && <p className="text-coffee-cream text-sm font-body mb-4">{goal.description}</p>}

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-ui text-coffee-cream mb-1">
                    <span>Progress</span>
                    <span>{goal.current_value} / {goal.target_value} ({Math.round(percent)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-parchment rounded-full overflow-hidden border border-coffee-cream/10">
                    <div 
                      className="h-full bg-maple-rust transition-all duration-500 ease-out" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                {goal.status !== 'completed' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => incrementProgress(goal, 1)}
                      className="flex items-center gap-1 bg-parchment border border-coffee-cream/20 px-3 py-1.5 rounded-sm font-ui text-xs text-library-ink hover:border-maple-rust hover:text-maple-rust transition-colors"
                    >
                      <ArrowUp size={14} /> +1 Session
                    </button>
                    <button 
                      onClick={() => incrementProgress(goal, 5)}
                      className="flex items-center gap-1 bg-parchment border border-coffee-cream/20 px-3 py-1.5 rounded-sm font-ui text-xs text-library-ink hover:border-maple-rust hover:text-maple-rust transition-colors"
                    >
                      <ArrowUp size={14} /> +5 Sessions
                    </button>
                  </div>
                )}
                {goal.status === 'completed' && (
                  <div className="flex items-center gap-2 text-porch-sage font-ui text-xs uppercase tracking-widest">
                    <BookOpen size={16} /> Syllabus Completed
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}