import React from 'react';

export const GlobalFooter: React.FC = () => {
  return (
    <footer id="global-footer" className="w-full py-5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800/80 mt-auto bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm no-print">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-teal-600 dark:text-teal-400">فاکتورچی</span>
          <span>— دستیار هوشمند مالی و صدور فاکتور صوتی</span>
        </div>
        <div className="text-slate-600 dark:text-slate-300 font-medium tracking-wide">
          this website powered by{' '}
          <a
            href="mailto:bagherikiarash74@gmail.com"
            className="font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors uppercase"
          >
            KIARASH
          </a>
        </div>
      </div>
    </footer>
  );
};
