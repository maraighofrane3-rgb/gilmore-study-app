import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();
// 🧛 Added 'vampire' to the list!
export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard', 'vampire'];

export function ThemeProvider({ children }) {
  const { user, loading: authLoading } = useAuth(); 
  const [theme, setTheme] = useState('paper');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return; 
    }

    if (!user) {
      const local = localStorage.getItem('theme');
      if (local && VALID_THEMES.includes(local)) {
        setTheme(local);
      }
      setIsLoading(false);
      return;
    }

    const loadTheme = async () => {
      console.log('🔄 Loading theme for user:', user.id);
      
      // ✅ Check localStorage FIRST (faster, more reliable)
      const local = localStorage.getItem('theme');
      if (local && VALID_THEMES.includes(local)) {
        console.log('✅ Found theme in localStorage:', local);
        setTheme(local);
        setIsLoading(false);
        return;
      }
      
      // Fall back to database if localStorage is empty
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ Error loading theme from DB:', error);
      } else if (data?.theme && VALID_THEMES.includes(data.theme)) {
        console.log('✅ Found theme in DB:', data.theme);
        setTheme(data.theme);
        localStorage.setItem('theme', data.theme);
      } else {
        console.log('⚠️ No valid theme found, using default');
      }
      setIsLoading(false);
    };

    loadTheme();
  }, [user, authLoading]);

  useEffect(() => {
    if (!isLoading && !authLoading) {
      console.log('🎨 Applying theme to DOM:', theme);
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      if (user) {
        supabase.from('profiles').update({ theme }).eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error('❌ Failed to save theme to DB:', error);
            else console.log('💾 Theme saved to DB successfully');
          });
      }
    }
  }, [theme, user, isLoading, authLoading]);

  if (isLoading || authLoading) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);