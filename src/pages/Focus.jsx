import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Play, Pause, RotateCcw, CheckCircle, BookOpen, Target, TrendingUp } from 'lucide-react';

export default function Focus() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState(25);
  
  // Daily goal states
  const [dailyGoal, setDailyGoal] = useState(2); // hours
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  
  const timerRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    fetchDailyGoal();
    fetchTodayProgress();
    fetchWeeklyStats();
  }, [user]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleComplete();
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'todo');
    if (data) setTasks(data);
  };

  const fetchDailyGoal = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('daily_goal_hours')
      .eq('id', user.id)
      .single();
    if (data?.daily_goal_hours) setDailyGoal(data.daily_goal_hours);
  };

  const fetchTodayProgress = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('pomodoro_sessions')
      .select('duration')
      .eq('user_id', user.id)
      .gte('created_at', today)
      .eq('completed', true);

    const totalMinutes = data?.reduce((sum, session) => sum + session.duration, 0) || 0;
    setTodayMinutes(totalMinutes);
  };

  const fetchWeeklyStats = async () => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const { data } = await supabase
      .from('pomodoro_sessions')
      .select('duration, created_at')
      .eq('user_id', user.id)
      .gte('created_at', weekAgo.toISOString())
      .eq('completed', true)
      .order('created_at', { ascending: true });

    // Group by day
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const stats = {};
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];
      stats[dateStr] = { day: dayName, minutes: 0, date: dateStr };
    }

    data?.forEach(session => {
      const dateStr = session.created_at.split('T')[0];
      if (stats[dateStr]) {
        stats[dateStr].minutes += session.duration;
      }
    });

    setWeeklyData(Object.values(stats));
  };

  const handleComplete = async () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    
    const { error } = await supabase.from('pomodoro_sessions').insert([
      {
        user_id: user.id,
        task_id: selectedTaskId || null,
        duration: mode,
        completed: true,
      }
    ]);

    if (!error) {
      alert(`✦ FOCUS COMPLETE ✦\n\n${mode} minutes saved.`);
      fetchTodayProgress();
      fetchWeeklyStats();
    }
    resetTimer();
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    setTimeLeft(mode * 60);
  };

  const changeMode = (newMode) => {
    setMode(newMode);
    setIsActive(false);
    clearInterval(timerRef.current);
    setTimeLeft(newMode * 60);
  };

  const updateDailyGoal = async (newGoal) => {
    setDailyGoal(newGoal);
    await supabase
      .from('profiles')
      .update({ daily_goal_hours: newGoal })
      .eq('id', user.id);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const dailyProgressPercent = Math.min((todayMinutes / (dailyGoal * 60)) * 100, 100);
  const weeklyTotalHours = (weeklyData.reduce((sum, day) => sum + day.minutes, 0) / 60).toFixed(1);

  // Weekly chart visualization
  const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 120);
  const chartHeight = 200;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="eyebrow mb-2">Deep Work</p>
        <h1 className="font-display text-4xl text-yale-blue">
          What are you <span className="italic text-maple-rust">working on</span>?
        </h1>
      </div>

      {/* Daily Goal Progress */}
      <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-4">
          <div className="flex items-center gap-3">
            <Target className="text-maple-rust" size={24} />
            <div>
              <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Daily Goal</h3>
              <p className="font-display text-2xl text-yale-blue">{dailyGoal} hours</p>
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-body text-coffee-cream">
                {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m completed
              </span>
              <span className="font-display text-maple-rust">{Math.round(dailyProgressPercent)}%</span>
            </div>
            <div className="w-full h-3 bg-parchment rounded-full overflow-hidden border border-coffee-cream/10">
              <div 
                className="h-full bg-gradient-to-r from-maple-rust to-yale-blue transition-all duration-1000"
                style={{ width: `${dailyProgressPercent}%` }}
              />
            </div>
          </div>

                    <div className="flex items-center gap-2">
           <input
  type="number"
  min="0.5"
  max="24"
  step="0.5"
  value={dailyGoal}
  onChange={(e) => {
    let val = parseFloat(e.target.value);
    // Cap the value between 0.5 and 24 hours
    if (val > 24) val = 24; 
    if (val < 0.5) val = 0.5; 
    updateDailyGoal(val);
  }}
  className="w-24 bg-parchment border border-coffee-cream/20 rounded-sm px-3 py-2 font-ui text-sm focus:outline-none focus:border-maple-rust text-center"
/>
            <span className="font-ui text-xs text-coffee-cream">hours/day</span>
          </div>
        </div>
      </div>

      {/* Task Selector */}
      <div className="relative max-w-md mx-auto animate-fade-in-up">
        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" size={20} />
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-page-cream border border-coffee-cream/20 rounded-sm text-library-ink font-body focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust appearance-none cursor-pointer"
        >
          <option value="">Select a task (optional)...</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>{task.title}</option>
          ))}
        </select>
      </div>

      {/* Timer Display */}
      <div className="py-8 text-center animate-fade-in-up">
        <p className="font-display text-8xl md:text-9xl text-yale-blue tracking-tight tabular-nums">
          {formatTime(timeLeft)}
        </p>
        <p className="font-ui text-sm uppercase tracking-widest text-coffee-cream mt-2">
          FOCUS TIME
        </p>
      </div>

      {/* Mode Toggles */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {[25, 45, 60, 120].map((duration) => (
          <button
            key={duration}
            onClick={() => changeMode(duration)}
            className={`px-4 py-2 rounded-sm font-ui text-xs uppercase tracking-wider transition-all ${
              mode === duration 
                ? 'bg-yale-blue text-page-cream' 
                : 'bg-page-cream text-coffee-cream border border-coffee-cream/20 hover:border-maple-rust'
            }`}
          >
            {duration === 25 ? '25m' : duration === 45 ? '45m' : duration === 60 ? '1h' : '2h'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={toggleTimer}
          className="flex items-center gap-2 bg-maple-rust text-page-cream px-8 py-4 rounded-sm font-ui text-sm uppercase tracking-widest hover:bg-yale-blue transition-colors shadow-cozy"
        >
          {isActive ? <Pause size={20} /> : <Play size={20} />}
          {isActive ? 'Pause' : 'Start Focus'}
        </button>
        <button
          onClick={resetTimer}
          className="flex items-center gap-2 bg-page-cream text-coffee-cream border border-coffee-cream/30 px-6 py-4 rounded-sm font-ui text-sm uppercase tracking-widest hover:border-maple-rust hover:text-maple-rust transition-colors"
        >
          <RotateCcw size={20} />
          Reset
        </button>
      </div>

      {/* Weekly Progress Chart */}
      <div className="bg-page-cream p-8 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-porch-sage" size={24} />
            <div>
              <h3 className="font-ui text-xs uppercase tracking-widest text-coffee-cream">Weekly Progress</h3>
              <p className="font-display text-xl text-yale-blue">{weeklyTotalHours} hours this week</p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-64 flex items-end justify-between gap-2 px-4">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[100, 75, 50, 25, 0].map(percent => (
              <div key={percent} className="border-t border-coffee-cream/10 w-full h-0 flex items-center">
                <span className="text-[10px] text-coffee-cream/40 -mt-5">{percent}%</span>
              </div>
            ))}
          </div>

          {/* Bars and Points */}
          {weeklyData.map((day, index) => {
            const height = (day.minutes / maxMinutes) * chartHeight;
            const percent = Math.round((day.minutes / (dailyGoal * 60)) * 100);
            const hours = (day.minutes / 60).toFixed(1);
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2 relative">
                {/* Percentage label */}
                <span className="text-[10px] font-ui text-maple-rust font-semibold z-10">
                  {percent}%
                </span>
                
                {/* Bar */}
                <div 
                  className="w-full bg-gradient-to-t from-yale-blue to-maple-rust rounded-t-sm opacity-80 hover:opacity-100 transition-all relative"
                  style={{ height: `${Math.max(height, 4)}px` }}
                >
                  {/* Dot at the top */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-page-cream border-2 border-maple-rust rounded-full" />
                </div>
                
                {/* Day label */}
                <span className="font-ui text-xs text-coffee-cream">{day.day}</span>
                <span className="font-ui text-[10px] text-coffee-cream/60">{hours}h</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-8 border-t border-coffee-cream/20 text-center">
        <Link to="/tasks" className="inline-flex items-center gap-2 text-maple-rust font-ui text-sm hover:underline">
          <CheckCircle size={16} />
          Manage your tasks
        </Link>
      </div>
    </div>
  );
}