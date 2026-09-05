import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Sparkles,
  Zap,
  Mic,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  XCircle,
  X,
  Eye,
  Trash2,
  CheckCheck,
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { RealtimeNotification, FeatureUpdate, NavigationTab } from '../types';
import { formatToman, toPersianDigits, formatPersianDate } from '../lib/utils';

interface NotificationDropdownProps {
  notifications: RealtimeNotification[];
  unreadCount: number;
  isRealtimeConnected: boolean;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification: (notif: RealtimeNotification) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  unreadCount,
  isRealtimeConnected,
  onMarkAllAsRead,
  onClearAll,
  onSelectNotification,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'whats-new' | 'events'>('whats-new');
  const [featureUpdates, setFeatureUpdates] = useState<FeatureUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [lastSeenUpdateCount, setLastSeenUpdateCount] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('factorchi_seen_updates_count') || '0', 10);
    } catch {
      return 0;
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch feature updates
  const fetchFeatureUpdates = async () => {
    setLoadingUpdates(true);
    try {
      const res = await fetch('/api/feature-updates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.updates)) {
          setFeatureUpdates(data.updates);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch feature updates:', e);
    } finally {
      setLoadingUpdates(false);
    }
  };

  useEffect(() => {
    fetchFeatureUpdates();
  }, []);

  // When opening dropdown and viewing What's New tab, update seen count
  useEffect(() => {
    if (isOpen && activeTab === 'whats-new' && featureUpdates.length > 0) {
      setLastSeenUpdateCount(featureUpdates.length);
      try {
        localStorage.setItem('factorchi_seen_updates_count', String(featureUpdates.length));
      } catch {}
    }
  }, [isOpen, activeTab, featureUpdates.length]);

  // If there are unread live notifications, default to 'events' tab on open, otherwise 'whats-new'
  const handleOpenDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      if (unreadCount > 0) {
        setActiveTab('events');
      } else {
        setActiveTab('whats-new');
      }
      fetchFeatureUpdates();
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Use capturing click or mousedown with small delay to avoid immediate closure
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [isOpen]);

  const unseenUpdatesCount = Math.max(0, featureUpdates.length - lastSeenUpdateCount);
  const totalBadgeCount = unreadCount + unseenUpdatesCount;

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 45) return 'هم‌اکنون (لحظه‌ای)';
      if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
      if (diffHour < 24) return `${toPersianDigits(diffHour)} ساعت پیش`;
      return formatPersianDate(isoString);
    } catch {
      return 'اخیراً';
    }
  };

  const renderFeatureIcon = (icon?: string) => {
    switch (icon) {
      case 'mic':
        return <Mic className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'shield':
        return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'chart':
        return <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'card':
        return <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      case 'zap':
      default:
        return <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
    }
  };

  const getBadgeClass = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
      case 'indigo':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20';
      case 'amber':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
      case 'rose':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
      case 'teal':
      default:
        return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="notifications-btn"
        onClick={handleOpenDropdown}
        title="تازه‌ها و اعلان‌های زنده فاکتورچی"
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 border-teal-500/40 dark:border-teal-500/40 ring-2 ring-teal-500/20'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800'
        }`}
      >
        <Bell className="w-4.5 h-4.5" />
        {totalBadgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm animate-pulse">
            {toPersianDigits(totalBadgeCount > 99 ? '99+' : totalBadgeCount)}
          </span>
        )}
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 w-auto sm:w-[420px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800/80 origin-top-left max-h-[85vh] flex flex-col">
          
          {/* Header & Segmented Tabs */}
          <div className="p-3 bg-slate-50/90 dark:bg-slate-800/80 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                  مرکز اعلان‌ها و تازه‌ها
                </span>
                {isRealtimeConnected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    زنده
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    اتصال مجدد
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeTab === 'events' && notifications.length > 0 && (
                  <>
                    {unreadCount > 0 && (
                      <button
                        onClick={onMarkAllAsRead}
                        title="خواندن همه"
                        className="p-1 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={onClearAll}
                      title="پاک کردن تاریخچه"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  title="بستن"
                  className="sm:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Segmented Control Buttons */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-950/60 rounded-xl">
              <button
                onClick={() => {
                  setActiveTab('whats-new');
                  setLastSeenUpdateCount(featureUpdates.length);
                  try {
                    localStorage.setItem('factorchi_seen_updates_count', String(featureUpdates.length));
                  } catch {}
                }}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 truncate ${
                  activeTab === 'whats-new'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">تازه‌ها (What's New)</span>
                {unseenUpdatesCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('events')}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 truncate ${
                  activeTab === 'events'
                    ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">اعلان‌های زنده</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black shrink-0">
                    {toPersianDigits(unreadCount)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: What's New (تازه‌ها و قابلیت‌ها) */}
          {activeTab === 'whats-new' && (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-2">
              {loadingUpdates ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  <span>در حال دریافت تازه‌ترین ویژگی‌های فاکتورچی...</span>
                </div>
              ) : featureUpdates.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    قابلیت‌های جدید به زودی منتشر می‌شوند
                  </p>
                </div>
              ) : (
                featureUpdates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 border border-slate-100 dark:border-slate-800/80 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center shadow-xs">
                          {renderFeatureIcon(item.icon)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </h4>
                          {item.date && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.date}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClass(
                            item.badgeColor
                          )}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.description}
                    </p>

                    {item.actionText && item.actionTab && (
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            if (item.actionTab) {
                              onNavigate(item.actionTab);
                              setIsOpen(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                        >
                          <span>{item.actionText}</span>
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Live Notifications & Receipts */}
          {activeTab === 'events' && (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                    <Bell className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    هیچ اعلان یا رسیدی ثبت نشده است
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    به‌محض بارگذاری فیش یا پرداخت توسط مشتریان، اعلان‌ها به صورت زنده در این بخش ظاهر می‌شوند.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const isReceipt = item.type === 'receipt_submitted';
                  const isVerified = item.type === 'payment_verified';
                  const isRejected = item.type === 'payment_rejected';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelectNotification(item);
                        setIsOpen(false);
                      }}
                      className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-start gap-3 relative ${
                        !item.read ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                      }`}
                    >
                      {/* Status Dot */}
                      {!item.read && (
                        <span className="absolute top-3.5 left-3 w-2 h-2 rounded-full bg-teal-500 animate-ping" />
                      )}

                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs ${
                          isReceipt
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : isVerified
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : isRejected
                            ? 'bg-rose-500/15 text-rose-600'
                            : 'bg-teal-500/15 text-teal-600'
                        }`}
                      >
                        {isReceipt ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : isVerified ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs font-bold truncate ${
                              !item.read
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>

                        {isReceipt && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-teal-500/30 shadow-2xs">
                              <Eye className="w-3 h-3" />
                              بررسی و تأیید رسید پرداخت
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-2.5 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                onNavigate('invoices');
                setIsOpen(false);
              }}
              className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              <span>مدیریت فاکتورها</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                onNavigate('billing');
                setIsOpen(false);
              }}
              className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              مدیریت اشتراک و طرح‌ها
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

