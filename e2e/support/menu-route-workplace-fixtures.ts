import type {
  MailAdminOverview,
  MailAdminOperationsSnapshot,
  MailActionProposalPage,
  MailDeliveryAuditPage,
  MailDeliveryPage,
  MailHome,
  MailOrganization,
  MailOrganizationWritingAsset,
  MailPolicyGovernance,
  MailRetentionSnapshot,
  MailSavedView,
  MailThreadPage,
  PageResult,
  RegistryEntry,
  RuntimeRegistryEntry,
  SpaceAdminOverview,
  SpaceLifecycleReview,
  SpaceOperationsDashboard,
  SpacePublicationReview,
  SpaceRequest,
  SpaceSummary,
  SpaceTemplate,
  WorkplaceAdminBookingPage,
  WorkplaceAdminOverview,
  WorkplaceBooking,
  WorkplaceCollaborationOverview,
  WorkplaceExploreResponse,
  WorkplaceGovernanceCampus,
  WorkplacePolicy,
  WorkplaceSite,
} from '@dwp-frontend/shared-utils';

import type { MenuRouteFixtureResolution } from './menu-route-fixture-contract';
import {
  defaultMailComposeContext,
  defaultMailPreferences,
  mailAddressBook,
} from './mail-fixtures';

const OBSERVED_AT = '2026-08-11T00:20:00Z';

const WORKPLACE_POLICY = {
  bookingWindowDays: 30,
  maximumActiveBookings: 10,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '08:00',
  workingDayEnd: '20:00',
  allowRecurring: true,
  requireCheckIn: true,
  checkInLeadMinutes: 15,
  autoReleaseMinutes: 15,
  allowAssignedDeskLending: true,
  showColleagueNames: true,
  bookingRetentionDays: 365,
  version: 1,
} satisfies WorkplacePolicy;

const pageResult = <T>(): PageResult<T> => ({
  content: [],
  page: 0,
  size: 100,
  totalElements: 0,
  totalPages: 0,
});

const resolveRegistryFixture = (path: string): MenuRouteFixtureResolution | null => {
  switch (path) {
    case '/api/platform/v1/catalog/registry-entries':
      return { data: [] satisfies RuntimeRegistryEntry[] };
    case '/api/platform/v1/admin/dwaion/agents':
      return { data: pageResult<RegistryEntry>() };
    default:
      return null;
  }
};

const resolveMailFixture = (path: string): MenuRouteFixtureResolution | null => {
  const policy = {
    externalSenderBanner: true,
    blockRemoteImages: true,
    allowSharedInboxes: true,
    aiAssistanceEnabled: true,
    aiCrossAppActionsEnabled: false,
    aiAutoExecuteEnabled: false,
    retentionDays: 365,
    maximumAttachmentMb: 25,
    version: 1,
  } as const;
  switch (path) {
    case '/api/platform/v1/mail/home':
      return {
        data: {
          accounts: [],
          metrics: {
            unread: 0,
            urgent: 0,
            needsReply: 0,
            assigned: 0,
            snoozed: 0,
            activeProposals: 0,
          },
          focusQueue: [],
          proposals: [],
          sharedInboxes: [],
          generatedAt: OBSERVED_AT,
        } satisfies MailHome,
      };
    case '/api/platform/v1/mail/threads':
      return { data: { items: [], total: 0, page: 0, pageSize: 30 } satisfies MailThreadPage };
    case '/api/platform/v1/mail/organization':
      return {
        data: {
          accounts: [],
          folders: [],
          rules: [],
          recentRuns: [],
          generatedAt: OBSERVED_AT,
        } satisfies MailOrganization,
      };
    case '/api/platform/v1/mail/address-book':
      return { data: mailAddressBook() };
    case '/api/platform/v1/mail/follow-ups':
      return { data: [] };
    case '/api/platform/v1/mail/deliveries':
      return {
        data: {
          items: [],
          total: 0,
          page: 0,
          pageSize: 30,
        } satisfies MailDeliveryPage,
      };
    case '/api/platform/v1/mail/proposals':
      return {
        data: {
          items: [],
          total: 0,
          page: 0,
          pageSize: 20,
        } satisfies MailActionProposalPage,
      };
    case '/api/platform/v1/mail/writing-assets':
      return { data: { templates: [], signatures: [] } };
    case '/api/platform/v1/mail/preferences':
      return { data: defaultMailPreferences() };
    case '/api/platform/v1/mail/compose-context':
      return { data: defaultMailComposeContext(Date.parse(OBSERVED_AT)) };
    case '/api/platform/v1/mail/saved-views':
      return { data: [] satisfies MailSavedView[] };
    case '/api/platform/v1/admin/mail/overview':
      return {
        data: {
          personalAccounts: 0,
          sharedAccounts: 0,
          activeConnections: 0,
          degradedConnections: 0,
          openSharedThreads: 0,
          pendingAiProposals: 0,
          queuedDeliveries: 0,
          failedDeliveries: 0,
          policy,
          connections: [],
          sharedInboxes: [],
          providerCatalog: [],
          generatedAt: OBSERVED_AT,
        } satisfies MailAdminOverview,
      };
    case '/api/platform/v1/admin/mail/operations':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          sources: [],
          exceptions: [],
          commands: [],
        } satisfies MailAdminOperationsSnapshot,
      };
    case '/api/platform/v1/admin/mail/writing-assets':
      return { data: [] satisfies MailOrganizationWritingAsset[] };
    case '/api/platform/v1/admin/mail/policy/evidence':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          policyVersion: 1,
          rows: [],
          history: [],
        } satisfies MailPolicyGovernance,
      };
    case '/api/platform/v1/admin/mail/retention':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          policyVersion: 1,
          resourcePolicies: [],
          holds: [],
          purgeJobs: [],
        } satisfies MailRetentionSnapshot,
      };
    case '/api/platform/v1/admin/mail/delivery-audit':
      return {
        data: {
          items: [],
          total: 0,
          page: 0,
          pageSize: 50,
          generatedAt: OBSERVED_AT,
        } satisfies MailDeliveryAuditPage,
      };
    default:
      return null;
  }
};

