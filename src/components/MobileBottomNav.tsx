import React from 'react';
import { LayoutDashboard, Plus, FileText, Settings, CreditCard, Shield } from 'lucide-react';
import { NavigationTab, Profile } from '../types';

interface MobileBottomNavProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  profile: Profile;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onNavigate,
  profile,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 no-print"
    >
      <div className="flex items-center justify-around">
        {/* Dashboard */}
        <button
          id="mob-nav-dashboard"
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'dashboard'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">خانه</span>
        </button>

        {/* Invoices List */}
        <button
          id="mob-nav-invoices"
          onClick={() => onNavigate('invoices')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'invoices'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">فاکتورها</span>
        </button>

        {/* Center Floating Action Button (New Voice Invoice) */}
        <div className="relative -top-4">
          <button
            id="mob-nav-new-invoice"
            onClick={() => onNavigate('new-invoice')}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/40 active:scale-95 transition-transform border-4 border-slate-50 dark:border-slate-950"
            title="صدور فاکتور صوتی جدید"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Billing */}
        <button
          id="mob-nav-billing"
          onClick={() => onNavigate('billing')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'billing'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">اشتراک</span>
        </button>

        {/* Settings / Admin */}
        <button
          id="mob-nav-settings"
          onClick={() => onNavigate(profile.role === 'admin' ? 'admin' : 'settings')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-colors ${
            currentTab === 'settings' || currentTab === 'admin'
              ? 'text-teal-600 dark:text-teal-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {profile.role === 'admin' ? (
            <>
              <Shield className="w-5 h-5 text-rose-500" />
              <span className="text-[10px] mt-0.5 text-rose-500 font-semibold">ادمین</span>
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">تنظیمات</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};
