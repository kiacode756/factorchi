import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Clock,
  Filter,
  Check,
  X,
  AlertTriangle,
  FileImage,
  Loader2,
  ExternalLink,
  Users,
  CreditCard,
  Search,
  UserCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  BellRing,
  Trash2,
  Wand2,
  Plus,
} from 'lucide-react';
import { SubscriptionRequest, Profile, FeatureUpdate } from '../types';
import { formatToman, toPersianDigits, formatPersianDate } from '../lib/utils';

interface AdminUserItem {
  id: string;
  email: string;
  created_at: string;
  profile: Profile;
  invoices_count: number;
}

interface AdminPaymentsProps {
  requests: SubscriptionRequest[];
  onVerifyPayment: (requestId: string, adminNote?: string) => Promise<boolean>;
  onRejectPayment: (requestId: string, adminNote: string) => Promise<boolean>;
}

export const AdminPayments: React.FC<AdminPaymentsProps> = ({
  requests,
  onVerifyPayment,
  onRejectPayment,
}) => {
  // Main View: requests vs users_view vs feature_updates
  const [adminView, setAdminView] = useState<'requests' | 'users_view' | 'feature_updates'>('requests');

  // Requests state
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Users View state
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Feature Updates state
  const [featureList, setFeatureList] = useState<FeatureUpdate[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [featurePrompt, setFeaturePrompt] = useState('');
  const [isGeneratingFeature, setIsGeneratingFeature] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'x-user-id': 'usr-admin',
          'Authorization': 'Bearer usr-admin',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      }
    } catch (e) {
      console.error('Failed to fetch admin users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFeatures = async () => {
    setLoadingFeatures(true);
    try {
      const res = await fetch('/api/feature-updates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.updates)) {
          setFeatureList(data.updates);
        }
      }
    } catch (e) {
      console.error('Failed to fetch feature updates:', e);
    } finally {
      setLoadingFeatures(false);
    }
  };

  useEffect(() => {
    if (adminView === 'users_view') {
      fetchUsers();
    } else if (adminView === 'feature_updates') {
      fetchFeatures();
    }
  }, [adminView]);

  const handleCreateFeatureWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featurePrompt.trim() || isGeneratingFeature) return;

    setIsGeneratingFeature(true);
    try {
      const res = await fetch('/api/feature-updates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: featurePrompt.trim() }),
      });
      const data = await res.json();
      if (data.success && data.update) {
        setFeatureList(prev => [data.update, ...prev]);
        setFeaturePrompt('');
        setActionSuccess('قابلیت جدید با موفقیت توسط جمنای پردازش، طراحی و به صفحه اصلی اضافه شد.');
      }
    } catch (e) {
      console.error('Error generating feature with AI:', e);
    } finally {
      setIsGeneratingFeature(false);
    }
  };

  const handleDeleteFeature = async (id: string) => {
    if (!confirm('آیا از حذف این قابلیت اطمینان دارید؟')) return;
    try {
      const res = await fetch(`/api/feature-updates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFeatureList(prev => prev.filter(f => f.id !== id));
        setActionSuccess('قابلیت با موفقیت حذف گردید.');
      }
    } catch (e) {
      console.error('Error deleting feature update:', e);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterTab === 'all') return true;
    return r.status === filterTab;
  });

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.profile?.full_name && u.profile.full_name.toLowerCase().includes(q)) ||
      (u.profile?.business_name && u.profile.business_name.toLowerCase().includes(q)) ||
      (u.profile?.phone && u.profile.phone.includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const handleApprove = async (req: SubscriptionRequest) => {
    setActionLoading(true);
    try {
      const ok = await onVerifyPayment(req.id, adminNote || 'پرداخت تایید و اشتراک فعال شد.');
      if (ok) {
        setActionSuccess(`پرداخت کاربر ${req.user_name} با موفقیت تایید و اشتراک ۳۰ روزه فعال شد.`);
        setSelectedRequest(null);
        setAdminNote('');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (req: SubscriptionRequest) => {
    const reason = adminNote.trim() || prompt('لطفاً دلیل رد درخواست را وارد نمایید:') || '';
    if (!reason) {
      alert('وارد کردن دلیل رد درخواست الزامی است.');
      return;
    }

    setActionLoading(true);
    try {
      const ok = await onRejectPayment(req.id, reason);
      if (ok) {
        setActionSuccess(`درخواست کاربر ${req.user_name} رد شد.`);
        setSelectedRequest(null);
        setAdminNote('');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Navigation */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                پنل مدیریت و نظارت فاکتورچی (Admin Panel)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مدیریت کاربران، پروفایل‌ها (`users_view`) و تأیید پرداخت‌های اشتراک
              </p>
            </div>
          </div>

          {/* Primary View Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setAdminView('requests')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminView === 'requests'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>درخواست‌های اشتراک</span>
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {toPersianDigits(requests.filter(r => r.status === 'pending').length)}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminView('users_view')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminView === 'users_view'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>کاربران و پروفایل‌ها (users_view)</span>
            </button>
            <button
              onClick={() => setAdminView('feature_updates')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                adminView === 'feature_updates'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>قابلیت‌ها و فیچرهای جدید</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. USERS VIEW (کاربران و پروفایل‌ها)                       */}
      {/* ======================================================== */}
      {adminView === 'users_view' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="جستجو در نام، ایمیل، کسب‌وکار یا شماره تماس..."
                className="w-full pl-3 pr-10 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchUsers}
              disabled={loadingUsers}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>به‌روزرسانی لیست</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            {loadingUsers ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>در حال دریافت لیست کاربران و پروفایل‌ها...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                کاربری با این مشخصات یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold">
                      <th className="py-3.5 px-4">شناسه و نام کاربر</th>
                      <th className="py-3.5 px-4">ایمیل</th>
                      <th className="py-3.5 px-4">کسب‌وکار / تلفن</th>
                      <th className="py-3.5 px-4">نقش (Role)</th>
                      <th className="py-3.5 px-4">وضعیت اشتراک</th>
                      <th className="py-3.5 px-4">تاریخ عضویت</th>
                      <th className="py-3.5 px-4 text-center">تعداد فاکتورها</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Name & ID */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {usr.profile?.full_name || 'کاربر بدون نام'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {usr.id}
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {usr.email}
                        </td>

                        {/* Business / Phone */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-900 dark:text-slate-100">
                            {usr.profile?.business_name || '—'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {usr.profile?.phone || '—'}
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          {usr.profile?.role === 'admin' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              مدیر سیستم (Admin)
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              کاربر عادی
                            </span>
                          )}
                        </td>

                        {/* Subscription */}
                        <td className="py-3.5 px-4">
                          {usr.profile?.subscription_status === 'active' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              اشتراک فعال
                            </span>
                          )}
                          {usr.profile?.subscription_status === 'trial' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 border border-teal-500/20">
                              دوره آزمایشی (Trial)
                            </span>
                          )}
                          {usr.profile?.subscription_status === 'expired' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              منقضی شده
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {usr.created_at ? formatPersianDate(usr.created_at) : '—'}
                        </td>

                        {/* Invoices Count */}
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {toPersianDigits(usr.invoices_count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. REQUESTS VIEW (درخواست‌های کارت به کارت)                */}
      {/* ======================================================== */}
      {adminView === 'requests' && (
        <div className="space-y-4">
          {/* Sub Filter Tabs */}
          <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              فیلتر وضعیت درخواست‌ها:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {[
                { key: 'pending', label: 'در انتظار تأیید' },
                { key: 'approved', label: 'تأیید شده' },
                { key: 'rejected', label: 'رد شده' },
                { key: 'all', label: 'همه' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilterTab(t.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterTab === t.key
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            {filteredRequests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                هیچ درخواستی در این بخش وجود ندارد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3.5 px-4">نام و ایمیل کاربر</th>
                      <th className="py-3.5 px-4">مبلغ واریزی</th>
                      <th className="py-3.5 px-4">شماره پیگیری</th>
                      <th className="py-3.5 px-4">تصویر رسید</th>
                      <th className="py-3.5 px-4">تاریخ ثبت</th>
                      <th className="py-3.5 px-4">وضعیت</th>
                      <th className="py-3.5 px-4 text-center">عملیات ادمین</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* User */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{req.user_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{req.user_email}</div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-slate-100">
                          {formatToman(req.amount)}
                        </td>

                        {/* Transaction reference */}
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                          {req.transaction_reference}
                        </td>

                        {/* Receipt thumbnail */}
                        <td className="py-3.5 px-4">
                          {req.receipt_image_url ? (
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-teal-600 font-semibold"
                            >
                              <img
                                src={req.receipt_image_url}
                                alt="Receipt"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700"
                              />
                              <span>مشاهده</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">بدون تصویر</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatPersianDate(req.requested_at)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {req.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              تأیید شده
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              رد شده
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              در انتظار تأیید
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="بررسی رسید و جزئیات"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(req)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                                  title="تایید پرداخت"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>تأیید</span>
                                </button>
                                <button
                                  onClick={() => handleReject(req)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                                  title="رد پرداخت"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>رد</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. FEATURE UPDATES VIEW (مدیریت فیچرها با هوش مصنوعی جمنای) */}
      {/* ======================================================== */}
      {adminView === 'feature_updates' && (
        <div className="space-y-6">
          {/* AI Generator Box */}
          <div className="bg-gradient-to-br from-teal-500/10 via-white to-amber-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-teal-500/30 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/30">
                <Wand2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>تولید و انتشار هوشمند قابلیت جدید با هوش مصنوعی Gemini</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    Auto-Formatted
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  شرح فیچر جدید را به زبان محاوره‌ای بنویسید؛ جمنای آن را با عنوان حرفه‌ای، رنگ بج، آیکون و دکمه اکشن تنظیم و بلافاصله به باکس صفحه اصلی اضافه می‌کند.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateFeatureWithAi} className="space-y-3">
              <textarea
                rows={3}
                value={featurePrompt}
                onChange={(e) => setFeaturePrompt(e.target.value)}
                placeholder="مثال: قابلیت اتصال فاکتورها به درگاه پرداخت مستقیم سپهر و پرداخت یار اضافه شد و مشتریان می‌توانند بلافاصله وجه فاکتور را پرداخت کنند."
                className="w-full p-4 rounded-2xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                disabled={isGeneratingFeature}
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>همگام‌سازی خودکار با پایگاه داده ابری و باکس داشبورد کاربران</span>
                </span>

                <button
                  type="submit"
                  disabled={!featurePrompt.trim() || isGeneratingFeature}
                  className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isGeneratingFeature ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جمنای در حال پردازش...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تولید و انتشار در صفحه اصلی</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* List of active feature updates */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  لیست قابلیت‌های فعال در باکس «تازه‌های فاکتورچی» ({toPersianDigits(featureList.length)})
                </h4>
              </div>

              <button
                onClick={fetchFeatures}
                disabled={loadingFeatures}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="تازه‌سازی لیست"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFeatures ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingFeatures ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>در حال بارگذاری قابلیت‌ها...</span>
              </div>
            ) : featureList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                هنوز هیچ قابلیتی اضافه نشده است. با کادر بالا اولین مورد را بسازید.
              </div>
            ) : (
              <div className="space-y-3">
                {featureList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {item.badge}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          • {item.date}
                        </span>
                        {item.ai_generated && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            هوش مصنوعی جمنای
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                      {item.actionText && (
                        <div className="pt-1 text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                          دکمه اقدام: {item.actionText} (هدایت به {item.actionTab || 'صفحه اصلی'})
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteFeature(item.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                      title="حذف این قابلیت از صفحه اصلی"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View & Audit Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  بررسی رسید پرداخت کارت به کارت
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Image Display */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 max-h-72 flex items-center justify-center">
              {selectedRequest.receipt_image_url ? (
                <img
                  src={selectedRequest.receipt_image_url}
                  alt="Receipt Preview"
                  className="max-h-72 w-full object-contain"
                />
              ) : (
                <div className="py-12 text-slate-400 text-xs">رسید تصویری بارگذاری نشده است</div>
              )}
            </div>

            {/* Transaction Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="text-slate-500 block mb-0.5">نام کاربر:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRequest.user_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">ایمیل کاربر:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{selectedRequest.user_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">مبلغ واریزی:</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{formatToman(selectedRequest.amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">کد پیگیری:</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{selectedRequest.transaction_reference}</span>
              </div>
              {selectedRequest.user_note && (
                <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">یادداشت کاربر:</span>
                  <p className="text-slate-800 dark:text-slate-200 italic">{selectedRequest.user_note}</p>
                </div>
              )}
            </div>

            {/* Admin Note Input */}
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                یادداشت یا دلیل ادمین:
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="توضیحات برای ثبت در سوابق سیستم..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
              >
                بستن
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedRequest)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>رد درخواست</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>تأیید و فعال‌سازی اشتراک</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
