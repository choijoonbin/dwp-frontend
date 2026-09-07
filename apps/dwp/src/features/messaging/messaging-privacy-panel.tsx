import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, ShieldCheck } from 'lucide-react';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';
import {
  getMessagingPrivacyPreference,
  updateMessagingPrivacyPreference,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

export function MessagingPrivacyPanel() {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['messaging', 'privacy-preferences'];
  const query = useQuery({
    queryKey,
    queryFn: getMessagingPrivacyPreference,
    staleTime: 0,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: updateMessagingPrivacyPreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(queryKey, preference);
      void queryClient.invalidateQueries({ queryKey: ['messaging', 'read-receipts'] });
      toast.success(t('privacy.saved'));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast.error(t('privacy.saveError'));
    },
  });

  if (query.isPending) return <LoadingState embedded label={t('privacy.loading')} />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title={t('privacy.loadError')}
        retryLabel={t('privacy.retry')}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        size="compact"
      />
    );
  const preference = query.data;
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ShieldCheck size={18} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2">
          {t('privacy.scope')}
        </Typography>
      </Stack>
      <Box>
        <FormControlLabel
          label={t('privacy.shareReadStatus')}
          labelPlacement="start"
          control={
            <Switch
              size="small"
              checked={preference.readReceiptsEnabled}
              disabled={mutation.isPending || query.isFetching}
              onChange={(_, readReceiptsEnabled) =>
                mutation.mutate({ ...preference, readReceiptsEnabled })
              }
            />
          }
          sx={{ width: 1, m: 0, gap: 1.5, justifyContent: 'space-between' }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {t('privacy.shareDescription')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} sx={{ bgcolor: 'action.hover', p: 1.5 }}>
        <Box sx={{ color: 'info.main', flexShrink: 0 }}>
          <Eye size={18} aria-hidden="true" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t(
            preference.readReceiptsEnabled
              ? 'privacy.enabledDescription'
              : 'privacy.disabledDescription'
          )}
        </Typography>
      </Stack>
    </Stack>
  );
}
