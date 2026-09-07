import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();

// 🎨 Every theme the app can wear
export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard'];

export const THEMES = [
  { id: 'paper',    label: 'Paper',    emoji: '📜' },
  { id: 'midnight', label: 'Midnight', emoji: '🌙' },
  { id: 'library',  label: 'Library',  emoji: '📚' },
  { id: 'cream',    label: 'Cream',    emoji: '☕' },
  { id: 'harvard',  label: 'Harvard',  emoji: '🎓' },
];

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  
  // 1. Initialize from localStorage (fallback)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return VALID_THEMES.includes(saved) ? saved : 'paper';
  });

  // 2. Load theme from database when user logs in
  useEffect(() => {
    const loadTheme = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();
        
        // If DB has a valid theme, override the local state
        if (data && data.theme && VALID_THEMES.includes(data.theme)) {
          setTheme(data.theme);
        }
      }
    };
    loadTheme();
  }, [user]);

  // 3. Whenever theme changes: update DOM, localStorage, AND database
  useEffect(() => {
    // ✅ Keep your working DOM/localStorage logic exactly as it was
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // ✅ NEW: Auto-save to database if user is logged in
    if (user) {
      supabase
        .from('profiles')
        .update({ theme })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to save theme to DB:', error);
        });
    }
  }, [theme, user]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);