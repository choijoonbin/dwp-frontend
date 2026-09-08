import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, LockKeyhole } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { getVideoMeetingPersonalRoom } from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { personalRoomInvitationUrl } from './meeting-personal-room-model';
import { meetingHomeInset } from './meeting-home-presentation';

/** Copy is a fresh owner read, not a reuse of a potentially rotated invitation. */
export function MeetingHomePersonalRoom({ scope, enabled }: { scope: string; enabled: boolean }) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const client = useQueryClient();
  const key = useMemo(() => ['meetings', 'home', 'personal-room', scope] as const, [scope]);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const copying = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'copied' | 'copyFailed' | 'changed' | null>(null);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const current = ++sequence.current;
      setNotice(null);
      const room = await getVideoMeetingPersonalRoom(signal);
      if (signal.aborted || current !== sequence.current)
        throw new DOMException('Superseded', 'AbortError');
      return room;
    },
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 60_000,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = enabled;
    if (!enabled) void client.cancelQueries({ queryKey: key });
    return () => {
      mounted.current = false;
      sequence.current += 1;
      copying.current?.abort();
      client.removeQueries({ queryKey: key });
    };
  }, [client, enabled, key]);
  const room = enabled && !query.isError && !query.isFetching ? query.data : null;
  const url = room ? personalRoomInvitationUrl(window.location.origin, room) : '';
  const copy = async () => {
    if (!room || !enabled || copying.current) return;
    const controller = new AbortController();
    copying.current = controller;
    const current = ++sequence.current;
    setBusy(true);
    setNotice(null);
    try {
      const fresh = await getVideoMeetingPersonalRoom(controller.signal);
      if (!mounted.current || controller.signal.aborted || current !== sequence.current) return;
      if (!fresh || fresh.roomId !== room.roomId) {
        client.setQueryData(key, null);
        setNotice('changed');
        return;
      }
      client.setQueryData(key, fresh);
      if (
        fresh.version !== room.version ||
        fresh.invitationRevision !== room.invitationRevision ||
        fresh.opaqueAlias !== room.opaqueAlias
      ) {
        setNotice('changed');
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(personalRoomInvitationUrl(window.location.origin, fresh));
      if (mounted.current && current === sequence.current && !controller.signal.aborted)
        setNotice('copied');
    } catch {
      if (mounted.current && current === sequence.current && !controller.signal.aborted) {
        client.setQueryData(key, null);
        setNotice('copyFailed');
      }
    } finally {
      if (copying.current === controller) copying.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Box
      data-testid="meeting-home-personal-room"
      sx={(theme) => ({ ...meetingHomeInset(theme), p: 1.25 })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5}>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<LockKeyhole size={16} aria-hidden="true" />}
          aria-label={room?.name || t('personalRoom.title')}
          onClick={() => navigate('/meetings/mine?view=personal-room')}
          sx={{ minWidth: 0, justifyContent: 'start', textAlign: 'left', px: 0.5 }}
        >
          <Box component="span" sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              variant="caption"
              fontWeight="fontWeightBold"
              sx={{ display: 'block', overflowWrap: 'anywhere' }}
            >
              {room?.name || t('personalRoom.title')}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block' }}
            >
              {room
                ? t('home.homePolish.privateInvitation')
                : t('home.homePolish.personalRoomOpen')}
            </Typography>
          </Box>
        </ActionButton>
        {room && (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Copy size={14} aria-hidden="true" />}
            disabled={!url || busy}
            loading={busy}
            onClick={() => void copy()}
            sx={{ flexShrink: 0, minHeight: 44 }}
          >
            {t('home.homePolish.copySecureLink')}
          </ActionButton>
        )}
      </Stack>
      {notice && (
        <Typography
          role="status"
          variant="caption"
          color={notice === 'copied' ? 'success.main' : 'text.secondary'}
          sx={{ display: 'block', mt: 0.5 }}
        >
          {t(`home.homePolish.${notice}`)}
        </Typography>
      )}
    </Box>
  );
}
