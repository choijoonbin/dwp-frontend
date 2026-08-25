import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type ProductSurfacePolicyLock = {
  policyName: string;
  owner: string;
  source: string;
  scope: string;
  effectiveAt: string;
  policyPath?: `/${string}`;
  exceptionRequestPath?: `/${string}`;
};

export function ProductSurfacePolicyLockNotice({ lock }: { lock: ProductSurfacePolicyLock }) {
  const { t } = useTranslation('common');
  const metadata = [
    [t('productSurface.policyLock.policy'), lock.policyName],
    [t('productSurface.policyLock.owner'), lock.owner],
    [t('productSurface.policyLock.source'), lock.source],
    [t('productSurface.policyLock.scope'), lock.scope],
    [t('productSurface.policyLock.effectiveAt'), lock.effectiveAt],
  ] as const;

  return (
    <Alert
      severity="warning"
      icon={<LockKeyhole size={19} strokeWidth={1.8} aria-hidden="true" />}
      data-testid="product-surface-policy-lock"
      sx={{ alignItems: 'flex-start', '@media (forced-colors: active)': { border: '1px solid' } }}
    >
      <Typography component="h3" variant="subtitle2">
        {t('productSurface.policyLock.title')}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {t('productSurface.policyLock.description')}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'max-content minmax(0, 1fr)' },
          columnGap: 1.5,
          rowGap: 0.5,
        }}
      >
        {metadata.map(([label, value]) => (
          <Box key={label} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="caption" fontWeight={750}>
              {label}
            </Typography>
            <Typography component="dd" variant="caption" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      {(lock.policyPath || lock.exceptionRequestPath) && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
          {lock.policyPath && (
            <ActionButton component={NavLink} to={lock.policyPath} intent="secondary" size="small">
              {t('productSurface.policyLock.viewPolicy')}
            </ActionButton>
          )}
          {lock.exceptionRequestPath && (
            <ActionButton
              component={NavLink}
              to={lock.exceptionRequestPath}
              intent="quiet"
              size="small"
            >
              {t('productSurface.policyLock.requestException')}
            </ActionButton>
          )}
        </Stack>
      )}
    </Alert>
  );
}
