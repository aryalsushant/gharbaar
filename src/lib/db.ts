import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fromCents, splitEqually, toCents } from './balances';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  roster_key: string | null;
};

export type RosterEntry = {
  key: string;
  display_name: string;
  sort_order: number;
  claimed: boolean;
  /** Masked, like b****@gmail.com. Null when the seat is not bound yet. */
  email_hint: string | null;
};

export type Expense = {
  id: string;
  paid_by: string;
  amount: number;
  description: string;
  category: string | null;
  items: { name: string; quantity?: number; amount?: number }[] | null;
  created_at: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  settled: boolean;
};

export type Responsibility = {
  id: string;
  name: string;
  frequency: string;
  rotation_start_date: string;
};

export type ResponsibilityMember = {
  id: string;
  responsibility_id: string;
  user_id: string;
  rotation_order: number;
  is_active: boolean;
};

export type ResponsibilityOverride = { id: string; date: string; user_id: string };
export type ResponsibilityCompletion = {
  id: string;
  date: string;
  user_id: string;
  marked_by: string | null;
};

export type Penalty = {
  id: string;
  user_id: string;
  issued_by: string;
  responsibility_id: string | null;
  date: string;
  amount: number;
  reason: string;
  created_at: string;
};

/** Every Supabase call funnels through here so one error shape reaches the UI. */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// --- identity ---------------------------------------------------------------

/** The six names, and which are already taken. */
export function useRoster() {
  return useQuery({
    queryKey: ['roster'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('household_roster');
      if (error) throw new Error(error.message);
      return data as RosterEntry[];
    },
  });
}

/** Names only, readable before anybody has signed in. */
export function usePublicRoster() {
  return useQuery({
    queryKey: ['public-roster'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_roster');
      if (error) throw new Error(error.message);
      return data as { key: string; display_name: string; sort_order: number }[];
    },
  });
}

export function useClaimIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.rpc('claim_identity', { identity_key: key });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['household'] });
    },
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, roster_key')
          .eq('id', userId!)
          .single()
      ) as Profile,
    enabled: !!userId,
  });
}

/** Everyone who has claimed a seat. This is the household. */
export function useHousehold() {
  return useQuery({
    queryKey: ['household'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, roster_key')
          .not('roster_key', 'is', null)
      ) as Profile[],
  });
}

// --- expenses ---------------------------------------------------------------

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('expenses')
          .select('id, paid_by, amount, description, category, items, created_at')
          .order('created_at', { ascending: false })
      ) as Expense[],
  });
}

export function useSplits() {
  return useQuery({
    queryKey: ['splits'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('expense_splits')
          .select('id, expense_id, user_id, amount_owed, settled')
      ) as ExpenseSplit[],
  });
}

/**
 * Insert the expense, then its equal splits. Amounts are divided in integer
 * cents so the shares always add back up to the total.
 */
export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      description,
      paidBy,
      memberIds,
      category,
      items,
    }: {
      amount: number;
      description: string;
      paidBy: string;
      memberIds: string[];
      category?: string | null;
      items?: Expense['items'];
    }) => {
      const expense = unwrap(
        await supabase
          .from('expenses')
          .insert({
            paid_by: paidBy,
            amount,
            description: description.trim(),
            split_type: 'equal',
            category: category ?? null,
            items: items ?? null,
          })
          .select('id')
          .single()
      ) as { id: string };

      const shares = splitEqually(toCents(amount), memberIds.length);
      const { error } = await supabase.from('expense_splits').insert(
        memberIds.map((userId, i) => ({
          expense_id: expense.id,
          user_id: userId,
          amount_owed: fromCents(shares[i]),
        }))
      );
      if (error) throw new Error(error.message);
      return expense;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['splits'] });
    },
  });
}

// --- responsibilities -------------------------------------------------------

export function useResponsibilities() {
  return useQuery({
    queryKey: ['responsibilities'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibilities')
          .select('id, name, frequency, rotation_start_date')
          .order('created_at')
      ) as Responsibility[],
  });
}

export function useCreateResponsibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      startDate,
      memberIds,
    }: {
      name: string;
      startDate: string;
      memberIds: string[];
    }) => {
      const responsibility = unwrap(
        await supabase
          .from('responsibilities')
          .insert({ name: name.trim(), frequency: 'daily', rotation_start_date: startDate })
          .select('id')
          .single()
      ) as { id: string };

      const { error } = await supabase.from('responsibility_members').insert(
        memberIds.map((userId, i) => ({
          responsibility_id: responsibility.id,
          user_id: userId,
          rotation_order: i,
        }))
      );
      if (error) throw new Error(error.message);
      return responsibility;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['responsibilities'] }),
  });
}

/**
 * Bring the rotation in line with the house without destroying anything.
 *
 * This is what people actually want when they reach for "restart": the rota was
 * opened before everyone had claimed a seat, and the missing housemates need to
 * be in it. Adding them is not a reason to lose the swaps and sign-offs that
 * have already happened.
 *
 * Existing members keep their rotation_order, so nobody who has already cooked
 * gets moved back to the front. New people are appended in roster order.
 */
