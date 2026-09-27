import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  CreditCard,
  Settings,
  Shield,
  Mic,
  Sparkles,
  Compass,
  Lock,
} from 'lucide-react';
import { NavigationTab, Profile } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  profile: Profile;
  pendingRequestsCount?: number;
  onStartTour?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  profile,
  pendingRequestsCount = 0,
  onStartTour,
}) => {
  const isUserAdmin = profile.role === 'admin' || profile.email?.toLowerCase() === 'bagherikiarash74@gmail.com';
  const isExpired = !isUserAdmin && profile.subscription_status === 'expired';

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'داشبورد',
      icon: LayoutDashboard,
    },
    {
      id: 'new-invoice' as NavigationTab,
      label: isExpired ? 'فاکتور صوتی (قفل)' : 'فاکتور صوتی جدید',
      icon: isExpired ? Lock : PlusCircle,
      badge: isExpired ? 'قفل اشتراک' : 'هوش مصنوعی',
      badgeColor: isExpired
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
        : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    },
    {
      id: 'invoices' as NavigationTab,
      label: 'لیست فاکتورها',
      icon: FileText,
    },
    {
      id: 'billing' as NavigationTab,
      label: 'مدیریت اشتراک',
      icon: CreditCard,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'تنظیمات',
      icon: Settings,
    },
  ];

  if (isUserAdmin) {
    navItems.push({
      id: 'admin' as NavigationTab,
      label: 'پنل مدیریت پرداخت‌ها',
      icon: Shield,
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} درخواست` : undefined,
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    });
  }

  return (
    <aside
      id="desktop-sidebar"
      className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl border-l border-slate-200/70 dark:border-slate-800/80 p-5 z-40 no-print transition-colors"
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
          <Mic className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              فاکتورچی
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              نسخه ۳
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            صدور فاکتور با صوت فارسی
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-500/25 font-semibold translate-x-1'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Guided Tour Sidebar Button */}
        {onStartTour && (
          <div className="pt-2">
            <button
              id="sidebar-tour-btn"
              type="button"
              onClick={onStartTour}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:rotate-45 transition-transform duration-300" />
                <span>تور راهنمای سایت</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-600 text-white shadow-xs">
                آموزش
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Subscription Quick Box */}
      <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className={`p-3.5 rounded-2xl border text-xs transition-colors ${
          isExpired
            ? 'bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-slate-800/40 border-rose-500/30'
            : 'bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-slate-800/70 dark:to-slate-800/30 border-teal-500/20'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-800 dark:text-slate-200">وضعیت حساب</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isUserAdmin
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : isExpired
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-black'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isUserAdmin ? 'مدیر سیستم' : isExpired ? 'منقضی شده (قفل)' : 'فعال'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            {isUserAdmin
              ? 'دسترسی نامحدود و دائمی به تمامی امکانات'
              : isExpired
              ? 'اشتراک منقضی شده؛ برای صدور فاکتور صوتی فیش واریز ثبت کنید.'
              : 'دسترسی به تمامی امکانات صوتی و گزارشات'}
          </p>
          <button
            onClick={() => onNavigate('billing')}
            className={`w-full py-1.5 px-3 rounded-xl font-medium text-[11px] transition-colors text-center text-white ${
              isExpired ? 'bg-rose-600 hover:bg-rose-700 shadow-xs animate-pulse' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {isUserAdmin ? 'مشاهده جزئیات حساب' : isExpired ? 'ارسال فیش و فعال‌سازی ۳۰ روزه' : 'مدیریت اشتراک'}
          </button>
        </div>
      </div>
    </aside>
  );
};
