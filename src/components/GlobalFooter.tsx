import React from 'react';
import { Mail } from 'lucide-react';

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

        {/* Support Email */}
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-teal-50/60 dark:bg-teal-950/30 px-3 py-1.5 rounded-full border border-teal-200/40 dark:border-teal-800/40">
          <span className="text-slate-500 dark:text-slate-400 font-medium">پشتیبانی:</span>
          <a
            href="mailto:kimiabg2013@gmail.com"
            className="font-mono text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 inline-flex items-center gap-1 font-semibold transition-colors hover:underline"
            dir="ltr"
            title="ارسال پیام به ایمیل پشتیبانی فاکتورچی"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>kimiabg2013@gmail.com</span>
          </a>
        </div>

        {/* Credits */}
        <div className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
          this website powered by{' '}
          <a
            href="mailto:kimiabg2013@gmail.com"
            className="font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors uppercase"
          >
            KIARASH
          </a>
        </div>
      </div>
    </footer>
  );
};
