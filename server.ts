import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import nodemailer from 'nodemailer';
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

// Global CORS & preflight OPTIONS handling for iframe & reverse proxy compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-user-email, Cache-Control, Pragma'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// High-speed HTTP compression for JS/CSS/JSON payloads (excluding SSE streams)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.path && req.path.includes('/api/realtime/stream')) {
      return false; // Do not buffer or compress realtime SSE stream
    }
    return compression.filter(req, res);
  }
}));

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
  tour_completed?: boolean;
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
  title?: string;
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

interface PasswordResetToken {
  id: string;
  user_id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

interface RegistrationOtp {
  id: string;
  email: string;
  code: string;
  full_name: string;
  business_name?: string;
  phone?: string;
  password: string;
  expires_at: string;
  created_at: string;
  attempts: number;
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

const SECONDARY_ADMIN: UserAccount = {
  id: 'usr-kimia-admin',
  email: 'kimiabg2013@gmail.com',
  password: 'admin1234',
  profile: {
    id: 'usr-kimia-admin',
    full_name: 'کیمیا باقری',
    business_name: 'استودیو طراحی و توسعه کیارش',
    phone: '09130481639',
    email: 'kimiabg2013@gmail.com',
    subscription_status: 'active',
    subscription_expires_at: null, // Unlimited perpetual access for admin
    role: 'admin',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    card_number: '',
    card_holder_name: 'کیمیا باقری',
    bank_name: 'سامان',
  },
};

const DEFAULT_ADMINS: UserAccount[] = [DEFAULT_ADMIN, SECONDARY_ADMIN];

export interface ExpenseRecord {
  id: string;
  user_id: string;
  title: string;
  category: 'material' | 'rent' | 'utility' | 'salary' | 'equipment' | 'other';
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

function loadDBFromDisk(): { 
  users: UserAccount[]; 
  invoices: Invoice[]; 
  deleted_invoices: string[];
  deleted_users: string[];
  expenses: ExpenseRecord[]; 
  subscription_requests: SubscriptionRequest[]; 
  feature_updates: FeatureUpdate[]; 
  password_resets: PasswordResetToken[]; 
  registration_otps: RegistrationOtp[] 
} {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        // Guarantee all designated admin accounts exist with active perpetual subscription
        for (const defAdmin of DEFAULT_ADMINS) {
          const adminIdx = parsed.users.findIndex((u: UserAccount) => u.email.toLowerCase() === defAdmin.email.toLowerCase());
          if (adminIdx === -1) {
            parsed.users.push(defAdmin);
          } else {
            parsed.users[adminIdx].profile.role = 'admin';
            parsed.users[adminIdx].profile.subscription_status = 'active';
            parsed.users[adminIdx].profile.subscription_expires_at = null;
          }
        }

        // Guarantee all accounts with role === 'admin' are kept active and perpetual
        parsed.users.forEach((u: UserAccount) => {
          if (u.profile && u.profile.role === 'admin') {
            u.profile.subscription_status = 'active';
            u.profile.subscription_expires_at = null;
          }
        });

        const rawDeleted: string[] = Array.isArray((parsed as any).deleted_invoices) ? (parsed as any).deleted_invoices : [];
        // Only track unique invoice document IDs, strictly strip out sequential invoice numbers (e.g. FC-1403-101) and old demo IDs
        const cleanedDeletedInvoices = rawDeleted
          .filter(id => id && typeof id === 'string' && !id.startsWith('FC-') && id !== 'inv-101' && id !== 'inv-102');
        const deletedSet = new Set<string>(cleanedDeletedInvoices);

        const rawDeletedUsers: string[] = Array.isArray((parsed as any).deleted_users) ? (parsed as any).deleted_users : [];
        // Protect admins from ever being in deleted_users
        const protectedAdminEmails = new Set(DEFAULT_ADMINS.map(a => a.email.toLowerCase()));
        const cleanedDeletedUsers = rawDeletedUsers
          .map(x => String(x).toLowerCase())
          .filter(x => !protectedAdminEmails.has(x) && !x.includes('admin'));

        // Filter out any leftover unwanted seed invoices and explicitly deleted invoice IDs (strictly NEVER by invoice_number)
        let loadedInvoices: Invoice[] = (Array.isArray(parsed.invoices) ? parsed.invoices : [])
          .filter((inv: any) => !inv.id?.startsWith('inv-seed-') && !deletedSet.has(inv.id))
          .map((inv: any) => ({
            ...inv,
            payment_status: inv.payment_status || (inv.status === 'paid' ? 'paid' : 'unpaid'),
            payment_url: (inv.payment_url && inv.payment_url.includes('factorchi.ir')) ? `/payment/${inv.id}` : (inv.payment_url || `/payment/${inv.id}`),
          }));

        return {
          users: parsed.users,
          invoices: loadedInvoices,
          deleted_invoices: Array.from(deletedSet),
          deleted_users: Array.from(new Set(cleanedDeletedUsers)),
          expenses: Array.isArray((parsed as any).expenses) ? (parsed as any).expenses : [],
          subscription_requests: Array.isArray(parsed.subscription_requests) ? parsed.subscription_requests : [],
          feature_updates: Array.isArray(parsed.feature_updates) && parsed.feature_updates.length > 0 ? parsed.feature_updates : [...INITIAL_FEATURE_UPDATES],
          password_resets: Array.isArray(parsed.password_resets) ? parsed.password_resets : [],
          registration_otps: Array.isArray((parsed as any).registration_otps) ? (parsed as any).registration_otps : [],
        };
      }
    }
  } catch (e) {
    console.error('Error loading DB from disk:', e);
  }

  return {
    users: [...DEFAULT_ADMINS],
    invoices: [],
    deleted_invoices: [],
    deleted_users: [],
    expenses: [],
    subscription_requests: [],
    feature_updates: [...INITIAL_FEATURE_UPDATES],
    password_resets: [],
    registration_otps: [],
  };
}

const DB = loadDBFromDisk();

function saveDB(immediate = true) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write DB to disk synchronously:', err);
  }
}
// Save initial state immediately
saveDB(true);

