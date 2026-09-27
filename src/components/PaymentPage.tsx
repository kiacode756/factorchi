import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  Share2,
  Clock,
  ShieldCheck,
  Building2,
  User,
  Phone,
  FileText,
  ArrowRight,
  Send,
  Lock,
  DollarSign,
  AlertCircle,
  HelpCircle,
  UploadCloud,
  Image as ImageIcon,
  X,
  Eye,
  ZoomIn
} from 'lucide-react';
import { Invoice, Profile } from '../types';
import { 
  formatToman, 
  toPersianDigits, 
  persianToEnglishDigits,
  formatCardNumberEnglish,
  formatPersianDate, 
  formatNumberWithCommas, 
  copyToClipboard 
} from '../lib/utils';
import { ReceiptLightboxModal } from './ReceiptImageViewer';

interface PaymentPageProps {
  invoiceId?: string;
  onNavigateHome?: () => void;
}

interface SellerInfo {
  business_name?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  card_number?: string;
  card_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  sheba_number?: string;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  invoiceId: propInvoiceId,
  onNavigateHome,
}) => {
  // Extract invoiceId from prop or window location pathname / search
  const [invoiceId, setInvoiceId] = useState<string>(() => {
    if (propInvoiceId) return propInvoiceId;
    const path = window.location.pathname;
    const match = path.match(/\/(?:payment|pay)\/([^/?#]+)/i);
    if (match && match[1]) return match[1];
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('id') || searchParams.get('invoiceId') || '';
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);

  // Active Payment Tab: 'card' | 'gateway'
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'gateway'>('card');

  // Copy state
  const [copiedCard, setCopiedCard] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedSheba, setCopiedSheba] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Confirmation Form State
  const [payerName, setPayerName] = useState('');
  const [payerCard, setPayerCard] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [submittedTracking, setSubmittedTracking] = useState('');
  const [submittedReceipt, setSubmittedReceipt] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [compressingImage, setCompressingImage] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch invoice and seller info
  useEffect(() => {
    const fetchInvoiceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/payment/${invoiceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.invoice) {
            setInvoice(data.invoice);
            setSeller(data.seller || null);
            if (data.invoice.payment_tracking_number) {
              setSubmittedTracking(data.invoice.payment_tracking_number);
            }
            if (data.invoice.payment_receipt_url || data.invoice.receipt_image_url) {
              setSubmittedReceipt(data.invoice.payment_receipt_url || data.invoice.receipt_image_url || null);
            }
            if (data.invoice.status === 'paid' || data.invoice.payment_status === 'paid') {
              setPaidSuccess(true);
            } else if (data.invoice.payment_status === 'pending_verification') {
              setPaidSuccess(true);
              setSuccessMessage('اطلاعات و رسید پرداخت قبلاً ثبت شده و در انتظار بررسی و تأیید فروشنده است.');
            }
            setLoading(false);
            return;
          }
        }

        // Fallback to public invoices endpoint
        const fallbackRes = await fetch(`/api/invoices/public/${invoiceId}`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          if (data.success && data.invoice) {
            setInvoice(data.invoice);
            setSeller(data.seller || null);
            if (data.invoice.payment_tracking_number) {
              setSubmittedTracking(data.invoice.payment_tracking_number);
            }
            if (data.invoice.payment_receipt_url || data.invoice.receipt_image_url) {
              setSubmittedReceipt(data.invoice.payment_receipt_url || data.invoice.receipt_image_url || null);
            }
            if (data.invoice.status === 'paid' || data.invoice.payment_status === 'paid') {
              setPaidSuccess(true);
            } else if (data.invoice.payment_status === 'pending_verification') {
              setPaidSuccess(true);
              setSuccessMessage('اطلاعات و رسید پرداخت قبلاً ثبت شده و در انتظار بررسی و تأیید فروشنده است.');
            }
            setLoading(false);
            return;
          }
        }

        setError('فاکتور مورد نظر یافت نشد یا ممکن است منقضی شده باشد.');
      } catch (err: any) {
        console.error('Error loading payment page:', err);
        setError('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
      } finally {
        setLoading(false);
      }
    };

    if (invoiceId) {
      fetchInvoiceData();
    } else {
      setLoading(false);
      setError('شناسه فاکتوری برای پرداخت مشخص نشده است.');
    }
  }, [invoiceId]);

  const handleCopyCard = async () => {
    if (!seller?.card_number) return;
    const clean = persianToEnglishDigits(seller.card_number).replace(/[^0-9]/g, '');
    const ok = await copyToClipboard(clean);
    if (ok) {
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2000);
    }
  };

  const handleCopyAmount = async () => {
    if (!invoice) return;
    const ok = await copyToClipboard(String(invoice.total_amount));
    if (ok) {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
  };

  const handleCopySheba = async () => {
    if (!seller?.sheba_number) return;
    const ok = await copyToClipboard(seller.sheba_number);
    if (ok) {
      setCopiedSheba(true);
      setTimeout(() => setCopiedSheba(false), 2000);
    }
  };

  const handleCopyShareLink = async () => {
    const link = window.location.href;
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Client-side image compression for fast and reliable uploading
  const compressReceiptImage = (
    file: File,
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82
  ): Promise<{ file: File; dataUrl: string }> => {
    return new Promise((resolve) => {
      // Non-image or SVG: resolve original
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve({ file, dataUrl: reader.result as string });
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const reader = new FileReader();
          reader.onload = () => resolve({ file, dataUrl: reader.result as string });
          reader.readAsDataURL(file);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const targetType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(targetType, quality);
        canvas.toBlob((blob) => {
          if (blob) {
            const originalBase = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${originalBase}_opt.jpg`, {
              type: targetType,
              lastModified: Date.now(),
            });
            resolve({ file: compressedFile, dataUrl });
          } else {
            resolve({ file, dataUrl });
          }
        }, targetType, quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => resolve({ file, dataUrl: reader.result as string });
        reader.readAsDataURL(file);
      };
      img.src = objectUrl;
    });
  };

  // Handle receipt image selection with automatic compression
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSubmitError('لطفاً یک فایل تصویری معتبر (JPG, PNG, WebP) انتخاب فرمایید.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setSubmitError('حجم تصویر فیش واریزی نباید بیشتر از ۲۵ مگابایت باشد.');
      return;
    }

    setSubmitError(null);
    setCompressingImage(true);

    try {
      // Auto-compress to ~150-250KB for instantaneous upload without proxy 413 errors
      const result = await compressReceiptImage(file, 1280, 1280, 0.82);
      setReceiptFile(result.file);
      setReceiptPreview(result.dataUrl);
    } catch (e) {
      console.warn('Compression error fallback:', e);
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setCompressingImage(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setSubmitError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Confirm payment via card-to-card or gateway
  const handleConfirmPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);
    
    // Normalize Persian/Arabic digits to English digits
    const rawCode = persianToEnglishDigits(trackingCode).trim();
    const cleanCode = rawCode.replace(/[^a-zA-Z0-9_-]/g, '');

    if (paymentMethod === 'card') {
      if (!cleanCode) {
        setSubmitError('لطفاً شماره ارجاع یا کد پیگیری تراکنش بانکی را وارد فرمایید.');
        return;
      }
      if (cleanCode.length < 5) {
        setSubmitError('شماره پیگیری باید حداقل ۵ رقم باشد.');
        return;
      }
    }

    setConfirming(true);
    try {
      const generatedCode = cleanCode || `TRX-${Date.now().toString().slice(-6)}`;
      const targetInvoiceId = invoice?.id || invoiceId;
      const targetInvoiceNumber = invoice?.invoice_number || '';

      let res: Response | null = null;
      let lastErrorMessage = '';

      // Primary submission method: FormData if receipt file is attached
      if (receiptFile) {
        try {
          const formData = new FormData();
          formData.append('invoice_id', targetInvoiceId);
          if (targetInvoiceNumber) {
            formData.append('invoice_number', targetInvoiceNumber);
          }
          formData.append('tracking_number', generatedCode);
          formData.append('tracking_code', generatedCode);
          formData.append('payer_name', payerName.trim());
          formData.append('payer_card', persianToEnglishDigits(payerCard).trim());
          formData.append('payment_method', paymentMethod === 'card' ? 'card_to_card' : 'online_gateway');
          formData.append('receipt_image', receiptFile);

          res = await fetch(`/api/payment/${encodeURIComponent(targetInvoiceId)}/confirm`, {
            method: 'POST',
            body: formData,
          });
        } catch (uploadNetErr: any) {
          console.warn('Multipart upload fetch notice, attempting JSON fallback:', uploadNetErr);
        }
      }

      // Secondary fallback: JSON payload if no file or if FormData upload faced proxy issue
      if (!res || !res.ok) {
        if (res) {
          const errData = await res.json().catch(() => ({}));
          lastErrorMessage = errData.error || '';
        }

        try {
          res = await fetch(`/api/payment/${encodeURIComponent(targetInvoiceId)}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoice_id: targetInvoiceId,
              invoice_number: targetInvoiceNumber,
              tracking_number: generatedCode,
              tracking_code: generatedCode,
              payer_name: payerName.trim(),
              payer_card: persianToEnglishDigits(payerCard).trim(),
              payment_method: paymentMethod === 'card' ? 'card_to_card' : 'online_gateway',
              receipt_image_url: receiptPreview || undefined,
            }),
          });
        } catch (jsonNetErr: any) {
          console.error('JSON confirm error:', jsonNetErr);
        }
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setPaidSuccess(true);
          setSubmittedTracking(generatedCode);
          if (receiptPreview) {
            setSubmittedReceipt(receiptPreview);
          } else if (data.invoice?.payment_receipt_url) {
            setSubmittedReceipt(data.invoice.payment_receipt_url);
          }
          setSuccessMessage(data.message || 'رسید و شماره پیگیری پرداخت با موفقیت ثبت شد و در انتظار تأیید فروشنده است.');
          if (invoice) {
            setInvoice({
              ...invoice,
              payment_status: 'pending_verification',
              payment_tracking_number: generatedCode,
              payment_receipt_url: receiptPreview || data.invoice?.payment_receipt_url,
              payer_name: payerName,
            });
          }
          return;
        } else {
          setSubmitError(data.error || lastErrorMessage || 'خطا در ثبت پرداخت.');
        }
      } else {
        const errJson = res ? await res.json().catch(() => ({})) : {};
        const msg = errJson.error || lastErrorMessage || (res?.status === 413 ? 'حجم تصویر فیش ارسالی بیش از حد مجاز است. لطفاً فایل کم‌حجم‌تری انتخاب فرمایید.' : 'خطا در ارتباط با سرور پرداخت.');
        setSubmitError(msg);
      }
    } catch (err: any) {
      console.error('Payment confirm error:', err);
      setSubmitError('خطا در ارتباط و ارسال اطلاعات پرداخت. لطفاً اتصال اینترنت خود را بررسی و مجدداً تلاش کنید.');
    } finally {
      setConfirming(false);
    }
  };

  // Format Card Number into 4-digit blocks with English digits
  const formatCardBlocks = (num?: string) => {
    return formatCardNumberEnglish(num);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20 flex items-center justify-center animate-pulse mb-4">
          <FileText className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">در حال فراخوانی اطلاعات فاکتور...</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">لطفاً چند لحظه شکیبا باشید</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">فاکتور یافت نشد</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {error || 'شناسه فاکتور نامعتبر است یا توسط فروشنده لغو شده است.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigateHome ? onNavigateHome() : window.location.href = '/'}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به صفحه اصلی</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isFullyPaid = invoice.status === 'paid' || invoice.payment_status === 'paid';
  const isPendingVerification = !isFullyPaid && (invoice.payment_status === 'pending_verification' || paidSuccess);
  const isFailed = invoice.payment_status === 'failed';
  const isUnpaid = !isFullyPaid && !isPendingVerification && !isFailed;
  const subtotal = (invoice.items || []).reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
  const totalRials = (invoice.total_amount || 0) * 10;
  const trackingNumberToShow = submittedTracking || invoice.payment_tracking_number || '';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Top Header & Trust Badge */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              ف
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-slate-900 dark:text-white">فاکتورچی</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 font-bold border border-teal-200 dark:border-teal-800/60 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  درگاه امن پرداخت
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">سامانه صدور و پرداخت هوشمند صورتحساب</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ فاکتور</span>
            </button>
            <button
              onClick={handleCopyShareLink}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'کپی شد' : 'اشتراک‌گذاری'}</span>
            </button>
          </div>
        </div>

        {/* Payment Status Banner */}
        {isFullyPaid && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 space-y-4 text-emerald-900 dark:text-emerald-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black">این فاکتور با موفقیت پرداخت و تأیید شد</h3>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {successMessage || 'مبلغ صورتحساب تسویه گردید و رسید پرداخت برای فروشنده و خریدار به ثبت رسید.'}
                  </p>
                </div>
              </div>
              {trackingNumberToShow && (
                <div className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] text-slate-500">کد پیگیری:</span>
                  <span dir="ltr">{toPersianDigits(trackingNumberToShow)}</span>
                </div>
              )}
            </div>

            {(submittedReceipt || invoice.payment_receipt_url) && (
              <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={submittedReceipt || invoice.payment_receipt_url}
                    alt="فیش واریز"
                    className="w-12 h-12 object-cover rounded-lg border border-emerald-200 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setPreviewImageModal(submittedReceipt || invoice.payment_receipt_url || null)}
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">تصویر فیش واریزی ضمیمه شده</span>
                    <span className="text-[11px] text-slate-500">جهت مشاهده در اندازه بزرگ روی تصویر کلیک کنید</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(submittedReceipt || invoice.payment_receipt_url || null)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>مشاهده فیش</span>
                </button>
              </div>
            )}
          </div>
        )}

        {isPendingVerification && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-5 space-y-4 text-amber-900 dark:text-amber-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black">پرداخت در انتظار بررسی و تطبیق توسط فروشنده است</h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  اطلاعات و تصویر فیش واریزی شما با موفقیت ثبت شد. فروشنده شماره پیگیری درج‌شده را با تصویر فیش مطابقت داده و سپس فاکتور را تسویه خواهد کرد.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trackingNumberToShow && (
                <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-amber-300/80 dark:border-amber-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">شماره پیگیری ثبت‌شده:</span>
                    <span className="font-mono font-bold text-amber-800 dark:text-amber-300 text-sm" dir="ltr">
                      {trackingNumberToShow}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(trackingNumberToShow);
                      setCopiedTracking(true);
                      setTimeout(() => setCopiedTracking(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 hover:bg-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTracking ? 'کپی شد ✓' : 'کپی کد'}</span>
                  </button>
                </div>
              )}

              {(submittedReceipt || invoice.payment_receipt_url) && (
                <div className="p-3 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-amber-300/80 dark:border-amber-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={submittedReceipt || invoice.payment_receipt_url}
                      alt="فیش واریزی"
                      className="w-10 h-10 object-cover rounded-lg border border-amber-200 cursor-pointer hover:opacity-80"
                      onClick={() => setPreviewImageModal(submittedReceipt || invoice.payment_receipt_url || null)}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-bold">عکس رسید ضمیمه شده</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal(submittedReceipt || invoice.payment_receipt_url || null)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 hover:bg-amber-200 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>مشاهده</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-5 flex items-start gap-4 text-rose-900 dark:text-rose-100">
            <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black">پرداخت قبلی تأیید نشد</h3>
              <p className="text-xs opacity-90 leading-relaxed">
                اطلاعات واریزی قبلی توسط فروشنده رد شد. لطفاً تصویر فیش معتبر و شماره پیگیری صحیح را وارد و مجدداً ثبت فرمایید.
              </p>
            </div>
          </div>
        )}

        {isUnpaid && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl p-5 flex items-start gap-4 text-sky-900 dark:text-sky-100">
            <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black">صورتحساب در انتظار پرداخت است</h3>
              <p className="text-xs opacity-90 leading-relaxed">
                جهت تسویه، می‌توانید از طریق انتقال کارت به کارت یا درگاه پرداخت آنلاین اقدام فرمایید.
              </p>
            </div>
          </div>
        )}

        {/* Invoice Main Details Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">صورتحساب فروش کالا و خدمات</span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {seller?.business_name || 'فروشگاه آنلاین'}
              </h1>
            </div>
            <div className="text-right sm:text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>{invoice.title ? 'عنوان فاکتور:' : 'شماره:'}</span>
                <span>{invoice.title || invoice.invoice_number}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                تاریخ صدور: {formatPersianDate(invoice.created_at)}
              </div>
            </div>
          </div>

          {/* Parties: Seller & Buyer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            {/* Seller */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>اطلاعات فروشنده:</span>
              </div>
              <div className="space-y-1 pr-5 text-slate-600 dark:text-slate-400">
                <div><strong className="text-slate-800 dark:text-slate-200">نام:</strong> {seller?.full_name || seller?.business_name || 'مدیریت فروشگاه'}</div>
                {seller?.phone && <div><strong className="text-slate-800 dark:text-slate-200">تلفن:</strong> <span dir="ltr">{toPersianDigits(seller.phone)}</span></div>}
              </div>
            </div>

            {/* Buyer */}
            <div className="space-y-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-r border-slate-200 dark:border-slate-700 md:pr-4">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>اطلاعات خریدار:</span>
              </div>
              <div className="space-y-1 pr-5 text-slate-600 dark:text-slate-400">
                <div><strong className="text-slate-800 dark:text-slate-200">نام خریدار:</strong> {invoice.customer_name || 'مشتری گرامی'}</div>
                {invoice.customer_phone && <div><strong className="text-slate-800 dark:text-slate-200">شماره همراه:</strong> <span dir="ltr">{toPersianDigits(invoice.customer_phone)}</span></div>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">ریز اقلام صورتحساب:</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">شرح کالا یا خدمات</th>
                    <th className="p-3 w-20 text-center">تعداد</th>
                    <th className="p-3 w-32 text-left">قیمت واحد (تومان)</th>
                    <th className="p-3 w-32 text-left">مبلغ کل (تومان)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoice.items.map((item, idx) => {
                    const rowTotal = (item.quantity || 1) * (item.unit_price || 0);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 text-center text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{item.name || 'کالا یا خدمت'}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{toPersianDigits(item.quantity)}</td>
                        <td className="p-3 text-left font-mono text-slate-600 dark:text-slate-400">{toPersianDigits(formatNumberWithCommas(item.unit_price))}</td>
                        <td className="p-3 text-left font-mono font-bold text-slate-900 dark:text-white">{toPersianDigits(formatNumberWithCommas(rowTotal))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Calculation Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>جمع کل اقلام:</span>
              <span className="font-mono font-bold">{toPersianDigits(formatNumberWithCommas(subtotal))} تومان</span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400">
                <span>
                  تخفیف ویژه
                  {invoice.discount_type === 'percent' && invoice.discount_percent
                    ? ` (${toPersianDigits(invoice.discount_percent)}٪)`
                    : ''}:
                </span>
                <span className="font-mono font-bold">-{toPersianDigits(formatNumberWithCommas(invoice.discount))} تومان</span>
              </div>
            )}

            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>مالیات و عوارض ارزش افزوده ({toPersianDigits(invoice.tax_rate)}٪):</span>
                <span className="font-mono font-bold">
                  +{toPersianDigits(formatNumberWithCommas(Math.round(Math.max(0, subtotal - invoice.discount) * (invoice.tax_rate / 100))))} تومان
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">مبلغ نهایی قابل پرداخت:</span>
              <div className="text-left">
                <div className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono">
                  {toPersianDigits(formatNumberWithCommas(invoice.total_amount))} تومان
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  معادل {toPersianDigits(formatNumberWithCommas(totalRials))} ریال
                </div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-teal-800 dark:text-teal-400">توضیحات و شرایط: </span>
              {invoice.notes}
            </div>
          )}
        </div>

        {/* Payment Action Section (If not fully paid) */}
        {!isFullyPaid && !isPendingVerification && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h2 className="text-base font-black text-slate-900 dark:text-white">روش پرداخت صورتحساب</h2>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${paymentMethod === 'card' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  کارت به کارت
                </button>
                <button
                  onClick={() => setPaymentMethod('gateway')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${paymentMethod === 'gateway' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  درگاه آنلاین
                </button>
              </div>
            </div>

            {paymentMethod === 'card' ? (
              <div className="space-y-6">
                {/* Visual Bank Card or Notice */}
                {seller?.card_number ? (
                  <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-teal-700 via-teal-800 to-slate-900 text-white p-6 sm:p-7 shadow-xl border border-teal-600/30">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 space-y-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-teal-200 font-bold block">بانک {seller.bank_name || 'عضو شتاب'}</span>
                          <h4 className="text-sm font-bold mt-0.5">{seller.card_holder_name || seller.full_name || 'پذیرنده حساب'}</h4>
                        </div>
                        <div className="w-10 h-8 rounded-lg bg-amber-400/80 border border-amber-300 flex items-center justify-center text-slate-900 font-mono text-[9px] font-bold">
                          CHIP
                        </div>
                      </div>

                      <div className="text-center py-3">
                        <div
                          dir="ltr"
                          style={{ direction: 'ltr', unicodeBidi: 'bidi-override' }}
                          className="text-xl sm:text-2xl font-mono tracking-widest font-bold text-white select-all inline-block px-4 py-2 rounded-2xl bg-black/25 border border-white/15 shadow-inner"
                        >
                          {formatCardBlocks(seller.card_number)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-teal-500/30 text-xs">
                        <div>
                          <span className="text-[10px] text-teal-200 block">مبلغ قابل واریز:</span>
                          <span className="font-bold font-mono text-sm text-teal-100">{toPersianDigits(formatNumberWithCommas(invoice.total_amount))} تومان</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleCopyCard}
                            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                          >
                            {copiedCard ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCard ? 'کارت کپی شد' : 'کپی شماره کارت'}</span>
                          </button>
                          <button
                            onClick={handleCopyAmount}
                            className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                          >
                            {copiedAmount ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedAmount ? 'مبلغ کپی شد' : 'کپی مبلغ'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs space-y-2">
                    <div className="font-bold text-sm">شماره کارت بانکی ثبت نشده است</div>
                    <p className="leading-relaxed">
                      فروشنده ({seller?.full_name || seller?.business_name || 'فروشنده'}) هنوز شماره کارت بانکی خود را در تنظیمات وارد نکرده است.
                      {seller?.phone && (
                        <span> لطفاً جهت هماهنگی نحوه تسویه با شماره <strong dir="ltr">{toPersianDigits(seller.phone)}</strong> تماس حاصل فرمایید.</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Sheba Details if available */}
                {seller?.sheba_number && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px]">شماره شبا (پایا / ساتنا):</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 dir-ltr">{seller.sheba_number}</span>
                    </div>
                    <button
                      onClick={handleCopySheba}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      {copiedSheba ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSheba ? 'کپی شد' : 'کپی شبا'}</span>
                    </button>
                  </div>
                )}

                {/* Submit Payment Proof Form */}
                <form onSubmit={handleConfirmPayment} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      ثبت اطلاعات واریز و عکس رسید پرداخت:
                    </h4>
                    <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                      جهت تطبیق و تأیید توسط فروشنده
                    </span>
                  </div>

                  {/* Upload Receipt Section */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      تصویر فیش یا رسید واریز (توصیه‌شده):
                    </label>

                    {compressingImage ? (
                      <div className="rounded-2xl border-2 border-teal-500/40 bg-teal-50/40 dark:bg-teal-950/30 p-4 text-center flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-teal-800 dark:text-teal-200">
                          در حال بهینه‌سازی و کاهش حجم تصویر فیش برای ارسال سریع و مطمئن...
                        </span>
                      </div>
                    ) : receiptPreview ? (
                      <div className="relative rounded-2xl border-2 border-teal-500/30 bg-teal-50/20 dark:bg-teal-950/20 p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={receiptPreview}
                            alt="پیش‌نمایش رسید"
                            className="w-14 h-14 object-cover rounded-xl border border-teal-300 cursor-pointer hover:opacity-90"
                            onClick={() => setPreviewImageModal(receiptPreview)}
                          />
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[200px] sm:max-w-xs">
                              {receiptFile?.name || 'تصویر فیش انتخاب شد'}
                            </span>
                            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                              {receiptFile ? `${Math.round(receiptFile.size / 1024)} کیلوبایت (بهینه‌شده برای ارسال سریع)` : 'آماده ارسال'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImageModal(receiptPreview)}
                            className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/50 hover:bg-teal-200 text-teal-700 dark:text-teal-300 transition-colors"
                            title="مشاهده تصویر بزرگ"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={removeReceipt}
                            className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 text-rose-600 dark:text-rose-400 transition-colors"
                            title="حذف و تغییر تصویر"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                          isDragging
                            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                            : 'border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                          <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            کلیک کنید یا تصویر فیش بانکی را اینجا رها کنید
                          </div>
                          <p className="text-[11px] text-slate-400">
                            فرمت‌های JPG، PNG و WebP (حداکثر ۲۵ مگابایت)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره پیگیری / کد ارجاع (الزامی):
                      </label>
                      <input
                        type="text"
                        required
                        value={trackingCode}
                        onChange={(e) => {
                          setTrackingCode(e.target.value);
                          if (submitError) setSubmitError(null);
                        }}
                        placeholder="مثال: ۹۸۷۶۵۴۳۲۱"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نام پرداخت‌کننده (اختیاری):
                      </label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="نام و نام خانوادگی صاحب کارت"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره کارت واریزکننده (اختیاری):
                      </label>
                      <input
                        type="text"
                        value={payerCard}
                        onChange={(e) => setPayerCard(e.target.value)}
                        placeholder="۴ رقم آخر یا شماره کارت"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                    💡 <strong>توجه خریدار گرامی:</strong> پس از ثبت فرم، صاحب فاکتور شماره پیگیری درج‌شده را با رسید واریزی مطابقت داده و وضعیت فاکتور را به «پرداخت شده» تغییر خواهد داد.
                  </p>

                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                      <div className="flex-1 font-medium">{submitError}</div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={confirming || compressingImage}
                    className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-transform active:scale-[0.99] disabled:opacity-50"
                  >
                    {confirming ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>در حال ثبت اطلاعات و ارسال رسید...</span>
                      </div>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>ثبت و تایید پرداخت فاکتور</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Online Gateway Simulation */
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">انتقال به درگاه امن شاپرک</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    با کلیک روی دکمه زیر، مستقیماً وارد درگاه الکترونیکی بانکی جهت پرداخت آنی صورتحساب خواهید شد.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleConfirmPayment()}
                    disabled={confirming}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-transform active:scale-95"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>پرداخت آنلاین {toPersianDigits(formatNumberWithCommas(invoice.total_amount))} تومان</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Support & Back Link */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-3 pt-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-600" />
            <span>پرداخت شما توسط سامانه فاکتورچی تضمین شده است.</span>
          </div>

          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
            >
              بازگشت به برنامه فاکتورچی
            </button>
          )}
        </div>

      </div>

      {/* Lightbox Modal for Receipt Image Preview */}
      {previewImageModal && (
        <ReceiptLightboxModal
          isOpen={!!previewImageModal}
          onClose={() => setPreviewImageModal(null)}
          src={previewImageModal}
          alt="تصویر فیش واریزی پرداخت"
          trackingNumber={trackingNumberToShow}
          invoiceNumber={invoice?.invoice_number}
        />
      )}
    </div>
  );
};
