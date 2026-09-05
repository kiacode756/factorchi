import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Search,
  Building2,
  User,
  Calendar,
  CreditCard,
  FileText,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  Download,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Invoice } from '../types';
import { formatToman, toPersianDigits, formatPersianDate, copyToClipboard } from '../lib/utils';

interface PaymentVerificationModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (invoiceId: string, status: 'paid' | 'failed', notes?: string) => Promise<boolean>;
}

export const PaymentVerificationModal: React.FC<PaymentVerificationModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onVerify,
}) => {
  if (!isOpen || !invoice) return null;

  const [copiedCode, setCopiedCode] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState(invoice.verification_notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullReceiptModal, setShowFullReceiptModal] = useState(false);

  useEffect(() => {
    setVerificationNotes(invoice.verification_notes || '');
    setError(null);
  }, [invoice]);

  const trackingNumber = invoice.payment_tracking_number || invoice.notes?.match(/کد پیگیری پرداخت:\s*([^\s|]+)/)?.[1] || 'ثبت نشده';
  const receiptUrl = invoice.payment_receipt_url || invoice.receipt_image_url || null;

  const handleCopyCode = async () => {
    if (!trackingNumber || trackingNumber === 'ثبت نشده') return;
    const ok = await copyToClipboard(trackingNumber);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAction = async (status: 'paid' | 'failed') => {
    setSubmitting(true);
    setError(null);
    try {
      const success = await onVerify(invoice.id, status, verificationNotes.trim());
      if (success) {
        onClose();
      } else {
        setError('خطا در ثبت وضعیت پرداخت. لطفاً مجدداً تلاش کنید.');
      }
    } catch (e: any) {
      setError(e.message || 'خطا در ارسال درخواست.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
        <div
          className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  بررسی و تطبیق فیش پرداخت با فاکتور
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  شماره فاکتور: {invoice.invoice_number}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
            {/* Comparison Box: Tracking Code & Receipt Image */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  🔍 اطلاعات تطبیق واریز خریدار:
                </span>
                {receiptUrl ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    عکس رسید ضمیمه است
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                    بدون ضمیمه تصویری
                  </span>
                )}
              </div>

              {/* Tracking Code */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-medium">
                  شماره پیگیری / ارجاع ثبت‌شده توسط مشتری:
                </span>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-300 dark:border-amber-700/60 shadow-xs">
                  <span className="font-mono font-black text-base text-slate-900 dark:text-white dir-ltr select-all">
                    {trackingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'کپی شد' : 'کپی کد'}</span>
                  </button>
                </div>
              </div>

              {/* Receipt Image Display */}
              {receiptUrl ? (
                <div className="space-y-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-teal-600" />
                      <span>تصویر رسید / فیش بانکی ارسالی:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFullReceiptModal(true)}
                      className="text-teal-600 dark:text-teal-400 hover:underline font-bold text-[11px] flex items-center gap-1"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>بزرگ‌نمایی تصویر</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setShowFullReceiptModal(true)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-amber-300/80 dark:border-amber-700 bg-black/5 dark:bg-black/30 max-h-56 flex items-center justify-center hover:border-teal-500 transition-colors"
                  >
                    <img
                      src={receiptUrl}
                      alt="فیش واریزی پرداخت"
                      className="w-full max-h-56 object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold gap-2 transition-opacity rounded-xl backdrop-blur-xs">
                      <ZoomIn className="w-5 h-5" />
                      <span>مشاهده در اندازه واقعی و کامل</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 text-center text-xs">
                  مشتری تصویر فیش را آپلود نکرده است. لطفاً شماره پیگیری بالا را در سامانه یا همراه بانک خود استعلام فرمایید.
                </div>
              )}
            </div>

            {/* Invoice & Payment Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">مشتری:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {invoice.customer_name}
                </span>
                {invoice.customer_phone && (
                  <span className="text-[11px] text-slate-500 font-mono dir-ltr block text-right">
                    {invoice.customer_phone}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">مبلغ کل صورتحساب:</span>
                <span className="font-black text-sm text-teal-600 dark:text-teal-400 mt-0.5 block font-mono">
                  {formatToman(invoice.total_amount)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">نام پرداخت‌کننده:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {invoice.payer_name || 'اعلام نشده'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700 col-span-2 sm:col-span-3">
                <span className="text-slate-400 block text-[11px]">تاریخ ثبت اعلام پرداخت:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block font-mono">
                  {invoice.payment_date ? formatPersianDate(invoice.payment_date) : formatPersianDate(invoice.updated_at)}
                </span>
              </div>
            </div>

            {/* Bank Quick Inquiry Links */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                استعلام سریع از سامانه‌های بانکی:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://shaparak.ir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-semibold">سامانه شاپرک</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <a
                  href="https://bam.bmi.ir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-semibold">همراه بانک ملی</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <a
                  href="https://ebanking.bankmellat.ir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-semibold">اینترنت بانک ملت</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-700 flex items-center justify-between transition-colors text-right"
                >
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-teal-600" />
                    <span className="font-semibold">کپی کد پیگیری</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Verification Notes */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                توضیحات و یادداشت بررسی (اختیاری):
              </label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="مثال: رسید با حساب مقصد مطابقت داشت و تأیید شد."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
            >
              انصراف
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('failed')}
                className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>رد پرداخت (عدم تطابق)</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleAction('paid')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-transform active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'در حال تأیید...' : 'تأیید پرداخت و تسویه فاکتور'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Receipt Lightbox Modal */}
      {showFullReceiptModal && receiptUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowFullReceiptModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <ImageIcon className="w-4 h-4 text-teal-400" />
                <span>تصویر فیش واریزی - فاکتور {invoice.invoice_number}</span>
                {trackingNumber !== 'ثبت نشده' && (
                  <span className="font-mono bg-slate-700 px-2 py-0.5 rounded-md text-amber-300 text-[11px]" dir="ltr">
                    کد پیگیری: {trackingNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={receiptUrl}
                  download={`receipt-${invoice.invoice_number}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors flex items-center gap-1 text-xs font-medium px-2.5"
                  title="دانلود تصویر رسید"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود</span>
                </a>
                <button
                  onClick={() => setShowFullReceiptModal(false)}
                  className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(92vh-90px)]">
              <img
                src={receiptUrl}
                alt="فیش واریزی کامل"
                className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
