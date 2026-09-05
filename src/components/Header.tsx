import React from 'react';
import { Plus, ShieldCheck, LogOut, Radio } from 'lucide-react';
import { Profile, NavigationTab, RealtimeNotification } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  profile: Profile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (tab: NavigationTab) => void;
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
  notifications = [],
  unreadCount = 0,
  pendingPaymentsCount = 0,
  isRealtimeConnected = true,
  onMarkAllAsRead = () => {},
  onClearAllNotifications = () => {},
  onSelectNotification = () => {},
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/75 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 px-4 lg:px-8 py-3.5 no-print transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* User Greeting & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {profile.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">
                سلام، {profile.full_name} 👋
              </h1>
              {profile.role === 'admin' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  مدیر سیستم
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pending Payments Alert Button */}
          {pendingPaymentsCount > 0 && (
            <button
              onClick={() => onNavigate('invoices')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-all text-xs font-bold animate-pulse"
              title="پرداخت‌های نیازمند تأیید"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{pendingPaymentsCount} رسید جدید</span>
            </button>
          )}

          {/* Quick Create Invoice Button (Desktop) */}
          <button
            id="header-quick-invoice-btn"
            onClick={() => onNavigate('new-invoice')}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>فاکتور صوتی جدید</span>
          </button>

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
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200/80 dark:border-slate-800 transition-colors"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

