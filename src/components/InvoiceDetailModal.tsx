import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  Send,
  CheckCircle2,
  Copy,
  QrCode,
  Download,
  Clock,
  Phone,
  FileText,
  CreditCard,
  ExternalLink,
  Check,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Image as ImageIcon,
  Eye,
  ZoomIn,
} from 'lucide-react';
import { Invoice, Profile } from '../types';
import { formatToman, toPersianDigits, formatPersianDate, copyToClipboard, formatPhoneForWhatsApp } from '../lib/utils';
import { exportInvoiceToPdf } from '../lib/pdfExport';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  profile?: Profile | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: Invoice['status']) => void;
  onOpenVerification?: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  profile,
  onClose,
  onUpdateStatus,
  onOpenVerification,
  onDeleteInvoice,
}) => {
  if (!invoice) return null;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [sendingWp, setSendingWp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReceiptImageModal, setShowReceiptImageModal] = useState(false);

  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.round(Math.max(0, subtotal - invoice.discount) * (invoice.tax_rate / 100));
  const trackingNumber = invoice.payment_tracking_number || '';
  const receiptUrl = invoice.payment_receipt_url || invoice.receipt_image_url || null;

  const handleCopyPaymentLink = async () => {
    const payUrl = `${window.location.origin}/payment/${invoice.id}`;
    const success = await copyToClipboard(payUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyTracking = async () => {
    if (!trackingNumber) return;
    const ok = await copyToClipboard(trackingNumber);
    if (ok) {
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const handleSendWhatsApp = async () => {
    setSendingWp(true);
    try {
      const res = await fetch('/api/whatsapp/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          customer_phone: invoice.customer_phone,
          origin: window.location.origin,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.whatsapp_link) {
          window.open(json.whatsapp_link, '_blank');
          return;
        }
      }

      // Client-side fallback if server response doesn't have link
      const formattedPhone = formatPhoneForWhatsApp(invoice.customer_phone);
      const itemsText = invoice.items.map((it, idx) => `${toPersianDigits(idx + 1)}. ${it.name} (${toPersianDigits(it.quantity)} عدد)`).join('\n');
      const payUrl = `${window.location.origin}/payment/${invoice.id}`;
      const fallbackMsg = `سلام ${invoice.customer_name || 'مشتری'} عزیز 🌸\nفاکتور شماره ${invoice.invoice_number} صادر شد.\n\n${itemsText}\n\n💰 مبلغ کل: ${formatToman(invoice.total_amount)}\n\n💳 لینک پرداخت و مشاهده فاکتور:\n${payUrl}\n\nبا تشکر`;
      const fallbackUrl = formattedPhone 
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
      window.open(fallbackUrl, '_blank');
    } catch (err) {
      console.error(err);
      const formattedPhone = formatPhoneForWhatsApp(invoice.customer_phone);
      const fallbackMsg = `فاکتور شماره ${invoice.invoice_number}\nمبلغ: ${formatToman(invoice.total_amount)}`;
      const fallbackUrl = formattedPhone 
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setSendingWp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
              مشاهده فاکتور {invoice.invoice_number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportInvoiceToPdf(invoice, profile)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
              title="دریافت فایل PDF و چاپ رسمی"
            >
              <Download className="w-4 h-4" />
              <span>خروجی PDF / چاپ</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Printable Invoice View */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Payment Status & Tracking Notification Card (No-print) */}
          {(invoice.payment_tracking_number || invoice.payment_status === 'pending_verification' || invoice.payment_status === 'paid' || invoice.payment_status === 'failed') && (
            <div className={`no-print p-4 rounded-2xl border text-xs space-y-3 ${
              invoice.payment_status === 'paid'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : invoice.payment_status === 'failed'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : invoice.payment_status === 'pending_verification'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                : invoice.status === 'paid'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {invoice.payment_status === 'paid' || (invoice.status === 'paid' && invoice.payment_status !== 'pending_verification' && invoice.payment_status !== 'failed') ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : invoice.payment_status === 'failed' ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                  )}
                  <span className="font-bold text-sm">
                    {invoice.payment_status === 'paid' || (invoice.status === 'paid' && invoice.payment_status !== 'pending_verification' && invoice.payment_status !== 'failed')
                      ? 'وضعیت پرداخت: تأیید شده و تسویه شد'
                      : invoice.payment_status === 'failed'
                      ? 'وضعیت پرداخت: رد شده / نامعتبر'
                      : 'وضعیت پرداخت: در انتظار تأیید فروشنده'}
                  </span>
                </div>

                {onOpenVerification && invoice.payment_status === 'pending_verification' && (
                  <button
                    onClick={() => onOpenVerification(invoice)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>بررسی و تأیید پرداخت</span>
                  </button>
                )}
              </div>

              {/* Tracking number and Receipt Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {invoice.payment_tracking_number && (
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">شماره پیگیری:</span>
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white" dir="ltr">
                        {invoice.payment_tracking_number}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyTracking}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTracking ? 'کپی شد' : 'کپی کد'}</span>
                    </button>
                  </div>
                )}

                {receiptUrl && (
                  <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <img
                        src={receiptUrl}
                        alt="رسید واریز"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setShowReceiptImageModal(true)}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">تصویر فیش واریزی</span>
                        <span className="text-[10px] text-slate-400">کلیک جهت بزرگ‌نمایی</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReceiptImageModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 text-xs font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده فیش</span>
                    </button>
                  </div>
                )}
              </div>

              {invoice.payer_name && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  <span>نام پرداخت‌کننده: </span>
                  <strong className="text-slate-800 dark:text-slate-200">{invoice.payer_name}</strong>
                </div>
              )}

              {invoice.verification_notes && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  <span>یادداشت بررسی: </span>
                  <span className="italic">{invoice.verification_notes}</span>
                </div>
              )}
            </div>
          )}

          {/* Printable Invoice Paper Area */}
          <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl font-black text-teal-800">
                  {profile?.business_name || 'فاکتور فروش'}
                </h1>
                <p className="text-xs text-slate-600 mt-1 font-semibold">
                  {profile?.full_name ? `صادرکننده: ${profile.full_name}` : 'فاکتور الکترونیک'}
                </p>
                {profile?.phone && (
                  <p className="text-[11px] text-slate-500">شماره تماس: {toPersianDigits(profile.phone)}</p>
                )}
              </div>

              <div className="text-left text-xs space-y-1">
                <div className="font-bold text-slate-900">
                  {invoice.invoice_number} :شماره
                </div>
                <div className="text-slate-500">
                  {formatPersianDate(invoice.created_at)} :تاریخ
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                  {invoice.status === 'paid' ? 'پرداخت شده ✅' : 'در انتظار پرداخت ⏳'}
                </div>
              </div>
            </div>

            {/* Buyer Details */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-medium">خریدار محترم: </span>
                  <span className="font-bold text-slate-900 text-sm">{invoice.customer_name}</span>
                </div>
                {invoice.customer_phone && (
                  <div>
                    <span className="text-slate-500 font-medium">تلفن: </span>
                    <span className="font-semibold text-slate-800 dir-ltr">{invoice.customer_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3 text-center w-10">ردیف</th>
                    <th className="py-2.5 px-3">شرح کالا یا خدمات</th>
                    <th className="py-2.5 px-3 text-center w-16">تعداد</th>
                    <th className="py-2.5 px-3 text-left w-28">قیمت واحد</th>
                    <th className="py-2.5 px-3 text-left w-32">قیمت کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {toPersianDigits(idx + 1)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-3 text-center text-slate-700">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="py-2.5 px-3 text-left text-slate-700 font-mono">
                        {formatToman(item.unit_price)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-black text-slate-900 font-mono">
                        {formatToman(item.quantity * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown */}
            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <div className="w-72 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>جمع کل فاکتور:</span>
                  <span className="font-mono font-semibold">{formatToman(subtotal)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex items-center justify-between text-rose-600">
                    <span>
                      مبلغ تخفیف
                      {invoice.discount_type === 'percent' && invoice.discount_percent
                        ? ` (${toPersianDigits(invoice.discount_percent)}٪)`
                        : ''}:
                    </span>
                    <span className="font-mono font-semibold">- {formatToman(invoice.discount)}</span>
                  </div>
                )}
                {invoice.tax_rate > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>مالیات ({toPersianDigits(invoice.tax_rate)}٪):</span>
                    <span className="font-mono font-semibold">+ {formatToman(taxAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-black text-base text-teal-900 border-t-2 border-teal-600 pt-2">
                  <span>مبلغ نهایی قابل پرداخت:</span>
                  <span className="font-mono">{formatToman(invoice.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Footer with Payment info & QR */}
            <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-600">
              <div className="space-y-1">
                {(profile?.card_number || profile?.sheba_number) ? (
                  <>
                    <p className="font-bold text-slate-800">اطلاعات واریز:</p>
                    {profile.card_number && (
                      <p className="font-mono text-slate-700">شماره کارت: {profile.card_number}</p>
                    )}
                    {profile.sheba_number && (
                      <p className="font-mono text-slate-700">شماره شبا: {profile.sheba_number}</p>
                    )}
                    {(profile.card_holder_name || profile.bank_name) && (
                      <p className="text-slate-500 text-[11px]">
                        به نام: {profile.card_holder_name || profile.full_name} {profile.bank_name ? `(${profile.bank_name})` : ''}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 text-xs">
                    {profile?.business_name ? `صادرکننده: ${profile.business_name}` : 'تسویه حساب طبق توافق'}
                  </p>
                )}
                {invoice.notes && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">یادداشت: {invoice.notes}</p>
                )}
              </div>

              <div className="text-center p-2 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-16 h-16 bg-slate-900 flex items-center justify-center text-white rounded-lg">
                  <QrCode className="w-12 h-12" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 mt-1 block">لینک پرداخت</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {invoice.status !== 'paid' ? (
              <button
                onClick={() => {
                  onUpdateStatus(invoice.id, 'paid');
                  onClose();
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ثبت به عنوان پرداخت شده</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onUpdateStatus(invoice.id, 'sent');
                  onClose();
                }}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                تغییر به در انتظار پرداخت
              </button>
            )}

            <button
              type="button"
              onClick={() => exportInvoiceToPdf(invoice, profile)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="دریافت و دانلود فایل PDF فاکتور"
            >
              <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>دانلود PDF</span>
            </button>

            <button
              onClick={handleCopyPaymentLink}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100"
            >
              <Copy className="w-4 h-4" />
              <span>{copiedLink ? 'لینک کپی شد ✅' : 'کپی لینک پرداخت'}</span>
            </button>

            <a
              href={`/payment/${invoice.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-100 dark:hover:bg-teal-900/50"
            >
              <ExternalLink className="w-4 h-4" />
              <span>صفحه پرداخت</span>
            </a>

            {onDeleteInvoice && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="حذف دائمی فاکتور"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف</span>
              </button>
            )}
          </div>

          <button
            onClick={handleSendWhatsApp}
            disabled={sendingWp}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>ارسال فاکتور در واتس‌اپ</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        invoice={invoice}
        isDeleting={isDeleting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          if (!invoice || !onDeleteInvoice) return;
          setIsDeleting(true);
          try {
            await onDeleteInvoice(invoice.id);
            setShowDeleteConfirm(false);
            onClose();
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      {/* Lightbox Modal for Receipt Full Preview */}
      {showReceiptImageModal && receiptUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowReceiptImageModal(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <ImageIcon className="w-4 h-4 text-teal-400" />
                <span>تصویر فیش واریزی ضمیمه فاکتور {invoice.invoice_number}</span>
                {invoice.payment_tracking_number && (
                  <span className="font-mono bg-slate-700 px-2 py-0.5 rounded-md text-amber-300 text-[11px]" dir="ltr">
                    کد پیگیری: {invoice.payment_tracking_number}
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
                  onClick={() => setShowReceiptImageModal(false)}
                  className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(90vh-90px)]">
              <img
                src={receiptUrl}
                alt="رسید واریز پرداخت"
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
