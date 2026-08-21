import Chip from '@mui/material/Chip';

import type { TFunction } from 'i18next';
import type {
  DwaionGateCategory,
  DwaionGateKey,
  DwaionGateStatus,
} from '@dwp-frontend/shared-utils';

export function gateTitle(t: TFunction, gateKey: DwaionGateKey): string {
  return t(`dwaionAdmin.gates.gateNames.${gateKey}.title`);
}

export function gateDescription(t: TFunction, gateKey: DwaionGateKey): string {
  return t(`dwaionAdmin.gates.gateNames.${gateKey}.description`);
}

export function gateCategoryLabel(t: TFunction, category: DwaionGateCategory): string {
  return t(`dwaionAdmin.gates.categories.${category}`);
}

export function gateOptionLabel(t: TFunction, gateKey: DwaionGateKey, option: string): string {
  return t(`dwaionAdmin.gates.options.${gateKey}.${option}`, { defaultValue: option });
}

export function GateStatusChip({ status, label }: { status: DwaionGateStatus; label: string }) {
  const color =
    status === 'APPROVED'
      ? 'success'
      : status === 'READY_FOR_APPROVAL'
        ? 'info'
        : status === 'BLOCKED' || status === 'EXPIRED'
          ? 'error'
          : status === 'NOT_CONFIGURED'
            ? 'default'
            : 'warning';
  return <Chip size="small" variant="outlined" color={color} label={label} />;
}
