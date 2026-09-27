import React, { useState } from 'react';
import {
  Search,
  Filter,
  FileText,
  Send,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MoreVertical,
  Plus,
  Eye,
  Trash2,
  Mic,
  MessageCircle,
  Copy,
  Check,
  ShieldAlert,
  CreditCard,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { Invoice } from '../types';
import { formatToman, toPersianDigits, formatPersianDate, formatPhoneForWhatsApp, copyToClipboard } from '../lib/utils';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onNewInvoice: () => void;
  onUpdateStatus: (id: string, status: Invoice['status']) => void;
  onDeleteInvoice: (id: string) => void;
  onOpenVerification?: (invoice: Invoice) => void;
}

type PaymentFilterType = 'all' | 'pending_verification' | 'paid' | 'unpaid' | 'failed';

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onUpdateStatus,
  onDeleteInvoice,
  onOpenVerification,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterType>('all');
  const [sendingWpId, setSendingWpId] = useState<string | null>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute payment status for an invoice
  const getInvoicePaymentStatus = (inv: Invoice): 'unpaid' | 'pending_verification' | 'paid' | 'failed' => {
    if (inv.payment_status) return inv.payment_status;
    if (inv.status === 'paid') return 'paid';
    if (inv.payment_tracking_number) return 'pending_verification';
    return 'unpaid';
  };

  const filteredInvoices = invoices.filter((inv) => {
    const pStatus = getInvoicePaymentStatus(inv);
    const trackingNum = inv.payment_tracking_number || '';

    const matchesSearch =
      inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.title && inv.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.customer_phone && inv.customer_phone.includes(searchQuery)) ||
      trackingNum.includes(searchQuery);

    const matchesPaymentStatus = paymentFilter === 'all' || pStatus === paymentFilter;

    return matchesSearch && matchesPaymentStatus;
  });

  const countPending = invoices.filter((i) => getInvoicePaymentStatus(i) === 'pending_verification').length;
  const countPaid = invoices.filter((i) => getInvoicePaymentStatus(i) === 'paid').length;
  const countUnpaid = invoices.filter((i) => getInvoicePaymentStatus(i) === 'unpaid').length;
  const countFailed = invoices.filter((i) => getInvoicePaymentStatus(i) === 'failed').length;

  const handleCopyTrackingNumber = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedTrackingId(code);
      setTimeout(() => setCopiedTrackingId(null), 2000);
    }
  };

  const getPaymentStatusBadge = (inv: Invoice) => {
    const status = getInvoicePaymentStatus(inv);
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            پرداخت شده
          </span>
        );
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            در انتظار تأیید
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            ناموفق
          </span>
        );
      case 'unpaid':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            پرداخت نشده
          </span>
        );
    }
  };

  const handleSendWhatsApp = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setSendingWpId(inv.id);
    try {
      const res = await fetch('/api/whatsapp/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: inv.id,
          customer_phone: inv.customer_phone,
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

      // Client fallback
      const formattedPhone = formatPhoneForWhatsApp(inv.customer_phone);
      const payUrl = `${window.location.origin}/payment/${inv.id}`;
      const fallbackMsg = `سلام ${inv.customer_name || 'مشتری'} عزیز 🌸\nفاکتور «${inv.title || inv.invoice_number}» به مبلغ ${formatToman(inv.total_amount)} صادر گردید.\n\n💳 لینک پرداخت و مشاهده فاکتور:\n${payUrl}`;
      const fallbackUrl = formattedPhone 
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
      window.open(fallbackUrl, '_blank');
    } catch (err) {
      console.error(err);
      const formattedPhone = formatPhoneForWhatsApp(inv.customer_phone);
      const payUrl = `${window.location.origin}/payment/${inv.id}`;
      const fallbackMsg = `فاکتور «${inv.title || inv.invoice_number}»\nمبلغ: ${formatToman(inv.total_amount)}\nلینک: ${payUrl}`;
      const fallbackUrl = formattedPhone 
        ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fallbackMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(fallbackMsg)}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setSendingWpId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header with Search and Quick Filters */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              مدیریت و پیگیری پرداخت فاکتورها
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مجموع {toPersianDigits(invoices.length)} فاکتور ثبت شده در سیستم
            </p>
          </div>

          <button
            onClick={onNewInvoice}
            className="self-stretch sm:self-auto justify-center px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-teal-500/20 transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>صدور فاکتور جدید</span>
          </button>
        </div>

        {/* Search Bar & Payment Status Filter Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس نام مشتری، شماره فاکتور، شماره پیگیری..."
              className="w-full pl-4 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Payment Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1 scrollbar-none">
            {[
              { key: 'all', label: 'همه فاکتورها', count: invoices.length },
              { key: 'pending_verification', label: 'در انتظار تأیید', count: countPending, highlight: countPending > 0 },
              { key: 'paid', label: 'پرداخت شده', count: countPaid },
              { key: 'unpaid', label: 'پرداخت نشده', count: countUnpaid },
              { key: 'failed', label: 'ناموفق', count: countFailed },
            ].map((tab) => {
              const isActive = paymentFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setPaymentFilter(tab.key as PaymentFilterType)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : tab.highlight
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : tab.highlight
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(tab.count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invoice List (Desktop Table / Mobile Card List) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        {filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold">هیچ فاکتوری با این فیلتر یا مشخصات یافت نشد.</p>
            <button
              onClick={onNewInvoice}
              className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline"
            >
              ایجاد فاکتور جدید
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">نام / شماره فاکتور</th>
                    <th className="py-3.5 px-4 font-semibold">نام مشتری</th>
                    <th className="py-3.5 px-4 font-semibold">تاریخ صدور</th>
                    <th className="py-3.5 px-4 font-semibold">مبلغ کل</th>
                    <th className="py-3.5 px-4 font-semibold">وضعیت پرداخت</th>
                    <th className="py-3.5 px-4 font-semibold">شماره پیگیری</th>
                    <th className="py-3.5 px-4 font-semibold">تاریخ پرداخت</th>
                    <th className="py-3.5 px-4 font-semibold text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInvoices.map((inv) => {
                    const pStatus = getInvoicePaymentStatus(inv);
                    const trackingNum = inv.payment_tracking_number || '';
                    const isCopied = copiedTrackingId === trackingNum;

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => onSelectInvoice(inv)}
                        className={`hover:bg-teal-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          pStatus === 'pending_verification' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Invoice Title / Number */}
                        <td className="py-4 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <span className="font-sans text-xs">{inv.title || inv.invoice_number}</span>
                        </td>

                        {/* Customer */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {inv.customer_name}
                          </div>
                          {inv.customer_phone && (
                            <div className="text-[11px] text-slate-400 dir-ltr text-right">
                              {inv.customer_phone}
                            </div>
                          )}
                        </td>

                        {/* Issue Date */}
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-400">
                          {formatPersianDate(inv.created_at)}
                        </td>

                        {/* Total Amount */}
                        <td className="py-4 px-4 font-black text-slate-900 dark:text-slate-100">
                          {formatToman(inv.total_amount)}
                        </td>

                        {/* Payment Status Badge */}
                        <td className="py-4 px-4">
                          {getPaymentStatusBadge(inv)}
                        </td>

                        {/* Payment Tracking Number */}
                        <td className="py-4 px-4 font-mono" onClick={(e) => e.stopPropagation()}>
                          {trackingNum ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs border border-slate-200 dark:border-slate-700">
                              {(inv.payment_receipt_url || inv.receipt_image_url) && (
                                <span title="دارای عکس فیش واریزی">
                                  <ImageIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                </span>
                              )}
                              <span dir="ltr">{toPersianDigits(trackingNum)}</span>
                              <button
                                onClick={(e) => handleCopyTrackingNumber(trackingNum, e)}
                                title="کپی شماره پیگیری"
                                className="p-0.5 rounded text-slate-400 hover:text-teal-600 transition-colors"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Payment Date */}
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                          {inv.payment_date ? formatPersianDate(inv.payment_date) : '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Verify button if pending */}
                            {pStatus === 'pending_verification' && onOpenVerification && (
                              <button
                                onClick={() => onOpenVerification(inv)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-transform active:scale-95"
                                title="بررسی و تأیید پرداخت"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تأیید پرداخت</span>
                              </button>
                            )}

                            {/* Send WhatsApp */}
                            <button
                              onClick={(e) => handleSendWhatsApp(inv, e)}
                              className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                              title="ارسال فاکتور در واتس‌اپ"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            {/* View details */}
                            <button
                              onClick={() => onSelectInvoice(inv)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="مشاهده فاکتور و چاپ"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoiceToDelete(inv);
                              }}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="حذف فاکتور"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map((inv) => {
                const pStatus = getInvoicePaymentStatus(inv);
                const trackingNum = inv.payment_tracking_number || '';
                const isCopied = copiedTrackingId === trackingNum;

                return (
                  <div
                    key={inv.id}
                    onClick={() => onSelectInvoice(inv)}
                    className={`p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800 transition-colors ${
                      pStatus === 'pending_verification' ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {inv.title || inv.invoice_number}
                      </span>
                      {getPaymentStatusBadge(inv)}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {inv.customer_name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatPersianDate(inv.created_at)}
                        </div>
                      </div>
                      <div className="text-left font-black text-sm text-teal-600 dark:text-teal-400">
                        {formatToman(inv.total_amount)}
                      </div>
                    </div>

                    {/* Tracking Number badge on mobile if available */}
                    {trackingNum && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-slate-500">
                          {(inv.payment_receipt_url || inv.receipt_image_url) && (
                            <span title="دارای عکس رسید">
                              <ImageIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            </span>
                          )}
                          <span>کد پیگیری:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                            {toPersianDigits(trackingNum)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleCopyTrackingNumber(trackingNum, e)}
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 border border-slate-200 dark:border-slate-600 flex items-center gap-1"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'کپی شد' : 'کپی'}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs gap-2">
                      <div className="flex items-center gap-2">
                        {pStatus === 'pending_verification' && onOpenVerification ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenVerification(inv);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأیید پرداخت</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleSendWhatsApp(inv, e)}
                            className="px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] font-semibold flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتس‌اپ</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoiceToDelete(inv);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          title="حذف فاکتور"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectInvoice(inv)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                      >
                        مشاهده فاکتور
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation In-App Modal */}
      <DeleteConfirmationModal
        isOpen={!!invoiceToDelete}
        invoice={invoiceToDelete}
        isDeleting={isDeleting}
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={async () => {
          if (!invoiceToDelete) return;
          setIsDeleting(true);
          try {
            await onDeleteInvoice(invoiceToDelete.id);
          } finally {
            setIsDeleting(false);
            setInvoiceToDelete(null);
          }
        }}
      />
    </div>
  );
};
