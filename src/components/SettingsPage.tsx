import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Phone,
  CreditCard,
  Palette,
  MessageCircle,
  CheckCircle2,
  Save,
  Sun,
  Moon,
  Shield,
  Smartphone,
} from 'lucide-react';
import { Profile } from '../types';
import { persianToEnglishDigits } from '../lib/utils';

interface SettingsPageProps {
  profile: Profile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onUpdateProfile: (data: Partial<Profile>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  profile,
  darkMode,
  onToggleDarkMode,
  onUpdateProfile,
}) => {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [businessName, setBusinessName] = useState(profile.business_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [role, setRole] = useState<'user' | 'admin'>(profile.role);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Bank Info strictly initialises from profile (clean empty string default, no hardcoded values)
  const [cardNumber, setCardNumber] = useState(profile.card_number || '');
  const [cardHolderName, setCardHolderName] = useState(profile.card_holder_name || '');
  const [bankName, setBankName] = useState(profile.bank_name || '');
  const [accountNumber, setAccountNumber] = useState(profile.account_number || '');
  const [shebaNumber, setShebaNumber] = useState(profile.sheba_number || '');
  const [defaultNotes, setDefaultNotes] = useState(profile.default_notes || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      full_name: fullName,
      business_name: businessName,
      phone: persianToEnglishDigits(phone).trim(),
      card_number: persianToEnglishDigits(cardNumber).replace(/\s+/g, '').trim(),
      card_holder_name: cardHolderName.trim(),
      bank_name: bankName.trim(),
      account_number: persianToEnglishDigits(accountNumber).trim(),
      sheba_number: persianToEnglishDigits(shebaNumber).trim(),
      default_notes: defaultNotes.trim(),
      role: profile.role === 'admin' ? 'admin' : 'user',
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Settings className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              تنظیمات عمومی و اطلاعات کسب‌وکار
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              شخصی‌سازی مشخصات فاکتور، اطلاعات واریز و اتصالات پیام‌رسان
            </p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>تغییرات با موفقیت ذخیره شد.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Details */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Building2 className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              اطلاعات صادرکننده فاکتور
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام و نام خانوادگی صادرکننده:
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام تجاری / فروشگاه / شرکت:
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شماره تماس کسب‌وکار:
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نقش کاربری در سیستم:
              </label>
              {profile.role === 'admin' ? (
                <div className="w-full px-3.5 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>مدیر ارشد سیستم (Super Admin)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-200/60 dark:bg-purple-900/60 text-[10px] text-purple-800 dark:text-purple-200">
                    دسترسی کامل
                  </span>
                </div>
              ) : (
                <select
                  value={role === 'admin' ? 'user' : role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                >
                  <option value="user">کاربر عادی (فریلنسر / کسب‌وکار)</option>
                  <option value="premium">کاربر حرفه‌ای (امکانات پیشرفته و صدور نامحدود)</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Bank & Payment Info on Invoices */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <CreditCard className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              اطلاعات بانکی درج شده روی فاکتورها
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شماره کارت بانکی:
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="شماره کارت ۱۶ رقمی خود را وارد کنید..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام صاحب حساب / کارت:
              </label>
              <input
                type="text"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value)}
                placeholder="نام و نام خانوادگی صاحب کارت..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نام بانک صادرکننده:
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="مثال: بانک سامان، ملت، ملی..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شماره حساب بانکی:
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="شماره حساب بانکی (اختیاری)..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-left dir-ltr"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شماره شبا (IBAN):
              </label>
              <input
                type="text"
                value={shebaNumber}
                onChange={(e) => setShebaNumber(e.target.value)}
                placeholder="IR... (شماره ۲۴ رقمی شبا)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-mono text-left dir-ltr"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                شرایط پیش‌فرض تسویه و یادداشت فاکتور:
              </label>
              <textarea
                rows={2}
                value={defaultNotes}
                onChange={(e) => setDefaultNotes(e.target.value)}
                placeholder="شرایط پیش‌فرض تسویه یا یادداشت مدنظر جهت درج روی فاکتورها..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Appearance and Theme */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Palette className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ظاهر و پوسته نرم‌افزار
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                حالت تاریک و روشن (Dark / Light Theme)
              </div>
              <div className="text-slate-500 mt-0.5">
                طراحی شیشه‌ای مدرن (Glassmorphism) سازگار با محیط‌های کم‌نور
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>تغییر به حالت روشن</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span>تغییر به حالت تاریک</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 4: WhatsApp Integration Status */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <MessageCircle className="w-4.5 h-4.5 text-[#25D366]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              اتصال پیام‌رسان واتس‌اپ
            </h3>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>ارسال خودکار لینک فاکتور و پرداخت (wa.me)</span>
              </div>
              <p className="text-slate-500">
                با هر بار صدور، پیام خوش‌آمد و لینک فاکتور آماده ارسال به واتس‌اپ خریدار می‌شود.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
              فعال
            </span>
          </div>
        </div>

        {/* Save Changes Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/25 transition-transform active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تنظیمات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
