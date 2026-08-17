import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, ErrorText, Field, Loading, Screen, Subtitle, styles, theme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatMoney, splitEqually, toCents, fromCents } from '@/lib/balances';
import { useAddExpense, useMembers } from '@/lib/db';

export default function AddExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id!;
  const router = useRouter();
  const { userId } = useAuth();

  const members = useMembers(groupId);
  const addExpense = useAddExpense(groupId);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paidBy && userId) setPaidBy(userId);
  }, [userId, paidBy]);

  const parsed = Number.parseFloat(amount);
  const validAmount = Number.isFinite(parsed) && parsed > 0;
  const memberIds = members.data?.map((m) => m.user_id) ?? [];

  // Show the exact per-person figure, including which people absorb the
  // leftover pennies, before anything is written.
  const preview = validAmount && memberIds.length > 0
    ? splitEqually(toCents(parsed), memberIds.length)
    : [];

  async function submit() {
    setError('');
    if (!validAmount || !paidBy || memberIds.length === 0) return;
    try {
      await addExpense.mutateAsync({
        amount: parsed,
        description,
        paidBy,
        memberIds,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense.');
    }
  }

  if (members.isLoading) return <Loading label="Loading members…" />;

  return (
    <Screen>
      <Field
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="42.50"
        keyboardType="decimal-pad"
        autoFocus
      />
      <Field
        label="What for"
        value={description}
        onChangeText={setDescription}
        placeholder="Groceries"
        autoCapitalize="sentences"
      />

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Paid by</Text>
        {members.data?.map((m) => (
          <Pressable key={m.user_id} onPress={() => setPaidBy(m.user_id)}>
            <View style={[pickerRow, paidBy === m.user_id && pickerRowActive]}>
              <Text style={{ color: theme.text, fontSize: 15 }}>
                {m.user_id === userId ? 'You' : m.profiles?.display_name || 'Someone'}
              </Text>
              {paidBy === m.user_id ? (
                <Text style={{ color: theme.accent, fontWeight: '700' }}>✓</Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {preview.length > 0 && (
        <Card>
          <Subtitle>
            Split equally between {memberIds.length} · everyone owes{' '}
            {formatMoney(fromCents(preview[preview.length - 1]))}
            {preview[0] !== preview[preview.length - 1]
              ? `, except ${preview.filter((c) => c === preview[0]).length} paying ${formatMoney(fromCents(preview[0]))}`
              : ''}
          </Subtitle>
        </Card>
      )}

      <ErrorText>{error || addExpense.error?.message}</ErrorText>
      <Button
        title="Save expense"
        onPress={submit}
        loading={addExpense.isPending}
        disabled={!validAmount || !paidBy}
      />
      <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const pickerRow = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: theme.surface,
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
} as const;

const pickerRowActive = { borderColor: theme.accent, borderWidth: 2 } as const;
