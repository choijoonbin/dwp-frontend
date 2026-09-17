import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { InlineFeedback } from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import { consumeWorkplaceDeviceBootstrap } from './workplace-navigation-device-bootstrap';
import { WorkplaceDeviceSurface } from './workplace-navigation-device-surfaces';

function WorkplaceDeviceBootstrapBoundary({ deviceId }: { deviceId: string }) {
  const { t, i18n } = useTranslation('rooms');
  const [bootstrap] = useState(() => consumeWorkplaceDeviceBootstrap(deviceId));
  const locale = resolveSupportedLocale(
    i18n.resolvedLanguage,
    i18n.language,
    typeof navigator === 'undefined' ? undefined : navigator.language
  );

  if (!bootstrap) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
        <InlineFeedback severity="error">
          {t('screen19.devices.displayAssertionRequired')}
        </InlineFeedback>
      </Box>
    );
  }

  return (
    <WorkplaceDeviceSurface
      deviceId={bootstrap.deviceId}
      deviceCredential={bootstrap.credential}
      locale={locale}
    />
  );
}

export function WorkplaceDeviceDisplayRoute() {
  const { deviceId = '' } = useParams<{ deviceId: string }>();
  return <WorkplaceDeviceBootstrapBoundary key={deviceId} deviceId={deviceId} />;
}

export default WorkplaceDeviceDisplayRoute;
