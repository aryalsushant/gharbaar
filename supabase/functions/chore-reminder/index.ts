/**
 * Reminds each person of their own corner of the kitchen, and nobody of
 * anybody else's.
 *
 * Six separate messages rather than one to the house. A notification that
 * lists all six jobs is a notice board: everybody reads it once, nobody reads
 * it twice. A notification that says the one sentence you personally agreed to
 * is a reminder, and it is the only kind worth sending every day.
 *
 * Anyone who has already answered is skipped, including the ones who answered
 * no. They have said their piece for the day and pinging them again would be
 * the app arguing with them.
 *
 * Hourly from pg_cron, doing nothing on 23 of the calls, for the same reason as
 * the cook reminder: pg_cron runs on UTC and a fixed UTC hour drifts by one
 * across daylight saving, so the check for the house's local hour belongs here
 * rather than in a cron expression that is wrong for half the year.
 *
 * Deployed with:  npx supabase functions deploy chore-reminder
 * Needs secrets:  VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, CRON_SECRET
 */
import { authorised, pushTo, serviceClient } from '../_shared/push.ts';

const HOUSE_TZ = 'America/Chicago';

// After dinner and before anybody is in bed. The cook reminder goes at five, so
// the two never land together and neither one drowns the other out.
const SEND_AT_HOUR = 20;

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

  const [{ data: chores }, { data: checks }, { data: people }] = await Promise.all([
    supabase.from('chores').select('id, roster_key, title'),
    supabase.from('chore_checks').select('chore_id').eq('date', today),
    // Seats nobody has claimed have no account to notify, which the join drops.
    supabase.from('profiles').select('id, roster_key').not('roster_key', 'is', null),
  ]);

  if (!chores || chores.length === 0) return Response.json({ skipped: 'no chores yet' });

  const answered = new Set((checks ?? []).map((c) => c.chore_id));
  const seatOwner = new Map((people ?? []).map((p) => [p.roster_key as string, p.id as string]));

  let sent = 0;
  let pruned = 0;
  const reminded: string[] = [];

  for (const chore of chores) {
    if (answered.has(chore.id)) continue;

    const owner = seatOwner.get(chore.roster_key);
    if (!owner) continue;
    // A single seat, for testing this without waking the other five.
    if (only && only !== chore.roster_key) continue;

    const result = await pushTo(supabase, [owner], {
      title: 'Your bit of the house',
      body: chore.title,
      url: '/today',
      // One tag per person per day, so a second run replaces the first
      // notification rather than stacking another one behind it.
      tag: `chore-${chore.roster_key}-${today}`,
    });

    sent += result.sent;
    pruned += result.pruned;
    if (result.sent > 0) reminded.push(chore.roster_key);
  }

  return Response.json({ date: today, sent, pruned, reminded });
});
