import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusTimer } from '../context/FocusTimerContext';
import {
  Timer, Play, Pause, RotateCcw, Coffee, CheckCircle, Sparkles,
  Loader2, Zap, Target, Flame, Trophy, Calendar, Clock, X,
  ListChecks, ChevronDown
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Focus() {
  const { user } = useAuth();
  const { taskContext, setTaskContext } = useFocusTimer();

  // ============================================
  // 🎯 TIMER STATES
  // ============================================
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus');
  const [task, setTask] = useState('');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [motivation, setMotivation] = useState('');
  const [loadingMotivation, setLoadingMotivation] = useState(false);
  const [sessions, setSessions] = useState([]);

  // ============================================
  // 🎯 GOAL / TASK SELECTION
  // ============================================
  const [focusMode, setFocusMode] = useState('goal'); // 'free' or 'goal'
  const [goals, setGoals] = useState([]);
  const [goalTasks, setGoalTasks] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Modals & notifications
  const [confirmReset, setConfirmReset] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notifTimer = useRef(null);

  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);

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

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) setSessions(data || []);
  }, [user]);

  const fetchGoalsAndTasks = useCallback(async () => {
    if (!user) return;
    const [goalsRes, tasksRes] = await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('goal_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);
    setGoals(goalsRes.data || []);
    setGoalTasks(tasksRes.data || []);
    // 🐞 DEBUG: check the console — you should see your goals & tasks counts
    console.log('🎯 Goals loaded:', (goalsRes.data || []).length, '| Tasks loaded:', (tasksRes.data || []).length, tasksRes.data);
  }, [user]);

  useEffect(() => {
    fetchSessions();
    fetchGoalsAndTasks();
  }, [fetchSessions, fetchGoalsAndTasks]);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // ⚡ TASK CONTEXT INTEGRATION (from Goals page)
  // ============================================

  useEffect(() => {
    if (taskContext && !isActive) {
      setFocusMode('goal');
      setSelectedGoalId(taskContext.goalId || '');
      setSelectedTaskId(taskContext.taskId || '');
      setTask(taskContext.taskTitle || '');
    }
  }, [taskContext, isActive]);

  // ============================================
  // 🧮 DERIVATIONS
  // ============================================

  const tasksOfSelectedGoal = useMemo(
    () => goalTasks.filter(t => t.goal_id === selectedGoalId && !t.completed),
    [goalTasks, selectedGoalId]
  );

  const selectedGoal = goals.find(g => g.id === selectedGoalId) || null;
  const selectedTask = goalTasks.find(t => t.id === selectedTaskId) || null;

  const sessionLabel = focusMode === 'goal'
    ? (selectedTask?.title || selectedGoal?.title || task || '')
    : task;

  // ============================================
  // ⏱️ TIMER LOGIC
  // ============================================

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleComplete();
    }

    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  // ============================================
  // 🤖 AI MOTIVATION
  // ============================================

  const getMotivation = useCallback(async (type) => {
    setLoadingMotivation(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-focus-motivation', {
        body: {
          session_type: type,
          energy_level: energyLevel,
          task: sessionLabel || taskContext?.taskTitle || 'your work'
        }
      });
      if (!error && data?.motivation) {
        setMotivation(data.motivation);
      }
    } catch (err) {
      console.error('Motivation error:', err);
    }
    setLoadingMotivation(false);
  }, [energyLevel, sessionLabel, taskContext]);

  // ============================================
  // 🎯 SESSION CONTROLS
  // ============================================

  const startSession = useCallback(async () => {
    const duration = mode === 'focus' ? 25 : 5;

    const { data, error } = await supabase
      .from('focus_sessions')
      .insert([{
        user_id: user.id,
        duration,
        task: sessionLabel || null,
        energy_level: energyLevel,
        started_at: new Date().toISOString(),
        goal_id: selectedGoalId || taskContext?.goalId || null,
        task_id: selectedTaskId || taskContext?.taskId || null
      }])
      .select()
      .single();

    if (!error && data) {
      sessionIdRef.current = data.id;
      setIsActive(true);
      await getMotivation('start');
      showNotification(`${mode === 'focus' ? 'Focus' : 'Break'} session started! 🎯`);
    } else {
      showNotification('Failed to start session.', 'error');
    }
  }, [mode, sessionLabel, selectedGoalId, selectedTaskId, taskContext, energyLevel, user, getMotivation, showNotification]);

  const pauseSession = useCallback(() => {
    setIsActive(false);
    clearInterval(timerRef.current);
    showNotification('Session paused', 'success');
  }, [showNotification]);

  const resumeSession = useCallback(() => {
    setIsActive(true);
    showNotification('Session resumed', 'success');
  }, [showNotification]);

  const handleComplete = useCallback(async () => {
    setIsActive(false);
    clearInterval(timerRef.current);

    if (sessionIdRef.current) {
      await supabase
        .from('focus_sessions')
        .update({
          completed: true,
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionIdRef.current);
    }

    await getMotivation('complete');
    await fetchSessions();

    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    sessionIdRef.current = null;

    if (taskContext) {
      setTaskContext(null);
    }

    showNotification(mode === 'focus' ? '🎉 Focus session completed!' : '☕ Break finished!', 'success');
  }, [mode, taskContext, setTaskContext, getMotivation, fetchSessions, showNotification]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    clearInterval(timerRef.current);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    setMotivation('');
    sessionIdRef.current = null;
    setConfirmReset(false);
    showNotification('Timer reset', 'success');
  }, [mode, showNotification]);

  const requestReset = useCallback(() => {
    if (isActive) {
      setConfirmReset(true);
    } else {
      resetTimer();
    }
  }, [isActive, resetTimer]);

  // ============================================
  // 🧮 HELPERS
  // ============================================

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(s =>
      new Date(s.created_at).toDateString() === today && s.completed
    );
    const totalMinutes = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      completedToday: todaySessions.length,
      totalMinutesToday: totalMinutes,
      totalSessions: sessions.length,
    };
  }, [sessions]);

  const progress = useMemo(() => {
    const total = mode === 'focus' ? 25 * 60 : 5 * 60;
    return ((total - timeLeft) / total) * 100;
  }, [timeLeft, mode]);

  // ============================================
  // 🎨 RENDER
  // ============================================

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
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
      <div>
        <p className="eyebrow mb-2">Deep Work</p>
        <h1 className="font-display text-4xl text-yale-blue">
          <span className="italic text-maple-rust">Focus</span> Mode.
        </h1>
        <p className="font-body text-coffee-cream mt-2">
          AI-powered Pomodoro sessions with adaptive motivation.
        </p>
      </div>

      {/* Task Context Banner (when coming from Goals) */}
      {taskContext && !isActive && (
        <div className="bg-page-cream p-4 rounded-sm border-l-4 border-gilmore-gold shadow-cozy animate-fade-in-up">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-label text-[0.6rem] uppercase tracking-wider text-gilmore-gold mb-1">
                Current Task
              </p>
              <p className="font-display text-lg text-yale-blue">{taskContext.taskTitle}</p>
              <p className="font-body text-xs text-coffee-cream italic">
                from: {taskContext.goalTitle}
              </p>
            </div>
            <button
              onClick={() => setTaskContext(null)}
              className="text-coffee-cream/40 hover:text-maple-rust transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Timer */}
      <div className="bg-parchment p-8 rounded-sm border border-coffee-cream/20 shadow-cozy text-center space-y-6">
        {/* Mode Toggle */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => { if (!isActive) { setMode('focus'); setTimeLeft(25 * 60); setMotivation(''); } }}
            disabled={isActive}
            className={`px-6 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
              mode === 'focus'
                ? 'bg-yale-blue text-page-cream'
                : 'text-coffee-cream hover:bg-page-cream disabled:opacity-50'
            }`}
          >
            <Target size={14} className="inline mr-2" />
            Focus (25 min)
          </button>
          <button
            onClick={() => { if (!isActive) { setMode('break'); setTimeLeft(5 * 60); setMotivation(''); } }}
            disabled={isActive}
            className={`px-6 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
              mode === 'break'
                ? 'bg-porch-sage text-page-cream'
                : 'text-coffee-cream hover:bg-page-cream disabled:opacity-50'
            }`}
          >
            <Coffee size={14} className="inline mr-2" />
            Break (5 min)
          </button>
        </div>

        {/* Progress Ring */}
        <div className="relative inline-block">
          <svg className="w-64 h-64 transform -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke="var(--color-coffee-cream)"
              strokeWidth="8"
              fill="none"
              opacity="0.2"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              stroke={mode === 'focus' ? 'var(--color-yale-blue)' : 'var(--color-porch-sage)'}
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 120}`}
              strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`text-6xl font-display font-bold ${
              mode === 'focus' ? 'text-yale-blue' : 'text-porch-sage'
            }`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* TASK / GOAL SELECTION                        */}
        {/* ============================================ */}
        {!isActive && !taskContext && (
          <div className="max-w-md mx-auto space-y-3 mb-6">
            {/* TASK / GOAL switch */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFocusMode('free')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider border transition-all ${
                  focusMode === 'free'
                    ? 'bg-maple-rust text-page-cream border-maple-rust'
                    : 'text-coffee-cream border-coffee-cream/30 hover:bg-page-cream'
                }`}
              >
                <ListChecks size={14} /> Task
              </button>
              <button
                onClick={() => setFocusMode('goal')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider border transition-all ${
                  focusMode === 'goal'
                    ? 'bg-yale-blue text-page-cream border-yale-blue'
                    : 'text-coffee-cream border-coffee-cream/30 hover:bg-page-cream'
                }`}
              >
                <Target size={14} /> Goal
              </button>
            </div>

            {/* Free task input */}
            {focusMode === 'free' && (
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="What are you focusing on?"
                className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-center animate-fade-in-up"
              />
            )}

            {/* GOAL mode: goal select + task bar */}
            {focusMode === 'goal' && (
              <div className="space-y-3 animate-fade-in-up">
                {/* Goal select */}
                <div className="relative">
                  <Target size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/60 pointer-events-none" />
                  <select
                    value={selectedGoalId}
                    onChange={(e) => {
                      setSelectedGoalId(e.target.value);
                      setSelectedTaskId('');
                    }}
                    className="w-full appearance-none pl-11 pr-10 py-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink cursor-pointer text-left"
                  >
                    <option value="">Select a goal...</option>
                    {goals.map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-coffee-cream pointer-events-none" />
                </div>

                {/* ✅ TASK BAR — appears right after a goal is selected */}
                {selectedGoalId && (
                  <div className="space-y-2 text-left animate-fade-in-up">
                    <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream flex items-center gap-1.5">
                      <ListChecks size={12} className="text-maple-rust" />
                      Tasks for "{selectedGoal?.title}" — pick one:
                    </p>

                    {tasksOfSelectedGoal.length === 0 ? (
                      <p className="font-body text-xs text-coffee-cream/60 italic">
                        No pending tasks for this goal — you'll focus on the goal itself.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {tasksOfSelectedGoal.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTaskId(selectedTaskId === t.id ? '' : t.id)}
                            className={`px-3 py-2 rounded-sm font-body text-xs border transition-all ${
                              selectedTaskId === t.id
                                ? 'bg-maple-rust text-page-cream border-maple-rust shadow-sm'
                                : 'bg-page-cream text-library-ink border-coffee-cream/30 hover:border-maple-rust/50 hover:text-maple-rust'
                            }`}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                {selectedGoalId && (
                  <div className="bg-page-cream p-3 rounded-sm border border-coffee-cream/10 text-left">
                    <p className="font-label text-[0.6rem] uppercase tracking-wider text-gilmore-gold mb-1">
                      Focus on
                    </p>
                    <p className="font-display text-sm text-yale-blue">
                      {selectedTask?.title || selectedGoal?.title}
                    </p>
                    {selectedTask && (
                      <p className="font-body text-xs text-coffee-cream italic">
                        from: {selectedGoal?.title}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Energy Level */}
        {!isActive && (
          <div className="mb-6">
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">
              Current Energy Level
            </p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setEnergyLevel(level)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    level === energyLevel
                      ? 'bg-gilmore-gold text-yale-blue font-bold'
                      : 'bg-coffee-cream/30 text-coffee-cream hover:bg-coffee-cream/50'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Motivation Display */}
        {motivation && (
          <div className="bg-page-cream/50 p-4 rounded-sm border-l-4 border-gilmore-gold text-left max-w-lg mx-auto animate-fade-in-up">
            <Sparkles size={16} className="inline text-gilmore-gold mb-2" />
            <p className="font-body text-library-ink italic">{motivation}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 pt-4">
          {!isActive ? (
            <button
              onClick={startSession}
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all"
            >
              <Play size={18} />
              Start Session
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="flex items-center gap-2 bg-yale-blue text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all"
            >
              <Pause size={18} />
              Pause
            </button>
          )}

          {isActive && (
            <button
              onClick={resumeSession}
              className="flex items-center gap-2 bg-porch-sage text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all"
            >
              <Play size={18} />
              Resume
            </button>
          )}

          <button
            onClick={requestReset}
            className="flex items-center gap-2 bg-coffee-cream/30 text-coffee-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-coffee-cream/50 transition-all"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>

        {/* Stats */}
        <div className="pt-6 border-t border-coffee-cream/20">
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <p className="font-display text-2xl text-maple-rust">{stats.completedToday}</p>
              <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
                Sessions Today
              </p>
            </div>
            <div className="text-center">
              <p className="font-display text-2xl text-gilmore-gold">{stats.totalMinutesToday}</p>
              <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
                Minutes Today
              </p>
            </div>
            <div className="text-center">
              <p className="font-display text-2xl text-porch-sage">{stats.totalSessions}</p>
              <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
                Total Sessions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <h2 className="font-display text-xl text-yale-blue mb-4 flex items-center gap-2">
            <Clock size={18} className="text-maple-rust" />
            Recent Sessions
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-page-cream/50 rounded-sm hover:bg-page-cream transition-colors"
              >
                <div className="flex-1">
                  <p className="font-body text-sm text-library-ink font-medium">
                    {session.task || 'Untitled session'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream flex items-center gap-1">
                      <Timer size={10} />
                      {session.duration} min
                    </span>
                    {session.energy_level && (
                      <span className="font-label text-[0.6rem] uppercase tracking-wider text-gilmore-gold flex items-center gap-1">
                        <Zap size={10} />
                        Energy {session.energy_level}
                      </span>
                    )}
                  </div>
                </div>
                {session.completed ? (
                  <CheckCircle size={20} className="text-porch-sage" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-coffee-cream/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <ConfirmDialog
        open={confirmReset}
        title="Reset this session?"
        message="Your current progress will be lost. This cannot be undone."
        confirmLabel="Reset"
        onConfirm={resetTimer}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}