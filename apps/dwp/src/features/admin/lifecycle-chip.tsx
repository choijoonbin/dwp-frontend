import { useTranslation } from 'react-i18next';
import type { ReferenceLifecycle } from '@dwp-frontend/shared-utils';

import Chip from '@mui/material/Chip';

const lifecycleColor: Record<string, 'warning' | 'success' | 'default'> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  RETIRED: 'default',
} as const;

export function lifecycleLabelKey(state: string): string {
  return `common.lifecycle.${['DRAFT', 'ACTIVE', 'RETIRED'].includes(state) ? state : 'UNKNOWN'}`;
}

export function LifecycleChip({ state }: { state: ReferenceLifecycle | string }) {
  const { t } = useTranslation('admin');
  return (
    <Chip
      label={t(lifecycleLabelKey(state))}
      color={lifecycleColor[state] ?? 'default'}
      variant={state === 'RETIRED' ? 'outlined' : 'filled'}
      size="small"
    />
  );
}
