/**
 * Reminds each person of their own job in today's round, and nobody of anybody
 * else's.
 *
 * A round is a list the house agreed to do on one particular day, so on most
 * days this finds nothing and sends nothing. That is the normal case, not a
 * failure: a reminder that arrives every evening whether or not anything was
 * agreed is the one people turn off.
 *
 * Six separate messages rather than one to the house. A notification that lists
 * all six jobs is a notice board, and everybody reads a notice board exactly
 * once. A notification carrying the one sentence you personally agreed to is a
 * reminder.
 *
 * Two modes.
 *
 * The evening one is what pg_cron calls. Anyone who has already answered is
 * skipped, including the ones who answered no: they have said their piece and
 * pinging them again would be the app arguing with them. It runs hourly and does
 * nothing on 23 of those calls, for the same reason as the cook reminder:
 * pg_cron runs on UTC and a fixed UTC hour drifts by one across daylight
 * saving, so the check for the house's local hour belongs here rather than in a
 * cron expression that is wrong for half the year.
 *
 * The announcement, `?announce=1`, is the once-only one. It goes to everybody in
 * the round whatever the hour and whatever they have answered, because its job
 * is to tell people a round exists and which sentence is theirs. Called by hand,
 * never by cron.
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
  // pg_cron is the only caller of the nightly mode, and the announcement is
  // called by hand with the same secret. Without this the function is a public
  // endpoint that will happily notify the house on demand.
  if (!authorised(request)) return new Response('no', { status: 401 });

  const url = new URL(request.url);
  const announce = url.searchParams.get('announce') === '1';
  const forced = url.searchParams.get('force') === '1';
  const only = url.searchParams.get('only');

  // An announcement is deliberate, so it does not wait for eight o'clock.
  if (!announce && !forced && hourIn(HOUSE_TZ) !== SEND_AT_HOUR) {
    return Response.json({ skipped: 'wrong hour', hour: hourIn(HOUSE_TZ) });
  }

  const supabase = serviceClient();
  const today = todayIn(HOUSE_TZ);

  const [chores, checks, people] = await Promise.all([
    supabase.from('chores').select('id, roster_key, title').eq('for_date', today),
    supabase.from('chore_checks').select('chore_id').eq('date', today),
    // Seats nobody has claimed have no account to notify, which this drops.
    supabase.from('profiles').select('id, roster_key').not('roster_key', 'is', null),
  ]);

  // A read that failed used to look exactly like a read that came back empty,
  // which turned "the query broke" into the far more alarming and completely
  // wrong "nobody has claimed their seat". Say which one broke instead.
  const broke = [
    ['chores', chores.error],
    ['chore_checks', checks.error],
    ['profiles', people.error],
  ].filter(([, error]) => error);

  if (broke.length > 0) {
    return Response.json(
      { failed: broke.map(([table, error]) => `${table}: ${(error as { message: string }).message}`) },
      { status: 500 }
    );
  }

  if (!chores.data || chores.data.length === 0) {
    return Response.json({ skipped: 'no round today', date: today });
  }

  const answered = new Set((checks.data ?? []).map((c) => c.chore_id));
  const seatOwner = new Map((people.data ?? []).map((p) => [p.roster_key as string, p.id as string]));

  let sent = 0;
  let pruned = 0;
  const reached: string[] = [];

  // Who the message was for and did not get. An announcement that quietly
  // reaches four of six looks identical to one that reached everybody, and the
  // two people who never heard about their job are exactly the ones who need
  // telling another way.
  const missed: string[] = [];

  for (const chore of chores.data) {
    if (!announce && answered.has(chore.id)) continue;

    // A single seat, for trying this without waking the other five.
    if (only && only !== chore.roster_key) continue;

    const owner = seatOwner.get(chore.roster_key);
    if (!owner) {
      missed.push(`${chore.roster_key} (seat not claimed)`);
      continue;
    }

    const result = await pushTo(supabase, [owner], {
      title: announce ? 'This is your task' : 'Your bit of the house',
      body: announce ? `${chore.title}. Tick it off in Gharbaar.` : chore.title,
      url: '/today',
      // One tag per person, so a second run replaces the first notification
      // rather than stacking another one behind it. The announcement keeps its
      // own tag so it never replaces a nightly reminder or the other way round.
      tag: announce ? `chore-intro-${chore.roster_key}` : `chore-${chore.roster_key}-${today}`,
    });

    sent += result.sent;
    pruned += result.pruned;

    if (result.sent > 0) reached.push(chore.roster_key);
    // No subscription on any device: notifications never turned on, or turned
    // on in a browser tab on an iPhone, where they cannot arrive.
    else missed.push(`${chore.roster_key} (no device subscribed)`);
  }

  return Response.json({ mode: announce ? 'announcement' : 'nightly', date: today, sent, pruned, reached, missed });
});
