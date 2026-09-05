import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc,
  setLogLevel,
  Firestore 
} from 'firebase/firestore';

dotenv.config();

// Suppress idle stream timeout warnings from Firestore gRPC connection
setLogLevel('silent');

// Read Firebase Configuration
let firebaseConfig: any = null;
try {
  const fbConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(fbConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf-8'));
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json:', err);
}

// Initialize Firestore
let firestoreDb: Firestore | null = null;
if (firebaseConfig) {
  try {
    const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || undefined);
    console.log('✅ Firebase Firestore connected successfully (dbId:', firebaseConfig.firestoreDatabaseId, ')');
  } catch (e) {
    console.error('Firebase initialization error in server:', e);
  }
}

const app = express();
const PORT = 3000;

// Multer storage in memory or temp dir
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  storage: multer.memoryStorage(),
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initial mock database store with persistence
interface Profile {
  id: string;
  full_name: string;
  business_name: string;
  phone: string;
  email?: string;
  subscription_status: 'active' | 'expired' | 'trial';
  trial_started_at?: string;
  trial_ends_at?: string;
  subscription_expires_at: string | null;
  role: 'user' | 'admin';
  card_number?: string;
  card_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  sheba_number?: string;
  default_notes?: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  items: InvoiceItem[];
  discount: number;
  discount_type?: 'amount' | 'percent';
  discount_percent?: number;
  tax_rate: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_status?: 'unpaid' | 'pending_verification' | 'paid' | 'failed';
  payment_tracking_number?: string;
  payment_receipt_url?: string;
  receipt_image_url?: string;
  payment_date?: string;
  payment_amount?: number;
  payment_method?: string;
  payer_name?: string;
  payer_card?: string;
  verification_notes?: string;
  payment_url: string;
  sent_via_whatsapp: boolean;
  voice_input_used: boolean;
  voice_input_method?: 'record' | 'upload';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface SubscriptionRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  receipt_image_url?: string;
  transaction_reference: string;
  user_note?: string;
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  admin_note?: string;
}

interface DailyProfitLoss {
  id: string;
  user_id: string;
  date: string;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  invoice_count: number;
}

interface UserAccount {
  id: string;
  email: string;
  password: string;
  profile: Profile;
}

interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: 'emerald' | 'indigo' | 'amber' | 'teal' | 'rose';
  icon: 'mic' | 'ai' | 'shield' | 'chart' | 'zap';
  date: string;
  actionText?: string;
  actionTab?: string;
  created_at?: string;
  ai_generated?: boolean;
}

const INITIAL_FEATURE_UPDATES: FeatureUpdate[] = [
  {
    id: 'gemini-voice-v2',
    title: 'صدور فوق‌دقیق فاکتور با صوت (هوش مصنوعی Gemini)',
    description: 'پردازش مستقیم ویس‌های ضبط‌شده با هوش مصنوعی جمنای؛ تفکیک خودکار اقلام، مقادیر، درصد تخفیف و نام مشتری با دقت بالا.',
    badge: 'جدید',
    badgeColor: 'teal',
    icon: 'mic',
    date: 'شهریور ۱۴۰۵',
    actionText: 'امتحان صدور صوتی',
    actionTab: 'new-invoice',
    created_at: new Date().toISOString(),
    ai_generated: true,
  },
  {
    id: 'instant-payment-verify',
    title: 'تأیید سریع فیش و تسویه لحظه‌ای فاکتورها',
    description: 'مشاهده آنلاین تصویر فیش پرداختی مشتریان و تأیید یا رد با یک کلیک، همگام با به‌روزرسانی آنی دریافتی‌های امروز در داشبورد.',
    badge: 'ارتقا',
    badgeColor: 'emerald',
    icon: 'shield',
    date: 'شهریور ۱۴۰۵',
    actionText: 'مدیریت فاکتورها',
    actionTab: 'invoices',
    created_at: new Date().toISOString(),
    ai_generated: true,
  },
  {
    id: 'pnl-analytics',
    title: 'داشبورد پیشرفته سود و زیان و تحلیل مالی',
    description: 'محاسبه دقیق حاشیه سود خالص، تفکیک هزینه‌های جاری و مقایسه هوشمند عملکرد فروش ماهانه نسبت به ماه قبل.',
    badge: 'امکانات مالی',
    badgeColor: 'indigo',
    icon: 'chart',
    date: 'شهریور ۱۴۰۵',
    created_at: new Date().toISOString(),
    ai_generated: true,
  },
];

// In-memory Database state with Disk & Firestore Persistence
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'factorchi_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Error creating data directory:', e);
  }
}

// Clean Initial Data Store - No fake seed invoices
const DEFAULT_ADMIN: UserAccount = {
  id: 'usr-admin',
  email: 'bagherikiarash74@gmail.com',
  password: 'admin1234',
  profile: {
    id: 'usr-admin',
    full_name: 'کیارش باقری',
    business_name: 'استودیو طراحی و توسعه کیارش',
    phone: '09130481639',
    email: 'bagherikiarash74@gmail.com',
    subscription_status: 'active',
    subscription_expires_at: null, // Unlimited perpetual access for admin
    role: 'admin',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    card_number: '6219861406993534',
    card_holder_name: 'کیارش باقری',
    bank_name: 'سامان',
  },
};

function loadDBFromDisk(): { users: UserAccount[]; invoices: Invoice[]; subscription_requests: SubscriptionRequest[]; feature_updates: FeatureUpdate[] } {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        // Guarantee admin user exists with active subscription
        const adminIndex = parsed.users.findIndex((u: UserAccount) => u.email.toLowerCase() === 'bagherikiarash74@gmail.com');
        if (adminIndex === -1) {
          parsed.users.unshift(DEFAULT_ADMIN);
        } else {
          parsed.users[adminIndex].profile.role = 'admin';
          parsed.users[adminIndex].profile.subscription_status = 'active';
        }

        // Filter out any leftover unwanted seed invoices
        let loadedInvoices: Invoice[] = (Array.isArray(parsed.invoices) ? parsed.invoices : [])
          .filter((inv: any) => !inv.id?.startsWith('inv-seed-'))
          .map((inv: any) => ({
            ...inv,
            payment_status: inv.payment_status || (inv.status === 'paid' ? 'paid' : 'unpaid'),
            payment_url: (inv.payment_url && inv.payment_url.includes('factorchi.ir')) ? `/payment/${inv.id}` : (inv.payment_url || `/payment/${inv.id}`),
          }));

        return {
          users: parsed.users,
          invoices: loadedInvoices,
          subscription_requests: Array.isArray(parsed.subscription_requests) ? parsed.subscription_requests : [],
          feature_updates: Array.isArray(parsed.feature_updates) && parsed.feature_updates.length > 0 ? parsed.feature_updates : [...INITIAL_FEATURE_UPDATES],
        };
      }
    }
  } catch (e) {
    console.error('Error loading DB from disk:', e);
  }

  return {
    users: [DEFAULT_ADMIN],
    invoices: [],
    subscription_requests: [],
    feature_updates: [...INITIAL_FEATURE_UPDATES],
  };
}

const DB = loadDBFromDisk();

function saveDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write DB to disk:', err);
  }
}
// Save initial state
saveDB();

// ----------------------------------------------------
// Cloud Firestore Real-Time Sync Helpers
// ----------------------------------------------------
async function syncUserToFirestore(user: UserAccount) {
  if (!firestoreDb) return;
  try {
    const userRef = doc(firestoreDb, 'users', user.id);
    await setDoc(userRef, {
      id: user.id,
      email: user.email,
      password: user.password,
      profile: user.profile,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    const profileRef = doc(firestoreDb, 'profiles', user.id);
    await setDoc(profileRef, user.profile, { merge: true });
  } catch (err) {
    console.error('Error syncing user to Firestore:', err);
  }
}

async function syncInvoiceToFirestore(invoice: Invoice) {
  if (!firestoreDb) return;
  try {
    const invRef = doc(firestoreDb, 'invoices', invoice.id);
    await setDoc(invRef, invoice, { merge: true });
  } catch (err) {
    console.error('Error syncing invoice to Firestore:', err);
  }
}

async function deleteInvoiceFromFirestore(invoiceId: string) {
  if (!firestoreDb) return;
  try {
    const invRef = doc(firestoreDb, 'invoices', invoiceId);
    await deleteDoc(invRef);
  } catch (err) {
    console.error('Error deleting invoice from Firestore:', err);
  }
}

async function syncSubscriptionRequestToFirestore(subReq: SubscriptionRequest) {
  if (!firestoreDb) return;
  try {
    const subRef = doc(firestoreDb, 'subscription_requests', subReq.id);
    await setDoc(subRef, subReq, { merge: true });
  } catch (err) {
    console.error('Error syncing subscription request to Firestore:', err);
  }
}

async function syncFeatureUpdateToFirestore(update: FeatureUpdate) {
  if (!firestoreDb) return;
  try {
    const featRef = doc(firestoreDb, 'feature_updates', update.id);
    await setDoc(featRef, update, { merge: true });
  } catch (err) {
    console.error('Error syncing feature update to Firestore:', err);
  }
}

async function deleteFeatureUpdateFromFirestore(updateId: string) {
  if (!firestoreDb) return;
  try {
    const featRef = doc(firestoreDb, 'feature_updates', updateId);
    await deleteDoc(featRef);
  } catch (err) {
    console.error('Error deleting feature update from Firestore:', err);
  }
}

async function loadDBFromFirestore() {
  if (!firestoreDb) return;
  try {
    console.log('🔄 Syncing persistent database from Cloud Firestore...');

    // 1. Fetch Users
    const usersSnapshot = await getDocs(collection(firestoreDb, 'users'));
    const firestoreUsers: UserAccount[] = [];
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data() as UserAccount;
      if (data && data.id && data.email) {
        firestoreUsers.push(data);
      }
    });

    // 2. Fetch Invoices
    const invoicesSnapshot = await getDocs(collection(firestoreDb, 'invoices'));
    const firestoreInvoices: Invoice[] = [];
    invoicesSnapshot.forEach(docSnap => {
      const data = docSnap.data() as Invoice;
      if (data && data.id && !data.id.startsWith('inv-seed-')) {
        firestoreInvoices.push(data);
      }
    });

    // 3. Fetch Subscription Requests
    const subSnapshot = await getDocs(collection(firestoreDb, 'subscription_requests'));
    const firestoreSubRequests: SubscriptionRequest[] = [];
    subSnapshot.forEach(docSnap => {
      const data = docSnap.data() as SubscriptionRequest;
      if (data && data.id) {
        firestoreSubRequests.push(data);
      }
    });

    // 4. Fetch Feature Updates
    const featSnapshot = await getDocs(collection(firestoreDb, 'feature_updates'));
    const firestoreFeatures: FeatureUpdate[] = [];
    featSnapshot.forEach(docSnap => {
      const data = docSnap.data() as FeatureUpdate;
      if (data && data.id) {
        firestoreFeatures.push(data);
      }
    });

    // Merge Users
    if (firestoreUsers.length > 0) {
      firestoreUsers.forEach(fUser => {
        const idx = DB.users.findIndex(u => u.id === fUser.id || u.email.toLowerCase() === fUser.email.toLowerCase());
        if (idx >= 0) {
          DB.users[idx] = fUser;
        } else {
          DB.users.push(fUser);
        }
      });
    }

    // Merge Invoices
    if (firestoreInvoices.length > 0) {
      const invMap = new Map<string, Invoice>();
      firestoreInvoices.forEach(inv => invMap.set(inv.id, inv));
      DB.invoices.forEach(inv => {
        if (!invMap.has(inv.id) && !inv.id.startsWith('inv-seed-')) {
          invMap.set(inv.id, inv);
          syncInvoiceToFirestore(inv);
        }
      });
      DB.invoices = Array.from(invMap.values());
    }

    // Merge Subscription Requests
    if (firestoreSubRequests.length > 0) {
      const subMap = new Map<string, SubscriptionRequest>();
      firestoreSubRequests.forEach(sub => subMap.set(sub.id, sub));
      DB.subscription_requests.forEach(sub => {
        if (!subMap.has(sub.id)) {
          subMap.set(sub.id, sub);
          syncSubscriptionRequestToFirestore(sub);
        }
      });
      DB.subscription_requests = Array.from(subMap.values());
    }

    // Merge Feature Updates
    if (firestoreFeatures.length > 0) {
      const featMap = new Map<string, FeatureUpdate>();
      firestoreFeatures.forEach(feat => featMap.set(feat.id, feat));
      DB.feature_updates.forEach(feat => {
        if (!featMap.has(feat.id)) {
          featMap.set(feat.id, feat);
          syncFeatureUpdateToFirestore(feat);
        }
      });
      DB.feature_updates = Array.from(featMap.values());
    } else {
      // Sync initial feature updates to Firestore if empty
      DB.feature_updates.forEach(feat => {
        syncFeatureUpdateToFirestore(feat);
      });
    }

    // Ensure Admin always active in Cloud Firestore
    const adminUser = DB.users.find(u => u.email.toLowerCase() === 'bagherikiarash74@gmail.com') || DEFAULT_ADMIN;
    adminUser.profile.role = 'admin';
    adminUser.profile.subscription_status = 'active';
    await syncUserToFirestore(adminUser);

    saveDB();
    console.log(`✅ Loaded from Cloud Firestore: ${DB.users.length} users, ${DB.invoices.length} invoices, ${DB.subscription_requests.length} requests, ${DB.feature_updates.length} feature updates`);
  } catch (err) {
    console.error('Error syncing from Cloud Firestore:', err);
  }
}

