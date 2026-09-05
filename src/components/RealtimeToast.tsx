import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Eye, X, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { RealtimeNotification } from '../types';
import { formatToman, toPersianDigits } from '../lib/utils';

interface RealtimeToastProps {
  notification: RealtimeNotification | null;
  onClose: () => void;
  onAction?: (notification: RealtimeNotification) => void;
}

export const RealtimeToast: React.FC<RealtimeToastProps> = ({
  notification,
  onClose,
  onAction,
}) => {
  if (!notification) return null;

  const isReceipt = notification.type === 'receipt_submitted';
  const isVerified = notification.type === 'payment_verified';
  const isSubscription = notification.type === 'subscription_request' || notification.type === 'subscription_approved';

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-96 animate-slide-down">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-teal-500/40 dark:border-teal-500/40 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-100 relative overflow-hidden ring-4 ring-teal-500/10">
        {/* Glowing top line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600 animate-pulse" />

        <div className="flex items-start gap-3">
          {/* Icon Badge */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
              isReceipt
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-bounce'
                : isVerified
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
            }`}
          >
            {isReceipt ? (
              <ImageIcon className="w-5 h-5" />
            ) : isVerified ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {notification.title}
                </h4>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
              {notification.message}
            </p>

            {notification.amount && (
              <div className="mt-2 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50/70 dark:bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-200/50 dark:border-teal-800/50 inline-block">
                مبلغ فاکتور: {formatToman(notification.amount)}
              </div>
            )}

            {/* Action Buttons */}
            {onAction && isReceipt && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    onAction(notification);
                    onClose();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>مشاهده و بررسی فیش</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
