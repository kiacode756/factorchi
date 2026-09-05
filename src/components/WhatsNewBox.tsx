import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Mic,
  ShieldCheck,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  BellRing,
  Loader2,
} from 'lucide-react';
import { FeatureUpdate, NavigationTab } from '../types';

interface WhatsNewBoxProps {
  onNavigate?: (tab: NavigationTab) => void;
}

export const WhatsNewBox: React.FC<WhatsNewBoxProps> = ({ onNavigate }) => {
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/feature-updates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.updates)) {
          setUpdates(data.updates);
        }
      }
    } catch (e) {
      console.error('Failed to fetch feature updates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
    const dismissed = localStorage.getItem('factorchi_whats_new_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('factorchi_whats_new_dismissed', 'true');
  };

  const handleReopen = () => {
    setIsDismissed(false);
    localStorage.removeItem('factorchi_whats_new_dismissed');
  };

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>آخرین قابلیت‌های اضافه شده به فاکتورچی</span>
          {updates.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-bold">
              {updates.length}
            </span>
          )}
        </div>
        <button
          onClick={handleReopen}
          className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>مشاهده قابلیت‌های جدید</span>
          <ArrowLeft className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const renderIcon = (icon: FeatureUpdate['icon']) => {
    switch (icon) {
      case 'mic':
        return <Mic className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'shield':
        return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'chart':
        return <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      case 'zap':
      default:
        return <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
    }
  };

  const getBadgeClass = (color: FeatureUpdate['badgeColor']) => {
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

  const displayedUpdates = isExpanded ? updates : updates.slice(0, 2);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 dark:border-teal-500/30 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/50 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-teal-950/40 p-4 sm:p-5 shadow-sm">
      {/* Decorative accent blob */}
      <div className="absolute -top-12 -left-12 w-40 h-40 bg-teal-400/10 dark:bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shadow-teal-600/30">
            <BellRing className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                تازه‌ها و قابلیت‌های جدید
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white shadow-xs">
                به‌روزرسانی خودکار
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ویژگی‌ها و تغییرات اضافه شده به فاکتورچی
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          title="بستن این اعلان"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Feature items */}
      <div className="space-y-2.5 relative z-10">
        {loading ? (
          <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            <span>در حال بارگذاری تازه‌ترین قابلیت‌ها...</span>
          </div>
        ) : displayedUpdates.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-500">
            هنوز قابلیت جدیدی ثبت نشده است.
          </div>
        ) : (
          displayedUpdates.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-teal-500/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 shrink-0 mt-0.5 sm:mt-0">
                  {renderIcon(item.icon)}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {item.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBadgeClass(
                        item.badgeColor
                      )}`}
                    >
                      {item.badge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      • {item.date}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {item.description}
                  </p>
                </div>
              </div>

              {item.actionText && item.actionTab && onNavigate && (
                <button
                  onClick={() => onNavigate(item.actionTab as NavigationTab)}
                  className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-teal-600/10 hover:bg-teal-600 text-teal-700 dark:text-teal-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                >
                  <span>{item.actionText}</span>
                  <ArrowLeft className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer controls */}
      {updates.length > 2 && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs relative z-10">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer text-xs"
          >
            <span>{isExpanded ? 'نمایش کمتر' : `مشاهده همه تغییرات (${updates.length})`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] text-slate-400">
            فاکتورچی هوشمند • همگام با آخرین آپدیت‌ها
          </span>
        </div>
      )}
    </div>
  );
};
