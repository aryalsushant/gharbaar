import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Row,
  Screen,
  styles,
  theme,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { computeBalances, formatMoney, settleUp } from '@/lib/balances';
import { useExpenses, useGroup, useMembers, useResponsibilities, useSplits } from '@/lib/db';

type Tab = 'expenses' | 'balances' | 'responsibilities';

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id!;
  const router = useRouter();
  const { userId } = useAuth();

  const [tab, setTab] = useState<Tab>('expenses');

  const group = useGroup(groupId);
  const members = useMembers(groupId);
  const expenses = useExpenses(groupId);
  const splits = useSplits(groupId);
  const responsibilities = useResponsibilities(groupId);

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members.data ?? []) {
      map.set(m.user_id, m.profiles?.display_name || 'Someone');
    }
    return (uid: string) => (uid === userId ? 'You' : (map.get(uid) ?? 'Someone'));
  }, [members.data, userId]);

  const balances = useMemo(() => {
    if (!members.data || !expenses.data || !splits.data) return [];
    return computeBalances(
      expenses.data,
      splits.data,
      members.data.map((m) => m.user_id)
    );
  }, [members.data, expenses.data, splits.data]);

  const settlements = useMemo(() => settleUp(balances), [balances]);

  return (
    <Screen>
      <Stack.Screen options={{ title: group.data?.name ?? 'Group' }} />

      <View style={tabStyles.bar}>
        {(['expenses', 'balances', 'responsibilities'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[tabStyles.tab, tab === t && tabStyles.tabActive]}>
            <Text style={[tabStyles.tabText, tab === t && tabStyles.tabTextActive]}>
              {t === 'expenses' ? 'Expenses' : t === 'balances' ? 'Balances' : 'Chores'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Row>
        <Text style={styles.muted}>
          {members.data?.length ?? 0} member{members.data?.length === 1 ? '' : 's'}
        </Text>
        <Pressable onPress={() => router.push(`/groups/${groupId}/invite`)}>
          <Text style={{ color: theme.accent, fontWeight: '600' }}>Invite someone</Text>
        </Pressable>
      </Row>

      {tab === 'expenses' && (
        <View style={{ gap: 12 }}>
          <Button
            title="+ Add expense"
            onPress={() => router.push(`/groups/${groupId}/add-expense`)}
          />
          {expenses.isLoading ? (
            <Loading label="Loading expenses…" />
          ) : expenses.error ? (
            <ErrorText>{expenses.error.message}</ErrorText>
          ) : expenses.data?.length === 0 ? (
            <EmptyState title="No expenses yet" hint="Add the first one and it splits evenly." />
          ) : (
            expenses.data?.map((expense) => (
              <Card key={expense.id}>
                <Row>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, flex: 1 }}>
                    {expense.description || 'Expense'}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                    {formatMoney(expense.amount)}
                  </Text>
                </Row>
                <Text style={styles.muted}>
                  {nameOf(expense.paid_by)} paid · {new Date(expense.created_at).toLocaleDateString()}
                </Text>
              </Card>
            ))
          )}
        </View>
      )}

      {tab === 'balances' && (
        <View style={{ gap: 12 }}>
          {members.isLoading || splits.isLoading ? (
            <Loading label="Working out balances…" />
          ) : balances.length === 0 ? (
            <EmptyState title="Nothing to settle" />
          ) : (
            <>
              <Card>
                {balances.map((b) => (
                  <Row key={b.user_id}>
                    <Text style={{ color: theme.text, fontSize: 15 }}>{nameOf(b.user_id)}</Text>
                    <Text
                      style={{
                        fontWeight: '700',
                        fontSize: 15,
                        color:
                          b.net > 0 ? theme.positive : b.net < 0 ? theme.danger : theme.muted,
                      }}>
                      {b.net === 0
                        ? 'settled up'
                        : b.net > 0
                          ? `is owed ${formatMoney(b.net)}`
                          : `owes ${formatMoney(b.net)}`}
                    </Text>
                  </Row>
                ))}
              </Card>

              {settlements.length > 0 && (
                <Card>
                  <Text style={{ fontWeight: '600', color: theme.text, marginBottom: 4 }}>
                    Simplest way to settle
                  </Text>
                  {settlements.map((s, i) => (
                    <Text key={i} style={styles.muted}>
                      {nameOf(s.from)} → {nameOf(s.to)}: {formatMoney(s.amount)}
                    </Text>
                  ))}
                </Card>
              )}
            </>
          )}
        </View>
      )}

      {tab === 'responsibilities' && (
        <View style={{ gap: 12 }}>
          <Button
            title="+ New responsibility"
            onPress={() => router.push(`/groups/${groupId}/new-responsibility`)}
          />
          {responsibilities.isLoading ? (
            <Loading label="Loading…" />
          ) : responsibilities.error ? (
            <ErrorText>{responsibilities.error.message}</ErrorText>
          ) : responsibilities.data?.length === 0 ? (
            <EmptyState
              title="No responsibilities yet"
              hint="Add one, pick who is in the rotation, and it assigns itself daily."
            />
          ) : (
            responsibilities.data?.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/groups/${groupId}/responsibilities/${r.id}`)}>
                {({ pressed }) => (
                  <View style={[cardLike, pressed && { opacity: 0.7 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                      {r.name}
                    </Text>
                    <Text style={styles.muted}>Daily rotation · tap to see the schedule</Text>
                  </View>
                )}
              </Pressable>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const cardLike = {
  backgroundColor: theme.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: theme.border,
  padding: 16,
  gap: 4,
} as const;

const tabStyles = {
  bar: {
    flexDirection: 'row',
    backgroundColor: '#efece7',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  tabActive: { backgroundColor: theme.surface },
  tabText: { color: theme.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: theme.text },
} as const;
