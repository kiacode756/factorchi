import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DailyProfitLoss, Timeframe, Profile } from '../types';
import { formatToman, toPersianDigits, formatNumber, fetchWithRetry } from '../lib/utils';
import { ExpenseManagerModal } from './ExpenseManagerModal';

interface ProfitLossSectionProps {
  profile?: Profile;
  onTimeframeChange?: (tf: Timeframe) => void;
}

export const ProfitLossSection: React.FC<ProfitLossSectionProps> = ({ profile }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyProfitLoss[]>([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [summary, setSummary] = useState({
    total_revenue: 0,
    total_expenses: 0,
    total_profit: 0,
    total_invoices: 0,
    has_custom_expenses: false,
    expenses_count: 0,
    category_breakdown: {} as Record<string, number>,
  });

  const fetchAnalytics = async (tf: Timeframe) => {
    setLoading(true);
    try {
      let userId = profile?.id || '';
      if (!userId) {
        try {
          const stored = localStorage.getItem('factorchi_user');
          if (stored) {
            const u = JSON.parse(stored);
            userId = u.id || '';
          }
        } catch {
          // ignore parse errors
        }
      }

      const res = await fetchWithRetry(`/api/analytics/profit-loss?timeframe=${tf}`, {
        headers: {
          'x-user-id': userId,
        },
      });

      if (res && res.ok) {
        try {
          const json = await res.json();
          if (json.success) {
            setData(json.data || []);
            if (json.summary) {
              setSummary(json.summary);
            }
          }
        } catch {
          // ignore json parse error
        }
      }
    } catch (err: any) {
      console.warn('[Analytics] Notice fetching profit-loss:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(timeframe);
  }, [timeframe]);

  const timeframeLabels: { key: Timeframe; label: string }[] = [
    { key: 'day', label: 'روزانه' },
    { key: 'week', label: 'هفتگی' },
    { key: 'month', label: 'ماهانه' },
    { key: 'year', label: 'سالانه' },
  ];

  const profitMarginPercent = summary.total_revenue > 0
    ? Math.round((summary.total_profit / summary.total_revenue) * 100)
    : 0;

  return (
    <section id="profit-loss-section" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header with Timeframe Tabs & Expense Management Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              گزارش سود و زیان (P&L) و تحلیل فروش
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            بررسی درآمد ناخالص، هزینه‌های واقعی ثبت‌شده و سود خالص حاصل از فاکتورها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Action Button: Register & Manage Expenses */}
          <button
            id="open-expense-modal-btn"
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>ثبت و مدیریت هزینه‌ها</span>
            {summary.expenses_count > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">
                {toPersianDigits(summary.expenses_count)}
              </span>
            )}
          </button>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
            {timeframeLabels.map((item) => (
              <button
                key={item.key}
                id={`timeframe-tab-${item.key}`}
                onClick={() => setTimeframe(item.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeframe === item.key
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {/* Total Revenue */}
        <div className="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">کل درآمد فروش</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-950 dark:text-emerald-100 mt-1">
            {formatToman(summary.total_revenue)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <span>فاکتورهای پرداخت‌شده</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="p-4 rounded-xl bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300">سود خالص (درآمد - هزینه)</span>
            <DollarSign className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-teal-950 dark:text-teal-100 mt-1">
            {formatToman(summary.total_profit)}
          </div>
          <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1">
            <span>حاشیه سود خالص: {toPersianDigits(profitMarginPercent)}٪</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 dark:text-rose-300">کل هزینه‌ها</span>
            <div className="flex items-center gap-1">
              {summary.has_custom_expenses ? (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  واقعی
                </span>
              ) : (
                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  <AlertCircle className="w-3 h-3" />
                  ثبت نشده
                </span>
              )}
              <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-950 dark:text-rose-100 mt-1">
            {formatToman(summary.total_expenses)}
          </div>
          <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 flex items-center justify-between">
            {summary.has_custom_expenses ? (
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="hover:underline font-semibold"
              >
                {toPersianDigits(summary.expenses_count)} هزینه ثبت‌شده (مشاهده)
              </button>
            ) : (
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="hover:underline font-bold flex items-center gap-1 text-rose-600 dark:text-rose-400"
              >
                <Plus className="w-3 h-3" />
                ثبت اولین هزینه
              </button>
            )}
          </div>
        </div>

        {/* Invoice Count */}
        <div className="p-4 rounded-xl bg-slate-500/5 dark:bg-slate-500/10 border border-slate-300/40 dark:border-slate-700/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">تعداد فاکتورها</span>
            <Receipt className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatNumber(summary.total_invoices)} عدد
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span>میانگین هر فاکتور: {formatToman(summary.total_invoices ? Math.round(summary.total_revenue / summary.total_invoices) : 0)}</span>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0D9488" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              stroke="#94A3B8"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
            />
            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => toPersianDigits(Math.round(value / 1000000)) + ' م'}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const revVal = payload.find(p => p.dataKey === 'revenue')?.value as number || 0;
                  const expVal = payload.find(p => p.dataKey === 'expenses')?.value as number || 0;
                  const profVal = payload.find(p => p.dataKey === 'profit')?.value as number || 0;

                  return (
                    <div className="p-3 bg-slate-900/95 text-white rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 backdrop-blur-md min-w-[180px]">
                      <div className="font-bold border-b border-slate-800 pb-1 text-slate-300">
                        {label}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>درآمد کل:</span>
                        <span className="font-semibold">{formatToman(revVal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-rose-400">
                        <span>کل هزینه‌ها:</span>
                        <span className="font-semibold">{formatToman(expVal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-teal-400 pt-1 border-t border-slate-800">
                        <span>سود خالص:</span>
                        <span className="font-bold">{formatToman(profVal)}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="درآمد"
              stroke="#10B981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="هزینه‌ها"
              stroke="#F43F5E"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorExpenses)"
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="سود خالص"
              stroke="#0D9488"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorProfit)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400">درآمد ناخالص</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500" />
          <span className="text-slate-600 dark:text-slate-400">کل هزینه‌های واقعی</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-teal-600" />
          <span className="text-slate-600 dark:text-slate-400">سود خالص (P&L)</span>
        </div>
      </div>

      {/* Expense Manager Modal */}
      <ExpenseManagerModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onExpenseChanged={() => fetchAnalytics(timeframe)}
      />
    </section>
  );
};

