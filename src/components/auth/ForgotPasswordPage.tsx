import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Mic, KeyRound, Sparkles, Lock, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { safeStorage } from '../../lib/safeStorage';
import { Profile } from '../../types';

interface ForgotPasswordPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateToLogin: (prefilledEmail?: string) => void;
  onNavigateToReset?: (token: string) => void;
  onLoginSuccess?: (profile: Profile) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onNavigateToLogin,
  onLoginSuccess,
}) => {
  // Step 1 State: Request token
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Step 2 State: Set new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Step 1: Request reset token by email
  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('لطفاً آدرس ایمیل حساب کاربری خود را وارد فرمایید.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        setResetToken(data.token);
        // Directly transition to new password form so user never has to wait for an email
        setStep('reset');
      } else {
        setErrorMessage(data.error || 'حساب کاربری با این ایمیل یافت نشد.');
      }
    } catch (err) {
      setErrorMessage('خطای برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی فرمایید.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set the new password and optionally auto-login
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage('کلمه عبور جدید باید حداقل ۴ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('تکرار کلمه عبور با کلمه عبور جدید یکسان نیست.');
      return;
    }

    if (!resetToken) {
      setErrorMessage('شناسه بازیابی یافت نشد. لطفاً مجدداً ایمیل خود را وارد نمایید.');
      setStep('request');
      return;
    }

    setResetting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStep('success');

        // If user and profile returned, auto-login for maximum user convenience
        if (data.profile && onLoginSuccess) {
          if (data.token) {
            safeStorage.setItem('factorchi_token', data.token);
          }
          safeStorage.setItem('factorchi_auth', 'true');
          safeStorage.setItem('factorchi_user', JSON.stringify(data.profile));

          setTimeout(() => {
            onLoginSuccess(data.profile);
          }, 1500);
        }
      } else {
        setErrorMessage(data.error || 'خطا در ثبت کلمه عبور جدید.');
      }
    } catch (err) {
      setErrorMessage('خطای شبکه در ثبت کلمه عبور جدید.');
    } finally {
      setResetting(false);
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
              {step === 'request' && 'بازیابی کلمه عبور'}
              {step === 'reset' && 'تنظیم کلمه عبور جدید'}
              {step === 'success' && 'کلمه عبور تغییر یافت'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {step === 'request' && 'ایمیل ثبت‌نامی خود را وارد فرمایید تا فرم تغییر رمز برای شما باز شود'}
              {step === 'reset' && `در حال ثبت رمز عبور جدید برای ${email}`}
              {step === 'success' && 'کلمه عبور جدید شما با موفقیت در سامانه ذخیره شد'}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Request Email */}
          {step === 'request' && (
            <form onSubmit={handleRequestToken} className="space-y-4">
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
                  <span>ادامه و بازیابی رمز عبور</span>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Set New Password directly */}
          {step === 'reset' && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>نیازی به چک کردن ایمیل نیست!</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  هویت حساب شما تأیید شد. اکنون بدون معطلی رمز جدید خود را وارد و ذخیره نمایید.
                </p>
              </div>

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
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  تکرار کلمه عبور جدید
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="تکرار کلمه عبور"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={resetting}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all"
              >
                {resetting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>ذخیره کلمه عبور جدید و ورود</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 text-center"
              >
                تغییر آدرس ایمیل
              </button>
            </form>
          )}

          {/* Step 3: Success state */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <div className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                  کلمه عبور با موفقیت به‌روزرسانی شد
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
                  رمز جدید شما ثبت گردید. در حال انتقال به سامانه فاکتورچی هستید...
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateToLogin(email)}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>ورود به حساب کاربری</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => onNavigateToLogin(email)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>بازگشت به صفحه ورود</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Footer */}
      <footer className="text-center py-4 text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center">
        <span>this website powered by KIARASH</span>
      </footer>
    </div>
  );
};
