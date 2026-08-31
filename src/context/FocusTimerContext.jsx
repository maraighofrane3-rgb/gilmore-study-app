import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const FocusTimerContext = createContext(null);

export function FocusTimerProvider({ children }) {
  const { user } = useAuth();

  const [durationMin, setDurationMin] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [completedAt, setCompletedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // ⏱️ Tick (app-level, survives navigation)
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const recordSession = async (minutes) => {
    if (user) {
      // NOTE: `goal_id` assumes a `goal_id` column on pomodoro_sessions
      // (nullable uuid, references goals.id). Add it via migration if
      // it doesn't exist yet — see the note in chat.
      const { error } = await supabase.from('pomodoro_sessions').insert([{
        user_id: user.id,
        task_id: selectedTaskId || null,
        goal_id: selectedGoalId || null,
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
    setTimeLeft(durationMin * 60);
  };

  // ✅ Natural completion (full time)
  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      recordSession(durationMin);
    }
  }, [timeLeft, isRunning]);

  // 🌟 Countdown in the browser tab
  useEffect(() => {
    if (isRunning) {
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      document.title = `${m}:${s} • Focusing — Rory Gilmore's World`;
    } else {
      document.title = "Rory Gilmore's World";
    }
  }, [timeLeft, isRunning]);

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const reset = () => { setIsRunning(false); setTimeLeft(durationMin * 60); };
  const changeDuration = (min) => { setDurationMin(min); setIsRunning(false); setTimeLeft(min * 60); };

  // ✅ DONE: bank the EXACT elapsed time, even if the session isn't finished.
  // No rounding, no forced minimum — whatever time really passed gets
  // recorded, down to the second (as fractional minutes).
  const done = () => {
    const elapsedSeconds = durationMin * 60 - timeLeft;
    if (elapsedSeconds <= 0) return; // nothing studied yet
    const minutes = elapsedSeconds / 60;
    setIsRunning(false);
    recordSession(minutes);
  };

  return (
    <FocusTimerContext.Provider value={{
      durationMin, timeLeft, isRunning, selectedTaskId, selectedGoalId, completedAt, saveError,
      setSelectedTaskId, setSelectedGoalId, start, pause, reset, changeDuration, done,
    }}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer() {
  return useContext(FocusTimerContext);
}