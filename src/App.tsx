import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { GlobalFooter } from './components/GlobalFooter';
import { DashboardView } from './components/DashboardView';
import { VoiceInvoiceCreator } from './components/VoiceInvoiceCreator';
import { InvoiceList } from './components/InvoiceList';
import { BillingPage } from './components/BillingPage';
import { AdminPayments } from './components/AdminPayments';
import { SettingsPage } from './components/SettingsPage';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { PaymentVerificationModal } from './components/PaymentVerificationModal';
import { ForbiddenPage } from './components/ForbiddenPage';
import { PaymentPage } from './components/PaymentPage';
import { RealtimeToast } from './components/RealtimeToast';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { OnboardingTour } from './components/OnboardingTour';
import { Invoice, Profile, SubscriptionRequest, NavigationTab, RealtimeNotification } from './types';
import { realtime } from './lib/realtime';
import { sound } from './lib/sound';
import { fetchWithRetry } from './lib/utils';
import { safeStorage } from './lib/safeStorage';
import { Sparkles, X, Lock, CreditCard } from 'lucide-react';

type AuthView = 'login' | 'register' | 'forgot-password' | 'reset-password' | null;

export function isAdminUser(p?: Profile | null): boolean {
  if (!p) return false;
  const email = (p.email || '').toLowerCase();
  return p.role === 'admin' || email === 'bagherikiarash74@gmail.com' || email === 'kimiabg2013@gmail.com';
}

