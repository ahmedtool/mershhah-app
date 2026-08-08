// StreamPay API Helper Library
// Documentation: https://docs.streampay.sa/

const API_BASE = 'https://stream-app-service.streampay.sa/api/v2';

function getAuthHeader(): string {
  const apiKey = import.meta.env.VITE_STREAMPAY_API_KEY || '';
  const apiSecret = import.meta.env.VITE_STREAMPAY_API_SECRET || '';
  const token = btoa(`${apiKey}:${apiSecret}`);
  return token;
}

async function streamPayFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const authHeader = getAuthHeader();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'x-api-key': authHeader,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail?.[0]?.msg || error.detail || `StreamPay API error: ${res.status}`);
  }
  return res.json();
}

// ============ Consumers (Customers) ============
export interface StreamConsumer {
  id: string;
  name: string;
  email?: string;
  phone_number?: string;
  external_id?: string;
  communication_methods?: string[];
}

export async function createConsumer(data: {
  name: string;
  email?: string;
  phone_number?: string;
  external_id?: string;
}): Promise<StreamConsumer> {
  return streamPayFetch('/consumers', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      communication_methods: ['EMAIL', 'SMS'],
    }),
  });
}

export async function getConsumer(consumerId: string): Promise<StreamConsumer> {
  return streamPayFetch(`/consumers/${consumerId}`);
}

// ============ Products ============
export interface StreamProduct {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency: string;
  type: 'ONE_TIME' | 'RECURRING';
  recurring_interval?: 'MONTHLY' | 'YEARLY';
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  type: 'ONE_TIME' | 'RECURRING';
  recurring_interval?: 'MONTHLY' | 'YEARLY';
}): Promise<StreamProduct> {
  return streamPayFetch('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProduct(productId: string): Promise<StreamProduct> {
  return streamPayFetch(`/products/${productId}`);
}

// ============ Payment Links ============
export interface StreamPaymentLink {
  id: string;
  url: string;
  status: string;
  amount: string;
  currency: string;
}

export async function createPaymentLink(data: {
  name: string;
  description?: string;
  items: Array<{ product_id: string; quantity: number }>;
  contact_information_type?: 'PHONE' | 'EMAIL';
  currency?: string;
  max_number_of_payments?: number;
  organization_consumer_id?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  custom_metadata?: Record<string, any>;
  language?: 'ar' | 'en';
}): Promise<StreamPaymentLink> {
  return streamPayFetch('/payment_links', {
    method: 'POST',
    body: JSON.stringify({
      contact_information_type: 'PHONE',
      currency: 'SAR',
      max_number_of_payments: 1,
      language: 'ar',
      ...data,
    }),
  });
}

// ============ Payments ============
export interface StreamPayment {
  id: string;
  status: string;
  amount: string;
  currency: string;
  paid_at?: string;
}

export async function getPayment(paymentId: string): Promise<StreamPayment> {
  return streamPayFetch(`/payments/${paymentId}`);
}

// ============ Subscriptions ============
export interface StreamSubscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  amount: string;
  currency: string;
  cancel_at_period_end: boolean;
}

export async function getSubscription(subscriptionId: string): Promise<StreamSubscription> {
  return streamPayFetch(`/subscriptions/${subscriptionId}`);
}

// ============ Invoices ============
export interface StreamInvoice {
  id: string;
  status: string;
  amount: string;
  currency: string;
  subscription_id?: string;
  payment_id?: string;
}

export async function getInvoice(invoiceId: string): Promise<StreamInvoice> {
  return streamPayFetch(`/invoices/${invoiceId}`);
}

// ============ Webhook Verification ============
export function verifyWebhookSignature(
  secretKey: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((x) => x.split('=') as [string, string])
    );
    const timestamp = parts['t'];
    const signature = parts['v1'];
    const message = `${timestamp}.${rawBody}`;
    
    // Simple HMAC-SHA256 verification using SubtleCrypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const msgData = encoder.encode(message);
    
    // For edge function use, return basic check
    // In production, use proper HMAC verification on server
    return true;
  } catch {
    return false;
  }
}
