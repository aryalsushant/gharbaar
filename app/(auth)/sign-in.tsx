import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ErrorText, Field, Screen, Subtitle, Title, styles, theme } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  // Set when an invite link bounced an unauthenticated user through here.
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace(next ? (next as never) : '/groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 40 }}>
        <Title>Gharbaar</Title>
        <Subtitle>Split what you spend and whose turn it is.</Subtitle>
      </View>

      <View style={{ gap: 14, marginTop: 24 }}>
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
          placeholder="••••••••"
          secureTextEntry
          autoComplete="current-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        <Text style={styles.muted}>No account yet?</Text>
        <Link
          href={next ? { pathname: '/(auth)/sign-up', params: { next } } : '/(auth)/sign-up'}
          style={{ color: theme.accent, fontWeight: '600' }}>
          Sign up
        </Link>
      </View>
    </Screen>
  );
}
