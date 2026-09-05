import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  Phone,
  Building2,
  Eye,
  EyeOff,
  UserPlus,
  Mic,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Profile } from '../../types';
import { ThemeToggle } from '../ThemeToggle';

interface RegisterPageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onRegisterSuccess: (profile: Profile) => void;
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  darkMode,
  onToggleDarkMode,
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = {
      fullName: fullName.trim(),
      businessName: businessName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim().toLowerCase(),
      password,
    };

    if (!formData.fullName || !formData.email || !formData.password) {
      setErrorMessage('لطفاً فیلدهای ضروری را پر کنید.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Call registration API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.fullName,
          business_name: formData.businessName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const authData = await res.json();
      if (!res.ok || !authData.success) {
        setErrorMessage(authData.error || 'خطا در ثبت‌نام کاربر.');
        setLoading(false);
        return;
      }

      const userId = authData.token || authData.profile?.id || `usr-${Date.now()}`;
      
      // Step 2: Explicit Profile Creation / Verification
      const initialProfile: Profile = {
        id: userId,
        full_name: formData.fullName || '',
        business_name: formData.businessName || 'کسب‌وکار من',
        phone: formData.phone || '',
        email: formData.email,
        subscription_status: 'trial',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        // Explicit profile insertion call
        await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify(initialProfile),
        });
      } catch (profileError) {
        console.error('Profile creation error:', profileError);
      }

      // Step 3: Show Success Modal popup for user to proceed to Login
      setRegisteredEmail(formData.email);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Registration network error:', err);
      setErrorMessage('خطا در برقراری ارتباط با سرور.');
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
            <span className="text-[10px] mr-1.5 font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              Factorchi
            </span>
          </div>
        </div>

        <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      </div>

      {/* Main Register Card */}
      <div className="w-full max-w-lg mx-auto my-8">
        <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              ثبت نام و ایجاد حساب کاربری
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مشخصات خود را برای دسترسی به پنل صدور فاکتور صوتی وارد نمایید
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name & Business */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  نام و نام خانوادگی *
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: علی احمدی"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  نام کسب‌وکار یا فروشگاه
                </label>
                <div className="relative">
                  <Building2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="مثال: فروشگاه نوین"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  آدرس ایمیل *
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mail@domain.com"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  شماره موبایل
                </label>
                <div className="relative">
                  <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09123456789"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                رمز عبور *
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="حداقل ۶ کاراکتر"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>تکمیل ثبت نام و ورود</span>
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>قبلاً ثبت نام کرده‌اید؟</span>{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
            >
              ورود به حساب
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal Popup */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                حساب شما با موفقیت ساخته شد
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                اکنون می‌توانید با ایمیل و رمز عبور خود وارد حساب کاربری شوید
              </p>
              {registeredEmail && (
                <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 dir-ltr text-center">
                  {registeredEmail}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  onNavigateToLogin();
                }}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all"
              >
                <span>ورود به حساب</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Footer */}
      <footer className="text-center py-4 text-xs font-medium text-slate-400 dark:text-slate-500">
        this website powered by KIARASH
      </footer>
    </div>
  );
};
