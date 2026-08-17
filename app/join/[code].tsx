import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, ErrorText, Loading, Screen, Subtitle, Title, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useInvitePreview, useJoinGroup } from '@/lib/db';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const inviteCode = (code ?? '').toUpperCase();
  const { session, loading } = useAuth();
  const router = useRouter();

  const preview = useInvitePreview(inviteCode);
  const join = useJoinGroup();
  const [error, setError] = useState('');

  if (loading) return <Loading />;

  // Send an unauthenticated visitor to sign-in, carrying the invite along so
  // they land back here the moment they have an account.
  if (!session) {
    return (
      <Redirect href={{ pathname: '/(auth)/sign-in', params: { next: `/join/${inviteCode}` } }} />
    );
  }

  async function accept() {
    setError('');
    try {
      const groupId = await join.mutateAsync(inviteCode);
      router.replace(`/groups/${groupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join that group.');
    }
  }

  return (
    <Screen>
      <Title>Join a group</Title>

      {preview.isLoading ? (
        <Loading label="Checking the invite…" />
      ) : !preview.data ? (
        <Card>
          <Subtitle>
            No group matches the code {inviteCode}. Ask whoever sent it for a fresh link.
          </Subtitle>
        </Card>
      ) : (
        <Card>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{preview.data.group_name}</Text>
          <Text style={styles.muted}>Invite code {inviteCode}</Text>
          {!preview.data.is_valid && (
            <ErrorText>This invite has expired or has been used up.</ErrorText>
          )}
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      <Button
        title="Join this group"
        onPress={accept}
        loading={join.isPending}
        disabled={!preview.data?.is_valid}
      />
      <Button title="Not now" variant="secondary" onPress={() => router.replace('/groups')} />
    </Screen>
  );
}
