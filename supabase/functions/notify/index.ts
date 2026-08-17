import { authorised, household, money, pushTo, serviceClient, type Message } from '../_shared/push.ts';

/**
 * Tells the house that something happened, the moment it happens.
 *
 * Called by database triggers rather than on a schedule, so the row that caused
 * it arrives in the body. That matters: reading it from the payload rather than
 * querying for "the latest expense" means two people adding a bill at the same
 * second get two correct notifications instead of two copies of one.
 *
 * Nobody is ever told about their own action.
 *
 * Deployed with:  npx supabase functions deploy notify --no-verify-jwt
 */

type Payload = {
  kind: 'expense' | 'settlement' | 'swap_request' | 'swap_taken';
  row: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (!authorised(request)) return new Response('no', { status: 401 });

  const { kind, row } = (await request.json()) as Payload;
  const supabase = serviceClient();

  const people = await household(supabase);
  const nameOf = (id: unknown) =>
    people.find((p) => p.id === id)?.display_name ?? 'Someone';

  let message: Message;
  let exclude: string[] = [];
  let audience = people.map((p) => p.id);

  switch (kind) {
    case 'expense': {
      const payer = row.paid_by as string;
      const what = (row.description as string)?.trim() || 'an expense';
      const where = row.apartment ? ` (${row.apartment})` : '';
      message = {
        title: `${nameOf(payer)} paid ${money(row.amount as number)}`,
        body: `${what}${where}. Tap to see the split.`,
        url: '/money',
        tag: `expense-${row.id}`,
      };
      exclude = [payer];

      // A flat's bill is not news to the other flat.
      //
      // Worked out from who lives there, not from the expense's splits. The
      // trigger fires the moment the expense row lands and the client writes
      // the splits immediately after, so reading them here finds nothing and
      // every apartment bill would notify nobody at all.
      if (row.apartment) {
        const { data: residents } = await supabase
          .from('profiles')
          .select('id')
          .eq('apartment', row.apartment as string)
          .not('roster_key', 'is', null);
        audience = (residents ?? []).map((r) => r.id as string);
      }
      break;
    }

    case 'settlement': {
      // The recipient records it, so the payer is the one who wants to know it
      // was acknowledged.
      const from = row.from_user as string;
      const to = row.to_user as string;
      message = {
        title: `${nameOf(to)} marked your ${money(row.amount as number)} received`,
        body: 'You are square with them on that.',
        url: '/money',
        tag: `settlement-${row.id}`,
      };
      audience = [from];
      exclude = [to];
      break;
    }

    case 'swap_request': {
      const asker = row.requested_by as string;
      message = {
        title: `${nameOf(asker)} cannot cook`,
        body: `${row.date}. Tap if you can take it.`,
        url: '/today',
        tag: `cover-${row.date}`,
      };
      exclude = [asker];
      break;
    }

    case 'swap_taken': {
      const taker = row.user_id as string;
      message = {
        title: `${nameOf(taker)} took a night`,
        body: `Covering ${row.date}. The rota has shifted.`,
        url: '/today',
        tag: `cover-${row.date}`,
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
