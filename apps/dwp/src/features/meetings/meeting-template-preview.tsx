import { useTranslation } from 'react-i18next';
import { ArrowRight, Clock3, Copy, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';

type Props = {
  template: VideoMeetingTemplate;
  compact?: boolean;
  busy: boolean;
  onApply: () => void;
  onClone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFullPreview?: () => void;
};

export function MeetingTemplatePreview({
  template,
  compact = false,
  busy,
  onApply,
  onClone,
  onEdit,
  onDelete,
  onFullPreview,
}: Props) {
  const { t } = useTranslation('meetings');
  const actions = (
    <Stack gap={1} data-testid="template-preview-actions">
      <ActionButton
        intent="primary"
        endIcon={<ArrowRight size={16} aria-hidden="true" />}
        disabled={busy}
        onClick={onApply}
        sx={{ alignSelf: compact ? 'stretch' : 'start', minHeight: { xs: 44, lg: 40 } }}
      >
        {t('templates.apply')}
      </ActionButton>
      {compact ? (
        onFullPreview && (
          <ActionButton intent="quiet" fullWidth onClick={onFullPreview} sx={{ minHeight: 44 }}>
            {t('templates.fullPreview')}
          </ActionButton>
        )
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          <ActionButton
            intent="quiet"
            startIcon={<Copy size={15} aria-hidden="true" />}
            disabled={busy}
            onClick={onClone}
          >
            {t('templates.clone')}
          </ActionButton>
          {template.canEdit && (
            <>
              <ActionButton
                intent="quiet"
                startIcon={<Pencil size={15} aria-hidden="true" />}
                disabled={busy}
                onClick={onEdit}
              >
                {t('templates.edit')}
              </ActionButton>
              <ActionButton
                intent="quiet"
                startIcon={<Trash2 size={15} aria-hidden="true" />}
                disabled={busy}
                onClick={onDelete}
              >
                {t('templates.delete')}
              </ActionButton>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
  return (
    <Stack
      gap={compact ? 1.5 : 3}
      data-testid={compact ? 'template-mobile-preview' : 'template-desktop-preview'}
    >
      {!compact && (
        <Box>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Chip size="small" label={t('templates.scopes.' + template.scope)} />
            <Typography variant="caption" color="text.secondary">
              {t('templates.version', { version: template.version })}
            </Typography>
          </Stack>
          <Typography
            component="h2"
            variant="h3"
            sx={(theme) => ({
              fontWeight: theme.typography.subtitle1.fontWeight,
              overflowWrap: 'anywhere',
            })}
          >
            {template.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {template.purpose}
          </Typography>
        </Box>
      )}
      {!compact && actions}
      {!compact && (
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Clock3 size={16} aria-hidden="true" />
            <Typography variant="body2">
              {t('units.minutes', { count: template.durationMinutes })}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('templates.agendaCount', { count: template.agendaItems.length })}
          </Typography>
        </Stack>
      )}
      <Box>
        {!compact && (
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
            {t('templates.agenda')}
          </Typography>
        )}
        {template.agendaItems.length > 0 ? (
          <Box
            component="ol"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              display: 'grid',
              gridTemplateColumns: compact ? 'repeat(3,minmax(0,1fr))' : 'minmax(0,1fr)',
              gap: 1,
            }}
          >
            {template.agendaItems.slice(0, compact ? 3 : 50).map((item, index) => (
              <Box
                component="li"
                key={index}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'start',
                  p: compact ? 1 : 2,
                  bgcolor: 'action.hover',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  minWidth: 0,
                }}
              >
                {!compact && (
                  <Typography variant="caption" color="primary.main" sx={{ pt: 0.5 }}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                )}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant={compact ? 'caption' : 'h6'}
                    component="p"
                    sx={(theme) => ({
                      overflowWrap: 'anywhere',
                      fontWeight: theme.typography.subtitle1.fontWeight,
                    })}
                  >
                    {item.title}
                  </Typography>
                  {!compact && item.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {item.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {t('units.minutes', { count: item.durationMinutes })}
                    {item.role && !compact ? ' · ' + item.role : ''}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('templates.noAgenda')}
          </Typography>
        )}
        {compact && template.agendaItems.length > 3 && (
          <Typography variant="caption">
            {t('templates.moreAgenda', { count: template.agendaItems.length - 3 })}
          </Typography>
        )}
      </Box>
      {compact && actions}
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: compact ? 1 : 2 }}>
        <Stack direction="row" alignItems="start" gap={1}>
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('templates.policyRecheck')}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
