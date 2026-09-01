import type {
  DwaionActionPolicy,
  DwaionDataSourcePolicy,
  DwaionEvaluationSetSummary,
  DwaionGovernanceAuditPage,
  DwaionOperationsOverview,
  DwaionOperationalGatePortfolio,
  DwaionProposalAnalysisPreference,
  DwaionProposalInboxPage,
  DwaionRetentionPolicy,
  DwaionSafetyPolicy,
  MessagingAdminOverview,
  MessagingConversationPage,
  MessagingDisplayPreference,
  MessagingHome,
  MessagingPerson,
  MessagingSavedItemPage,
  VideoMeetingAdminOverview,
  VideoMeetingAdminPolicy,
  VideoMeetingHome,
  VideoMeetingPage,
  VideoMeetingSummary,
} from '@dwp-frontend/shared-utils';

import type { MenuRouteFixtureResolution } from './menu-route-fixture-contract';

const OBSERVED_AT = '2026-08-11T00:20:00Z';

const resolveAgentFixture = (path: string): MenuRouteFixtureResolution | null => {
  const retention = {
    retentionDays: 30,
    legalHold: false,
    policyVersion: 1,
    updatedAt: OBSERVED_AT,
  } satisfies DwaionRetentionPolicy;
  const safety = {
    promptInjectionOutcome: 'DENY',
    privilegedDataOutcome: 'DENY',
    mutationOutcome: 'HANDOFF',
    requireCitations: true,
    publicWebEnabled: false,
    maxSourceScopes: 5,
    maxToolCalls: 6,
    policyVersion: 1,
    updatedAt: OBSERVED_AT,
  } satisfies DwaionSafetyPolicy;

  switch (path) {
    case '/api/agent/v1/actions':
    case '/api/agent/v1/conversations':
    case '/api/agent/v1/runs':
      return { data: [] };
    case '/api/agent/v1/proposals':
      return {
        data: {
          items: [],
          nextCursor: null,
          summary: { active: 0, highPriority: 0, snoozed: 0, handled: 0 },
        } satisfies DwaionProposalInboxPage,
      };
    case '/api/agent/v1/proposals/preferences':
      return {
        data: {
          proactiveAnalysisEnabled: false,
          revision: 0,
          updatedAt: null,
        } satisfies DwaionProposalAnalysisPreference,
      };
    case '/api/agent/v1/admin/overview':
      return {
        data: {
          periodDays: 30,
          runCount: 0,
          completedRunCount: 0,
          failedRunCount: 0,
          allowedRunCount: 0,
          handedOffRunCount: 0,
          deniedRunCount: 0,
          groundedAnswerCount: 0,
          abstainedAnswerCount: 0,
          configurationRequiredCount: 0,
          averageLatencyMs: 0,
          totalTokens: 0,
          activeUserCount: 0,
          conversationCount: 0,
          feedbackUpCount: 0,
          feedbackDownCount: 0,
          retention,
          generatedAt: OBSERVED_AT,
        } satisfies DwaionOperationsOverview,
      };
    case '/api/agent/v1/admin/retention':
      return { data: retention };
    case '/api/agent/v1/admin/sources':
      return { data: [] satisfies DwaionDataSourcePolicy[] };
    case '/api/agent/v1/admin/actions':
      return { data: [] satisfies DwaionActionPolicy[] };
    case '/api/agent/v1/admin/safety':
      return { data: safety };
    case '/api/agent/v1/admin/evaluations':
      return { data: [] satisfies DwaionEvaluationSetSummary[] };
    case '/api/agent/v1/admin/audit':
      return {
        data: {
          content: [],
          page: 0,
          size: 50,
          totalElements: 0,
          totalPages: 0,
        } satisfies DwaionGovernanceAuditPage,
      };
    case '/api/agent/v1/admin/gates':
      return {
        data: {
          approvedCount: 0,
          blockedCount: 0,
          completionPercent: 0,
          deliveryReady: false,
          environment: 'PRODUCTION',
          expiredCount: 0,
          gates: [],
          readyForApprovalCount: 0,
          requiredCount: 0,
          totalCount: 0,
        } satisfies DwaionOperationalGatePortfolio,
      };
    default:
      return null;
  }
};

