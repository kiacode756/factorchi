import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, KeyRound, Mic, ShieldCheck, Mail } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface ResetPasswordPageProps {
  token: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateToLogin: (prefilledEmail?: string) => void;
  onNavigateToForgotPassword: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  darkMode,
  onToggleDarkMode,
  onNavigateToLogin,
  onNavigateToForgotPassword,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setErrorMessage('شناسه بازیابی رمز عبور (توکن) یافت نشد.');
      return;
    }

    const verifyToken = async () => {
      try {
        setVerifying(true);
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setTokenValid(true);
          setUserEmail(data.email || '');
          setErrorMessage(null);
        } else {
          setTokenValid(false);
          setErrorMessage(data.error || 'لینک بازیابی نامعتبر است یا منقضی شده است.');
        }
      } catch (err) {
        setTokenValid(false);
        setErrorMessage('خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش فرمایید.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage('کلمه عبور باید حداقل شامل ۴ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('تکرار کلمه عبور با کلمه عبور جدید یکسان نمی‌باشد.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setErrorMessage(data.error || 'تغییر رمز عبور با خطا مواجه شد.');
      }
    } catch (err) {
      setErrorMessage('خطای شبکه در ثبت رمز عبور جدید.');
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
              تنظیم رمز عبور جدید
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {userEmail ? (
                <span>در حال بازیابی کلمه عبور برای <strong className="text-teal-600 dark:text-teal-400 font-mono dir-ltr inline-block">{userEmail}</strong></span>
              ) : (
                'کلمه عبور جدید خود را با دقت انتخاب فرمایید'
              )}
            </p>
          </div>

          {/* Loading Verification State */}
          {verifying && (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                در حال اعتبارسنجی لینک بازیابی...
              </p>
            </div>
          )}

          {/* Error / Invalid Token State */}
          {!verifying && !tokenValid && !success && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>لینک بازیابی نامعتبر است</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {errorMessage || 'این لینک بازیابی نامعتبر است یا مدت زمان اعتبار آن (۱ ساعت) به پایان رسیده است.'}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={onNavigateToForgotPassword}
                  className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95"
                >
                  درخواست مجدد لینک بازیابی
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToLogin()}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  بازگشت به صفحه ورود
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-emerald-900 dark:text-emerald-200">
                  رمز عبور با موفقیت تغییر کرد!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  کلمه عبور جدید شما با موفقیت در سامانه ذخیره شد. اکنون می‌توانید با رمز عبور جدید وارد حساب کاربری خود شوید.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToLogin(userEmail)}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>ورود به حساب با رمز عبور جدید</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          {/* Form State */}
          {!verifying && tokenValid && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  کلمه عبور جدید
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  تکرار کلمه عبور جدید
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تکرار رمز عبور جدید"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>ذخیره کلمه عبور جدید</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateToLogin()}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  انصراف و بازگشت به صفحه ورود
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer info */}
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
