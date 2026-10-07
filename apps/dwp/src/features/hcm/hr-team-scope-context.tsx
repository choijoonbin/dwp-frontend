import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HrEmployeeContext, HrTeamDataBoundary } from '@dwp-frontend/shared-utils';

export function HrTeamScopeContext({
  manager,
  dataBoundary,
  refreshedAt,
}: {
  manager: HrEmployeeContext;
  dataBoundary: HrTeamDataBoundary;
  refreshedAt: number;
}) {
  const { t } = useTranslation('hcm');
  const refreshedAtLabel = refreshedAt
    ? formatDate(refreshedAt, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : t('home.states.unavailable');

  return (
    <Alert
      severity="info"
      icon={<ShieldCheck size={18} aria-hidden="true" />}
      data-testid="hr-team-scope-context"
    >
      <Stack gap={0.25}>
        <Typography variant="body2">
          {t('domains.teamBoundary', { boundary: dataBoundary })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {manager.displayName} · {t('home.operations.generatedAt', { value: refreshedAtLabel })}
        </Typography>
      </Stack>
    </Alert>
  );
}
