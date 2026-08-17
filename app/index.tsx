import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={session ? '/groups' : '/(auth)/sign-in'} />;
}
