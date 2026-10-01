import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import type { ProviderDataPolicy, ProviderDataPolicyPage } from '@dwp-frontend/shared-utils';

export function ProviderDataPolicyPartialWarnings({
  page,
  selectedPolicy,
}: {
  page: ProviderDataPolicyPage;
  selectedPolicy?: ProviderDataPolicy;
}) {
  const { t } = useTranslation('provider');
  if (!page.hasMore && !selectedPolicy?.revisionsHasMore) return null;

  return (
    <Stack gap={1}>
      {page.hasMore && (
        <Alert severity="warning">
          {t('dataGovernance.policy.policyPagePartial', {
            count: page.items.length,
            limit: page.limit,
          })}
        </Alert>
      )}
      {selectedPolicy?.revisionsHasMore && (
        <Alert severity="warning">
          {t('dataGovernance.policy.revisionPagePartial', {
            count: selectedPolicy.revisions.length,
            limit: selectedPolicy.revisionsLimit,
            policy: selectedPolicy.displayName,
          })}
        </Alert>
      )}
    </Stack>
  );
}