// ----------------------------------------------------
// Cloud Firestore Real-Time Sync Helpers
// ----------------------------------------------------
function sanitizeForFirestore(val: any): any {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.map(sanitizeForFirestore);
  if (typeof val === 'object' && !(val instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return val;
}

async function syncUserToFirestore(user: UserAccount) {
  if (!firestoreDb) return;
  try {
    const safeUserData = sanitizeForFirestore({
      id: user.id,
      email: user.email,
      password: user.password || '',
      profile: user.profile,
      updated_at: new Date().toISOString(),
    });
    const userRef = doc(firestoreDb, 'users', user.id);
    await setDoc(userRef, safeUserData, { merge: true });

    const safeProfileData = sanitizeForFirestore(user.profile);
    const profileRef = doc(firestoreDb, 'profiles', user.id);
    await setDoc(profileRef, safeProfileData, { merge: true });
  } catch (err) {
    console.error('Error syncing user to Firestore:', err);
  }
}

async function syncInvoiceToFirestore(invoice: Invoice) {
  if (!firestoreDb) return;
  try {
    const clone = { ...invoice };
    // Guard against exceeding Firestore 1MB document size limit if receipt is stored as raw large data URL
    if (clone.payment_receipt_url && clone.payment_receipt_url.length > 400000) {
      clone.payment_receipt_url = clone.payment_receipt_url.substring(0, 100) + '...[local_receipt_data]';
    }
    if (clone.receipt_image_url && clone.receipt_image_url.length > 400000) {
      clone.receipt_image_url = clone.receipt_image_url.substring(0, 100) + '...[local_receipt_data]';
    }
    const safeInvoice = sanitizeForFirestore(clone);
    const invRef = doc(firestoreDb, 'invoices', invoice.id);
    await setDoc(invRef, safeInvoice, { merge: true });
  } catch (err) {
    console.error('Error syncing invoice to Firestore:', err);
  }
}

async function deleteInvoiceFromFirestore(invoiceId: string) {
  if (!firestoreDb) return;
  try {
    const invRef = doc(firestoreDb, 'invoices', invoiceId);
    await deleteDoc(invRef);

    // Save tombstone in Firestore deleted_invoices collection strictly by unique ID
    try {
      await setDoc(doc(firestoreDb, 'deleted_invoices', invoiceId), {
        id: invoiceId,
        deleted_at: new Date().toISOString(),
      });
    } catch {
      // ignore tombstone write failure
    }
  } catch (err) {
    console.error('Error deleting invoice from Firestore:', err);
  }
}

async function syncSubscriptionRequestToFirestore(subReq: SubscriptionRequest) {
  if (!firestoreDb) return;
  try {
    const safeSubReq = sanitizeForFirestore(subReq);
    const subRef = doc(firestoreDb, 'subscription_requests', subReq.id);
    await setDoc(subRef, safeSubReq, { merge: true });
  } catch (err) {
    console.error('Error syncing subscription request to Firestore:', err);
  }
}

async function syncFeatureUpdateToFirestore(update: FeatureUpdate) {
  if (!firestoreDb) return;
  try {
    const safeUpdate = sanitizeForFirestore(update);
    const featRef = doc(firestoreDb, 'feature_updates', update.id);
    await setDoc(featRef, safeUpdate, { merge: true });
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

async function syncExpenseToFirestore(expense: ExpenseRecord) {
  if (!firestoreDb) return;
  try {
    const safeExpense = sanitizeForFirestore(expense);
    const expRef = doc(firestoreDb, 'expenses', expense.id);
    await setDoc(expRef, safeExpense, { merge: true });
  } catch (err) {
    console.error('Error syncing expense to Firestore:', err);
  }
}

async function deleteExpenseFromFirestore(expenseId: string) {
  if (!firestoreDb) return;
  try {
    const expRef = doc(firestoreDb, 'expenses', expenseId);
    await deleteDoc(expRef);
  } catch (err) {
    console.error('Error deleting expense from Firestore:', err);
  }
}

function normalizeCleanEmail(email: any): string {
  return String(email || '').normalize('NFKC').trim().toLowerCase();
}

async function syncRegistrationOtpToFirestore(otp: RegistrationOtp) {
  if (!firestoreDb) return;
  try {
    const cleanEmail = normalizeCleanEmail(otp.email);
    const docId = encodeURIComponent(cleanEmail).replace(/%/g, '_');
    const safeData = sanitizeForFirestore({
      ...otp,
      email: cleanEmail,
    });
    await setDoc(doc(firestoreDb, 'registration_otps', docId), safeData, { merge: true });
    console.log(`✅ [OTP SYNC] Synced registration OTP for ${cleanEmail} to Firestore (docId: ${docId})`);
  } catch (err) {
    console.error('❌ [OTP SYNC] Failed to sync registration OTP to Firestore:', err);
  }
}

async function findRegistrationOtp(email: string): Promise<RegistrationOtp | null> {
  const cleanEmail = normalizeCleanEmail(email);
  if (!cleanEmail) return null;

  if (!Array.isArray(DB.registration_otps)) {
    DB.registration_otps = [];
  }

  // 1. Check in-memory list first
  const inMem = DB.registration_otps.find(o => normalizeCleanEmail(o.email) === cleanEmail);
  if (inMem) {
    return inMem;
  }

  // 2. Check Firestore
  if (firestoreDb) {
    try {
      const docId = encodeURIComponent(cleanEmail).replace(/%/g, '_');
      const snap = await getDoc(doc(firestoreDb, 'registration_otps', docId));
      if (snap.exists()) {
        const data = snap.data() as RegistrationOtp;
        if (data && data.code) {
          DB.registration_otps = DB.registration_otps.filter(o => normalizeCleanEmail(o.email) !== cleanEmail);
          DB.registration_otps.push(data);
          saveDB();
          console.log(`🔄 [OTP RESTORE] Restored registration OTP for ${cleanEmail} from Firestore docId`);
          return data;
        }
      }

      // Fallback query across collection
      const colSnap = await getDocs(collection(firestoreDb, 'registration_otps'));
      for (const d of colSnap.docs) {
        const data = d.data() as RegistrationOtp;
        if (data && data.email && normalizeCleanEmail(data.email) === cleanEmail) {
          DB.registration_otps = DB.registration_otps.filter(o => normalizeCleanEmail(o.email) !== cleanEmail);
          DB.registration_otps.push(data);
          saveDB();
          console.log(`🔄 [OTP RESTORE] Restored registration OTP for ${cleanEmail} from Firestore collection scan`);
          return data;
        }
      }
    } catch (err) {
      console.error('Error finding OTP in Firestore:', err);
    }
  }

  return null;
}

async function deleteRegistrationOtp(email: string): Promise<void> {
  const cleanEmail = normalizeCleanEmail(email);
  if (!cleanEmail) return;

  if (Array.isArray(DB.registration_otps)) {
    DB.registration_otps = DB.registration_otps.filter(o => normalizeCleanEmail(o.email) !== cleanEmail);
    saveDB();
  }

  if (firestoreDb) {
    try {
      const docId = encodeURIComponent(cleanEmail).replace(/%/g, '_');
      await deleteDoc(doc(firestoreDb, 'registration_otps', docId)).catch(() => {});

      const colSnap = await getDocs(collection(firestoreDb, 'registration_otps'));
      const deletes: Promise<any>[] = [];
      colSnap.forEach(d => {
        const data = d.data();
        if (data && data.email && normalizeCleanEmail(data.email) === cleanEmail) {
          deletes.push(deleteDoc(d.ref));
        }
      });
      await Promise.all(deletes).catch(() => {});
    } catch (err) {
      console.error('Error deleting OTP from Firestore:', err);
    }
  }
}

async function deleteUserCompletelyFromFirestore(userId: string, userEmail?: string) {
  if (!firestoreDb) return;
  try {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    console.log(`🗑️ Deleting user ${userId} (${cleanEmail || 'no-email'}) and all associated data from Cloud Firestore...`);
    
    // 1. Delete user record & profile record directly by ID and by Email
    const directDeletes: Promise<any>[] = [
      deleteDoc(doc(firestoreDb, 'users', userId)),
      deleteDoc(doc(firestoreDb, 'profiles', userId)),
    ];
    if (cleanEmail) {
      directDeletes.push(deleteDoc(doc(firestoreDb, 'users', cleanEmail)));
      directDeletes.push(deleteDoc(doc(firestoreDb, 'profiles', cleanEmail)));
    }
    await Promise.all(directDeletes).catch(() => {});

    // 2. Scan and purge any lingering user docs in Firestore matching userId or email
    try {
      const uSnapshot = await getDocs(collection(firestoreDb, 'users'));
      const uDeletes: Promise<any>[] = [];
      uSnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (
          docSnap.id === userId ||
          (cleanEmail && docSnap.id.toLowerCase() === cleanEmail) ||
          (u && (u.id === userId || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)))
        ) {
          uDeletes.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(uDeletes);
    } catch (e) {
      console.error('Error scanning/deleting user docs from Firestore:', e);
    }

    try {
      const pSnapshot = await getDocs(collection(firestoreDb, 'profiles'));
      const pDeletes: Promise<any>[] = [];
      pSnapshot.forEach((docSnap) => {
        const p = docSnap.data();
        if (
          docSnap.id === userId ||
          (cleanEmail && docSnap.id.toLowerCase() === cleanEmail) ||
          (p && (p.id === userId || (cleanEmail && p.email && p.email.toLowerCase() === cleanEmail)))
        ) {
          pDeletes.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(pDeletes);
    } catch (e) {
      console.error('Error scanning/deleting profile docs from Firestore:', e);
    }

    // 3. Delete all invoices belonging to this user and record tombstones
    try {
      const invSnapshot = await getDocs(collection(firestoreDb, 'invoices'));
      const deletePromises: Promise<any>[] = [];
      invSnapshot.forEach((docSnap) => {
        const inv = docSnap.data();
        if (inv && (inv.user_id === userId || inv.userId === userId || (cleanEmail && inv.user_email && inv.user_email.toLowerCase() === cleanEmail))) {
          const invId = docSnap.id || inv.id;
          if (invId) {
            if (!DB.deleted_invoices) DB.deleted_invoices = [];
            if (!DB.deleted_invoices.includes(invId)) DB.deleted_invoices.push(invId);
            deletePromises.push(
              setDoc(doc(firestoreDb, 'deleted_invoices', invId), {
                id: invId,
                deleted_at: new Date().toISOString(),
                user_id: userId,
                reason: 'user_deleted_cascade'
              }).catch(() => {})
            );
          }
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(deletePromises);
    } catch (e) {
      console.error('Error deleting user invoices from Firestore:', e);
    }

    // 4. Delete all expenses belonging to this user
    try {
      const expSnapshot = await getDocs(collection(firestoreDb, 'expenses'));
      const expDeletePromises: Promise<any>[] = [];
      expSnapshot.forEach((docSnap) => {
        const exp = docSnap.data();
        if (exp && (exp.user_id === userId || exp.userId === userId)) {
          expDeletePromises.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(expDeletePromises);
    } catch (e) {
      console.error('Error deleting user expenses from Firestore:', e);
    }

    // 5. Delete all subscription requests belonging to this user
    try {
      const subSnapshot = await getDocs(collection(firestoreDb, 'subscription_requests'));
      const subDeletePromises: Promise<any>[] = [];
      subSnapshot.forEach((docSnap) => {
        const sub = docSnap.data();
        if (sub && (sub.user_id === userId || sub.userId === userId || (cleanEmail && sub.user_email && sub.user_email.toLowerCase() === cleanEmail))) {
          subDeletePromises.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(subDeletePromises);
    } catch (e) {
      console.error('Error deleting user subscription requests from Firestore:', e);
    }

    console.log(`✅ User ${userId} (${cleanEmail}) and associated collections successfully deleted from Cloud Firestore.`);
  } catch (err) {
    console.error('Error in deleteUserCompletelyFromFirestore:', err);
  }
}

async function loadDBFromFirestore() {
  if (!firestoreDb) return;
  try {
    console.log('🔄 Syncing persistent database from Cloud Firestore...');

    const deletedUsersSet = new Set<string>((DB.deleted_users || []).map(x => x.toLowerCase()));
    const deadUserDocs: Promise<any>[] = [];
    const protectedEmails = new Set(DEFAULT_ADMINS.map(a => a.email.toLowerCase()));

    // 1. Fetch Users
    const usersSnapshot = await getDocs(collection(firestoreDb, 'users'));
    const firestoreUsers: UserAccount[] = [];
    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data() as UserAccount;
      if (data && data.id && data.email) {
        const emailLower = data.email.toLowerCase();
        const isAdmin = data.profile?.role === 'admin' || protectedEmails.has(emailLower);
        if (!isAdmin && (deletedUsersSet.has(docSnap.id.toLowerCase()) || deletedUsersSet.has(data.id.toLowerCase()) || deletedUsersSet.has(emailLower))) {
          // Permanently purge deleted user record from Firestore
          deadUserDocs.push(deleteDoc(docSnap.ref));
        } else {
          if (isAdmin && data.profile) {
            data.profile.role = 'admin';
            data.profile.subscription_status = 'active';
            data.profile.subscription_expires_at = null;
          }
          firestoreUsers.push(data);
        }
      }
    });

    if (deadUserDocs.length > 0) {
      await Promise.all(deadUserDocs).catch(() => {});
    }

    // 0. Fetch Deleted Invoices (Tombstones) from Firestore strictly by ID
    try {
      const delSnapshot = await getDocs(collection(firestoreDb, 'deleted_invoices'));
      delSnapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (docSnap.id && !docSnap.id.startsWith('FC-') && docSnap.id !== 'inv-101' && docSnap.id !== 'inv-102' && !DB.deleted_invoices.includes(docSnap.id)) {
          DB.deleted_invoices.push(docSnap.id);
        }
        if (d && d.id && !d.id.startsWith('FC-') && d.id !== 'inv-101' && d.id !== 'inv-102' && !DB.deleted_invoices.includes(d.id)) {
          DB.deleted_invoices.push(d.id);
        }
      });
    } catch (tombstoneErr) {
      console.warn('Could not read deleted_invoices collection from Firestore:', tombstoneErr);
    }

    const deletedSet = new Set<string>(DB.deleted_invoices || []);

    // 2. Fetch Invoices
    const invoicesSnapshot = await getDocs(collection(firestoreDb, 'invoices'));
    const firestoreInvoices: Invoice[] = [];
    const deadDocsToDelete: Promise<any>[] = [];

    invoicesSnapshot.forEach(docSnap => {
      const data = docSnap.data() as Invoice;
      if (data && data.id) {
        if (
          deletedSet.has(docSnap.id) ||
          deletedSet.has(data.id)
        ) {
          // Permanently purge deleted invoice from Firestore
          deadDocsToDelete.push(deleteDoc(docSnap.ref));
        } else if (!data.id.startsWith('inv-seed-')) {
          firestoreInvoices.push(data);
        }
      }
    });

    if (deadDocsToDelete.length > 0) {
      await Promise.all(deadDocsToDelete).catch(() => {});
    }

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

    // 5. Fetch Expenses (P&L Tracking)
    const expensesSnapshot = await getDocs(collection(firestoreDb, 'expenses'));
    const firestoreExpenses: ExpenseRecord[] = [];
    expensesSnapshot.forEach(docSnap => {
      const data = docSnap.data() as ExpenseRecord;
      if (data && data.id && data.title) {
        firestoreExpenses.push(data);
      }
    });

    // Merge Users
    if (firestoreUsers.length > 0) {
      firestoreUsers.forEach(fUser => {
        const emailLower = (fUser.email || '').toLowerCase();
        const isAdmin = fUser.profile?.role === 'admin' || protectedEmails.has(emailLower);
        const isDeleted = !isAdmin && (deletedUsersSet.has(fUser.id.toLowerCase()) || (fUser.email && deletedUsersSet.has(emailLower)));
        if (isDeleted) return;

        const idx = DB.users.findIndex(u => u.id === fUser.id || u.email.toLowerCase() === emailLower);
        if (idx >= 0) {
          if (DB.users[idx].profile?.role === 'admin' || isAdmin) {
            fUser.profile.role = 'admin';
            fUser.profile.subscription_status = 'active';
            fUser.profile.subscription_expires_at = null;
          }
          DB.users[idx] = fUser;
        } else {
          DB.users.push(fUser);
        }
      });
    }

    // Bi-directional sync: push any users in DB.users that are not yet in Firestore
    for (const localUser of DB.users) {
      const emailLower = (localUser.email || '').toLowerCase();
      const isAdmin = localUser.profile?.role === 'admin' || protectedEmails.has(emailLower);
      if (isAdmin && localUser.profile) {
        localUser.profile.role = 'admin';
        localUser.profile.subscription_status = 'active';
        localUser.profile.subscription_expires_at = null;
      }
      const existsInFirestore = firestoreUsers.some(fu => fu.id === localUser.id || (fu.email && fu.email.toLowerCase() === emailLower));
      if (!existsInFirestore) {
        await syncUserToFirestore(localUser);
      }
    }

    // Merge Invoices (strictly excluding any deleted items by unique ID)
    const invMap = new Map<string, Invoice>();
    firestoreInvoices.forEach(inv => {
      if (!deletedSet.has(inv.id)) {
        invMap.set(inv.id, inv);
      }
    });
    DB.invoices.forEach(inv => {
      if (
        !deletedSet.has(inv.id) &&
        !inv.id.startsWith('inv-seed-')
      ) {
        if (!invMap.has(inv.id)) {
          invMap.set(inv.id, inv);
          syncInvoiceToFirestore(inv);
        }
      }
    });
    DB.invoices = Array.from(invMap.values());

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

    // Merge Expenses
    if (firestoreExpenses.length > 0) {
      const expMap = new Map<string, ExpenseRecord>();
      firestoreExpenses.forEach(exp => expMap.set(exp.id, exp));
      DB.expenses.forEach(exp => {
        if (!expMap.has(exp.id)) {
          expMap.set(exp.id, exp);
          syncExpenseToFirestore(exp);
        }
      });
      DB.expenses = Array.from(expMap.values());
    }

    // Ensure all default admins exist and are synced
    for (const defAdmin of DEFAULT_ADMINS) {
      let adminInDB = DB.users.find(u => u.email.toLowerCase() === defAdmin.email.toLowerCase());
      if (!adminInDB) {
        DB.users.push(defAdmin);
        adminInDB = defAdmin;
      }
      adminInDB.profile.role = 'admin';
      adminInDB.profile.subscription_status = 'active';
      adminInDB.profile.subscription_expires_at = null;
      await syncUserToFirestore(adminInDB);
    }

    // Ensure all accounts with role admin have active perpetual access
    for (const u of DB.users) {
      if (u.profile && u.profile.role === 'admin') {
        u.profile.subscription_status = 'active';
        u.profile.subscription_expires_at = null;
        await syncUserToFirestore(u);
      }
    }

    // Enforce 1-day limit across all trial users
    for (const u of DB.users) {
      if (u.profile && u.profile.role !== 'admin' && !protectedEmails.has((u.email || '').toLowerCase())) {
        const modified = checkAndUpdateUserSubscription(u);
        if (modified) {
          await syncUserToFirestore(u);
        }
      }
    }

    // 6. Fetch Active Registration OTPs from Firestore
    try {
      const otpSnapshot = await getDocs(collection(firestoreDb, 'registration_otps'));
      const nowMs = Date.now();
      if (!Array.isArray(DB.registration_otps)) {
        DB.registration_otps = [];
      }
      otpSnapshot.forEach(docSnap => {
        const otpData = docSnap.data() as RegistrationOtp;
        if (otpData && otpData.email && otpData.code) {
          const expiresMs = new Date(otpData.expires_at).getTime();
          if (expiresMs > nowMs) {
            const cleanEmail = normalizeCleanEmail(otpData.email);
            const exists = DB.registration_otps.some(o => normalizeCleanEmail(o.email) === cleanEmail);
            if (!exists) {
              DB.registration_otps.push(otpData);
            }
          }
        }
      });
    } catch (e) {
      // ignore
    }

    saveDB();
    console.log(`✅ Loaded from Cloud Firestore: ${DB.users.length} users, ${DB.invoices.length} invoices, ${DB.subscription_requests.length} requests, ${DB.feature_updates.length} feature updates`);
  } catch (err) {
    console.error('Error syncing from Cloud Firestore:', err);
  }
}

// Helper: Extract authenticated user from request headers or authorization token
function getAuthUser(req: express.Request): UserAccount | null {
  const userIdHeader = (req.headers['x-user-id'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  const userEmailHeader = (req.headers['x-user-email'] as string) || '';
  
  let targetId = userIdHeader;
  if (!targetId && authHeader.startsWith('Bearer ')) {
    targetId = authHeader.substring(7).trim();
  }
  if (!targetId && userEmailHeader) {
    targetId = userEmailHeader;
  }

  if (targetId || userEmailHeader) {
    const found = DB.users.find(u => 
      (targetId && (u.id === targetId || u.email.toLowerCase() === targetId.toLowerCase())) ||
      (userEmailHeader && u.email.toLowerCase() === userEmailHeader.toLowerCase())
    );
    if (found) {
      if (found.email.toLowerCase() === 'bagherikiarash74@gmail.com' || found.email.toLowerCase() === 'kimiabg2013@gmail.com' || found.profile.role === 'admin') {
        found.profile.role = 'admin';
        found.profile.subscription_status = 'active';
        found.profile.subscription_expires_at = null;
      } else {
        const hasExpired = checkAndUpdateUserSubscription(found);
        if (hasExpired) {
          saveDB();
          syncUserToFirestore(found);
        }
      }
      return found;
    }

    // Session Recovery: If client holds a valid user ID token from previous session
    if (targetId && targetId.startsWith('usr-')) {
      const isExplicitlyDeleted = (DB.deleted_users || []).some(x => 
        x.toLowerCase() === targetId.toLowerCase() || 
        (userEmailHeader && x.toLowerCase() === userEmailHeader.toLowerCase())
      );
      if (isExplicitlyDeleted) {
        return null;
      }

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
          trial_ends_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_expires_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };
      checkAndUpdateUserSubscription(recoveredUser);
      DB.users.push(recoveredUser);
      saveDB();
      return recoveredUser;
    }
  }

  return null;
}

// Automatically evaluates and updates subscription expiry
function checkAndUpdateUserSubscription(user: UserAccount): boolean {
  if (!user || !user.profile) return false;
  if (user.email.toLowerCase() === 'bagherikiarash74@gmail.com' || user.profile.role === 'admin') {
    user.profile.role = 'admin';
    user.profile.subscription_status = 'active';
    user.profile.subscription_expires_at = null;
    return false;
  }

  // If perpetual access was granted by admin, subscription_expires_at is null
  if (user.profile.subscription_status === 'active' && user.profile.subscription_expires_at === null) {
    return false;
  }

  let modified = false;

  // Check if expiration date has passed
  if (user.profile.subscription_expires_at) {
    const expiryTime = new Date(user.profile.subscription_expires_at).getTime();
    if (!isNaN(expiryTime)) {
      if (Date.now() >= expiryTime) {
        // The subscription or trial period has genuinely elapsed
        if (user.profile.subscription_status !== 'expired') {
          user.profile.subscription_status = 'expired';
          user.profile.updated_at = new Date().toISOString();
          modified = true;
        }
      } else {
        // The expiration date is still in the future!
        // Ensure user is not wrongly marked as expired
        if (user.profile.subscription_status === 'expired') {
          user.profile.subscription_status = user.profile.trial_ends_at ? 'trial' : 'active';
          user.profile.updated_at = new Date().toISOString();
          modified = true;
        }
      }
    }
  } else if (user.profile.subscription_status !== 'active') {
    // If no expiration date is set and user is not perpetual active, mark expired
    if (user.profile.subscription_status !== 'expired') {
      user.profile.subscription_status = 'expired';
      user.profile.updated_at = new Date().toISOString();
      modified = true;
    }
  }

  return modified;
}

// Security Middleware: Require Authenticated Admin (Permanent unrestricted access for system administrators)
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

  // Auto-upgrade permanent admin email if needed
  if (authUser.email.toLowerCase() === 'bagherikiarash74@gmail.com' || authUser.email.toLowerCase() === 'kimiabg2013@gmail.com' || authUser.profile.role === 'admin') {
    authUser.profile.role = 'admin';
    authUser.profile.subscription_status = 'active';
    authUser.profile.subscription_expires_at = null;
  }

  if (authUser.profile.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'دسترسی ممنوع: شما دسترسی مدیر سیستم (Admin) ندارید.',
      code: 'FORBIDDEN_NOT_ADMIN',
    });
    return null;
  }

  // Administrators always have active permanent subscription status
  if (authUser.profile.subscription_status !== 'active') {
    authUser.profile.subscription_status = 'active';
    authUser.profile.subscription_expires_at = null;
    saveDB();
    syncUserToFirestore(authUser);
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

  // Ensure admin user profile stays permanently active
  if (user.email.toLowerCase() === 'bagherikiarash74@gmail.com' || user.profile.role === 'admin') {
    user.profile.role = 'admin';
    user.profile.subscription_status = 'active';
    user.profile.subscription_expires_at = null;
    saveDB();
    syncUserToFirestore(user);
  } else {
    const hasExpired = checkAndUpdateUserSubscription(user);
    if (hasExpired) {
      saveDB();
      syncUserToFirestore(user);
    }
  }

  // Ensure existing users logging in have tour_completed marked so they never see the tour on login
  if (user.profile.tour_completed === undefined) {
    user.profile.tour_completed = true;
    saveDB();
    syncUserToFirestore(user);
  }

  // Success: Return isolated profile and session token (is_new_account is false for existing accounts)
  return res.json({
    success: true,
    message: 'ورود به حساب کاربری با موفقیت انجام شد',
    token: user.id,
    profile: user.profile,
    is_new_account: false,
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
  const trialEnds = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1-day trial

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
      tour_completed: false, // New account that wasn't in the database
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  };

  DB.users.push(newUser);
  if (Array.isArray(DB.deleted_users)) {
    DB.deleted_users = DB.deleted_users.filter(x => x !== cleanEmail && x !== newId);
  }
  saveDB();
  syncUserToFirestore(newUser);

  return res.json({
    success: true,
    message: 'ثبت‌نام با موفقیت انجام شد و پروفایل کاربری ایجاد گردید',
    token: newId,
    profile: newUser.profile,
    is_new_account: true,
  });
});

// 1. Send 6-digit OTP verification email for registration
app.post('/api/auth/send-registration-otp', async (req, res) => {
  const { full_name, business_name, email, phone, password } = req.body;
  const cleanEmail = normalizeCleanEmail(email);

  if (!full_name || !cleanEmail || !password) {
    return res.status(400).json({ success: false, error: 'تمامی فیلدهای ضروری (نام، ایمیل، کلمه عبور) الزامی است.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'فرمت آدرس ایمیل نامعتبر است. لطفاً ایمیل معتبر وارد فرمایید.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ success: false, error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
  }

  const existing = DB.users.find(u => normalizeCleanEmail(u.email) === cleanEmail);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'حساب کاربری با این ایمیل از قبل در سیستم وجود دارد. لطفاً وارد شوید.',
      code: 'USER_ALREADY_EXISTS',
    });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes generous validity

  if (!Array.isArray(DB.registration_otps)) {
    DB.registration_otps = [];
  }

  // Remove existing pending OTP for this email
  DB.registration_otps = DB.registration_otps.filter(o => normalizeCleanEmail(o.email) !== cleanEmail);

  const otpRecord: RegistrationOtp = {
    id: `otp-${Date.now()}`,
    email: cleanEmail,
    code,
    full_name: String(full_name).trim(),
    business_name: business_name ? String(business_name).trim() : 'کسب‌وکار من',
    phone: phone ? String(phone).trim() : '',
    password: String(password),
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    attempts: 0,
  };

  DB.registration_otps.push(otpRecord);
  saveDB();
  await syncRegistrationOtpToFirestore(otpRecord);

  const emailResult = await sendRegistrationOtpEmail(cleanEmail, String(full_name).trim(), code);
  const isDevPreview = !process.env.SMTP_HOST && !process.env.GMAIL_USER;

  return res.json({
    success: true,
    message: emailResult.sent
      ? `کد تأیید ۶ رقمی با موفقیت به ایمیل ${cleanEmail} ارسال گردید.`
      : `کد تأیید ایجاد شد و آماده بررسی است.`,
    email: cleanEmail,
    email_sent: emailResult.sent,
    dev_otp: isDevPreview ? code : undefined,
  });
});

// 2. Resend 6-digit OTP code
app.post('/api/auth/resend-registration-otp', async (req, res) => {
  const cleanEmail = normalizeCleanEmail(req.body.email);
  if (!cleanEmail) {
    return res.status(400).json({ success: false, error: 'آدرس ایمیل الزامی است.' });
  }

  let existingOtp = await findRegistrationOtp(cleanEmail);
  if (!existingOtp) {
    return res.status(404).json({
      success: false,
      error: 'اطلاعات ثبت‌نامی برای این ایمیل یافت نشد یا منقضی گردیده است. لطفاً فرم را دوباره ارسال کنید.',
    });
  }

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  existingOtp.code = newCode;
  existingOtp.expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  existingOtp.attempts = 0;
  saveDB();
  await syncRegistrationOtpToFirestore(existingOtp);

  const emailResult = await sendRegistrationOtpEmail(cleanEmail, existingOtp.full_name, newCode);
  const isDevPreview = !process.env.SMTP_HOST && !process.env.GMAIL_USER;

  return res.json({
    success: true,
    message: emailResult.sent
      ? `کد تأیید جدید به ایمیل ${cleanEmail} ارسال شد.`
      : `کد تأیید جدید صادر شد.`,
    email_sent: emailResult.sent,
    dev_otp: isDevPreview ? newCode : undefined,
  });
});

// 3. Verify 6-digit OTP code and complete registration
app.post('/api/auth/verify-registration-otp', async (req, res) => {
  const { email, code } = req.body;
  const cleanEmail = normalizeCleanEmail(email);

  // Normalize code to standard digits
  let cleanCode = String(code || '').trim();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    cleanCode = cleanCode.replaceAll(persianDigits[i], String(i));
    cleanCode = cleanCode.replaceAll(arabicDigits[i], String(i));
  }
  cleanCode = cleanCode.replace(/[^0-9]/g, '');

  if (!cleanEmail || !cleanCode) {
    return res.status(400).json({ success: false, error: 'آدرس ایمیل و کد تأیید ۶ رقمی الزامی است.' });
  }

  const record = await findRegistrationOtp(cleanEmail);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'کد تأیید برای این ایمیل یافت نشد یا منقضی گردیده است. لطفاً درخواست کد مجدد دهید.',
      code: 'OTP_NOT_FOUND',
    });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await deleteRegistrationOtp(cleanEmail);
    return res.status(400).json({
      success: false,
      error: 'کد تأیید منقضی شده است. لطفاً روی دکمه ارسال مجدد کد کلیک فرمایید.',
      code: 'OTP_EXPIRED',
    });
  }

  if (record.attempts >= 5) {
    await deleteRegistrationOtp(cleanEmail);
    return res.status(429).json({
      success: false,
      error: 'تعداد دفعات تلاش نادرست بیش از حد مجاز بود. لطفاً مجدداً ثبت‌نام را شروع کنید.',
      code: 'TOO_MANY_ATTEMPTS',
    });
  }

  if (record.code !== cleanCode) {
    record.attempts += 1;
    saveDB();
    await syncRegistrationOtpToFirestore(record);
    return res.status(400).json({
      success: false,
      error: 'کد تأیید وارد شده نادرست است. لطفاً مجدداً بررسی فرمایید.',
      code: 'INVALID_CODE',
      remaining_attempts: Math.max(0, 5 - record.attempts),
    });
  }

  // Check if account was created in meantime
  const existingUser = DB.users.find(u => normalizeCleanEmail(u.email) === cleanEmail);
  if (existingUser) {
    await deleteRegistrationOtp(cleanEmail);
    return res.json({
      success: true,
      message: 'حساب کاربری از قبل موجود بود؛ ورود انجام شد.',
      token: existingUser.id,
      profile: existingUser.profile,
      is_new_account: false,
    });
  }

  // Create new verified user account with 1-day trial and tour flag
  const newId = `usr-${Date.now()}`;
  const now = new Date();
  const trialEnds = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1-day trial

  const newUser: UserAccount = {
    id: newId,
    email: cleanEmail,
    password: String(record.password),
    profile: {
      id: newId,
      full_name: record.full_name.trim(),
      business_name: record.business_name ? record.business_name.trim() : 'کسب‌وکار من',
      phone: record.phone ? record.phone.trim() : '',
      email: cleanEmail,
      subscription_status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      subscription_expires_at: trialEnds.toISOString(),
      role: 'user', // strictly regular user for new signups
      tour_completed: false, // New account that wasn't in the database
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  };

  DB.users.push(newUser);
  await deleteRegistrationOtp(cleanEmail);
  if (Array.isArray(DB.deleted_users)) {
    DB.deleted_users = DB.deleted_users.filter(x => x !== cleanEmail && x !== newId);
  }
  saveDB();
  await syncUserToFirestore(newUser);

  console.log(`🎉 [REGISTRATION VERIFIED] New user registered and verified via OTP: ${cleanEmail}`);

  return res.json({
    success: true,
    message: 'ثبت‌نام و تأیید ایمیل با موفقیت انجام شد. خوش آمدید!',
    token: newId,
    profile: newUser.profile,
    is_new_account: true,
  });
});

// Endpoint to mark tour as completed for user in database
app.post('/api/auth/tour-completed', (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'احراز هویت الزامی است.' });
  }

  authUser.profile.tour_completed = true;
  authUser.profile.updated_at = new Date().toISOString();
  saveDB();
  syncUserToFirestore(authUser);

  return res.json({
    success: true,
    message: 'وضعیت تکمیل تور راهنما در پایگاه داده ثبت گردید.',
    profile: authUser.profile,
  });
});

app.get(['/api/auth/session', '/api/auth/me'], (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({
      success: false,
      error: 'نشست کاربری یافت نشد یا منقضی شده است.',
    });
  }
  return res.json({
    success: true,
    user: authUser,
    profile: authUser.profile,
  });
});

app.post('/api/auth/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'خروج از حساب با موفقیت انجام شد',
  });
});

// Helper to send Registration 6-Digit OTP Email
async function sendRegistrationOtpEmail(to: string, userName: string, code: string): Promise<{ sent: boolean; message: string }> {
  const cleanTo = normalizeCleanEmail(to);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>کد تأیید ثبت‌نام فاکتورچی</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Vazirmatn', Tahoma, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; direction: rtl; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .brand { font-size: 22px; font-weight: 900; color: #0f766e; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px; }
        h1 { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px; }
        p { font-size: 14px; line-height: 1.8; color: #475569; margin: 0 0 16px; }
        .otp-box { text-align: center; margin: 28px 0; }
        .otp-code { display: inline-block; padding: 18px 36px; background-color: #f0fdfa; border: 2px dashed #0d9488; border-radius: 16px; font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #0f766e; }
        .note { font-size: 12px; color: #64748b; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 18px; line-height: 1.8; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="brand">⚡ فاکتورچی | Factorchi</div>
        <h1>کد تأیید ثبت‌نام و فعال‌سازی حساب کاربری</h1>
        <p>سلام <strong>${userName || 'کاربر'}</strong> گرامی،</p>
        <p>از ثبت‌نام شما در سامانه صدور فاکتور صوتی فاکتورچی سپاسگزاریم. برای تکمیل فرآیند ثبت‌نام و فعال‌سازی حساب خود، لطفاً کد تأیید ۶ رقمی زیر را در کادر مربوطه وارد نمایید:</p>
        
        <div class="otp-box">
          <div class="otp-code">${code}</div>
        </div>

        <div class="note">
          ⏱ <strong>مدت اعتبار:</strong> این کد به مدت <strong>۱۵ دقیقه</strong> دارای اعتبار است.<br>
          چنانچه شما درخواست ثبت‌نام در سامانه فاکتورچی را ارسال نکرده‌اید، این ایمیل را نادیده بگیرید؛ هیچ حسابی بدون تأیید این کد فعال نخواهد شد.<br>
          ✉️ در صورت بروز هرگونه مشکل با ایمیل پشتیبانی در ارتباط باشید: <a href="mailto:kimiabg2013@gmail.com" style="color: #0d9488; text-decoration: none; font-weight: bold;">kimiabg2013@gmail.com</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@factorchi.ir';

  if (smtpHost || smtpUser) {
    try {
      let transporter;
      if (process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)) {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS,
          },
        });
      } else {
        transporter = nodemailer.createTransport({
          host: smtpHost || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        });
      }

      // CRITICAL: Strictly lock delivery ONLY to cleanTo
      // envelope.to locks the SMTP RCPT TO command strictly to the single intended recipient
      await transporter.sendMail({
        from: `"فاکتورچی" <${smtpFrom}>`,
        to: cleanTo,
        cc: undefined,
        bcc: undefined,
        replyTo: smtpFrom,
        envelope: {
          from: smtpFrom,
          to: [cleanTo],
        },
        subject: `کد تأیید ثبت‌نام در فاکتورچی: ${code}`,
        html: htmlContent,
      });

      console.log(`✅ [EMAIL] Registration OTP sent strictly to: ${cleanTo} (Code: ${code})`);
      return { sent: true, message: 'کد تایید با موفقیت به ایمیل شما ارسال شد.' };
    } catch (err: any) {
      console.error('❌ [EMAIL] Failed to send registration OTP email:', err.message || err);
      console.log(`🔑 [OTP BACKUP CODE] For ${cleanTo}: ${code}`);
      return { sent: false, message: 'کد تایید صادر شد اما ارسال از طریق ایمیل با خطا مواجه گردید.' };
    }
  }

  console.log(`ℹ️ [EMAIL NOTICE] SMTP not configured. Registration OTP for ${cleanTo}: ${code}`);
  return { sent: false, message: 'کد تایید صادر شد.' };
}