export function useSyncRotationMembers(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedUserIds: string[]) => {
      const existing = unwrap(
        await supabase
          .from('responsibility_members')
          .select('user_id, rotation_order')
          .eq('responsibility_id', respId!)
      ) as { user_id: string; rotation_order: number }[];

      const known = new Set(existing.map((m) => m.user_id));
      const missing = orderedUserIds.filter((id) => !known.has(id));
      if (missing.length === 0) return 0;

      const nextOrder = existing.reduce((max, m) => Math.max(max, m.rotation_order), -1) + 1;

      const { error } = await supabase.from('responsibility_members').insert(
        missing.map((userId, i) => ({
          responsibility_id: respId,
          user_id: userId,
          rotation_order: nextOrder + i,
        }))
      );
      if (error) throw new Error(error.message);
      return missing.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rotation-members', respId] }),
  });
}

export function useRotationMembers(respId: string | undefined) {
  return useQuery({
    queryKey: ['rotation-members', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_members')
          .select('id, responsibility_id, user_id, rotation_order, is_active')
          .eq('responsibility_id', respId!)
          .order('rotation_order')
      ) as ResponsibilityMember[],
    enabled: !!respId,
  });
}

export function useOverrides(respId: string | undefined) {
  return useQuery({
    queryKey: ['overrides', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_overrides')
          .select('id, date, user_id')
          .eq('responsibility_id', respId!)
      ) as ResponsibilityOverride[],
    enabled: !!respId,
  });
}

export function useCompletions(respId: string | undefined) {
  return useQuery({
    queryKey: ['completions', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_completions')
          .select('id, date, user_id, marked_by')
          .eq('responsibility_id', respId!)
      ) as ResponsibilityCompletion[],
    enabled: !!respId,
  });
}

/**
 * Confirm that whoever was on duty actually did it. `markedBy` is always the
 * current user and the policy refuses it when it equals the assignee, so this
 * cannot be used to sign off your own night.
 */
export function useConfirmCompletion(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      assignee,
      markedBy,
      existingId,
    }: {
      date: string;
      assignee: string;
      markedBy: string;
      existingId?: string;
    }) => {
      if (existingId) {
        const { error } = await supabase
          .from('responsibility_completions')
          .delete()
          .eq('id', existingId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase.from('responsibility_completions').insert({
        responsibility_id: respId,
        date,
        user_id: assignee,
        marked_by: markedBy,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['completions', respId] }),
  });
}

/** A swap is an override row for one date; upsert so re-swapping works. */
export function useSetOverride(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, userId }: { date: string; userId: string }) => {
      const { error } = await supabase
        .from('responsibility_overrides')
        .upsert(
          { responsibility_id: respId, date, user_id: userId },
          { onConflict: 'responsibility_id,date' }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overrides', respId] }),
  });
}

/**
 * Both halves of a swap in one upsert. Writing them as two separate mutations
 * would let the first land and the second fail, which leaves one person cooking
 * twice and the other not at all.
 */
export function useApplySwap(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { date: string; user_id: string }[]) => {
      const { error } = await supabase
        .from('responsibility_overrides')
        .upsert(
          rows.map((row) => ({ ...row, responsibility_id: respId })),
          { onConflict: 'responsibility_id,date' }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overrides', respId] }),
  });
}

// --- swap requests ----------------------------------------------------------

export type SwapRequest = {
  id: string;
  date: string;
  requested_by: string;
  note: string;
  created_at: string;
};

export function useSwapRequests(respId: string | undefined) {
  return useQuery({
    queryKey: ['swap-requests', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('swap_requests')
          .select('id, date, requested_by, note, created_at')
          .eq('responsibility_id', respId!)
          .order('date')
      ) as SwapRequest[],
    enabled: !!respId,
  });
}

/** "I cannot cook that night." Upserts, so asking twice is not two asks. */
export function useRequestSwap(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      requestedBy,
      note,
    }: {
      date: string;
      requestedBy: string;
      note: string;
    }) => {
      const { error } = await supabase
        .from('swap_requests')
        .upsert(
          { responsibility_id: respId, date, requested_by: requestedBy, note },
          { onConflict: 'responsibility_id,date' }
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests', respId] }),
  });
}

export function useCloseSwapRequest(respId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('swap_requests').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['swap-requests', respId] }),
  });
}

// --- penalties --------------------------------------------------------------

export function usePenalties() {
  return useQuery({
    queryKey: ['penalties'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('penalties')
          .select('id, user_id, issued_by, responsibility_id, date, amount, reason, created_at')
          .order('date', { ascending: false })
      ) as Penalty[],
  });
}

export function useIssuePenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      issuedBy,
      responsibilityId,
      date,
      reason,
      amount = 10,
    }: {
      userId: string;
      issuedBy: string;
      responsibilityId: string | null;
      date: string;
      reason: string;
      amount?: number;
    }) => {
      const { error } = await supabase.from('penalties').insert({
        user_id: userId,
        issued_by: issuedBy,
        responsibility_id: responsibilityId,
        date,
        amount,
        reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penalties'] }),
  });
}

export function useRevokePenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('penalties').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penalties'] }),
  });
}
