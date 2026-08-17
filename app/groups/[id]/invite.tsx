import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Subtitle,
  styles,
  theme,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCreateInvite, useInvites } from '@/lib/db';
import { inviteLink } from '@/lib/invite';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id!;
  const { userId } = useAuth();

  const invites = useInvites(groupId);
  const createInvite = useCreateInvite(groupId);

  const latest = invites.data?.[0];
  const link = latest ? inviteLink(latest.invite_code) : '';

  return (
    <Screen>
      <Subtitle>
        Share the code or the link. Anyone who opens it and signs in joins this group.
      </Subtitle>

      {invites.isLoading ? (
        <Loading label="Loading invites…" />
      ) : !latest ? (
        <EmptyState title="No invite code yet" hint="Generate one to add people." />
      ) : (
        <Card>
          <Text style={codeStyle}>{latest.invite_code}</Text>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <QRCode value={link} size={180} backgroundColor={theme.surface} color={theme.text} />
          </View>
          <Text style={[styles.muted, { textAlign: 'center' }]} selectable>
            {link}
          </Text>
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Used {latest.uses_count} time{latest.uses_count === 1 ? '' : 's'}
          </Text>

          <View style={{ gap: 8, marginTop: 8 }}>
            <Button
              title="Copy link"
              variant="secondary"
              onPress={() => Clipboard.setStringAsync(link)}
            />
            <Button
              title="Share"
              variant="secondary"
              onPress={() =>
                Share.share({ message: `Join my group on Gharbaar: ${link}` }).catch(() => {})
              }
            />
          </View>
        </Card>
      )}

      <ErrorText>{createInvite.error?.message}</ErrorText>
      <Button
        title={latest ? 'Generate a new code' : 'Generate invite code'}
        onPress={() => userId && createInvite.mutate(userId)}
        loading={createInvite.isPending}
      />
    </Screen>
  );
}

const codeStyle = {
  fontSize: 34,
  fontWeight: '700',
  letterSpacing: 6,
  textAlign: 'center',
  color: theme.text,
} as const;
