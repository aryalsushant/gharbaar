import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Screen,
  Title,
  styles,
  theme,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCreateGroup, useGroups } from '@/lib/db';

export default function GroupsScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const groups = useGroups();
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function submit() {
    if (!userId || !name.trim()) return;
    try {
      const group = await createGroup.mutateAsync({ name, userId });
      setName('');
      setCreating(false);
      router.push(`/groups/${group.id}`);
    } catch {
      // surfaced through createGroup.error below
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" style={{ color: theme.accent, fontWeight: '600' }}>
              Settings
            </Link>
          ),
        }}
      />

      {creating ? (
        <Card>
          <Field
            label="Group name"
            value={name}
            onChangeText={setName}
            placeholder="Flat 3B"
            autoCapitalize="words"
            autoFocus
          />
          <ErrorText>{createGroup.error?.message}</ErrorText>
          <View style={{ gap: 8, marginTop: 4 }}>
            <Button
              title="Create group"
              onPress={submit}
              loading={createGroup.isPending}
              disabled={!name.trim()}
            />
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setCreating(false);
                setName('');
              }}
            />
          </View>
        </Card>
      ) : (
        <Button title="+ New group" onPress={() => setCreating(true)} />
      )}

      {groups.isLoading ? (
        <Loading label="Loading groups…" />
      ) : groups.error ? (
        <ErrorText>{groups.error.message}</ErrorText>
      ) : groups.data?.length === 0 ? (
        <EmptyState
          title="No groups yet"
          hint="Create one, or open an invite link someone sent you."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {groups.data?.map((group) => (
            <Pressable key={group.id} onPress={() => router.push(`/groups/${group.id}`)}>
              {({ pressed }) => (
                <View style={[localStyles.groupCard, pressed && { opacity: 0.7 }]}>
                  <Title>{group.name}</Title>
                  <Text style={styles.muted}>
                    Created {new Date(group.created_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const localStyles = {
  groupCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 4,
  },
};
