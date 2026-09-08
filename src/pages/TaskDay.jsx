import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Trash2, CheckCircle, Circle, Timer, Target } from 'lucide-react';

export default function TaskDay() {
  const { date } = useParams();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [title, setTitle] = useState('');
  
  const [category, setCategory] = useState('General');
  const [goalId, setGoalId] = useState('');
  const [goals, setGoals] = useState([]);
  const [priority, setPriority] = useState('B');
  
  const [loading, setLoading] = useState(true);

  const longDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    if (!user) return;
    const fetchDay = async () => {
      const [tasksRes, sessionsRes, goalsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, goals(title)')
          .eq('user_id', user.id)
          .eq('due_date', date)
          .order('created_at', { ascending: true }),
        supabase
          .from('pomodoro_sessions')
          .select('task_id, goal_task_id, duration')
          .eq('user_id', user.id)
          .eq('completed', true),
        supabase
          .from('goals')
          .select('id, title')
          .eq('user_id', user.id)
          .eq('status', 'active')
      ]);
      
      setTasks(tasksRes.data || []);
      setSessions(sessionsRes.data || []);
      setGoals(goalsRes.data || []);
      setLoading(false);
    };
    fetchDay();
  }, [user, date]);

  const timeSpentByTaskId = useMemo(() => {
    const totals = {};
    sessions.forEach(s => {
      if (s.task_id) totals[s.task_id] = (totals[s.task_id] || 0) + (s.duration || 0);
    });
    return totals;
  }, [sessions]);

  const formatTimeSpent = (minutes) => {
    if (!minutes || minutes < 1) return null;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const priorityOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const priorityA = a.priority || 'B';
      const priorityB = b.priority || 'B';
      return priorityOrder[priorityA] - priorityOrder[priorityB];
    });
  }, [tasks]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    const finalCategory = category === 'Goals' ? 'Goals' : category;
    const finalGoalId = category === 'Goals' ? (goalId || null) : null;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        user_id: user.id, 
        title: title.trim(), 
        due_date: date, 
        status: 'todo',
        category: finalCategory,
        goal_id: finalGoalId,
        priority: priority
      }])
      .select('*, goals(title)')
      .single();
      
    if (!error) {
      setTasks([...tasks, data]);
      setTitle('');
      setCategory('General');
      setGoalId('');
      setPriority('B');
    } else {
      console.error('Error adding task:', error);
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

  const priorityColors = {
    'A': 'bg-maple-rust text-page-cream',
    'B': 'bg-yale-blue text-page-cream',
    'C': 'bg-gilmore-gold text-yale-blue',
    'D': 'bg-coffee-cream text-page-cream'
  };

  if (loading) return <div className="text-center py-20 text-coffee-cream italic font-body">Loading your day...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <Link to="/tasks" className="inline-flex items-center gap-2 text-coffee-cream hover:text-maple-rust transition-colors">
        <ArrowLeft size={18} /> Back to Calendar
      </Link>

      <div>
        <p className="eyebrow mb-2">{pending} pending · {done} done</p>
        <h1 className="font-display text-3xl text-yale-blue">{longDate}</h1>
      </div>

      {/* Add Task Form */}
      <form onSubmit={addTask} className="space-y-3 bg-parchment p-4 rounded-sm border border-coffee-cream/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done this day?"
            className="flex-1 p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <button type="submit" className="bg-yale-blue text-page-cream px-4 rounded-sm hover:bg-maple-rust transition-colors">
            <Plus size={18} />
          </button>
        </div>
        
        {/* Category, Goal & Priority Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Category Dropdown */}
          <div className="flex-1">
            <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value !== 'Goals') setGoalId('');
              }}
              className="w-full p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            >
              <option value="General">General</option>
              <option value="Goals">Goals</option>
              <option value="Reading">Reading</option>
              <option value="Writing">Writing</option>
              <option value="Admin">Admin</option>
              <option value="Learning">Learning</option>
            </select>
          </div>

          {/* Goal Dropdown (Only shows if category is "Goals") */}
          {category === 'Goals' && (
            <div className="flex-1 animate-fade-in-up">
              <label className="block font-label text-[0.65rem] uppercase tracking-wider text-maple-rust mb-1">
                <Target size={10} className="inline mr-1" /> Select Goal
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                required={category === 'Goals'}
                className="w-full p-2.5 bg-page-cream border border-maple-rust/30 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
              >
                <option value="">-- Choose a Goal --</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
              {goals.length === 0 && (
                <p className="text-xs text-maple-rust mt-1 italic">No active goals. Create one first!</p>
              )}
            </div>
          )}

          {/* Priority Selector */}
          <div className="flex-1">
            <label className="block font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            >
              <option value="A">A - Urgent & Important</option>
              <option value="B">B - Important</option>
              <option value="C">C - Nice to do</option>
              <option value="D">D - Delegate/Later</option>
            </select>
          </div>
        </div>
      </form>

      {/* Tasks of the day - Sorted by Priority */}
      {tasks.length === 0 ? (
        <div className="cozy-card p-10 text-center">
          <p className="font-body text-coffee-cream italic">A blank page. Add your first task for this day.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((t) => (
            <div key={t.id} className="cozy-card p-4 flex items-start sm:items-center gap-3 group">
              <button onClick={() => toggleTask(t)} className={t.status === 'done' ? 'text-porch-sage' : 'text-coffee-cream hover:text-porch-sage transition-colors'}>
                {t.status === 'done' ? <CheckCircle size={20} /> : <Circle size={20} />}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-body text-sm ${t.status === 'done' ? 'line-through text-coffee-cream' : 'text-library-ink'}`}>
                    {t.title}
                  </span>
                  
                  {/* Priority Badge */}
                  <span className={`shrink-0 px-2 py-0.5 rounded-sm font-label text-[0.6rem] uppercase tracking-wider ${priorityColors[t.priority || 'B']}`}>
                    {t.priority || 'B'}
                  </span>
                  
                  {/* Category Badge */}
                  {t.category && t.category !== 'General' && (
                    <span className="shrink-0 px-2 py-0.5 bg-yale-blue/10 text-yale-blue rounded-sm font-label text-[0.6rem] uppercase tracking-wider">
                      {t.category}
                    </span>
                  )}
                  
                  {/* Linked Goal Badge */}
                  {t.goal_id && t.goals?.title && (
                    <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 bg-maple-rust/10 text-maple-rust rounded-sm font-label text-[0.6rem] uppercase tracking-wider">
                      <Target size={10} />
                      {t.goals.title}
                    </span>
                  )}
                </div>
                
                {timeSpentByTaskId[t.id] && (
                  <div className="flex items-center gap-1 mt-1.5 text-coffee-cream/60 font-label text-[0.65rem]">
                    <Timer size={10} />
                    {formatTimeSpent(timeSpentByTaskId[t.id])} spent
                  </div>
                )}
              </div>
              
              <button onClick={() => deleteTask(t.id)} className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100 transition-opacity mt-1 sm:mt-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}