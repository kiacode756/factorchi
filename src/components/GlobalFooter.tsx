import React from 'react';

export const GlobalFooter: React.FC = () => {
  return (
    <footer id="global-footer" className="w-full py-4 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/80 mt-auto bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm no-print">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-right">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-teal-600 dark:text-teal-400">فاکتورچی</span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
          <span className="text-slate-500 dark:text-slate-400">دستیار هوشمند مالی و صدور فاکتور صوتی</span>
        </div>

        {/* Credits */}
        <div className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
          this website powered by{' '}
          <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">
            KIARASH
          </span>
        </div>
      </div>
    </footer>
  );
};
