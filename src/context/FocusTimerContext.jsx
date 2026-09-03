import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const STORE_KEY = 'rg-focus-timer-v1';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const FocusTimerContext = createContext(null);

export function FocusTimerProvider({ children }) {
  const { user } = useAuth();
  const stored = useRef(loadStore()).current;

  const [durationMin, setDurationMin] = useState(stored?.durationMin || 25);
  const [endAt, setEndAt] = useState(stored?.endAt || null);
  const [isRunning, setIsRunning] = useState(
    !!(stored?.isRunning && stored?.endAt && stored.endAt > Date.now())
  );
  const [timeLeft, setTimeLeft] = useState(() => {
    if (stored?.isRunning && stored?.endAt) {
      return Math.max(0, Math.ceil((stored.endAt - Date.now()) / 1000));
    }
    return (stored?.durationMin || 25) * 60;
  });
  const [selectedTaskId, setSelectedTaskId] = useState(stored?.selectedTaskId ?? null);
  const [selectedGoalId, setSelectedGoalId] = useState(stored?.selectedGoalId ?? null);
  const [selectedGoalTaskId, setSelectedGoalTaskId] = useState(stored?.selectedGoalTaskId ?? null);
  const [sessionKind, setSessionKind] = useState(stored?.sessionKind || 'focus');
  const [phase, setPhase] = useState(stored?.phase || 'focus'); // ✅ lives here now
  const [coffeeEmpty, setCoffeeEmpty] = useState(false);
  const [completedAt, setCompletedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const lastFocusMin = useRef(stored?.lastFocusMin || stored?.durationMin || 25);
  const breakBackTimer = useRef(null);
  const missedCompletion = useRef(
    !!(stored?.isRunning && stored?.endAt && stored.endAt <= Date.now())
  );

  // ---------- phase switching ----------
  const goBreak = () => {
    setPhase('break');
    setSessionKind('break');
    setIsRunning(false);
    setEndAt(null);
    setDurationMin(5);
    setTimeLeft(5 * 60);
  };

  const goFocus = () => {
    setCoffeeEmpty(false);
    setPhase('focus');
    setSessionKind('focus');
    setIsRunning(false);
    setEndAt(null);
    setDurationMin(lastFocusMin.current);
    setTimeLeft(lastFocusMin.current * 60);
  };

  const skipBreak = () => {
    if (breakBackTimer.current) clearTimeout(breakBackTimer.current);
    goFocus();
  };

  // ---------- record + cycle ----------
  const recordSession = async (minutes) => {
    if (user && sessionKind === 'focus') {
      const { error } = await supabase.from('pomodoro_sessions').insert([{
        user_id: user.id,
        task_id: selectedTaskId || null,
        goal_id: selectedGoalId || null,
        goal_task_id: selectedGoalTaskId || null,
        duration: minutes,
        completed: true,
      }]);
      if (error) {
        console.error('Failed to record session:', error);
        setSaveError(error.message || 'Could not save your session.');
      } else {
        setSaveError(null);
      }
    }
    setCompletedAt(new Date().toISOString());

    // ✅ focus → coffee break · break → empty coffee → candle
    if (sessionKind === 'focus') {
      goBreak();
    } else {
      setCoffeeEmpty(true);
      breakBackTimer.current = setTimeout(goFocus, 2600);
    }
  };
  const recordRef = useRef(recordSession);
  recordRef.current = recordSession;

  // ---------- wall-clock tick ----------
  useEffect(() => {
    if (!isRunning || !endAt) return;
    const tick = () => {
      const rem = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem <= 0) {
        setIsRunning(false);
        setEndAt(null);
        recordRef.current(durationMin);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isRunning, endAt, durationMin]);

  // session that finished while the app was closed
  useEffect(() => {
    if (user && missedCompletion.current) {
      missedCompletion.current = false;
      recordRef.current(stored?.durationMin || durationMin);
    }
  }, [user]);

  useEffect(() => () => { if (breakBackTimer.current) clearTimeout(breakBackTimer.current); }, []);

  // ---------- persist ----------
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        durationMin, timeLeft, isRunning, endAt, sessionKind, phase,
        lastFocusMin: lastFocusMin.current,
        selectedTaskId, selectedGoalId, selectedGoalTaskId,
      }));
    } catch {}
  }, [durationMin, timeLeft, isRunning, endAt, sessionKind, phase, selectedTaskId, selectedGoalId, selectedGoalTaskId]);

  // ---------- tab title ----------
  useEffect(() => {
    if (isRunning) {
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      document.title = `${m}:${s} • ${phase === 'focus' ? 'Focusing' : 'Break'} — Rory Gilmore's World`;
    } else {
      document.title = "Rory Gilmore's World";
    }
  }, [timeLeft, isRunning, phase]);

  // ---------- controls ----------
  const start = () => {
    if (timeLeft <= 0) return;
    setEndAt(Date.now() + timeLeft * 1000);
    setIsRunning(true);
  };
  const pause = () => { setIsRunning(false); setEndAt(null); };
  const reset = () => { setIsRunning(false); setEndAt(null); setTimeLeft(durationMin * 60); };
  const changeDuration = (min) => {
    if (sessionKind === 'focus') lastFocusMin.current = min; // remember focus length
    setDurationMin(min);
    setIsRunning(false);
    setEndAt(null);
    setTimeLeft(min * 60);
  };
  const done = () => {
    const elapsed = durationMin * 60 - timeLeft;
    if (elapsed <= 0) return;
    setIsRunning(false);
    setEndAt(null);
    recordSession(elapsed / 60);
  };

  return (
    <FocusTimerContext.Provider value={{
      durationMin, timeLeft, isRunning, phase, coffeeEmpty,
      selectedTaskId, selectedGoalId, selectedGoalTaskId,
      completedAt, saveError, sessionKind,
      setSelectedTaskId, setSelectedGoalId, setSelectedGoalTaskId, setSessionKind,
      start, pause, reset, changeDuration, done, skipBreak,
    }}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer() {
  return useContext(FocusTimerContext);
}