import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ErrorText, Field, Screen, Subtitle, Title, styles, theme } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signUp(email, password, displayName);
      // With email confirmation on, signUp returns no session and the auth
      // listener never fires — say so rather than silently doing nothing.
      setNotice('Account created. If a confirmation email arrives, confirm it, then sign in.');
      router.replace(next ? (next as never) : '/groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign up.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 40 }}>
        <Title>Create account</Title>
        <Subtitle>You will need one to join or start a household.</Subtitle>
      </View>

      <View style={{ gap: 14, marginTop: 24 }}>
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Sushant"
          autoCapitalize="words"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete="new-password"
        />
        <ErrorText>{error}</ErrorText>
        {notice ? <Text style={styles.muted}>{notice}</Text> : null}
        <Button
          title="Create account"
          onPress={submit}
          loading={busy}
          disabled={!email || !password || !displayName}
        />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        <Text style={styles.muted}>Already have one?</Text>
        <Link
          href={next ? { pathname: '/(auth)/sign-in', params: { next } } : '/(auth)/sign-in'}
          style={{ color: theme.accent, fontWeight: '600' }}>
          Sign in
        </Link>
      </View>
    </Screen>
  );
}
