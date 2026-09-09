import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, BookOpen, FileText, Target, CheckCircle, 
  XCircle, Clock, Award, AlertCircle, ArrowUp, ArrowDown,
  Calendar, BarChart3, Lightbulb, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function WeeklyReport() {
  const { user } = useAuth();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  useEffect(() => {
    if (user) fetchWeeklyReport();
  }, [user, currentWeekOffset]);

  const fetchWeeklyReport = async () => {
    setLoading(true);
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7) + (currentWeekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    // Fetch all data with proper columns
    const [
      sessionsRes,
      tasksRes,
      goalTasksRes,
      goalsRes,
      booksRes,
      materialsRes
    ] = await Promise.all([
      supabase.from('pomodoro_sessions')
        .select('duration, task_id, goal_id, goal_task_id, book_id, material_id, created_at')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('created_at', weekStartISO)
        .lte('created_at', weekEndISO),
      
      supabase.from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('user_id', user.id),
      
      supabase.from('goal_tasks')
        .select('id, title, completed, goal_id')
        .eq('user_id', user.id),
      
      supabase.from('goals')
        .select('id, title, current_value, target_value, status')
        .eq('user_id', user.id),
      
      supabase.from('books')
        .select('id, title, status')
        .eq('user_id', user.id),
      
      supabase.from('materials')
        .select('id, title')
        .eq('user_id', user.id),
    ]);

    const sessions = sessionsRes.data || [];
    const tasks = tasksRes.data || [];
    const goalTasks = goalTasksRes.data || [];
    const goals = goalsRes.data || [];
    const books = booksRes.data || [];
    const materials = materialsRes.data || [];

    // Calculate total time
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // ✅ Time by individual TASK
    const timeByTask = {};
    sessions.forEach(session => {
      if (session.task_id) {
        timeByTask[session.task_id] = (timeByTask[session.task_id] || 0) + session.duration;
      }
    });

    // ✅ Time by individual BOOK
    const timeByBook = {};
    sessions.forEach(session => {
      if (session.book_id) {
        timeByBook[session.book_id] = (timeByBook[session.book_id] || 0) + session.duration;
      }
    });

    // Time by GOAL
    const timeByGoal = {};
    sessions.forEach(session => {
      if (session.goal_id) {
        timeByGoal[session.goal_id] = (timeByGoal[session.goal_id] || 0) + session.duration;
      }
    });

    // Task statistics
    const completedTasks = tasks.filter(t => t.status === 'done');
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    const taskCompletionRate = tasks.length > 0 
      ? (completedTasks.length / tasks.length) * 100 
      : 0;

    // Goal progress
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');
    const avgGoalProgress = activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + (g.current_value / g.target_value) * 100, 0) / activeGoals.length
      : 0;

    // Book stats
    const readingBooks = books.filter(b => b.status === 'reading');

    // Calculate grade
    const grade = calculateGrade({
      taskCompletionRate,
      avgGoalProgress,
      totalHours: parseFloat(totalHours),
    });

    // Generate advice
    const advice = generateAdvice({
      taskCompletionRate,
      avgGoalProgress,
      totalHours: parseFloat(totalHours),
      pendingTasks,
      completedTasks,
      activeGoals,
      readingBooks,
    });

    // Daily breakdown for chart
    const dailyData = generateDailyData(sessions, weekStart, weekEnd);

    setReportData({
      weekStart,
      weekEnd,
      totalHours,
      totalMinutes,
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        pending: pendingTasks.length,
        completionRate: taskCompletionRate,
        byTask: timeByTask,
        pendingList: pendingTasks,
        allTasks: tasks, // Add this to look up task titles
      },
      goals: {
        total: goals.length,
        active: activeGoals.length,
        completed: completedGoals.length,
        avgProgress: avgGoalProgress,
        byGoal: timeByGoal,
        list: goals,
      },
      books: {
        total: books.length,
        reading: readingBooks.length,
        byBook: timeByBook,
        list: books,
      },
      materials: {
        total: materials.length,
      },
      grade,
      advice,
      dailyData,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-coffee-cream/20 rounded w-64 mx-auto mb-4"></div>
          <div className="h-4 bg-coffee-cream/10 rounded w-96 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Weekly Analysis</p>
          <h1 className="font-display text-4xl text-yale-blue">
            Week of <span className="italic text-maple-rust">
              {reportData.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeekOffset(prev => prev - 1)}
            className="p-2 border border-coffee-cream/30 rounded-sm hover:bg-page-cream transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentWeekOffset(0)}
            className="px-4 py-2 bg-yale-blue text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors"
          >
            This Week
          </button>
          <button
            onClick={() => setCurrentWeekOffset(prev => prev + 1)}
            disabled={currentWeekOffset >= 0}
            className="p-2 border border-coffee-cream/30 rounded-sm hover:bg-page-cream transition-colors disabled:opacity-40"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Grade Card */}
      <div className={`cozy-card p-8 border-l-4 ${getGradeColor(reportData.grade)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">Weekly Grade</p>
            <div className="flex items-center gap-4">
              <span className={`font-display text-6xl ${getGradeColor(reportData.grade).replace('border-', 'text-')}`}>
                {reportData.grade}
              </span>
              <div>
                <p className="font-body text-lg text-library-ink mb-1">{getGradeMessage(reportData.grade)}</p>
                <p className="font-label text-xs text-coffee-cream">
                  {reportData.totalHours} hours focused this week
                </p>
              </div>
            </div>
          </div>
          <Award size={64} className={getGradeColor(reportData.grade).replace('border-', 'text-')} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CheckCircle}
          label="Tasks Completed"
          value={`${reportData.tasks.completed}/${reportData.tasks.total}`}
          percentage={reportData.tasks.completionRate}
          color="text-porch-sage"
        />
        <StatCard
          icon={Target}
          label="Goal Progress"
          value={`${Math.round(reportData.goals.avgProgress)}%`}
          percentage={reportData.goals.avgProgress}
          color="text-maple-rust"
        />
        <StatCard
          icon={BookOpen}
          label="Books Reading"
          value={`${reportData.books.reading}/${reportData.books.total}`}
          percentage={reportData.books.total > 0 ? (reportData.books.reading / reportData.books.total) * 100 : 0}
          color="text-gilmore-gold"
        />
        <StatCard
          icon={Clock}
          label="Total Focus Time"
          value={`${reportData.totalHours}h`}
          percentage={Math.min(100, (parseFloat(reportData.totalHours) / 40) * 100)}
          color="text-yale-blue"
        />
      </div>

      {/* Daily Activity Chart */}
      <div className="cozy-card p-6">
        <h2 className="font-display text-xl text-yale-blue mb-4 flex items-center gap-2">
          <BarChart3 size={20} /> Daily Activity
        </h2>
        <div className="flex items-end gap-3 h-48 px-2">
          {reportData.dailyData.map((day, idx) => {
            const maxMinutes = Math.max(...reportData.dailyData.map(d => d.minutes), 1);
            const heightPct = (day.minutes / maxMinutes) * 100;
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-maple-rust/75 rounded-t-sm transition-all hover:bg-maple-rust"
                  style={{ height: `${heightPct}%` }}
                  title={`${day.label}: ${(day.minutes / 60).toFixed(1)}h`}
                />
                <span className="font-label text-[0.6rem] uppercase text-coffee-cream">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ✅ Tasks Time */}
        <div className="cozy-card p-6">
          <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
            <FileText size={18} /> Time by Task
          </h3>
          {Object.keys(reportData.tasks.byTask).length === 0 ? (
            <p className="text-coffee-cream italic text-sm">No task-specific time tracked</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(reportData.tasks.byTask)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([taskId, minutes]) => {
                  const task = reportData.tasks.allTasks.find(t => t.id === taskId) || { title: 'Unknown Task' };
                  return (
                    <div key={taskId} className="flex items-center justify-between py-2 border-b border-coffee-cream/10 last:border-0">
                      <span className="font-body text-sm text-library-ink truncate flex-1">
                        {task.title}
                      </span>
                      <span className="font-label text-xs text-coffee-cream ml-4">
                        {(minutes / 60).toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Goals Time */}
        <div className="cozy-card p-6">
          <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
            <Target size={18} /> Time by Goal
          </h3>
          {Object.keys(reportData.goals.byGoal).length === 0 ? (
            <p className="text-coffee-cream italic text-sm">No goal-specific time tracked</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(reportData.goals.byGoal)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([goalId, minutes]) => {
                  const goal = reportData.goals.list.find(g => g.id === goalId) || { title: 'Unknown Goal' };
                  return (
                    <div key={goalId} className="flex items-center justify-between py-2 border-b border-coffee-cream/10 last:border-0">
                      <span className="font-body text-sm text-library-ink truncate flex-1">
                        {goal.title}
                      </span>
                      <span className="font-label text-xs text-coffee-cream ml-4">
                        {(minutes / 60).toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ✅ Books Time - NEW */}
        <div className="cozy-card p-6">
          <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
            <BookOpen size={18} /> Time by Book
          </h3>
          {Object.keys(reportData.books.byBook).length === 0 ? (
            <p className="text-coffee-cream italic text-sm">No book reading time tracked</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(reportData.books.byBook)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([bookId, minutes]) => {
                  const book = reportData.books.list.find(b => b.id === bookId) || { title: 'Unknown Book' };
                  return (
                    <div key={bookId} className="flex items-center justify-between py-2 border-b border-coffee-cream/10 last:border-0">
                      <span className="font-body text-sm text-library-ink truncate flex-1">
                        {book.title}
                      </span>
                      <span className="font-label text-xs text-coffee-cream ml-4">
                        {(minutes / 60).toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Materials Time */}
        <div className="cozy-card p-6">
          <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
            <FileText size={18} /> Time by Material
          </h3>
          <p className="text-coffee-cream italic text-sm">Study material tracking coming soon</p>
        </div>
      </div>

      {/* Pending Tasks */}
      {reportData.tasks.pending.length > 0 && (
        <div className="cozy-card p-6 border-l-4 border-maple-rust">
          <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
            <XCircle size={18} className="text-maple-rust" /> Incomplete Tasks
          </h3>
          <div className="space-y-2">
            {reportData.tasks.pending.slice(0, 10).map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2 px-3 bg-page-cream rounded-sm">
                <AlertCircle size={14} className="text-maple-rust shrink-0" />
                <span className="font-body text-sm text-library-ink flex-1">{task.title}</span>
                {task.priority && (
                  <span className={`px-2 py-0.5 rounded-sm font-label text-[0.6rem] ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advice Section */}
      <div className="cozy-card p-6">
        <h3 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
          <Lightbulb size={18} className="text-gilmore-gold" /> Personalized Advice
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportData.advice.tasks && (
            <AdviceCard icon={FileText} category="Tasks" advice={reportData.advice.tasks} />
          )}
          {reportData.advice.goals && (
            <AdviceCard icon={Target} category="Goals" advice={reportData.advice.goals} />
          )}
          {reportData.advice.books && (
            <AdviceCard icon={BookOpen} category="Reading" advice={reportData.advice.books} />
          )}
          {reportData.advice.time && (
            <AdviceCard icon={Clock} category="Time Management" advice={reportData.advice.time} />
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Functions

function calculateGrade(metrics) {
  const { taskCompletionRate, avgGoalProgress, totalHours } = metrics;
  
  const score = (
    (taskCompletionRate * 0.3) +
    (avgGoalProgress * 0.3) +
    (Math.min(totalHours / 40 * 100, 100) * 0.4)
  );

  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getGradeColor(grade) {
  const colors = {
    'A': 'border-porch-sage text-porch-sage',
    'B': 'border-yale-blue text-yale-blue',
    'C': 'border-gilmore-gold text-gilmore-gold',
    'D': 'border-maple-rust text-maple-rust',
    'F': 'border-coffee-cream text-coffee-cream',
  };
  return colors[grade] || colors['C'];
}

function getGradeMessage(grade) {
  const messages = {
    'A': 'Outstanding work! You\'re excelling in all areas.',
    'B': 'Great job! Consistent progress across the board.',
    'C': 'Good effort. Room for improvement in some areas.',
    'D': 'Needs attention. Consider adjusting your approach.',
    'F': 'Time to refocus. Let\'s get back on track.',
  };
  return messages[grade] || messages['C'];
}

function generateAdvice(metrics) {
  const advice = {};

  if (metrics.taskCompletionRate < 50) {
    advice.tasks = "Focus on completing fewer tasks with higher quality. Try breaking large tasks into smaller, manageable steps.";
  } else if (metrics.taskCompletionRate < 80) {
    advice.tasks = "You're doing well! Try tackling high-priority tasks first thing in the morning when your energy is highest.";
  } else {
    advice.tasks = "Excellent task completion! Consider taking on more challenging projects or helping others with theirs.";
  }

  if (metrics.avgGoalProgress < 30) {
    advice.goals = "Your goals need more attention. Schedule dedicated time blocks each week specifically for goal-related work.";
  } else if (metrics.avgGoalProgress < 70) {
    advice.goals = "Steady progress! Try setting weekly milestones for your goals to maintain momentum.";
  } else {
    advice.goals = "Fantastic goal progress! You're on track to achieve your objectives. Keep up the consistency!";
  }

  if (metrics.readingBooks.length === 0) {
    advice.books = "Consider adding a book to your reading list. Even 10 pages a day can make a significant difference over time.";
  } else if (metrics.readingBooks.length < 3) {
    advice.books = "Good reading habit! Try to maintain consistency by setting aside specific reading time each evening.";
  } else {
    advice.books = "Impressive reading list! You're absorbing knowledge consistently. Consider taking notes to retain more.";
  }

  if (metrics.totalHours < 10) {
    advice.time = "Try to increase your focus time gradually. Start with one additional 25-minute session per day.";
  } else if (metrics.totalHours < 25) {
    advice.time = "Solid focus time! Try batching similar tasks together to maximize deep work sessions.";
  } else if (metrics.totalHours > 50) {
    advice.time = "Excellent dedication! Remember to balance intense focus with adequate rest to avoid burnout.";
  } else {
    advice.time = "Great time management! You're maintaining a healthy and productive balance.";
  }

  return advice;
}

function generateDailyData(sessions, weekStart, weekEnd) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    days.push({
      date: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: 0,
    });
  }

  sessions.forEach(session => {
    const sessionDate = session.created_at.split('T')[0];
    const dayEntry = days.find(d => d.date === sessionDate);
    if (dayEntry) {
      dayEntry.minutes += session.duration || 0;
    }
  });

  return days;
}

function StatCard({ icon: Icon, label, value, percentage, color }) {
  return (
    <div className="bg-page-cream p-5 rounded-sm border border-coffee-cream/20">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={color} />
        <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
          {label}
        </p>
      </div>
      <p className={`font-display text-2xl ${color} mb-2`}>{value}</p>
      <div className="w-full bg-coffee-cream/20 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}

function AdviceCard({ icon: Icon, category, advice }) {
  return (
    <div className="bg-parchment/50 p-4 rounded-sm border border-coffee-cream/20">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-maple-rust" />
        <h4 className="font-label text-xs uppercase tracking-wider text-coffee-cream">
          {category}
        </h4>
      </div>
      <p className="font-body text-sm text-library-ink leading-relaxed">
        {advice}
      </p>
    </div>
  );
}

function getPriorityColor(priority) {
  const colors = {
    'A': 'bg-maple-rust text-page-cream',
    'B': 'bg-yale-blue text-page-cream',
    'C': 'bg-gilmore-gold text-yale-blue',
    'D': 'bg-coffee-cream text-page-cream',
  };
  return colors[priority] || 'bg-coffee-cream/30 text-coffee-cream';
}