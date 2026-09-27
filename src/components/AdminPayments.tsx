import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Clock,
  Filter,
  Check,
  X,
  AlertTriangle,
  FileImage,
  Loader2,
  ExternalLink,
  Users,
  CreditCard,
  Search,
  UserCheck,
  Calendar,
  Sparkles,
  RefreshCw,
  BellRing,
  Trash2,
  Wand2,
  Plus,
  Copy,
  Settings2,
  UserCog,
  Mail,
  Phone,
  Building,
  ArrowUpDown,
  Layers,
  AlertCircle,
  FileText,
  UserPlus,
  Lock,
} from 'lucide-react';
import { SubscriptionRequest, Profile, FeatureUpdate } from '../types';
import { formatToman, toPersianDigits, formatPersianDate, fetchWithRetry } from '../lib/utils';
import { ReceiptImageHoverZoom } from './ReceiptImageViewer';

interface AdminUserItem {
  id: string;
  email: string;
  created_at: string;
  profile: Profile;
  invoices_count: number;
}

interface AdminPaymentsProps {
  requests: SubscriptionRequest[];
  onVerifyPayment: (requestId: string, adminNote?: string) => Promise<boolean>;
  onRejectPayment: (requestId: string, adminNote: string) => Promise<boolean>;
  profile?: Profile;
  onProfileUpdate?: (profile: Profile) => void;
}

