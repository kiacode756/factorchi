import React from 'react';
import { LayoutDashboard, Plus, FileText, Settings, CreditCard, Shield } from 'lucide-react';
import { NavigationTab, Profile } from '../types';
import { toPersianDigits } from '../lib/utils';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  profile: Profile;
  pendingRequestsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onNavigate,
  profile,
  pendingRequestsCount = 0,
}) => {
  const isUserAdmin = profile.role === 'admin' || profile.email?.toLowerCase() === 'bagherikiarash74@gmail.com';

  return (
    <nav
      id="mobile-bottom-nav"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] no-print shadow-[0_-4px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.35)] transition-colors"
    >
      <div className="grid grid-cols-5 items-end max-w-md mx-auto relative">
        {/* Tab 1: Dashboard (خانه) */}
        <button
          id="mob-nav-dashboard"
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center py-1 w-full transition-all duration-150 active:scale-95 ${
            currentTab === 'dashboard'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <LayoutDashboard className={`w-5 h-5 transition-transform ${currentTab === 'dashboard' ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[10px] mt-1 whitespace-nowrap">خانه</span>
          {currentTab === 'dashboard' && (
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-0.5" />
          )}
        </button>

        {/* Tab 2: Invoices (فاکتورها) */}
        <button
          id="mob-nav-invoices"
          onClick={() => onNavigate('invoices')}
          className={`flex flex-col items-center justify-center py-1 w-full transition-all duration-150 active:scale-95 ${
            currentTab === 'invoices'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileText className={`w-5 h-5 transition-transform ${currentTab === 'invoices' ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[10px] mt-1 whitespace-nowrap">فاکتورها</span>
          {currentTab === 'invoices' && (
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-0.5" />
          )}
        </button>

        {/* Tab 3: Center Action Button - Voice Invoice (صدور) */}
        <div className="flex flex-col items-center justify-center -mt-6 relative">
          <button
            id="mob-nav-new-invoice"
            onClick={() => onNavigate('new-invoice')}
            className={`w-12 h-12 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all duration-200 border-4 border-white dark:border-slate-900 ${
              currentTab === 'new-invoice'
                ? 'shadow-teal-500/50 ring-2 ring-teal-500/30 scale-105'
                : 'shadow-teal-500/35 hover:shadow-teal-500/50'
            }`}
            title="صدور فاکتور صوتی جدید"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span
            className={`text-[10px] font-bold mt-1 whitespace-nowrap transition-colors ${
              currentTab === 'new-invoice'
                ? 'text-teal-600 dark:text-teal-400'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            صدور فاکتور
          </span>
        </div>

        {/* Tab 4: Admin Panel (ادمین) for Admin OR Billing (اشتراک) for Regular Users */}
        {isUserAdmin ? (
          <button
            id="mob-nav-admin"
            onClick={() => onNavigate('admin')}
            className={`flex flex-col items-center justify-center py-1 w-full transition-all duration-150 active:scale-95 ${
              currentTab === 'admin'
                ? 'text-rose-600 dark:text-rose-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Shield className={`w-5 h-5 transition-transform ${currentTab === 'admin' ? 'scale-110 text-rose-500' : 'text-rose-500/80'}`} />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                  {toPersianDigits(pendingRequestsCount)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 whitespace-nowrap">پنل ادمین</span>
            {currentTab === 'admin' && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-0.5" />
            )}
          </button>
        ) : (
          <button
            id="mob-nav-billing"
            onClick={() => onNavigate('billing')}
            className={`flex flex-col items-center justify-center py-1 w-full transition-all duration-150 active:scale-95 ${
              currentTab === 'billing'
                ? 'text-teal-600 dark:text-teal-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <CreditCard className={`w-5 h-5 transition-transform ${currentTab === 'billing' ? 'scale-110' : ''}`} />
            </div>
            <span className="text-[10px] mt-1 whitespace-nowrap">اشتراک</span>
            {currentTab === 'billing' && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-0.5" />
            )}
          </button>
        )}

        {/* Tab 5: Settings (تنظیمات) */}
        <button
          id="mob-nav-settings"
          onClick={() => onNavigate('settings')}
          className={`flex flex-col items-center justify-center py-1 w-full transition-all duration-150 active:scale-95 ${
            currentTab === 'settings'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Settings className={`w-5 h-5 transition-transform ${currentTab === 'settings' ? 'scale-110' : ''}`} />
          </div>
          <span className="text-[10px] mt-1 whitespace-nowrap">تنظیمات</span>
          {currentTab === 'settings' && (
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
