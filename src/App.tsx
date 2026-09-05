import React, { useState, useEffect } from 'react';
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
import { Invoice, Profile, SubscriptionRequest, NavigationTab, RealtimeNotification } from './types';
import { realtime } from './lib/realtime';
import { sound } from './lib/sound';
import { Sparkles, X } from 'lucide-react';

type AuthView = 'login' | 'register' | 'forgot-password' | null;

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
      const savedUser = localStorage.getItem('factorchi_user') || sessionStorage.getItem('factorchi_user');
      if (savedUser) return JSON.parse(savedUser);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem('factorchi_auth') || sessionStorage.getItem('factorchi_auth');
    const savedUser = localStorage.getItem('factorchi_user') || sessionStorage.getItem('factorchi_user');
    return savedAuth === 'true' && !!savedUser;
  });

  const [authView, setAuthView] = useState<AuthView>(() => {
    const savedAuth = localStorage.getItem('factorchi_auth') || sessionStorage.getItem('factorchi_auth');
    const savedUser = localStorage.getItem('factorchi_user') || sessionStorage.getItem('factorchi_user');
    return savedAuth === 'true' && !!savedUser ? null : 'login';
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

  // Welcome Notification Toast
  const [welcomeToast, setWelcomeToast] = useState(true);

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
        // Ensure event belongs to this user
        if (payload.invoice?.user_id && profile?.id && payload.invoice.user_id !== profile.id) {
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
          // Strictly verify owner
          if (profile?.id && payload.invoice.user_id && payload.invoice.user_id !== profile.id) {
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
          // Strictly verify owner
          if (profile?.id && payload.invoice.user_id && payload.invoice.user_id !== profile.id) {
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
        if (payload.user_id && profile?.id && payload.user_id !== profile.id) {
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
          localStorage.setItem('factorchi_user', JSON.stringify(payload.profile));
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
      if (path === '/auth/register') {
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
      if (!activeProfile || activeProfile.role !== 'admin' || activeProfile.subscription_status !== 'active') {
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
      if (!profile || profile.role !== 'admin' || profile.subscription_status !== 'active') {
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

      // Invoices for this specific user
      const invRes = await fetch('/api/invoices', { headers });
      if (invRes.ok) {
        const json = await invRes.json();
        if (json.invoices) setInvoices(json.invoices);
      }

      // Check Session & Profile
      const profRes = await fetch('/api/auth/session', { headers });
      if (profRes.ok) {
        const json = await profRes.json();
        if (json.profile) {
          setProfile(json.profile);
          localStorage.setItem('factorchi_user', JSON.stringify(json.profile));
        }
      }

      // Admin requests (if admin with active subscription)
      if (activeUser.role === 'admin' && activeUser.subscription_status === 'active') {
        const reqRes = await fetch('/api/admin/subscription-requests', { headers });
        if (reqRes.ok) {
          const json = await reqRes.json();
          if (json.requests) setSubscriptionRequests(json.requests);
        }
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && profile) {
      loadData(profile);
    }
  }, [isAuthenticated, profile?.id]);

  // Auth Handlers
  const handleLoginSuccess = (userProfile: Profile, remember: boolean = true) => {
    setProfile(userProfile);
    setIsAuthenticated(true);
    setAuthView(null);
    
    // Persist session to localStorage (and also sessionStorage for resilience against refresh)
    localStorage.setItem('factorchi_auth', 'true');
    localStorage.setItem('factorchi_user', JSON.stringify(userProfile));
    sessionStorage.setItem('factorchi_auth', 'true');
    sessionStorage.setItem('factorchi_user', JSON.stringify(userProfile));

    // Handle post-login redirect query parameter
    const params = new URLSearchParams(window.location.search);
    const redirectTarget = params.get('redirect');

    if (redirectTarget && redirectTarget.startsWith('/admin')) {
      if (userProfile.role === 'admin' && userProfile.subscription_status === 'active') {
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
    localStorage.setItem('factorchi_auth', 'true');
    localStorage.setItem('factorchi_user', JSON.stringify(userProfile));
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
    localStorage.removeItem('factorchi_auth');
    localStorage.removeItem('factorchi_user');
    sessionStorage.removeItem('factorchi_auth');
    sessionStorage.removeItem('factorchi_user');
    window.history.pushState({}, '', '/auth/login');
  };

  // Save new invoice
  const handleSaveInvoice = async (invData: Partial<Invoice>): Promise<Invoice> => {
    if (!profile) throw new Error('لطفاً ابتدا وارد شوید');

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
        setInvoices((prev) => [json.invoice, ...prev]);
        realtime.publishLocal('invoice:created', { invoice: json.invoice });
        return json.invoice;
      }
    }
    throw new Error('خطا در ذخیره فاکتور');
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
    // 1. Optimistic removal from client state
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
      }

      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Server delete response not ok:', errJson);
      }
      return true;
    } catch (e) {
      console.error('Network or server error during invoice delete:', e);
      return true;
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
    if (!profile || profile.role !== 'admin') return false;

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
    if (!profile || profile.role !== 'admin') return false;

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
        localStorage.setItem('factorchi_user', JSON.stringify(json.profile));
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Sticky Header with Theme Toggle & Logout */}
        <Header
          profile={profile}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigate={navigateToTab}
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
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs flex items-center justify-between shadow-xs animate-fade-in no-print">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-teal-600 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold block">🎉 به سامانه فاکتورچی خوش آمدید!</span>
                <span className="text-[11px] text-teal-800 dark:text-teal-300">
                  حساب کاربری شما فعال است. می‌توانید با صدای فارسی فاکتورهای رسمی صادر نمایید.
                </span>
              </div>
            </div>
            <button
              onClick={() => setWelcomeToast(false)}
              className="p-1 rounded-lg text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Routed Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              profile={profile}
              invoices={invoices}
              onNavigate={navigateToTab}
              onSelectInvoice={setSelectedInvoice}
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

          {/* Protected Admin Route with Role and Active Subscription Check */}
          {currentTab === 'admin' && (
            profile.role === 'admin' && profile.subscription_status === 'active' ? (
              <AdminPayments
                requests={subscriptionRequests}
                onVerifyPayment={handleVerifyPayment}
                onRejectPayment={handleRejectPayment}
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
    </div>
  );
}
