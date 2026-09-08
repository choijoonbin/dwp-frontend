import { foundationTokens } from '@dwp-frontend/design-system';
import { meetingShape, meetingSoftShadow } from './meeting-visual-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, CheckCircle2, Clock3, ListOrdered, LockKeyhole, Star } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export function MeetingTemplateCatalogCard({
  template,
  active,
  busy,
  onSelect,
  onFavorite,
  children,
}: {
  template: VideoMeetingTemplate;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation('meetings');
  const OrganizationIcon = template.scope === 'ORGANIZATION' ? BadgeCheck : LockKeyhole;
  return (
    <Box
      component="article"
      data-testid="template-catalog-card"
      sx={(theme) => ({
        position: 'relative',
        p: { xs: 2, lg: 2 },
        minWidth: 0,
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(active ? theme.palette.primary.main : theme.palette.text.primary, active ? 0.22 : 0.1)}`,
        borderRadius: meetingShape.card,
        boxShadow: active ? meetingSoftShadow(theme) : theme.shadows[0],
        '&::before': {
          display: { xs: 'none', lg: active ? 'block' : 'none' },
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          bgcolor: 'primary.main',
          borderTopLeftRadius: meetingShape.card,
          borderBottomLeftRadius: meetingShape.card,
        },
      })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
          <Chip
            size="small"
            icon={<OrganizationIcon size={14} />}
            color={template.scope === 'ORGANIZATION' ? 'success' : 'default'}
            label={t('templates.scopes.' + template.scope)}
            sx={{ borderRadius: foundationTokens.radius.control + 'px' }}
          />
          <Typography
            variant="caption"
            sx={{
              px: 0.75,
              py: 0.25,
              bgcolor: 'action.hover',
              borderRadius: foundationTokens.radius.compact + 'px',
            }}
          >
            {t('templates.version', { version: template.version })}
          </Typography>
        </Stack>
        <ActionIconButton
          label={t(template.favorite ? 'templates.unfavorite' : 'templates.favorite')}
          aria-pressed={template.favorite}
          disabled={busy}
          onClick={onFavorite}
        >
          <Star size={17} fill={template.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      <ActionButton
        intent="quiet"
        disabled={busy}
        onClick={onSelect}
        aria-pressed={active}
        sx={{
          p: 0,
          py: 0.75,
          textAlign: 'left',
          justifyContent: 'start',
          color: 'text.primary',
          width: '100%',
          minWidth: 0,
        }}
      >
        <Typography
          component="h2"
          variant="subtitle1"
          fontWeight="fontWeightBold"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {template.name}
        </Typography>
        {active && (
          <CheckCircle2
            size={16}
            aria-hidden="true"
            style={{ flexShrink: 0, marginLeft: 'auto' }}
          />
        )}
      </ActionButton>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          overflowWrap: 'anywhere',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }}
      >
        {template.purpose}
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={1.5}
        sx={(theme) => ({
          mt: 1.25,
          p: 0.75,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          borderRadius: foundationTokens.radius.control + 'px',
        })}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Clock3 size={14} />
          <Typography variant="caption">
            {t('units.minutes', { count: template.durationMinutes })}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <ListOrdered size={14} />
          <Typography variant="caption">
            {t('templates.agendaCount', { count: template.agendaItems.length })}
          </Typography>
        </Stack>
      </Stack>
      {children}
      {!active && (
        <Box
          sx={{
            display: { xs: 'flex', lg: 'none' },
            mt: 1.5,
            pt: 1,
            borderTop: 1,
            borderColor: 'divider',
            justifyContent: 'flex-end',
          }}
        >
          <ActionButton intent="secondary" size="small" disabled={busy} onClick={onSelect}>
            {t('stitch.templates.selectPreview')}
          </ActionButton>
        </Box>
      )}
    </Box>
  );
}
