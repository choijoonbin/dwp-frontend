import { useTranslation } from 'react-i18next';

import Chip from '@mui/material/Chip';

import {
  providerCodeEnumTranslationKey,
  providerSafeEnumPresentation,
} from './provider-safe-enum-presentation';

const LEVEL_COLORS: Record<string, 'default' | 'info' | 'success'> = {
  SYSTEM: 'default',
  EXTENSIBLE: 'info',
  USER: 'success',
  UNAVAILABLE: 'default',
};

const KIND_COLORS: Record<
  string,
  'default' | 'info' | 'warning' | 'error' | 'primary' | 'success'
> = {
  REFERENCE: 'info',
  STATE_MACHINE: 'warning',
  SECURITY: 'error',
  PROTOCOL: 'primary',
  OBSERVABILITY: 'success',
  REGISTRY_META: 'default',
  UNAVAILABLE: 'default',
};

export function ProviderCodeContractTypeBadges({
  configurationLevel,
  contractKind,
}: {
  configurationLevel: unknown;
  contractKind: unknown;
}) {
  const { t } = useTranslation('provider');
  const safeLevel = providerSafeEnumPresentation('codeConfigurationLevel', configurationLevel);
  const safeKind = providerSafeEnumPresentation('codeContractKind', contractKind);
  return (
    <>
      <Chip
        label={t(providerCodeEnumTranslationKey('codeConfigurationLevel', safeLevel))}
        color={LEVEL_COLORS[safeLevel]}
        size="small"
        variant="outlined"
      />
      <Chip
        label={t(providerCodeEnumTranslationKey('codeContractKind', safeKind))}
        color={KIND_COLORS[safeKind]}
        size="small"
        variant="outlined"
      />
    </>
  );
}

export function ProviderCodeContractRegistrationChip({ state }: { state: unknown }) {
  const { t } = useTranslation('provider');
  const safeState = providerSafeEnumPresentation('codeRegistrationState', state);
  return (
    <Chip
      label={t(providerCodeEnumTranslationKey('codeRegistrationState', safeState))}
      color={safeState === 'REGISTERED' ? 'success' : 'warning'}
      size="small"
    />
  );
}
