import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  isProviderSupportSessionActive,
  useCurrentProviderSupportContext,
} from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

export function ProviderTenantDiagnosisBoundary({
  tenantId,
  canSupport,
}: {
  tenantId: string;
  canSupport: boolean;
}) {
  const { t } = useTranslation('provider');
  const navigate = useNavigate();
  const supportContext = useCurrentProviderSupportContext();
  const activeSupportContext =
    !supportContext.isError && isProviderSupportSessionActive(supportContext.data)
      ? supportContext.data
      : null;
  const targetMismatch = Boolean(
    activeSupportContext && activeSupportContext.tenantId !== tenantId
  );

  return (
    <>
      <Alert
        severity={targetMismatch ? 'warning' : 'info'}
        action={
          canSupport &&
          !activeSupportContext &&
          !supportContext.isLoading &&
          !supportContext.isError ? (
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => navigate(`/provider/support?tenantId=${encodeURIComponent(tenantId)}`)}
              sx={{ color: 'inherit' }}
            >
              {t('tenantDetail.diagnosis.start')}
            </ActionButton>
          ) : undefined
        }
      >
        <Typography variant="subtitle2">{t('tenantDetail.diagnosis.boundaryTitle')}</Typography>
        <Typography variant="body2">
          {t(
            targetMismatch
              ? 'diagnosis.active.targetMismatch'
              : 'tenantDetail.diagnosis.boundaryDescription'
          )}
        </Typography>
      </Alert>
      {supportContext.isError && !activeSupportContext && (
        <Alert severity="warning">{t('diagnosis.contextUnavailable')}</Alert>
      )}
    </>
  );
}