const resolveMeetingFixture = (path: string): MenuRouteFixtureResolution | null => {
  const capabilities = {
    available: true,
    provider: 'LIVEKIT',
    unavailableReason: null,
    audio: true,
    video: true,
    screenShare: true,
    participantList: true,
    chat: true,
    reactions: true,
    handRaise: true,
    captions: false,
    recordingConfigured: false,
    transcriptConfigured: false,
    aiNotesConfigured: false,
    maximumParticipants: 100,
    tokenTtlSeconds: 300,
    unmuteControl: 'REQUEST_ONLY',
  } as const;
  const policy = {
    meetingsEnabled: true,
    waitingRoomRequired: true,
    guestsAllowed: false,
    participantChatAllowed: true,
    reactionsAllowed: true,
    screenShareAllowed: true,
    unmuteControl: 'REQUEST_ONLY',
    recordingPolicy: 'HOST_OPT_IN',
    allowJoinBeforeHost: false,
    requireAuthenticatedInternalUsers: true,
    maximumParticipants: 100,
    retentionDays: 30,
    artifactRetentionDays: 30,
    chatRetentionDays: 30,
    recordingConfigured: false,
    aiNotesConfigured: false,
    version: 1,
  } satisfies VideoMeetingAdminPolicy;

  switch (path) {
    case '/api/meetings/v1/home':
      return {
        data: {
          serverNow: OBSERVED_AT,
          timeZone: 'Asia/Seoul',
          activeMeeting: null,
          nextMeeting: null,
          today: [],
          recent: [],
          metrics: {
            meetingsToday: 0,
            meetingMinutesToday: 0,
            waitingForApproval: 0,
            qualityScore: null,
            averageJoinSeconds: null,
          },
          capabilities,
        } satisfies VideoMeetingHome,
      };
    case '/api/meetings/v1/history':
    case '/api/meetings/v1/meetings':
      return {
        data: {
          items: [],
          page: 0,
          pageSize: 20,
          total: 0,
        } satisfies VideoMeetingPage<VideoMeetingSummary>,
      };
    case '/api/meetings/v1/admin/policy':
      return { data: policy };
    case '/api/meetings/v1/admin/overview':
      return {
        data: {
          liveMeetings: 0,
          scheduledToday: 0,
          waitingParticipants: 0,
          meetingsLastSevenDays: 0,
          averageQualityScore: null,
          failedJoinAttempts: 0,
          capabilities: {
            video: true,
            screenShare: true,
            chat: true,
            captions: false,
            recordingConfigured: false,
            transcriptConfigured: false,
            aiNotesConfigured: false,
          },
        } satisfies VideoMeetingAdminOverview,
      };
    case '/api/meetings/v1/admin/intelligence/readiness':
      return {
        data: {
          readinessVersion: '1',
          observedAt: OBSERVED_AT,
          recordingPolicy: policy.recordingPolicy,
          providerCode: 'LIVEKIT',
          providerModel: 'SELF_HOSTED',
          processingRegion: 'kr-central',
          capabilities: {},
          dependencies: {},
          governance: {},
          retention: {
            meetingDays: policy.retentionDays,
            artifactDays: policy.artifactRetentionDays,
            chatDays: policy.chatRetentionDays,
            intelligenceWorkerReady: true,
            signals: {},
          },
        },
      };
    default:
      return null;
  }
};

