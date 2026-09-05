import React from 'react';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';
import { NavigationTab } from '../types';

interface AccessDeniedProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-rose-200 dark:border-rose-900/40 rounded-3xl p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Lock className="w-3 h-3" />
            خطای ۴۰۳ • دسترسی غیرمجاز
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            شما دسترسی به این بخش را ندارید
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            بخش «مدیریت و تایید پرداخت‌ها» فقط برای حساب‌های دارای نقش <strong>مدیر سیستم (Admin)</strong> فعال است.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-transform active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به داشبورد</span>
          </button>
        </div>
      </div>
    </div>
  );
};
