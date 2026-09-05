import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Mic, KeyRound } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface ForgotPasswordPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onNavigateToLogin,
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
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

          {submitted ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>لینک بازیابی ارسال گردید</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                در صورت وجود حساب با ایمیل <strong>{email}</strong>، دستورالعمل تغییر رمز عبور برای شما ارسال شد.
              </p>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="pt-2 text-teal-600 dark:text-teal-400 font-bold hover:underline block"
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
      <footer className="text-center py-4 text-xs font-medium text-slate-400 dark:text-slate-500">
        this website powered by KIARASH
      </footer>
    </div>
  );
};
