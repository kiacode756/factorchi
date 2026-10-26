import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  RefreshCw,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { Profile } from '../../types';
import { ThemeToggle } from '../ThemeToggle';
import { toPersianDigits, persianToEnglishDigits } from '../../lib/utils';

import { safeStorage } from '../../lib/safeStorage';

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
  // Step state: 'form' (collecting details) or 'verify-otp' (entering 6-digit email code)
  const [step, setStep] = useState<'form' | 'verify-otp'>('form');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification state
  const [otpCode, setOtpCode] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  // Timer countdown for resend button
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'verify-otp' && resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCountdown]);

  // Focus OTP input when switching to verify-otp step
  useEffect(() => {
    if (step === 'verify-otp') {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    }
  }, [step]);

  // Step 1: Submit registration details and request 6-digit email OTP
  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanBusiness = businessName.trim();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMessage('لطفاً فیلدهای ضروری (نام، ایمیل، کلمه عبور) را پر کنید.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: cleanName,
          business_name: cleanBusiness || 'کسب‌وکار من',
          email: cleanEmail,
          phone: cleanPhone,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'خطا در ارسال کد تأیید. لطفاً مجدداً تلاش کنید.');
        setLoading(false);
        return;
      }

      // Transition to OTP verification step
      setRegisteredEmail(cleanEmail);
      setStep('verify-otp');
      setOtpCode('');
      setResendCountdown(60);
      setCanResend(false);
      setSuccessMessage(`کد تأیید ۶ رقمی به ایمیل ${cleanEmail} ارسال شد.`);
      if (data.dev_otp) {
        setDevOtpHint(data.dev_otp);
      } else {
        setDevOtpHint(null);
      }
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setErrorMessage('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit OTP code and complete login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const rawCode = persianToEnglishDigits(otpCode).replace(/[^0-9]/g, '').trim();
    const targetEmail = (registeredEmail || email || '').trim().toLowerCase();

    if (!targetEmail) {
      setErrorMessage('آدرس ایمیل یافت نشد. لطفاً مجدداً فرم را ارسال نمایید.');
      setStep('form');
      return;
    }

    if (rawCode.length !== 6) {
      setErrorMessage('لطفاً کد ۶ رقمی کامل را وارد فرمایید.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          code: rawCode,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'کد تأیید نامعتبر یا منقضی شده است.');
        setLoading(false);
        return;
      }

      // Success: Save auth and profile to storage
      const token = data.token;
      const userProfile: Profile = data.profile;

      if (token) {
        safeStorage.setItem('factorchi_token', token);
      }
      safeStorage.setItem('factorchi_auth', 'true');
      safeStorage.setItem('factorchi_user', JSON.stringify(userProfile));
      safeStorage.setItem('factorchi_is_new_user', 'true');
      safeStorage.removeItem(`factorchi_tour_completed_${userProfile.id}`);

      // Notify parent App component
      onRegisterSuccess(userProfile);
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      setErrorMessage('خطا در اعتبارسنجی کد. لطفاً دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP code
  const handleResendOtp = async () => {
    if (!canResend || resending) return;
    const targetEmail = (registeredEmail || email || '').trim().toLowerCase();
    if (!targetEmail) {
      setErrorMessage('آدرس ایمیل مشخص نیست. لطفاً به مرحله قبل برگردید.');
      return;
    }
    setResending(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/resend-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'خطا در ارسال مجدد کد تأیید.');
        setResending(false);
        return;
      }

      setResendCountdown(60);
      setCanResend(false);
      setSuccessMessage('کد تأیید جدید با موفقیت به ایمیل شما ارسال شد.');
      if (data.dev_otp) {
        setDevOtpHint(data.dev_otp);
      }
    } catch (err) {
      setErrorMessage('خطا در ارسال مجدد کد تأیید.');
    } finally {
      setResending(false);
    }
  };

  // Back to edit form
  const handleBackToForm = () => {
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
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

      {/* Main Container */}
      <div className="w-full max-w-lg mx-auto my-8">
        <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          {/* STEP 1: Registration Form */}
          {step === 'form' && (
            <>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ثبت نام و ایجاد حساب کاربری
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  مشخصات خود را وارد نمایید؛ جهت فعال‌سازی حساب، یک کد تأیید به ایمیل شما ارسال خواهد شد
                </p>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInitialSubmit} className="space-y-4">
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
                        placeholder="نام و نام خانوادگی"
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
                        placeholder="مثال: فروشگاه دیجیتال نوین"
                        className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      آدرس ایمیل دریافت کد تأیید *
                    </label>
                    <div className="relative">
                      <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
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
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                      <span>دریافت کد تأیید ایمیل و ادامه</span>
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
                  ورود به حساب کاربری
                </button>
              </div>
            </>
          )}

          {/* STEP 2: Verify 6-Digit Email OTP */}
          {step === 'verify-otp' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-inner">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  تأیید آدرس ایمیل
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  کد تأیید ۶ رقمی ارسال‌شده به ایمیل زیر را وارد نمایید:
                </p>
                
                {/* Email address badge with edit action */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <span className="font-mono dir-ltr">{registeredEmail}</span>
                  <button
                    type="button"
                    onClick={handleBackToForm}
                    className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold text-[11px] flex items-center gap-1 border-r border-slate-300 dark:border-slate-600 pr-2 mr-1"
                    title="ویرایش مشخصات یا ایمیل"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>ویرایش</span>
                  </button>
                </div>
              </div>

              {/* Dev Hint if SMTP preview is active */}
              {devOtpHint && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>کد تست برای آزمایش مستقیم:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpHint)}
                    className="font-mono font-black text-sm px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-700 dark:text-amber-200 tracking-wider"
                    title="کلیک برای درج خودکار کد"
                  >
                    {devOtpHint}
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2 text-center">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    کد تأیید ۶ رقمی را وارد کنید:
                  </label>
                  
                  <div className="relative max-w-xs mx-auto">
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => {
                        const clean = persianToEnglishDigits(e.target.value).replace(/[^0-9]/g, '');
                        setOtpCode(clean);
                        if (clean.length === 6) {
                          setErrorMessage(null);
                        }
                      }}
                      placeholder="• • • • • •"
                      className="w-full py-3.5 px-4 text-center font-mono text-2xl tracking-[0.5em] font-black rounded-2xl bg-slate-50 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-inner dir-ltr"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    مدت اعتبار کد ۱۵ دقیقه می‌باشد. لطفاً پوشه Spam یا هرزنامه ایمیل خود را نیز بررسی کنید.
                  </p>
                </div>

                {/* Submit Verification Button */}
                <button
                  type="submit"
                  disabled={loading || otpCode.replace(/[^0-9]/g, '').length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>تأیید و ورود به حساب</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend OTP & Back options */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || resending}
                  className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-50 disabled:hover:text-slate-600 font-medium transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {canResend ? (
                    <span>ارسال مجدد کد تأیید</span>
                  ) : (
                    <span>ارسال مجدد کد پس از ({toPersianDigits(resendCountdown)} ثانیه)</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  بازگشت و تغییر اطلاعات
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Mandatory Footer */}
      <footer className="text-center py-4 text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center justify-center">
        <span>this website powered by KIARASH</span>
      </footer>
    </div>
  );
};
