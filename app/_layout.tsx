import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading, theme } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

/**
 * Signed-out users get bounced to sign-in, except on /join/[code] — an invite
 * link has to survive the round trip through sign-up, so that screen handles
 * its own redirect and carries the code along.
 */
function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';
  const inJoinRoute = segments[0] === 'join';

  useEffect(() => {
    if (loading) return;
    if (!session && !inAuthGroup && !inJoinRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/groups');
    }
  }, [session, loading, inAuthGroup, inJoinRoute, router]);

  if (loading) return <Loading label="Starting up…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: theme.bg },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="groups/index" options={{ title: 'Your groups' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="join/[code]" options={{ title: 'Join group' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
