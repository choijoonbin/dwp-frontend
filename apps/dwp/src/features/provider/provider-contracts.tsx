import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { HOME_WIDGET_LIBRARY_ENABLED } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { ProviderCodeContracts } from './provider-code-contracts';
import { ProviderWidgetCatalog } from './provider-widget-catalog';

type ContractSurface = 'widgets' | 'codes';

export function ProviderContracts() {
  const { t } = useTranslation('provider');
  const [searchParams, setSearchParams] = useSearchParams();
  if (!HOME_WIDGET_LIBRARY_ENABLED) return <ProviderCodeContracts />;
  const surface: ContractSurface = searchParams.get('tab') === 'widgets' ? 'widgets' : 'codes';
  const selectSurface = (nextSurface: ContractSurface) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', nextSurface);
        return next;
      },
      { replace: true }
    );
  };

  return (
    <Stack gap={3}>
      <Tabs
        value={surface}
        onChange={(_, value: ContractSurface) => selectSurface(value)}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label={t('contractSurfaces.label')}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="widgets" label={t('contractSurfaces.widgets')} />
        <Tab value="codes" label={t('contractSurfaces.codes')} />
      </Tabs>
      <Box role="tabpanel" aria-label={t(`contractSurfaces.${surface}`)}>
        {surface === 'widgets' ? (
          <ProviderWidgetCatalog onOpenCodeContracts={() => selectSurface('codes')} />
        ) : (
          <ProviderCodeContracts />
        )}
      </Box>
    </Stack>
  );
}
