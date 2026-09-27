import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Receipt,
  CheckCircle2,
  Wallet,
  Scissors,
  Home,
  Zap,
  Users,
  Wrench,
  Layers,
  ArrowDownRight,
  Sparkles,
  Loader2,
  Briefcase,
  RefreshCw,
  EyeOff,
  Eye,
  Check,
  Edit3,
  Calendar,
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';
import {
  formatToman,
  toPersianDigits,
  formatNumberWithCommas,
  removeCommas,
  formatPersianDate,
  PERSIAN_MONTH_NAMES,
  getJalaliDateParts,
  jalaliToIsoDate,
  fetchWithRetry,
} from '../lib/utils';

interface ExpenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseChanged: () => void;
}

interface AISuggestion {
  title: string;
  category: ExpenseCategory;
  suggested_amount?: number;
  reason?: string;
}

const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  material: {
    label: 'مواد اولیه و اقلام مصرفی',
    icon: Scissors,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  rent: {
    label: 'اجاره و رهن محل کار',
    icon: Home,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  utility: {
    label: 'قبوض، آب، برق و انرژی',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  salary: {
    label: 'حقوق و دستمزد پرسنل',
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  equipment: {
    label: 'تجهیزات، ابزار و استهلاک',
    icon: Wrench,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  other: {
    label: 'متفرقه و سایر هزینه‌ها',
    icon: Layers,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
  },
};

export const ExpenseManagerModal: React.FC<ExpenseManagerModalProps> = ({
  isOpen,
  onClose,
  onExpenseChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Gemini AI Suggestions State
  const [detectedProfession, setDetectedProfession] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(() => {
    return localStorage.getItem('factorchi_show_expense_suggestions') !== 'false';
  });
  const [editingProfession, setEditingProfession] = useState(false);
  const [customJobInput, setCustomJobInput] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('material');
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Shamsi Date State for Expense Date
  const initialJalali = getJalaliDateParts();
  const [shamsiYear, setShamsiYear] = useState<number>(initialJalali.year);
  const [shamsiMonth, setShamsiMonth] = useState<number>(initialJalali.month);
  const [shamsiDay, setShamsiDay] = useState<number>(initialJalali.day);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Quick Shamsi date setters
  const handleSetToday = () => {
    const today = getJalaliDateParts(new Date());
    setShamsiYear(today.year);
    setShamsiMonth(today.month);
    setShamsiDay(today.day);
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const parts = getJalaliDateParts(d);
    setShamsiYear(parts.year);
    setShamsiMonth(parts.month);
    setShamsiDay(parts.day);
  };

  const handleSetTwoDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const parts = getJalaliDateParts(d);
    setShamsiYear(parts.year);
    setShamsiMonth(parts.month);
    setShamsiDay(parts.day);
  };

  const currentJalaliYear = initialJalali.year;
  const availableYears = [
    currentJalaliYear + 1,
    currentJalaliYear,
    currentJalaliYear - 1,
    currentJalaliYear - 2,
    currentJalaliYear - 3,
  ];

  const maxDaysInCurrentMonth = shamsiMonth <= 6 ? 31 : (shamsiMonth <= 11 ? 30 : 29);
  const currentSelectedDay = Math.min(shamsiDay, maxDaysInCurrentMonth);
  const selectedIsoDate = jalaliToIsoDate(shamsiYear, shamsiMonth, currentSelectedDay);
  const selectedDateParts = getJalaliDateParts(selectedIsoDate);
  const selectedDateFullText = `${selectedDateParts.weekdayName}، ${toPersianDigits(selectedDateParts.day)} ${selectedDateParts.monthName} ${toPersianDigits(selectedDateParts.year)}`;
  const selectedDateNumeric = `${toPersianDigits(selectedDateParts.year)}/${toPersianDigits(String(selectedDateParts.month).padStart(2, '0'))}/${toPersianDigits(String(selectedDateParts.day).padStart(2, '0'))}`;

  const startEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setTitle(exp.title);
    setAmountInput(formatNumberWithCommas(exp.amount));
    setCategory(exp.category || 'material');
    setNotes(exp.notes || '');
    const parts = getJalaliDateParts(exp.date);
    setShamsiYear(parts.year);
    setShamsiMonth(parts.month);
    setShamsiDay(parts.day);
    setActiveTab('add');
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setTitle('');
    setAmountInput('');
    setNotes('');
    handleSetToday();
  };

  const getUserId = () => {
    try {
      const stored = localStorage.getItem('factorchi_user');
      if (stored) {
        const u = JSON.parse(stored);
        return u.id || '';
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      const res = await fetchWithRetry('/api/expenses', {
        headers: {
          'x-user-id': userId,
        },
      });
      if (res && res.ok) {
        try {
          const json = await res.json();
          if (json.success) {
            setExpenses(json.expenses || []);
            setTotalAmount(json.total_amount || 0);
          }
        } catch {
          // ignore json parse error
        }
      }
    } catch (err: any) {
      console.warn('[Expenses] Notice fetching expenses:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiSuggestions = async (overrideJob?: string) => {
    setAiLoading(true);
    try {
      const userId = getUserId();
      const jobToUse = overrideJob !== undefined ? overrideJob : customJobInput;
      const res = await fetch('/api/expenses/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          custom_job: jobToUse.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDetectedProfession(data.detected_profession || '');
          setAiSuggestions(data.suggestions || []);
          if (data.detected_profession && !customJobInput) {
            setCustomJobInput(data.detected_profession);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching AI suggestions:', err);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExpenses();
      setSuccessMessage('');
      setErrorMessage('');
      // Fetch Gemini AI suggestions if suggestions are enabled
      if (showSuggestions && aiSuggestions.length === 0) {
        fetchAiSuggestions();
      }
    }
  }, [isOpen]);

  const toggleSuggestions = () => {
    const nextState = !showSuggestions;
    setShowSuggestions(nextState);
    localStorage.setItem('factorchi_show_expense_suggestions', String(nextState));
    if (nextState && aiSuggestions.length === 0) {
      fetchAiSuggestions();
    }
  };

  const handleCustomJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditingProfession(false);
    fetchAiSuggestions(customJobInput);
  };

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = removeCommas(e.target.value);
    if (!rawVal) {
      setAmountInput('');
      return;
    }
    const num = Number(rawVal);
    if (!isNaN(num)) {
      setAmountInput(formatNumberWithCommas(num));
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!title.trim()) {
      setErrorMessage('لطفاً عنوان هزینه را وارد کنید.');
      return;
    }

    const rawAmount = Number(removeCommas(amountInput));
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setErrorMessage('لطفاً مبلغ معتبری به تومان وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = getUserId();
      const endpoint = editingExpenseId ? `/api/expenses/${editingExpenseId}` : '/api/expenses';
      const method = editingExpenseId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          amount: rawAmount,
          date: selectedIsoDate,
          notes: notes.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMessage(
          editingExpenseId
            ? 'هزینه با موفقیت ویرایش و بروزرسانی شد.'
            : 'هزینه با موفقیت با تاریخ شمسی در گزارش ثبت شد.'
        );
        setTitle('');
        setAmountInput('');
        setNotes('');
        setEditingExpenseId(null);
        handleSetToday();
        await fetchExpenses();
        onExpenseChanged();
        setTimeout(() => {
          setSuccessMessage('');
          setActiveTab('list');
        }, 800);
      } else {
        setErrorMessage(json.error || 'خطا در ثبت هزینه');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطا در ارتباط با سرور');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (exp: Expense) => {
    setExpenseToDelete(exp);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    const id = expenseToDelete.id;
    setDeletingId(id);
    try {
      const userId = getUserId();
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': userId,
        },
      });
      if (res.ok) {
        await fetchExpenses();
        onExpenseChanged();
        setExpenseToDelete(null);
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const selectSuggestion = (s: AISuggestion) => {
    setTitle(s.title);
    setCategory(s.category);
    if (s.suggested_amount && !amountInput) {
      setAmountInput(formatNumberWithCommas(s.suggested_amount));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="expense-manager-modal"
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                ثبت و مدیریت هزینه‌های واقعی (P&L)
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  سود و زیان دقیق
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مخارج واقعی کار را ثبت کنید تا سود خالص دقیق محاسبه شود.
              </p>
            </div>
          </div>
          <button
            id="close-expense-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              id="tab-add-expense"
              onClick={() => setActiveTab('add')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'add'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {editingExpenseId ? <Edit3 className="w-4 h-4 text-indigo-500" /> : <Plus className="w-4 h-4" />}
              <span>{editingExpenseId ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</span>
            </button>
            <button
              id="tab-list-expenses"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'list'
                  ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>لیست هزینه‌های ثبت‌شده</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-normal">
                {toPersianDigits(expenses.length)}
              </span>
            </button>
          </div>

          {editingExpenseId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-rose-600 hover:underline pb-3 font-semibold transition-colors"
            >
              انصراف از ویرایش
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {activeTab === 'add' ? (
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* Gemini AI Suggestions Section (or Toggle to hide completely) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-3.5 space-y-3 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      پیشنهادهای هوشمند جمنای (بر اساس شغل شما)
                    </span>
                    {detectedProfession && showSuggestions && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-indigo-500" />
                        <span>{detectedProfession}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {showSuggestions && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingProfession(!editingProfession)}
                          title="تغییر صنف یا شغل"
                          className="px-2 py-1 text-[11px] rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تغییر شغل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fetchAiSuggestions()}
                          disabled={aiLoading}
                          title="بروزرسانی پیشنهادها با جمنای"
                          className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                      </>
                    )}

                    {/* Toggle to completely hide or show suggestions */}
                    <button
                      type="button"
                      id="toggle-suggestions-btn"
                      onClick={toggleSuggestions}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1"
                    >
                      {showSuggestions ? (
                        <>
                          <EyeOff className="w-3 h-3 text-rose-500" />
                          <span>حذف پیشنهادها (ورود دستی)</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-indigo-500" />
                          <span>نمایش پیشنهادهای جمنای</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline Profession Editor */}
                {showSuggestions && editingProfession && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customJobInput}
                        onChange={(e) => setCustomJobInput(e.target.value)}
                        placeholder="عنوان دقیق شغل خود را بنویسید (مثلاً: تعویض‌روغنی، سالن زیبایی، کافه‌رستوران، دفتر برنامه‌نویسی)..."
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        dir="rtl"
                      />
                      <button
                        type="button"
                        onClick={handleCustomJobSubmit}
                        disabled={aiLoading}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>اعمال و دریافت پیشنهاد</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Suggestion Chips */}
                {showSuggestions ? (
                  aiLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>جمنای در حال تحلیل اطلاعات کسب‌وکار و تولید هزینه‌های واقعی شغل شماست...</span>
                    </div>
                  ) : aiSuggestions.length > 0 ? (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {aiSuggestions.map((s, idx) => {
                          const cfg = CATEGORY_CONFIG[s.category || 'material'] || CATEGORY_CONFIG.other;
                          return (
                            <button
                              type="button"
                              key={idx}
                              id={`ai-suggestion-chip-${idx}`}
                              onClick={() => selectSuggestion(s)}
                              title={s.reason || 'انتخاب و درج این هزینه'}
                              className="text-xs px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-400 transition-all flex items-center gap-1.5 shadow-2xs group text-right"
                            >
                              <Plus className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                              <span className="font-semibold">{s.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                                {cfg.label.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                        روی هر پیشنهاد کلیک کنید تا عنوان و دسته‌بندی به‌صورت خودکار در فرم درج شوند.
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 py-1">
                      پیشنهادی یافت نشد. می‌توانید مستقیماً هزینه را در فرم زیر وارد کنید.
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-0.5">
                    پیشنهادها غیرفعال هستند. می‌توانید اقلام و هزینه‌های خود را به‌صورت کاملاً دستی در فرم زیر ثبت کنید.
                  </p>
                )}
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان هزینه <span className="text-rose-500">*</span>
                </label>
                <input
                  id="expense-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    detectedProfession
                      ? `مثال: هزینه‌های مربوط به ${detectedProfession}...`
                      : 'مثال: خرید مواد اولیه، اجاره ماهانه، قبض برق، دستمزد همکار...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  dir="rtl"
                  required
                />
              </div>

              {/* Amount and Shamsi Date row */}
              <div className="space-y-3.5">
                {/* Amount input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    مبلغ هزینه (تومان) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="expense-amount-input"
                      type="text"
                      value={amountInput}
                      onChange={handleAmountChange}
                      placeholder="مثال: ۵۵۰,۰۰۰"
                      className="w-full px-3.5 py-2.5 pl-14 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                      dir="ltr"
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      تومان
                    </span>
                  </div>
                  {amountInput && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1" dir="rtl">
                      معادل: {formatToman(Number(removeCommas(amountInput)))}
                    </div>
                  )}
                </div>

                {/* Shamsi Date Box */}
                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      <span>تاریخ هزینه (شمسی)</span>
                    </label>

                    {/* Quick Shamsi presets */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">انتخاب سریع:</span>
                      <button
                        type="button"
                        onClick={handleSetToday}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 border border-slate-200 dark:border-slate-700 font-medium transition-colors"
                      >
                        امروز
                      </button>
                      <button
                        type="button"
                        onClick={handleSetYesterday}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 border border-slate-200 dark:border-slate-700 font-medium transition-colors"
                      >
                        دیروز
                      </button>
                      <button
                        type="button"
                        onClick={handleSetTwoDaysAgo}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 border border-slate-200 dark:border-slate-700 font-medium transition-colors hidden sm:inline-block"
                      >
                        پریروز
                      </button>
                    </div>
                  </div>

                  {/* 3 Selects: Day, Month, Year */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Day */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        روز
                      </label>
                      <select
                        id="expense-shamsi-day"
                        value={shamsiDay}
                        onChange={(e) => setShamsiDay(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        dir="rtl"
                      >
                        {Array.from({ length: maxDaysInCurrentMonth }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            {toPersianDigits(d)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Month */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        ماه
                      </label>
                      <select
                        id="expense-shamsi-month"
                        value={shamsiMonth}
                        onChange={(e) => {
                          const newM = Number(e.target.value);
                          setShamsiMonth(newM);
                          const maxD = newM <= 6 ? 31 : (newM <= 11 ? 30 : 29);
                          if (shamsiDay > maxD) setShamsiDay(maxD);
                        }}
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        dir="rtl"
                      >
                        {PERSIAN_MONTH_NAMES.map((mName, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {toPersianDigits(idx + 1)} - {mName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Year */}
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        سال
                      </label>
                      <select
                        id="expense-shamsi-year"
                        value={shamsiYear}
                        onChange={(e) => setShamsiYear(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                        dir="rtl"
                      >
                        {availableYears.map((y) => (
                          <option key={y} value={y}>
                            {toPersianDigits(y)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selected Persian Date Preview */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">تاریخ انتخابی ثبت:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span>{selectedDateFullText}</span>
                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500" dir="ltr">
                        ({selectedDateNumeric})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Category selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  دسته‌بندی هزینه
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]).map((catKey) => {
                    const cfg = CATEGORY_CONFIG[catKey];
                    const Icon = cfg.icon;
                    const isSelected = category === catKey;
                    return (
                      <button
                        type="button"
                        key={catKey}
                        id={`category-btn-${catKey}`}
                        onClick={() => setCategory(catKey)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className={`p-1.5 rounded-lg ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-xs font-bold truncate">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  یادداشت، نام فروشگاه یا شماره فاکتور خرید (اختیاری)
                </label>
                <input
                  id="expense-notes-input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: خرید از فروشگاه مرکزی، فاکتور خرید شماره ۲۳۴"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  dir="rtl"
                />
              </div>

              {/* Messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit button */}
              <div className="flex items-center gap-2">
                <button
                  id="submit-expense-btn"
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {editingExpenseId
                          ? 'بروزرسانی و ذخیره تغییرات هزینه'
                          : 'ثبت قطعی هزینه در صورت سود و زیان'}
                      </span>
                    </>
                  )}
                </button>
                {editingExpenseId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                  >
                    انصراف
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Total Summary Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">جمع کل هزینه‌های ثبت شده:</span>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                    {formatToman(totalAmount)}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن هزینه</span>
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
                  <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    هنوز هزینه‌ای ثبت نشده است
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    برای اینکه گزارش P&L سود خالص را بر اساس اعداد دقیق کسب‌وکارتان حساب کند، اولین هزینه خود را ثبت کنید.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ثبت اولین هزینه</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.map((exp) => {
                    const cfg = CATEGORY_CONFIG[exp.category || 'material'] || CATEGORY_CONFIG.other;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={exp.id}
                        className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`p-2 rounded-xl ${cfg.bg} ${cfg.color} shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {exp.title}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>تاریخ: {formatPersianDate(exp.date, { showWeekday: true })}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                                ({formatPersianDate(exp.date, { numericOnly: true })})
                              </span>
                              {exp.notes && (
                                <span className="truncate max-w-[180px]">یادداشت: {exp.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-left" dir="ltr">
                            <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                              - {formatToman(exp.amount)}
                            </span>
                          </div>
                          <button
                            id={`edit-expense-${exp.id}`}
                            onClick={() => startEditExpense(exp)}
                            title="ویرایش هزینه"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            id={`delete-expense-${exp.id}`}
                            onClick={() => handleDeleteExpense(exp)}
                            disabled={deletingId === exp.id}
                            title="حذف هزینه"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
            <span>تمام هزینه‌ها فوراً در فرمول سود خالص (P&L) اعمال می‌شوند.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
          >
            بستن
          </button>
        </div>

        {/* Delete Expense Confirmation Modal */}
        {expenseToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 border border-rose-200 dark:border-rose-900/60 shadow-2xl space-y-4">
              <div className="flex items-start gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    حذف ردیف هزینه
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    آیا از حذف این رکورد هزینه اطمینان دارید؟
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white">
                  {expenseToDelete.title}
                </div>
                <div className="text-rose-600 dark:text-rose-400 font-bold" dir="ltr">
                  - {formatToman(expenseToDelete.amount)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpenseToDelete(null)}
                  disabled={deletingId === expenseToDelete.id}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteExpense}
                  disabled={deletingId === expenseToDelete.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {deletingId === expenseToDelete.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال حذف...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>بله، حذف کن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
