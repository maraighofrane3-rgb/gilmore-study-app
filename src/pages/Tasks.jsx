import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle, Circle, Trash2 } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setTasks(data || []);
      setLoading(false);
    };
    fetchTasks();
  }, [user]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Group tasks by due_date
  const byDate = {};
  tasks.forEach((t) => {
    if (t.due_date) (byDate[t.due_date] = byDate[t.due_date] || []).push(t);
  });
  const unscheduled = tasks.filter((t) => !t.due_date);

  // Build calendar cells (Monday first)
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const todayKey = keyOf(new Date());
  const monthTasks = tasks.filter((t) => t.due_date && t.due_date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
  };

  const deleteTask = async (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{monthTasks.length} task{monthTasks.length !== 1 ? 's' : ''} this month</p>
          <h1 className="font-display text-4xl text-yale-blue">Study <span className="italic text-maple-rust">Calendar</span>.</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 border border-coffee-cream/30 rounded-sm text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setViewDate(new Date())} className="px-3 py-2 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-colors">
            Today
          </button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 border border-coffee-cream/30 rounded-sm text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Month title */}
      <p className="font-display text-2xl text-yale-blue">{monthName}</p>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((w) => (
          <p key={w} className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream text-center">{w}</p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const key = keyOf(d);
          const dayTasks = byDate[key] || [];
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              onClick={() => navigate(`/tasks/${key}`)}
              className={`min-h-[96px] rounded-sm border p-2 text-left transition-all group flex flex-col gap-1 ${
                isToday
                  ? 'border-maple-rust bg-maple-rust/10 shadow-cozy'
                  : 'border-coffee-cream/20 bg-parchment hover:border-maple-rust/50 hover:shadow-cozy'
              }`}
            >
              <span className={`font-label text-xs ${isToday ? 'text-maple-rust font-bold' : 'text-coffee-cream'}`}>
                {d.getDate()}
              </span>
              <div className="space-y-1 w-full">
                {dayTasks.slice(0, 2).map((t) => (
                  <div
                    key={t.id}
                    className={`truncate text-[0.65rem] px-1.5 py-0.5 rounded-sm font-body ${
                      t.status === 'done'
                        ? 'bg-porch-sage/20 text-porch-sage line-through'
                        : 'bg-yale-blue/10 text-yale-blue'
                    }`}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <span className="text-[0.6rem] font-label text-coffee-cream">+{dayTasks.length - 2} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Unscheduled tasks (created before the calendar existed) */}
      {unscheduled.length > 0 && (
        <div className="cozy-card p-6 space-y-3">
          <h3 className="font-display text-lg text-yale-blue">Unscheduled Tasks</h3>
          <p className="font-body text-xs text-coffee-cream italic">These tasks have no date yet — open a day above to schedule new ones.</p>
          <div className="space-y-2">
            {unscheduled.map((t) => (
              <div key={t.id} className="flex items-center gap-3 bg-page-cream border border-coffee-cream/20 rounded-sm p-3">
                <button onClick={() => toggleTask(t)} className={t.status === 'done' ? 'text-porch-sage' : 'text-coffee-cream hover:text-porch-sage'}>
                  {t.status === 'done' ? <CheckCircle size={18} /> : <Circle size={18} />}
                </button>
                <span className={`flex-1 font-body text-sm ${t.status === 'done' ? 'line-through text-coffee-cream' : 'text-library-ink'}`}>
                  {t.title}
                </span>
                <button onClick={() => deleteTask(t.id)} className="text-coffee-cream/40 hover:text-maple-rust">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}