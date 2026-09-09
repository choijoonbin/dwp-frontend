import { useTranslation } from 'react-i18next';
import { Activity, ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  foundationTokens,
  LoadingState,
} from '@dwp-frontend/design-system';
import { useNavigate } from 'react-router-dom';
import type { AskCitationSourceType, WorkspaceWorkSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';

export function DwaionStudioRail({
  selected,
  available,
  onToggle,
  summary,
  loading,
  error,
  expert,
  onRetry,
}: {
  selected: AskCitationSourceType[];
  available: AskCitationSourceType[];
  onToggle: (source: AskCitationSourceType) => void;
  summary?: WorkspaceWorkSummary;
  loading: boolean;
  error: boolean;
  expert: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

  if (compact) {
    return (
      <Box
        component="aside"
        aria-label={t('askPage.contextRail.label')}
        data-testid="dwaion-studio-rail"
        sx={{
          minWidth: 0,
          alignSelf: 'start',
          p: 2,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: 'action.hover',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography
            component="h2"
            variant="subtitle2"
            sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}
          >
            <ShieldCheck size={17} />
            {t('askPage.contextRail.scopeTitle')}
          </Typography>
          <Typography variant="caption" color="primary.main">
            {t('dwaionStudio.selected', { count: selected.length })}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {selected.map((source) => t(`askPage.sourceTypes.${source}`)).join(' · ')}
        </Typography>
        {error && !expert && (
          <ErrorState
            size="compact"
            title={t('askPage.contextUnavailable')}
            retryLabel={t('dwaionStudio.retry')}
            onRetry={onRetry}
          />
        )}
        <Stack direction="row" alignItems="flex-start" gap={1} sx={{ mt: 1.5 }}>
          <LockKeyhole size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 'caption.lineHeight' }}
          >
            {t('dwaionStudio.trust.privacy')}
          </Typography>
        </Stack>
        {!expert && (
          <ActionButton
            intent="secondary"
            startIcon={<Sparkles size={16} aria-hidden="true" />}
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={() => navigate('/dwaion/new?agent=DWP_APPROVAL_EXPERT')}
            fullWidth
            sx={{ mt: 1.5, justifyContent: 'space-between' }}
          >
            {t('dwaionStudio.approvalExpertAction')}
          </ActionButton>
        )}
      </Box>
    );
  }

  return (
    <Box
      component="aside"
      aria-label={t('askPage.contextRail.label')}
      data-testid="dwaion-studio-rail"
      sx={{
        minWidth: 0,
        alignSelf: 'start',
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'background.paper',
      }}
    >
      <Box component="section" sx={{ pb: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1} justifyContent="space-between">
          <Typography
            component="h2"
            variant="subtitle2"
            sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}
          >
            <ShieldCheck size={16} />
            {t('askPage.contextRail.scopeTitle')}
          </Typography>
          <Typography variant="caption" color="primary.main">
            {t('dwaionStudio.selected', { count: selected.length })}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('dwaionStudio.scopeNote')}
        </Typography>
        <Stack sx={{ mt: 1 }} spacing={0.5}>
          {available.map((source) => (
            <FormControlLabel
              key={source}
              sx={{
                m: 0,
                p: 0.5,
                borderRadius: foundationTokens.radius.control + 'px',
                bgcolor: selected.includes(source) ? 'var(--dwp-product-soft)' : 'transparent',
                alignItems: 'flex-start',
              }}
              control={
                <Checkbox
                  size="small"
                  checked={selected.includes(source)}
                  disabled={selected.length === 1 && selected.includes(source)}
                  onChange={() => onToggle(source)}
                  slotProps={{ input: { 'aria-label': t(`askPage.sourceTypes.${source}`) } }}
                />
              }
              label={
                <Box sx={{ py: 0.75 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {t(`askPage.sourceTypes.${source}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`askPage.contextRail.sources.${source}`)}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Stack>
      </Box>
      {!expert && (
        <Box component="section" sx={{ py: 2.5, borderBlock: 1, borderColor: 'divider' }}>
          <Typography
            component="h2"
            variant="subtitle2"
            sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}
          >
            <Activity size={16} />
            {t('askPage.contextRail.signalsTitle')}
          </Typography>
          {error ? (
            <ErrorState
              size="compact"
              title={t('askPage.contextUnavailable')}
              retryLabel={t('dwaionStudio.retry')}
              onRetry={onRetry}
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
                mt: 1.5,
              }}
            >
              {(['total', 'dueSoon', 'waiting'] as const).map((key) => (
                <Box
                  key={key}
                  sx={{
                    minWidth: 0,
                    borderLeft: 2,
                    borderColor: key === 'dueSoon' ? 'warning.main' : 'divider',
                    pl: 1,
                  }}
                >
                  {loading || !summary ? (
                    <Box sx={{ width: 32 }}>
                      <LoadingState
                        embedded
                        variant="skeleton"
                        skeletonRows={1}
                        skeletonHeight={32}
                        label={t('dwaionHome.loading')}
                      />
                    </Box>
                  ) : (
                    <Typography variant="h5">{summary[key]}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {t(`askPage.contextRail.signals.${key}`)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('dwaionStudio.signalsNote')}
          </Typography>
        </Box>
      )}
      <Box component="section" sx={{ pt: 2.5 }}>
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}
        >
          <LockKeyhole size={16} />
          {t('dwaionStudio.trustTitle')}
        </Typography>
        <Stack component="ul" spacing={1.5} sx={{ p: 0, mt: 1.5, listStyle: 'none' }}>
          {['evidence', 'approval', 'privacy'].map((key) => (
            <Box component="li" key={key} sx={{ display: 'flex', gap: 1 }}>
              <Check size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <Typography variant="caption" color="text.secondary">
                {t(`dwaionStudio.trust.${key}`)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
      {!expert && (
        <Box
          component="section"
          sx={{
            mt: 2.5,
            p: 1.5,
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: 'action.selected',
          }}
        >
          <Typography
            component="h2"
            variant="subtitle2"
            sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}
          >
            <Sparkles size={16} />
            {t('dwaionStudio.approvalExpertTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {t('dwaionStudio.approvalExpertDescription')}
          </Typography>
          <ActionButton
            intent="secondary"
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={() => navigate('/dwaion/new?agent=DWP_APPROVAL_EXPERT')}
            fullWidth
            sx={{ mt: 1.25, justifyContent: 'space-between' }}
          >
            {t('dwaionStudio.approvalExpertAction')}
          </ActionButton>
        </Box>
      )}
    </Box>
  );
}
