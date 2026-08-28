import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, CheckCircle, Circle, Feather, Trash2 } from 'lucide-react';
import TaskPrioritizer from '../components/TaskPrioritizer';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching tasks:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ user_id: user.id, title: newTaskTitle, status: 'todo' }])
      .select()
      .single();
    if (error) console.error('Error adding task:', error);
    else {
      setTasks([data, ...tasks]);
      setNewTaskTitle('');
    }
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === 'todo' ? 'completed' : 'todo';

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);
    if (error) console.error('Error updating task:', error);
    else {
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    }
  };

  // ✅ NEW: Delete function
  const handleDelete = async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) console.error('Error deleting task:', error);
    else {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const doneCount = tasks.length - pendingCount;

  return (
    <div className="max-w-2xl mx-auto">
      <p className="eyebrow mb-2">
        {tasks.length === 0 ? 'Nothing on the list yet' : `${pendingCount} pending · ${doneCount} done`}
      </p>
      <h1 className="font-display text-4xl text-yale-blue mb-6">
        Today's <span className="italic text-maple-rust">Tasks</span>.
      </h1>

      <form onSubmit={addTask} className="flex gap-2 mb-8 animate-fade-in-up">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 p-3 border border-coffee-cream/30 rounded-sm bg-parchment text-library-ink font-body focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust transition-colors"
        />
        <button
          type="submit"
          className="bg-yale-blue text-page-cream p-3 rounded-sm hover:bg-maple-rust transition-colors"
        >
          <Plus size={24} />
        </button>
      </form>

      {loading ? (
        <p className="text-coffee-cream text-center font-body italic">Gathering your thoughts...</p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 animate-fade-in-up">
          <Feather className="text-porch-sage" size={28} />
          <p className="text-coffee-cream text-center italic font-body">
            Your desk is clear. Add a task to begin.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          <TaskPrioritizer 
            tasks={tasks} 
            onReorder={(newOrder) => setTasks(newOrder)} 
          />
          {tasks.map((task, i) => (
            <li
              key={task.id}
              className="flex items-center gap-4 p-4 bg-parchment rounded-sm border border-coffee-cream/20 shadow-cozy hover:-translate-y-0.5 hover:border-coffee-cream/40 transition-all animate-fade-in-up group"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <button onClick={() => toggleTaskStatus(task)} className="shrink-0">
                {task.status === 'completed' ? (
                  <CheckCircle className="text-maple-rust" size={24} />
                ) : (
                  <Circle className="text-coffee-cream/50 hover:text-porch-sage transition-colors" size={24} />
                )}
              </button>
              <span className={`font-body text-lg flex-1 ${task.status === 'completed' ? 'line-through text-coffee-cream/50' : 'text-library-ink'}`}>
                {task.title}
              </span>
              
              {/* ✅ NEW: Delete Button */}
              <button
                onClick={() => handleDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 text-coffee-cream/40 hover:text-maple-rust transition-all p-1"
                title="Delete task"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}