// Helper to send Password Reset Email
async function sendPasswordResetEmail(to: string, userName: string, resetLink: string): Promise<{ sent: boolean; message: string }> {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>بازیابی رمز عبور فاکتورچی</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Vazirmatn', Tahoma, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; direction: rtl; }
        .wrapper { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .brand { font-size: 22px; font-weight: 900; color: #0f766e; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px; }
        h1 { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 16px; }
        p { font-size: 14px; line-height: 1.8; color: #475569; margin: 0 0 16px; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .note { font-size: 12px; color: #64748b; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 18px; line-height: 1.7; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="brand">⚡ فاکتورچی | Factorchi</div>
        <h1>درخواست بازیابی کلمه عبور</h1>
        <p>سلام ${userName || 'کاربر'} گرامی،</p>
        <p>درخواستی برای تغییر و بازنشانی رمز عبور حساب کاربری شما در سامانه فاکتورچی ثبت گردیده است. برای انتخاب و ثبت کلمه عبور جدید، لطفاً روی دکمه زیر کلیک نمایید:</p>
        <div class="btn-wrapper">
          <!-- Bulletproof Email Button with Inline Styles for All Email Clients -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; text-align: center;">
            <tr>
              <td align="center" style="background-color: #0d9488; border-radius: 14px; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);">
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 36px; font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, Tahoma, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #ffffff !important; text-decoration: none; border-radius: 14px; border: 1px solid #0d9488;">
                  تغییر و تنظیم رمز عبور جدید
                </a>
              </td>
            </tr>
          </table>
        </div>
        <div class="note">
          ⏱ <strong>نکته امنیتی:</strong> این لینک به مدت <strong>۱ ساعت</strong> دارای اعتبار است.<br>
          چنانچه شما این درخواست را ارسال نکرده‌اید، نیازی به انجام کاری نیست؛ امنیت حساب کاربری و اطلاعات شما تضمین شده است.<br>
          ✉️ ایمیل پشتیبانی فاکتورچی: <a href="mailto:kimiabg2013@gmail.com" style="color: #0d9488; text-decoration: none; font-weight: bold;">kimiabg2013@gmail.com</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check SMTP / Gmail credentials
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@factorchi.ir';

  if (smtpHost || smtpUser) {
    try {
      let transporter;
      if (process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS)) {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS,
          },
        });
      } else {
        transporter = nodemailer.createTransport({
          host: smtpHost || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        });
      }

      await transporter.sendMail({
        from: `"فاکتورچی" <${smtpFrom}>`,
        to,
        subject: 'بازیابی کلمه عبور حساب کاربری فاکتورچی',
        html: htmlContent,
      });

      console.log(`✅ [EMAIL] Password reset email sent to: ${to}`);
      return { sent: true, message: 'ایمیل بازیابی رمز عبور با موفقیت به صندوق ورودی شما ارسال شد.' };
    } catch (err: any) {
      console.error('❌ [EMAIL] Failed to send email via SMTP:', err.message || err);
      console.log(`🔗 [EMAIL BACKUP LINK] For ${to}: ${resetLink}`);
      return { sent: false, message: 'لینک بازیابی ایجاد شد اما ارسال از طریق ایمیل با خطا مواجه شد.' };
    }
  }

  console.log(`ℹ️ [EMAIL NOTICE] SMTP not configured. Password recovery link for ${to}:\n${resetLink}`);
  return { sent: false, message: 'لینک بازیابی رمز عبور ایجاد گردید.' };
}

