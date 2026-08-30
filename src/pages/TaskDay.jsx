import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

export default function TaskDay() {
  const { date } = useParams(); // e.g. "2026-08-31"
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    if (!user) return;
    const fetchDay = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('due_date', date)
        .order('created_at', { ascending: true });
      setTasks(data || []);
      setLoading(false);
    };
    fetchDay();
  }, [user, date]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ user_id: user.id, title: title.trim(), due_date: date, status: 'todo' }])
      .select()
      .single();
    if (!error) {
      setTasks([...tasks, data]);
      setTitle('');
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
  };

  const deleteTask = async (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  const pending = tasks.filter((t) => t.status !== 'done').length;
  const done = tasks.length - pending;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <Link to="/tasks" className="inline-flex items-center gap-2 text-coffee-cream hover:text-maple-rust transition-colors">
        <ArrowLeft size={18} /> Back to Calendar
      </Link>

      <div>
        <p className="eyebrow mb-2">{pending} pending · {done} done</p>
        <h1 className="font-display text-3xl text-yale-blue">{longDate}</h1>
      </div>

      {/* Add task for this day */}
      <form onSubmit={addTask} className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done this day?"
          className="flex-1 p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
        />
        <button type="submit" className="bg-yale-blue text-page-cream px-4 rounded-sm hover:bg-maple-rust transition-colors">
          <Plus size={18} />
        </button>
      </form>

      {/* Tasks of the day */}
      {tasks.length === 0 ? (
        <div className="cozy-card p-10 text-center">
          <p className="font-body text-coffee-cream italic">A blank page. Add your first task for this day.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="cozy-card p-4 flex items-center gap-3 group">
              <button onClick={() => toggleTask(t)} className={t.status === 'done' ? 'text-porch-sage' : 'text-coffee-cream hover:text-porch-sage transition-colors'}>
                {t.status === 'done' ? <CheckCircle size={20} /> : <Circle size={20} />}
              </button>
              <span className={`flex-1 font-body text-sm ${t.status === 'done' ? 'line-through text-coffee-cream' : 'text-library-ink'}`}>
                {t.title}
              </span>
              <button onClick={() => deleteTask(t.id)} className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}