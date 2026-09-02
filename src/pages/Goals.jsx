import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import {
  Plus, Target, Trash2, ArrowUp, BookOpen, Search, CheckCircle,
  Circle, Calendar, Clock, X, ListChecks, Sparkles, ChevronDown,
  ChevronRight, Flame, Trophy, FolderOpen
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

// ============================================
// 🎨 CONSTANTS
// ============================================

const CATEGORIES = [
  { id: 'all', label: 'All', icon: FolderOpen, color: 'text-coffee-cream' },
  { id: 'Learning', label: 'Learning', icon: Sparkles, color: 'text-yale-blue' },
  { id: 'Reading', label: 'Reading', icon: BookOpen, color: 'text-maple-rust' },
  { id: 'Project', label: 'Project', icon: Flame, color: 'text-gilmore-gold' },
  { id: 'Habit', label: 'Habit', icon: Trophy, color: 'text-porch-sage' },
];

const STATUSES = [
  { id: 'all', label: 'All', icon: Target },
  { id: 'active', label: 'Active', icon: Flame },
  { id: 'completed', label: 'Completed', icon: Trophy },
];

// ============================================
// 🧠 MEMOIZED TASK ROW
// ============================================

const TaskRow = memo(function TaskRow({ task, onToggle, onDelete, onFocus }) {
  return (
    <div className="flex items-center gap-2 group py-1.5 px-2 rounded-sm hover:bg-page-cream/50 transition-colors">
      <button
        onClick={() => onToggle(task)}
        className="shrink-0 text-coffee-cream hover:text-maple-rust transition-colors"
      >
        {task.completed ? (
          <CheckCircle size={16} className="text-porch-sage" />
        ) : (
          <Circle size={16} />
        )}
      </button>
      <span className={`flex-1 font-body text-sm ${task.completed ? 'line-through text-coffee-cream/50' : 'text-library-ink'}`}>
        {task.title}
      </span>
      <button
        onClick={() => onFocus(task)}
        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-sm bg-gilmore-gold/20 text-gilmore-gold hover:bg-gilmore-gold hover:text-yale-blue font-label text-[0.6rem] uppercase tracking-wider transition-all"
      >
        <Clock size={10} /> Focus
      </button>
      <button
        onClick={() => onDelete(task)}
        className="opacity-0 group-hover:opacity-100 text-coffee-cream/40 hover:text-maple-rust transition-colors p-1"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
});

// ============================================
// 🧠 MEMOIZED GOAL CARD
// ============================================

const GoalCard = memo(function GoalCard({ goal, index, tasks, onAddTask, onToggleTask, onDeleteTask, onFocusTask, onDeleteGoal }) {
  const [expanded, setExpanded] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const percent = Math.round((goal.current_value / goal.target_value) * 100);
  const goalTasks = tasks.filter(t => t.goal_id === goal.id);
  const completedTasks = goalTasks.filter(t => t.completed).length;
  const category = CATEGORIES.find(c => c.id === goal.category) || CATEGORIES[1];
  const CategoryIcon = category.icon;

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onAddTask(goal.id, newTaskTitle.trim());
    setNewTaskTitle('');
    setAddingTask(false);
  };

  return (
    <div
      className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up hover:border-maple-rust/30 transition-all"
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <CategoryIcon size={14} className={category.color} />
          <span className={`font-label text-[0.6rem] uppercase tracking-wider ${category.color}`}>
            {goal.category}
          </span>
          {goal.deadline && (
            <span className="flex items-center gap-1 font-label text-[0.6rem] text-coffee-cream/60 uppercase tracking-wider">
              <Calendar size={10} />
              {new Date(goal.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => onDeleteGoal(goal)}
          className="text-coffee-cream/40 hover:text-maple-rust transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <h3 className={`font-display text-2xl mb-2 ${goal.status === 'completed' ? 'text-porch-sage line-through' : 'text-yale-blue'}`}>
        {goal.title}
      </h3>

      {goal.description && (
        <p className="text-coffee-cream text-sm font-body italic mb-4 line-clamp-2">{goal.description}</p>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs font-label uppercase tracking-wider text-coffee-cream mb-1">
          <span>Progress</span>
          <span className="text-maple-rust font-medium">{goal.current_value} / {goal.target_value} ({percent}%)</span>
        </div>
        <div className="w-full h-2 bg-parchment rounded-full overflow-hidden border border-coffee-cream/10">
          <div
            className="h-full bg-maple-rust transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Tasks section */}
      <div className="border-t border-coffee-cream/10 pt-3 mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full group"
        >
          <div className="flex items-center gap-2">
            <ListChecks size={14} className="text-maple-rust" />
            <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">
              Tasks ({completedTasks} / {goalTasks.length})
            </span>
          </div>
          <ChevronDown size={14} className={`text-coffee-cream transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-1 animate-fade-in-up">
            {goalTasks.length === 0 ? (
              <p className="font-body text-xs text-coffee-cream/60 italic text-center py-3">
                No tasks yet. Break down your goal into actionable steps.
              </p>
            ) : (
              goalTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={onToggleTask}
                  onDelete={onDeleteTask}
                  onFocus={onFocusTask}
                />
              ))
            )}

            {/* Add task form */}
            {addingTask ? (
              <form onSubmit={handleSubmitTask} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  autoFocus
                  placeholder="Task name..."
                  className="flex-1 px-3 py-1.5 bg-parchment border border-coffee-cream/20 rounded-sm font-body text-sm focus:outline-none focus:border-maple-rust"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-maple-rust text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingTask(false); setNewTaskTitle(''); }}
                  className="px-3 py-1.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setAddingTask(true)}
                className="w-full mt-2 flex items-center justify-center gap-1 py-2 border border-dashed border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-colors"
              >
                <Plus size={12} /> Add Task
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================
// 🏠 MAIN COMPONENT
// ============================================

export default function Goals() {
  const { user } = useAuth();
  const { setTaskContext } = useFocusTimer(); // ⚡ Link to Focus session

  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Learning',
    target_value: 10,
    deadline: ''
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');

  // Modals & notifications
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [goalsRes, tasksRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('goal_tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);

    if (!goalsRes.error) setGoals(goalsRes.data || []);
    if (!tasksRes.error) setTasks(tasksRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // 🧮 MEMOIZED DERIVATIONS
  // ============================================

  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;
    return {
      total: goals.length,
      activeGoals,
      completedGoals,
      totalTasks,
      completedTasks,
    };
  }, [goals, tasks]);

  const filteredGoals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return goals.filter(g => {
      const matchesCategory = activeCategory === 'all' || g.category === activeCategory;
      const matchesStatus = activeStatus === 'all' || g.status === activeStatus;
      const matchesSearch = q === '' ||
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [goals, searchQuery, activeCategory, activeStatus]);

  // ============================================
  // 🎯 GOAL CRUD
  // ============================================

  const handleAddGoal = useCallback(async (e) => {
    e.preventDefault();

    const goalData = {
      user_id: user.id,
      title: newGoal.title,
      description: newGoal.description,
      category: newGoal.category,
      target_value: newGoal.target_value,
      current_value: 0,
      status: 'active',
      deadline: newGoal.deadline || null
    };

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert([goalData])
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => [data, ...prev]);
      setIsAdding(false);
      setNewGoal({ title: '', description: '', category: 'Learning', target_value: 10, deadline: '' });
      showNotification(`"${data.title}" added to your syllabus! 📚`);
    } catch (err) {
      showNotification(`Failed to add goal: ${err.message}`, 'error');
    }
  }, [newGoal, user, showNotification]);

  const requestDeleteGoal = useCallback((goal) => {
    setDeleteTarget({ type: 'goal', data: goal });
  }, []);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    if (target.type === 'goal') {
      setGoals(prev => prev.filter(g => g.id !== target.data.id));
      setTasks(prev => prev.filter(t => t.goal_id !== target.data.id));
      const { error } = await supabase.from('goals').delete().eq('id', target.data.id);
      if (error) {
        fetchGoals();
        showNotification('Failed to delete goal.', 'error');
      } else {
        showNotification(`"${target.data.title}" removed.`);
      }
    } else if (target.type === 'task') {
      setTasks(prev => prev.filter(t => t.id !== target.data.id));
      const { error } = await supabase.from('goal_tasks').delete().eq('id', target.data.id);
      if (error) {
        fetchGoals();
        showNotification('Failed to delete task.', 'error');
      } else {
        showNotification('Task removed.');
      }
    }
  }, [deleteTarget, fetchGoals, showNotification]);

  // ============================================
  // ✅ TASK MANAGEMENT
  // ============================================

  const handleAddTask = useCallback(async (goalId, title) => {
    try {
      const { data, error } = await supabase
        .from('goal_tasks')
        .insert([{
          goal_id: goalId,
          user_id: user.id,
          title,
          completed: false
        }])
        .select()
        .single();

      if (error) throw error;
      setTasks(prev => [...prev, data]);
      showNotification('Task added! ✨');
    } catch (err) {
      showNotification(`Failed to add task: ${err.message}`, 'error');
    }
  }, [user, showNotification]);

  const handleToggleTask = useCallback(async (task) => {
    const newCompleted = !task.completed;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted } : t));

    try {
      const { error } = await supabase
        .from('goal_tasks')
        .update({ completed: newCompleted })
        .eq('id', task.id);

      if (error) throw error;

      // Auto-update goal progress based on completed tasks ratio
      const goalTasks = tasks.filter(t => t.goal_id === task.goal_id);
      const goal = goals.find(g => g.id === task.goal_id);
      if (goal) {
        const completedCount = goalTasks.filter(t =>
          t.id === task.id ? newCompleted : t.completed
        ).length;
        const totalTasks = goalTasks.length;

        // Map tasks completion ratio to goal target
        const newValue = Math.round((completedCount / totalTasks) * goal.target_value);
        const newStatus = newValue >= goal.target_value ? 'completed' : 'active';

        await supabase
          .from('goals')
          .update({ current_value: newValue, status: newStatus })
          .eq('id', task.goal_id);

        setGoals(prev => prev.map(g =>
          g.id === task.goal_id ? { ...g, current_value: newValue, status: newStatus } : g
        ));
      }
    } catch (err) {
      // Rollback
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
      showNotification('Failed to update task.', 'error');
    }
  }, [tasks, goals, showNotification]);

  const requestDeleteTask = useCallback((task) => {
    setDeleteTarget({ type: 'task', data: task });
  }, []);

  // ⚡ LINK TO FOCUS SESSION
  const handleFocusTask = useCallback((task) => {
    const goal = goals.find(g => g.id === task.goal_id);
    if (setTaskContext) {
      setTaskContext({
        taskId: task.id,
        taskTitle: task.title,
        goalTitle: goal?.title || '',
        goalId: task.goal_id
      });
    }
    // Navigate to Focus page
    window.location.href = '/focus';
  }, [goals, setTaskContext]);

  // ============================================
  // 🎨 RENDER
  // ============================================

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
        <div>
          <p className="eyebrow mb-2">The Syllabus</p>
          <h1 className="font-display text-4xl text-yale-blue">
            Long-term <span className="italic text-maple-rust">Goals</span>.
          </h1>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors"
        >
          <Plus size={16} /> {isAdding ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-yale-blue" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Total Goals</p>
          </div>
          <p className="font-display text-2xl text-yale-blue">{stats.total}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={16} className="text-maple-rust" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Active</p>
          </div>
          <p className="font-display text-2xl text-maple-rust">{stats.activeGoals}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <ListChecks size={16} className="text-gilmore-gold" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Tasks</p>
          </div>
          <p className="font-display text-2xl text-gilmore-gold">
            {stats.completedTasks} / {stats.totalTasks}
          </p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-porch-sage" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Completed</p>
          </div>
          <p className="font-display text-2xl text-porch-sage">{stats.completedGoals}</p>
        </div>
      </div>

      {/* Add Goal Form */}
      {isAdding && (
        <form onSubmit={handleAddGoal} className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Title</label>
              <input
                type="text"
                required
                value={newGoal.title}
                onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
                placeholder="e.g., Learn Astrophysics"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Description</label>
              <textarea
                value={newGoal.description}
                onChange={e => setNewGoal({ ...newGoal, description: e.target.value })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body h-20 resize-none"
                placeholder="What do you want to achieve?"
              />
            </div>
            <div>
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Category</label>
              <select
                value={newGoal.category}
                onChange={e => setNewGoal({ ...newGoal, category: e.target.value })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              >
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Target (Sessions/Units)</label>
              <input
                type="number"
                required
                min="1"
                value={newGoal.target_value}
                onChange={e => setNewGoal({ ...newGoal, target_value: parseInt(e.target.value) || 1 })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Deadline (optional)</label>
              <input
                type="date"
                value={newGoal.deadline}
                onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-maple-rust text-page-cream py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors mt-2">
            Add to Syllabus
          </button>
        </form>
      )}

      {/* Search + Filters */}
      {goals.length > 0 && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search goals..."
              className="w-full pl-11 pr-4 py-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
            />
          </div>

          {/* Status tabs */}
          <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2">
            {STATUSES.map(s => {
              const Icon = s.icon;
              const count = s.id === 'all' ? goals.length : goals.filter(g => g.status === s.id).length;
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
              const count = c.id === 'all' ? goals.length : goals.filter(g => g.category === c.id).length;
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
                  {c.label}
                  <span className={`ml-0.5 ${isActive ? 'text-maple-rust' : 'text-coffee-cream/50'}`}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Goals List */}
      {loading ? (
        <p className="text-center text-coffee-cream italic py-10 font-body">Consulting the syllabus...</p>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <Target className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic mb-4">
            No goals yet. Add your first syllabus item to begin your journey.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors"
          >
            <Plus size={16} /> Add Your First Goal
          </button>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <Search className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">No goals match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGoals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={requestDeleteTask}
              onFocusTask={handleFocusTask}
              onDeleteGoal={requestDeleteGoal}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'goal' ? 'Delete this goal?' : 'Delete this task?'}
        message={
          deleteTarget?.type === 'goal' ? (
            <>
              "<span className="italic text-library-ink">{deleteTarget?.data?.title}</span>" and
              all its tasks will be permanently removed. This cannot be undone.
            </>
          ) : (
            <>
              "<span className="italic text-library-ink">{deleteTarget?.data?.title}</span>" will
              be removed from this goal.
            </>
          )
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}