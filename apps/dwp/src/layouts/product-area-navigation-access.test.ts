import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { CALENDAR_NAVIGATION } from '../features/calendar/calendar-navigation';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { MAIL_NAVIGATION } from '../features/mail/mail-navigation';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { MESSAGING_NAVIGATION } from '../features/messaging/messaging-navigation';
import { ROOMS_NAVIGATION } from '../features/rooms/rooms-navigation';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import { SPACE_NAVIGATION } from '../features/spaces/space-navigation';
import { ProductAreaNavigationItemAccessGuard } from './product-area-navigation-access-guard';

import type { ProductSurfaceManifest } from '../components/product-manifest';
import type { GovernedProductAreaNavigationItem } from './product-area-permissions';
import type { ComponentProps } from 'react';

const accessMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePermissions: vi.fn(),
  useProviderSupportContext: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: accessMocks.useAuth,
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: accessMocks.usePermissions,
}));

vi.mock('@dwp-frontend/shared-utils/auth/provider-support-context', () => ({
  useProviderSupportContext: accessMocks.useProviderSupportContext,
}));

vi.mock('../components/product-surface-access-state', () => ({
  ProductSurfaceAccessState: ({ decision }: { decision: { state: string } }) =>
    createElement('span', { 'data-product-access-state': decision.state }, 'local deny'),
}));

type NavigationEntry = GovernedProductAreaNavigationItem & { path: string };
type ManagementEntryFixture = {
  name: string;
  manifest: ProductSurfaceManifest;
  navigation: readonly { items: readonly NavigationEntry[] }[];
};

const MANAGEMENT_ENTRY_FIXTURES: readonly ManagementEntryFixture[] = [
  { name: 'calendar', manifest: CALENDAR_PRODUCT_MANIFEST, navigation: CALENDAR_NAVIGATION },
  { name: 'mail', manifest: MAIL_PRODUCT_MANIFEST, navigation: MAIL_NAVIGATION },
  {
    name: 'messaging',
    manifest: MESSAGING_PRODUCT_MANIFEST,
    navigation: MESSAGING_NAVIGATION,
  },
  { name: 'workplace', manifest: WORKPLACE_PRODUCT_MANIFEST, navigation: ROOMS_NAVIGATION },
  { name: 'spaces', manifest: SPACE_PRODUCT_MANIFEST, navigation: SPACE_NAVIGATION },
];

function managementEntryItem(fixture: ManagementEntryFixture): NavigationEntry {
  const surface = fixture.manifest.surfaces.find((candidate) => candidate.plane === 'management');
  if (!surface) throw new Error(`${fixture.name} management surface is missing`);
  const item = fixture.navigation
    .flatMap((group) => group.items)
    .find((candidate) => candidate.path === surface.indexPath);
  if (!item) throw new Error(`${fixture.name} management entry item is missing`);
  return item;
}

function renderGuard(item: GovernedProductAreaNavigationItem) {
  const child = createElement('span', { 'data-testid': 'management-page' }, 'management page');
  const props = { item } as ComponentProps<typeof ProductAreaNavigationItemAccessGuard>;
  return renderToStaticMarkup(createElement(ProductAreaNavigationItemAccessGuard, props, child));
}

describe('legacy product area page access guard', () => {
  beforeEach(() => {
    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    accessMocks.useProviderSupportContext.mockReturnValue({ isLoading: false, data: undefined });
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => false),
    });
  });

  it.each(MANAGEMENT_ENTRY_FIXTURES)(
    'renders the $name management CTA target for a MANAGE-only persona',
    (fixture) => {
      const item = managementEntryItem(fixture);
      accessMocks.usePermissions.mockReturnValue({
        isLoaded: true,
        hasPermission: vi.fn(
          (resourceKey: string, permissionCode?: string) =>
            resourceKey === item.requiredResourceKey && permissionCode === 'MANAGE'
        ),
      });

      const markup = renderGuard(item);

      expect(markup).toContain('data-testid="management-page"');
      expect(markup).not.toContain('data-product-access-state');
    }
  );

  it.each(MANAGEMENT_ENTRY_FIXTURES)(
    'renders a local deny at the $name management CTA target without VIEW or MANAGE',
    (fixture) => {
      const markup = renderGuard(managementEntryItem(fixture));

      expect(markup).not.toContain('data-testid="management-page"');
      expect(markup).toContain('data-product-access-state="route-denied"');
    }
  );

  it('renders nothing while tenant permissions or provider support context are loading', () => {
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: false,
      hasPermission: vi.fn(() => true),
    });
    expect(renderGuard({})).toBe('');

    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: ['PROVIDER_SUPPORT'], resourceRoles: [] },
    });
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });
    accessMocks.useProviderSupportContext.mockReturnValue({ isLoading: true, data: undefined });
    expect(renderGuard({ requiredAnySupportScopes: ['WORKFORCE_READ'] })).toBe('');
  });

  it('fails closed without a support session and with a resolved empty scope list', () => {
    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: ['PROVIDER_SUPPORT'], resourceRoles: [] },
    });
    accessMocks.usePermissions.mockReturnValue({
      isLoaded: true,
      hasPermission: vi.fn(() => true),
    });

    expect(renderGuard({ requiredAnySupportScopes: ['WORKFORCE_READ'] })).toContain(
      'data-product-access-state="support-scope-denied"'
    );

    accessMocks.useProviderSupportContext.mockReturnValue({
      isLoading: false,
      data: { scopes: [] },
    });
    expect(renderGuard({ requiredAnySupportScopes: ['WORKFORCE_READ'] })).toContain(
      'data-product-access-state="support-scope-denied"'
    );
  });

  it('never resolves retired provider support scopes into a tenant product page', () => {
    const scopedItem = {
      requiredResourceKey: 'ADMIN.EXAMPLE',
      requiredPermissionCode: 'VIEW',
      requiredAnySupportScopes: ['WORKFORCE_READ'],
    };
    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'PROVIDER', roles: ['PROVIDER_SUPPORT'], resourceRoles: [] },
    });
    accessMocks.useProviderSupportContext.mockReturnValue({
      isLoading: false,
      data: { scopes: ['WORKFORCE_READ'] },
    });
    expect(renderGuard(scopedItem)).toContain('data-product-access-state="support-scope-denied"');

    accessMocks.useAuth.mockReturnValue({
      user: { identityPlane: 'TENANT', roles: [], resourceRoles: [] },
    });
    expect(renderGuard(scopedItem)).toContain('data-product-access-state="route-denied"');
  });
});
