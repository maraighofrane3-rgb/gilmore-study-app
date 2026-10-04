import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ThemeContext = createContext();

export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard', 'vampire', 'custom'];

// Define defaults outside the component to ensure consistency
const DEFAULT_CUSTOM_COLORS = {
  bg: '#F3EAD8',
  surface: '#E8DCC4',
  text: '#132A44',
  heading: '#A13D2B',
  accent: '#C9A227',
  sidebarBg: '#2A4A5E',
  sidebarText: '#FBF3E4',
  sidebarMuted: '#D9B98A',
  sidebarAccent: '#E8A23D'
};

export function ThemeProvider({ children }) {
  const { user, loading: authLoading } = useAuth(); 
  const [theme, setTheme] = useState('paper');
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Initialize from localStorage immediately, merging with defaults to prevent undefined crashes
  const [customColors, setCustomColors] = useState(() => {
    const saved = localStorage.getItem('rgw-custom-colors');
    if (saved) {
      try {
        return { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_CUSTOM_COLORS;
      }
    }
    return DEFAULT_CUSTOM_COLORS;
  });

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const local = localStorage.getItem('theme');
      if (local && VALID_THEMES.includes(local)) setTheme(local);
      setIsLoading(false);
      return;
    }

    const loadTheme = async () => {
      console.log('🔄 Loading theme for user:', user.id);
      
      const local = localStorage.getItem('theme');
      if (local && VALID_THEMES.includes(local)) {
        console.log('✅ Found theme in localStorage:', local);
        setTheme(local);
        
        // If it's custom, check DB for the latest colors to ensure cross-device sync
        if (local === 'custom') {
          const { data } = await supabase.from('profiles').select('custom_theme').eq('id', user.id).single();
          if (data?.custom_theme) {
            setCustomColors({ ...DEFAULT_CUSTOM_COLORS, ...data.custom_theme });
            localStorage.setItem('rgw-custom-colors', JSON.stringify(data.custom_theme));
          }
        }
        setIsLoading(false);
        return;
      }
      
      // Fall back to database if localStorage is empty
      const { data, error } = await supabase
        .from('profiles')
        .select('theme, custom_theme')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('❌ Error loading theme from DB:', error);
      } else if (data?.theme && VALID_THEMES.includes(data.theme)) {
        console.log('✅ Found theme in DB:', data.theme);
        setTheme(data.theme);
        localStorage.setItem('theme', data.theme);
        
        // Apply custom colors from DB if theme is custom
        if (data.theme === 'custom' && data.custom_theme) {
          setCustomColors({ ...DEFAULT_CUSTOM_COLORS, ...data.custom_theme });
          localStorage.setItem('rgw-custom-colors', JSON.stringify(data.custom_theme));
        }
      } else {
        console.log('⚠️ No valid theme found, using default');
      }
      setIsLoading(false);
    };

    loadTheme();
  }, [user, authLoading]);

  // Persist custom colors to localStorage instantly for smooth UI updates
  useEffect(() => {
    localStorage.setItem('rgw-custom-colors', JSON.stringify(customColors));
  }, [customColors]);

  // Apply theme to DOM
  useEffect(() => {
    if (!isLoading && !authLoading) {
      console.log('🎨 Applying theme to DOM:', theme);
      const root = document.documentElement;
      
      if (theme === 'custom') {
        root.setAttribute('data-theme', 'custom');
        
        // Main theme colors
        root.style.setProperty('--color-page-cream', customColors.bg);
        root.style.setProperty('--color-parchment', customColors.surface);
        root.style.setProperty('--color-library-ink', customColors.text);
        root.style.setProperty('--color-yale-blue', customColors.heading);
        root.style.setProperty('--color-maple-rust', customColors.accent);
        
        // ✅ Sidebar colors (using dedicated custom properties)
        root.style.setProperty('--color-sidebar-bg', customColors.sidebarBg);
        root.style.setProperty('--color-sidebar-text', customColors.sidebarText);
        root.style.setProperty('--color-sidebar-muted', customColors.sidebarMuted);
        root.style.setProperty('--color-sidebar-accent', customColors.sidebarAccent);
      } else {
        root.setAttribute('data-theme', theme);
        
        // Clear ALL custom inline properties so predefined CSS themes take over cleanly
        root.style.removeProperty('--color-page-cream');
        root.style.removeProperty('--color-parchment');
        root.style.removeProperty('--color-library-ink');
        root.style.removeProperty('--color-yale-blue');
        root.style.removeProperty('--color-maple-rust');
        root.style.removeProperty('--color-sidebar-bg');
        root.style.removeProperty('--color-sidebar-text');
        root.style.removeProperty('--color-sidebar-muted');
        root.style.removeProperty('--color-sidebar-accent');
      }
      
      localStorage.setItem('theme', theme);
      
      if (user) {
        supabase.from('profiles').update({ theme }).eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error('❌ Failed to save theme to DB:', error);
          });
      }
    }
  }, [theme, customColors, user, isLoading, authLoading]);

  if (isLoading || authLoading) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);