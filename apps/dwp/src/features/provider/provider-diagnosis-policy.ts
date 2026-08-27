import type { ProviderSupportSessionContext } from '@dwp-frontend/shared-utils';

export const TENANT_EXPERIENCE_PREVIEW_SCOPE = 'TENANT_EXPERIENCE_PREVIEW';

export type TenantExperiencePreviewAccess =
  | { state: 'allowed'; context: ProviderSupportSessionContext }
  | { state: 'no-session' }
  | { state: 'wrong-tenant'; context: ProviderSupportSessionContext }
  | { state: 'expired'; context: ProviderSupportSessionContext }
  | { state: 'scope-denied'; context: ProviderSupportSessionContext };

export function isExecutableProviderDiagnosisScopeSet(scopes: readonly string[]): boolean {
  return scopes.length === 1 && scopes[0] === TENANT_EXPERIENCE_PREVIEW_SCOPE;
}

export function resolveTenantExperiencePreviewAccess(
  context: ProviderSupportSessionContext | null | undefined,
  tenantId: string,
  now = Date.now()
): TenantExperiencePreviewAccess {
  if (!context) return { state: 'no-session' };
  if (context.tenantId !== tenantId) return { state: 'wrong-tenant', context };
  const expiresAt = Date.parse(context.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return { state: 'expired', context };
  if (!isExecutableProviderDiagnosisScopeSet(context.scopes)) {
    return { state: 'scope-denied', context };
  }
  return { state: 'allowed', context };
}

export function tenantDiagnosisLandingPath(tenantId: string, scopes: readonly string[]): string {
  if (isExecutableProviderDiagnosisScopeSet(scopes)) {
    return `/provider/tenants/${encodeURIComponent(tenantId)}/experience-preview`;
  }
  return '/provider/support';
}

type DiagnosisWindowOpener = (
  url?: string | URL,
  target?: string,
  features?: string
) => Window | null;

export type TenantDiagnosisWindowReservation = {
  destination: string;
  popup: Window | null;
};

/** Reserve the tab synchronously from the activation click so popup blockers cannot race it. */
export function reserveTenantDiagnosisWindow(
  tenantId: string,
  scopes: readonly string[],
  openWindow: DiagnosisWindowOpener = window.open.bind(window)
): TenantDiagnosisWindowReservation {
  const popup = openWindow('about:blank', '_blank');
  if (popup) popup.opener = null;
  return { destination: tenantDiagnosisLandingPath(tenantId, scopes), popup };
}

export function completeTenantDiagnosisWindow(
  reservation: TenantDiagnosisWindowReservation,
  navigateSameTab: (destination: string) => void
): 'new-tab' | 'same-tab' {
  if (reservation.popup && !reservation.popup.closed) {
    reservation.popup.location.replace(reservation.destination);
    return 'new-tab';
  }
  navigateSameTab(reservation.destination);
  return 'same-tab';
}

export function cancelTenantDiagnosisWindow(reservation: TenantDiagnosisWindowReservation): void {
  if (reservation.popup && !reservation.popup.closed) reservation.popup.close();
}