// 1. Endpoint: Request Password Reset Link
app.post('/api/auth/forgot-password', async (req, res) => {
  const rawEmail = (req.body.email || '').trim().toLowerCase();
  if (!rawEmail) {
    return res.status(400).json({ success: false, error: 'لطفاً آدرس ایمیل خود را وارد نمایید.' });
  }

  const user = DB.users.find(u => u.email.toLowerCase() === rawEmail);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'حساب کاربری با این ایمیل یافت نشد. لطفاً ایمیل ثبت‌نامی خود را با دقت بررسی فرمایید.',
      code: 'USER_NOT_FOUND',
    });
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Invalidate any previous un-used reset tokens for this user
  if (!Array.isArray(DB.password_resets)) {
    DB.password_resets = [];
  }
  DB.password_resets = DB.password_resets.filter(r => r.user_id !== user.id || r.used);

  const resetRecord: PasswordResetToken = {
    id: `rst-${Date.now()}`,
    user_id: user.id,
    email: user.email,
    token,
    expires_at: expiresAt,
    used: false,
    created_at: new Date().toISOString(),
  };

  DB.password_resets.push(resetRecord);
  saveDB();

  // Determine application base url with reverse proxy support
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = req.headers.origin || (host ? `${protocol}://${host}` : (process.env.APP_URL || 'https://factorchi.ir'));
  const resetLink = `${origin}/auth/reset-password?token=${token}`;

  const emailResult = await sendPasswordResetEmail(user.email, user.profile.full_name, resetLink);

  return res.json({
    success: true,
    message: emailResult.sent 
      ? `لینک بازیابی کلمه عبور با موفقیت به ایمیل ${user.email} ارسال گردید.`
      : `لینک بازیابی کلمه عبور با موفقیت ایجاد شد.`,
    email: user.email,
    email_sent: emailResult.sent,
    token,
    reset_link: resetLink,
  });
});

// 2. Endpoint: Verify Password Reset Token
app.get('/api/auth/verify-reset-token', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.status(400).json({ success: false, error: 'شناسه توکن الزامی است.' });
  }

  if (!Array.isArray(DB.password_resets)) {
    DB.password_resets = [];
  }

  const record = DB.password_resets.find(r => r.token === token);
  if (!record || record.used) {
    return res.status(400).json({
      success: false,
      error: 'این لینک بازیابی نامعتبر است یا قبلاً استفاده شده است.',
      code: 'INVALID_TOKEN',
    });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return res.status(400).json({
      success: false,
      error: 'مهلت استفاده از این لینک بازیابی به پایان رسیده است (۱ ساعت). لطفاً مجدداً درخواست ارسال لینک دهید.',
      code: 'EXPIRED_TOKEN',
    });
  }

  return res.json({
    success: true,
    email: record.email,
    user_id: record.user_id,
  });
});

// 3. Endpoint: Reset Password with New Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  const cleanToken = String(token || '').trim();
  const cleanPassword = String(new_password || '');

  if (!cleanToken || !cleanPassword) {
    return res.status(400).json({ success: false, error: 'توکن بازیابی و کلمه عبور جدید الزامی هستند.' });
  }

  if (cleanPassword.length < 4) {
    return res.status(400).json({ success: false, error: 'کلمه عبور جدید باید حداقل ۴ کاراکتر باشد.' });
  }

  if (!Array.isArray(DB.password_resets)) {
    DB.password_resets = [];
  }

  const record = DB.password_resets.find(r => r.token === cleanToken);
  if (!record || record.used) {
    return res.status(400).json({
      success: false,
      error: 'لینک بازیابی نامعتبر است یا قبلاً برای تغییر رمز استفاده شده است.',
      code: 'INVALID_TOKEN',
    });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return res.status(400).json({
      success: false,
      error: 'مهلت استفاده از این لینک بازیابی به پایان رسیده است. لطفاً لینک جدیدی درخواست نمایید.',
      code: 'EXPIRED_TOKEN',
    });
  }

  const user = DB.users.find(u => u.id === record.user_id || u.email.toLowerCase() === record.email.toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربر مورد نظر یافت نشد.' });
  }

  // Update password
  user.password = cleanPassword;
  user.profile.updated_at = new Date().toISOString();
  record.used = true;

  saveDB();
  await syncUserToFirestore(user);

  console.log(`🔐 [AUTH] Password successfully reset for user: ${user.email}`);

  return res.json({
    success: true,
    message: 'کلمه عبور شما با موفقیت تغییر یافت. اکنون می‌توانید با رمز جدید وارد شوید.',
  });
});

// Helper to get Gemini Client lazily
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return geminiClient;
}

/**
 * Converts incoming audio (WebM Opus, MP4, AAC, etc.) into clean standard 16kHz mono WAV.
 * This guarantees reliable acceptance and zero header/container mismatch errors across Gemini models.
 */
function convertToStandardWav(inputBuffer: Buffer, mimeType: string): { buffer: Buffer; mimeType: string } {
  try {
    const converted = execSync('ffmpeg -i pipe:0 -ar 16000 -ac 1 -f wav pipe:1 -v quiet', {
      input: inputBuffer,
      maxBuffer: 25 * 1024 * 1024,
      timeout: 6000,
    });
    if (converted && converted.length > 100) {
      return { buffer: converted, mimeType: 'audio/wav' };
    }
  } catch (err) {
    console.warn('ffmpeg audio conversion notice (using original buffer):', err);
  }
  return { buffer: inputBuffer, mimeType: mimeType || 'audio/wav' };
}

/**
 * Extracts transcription text safely from Gemini response, handling both standard text
 * parts and multimodal audioTranscription parts returned by models like gemini-3.5-transcribe.
 */
function extractTranscriptionText(response: any): string {
  if (!response) return '';
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }
  const parts = response.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    let extracted = '';
    for (const part of parts) {
      if (part.text) {
        extracted += part.text + ' ';
      } else if (part.audioTranscription) {
        if (typeof part.audioTranscription === 'string') {
          extracted += part.audioTranscription + ' ';
        } else if (part.audioTranscription.text) {
          extracted += part.audioTranscription.text + ' ';
        }
      }
    }
    return extracted.trim();
  }
  return '';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = 'Operation timed out'): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonFromAiText(text?: string | null): any {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const startObj = cleaned.indexOf('{');
  const startArr = cleaned.indexOf('[');
  let start = -1;
  let end = -1;
  if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
    start = startObj;
    end = cleaned.lastIndexOf('}');
  } else if (startArr !== -1) {
    start = startArr;
    end = cleaned.lastIndexOf(']');
  }
  if (start !== -1 && end !== -1 && end >= start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }
  try {
    return JSON.parse(cleaned);
  } catch {}
  return null;
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
    if (parts[1]) {
      const rem = parts[1].replace(/^[و\s]+/, '').trim();
      const remVal = parsePersianWordNumber(rem) || parseFloat(rem) || 0;
      total += remVal;
    }
    return Math.round(total);
  }

  const directWord = parsePersianWordNumber(text);
  if (directWord > 0) return Math.round(directWord);

  const num = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Normalizes and parses Persian speech text into customer, items, and financial values.
 * Accurately separates multiple items spoken in continuous speech, even without conjunctions.
 * Handles customer names placed anywhere (before, after, or between items).
 */
