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
} from 'lucide-react';
import { NavigationTab, Profile } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  profile: Profile;
  pendingRequestsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onNavigate,
  profile,
  pendingRequestsCount = 0,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'داشبورد',
      icon: LayoutDashboard,
    },
    {
      id: 'new-invoice' as NavigationTab,
      label: 'فاکتور صوتی جدید',
      icon: PlusCircle,
      badge: 'هوش مصنوعی',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
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

  if (profile.role === 'admin') {
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
      </nav>

      {/* Subscription Quick Box (Clean, zero mention of free trial) */}
      <div className="mt-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-slate-800/70 dark:to-slate-800/30 border border-teal-500/20 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-slate-800 dark:text-slate-200">وضعیت حساب</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {profile.role === 'admin' ? 'مدیر سیستم' : profile.subscription_status === 'active' ? 'فعال' : 'نیاز به تمدید'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            {profile.role === 'admin'
              ? 'دسترسی نامحدود و دائمی به تمامی امکانات'
              : 'دسترسی به تمامی امکانات صوتی و گزارشات'}
          </p>
          <button
            onClick={() => onNavigate('billing')}
            className="w-full py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-[11px] transition-colors text-center"
          >
            {profile.role === 'admin' ? 'مشاهده جزئیات حساب' : 'مدیریت اشتراک'}
          </button>
        </div>
      </div>
    </aside>
  );
};
