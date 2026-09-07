import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();
export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard'];

export function ThemeProvider({ children }) {
  // ✅ 1. Grab the 'loading' state from AuthContext
  const { user, loading: authLoading } = useAuth(); 
  const [theme, setTheme] = useState('paper');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ 2. If Auth is still checking the session, DO NOTHING yet.
    if (authLoading) {
      return; 
    }

    // ✅ 3. If Auth is done and there is NO user, just use localStorage/default
    if (!user) {
      const local = localStorage.getItem('theme');
      if (local && VALID_THEMES.includes(local)) {
        setTheme(local);
      }
      setIsLoading(false);
      return;
    }

    // ✅ 4. Auth is done AND user is logged in: Fetch from database!
    const loadTheme = async () => {
      console.log('🔄 Loading theme for user:', user.id);
      
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
      } else {
        console.log('⚠️ No valid theme in DB, checking localStorage');
        const local = localStorage.getItem('theme');
        if (local && VALID_THEMES.includes(local)) {
          setTheme(local);
        }
      }
      setIsLoading(false);
    };

    loadTheme();
  }, [user, authLoading]); // ✅ Re-run this effect whenever user OR authLoading changes

  // ✅ 5. Apply theme to DOM and save to DB whenever the theme state changes
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

  // ✅ 6. Hide the app until we know for sure what the theme should be
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