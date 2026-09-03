import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

// 🎨 Every theme the app can wear — Harvard joins the family
export const VALID_THEMES = ['paper', 'midnight', 'library', 'cream', 'harvard'];

export const THEMES = [
  { id: 'paper',    label: 'Paper',    emoji: '📜' },
  { id: 'midnight', label: 'Midnight', emoji: '🌙' },
  { id: 'library',  label: 'Library',  emoji: '📚' },
  { id: 'cream',    label: 'Cream',    emoji: '☕' },
  { id: 'harvard',  label: 'Harvard',  emoji: '🎓' },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return VALID_THEMES.includes(saved) ? saved : 'paper';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);