const resolveMessagingFixture = (path: string): MenuRouteFixtureResolution | null => {
  switch (path) {
    case '/api/messaging/v1/home':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          metrics: {
            unreadConversations: 0,
            mentions: 0,
            spaceChannels: 0,
            directMessages: 0,
            savedItems: 0,
          },
          priority: [],
          spaces: [],
          people: [],
        } satisfies MessagingHome,
      };
    case '/api/messaging/v1/conversations':
      return {
        data: { items: [], total: 0, page: 0, pageSize: 30 } satisfies MessagingConversationPage,
      };
    case '/api/messaging/v1/people':
      return { data: [] satisfies MessagingPerson[] };
    case '/api/messaging/v1/saved-items':
      return {
        data: { items: [], total: 0, page: 0, pageSize: 30 } satisfies MessagingSavedItemPage,
      };
    case '/api/messaging/v1/display-preferences':
      return {
        data: {
          layoutMode: 'AUTO',
          density: 'COMFORTABLE',
          theme: 'DEFAULT',
          showAvatars: true,
          timestampMode: 'SMART',
          messagePreview: true,
          version: 0,
          policy: {
            allowedThemes: ['DEFAULT', 'MIST', 'SAGE', 'ROSE'],
            allowPersonalBackgrounds: true,
            allowThemeSharing: false,
            version: 1,
          },
        } satisfies MessagingDisplayPreference,
      };
    case '/api/messaging/v1/admin/overview':
      return {
        data: {
          generatedAt: OBSERVED_AT,
          metrics: {
            activeConversations: 0,
            spaceLinkedConversations: 0,
            activeMembers: 0,
            retainedMessages: 0,
            restrictedConversations: 0,
          },
          policy: {
            directMessagesEnabled: true,
            spaceMessagingEnabled: true,
            allowMessageEdit: true,
            allowMessageDelete: true,
            aiAssistanceEnabled: true,
            aiAutoExecuteEnabled: false,
            retentionDays: 365,
            maximumAttachmentMb: 25,
            version: 1,
          },
          governedConversations: [],
        } satisfies MessagingAdminOverview,
      };
    default:
      return null;
  }
};

const resolveNotificationFixture = (path: string): MenuRouteFixtureResolution | null => {
  const partial = { partial: false, unavailableSources: [], message: null } as const;
  switch (path) {
    case '/api/notifications/v1/inbox':
      return {
        data: {
          ...partial,
          items: [],
          nextCursor: null,
          hasMore: false,
          approximateTotal: 0,
          changeVersion: '0',
        },
      };
    case '/api/notifications/v1/summary/by-app':
      return {
        data: {
          partial: false,
          unavailableSources: [],
          apps: [],
          changeVersion: '0',
          counterVersion: '0',
          generatedAt: OBSERVED_AT,
        },
      };
    case '/api/notifications/v1/admin/overview':
      return {
        data: { ...partial, generatedAt: OBSERVED_AT, metrics: [], trend: [], findings: [] },
      };
    case '/api/notifications/v1/admin/operations':
      return {
        data: {
          ...partial,
          generatedAt: OBSERVED_AT,
          lanes: [],
          providers: [],
          retryQueue: 0,
          deadLetterQueue: 0,
          unknownOutcomes: 0,
          findings: [],
        },
      };
    case '/api/notifications/v1/admin/types':
      return { data: { ...partial, items: [], nextCursor: null, hasMore: false } };
    case '/api/notifications/v1/admin/policies':
      return { data: { effectivePolicies: [], drafts: [], generatedAt: OBSERVED_AT } };
    case '/api/notifications/v1/admin/templates':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    case '/api/notifications/v1/admin/suppressions':
      return { data: { items: [], generatedAt: OBSERVED_AT } };
    default:
      return null;
  }
};

export const resolveMenuRouteCollaborationFixture = (
  method: string,
  path: string
): MenuRouteFixtureResolution | null => {
  if (method !== 'GET') return null;
  return (
    resolveAgentFixture(path) ??
    resolveMeetingFixture(path) ??
    resolveMessagingFixture(path) ??
    resolveNotificationFixture(path)
  );
};
