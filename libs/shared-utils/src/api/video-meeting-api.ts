import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export { leaveVideoMeeting, VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingLifecycleState =
  'DRAFT' | 'SCHEDULED' | 'LOBBY' | 'LIVE' | 'ENDED' | 'CANCELLED';
export type VideoMeetingAccessScope = 'INTERNAL' | 'INVITED' | 'PUBLIC_CODE';
export type VideoMeetingRole = 'ORGANIZER' | 'CO_HOST' | 'PRESENTER' | 'ATTENDEE' | 'GUEST';
export type VideoMeetingJoinState = 'WAITING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
export type VideoMeetingAttendanceState =
  'INVITED' | 'REQUESTED' | 'ADMITTED' | 'DENIED' | 'JOINED' | 'LEFT';
export type VideoMeetingArtifactType =
  'RECORDING' | 'TRANSCRIPT' | 'SUMMARY' | 'ATTENDANCE' | 'CHAT_EXPORT';
export type VideoMeetingArtifactState =
  'NONE' | 'PROCESSING' | 'AVAILABLE' | 'UNAVAILABLE' | 'FAILED' | 'DELETED';

export type VideoMeetingArtifact = {
  artifactId: string;
  artifactType: VideoMeetingArtifactType;
  artifactState: VideoMeetingArtifactState;
  contentType?: string | null;
  sizeBytes?: number | null;
  retentionUntil?: string | null;
  metadata: Record<string, unknown>;
  version: number;
};

export type VideoMeetingDecision = {
  decision: string;
  ownerUserId?: number | null;
  status?: string | null;
  sourceTimestampSeconds?: number | null;
};

export type VideoMeetingFollowUpAction = {
  action: string;
  ownerUserId?: number | null;
  dueInDays?: number | null;
  status?: string | null;
  sourceTimestampSeconds?: number | null;
};

export type VideoMeetingCapabilities = {
  available: boolean;
  provider: string;
  unavailableReason?: string | null;
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  chat: boolean;
  reactions: boolean;
  handRaise: boolean;
  captions: boolean;
  recordingConfigured: boolean;
  transcriptConfigured: boolean;
  aiNotesConfigured: boolean;
  maximumParticipants?: number | null;
  participantList: boolean;
  tokenTtlSeconds: number;
  unmuteControl: 'REQUEST_ONLY';
};

export type VideoMeetingPerson = {
  userId: number;
  personPublicId?: string | null;
  emailAddress: string;
  displayName: string;
  jobTitle?: string | null;
  organizationName?: string | null;
};

export type VideoMeetingParticipant = {
  participantId: string;
  userId?: number | null;
  personPublicId?: string | null;
  emailAddress?: string | null;
  displayName: string;
  jobTitle?: string | null;
  organizationName?: string | null;
  participantRole: VideoMeetingRole;
  attendanceState: VideoMeetingAttendanceState;
  canSelfUnmute: boolean;
  joinRequestedAt?: string | null;
  admittedAt?: string | null;
  joinedAt?: string | null;
  leftAt?: string | null;
  version: number;
};

export type VideoMeetingSummary = {
  meetingId: string;
  meetingCode: string;
  title: string;
  description?: string | null;
  agenda?: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timeZone: string;
  accessScope: VideoMeetingAccessScope;
  waitingRoomEnabled: boolean;
  guestAccessEnabled: boolean;
  allowJoinBeforeHost: boolean;
  defaultMicrophoneEnabled: boolean;
  defaultCameraEnabled: boolean;
  lifecycleState: VideoMeetingLifecycleState;
  organizerUserId?: number | null;
  organizerName: string;
  attendeeCount: number;
  participantLimit?: number | null;
  myRole?: VideoMeetingRole | null;
  canHost: boolean;
  canModerate: boolean;
  provider?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  participants: VideoMeetingParticipant[];
  decisions: VideoMeetingDecision[];
  followUpActions: VideoMeetingFollowUpAction[];
  artifacts: VideoMeetingArtifact[];
  aiNotesAvailable: boolean;
  version: number;
};

export type VideoMeetingHome = {
  serverNow: string;
  timeZone: string;
  activeMeeting?: VideoMeetingSummary | null;
  nextMeeting?: VideoMeetingSummary | null;
  today: VideoMeetingSummary[];
  recent: VideoMeetingHistoryItem[];
  metrics: {
    meetingsToday: number;
    meetingMinutesToday: number;
    waitingForApproval: number;
    qualityScore?: number | null;
    averageJoinSeconds?: number | null;
  };
  capabilities: VideoMeetingCapabilities;
};

export type VideoMeetingHistoryItem = VideoMeetingSummary & {
  endedAt: string;
  actualDurationMinutes: number;
  participantPeak: number;
  averageQualityScore?: number | null;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
};

export type VideoMeetingPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ScheduleVideoMeetingInput = {
  title: string;
  agenda?: string | null;
  startsAt: string;
  durationMinutes: number;
  timeZone: string;
  participantUserIds: number[];
  accessScope: VideoMeetingAccessScope;
  waitingRoomEnabled: boolean;
  allowJoinBeforeHost: boolean;
  defaultMicrophoneEnabled: boolean;
  defaultCameraEnabled: boolean;
  idempotencyKey: string;
};

export type InstantVideoMeetingInput = Pick<
  ScheduleVideoMeetingInput,
  | 'title'
  | 'agenda'
  | 'participantUserIds'
  | 'accessScope'
  | 'waitingRoomEnabled'
  | 'defaultMicrophoneEnabled'
  | 'defaultCameraEnabled'
  | 'idempotencyKey'
>;

export type VideoMeetingCodeResolution = {
  meeting: VideoMeetingSummary;
  joinAllowed: boolean;
  requiresApproval: boolean;
  denialReason?: string | null;
};

export type VideoMeetingJoinRequest = {
  requestId: string;
  meetingId: string;
  state: VideoMeetingJoinState;
  displayName: string;
  requestedAt: string;
  decidedAt?: string | null;
  expiresAt: string;
};

export type VideoMeetingJoinCredential = {
  meetingId: string;
  sessionId: string;
  provider: string;
  serverUrl: string;
  participantToken: string;
  participantRole: VideoMeetingRole;
  expiresAt: string;
  effectivePermissions: VideoMeetingEffectivePermissions;
};

export type VideoMeetingEffectivePermissions = {
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
  participantList: boolean;
  chat: boolean;
  reactions: boolean;
  handRaise: boolean;
};

export type VideoMeetingLobbyParticipant = {
  requestId: string;
  userId?: number | null;
  displayName: string;
  email?: string | null;
  organizationName?: string | null;
  external: boolean;
  requestedAt: string;
  version: number;
};

export type VideoMeetingLobby = {
  waiting: VideoMeetingLobbyParticipant[];
  generatedAt: string;
};

export type VideoMeetingAdminPolicy = {
  meetingsEnabled: boolean;
  waitingRoomRequired: boolean;
  guestsAllowed: boolean;
  participantChatAllowed: boolean;
  reactionsAllowed: boolean;
  screenShareAllowed: boolean;
  unmuteControl: 'REQUEST_ONLY';
  recordingPolicy: 'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED';
  allowJoinBeforeHost: boolean;
  requireAuthenticatedInternalUsers: boolean;
  maximumParticipants: number;
  retentionDays: number;
  artifactRetentionDays: number;
  chatRetentionDays: number;
  recordingConfigured: boolean;
  aiNotesConfigured: boolean;
  version: number;
};

export type VideoMeetingAdminCapabilities = {
  video: boolean;
  screenShare: boolean;
  chat: boolean;
  captions: boolean;
  recordingConfigured: boolean;
  transcriptConfigured: boolean;
  aiNotesConfigured: boolean;
};

export type VideoMeetingAdminOverview = {
  liveMeetings: number;
  scheduledToday: number;
  waitingParticipants: number;
  meetingsLastSevenDays: number;
  averageQualityScore?: number | null;
  failedJoinAttempts: number;
  capabilities: VideoMeetingAdminCapabilities;
};

type WireCapability = {
  available: boolean;
  provider: string;
  unavailableReason?: string | null;
  audio: boolean;
  video: boolean;
  screenShare: boolean;
  participantList: boolean;
  chat: boolean;
  reactions: boolean;
  handRaise: boolean;
  captions: boolean;
  maximumParticipants: number;
  tokenTtlSeconds: number;
  unmuteControl: 'REQUEST_ONLY';
  recordingConfigured: boolean;
  transcriptConfigured: boolean;
  aiNotesConfigured: boolean;
};

type WireMeetingSummary = {
  meetingId: string;
  title: string;
  description?: string | null;
  agenda?: string | null;
  lifecycleState: VideoMeetingLifecycleState;
  accessScope: VideoMeetingAccessScope;
  meetingCode: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes: number;
  timeZone: string;
  organizerUserId: number;
  organizerName: string;
  waitingRoomEnabled: boolean;
  allowJoinBeforeHost: boolean;
  defaultMicrophoneEnabled: boolean;
  defaultCameraEnabled: boolean;
  attendeeCount: number;
  participantRole: VideoMeetingRole;
  canHost: boolean;
  canModerate: boolean;
  version: number;
};

type WireMeetingDetail = {
  meetingId: string;
  title: string;
  description?: string | null;
  agenda?: string | null;
  lifecycleState: VideoMeetingLifecycleState;
  accessScope: VideoMeetingAccessScope;
  meetingCode: string;
  startsAt?: string | null;
  endsAt?: string | null;
  durationMinutes: number;
  timeZone: string;
  waitingRoomEnabled: boolean;
  guestAccessEnabled: boolean;
  provider?: string | null;
  organizerUserId: number;
  organizerName: string;
  participantRole: VideoMeetingRole;
  canHost: boolean;
  canModerate: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  decisions?: unknown;
  followUpActions?: unknown;
  participants: VideoMeetingParticipant[];
  artifacts?: Array<{
    artifactId: string;
    artifactType: string;
    artifactState: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    retentionUntil?: string | null;
    metadata?: unknown;
    version: number;
  }>;
  version: number;
  allowJoinBeforeHost: boolean;
  defaultMicrophoneEnabled: boolean;
  defaultCameraEnabled: boolean;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
  aiNotesAvailable: boolean;
};

type WireHome = {
  serverNow: string;
  timeZone: string;
  capabilities: WireCapability;
  activeMeeting?: WireMeetingSummary | null;
  nextMeeting?: WireMeetingSummary | null;
  today: WireMeetingSummary[];
  recent: WireMeetingSummary[];
  metrics: {
    meetingsToday: number;
    meetingMinutesToday: number;
    waitingForApproval: number;
    qualityScore?: number | null;
    averageJoinSeconds?: number | null;
  };
};

type WireMeetingPage = {
  items: WireMeetingSummary[];
  page?: number;
  pageSize?: number;
  total?: number;
};

type WireCreated = { meeting: WireMeetingDetail; meetingCode: string };
type WireJoinCodeResolution = {
  meeting: WireMeetingSummary;
  joinAllowed: boolean;
  denialReason?: string | null;
  waitingRoomRequired: boolean;
};
type WireHistoryItem = {
  meetingId: string;
  title: string;
  endedAt: string;
  actualDurationMinutes: number;
  participantPeak: number;
  averageQualityScore?: number | null;
  recordingAvailable: boolean;
  transcriptAvailable: boolean;
};
type WireJoinRequest = {
  requestId: string;
  state: VideoMeetingJoinState;
  displayName: string;
  email?: string | null;
  organizationName?: string | null;
  external: boolean;
  requestedAt: string;
  version: number;
};
type WireLobby = { waiting: WireJoinRequest[] };
type WirePolicy = VideoMeetingAdminPolicy;

function meetingPath(meetingId: string, suffix = ''): string {
  const path = `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
  return suffix ? `${path}/${suffix}` : path;
}

function idempotencyConfig(idempotencyKey: string) {
  const normalizedKey = idempotencyKey.trim();
  if (
    normalizedKey.length < 8 ||
    normalizedKey.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(normalizedKey)
  ) {
    throw new Error('Video meeting commands require a valid idempotency key.');
  }
  return { headers: { 'Idempotency-Key': normalizedKey } };
}

function fallbackDate(value?: string | null): string {
  return value ?? new Date().toISOString();
}

function normalizeSummary(summary: WireMeetingSummary): VideoMeetingSummary {
  const startsAt = fallbackDate(summary.startsAt);
  const endsAt = summary.endsAt ?? startsAt;
  return {
    meetingId: summary.meetingId,
    meetingCode: summary.meetingCode,
    title: summary.title,
    description: summary.description,
    agenda: summary.agenda,
    startsAt,
    endsAt,
    durationMinutes: summary.durationMinutes,
    timeZone: summary.timeZone,
    accessScope: summary.accessScope,
    waitingRoomEnabled: summary.waitingRoomEnabled,
    guestAccessEnabled: summary.accessScope === 'PUBLIC_CODE',
    allowJoinBeforeHost: summary.allowJoinBeforeHost,
    defaultMicrophoneEnabled: summary.defaultMicrophoneEnabled,
    defaultCameraEnabled: summary.defaultCameraEnabled,
    lifecycleState: summary.lifecycleState,
    organizerUserId: summary.organizerUserId,
    organizerName: summary.organizerName,
    attendeeCount: summary.attendeeCount,
    myRole: summary.participantRole,
    canHost: summary.canHost,
    canModerate: summary.canModerate,
    participants: [],
    decisions: [],
    followUpActions: [],
    artifacts: [],
    aiNotesAvailable: false,
    version: summary.version,
  };
}

const ARTIFACT_TYPES = new Set<VideoMeetingArtifactType>([
  'RECORDING',
  'TRANSCRIPT',
  'SUMMARY',
  'ATTENDANCE',
  'CHAT_EXPORT',
]);
const ARTIFACT_STATES = new Set<VideoMeetingArtifactState>([
  'NONE',
  'PROCESSING',
  'AVAILABLE',
  'UNAVAILABLE',
  'FAILED',
  'DELETED',
]);

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeDecisions(value: unknown): VideoMeetingDecision[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = recordValue(item);
    if (typeof candidate.decision !== 'string' || !candidate.decision.trim()) return [];
    return [
      {
        decision: candidate.decision.trim(),
        ownerUserId: typeof candidate.ownerUserId === 'number' ? candidate.ownerUserId : null,
        status: typeof candidate.status === 'string' ? candidate.status : null,
        sourceTimestampSeconds:
          typeof candidate.sourceTimestampSeconds === 'number'
            ? candidate.sourceTimestampSeconds
            : null,
      },
    ];
  });
}

function normalizeFollowUpActions(value: unknown): VideoMeetingFollowUpAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = recordValue(item);
    if (typeof candidate.action !== 'string' || !candidate.action.trim()) return [];
    return [
      {
        action: candidate.action.trim(),
        ownerUserId: typeof candidate.ownerUserId === 'number' ? candidate.ownerUserId : null,
        dueInDays: typeof candidate.dueInDays === 'number' ? candidate.dueInDays : null,
        status: typeof candidate.status === 'string' ? candidate.status : null,
        sourceTimestampSeconds:
          typeof candidate.sourceTimestampSeconds === 'number'
            ? candidate.sourceTimestampSeconds
            : null,
      },
    ];
  });
}

function normalizeArtifacts(value: WireMeetingDetail['artifacts']): VideoMeetingArtifact[] {
  if (!value) return [];
  return value.flatMap((artifact) => {
    if (
      !ARTIFACT_TYPES.has(artifact.artifactType as VideoMeetingArtifactType) ||
      !ARTIFACT_STATES.has(artifact.artifactState as VideoMeetingArtifactState)
    ) {
      return [];
    }
    return [
      {
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType as VideoMeetingArtifactType,
        artifactState: artifact.artifactState as VideoMeetingArtifactState,
        contentType: artifact.contentType,
        sizeBytes: artifact.sizeBytes,
        retentionUntil: artifact.retentionUntil,
        metadata: recordValue(artifact.metadata),
        version: artifact.version,
      },
    ];
  });
}

function normalizeDetail(detail: WireMeetingDetail): VideoMeetingSummary {
  const startsAt = fallbackDate(detail.startsAt ?? detail.startedAt);
  const endsAt = detail.endsAt ?? detail.endedAt ?? startsAt;
  return {
    meetingId: detail.meetingId,
    meetingCode: detail.meetingCode,
    title: detail.title,
    description: detail.description,
    agenda: detail.agenda,
    startsAt,
    endsAt,
    durationMinutes: detail.durationMinutes,
    timeZone: detail.timeZone,
    accessScope: detail.accessScope,
    waitingRoomEnabled: detail.waitingRoomEnabled,
    guestAccessEnabled: detail.guestAccessEnabled,
    allowJoinBeforeHost: detail.allowJoinBeforeHost,
    defaultMicrophoneEnabled: detail.defaultMicrophoneEnabled,
    defaultCameraEnabled: detail.defaultCameraEnabled,
    lifecycleState: detail.lifecycleState,
    organizerUserId: detail.organizerUserId,
    organizerName: detail.organizerName,
    attendeeCount: detail.participants.length,
    myRole: detail.participantRole,
    canHost: detail.canHost,
    canModerate: detail.canModerate,
    provider: detail.provider,
    startedAt: detail.startedAt,
    endedAt: detail.endedAt,
    participants: detail.participants,
    decisions: normalizeDecisions(detail.decisions),
    followUpActions: normalizeFollowUpActions(detail.followUpActions),
    artifacts: normalizeArtifacts(detail.artifacts),
    aiNotesAvailable: detail.aiNotesAvailable,
    version: detail.version,
  };
}

function normalizeCapability(capability: WireCapability): VideoMeetingCapabilities {
  return {
    ...capability,
    reactions: Boolean(capability.reactions),
    handRaise: Boolean(capability.handRaise),
    maximumParticipants: capability.maximumParticipants ?? null,
  };
}

function normalizeHistory(item: WireHistoryItem): VideoMeetingHistoryItem {
  const endsAt = fallbackDate(item.endedAt);
  return {
    meetingId: item.meetingId,
    meetingCode: '',
    title: item.title,
    startsAt: endsAt,
    endsAt,
    durationMinutes: item.actualDurationMinutes,
    timeZone: '',
    accessScope: 'INVITED',
    waitingRoomEnabled: false,
    guestAccessEnabled: false,
    allowJoinBeforeHost: false,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    lifecycleState: 'ENDED',
    organizerName: '',
    attendeeCount: item.participantPeak,
    myRole: null,
    canHost: false,
    canModerate: false,
    participants: [],
    decisions: [],
    followUpActions: [],
    artifacts: [],
    aiNotesAvailable: false,
    version: 0,
    endedAt: endsAt,
    actualDurationMinutes: item.actualDurationMinutes,
    participantPeak: item.participantPeak,
    averageQualityScore: item.averageQualityScore,
    recordingAvailable: item.recordingAvailable,
    transcriptAvailable: item.transcriptAvailable,
  };
}

function normalizeJoinRequest(
  meetingId: string,
  request: WireJoinRequest
): VideoMeetingJoinRequest {
  const requestedAt = request.requestedAt;
  return {
    requestId: request.requestId,
    meetingId,
    state: request.state,
    displayName: request.displayName,
    requestedAt,
    decidedAt: request.state === 'WAITING' ? null : new Date().toISOString(),
    expiresAt: new Date(Date.parse(requestedAt) + 10 * 60_000).toISOString(),
  };
}

const VIDEO_MEETING_CODE_CHARACTER_PATTERN = /[A-HJ-NP-Z2-9]/u;

export function normalizeVideoMeetingCode(value: string): string {
  return Array.from(value.toUpperCase())
    .filter((character) => VIDEO_MEETING_CODE_CHARACTER_PATTERN.test(character))
    .join('')
    .slice(0, 16);
}

export function isTrustedVideoMeetingServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'wss:') return true;
    return (
      url.protocol === 'ws:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export async function getVideoMeetingCapabilities(): Promise<VideoMeetingCapabilities> {
  const response = await axiosInstance.get<ApiResponse<WireCapability>>(
    `${VIDEO_MEETING_API_BASE}/capabilities`
  );
  return normalizeCapability(response.data.data);
}

export async function searchVideoMeetingPeople(
  query: string,
  limit = 20
): Promise<VideoMeetingPerson[]> {
  const search = new URLSearchParams({
    q: query.trim(),
    limit: String(Math.max(1, Math.min(50, limit))),
  });
  const response = await axiosInstance.get<ApiResponse<VideoMeetingPerson[]>>(
    `${VIDEO_MEETING_API_BASE}/people?${search.toString()}`
  );
  return response.data.data;
}

export async function getVideoMeetingHome(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
): Promise<VideoMeetingHome> {
  const response = await axiosInstance.get<ApiResponse<WireHome>>(
    `${VIDEO_MEETING_API_BASE}/home?timeZone=${encodeURIComponent(timeZone)}`
  );
  const home = response.data.data;
  return {
    serverNow: home.serverNow,
    timeZone: home.timeZone,
    activeMeeting: home.activeMeeting ? normalizeSummary(home.activeMeeting) : null,
    nextMeeting: home.nextMeeting ? normalizeSummary(home.nextMeeting) : null,
    today: home.today.map(normalizeSummary),
    recent: home.recent.map((item) => {
      const summary = normalizeSummary(item);
      return {
        ...summary,
        endedAt: summary.endsAt,
        actualDurationMinutes: summary.durationMinutes,
        participantPeak: summary.attendeeCount,
        averageQualityScore: null,
        recordingAvailable: false,
        transcriptAvailable: false,
      };
    }),
    metrics: home.metrics,
    capabilities: normalizeCapability(home.capabilities),
  };
}

export async function getVideoMeetings(
  page = 0,
  pageSize = 30
): Promise<VideoMeetingPage<VideoMeetingSummary>> {
  const response = await axiosInstance.get<ApiResponse<WireMeetingPage>>(
    `${VIDEO_MEETING_API_BASE}/meetings?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`
  );
  const result = response.data.data;
  return {
    items: result.items.map(normalizeSummary),
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
    total: result.total ?? result.items.length,
  };
}

export async function getVideoMeetingHistory(
  page = 0,
  pageSize = 30
): Promise<VideoMeetingPage<VideoMeetingHistoryItem>> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingPage<WireHistoryItem>>>(
    `${VIDEO_MEETING_API_BASE}/history?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`
  );
  const result = response.data.data;
  return {
    items: result.items.map(normalizeHistory),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  };
}

export async function getVideoMeeting(meetingId: string): Promise<VideoMeetingSummary> {
  const response = await axiosInstance.get<ApiResponse<WireMeetingDetail>>(meetingPath(meetingId));
  return normalizeDetail(response.data.data);
}

export async function createInstantVideoMeeting(
  input: InstantVideoMeetingInput
): Promise<VideoMeetingSummary> {
  const response = await axiosInstance.post<ApiResponse<WireCreated>, Record<string, unknown>>(
    `${VIDEO_MEETING_API_BASE}/meetings/instant`,
    {
      title: input.title,
      description: null,
      agenda: input.agenda,
      accessScope: input.accessScope,
      waitingRoomEnabled: input.waitingRoomEnabled,
      guestAccessEnabled: input.accessScope === 'PUBLIC_CODE',
      allowJoinBeforeHost: false,
      defaultMicrophoneEnabled: input.defaultMicrophoneEnabled,
      defaultCameraEnabled: input.defaultCameraEnabled,
      participantUserIds: input.participantUserIds,
      guestInvitees: [],
    },
    idempotencyConfig(input.idempotencyKey)
  );
  return normalizeDetail(response.data.data.meeting);
}

export async function scheduleVideoMeeting(
  input: ScheduleVideoMeetingInput
): Promise<VideoMeetingSummary> {
  const response = await axiosInstance.post<ApiResponse<WireCreated>, Record<string, unknown>>(
    `${VIDEO_MEETING_API_BASE}/meetings`,
    {
      title: input.title,
      description: null,
      agenda: input.agenda,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      timeZone: input.timeZone,
      accessScope: input.accessScope,
      waitingRoomEnabled: input.waitingRoomEnabled,
      guestAccessEnabled: input.accessScope === 'PUBLIC_CODE',
      allowJoinBeforeHost: input.allowJoinBeforeHost,
      defaultMicrophoneEnabled: input.defaultMicrophoneEnabled,
      defaultCameraEnabled: input.defaultCameraEnabled,
      participantUserIds: input.participantUserIds,
      guestInvitees: [],
    },
    idempotencyConfig(input.idempotencyKey)
  );
  return normalizeDetail(response.data.data.meeting);
}

export async function resolveVideoMeetingCode(code: string): Promise<VideoMeetingCodeResolution> {
  const normalizedCode = normalizeVideoMeetingCode(code);
  if (normalizedCode.length < 10) {
    throw new Error('Video meeting codes must contain 10 to 16 canonical characters.');
  }
  const response = await axiosInstance.get<ApiResponse<WireJoinCodeResolution>>(
    `${VIDEO_MEETING_API_BASE}/join-codes/${encodeURIComponent(normalizedCode)}`
  );
  const resolution = response.data.data;
  return {
    meeting: normalizeSummary(resolution.meeting),
    joinAllowed: resolution.joinAllowed,
    requiresApproval: resolution.waitingRoomRequired,
    denialReason: resolution.denialReason,
  };
}

export async function requestVideoMeetingJoin(
  meetingId: string,
  input: { displayName: string; idempotencyKey: string }
): Promise<VideoMeetingJoinRequest> {
  const response = await axiosInstance.post<ApiResponse<WireJoinRequest>, { displayName: string }>(
    meetingPath(meetingId, 'join-requests'),
    { displayName: input.displayName },
    idempotencyConfig(input.idempotencyKey)
  );
  return normalizeJoinRequest(meetingId, response.data.data);
}

export async function getVideoMeetingJoinRequest(
  meetingId: string,
  requestId: string
): Promise<VideoMeetingJoinRequest> {
  const response = await axiosInstance.get<ApiResponse<WireJoinRequest>>(
    meetingPath(meetingId, `join-requests/${encodeURIComponent(requestId)}`)
  );
  return normalizeJoinRequest(meetingId, response.data.data);
}

export async function startVideoMeeting(
  meetingId: string,
  expectedVersion: number
): Promise<VideoMeetingSummary> {
  const response = await axiosInstance.post<
    ApiResponse<WireMeetingDetail>,
    { expectedVersion: number }
  >(meetingPath(meetingId, 'start'), { expectedVersion }, idempotencyConfig(crypto.randomUUID()));
  return normalizeDetail(response.data.data);
}

export async function issueVideoMeetingToken(
  meetingId: string,
  input: { joinRequestId?: string | null }
): Promise<VideoMeetingJoinCredential> {
  const response = await axiosInstance.post<
    ApiResponse<{
      meetingId: string;
      sessionId: string;
      provider: string;
      serverUrl: string;
      participantToken: string;
      participantRole: VideoMeetingRole;
      expiresAt: string;
      effectivePermissions?: Partial<VideoMeetingEffectivePermissions> | null;
    }>,
    { joinRequestId?: string | null }
  >(meetingPath(meetingId, 'token'), input);
  const credential = response.data.data;
  if (!isTrustedVideoMeetingServerUrl(credential.serverUrl)) {
    throw new Error('The meeting provider returned an untrusted realtime endpoint.');
  }
  return {
    ...credential,
    effectivePermissions: {
      microphone: credential.effectivePermissions?.microphone === true,
      camera: credential.effectivePermissions?.camera === true,
      screenShare: credential.effectivePermissions?.screenShare === true,
      participantList: credential.effectivePermissions?.participantList === true,
      chat: credential.effectivePermissions?.chat === true,
      reactions: credential.effectivePermissions?.reactions === true,
      handRaise: credential.effectivePermissions?.handRaise === true,
    },
  };
}

export async function confirmVideoMeetingConnected(
  meetingId: string
): Promise<VideoMeetingParticipant> {
  const response = await axiosInstance.post<ApiResponse<VideoMeetingParticipant>, undefined>(
    meetingPath(meetingId, 'connected'),
    undefined
  );
  return response.data.data;
}

export async function endVideoMeeting(
  meetingId: string,
  expectedVersion: number
): Promise<VideoMeetingSummary> {
  const response = await axiosInstance.post<
    ApiResponse<WireMeetingDetail>,
    { expectedVersion: number }
  >(meetingPath(meetingId, 'end'), { expectedVersion }, idempotencyConfig(crypto.randomUUID()));
  return normalizeDetail(response.data.data);
}

export async function getVideoMeetingLobby(meetingId: string): Promise<VideoMeetingLobby> {
  const response = await axiosInstance.get<ApiResponse<WireLobby>>(meetingPath(meetingId, 'lobby'));
  return {
    waiting: response.data.data.waiting,
    generatedAt: new Date().toISOString(),
  };
}

export async function decideVideoMeetingLobbyRequest(
  meetingId: string,
  requestId: string,
  expectedVersion: number,
  decision: 'APPROVE' | 'DENY'
): Promise<void> {
  const action = decision === 'APPROVE' ? 'admit' : 'deny';
  await axiosInstance.post<ApiResponse<WireJoinRequest>, { expectedVersion: number }>(
    meetingPath(meetingId, `join-requests/${encodeURIComponent(requestId)}/${action}`),
    { expectedVersion },
    idempotencyConfig(crypto.randomUUID())
  );
}

export async function getVideoMeetingAdminPolicy(): Promise<VideoMeetingAdminPolicy> {
  const response = await axiosInstance.get<ApiResponse<WirePolicy>>(
    `${VIDEO_MEETING_API_BASE}/admin/policy`
  );
  return response.data.data;
}

export async function getVideoMeetingAdminOverview(): Promise<VideoMeetingAdminOverview> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await axiosInstance.get<ApiResponse<VideoMeetingAdminOverview>>(
    `${VIDEO_MEETING_API_BASE}/admin/overview?timeZone=${encodeURIComponent(timeZone)}`
  );
  return response.data.data;
}

export async function updateVideoMeetingAdminPolicy(
  policy: VideoMeetingAdminPolicy
): Promise<VideoMeetingAdminPolicy> {
  const response = await axiosInstance.put<ApiResponse<WirePolicy>, Record<string, unknown>>(
    `${VIDEO_MEETING_API_BASE}/admin/policy`,
    {
      meetingsEnabled: policy.meetingsEnabled,
      waitingRoomRequired: policy.waitingRoomRequired,
      guestsAllowed: policy.guestsAllowed,
      participantChatAllowed: policy.participantChatAllowed,
      reactionsAllowed: policy.reactionsAllowed,
      screenShareAllowed: policy.screenShareAllowed,
      recordingPolicy: policy.recordingPolicy,
      allowJoinBeforeHost: policy.allowJoinBeforeHost,
      requireAuthenticatedInternalUsers: policy.requireAuthenticatedInternalUsers,
      maximumParticipants: policy.maximumParticipants,
      retentionDays: policy.retentionDays,
      artifactRetentionDays: policy.artifactRetentionDays,
      chatRetentionDays: policy.chatRetentionDays,
      expectedVersion: policy.version,
    },
    idempotencyConfig(crypto.randomUUID())
  );
  return response.data.data;
}
