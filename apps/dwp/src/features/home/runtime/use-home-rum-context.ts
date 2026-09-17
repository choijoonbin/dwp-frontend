import { useEffect } from 'react';

import { setHomeWebVitalsContext } from '../../../observability/web-vitals';

import type { HomeDeviceClass } from '@dwp-frontend/shared-utils';
import type { useHomeV2Runtime } from './use-home-v2-runtime';

export function useHomeRumContext(
  runtime: ReturnType<typeof useHomeV2Runtime>,
  deviceClass: HomeDeviceClass
): void {
  const result =
    runtime.activation.kind === 'ACTIVE' || runtime.activation.kind === 'SHADOW'
      ? runtime.activation.result
      : null;
  useEffect(() => {
    if (!result) {
      setHomeWebVitalsContext(null);
      return;
    }
    if (result.metadata.runtimeState === 'DISABLED') {
      setHomeWebVitalsContext(null);
      return;
    }
    setHomeWebVitalsContext({
      deviceClass,
      homeMode: result.snapshot.data.mode,
      homeRuntime: result.metadata.runtimeState,
      rolloutRing: result.metadata.rolloutRing,
    });
    return () => setHomeWebVitalsContext(null);
  }, [deviceClass, result]);
}