export default function App() {
  // Theme state (Dark / Light) with Next-themes / LocalStorage compatibility
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme') || localStorage.getItem('factorchi_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('factorchi_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('factorchi_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Authentication State
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const savedUser = safeStorage.getItem('factorchi_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && isAdminUser(parsed)) {
          parsed.role = 'admin';
          parsed.subscription_status = 'active';
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedAuth = safeStorage.getItem('factorchi_auth');
      const savedUser = safeStorage.getItem('factorchi_user');
      if (savedAuth === 'true' && savedUser) return true;
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) return true;
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  });

  const [resetToken, setResetToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || '';
    }
    return '';
  });

  const [authView, setAuthView] = useState<AuthView>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      if (path.includes('/auth/reset-password') || params.get('token')) {
        return 'reset-password';
      }
    }
    const savedAuth = safeStorage.getItem('factorchi_auth');
    const savedUser = safeStorage.getItem('factorchi_user');
    return (savedAuth === 'true' && !!savedUser) || !!savedUser ? null : 'login';
  });

  // Active Navigation Tab
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path.startsWith('/payment') || path.startsWith('/pay')) return 'payment';
    return 'dashboard';
  });

  // Invoices & Admin Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [verifyingInvoice, setVerifyingInvoice] = useState<Invoice | null>(null);

  // Real-time Notifications & Toast State
  const [notifications, setNotifications] = useState<RealtimeNotification[]>(() => {
    try {
      const saved = localStorage.getItem('factorchi_notifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [activeToast, setActiveToast] = useState<RealtimeNotification | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  // Welcome Notification Toast
  const [welcomeToast, setWelcomeToast] = useState(true);
  // Onboarding Guided Tour State
  const [showTour, setShowTour] = useState(false);
  // Guard against duplicate in-flight invoice submissions
  const isSavingInvoiceRef = useRef(false);

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('factorchi_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }, [notifications]);

  // Auto-dismiss active real-time toast
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Check if current user is newly registered (not in database before) and hasn't completed the onboarding tour yet
  useEffect(() => {
    if (!isAuthenticated || !profile?.id) return;

    try {
      const isNewUser = localStorage.getItem('factorchi_is_new_user') === 'true';
      const tourAlreadyCompleted = 
        profile.tour_completed === true || 
        localStorage.getItem(`factorchi_tour_completed_${profile.id}`) === 'true';

      // The onboarding tour ONLY automatically appears for newly registered accounts,
      // NOT for existing database accounts on login!
      if (isNewUser && !tourAlreadyCompleted) {
        const timer = setTimeout(() => {
          setShowTour(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.error('Error checking tour completion status:', e);
    }
  }, [isAuthenticated, profile?.id, profile?.tour_completed]);

  const handleStartTour = () => {
    setShowTour(true);
  };

  // Real-time SSE Connection & Event Dispatcher
  useEffect(() => {
    if (!isAuthenticated || !profile?.id) {
      realtime.disconnect();
      return;
    }

    realtime.connect(profile.id);

    const unsubscribeStatus = realtime.onStatusChange((connected) => {
      setIsRealtimeConnected(connected);
    });

    const unsubscribeEvents = realtime.subscribe((event) => {
      const { type, payload } = event;

      if (type === 'payment:receipt_submitted') {
        // Strictly verify that event belongs to the currently logged in user
        const invoiceUserId = payload.invoice?.user_id || payload.userId;
        if (!invoiceUserId || !profile?.id || invoiceUserId !== profile.id) {
          return;
        }

        // 1. Play audible receipt chime
        sound.playReceiptReceived();

        // 2. Real-time update invoices state
        if (payload.invoice) {
          setInvoices((prev) => {
            const existingIdx = prev.findIndex(
              (i) => i.id === payload.invoice.id || i.invoice_number === payload.invoice.invoice_number
            );
            if (existingIdx !== -1) {
              const copy = [...prev];
              copy[existingIdx] = payload.invoice;
              return copy;
            }
            return [payload.invoice, ...prev];
          });

          if (
            selectedInvoice &&
            (selectedInvoice.id === payload.invoice.id || selectedInvoice.invoice_number === payload.invoice.invoice_number)
          ) {
            setSelectedInvoice(payload.invoice);
          }
        }

        // 3. Create real-time notification
        const newNotif: RealtimeNotification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'receipt_submitted',
          title: 'رسید پرداخت جدید دریافت شد 🔔',
          message: payload.message || `رسید پرداخت برای فاکتور ${payload.invoice_number} توسط ${payload.customer_name} بارگذاری شد.`,
          timestamp: new Date().toISOString(),
          read: false,
          invoiceId: payload.invoice_id || payload.invoice?.id,
          invoiceNumber: payload.invoice_number || payload.invoice?.invoice_number,
          amount: payload.amount,
          customerName: payload.customer_name,
          customerPhone: payload.customer_phone,
          receiptUrl: payload.receipt_image_url,
          trackingNumber: payload.tracking_number,
        };

        setNotifications((prev) => [newNotif, ...prev]);
        setActiveToast(newNotif);
      } else if (type === 'invoice:updated') {
        if (payload.invoice) {
          // Strictly verify owner: never modify state for another user's invoice
          if (!profile?.id || payload.invoice.user_id !== profile.id) {
            return;
          }

          setInvoices((prev) => {
            const existingIdx = prev.findIndex(
              (i) => i.id === payload.invoice.id || i.invoice_number === payload.invoice.invoice_number
            );
            if (existingIdx !== -1) {
              const copy = [...prev];
              copy[existingIdx] = payload.invoice;
              return copy;
            }
            return [payload.invoice, ...prev];
          });

          if (
            selectedInvoice &&
            (selectedInvoice.id === payload.invoice.id || selectedInvoice.invoice_number === payload.invoice.invoice_number)
          ) {
            setSelectedInvoice(payload.invoice);
          }
        }
      } else if (type === 'invoice:created') {
        if (payload.invoice) {
          // Strictly verify owner: never inject another user's invoice
          if (!profile?.id || payload.invoice.user_id !== profile.id) {
            return;
          }

          setInvoices((prev) => {
            const exists = prev.some(
              (i) => i.id === payload.invoice.id || i.invoice_number === payload.invoice.invoice_number
            );
            return exists ? prev : [payload.invoice, ...prev];
          });
        }
      } else if (type === 'invoice:deleted') {
        const deletedOwnerId = payload.user_id || payload.userId;
        if (deletedOwnerId && profile?.id && deletedOwnerId !== profile.id) {
          return;
        }
        if (payload.invoice_id) {
          setInvoices((prev) =>
            prev.filter((i) => i.id !== payload.invoice_id && i.invoice_number !== payload.invoice_number)
          );
          if (
            selectedInvoice &&
            (selectedInvoice.id === payload.invoice_id || selectedInvoice.invoice_number === payload.invoice_number)
          ) {
            setSelectedInvoice(null);
          }
        }
      } else if (type === 'subscription:created') {
        if (payload.request) {
          setSubscriptionRequests((prev) => [payload.request, ...prev.filter((r) => r.id !== payload.request.id)]);
          if (profile.role === 'admin') {
            sound.playAlert();
            const subNotif: RealtimeNotification = {
              id: `notif-${Date.now()}`,
              type: 'subscription_request',
              title: 'درخواست خرید اشتراک جدید',
              message: payload.message || 'یک درخواست خرید اشتراک جدید در صف بررسی قرار گرفت.',
              timestamp: new Date().toISOString(),
              read: false,
            };
            setNotifications((prev) => [subNotif, ...prev]);
            setActiveToast(subNotif);
          }
        }
      } else if (type === 'subscription:updated') {
        if (payload.request) {
          setSubscriptionRequests((prev) =>
            prev.map((r) => (r.id === payload.request.id ? payload.request : r))
          );
        }
        if (payload.request?.user_id === profile.id) {
          loadData(profile);
          sound.playSuccess();
          const subNotif: RealtimeNotification = {
            id: `notif-${Date.now()}`,
            type: 'subscription_approved',
            title: payload.status === 'approved' ? 'اشتراک ماهانه شما فعال شد 🎉' : 'وضعیت درخواست اشتراک',
            message: payload.message || 'وضعیت درخواست اشتراک شما به‌روز شد.',
            timestamp: new Date().toISOString(),
            read: false,
          };
          setNotifications((prev) => [subNotif, ...prev]);
          setActiveToast(subNotif);
        }
      } else if (type === 'profile:updated') {
        if (payload.profile && (payload.user_id === profile.id || payload.profile.id === profile.id)) {
          setProfile(payload.profile);
          safeStorage.setItem('factorchi_user', JSON.stringify(payload.profile));
        }
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      realtime.disconnect();
    };
  }, [isAuthenticated, profile?.id, selectedInvoice?.id]);

  // Sync with URL route on mount and popstate navigation
  const syncRouteWithState = (activeProfile: Profile | null, authenticated: boolean) => {
    const path = window.location.pathname;
    
    // Public Payment Route - Accessible without authentication
    if (path.startsWith('/payment') || path.startsWith('/pay')) {
      setCurrentTab('payment');
      setAuthView(null);
      return;
    }

    // Auth route handling
    if (!authenticated) {
      if (path === '/auth/reset-password' || path.startsWith('/auth/reset-password') || window.location.search.includes('token=')) {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        if (tokenFromUrl) setResetToken(tokenFromUrl);
        setAuthView('reset-password');
      } else if (path === '/auth/register') {
        setAuthView('register');
      } else if (path === '/auth/forgot-password') {
        setAuthView('forgot-password');
      } else {
        setAuthView('login');
        if (path.startsWith('/admin') || path === '/invoices' || path === '/billing' || path === '/settings' || path === '/new-invoice') {
          const redirectParam = encodeURIComponent(path);
          window.history.replaceState({}, '', `/auth/login?redirect=${redirectParam}`);
        }
      }
      return;
    }

    // Authenticated route handling
    setAuthView(null);
    if (path === '/403') {
      setCurrentTab('403');
    } else if (path === '/admin' || path.startsWith('/admin/')) {
      const isUserAdmin = isAdminUser(activeProfile);
      if (!activeProfile || !isUserAdmin) {
        setCurrentTab('403');
        window.history.replaceState({}, '', '/403');
      } else {
        setCurrentTab('admin');
      }
    } else if (path === '/invoices') {
      setCurrentTab('invoices');
    } else if (path === '/billing') {
      setCurrentTab('billing');
    } else if (path === '/settings') {
      setCurrentTab('settings');
    } else if (path === '/new-invoice') {
      setCurrentTab('new-invoice');
    } else {
      setCurrentTab('dashboard');
    }
  };

  useEffect(() => {
    syncRouteWithState(profile, isAuthenticated);

    const handlePopState = () => {
      syncRouteWithState(profile, isAuthenticated);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated, profile?.id, profile?.role, profile?.subscription_status]);

  // Tab navigation middleware
  const navigateToTab = (tab: NavigationTab) => {
    if (tab === 'admin') {
      const isUserAdmin = isAdminUser(profile);
      if (!profile || !isUserAdmin) {
        setCurrentTab('403');
        window.history.pushState({}, '', '/403');
      } else {
        setCurrentTab('admin');
        window.history.pushState({}, '', '/admin/payments');
      }
    } else if (tab === '403') {
      setCurrentTab('403');
      window.history.pushState({}, '', '/403');
    } else {
      setCurrentTab(tab);
      window.history.pushState({}, '', tab === 'dashboard' ? '/' : `/${tab}`);
    }
  };

  // Fetch initial data scoped to active user
  const loadData = async (userProfile?: Profile) => {
    const activeUser = userProfile || profile;
    if (!activeUser) return;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': activeUser.id,
      };

      const isUserAdmin = isAdminUser(activeUser);

      // Load invoices, session, and admin requests in parallel with retry resilience
      const [invRes, profRes, reqRes] = await Promise.all([
        fetchWithRetry('/api/invoices', { headers }),
        fetchWithRetry('/api/auth/session', { headers }),
        isUserAdmin ? fetchWithRetry('/api/admin/subscription-requests', { headers }) : Promise.resolve(null),
      ]);

      if (invRes && invRes.ok) {
        try {
          const json = await invRes.json();
          if (json.invoices) setInvoices(json.invoices);
        } catch {
          // ignore json parse error on abnormal response
        }
      }

      if (profRes && profRes.ok) {
        try {
          const json = await profRes.json();
          if (json.profile) {
            const fetchedProfile = json.profile;
            if (isAdminUser(fetchedProfile)) {
              fetchedProfile.role = 'admin';
              fetchedProfile.subscription_status = 'active';
            }
            setProfile(fetchedProfile);
            safeStorage.setItem('factorchi_user', JSON.stringify(fetchedProfile));
          }
        } catch {
          // ignore json parse error on abnormal response
        }
      }

      if (reqRes && reqRes.ok) {
        try {
          const json = await reqRes.json();
          if (json.requests) setSubscriptionRequests(json.requests);
        } catch {
          // ignore json parse error on abnormal response
        }
      }
    } catch (e: any) {
      console.warn('[App] Notice loading initial data:', e?.message || e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && profile) {
      loadData(profile);
    }
  }, [isAuthenticated, profile?.id]);

  // Auth Handlers
  const handleLoginSuccess = (userProfile: Profile, remember: boolean = true) => {
    if (isAdminUser(userProfile)) {
      userProfile.role = 'admin';
      userProfile.subscription_status = 'active';
    }
    setProfile(userProfile);
    setIsAuthenticated(true);
    setAuthView(null);
    
    // Persist session to multi-tier safeStorage (localStorage, sessionStorage, cookie)
    safeStorage.setItem('factorchi_auth', 'true');
    safeStorage.setItem('factorchi_user', JSON.stringify(userProfile));

    // Existing database user logged in: ensure tour is marked as completed and is_new_user is cleared
    safeStorage.removeItem('factorchi_is_new_user');
    safeStorage.setItem(`factorchi_tour_completed_${userProfile.id}`, 'true');

    // Handle post-login redirect query parameter
    const params = new URLSearchParams(window.location.search);
    const redirectTarget = params.get('redirect');

    const isUserAdmin = isAdminUser(userProfile);
    if (redirectTarget && redirectTarget.startsWith('/admin')) {
      if (isUserAdmin) {
        setCurrentTab('admin');
        window.history.pushState({}, '', '/admin/payments');
      } else {
        setCurrentTab('403');
        window.history.pushState({}, '', '/403');
      }
    } else if (redirectTarget && redirectTarget === '/billing') {
      setCurrentTab('billing');
      window.history.pushState({}, '', '/billing');
    } else if (redirectTarget && redirectTarget === '/invoices') {
      setCurrentTab('invoices');
      window.history.pushState({}, '', '/invoices');
    } else if (redirectTarget && redirectTarget === '/settings') {
      setCurrentTab('settings');
      window.history.pushState({}, '', '/settings');
    } else if (redirectTarget && redirectTarget === '/new-invoice') {
      setCurrentTab('new-invoice');
      window.history.pushState({}, '', '/new-invoice');
    } else {
      setCurrentTab('dashboard');
      window.history.pushState({}, '', '/');
    }
    loadData(userProfile);
  };

  const handleRegisterSuccess = (userProfile: Profile) => {
    setProfile(userProfile);
    setIsAuthenticated(true);
    setAuthView(null);
    safeStorage.setItem('factorchi_auth', 'true');
    safeStorage.setItem('factorchi_user', JSON.stringify(userProfile));
    // Mark as newly registered account that wasn't in database previously
    safeStorage.setItem('factorchi_is_new_user', 'true');
    safeStorage.removeItem(`factorchi_tour_completed_${userProfile.id}`);
    setCurrentTab('dashboard');
    window.history.pushState({}, '', '/');
    loadData(userProfile);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setProfile(null);
    setIsAuthenticated(false);
    setInvoices([]);
    setSubscriptionRequests([]);
    setSelectedInvoice(null);
    setAuthView('login');
    safeStorage.removeItem('factorchi_auth');
    safeStorage.removeItem('factorchi_user');
    safeStorage.removeItem('factorchi_token');
    window.history.pushState({}, '', '/auth/login');
  };

  // Save new invoice
  const handleSaveInvoice = async (invData: Partial<Invoice>): Promise<Invoice> => {
    if (!profile) throw new Error('لطفاً ابتدا وارد شوید');
    if (isSavingInvoiceRef.current) {
      console.warn('[Invoice] Duplicate submission ignored in App.tsx');
      throw new Error('درخواست ثبت فاکتور در حال انجام است.');
    }

    isSavingInvoiceRef.current = true;
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': profile.id,
        },
        body: JSON.stringify({
          origin: window.location.origin,
          ...invData,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.invoice) {
          setInvoices((prev) => {
            const exists = prev.some(
              (i) => i.id === json.invoice.id || i.invoice_number === json.invoice.invoice_number
            );
            if (exists) return prev;
            return [json.invoice, ...prev];
          });
          return json.invoice;
        }
      }
      throw new Error('خطا در ذخیره فاکتور');
    } finally {
      setTimeout(() => {
        isSavingInvoiceRef.current = false;
      }, 500);
    }
  };

  // Update invoice status
  const handleUpdateStatus = async (id: string, status: Invoice['status']) => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': profile.id,
        },
        body: JSON.stringify({
          status,
          payment_status: status === 'paid' ? 'paid' : (status === 'overdue' ? 'failed' : 'unpaid'),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.invoice) {
          setInvoices((prev) => prev.map((i) => (i.id === id || i.invoice_number === id ? json.invoice : i)));
          if (selectedInvoice && (selectedInvoice.id === id || selectedInvoice.invoice_number === id)) {
            setSelectedInvoice(json.invoice);
          }
          realtime.publishLocal('invoice:updated', { invoice: json.invoice });
        } else {
          setInvoices((prev) =>
            prev.map((i) => (i.id === id || i.invoice_number === id ? { ...i, status, payment_status: status === 'paid' ? 'paid' : 'unpaid', updated_at: new Date().toISOString() } : i))
          );
          if (selectedInvoice && (selectedInvoice.id === id || selectedInvoice.invoice_number === id)) {
            setSelectedInvoice((prev) => (prev ? { ...prev, status, payment_status: status === 'paid' ? 'paid' : 'unpaid' } : null));
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete invoice
  const handleDeleteInvoice = async (id: string): Promise<boolean> => {
    // 1. Snapshot previous state for rollback in case of any failure
    const previousInvoices = invoices;
    const previousSelected = selectedInvoice;

    // Optimistic removal from client state
    setInvoices((prev) => prev.filter((i) => i.id !== id && i.invoice_number !== id));
    if (selectedInvoice && (selectedInvoice.id === id || selectedInvoice.invoice_number === id)) {
      setSelectedInvoice(null);
    }
    realtime.publishLocal('invoice:deleted', { invoice_id: id });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (profile?.id) {
        headers['x-user-id'] = profile.id;
        headers['Authorization'] = `Bearer ${profile.id}`;
      }
      if (profile?.email) {
        headers['x-user-email'] = profile.email;
      }

      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok || !resJson.success) {
        console.error('Server delete error:', resJson);
        // Rollback state
        setInvoices(previousInvoices);
        setSelectedInvoice(previousSelected);
        alert(resJson.error || 'خطا در حذف فاکتور از سرور. عملیات لغو شد.');
        return false;
      }

      sound.playAlert();
      return true;
    } catch (e) {
      console.error('Network or server error during invoice delete:', e);
      // Rollback state
      setInvoices(previousInvoices);
      setSelectedInvoice(previousSelected);
      alert('خطای ارتباط با سرور در حذف فاکتور. لطفاً دوباره تلاش کنید.');
      return false;
    }
  };

  // Verify or Reject Customer Invoice Payment Tracking
  const handleVerifyInvoicePayment = async (
    invoiceId: string,
    status: 'paid' | 'failed',
    notes?: string
  ): Promise<boolean> => {
    if (!profile) return false;
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': profile.id,
        },
        body: JSON.stringify({
          status,
          payment_status: status,
          notes,
          verification_notes: notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.invoice) {
          setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId || inv.invoice_number === invoiceId ? data.invoice : inv)));
          if (selectedInvoice && (selectedInvoice.id === invoiceId || selectedInvoice.invoice_number === invoiceId)) {
            setSelectedInvoice(data.invoice);
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Error verifying payment:', err);
      return false;
    }
  };

  // Submit payment request
  const handleSubmitPayment = async (formData: FormData): Promise<boolean> => {
    if (!profile) return false;
    formData.append('user_id', profile.id);
    formData.append('user_name', profile.full_name);
    if (profile.email) formData.append('user_email', profile.email);

    const res = await fetch('/api/subscription/request', {
      method: 'POST',
      headers: {
        'x-user-id': profile.id,
      },
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.request) {
        setSubscriptionRequests((prev) => [json.request, ...prev]);
        return true;
      }
    }
    return false;
  };

  // Verify payment (Admin)
  const handleVerifyPayment = async (requestId: string, adminNote?: string): Promise<boolean> => {
    const isUserAdmin = isAdminUser(profile);
    if (!isUserAdmin) return false;

    const res = await fetch('/api/admin/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': profile.id,
      },
      body: JSON.stringify({ request_id: requestId, admin_note: adminNote, admin_id: profile.id }),
    });
    if (res.ok) {
      setSubscriptionRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'approved', admin_note: adminNote } : r))
      );
      loadData(profile);
      return true;
    }
    return false;
  };

  // Reject payment (Admin)
  const handleRejectPayment = async (requestId: string, adminNote: string): Promise<boolean> => {
    const isUserAdmin = isAdminUser(profile);
    if (!isUserAdmin) return false;

    const res = await fetch('/api/admin/reject-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': profile.id,
      },
      body: JSON.stringify({ request_id: requestId, admin_note: adminNote }),
    });
    if (res.ok) {
      setSubscriptionRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'rejected', admin_note: adminNote } : r))
      );
      return true;
    }
    return false;
  };

  // Update profile
  const handleUpdateProfile = async (data: Partial<Profile>) => {
    if (!profile) return;
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': profile.id,
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.profile) {
        setProfile(json.profile);
        safeStorage.setItem('factorchi_user', JSON.stringify(json.profile));
      }
    }
  };

  const pendingRequestsCount = subscriptionRequests.filter((r) => r.status === 'pending').length;
  const pendingPaymentsCount = invoices.filter(
    (i) => i.payment_status === 'pending_verification' || (!i.payment_status && i.payment_tracking_number && i.status !== 'paid')
  ).length;
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleSelectNotification = (notif: RealtimeNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));

    if (notif.invoiceId || notif.invoiceNumber) {
      const found = invoices.find(
        (i) => i.id === notif.invoiceId || i.invoice_number === notif.invoiceNumber || i.id === notif.invoiceNumber
      );
      if (found) {
        if (notif.type === 'receipt_submitted') {
          setVerifyingInvoice(found);
        } else {
          setSelectedInvoice(found);
        }
      } else {
        navigateToTab('invoices');
      }
    } else if (notif.type === 'subscription_request') {
      navigateToTab('admin');
    } else if (notif.type === 'subscription_approved') {
      navigateToTab('billing');
    }
  };

  const handleToastAction = (notif: RealtimeNotification) => {
    handleSelectNotification(notif);
  };

  // Dedicated Public Payment View (Works for both guest customers and authenticated users)
  if (currentTab === 'payment') {
    return (
      <PaymentPage
        onNavigateHome={() => {
          if (isAuthenticated) {
            navigateToTab('dashboard');
          } else {
            setAuthView('login');
            setCurrentTab('dashboard');
            window.history.pushState({}, '', '/auth/login');
          }
        }}
      />
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    if (authView === 'register') {
      return (
        <RegisterPage
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateToLogin={() => {
            setAuthView('login');
            window.history.pushState({}, '', '/auth/login');
          }}
        />
      );
    }

    if (authView === 'forgot-password') {
      return (
        <ForgotPasswordPage
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigateToLogin={() => {
            setAuthView('login');
            window.history.pushState({}, '', '/auth/login');
          }}
          onNavigateToReset={(token) => {
            setResetToken(token);
            setAuthView('reset-password');
            window.history.pushState({}, '', `/auth/reset-password?token=${encodeURIComponent(token)}`);
          }}
        />
      );
    }

    if (authView === 'reset-password') {
      return (
        <ResetPasswordPage
          token={resetToken}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigateToLogin={() => {
            setAuthView('login');
            window.history.pushState({}, '', '/auth/login');
          }}
          onNavigateToForgotPassword={() => {
            setAuthView('forgot-password');
            window.history.pushState({}, '', '/auth/forgot-password');
          }}
        />
      );
    }

    return (
      <LoginPage
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => {
          setAuthView('register');
          window.history.pushState({}, '', '/auth/register');
        }}
        onNavigateToForgotPassword={() => {
          setAuthView('forgot-password');
          window.history.pushState({}, '', '/auth/forgot-password');
        }}
      />
    );
  }

  // Authenticated Main Application Flow
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors relative">
      {/* Realtime Live Incoming Notification Toast */}
      <RealtimeToast
        notification={activeToast}
        onClose={() => setActiveToast(null)}
        onAction={handleToastAction}
      />

      {/* Desktop Right Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={navigateToTab}
        profile={profile}
        pendingRequestsCount={pendingRequestsCount}
        onStartTour={handleStartTour}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Sticky Header with Theme Toggle & Logout */}
        <Header
          profile={profile}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigate={navigateToTab}
          onStartTour={handleStartTour}
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          pendingPaymentsCount={pendingPaymentsCount}
          isRealtimeConnected={isRealtimeConnected}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onClearAllNotifications={handleClearAllNotifications}
          onSelectNotification={handleSelectNotification}
          onLogout={handleLogout}
        />

        {/* Welcome Toast Notification (Compliant with Rule #11 - No Mention of Trial or Free) */}
        {welcomeToast && (
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fade-in no-print">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-teal-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold block">🎉 به سامانه فاکتورچی خوش آمدید!</span>
                <span className="text-[11px] text-teal-800 dark:text-teal-300">
                  برای آشنایی سریع و گام‌به‌گام با بخش‌های صدور فاکتور و پرداخت، تور راهنما را مشاهده کنید.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-auto">
              <button
                type="button"
                onClick={() => {
                  setShowTour(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                شروع تور راهنما
              </button>
              <button
                onClick={() => setWelcomeToast(false)}
                className="p-1 rounded-lg text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Subscription Expired Alert Banner */}
        {profile && !isAdminUser(profile) && profile.subscription_status === 'expired' && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fade-in no-print">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-sm block text-rose-700 dark:text-rose-400">
                  ⚠️ اشتراک شما به پایان رسیده است (حساب قفل است)
                </span>
                <span className="text-[12px] text-rose-800 dark:text-rose-300">
                  برای ادامه صدور فاکتور صوتی، لطفاً فیش واریزی خود را ثبت نمایید تا پس از تایید توسط ادمین، اشتراک ۳۰ روزه شما فعال گردد.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-auto">
              <button
                type="button"
                onClick={() => navigateToTab('billing')}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 hover:scale-105 active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>ارسال فیش و فعال‌سازی ۳۰ روزه</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Routed Views */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              profile={profile}
              invoices={invoices}
              onNavigate={navigateToTab}
              onSelectInvoice={setSelectedInvoice}
              onStartTour={handleStartTour}
            />
          )}

          {currentTab === 'new-invoice' && (
            <VoiceInvoiceCreator
              profile={profile}
              onSaveInvoice={handleSaveInvoice}
              onNavigateToInvoice={(invId) => {
                const found = invoices.find((i) => i.id === invId);
                if (found) setSelectedInvoice(found);
              }}
              onNavigateToBilling={() => navigateToTab('billing')}
            />
          )}

          {currentTab === 'invoices' && (
            <InvoiceList
              invoices={invoices}
              onSelectInvoice={setSelectedInvoice}
              onNewInvoice={() => navigateToTab('new-invoice')}
              onUpdateStatus={handleUpdateStatus}
              onDeleteInvoice={handleDeleteInvoice}
              onOpenVerification={(inv) => setVerifyingInvoice(inv)}
            />
          )}

          {currentTab === 'billing' && (
            <BillingPage
              profile={profile}
              requests={subscriptionRequests}
              onSubmitPayment={handleSubmitPayment}
            />
          )}

          {/* Protected Admin Route */}
          {currentTab === 'admin' && (
            isAdminUser(profile) ? (
              <AdminPayments
                profile={profile}
                requests={subscriptionRequests}
                onVerifyPayment={handleVerifyPayment}
                onRejectPayment={handleRejectPayment}
                onProfileUpdate={(updatedProfile) => {
                  setProfile(updatedProfile);
                  safeStorage.setItem('factorchi_user', JSON.stringify(updatedProfile));
                }}
              />
            ) : (
              <ForbiddenPage onNavigate={navigateToTab} profile={profile} />
            )
          )}

          {/* 403 Forbidden Access Page */}
          {currentTab === '403' && (
            <ForbiddenPage onNavigate={navigateToTab} profile={profile} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              profile={profile}
              darkMode={darkMode}
              onToggleDarkMode={toggleDarkMode}
              onUpdateProfile={handleUpdateProfile}
              onStartTour={handleStartTour}
              onNavigate={navigateToTab}
            />
          )}
        </main>

        {/* Mandatory Global Footer: this website powered by KIARASH */}
        <GlobalFooter />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentTab={currentTab}
        onNavigate={navigateToTab}
        profile={profile}
        pendingRequestsCount={pendingRequestsCount}
      />

      {/* Full Invoice Detail & Print Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        profile={profile}
        onClose={() => setSelectedInvoice(null)}
        onUpdateStatus={handleUpdateStatus}
        onOpenVerification={(inv) => setVerifyingInvoice(inv)}
        onDeleteInvoice={handleDeleteInvoice}
      />

      {/* Seller Payment Verification Modal */}
      <PaymentVerificationModal
        invoice={verifyingInvoice}
        isOpen={!!verifyingInvoice}
        onClose={() => setVerifyingInvoice(null)}
        onVerify={handleVerifyInvoicePayment}
      />

      {/* Interactive Onboarding Tour for New Users */}
      <OnboardingTour
        isOpen={showTour}
        onClose={async () => {
          setShowTour(false);
          try {
            localStorage.removeItem('factorchi_is_new_user');
            if (profile?.id) {
              localStorage.setItem(`factorchi_tour_completed_${profile.id}`, 'true');
              // Persist to database so user never sees tour again across any device
              await fetch('/api/auth/tour-completed', {
                method: 'POST',
                headers: { 'x-user-id': profile.id },
              }).catch(() => {});
              setProfile((prev) => prev ? { ...prev, tour_completed: true } : prev);
            }
          } catch (e) {
            console.error('Error saving tour completion:', e);
          }
        }}
        currentTab={currentTab}
        onNavigate={navigateToTab}
        profile={profile}
      />
    </div>
  );
}
