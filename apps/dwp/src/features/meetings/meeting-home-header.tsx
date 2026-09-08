import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus2, Hash, RefreshCw, Video } from 'lucide-react';
import { ActionButton, ActionIconButton, FormDialog, FormField } from '@dwp-frontend/design-system';
import { normalizeVideoMeetingCode } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatHomeJoinCode, homeMeetingDate } from './meeting-home-model';
import { meetingHomeCard } from './meeting-home-presentation';
import { meetingShape } from './meeting-visual-system';

type Props = {
  timeZone: string;
  now: number;
  updatedAt: number;
  refreshing: boolean;
  disabled: boolean;
  scheduleDisabled?: boolean;
  starting: boolean;
  joinCode: string;
  meetingCount: number;
  live: boolean;
  onCodeChange: (value: string) => void;
  onRefresh: () => void;
  onSchedule: () => void;
  onStart: () => void;
};
export function MeetingHomeHeader(props: Props) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const [codeOpen, setCodeOpen] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!codeOpen) return;
    const frame = window.requestAnimationFrame(() => codeInput.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [codeOpen]);
  const openJoin = () => {
    if (props.disabled) return;
    const code = normalizeVideoMeetingCode(props.joinCode);
    navigate('/meetings/join' + (code ? '?code=' + encodeURIComponent(code) : ''));
  };
  const codeField = (dialog = false) => (
    <FormField
      label={t('join.code')}
      value={props.joinCode}
      size="small"
      disabled={props.disabled}
      autoComplete="one-time-code"
      autoFocus={dialog}
      inputRef={dialog ? codeInput : undefined}
      inputProps={{ maxLength: 19, inputMode: 'text' }}
      onChange={(event) => props.onCodeChange(formatHomeJoinCode(event.target.value))}
      sx={{ minWidth: 0, '& .MuiInputBase-root': { minHeight: 36 }, '& input': { py: 0.75 } }}
    />
  );
  return (
    <Box sx={{ mb: { xs: 2, md: 3 } }}>
      <Stack
        data-testid="meeting-home-context"
        direction="row"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={(theme) => ({ ...meetingHomeCard(theme), px: 1.5, py: 0.5, mb: 2, minHeight: 42 })}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: { xs: 'none', sm: 'block' } }}
        >
          {t('home.workspace.subtitle')}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="caption" color="text.secondary" role="status">
            {props.refreshing
              ? t('home.refreshing')
              : t('home.workspace.refreshed', {
                  time: homeMeetingDate(props.updatedAt, i18n.language, props.timeZone, true),
                })}
          </Typography>
          <ActionIconButton
            label={t('actions.refresh')}
            onClick={props.onRefresh}
            loading={props.refreshing}
            sx={{ minWidth: 36, minHeight: 36 }}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </ActionIconButton>
        </Stack>
      </Stack>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flex: '1 1 250px', minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={{ mb: 0.25, display: { xs: 'none', sm: 'flex' }, color: 'text.secondary' }}
          >
            <CalendarDays size={13} aria-hidden="true" />
            <Typography variant="caption">
              {homeMeetingDate(props.now, i18n.language, props.timeZone)} · {props.timeZone}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontSize: { xs: 'h6.fontSize', md: 'h3.fontSize' },
                fontWeight: 'fontWeightBold',
                overflowWrap: 'anywhere',
                wordBreak: 'keep-all',
              }}
            >
              {t('home.title')}
            </Typography>
            <Chip
              size="small"
              color={props.live ? 'success' : 'primary'}
              variant="outlined"
              sx={{ borderRadius: meetingShape.spotlight }}
              label={
                props.live
                  ? t('status.LIVE')
                  : t('home.workspace.scheduledCount', { count: props.meetingCount })
              }
            />
          </Stack>
        </Box>
        <Box
          data-testid="meeting-home-actions"
          sx={(theme) => ({
            display: { xs: 'grid', md: 'flex' },
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            flexWrap: 'wrap',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: { xs: 0.75, md: 1 },
            width: { xs: '100%', md: 'auto' },
            minWidth: 0,
            p: { xs: 0, md: 0.75 },
            borderRadius: meetingShape.stage,
            bgcolor: { xs: 'transparent', md: 'background.paper' },
            '& > button': {
              minWidth: 0,
              px: { xs: 1, md: 1.5 },
              typography: { xs: 'caption', md: 'button' },
              fontWeight: theme.typography.button.fontWeight,
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            },
            '& > button .MuiButton-startIcon': {
              ml: { xs: 0, md: -0.5 },
              mr: { xs: 0.5, md: 1 },
              flexShrink: 0,
            },
          })}
        >
          <Box
            component="form"
            sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5, width: 220 }}
            onSubmit={(event) => {
              event.preventDefault();
              openJoin();
            }}
          >
            {codeField()}
            <ActionButton
              type="submit"
              intent="quiet"
              disabled={props.disabled}
              sx={{ minHeight: 44, flexShrink: 0 }}
            >
              {t('home.join.action')}
            </ActionButton>
          </Box>
          <ActionButton
            intent="secondary"
            startIcon={<CalendarPlus2 size={16} aria-hidden="true" />}
            disabled={props.scheduleDisabled ?? props.disabled}
            onClick={props.onSchedule}
            sx={{ minHeight: 44 }}
          >
            {t('home.schedule.action')}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<Video size={16} aria-hidden="true" />}
            disabled={props.disabled}
            loading={props.starting}
            onClick={props.onStart}
            sx={{ minHeight: 44 }}
          >
            {t('home.instant.action')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<Hash size={16} aria-hidden="true" />}
            disabled={props.disabled}
            onClick={() => setCodeOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, minHeight: 44 }}
          >
            {t('home.join.action')}
          </ActionButton>
        </Box>
      </Box>
      <FormDialog
        open={codeOpen}
        title={t('home.join.title')}
        description={t('home.join.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('home.join.action')}
        submitDisabled={props.disabled}
        onClose={() => setCodeOpen(false)}
        onSubmit={openJoin}
        maxWidth="xs"
      >
        {codeField(true)}
      </FormDialog>
    </Box>
  );
}
