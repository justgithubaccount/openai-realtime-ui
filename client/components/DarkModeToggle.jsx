import { useState, useEffect } from 'react';
import { Sun, Moon } from "lucide-react";

export default function DarkModeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  const toggleMode = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  return (
    <button
      onClick={toggleMode}
      className="p-1.5 rounded-md text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-dark-surface-alt transition-colors"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? (
        <Sun className="w-5 h-5" /> 
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
} 