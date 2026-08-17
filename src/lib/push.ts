import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * The browser wants the applicationServerKey as raw bytes, not base64url.
 *
 * Backed by an explicit ArrayBuffer rather than Uint8Array.from, because the
 * DOM types demand a buffer that cannot be shared and TypeScript will not
 * assume that of a plain Uint8Array.
 */
function decodeKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Launched from a home screen icon rather than a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates the standard and is still what iOS sets.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, and is only distinguishable by touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Why an iPhone can be capable and still refuse: Safari only exposes push to a
 * PWA opened from its home screen icon. In a tab the APIs exist and the
 * subscribe call fails, so this has to be checked rather than attempted.
 */
export function pushBlockedUntilInstalled(): boolean {
  return isIOS() && !isInstalled();
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePush(userId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('No VAPID public key in this build. Set VITE_VAPID_PUBLIC_KEY.');
  }
  if (!pushSupported()) {
    throw new Error('This browser cannot do notifications.');
  }
  if (pushBlockedUntilInstalled()) {
    throw new Error('On iPhone, add Gharbaar to your home screen first, then open it from there.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were blocked. You can turn them back on in browser settings.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Anything less than every message being shown gets the subscription
      // revoked by the browser.
      userVisibleOnly: true,
      applicationServerKey: decodeKey(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw new Error(error.message);
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
}
