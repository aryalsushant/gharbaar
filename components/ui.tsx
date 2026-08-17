import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const theme = {
  bg: '#faf9f7',
  surface: '#ffffff',
  border: '#e5e1da',
  text: '#1c1917',
  muted: '#78716c',
  accent: '#0f766e',
  danger: '#b91c1c',
  positive: '#15803d',
};

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const inner = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? theme.text : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.muted}>{hint}</Text> : null}
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  screenInner: { flex: 1, padding: 20, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  scrollContent: { flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.muted, lineHeight: 21 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 8,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.muted },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.text,
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonSecondary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  buttonDanger: { backgroundColor: theme.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextSecondary: { color: theme.text },
  error: { color: theme.danger, fontSize: 14 },
  muted: { color: theme.muted, fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
