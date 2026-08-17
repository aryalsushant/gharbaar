import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

/**
 * Sending web push, shared by every function that needs to.
 *
 * Kept in one place because the awkward parts are easy to get subtly wrong
 * twice: the VAPID details have to be set before every send, and dead
 * subscriptions have to be deleted rather than retried forever.
 */

export type Message = {
  title: string;
  body: string;
  /** Where tapping it should land. */
  url?: string;
  /** Notifications sharing a tag replace each other instead of stacking. */
  tag?: string;
};

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/** The shared secret every caller must present. pg_cron and triggers have no user. */
export function authorised(request: Request): boolean {
  return request.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET');
}

/**
 * Push to everyone listed, minus anyone excluded.
 *
 * `exclude` is almost always the person who caused the notification. Telling
 * somebody what they just did themselves is the fastest way to get an app
 * muted.
 */
export async function pushTo(
  supabase: SupabaseClient,
  userIds: string[],
  message: Message,
  exclude: string[] = []
): Promise<{ sent: number; pruned: number }> {
  const targets = userIds.filter((id) => id && !exclude.includes(id));
  if (targets.length === 0) return { sent: 0, pruned: 0 };

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', targets);

  if (!subscriptions || subscriptions.length === 0) return { sent: 0, pruned: 0 };

  webpush.setVapidDetails(
    'mailto:gharbaar@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const payload = JSON.stringify(message);
  let sent = 0;
  const dead: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (error) {
      // 404 and 410 are the browser saying this subscription is gone:
      // uninstalled, permission revoked, or storage cleared. Keeping it means
      // failing against a dead endpoint forever.
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(sub.id);
    }
  }

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead);
  }

  return { sent, pruned: dead.length };
}

/** Everyone who holds a seat. */
export async function household(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name')
    .not('roster_key', 'is', null);
  return data ?? [];
}

export const money = (amount: number | string) => `$${Number(amount).toFixed(2)}`;

/**
 * Wednesday 19th August, rather than 2026-08-19.
 *
 * A notification is one line on a lock screen with no other context, so the
 * weekday earns its place: "Wednesday 19th August" answers "is that tonight?"
 * and a machine date does not.
 *
 * Duplicated from the app's src/lib/dates.ts rather than imported, because Edge
 * Functions run on Deno and cannot reach into the Vite bundle. Keep the two in
 * step if the format ever changes.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return `${DAYS[weekday]} ${ordinal(d)} ${MONTHS[m - 1]}`;
}

/** "tonight" when it is today, otherwise the date, so a reminder reads naturally. */
export function whenPhrase(key: string, todayKey: string): string {
  return key === todayKey ? 'tonight' : longDate(key);
}
