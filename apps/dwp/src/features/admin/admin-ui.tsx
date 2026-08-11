import type { ReferenceLifecycle } from '@dwp-frontend/shared-utils';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';

const lifecycleColor = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  RETIRED: 'default',
} as const;

export function LifecycleChip({ state }: { state: ReferenceLifecycle }) {
  const { t } = useTranslation('admin');
  return (
    <Chip
      label={t(`common.lifecycle.${state}`)}
      color={lifecycleColor[state]}
      variant={state === 'RETIRED' ? 'outlined' : 'filled'}
      size="small"
    />
  );
}

export function AdminPanelLoading({ label }: { label: string }) {
  return <LoadingState label={label} size="page" />;
}

export function AdminPanelError({ message }: { message: string }) {
  const { t } = useTranslation('admin');
  return <ErrorState title={t('common.loadError')} description={message} size="standard" />;
}
