import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Button, Card, ErrorText, Field, Loading, Screen, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProfile, useUpdateProfile } from '@/lib/db';

export default function Settings() {
  const { userId, session, signOut } = useAuth();
  const router = useRouter();

  const profile = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);

  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data) setDisplayName(profile.data.display_name);
  }, [profile.data]);

  if (profile.isLoading) return <Loading label="Loading profile…" />;

  return (
    <Screen>
      <Card>
        <Text style={styles.muted}>Signed in as</Text>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>{session?.user.email}</Text>
      </Card>

      <Field
        label="Display name"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          setSaved(false);
        }}
        placeholder="Your name"
        autoCapitalize="words"
      />
      <ErrorText>{profile.error?.message || updateProfile.error?.message}</ErrorText>
      {saved ? <Text style={styles.muted}>Saved.</Text> : null}
      <Button
        title="Save"
        loading={updateProfile.isPending}
        disabled={!displayName.trim()}
        onPress={async () => {
          await updateProfile.mutateAsync(displayName);
          setSaved(true);
        }}
      />

      <Button
        title="Sign out"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/sign-in');
        }}
      />
    </Screen>
  );
}
