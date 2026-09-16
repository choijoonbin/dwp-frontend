import { useTranslation } from 'react-i18next';
import { Check, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

type HomePreferenceConflictDialogProps = {
  open: boolean;
  changeCount: number;
  baseVersion?: number;
  latestVersion?: number;
  busy?: boolean;
  canReapply?: boolean;
  onReloadLatest: () => void;
  onReapply: () => void;
  onClose: () => void;
};

function ChangeSummary({
  tone,
  title,
  badge,
  description,
}: {
  tone: 'draft' | 'server';
  title: string;
  badge?: string;
  description: string;
}) {
  const { t } = useTranslation('home');
  const draft = tone === 'draft';
  const accentColor = draft ? 'primary.main' : 'warning.main';
  const strongColor = draft ? 'primary.dark' : 'warning.dark';

  return (
    <Paper
      component="section"
      aria-label={title}
      data-conflict-summary={tone}
      variant="outlined"
      sx={(theme) => ({
        minWidth: 0,
        p: { xs: 1.5, sm: 2 },
        borderRadius: foundationTokens.home.radius.card,
        borderColor: draft ? theme.palette.primary.light : theme.palette.warning.light,
        bgcolor: alpha(draft ? theme.palette.primary.main : theme.palette.warning.main, 0.08),
        boxShadow: 'none',
      })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <Box
            aria-hidden="true"
            sx={{
              width: 9,
              height: 9,
              flex: '0 0 auto',
              borderRadius: '50%',
              bgcolor: accentColor,
            }}
          />
          <Typography
            variant="subtitle2"
            fontWeight={foundationTokens.home.typography.weightHeavy}
            color={strongColor}
          >
            {title}
          </Typography>
        </Stack>
        {badge && (
          <Chip
            size="small"
            label={badge}
            sx={(theme) => ({
              flex: '0 0 auto',
              height: 26,
              color: strongColor,
              bgcolor: alpha(draft ? theme.palette.primary.main : theme.palette.warning.main, 0.12),
              '& .MuiChip-label': { px: 1.25 },
            })}
          />
        )}
      </Stack>
      <Typography
        variant="body2"
        color="text.primary"
        sx={{ mt: 1.5, lineHeight: foundationTokens.home.typography.cardLineHeight }}
      >
        {description}
      </Typography>
      {draft && (
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          sx={{
            mt: 1.5,
            pt: 1.25,
            borderTop: 1,
            borderColor: 'primary.light',
            color: 'primary.main',
          }}
        >
          <Check size={15} aria-hidden="true" />
          <Typography
            variant="caption"
            fontWeight={foundationTokens.home.typography.weightSemibold}
          >
            {t('flow.conflict.localPreserved')}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}

export function HomePreferenceConflictDialog({
  open,
  changeCount,
  baseVersion,
  latestVersion,
  busy = false,
  canReapply = true,
  onReloadLatest,
  onReapply,
  onClose,
}: HomePreferenceConflictDialogProps) {
  const { t } = useTranslation('home');
  const closeAndRestoreFocus = () => {
    onClose();
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('[data-composer-control="save"]')?.focus();
    }, 0);
  };

  return (
    <ContentDialog
      open={open}
      title={t('flow.conflict.title')}
      description={t('flow.conflict.description')}
      closeLabel={t('flow.conflict.closeDialog')}
      onClose={closeAndRestoreFocus}
      busy={busy}
      maxWidth="md"
      titleStart={
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: 44,
            height: 44,
            flex: '0 0 auto',
            display: { xs: 'none', sm: 'grid' },
            placeItems: 'center',
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            color: 'warning.main',
            border: 1,
            borderColor: 'warning.light',
          })}
        >
          <TriangleAlert size={24} />
        </Box>
      }
      titleEnd={
        <Chip
          icon={<TriangleAlert size={15} aria-hidden="true" />}
          label={t('flow.conflict.detected')}
          size="small"
          sx={(theme) => ({
            display: { xs: 'inline-flex', sm: 'none' },
            color: 'warning.dark',
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            border: 1,
            borderColor: 'warning.light',
            fontWeight: foundationTokens.home.typography.weightBold,
          })}
        />
      }
      slotProps={{
        backdrop: {
          sx: (theme) => ({
            bgcolor: alpha(theme.palette.common.black, 0.58),
            backdropFilter: 'blur(2px)',
          }),
        },
        paper: {
          sx: (theme) => ({
            width: { xs: 'calc(100% - 32px)', sm: 760 },
            maxWidth: 760,
            m: { xs: 2, sm: 3 },
            maxHeight: { xs: 'calc(100dvh - 48px)', sm: 'calc(100dvh - 96px)' },
            overflow: 'hidden',
            borderRadius: foundationTokens.home.radius.surface,
            border: 1,
            borderColor: 'divider',
            boxShadow: theme.shadows[24],
            '@media (prefers-reduced-motion: reduce)': {
              '&, & *, & *::before, & *::after': {
                scrollBehavior: 'auto !important',
                transitionDuration: '0s !important',
                animationDuration: '0s !important',
              },
            },
          }),
        },
      }}
      contentSx={{ px: { xs: 2.25, sm: 3 }, pb: { xs: 2, sm: 3 } }}
      footerSx={{
        px: { xs: 2.25, sm: 3 },
        py: { xs: 2, sm: 2.25 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr auto auto' },
        gap: 1,
        bgcolor: 'action.hover',
        borderTop: 1,
        borderColor: 'divider',
        '& > :not(style) ~ :not(style)': { ml: 0 },
      }}
      footerContent={
        <>
          <ActionButton
            type="button"
            intent="primary"
            aria-label={t('flow.conflict.reapply')}
            onClick={onReapply}
            disabled={busy || !canReapply}
            startIcon={<RefreshCw size={17} aria-hidden="true" />}
            sx={{
              order: { xs: 1, sm: 3 },
              minHeight: 48,
              minWidth: { sm: 184 },
              width: { xs: 1, sm: 'auto' },
            }}
          >
            <Stack
              component="span"
              alignItems="center"
              sx={{ lineHeight: foundationTokens.home.typography.navigationLineHeight }}
            >
              <Box component="span">{t('flow.conflict.reapply')}</Box>
              <Box
                component="span"
                sx={{
                  display: { xs: 'inline', sm: 'none' },
                  fontSize: foundationTokens.home.typography.captionSize,
                  opacity: 0.84,
                }}
              >
                {latestVersion === undefined
                  ? t('flow.conflict.reapplyHintUnknown')
                  : t('flow.conflict.reapplyHint', { version: latestVersion })}
              </Box>
            </Stack>
          </ActionButton>
          <ActionButton
            type="button"
            intent="quiet"
            aria-label={t('flow.conflict.reload')}
            onClick={onReloadLatest}
            disabled={busy}
            startIcon={<RefreshCw size={16} aria-hidden="true" />}
            sx={{
              order: { xs: 2, sm: 2 },
              minHeight: 48,
              minWidth: { sm: 158 },
              width: { xs: 1, sm: 'auto' },
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            {t('flow.conflict.reload')}
          </ActionButton>
          <ActionButton
            type="button"
            intent="quiet"
            aria-label={t('flow.conflict.keepEditing')}
            onClick={closeAndRestoreFocus}
            disabled={busy}
            sx={{
              order: { xs: 3, sm: 1 },
              minHeight: 48,
              justifySelf: { sm: 'start' },
              width: { xs: 1, sm: 'auto' },
            }}
          >
            {t('flow.conflict.keepEditing')}
          </ActionButton>
        </>
      }
    >
      <Box data-home-content-state="conflict" data-home-draft-preserved="true">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.75,
          }}
        >
          <ChangeSummary
            tone="draft"
            title={t('flow.conflict.draftTitle', { count: changeCount })}
            badge={
              baseVersion === undefined
                ? undefined
                : t('flow.conflict.baseVersion', { version: baseVersion })
            }
            description={t('flow.conflict.draftSummary', { count: changeCount })}
          />
          <ChangeSummary
            tone="server"
            title={
              latestVersion === undefined
                ? t('flow.conflict.serverTitleUnknown')
                : t('flow.conflict.serverTitle', { version: latestVersion })
            }
            description={t('flow.conflict.serverSummary')}
          />
        </Box>

        <Stack
          direction="row"
          alignItems="flex-start"
          gap={1}
          sx={{
            mt: 2,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.home.radius.control,
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <Info size={18} color="currentColor" aria-hidden="true" />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: foundationTokens.home.typography.cardLineHeight }}
          >
            {latestVersion === undefined
              ? t('flow.conflict.mergeGuidanceUnknown', { count: changeCount })
              : t('flow.conflict.mergeGuidance', {
                  version: latestVersion,
                  count: changeCount,
                })}
          </Typography>
        </Stack>
      </Box>
    </ContentDialog>
  );
}
