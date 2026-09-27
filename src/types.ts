export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
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

export interface Profile {
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

export interface SubscriptionRequest {
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

export interface DailyProfitLoss {
  date: string;
  dateLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoice_count: number;
}

export type Timeframe = 'day' | 'week' | 'month' | 'year';

export type NavigationTab = 'dashboard' | 'invoices' | 'new-invoice' | 'billing' | 'admin' | 'settings' | 'payment' | '403';

export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: 'emerald' | 'indigo' | 'amber' | 'teal' | 'rose';
  icon: 'mic' | 'ai' | 'shield' | 'chart' | 'zap';
  date: string;
  actionText?: string;
  actionTab?: NavigationTab;
  created_at?: string;
  ai_generated?: boolean;
}

export interface RealtimeNotification {
  id: string;
  type: 'receipt_submitted' | 'payment_verified' | 'payment_rejected' | 'invoice_created' | 'invoice_deleted' | 'subscription_request' | 'subscription_approved' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  customerName?: string;
  customerPhone?: string;
  receiptUrl?: string;
  trackingNumber?: string;
  data?: any;
}

export interface RealtimeEventPayload {
  type: string;
  payload: any;
  timestamp: string;
}

export type ExpenseCategory = 'material' | 'rent' | 'utility' | 'salary' | 'equipment' | 'other';

export interface Expense {
  id: string;
  user_id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