const resolveWorkplaceFixture = (path: string): MenuRouteFixtureResolution | null => {
  switch (path) {
    case '/api/platform/v1/workplace/experience/collaboration/overview':
      return {
        data: {
          shareableGroups: [],
          ownPlans: [],
          sharedPlans: [],
          preference: { optIn: false, visibility: 'PRIVATE', version: 0 },
          policy: { sharingEnabled: true, maximumVisibility: 'SITE', version: 0 },
          actualPresence: {
            kind: 'ACTUAL_PRESENCE',
            provider: null,
            status: 'NOT_CONFIGURED',
            configurationReference: null,
            lastVerifiedAt: null,
            version: 0,
          },
          generatedAt: OBSERVED_AT,
        } satisfies WorkplaceCollaborationOverview,
      };
    case '/api/platform/v1/workplace/explore':
      return {
        data: {
          sites: [],
          floors: [],
          selectedFloor: null,
          resources: [],
          occupancy: [],
          policy: WORKPLACE_POLICY,
          generatedAt: OBSERVED_AT,
        } satisfies WorkplaceExploreResponse,
      };
    case '/api/platform/v1/workplace/bookings':
      return { data: [] satisfies WorkplaceBooking[] };
    case '/api/platform/v1/workplace/booking-intents/beneficiaries':
      return { data: { beneficiaries: [], generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/workplace/waitlist-entries':
      return {
        data: {
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
          generatedAt: OBSERVED_AT,
        },
      };
    case '/api/platform/v1/workplace/service-orders':
      return { data: { items: [], nextCursor: null, hasMore: false, generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/workplace/safety/incidents/active':
      return { data: [] };
    case '/api/platform/v1/admin/workplace/overview':
      return {
        data: {
          activeSites: 0,
          configuredFloors: 0,
          reservableResources: 0,
          assignedResources: 0,
          bookingsThisWeek: 0,
          checkedInToday: 0,
          utilizationPercent: 0,
          policy: WORKPLACE_POLICY,
          generatedAt: OBSERVED_AT,
        } satisfies WorkplaceAdminOverview,
      };
    case '/api/platform/v1/admin/workplace/bookings':
      return {
        data: {
          content: [],
          page: 0,
          size: 30,
          totalElements: 0,
          totalPages: 0,
        } satisfies WorkplaceAdminBookingPage,
      };
    case '/api/platform/v1/admin/workplace/sites':
      return { data: [] satisfies WorkplaceSite[] };
    case '/api/platform/v1/admin/workplace/policy':
      return { data: WORKPLACE_POLICY };
    case '/api/platform/v1/admin/workplace/governance/campuses':
      return { data: [] satisfies WorkplaceGovernanceCampus[] };
    case '/api/platform/v1/admin/workplace/experience/facilities/requests':
      return {
        data: {
          content: [],
          page: 0,
          size: 1,
          totalElements: 0,
          totalPages: 0,
          generatedAt: OBSERVED_AT,
          countsScope: 'SITE',
          allowedFloorIds: [],
        },
      };
    case '/api/platform/v1/admin/workplace/safety/incidents':
    case '/api/platform/v1/admin/workplace/safety/connectors':
    case '/api/platform/v1/admin/workplace/devices':
    case '/api/platform/v1/admin/workplace/device-providers':
    case '/api/platform/v1/admin/workplace/visit-policies':
    case '/api/platform/v1/admin/workplace/access-zones':
    case '/api/platform/v1/admin/workplace/provider-bindings':
    case '/api/platform/v1/admin/workplace/kiosk-devices':
      return { data: [] };
    case '/api/platform/v1/admin/workplace/assistant/governance':
      return {
        data: {
          tenantOptIn: false,
          killSwitch: true,
          modelProviderReference: null,
          modelVersion: null,
          promptVersion: null,
          toolVersion: null,
          retentionDays: 30,
          feedbackUseEnabled: false,
          redactionState: 'READY',
          version: 0,
          updatedAt: null,
          updatedBy: null,
        },
      };
    case '/api/platform/v1/admin/workplace/assistant/audit-events':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/admin/workplace/service-orders':
      return { data: { items: [], nextCursor: null, hasMore: false, generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/admin/workplace/service-catalog':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/admin/workplace/service-providers':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/admin/workplace/visits/exceptions':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    case '/api/platform/v1/admin/workplace/exceptions':
      return {
        data: {
          summary: {
            active: 0,
            critical: 0,
            warning: 0,
            error: 0,
            concurrencyConflicts24h: 0,
            deadLetterQueueDepth: 0,
            automaticRecoveryPercent: null,
            slaCompliancePercent: null,
          },
          exceptions: [],
          guardrails: [],
          generatedAt: OBSERVED_AT,
          externalTelemetryUrl: null,
        },
      };
    default:
      return null;
  }
};

const resolveSpaceFixture = (path: string): MenuRouteFixtureResolution | null => {
  switch (path) {
    case '/api/spaces/v1/spaces':
      return { data: [] satisfies SpaceSummary[] };
    case '/api/spaces/v1/requests':
      return { data: [] satisfies SpaceRequest[] };
    case '/api/spaces/v1/admin/spaces':
      return { data: [] satisfies SpaceSummary[] };
    case '/api/spaces/v1/admin/requests':
      return { data: [] satisfies SpaceRequest[] };
    case '/api/spaces/v1/admin/templates':
      return { data: [] satisfies SpaceTemplate[] };
    case '/api/spaces/v1/admin/content-reviews':
      return { data: [] satisfies SpacePublicationReview[] };
    case '/api/spaces/v1/admin/lifecycle':
      return { data: [] satisfies SpaceLifecycleReview[] };
    case '/api/spaces/v1/admin/overview':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          metrics: {
            activeSpaces: 0,
            restrictedSpaces: 0,
            pendingCreationRequests: 0,
            pendingPublicationReviews: 0,
            overdueLifecycleReviews: 0,
            activeMemberships: 0,
          },
          priorityRequests: [],
          publicationQueue: [],
          lifecycleQueue: [],
          portfolio: [],
        } satisfies SpaceAdminOverview,
      };
    case '/api/spaces/v1/admin/operations':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          entitlementProviderConfigured: true,
          metrics: {
            queuedDeliveries: 0,
            deadLetters: 0,
            openFindings: 0,
            highRiskFindings: 0,
            ownerlessSpaces: 0,
            overdueReviews: 0,
            synchronizedLast24Hours: 0,
          },
          recentRuns: [],
          findings: [],
          deliveries: [],
        } satisfies SpaceOperationsDashboard,
      };
    default:
      return null;
  }
};

export const resolveMenuRouteWorkplaceFixture = (
  method: string,
  path: string
): MenuRouteFixtureResolution | null => {
  if (method !== 'GET') return null;
  return (
    resolveRegistryFixture(path) ??
    resolveMailFixture(path) ??
    resolveWorkplaceFixture(path) ??
    resolveSpaceFixture(path)
  );
};
