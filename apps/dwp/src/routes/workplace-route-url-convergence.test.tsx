// @vitest-environment jsdom
import { act, createElement, Suspense, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductSurfaceCanaryProvider } from '../components/product-surface-canary-runtime';
import { WorkplacePlanner } from '../features/rooms/workplace-planner';
import { WorkplaceUnifiedReservations } from '../features/rooms/workplace-unified-reservations';
import { ProductCanaryRouteBoundary } from './product-surface-canary-routes';

import type { ReactElement } from 'react';
import type { ProductSurfaceCanaryAuthority } from '../components/product-surface-canary-runtime';

const queryRuntime = vi.hoisted(() => {
  const refetch = vi.fn(async () => ({ data: undefined }));
  return {
    query: {
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      isPending: false,
      isPlaceholderData: false,
      refetch,
    },
    mutation: {
      isPending: false,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    },
    invalidateQueries: vi.fn(async () => undefined),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => queryRuntime.mutation,
  useQuery: () => queryRuntime.query,
  useQueryClient: () => ({ invalidateQueries: queryRuntime.invalidateQueries }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));

vi.mock('@dwp-frontend/shared-utils', () => ({
  acceptWorkplaceAlternativeOffer: vi.fn(),
  cancelRoomBooking: vi.fn(),
  cancelWorkplaceBooking: vi.fn(),
  cancelWorkplaceWaitlistEntry: vi.fn(),
  checkInWorkplaceBooking: vi.fn(),
  compensateWorkplaceBookingBatch: vi.fn(),
  createWorkplaceIdempotencyKey: () => 'test-idempotency-key',
  createWorkplaceReservationHolds: vi.fn(),
  createWorkplaceWaitlistEntry: vi.fn(),
  getRoomBookings: vi.fn(),
  getRoomsPolicy: vi.fn(),
  getWorkplaceAuthorizedBookingBeneficiaries: vi.fn(),
  getWorkplaceBookingBatch: vi.fn(),
  getWorkplaceBookingIntent: vi.fn(),
  getWorkplaceBookings: vi.fn(),
  getWorkplaceExplore: vi.fn(),
  getWorkplaceWaitlistEntries: vi.fn(),
  previewWorkplaceBookingIntent: vi.fn(),
  releaseWorkplaceBooking: vi.fn(),
  releaseWorkplaceReservationHolds: vi.fn(),
  replanWorkplaceBookingBatch: vi.fn(),
  resolveIdempotentMutationIntent: vi.fn(),
  respondToRoomBooking: vi.fn(),
  startWorkplaceBookingBatch: vi.fn(),
  updateWorkplaceWaitlistEntry: vi.fn(),
  useAuth: () => ({
    user: { tenantId: 1, userId: 900018, displayName: 'Verification member', roles: [] },
  }),
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children }: { children: ReactNode }) => createElement('button', null, children),
  ConfirmDialog: () => null,
  EmptyState: ({ title, description, action }: Record<string, ReactNode>) =>
    createElement('section', null, title, description, action),
  FilterBar: ({ filters }: { filters: ReactNode }) => createElement('section', null, filters),
  InlineFeedback: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  LoadingState: ({ label }: { label: string }) => createElement('div', null, label),
  PageCanvas: ({ children, ...props }: { children: ReactNode; 'data-testid'?: string }) =>
    createElement('main', { 'data-testid': props['data-testid'] }, children),
  SelectField: ({ label }: { label: string }) => createElement('label', null, label),
}));

vi.mock('./product-surface-guard', () => ({
  ProductSurfaceGuard: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}));

vi.mock('../features/rooms/rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplace: false,
    canCreateWorkplaceBooking: false,
    canUpdateWorkplaceBooking: false,
    canViewRooms: false,
    canCreateRoomBooking: false,
    canUpdateRoomBooking: false,
  }),
}));

vi.mock('../features/rooms/rooms-ui', () => ({
  RoomsPageHeading: ({ title }: { title: string }) => createElement('h1', null, title),
  RoomsPermissionNotice: () => null,
}));

vi.mock('../features/rooms/workplace-planner-configuration', () => ({
  WorkplacePlannerConfiguration: ({ state }: { state: { scope: string | null } }) =>
    createElement('div', { 'data-testid': 'planner-page' }, state.scope),
}));
vi.mock('../features/rooms/workplace-planner-result', () => ({
  WorkplacePlannerResult: () => null,
}));
vi.mock('../features/rooms/workplace-planner-review', () => ({
  WorkplacePlannerReview: () => null,
}));
vi.mock('../features/rooms/workplace-planner-waitlists', () => ({
  WorkplacePlannerWaitlists: () => null,
}));

vi.mock('../features/rooms/workplace-member-surfaces', () => ({
  workplaceMemberCard: () => ({}),
  workplaceMemberSoftSurface: () => ({}),
}));
vi.mock('../features/rooms/workplace-reservation-permission-notices', () => ({
  WorkplaceReservationPermissionNotices: () => null,
}));
vi.mock('../features/rooms/workplace-reservations-next-action', () => ({
  WorkplaceReservationsNextAction: () => null,
}));
vi.mock('../features/rooms/workplace-reservation-source-summary', () => ({
  WorkplaceReservationSourceSummary: () => null,
}));
vi.mock('../features/rooms/workplace-mobile-reservation-inspector', () => ({
  WorkplaceMobileReservationInspector: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../features/rooms/workplace-reservation-detail-tab-content', () => ({
  WorkplaceReservationDetailTabContent: () => null,
}));
vi.mock('../features/rooms/workplace-relocate-booking-dialog', () => ({
  WorkplaceRelocateBookingDialog: () => null,
}));
vi.mock('../features/rooms/room-booking-dialog', () => ({ RoomBookingDialog: () => null }));
vi.mock('../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => vi.fn(),
}));
vi.mock('../features/rooms/use-workplace-reservation-confirmation-validity', () => ({
  useWorkplaceReservationConfirmationValidity: () => undefined,
}));
vi.mock('../features/rooms/workplace-decision-clock', () => ({
  useWorkplaceDecisionClock: () => ({
    advance: vi.fn(),
    nowInstant: Date.parse('2026-10-27T07:00:00Z'),
    readNow: () => Date.parse('2026-10-27T07:00:00Z'),
  }),
}));

