import React from 'react';
import { Lock, ArrowRight, Home, ShieldAlert, CreditCard } from 'lucide-react';
import { NavigationTab, Profile } from '../types';

interface ForbiddenPageProps {
  onNavigate: (tab: NavigationTab) => void;
  profile?: Profile | null;
}

export const ForbiddenPage: React.FC<ForbiddenPageProps> = ({ onNavigate, profile }) => {
  const isSubscriptionExpired = profile && profile.subscription_status !== 'active';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-rose-200 dark:border-rose-900/50 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-inner">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            خطای ۴۰۳ • دسترسی ممنوع
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            دسترسی ممنوع
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            شما اجازه دسترسی به این صفحه را ندارید.
          </p>
          {isSubscriptionExpired ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              ⚠️ اشتراک کاربری شما به پایان رسیده است. برای ادامه دسترسی به این بخش، لطفاً اشتراک خود را تمدید فرمایید.
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              این بخش صرفاً در دسترس حساب‌های دارای دسترسی <strong>مدیر سیستم (Admin)</strong> با <strong>اشتراک فعال</strong> است.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {isSubscriptionExpired && (
            <button
              onClick={() => {
                onNavigate('billing');
                window.history.pushState({}, '', '/billing');
              }}
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <CreditCard className="w-4 h-4" />
              <span>ارتقا و تمدید اشتراک</span>
            </button>
          )}

          <button
            onClick={() => {
              onNavigate('dashboard');
              window.history.pushState({}, '', '/');
            }}
            className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به داشبورد</span>
          </button>

          <button
            onClick={() => {
              onNavigate('dashboard');
              window.history.pushState({}, '', '/');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>صفحه اصلی</span>
          </button>
        </div>
      </div>
    </div>
  );
};
