import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Timer, Play, Pause, RotateCcw, Coffee, CheckCircle, Sparkles, Loader2, Zap } from 'lucide-react';

export default function Focus() {
  const { user } = useAuth();
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('focus'); // 'focus' or 'break'
  const [task, setTask] = useState('');
  const [energyLevel, setEnergyLevel] = useState(3);
  const [motivation, setMotivation] = useState('');
  const [loadingMotivation, setLoadingMotivation] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showStats, setShowStats] = useState(false);
  
  const timerRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (user) fetchSessions();
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

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error) setSessions(data || []);
  };

  const getMotivation = async (type) => {
    setLoadingMotivation(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-focus-motivation', {
        body: { session_type: type, energy_level: energyLevel, task: task || 'your work' }
      });
      if (!error) setMotivation(data.motivation);
    } catch (err) {
      console.error(err);
    }
    setLoadingMotivation(false);
  };

  const startSession = async () => {
    // Create session record
    const { data, error } = await supabase
      .from('focus_sessions')
      .insert([{
        user_id: user.id,
        duration: mode === 'focus' ? 25 : 5,
        task: task || null,
        energy_level: energyLevel,
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (!error && data) {
      sessionIdRef.current = data.id;
      setIsActive(true);
      await getMotivation('start');
    }
  };

  const pauseSession = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
  };

  const resumeSession = () => {
    setIsActive(true);
  };

  const handleComplete = async () => {
    setIsActive(false);
    
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
    
    // Reset timer
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    sessionIdRef.current = null;
  };

  const resetTimer = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    setMotivation('');
    sessionIdRef.current = null;
  };

  const toggleMode = () => {
    resetTimer();
    setMode(mode === 'focus' ? 'break' : 'focus');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const completedToday = sessions.filter(s => {
    const sessionDate = new Date(s.created_at);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString() && s.completed;
  }).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <p className="eyebrow mb-2">Deep Work</p>
        <h1 className="font-display text-4xl text-yale-blue">
          <span className="italic text-maple-rust">Focus</span> Mode.
        </h1>
        <p className="font-body text-coffee-cream mt-2">
          AI-powered Pomodoro sessions with adaptive motivation.
        </p>
      </div>

      {/* Main Timer */}
      <div className="bg-parchment p-8 rounded-sm border border-coffee-cream/20 shadow-cozy text-center space-y-6">
        {/* Mode Toggle */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => { if (!isActive) { setMode('focus'); resetTimer(); } }}
            disabled={isActive}
            className={`px-6 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label transition-all ${
              mode === 'focus' 
                ? 'bg-yale-blue text-page-cream' 
                : 'text-coffee-cream hover:bg-page-cream disabled:opacity-50'
            }`}
          >
            Focus (25 min)
          </button>
          <button
            onClick={() => { if (!isActive) { setMode('break'); resetTimer(); } }}
            disabled={isActive}
            className={`px-6 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label transition-all ${
              mode === 'break' 
                ? 'bg-porch-sage text-page-cream' 
                : 'text-coffee-cream hover:bg-page-cream disabled:opacity-50'
            }`}
          >
            Break (5 min)
          </button>
        </div>

        {/* Timer Display */}
        <div className={`text-8xl font-display font-bold mb-6 ${
          mode === 'focus' ? 'text-yale-blue' : 'text-porch-sage'
        }`}>
          {formatTime(timeLeft)}
        </div>

        {/* Task Input */}
        {!isActive && (
          <div className="max-w-md mx-auto mb-6">
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What are you focusing on?"
              className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-center"
            />
          </div>
        )}

        {/* Energy Level */}
        {!isActive && (
          <div className="mb-6">
            <p className="font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-2">
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
          <div className="bg-page-cream/50 p-4 rounded-sm border-l-4 border-gilmore-gold text-left max-w-lg mx-auto">
            <p className="font-body text-library-ink italic">{motivation}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 pt-4">
          {!isActive ? (
            <button
              onClick={startSession}
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-all"
            >
              <Play size={18} />
              Start Session
            </button>
          ) : (
            <button
              onClick={pauseSession}
              className="flex items-center gap-2 bg-yale-blue text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all"
            >
              <Pause size={18} />
              Pause
            </button>
          )}

          {isActive && (
            <button
              onClick={resumeSession}
              className="flex items-center gap-2 bg-porch-sage text-page-cream px-8 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all"
            >
              <Play size={18} />
              Resume
            </button>
          )}

          <button
            onClick={resetTimer}
            className="flex items-center gap-2 bg-coffee-cream/30 text-coffee-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-coffee-cream/50 transition-all"
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>

        {/* Stats */}
        <div className="pt-6 border-t border-coffee-cream/20">
          <p className="font-body text-sm text-coffee-cream">
            <CheckCircle size={16} className="inline mr-2 text-porch-sage" />
            {completedToday} session{completedToday !== 1 ? 's' : ''} completed today
          </p>
        </div>
      </div>

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <h2 className="font-display text-xl text-yale-blue mb-4">Recent Sessions</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((session, idx) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-page-cream/50 rounded-sm"
              >
                <div>
                  <p className="font-body text-sm text-library-ink">
                    {session.task || 'Untitled session'}
                  </p>
                  <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream">
                    {new Date(session.created_at).toLocaleString()} • {session.duration} min
                  </p>
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
    </div>
  );
}