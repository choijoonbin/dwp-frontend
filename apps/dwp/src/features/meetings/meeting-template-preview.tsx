import { foundationTokens } from '@dwp-frontend/design-system';
import { meetingShape } from './meeting-visual-system';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  DoorOpen,
  Info,
  Link,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  Timer,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';

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
  const toast = useToast();
  const copyLink = async () => {
    const url = new URL('/meetings/templates', window.location.origin);
    url.searchParams.set('scope', template.scope);
    url.searchParams.set('template', template.templateId);
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success(t('stitch.templates.linkCopied'));
    } catch {
      toast.error(t('stitch.templates.copyFailed'));
    }
  };
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
          <ActionButton
            intent="quiet"
            startIcon={<Link size={15} />}
            disabled={busy}
            onClick={() => void copyLink()}
          >
            {t('stitch.templates.share')}
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
      gap={compact ? 1.5 : 2.5}
      data-testid={compact ? 'template-mobile-preview' : 'template-desktop-preview'}
    >
      {!compact && (
        <Box>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
            <Chip
              size="small"
              icon={<BadgeCheck size={14} />}
              color={template.scope === 'ORGANIZATION' ? 'success' : 'default'}
              label={t('templates.scopes.' + template.scope)}
            />
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
        <>
          {!template.canEdit && (
            <Stack
              direction="row"
              alignItems="start"
              gap={1}
              sx={(theme) => ({
                p: 1.5,
                borderRadius: meetingShape.control,
                bgcolor: alpha(theme.palette.primary.main, 0.055),
              })}
            >
              <Info size={18} style={{ flexShrink: 0 }} />
              <Typography variant="body2">{t('stitch.templates.readOnlyHint')}</Typography>
            </Stack>
          )}
          <Box data-testid="template-overview">
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              {t('stitch.templates.overview')}
            </Typography>
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                '@media (min-width: 1280px)': { gridTemplateColumns: 'repeat(4,minmax(0,1fr))' },
                gap: 1.5,
                p: 1.5,
                borderRadius: meetingShape.control,
                bgcolor: alpha(theme.palette.primary.main, 0.055),
              })}
            >
              {[
                [
                  t('templates.fields.purpose'),
                  [
                    'GENERAL',
                    'TEAM',
                    'DECISION',
                    'ONE_ON_ONE',
                    'RETROSPECTIVE',
                    'WORKSHOP',
                    'OTHER',
                  ].includes(template.category)
                    ? t('templates.categories.' + template.category)
                    : template.category,
                ],
                [
                  t('templates.fields.duration'),
                  t('units.minutes', { count: template.durationMinutes }),
                ],
                [t('stitch.templates.access'), t('stitch.templates.invited')],
                [t('stitch.templates.waitingRoom'), t('stitch.templates.required')],
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </>
      )}
      <Box
        sx={
          compact
            ? (theme) => ({
                p: 1,
                borderRadius: meetingShape.control,
                bgcolor: alpha(theme.palette.primary.main, 0.055),
              })
            : undefined
        }
      >
        {!compact && (
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
            {t('templates.agenda')}
          </Typography>
        )}
        {compact && (
          <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
            <Typography variant="caption">{t('stitch.templates.timebox')}</Typography>
            <Typography variant="caption" color="primary.main">
              {t('units.minutes', { count: template.durationMinutes })}
            </Typography>
          </Stack>
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
                sx={(theme) => ({
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'start',
                  p: compact ? 1 : 2,
                  bgcolor: compact ? 'background.paper' : alpha(theme.palette.primary.main, 0.055),
                  borderRadius: meetingShape.control,
                  minWidth: 0,
                })}
              >
                {!compact && (
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{
                      p: 0.75,
                      bgcolor: 'background.paper',
                      borderRadius: foundationTokens.radius.control + 'px',
                      fontWeight: 'fontWeightBold',
                    }}
                  >
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
      {compact && (
        <Stack direction="row" gap={1} alignItems="center" data-testid="template-usage-evidence">
          <BarChart3 size={17} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('stitch.templates.usageUnavailable')}
          </Typography>
        </Stack>
      )}
      {compact && actions}
      {!compact && (
        <Box data-testid="template-governance">
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            {t('stitch.templates.governance')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(3,minmax(0,1fr))' },
              gap: 1,
            }}
          >
            {[
              { icon: LockKeyhole, title: 'encryption', value: 'policyAtBooking' },
              { icon: Timer, title: 'retention', value: 'policyAtBooking' },
              { icon: DoorOpen, title: 'waitingRoom', value: 'required' },
            ].map(({ icon: Icon, title, value }) => (
              <Stack
                key={title}
                direction="row"
                alignItems="center"
                gap={1}
                sx={(theme) => ({
                  p: 1.25,
                  borderRadius: meetingShape.control,
                  bgcolor: alpha(theme.palette.primary.main, 0.055),
                })}
              >
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    color: 'primary.main',
                    p: 0.75,
                    borderRadius: foundationTokens.radius.control + 'px',
                    display: 'flex',
                  }}
                >
                  <Icon size={18} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('stitch.templates.' + title)}
                  </Typography>
                  <Typography variant="caption" component="p" fontWeight="fontWeightMedium">
                    {t('stitch.templates.' + value)}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </Box>
      )}
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
