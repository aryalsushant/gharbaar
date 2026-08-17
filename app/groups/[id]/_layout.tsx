import { Stack } from 'expo-router';

import { theme } from '@/components/ui';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: theme.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'Group' }} />
      <Stack.Screen name="add-expense" options={{ title: 'Add expense', presentation: 'modal' }} />
      <Stack.Screen name="invite" options={{ title: 'Invite' }} />
      <Stack.Screen
        name="new-responsibility"
        options={{ title: 'New responsibility', presentation: 'modal' }}
      />
      <Stack.Screen name="responsibilities/[respId]" options={{ title: 'Rotation' }} />
    </Stack>
  );
}
