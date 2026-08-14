import { useTranslation } from 'react-i18next';
import type { ReferenceLifecycle } from '@dwp-frontend/shared-utils';

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
