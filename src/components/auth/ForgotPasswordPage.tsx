import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Mic, KeyRound } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface ForgotPasswordPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateToLogin: () => void;
  onNavigateToReset?: (token: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onNavigateToLogin,
  onNavigateToReset,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
        setServerMessage(data.message || 'لینک بازیابی با موفقیت ایجاد و ارسال شد.');
        if (data.token) {
          setResetToken(data.token);
        }
      } else {
        setErrorMessage(data.error || 'ارسال لینک بازیابی با خطا مواجه شد.');
      }
    } catch (err) {
      setErrorMessage('خطای برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی فرمایید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 transition-colors font-sans">
      {/* Top Header / Theme Toggle */}
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              فاکتورچی
            </span>
          </div>
        </div>

        <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              بازیابی کلمه عبور
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ایمیل ثبت‌نامی خود را وارد کنید تا لینک بازیابی ارسال شود
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submitted ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>لینک بازیابی رمز عبور ارسال شد</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {serverMessage || `دستورالعمل و لینک تغییر کلمه عبور به آدرس ${email} ارسال گردید. این لینک به مدت ۱ ساعت معتبر می‌باشد.`}
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  💡 لطفاً صندوق ورودی (Inbox) و در صورت عدم مشاهده، پوشه هرزنامه (Spam / Junk) ایمیل خود را بررسی کنید.
                </div>
              </div>

              {/* Instant action button if token is available for convenient preview testing */}
              {resetToken && onNavigateToReset && (
                <button
                  type="button"
                  onClick={() => onNavigateToReset(resetToken)}
                  className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>باز کردن مستقیم صفحه تنظیم رمز عبور جدید</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              )}

              <button
                type="button"
                onClick={onNavigateToLogin}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                بازگشت به صفحه ورود
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  ایمیل حساب کاربری
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@domain.com"
                    className="w-full pl-3.5 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>ارسال لینک بازیابی</span>
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>بازگشت به صفحه ورود</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Footer */}
      <footer className="text-center py-4 text-xs font-medium text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <a
          href="mailto:kimiabg2013@gmail.com"
          className="text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1 transition-colors"
          dir="ltr"
          title="پشتیبانی فاکتورچی"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>kimiabg2013@gmail.com</span>
          <span className="font-sans text-slate-400 dark:text-slate-500">(پشتیبانی)</span>
        </a>
        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
        <span>this website powered by KIARASH</span>
      </footer>
    </div>
  );
};
