import React, { useState } from 'react';
import {
  CreditCard,
  Check,
  Sparkles,
  Copy,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileImage,
  Loader2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Profile, SubscriptionRequest } from '../types';
import { formatToman, toPersianDigits, formatPersianDate, copyToClipboard } from '../lib/utils';

interface BillingPageProps {
  profile: Profile;
  requests: SubscriptionRequest[];
  onSubmitPayment: (formData: FormData) => Promise<boolean>;
}

export const BillingPage: React.FC<BillingPageProps> = ({
  profile,
  requests,
  onSubmitPayment,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedCard, setCopiedCard] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [userNote, setUserNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cardNumber = '6219-8614-0699-3534';
  const cardHolder = 'کیارش باقری';
  const bankName = 'بانک سامان';
  const planPrice = 500000;

  const handleCopyCard = async () => {
    const success = await copyToClipboard(cardNumber.replace(/-/g, ''));
    if (success) {
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم تصویر رسید نباید بیشتر از ۵ مگابایت باشد.');
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim()) {
      alert('لطفاً شماره پیگیری تراکنش را وارد کنید.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      if (receiptFile) fd.append('receipt_image', receiptFile);
      fd.append('transaction_reference', transactionRef);
      fd.append('user_note', userNote);
      fd.append('user_id', profile.id);
      fd.append('user_name', profile.full_name);
      fd.append('user_email', profile.email || 'user@example.com');

      const ok = await onSubmitPayment(fd);
      if (ok) {
        setSuccessMessage('رسید پرداخت شما با موفقیت ثبت شد و در صف تایید ادمین قرار گرفت.');
        setModalOpen(false);
        setTransactionRef('');
        setUserNote('');
        setReceiptFile(null);
        setReceiptPreview(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: SubscriptionRequest['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            تایید و فعال شده
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            رد شده
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            در انتظار بررسی ادمین
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <span className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <CreditCard className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              مدیریت اشتراک و ارتقاء حساب
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              دسترسی نامحدود به دستیار هوش مصنوعی و صدور فاکتور صوتی
            </p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Subscription Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                {profile.role === 'admin' ? 'سطح دسترسی شما' : 'طرح فعال شما'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-500/20 border border-teal-400/30 text-teal-300">
                {profile.role === 'admin'
                  ? 'مدیر سیستم (دسترسی دائمی و نامحدود)'
                  : profile.subscription_status === 'active'
                  ? 'اشتراک حرفه‌ای فعال'
                  : 'نیازمند تمدید'}
              </span>
            </div>

            <h3 className="text-2xl font-black">
              {profile.role === 'admin'
                ? 'حساب جامع مدیریت سیستم'
                : 'اشتراک ماهانه فاکتورچی'}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
              {profile.role === 'admin'
                ? 'حساب شما دارای دسترسی دائمی، بدون محدودیت زمانی یا انقضا به کلیه امکانات صوتی، هوش مصنوعی، گزارشات سود و زیان و پنل بررسی پرداخت‌ها می‌باشد.'
                : 'صدور نامحدود فاکتور با صدا، اشتراک در واتس‌اپ، گزارشات سود و زیان P&L و پشتیبانی اختصاصی'}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-700/60 mt-4 flex items-center justify-between relative z-10 text-xs">
            <div>
              <span className="text-slate-400">وضعیت اعتبار حساب:</span>
              <div className="font-bold text-teal-300 text-sm mt-0.5">
                {profile.role === 'admin'
                  ? 'دائمی و نامحدود (بدون انقضا)'
                  : profile.subscription_expires_at
                  ? formatPersianDate(profile.subscription_expires_at)
                  : 'اعتبار فعال'}
              </div>
            </div>

            {profile.role !== 'admin' && (
              <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 transition-transform active:scale-95 flex items-center gap-1.5"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>تمدید / خرید اشتراک</span>
              </button>
            )}
          </div>
        </div>

        {/* Pricing Summary Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
              {profile.role === 'admin' ? 'امکانات حساب مدیر' : 'تعرفه رسمی'}
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {profile.role === 'admin' ? 'نامحدود' : formatToman(planPrice)}
              </span>
              {profile.role !== 'admin' && (
                <span className="text-xs text-slate-500 dark:text-slate-400">/ ماهانه</span>
              )}
            </div>

            <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-600" />
                <span>فاکتور نامحدود</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-600" />
                <span>تبدیل صوت به فاکتور هوشمند</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-600" />
                <span>ارسال مستقیم واتس‌اپ</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-600" />
                <span>گزارشات کامل سود و زیان (P&L)</span>
              </li>
              {profile.role === 'admin' && (
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">پنل مدیریت و تایید فاکتورهای پرداختی</span>
                </li>
              )}
            </ul>
          </div>

          {profile.role !== 'admin' ? (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs text-center shadow-sm"
            >
              خرید اشتراک (کارت به کارت)
            </button>
          ) : (
            <div className="w-full mt-6 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs text-center">
              ✓ حساب مدیر فعال است
            </div>
          )}
        </div>
      </div>

      {/* Payment Requests History Table */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
          تاریخچه درخواست‌های واریز و اشتراک
        </h3>

        {requests.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            هنوز درخواست واریزی ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3 px-4">کد پیگیری تراکنش</th>
                  <th className="py-3 px-4">مبلغ</th>
                  <th className="py-3 px-4">تاریخ درخواست</th>
                  <th className="py-3 px-4">وضعیت</th>
                  <th className="py-3 px-4">توضیحات ادمین</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {req.transaction_reference}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {formatToman(req.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatPersianDate(req.requested_at)}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(req.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {req.admin_note || req.user_note || '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card to Card Payment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  پرداخت و فعال‌سازی اشتراک
                </h3>
                <p className="text-xs text-slate-500">
                  انتقال کارت به کارت و ارسال رسید پرداخت
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Area */}
            <form onSubmit={handleSubmitRequest} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
                {/* Bank Card Info Display */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800/80 border border-teal-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                      مشخصات حساب جهت واریز
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      مبلغ: {formatToman(planPrice)}
                    </span>
                  </div>

                  {/* Card Number Box with Copy */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-teal-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">شماره کارت (بانک سامان):</span>
                      <span className="font-mono text-sm font-black text-slate-900 dark:text-white tracking-widest dir-ltr">
                        {cardNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCard}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCard ? 'کپی شد' : 'کپی کارت'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
                    <span>به نام: <strong className="text-slate-800 dark:text-slate-200">{cardHolder}</strong></span>
                    <span>بانک: <strong className="text-slate-800 dark:text-slate-200">{bankName}</strong></span>
                  </div>
                </div>

                {/* Payment Steps */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">مراحل پرداخت:</div>
                  <div>۱. شماره کارت بالا را کپی و مبلغ ۵۰۰,۰۰۰ تومان را واریز فرمایید.</div>
                  <div>۲. اسکرین‌شات یا عکس رسید واریز را در فرم زیر بارگذاری کنید.</div>
                  <div>۳. شماره پیگیری تراکنش را وارد کرده و دکمه ثبت را بزنید.</div>
                </div>

                {/* Receipt File Upload */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تصویر رسید پرداخت (اسکرین‌شات بانکی):
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 text-center cursor-pointer hover:border-teal-500 transition-colors relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {receiptPreview ? (
                      <div className="flex items-center justify-center gap-3">
                        <img src={receiptPreview} alt="Receipt preview" className="w-16 h-16 object-cover rounded-lg border" />
                        <div className="text-right">
                          <span className="font-bold text-teal-600 block">رسید انتخاب شد</span>
                          <span className="text-[10px] text-slate-400">برای تغییر دوباره کلیک کنید</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <Upload className="w-6 h-6 mx-auto text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                          برای انتخاب عکس رسید کلیک کنید
                        </span>
                        <span className="text-[10px] text-slate-400">فرمت‌های تصویری JPG, PNG (حداکثر ۵ مگابایت)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction Reference Number */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    شماره پیگیری / شماره ارجاع تراکنش: *
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="مثال: 98234710 یا TRX-1403"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>

                {/* User Note */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    توضیحات (اختیاری):
                  </label>
                  <input
                    type="text"
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="مثلاً: واریز از اپلیکیشن آپ یا همراه بانک تجارت"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Sticky Action Footer (Optimized for Mobile & Desktop) */}
              <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 z-30 shadow-lg sm:shadow-none flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  <span>ثبت واریز و ارسال برای تایید</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
