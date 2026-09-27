import React, { useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  AlertCircle,
  Plus,
  Mic,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Compass,
  Lock,
} from 'lucide-react';
import { Invoice, Profile, NavigationTab } from '../types';
import { formatToman, toPersianDigits, formatNumber, formatPersianDate } from '../lib/utils';
import { ProfitLossSection } from './ProfitLossSection';

interface DashboardViewProps {
  profile: Profile;
  invoices: Invoice[];
  onNavigate: (tab: NavigationTab) => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onStartTour?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  invoices,
  onNavigate,
  onSelectInvoice,
  onStartTour,
}) => {
  const isUserAdmin = profile.role === 'admin' || profile.email?.toLowerCase() === 'bagherikiarash74@gmail.com';
  const isExpired = !isUserAdmin && profile.subscription_status === 'expired';
  // Helper to determine if an invoice is verified as paid
  const isInvoiceFullyPaid = (inv: Invoice): boolean => {
    if (inv.payment_status === 'paid') return true;
    if (inv.payment_status === 'pending_verification' || inv.payment_status === 'failed') return false;
    return inv.status === 'paid';
  };

  // Helper to safely parse any Persian or Western date string
  const parseSafeDate = (dStr?: string): Date | null => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return !isNaN(d.getTime()) ? d : null;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Memoized stats calculation to avoid redundant overhead on re-renders
  const { totalInvoices, paidInvoices, totalSalesMonth, overdueAmount, todayReceived, recentInvoices, todayPaidInvoices, overdueInvoices } = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter(isInvoiceFullyPaid);

    const nowDate = new Date();
    const thirtyDaysAgoDate = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const monthly = invoices.filter((inv) => {
      const invDate = parseSafeDate(inv.created_at);
      if (!invDate) return false;
      return (
        (invDate.getFullYear() === nowDate.getFullYear() && invDate.getMonth() === nowDate.getMonth()) ||
        invDate >= thirtyDaysAgoDate
      );
    });

    const salesMonth = monthly.reduce(
      (sum, i) => sum + (Number(i.total_amount) || 0),
      0
    );

    const overdue = invoices.filter((inv) => !isInvoiceFullyPaid(inv));
    const overdueTotal = overdue.reduce(
      (sum, i) => sum + (Number(i.total_amount) || 0),
      0
    );

    const todayPaid = invoices.filter((inv) => {
      if (!isInvoiceFullyPaid(inv)) return false;
      const dateToCheck = parseSafeDate(inv.payment_date) || parseSafeDate(inv.created_at);
      if (!dateToCheck) return false;
      return isSameDay(dateToCheck, nowDate);
    });

    const todayRec = todayPaid.reduce(
      (sum, i) => sum + (Number(i.total_amount) || 0),
      0
    );

    return {
      totalInvoices: total,
      paidInvoices: paid,
      totalSalesMonth: salesMonth,
      overdueAmount: overdueTotal,
      todayReceived: todayRec,
      recentInvoices: invoices.slice(0, 5),
      todayPaidInvoices: todayPaid,
      overdueInvoices: overdue,
    };
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Voice Invoice Hero Banner */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-teal-100 text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>هوش مصنوعی فاکتورچی فعال است</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            صدور فاکتور در کمتر از ۱۰ ثانیه با صدای شما
          </h2>
          <p className="text-xs sm:text-sm text-teal-100 max-w-xl">
            کافیست اقلام، نام مشتری و قیمت‌ها را به زبان فارسی بگویید تا فاکتور رسمی آماده تحویل شود.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
          {onStartTour && (
            <button
              id="dashboard-tour-btn"
              type="button"
              onClick={onStartTour}
              className="px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-2 border border-white/20 transition-all active:scale-95"
            >
              <Compass className="w-4 h-4" />
              <span>تور راهنمای سایت</span>
            </button>
          )}
          {isExpired ? (
            <button
              id="hero-expired-btn"
              onClick={() => onNavigate('billing')}
              className="px-5 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-900/40 hover:bg-rose-700 transition-all hover:scale-105 active:scale-95 animate-pulse"
            >
              <Lock className="w-4 h-4 text-white" />
              <span>تمدید اشتراک (حساب قفل است)</span>
            </button>
          ) : (
            <button
              id="hero-voice-btn"
              onClick={() => onNavigate('new-invoice')}
              className="px-5 py-3 rounded-xl bg-white text-teal-900 font-bold text-xs flex items-center gap-2 shadow-lg shadow-black/10 hover:bg-teal-50 transition-all hover:scale-105 active:scale-95"
            >
              <Mic className="w-4 h-4 text-teal-600" />
              <span>شروع ضبط صوت فاکتور</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Today Received */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>دریافتی امروز</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {formatToman(todayReceived)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" />
            <span>{todayPaidInvoices.length > 0 ? `${toPersianDigits(todayPaidInvoices.length)} فاکتور تسویه امروز` : 'تسویه فوری بانکی'}</span>
          </div>
        </div>

        {/* Overdue / Unpaid */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>طلب‌های معوقه</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {formatToman(overdueAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{toPersianDigits(overdueInvoices.length)} فاکتور پرداخت نشده</span>
          </div>
        </div>

        {/* Total Sales Month */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>کل فروش این ماه</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {formatToman(totalSalesMonth)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            <span>{invoices.length > 0 ? `${formatNumber(paidInvoices.length)} فاکتور تسویه شده` : 'در انتظار صدور فاکتور'}</span>
          </div>
        </div>

        {/* Invoice Count */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>تعداد فاکتورها</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {formatNumber(totalInvoices)} عدد
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{formatNumber(paidInvoices.length)} پرداخت شده</span>
          </div>
        </div>
      </div>

      {/* P&L Interactive Analytics Section */}
      <ProfitLossSection profile={profile} />

      {/* Recent Invoices Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              آخرین فاکتورهای صادر شده
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              دسترسی سریع به فاکتورهای جدید و ارسال مجدد
            </p>
          </div>

          {invoices.length > 0 && (
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              <span>مشاهده همه ({toPersianDigits(invoices.length)})</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                هنوز فاکتوری صادر نشده است
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                پایگاه داده شما خالی و آماده به کار است. اولین فاکتور هوشمند خود را با صوت یا متن ثبت کنید.
              </p>
            </div>
            <button
              onClick={() => onNavigate('new-invoice')}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-teal-500/20 transition-transform active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>صدور اولین فاکتور صوتی</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onSelectInvoice(inv)}
                className="py-3 px-2 flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                    {inv.voice_input_used ? <Mic className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {inv.title ? `${inv.title} (${inv.customer_name})` : inv.customer_name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {inv.title || inv.invoice_number} • {formatPersianDate(inv.created_at)}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <div className="font-black text-xs text-slate-900 dark:text-slate-100">
                    {formatToman(inv.total_amount)}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {inv.status === 'paid' ? (
                      <span className="text-emerald-600 font-semibold">پرداخت شده</span>
                    ) : inv.status === 'overdue' ? (
                      <span className="text-rose-600 font-semibold">معوقه</span>
                    ) : (
                      <span className="text-sky-600 font-semibold">ارسال شده</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
