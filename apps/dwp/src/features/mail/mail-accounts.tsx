import { useTranslation } from 'react-i18next';
import { CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMailHome } from '@dwp-frontend/shared-utils';
import { ActionButton, GuidedEmptyState, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MailPageHeading } from './mail-components';

export function MailAccounts() {
  const { t } = useTranslation('mail');
  const query = useQuery({
    queryKey: ['mail', 'home'],
    queryFn: getMailHome,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <PageCanvas mode="focus">
      <MailPageHeading
        eyebrow={t('accounts.eyebrow')}
        title={t('accounts.title')}
        description={t('accounts.description')}
        actions={
          <ActionButton
            intent="quiet"
            startIcon={<RefreshCw size={17} />}
            onClick={() => query.refetch()}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />

      {query.isError && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {t('accounts.loadError')}
        </Alert>
      )}
      {query.isLoading ? (
        <Skeleton variant="rounded" height={280} sx={{ mt: 3 }} />
      ) : query.data ? (
        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box
            component="section"
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}
          >
            {query.data.accounts.length ? (
              query.data.accounts.map((account, index) => (
                <Box key={account.accountId}>
                  {index > 0 && <Divider />}
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    sx={{ p: 2.25 }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'var(--dwp-product-accent)',
                      }}
                    >
                      <MailCheck size={20} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        <Typography fontWeight={800}>{account.displayName}</Typography>
                        {account.defaultAccount && (
                          <Chip
                            size="small"
                            label={t('accounts.default')}
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {account.accountKind === 'SHARED' && (
                          <Chip size="small" label={t('accounts.shared')} variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {account.emailAddress}
                      </Typography>
                    </Box>
                    <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={0.5}>
                      <Stack direction="row" spacing={0.6} alignItems="center" color="success.main">
                        <CheckCircle2 size={15} />
                        <Typography variant="body2" fontWeight={700}>
                          {t('accounts.ready')}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t(`provider.${account.providerType}`)} · {account.synchronizationState}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              ))
            ) : (
              <GuidedEmptyState
                kind="first-use"
                title={t('accounts.emptyTitle')}
                description={t('accounts.emptyDescription')}
              />
            )}
          </Box>
          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('accounts.governed')}
          </Alert>
        </Stack>
      ) : null}
    </PageCanvas>
  );
}