const SCOPE_KEY = 'scope:workplace:self';
const REVALIDATE_AT = '2030-01-01T00:00:00Z';
const scope = {
  key: SCOPE_KEY,
  kind: 'SELF' as const,
  displayName: 'Self',
  isDefault: true,
  readOnly: false,
};
const context = {
  contextKey: 'workplace-work-context',
  productKey: 'workplace',
  surfaceKey: 'workplace.work',
  plane: 'work' as const,
  accessMode: 'NORMAL' as const,
  accessSource: 'ENTITLEMENT' as const,
  appResourceKey: 'APP.WORKPLACE',
  effectiveGrants: [
    {
      grantKind: 'POLICY' as const,
      accessPolicyKey: 'workplace.work-access.v1',
      authorityMode: 'ENTITLEMENT' as const,
      policyDecisionRef: 'verification-policy-decision',
      scopeKeys: [SCOPE_KEY],
      requiresProductEntitlement: true,
      readOnly: false,
    },
  ],
  scopes: [scope],
  revalidateAt: REVALIDATE_AT,
};
const decision = {
  state: 'allowed' as const,
  context,
  routeGrantRef: 'workplace.work-access.v1',
  scope,
  effectiveReadOnly: false,
  revalidateAt: REVALIDATE_AT,
  decisionRevision: 'workplace-url-convergence-revision',
};
const authority: ProductSurfaceCanaryAuthority = {
  flags: {
    contextShadow: true,
    capabilityEnforcement: true,
    surfaceUi: true,
    surfaceUiEvaluation: 'resolved',
  },
  serverNowMs: Date.parse('2029-01-01T00:00:00Z'),
  envelope: {
    contractVersion: '1',
    decisionRevision: 'workplace-url-convergence-revision',
    sourceRevisions: {},
    activeAccessMode: 'NORMAL',
    generatedAt: '2029-01-01T00:00:00Z',
    contexts: [context],
  },
  routeDecisions: {
    'route.workplace.work.planner.page': decision,
    'route.workplace.work.reservations.page': decision,
  },
};

function LocationProbe({ onLocation }: { onLocation: (value: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onLocation(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, onLocation]);
  return null;
}

describe('governed workplace page URL convergence', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function renderGovernedPage({
    initialEntry,
    path,
    routeContractKey,
    page,
  }: {
    initialEntry: string;
    path: string;
    routeContractKey: string;
    page: ReactElement;
  }) {
    const locations: string[] = [];
    await act(async () => {
      root.render(
        <ProductSurfaceCanaryProvider authority={authority}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <LocationProbe
              onLocation={(value) => {
                if (locations.at(-1) !== value) locations.push(value);
              }}
            />
            <Routes>
              <Route
                path={path}
                element={
                  <ProductCanaryRouteBoundary
                    productId="workplace"
                    surfaceId="workplace.work"
                    routeContractKey={routeContractKey}
                  >
                    <Suspense fallback={null}>{page}</Suspense>
                  </ProductCanaryRouteBoundary>
                }
              />
            </Routes>
          </MemoryRouter>
        </ProductSurfaceCanaryProvider>
      );
    });
    await vi.dynamicImportSettled();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    return locations;
  }

  it('settles the planner after the route boundary injects its canonical scope', async () => {
    const locations = await renderGovernedPage({
      initialEntry:
        '/workplace/planner?v=1&week=2026-10-26&dates=2026-10-26%2C2026-10-27' +
        '&start=09%3A00&duration=540&tz=Asia%2FSeoul&target=SELF&types=DESK&step=PLAN',
      path: '/workplace/planner',
      routeContractKey: 'route.workplace.work.planner.page',
      page: <WorkplacePlanner />,
    });

    expect(host.querySelector('[data-testid="workplace-weekly-planner"]')).not.toBeNull();
    expect(locations).toHaveLength(2);
    expect(new URLSearchParams(locations.at(-1)?.split('?')[1]).get('scope')).toBe(SCOPE_KEY);
  });

  it('settles reservations after the route boundary injects its canonical scope', async () => {
    const locations = await renderGovernedPage({
      initialEntry:
        '/workplace/reservations?v=1&period=UPCOMING&types=ALL&status=ACTIVE&authority=ALL',
      path: '/workplace/reservations',
      routeContractKey: 'route.workplace.work.reservations.page',
      page: <WorkplaceUnifiedReservations />,
    });

    expect(host.querySelector('[data-testid="workplace-unified-reservations"]')).not.toBeNull();
    expect(locations).toHaveLength(2);
    expect(new URLSearchParams(locations.at(-1)?.split('?')[1]).get('scope')).toBe(SCOPE_KEY);
  });
});
