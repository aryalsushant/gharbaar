import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

// No I/O/0/1 — these codes get read aloud and typed in by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8): string {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * Expo Router serves /join/[code] on every platform, so one route backs both
 * link shapes: gharbaar://join/ABC123 on native, https://host/join/ABC123 on web.
 */
export function inviteLink(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/join/${code}`;
  }
  return Linking.createURL(`/join/${code}`);
}
