// @ts-nocheck
import { supabase } from './supabase';
import type { UserRole } from './types';

// VAPID public key — generated server-side, safe to expose in client
const VAPID_PUBLIC_KEY = 'BAIF5pzeNIQJzYltOzA7xaCzLCZKE1EY5bIDmvKe4HwTwTFRCDA0vxyHY6ch9sHJqRoCP2UuZMBqnMs52z0XidY';

const SW_PATH = '/sw.js';
const SUBSCRIPTIONS_TABLE = 'push_subscriptions';

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
    });
    return reg;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!registrationPromise) {
    registrationPromise = registerServiceWorker();
  }
  return registrationPromise;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(
  userId: string,
  role: UserRole,
): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;

  if (!('PushManager' in window)) return false;

  try {
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const sub = subscription.toJSON();
    const endpoint = sub.endpoint;
    const keys = sub.keys as { p256dh: string; auth: string } | undefined;

    if (!endpoint || !keys?.p256dh || !keys?.auth) return false;

    // Upsert to database — if this endpoint already exists, update it
    const { error } = await supabase
      .from(SUBSCRIPTIONS_TABLE)
      .upsert(
        {
          user_id: userId,
          role: role,
          endpoint: endpoint,
          p256dh_key: keys.p256dh,
          auth_key: keys.auth,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      );

    if (error) {
      console.error('Failed to save push subscription:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await getRegistration();
    if (!reg) return;

    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  return await Notification.requestPermission();
}

export async function initPushNotifications(
  userId: string,
  role: UserRole,
): Promise<{ permission: NotificationPermission; subscribed: boolean }> {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return { permission, subscribed: false };
  }

  const subscribed = await subscribeToPush(userId, role);
  return { permission, subscribed };
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