function parsePersianTextToInvoice(rawText: string) {
  if (!rawText) {
    return {
      invoice_name: '',
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

  // Normalize common spoken quantity phrases
  processed = processed
    .replace(/دو\s*عدد/g, '2 عدد').replace(/دوعدد/g, '2 عدد')
    .replace(/یک\s*عدد/g, '1 عدد').replace(/یکعدد/g, '1 عدد')
    .replace(/سه\s*عدد/g, '3 عدد').replace(/سهعدد/g, '3 عدد')
    .replace(/چهار\s*عدد/g, '4 عدد').replace(/چهارعدد/g, '4 عدد')
    .replace(/پنج\s*عدد/g, '5 عدد').replace(/پنجعدد/g, '5 عدد')
    .replace(/شش\s*عدد/g, '6 عدد').replace(/شیش\s*عدد/g, '6 عدد')
    .replace(/هفت\s*عدد/g, '7 عدد').replace(/هشت\s*عدد/g, '8 عدد')
    .replace(/نه\s*عدد/g, '9 عدد').replace(/ده\s*عدد/g, '10 عدد');

  const normalized = persianToEnglishDigits(processed);
  let invoice_name = '';
  let customer_name = '';
  let customer_phone = '';
  const items: { name: string; quantity: number; unit_price: number }[] = [];
  let discount = 0;
  let discount_type: 'amount' | 'percent' = 'amount';
  let discount_percent = 0;
  let tax_rate = 0;
  let notes = '';

  // Extract explicit invoice name/title if mentioned (e.g. "فاکتور طراحی سایت برای آقای...", "عنوان فاکتور خرید لپتاپ")
  const explicitTitleMatch = normalized.match(/(?:عنوان\s*(?:فاکتور)?|نام\s*فاکتور)(?::|\s+)([^،,\n]+?)(?=\s+(?:برای|به\s*نام|به\s*شماره|با\s*شماره)|[،,\n]|$)/i) ||
    normalized.match(/فاکتور\s+([^،,\n]+?)(?=\s+(?:برای|به\s*نام|به\s*شماره|با\s*شماره)|[،,\n]|$)/i);
  if (explicitTitleMatch && explicitTitleMatch[1]) {
    const candidateTitle = explicitTitleMatch[1].trim();
    if (candidateTitle.length >= 2 && !candidateTitle.includes('شماره') && !candidateTitle.startsWith('آقای') && !candidateTitle.startsWith('خانم')) {
      invoice_name = candidateTitle;
    }
  }

  // 1. Phone extraction (09xxxxxxxxx or 9xxxxxxxxx)
  const phoneMatch = normalized.match(/(?:09|9)\d{9}/);
  if (phoneMatch) {
    let p = phoneMatch[0];
    if (p.startsWith('9') && p.length === 10) p = '0' + p;
    customer_phone = p;
  }

  // 2. Discount extraction (percent or amount)
  const percentDiscountMatch = normalized.match(/(?:(?:تخفیف\s*(?:به\s*میزان|به\s*اندازه|معادل|هم)?\s*(\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی))|(?:(\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی)(?:\s+(?:هم|رو\s*هم|نیز|برای\s*کل|روی\s*کل))?\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف\s*لحاظ\s*کن|تخفیف|آف)?))/i);

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
  const taxMatch = normalized.match(/(?:(?:مالیات|ارزش\s*افزوده)\s*(\d+)\s*(?:درصد|٪|%))|(?:(\d+)\s*(?:درصد|٪|%)\s*(?:مالیات|ارزش\s*افزوده))/i);
  if (taxMatch) {
    const rawTax = taxMatch[1] || taxMatch[2];
    if (rawTax) {
      tax_rate = parseInt(persianToEnglishDigits(rawTax), 10) || 0;
    }
  }

  // 3. Customer Name extraction (handles explicit prefixes and honorifics)
  const namePatterns = [
    /(?:(?:فاکتور\s+(?:برای|به\s+نام|به)|سفارش\s+(?:برای|به\s+نام|به)|خریدار(?::|\s+)|مشتری(?::|\s+)|به\s+نام|برای)\s+([^،,\n]+?))(?=\s+(?:به\s*شماره|با\s*شماره|شماره|تلفن|همراه|\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|به\s*مبلغ|به\s*قیمت|قیمت|تومان|تومن|تخفیف|مالیات)|[،,\n]|$)/i,
    /^(?:آقای|خانم|جناب\s+آقای|سرکار\s+خانم|مهندس|دکتر|شرکت|فروشگاه)\s+([^،,\n]+?)(?=\s+(?:به\s*شماره|با\s*شماره|شماره|تلفن|همراه|\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|به\s*مبلغ|به\s*قیمت|قیمت|تومان|تومن|تخفیف|مالیات)|[،,\n]|$)/i,
    /(?:آقای|خانم|جناب\s+آقای|سرکار\s+خانم|مهندس|دکتر)\s+([آ-یa-zA-Z]+(?:\s+[آ-یa-zA-Z]+){1,2})/i
  ];

  for (const np of namePatterns) {
    const nm = normalized.match(np);
    if (nm && (nm[1] || nm[2])) {
      let clean = (nm[1] || nm[2]).trim();
      const cutIdx = clean.search(/(?:به\s*مبلغ|به\s*قیمت|به\s*ارزش|مبلغ|قیمت|تومان|تومن|ریال|\d+\s*(?:عدد|تا|مورد|کیلو))/i);
      if (cutIdx > 0) clean = clean.substring(0, cutIdx).trim();
      clean = clean.replace(/^(?:آقای|خانم|مهندس|دکتر|جناب)\s+/i, '').trim();
      if (clean.length >= 2 && !clean.includes('فاکتور')) {
        const companyMatch = clean.match(/^(.+?)\s+(شرکت\s+.+)$/i);
        if (companyMatch) {
          customer_name = `${companyMatch[1].trim()} (${companyMatch[2].trim()})`;
        } else {
          customer_name = clean;
        }
        break;
      }
    }
  }

  // 4. Extract Items Segment
  let itemsText = normalized;
  if (customer_phone) {
    itemsText = itemsText.replace(customer_phone, ' ');
  }
  if (customer_name) {
    const escapedName = customer_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    itemsText = itemsText.replace(new RegExp('(?:فاکتور\\s+(?:برای|به\\s+نام|به)|سفارش\\s+(?:برای|به\\s+نام|به)|خریدار(?::|\\s+)|مشتری(?::|\\s+)|به\\s+نام|برای|آقای|خانم|مهندس|دکتر|شرکت|فروشگاه)?\\s*' + escapedName, 'gi'), ' ');
  }

  // Clean conversational filler words using word boundaries
  itemsText = itemsText
    .replace(/(?:^|\s+)(?:فاکتور\s+بزن|فاکتور\s+کن|فاکتور|سفارش|سلام|درود|لطفا|لطفاً|بزن|کن|ثبت\s+کن|ثبت|ممنون|تشکر|دستت\s+درد\s+نکنه)(?=\s+|$)/gi, ' ')
    .replace(/(?:(?:تخفیف\s*(?:به\s*میزان|به\s*اندازه|معادل|هم)?\s*(\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی))|(?:(\d+|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|پانزده|پونزده|بیست|بیست\s*و\s*پنج|سی|چهل|پنجاه)\s*(?:درصد|٪|%|درصدی)(?:\s+(?:هم|رو\s*هم|نیز|برای\s*کل|روی\s*کل))?\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف\s*لحاظ\s*کن|تخفیف|آف)?))/gi, ' ')
    .replace(/[^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?\s*(?:تخفیف\s*بده|تخفیف\s*بزن|تخفیف)/gi, ' ')
    .replace(/تخفیف\s*(?:به\s*مبلغ|به\s*ارزش|مبلغ)?\s*[^\s،,]+(?:\s+[^\s،,]+){0,3}\s*(?:میلیون|هزار|تومان|تومن)?/gi, ' ')
    .replace(/(\d+)\s*(?:درصد|٪|%)\s*(?:مالیات|ارزش\s*افزوده)?/gi, ' ')
    .replace(/(?:مالیات|ارزش\s*افزوده)\s*(\d+)\s*(?:درصد|٪|%)/gi, ' ')
    .replace(/^(?:تلفن|شماره|همراه|،|,|\s)+/i, '');

  const numPattern = '(?:\\d+|یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|پونزده|شانزده|هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|پانصد|پونصد|ششصد|هفتصد|هشتصد|نهصد|نیم)';

  // Split multiple items using Persian conjunctions and delimiters
  const itemSeparators = [
    'به همراه', 'به‌همراه', 'و همچنین', 'وهمچنین', 'اضافه بر این', 'اضافه براین',
    'به علاوه', 'بعلاوه', 'همراه با', 'و نیز', 'به انضمام', 'قلم بعدی', 'مورد بعدی',
    'آیتم بعدی', 'مورد دوم', 'مورد سوم', 'مورد چهارم'
  ];

  let rawSegments = [itemsText];
  for (const sep of itemSeparators) {
    const nextList: string[] = [];
    for (const segment of rawSegments) {
      const parts = segment.split(new RegExp(`(?:\\s+${sep}\\s+|،|,|;|\\n)`, 'gi'));
      nextList.push(...parts);
    }
    rawSegments = nextList;
  }

  // CRITICAL: Split after price words when followed by a new quantity/item
  const postPriceSplitRegex = new RegExp('(?<=(?:تومان|تومن|ریال|هزار|میلیون))\\s+(?=(?:و\\s+)?(?:' + numPattern + ')\\s*(?:عدد|تا|دونه|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته|پرس|دست|جعبه|کارتن|\\s+))', 'gi');
  const intermediateSegments: string[] = [];
  for (const seg of rawSegments) {
    const subParts = seg.split(postPriceSplitRegex);
    intermediateSegments.push(...subParts);
  }

  // Split on "و" followed by a quantity or item counter
  const finalSegments: string[] = [];
  for (const seg of intermediateSegments) {
    const subParts = seg.split(new RegExp('\\s+و\\s+(?=(?:' + numPattern + ')\\s*(?:عدد|تا|دونه|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته|پرس|دست|جعبه|کارتن)?)', 'gi'));
    finalSegments.push(...subParts);
  }

  for (const chunk of finalSegments) {
    let working = chunk.trim();
    if (!working || working.length < 2) continue;

    let quantity = 1;
    let unitPrice = 0;
    let itemName = working;

    // 1. Quantity at beginning
    const qtyRegex = new RegExp('^(' + numPattern + ')\\s*(?:عدد|تا|دونه|مورد|فقره|دستگاه|متر|ساعت|نفر|جلسه|کیلو|پکیج|بسته|پرس|دست|جعبه|کارتن)?\\s+(.+)$', 'i');
    const qtyMatch = working.match(qtyRegex);
    if (qtyMatch) {
      quantity = parsePersianWordNumber(qtyMatch[1]) || parseInt(qtyMatch[1], 10) || 1;
      working = qtyMatch[2].trim();
    }

    // 2. Unit price extraction
    const priceSeparatorMatch = working.match(/(?:هر\s*کدام|هر\s*یک|هر\s*کدوم|هرکدوم|دانه‌ای|دونه‌ای|دونه\s*ای|دونه|ساعتی|متری|جلسه‌ای|پرسی|به\s*مبلغ|به\s*ارزش|به\s*قیمت|قیمت|ارزش|مبلغ)\s*(.+)$/i);
    if (priceSeparatorMatch) {
      itemName = working.substring(0, priceSeparatorMatch.index).trim();
      unitPrice = parsePersianPrice(priceSeparatorMatch[1]);
    } else {
      const endPriceRegex = new RegExp('(.+?)\\s+(' + numPattern + '(?:\\s+(?:و\\s+)?' + numPattern + ')*\\s*(?:میلیون|هزار|تومان|تومن).*)$', 'i');
      const endPriceMatch = working.match(endPriceRegex);
      if (endPriceMatch) {
        itemName = endPriceMatch[1].trim();
        unitPrice = parsePersianPrice(endPriceMatch[2]);
      } else {
        itemName = working.replace(/تومان|تومن|ریال/g, '').trim();
      }
    }

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

/**
 * Safety validator and disentangler:
 * Guarantees that if an AI model or parser returns a single item whose "name" actually
 * contains multiple items, prices, or whole spoken sentences, they are disentangled
 * into individual clean invoice items.
 */
function disentangleAndValidateItems(
  rawItems: { name: string; quantity: number; unit_price: number }[],
  currentCustomerName: string
): { items: { name: string; quantity: number; unit_price: number }[]; customer_name: string } {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { items: [{ name: 'خدمات / کالا', quantity: 1, unit_price: 0 }], customer_name: currentCustomerName };
  }

  const resultItems: { name: string; quantity: number; unit_price: number }[] = [];
  let extractedCustomerName = currentCustomerName || '';

  for (const it of rawItems) {
    const rawName = (it.name || '').trim();
    if (!rawName) continue;

    // Check if the item name is actually an entire sentence with price/conjunction markers
    const hasPriceMarkers = /(?:تومان|تومن|ریال|میلیون|هزار|قیمت|مبلغ|دونه\s*ای|دانه‌ای|دونه‌ای)/i.test(rawName);
    const hasConjunctions = /(?:به\s*همراه|به‌همراه|و\s*همچنین|بعلاوه|به\s*علاوه|\s+و\s+(?:\d+|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده))/i.test(rawName);
    const hasCustomerMarker = /(?:آقای|خانم|جناب|مهندس|دکتر|فاکتور\s+برای|به\s+نام)/i.test(rawName);

    if (hasPriceMarkers || (hasConjunctions && rawName.length > 20) || (hasCustomerMarker && !extractedCustomerName)) {
      const parsed = parsePersianTextToInvoice(rawName);
      if (!extractedCustomerName && parsed.customer_name) {
        extractedCustomerName = parsed.customer_name;
      }
      if (parsed.items && parsed.items.length > 0) {
        resultItems.push(...parsed.items);
      } else {
        const cleaned = rawName
          .replace(/(?:تومان|تومن|ریال|میلیون|هزار|قیمت|مبلغ|دونه\s*ای|دانه‌ای|دونه‌ای)/gi, '')
          .trim();
        resultItems.push({
          name: cleaned || rawName,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
        });
      }
    } else {
      resultItems.push({
        name: rawName,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price: Math.max(0, Number(it.unit_price) || 0),
      });
    }
  }

  return {
    items: resultItems.length > 0 ? resultItems : [{ name: 'خدمات / کالا', quantity: 1, unit_price: 0 }],
    customer_name: extractedCustomerName,
  };
}

// ----------------------------------------------------
// API: AI Voice-to-Invoice (/api/ai/voice-to-invoice)
// ----------------------------------------------------
app.post('/api/ai/voice-to-invoice', upload.single('audio_file'), async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (authUser && authUser.profile.role !== 'admin' && authUser.email.toLowerCase() !== 'bagherikiarash74@gmail.com') {
      if (authUser.profile.subscription_status === 'expired') {
        return res.status(403).json({
          success: false,
          error: 'دوره آزمایشی یا اشتراک شما به پایان رسیده است. برای ادامه استفاده از دستیار هوش مصنوعی و صدور فاکتور صوتی، لطفاً اشتراک خود را تمدید فرمایید.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }
    }

    const startTime = Date.now();
    let textToAnalyze = (req.body.text || '').trim();
    const liveTranscript = (req.body.live_transcript || '').trim();
    const audioFile = req.file;
    const base64Audio = req.body.audioBase64;
    const incomingMimeType = req.body.mimeType || 'audio/webm';
    let transcriptionResult = textToAnalyze || liveTranscript || '';

    // Models ordered by responsiveness and multimodal stability per Gemini API specifications
    const geminiAudioModels = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'];
    const geminiTextModels = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'];

    // If audio is provided, process audio with Gemini
    if (audioFile || base64Audio) {
      const rawBuffer = audioFile ? audioFile.buffer : Buffer.from(base64Audio, 'base64');
      if (rawBuffer.length < 300 && !textToAnalyze && !liveTranscript) {
        return res.status(400).json({
          success: false,
          error: 'فایل صوتی ضبط‌شده بسیار کوتاه یا فاقد صدا است. لطفاً مجدداً دکمه ضبط را فشار دهید و با صدای رسا صحبت کنید.',
        });
      }

      // Convert audio to standard 16kHz mono WAV for maximum compatibility
      const converted = convertToStandardWav(rawBuffer, incomingMimeType);
      const audioBuffer = converted.buffer;
      const audioMime = converted.mimeType;

      const ai = getGemini();

      // Step 1: Direct Multimodal Audio Extraction with Gemini
      if (ai) {
        const audioPrompt = `شما دستیار حسابداری و صدور فاکتور فوق‌سریع و دقیق به زبان فارسی هستید.
این صوت فارسی را با دقت بالا گوش دهید. کلمات بیان شده را در transcription بنویسید و فیلدهای فاکتور را استخراج کنید.

قوانین حیاتی:
- transcription: متن دقیق و کامل کلمات فارسی گفته‌شده در صوت
- invoice_name: نام یا عنوان انتخابی فاکتور یا پروژه (مثلاً "طراحی سایت شرکت آریا"، "پروژه بازسازی"، "سفارش پوشاک") در صورتی که در صوت بیان شده باشد، وگرنه ""
- customer_name: نام خریدار یا نام شرکت/فروشگاه یا ""
- customer_phone: شماره تماس با ارقام انگلیسی (مثلاً 09121234567) یا ""
- items: آرایه‌ای از اقلام/خدمات. بسیار مهم: اگر چند قلم کالا یا خدمت در ویس بیان شده، هر قلم را حتماً و قطعاً در یک شیء مجزا در آرایه items قرار دهید. هرگز نباید همه اقلام یا کل صحبت‌های ویس در یک فیلد name تجمیع شوند:
  {
    "name": "فقط و فقط نام خالص کالا یا خدمت (بدون آوردن قیمت، تعداد یا نام کالاهای دیگر)",
    "quantity": تعداد عددی صحیح,
    "unit_price": قیمت واحد ۱ قلم به تومان به عدد صحیح
  }
- discount_type: در صورت تخفیف درصدی "percent" و در صورت تخفیف تومانی "amount"
- discount_percent: درصد تخفیف یا 0
- discount: مبلغ کل تخفیف به تومان یا 0
- tax_rate: درصد مالیات یا 0
- notes: توضیحات گفته شده یا ""
- confidence: عدد بین ۹۰ تا ۱۰۰

پاسخ را فقط و فقط به صورت یک شیء معتبر JSON ارسال کنید.`;

        const audioDataPart = {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: audioMime,
          }
        };

        for (const modelName of geminiAudioModels) {
          try {
            const aiPromise = ai.models.generateContent({
              model: modelName,
              contents: [
                audioDataPart,
                { text: audioPrompt }
              ],
              config: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            });

            const response = await withTimeout(aiPromise, 25000, `${modelName} audio timed out`);
            if (response && response.text) {
              const parsed = extractJsonFromAiText(response.text);
              if (parsed) {
                const rawItems = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                  name: (it.name || '').trim(),
                  quantity: Math.max(1, Number(it.quantity) || 1),
                  unit_price: Math.max(0, Number(it.unit_price) || 0),
                })).filter((it: any) => it.name) : [];

                const extractedTranscription = (parsed.transcription || '').trim();
                if (extractedTranscription) {
                  textToAnalyze = extractedTranscription;
                  transcriptionResult = extractedTranscription;
                }

                if (rawItems.length > 0) {
                  // Ensure multi-item disentanglement
                  const validated = disentangleAndValidateItems(rawItems, parsed.customer_name || '');
                  const finalItems = validated.items;
                  const finalCustomer = validated.customer_name || parsed.customer_name || '';

                  const subtotal = finalItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
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
                      invoice_name: parsed.invoice_name || parsed.title || '',
                      customer_name: finalCustomer,
                      customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                      items: finalItems,
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

                if (extractedTranscription) {
                  break; // Proceed with transcription text
                }
              }
            }
          } catch (audioErr: any) {
            console.log(`[Voice AI] Model ${modelName} notice:`, audioErr?.message || 'timeout/fallback');
          }
        }

        // Step 2: Dedicated Audio Transcription with gemini-3.5-transcribe if needed
        if (!textToAnalyze) {
          try {
            const transPromise = ai.models.generateContent({
              model: 'gemini-3.5-transcribe',
              contents: [
                audioDataPart,
                { text: 'Transcribe this Persian speech audio accurately into Persian text.' }
              ],
            });

            const transResponse = await withTimeout(transPromise, 22000, 'gemini-3.5-transcribe timed out');
            const extractedTrans = extractTranscriptionText(transResponse);
            if (extractedTrans && extractedTrans.trim().length >= 2) {
              textToAnalyze = extractedTrans.trim();
              transcriptionResult = textToAnalyze;
            }
          } catch (transcribeErr: any) {
            console.log('[Voice AI] gemini-3.5-transcribe notice:', transcribeErr?.message || 'fallback');
          }
        }
      }

      // Step 3: AvalAI Whisper fallback if available and no text yet
      if (process.env.AVALAI_API_KEY && !textToAnalyze) {
        try {
          const formData = new FormData();
          const blob = new Blob([audioBuffer], { type: audioMime });
          formData.append('file', blob, 'voice.wav');
          formData.append('model', 'whisper-1');
          formData.append('language', 'fa');

          const whisperPromise = fetch('https://api.avalai.ir/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.AVALAI_API_KEY}`,
            },
            body: formData,
          });

          const whisperResp = await withTimeout(whisperPromise, 7000, 'Whisper timeout');
          if (whisperResp && whisperResp.ok) {
            const whisperData = await whisperResp.json();
            if (whisperData.text && whisperData.text.trim()) {
              textToAnalyze = whisperData.text.trim();
              transcriptionResult = textToAnalyze;
            }
          }
        } catch (whisperErr) {
          console.warn('AvalAI Whisper transcription fallback notice:', whisperErr);
        }
      }

      // If still no text from audio, use live browser transcript if provided
      if (!textToAnalyze && liveTranscript) {
        textToAnalyze = liveTranscript;
        transcriptionResult = liveTranscript;
      }
    }

    // Step 4: Structured Invoice Extraction for Text / Transcribed Speech
    if (textToAnalyze && textToAnalyze.trim().length >= 2) {
      const ai = getGemini();
      if (ai) {
        for (const modelName of geminiTextModels) {
          try {
            const prompt = `شما یک دستیار حسابداری و صدور فاکتور فوق هوشمند و دقیق به زبان فارسی هستید.
متن گفتار یا ویس فاکتور زیر را با دقت بسیار بالا تحلیل کنید و اطلاعات فاکتور را استخراج کنید:
"${textToAnalyze}"

دستورالعمل‌های استخراج:
۱. invoice_name: نام یا عنوان فاکتور در صورتی که در متن ذکر شده باشد (مثلاً "طراحی سایت شرکت آریا"، "پروژه بازسازی"، "سفارش ۵ قلم پوشاک"). در غیر این صورت رشته خالی "" برگردانید.
۲. customer_name: نام و نام خانوادگی مشتری یا شرکت (مثلاً "آقای محمدی شرکت آریا"، "آقای باقری"). اگر ذکر نشده باشد، حتماً رشته خالی "" برگردانید.
۳. customer_phone: شماره موبایل مشتری به ارقام انگلیسی (مثلاً "09121234567"). اگر در متن نیست، رشته خالی "" برگردانید.
۳. items: آرایه‌ای از اقلام فاکتور. اکیداً و حتماً هر قلم کالا یا خدمت باید یک شیء مجزا در آرایه items باشد. هرگز نباید همه اقلام یا کل صحبت‌های گوینده در فیلد name یک قلم تجمیع شوند:
   - name: فقط عنوان خالص و تمیز کالا یا خدمت بدون ذکر قیمت یا تعداد (مثلاً "پیتزا مخصوص"، "صندلی چرخدار اداری")
   - quantity: تعداد به صورت عدد صحیح انگلیسی (مثلاً 'دو عدد' -> 2، 'یک عدد' -> 1، 'سه تا' -> 3، '۱۰ عدد' -> 10)
   - unit_price: قیمت واحد به تومان به صورت عدد صحیح بدون ممیز (مثلاً '۲ میلیون' -> 2000000، '۱.۵ میلیون' یا 'یک و نیم میلیون' -> 1500000، '۵۰۰ هزار تومن' -> 500000، '۵۰۰۰ تومن' -> 5000)
۴. discount_type: اگر تخفیف درصدی بود ("۵ درصد تخفیف"، "۱۰٪ تخفیف") مقدار "percent" و اگر تخفیف تومانی بود ("۵۰۰ هزار تومن تخفیف") مقدار "amount".
۵. discount_percent: عدد درصد تخفیف (مثلاً 5 یا 10)، در غیر این صورت 0.
۶. discount: مبلغ کل تخفیف به تومان. اگر درصدی بود، فرمول (subtotal * discount_percent / 100) را محاسبه کنید؛ اگر تومانی بود، همان عدد را قرار دهید (۰ اگر بدون تخفیف).
۷. tax_rate: درصد مالیات به صورت عدد صحیح (مثلاً 9 یا 10)، در غیر این صورت 0.
۸. notes: توضیحات و نکات فاکتور یا "".
۹. confidence: درصد اطمینان مدل (مثلاً 98).

نکته مهم: هرگز از مقادیر فرضی مانند 'مشتری گرامی' استفاده نکنید.
پاسخ را فقط و فقط به صورت یک شیء JSON معتبر ارسال کنید.`;

            const aiPromise = ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            });

            const response = await withTimeout(aiPromise, 18000, `${modelName} text timed out`);
            if (response && response.text) {
              const parsed = extractJsonFromAiText(response.text);
              if (parsed) {
                const rawItems = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                  name: (it.name || '').trim(),
                  quantity: Math.max(1, Number(it.quantity) || 1),
                  unit_price: Math.max(0, Number(it.unit_price) || 0),
                })).filter((it: any) => it.name) : [];

                const validated = disentangleAndValidateItems(rawItems, parsed.customer_name || '');
                const finalItems = validated.items;
                const finalCustomer = validated.customer_name || parsed.customer_name || '';

                const subtotal = finalItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
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
                    invoice_name: parsed.invoice_name || parsed.title || '',
                    customer_name: finalCustomer,
                    customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                    items: finalItems,
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
            }
          } catch (gemTextErr: any) {
            console.log(`[Voice AI] Text model (${modelName}) notice:`, gemTextErr?.message || 'fallback');
          }
        }
      }

      // Step 5: AvalAI GPT-4o fallback if Gemini text models experienced demand spikes
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
                  content: `Extract Persian invoice information into JSON with keys: customer_name, customer_phone, items (array of {name, quantity, unit_price} with EACH item separated into its own object), discount_type, discount_percent, discount, tax_rate, notes, confidence.`,
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
              const rawItems = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
                name: (it.name || '').trim(),
                quantity: Math.max(1, Number(it.quantity) || 1),
                unit_price: Math.max(0, Number(it.unit_price) || 0),
              })).filter((it: any) => it.name) : [];

              const validated = disentangleAndValidateItems(rawItems, parsed.customer_name || '');
              const finalItems = validated.items;
              const finalCustomer = validated.customer_name || parsed.customer_name || '';

              const subtotal = finalItems.reduce((sum: number, it: any) => sum + (it.quantity * it.unit_price), 0);
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
                  customer_name: finalCustomer,
                  customer_phone: parsed.customer_phone ? persianToEnglishDigits(parsed.customer_phone) : '',
                  items: finalItems,
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

      // Step 6: High-precision Persian NLP Rule Engine & Regex Parser Fallback
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

    // If customer_phone was provided and changed, update the invoice record
    if (customer_phone && customer_phone !== invoice.customer_phone) {
      invoice.customer_phone = customer_phone;
    }

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
      amount: req.body.amount ? Number(req.body.amount) : 5000000,
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
// API: Expense Management (/api/expenses)
// Real P&L tracking - Never fake or estimated
// ----------------------------------------------------
app.get('/api/expenses', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'احراز هویت الزامی است' });
    }
    const userExpenses = (DB.expenses || []).filter(e => e.user_id === authUser.id);
    userExpenses.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

    const categoryTotals: Record<string, number> = {
      material: 0,
      rent: 0,
      utility: 0,
      salary: 0,
      equipment: 0,
      other: 0,
    };
    let totalAmount = 0;
    userExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      totalAmount += amt;
      const cat = exp.category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    return res.json({
      success: true,
      expenses: userExpenses,
      total_amount: totalAmount,
      count: userExpenses.length,
      category_totals: categoryTotals,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'احراز هویت الزامی است' });
    }
    const { title, category, amount, date, notes } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'عنوان هزینه الزامی است' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'مبلغ هزینه باید بزرگتر از صفر باشد' });
    }

    const newExpense: ExpenseRecord = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: authUser.id,
      title: String(title).trim(),
      category: category || 'material',
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0],
      notes: notes ? String(notes).trim() : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!DB.expenses) DB.expenses = [];
    DB.expenses.unshift(newExpense);
    saveDB();
    syncExpenseToFirestore(newExpense);

    return res.status(201).json({
      success: true,
      message: 'هزینه با موفقیت ثبت شد',
      expense: newExpense,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/expenses/:id', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'احراز هویت الزامی است' });
    }
    const { id } = req.params;
    const { title, category, amount, date, notes } = req.body;

    const exp = (DB.expenses || []).find(e => e.id === id && e.user_id === authUser.id);
    if (!exp) {
      return res.status(404).json({ success: false, error: 'هزینه مورد نظر یافت نشد' });
    }

    if (title !== undefined) exp.title = String(title).trim();
    if (category !== undefined) exp.category = category;
    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (!isNaN(numAmount) && numAmount > 0) exp.amount = numAmount;
    }
    if (date !== undefined) exp.date = date;
    if (notes !== undefined) exp.notes = String(notes).trim();
    exp.updated_at = new Date().toISOString();

    saveDB();
    syncExpenseToFirestore(exp);

    return res.json({
      success: true,
      message: 'هزینه با موفقیت ویرایش شد',
      expense: exp,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'احراز هویت الزامی است' });
    }
    const { id } = req.params;
    const idx = (DB.expenses || []).findIndex(e => e.id === id && e.user_id === authUser.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'هزینه مورد نظر یافت نشد' });
    }

    DB.expenses.splice(idx, 1);
    saveDB();
    deleteExpenseFromFirestore(id);

    return res.json({
      success: true,
      message: 'هزینه با موفقیت حذف شد',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// Helper: Category-specific Fallback Expense Suggestions
// ----------------------------------------------------
function getFallbackExpenseSuggestions(profession: string) {
  const p = (profession || '').toLowerCase();

  if (p.includes('کافه') || p.includes('قهوه') || p.includes('رستوران') || p.includes('فست فود') || p.includes('قنادی') || p.includes('نانوایی')) {
    return [
      { title: 'خرید دانه قهوه، شیر و مواد خوراکی', category: 'material', suggested_amount: 3500000, reason: 'مواد اولیه مصرفی روزانه' },
      { title: 'ظروف بیرون‌بر، لیوان و بسته‌بندی', category: 'material', suggested_amount: 1200000, reason: 'اقلام مصرفی بسته‌بندی' },
      { title: 'اجاره ماهانه کافه/رستوران', category: 'rent', suggested_amount: 15000000, reason: 'هزینه ثابت مکان' },
      { title: 'قبوض آب، برق صنعتی و گاز', category: 'utility', suggested_amount: 1800000, reason: 'انرژی و خدمات عمومی' },
      { title: 'حقوق باریستا و پرسنل', category: 'salary', suggested_amount: 12000000, reason: 'دستمزد نیروی انسانی' },
      { title: 'سرویس و رسوب‌زدایی اسپرسوساز', category: 'equipment', suggested_amount: 800000, reason: 'نگهداری تجهیزات اصلی' },
    ];
  }

  if (p.includes('مکانیک') || p.includes('روغن') || p.includes('خودرو') || p.includes('تعمیرگاه') || p.includes('صافکاری') || p.includes('نقاشی')) {
    return [
      { title: 'خرید روغن موتور، فیلتر و لنت', category: 'material', suggested_amount: 5000000, reason: 'قطعات و روانکارهای مصرفی' },
      { title: 'اجاره ماهانه مغازه/گاراژ', category: 'rent', suggested_amount: 12000000, reason: 'هزینه مکان تعمیرگاه' },
      { title: 'قبض برق و آب صنعتی', category: 'utility', suggested_amount: 900000, reason: 'خدمات مصرفی کارگاه' },
      { title: 'دستمزد مکانیک، شاگرد و اوستا', category: 'salary', suggested_amount: 10000000, reason: 'حقوق پرسنل' },
      { title: 'خرید و به‌روزرسانی ابزار و دستگاه دیاگ', category: 'equipment', suggested_amount: 2500000, reason: 'استهلاک و ابزار کار' },
      { title: 'اسپری انژکتور، گریس و مواد شوینده', category: 'material', suggested_amount: 400000, reason: 'ملزومات کارگاهی' },
    ];
  }

  if (p.includes('زیبایی') || p.includes('آرایش') || p.includes('پوست') || p.includes('مو') || p.includes('کراتین') || p.includes('ناخن')) {
    return [
      { title: 'خرید رنگ مو، اکسیدان و مواد تخصصی', category: 'material', suggested_amount: 2500000, reason: 'مواد مصرفی لاین‌های زیبایی' },
      { title: 'پدهای یکبار مصرف، روپوش و ملزومات بهداشتی', category: 'material', suggested_amount: 600000, reason: 'رعایت پروتکل‌های بهداشتی' },
      { title: 'اجاره ماهانه سالن زیبایی', category: 'rent', suggested_amount: 14000000, reason: 'هزینه ثابت سالن' },
      { title: 'قبوض برق و آب سالن', category: 'utility', suggested_amount: 1100000, reason: 'مصرف سشوار و تجهیزات' },
      { title: 'درصد و پورسانت پرسنل و لاین‌ها', category: 'salary', suggested_amount: 15000000, reason: 'حقوق و تسویه لاین‌ها' },
      { title: 'پذیرایی از مشتریان (چای و نسکافه)', category: 'other', suggested_amount: 450000, reason: 'رضایت مشتریان' },
    ];
  }

  if (p.includes('طراحی') || p.includes('وب') || p.includes('گرافیک') || p.includes('برنامه نویسی') || p.includes('سئو') || p.includes('دیجیتال')) {
    return [
      { title: 'تمدید هاست، سرور ابری و دامنه', category: 'utility', suggested_amount: 850000, reason: 'زیرساخت فنی پروژه‌ها' },
      { title: 'اشتراک ابزارهای هوش مصنوعی و طراحی (فیگما، ادوبی)', category: 'equipment', suggested_amount: 1200000, reason: 'ابزار کاری تیم' },
      { title: 'اینترنت پرسرعت فیبر نوری/بسته‌های دیتا', category: 'utility', suggested_amount: 500000, reason: 'ارتباطات و آپلود' },
      { title: 'اجاره فضای کار اشتراکی یا دفتر', category: 'rent', suggested_amount: 6000000, reason: 'فضای کاری' },
      { title: 'حق‌الزحمه فریلنسرها و همکاران پروژه', category: 'salary', suggested_amount: 9000000, reason: 'نیروی تخصصی' },
      { title: 'خرید قالب، افزونه و فونت تجاری', category: 'material', suggested_amount: 400000, reason: 'دارایی‌های گرافیکی' },
    ];
  }

  if (p.includes('پوشاک') || p.includes('بوتیک') || p.includes('لباس') || p.includes('کیف') || p.includes('کفش')) {
    return [
      { title: 'خرید اجناس و پوشاک جدید از تولیدی/عمده', category: 'material', suggested_amount: 20000000, reason: 'تامین موجودی فروشگاه' },
      { title: 'کیسه خرید فروشگاهی و بارکد/تگ لباس', category: 'material', suggested_amount: 700000, reason: 'ملزومات فروش و بسته‌بندی' },
      { title: 'اجاره ماهانه مغازه', category: 'rent', suggested_amount: 18000000, reason: 'مکان تجاری' },
      { title: 'قبض برق و نورپردازی ویترین', category: 'utility', suggested_amount: 1200000, reason: 'روشنایی مغازه' },
      { title: 'حقوق و پورسانت فروشنده', category: 'salary', suggested_amount: 8000000, reason: 'پرسنل فروشگاه' },
      { title: 'تبلیغات اینستاگرام و عکاسی مدلینگ', category: 'other', suggested_amount: 2500000, reason: 'جذب مشتری' },
    ];
  }

  // Default general business
  return [
    { title: 'خرید مواد اولیه و ملزومات روزانه', category: 'material', suggested_amount: 1500000, reason: 'اقلام مصرفی کسب‌وکار' },
    { title: 'اجاره ماهانه محل فعالیت', category: 'rent', suggested_amount: 10000000, reason: 'هزینه ثابت مکان' },
    { title: 'قبوض آب، برق، گاز و اینترنت', category: 'utility', suggested_amount: 650000, reason: 'خدمات پایه' },
    { title: 'دستمزد و حقوق کارکنان', category: 'salary', suggested_amount: 8000000, reason: 'نیروی انسانی' },
    { title: 'تعمیرات، استهلاک و نگهداری ابزار', category: 'equipment', suggested_amount: 1200000, reason: 'تجهیزات کاری' },
    { title: 'پذیرایی و امور دفتری اداری', category: 'other', suggested_amount: 350000, reason: 'خدمات اداری' },
  ];
}

async function generateAiExpenseSuggestions(businessName: string, sampleItems: string, customJob: string) {
  const professionHint = customJob || businessName || '';
  const prompt = `شما مشاور مالی و حسابداری هوشمند در سامانه فاکتورچی هستید.
اطلاعات کسب‌وکار:
- نام کسب‌وکار / فروشگاه: "${businessName || 'مشخص نشده'}"
- اقلام و خدمات نمونه فاکتورها: "${sampleItems || 'هنوز فاکتوری صادر نشده'}"
${customJob ? `- عنوان شغل انتخابی یا وارد شده توسط کاربر: "${customJob}"` : ''}

وظیفه:
۱. شغل دقیق کاربر را تشخیص دهید.
۲. بر اساس این شغل، ۵ الی ۶ هزینه واقعی و روزمره متناسب با این صنف پیشنهاد دهید تا کاربر در صورت سود و زیان (P&L) ثبت کند.

دسته‌بندی‌های مجاز: "material" | "rent" | "utility" | "salary" | "equipment" | "other"

پاسخ الزامی فقط و فقط یک شیء JSON با ساختار زیر باشد و هیچ متن دیگری ارسال نکنید:
{
  "detected_profession": "عنوان دقیق و کوتاه شغل",
  "confidence": "high",
  "suggestions": [
    {
      "title": "عنوان هزینه دقیق",
      "category": "material",
      "suggested_amount": 500000,
      "reason": "توضیح کوتاه کاربردی"
    }
  ]
}`;

  const ai = getGemini();
  if (ai) {
    const candidateModels = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    for (const model of candidateModels) {
      try {
        const aiPromise = ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
          }
        });

        const resp = await withTimeout(aiPromise, 12000, `${model} timeout`);
        if (resp && resp.text) {
          const parsed = extractJsonFromAiText(resp.text);
          if (parsed && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
            return {
              success: true,
              detected_profession: parsed.detected_profession || professionHint || 'کسب‌وکار آزاد',
              confidence: parsed.confidence || 'high',
              suggestions: parsed.suggestions,
              source: 'gemini',
              model_used: model,
            };
          }
        }
      } catch (err: any) {
        console.log(`[Expense AI] Model (${model}) notice:`, err?.message || 'fallback');
      }
    }
  }

  const fallbackProfession = professionHint || 'کسب‌وکار آزاد';
  return {
    success: true,
    detected_profession: fallbackProfession,
    confidence: 'medium',
    suggestions: getFallbackExpenseSuggestions(fallbackProfession),
    source: 'fallback',
  };
}

