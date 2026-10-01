/**
 * Asks everybody but tonight's cook to rate the cooking and the cleaning.
 *
 * Half past nine, which is when the stars open on the board. Dinner is eaten
 * and the kitchen is either clean or it is not, so there is something to rate,
 * and it is early enough that people are still holding their phones.
 *
 * The cook is left out. Asking somebody to rate their own night is a question
 * the app will refuse to accept the answer to.
 *
 * Called every hour by pg_cron at half past, and does nothing on 23 of those
 * calls. Same reasoning as the other reminders: pg_cron runs on UTC and a fixed
 * UTC hour drifts by one across daylight saving, so the check for the house's
 * local hour belongs here.
 *
 * `?force=1` sends whatever the hour, and `?only=<seat>` sends to one seat, so
 * this can be tried without waking the house.
 *
 * Deployed with:  npx supabase functions deploy rate-reminder --no-verify-jwt
 * Needs secrets:  VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, CRON_SECRET
 */
import { authorised, pushTo, serviceClient } from '../_shared/push.ts';

const HOUSE_TZ = 'America/Chicago';

// The cron job fires at half past every hour, so this is 9:30pm.
const SEND_AT_HOUR = 21;

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
  if (!authorised(request)) return new Response('no', { status: 401 });

  const url = new URL(request.url);
  const forced = url.searchParams.get('force') === '1';
  const only = url.searchParams.get('only');

  if (!forced && hourIn(HOUSE_TZ) !== SEND_AT_HOUR) {
    return Response.json({ skipped: 'wrong hour', hour: hourIn(HOUSE_TZ) });
  }

  const supabase = serviceClient();
  const today = todayIn(HOUSE_TZ);

  // The oldest rotation is dinner, the same rule the cook reminder uses.
  const { data: duty, error: dutyError } = await supabase
    .from('responsibilities')
    .select('id, rotation_start_date')
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (dutyError) return Response.json({ failed: [`responsibilities: ${dutyError.message}`] }, { status: 500 });
  if (!duty) return Response.json({ skipped: 'no rotation yet' });
  if (today < duty.rotation_start_date) return Response.json({ skipped: 'rotation not started' });

  const [members, overrides, people] = await Promise.all([
    supabase
      .from('responsibility_members')
      .select('user_id, rotation_order')
      .eq('responsibility_id', duty.id)
      .eq('is_active', true)
      .order('rotation_order'),
    supabase
      .from('responsibility_overrides')
      .select('user_id')
      .eq('responsibility_id', duty.id)
      .eq('date', today),
    // Seats nobody has claimed have no account to notify, which this drops.
    supabase.from('profiles').select('id, display_name, roster_key').not('roster_key', 'is', null),
  ]);

  // Say which read broke. A failed read looks exactly like an empty one
  // otherwise, and "nobody in the rotation" is the wrong thing to go chasing.
  const broke = [
    ['responsibility_members', members.error],
    ['responsibility_overrides', overrides.error],
    ['profiles', people.error],
  ].filter(([, error]) => error);

  if (broke.length > 0) {
    return Response.json(
      { failed: broke.map(([table, error]) => `${table}: ${(error as { message: string }).message}`) },
      { status: 500 }
    );
  }

  // Same rule as the app: an override wins, otherwise the modulo decides.
  const rota = members.data ?? [];
  let cook: string | null = overrides.data?.[0]?.user_id ?? null;
  if (!cook && rota.length > 0) {
    const days = daysBetween(duty.rotation_start_date, today);
    cook = rota[((days % rota.length) + rota.length) % rota.length].user_id;
  }

  if (!cook) return Response.json({ skipped: 'nobody in the rotation' });

  const house = people.data ?? [];
  const cookName = house.find((p) => p.id === cook)?.display_name ?? 'tonight\'s cook';

  const audience = house
    .filter((p) => p.id !== cook)
    .filter((p) => !only || p.roster_key === only)
    .map((p) => p.id as string);

  const result = await pushTo(supabase, audience, {
    title: 'Rate tonight\'s dinner',
    body: `Please rate ${cookName}'s cooking and cleaning today.`,
    url: '/today',
    // One per night, so a second run replaces the first rather than stacking.
    tag: `rate-${today}`,
  });

  return Response.json({ date: today, cook, audience: audience.length, ...result });
});