export const AdminPayments: React.FC<AdminPaymentsProps> = ({
  requests,
  onVerifyPayment,
  onRejectPayment,
  profile,
  onProfileUpdate,
}) => {
  const adminUserId = profile?.id || 'usr-admin';
  const adminUserEmail = profile?.email || 'bagherikiarash74@gmail.com';

  const getAdminAuthHeaders = () => ({
    'x-user-id': adminUserId,
    'x-user-email': adminUserEmail,
    'Authorization': `Bearer ${adminUserId}`,
    'Content-Type': 'application/json',
  });

  // Main View: requests vs users_view vs feature_updates
  const [adminView, setAdminView] = useState<'requests' | 'users_view' | 'feature_updates'>('requests');

  // Requests state
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Users View state
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'admin'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit User Modal State
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<AdminUserItem | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'trial' | 'expired'>('active');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editIsPerpetual, setEditIsPerpetual] = useState<boolean>(false);
  const [editExtendFromNow, setEditExtendFromNow] = useState<boolean>(false);
  const [editDaysToAdd, setEditDaysToAdd] = useState<number>(30);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserBusiness, setNewUserBusiness] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserStatus, setNewUserStatus] = useState<'active' | 'trial' | 'expired'>('active');
  const [newUserDays, setNewUserDays] = useState<number>(30);
  const [newUserIsPerpetual, setNewUserIsPerpetual] = useState<boolean>(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setCreateUserError('نام و نام خانوادگی، ایمیل و کلمه عبور الزامی است.');
      return;
    }
    setIsCreatingUser(true);
    setCreateUserError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          full_name: newUserName.trim(),
          business_name: newUserBusiness.trim() || 'کسب‌وکار من',
          email: newUserEmail.trim().toLowerCase(),
          phone: newUserPhone.trim(),
          password: newUserPassword.trim(),
          role: newUserRole,
          subscription_status: newUserStatus,
          days: newUserStatus === 'active' ? (newUserIsPerpetual ? 0 : newUserDays) : (newUserStatus === 'trial' ? newUserDays : 0),
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setActionSuccess(`کاربر «${newUserName}» با موفقیت در پایگاه داده ایجاد شد.`);
        setUsersList(prev => [data.user, ...prev]);
        setIsAddUserModalOpen(false);
        setNewUserName('');
        setNewUserBusiness('');
        setNewUserEmail('');
        setNewUserPhone('');
        setNewUserPassword('');
        setNewUserRole('user');
        setNewUserStatus('active');
        setNewUserIsPerpetual(true);
        setCreateUserError(null);
      } else {
        setCreateUserError(data.error || 'خطا در ایجاد کاربر جدید');
      }
    } catch (err: any) {
      setCreateUserError('خطا در برقراری ارتباط با سرور: ' + err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Feature Updates state
  const [featureList, setFeatureList] = useState<FeatureUpdate[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [featurePrompt, setFeaturePrompt] = useState('');
  const [isGeneratingFeature, setIsGeneratingFeature] = useState(false);
  const [featureToDelete, setFeatureToDelete] = useState<FeatureUpdate | null>(null);
  const [isDeletingFeature, setIsDeletingFeature] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchWithRetry('/api/admin/users', {
        headers: getAdminAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      }
    } catch (e) {
      console.error('Failed to fetch admin users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenEditUser = (usr: AdminUserItem) => {
    setSelectedUserToEdit(usr);
    const status = (usr.profile?.subscription_status as any) || 'active';
    setEditStatus(status);
    setEditRole(usr.profile?.role || 'user');
    setEditIsPerpetual(usr.profile?.subscription_expires_at === null);
    setEditExtendFromNow(false);
    setEditDaysToAdd(status === 'trial' ? 1 : 30);
  };

  const handleUpdateUserSubscription = async () => {
    if (!selectedUserToEdit) return;
    setIsSavingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserToEdit.id}/subscription`, {
        method: 'PUT',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({
          subscription_status: editStatus,
          role: editRole,
          days_to_add: editStatus === 'expired' ? 0 : editDaysToAdd,
          is_perpetual: editStatus === 'active' && editIsPerpetual,
          extend_from_now: editExtendFromNow,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setActionSuccess(`وضعیت اشتراک و سطح دسترسی «${data.user.profile?.full_name || data.user.email}» با موفقیت ذخیره و در سیستم اعمال شد.`);
        setUsersList(prev =>
          prev.map(u =>
            u.id === selectedUserToEdit.id
              ? {
                  ...u,
                  profile: data.user.profile,
                }
              : u
          )
        );
        if (selectedUserToEdit.id === profile?.id && onProfileUpdate) {
          onProfileUpdate(data.user.profile);
        }
        setSelectedUserToEdit(null);
      } else {
        setActionError(data.error || 'خطا در ویرایش اشتراک کاربر');
      }
    } catch (err: any) {
      setActionError('خطا در ارتباط با سرور: ' + err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleOpenDeleteModal = (usr: AdminUserItem) => {
    setUserToDelete(usr);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message || `کاربر با موفقیت از کل پایگاه داده حذف گردید.`);
        setUsersList((prev) => prev.filter((u) => u.id !== userToDelete.id));
        if (selectedUserToEdit?.id === userToDelete.id) {
          setSelectedUserToEdit(null);
        }
        setUserToDelete(null);
      } else {
        setActionError(data.error || 'خطا در حذف کاربر از دیتابیس');
      }
    } catch (err: any) {
      setActionError('خطا در برقراری ارتباط با سرور: ' + err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const fetchFeatures = async () => {
    setLoadingFeatures(true);
    try {
      const res = await fetch('/api/feature-updates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.updates)) {
          setFeatureList(data.updates);
        }
      }
    } catch (e) {
      console.error('Failed to fetch feature updates:', e);
    } finally {
      setLoadingFeatures(false);
    }
  };

  useEffect(() => {
    if (adminView === 'users_view') {
      fetchUsers();
    } else if (adminView === 'feature_updates') {
      fetchFeatures();
    }
  }, [adminView]);

  const handleCreateFeatureWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featurePrompt.trim() || isGeneratingFeature) return;

    setIsGeneratingFeature(true);
    try {
      const res = await fetch('/api/feature-updates/ai-generate', {
        method: 'POST',
        headers: getAdminAuthHeaders(),
        body: JSON.stringify({ prompt: featurePrompt.trim() }),
      });
      const data = await res.json();
      if (data.success && data.update) {
        setFeatureList(prev => [data.update, ...prev]);
        setFeaturePrompt('');
        setActionSuccess('قابلیت جدید با موفقیت توسط جمنای پردازش، طراحی و به صفحه اصلی اضافه شد.');
      } else {
        setActionError(data.error || 'خطا در ثبت قابلیت هوش مصنوعی');
      }
    } catch (e: any) {
      console.error('Error generating feature with AI:', e);
      setActionError('خطا در ارتباط با سرور: ' + (e?.message || ''));
    } finally {
      setIsGeneratingFeature(false);
    }
  };

  const handleDeleteFeature = (item: FeatureUpdate) => {
    setFeatureToDelete(item);
  };

  const handleConfirmDeleteFeature = async () => {
    if (!featureToDelete) return;
    setIsDeletingFeature(true);
    try {
      const res = await fetch(`/api/feature-updates/${featureToDelete.id}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setFeatureList(prev => prev.filter(f => f.id !== featureToDelete.id));
        setActionSuccess(`قابلیت «${featureToDelete.title}» با موفقیت حذف گردید.`);
        setFeatureToDelete(null);
      } else {
        setActionError(data.error || 'خطا در حذف قابلیت');
      }
    } catch (e: any) {
      console.error('Error deleting feature update:', e);
      setActionError('خطا در برقراری ارتباط با سرور: ' + (e?.message || ''));
    } finally {
      setIsDeletingFeature(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterTab === 'all') return true;
    return r.status === filterTab;
  });

  const userStats = {
    total: usersList.length,
    active: usersList.filter(u => u.profile?.subscription_status === 'active').length,
    trial: usersList.filter(u => u.profile?.subscription_status === 'trial').length,
    expired: usersList.filter(u => u.profile?.subscription_status === 'expired').length,
    admin: usersList.filter(u => u.profile?.role === 'admin').length,
    totalInvoices: usersList.reduce((acc, u) => acc + (u.invoices_count || 0), 0),
  };

  const filteredUsers = usersList.filter((u) => {
    // Status filter
    if (userStatusFilter === 'active' && u.profile?.subscription_status !== 'active') return false;
    if (userStatusFilter === 'trial' && u.profile?.subscription_status !== 'trial') return false;
    if (userStatusFilter === 'expired' && u.profile?.subscription_status !== 'expired') return false;
    if (userStatusFilter === 'admin' && u.profile?.role !== 'admin') return false;

    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase().trim();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.profile?.full_name && u.profile.full_name.toLowerCase().includes(q)) ||
      (u.profile?.business_name && u.profile.business_name.toLowerCase().includes(q)) ||
      (u.profile?.phone && u.profile.phone.includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const handleApprove = async (req: SubscriptionRequest) => {
    setActionLoading(true);
    try {
      const ok = await onVerifyPayment(req.id, adminNote || 'پرداخت تایید و اشتراک فعال شد.');
      if (ok) {
        setActionSuccess(`پرداخت کاربر ${req.user_name} با موفقیت تایید و اشتراک ۳۰ روزه فعال شد.`);
        setSelectedRequest(null);
        setAdminNote('');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (req: SubscriptionRequest) => {
    const reason = adminNote.trim() || 'عدم تطابق یا نقص مدارک واریز';

    setActionLoading(true);
    try {
      const ok = await onRejectPayment(req.id, reason);
      if (ok) {
        setActionSuccess(`درخواست کاربر ${req.user_name} رد شد.`);
        setSelectedRequest(null);
        setAdminNote('');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Navigation */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  پنل مدیریت و نظارت فاکتورچی
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مدیریت جامع کاربران، بررسی و تایید رسیدهای اشتراک و توسعه فیچرهای هوش مصنوعی
              </p>
            </div>
          </div>

          {/* Primary View Switcher */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setAdminView('requests')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                adminView === 'requests'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>درخواست‌های اشتراک</span>
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                  {toPersianDigits(requests.filter(r => r.status === 'pending').length)}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminView('users_view')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                adminView === 'users_view'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>کاربران سیستم</span>
              <span className="px-1.5 py-0.2 rounded-md text-[9px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-mono">
                users_view
              </span>
              {usersList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold">
                  {toPersianDigits(usersList.length)}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminView('feature_updates')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                adminView === 'feature_updates'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>قابلیت‌های هوش مصنوعی</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600 text-base">✕</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. USERS VIEW (کاربران و پروفایل‌ها)                       */}
      {/* ======================================================== */}
      {adminView === 'users_view' && (
        <div className="space-y-4">
          {/* User Metrics KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              type="button"
              onClick={() => setUserStatusFilter('all')}
              className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
                userStatusFilter === 'all'
                  ? 'bg-teal-500/10 border-teal-500/40 ring-2 ring-teal-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  کل کاربران ثبت‌شده
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  {toPersianDigits(userStats.total)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUserStatusFilter('active')}
              className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
                userStatusFilter === 'active'
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  اشتراک فعال
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {toPersianDigits(userStats.active)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUserStatusFilter('trial')}
              className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
                userStatusFilter === 'trial'
                  ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  دوره آزمایشی (Trial)
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {toPersianDigits(userStats.trial)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => setUserStatusFilter('expired')}
              className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
                userStatusFilter === 'expired'
                  ? 'bg-rose-500/10 border-rose-500/40 ring-2 ring-rose-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  منقضی شده
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  {toPersianDigits(userStats.expired)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="جستجو در نام، ایمیل، نام کسب‌وکار، شماره تماس یا شناسه..."
                className="w-full pl-9 pr-10 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {userSearchQuery && (
                <button
                  onClick={() => setUserSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Tabs and Refresh */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                {[
                  { key: 'all', label: 'همه' },
                  { key: 'active', label: 'فعال' },
                  { key: 'trial', label: 'آزمایشی' },
                  { key: 'expired', label: 'منقضی' },
                  { key: 'admin', label: 'مدیران' },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setUserStatusFilter(st.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      userStatusFilter === st.key
                        ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 border border-slate-200 dark:border-slate-700"
                title="به‌روزرسانی لیست کاربران"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin text-teal-600' : ''}`} />
                <span className="hidden sm:inline">به‌روزرسانی</span>
              </button>

              {/* Add New User Button */}
              <button
                type="button"
                onClick={() => {
                  setCreateUserError(null);
                  setIsAddUserModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                title="ایجاد کاربر جدید در سیستم"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>افزودن کاربر جدید</span>
              </button>
            </div>
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            {loadingUsers ? (
              <div className="py-20 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                <span>در حال دریافت و هماهنگ‌سازی لیست کاربران و پروفایل‌ها...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                کاربری با فیلترها و مشخصات وارد شده یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-bold whitespace-nowrap">
                      <th className="py-3.5 px-4">کاربر و شناسه</th>
                      <th className="py-3.5 px-4">ایمیل کاربر</th>
                      <th className="py-3.5 px-4">کسب‌وکار و تلفن</th>
                      <th className="py-3.5 px-4 text-center">نقش</th>
                      <th className="py-3.5 px-4 text-center">وضعیت اشتراک</th>
                      <th className="py-3.5 px-4 text-center">تاریخ عضویت</th>
                      <th className="py-3.5 px-4 text-center">فاکتورها</th>
                      <th className="py-3.5 px-4 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {filteredUsers.map((usr) => {
                      const initial = (usr.profile?.full_name || usr.email || 'U').charAt(0).toUpperCase();
                      const isAdmin = usr.profile?.role === 'admin';
                      return (
                        <tr key={usr.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Name & ID */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs ${
                                isAdmin
                                  ? 'bg-gradient-to-br from-rose-500 to-amber-600'
                                  : 'bg-gradient-to-br from-teal-500 to-emerald-600'
                              }`}>
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                  <span>{usr.profile?.full_name || 'کاربر بدون نام'}</span>
                                  {isAdmin && (
                                    <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.2 rounded">
                                      مدیر
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono select-all">
                                    {usr.id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyId(usr.id)}
                                    className="p-0.5 text-slate-400 hover:text-teal-600 transition-colors"
                                    title="کپی شناسه کاربر"
                                  >
                                    {copiedId === usr.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email - LTR & Monospace */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div dir="ltr" className="text-left font-mono text-slate-700 dark:text-slate-300 font-medium">
                              {usr.email}
                            </div>
                          </td>

                          {/* Business / Phone */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="text-slate-900 dark:text-slate-100 font-medium flex items-center gap-1">
                              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {usr.profile?.business_name || 'کسب‌وکار شخصی'}
                              </span>
                            </div>
                            <div dir="ltr" className="text-left text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{usr.profile?.phone || 'بدون شماره'}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isAdmin ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                <span>مدیر سیستم</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 inline-block">
                                کاربر عادی
                              </span>
                            )}
                          </td>

                          {/* Subscription Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {usr.profile?.subscription_status === 'active' && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>اشتراک فعال</span>
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                  {usr.profile.subscription_expires_at === null
                                    ? '✨ دسترسی دائمی'
                                    : `تا ${formatPersianDate(usr.profile.subscription_expires_at)}`}
                                </span>
                              </div>
                            )}
                            {usr.profile?.subscription_status === 'trial' && (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>آزمایشی (۱ روزه)</span>
                                </span>
                                {usr.profile?.subscription_expires_at && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    تا {formatPersianDate(usr.profile.subscription_expires_at)}
                                  </span>
                                )}
                              </div>
                            )}
                            {usr.profile?.subscription_status === 'expired' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>منقضی شده</span>
                              </span>
                            )}
                            {!usr.profile?.subscription_status && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                نامشخص
                              </span>
                            )}
                          </td>

                          {/* Created At */}
                          <td className="py-3.5 px-4 text-center text-slate-500 text-[11px] whitespace-nowrap font-mono">
                            {usr.created_at ? formatPersianDate(usr.created_at) : '—'}
                          </td>

                          {/* Invoices Count */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {toPersianDigits(usr.invoices_count || 0)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(usr)}
                                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                                title="مدیریت اشتراک و دسترسی این کاربر"
                              >
                                <UserCog className="w-3.5 h-3.5 text-teal-600" />
                                <span>مدیریت اشتراک</span>
                              </button>

                              {usr.email?.toLowerCase() === 'bagherikiarash74@gmail.com' ? (
                                <span
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-[11px] font-medium border border-slate-200/60 dark:border-slate-800 inline-flex items-center gap-1 cursor-not-allowed select-none"
                                  title="مدیر ارشد سیستم قابل حذف نیست"
                                >
                                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                                  <span>مدیر ارشد</span>
                                </span>
                              ) : usr.id === adminUserId ? (
                                <span
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 text-[11px] font-medium border border-slate-200/60 dark:border-slate-800 inline-flex items-center gap-1 cursor-not-allowed select-none"
                                  title="حساب کاربری فعال شما"
                                >
                                  <span>حساب شما</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeleteModal(usr)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 font-bold text-xs inline-flex items-center gap-1 transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98]"
                                  title="حذف کامل کاربر و اطلاعات از کلیه دیتابیس"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>حذف کاربر</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="block md:hidden space-y-3">
            {loadingUsers ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2 bg-white/80 dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                <span>در حال دریافت لیست کاربران...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold bg-white/80 dark:bg-slate-900/80 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800">
                کاربری با این مشخصات یافت نشد.
              </div>
            ) : (
              filteredUsers.map((usr) => {
                const initial = (usr.profile?.full_name || usr.email || 'U').charAt(0).toUpperCase();
                const isAdmin = usr.profile?.role === 'admin';
                return (
                  <div
                    key={usr.id}
                    className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5"
                  >
                    {/* Header: Avatar, Name, Role & Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs ${
                          isAdmin
                            ? 'bg-gradient-to-br from-rose-500 to-amber-600'
                            : 'bg-gradient-to-br from-teal-500 to-emerald-600'
                        }`}>
                          {initial}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                            <span>{usr.profile?.full_name || 'کاربر بدون نام'}</span>
                            {isAdmin && (
                              <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.2 rounded">
                                مدیر
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {usr.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(usr.id)}
                              className="p-0.5 text-slate-400 hover:text-teal-600"
                              title="کپی شناسه"
                            >
                              {copiedId === usr.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="text-left">
                        {usr.profile?.subscription_status === 'active' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 inline-block">
                              اشتراک فعال
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {usr.profile.subscription_expires_at === null
                                ? '✨ نامحدود'
                                : formatPersianDate(usr.profile.subscription_expires_at)}
                            </span>
                          </div>
                        )}
                        {usr.profile?.subscription_status === 'trial' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 inline-block">
                              آزمایشی (۱ روزه)
                            </span>
                            {usr.profile?.subscription_expires_at && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatPersianDate(usr.profile.subscription_expires_at)}
                              </span>
                            )}
                          </div>
                        )}
                        {usr.profile?.subscription_status === 'expired' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-block">
                            منقضی
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Info Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">ایمیل کاربر:</span>
                        <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200 text-left block truncate">
                          {usr.email}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">کسب‌وکار:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {usr.profile?.business_name || 'کسب‌وکار شخصی'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">شماره تماس:</span>
                        <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200 text-left block">
                          {usr.profile?.phone || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-0.5">فاکتورهای صادرشده:</span>
                        <span className="font-black text-teal-600 dark:text-teal-400">
                          {toPersianDigits(usr.invoices_count || 0)} عدد
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditUser(usr)}
                        className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <UserCog className="w-3.5 h-3.5" />
                        <span>مدیریت اشتراک</span>
                      </button>

                      {usr.email?.toLowerCase() === 'bagherikiarash74@gmail.com' ? (
                        <div className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 font-medium text-xs flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
                          <Shield className="w-3.5 h-3.5 text-amber-500" />
                          <span>مدیر ارشد</span>
                        </div>
                      ) : usr.id === adminUserId ? (
                        <div className="py-2.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 font-medium text-xs flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
                          <span>حساب شما</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(usr)}
                          className="py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-1 border border-rose-200 dark:border-rose-800/60 transition-all shadow-2xs active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>حذف از دیتابیس</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. REQUESTS VIEW (درخواست‌های کارت به کارت)                */}
      {/* ======================================================== */}
      {adminView === 'requests' && (
        <div className="space-y-4">
          {/* Sub Filter Tabs */}
          <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              فیلتر وضعیت درخواست‌ها:
            </span>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {[
                { key: 'pending', label: 'در انتظار تأیید' },
                { key: 'approved', label: 'تأیید شده' },
                { key: 'rejected', label: 'رد شده' },
                { key: 'all', label: 'همه' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilterTab(t.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterTab === t.key
                      ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
            {filteredRequests.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                هیچ درخواستی در این بخش وجود ندارد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3.5 px-4">نام و ایمیل کاربر</th>
                      <th className="py-3.5 px-4">مبلغ واریزی</th>
                      <th className="py-3.5 px-4">شماره پیگیری</th>
                      <th className="py-3.5 px-4">تصویر رسید</th>
                      <th className="py-3.5 px-4">تاریخ ثبت</th>
                      <th className="py-3.5 px-4">وضعیت</th>
                      <th className="py-3.5 px-4 text-center">عملیات ادمین</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* User */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{req.user_name}</div>
                          <div dir="ltr" className="text-left text-[11px] text-slate-400 font-mono">{req.user_email}</div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatToman(req.amount)}
                        </td>

                        {/* Transaction reference */}
                        <td dir="ltr" className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400 text-left whitespace-nowrap">
                          {req.transaction_reference}
                        </td>

                        {/* Receipt thumbnail */}
                        <td className="py-3.5 px-4">
                          {req.receipt_image_url ? (
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-teal-600 font-semibold"
                            >
                              <img
                                src={req.receipt_image_url}
                                alt="Receipt"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700"
                              />
                              <span>مشاهده</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">بدون تصویر</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatPersianDate(req.requested_at)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {req.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              تأیید شده
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              رد شده
                            </span>
                          )}
                          {req.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              در انتظار تأیید
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="بررسی رسید و جزئیات"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(req)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                                  title="تایید پرداخت"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>تأیید</span>
                                </button>
                                <button
                                  onClick={() => handleReject(req)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs"
                                  title="رد پرداخت"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>رد</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. FEATURE UPDATES VIEW (مدیریت فیچرها با هوش مصنوعی جمنای) */}
      {/* ======================================================== */}
      {adminView === 'feature_updates' && (
        <div className="space-y-6">
          {/* AI Generator Box */}
          <div className="bg-gradient-to-br from-teal-500/10 via-white to-amber-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-teal-500/30 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/30">
                <Wand2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>تولید و انتشار هوشمند قابلیت جدید با هوش مصنوعی Gemini</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    Auto-Formatted
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  شرح فیچر جدید را به زبان محاوره‌ای بنویسید؛ جمنای آن را با عنوان حرفه‌ای، رنگ بج، آیکون و دکمه اکشن تنظیم و بلافاصله به باکس صفحه اصلی اضافه می‌کند.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateFeatureWithAi} className="space-y-3">
              <textarea
                rows={3}
                value={featurePrompt}
                onChange={(e) => setFeaturePrompt(e.target.value)}
                placeholder="مثال: قابلیت اتصال فاکتورها به درگاه پرداخت مستقیم سپهر و پرداخت یار اضافه شد و مشتریان می‌توانند بلافاصله وجه فاکتور را پرداخت کنند."
                className="w-full p-4 rounded-2xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                disabled={isGeneratingFeature}
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>همگام‌سازی خودکار با پایگاه داده ابری و باکس داشبورد کاربران</span>
                </span>

                <button
                  type="submit"
                  disabled={!featurePrompt.trim() || isGeneratingFeature}
                  className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {isGeneratingFeature ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جمنای در حال پردازش...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تولید و انتشار در صفحه اصلی</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* List of active feature updates */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  لیست قابلیت‌های فعال در باکس «تازه‌های فاکتورچی» ({toPersianDigits(featureList.length)})
                </h4>
              </div>

              <button
                onClick={fetchFeatures}
                disabled={loadingFeatures}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="تازه‌سازی لیست"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFeatures ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingFeatures ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>در حال بارگذاری قابلیت‌ها...</span>
              </div>
            ) : featureList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                هنوز هیچ قابلیتی اضافه نشده است. با کادر بالا اولین مورد را بسازید.
              </div>
            ) : (
              <div className="space-y-3">
                {featureList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {item.badge}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          • {item.date}
                        </span>
                        {item.ai_generated && (
                          <span className="px-1.5 py-0.2 text-[9px] rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            هوش مصنوعی جمنای
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.description}
                      </p>
                      {item.actionText && (
                        <div className="pt-1 text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                          دکمه اقدام: {item.actionText} (هدایت به {item.actionTab || 'صفحه اصلی'})
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteFeature(item)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                      title="حذف این قابلیت از صفحه اصلی"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View & Audit Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileImage className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  بررسی رسید پرداخت کارت به کارت
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Image Display with Interactive Pointer Hover Zoom & Fullscreen Lightbox */}
            {selectedRequest.receipt_image_url ? (
              <ReceiptImageHoverZoom
                src={selectedRequest.receipt_image_url}
                alt={`رسید پرداخت کاربر ${selectedRequest.user_name || ''}`}
                trackingNumber={selectedRequest.transaction_reference}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-slate-400 text-xs text-center bg-slate-50 dark:bg-slate-800/40">
                رسید تصویری بارگذاری نشده است
              </div>
            )}

            {/* Transaction Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="text-slate-500 block mb-0.5">نام کاربر:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRequest.user_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">ایمیل کاربر:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{selectedRequest.user_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">مبلغ واریزی:</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{formatToman(selectedRequest.amount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">کد پیگیری:</span>
                <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{selectedRequest.transaction_reference}</span>
              </div>
              {selectedRequest.user_note && (
                <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">یادداشت کاربر:</span>
                  <p className="text-slate-800 dark:text-slate-200 italic">{selectedRequest.user_note}</p>
                </div>
              )}
            </div>

            {/* Admin Note Input */}
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                یادداشت یا دلیل ادمین:
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="توضیحات برای ثبت در سوابق سیستم..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
              >
                بستن
              </button>

              {selectedRequest.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedRequest)}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>رد درخواست</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(selectedRequest)}
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>تأیید و فعال‌سازی اشتراک</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL: EDIT USER SUBSCRIPTION & ROLE                  */}
      {/* ======================================================== */}
      {selectedUserToEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    مدیریت اشتراک و سطح دسترسی کاربر
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ویرایش فوری وضعیت، روزهای دسترسی و نقش کاربری
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            {/* Target User Info Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedUserToEdit.profile?.full_name || 'کاربر بدون نام'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedUserToEdit.id}
                </span>
              </div>
              <div dir="ltr" className="text-left font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {selectedUserToEdit.email}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                <span className="text-slate-400">وضعیت و انقضای فعلی:</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">
                  {selectedUserToEdit.profile?.subscription_status === 'active'
                    ? (selectedUserToEdit.profile?.subscription_expires_at === null ? 'اشتراک فعال (دائمی)' : `فعال تا ${formatPersianDate(selectedUserToEdit.profile.subscription_expires_at)}`)
                    : selectedUserToEdit.profile?.subscription_status === 'trial'
                    ? `آزمایشی (تا ${selectedUserToEdit.profile?.subscription_expires_at ? formatPersianDate(selectedUserToEdit.profile.subscription_expires_at) : '—'})`
                    : 'منقضی شده'}
                </span>
              </div>
            </div>

            {/* Field 1: User Role */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                نقش و سطح دسترسی کاربر:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditRole('user')}
                  disabled={selectedUserToEdit.email?.toLowerCase() === 'bagherikiarash74@gmail.com'}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                    editRole === 'user'
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-600'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>کاربر عادی</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditRole('admin')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                    editRole === 'admin'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>مدیر سیستم (Admin)</span>
                </button>
              </div>
            </div>

            {/* Field 2: Subscription Status */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                وضعیت اشتراک:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'active', label: 'اشتراک فعال', color: 'emerald' },
                  { key: 'trial', label: 'دوره آزمایشی', color: 'teal' },
                  { key: 'expired', label: 'منقضی شده', color: 'rose' },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      setEditStatus(st.key as any);
                      if (st.key === 'expired') {
                        setEditIsPerpetual(false);
                      } else if (st.key === 'trial') {
                        setEditDaysToAdd(1);
                        setEditIsPerpetual(false);
                      }
                    }}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                      editStatus === st.key
                        ? st.key === 'active'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : st.key === 'trial'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Options when Status is TRIAL */}
            {editStatus === 'trial' && (
              <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>دسترسی آزمایشی و تست رایگان (۲۴ ساعت کامل)</span>
                </div>
                <p className="text-[11px] text-teal-700 dark:text-teal-300 leading-relaxed">
                  با ذخیره این حالت، اشتراک کاربر دقیقاً از همین لحظه به مدت ۱ روز (۲۴ ساعت) فعال می‌شود و در پایگاه‌داده و سرور پایدار خواهد ماند.
                </p>
              </div>
            )}

            {/* Options when Status is ACTIVE */}
            {editStatus === 'active' && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                {/* Perpetual Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIsPerpetual}
                    onChange={(e) => setEditIsPerpetual(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    ✨ دسترسی نامحدود و دائمی (بدون تاریخ انقضا)
                  </span>
                </label>

                {!editIsPerpetual && (
                  <div className="space-y-2.5 pt-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      مدت زمان افزایش اشتراک:
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { days: 1, label: '+۱ روز' },
                        { days: 30, label: '+۳۰ روز' },
                        { days: 90, label: '+۹۰ روز' },
                        { days: 180, label: '+۶ ماه' },
                        { days: 365, label: '+۱ سال' },
                      ].map((p) => (
                        <button
                          key={p.days}
                          type="button"
                          onClick={() => setEditDaysToAdd(p.days)}
                          className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            editDaysToAdd === p.days
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={editDaysToAdd}
                        onChange={(e) => setEditDaysToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        placeholder="تعداد روز دلخواه..."
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
                        روز
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <input
                        type="checkbox"
                        id="extendFromNow"
                        checked={editExtendFromNow}
                        onChange={(e) => setEditExtendFromNow(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                      />
                      <label htmlFor="extendFromNow" className="cursor-pointer select-none">
                        محاسبه و شروع مجدد از تاریخ امروز (به جای تمدید پایان اعتبار فعلی)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Options when Status is TRIAL */}
            {editStatus === 'trial' && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/40">
                <span className="block text-xs font-bold text-teal-800 dark:text-teal-300">
                  مدت دوره آزمایشی (از لحظه ثبت / امروز):
                </span>
                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white border border-teal-600 flex items-center gap-1.5 shadow-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>۱ روزه (۲۴ ساعت مهلت تست رایگان)</span>
                  </div>
                </div>
                <p className="text-[11px] text-teal-700/90 dark:text-teal-300/80 leading-relaxed mt-1">
                  طبق سیاست کلی سامانه، کلیه حساب‌های آزمایشی صرفاً به مدت ۱ روز (۲۴ ساعت) فعال بوده و پس از آن منقضی می‌گردند.
                </p>
              </div>
            )}

            {/* Warning when Status is EXPIRED */}
            {editStatus === 'expired' && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <p>
                  با انتخاب این گزینه، وضعیت اشتراک کاربر فوراً منقضی شده و دسترسی به هوش مصنوعی و صدور فاکتور صوتی مسدود می‌گردد.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {selectedUserToEdit.email?.toLowerCase() !== 'bagherikiarash74@gmail.com' && selectedUserToEdit.id !== adminUserId ? (
                <button
                  type="button"
                  onClick={() => {
                    const usr = selectedUserToEdit;
                    setSelectedUserToEdit(null);
                    handleOpenDeleteModal(usr);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-200 dark:border-rose-800/60 transition-colors shadow-2xs active:scale-95"
                  title="حذف کامل این کاربر از دیتابیس"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>حذف کامل کاربر</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserToEdit(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleUpdateUserSubscription}
                  disabled={isSavingUser}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingUser ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>ذخیره و اعمال فوری تغییرات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4.5. MODAL: ADD NEW USER DIRECTLY                        */}
      {/* ======================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    افزودن کاربر جدید به سیستم
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ایجاد مستقیم حساب کاربری و تعیین اشتراک اولیه بدون نیاز به کد تأیید
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              {createUserError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createUserError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام و نام خانوادگی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="مثال: علی رضایی"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام کسب‌وکار یا فروشگاه
                  </label>
                  <input
                    type="text"
                    value={newUserBusiness}
                    onChange={(e) => setNewUserBusiness(e.target.value)}
                    placeholder="مثال: فروشگاه رضایی"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    آدرس ایمیل (ورود به سیستم) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    شماره تماس
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="09123456789"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    کلمه عبور ورود <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="رمز عبور"
                      className="w-full pl-3 pr-8 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نقش کاربری
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setNewUserRole('user')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        newUserRole === 'user'
                          ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      کاربر عادی
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUserRole('admin')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        newUserRole === 'admin'
                          ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      مدیر سیستم
                    </button>
                  </div>
                </div>
              </div>

              {/* Initial Subscription Status */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  وضعیت اشتراک اولیه
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserStatus('active');
                      setNewUserIsPerpetual(true);
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      newUserStatus === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    فعال (نامحدود)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserStatus('trial');
                      setNewUserDays(1);
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      newUserStatus === 'trial'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    آزمایشی ۱ روزه
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserStatus('expired');
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                      newUserStatus === 'expired'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    منقضی شده
                  </button>
                </div>

                {newUserStatus === 'active' && (
                  <div className="pt-2 flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">نوع فعال‌سازی:</span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="newUserPerpetual"
                          checked={newUserIsPerpetual}
                          onChange={() => setNewUserIsPerpetual(true)}
                          className="accent-teal-600"
                        />
                        <span className="text-[11px] font-bold">دائمی (مادام‌العمر)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="newUserPerpetual"
                          checked={!newUserIsPerpetual}
                          onChange={() => setNewUserIsPerpetual(false)}
                          className="accent-teal-600"
                        />
                        <span className="text-[11px] font-bold">مدت‌دار (۳۰ روز)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  disabled={isCreatingUser}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ایجاد کاربر...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ایجاد و ثبت قطعی کاربر</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. MODAL: DELETE USER PERMANENTLY FROM DATABASE         */}
      {/* ======================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-rose-200 dark:border-rose-900/60 shadow-2xl space-y-4">
            {/* Warning Header */}
            <div className="flex items-start gap-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  حذف قطعی کاربر از پایگاه داده
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  این عملیات غیرقابل بازگشت است!
                </p>
              </div>
            </div>

            {/* Target User Specs Card */}
            <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl p-4 border border-rose-200/60 dark:border-rose-900/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">نام و نام خانوادگی:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {userToDelete.profile?.full_name || 'کاربر بدون نام'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">آدرس ایمیل:</span>
                <span dir="ltr" className="font-mono text-slate-800 dark:text-slate-200 font-semibold select-all text-[11px]">
                  {userToDelete.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">کسب‌وکار:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {userToDelete.profile?.business_name || 'کسب‌وکار شخصی'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">فاکتورهای صادر شده:</span>
                <span className="font-black text-rose-600 dark:text-rose-400">
                  {toPersianDigits(userToDelete.invoices_count || 0)} عدد
                </span>
              </div>
            </div>

            {/* Detailed Warning Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>موارد زیر به طور کامل و قطعی پاک خواهند شد:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 dark:text-amber-200 pr-1">
                <li>حساب کاربری و پروفایل از دیتابیس محلی و دیتابیس ابری Firestore</li>
                <li>تمامی فاکتورها و پیش‌فاکتورهای صادر شده توسط این کاربر</li>
                <li>کلیه رکوردهای هزینه‌ها و تراکنش‌های ثبت‌شده</li>
                <li>درخواست‌های اشتراک و اطلاعات رسیدهای قبلی</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال پاک‌سازی از دیتابیس...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>بله، کاربر را به صورت دائمی حذف کن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MODAL: DELETE FEATURE UPDATE FROM SYSTEM              */}
      {/* ======================================================== */}
      {featureToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-rose-200 dark:border-rose-900/60 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  حذف قابلیت از سیستم
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  آیا از حذف این قابلیت از صفحه اصلی و پنل کاربری اطمینان دارید؟
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {featureToDelete.title}
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                {featureToDelete.description}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFeatureToDelete(null)}
                disabled={isDeletingFeature}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFeature}
                disabled={isDeletingFeature}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isDeletingFeature ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>بله، حذف کن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
