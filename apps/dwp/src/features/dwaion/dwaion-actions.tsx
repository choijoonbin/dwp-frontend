import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarPlus,
  FileCheck2,
  MailPlus,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { ActionButton, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';
import { getWorkplaceActions, type WorkplaceAction } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionActions() {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['dwaion', 'actions'],
    queryFn: getWorkplaceActions,
    staleTime: 30_000,
  });

  return (
    <PageCanvas>
      <Box component="header">
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Workflow size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography variant="overline" color="primary.main">
            {t('dwaionActions.eyebrow')}
          </Typography>
        </Stack>
        <Typography component="h1" variant="h4" sx={{ mt: 0.4 }}>
          {t('dwaionActions.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65, maxWidth: 760 }}>
          {t('dwaionActions.description')}
        </Typography>
      </Box>

      <Alert severity="info" icon={<ShieldCheck size={19} />} sx={{ mt: 2.5, maxWidth: 960 }}>
        {t('dwaionActions.reviewBoundary')}
      </Alert>

      {query.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('dwaionActions.loadError')}
        </Alert>
      )}

      <Box component="section" aria-label={t('dwaionActions.catalogLabel')} sx={{ mt: 3 }}>
        {query.isLoading ? (
          <Stack spacing={1}>
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} variant="rounded" height={112} />
            ))}
          </Stack>
        ) : query.data?.length ? (
          <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
            {query.data.map((action, index) => (
              <Box key={action.actionKey}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  gap={2}
                  sx={{ py: 2, px: { xs: 0, sm: 1 } }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1,
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'var(--dwp-product-accent)',
                      }}
                    >
                      <ActionIcon action={action} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography component="h2" variant="subtitle1" fontWeight={800}>
                          {action.title}
                        </Typography>
                        <Chip size="small" variant="outlined" label={action.riskTier} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {action.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="p"
                        sx={{ mt: 0.6 }}
                      >
                        {t('dwaionActions.permission', { permission: action.requiredPermission })}
                      </Typography>
                    </Box>
                  </Stack>
                  <ActionButton
                    intent="secondary"
                    endIcon={<ArrowRight size={16} />}
                    onClick={() => navigate(action.targetRoute)}
                    sx={{ flexShrink: 0 }}
                  >
                    {t('dwaionActions.open')}
                  </ActionButton>
                </Stack>
              </Box>
            ))}
          </Box>
        ) : (
          <GuidedEmptyState
            kind="permission"
            title={t('dwaionActions.emptyTitle')}
            description={t('dwaionActions.emptyDescription')}
          />
        )}
      </Box>
    </PageCanvas>
  );
}

function ActionIcon({ action }: { action: WorkplaceAction }) {
  if (action.actionKey.startsWith('MAIL.')) return <MailPlus size={20} aria-hidden="true" />;
  if (action.actionKey.startsWith('CALENDAR.'))
    return <CalendarPlus size={20} aria-hidden="true" />;
  if (action.actionKey.startsWith('APPROVAL.')) return <FileCheck2 size={20} aria-hidden="true" />;
  return <Workflow size={20} aria-hidden="true" />;
}
