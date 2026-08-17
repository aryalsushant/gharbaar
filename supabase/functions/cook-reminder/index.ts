/**
 * Tells whoever is cooking tonight that they are cooking tonight.
 *
 * Called every hour by pg_cron, and does nothing on 23 of those calls. That
 * looks wasteful until you remember the alternative: pg_cron runs on UTC, and a
 * fixed UTC hour drifts by one across daylight saving, so the reminder would
 * arrive at 4pm for half the year. Checking the local hour here means the
 * schedule is correct in March and November without anybody editing a cron
 * expression.
 *
 * Deployed with:  npx supabase functions deploy cook-reminder
 * Needs secrets:  VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, CRON_SECRET
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const HOUSE_TZ = 'America/Chicago';
const SEND_AT_HOUR = 17;

/** Local calendar date in the house's timezone, as YYYY-MM-DD. */
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function hourIn(timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date())
  );
}

function daysBetween(startKey: string, endKey: string): number {
  const [ys, ms, ds] = startKey.split('-').map(Number);
  const [ye, me, de] = endKey.split('-').map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000);
}

Deno.serve(async (request) => {
  // pg_cron is the only caller. Without this the function is a public endpoint
  // that will happily notify the house on demand.
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('no', { status: 401 });
  }

  const url = new URL(request.url);
  const forced = url.searchParams.get('force') === '1';

  if (!forced && hourIn(HOUSE_TZ) !== SEND_AT_HOUR) {
    return Response.json({ skipped: 'wrong hour', hour: hourIn(HOUSE_TZ) });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const today = todayIn(HOUSE_TZ);

  const { data: duty } = await supabase
    .from('responsibilities')
    .select('id, name, rotation_start_date')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (!duty) return Response.json({ skipped: 'no rotation yet' });

  const [{ data: members }, { data: overrides }, { data: completions }] = await Promise.all([
    supabase
      .from('responsibility_members')
      .select('user_id, rotation_order, is_active')
      .eq('responsibility_id', duty.id)
      .eq('is_active', true)
      .order('rotation_order'),
    supabase
      .from('responsibility_overrides')
      .select('user_id')
      .eq('responsibility_id', duty.id)
      .eq('date', today),
    supabase
      .from('responsibility_completions')
      .select('id')
      .eq('responsibility_id', duty.id)
      .eq('date', today),
  ]);

  // Already done and signed off before five. Rare, but pinging somebody about a
  // job they have finished is the fastest way to get a notification muted.
  if (completions && completions.length > 0) {
    return Response.json({ skipped: 'already signed off' });
  }

  // Same rule as the app: an override wins, otherwise the modulo decides.
  let assignee: string | null = overrides?.[0]?.user_id ?? null;
  if (!assignee && members && members.length > 0) {
    const days = daysBetween(duty.rotation_start_date, today);
    assignee = members[((days % members.length) + members.length) % members.length].user_id;
  }

  if (!assignee) return Response.json({ skipped: 'nobody in the rotation' });

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', assignee);

  if (!subscriptions || subscriptions.length === 0) {
    return Response.json({ skipped: 'assignee has no device', assignee });
  }

  webpush.setVapidDetails(
    'mailto:gharbaar@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const payload = JSON.stringify({
    title: 'Your night to cook',
    body: 'Dinner and the clean up are yours tonight. Someone else signs it off.',
    url: '/today',
    tag: `cook-${today}`,
  });

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
      // 404 and 410 mean the browser threw the subscription away: uninstalled,
      // permission revoked, or storage cleared. Keeping it would mean retrying
      // a dead endpoint every evening forever.
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(sub.id);
    }
  }

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead);
  }

  return Response.json({ date: today, assignee, sent, pruned: dead.length });
});
