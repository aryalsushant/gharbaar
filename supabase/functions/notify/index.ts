import {
  authorised,
  household,
  longDate,
  pushTo,
  serviceClient,
  whenPhrase,
  type Message,
} from '../_shared/push.ts';

/**
 * Tells the house that something happened, the moment it happens.
 *
 * Called by database triggers rather than on a schedule, so the row that caused
 * it arrives in the body. That matters: reading it from the payload rather than
 * querying for "the latest request" means two people asking for cover at the
 * same second get two correct notifications instead of two copies of one.
 *
 * Nobody is ever told about their own action.
 *
 * Deployed with:  npx supabase functions deploy notify --no-verify-jwt
 */

type Payload = {
  kind: 'swap_request' | 'swap_taken';
  row: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (!authorised(request)) return new Response('no', { status: 401 });

  const { kind, row } = (await request.json()) as Payload;
  const supabase = serviceClient();

  // The house is in Central time, and "tonight" has to mean tonight there.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const people = await household(supabase);
  const nameOf = (id: unknown) =>
    people.find((p) => p.id === id)?.display_name ?? 'Someone';

  let message: Message;
  let exclude: string[] = [];
  const audience = people.map((p) => p.id);

  switch (kind) {
    case 'swap_request': {
      const asker = row.requested_by as string;
      message = {
        title: `${nameOf(asker)} cannot cook ${whenPhrase(row.date as string, today)}`,
        body: 'Tap if you can take it. They pick up your next turn instead.',
        url: '/today',
        tag: `cover-${row.date}`,
      };
      exclude = [asker];
      break;
    }

    case 'swap_taken': {
      const taker = row.user_id as string;
      message = {
        title: `${nameOf(taker)} is cooking ${whenPhrase(row.date as string, today)}`,
        body: 'They covered a night, so the rota has shifted.',
        url: '/today',
        tag: `taken-${row.date}`,
      };
      exclude = [taker];
      break;
    }

    default:
      return Response.json({ skipped: 'unknown kind', kind });
  }

  const result = await pushTo(supabase, audience, message, exclude);
  return Response.json({ kind, ...result });
});