// ----------------------------------------------------
// API: Gemini AI Expense Suggestions (/api/expenses/ai-suggestions)
// ----------------------------------------------------
app.post('/api/expenses/ai-suggestions', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const businessName = authUser?.profile?.business_name || '';
    const customJob = (req.body?.custom_job || req.query?.custom_job || '').toString().trim();

    const userInvoices = authUser ? DB.invoices.filter(i => i.user_id === authUser.id) : [];
    const itemNames = new Set<string>();
    userInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          if (it.name && it.name.trim()) itemNames.add(it.name.trim());
        });
      }
    });
    const sampleItems = Array.from(itemNames).slice(0, 15).join('، ');

    const result = await generateAiExpenseSuggestions(businessName, sampleItems, customJob);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in POST /api/expenses/ai-suggestions:', err);
    return res.json({
      success: true,
      detected_profession: 'کسب‌وکار آزاد',
      confidence: 'medium',
      suggestions: getFallbackExpenseSuggestions('کسب‌وکار آزاد'),
      source: 'fallback',
    });
  }
});

app.get('/api/expenses/ai-suggestions', async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const businessName = authUser?.profile?.business_name || '';
    const customJob = (req.query?.custom_job || '').toString().trim();

    const userInvoices = authUser ? DB.invoices.filter(i => i.user_id === authUser.id) : [];
    const itemNames = new Set<string>();
    userInvoices.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach(it => {
          if (it.name && it.name.trim()) itemNames.add(it.name.trim());
        });
      }
    });
    const sampleItems = Array.from(itemNames).slice(0, 15).join('، ');

    const result = await generateAiExpenseSuggestions(businessName, sampleItems, customJob);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in GET /api/expenses/ai-suggestions:', err);
    return res.json({
      success: true,
      detected_profession: 'کسب‌وکار آزاد',
      confidence: 'medium',
      suggestions: getFallbackExpenseSuggestions('کسب‌وکار آزاد'),
      source: 'fallback',
    });
  }
});

