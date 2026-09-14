import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isAppEntitled,
  localizeHomeApps,
} from '../../components/workspace-composer/app-launchpad-model';
import { GlobalSearchDialog } from './global-search-dialog';

import type { PermissionDTO } from '@dwp-frontend/shared-utils/api/auth-api';

const dwaionRuntimeBundled = import.meta.env.VITE_PRODUCT_DWAION_RUNTIME !== 'disabled';
const DwaionGlobalSearchDialog = dwaionRuntimeBundled
  ? lazy(() =>
      import('./global-search-dialog-dwaion-runtime').then((module) => ({
        default: module.DwaionGlobalSearchDialog,
      }))
    )
  : undefined;

type GlobalSearchDialogRuntimeProps = {
  open: boolean;
  roles: readonly string[];
  permissions: readonly PermissionDTO[];
  legacyRoleFallbackAllowed: boolean;
  tenantSourcesEnabled: boolean;
  includeTenantAudit: boolean;
  includeTenantCatalog: boolean;
  includeProvider: boolean;
  onClose: () => void;
};

/** Loads the app catalog only after search is opened, outside the initial shell graph. */
export function GlobalSearchDialogRuntime({
  roles,
  permissions,
  legacyRoleFallbackAllowed,
  tenantSourcesEnabled,
  ...dialogProps
}: GlobalSearchDialogRuntimeProps) {
  const { t: tHome } = useTranslation('home');
  const apps = useMemo(
    () =>
      tenantSourcesEnabled
        ? localizeHomeApps(tHome).filter((app) =>
            isAppEntitled(app, roles, permissions, legacyRoleFallbackAllowed)
          )
        : [],
    [legacyRoleFallbackAllowed, permissions, roles, tHome, tenantSourcesEnabled]
  );
  const includeAsk = apps.some((app) => app.id === 'dwp-ask');
  const sharedProps = {
    ...dialogProps,
    apps,
    includeWork: apps.some((app) => app.id === 'dwp-work'),
    includePeople: apps.some((app) => app.id === 'ref-app-people'),
  };

  if (DwaionGlobalSearchDialog && includeAsk) {
    return <DwaionGlobalSearchDialog {...sharedProps} includeAsk />;
  }

  return <GlobalSearchDialog {...sharedProps} includeAsk={false} />;
}