// Initial Sync from Cloud Firestore on start
loadDBFromFirestore();

// Helper: Extract authenticated user from request headers or authorization token
function getAuthUser(req: express.Request): UserAccount | null {
  const userIdHeader = (req.headers['x-user-id'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  
  let targetId = userIdHeader;
  if (!targetId && authHeader.startsWith('Bearer ')) {
    targetId = authHeader.substring(7).trim();
  }

  if (targetId) {
    const found = DB.users.find(u => u.id === targetId || u.email.toLowerCase() === targetId.toLowerCase());
    if (found) return found;

    // Session Recovery: If client holds a valid user ID token from previous session
    if (targetId.startsWith('usr-')) {
      const recoveredUser: UserAccount = {
        id: targetId,
        email: `${targetId}@factorchi.ir`,
        password: '',
        profile: {
          id: targetId,
          full_name: 'کاربر سیستم',
          business_name: 'کسب‌وکار من',
          phone: '',
          subscription_status: 'trial',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
      DB.users.push(recoveredUser);
      saveDB();
      return recoveredUser;
    }
  }

  return null;
}

// Security Middleware: Require Authenticated Admin with Active Subscription
function requireActiveAdmin(req: express.Request, res: express.Response): UserAccount | null {
  const authUser = getAuthUser(req);
  if (!authUser) {
    res.status(401).json({
      success: false,
      error: 'برای دسترسی به پنل مدیریت، ابتدا وارد حساب کاربری خود شوید.',
      code: 'UNAUTHENTICATED',
    });
    return null;
  }

  if (authUser.profile.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'دسترسی ممنوع: شما دسترسی مدیر سیستم (Admin) ندارید.',
      code: 'FORBIDDEN_NOT_ADMIN',
    });
    return null;
  }

  if (authUser.profile.subscription_status !== 'active') {
    res.status(403).json({
      success: false,
      error: 'دسترسی ممنوع: اشتراک حساب مدیریت شما فعال نیست.',
      code: 'FORBIDDEN_SUBSCRIPTION_EXPIRED',
    });
    return null;
  }

  return authUser;
}

// ----------------------------------------------------
// Realtime SSE Event Bus & Client Hub
// ----------------------------------------------------
interface SSEClient {
  id: string;
  userId: string;
  userEmail: string;
  role: string;
  res: express.Response;
  connectedAt: Date;
}

const sseClients = new Map<string, SSEClient>();
const recentRealtimeEvents: { id: string; type: string; payload: any; targetUserId?: string; targetRole?: string; timestamp: string }[] = [];

export function broadcastRealtimeEvent(
  type: string,
  payload: any,
  target?: { userId?: string; role?: string; excludeClientId?: string }
) {
  const eventId = `ev-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const eventData = {
    id: eventId,
    type,
    payload,
    targetUserId: target?.userId,
    targetRole: target?.role,
    timestamp: new Date().toISOString(),
  };

  // Keep last 100 events for ultra-fast polling fallback
  recentRealtimeEvents.unshift(eventData);
  if (recentRealtimeEvents.length > 100) {
    recentRealtimeEvents.pop();
  }

  const sseMessage = `event: message\ndata: ${JSON.stringify(eventData)}\n\n`;

  let deliveredCount = 0;
  sseClients.forEach((client, clientId) => {
    if (target?.excludeClientId && client.id === target.excludeClientId) return;

    // Target filtering: Strictly isolate private events by user ID
    if (target?.userId) {
      const isDirectUser = 
        client.userId === target.userId || 
        (client.userEmail && target.userId && client.userEmail.toLowerCase() === target.userId.toLowerCase());

      if (!isDirectUser) {
        return;
      }
    }

    if (target?.role && client.role !== target.role) {
      return;
    }

    try {
      client.res.write(sseMessage);
      deliveredCount++;
    } catch {
      sseClients.delete(clientId);
    }
  });

  console.log(`📡 Broadcast realtime event [${type}] (id: ${eventId}) to ${deliveredCount} active client(s)`);
}

// SSE Stream Endpoint
app.get('/api/realtime/stream', (req, res) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';

  // Find user and role
  const user = DB.users.find(u => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  const role = user?.profile?.role || (userId === 'usr-admin' ? 'admin' : 'user');
  const userEmail = user?.email || (userId.includes('@') ? userId : '');

  // Set SSE Headers with no-buffering directives
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform, no-store',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  if (req.socket) {
    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);
    req.socket.setTimeout(0);
  }

  const client: SSEClient = {
    id: clientId,
    userId: userId || 'anonymous',
    userEmail,
    role,
    res,
    connectedAt: new Date(),
  };

  sseClients.set(clientId, client);

  // Send immediate welcome handshake & padding to bypass any proxy buffer
  res.write(`: init-stream-flush-${' '.repeat(256)}\n\n`);
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Periodic heartbeat keepalive (every 10s)
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
    } catch {
      clearInterval(keepAliveInterval);
      sseClients.delete(clientId);
    }
  }, 10000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(clientId);
  });
});

// Polling fallback endpoint
app.get('/api/realtime/poll', (req, res) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const since = req.query.since as string;
  const sinceTime = since ? new Date(since).getTime() : Date.now() - 30000;

  const user = DB.users.find(u => u.id === userId || u.email.toLowerCase() === userId.toLowerCase());
  const role = user?.profile?.role || (userId === 'usr-admin' ? 'admin' : 'user');
  const userEmail = user?.email || (userId.includes('@') ? userId : '');

  const matchedEvents = recentRealtimeEvents.filter(ev => {
    const evTime = new Date(ev.timestamp).getTime();
    if (evTime <= sinceTime) return false;

    if (ev.targetUserId) {
      const isDirectUser = 
        ev.targetUserId === userId || 
        (userEmail && ev.targetUserId.toLowerCase() === userEmail.toLowerCase());
      if (!isDirectUser) return false;
    }

    if (ev.targetRole && ev.targetRole !== role) {
      return false;
    }

    return true;
  });

  return res.json({
    success: true,
    timestamp: new Date().toISOString(),
    events: matchedEvents,
  });
});

// ----------------------------------------------------
// API: Authentication
// ----------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const rawInput = (req.body.email || req.body.username || '').trim();
  const email = rawInput.toLowerCase();
  const normalizedInput = persianToEnglishDigits(rawInput);
  const password = req.body.password || '';
  
  if (!rawInput || !password) {
    return res.status(400).json({ success: false, error: 'لطفاً ایمیل یا شماره موبایل و رمز عبور را وارد نمایید.' });
  }

  // Search by exact email, phone, normalized phone, or ID
  const user = DB.users.find(u => 
    u.email.toLowerCase() === email || 
    (u.profile.phone && (u.profile.phone === rawInput || u.profile.phone === normalizedInput || persianToEnglishDigits(u.profile.phone) === normalizedInput)) ||
    u.id === rawInput
  );

  // Check 1: User does not exist -> Return clear "Account not found" error
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'حساب کاربری با این ایمیل یا شماره یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
      code: 'USER_NOT_FOUND',
    });
  }

  // Check 2: Password mismatch
  if (user.password !== password) {
    return res.status(401).json({
      success: false,
      error: 'ایمیل یا رمز عبور اشتباه است.',
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Success: Return isolated profile and session token
  return res.json({
    success: true,
    message: 'ورود به حساب کاربری با موفقیت انجام شد',
    token: user.id,
    profile: user.profile,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { full_name, business_name, email, phone, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!full_name || !cleanEmail || !password) {
    return res.status(400).json({ success: false, error: 'تمامی فیلدهای ضروری (نام، ایمیل، کلمه عبور) الزامی است.' });
  }

  const existing = DB.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'حساب کاربری با این ایمیل از قبل وجود دارد. لطفاً وارد شوید.',
      code: 'USER_ALREADY_EXISTS',
    });
  }

  const newId = `usr-${Date.now()}`;
  const now = new Date();
  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day trial

  const newUser: UserAccount = {
    id: newId,
    email: cleanEmail,
    password: String(password),
    profile: {
      id: newId,
      full_name: full_name.trim(),
      business_name: business_name ? business_name.trim() : 'کسب‌وکار من',
      phone: phone ? phone.trim() : '',
      email: cleanEmail,
      subscription_status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      subscription_expires_at: trialEnds.toISOString(),
      role: 'user', // strictly regular user for new signups
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  };

  DB.users.push(newUser);
  saveDB();
  syncUserToFirestore(newUser);

  return res.json({
    success: true,
    message: 'ثبت‌نام با موفقیت انجام شد و پروفایل کاربری ایجاد گردید',
    token: newId,
    profile: newUser.profile,
  });
});

app.get('/api/auth/session', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      success: false,
      error: 'نشست کاربری یافت نشد یا منقضی شده است.',
    });
  }
  return res.json({
    success: true,
    profile: authUser.profile,
  });
});

app.post('/api/auth/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'خروج از حساب با موفقیت انجام شد',
  });
});

// Helper to get Gemini Client lazily
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// ----------------------------------------------------
// Helper Functions for Persian NLP & Voice Invoice Extraction
// ----------------------------------------------------
function persianToEnglishDigits(str: string): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let res = String(str);
  for (let i = 0; i < 10; i++) {
    res = res.replace(new RegExp(persianDigits[i], 'g'), String(i));
    res = res.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return res;
}

const persianWordMap: Record<string, number> = {
  'صفر': 0, 'یک': 1, 'یه': 1, 'یکعدد': 1, 'یکتا': 1, 'دو': 2, 'دوعدد': 2, 'دوتا': 2,
  'سه': 3, 'سهعدد': 3, 'سهتا': 3, 'چهار': 4, 'چهارعدد': 4, 'چهارتا': 4,
  'پنج': 5, 'پنجعدد': 5, 'پنجتا': 5, 'شش': 6, 'شیش': 6, 'ششعدد': 6, 'شیشعدد': 6, 'ششتا': 6, 'شیشتا': 6,
  'هفت': 7, 'هفتعدد': 7, 'هفتتا': 7, 'هشت': 8, 'هشتعدد': 8, 'هشتتا': 8,
  'نه': 9, 'نهعدد': 9, 'نهتا': 9, 'ده': 10, 'دهعدد': 10, 'دهتا': 10,
  'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15,
  'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19, 'بیست': 20,
  'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
  'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'پونصد': 500,
  'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900,
  'نیم': 0.5,
};

function parsePersianWordNumber(str: string): number {
  if (!str) return 0;
  const clean = persianToEnglishDigits(str).trim();
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }

  // Check direct lookup first
  if (persianWordMap[clean] !== undefined) {
    return persianWordMap[clean];
  }

  let total = 0;
  const tokens = clean.split(/[و\s+]+/).filter(Boolean);
  for (const token of tokens) {
    if (persianWordMap[token] !== undefined) {
      total += persianWordMap[token];
    } else {
      const num = parseFloat(token);
      if (!isNaN(num)) total += num;
    }
  }
  return total;
}

function parsePersianPrice(priceStr: string): number {
  if (!priceStr) return 0;
  let text = persianToEnglishDigits(priceStr.trim());
  text = text.replace(/تومان|تومن|ریال|هزینه|مبلغ|قیمت|ارزش/g, '').trim();

  if (/^\d+$/.test(text)) {
    return parseInt(text, 10);
  }

  let total = 0;

  // Handle "X و نیم میلیون"
  if (text.includes('و نیم میلیون') || text.includes('ونیم میلیون')) {
    const mainNum = parsePersianWordNumber(text.split(/و\s*نیم\s*میلیون/)[0]) || 1;
    return Math.round(mainNum * 1000000 + 500000);
  }

  // Handle Millions
  if (text.includes('میلیون')) {
    const parts = text.split('میلیون');
    const millionPart = parts[0].trim();
    const millionVal = parsePersianWordNumber(millionPart) || parseFloat(millionPart) || 1;
    total += millionVal * 1000000;

    if (parts[1]) {
      let rem = parts[1].replace(/^[و\s]+/, '').trim();
      if (rem.includes('هزار')) {
        const thousandPart = rem.split('هزار')[0].trim();
        const thousandVal = parsePersianWordNumber(thousandPart) || parseFloat(thousandPart) || 1;
        total += thousandVal * 1000;
      } else {
        const directNum = parseFloat(rem);
        if (!isNaN(directNum) && directNum > 0) {
          total += directNum < 1000 ? directNum * 1000 : directNum;
        }
      }
    }
    return Math.round(total);
  }

  // Handle Thousands
  if (text.includes('هزار')) {
    const parts = text.split('هزار');
    const thousandPart = parts[0].trim();
    const thousandVal = parsePersianWordNumber(thousandPart) || parseFloat(thousandPart) || 1;
    total += thousandVal * 1000;
    return Math.round(total);
  }

  const num = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Normalizes and parses Persian speech text into customer, items, and financial values.
 * Handles multiple items linked with "به همراه", "و همچنین", "بعلاوه", "و", etc.
 * Properly distinguishes between percentage discounts ("5 درصد تخفیف") and Toman discounts ("5000 تومن تخفیف").
 */
function parsePersianTextToInvoice(rawText: string) {
  if (!rawText) {
    return {
      customer_name: '',
      customer_phone: '',
      items: [],
      discount: 0,
      discount_type: 'amount' as 'amount' | 'percent',
      discount_percent: 0,
      tax_rate: 0,
      notes: '',
      confidence: 85,
    };
  }

  let processed = rawText;

  // Normalize numbers and common phrases
  processed = processed
    .replace(/دو\s*عدد/g, '2 عدد')
    .replace(/دوعدد/g, '2 عدد')
    .replace(/یک\s*عدد/g, '1 عدد')
    .replace(/یکعدد/g, '1 عدد')
    .replace(/سه\s*عدد/g, '3 عدد')
    .replace(/سهعدد/g, '3 عدد')
    .replace(/چهار\s*عدد/g, '4 عدد')
    .replace(/چهارعدد/g, '4 عدد')
    .replace(/پنج\s*عدد/g, '5 عدد')
    .replace(/پنجعدد/g, '5 عدد')
    .replace(/شش\s*عدد/g, '6 عدد')
    .replace(/شیش\s*عدد/g, '6 عدد')
    .replace(/هفت\s*عدد/g, '7 عدد')
    .replace(/هشت\s*عدد/g, '8 عدد')
    .replace(/نه\s*عدد/g, '9 عدد')
    .replace(/ده\s*عدد/g, '10 عدد');

  const normalized = persianToEnglishDigits(processed);
  let customer_name = '';
  let customer_phone = '';
  const items: { name: string; quantity: number; unit_price: number }[] = [];
  let discount = 0;
  let discount_type: 'amount' | 'percent' = 'amount';
  let discount_percent = 0;
  let tax_rate = 0;
  let notes = '';

  // 1. Phone extraction (09xxxxxxxxx or 9xxxxxxxxx)
  const phoneMatch = normalized.match(/(?:09|9)\d{9}/);
  if (phoneMatch) {
    let p = phoneMatch[0];
    if (p.startsWith('9') && p.length === 10) p = '0' + p;
    customer_phone = p;
  }

  // 2. Discount extraction: distinguish between percentage ("5 درصد تخفیف") and Toman amount ("5000 تومن تخفیف")
  // First check percentage discount patterns
  const percentDiscountMatch = normalized.match(/(?:(?:تخفیف\s*(?:به\s*میزان|به\s*اندازه|معادل)?\s*(\d+|[۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی))|(?:(\d+|[۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی)\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف|آف)?))/i);

  if (percentDiscountMatch) {
    const rawP = percentDiscountMatch[1] || percentDiscountMatch[2];
    if (rawP) {
      const val = parsePersianWordNumber(rawP) || parseFloat(persianToEnglishDigits(rawP)) || 0;
      if (val > 0) {
        discount_type = 'percent';
        discount_percent = val;
      }
    }
  } else {
    // Check for fixed amount discount (Tomans / Thousands / Millions)
    const amountDiscountMatch = normalized.match(/(?:تخفیف\s*(?:به\s*مبلغ|به\s*ارزش|مبلغ)?\s*([^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?))|(?:([^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?)\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف))/i);
    if (amountDiscountMatch) {
      const rawDisc = amountDiscountMatch[1] || amountDiscountMatch[2];
      if (rawDisc) {
        discount = parsePersianPrice(rawDisc);
        discount_type = 'amount';
        discount_percent = 0;
      }
    }
  }

  // Tax extraction
  const taxMatch = normalized.match(/(?:(?:مالیات|ارزش\s*افزوده)\s*(\d+|[۰-۹]+)\s*(?:درصد|٪|%))|(?:(\d+|[۰-۹]+)\s*(?:درصد|٪|%)\s*(?:مالیات|ارزش\s*افزوده))/i);
  if (taxMatch) {
    const rawTax = taxMatch[1] || taxMatch[2];
    if (rawTax) {
      tax_rate = parseInt(persianToEnglishDigits(rawTax), 10) || 0;
    }
  }

  // 3. Customer Name extraction
  let textBeforePhone = normalized;
  if (customer_phone) {
    const phoneIdx = normalized.indexOf(customer_phone);
    if (phoneIdx > 0) {
      textBeforePhone = normalized.substring(0, phoneIdx);
    }
  } else if (normalized.includes('تلفن') || normalized.includes('شماره')) {
    const splitPoint = normalized.search(/(?:تلفن|شماره|به شماره|با شماره)/);
    if (splitPoint > 0) {
      textBeforePhone = normalized.substring(0, splitPoint);
    }
  }

  let cleanName = textBeforePhone
    .replace(/^.*?(?:فاکتور\s+برای|فاکتور\s+به\s+نام|فاکتور\s+بهنام|فاکتور|سفارش\s+برای|سفارش\s+به\s+نام|سفارش|به\s+نام|برای)\s+/i, '')
    .replace(/(?:تلفن|شماره|با شماره|به شماره|همراه).*$/i, '')
    .trim();

  if (cleanName.includes('،') || cleanName.includes(',')) {
    cleanName = cleanName.split(/[،,]/)[0].trim();
  }

  // If text contains item count markers
  const itemStartMatch = cleanName.search(/(?:\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\s*(?:عدد|تا|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته|دونه)/i);
  if (itemStartMatch > 0) {
    cleanName = cleanName.substring(0, itemStartMatch).trim();
  }

  if (cleanName) {
    const companyMatch = cleanName.match(/^(.+?)\s+(شرکت\s+.+)$/i);
    if (companyMatch) {
      customer_name = `${companyMatch[1].trim()} (${companyMatch[2].trim()})`;
    } else {
      customer_name = cleanName;
    }
  }

  // 4. Extract Items Segment
  let itemsText = normalized;
  if (customer_phone) {
    const phoneIdx = itemsText.indexOf(customer_phone);
    if (phoneIdx >= 0) {
      itemsText = itemsText.substring(phoneIdx + customer_phone.length);
    }
  } else if (customer_name && itemsText.includes(customer_name)) {
    const nameIdx = itemsText.indexOf(customer_name);
    if (nameIdx >= 0) {
      itemsText = itemsText.substring(nameIdx + customer_name.length);
    }
  } else if (itemsText.includes('سفارش') || itemsText.includes('فاکتور')) {
    itemsText = itemsText.replace(/^.*?(?:سفارش|فاکتور)\s+([^\s]+(?:\s+[^\s]+)?)\s+/i, '');
  }

  // Remove discount & tax phrases from items text
  itemsText = itemsText
    .replace(/(?:تخفیف\s*(?:به\s*میزان|به\s*اندازه|معادل)?\s*)?(\d+|[۰-۹]+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)?\s*(?:درصد|٪|%|درصدی)\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف|آف)?/gi, '')
    .replace(/[^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف)/gi, '')
    .replace(/تخفیف\s*(?:به\s*مبلغ|به\s*ارزش|مبلغ)?\s*[^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?/gi, '')
    .replace(/(\d+|[۰-۹]+)\s*(?:درصد|٪|%)\s*(?:مالیات|ارزش\s*افزوده)?/gi, '')
    .replace(/(?:مالیات|ارزش\s*افزوده)\s*(\d+|[۰-۹]+)\s*(?:درصد|٪|%)/gi, '')
    .replace(/^(?:تلفن|شماره|همراه|،|,|\s)+/i, '');

  // Split multiple items using known Persian conjunctions and delimiters
  const itemSeparators = [
    'به همراه', 'به‌همراه', 'و همچنین', 'وهمچنین', 'اضافه بر این', 'اضافه براین',
    'به علاوه', 'بعلاوه', 'همراه با', 'و نیز', 'به انضمام'
  ];

  let rawSegments = [itemsText];
  for (const sep of itemSeparators) {
    const nextList: string[] = [];
    for (const segment of rawSegments) {
      const parts = segment.split(new RegExp(`(?:\\s+${sep}\\s+|،|\\n)`, 'gi'));
      nextList.push(...parts);
    }
    rawSegments = nextList;
  }

  // Further split on " و " if followed by a quantity like " و یک عدد..." or " و ۲ عدد..."
  const finalSegments: string[] = [];
  for (const seg of rawSegments) {
    const subParts = seg.split(/\s+و\s+(?=(?:\d+|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\s*(?:عدد|تا|دونه|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته)?)/gi);
    finalSegments.push(...subParts);
  }

  for (const chunk of finalSegments) {
    let working = chunk.trim();
    if (!working || working.length < 2) continue;

    // Check if starts with a leading price: e.g. "۲۰۰ هزار تومن ایاب و ذهاب"
    const leadingPriceMatch = working.match(/^((?:\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|نیم)\s*(?:میلیون|هزار|تومان|تومن).*?)\s+(.+)$/i);
    let quantity = 1;
    let unitPrice = 0;
    let itemName = working;

    if (leadingPriceMatch && (leadingPriceMatch[1].includes('هزار') || leadingPriceMatch[1].includes('میلیون') || leadingPriceMatch[1].includes('تومان') || leadingPriceMatch[1].includes('تومن'))) {
      unitPrice = parsePersianPrice(leadingPriceMatch[1]);
      itemName = leadingPriceMatch[2].trim();
    } else {
      // Quantity extraction: e.g., '2 عدد دمبل 20 کیلویی' or 'یک برنامه غذایی'
      const qtyMatch = working.match(/^(\d+|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)\s*(?:عدد|تا|دونه|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته)?\s+(.+)$/i);
      if (qtyMatch) {
        const parsedQty = parsePersianWordNumber(qtyMatch[1]) || parseInt(qtyMatch[1], 10) || 1;
        quantity = parsedQty;
        working = qtyMatch[2].trim();
      }

      // Price separators: e.g., 'دونه ای 12 میلیون' or '500 هزار تومن'
      const priceSeparatorMatch = working.match(/(?:هر\s*کدام|هر\s*یک|هر\s*کدوم|هرکدوم|دانه‌ای|دونه‌ای|دونه\s*ای|دونه|ساعتی|متری|جلسه‌ای|به\s*مبلغ|به\s*ارزش|به\s*قیمت|قیمت|ارزش)\s*(.+)$/i);
      if (priceSeparatorMatch) {
        itemName = working.substring(0, priceSeparatorMatch.index).trim();
        unitPrice = parsePersianPrice(priceSeparatorMatch[1]);
      } else {
        const endPriceMatch = working.match(/(.+?)\s+((?:\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|نیم)\s*(?:میلیون|هزار|تومان|تومن).*)$/i);
        if (endPriceMatch) {
          itemName = endPriceMatch[1].trim();
          unitPrice = parsePersianPrice(endPriceMatch[2]);
        } else {
          itemName = working.replace(/تومان|تومن|ریال/g, '').trim();
        }
      }
    }

    // Clean up item name
    itemName = itemName
      .replace(/^[و\s،,]+/, '')
      .replace(/^(?:تومان|تومن|ریال|هزار|میلیون)\s+/i, '')
      .replace(/\s*(?:هر\s*کدام|هرکدام|هر\s*کدوم|قیمت|به\s*مبلغ|به\s*ارزش|دونه‌ای|دانه‌ای|دونه\s*ای|ساعتی|متری)\s*$/, '')
      .trim();

    if (itemName && itemName.length >= 2) {
      items.push({
        name: itemName,
        quantity: quantity || 1,
        unit_price: unitPrice || 0,
      });
    }
  }

  // If discount was in percentage, compute discount amount in Tomans from subtotal
  const subtotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
  if (discount_type === 'percent' && discount_percent > 0) {
    discount = Math.round(subtotal * (discount_percent / 100));
  }

  return {
    customer_name,
    customer_phone,
    items,
    discount,
    discount_type,
    discount_percent,
    tax_rate,
    notes,
    confidence: items.length > 0 ? 98 : 85,
  };
}

// ----------------------------------------------------
// API: AI Voice-to-Invoice (/api/ai/voice-to-invoice)
// ----------------------------------------------------
app.post('/api/ai/voice-to-invoice', upload.single('audio_file'), async (req, res) => {
  try {
    const startTime = Date.now();
    let textToAnalyze = (req.body.text || '').trim();
    const audioFile = req.file;
    const base64Audio = req.body.audioBase64;
    const mimeType = req.body.mimeType || 'audio/webm';
    let transcriptionResult = textToAnalyze;

    // 1. If text is already provided (e.g. from fast live speech-to-text), process with Gemini text mode first for sub-second speed
    if (textToAnalyze && textToAnalyze.length >= 3) {
      const ai = getGemini();
      if (ai) {
        const textModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const modelName of textModels) {
          try {
            const prompt = `شما دستیار حسابداری و صدور فاکتور فوق‌سریع به زبان فارسی هستید.
متن زیر را بررسی و اطلاعات فاکتور را استخراج کنید:
"${textToAnalyze}"

فیلدها:
- customer_name: نام خریدار/شرکت یا ""
- customer_phone: شماره تماس با ارقام انگلیسی یا ""
- items: آرایه‌ای از { name: نام کالا/خدمت, quantity: تعداد عددی, unit_price: قیمت واحد به تومان }
- discount_type: "percent" یا "amount"
- discount_percent: درصد تخفیف یا 0
- discount: مبلغ تخفیف به تومان یا 0
- tax_rate: درصد مالیات یا 0
- notes: توضیحات یا ""
- confidence: عدد ۹۰ تا ۱۰۰

پاسخ را فقط به صورت JSON معتبر ارسال کنید.`;

            const config: any = {
              responseMimeType: 'application/json',
              temperature: 0.1,
            };
            if (modelName === 'gemini-3.7-flash') {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config,
            });

            if (response && response.text) {
              const parsed = JSON.parse(response.text);
              const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                name: (it.name || '').trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unit_price) || 0),
              })).filter((it: any) => it.name) : [];

              const subtotal = items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
              let discType = parsed.discount_type === 'percent' ? 'percent' : 'amount';
              let discPercent = typeof parsed.discount_percent === 'number' ? parsed.discount_percent : 0;
              let discAmount = typeof parsed.discount === 'number' ? parsed.discount : 0;
              if (discType === 'percent' && discPercent > 0 && (!discAmount || discAmount === discPercent)) {
                discAmount = Math.round(subtotal * (discPercent / 100));
              }

              return res.json({
                success: true,
                data: {
                  transcription: textToAnalyze,
                  customer_name: parsed.customer_name || '',
                  customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                  items: items.length > 0 ? items : [{ name: 'خدمات / کالا', quantity: 1, unit_price: 0 }],
                  discount_type: discType,
                  discount_percent: discPercent,
                  discount: discAmount,
                  tax_rate: typeof parsed.tax_rate === 'number' ? parsed.tax_rate : 0,
                  notes: parsed.notes || '',
                  confidence: parsed.confidence || 98,
                },
                metadata: {
                  model_used: modelName,
                  processing_time_ms: Date.now() - startTime,
                }
              });
            }
          } catch (fastTextErr) {
            console.warn(`Fast text extraction fallback (${modelName}):`, fastTextErr);
          }
        }
      }
    }

    // 2. Direct Gemini Multimodal Audio Processing if audio is provided
    if (audioFile || base64Audio) {
      const buffer = audioFile ? audioFile.buffer : Buffer.from(base64Audio, 'base64');
      if (buffer.length < 300 && !textToAnalyze) {
        return res.status(400).json({
          success: false,
          error: 'فایل صوتی ضبط‌شده بسیار کوتاه یا فاقد صدا است. لطفاً مجدداً دکمه ضبط را فشار دهید و با صدای رسا صحبت کنید.',
        });
      }

      let rawMime = audioFile?.mimetype || mimeType || 'audio/webm';
      let cleanMime = rawMime.split(';')[0].trim().toLowerCase();
      if (!cleanMime.startsWith('audio/')) {
        cleanMime = 'audio/webm';
      }
      if (cleanMime === 'audio/m4a' || cleanMime === 'audio/x-m4a') {
        cleanMime = 'audio/mp4';
      }

      const ai = getGemini();
      if (ai) {
        const audioPrompt = `شما دستیار حسابداری و صدور فاکتور فوق‌سریع و دقیق به زبان فارسی هستید.
وظیفه شما: این صوت فارسی را با دقت گوش دهید، کلمات بیان شده را در transcription بنویسید و فیلدهای فاکتور را استخراج کنید.

فیلدها:
- transcription: متن دقیق و کامل کلمات فارسی گفته‌شده در ویس
- customer_name: نام خریدار یا نام شرکت/فروشگاه یا ""
- customer_phone: شماره تماس با ارقام انگلیسی (مثلا 09121234567) یا ""
- items: آرایه‌ای از اقلام/خدمات شامل:
  { "name": "نام دقیق کالا یا خدمت", "quantity": تعداد عددی, "unit_price": قیمت واحد ۱ قلم به تومان }
- discount_type: در صورت تخفیف درصدی "percent" و در صورت تخفیف تومانی "amount"
- discount_percent: درصد تخفیف یا 0
- discount: مبلغ کل تخفیف به تومان یا 0
- tax_rate: درصد مالیات یا 0
- notes: توضیحات گفته شده یا ""
- confidence: عدد بین ۹۰ تا ۱۰۰

پاسخ را فقط و فقط به صورت شیء معتبر JSON ارسال کنید.`;

        const audioDataPart = {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: cleanMime,
          }
        };

        // Models proven to support audio input
        const audioModelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const modelName of audioModelsToTry) {
          try {
            const config: any = {
              responseMimeType: 'application/json',
              temperature: 0.1,
            };
            if (modelName === 'gemini-3.7-flash') {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }

            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                audioDataPart,
                { text: audioPrompt }
              ],
              config,
            });

            if (response && response.text) {
              const parsed = JSON.parse(response.text);
              const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                name: (it.name || '').trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unit_price) || 0),
              })).filter((it: any) => it.name) : [];

              const extractedTranscription = (parsed.transcription || '').trim();
              if (extractedTranscription) {
                textToAnalyze = extractedTranscription;
                transcriptionResult = extractedTranscription;
              }

              // If items were successfully extracted directly from audio
              if (items.length > 0) {
                const subtotal = items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
                let discType = parsed.discount_type === 'percent' ? 'percent' : 'amount';
                let discPercent = typeof parsed.discount_percent === 'number' ? parsed.discount_percent : 0;
                let discAmount = typeof parsed.discount === 'number' ? parsed.discount : 0;
                if (discType === 'percent' && discPercent > 0 && (!discAmount || discAmount === discPercent)) {
                  discAmount = Math.round(subtotal * (discPercent / 100));
                }

                return res.json({
                  success: true,
                  data: {
                    transcription: extractedTranscription || textToAnalyze || 'صوت با موفقیت تحلیل شد',
                    customer_name: parsed.customer_name || '',
                    customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                    items: items,
                    discount_type: discType,
                    discount_percent: discPercent,
                    discount: discAmount,
                    tax_rate: typeof parsed.tax_rate === 'number' ? parsed.tax_rate : 0,
                    notes: parsed.notes || '',
                    confidence: parsed.confidence || 98,
                  },
                  metadata: {
                    model_used: modelName,
                    processing_time_ms: Date.now() - startTime,
                  }
                });
              }
              
              // If transcription was extracted but items were empty, break out of audio loop and proceed to text analysis
              if (extractedTranscription) {
                break;
              }
            }
          } catch (modelErr) {
            console.warn(`Gemini audio model ${modelName} attempt warning:`, modelErr);
          }
        }
      }

      // AvalAI Whisper transcription fallback if Gemini audio direct call failed
      if (process.env.AVALAI_API_KEY && !textToAnalyze) {
        try {
          const formData = new FormData();
          const blob = new Blob([buffer], { type: cleanMime });
          formData.append('file', blob, 'voice.webm');
          formData.append('model', 'whisper-1');
          formData.append('language', 'fa');

          const whisperResp = await fetch('https://api.avalai.ir/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.AVALAI_API_KEY}`,
            },
            body: formData,
          });

          if (whisperResp.ok) {
            const whisperData = await whisperResp.json();
            textToAnalyze = whisperData.text || '';
            transcriptionResult = textToAnalyze;
          }
        } catch (avalErr) {
          console.warn('AvalAI Whisper transcription fallback:', avalErr);
        }
      }
    }

    // 3. Structured Extraction using Gemini Flash for Text or Transcribed Speech
    if (textToAnalyze) {
      const ai = getGemini();
      if (ai) {
        const textModels = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
        for (const modelName of textModels) {
          try {
            const prompt = `شما یک دستیار حسابداری و صدور فاکتور فوق هوشمند و دقیق به زبان فارسی هستید.
متن گفتار یا ویس فاکتور زیر را با دقت بسیار بالا تحلیل کنید و اطلاعات فاکتور را استخراج کنید:
"${textToAnalyze}"

دستورالعمل‌های استخراج:
۱. customer_name: نام و نام خانوادگی مشتری یا شرکت (مثلاً "آقای محمدی شرکت آریا"، "خانم احمدی"). اگر ذکر نشده باشد، حتماً رشته خالی "" برگردانید.
۲. customer_phone: شماره موبایل مشتری به ارقام انگلیسی (مثلاً "09121234567"). اگر در متن نیست، رشته خالی "" برگردانید.
۳. items: آرایه‌ای از اقلام فاکتور. اگر چند مورد نام برده شد (که با عباراتی مثل "به همراه"، "و همچنین"، "بعلاوه"، "و"، "دونه‌ای" و... جدا شده‌اند)، هر قلم را تفکیک کنید:
   - name: نام تمیز کالا یا خدمت (مثلاً "طرح هویت بصری و لوگو"، "مشاوره برندینگ"، "دمبل ۲۰ کیلویی")
   - quantity: تعداد به صورت عدد صحیح انگلیسی (مثلاً 'دو عدد' -> 2، 'یک عدد' -> 1، 'سه تا' -> 3، '۱۰ عدد' -> 10)
   - unit_price: قیمت واحد به تومان به صورت عدد صحیح بدون ممیز (مثلاً '۲ میلیون' -> 2000000، '۱.۵ میلیون' یا 'یک و نیم میلیون' -> 1500000، '۵۰۰ هزار تومن' -> 500000، '۵۰۰۰ تومن' -> 5000)
۴. discount_type: اگر تخفیف درصدی بود ("۵ درصد تخفیف"، "۱۰٪ تخفیف") مقدار "percent" و اگر تخفیف تومانی بود ("۵۰۰ هزار تومن تخفیف"، "۵۰۰۰ تومن تخفیف") مقدار "amount".
۵. discount_percent: عدد درصد تخفیف (مثلاً 5 یا 10)، در غیر این صورت 0.
۶. discount: مبلغ کل تخفیف به تومان. اگر درصدی بود، فرمول (subtotal * discount_percent / 100) را محاسبه کنید؛ اگر تومانی بود، همان عدد را قرار دهید (۰ اگر بدون تخفیف).
۷. tax_rate: درصد مالیات به صورت عدد صحیح (مثلاً 9 یا 10)، در غیر این صورت 0.
۸. notes: توضیحات و نکات فاکتور یا "".
۹. confidence: درصد اطمینان مدل (مثلاً 98).

نکته مهم: هرگز از مقادیر فرضی مانند 'مشتری گرامی' استفاده نکنید.
پاسخ را فقط به صورت JSON معتبر برگردانید.`;

            const config: any = {
              responseMimeType: 'application/json',
              temperature: 0.1,
            };
            if (modelName === 'gemini-3.7-flash') {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }

            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config,
            });

            if (response && response.text) {
              const parsed = JSON.parse(response.text);
              const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                name: (it.name || '').trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unit_price) || 0),
              })).filter((it: any) => it.name) : [];

              const subtotal = items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
              let discType = parsed.discount_type === 'percent' ? 'percent' : 'amount';
              let discPercent = typeof parsed.discount_percent === 'number' ? parsed.discount_percent : 0;
              let discAmount = typeof parsed.discount === 'number' ? parsed.discount : 0;
              if (discType === 'percent' && discPercent > 0 && (!discAmount || discAmount === discPercent)) {
                discAmount = Math.round(subtotal * (discPercent / 100));
              }

              return res.json({
                success: true,
                data: {
                  transcription: textToAnalyze,
                  customer_name: parsed.customer_name || '',
                  customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                  items: items.length > 0 ? items : [{ name: 'خدمات / کالا', quantity: 1, unit_price: 0 }],
                  discount_type: discType,
                  discount_percent: discPercent,
                  discount: discAmount,
                  tax_rate: typeof parsed.tax_rate === 'number' ? parsed.tax_rate : 0,
                  notes: parsed.notes || '',
                  confidence: parsed.confidence || 98,
                },
                metadata: {
                  model_used: modelName,
                  processing_time_ms: Date.now() - startTime,
                }
              });
            }
          } catch (gemTextErr) {
            console.warn(`Gemini text extraction note (${modelName}):`, gemTextErr);
          }
        }
      }

      // AvalAI GPT-4o fallback if Gemini text failed
      if (process.env.AVALAI_API_KEY) {
        try {
          const chatResp = await fetch('https://api.avalai.ir/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.AVALAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: `Extract Persian invoice information:
1. customer_name: Customer/company name or "".
2. customer_phone: Phone number with English digits or "".
3. items: Array of objects with name, quantity, unit_price in Tomans.
4. discount_type: "percent" or "amount".
5. discount_percent: percent number or 0.
6. discount: Toman discount number or 0.
7. tax_rate: tax percent or 0.
8. notes: string or "".
Respond ONLY in JSON.`,
                },
                {
                  role: 'user',
                  content: textToAnalyze,
                }
              ],
              response_format: { type: 'json_object' },
            }),
          });

          if (chatResp.ok) {
            const chatData = await chatResp.json();
            const content = chatData.choices?.[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content);
              const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                name: (it.name || '').trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unit_price) || 0),
              })).filter((it: any) => it.name) : [];

              const subtotal = items.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
              let discType = parsed.discount_type === 'percent' ? 'percent' : 'amount';
              let discPercent = typeof parsed.discount_percent === 'number' ? parsed.discount_percent : 0;
              let discAmount = typeof parsed.discount === 'number' ? parsed.discount : 0;
              if (discType === 'percent' && discPercent > 0 && (!discAmount || discAmount === discPercent)) {
                discAmount = Math.round(subtotal * (discPercent / 100));
              }

              return res.json({
                success: true,
                data: {
                  transcription: textToAnalyze,
                  customer_name: parsed.customer_name || '',
                  customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                  items: items.length > 0 ? items : [{ name: 'خدمات / کالا', quantity: 1, unit_price: 0 }],
                  discount_type: discType,
                  discount_percent: discPercent,
                  discount: discAmount,
                  tax_rate: parsed.tax_rate || 0,
                  notes: parsed.notes || '',
                  confidence: parsed.confidence || 98,
                },
                metadata: {
                  model_used: 'AvalAI gpt-4o',
                  processing_time_ms: Date.now() - startTime,
                }
              });
            }
          }
        } catch (chatErr) {
          console.warn('AvalAI chat extraction error:', chatErr);
        }
      }
    }

    // High-precision Rule Engine & Regex Parser Fallback
    if (textToAnalyze && textToAnalyze.trim().length > 0) {
      const fallbackParsed = parsePersianTextToInvoice(textToAnalyze);
      return res.json({
        success: true,
        data: {
          transcription: textToAnalyze || transcriptionResult || '',
          ...fallbackParsed,
        },
        metadata: {
          model_used: 'factorchi-persian-nlp-engine',
          processing_time_ms: Date.now() - startTime,
        }
      });
    }

    // If audio was submitted but no voice/words could be detected:
    if (audioFile || base64Audio) {
      return res.status(422).json({
        success: false,
        error: 'کلمات یا صدای واضحی در فایل صوتی تشخیص داده نشد. لطفاً در محیطی با نویز کمتر با صدای رسا صحبت کنید یا از تب «شبیه‌ساز متن گفتار» استفاده فرمایید.',
      });
    }

    return res.status(400).json({
      success: false,
      error: 'متن یا فایل صوتی برای استخراج فاکتور ارسال نشده است.',
    });

  } catch (err: any) {
    console.error('Voice to invoice error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'خطا در پردازش صدا و استخراج اطلاعات فاکتور',
    });
  }
});

// Helper to format phone for WhatsApp wa.me link
function formatPhoneForWhatsApp(phone: string | undefined | null): string {
  if (!phone) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let cleaned = String(phone).trim();
  persianDigits.forEach((pd, idx) => {
    cleaned = cleaned.replaceAll(pd, String(idx));
  });
  arabicDigits.forEach((ad, idx) => {
    cleaned = cleaned.replaceAll(ad, String(idx));
  });

  cleaned = cleaned.replace(/\D/g, '');

  if (!cleaned || cleaned === '98' || cleaned === '0' || cleaned.length < 7) {
    return '';
  }

  if (cleaned.startsWith('0098')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('98') && cleaned.length > 9) {
    cleaned = cleaned.substring(2);
  }

  while (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.length >= 7) {
    return '98' + cleaned;
  }

  return '';
}

function getAppOrigin(req: express.Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'] as string;
  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : (req.protocol || 'https');
  const forwardedHost = req.headers['x-forwarded-host'] as string;
  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : (req.get('host') || 'localhost:3000');
  return `${proto}://${host}`;
}

function formatInvoiceForClient(inv: Invoice, req?: express.Request): Invoice {
  const origin = req ? getAppOrigin(req) : '';
  const currentPayUrl = origin ? `${origin}/payment/${inv.id}` : `/payment/${inv.id}`;
  const needsFix = !inv.payment_url || inv.payment_url.includes('factorchi.ir') || inv.payment_url.startsWith('https://factorchi.ir') || inv.payment_url.startsWith('http://factorchi.ir');
  
  return {
    ...inv,
    payment_url: needsFix ? currentPayUrl : inv.payment_url,
  };
}

// ----------------------------------------------------
// API: WhatsApp Link Generator (/api/whatsapp/send-invoice)
// ----------------------------------------------------
app.post('/api/whatsapp/send-invoice', (req, res) => {
  try {
    const { invoice_id, customer_phone, origin: clientOrigin } = req.body;
    const invoice = DB.invoices.find(inv => inv.id === invoice_id) || DB.invoices[0];

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'فاکتور یافت نشد' });
    }

    const origin = clientOrigin || req.body.base_url || getAppOrigin(req);
    const paymentUrl = `${origin}/payment/${invoice.id}`;
    invoice.payment_url = paymentUrl;

    const rawPhone = customer_phone || invoice.customer_phone || '';
    const cleanPhone = formatPhoneForWhatsApp(rawPhone);

    const itemsSummary = invoice.items
      .map((item, idx) => `${idx + 1}. ${item.name} (${item.quantity} عدد) - ${item.unit_price.toLocaleString('fa-IR')} ت`)
      .join('\n');

    const formattedAmount = invoice.total_amount.toLocaleString('fa-IR');
    const customerGreeting = invoice.customer_name ? `${invoice.customer_name} عزیز` : 'مشتری گرامی';
    const message = `سلام ${customerGreeting} 🌸
فاکتور شماره ${invoice.invoice_number} برای شما صادر شد.

📋 *اقلام فاکتور:*
${itemsSummary}

💰 *مبلغ قابل پرداخت:* ${formattedAmount} تومان
🔗 *لینک مشاهده و پرداخت آنلاین:*
${paymentUrl}

با تشکر از اعتماد شما 🙏
_صادر شده توسط فاکتورچی_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappLink = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    // Mark as sent
    invoice.sent_via_whatsapp = true;
    invoice.updated_at = new Date().toISOString();
    saveDB();

    return res.json({
      success: true,
      whatsapp_link: whatsappLink,
      payment_url: paymentUrl,
      formatted_phone: cleanPhone,
      has_valid_phone: !!cleanPhone,
      message,
      invoice_number: invoice.invoice_number,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// API: Subscription Request (Card to Card) (/api/subscription/request)
// ----------------------------------------------------
app.post('/api/subscription/request', upload.single('receipt_image'), (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const { transaction_reference, user_note, receipt_url } = req.body;

    let receiptImageUrl = receipt_url;
    if (req.file) {
      // Store in base64 data url for preview
      receiptImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const userId = authUser ? authUser.id : (req.body.user_id || 'usr-guest');
    const userName = authUser ? authUser.profile.full_name : (req.body.user_name || 'کاربر فاکتورچی');
    const userEmail = authUser ? authUser.email : (req.body.user_email || 'user@example.com');

    const newRequest: SubscriptionRequest = {
      id: `sub-req-${Date.now()}`,
      user_id: userId,
      user_name: userName,
      user_email: userEmail,
      amount: 500000,
      status: 'pending',
      receipt_image_url: receiptImageUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60',
      transaction_reference: transaction_reference || `TRX-${Math.floor(10000000 + Math.random() * 90000000)}`,
      user_note: user_note || '',
      requested_at: new Date().toISOString(),
    };

    DB.subscription_requests.unshift(newRequest);
    saveDB();
    syncSubscriptionRequestToFirestore(newRequest);

    broadcastRealtimeEvent('subscription:created', {
      request: newRequest,
      message: `درخواست اشتراک جدید از طرف ${userName} ثبت شد.`,
    }, { role: 'admin' });

    return res.json({
      success: true,
      message: 'درخواست خرید اشتراک با موفقیت ثبت شد و در صف بررسی ادمین قرار گرفت.',
      request: newRequest,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// API: Admin Verify Payment (/api/admin/verify-payment)
// ----------------------------------------------------
app.post('/api/admin/verify-payment', (req, res) => {
  try {
    const authUser = requireActiveAdmin(req, res);
    if (!authUser) return;

    const { request_id, admin_note, admin_id } = req.body;
    const request = DB.subscription_requests.find(r => r.id === request_id);

    if (!request) {
      return res.status(404).json({ success: false, error: 'درخواست اشتراک یافت نشد' });
    }

    request.status = 'approved';
    request.approved_at = new Date().toISOString();
    request.approved_by = admin_id || authUser.profile.full_name || 'مدیر سیستم';
    request.admin_note = admin_note || 'پرداخت تایید و اشتراک ۳۰ روزه کاربر فعال گردید.';

    // Extend target user's subscription by 30 days
    const targetUser = DB.users.find(u => u.id === request.user_id);
    if (targetUser) {
      targetUser.profile.subscription_status = 'active';
      const currentExpiry = targetUser.profile.subscription_expires_at ? new Date(targetUser.profile.subscription_expires_at).getTime() : Date.now();
      const baseTime = Math.max(Date.now(), currentExpiry);
      targetUser.profile.subscription_expires_at = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();
      targetUser.profile.updated_at = new Date().toISOString();
    }

    saveDB();
    syncSubscriptionRequestToFirestore(request);
    if (targetUser) {
      syncUserToFirestore(targetUser);
    }

    broadcastRealtimeEvent('subscription:updated', {
      request,
      status: 'approved',
      message: 'درخواست خرید اشتراک شما با موفقیت تأیید شد و اشتراک فعال گردید.',
    }, { userId: request.user_id });

    return res.json({
      success: true,
      message: 'پرداخت با موفقیت تأیید شد و اشتراک ماهانه کاربر فعال شد.',
      request,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// API: Admin Reject Payment (/api/admin/reject-payment)
// ----------------------------------------------------
app.post('/api/admin/reject-payment', (req, res) => {
  try {
    const authUser = requireActiveAdmin(req, res);
    if (!authUser) return;

    const { request_id, admin_note } = req.body;
    const request = DB.subscription_requests.find(r => r.id === request_id);

    if (!request) {
      return res.status(404).json({ success: false, error: 'درخواست اشتراک یافت نشد' });
    }

    request.status = 'rejected';
    request.admin_note = admin_note || 'عدم تطابق فیش واریزی با گردش حساب بانکی';
    saveDB();
    syncSubscriptionRequestToFirestore(request);

    broadcastRealtimeEvent('subscription:updated', {
      request,
      status: 'rejected',
      message: 'درخواست خرید اشتراک شما رد شد.',
    }, { userId: request.user_id });

    return res.json({
      success: true,
      message: 'درخواست پرداخت رد شد و وضعیت به‌روزرسانی شد.',
      request,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// API: Analytics Profit & Loss (/api/analytics/profit-loss)
// Calculated dynamically based on the current user's invoices
// ----------------------------------------------------
app.get('/api/analytics/profit-loss', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const timeframe = (req.query.timeframe as string) || 'month';

    const userInvoices = authUser ? DB.invoices.filter(i => i.user_id === authUser.id) : [];

    const total_revenue = userInvoices.reduce(
      (sum, inv) => sum + (inv.status === 'paid' || inv.payment_status === 'paid' ? Number(inv.total_amount) || 0 : 0),
      0
    );
    const total_expenses = Math.round(total_revenue * 0.18);
    const total_profit = total_revenue - total_expenses;
    const total_invoices = userInvoices.length;

    // Generate dynamic chart distribution for this specific user
    const dataPoints: { date: string; dateLabel: string; revenue: number; expenses: number; profit: number; invoice_count: number }[] = [];

    if (timeframe === 'day') {
      const hours = ['۰۸:۰۰', '۱۰:۰۰', '۱۲:۰۰', '۱۴:۰۰', '۱۶:۰۰', '۱۸:۰۰', '۲۰:۰۰', '۲۲:۰۰'];
      hours.forEach((h, idx) => {
        const rev = userInvoices.length > 0 ? Math.round((total_revenue / hours.length) * (0.5 + (idx % 3) * 0.4)) : 0;
        const exp = Math.round(rev * 0.18);
        dataPoints.push({
          date: h,
          dateLabel: h,
          revenue: rev,
          expenses: exp,
          profit: Math.max(0, rev - exp),
          invoice_count: rev > 0 ? 1 : 0,
        });
      });
    } else if (timeframe === 'week') {
      const days = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
      days.forEach((d, idx) => {
        const rev = userInvoices.length > 0 ? Math.round((total_revenue / days.length) * (0.6 + (idx % 4) * 0.3)) : 0;
        const exp = Math.round(rev * 0.18);
        dataPoints.push({
          date: d,
          dateLabel: d,
          revenue: rev,
          expenses: exp,
          profit: Math.max(0, rev - exp),
          invoice_count: rev > 0 ? 1 : 0,
        });
      });
    } else if (timeframe === 'year') {
      const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
      months.forEach((m, idx) => {
        const rev = userInvoices.length > 0 ? Math.round((total_revenue / months.length) * (0.7 + (idx % 5) * 0.2)) : 0;
        const exp = Math.round(rev * 0.18);
        dataPoints.push({
          date: m,
          dateLabel: m,
          revenue: rev,
          expenses: exp,
          profit: Math.max(0, rev - exp),
          invoice_count: rev > 0 ? 1 : 0,
        });
      });
    } else {
      // Month
      const weeks = ['هفته اول', 'هفته دوم', 'هفته سوم', 'هفته چهارم'];
      weeks.forEach((w, idx) => {
        const rev = userInvoices.length > 0 ? Math.round((total_revenue / weeks.length) * (0.7 + (idx % 3) * 0.3)) : 0;
        const exp = Math.round(rev * 0.18);
        dataPoints.push({
          date: w,
          dateLabel: w,
          revenue: rev,
          expenses: exp,
          profit: Math.max(0, rev - exp),
          invoice_count: rev > 0 ? Math.ceil(total_invoices / weeks.length) : 0,
        });
      });
    }

    return res.json({
      success: true,
      timeframe,
      data: dataPoints,
      summary: {
        total_revenue,
        total_expenses,
        total_profit,
        total_invoices,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Public Payment APIs (Accessible by Customers without Login)
// ----------------------------------------------------
app.get(['/api/payment/:id', '/api/invoices/public/:id'], (req, res) => {
  try {
    const { id } = req.params;
    const inv = DB.invoices.find(i => i.id === id || i.invoice_number === id);
    if (!inv) {
      return res.status(404).json({ success: false, error: 'فاکتور مورد نظر یافت نشد یا منقضی شده است.' });
    }

    const sellerUser = DB.users.find(u => u.id === inv.user_id);
    const seller = sellerUser?.profile;

    return res.json({
      success: true,
      invoice: formatInvoiceForClient(inv, req),
      seller: {
        id: seller?.id || inv.user_id,
        business_name: seller?.business_name || '',
        full_name: seller?.full_name || '',
        phone: seller?.phone || '',
        email: seller?.email || '',
        card_number: seller?.card_number || '',
        card_holder_name: seller?.card_holder_name || seller?.full_name || '',
        bank_name: seller?.bank_name || '',
        account_number: seller?.account_number || '',
        sheba_number: seller?.sheba_number || '',
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/payment/:id/confirm', '/api/payment/confirm'], upload.single('receipt_image'), (req, res) => {
  try {
    const invoiceId = req.params.id || req.body.invoice_id;
    const { 
      tracking_code, 
      tracking_number, 
      reference_number, 
      payer_name, 
      payer_card, 
      payment_method, 
      notes,
      payment_receipt_url,
      receipt_image_url,
      receipt_image
    } = req.body;
    const code = tracking_number || tracking_code || reference_number;

    const inv = DB.invoices.find(i => i.id === invoiceId || i.invoice_number === invoiceId);
    if (!inv) {
      return res.status(404).json({ success: false, error: 'فاکتور مورد نظر برای پرداخت یافت نشد.' });
    }

    if (!code || String(code).trim().length < 5) {
      return res.status(400).json({ success: false, error: 'لطفاً شماره پیگیری یا ارجاع بانکی معتبر (حداقل ۵ رقم) وارد کنید.' });
    }

    let receiptUrl = payment_receipt_url || receipt_image_url || receipt_image;
    if (req.file) {
      // Store in base64 data url for direct view & verification
      receiptUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const cleanCode = String(code).trim();
    inv.payment_tracking_number = cleanCode;
    if (receiptUrl) {
      inv.payment_receipt_url = receiptUrl;
      inv.receipt_image_url = receiptUrl;
    }
    inv.payment_date = new Date().toISOString();
    inv.payment_status = 'pending_verification';
    inv.payment_amount = inv.total_amount;
    inv.payment_method = payment_method || 'card_to_card';
    if (payer_name) inv.payer_name = payer_name.trim();
    if (payer_card) inv.payer_card = payer_card.trim();
    inv.updated_at = new Date().toISOString();

    if (notes) {
      inv.notes = [inv.notes, `توضیحات پرداخت: ${notes}`].filter(Boolean).join(' | ');
    }
    saveDB();
    syncInvoiceToFirestore(inv);

    const formattedInvoice = formatInvoiceForClient(inv, req);
    broadcastRealtimeEvent('payment:receipt_submitted', {
      invoice: formattedInvoice,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name || 'مشتری گرامی',
      customer_phone: inv.customer_phone || '',
      amount: inv.total_amount,
      tracking_number: inv.payment_tracking_number,
      receipt_image_url: inv.receipt_image_url || inv.payment_receipt_url,
      message: `رسید پرداخت جدید برای فاکتور ${inv.invoice_number} توسط ${inv.customer_name || 'مشتری'} ثبت شد.`,
    }, { userId: inv.user_id });

    return res.json({
      success: true,
      message: 'رسید و شماره پیگیری پرداخت با موفقیت ثبت شد و در انتظار تأیید فروشنده است.',
      invoice: formattedInvoice,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// CRUD Invoices with Row Level Security (RLS)
// ----------------------------------------------------
app.get('/api/invoices', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'برای دسترسی به فاکتورها ابتدا وارد شوید.' });
  }

  // Row Level Security: Users ONLY receive their own invoices
  const userInvoices = DB.invoices
    .filter(i => i.user_id === authUser.id)
    .map(i => formatInvoiceForClient(i, req));
  res.json({ success: true, invoices: userInvoices });
});

app.get('/api/invoices/pending-payments/count', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'ابتدا وارد حساب کاربری شوید.' });
  }

  const count = DB.invoices.filter(i => i.user_id === authUser.id && i.payment_status === 'pending_verification').length;
  return res.json({ success: true, count });
});

app.get('/api/invoices/:id', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'ابتدا وارد حساب کاربری خود شوید.' });
  }

  const inv = DB.invoices.find(i => i.id === req.params.id && (i.user_id === authUser.id || authUser.profile.role === 'admin'));
  if (!inv) return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا دسترسی غیرمجاز است' });
  res.json({ success: true, invoice: formatInvoiceForClient(inv, req) });
});

const handleVerifyPaymentRequest = (req: express.Request, res: express.Response) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'ابتدا وارد حساب کاربری شوید.' });
    }

    const rawId = req.params.id || '';
    const inv = DB.invoices.find(
      i => (i.id === rawId || i.invoice_number === rawId) && (i.user_id === authUser.id || authUser.profile.role === 'admin')
    );
    if (!inv) {
      return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا دسترسی مجاز نیست.' });
    }

    const targetStatus = req.body.payment_status || req.body.status;
    const notes = req.body.verification_notes !== undefined ? req.body.verification_notes : req.body.notes;

    if (!['paid', 'failed', 'pending_verification', 'unpaid'].includes(targetStatus)) {
      return res.status(400).json({ success: false, error: 'وضعیت پرداخت نامعتبر است.' });
    }

    inv.payment_status = targetStatus;
    if (notes !== undefined) {
      inv.verification_notes = notes;
    }

    if (targetStatus === 'paid') {
      inv.status = 'paid';
      if (!inv.payment_date) {
        inv.payment_date = new Date().toISOString();
      }
    } else if (targetStatus === 'failed') {
      inv.status = 'overdue';
    } else if (targetStatus === 'unpaid') {
      inv.status = 'sent';
      inv.payment_tracking_number = undefined;
      inv.payment_receipt_url = undefined;
      inv.receipt_image_url = undefined;
    }

    inv.updated_at = new Date().toISOString();
    saveDB();
    syncInvoiceToFirestore(inv);

    const formattedInvoice = formatInvoiceForClient(inv, req);
    broadcastRealtimeEvent('invoice:updated', {
      invoice: formattedInvoice,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      payment_status: inv.payment_status,
      status: inv.status,
      message: targetStatus === 'paid' ? `پرداخت فاکتور ${inv.invoice_number} با موفقیت تأیید شد.` : (targetStatus === 'failed' ? `پرداخت فاکتور ${inv.invoice_number} رد شد.` : `وضعیت فاکتور ${inv.invoice_number} به‌روزرسانی شد.`),
    }, { userId: inv.user_id });

    return res.json({
      success: true,
      message: targetStatus === 'paid' ? 'پرداخت با موفقیت تأیید شد.' : targetStatus === 'failed' ? 'پرداخت رد شد.' : 'وضعیت پرداخت به‌روزرسانی شد.',
      invoice: formattedInvoice,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.put('/api/invoices/:id/verify-payment', handleVerifyPaymentRequest);
app.post('/api/invoices/:id/verify-payment', handleVerifyPaymentRequest);
app.post('/api/invoices/:id/payment-verify', handleVerifyPaymentRequest);

app.post('/api/invoices', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'برای ثبت فاکتور ابتدا وارد شوید.' });
    }

    const {
      customer_name,
      customer_phone,
      items,
      discount = 0,
      discount_type = 'amount',
      discount_percent = 0,
      tax_rate = 0,
      status = 'sent',
      voice_input_used = false,
      voice_input_method = 'record',
      notes = '',
      origin: clientOrigin,
    } = req.body;

    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    let finalDiscountAmount = Number(discount) || 0;
    if (discount_type === 'percent' && Number(discount_percent) > 0) {
      finalDiscountAmount = Math.round(subtotal * (Number(discount_percent) / 100));
    }
    const discounted = Math.max(0, subtotal - finalDiscountAmount);
    const tax = Math.round(discounted * (Number(tax_rate) / 100));
    const total_amount = discounted + tax;

    const newId = `inv-${100 + DB.invoices.length + 1}`;
    const origin = clientOrigin || req.body.base_url || getAppOrigin(req);
    const newInvoice: Invoice = {
      id: newId,
      user_id: authUser.id, // Strictly isolate by authenticated user's ID
      invoice_number: `FC-1403-${100 + DB.invoices.length + 1}`,
      customer_name: customer_name || 'مشتری گرامی',
      customer_phone: customer_phone || '',
      items: items || [{ id: 'itm-1', name: 'خدمات طراحی', quantity: 1, unit_price: subtotal || 1000000 }],
      discount: finalDiscountAmount,
      discount_type: discount_type as 'amount' | 'percent',
      discount_percent: Number(discount_percent) || (subtotal > 0 && finalDiscountAmount > 0 ? Math.round((finalDiscountAmount / subtotal) * 100) : 0),
      tax_rate: Number(tax_rate),
      total_amount,
      status: status || 'sent',
      payment_status: status === 'paid' ? 'paid' : 'unpaid',
      payment_amount: total_amount,
      payment_method: 'card_to_card',
      payment_url: `${origin}/payment/${newId}`,
      sent_via_whatsapp: false,
      voice_input_used: !!voice_input_used,
      voice_input_method: voice_input_method,
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    DB.invoices.unshift(newInvoice);
    saveDB();
    syncInvoiceToFirestore(newInvoice);

    const formattedInvoice = formatInvoiceForClient(newInvoice, req);
    broadcastRealtimeEvent('invoice:created', {
      invoice: formattedInvoice,
      invoice_id: newInvoice.id,
      invoice_number: newInvoice.invoice_number,
      message: `فاکتور جدید ${newInvoice.invoice_number} ایجاد شد.`,
    }, { userId: authUser.id });

    res.json({ success: true, invoice: formattedInvoice });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/invoices/:id', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'ابتدا وارد شوید.' });
  }

  // Verify ownership before updating
  const index = DB.invoices.findIndex(i => i.id === req.params.id && (i.user_id === authUser.id || authUser.profile.role === 'admin'));
  if (index === -1) return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا شما اجازه ویرایش آن را ندارید' });

  const updated = {
    ...DB.invoices[index],
    ...req.body,
    id: DB.invoices[index].id,
    user_id: DB.invoices[index].user_id, // Immutable owner ID
    updated_at: new Date().toISOString(),
  };

  // Synchronize status and payment_status
  if (req.body.status === 'paid' && req.body.payment_status === undefined) {
    updated.payment_status = 'paid';
    if (!updated.payment_date) {
      updated.payment_date = new Date().toISOString();
    }
  } else if (req.body.payment_status === 'paid' && req.body.status === undefined) {
    updated.status = 'paid';
    if (!updated.payment_date) {
      updated.payment_date = new Date().toISOString();
    }
  } else if ((req.body.status === 'sent' || req.body.status === 'draft') && req.body.payment_status === undefined) {
    if (updated.payment_status === 'paid') {
      updated.payment_status = 'unpaid';
    }
  }

  if (req.body.items || req.body.discount !== undefined || req.body.discount_percent !== undefined || req.body.discount_type !== undefined || req.body.tax_rate !== undefined) {
    const subtotal = updated.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    let finalDiscount = Number(updated.discount) || 0;
    if (updated.discount_type === 'percent' && Number(updated.discount_percent) > 0) {
      finalDiscount = Math.round(subtotal * (Number(updated.discount_percent) / 100));
      updated.discount = finalDiscount;
    }
    const discounted = Math.max(0, subtotal - finalDiscount);
    const tax = Math.round(discounted * (Number(updated.tax_rate) / 100));
    updated.total_amount = discounted + tax;
  }

  DB.invoices[index] = updated;
  saveDB();
  syncInvoiceToFirestore(updated);

  const formattedInvoice = formatInvoiceForClient(updated, req);
  broadcastRealtimeEvent('invoice:updated', {
    invoice: formattedInvoice,
    invoice_id: updated.id,
    invoice_number: updated.invoice_number,
  }, { userId: updated.user_id });

  res.json({ success: true, invoice: formattedInvoice });
});

app.delete('/api/invoices/:id', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const rawId = req.params.id || '';
    let decodedId = rawId;
    try {
      decodedId = decodeURIComponent(rawId);
    } catch {
      decodedId = rawId;
    }

    if (!rawId) {
      return res.status(400).json({ success: false, error: 'شناسه فاکتور مشخص نشده است.' });
    }

    const index = DB.invoices.findIndex(
      i => i.id === rawId || i.id === decodedId || i.invoice_number === rawId || i.invoice_number === decodedId
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا از قبل حذف شده است.' });
    }

    const invoice = DB.invoices[index];
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'برای حذف فاکتور ابتدا وارد شوید.' });
    }

    const isOwner = invoice.user_id === authUser.id;
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'شما فقط مجاز به حذف فاکتورهای حساب کاربری خود هستید.' });
    }

    // Cascade deletion of all occurrences of this invoice
    const targetInvoiceId = invoice.id;
    const targetInvoiceNumber = invoice.invoice_number;
    DB.invoices = DB.invoices.filter(
      i => i.id !== targetInvoiceId && i.invoice_number !== targetInvoiceNumber
    );
    saveDB();
    deleteInvoiceFromFirestore(targetInvoiceId);

    broadcastRealtimeEvent('invoice:deleted', {
      invoice_id: targetInvoiceId,
      invoice_number: targetInvoiceNumber,
    }, { userId: invoice.user_id });

    return res.json({ 
      success: true, 
      message: 'فاکتور با موفقیت حذف شد.',
      deleted_id: targetInvoiceId,
      deleted_number: targetInvoiceNumber
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'خطای سرور در حذف فاکتور' });
  }
});

// Admin subscription requests list
app.get('/api/admin/subscription-requests', (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;
  res.json({ success: true, requests: DB.subscription_requests });
});

// Admin Users View (users_view) & Profiles list
app.get(['/api/admin/users', '/api/admin/users_view', '/api/users_view'], (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  const usersList = DB.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.profile.created_at,
    profile: u.profile,
    invoices_count: DB.invoices.filter((inv) => inv.user_id === u.id).length,
  }));

  res.json({
    success: true,
    users: usersList,
    total_count: usersList.length,
  });
});

// Admin Update User Subscription / Profile
app.put('/api/admin/users/:id/subscription', (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  const target = DB.users.find((u) => u.id === req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, error: 'کاربر یافت نشد' });
  }

  const { subscription_status, days_to_add } = req.body;
  if (subscription_status) {
    target.profile.subscription_status = subscription_status;
  }
  if (days_to_add && Number(days_to_add) > 0) {
    const currentExpiry = target.profile.subscription_expires_at
      ? new Date(target.profile.subscription_expires_at).getTime()
      : Date.now();
    const baseTime = Math.max(Date.now(), currentExpiry);
    target.profile.subscription_expires_at = new Date(baseTime + Number(days_to_add) * 24 * 60 * 60 * 1000).toISOString();
  }
  target.profile.updated_at = new Date().toISOString();
  saveDB();
  syncUserToFirestore(target);

  res.json({ success: true, user: target });
});

// User profile & billing info (profiles table endpoints)
app.get(['/api/profile', '/api/profiles'], (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'کاربر احراز هویت نشده است' });
  }
  res.json({ success: true, profile: authUser.profile, data: authUser.profile });
});

app.post('/api/profiles', (req, res) => {
  const authUser = getAuthUser(req);
  const profilePayload = req.body || {};
  const userId = profilePayload.id || authUser?.id;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'شناسه کاربر الزامی است' });
  }

  const user = DB.users.find(u => u.id === userId);
  if (user) {
    if (profilePayload.role === 'admin' && user.profile.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'شما اجازه تغییر نقش به مدیر ارشد را ندارید.',
        code: 'FORBIDDEN_ROLE_ESCALATION',
      });
    }

    user.profile = {
      ...user.profile,
      ...profilePayload,
      id: userId,
      role: user.profile.role, // preserve role security
      updated_at: new Date().toISOString(),
    };
    saveDB();
    syncUserToFirestore(user);
    broadcastRealtimeEvent('profile:updated', { profile: user.profile, user_id: userId }, { userId });
    return res.json({ success: true, profile: user.profile, data: user.profile });
  }

  profilePayload.role = 'user';
  return res.json({ success: true, profile: profilePayload, data: profilePayload });
});

app.put(['/api/profile', '/api/profiles'], (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'کاربر احراز هویت نشده است' });
  }

  if (req.body?.role === 'admin' && authUser.profile.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'شما اجازه تغییر نقش به مدیر ارشد را ندارید.',
      code: 'FORBIDDEN_ROLE_ESCALATION',
    });
  }

  authUser.profile = {
    ...authUser.profile,
    ...req.body,
    id: authUser.id,
    role: authUser.profile.role, // role cannot be escalated via profile edit
    updated_at: new Date().toISOString(),
  };
  saveDB();
  syncUserToFirestore(authUser);
  broadcastRealtimeEvent('profile:updated', { profile: authUser.profile, user_id: authUser.id }, { userId: authUser.id });
  res.json({ success: true, profile: authUser.profile, data: authUser.profile });
});

// ----------------------------------------------------
// Feature Updates (What's New) Endpoints with Gemini AI
// ----------------------------------------------------
app.get('/api/feature-updates', (req, res) => {
  const updates = DB.feature_updates || [];
  res.json({
    success: true,
    updates: updates,
  });
});

app.post('/api/feature-updates/ai-generate', async (req, res) => {
  try {
    const { prompt: userFeaturePrompt } = req.body;
    if (!userFeaturePrompt || typeof userFeaturePrompt !== 'string') {
      return res.status(400).json({ success: false, error: 'شرح قابلیت یا تغییرات الزامی است.' });
    }

    const ai = getGemini();
    let generatedUpdate: FeatureUpdate | null = null;

    if (ai) {
      try {
        const prompt = `شما یک دستیار معرفی ویژگی‌های محصول (Product Feature Release Manager) برای نرم‌افزار حسابداری و فاکتور ساز آنلاین «فاکتورچی» هستید.
کاربر به زبان ساده توضیح داده که چه فیچر یا تغییری به برنامه اضافه شده است:
"${userFeaturePrompt}"

وظیفه شما: این قابلیت جدید را تحلیل کرده و یک آیتم معرفی جذاب، رسمی، خوانا و کاربرپسند به زبان فارسی تولید کنید.

قالب خروجی JSON با فیلدهای زیر:
1. title: عنوان خلاصه و جذاب ویژگی جدید به زبان فارسی (مثلاً "صدور صوتی فاکتور با هوش مصنوعی جمنای")
2. description: توضیح یک یا دو جمله‌ای روان و مفید از این قابلیت برای کاربران و مدیران کسب‌وکار.
3. badge: یک برچسب کوتاه (مانند "جدید"، "ارتقا"، "هوش مصنوعی"، "امکانات مالی"، "بهینه‌سازی"، "امنیتی")
4. badgeColor: یکی از مقادیر روبرو بر اساس نوع تغییر: "teal" | "emerald" | "indigo" | "amber" | "rose"
5. icon: یکی از مقادیر روبرو: "mic" | "ai" | "shield" | "chart" | "zap"
6. actionText: متن دکمه اقدام سریع اختیاری (مثلاً "امتحان کنید"، "مشاهده گزارش"، "تنظیمات"، "ثبت فاکتور") یا ""
7. actionTab: تب مقصد در صورت مرتبط بودن یکی از این موارد: "dashboard" | "invoices" | "new-invoice" | "billing" | "settings" | "admin" یا ""

فقط و فقط یک شیء معتبر JSON برگردانید.`;

        const featModels = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.7-flash'];
        let response: any = null;
        for (const m of featModels) {
          try {
            response = await ai.models.generateContent({
              model: m,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              }
            });
            if (response && response.text) break;
          } catch (modelErr) {
            console.warn(`Feature gen error on ${m}:`, modelErr);
          }
        }

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          const newId = `feat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          
          // Persian current date label
          const now = new Date();
          const pDate = new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(now);

          generatedUpdate = {
            id: newId,
            title: parsed.title || userFeaturePrompt.slice(0, 50),
            description: parsed.description || userFeaturePrompt,
            badge: parsed.badge || 'جدید',
            badgeColor: ['teal', 'emerald', 'indigo', 'amber', 'rose'].includes(parsed.badgeColor) ? parsed.badgeColor : 'teal',
            icon: ['mic', 'ai', 'shield', 'chart', 'zap'].includes(parsed.icon) ? parsed.icon : 'zap',
            date: pDate || 'شهریور ۱۴۰۵',
            actionText: parsed.actionText || undefined,
            actionTab: parsed.actionTab || undefined,
            created_at: new Date().toISOString(),
            ai_generated: true,
          };
        }
      } catch (gemErr) {
        console.error('Gemini Feature Generation error:', gemErr);
      }
    }

    // Fallback if AI not reachable
    if (!generatedUpdate) {
      const newId = `feat-${Date.now()}`;
      generatedUpdate = {
        id: newId,
        title: userFeaturePrompt.slice(0, 60),
        description: userFeaturePrompt,
        badge: 'قابلیت جدید',
        badgeColor: 'teal',
        icon: 'zap',
        date: 'شهریور ۱۴۰۵',
        created_at: new Date().toISOString(),
        ai_generated: false,
      };
    }

    // Add to DB at beginning of array
    DB.feature_updates.unshift(generatedUpdate);
    saveDB();
    syncFeatureUpdateToFirestore(generatedUpdate);

    return res.json({
      success: true,
      message: 'قابلیت جدید با هوش مصنوعی جمنای ایجاد و به لیست اضافه شد.',
      update: generatedUpdate,
      updates: DB.feature_updates,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'خطا در ثبت قابلیت جدید با هوش مصنوعی' });
  }
});

