import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();

export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard'];

export const THEMES = [
  { id: 'paper',    label: 'Paper',    emoji: '📜' },
  { id: 'midnight', label: 'Midnight', emoji: '🌙' },
  { id: 'library',  label: 'Library',  emoji: '' },
  { id: 'cream',    label: 'Cream',    emoji: '' },
  { id: 'harvard',  label: 'Harvard',  emoji: '' },
];

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('paper'); // Start with default
  const [isLoading, setIsLoading] = useState(true); // Track loading state

  useEffect(() => {
    const loadTheme = async () => {
      setIsLoading(true);
      
      if (user) {
        // ✅ Logged in: ALWAYS fetch from database first
        const { data, error } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error loading theme from DB:', error);
        }
        
        // Use DB theme if valid, otherwise fallback to localStorage or default
        const dbTheme = data?.theme;
        const localTheme = localStorage.getItem('theme');
        
        const finalTheme = (dbTheme && VALID_THEMES.includes(dbTheme)) 
          ? dbTheme 
          : (VALID_THEMES.includes(localTheme) ? localTheme : 'paper');
        
        setTheme(finalTheme);
      } else {
        // ✅ Not logged in: Use localStorage or default
        const localTheme = localStorage.getItem('theme');
        const finalTheme = VALID_THEMES.includes(localTheme) ? localTheme : 'paper';
        setTheme(finalTheme);
      }
      
      setIsLoading(false);
    };
    
    loadTheme();
  }, [user]);

  // ✅ Apply theme to DOM whenever it changes
  useEffect(() => {
    if (!isLoading) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      // ✅ Auto-save to database if logged in
      if (user) {
        supabase
          .from('profiles')
          .update({ theme })
          .eq('id', user.id)
          .catch(err => console.error('Failed to save theme:', err));
      }
    }
  }, [theme, user, isLoading]);

  // Show nothing or a loading state while determining the theme
  if (isLoading) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);