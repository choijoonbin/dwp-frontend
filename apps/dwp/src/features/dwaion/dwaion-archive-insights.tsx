import { History, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { archiveSummary } from './dwaion-archive-model';

export function DwaionArchiveInsights({
  items,
  now,
}: {
  items: DwaionConversationSummary[];
  now: number;
}) {
  const { t, i18n } = useTranslation('work');
  const summary = archiveSummary(items, now);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Box component="aside" aria-label={t('dwaionArchive.insights')} sx={{ minWidth: 0 }}>
      <Typography
        component="h2"
        variant="subtitle2"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <History size={16} />
        {t('dwaionArchive.insights')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('dwaionArchive.window')}
      </Typography>
      <Box component="dl" sx={{ m: 0, mt: 2 }}>
        {(['conversations', 'messages', 'activeWeek'] as const).map((key) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              py: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
              gap: 2,
            }}
          >
            <Typography component="dt" variant="body2" color="text.secondary">
              {t(`dwaionArchive.stats.${key}`)}
            </Typography>
            <Typography component="dd" variant="h5" sx={{ m: 0 }}>
              {summary[key]}
            </Typography>
          </Box>
        ))}
      </Box>
      {summary.latest && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          {t('dwaionArchive.latest', {
            date: formatDate(
              summary.latest,
              { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
              locale
            ),
          })}
        </Typography>
      )}
      <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography
          component="h2"
          variant="subtitle2"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <ShieldCheck size={16} />
          {t('dwaionArchive.policyTitle')}
        </Typography>
        <Stack spacing={2} sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('dwaionArchive.policyScope')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dwaionArchive.policyEvidence')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <LockKeyhole size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <Typography variant="caption" color="text.secondary">
              {t('dwaionArchive.policyRetention')}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
