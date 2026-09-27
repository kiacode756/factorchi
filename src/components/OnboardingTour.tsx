import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Compass,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Mic,
  FileText,
  CreditCard,
  Bell,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  ArrowLeft,
  Zap,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { NavigationTab, Profile } from '../types';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetIdDesktop?: string;
  targetIdMobile?: string;
  tab?: NavigationTab;
  icon: React.ComponentType<{ className?: string }>;
  proTip?: string;
  actionText?: string;
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  profile: Profile;
  isFirstTime?: boolean;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  currentTab,
  onNavigate,
  profile,
  isFirstTime = false,
}) => {
  // Step index: -1 means "Welcome Modal", 0..N means tour steps, N+1 means "Completion Modal"
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(isFirstTime ? -1 : 0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = useState<boolean>(false);

  const steps: TourStep[] = useMemo(
    () => [
      {
        id: 'dashboard',
        title: 'پیشخوان و وضعیت فروش کسب‌وکار',
        description:
          'اینجا اتاق فرمان کسب‌وکار شماست! در یک نگاه، مجموع دریافتی‌های امروز، طلب‌های معوقه، تعداد فاکتورها و نمودار سود و زیان را به صورت خودکار مشاهده می‌کنید.',
        targetIdDesktop: 'sidebar-nav-dashboard',
        targetIdMobile: 'mob-nav-dashboard',
        tab: 'dashboard',
        icon: LayoutDashboard,
        proTip: 'نیازی به دفترچه و حسابداری دستی نیست؛ تمام محاسبات مالی به صورت لحظه‌ای انجام می‌شود.',
      },
      {
        id: 'voice-invoice',
        title: 'صدور فاکتور در چند ثانیه با صدای شما 🎙️',
        description:
          'شاهکار فاکتورچی اینجاست! فقط دکمه ضبط صدا را بزنید و به فارسی عادی بگویید چه کالایی و برای چه کسی فروخته‌اید. هوش مصنوعی ما اقلام، قیمت، تعداد و تخفیف را فوراً به فاکتور رسمی تبدیل می‌کند.',
        targetIdDesktop: 'sidebar-nav-new-invoice',
        targetIdMobile: 'mob-nav-new-invoice',
        tab: 'new-invoice',
        icon: Mic,
        proTip: 'می‌توانید فایل صوتی ضبط‌شده از قبل را هم آپلود کنید یا حتی متن بنویسید.',
      },
      {
        id: 'invoices-list',
        title: 'مدیریت، چاپ و ارسال فاکتورها',
        description:
          'تمام فاکتورهای صادرشده با جزئیات کامل ذخیره می‌شوند. می‌توانید وضعیت تسویه را ببینید، نسخه PDF استاندارد دانلود کنید، پرینت بگیرید یا مستقیماً به واتساپ مشتری ارسال فرمایید.',
        targetIdDesktop: 'sidebar-nav-invoices',
        targetIdMobile: 'mob-nav-invoices',
        tab: 'invoices',
        icon: FileText,
        proTip: 'با کلیک روی هر فاکتور، می‌توانید پیش‌نمایش زیبا، رسید واریزی مشتری و تاریخچه را بررسی کنید.',
      },
      {
        id: 'payment-link',
        title: 'لینک اختصاصی پرداخت و آپلود رسید 💳',
        description:
          'برای هر فاکتور، یک لینک اختصاصی برای مشتری ایجاد می‌شود. مشتری در تلفن همراه خود فاکتور را می‌بیند، شماره کارت شما را کپی می‌کند و فیش واریز را مستقیماً بارگذاری می‌نماید!',
        targetIdDesktop: 'sidebar-nav-billing',
        targetIdMobile: 'mob-nav-billing',
        tab: 'invoices',
        icon: CreditCard,
        proTip: 'دیگر نگران گم شدن رسیدها یا شلوغی گالری موبایل نباشید؛ فیش هر مشتری متصل به فاکتور خودش است.',
      },
      {
        id: 'notifications',
        title: 'زنگ اعلان آنی و تایید فیش‌های واریزی 🔔',
        description:
          'به محض اینکه مشتری رسید واریز را در لینک پرداخت ثبت کند، زنگوله اعلان در بالای صفحه به صدا درآمده و مشخصات واریزی را به شما نشان می‌دهد تا با یک کلیک تایید فرمایید.',
        targetIdDesktop: 'notifications-btn',
        targetIdMobile: 'notifications-btn',
        icon: Bell,
        proTip: 'همچنین قابلیت‌های جدید هوش مصنوعی و تغییرات سامانه در بخش «تازه‌ها» اطلاع‌رسانی می‌شود.',
      },
      {
        id: 'settings',
        title: 'تنظیمات نام فروشگاه و شماره کارت بانکی',
        description:
          'مشخصات کسب‌وکار، نام فروشگاه، شماره کارت، شبا و متن پایانی فاکتورهای خود را یک‌بار اینجا ثبت کنید تا خودکار روی تمام فاکتورها و صفحه پرداخت مشتریانتان بنشیند.',
        targetIdDesktop: 'sidebar-nav-settings',
        targetIdMobile: 'mob-nav-settings',
        tab: 'settings',
        icon: Settings,
        proTip: 'ثبت شماره شبا و کارت بانکی باعث افزایش اعتماد خریدار و تسویه سریع‌تر حساب‌ها می‌شود.',
      },
      {
        id: 'billing',
        title: 'مدیریت حساب و تمدید اشتراک',
        description:
          'شما پس از ثبت‌نام، دسترسی کامل به امکانات فاکتورچی دارید. برای تمدید مدت اشتراک و استمرار استفاده بدون محدودیت، همیشه می‌توانید به بخش مدیریت اشتراک سر بزنید.',
        targetIdDesktop: 'sidebar-nav-billing',
        targetIdMobile: 'mob-nav-billing',
        tab: 'billing',
        icon: Sparkles,
        proTip: 'تیم پشتیبانی فاکتورچی همواره برای پاسخگویی به سوالات شما در دسترس است.',
      },
    ],
    []
  );

  const totalSteps = steps.length;
  const isWelcome = currentStepIndex === -1;
  const isCompletion = currentStepIndex >= totalSteps;
  const activeStep = !isWelcome && !isCompletion ? steps[currentStepIndex] : null;

  // Measure and locate target element
  const updateTargetPosition = useCallback(() => {
    if (!activeStep) {
      setHighlightRect(null);
      setTargetFound(false);
      return;
    }

    const isMobile = window.innerWidth < 1024;
    const targetId = isMobile
      ? activeStep.targetIdMobile || activeStep.targetIdDesktop
      : activeStep.targetIdDesktop || activeStep.targetIdMobile;

    if (!targetId) {
      setHighlightRect(null);
      setTargetFound(false);
      return;
    }

    const el = document.getElementById(targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Ensure element is somewhat visible in viewport
      setHighlightRect(rect);
      setTargetFound(true);
    } else {
      setHighlightRect(null);
      setTargetFound(false);
    }
  }, [activeStep]);

  // Update target on step change or resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    // Switch tab if step demands it
    if (activeStep?.tab && activeStep.tab !== currentTab) {
      onNavigate(activeStep.tab);
    }

    // Wait for DOM to render if tab switched
    const timer = setTimeout(() => {
      updateTargetPosition();
    }, 150);

    const handleResizeOrScroll = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen, currentStepIndex, activeStep, currentTab, onNavigate, updateTargetPosition]);

  // Keyboard navigation (Arrow keys and Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleFinishTour();
      } else if (e.key === 'ArrowLeft' && !isCompletion) {
        handleNextStep();
      } else if (e.key === 'ArrowRight' && currentStepIndex > 0) {
        handlePrevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, isCompletion]);

  const handleStartTour = () => {
    setCurrentStepIndex(0);
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setCurrentStepIndex(totalSteps); // Move to completion
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleFinishTour = () => {
    try {
      localStorage.setItem(`factorchi_tour_completed_${profile.id}`, 'true');
      localStorage.setItem('factorchi_is_new_user', 'false');
    } catch {}
    onClose();
  };

  const handleGoToVoiceInvoice = () => {
    handleFinishTour();
    onNavigate('new-invoice');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 font-sans select-none pointer-events-none">
      {/* Background layer: Subtle overlay only on welcome/completion modal, 100% transparent and clear during steps */}
      {(isWelcome || isCompletion) && (
        <div
          className="fixed inset-0 bg-slate-950/40 pointer-events-auto transition-opacity duration-300"
          onClick={handleFinishTour}
        />
      )}

      {/* Target Element Highlight Frame (Crystal Clear, zero blur, zero screen blackout shadow) */}
      {highlightRect && targetFound && !isWelcome && !isCompletion && (
        <div
          className="fixed border-2 border-teal-500 rounded-2xl pointer-events-none transition-all duration-300 ring-4 ring-teal-400/40 shadow-xl shadow-teal-500/25 z-40 animate-pulse"
          style={{
            top: Math.max(0, highlightRect.top - 5),
            left: Math.max(0, highlightRect.left - 5),
            width: highlightRect.width + 10,
            height: highlightRect.height + 10,
          }}
        >
          {/* Glowing Beacon Indicator */}
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-500" />
          </span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. WELCOME MODAL (First Time Experience)                  */}
      {/* ======================================================== */}
      {isWelcome && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto z-50">
          <div className="relative max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            {/* Decorative Icon */}
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center shadow-xl shadow-teal-500/25">
              <Sparkles className="w-10 h-10 animate-bounce" />
              <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-xs">
                جدید
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                سلام {profile.full_name || 'کاربر گرامی'}، به فاکتورچی خوش آمدید! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
                سامانه هوشمند فاکتورچی به شما کمک می‌کند تنها با صدای خودتان فاکتور صادر کنید و رسید واریزی مشتریانتان را به صورت خودکار دریافت نمایید.
              </p>
            </div>

            {/* Key Highlights Mini Grid */}
            <div className="grid grid-cols-3 gap-2.5 text-right text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <span className="w-7 h-7 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center mb-1">
                  <Mic className="w-4 h-4" />
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">صدور صوتی</span>
                <span className="text-[10px] text-slate-400 block">بدون نیاز به تایپ</span>
              </div>
              <div className="space-y-1">
                <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center mb-1">
                  <CreditCard className="w-4 h-4" />
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">لینک پرداخت</span>
                <span className="text-[10px] text-slate-400 block">آپلود مستقیم رسید</span>
              </div>
              <div className="space-y-1">
                <span className="w-7 h-7 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center mb-1">
                  <Bell className="w-4 h-4" />
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">اعلان آنی</span>
                <span className="text-[10px] text-slate-400 block">تایید لحظه‌ای فیش</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleStartTour}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>شروع تور معرفی سایت (۲ دقیقه)</span>
              </button>
              <button
                type="button"
                onClick={handleFinishTour}
                className="w-full py-2.5 px-4 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 font-semibold text-xs transition-colors"
              >
                رد کردن و رفتن به داشبورد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ACTIVE STEP CARD (Clear Bottom-Left Floating Panel)   */}
      {/* ======================================================== */}
      {!isWelcome && !isCompletion && activeStep && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-8 z-50 max-w-md w-[calc(100%-2rem)] sm:w-full pointer-events-auto">
          <div className="bg-white/95 dark:bg-slate-900/95 border-2 border-teal-500/40 dark:border-teal-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl shadow-slate-900/25 space-y-3.5 sm:space-y-4 animate-in slide-in-from-bottom-4 duration-200 max-h-[calc(100vh-6rem)] overflow-y-auto">
            {/* Step Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
                  <activeStep.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                      گام {currentStepIndex + 1} از {totalSteps}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">تور راهنما</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinishTour}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="خروج از تور"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Content */}
            <div className="space-y-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {activeStep.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeStep.description}
              </p>

              {/* Pro Tip Box */}
              {activeStep.proTip && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="font-bold ml-1">نکته هوشمند:</strong>
                    <span>{activeStep.proTip}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Indicators & Step Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              {/* Progress Dots */}
              <div className="flex items-center gap-1">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentStepIndex
                        ? 'w-6 bg-teal-600'
                        : idx < currentStepIndex
                        ? 'w-2 bg-teal-400/50'
                        : 'w-2 bg-slate-200 dark:bg-slate-700'
                    }`}
                    title={`پرش به گام ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-1.5">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs flex items-center gap-1 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>قبلی</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-teal-600/20 transition-all"
                >
                  <span>{currentStepIndex === totalSteps - 1 ? 'پایان تور' : 'گام بعدی'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. COMPLETION MODAL                                      */}
      {/* ======================================================== */}
      {isCompletion && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto z-50">
          <div className="relative max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-500/20">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                تبریک! شما آماده صدور اولین فاکتور هستید 🚀
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                اکنون با کلیه امکانات فاکتورچی آشنا شدید. می‌توانید همین حالا میکروفون را روشن کنید و اولین فاکتور صوتی خود را بیازمایید.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleGoToVoiceInvoice}
                className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>صدور اولین فاکتور صوتی من</span>
              </button>
              <button
                type="button"
                onClick={handleFinishTour}
                className="w-full py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                ورود به داشبورد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
