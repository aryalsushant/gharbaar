import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { splitEqually, toCents, fromCents } from './balances';
import { generateInviteCode } from './invite';
import { supabase } from './supabase';

export type Profile = { id: string; display_name: string; avatar_url: string | null };
export type Group = { id: string; name: string; created_by: string; created_at: string };
export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  profiles: Profile | null;
};
export type Expense = {
  id: string;
  group_id: string;
  paid_by: string;
  amount: number;
  description: string;
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
  group_id: string;
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
export type ResponsibilityCompletion = { id: string; date: string; user_id: string };

/** Every Supabase call funnels through here so one error shape reaches the UI. */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// --- groups -----------------------------------------------------------------

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('groups')
          .select('id, name, created_by, created_at')
          .order('created_at', { ascending: false })
      ) as Group[],
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('groups')
          .select('id, name, created_by, created_at')
          .eq('id', groupId)
          .single()
      ) as Group,
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) =>
      unwrap(
        await supabase
          .from('groups')
          .insert({ name: name.trim(), created_by: userId })
          .select('id, name, created_by, created_at')
          .single()
      ) as Group,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useMembers(groupId: string) {
  return useQuery({
    queryKey: ['members', groupId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('group_members')
          .select('id, group_id, user_id, role, is_active, profiles(id, display_name, avatar_url)')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .order('joined_at')
      ) as unknown as GroupMember[],
    enabled: !!groupId,
  });
}

// --- invites ----------------------------------------------------------------

export function useInvites(groupId: string) {
  return useQuery({
    queryKey: ['invites', groupId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('group_invites')
          .select('id, invite_code, uses_count, max_uses, expires_at, created_at')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
      ) as { id: string; invite_code: string; uses_count: number; created_at: string }[],
    enabled: !!groupId,
  });
}

export function useCreateInvite(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      unwrap(
        await supabase
          .from('group_invites')
          .insert({
            group_id: groupId,
            invite_code: generateInviteCode(),
            created_by: userId,
          })
          .select('id, invite_code, uses_count, created_at')
          .single()
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', groupId] }),
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group_with_code', { code });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useInvitePreview(code: string) {
  return useQuery({
    queryKey: ['invite-preview', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_invite', { code });
      if (error) throw new Error(error.message);
      const row = (data as { group_id: string; group_name: string; is_valid: boolean }[])?.[0];
      return row ?? null;
    },
    enabled: !!code,
    retry: false,
  });
}

// --- expenses ---------------------------------------------------------------

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: ['expenses', groupId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('expenses')
          .select('id, group_id, paid_by, amount, description, created_at')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
      ) as Expense[],
    enabled: !!groupId,
  });
}

export function useSplits(groupId: string) {
  return useQuery({
    queryKey: ['splits', groupId],
    queryFn: async () => {
      const expenses = unwrap(
        await supabase.from('expenses').select('id').eq('group_id', groupId)
      ) as { id: string }[];
      if (expenses.length === 0) return [] as ExpenseSplit[];
      return unwrap(
        await supabase
          .from('expense_splits')
          .select('id, expense_id, user_id, amount_owed, settled')
          .in(
            'expense_id',
            expenses.map((e) => e.id)
          )
      ) as ExpenseSplit[];
    },
    enabled: !!groupId,
  });
}

/**
 * Insert the expense, then its equal splits. The split amounts are computed in
 * cents so they always add back up to the expense total.
 */
export function useAddExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      description,
      paidBy,
      memberIds,
    }: {
      amount: number;
      description: string;
      paidBy: string;
      memberIds: string[];
    }) => {
      const expense = unwrap(
        await supabase
          .from('expenses')
          .insert({
            group_id: groupId,
            paid_by: paidBy,
            amount,
            description: description.trim(),
            split_type: 'equal',
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
      qc.invalidateQueries({ queryKey: ['expenses', groupId] });
      qc.invalidateQueries({ queryKey: ['splits', groupId] });
    },
  });
}

// --- responsibilities -------------------------------------------------------

export function useResponsibilities(groupId: string) {
  return useQuery({
    queryKey: ['responsibilities', groupId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibilities')
          .select('id, group_id, name, frequency, rotation_start_date')
          .eq('group_id', groupId)
          .order('created_at')
      ) as Responsibility[],
    enabled: !!groupId,
  });
}

export function useCreateResponsibility(groupId: string) {
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
          .insert({
            group_id: groupId,
            name: name.trim(),
            frequency: 'daily',
            rotation_start_date: startDate,
          })
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['responsibilities', groupId] }),
  });
}

export function useResponsibility(respId: string) {
  return useQuery({
    queryKey: ['responsibility', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibilities')
          .select('id, group_id, name, frequency, rotation_start_date')
          .eq('id', respId)
          .single()
      ) as Responsibility,
    enabled: !!respId,
  });
}

export function useRotationMembers(respId: string) {
  return useQuery({
    queryKey: ['rotation-members', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_members')
          .select('id, responsibility_id, user_id, rotation_order, is_active')
          .eq('responsibility_id', respId)
          .order('rotation_order')
      ) as ResponsibilityMember[],
    enabled: !!respId,
  });
}

export function useOverrides(respId: string) {
  return useQuery({
    queryKey: ['overrides', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_overrides')
          .select('id, date, user_id')
          .eq('responsibility_id', respId)
      ) as ResponsibilityOverride[],
    enabled: !!respId,
  });
}

export function useCompletions(respId: string) {
  return useQuery({
    queryKey: ['completions', respId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('responsibility_completions')
          .select('id, date, user_id')
          .eq('responsibility_id', respId)
      ) as ResponsibilityCompletion[],
    enabled: !!respId,
  });
}

export function useToggleCompletion(respId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      userId,
      existingId,
    }: {
      date: string;
      userId: string;
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
      const { error } = await supabase
        .from('responsibility_completions')
        .insert({ responsibility_id: respId, date, user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['completions', respId] }),
  });
}

/** A swap is just an override row for one date; upsert so re-swapping works. */
export function useSetOverride(respId: string) {
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

export function useClearOverride(respId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('responsibility_overrides')
        .delete()
        .eq('responsibility_id', respId)
        .eq('date', date);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['overrides', respId] }),
  });
}

// --- profile ----------------------------------------------------------------

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', userId!)
          .single()
      ) as Profile,
    enabled: !!userId,
  });
}

export function useUpdateProfile(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', userId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  });
}
