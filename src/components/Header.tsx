import React from 'react';
import { Plus, ShieldCheck, LogOut, Radio, Compass, Lock, Clock } from 'lucide-react';
import { Profile, NavigationTab, RealtimeNotification } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  profile: Profile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onStartTour?: () => void;
  notifications?: RealtimeNotification[];
  unreadCount?: number;
  pendingPaymentsCount?: number;
  isRealtimeConnected?: boolean;
  onMarkAllAsRead?: () => void;
  onClearAllNotifications?: () => void;
  onSelectNotification?: (notif: RealtimeNotification) => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  onStartTour,
  notifications = [],
  unreadCount = 0,
  pendingPaymentsCount = 0,
  isRealtimeConnected = true,
  onMarkAllAsRead = () => {},
  onClearAllNotifications = () => {},
  onSelectNotification = () => {},
  onLogout,
}) => {
  const isUserAdmin = profile.role === 'admin' || profile.email?.toLowerCase() === 'bagherikiarash74@gmail.com';
  const isExpired = !isUserAdmin && profile.subscription_status === 'expired';
  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3.5 no-print transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* User Greeting & Status */}
        <div id="header-user-profile" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center font-bold text-sm sm:text-lg shadow-sm">
            {profile.full_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate max-w-[105px] xs:max-w-[150px] sm:max-w-none">
                سلام، {profile.full_name} 👋
              </h1>
              {profile.role === 'admin' && (
                <button
                  onClick={() => onNavigate('admin')}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer"
                  title="ورود به پنل مدیریت ادمین"
                >
                  <ShieldCheck className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden xs:inline">مدیر سیستم</span>
                  <span className="xs:hidden">ادمین</span>
                </button>
              )}
              {isExpired && (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                    <Lock className="w-3 h-3" />
                    اشتراک منقضی
                  </span>
                  <span className="sm:hidden text-rose-500 shrink-0 animate-pulse" title="اشتراک منقضی">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                </>
              )}
              {!isUserAdmin && !isExpired && profile.subscription_status === 'trial' && (
                <button
                  onClick={() => onNavigate('billing')}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/25 hover:bg-teal-500/20 active:scale-95 transition-all cursor-pointer"
                  title="حساب شما در دوره آزمایشی ۱ روزه (۲۴ ساعته) قرار دارد - ارتقا به اشتراک ماهانه"
                >
                  <Clock className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>تست ۱ روزه</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                {profile.business_name || 'کسب‌وکار شخصی'}
              </p>
              {/* Realtime Live Pulse Indicator */}
              <span 
                title={isRealtimeConnected ? "سیستم به‌روزرسانی زنده (Real-time) فعال است" : "در حال تلاش برای اتصال زنده..."} 
                className={`hidden md:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                  isRealtimeConnected 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span>{isRealtimeConnected ? 'اتصال زنده' : 'اتصال مجدد'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Pending Payments Alert Button */}
          {pendingPaymentsCount > 0 && (
            <button
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-all text-xs font-bold animate-pulse"
              title="پرداخت‌های نیازمند تأیید"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">{pendingPaymentsCount} رسید جدید</span>
              <span className="sm:hidden">{pendingPaymentsCount}</span>
            </button>
          )}

          {/* Quick Create Invoice Button or Expired Lock Button */}
          {isExpired ? (
            <button
              id="header-expired-renew-btn"
              onClick={() => onNavigate('billing')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] animate-pulse"
            >
              <Lock className="w-4 h-4" />
              <span>تمدید اشتراک (قفل)</span>
            </button>
          ) : (
            <button
              id="header-quick-invoice-btn"
              onClick={() => onNavigate('new-invoice')}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>فاکتور صوتی جدید</span>
            </button>
          )}

          {/* Guided Tour Trigger Button */}
          {onStartTour && (
            <button
              id="header-tour-btn"
              type="button"
              onClick={onStartTour}
              title="راهنمای سامانه و تور آموزشی"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Compass className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-spin-slow" />
              <span>تور راهنما</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />

          {/* Live Notification Dropdown Center */}
          <NotificationDropdown
            notifications={notifications}
            unreadCount={unreadCount}
            isRealtimeConnected={isRealtimeConnected}
            onMarkAllAsRead={onMarkAllAsRead}
            onClearAll={onClearAllNotifications}
            onSelectNotification={onSelectNotification}
            onNavigate={onNavigate}
          />

          {/* Logout Button */}
          {onLogout && (
            <button
              id="header-logout-btn"
              onClick={onLogout}
              title="خروج از حساب کاربری"
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200/80 dark:border-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

