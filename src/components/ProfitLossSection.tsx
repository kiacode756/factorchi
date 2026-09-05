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
import { TrendingUp, DollarSign, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { DailyProfitLoss, Timeframe } from '../types';
import { formatToman, toPersianDigits, formatNumber } from '../lib/utils';

interface ProfitLossSectionProps {
  onTimeframeChange?: (tf: Timeframe) => void;
}

export const ProfitLossSection: React.FC<ProfitLossSectionProps> = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DailyProfitLoss[]>([]);
  const [summary, setSummary] = useState({
    total_revenue: 0,
    total_expenses: 0,
    total_profit: 0,
    total_invoices: 0,
  });

  const fetchAnalytics = async (tf: Timeframe) => {
    setLoading(true);
    try {
      let userId = '';
      try {
        const stored = localStorage.getItem('factorchi_user');
        if (stored) {
          const u = JSON.parse(stored);
          userId = u.id || '';
        }
      } catch (e) {
        console.error(e);
      }

      const res = await fetch(`/api/analytics/profit-loss?timeframe=${tf}`, {
        headers: {
          'x-user-id': userId,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setSummary(json.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
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

  return (
    <section id="profit-loss-section" className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header with Timeframe Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
            بررسی درآمد ناخالص، هزینه‌ها و سود خالص حاصل از فاکتورهای صادر شده
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60 self-start sm:self-auto">
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
            <span>+۱۲٪ رشد نسبت به دوره قبل</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="p-4 rounded-xl bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300">سود خالص</span>
            <DollarSign className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-teal-950 dark:text-teal-100 mt-1">
            {formatToman(summary.total_profit)}
          </div>
          <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1">
            <span>حاشیه سود خالص: ۷۸٪</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 dark:text-rose-300">کل هزینه‌ها</span>
            <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-950 dark:text-rose-100 mt-1">
            {formatToman(summary.total_expenses)}
          </div>
          <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
            <span>۲۲٪ از کل فروش ناخالص</span>
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
                  return (
                    <div className="p-3 bg-slate-900/95 text-white rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 backdrop-blur-md">
                      <div className="font-bold border-b border-slate-800 pb-1 text-slate-300">
                        {label}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>درآمد کل:</span>
                        <span className="font-semibold">{formatToman(payload[0]?.value as number)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-teal-400">
                        <span>سود خالص:</span>
                        <span className="font-semibold">{formatToman(payload[1]?.value as number)}</span>
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
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400">درآمد ناخالص</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-teal-600" />
          <span className="text-slate-600 dark:text-slate-400">سود خالص</span>
        </div>
      </div>
    </section>
  );
};
