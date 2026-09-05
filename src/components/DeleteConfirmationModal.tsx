import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Invoice } from '../types';
import { formatToman, toPersianDigits } from '../lib/utils';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  invoice,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Warning Icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                حذف دائمی فاکتور
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                شماره فاکتور: <span className="font-mono font-bold" dir="ltr">{toPersianDigits(invoice.invoice_number)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">نام خریدار / مشتری:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{invoice.customer_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">مبلغ کل فاکتور:</span>
            <span className="font-black text-slate-900 dark:text-slate-100">{formatToman(invoice.total_amount)}</span>
          </div>
          {invoice.items && invoice.items.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
              <span>تعداد اقلام فاکتور:</span>
              <span>{toPersianDigits(invoice.items.length)} قلم کالا / خدمات</span>
            </div>
          )}
        </div>

        {/* Warning Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            آیا از حذف این فاکتور اطمینان دارید؟ با حذف فاکتور، تمام سوابق و اقلام مربوط به آن حذف شده و این عملیات قابل بازگشت نیست.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-rose-600/30 transition-transform active:scale-95 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'در حال حذف...' : 'بله، حذف شود'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
