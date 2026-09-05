import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  darkMode,
  onToggle,
  className = '',
  showLabel = false,
}) => {
  return (
    <button
      type="button"
      id="theme-toggle-btn"
      onClick={onToggle}
      aria-label={darkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
      title={darkMode ? 'حالت روز' : 'حالت شب'}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-300 border ${
        darkMode
          ? 'bg-slate-800/90 border-slate-700/80 text-amber-400 hover:bg-slate-700 hover:border-amber-400/40 shadow-sm shadow-amber-400/10'
          : 'bg-slate-100/90 border-slate-200/80 text-slate-700 hover:bg-slate-200/90 hover:text-slate-900 shadow-sm'
      } ${className}`}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {darkMode ? (
          <Sun className="w-4.5 h-4.5 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Moon className="w-4.5 h-4.5 text-slate-700 transition-transform duration-300 -rotate-12 scale-100" />
        )}
      </div>

      {showLabel && (
        <span className="mr-2 text-xs font-semibold">
          {darkMode ? 'حالت روز' : 'حالت شب'}
        </span>
      )}
    </button>
  );
};
