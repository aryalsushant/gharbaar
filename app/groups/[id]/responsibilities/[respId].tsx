import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, ErrorText, Loading, Screen, Subtitle, styles, theme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  useClearOverride,
  useCompletions,
  useMembers,
  useOverrides,
  useResponsibility,
  useRotationMembers,
  useSetOverride,
  useToggleCompletion,
} from '@/lib/db';
import { dateRange, fromDateKey, getAssignee, toDateKey } from '@/lib/rotation';

const DAYS_SHOWN = 14;

export default function RotationScreen() {
  const { id, respId } = useLocalSearchParams<{ id: string; respId: string }>();
  const groupId = id!;
  const responsibilityId = respId!;
  const { userId } = useAuth();

  const responsibility = useResponsibility(responsibilityId);
  const rotationMembers = useRotationMembers(responsibilityId);
  const overrides = useOverrides(responsibilityId);
  const completions = useCompletions(responsibilityId);
  const members = useMembers(groupId);

  const toggleCompletion = useToggleCompletion(responsibilityId);
  const setOverride = useSetOverride(responsibilityId);
  const clearOverride = useClearOverride(responsibilityId);

  // Which day's swap picker is open, if any.
  const [swapping, setSwapping] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members.data ?? []) {
      map.set(m.user_id, m.profiles?.display_name || 'Someone');
    }
    return (uid: string | null) =>
      uid === null ? 'Nobody' : uid === userId ? 'You' : (map.get(uid) ?? 'Someone');
  }, [members.data, userId]);

  const today = toDateKey(new Date());
  const days = useMemo(() => dateRange(today, DAYS_SHOWN), [today]);

  if (responsibility.isLoading || rotationMembers.isLoading || members.isLoading) {
    return <Loading label="Loading rotation…" />;
  }
  if (responsibility.error) {
    return (
      <Screen>
        <ErrorText>{responsibility.error.message}</ErrorText>
      </Screen>
    );
  }

  const resp = responsibility.data!;
  const rotation = rotationMembers.data ?? [];
  const overrideRows = overrides.data ?? [];
  const completionRows = completions.data ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: resp.name }} />

      <Subtitle>
        Rotates daily between {rotation.filter((m) => m.is_active).length} people, starting{' '}
        {fromDateKey(resp.rotation_start_date).toLocaleDateString()}. Whose turn it is on any
        date is calculated, not scheduled — a swap just pins one day to someone else.
      </Subtitle>

      <ErrorText>
        {toggleCompletion.error?.message ||
          setOverride.error?.message ||
          clearOverride.error?.message}
      </ErrorText>

      <View style={{ gap: 10 }}>
        {days.map((dateKey) => {
          const assignee = getAssignee(resp, rotation, overrideRows, dateKey);
          const overridden = overrideRows.some((o) => o.date === dateKey);
          const completion = completionRows.find((c) => c.date === dateKey);
          const isToday = dateKey === today;
          const date = fromDateKey(dateKey);

          return (
            <Card key={dateKey}>
              <View style={rowStyle}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 13, color: theme.muted, fontWeight: '600' }}>
                    {isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'long' })}
                    {' · '}
                    {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: theme.text }}>
                    {nameOf(assignee)}
                    {overridden ? (
                      <Text style={{ fontSize: 13, color: theme.accent }}> (swapped)</Text>
                    ) : null}
                  </Text>
                </View>

                {completion ? (
                  <Text style={{ color: theme.positive, fontWeight: '700' }}>✓ done</Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={completion ? 'Undo' : 'Mark done'}
                    variant="secondary"
                    disabled={!assignee}
                    onPress={() =>
                      assignee &&
                      toggleCompletion.mutate({
                        date: dateKey,
                        userId: assignee,
                        existingId: completion?.id,
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={swapping === dateKey ? 'Close' : 'Swap'}
                    variant="secondary"
                    onPress={() => setSwapping(swapping === dateKey ? null : dateKey)}
                  />
                </View>
              </View>

              {swapping === dateKey && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={styles.label}>Give this day to</Text>
                  {rotation.map((m) => (
                    <Pressable
                      key={m.user_id}
                      onPress={() => {
                        setOverride.mutate({ date: dateKey, userId: m.user_id });
                        setSwapping(null);
                      }}>
                      <View style={[pickerRow, assignee === m.user_id && pickerRowActive]}>
                        <Text style={{ color: theme.text, fontSize: 15 }}>{nameOf(m.user_id)}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {overridden && (
                    <Button
                      title="Clear swap (back to the rotation)"
                      variant="secondary"
                      onPress={() => {
                        clearOverride.mutate(dateKey);
                        setSwapping(null);
                      }}
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const rowStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
} as const;

const pickerRow = {
  backgroundColor: theme.bg,
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 11,
} as const;

const pickerRowActive = { borderColor: theme.accent, borderWidth: 2 } as const;
