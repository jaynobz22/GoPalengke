// @ts-nocheck
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { supabase } from './supabase';

export type AccountStatus = 'ACTIVE' | 'RESTRICTED_48H' | 'SUSPENDED' | 'BANNED';
export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type SecurityFlagStatus = 'PENDING_REVIEW' | 'RESOLVED' | 'BANNED';
export type TriggerType =
  | 'OFF_PLATFORM_POACHING'
  | 'ACCOUNT_TAKEOVER'
  | 'BULK_ACCOUNT_CREATION'
  | 'PRICE_ANOMALY'
  | 'IP_DELIVERY_MISMATCH'
  | 'ORDER_FLOODING'
  | 'MANUAL';

export interface SecurityFlag {
  id: string;
  user_id: string | null;
  trigger_type: TriggerType;
  severity: SecuritySeverity;
  actions_taken: string[];
  details: Record<string, unknown>;
  status: SecurityFlagStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_id: string;
  ip_address: string | null;
  user_agent: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

const FRAUD_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/fraud-detection`;

function getHeaders() {
  return {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ============================================================
// Chat scanner patterns (client-side pre-check)
// ============================================================
const POACHING_PATTERNS = [
  /\bviber\b/i,
  /\bwhatsapp\b/i,
  /\bfb\s*messenger\b/i,
  /\bmessenger\b/i,
  /\btext\s*mo\s*ako\b/i,
  /\btext\s*me\b/i,
  /\bcall\s*me\s*at\b/i,
  /\bpm\s*me\b/i,
  /\bmessage\s*me\s*sa\b/i,
  /\badd\s*me\s*sa\b/i,
  /\b09\d{9}\b/,
  /\b\+63\s*9\d{9}\b/,
  /\bhttps?:\/\/(?!gopalengke\.net)\S+/i,
];

export function scanMessageLocally(text: string): boolean {
  return POACHING_PATTERNS.some(p => p.test(text));
}

// ============================================================
// 1. Scan chat message for off-platform poaching
// ============================================================
export async function scanChatMessage(
  senderId: string,
  messageBody: string,
  conversationId: string,
  messageId: string,
): Promise<{ flagged: boolean; flagId?: string }> {
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'scan_chat',
        senderId,
        messageBody,
        conversationId,
        messageId,
      }),
    });
    if (!res.ok) return { flagged: false };
    const data = await res.json();
    return { flagged: data.flagged, flagId: data.flagId };
  } catch {
    return { flagged: false };
  }
}

// ============================================================
// 2. Device fingerprint check
// ============================================================
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '0',
  ];
  const raw = components.join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'dev_' + Math.abs(hash).toString(36) + '_' + raw.length.toString(36);
}

export async function checkDeviceFingerprint(
  userId: string,
  ipAddress?: string,
): Promise<{ banned: boolean; flagged: boolean; distinctUsers?: number }> {
  const deviceId = generateDeviceFingerprint();
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'check_device',
        deviceId,
        userId,
        ipAddress: ipAddress || 'unknown',
        userAgent: navigator.userAgent,
      }),
    });
    if (res.status === 403) {
      const data = await res.json();
      return { banned: data.banned || true, flagged: data.flagged || true, distinctUsers: data.distinctUsers };
    }
    if (!res.ok) return { banned: false, flagged: false };
    const data = await res.json();
    return { banned: false, flagged: data.flagged || false, distinctUsers: data.distinctUsers };
  } catch {
    return { banned: false, flagged: false };
  }
}

// ============================================================
// 3. Price anomaly check
// ============================================================
export async function checkPriceAnomaly(
  categoryId: string,
  price: number,
  sellerId: string,
  productName: string,
  productId?: string,
): Promise<{ flagged: boolean; avgPrice?: number; priceDropPercent?: number }> {
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'check_price',
        categoryId,
        price,
        sellerId,
        productName,
        productId,
      }),
    });
    if (!res.ok) return { flagged: false };
    const data = await res.json();
    return {
      flagged: data.flagged,
      avgPrice: data.avgPrice,
      priceDropPercent: data.priceDropPercent,
    };
  } catch {
    return { flagged: false };
  }
}

// ============================================================
// 4. Order flooding check
// ============================================================
export async function checkOrderFlood(
  buyerId: string,
  storeId: string,
): Promise<{ flagged: boolean; distinctStores?: number; message?: string }> {
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'check_order_flood',
        buyerId,
        storeId,
      }),
    });
    if (res.status === 403) {
      const data = await res.json();
      return { flagged: true, distinctStores: data.distinctStores, message: data.message };
    }
    if (!res.ok) return { flagged: false };
    const data = await res.json();
    return { flagged: data.flagged, distinctStores: data.distinctStores };
  } catch {
    return { flagged: false };
  }
}

// ============================================================
// 5. IP / delivery mismatch check
// ============================================================
export async function checkIpMismatch(
  deliveryCity: string,
  deliveryRegion: string,
): Promise<{ mismatch: boolean; ipCountry?: string; ipCity?: string }> {
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'check_ip_mismatch',
        deliveryCity,
        deliveryRegion,
      }),
    });
    if (!res.ok) return { mismatch: false };
    const data = await res.json();
    return {
      mismatch: data.mismatch,
      ipCountry: data.ipCountry,
      ipCity: data.ipCity,
    };
  } catch {
    return { mismatch: false };
  }
}

// ============================================================
// 6. Admin security actions
// ============================================================
export async function adminSecurityAction(
  flagId: string,
  adminId: string,
  action: 'dismiss' | 'lift' | 'ban',
  deviceId?: string,
  notes?: string,
): Promise<{ success: boolean }> {
  try {
    const res = await fetch(FRAUD_FUNCTION_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        action: 'admin_action',
        flagId,
        adminId,
        adminAction: action,
        deviceId,
        notes,
      }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return { success: data.success };
  } catch {
    return { success: false };
  }
}

// ============================================================
// Helper: check if account is usable
// ============================================================
export function isAccountUsable(status: AccountStatus | undefined): boolean {
  if (!status) return true;
  return status === 'ACTIVE' || status === 'RESTRICTED_48H';
}

export function isAccountBanned(status: AccountStatus | undefined): boolean {
  return status === 'BANNED';
}

export function isAccountSuspended(status: AccountStatus | undefined): boolean {
  return status === 'SUSPENDED';
}

// ============================================================
// Helper: get account status label and color
// ============================================================
export function getAccountStatusLabel(status: AccountStatus | undefined): string {
  switch (status) {
    case 'ACTIVE': return 'Active';
    case 'RESTRICTED_48H': return 'Restricted (48h)';
    case 'SUSPENDED': return 'Suspended';
    case 'BANNED': return 'Banned';
    default: return 'Active';
  }
}

export function getAccountStatusColor(status: AccountStatus | undefined): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-700';
    case 'RESTRICTED_48H': return 'bg-amber-100 text-amber-700';
    case 'SUSPENDED': return 'bg-orange-100 text-orange-700';
    case 'BANNED': return 'bg-red-100 text-red-700';
    default: return 'bg-green-100 text-green-700';
  }
}

export function getTriggerTypeLabel(type: TriggerType): string {
  switch (type) {
    case 'OFF_PLATFORM_POACHING': return 'Off-Platform Poaching';
    case 'ACCOUNT_TAKEOVER': return 'Account Takeover';
    case 'BULK_ACCOUNT_CREATION': return 'Bulk Account Creation';
    case 'PRICE_ANOMALY': return 'Price Anomaly';
    case 'IP_DELIVERY_MISMATCH': return 'IP / Delivery Mismatch';
    case 'ORDER_FLOODING': return 'Order Flooding';
    case 'MANUAL': return 'Manual Flag';
    default: return type;
  }
}

export function getSeverityColor(severity: SecuritySeverity): string {
  switch (severity) {
    case 'HIGH': return 'bg-red-100 text-red-700 border-red-200';
    case 'MEDIUM': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'LOW': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