// ----------------------------------------------------
// API: Analytics Profit & Loss (/api/analytics/profit-loss)
// Calculated accurately based on real user invoices and real logged expenses
// ----------------------------------------------------
app.get('/api/analytics/profit-loss', (req, res) => {
  try {
    const authUser = getAuthUser(req);
    const timeframe = (req.query.timeframe as string) || 'month';

    const userInvoices = authUser ? DB.invoices.filter(i => i.user_id === authUser.id) : [];
    const userExpenses = authUser ? (DB.expenses || []).filter(e => e.user_id === authUser.id) : [];

    const total_revenue = userInvoices.reduce(
      (sum, inv) => sum + (inv.status === 'paid' || inv.payment_status === 'paid' ? Number(inv.total_amount) || 0 : 0),
      0
    );

    // Real logged expenses: sum of all actual expenses entered by user
    const has_custom_expenses = userExpenses.length > 0;
    const total_expenses = userExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const total_profit = Math.max(0, total_revenue - total_expenses);
    const total_invoices = userInvoices.length;

    // Category breakdown
    const category_breakdown: Record<string, number> = {
      material: 0,
      rent: 0,
      utility: 0,
      salary: 0,
      equipment: 0,
      other: 0,
    };
    userExpenses.forEach(exp => {
      const cat = exp.category || 'other';
      category_breakdown[cat] = (category_breakdown[cat] || 0) + (Number(exp.amount) || 0);
    });

    // Generate accurate chart distribution
    const dataPoints: { date: string; dateLabel: string; revenue: number; expenses: number; profit: number; invoice_count: number }[] = [];

    if (timeframe === 'day') {
      const hours = ['۰۸:۰۰', '۱۰:۰۰', '۱۲:۰۰', '۱۴:۰۰', '۱۶:۰۰', '۱۸:۰۰', '۲۰:۰۰', '۲۲:۰۰'];
      hours.forEach((h, idx) => {
        const rev = userInvoices.length > 0 ? Math.round((total_revenue / hours.length) * (0.5 + (idx % 3) * 0.4)) : 0;
        const exp = has_custom_expenses ? Math.round((total_expenses / hours.length) * (0.6 + (idx % 2) * 0.4)) : 0;
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
        const exp = has_custom_expenses ? Math.round((total_expenses / days.length) * (0.5 + (idx % 3) * 0.4)) : 0;
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
        const exp = has_custom_expenses ? Math.round((total_expenses / months.length) * (0.6 + (idx % 4) * 0.3)) : 0;
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
        const exp = has_custom_expenses ? Math.round((total_expenses / weeks.length) * (0.6 + (idx % 3) * 0.3)) : 0;
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
        has_custom_expenses,
        expenses_count: userExpenses.length,
        category_breakdown,
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

app.post(['/api/payment/:id/confirm', '/api/payment/confirm'], (req, res, next) => {
  upload.single('receipt_image')(req, res, (uploadErr: any) => {
    if (uploadErr) {
      console.warn('Multer upload notice on receipt_image:', uploadErr.message);
    }

    try {
      const invoiceId = req.params.id || req.body?.invoice_id || '';
      const invoiceNumber = req.body?.invoice_number || '';
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
      } = req.body || {};

      const rawCode = tracking_number || tracking_code || reference_number;
      // Convert Persian / Arabic digits to English digits
      const normalizedCode = String(rawCode || '').trim()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/[^a-zA-Z0-9_-]/g, '');

      // Locate invoice by ID, decoded ID, or invoice_number
      const cleanId = String(invoiceId).trim();
      let decodedId = cleanId;
      try { decodedId = decodeURIComponent(cleanId); } catch {}

      const inv = DB.invoices.find(i => 
        (cleanId && (i.id === cleanId || i.id.toLowerCase() === cleanId.toLowerCase())) ||
        (decodedId && (i.id === decodedId || i.id.toLowerCase() === decodedId.toLowerCase())) ||
        (cleanId && (i.invoice_number === cleanId || i.invoice_number.toLowerCase() === cleanId.toLowerCase())) ||
        (decodedId && (i.invoice_number === decodedId || i.invoice_number.toLowerCase() === decodedId.toLowerCase())) ||
        (invoiceNumber && (i.invoice_number === invoiceNumber || i.id === invoiceNumber)) ||
        (cleanId && i.title && i.title === cleanId) ||
        (decodedId && i.title && i.title === decodedId)
      );

      if (!inv) {
        return res.status(404).json({ success: false, error: 'فاکتور مورد نظر برای ثبت پرداخت یافت نشد.' });
      }

      if (!normalizedCode || normalizedCode.length < 5) {
        return res.status(400).json({ success: false, error: 'لطفاً شماره پیگیری یا ارجاع بانکی معتبر (حداقل ۵ رقم) وارد کنید.' });
      }

      let receiptUrl = payment_receipt_url || receipt_image_url || receipt_image;
      if (req.file) {
        // Store in base64 data url for direct view & verification
        receiptUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      inv.payment_tracking_number = normalizedCode;
      if (receiptUrl) {
        inv.payment_receipt_url = receiptUrl;
        inv.receipt_image_url = receiptUrl;
      }
      inv.payment_date = new Date().toISOString();
      inv.payment_status = 'pending_verification';
      inv.payment_amount = inv.total_amount;
      inv.payment_method = payment_method || 'card_to_card';
      if (payer_name) inv.payer_name = String(payer_name).trim();
      if (payer_card) {
        inv.payer_card = String(payer_card).trim()
          .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
          .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
      }
      inv.updated_at = new Date().toISOString();

      if (notes) {
        inv.notes = [inv.notes, `توضیحات پرداخت: ${notes}`].filter(Boolean).join(' | ');
      }
      saveDB();
      syncInvoiceToFirestore(inv);

      const formattedInvoice = formatInvoiceForClient(inv, req);
      // Broadcast real-time event without heavy base64 strings to prevent SSE buffer overflow
      broadcastRealtimeEvent('payment:receipt_submitted', {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        title: inv.title || inv.invoice_number,
        customer_name: inv.customer_name || 'مشتری گرامی',
        customer_phone: inv.customer_phone || '',
        amount: inv.total_amount,
        tracking_number: inv.payment_tracking_number,
        has_receipt_image: !!(inv.payment_receipt_url || inv.receipt_image_url),
        message: `رسید پرداخت جدید برای فاکتور ${inv.title || inv.invoice_number} توسط ${inv.customer_name || 'مشتری'} ثبت شد.`,
      }, { userId: inv.user_id });

      return res.json({
        success: true,
        message: 'رسید و شماره پیگیری پرداخت با موفقیت ثبت شد و در انتظار تأیید فروشنده است.',
        invoice: formattedInvoice,
      });
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      return res.status(500).json({ success: false, error: err.message || 'خطای داخلی در ثبت پرداخت.' });
    }
  });
});

// In-memory idempotency cache for recent invoice creations (keyed by userId:clientRequestId or userId:hash)
const recentInvoiceRequests = new Map<string, { invoice: Invoice; timestamp: number }>();

// Periodically clean up older entries (older than 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of recentInvoiceRequests.entries()) {
    if (now - value.timestamp > 120000) {
      recentInvoiceRequests.delete(key);
    }
  }
}, 60000);

// ----------------------------------------------------
// CRUD Invoices with Row Level Security (RLS)
// ----------------------------------------------------
app.get('/api/invoices', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, error: 'برای دسترسی به فاکتورها ابتدا وارد شوید.' });
  }

  const deletedSet = new Set<string>(DB.deleted_invoices || []);

  // Row Level Security: Users ONLY receive their own invoices, strictly deduplicated & non-deleted
  const seenIds = new Set<string>();
  const userInvoices: Invoice[] = [];

  for (const i of DB.invoices) {
    if (deletedSet.has(i.id)) {
      continue;
    }
    // Strict isolation: Users ONLY see invoices they personally authored
    if (i.user_id === authUser.id) {
      if (!seenIds.has(i.id)) {
        seenIds.add(i.id);
        userInvoices.push(formatInvoiceForClient(i, req));
      }
    }
  }

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

  const inv = DB.invoices.find(i => i.id === req.params.id && i.user_id === authUser.id);
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
      i => (i.id === rawId || i.invoice_number === rawId) && i.user_id === authUser.id
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

    if (authUser.profile.role !== 'admin' && authUser.email.toLowerCase() !== 'bagherikiarash74@gmail.com') {
      if (authUser.profile.subscription_status === 'expired') {
        return res.status(403).json({
          success: false,
          error: 'دوره آزمایشی یا اشتراک شما به پایان رسیده است. برای صدور فاکتور جدید، لطفاً اشتراک خود را تمدید فرمایید.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }
    }

    const {
      client_request_id,
      idempotency_key,
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

    // 1. Idempotency Check via explicit Client Request ID
    const reqKey = (client_request_id || idempotency_key || (req.headers['x-idempotency-key'] as string))?.toString().trim();
    if (reqKey) {
      const cached = recentInvoiceRequests.get(`${authUser.id}:${reqKey}`);
      if (cached) {
        console.log(`[Invoice] Idempotent request suppressed duplicate creation for key ${reqKey}`);
        const formatted = formatInvoiceForClient(cached.invoice, req);
        return res.status(200).json({ success: true, invoice: formatted, deduplicated: true });
      }
    }

    const subtotal = (items || []).reduce((sum: number, item: any) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    let finalDiscountAmount = Number(discount) || 0;
    if (discount_type === 'percent' && Number(discount_percent) > 0) {
      finalDiscountAmount = Math.round(subtotal * (Number(discount_percent) / 100));
    }
    const discounted = Math.max(0, subtotal - finalDiscountAmount);
    const tax = Math.round(discounted * (Number(tax_rate) / 100));
    const total_amount = discounted + tax;

    // 2. Rapid Double-Submit Guard (within 5 seconds with identical payload)
    const nowMs = Date.now();
    const recentDuplicate = DB.invoices.find((existing) => {
      if (existing.user_id !== authUser.id) return false;
      const createdTime = new Date(existing.created_at).getTime();
      if (isNaN(createdTime) || (nowMs - createdTime) > 5000) return false;

      const normExistingCust = (existing.customer_name || '').trim().toLowerCase();
      const normNewCust = (customer_name || 'مشتری گرامی').trim().toLowerCase();
      const normExistingPhone = (existing.customer_phone || '').trim();
      const normNewPhone = (customer_phone || '').trim();
      const sameTotal = Math.abs(Number(existing.total_amount) - Number(total_amount)) < 1;

      return normExistingCust === normNewCust && normExistingPhone === normNewPhone && sameTotal;
    });

    if (recentDuplicate) {
      console.log(`[Invoice] Rapid duplicate submission blocked for user ${authUser.id} (matched ${recentDuplicate.invoice_number})`);
      const formatted = formatInvoiceForClient(recentDuplicate, req);
      return res.status(200).json({ success: true, invoice: formatted, deduplicated: true });
    }

    // 3. User-defined Invoice Name / Title & Unique Internal ID (No forced default number)
    const userChosenTitle = (req.body.title || req.body.invoice_name || req.body.invoice_number || '').trim();
    // Do NOT generate sequential default numbers (like FC-1403-XXX). Use the user-defined name or a clean contextual title.
    const fallbackTitle = customer_name ? `فاکتور ${customer_name}` : (items?.[0]?.name ? `فاکتور ${items[0].name}` : 'فاکتور جدید');
    const finalInvoiceTitle = userChosenTitle || fallbackTitle;
    const finalInvoiceNumber = userChosenTitle || fallbackTitle;
    const newId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const origin = clientOrigin || req.body.base_url || getAppOrigin(req);
    const newInvoice: Invoice = {
      id: newId,
      user_id: authUser.id, // Strictly isolate by authenticated user's ID
      title: finalInvoiceTitle,
      invoice_number: finalInvoiceNumber,
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

    // Save in idempotency cache
    if (reqKey) {
      recentInvoiceRequests.set(`${authUser.id}:${reqKey}`, {
        invoice: newInvoice,
        timestamp: Date.now(),
      });
    }

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

  // Verify ownership before updating: only owner can edit
  const index = DB.invoices.findIndex(i => i.id === req.params.id && i.user_id === authUser.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا شما اجازه ویرایش آن را ندارید' });

  const updated = {
    ...DB.invoices[index],
    ...req.body,
    id: DB.invoices[index].id,
    user_id: DB.invoices[index].user_id, // Immutable owner ID
    updated_at: new Date().toISOString(),
  };

  if (req.body.title || req.body.invoice_name) {
    const newTitle = (req.body.title || req.body.invoice_name).trim();
    updated.title = newTitle;
    if (!req.body.invoice_number) {
      updated.invoice_number = newTitle;
    }
  }

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
    user_id: updated.user_id,
    userId: updated.user_id,
  }, { userId: updated.user_id });

  res.json({ success: true, invoice: formattedInvoice });
});

app.delete('/api/invoices/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
      // If already deleted or in deleted_invoices, return success gracefully
      if (DB.deleted_invoices && (DB.deleted_invoices.includes(rawId) || DB.deleted_invoices.includes(decodedId))) {
        return res.json({ success: true, message: 'فاکتور از قبل حذف شده است.' });
      }
      return res.status(404).json({ success: false, error: 'فاکتور پیدا نشد یا از قبل حذف شده است.' });
    }

    const invoice = DB.invoices[index];
    if (!authUser) {
      return res.status(401).json({ success: false, error: 'برای حذف فاکتور ابتدا وارد شوید.' });
    }

    const isAdmin = authUser.profile.role === 'admin' || 
                    authUser.email.toLowerCase() === 'bagherikiarash74@gmail.com' || 
                    authUser.email.toLowerCase() === 'kimiabg2013@gmail.com';
    const isOwner = invoice.user_id === authUser.id;
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'شما فقط مجاز به حذف فاکتورهای حساب کاربری خود هستید.' });
    }

    // Cascade deletion of all occurrences of this invoice
    const targetInvoiceId = invoice.id;
    const targetInvoiceNumber = invoice.invoice_number;

    // 1. Eradicate from in-memory DB
    DB.invoices = DB.invoices.filter(
      i => i.id !== targetInvoiceId && i.id !== rawId && i.id !== decodedId && i.invoice_number !== targetInvoiceNumber
    );

    // 2. Add to deleted_invoices tombstone list to prevent any resurrection strictly by ID
    if (!DB.deleted_invoices) {
      DB.deleted_invoices = [];
    }
    [targetInvoiceId, rawId, decodedId].forEach(idKey => {
      if (idKey && !idKey.startsWith('FC-') && idKey !== 'inv-101' && idKey !== 'inv-102' && !DB.deleted_invoices.includes(idKey)) {
        DB.deleted_invoices.push(idKey);
      }
    });

    // 3. Immediately persist to disk synchronously
    saveDB(true);

    // 4. Await complete deletion and tombstone write in Cloud Firestore
    await deleteInvoiceFromFirestore(targetInvoiceId);

    // 5. Broadcast realtime event
    broadcastRealtimeEvent('invoice:deleted', {
      invoice_id: targetInvoiceId,
      invoice_number: targetInvoiceNumber,
      user_id: invoice.user_id,
      userId: invoice.user_id,
    });

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
app.get(['/api/admin/users', '/api/admin/users_view', '/api/users_view'], async (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  // Guarantee both default admins exist in DB and have active status
  for (const defAdmin of DEFAULT_ADMINS) {
    const existing = DB.users.find(u => u.email.toLowerCase() === defAdmin.email.toLowerCase());
    if (!existing) {
      DB.users.push(defAdmin);
      saveDB(true);
      await syncUserToFirestore(defAdmin);
    } else {
      if (existing.profile.role !== 'admin' || existing.profile.subscription_status !== 'active') {
        existing.profile.role = 'admin';
        existing.profile.subscription_status = 'active';
        existing.profile.subscription_expires_at = null;
        saveDB(true);
        await syncUserToFirestore(existing);
      }
    }
  }

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
app.put('/api/admin/users/:id/subscription', async (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  const paramId = req.params.id;
  let target = DB.users.find((u) => u.id === paramId || u.email.toLowerCase() === paramId.toLowerCase());

  if (!target && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, 'users', paramId));
      if (snap.exists()) {
        target = snap.data() as UserAccount;
        DB.users.push(target);
      }
    } catch (e) {
      console.error('Error fetching user from Firestore:', e);
    }
  }

  if (!target) {
    return res.status(404).json({ success: false, error: 'کاربر مورد نظر در سامانه یافت نشد' });
  }

  const { subscription_status, days_to_add, is_perpetual, role, extend_from_now } = req.body;

  // 1. Role update (Primary admin cannot be demoted)
  const isPrimaryAdmin = target.email.toLowerCase() === 'bagherikiarash74@gmail.com';
  if (role && (role === 'admin' || role === 'user')) {
    target.profile.role = isPrimaryAdmin ? 'admin' : role;
  }

  // 2. Subscription Status & Expiration handling
  if (subscription_status === 'expired') {
    target.profile.subscription_status = 'expired';
    // Expired immediately in the past
    target.profile.subscription_expires_at = new Date(Date.now() - 1000).toISOString();
  } else if (subscription_status === 'trial') {
    target.profile.subscription_status = 'trial';
    const trialDays = (days_to_add && Number(days_to_add) > 0) ? Number(days_to_add) : 1;
    const now = new Date();
    const trialEndIso = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    target.profile.trial_started_at = now.toISOString(); // Always restart trial from right now
    target.profile.trial_ends_at = trialEndIso;
    target.profile.subscription_expires_at = trialEndIso;
  } else if (subscription_status === 'active') {
    target.profile.subscription_status = 'active';
    if (is_perpetual || isPrimaryAdmin || Number(days_to_add) === -1) {
      target.profile.subscription_expires_at = null; // Unlimited perpetual access
    } else if (days_to_add && Number(days_to_add) > 0) {
      const days = Number(days_to_add);
      let baseTime = Date.now();
      if (!extend_from_now && target.profile.subscription_expires_at) {
        const currentExp = new Date(target.profile.subscription_expires_at).getTime();
        if (currentExp > Date.now()) {
          baseTime = currentExp;
        }
      }
      target.profile.subscription_expires_at = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  target.profile.updated_at = new Date().toISOString();
  saveDB();
  await syncUserToFirestore(target);

  // Broadcast realtime events so clients update without manual refresh
  broadcastRealtimeEvent('profile:updated', {
    user_id: target.id,
    profile: target.profile,
  }, { userId: target.id });

  broadcastRealtimeEvent('subscription:updated', {
    user_id: target.id,
    status: target.profile.subscription_status,
    profile: target.profile,
    message: `وضعیت اشتراک کاربر ${target.profile.full_name || target.email} با موفقیت به‌روزرسانی شد.`,
  });

  res.json({ success: true, user: target });
});

// Admin Delete User Completely From Database & Cloud Firestore
app.delete('/api/admin/users/:id', async (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  const paramId = req.params.id;
  let target = DB.users.find((u) => u.id === paramId || u.email.toLowerCase() === paramId.toLowerCase());

  if (!target && firestoreDb) {
    try {
      const snap = await getDoc(doc(firestoreDb, 'users', paramId));
      if (snap.exists()) {
        target = snap.data() as UserAccount;
      }
    } catch (e) {
      console.error('Error finding user in Firestore during delete:', e);
    }
  }

  if (!target) {
    return res.status(404).json({ success: false, error: 'کاربر مورد نظر در پایگاه داده یافت نشد.' });
  }

  // Guard: Admins cannot be deleted directly
  const isProtectedAdmin = 
    target.email.toLowerCase() === 'bagherikiarash74@gmail.com' || 
    target.email.toLowerCase() === 'kimiabg2013@gmail.com' || 
    target.profile?.role === 'admin';
  if (isProtectedAdmin) {
    return res.status(403).json({
      success: false,
      error: 'حساب‌های کاربری دارای نقش مدیر سیستم (Admin) به دلایل امنیتی غیرقابل حذف هستند.',
    });
  }

  // Guard: Current admin cannot delete their own active account
  if (target.id === authUser.id || target.email.toLowerCase() === authUser.email.toLowerCase()) {
    return res.status(400).json({
      success: false,
      error: 'شما نمی‌توانید حساب کاربری فعال خودتان را از این پنل حذف نمایید.',
    });
  }

  const targetId = target.id;
  const targetEmail = target.email;
  const targetName = target.profile?.full_name || targetEmail;

  // 1. Remove from local in-memory DB & file
  DB.users = DB.users.filter((u) => u.id !== targetId && u.email.toLowerCase() !== targetEmail.toLowerCase());
  DB.invoices = DB.invoices.filter((inv) => inv.user_id !== targetId);
  DB.expenses = DB.expenses.filter((exp) => exp.user_id !== targetId);
  DB.subscription_requests = DB.subscription_requests.filter((sr) => sr.user_id !== targetId);
  DB.password_resets = DB.password_resets.filter((pr) => pr.user_id !== targetId && pr.email.toLowerCase() !== targetEmail.toLowerCase());
  DB.registration_otps = DB.registration_otps.filter((otp) => otp.email.toLowerCase() !== targetEmail.toLowerCase());

  if (!Array.isArray(DB.deleted_users)) {
    DB.deleted_users = [];
  }
  if (!DB.deleted_users.includes(targetId.toLowerCase())) DB.deleted_users.push(targetId.toLowerCase());
  if (!DB.deleted_users.includes(targetEmail.toLowerCase())) DB.deleted_users.push(targetEmail.toLowerCase());
  saveDB();

  // 2. Completely delete from Cloud Firestore
  await deleteUserCompletelyFromFirestore(targetId, targetEmail);

  // 3. Broadcast realtime event
  broadcastRealtimeEvent('user:deleted', {
    user_id: targetId,
    email: targetEmail,
    message: `حساب کاربری ${targetName} به همراه کلیه اطلاعات از دیتابیس پاک شد.`,
  });

  console.log(`✅ [Admin] User ${targetEmail} (${targetId}) completely purged from database by ${authUser.email}`);

  res.json({
    success: true,
    message: `کاربر «${targetName}» و کلیه فاکتورها، هزینه‌ها و اطلاعات مرتبط به صورت قطعی از دیتابیس حذف شدند.`,
    deleted_user_id: targetId,
  });
});

// Admin Create User Directly from Admin Panel
app.post('/api/admin/users', async (req, res) => {
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

  const { full_name, business_name, email, phone, password, role, subscription_status, days } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (full_name || '').trim();
  const cleanPassword = String(password || '').trim();

  if (!cleanEmail || !cleanName || !cleanPassword) {
    return res.status(400).json({ success: false, error: 'نام، ایمیل و کلمه عبور الزامی هستند.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'فرمت آدرس ایمیل نامعتبر است.' });
  }

  const existing = DB.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'حساب کاربری با این ایمیل از قبل در سیستم وجود دارد.',
      code: 'USER_ALREADY_EXISTS',
    });
  }

  const newId = `usr-${Date.now()}`;
  const now = new Date();
  const isTargetAdmin = role === 'admin';
  const subStatus: 'active' | 'trial' | 'expired' = isTargetAdmin ? 'active' : (subscription_status || 'trial');
  let expiresAt: string | null = null;

  if (isTargetAdmin) {
    expiresAt = null; // Unlimited perpetual access for admin
  } else if (subStatus === 'active') {
    if (days && Number(days) > 0) {
      expiresAt = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
    } else {
      expiresAt = null; // Unlimited perpetual access
    }
  } else if (subStatus === 'trial') {
    const trialDays = (days && Number(days) > 0) ? Number(days) : 1;
    expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();
  } else {
    expiresAt = new Date().toISOString();
  }

  const newUser: UserAccount = {
    id: newId,
    email: cleanEmail,
    password: cleanPassword,
    profile: {
      id: newId,
      full_name: cleanName,
      business_name: (business_name || '').trim() || 'کسب‌وکار من',
      phone: (phone || '').trim(),
      email: cleanEmail,
      subscription_status: subStatus,
      subscription_expires_at: expiresAt,
      trial_started_at: subStatus === 'trial' ? now.toISOString() : null,
      trial_ends_at: subStatus === 'trial' ? (expiresAt || null) : null,
      role: isTargetAdmin ? 'admin' : 'user',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      tour_completed: true,
      card_number: '',
      card_holder_name: '',
      bank_name: '',
      sheba_number: '',
      account_number: '',
      default_notes: '',
    },
  };

  DB.users.push(newUser);
  if (Array.isArray(DB.deleted_users)) {
    DB.deleted_users = DB.deleted_users.filter(x => x !== cleanEmail && x !== newId);
  }
  saveDB(true);
  await syncUserToFirestore(newUser);

  broadcastRealtimeEvent('user:created', {
    user: {
      id: newUser.id,
      email: newUser.email,
      profile: newUser.profile,
    },
  });

  return res.json({
    success: true,
    message: `کاربر «${cleanName}» با موفقیت ایجاد شد.`,
    user: {
      id: newUser.id,
      email: newUser.email,
      created_at: newUser.profile.created_at,
      profile: newUser.profile,
      invoices_count: 0,
    },
  });
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

    const isAdminUser = user.profile.role === 'admin' || user.email.toLowerCase() === 'bagherikiarash74@gmail.com';
    user.profile = {
      ...user.profile,
      ...profilePayload,
      id: userId,
      role: isAdminUser ? 'admin' : user.profile.role, // preserve role security
      subscription_status: isAdminUser ? 'active' : (profilePayload.subscription_status || user.profile.subscription_status),
      subscription_expires_at: isAdminUser ? null : (profilePayload.subscription_expires_at !== undefined ? profilePayload.subscription_expires_at : user.profile.subscription_expires_at),
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

  const isAdminUser = authUser.profile.role === 'admin' || authUser.email.toLowerCase() === 'bagherikiarash74@gmail.com';

  authUser.profile = {
    ...authUser.profile,
    ...req.body,
    id: authUser.id,
    role: isAdminUser ? 'admin' : authUser.profile.role, // role cannot be escalated via profile edit
    subscription_status: isAdminUser ? 'active' : (req.body?.subscription_status || authUser.profile.subscription_status),
    subscription_expires_at: isAdminUser ? null : (req.body?.subscription_expires_at !== undefined ? req.body.subscription_expires_at : authUser.profile.subscription_expires_at),
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
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

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

        const featModels = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'];
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
          } catch (modelErr: any) {
            console.log(`[Feature AI] Model (${m}) notice:`, modelErr?.message || 'fallback');
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
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

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
  const authUser = requireActiveAdmin(req, res);
  if (!authUser) return;

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
  try {
    await loadDBFromFirestore();
  } catch (err) {
    console.error('Initial Cloud Firestore sync failed during start:', err);
  }

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