app.post('/api/feature-updates', (req, res) => {
  try {
    const { title, description, badge, badgeColor, icon, actionText, actionTab } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'عنوان و توضیحات قابلیت الزامی است.' });
    }

    const newId = `feat-${Date.now()}`;
    const newUpdate: FeatureUpdate = {
      id: newId,
      title,
      description,
      badge: badge || 'جدید',
      badgeColor: badgeColor || 'teal',
      icon: icon || 'zap',
      date: new Intl.DateTimeFormat('fa-IR', { month: 'long', year: 'numeric' }).format(new Date()),
      actionText: actionText || undefined,
      actionTab: actionTab || undefined,
      created_at: new Date().toISOString(),
      ai_generated: false,
    };

    DB.feature_updates.unshift(newUpdate);
    saveDB();
    syncFeatureUpdateToFirestore(newUpdate);

    return res.json({
      success: true,
      update: newUpdate,
      updates: DB.feature_updates,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/feature-updates/:id', (req, res) => {
  try {
    const { id } = req.params;
    DB.feature_updates = DB.feature_updates.filter(f => f.id !== id);
    saveDB();
    deleteFeatureUpdateFromFirestore(id);
    return res.json({ success: true, message: 'قابلیت با موفقیت حذف شد.', updates: DB.feature_updates });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Vite Middleware & Static Serving
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Factorchi Server running at http://localhost:${PORT}`);
  });
}

start();
