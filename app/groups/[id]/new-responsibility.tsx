import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, ErrorText, Field, Loading, Screen, Subtitle, styles, theme } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCreateResponsibility, useMembers } from '@/lib/db';
import { toDateKey } from '@/lib/rotation';

export default function NewResponsibility() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id!;
  const router = useRouter();
  const { userId } = useAuth();

  const members = useMembers(groupId);
  const create = useCreateResponsibility(groupId);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(toDateKey(new Date()));
  // Order matters: this array *is* the rotation order.
  const [rotation, setRotation] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (rotation.length === 0 && members.data && members.data.length > 0) {
      setRotation(members.data.map((m) => m.user_id));
    }
  }, [members.data, rotation.length]);

  function toggle(uid: string) {
    setRotation((current) =>
      current.includes(uid) ? current.filter((u) => u !== uid) : [...current, uid]
    );
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  async function submit() {
    setError('');
    if (!name.trim() || rotation.length === 0 || !validDate) return;
    try {
      await create.mutateAsync({ name, startDate, memberIds: rotation });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the responsibility.');
    }
  }

  if (members.isLoading) return <Loading label="Loading members…" />;

  return (
    <Screen>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Cooking dinner"
        autoCapitalize="sentences"
        autoFocus
      />
      <Field
        label="Rotation starts on"
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
      />

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Who is in the rotation</Text>
        <Subtitle>Tap to include. The order you tap is the order they take turns.</Subtitle>
        {members.data?.map((m) => {
          const position = rotation.indexOf(m.user_id);
          const included = position >= 0;
          return (
            <Pressable key={m.user_id} onPress={() => toggle(m.user_id)}>
              <View style={[pickerRow, included && pickerRowActive]}>
                <Text style={{ color: theme.text, fontSize: 15 }}>
                  {m.user_id === userId ? 'You' : m.profiles?.display_name || 'Someone'}
                </Text>
                {included ? (
                  <Text style={{ color: theme.accent, fontWeight: '700' }}>#{position + 1}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error || create.error?.message}</ErrorText>
      <Button
        title="Create responsibility"
        onPress={submit}
        loading={create.isPending}
        disabled={!name.trim() || rotation.length === 0 || !validDate}
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
