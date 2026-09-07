import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingAgendaInput = {
  itemId?: string | null;
  title: string;
  objective?: string | null;
  ownerUserId?: number | null;
  plannedMinutes?: number | null;
};
export type VideoMeetingPreparationSource = {
  agendaItems?: VideoMeetingAgendaInput[];
  sourceTemplateId?: string;
  sourceTemplateVersion?: number;
};
export type VideoMeetingInvitationResponse = {
  participantId: string;
  displayName: string;
  response: 'PENDING' | 'ACCEPTED' | 'TENTATIVE' | 'DECLINED';
  invitationRevision: number;
  respondedAt: string | null;
  version: number;
  mine: boolean;
};
export type VideoMeetingPreparationMaterial = {
  materialId: string;
  displayName: string;
  contentType: string;
  referenceProvider: 'DWP_FILES' | 'SHAREPOINT' | 'CONFLUENCE';
  opaqueReference: string | null;
  sourceVersion: string | null;
  classification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  sizeBytes: number | null;
  contentSha256: string | null;
  retentionUntil: string;
  accessVerificationState: 'PENDING_REVALIDATION';
  version: number;
};
export type RegisterVideoMeetingMaterialInput = {
  displayName: string;
  contentType: string;
  referenceProvider: VideoMeetingPreparationMaterial['referenceProvider'];
  opaqueReference: string;
  sourceVersion?: string | null;
  classification: VideoMeetingPreparationMaterial['classification'];
  sizeBytes?: number | null;
  contentSha256?: string | null;
};
export type VideoMeetingMaterialAccessTicket = {
  meetingId: string;
  materialId: string;
  materialVersion: number;
  accessUrl: string;
  expiresAt: string;
  contentType: string;
  displayName: string;
};
export type VideoMeetingMyPreparation = {
  agendaVersion: number;
  version: number;
  preparedAgendaItemIds: string[];
  updatedAt: string | null;
};
export type VideoMeetingPreparation = {
  meetingId: string;
  meetingVersion: number;
  agendaVersion: number;
  materialsVersion: number;
  invitationRevision: number;
  agendaItems: (VideoMeetingAgendaInput & {
    itemId: string;
    position: number;
    ownerDisplayName: string | null;
  })[];
  materials: VideoMeetingPreparationMaterial[];
  myResponse: VideoMeetingInvitationResponse | null;
  invitationResponses: VideoMeetingInvitationResponse[];
  invitationCounts: { accepted: number; tentative: number; declined: number; pending: number };
  myPreparation: VideoMeetingMyPreparation;
  canEditAgenda: boolean;
  canManageMaterials: boolean;
  canRespond: boolean;
  canPrepare: boolean;
  observedAt: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const sha256 = /^[0-9a-f]{64}$/u;
const contentType = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/u;
const opaqueReference = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u;
const sourceVersion = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;
const invitationStates = new Set(['PENDING', 'ACCEPTED', 'TENTATIVE', 'DECLINED']);
const referenceProviders = new Set(['DWP_FILES', 'SHAREPOINT', 'CONFLUENCE']);
const classifications = new Set(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function validVersion(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid preparation version');
  return value;
}
function version(value: unknown) {
  return validVersion(value as number);
}
function timestamp(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value)))
    throw new Error(message);
  return value;
}
function nullableText(value: unknown, maximum: number, message: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maximum) throw new Error(message);
  return value;
}
function path(meetingId: string) {
  if (!uuid.test(meetingId)) throw new Error('Invalid meeting reference');
  return `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}`;
}
function command(key: string) {
  if (!uuid.test(key)) throw new Error('A stable UUID idempotency key is required');
  return { headers: { 'Idempotency-Key': key } };
}

function parsedAgendaItem(value: unknown, position: number) {
  const candidate = record(value, 'Invalid preparation agenda');
  if (
    typeof candidate.itemId !== 'string' ||
    !uuid.test(candidate.itemId) ||
    candidate.position !== position ||
    typeof candidate.title !== 'string' ||
    !candidate.title.trim() ||
    candidate.title.length > 240 ||
    (candidate.ownerUserId !== null &&
      (!Number.isSafeInteger(candidate.ownerUserId) || (candidate.ownerUserId as number) <= 0)) ||
    (candidate.plannedMinutes !== null &&
      (!Number.isInteger(candidate.plannedMinutes) ||
        (candidate.plannedMinutes as number) < 1 ||
        (candidate.plannedMinutes as number) > 1440))
  )
    throw new Error('Invalid preparation agenda');
  return {
    itemId: candidate.itemId,
    position,
    title: candidate.title,
    objective: nullableText(candidate.objective, 2000, 'Invalid preparation agenda'),
    ownerUserId: candidate.ownerUserId as number | null,
    ownerDisplayName: nullableText(candidate.ownerDisplayName, 160, 'Invalid preparation agenda'),
    plannedMinutes: candidate.plannedMinutes as number | null,
  };
}

function parsedMaterial(value: unknown) {
  const candidate = record(value, 'Invalid preparation material');
  if (
    typeof candidate.materialId !== 'string' ||
    !uuid.test(candidate.materialId) ||
    typeof candidate.displayName !== 'string' ||
    !candidate.displayName ||
    candidate.displayName.length > 240 ||
    typeof candidate.contentType !== 'string' ||
    !contentType.test(candidate.contentType) ||
    !referenceProviders.has(String(candidate.referenceProvider)) ||
    (candidate.opaqueReference !== null &&
      (typeof candidate.opaqueReference !== 'string' ||
        !opaqueReference.test(candidate.opaqueReference))) ||
    (candidate.sourceVersion !== null &&
      (typeof candidate.sourceVersion !== 'string' ||
        !sourceVersion.test(candidate.sourceVersion))) ||
    !classifications.has(String(candidate.classification)) ||
    (candidate.sizeBytes !== null &&
      (!Number.isSafeInteger(candidate.sizeBytes) ||
        (candidate.sizeBytes as number) < 0 ||
        (candidate.sizeBytes as number) > 10_737_418_240)) ||
    (candidate.contentSha256 !== null &&
      (typeof candidate.contentSha256 !== 'string' || !sha256.test(candidate.contentSha256))) ||
    candidate.accessVerificationState !== 'PENDING_REVALIDATION'
  )
    throw new Error('Invalid preparation material');
  return {
    materialId: candidate.materialId,
    displayName: candidate.displayName,
    contentType: candidate.contentType,
    referenceProvider:
      candidate.referenceProvider as VideoMeetingPreparationMaterial['referenceProvider'],
    opaqueReference: candidate.opaqueReference as string | null,
    sourceVersion: candidate.sourceVersion as string | null,
    classification: candidate.classification as VideoMeetingPreparationMaterial['classification'],
    sizeBytes: candidate.sizeBytes as number | null,
    contentSha256: candidate.contentSha256 as string | null,
    retentionUntil: timestamp(candidate.retentionUntil, 'Invalid preparation material'),
    accessVerificationState: 'PENDING_REVALIDATION' as const,
    version: version(candidate.version),
  };
}

function parsedInvitation(value: unknown): VideoMeetingInvitationResponse {
  const candidate = record(value, 'Invalid preparation invitation');
  if (
    typeof candidate.participantId !== 'string' ||
    !uuid.test(candidate.participantId) ||
    typeof candidate.displayName !== 'string' ||
    !candidate.displayName ||
    candidate.displayName.length > 160 ||
    !invitationStates.has(String(candidate.response)) ||
    !Number.isSafeInteger(candidate.invitationRevision) ||
    (candidate.invitationRevision as number) < 1 ||
    typeof candidate.mine !== 'boolean'
  )
    throw new Error('Invalid preparation invitation');
  const respondedAt =
    candidate.respondedAt === null
      ? null
      : timestamp(candidate.respondedAt, 'Invalid preparation invitation');
  if ((candidate.response === 'PENDING') !== (respondedAt === null))
    throw new Error('Invalid preparation invitation');
  return {
    participantId: candidate.participantId,
    displayName: candidate.displayName,
    response: candidate.response as VideoMeetingInvitationResponse['response'],
    invitationRevision: candidate.invitationRevision as number,
    respondedAt,
    version: version(candidate.version),
    mine: candidate.mine,
  };
}

function parsedMyPreparation(
  value: unknown,
  agendaVersion: number,
  agendaIds: ReadonlySet<string>
): VideoMeetingMyPreparation {
  const candidate = record(value, 'Invalid personal preparation');
  if (
    version(candidate.agendaVersion) !== agendaVersion ||
    !Array.isArray(candidate.preparedAgendaItemIds) ||
    candidate.preparedAgendaItemIds.length > 50
  )
    throw new Error('Invalid personal preparation');
  const ids = candidate.preparedAgendaItemIds.map((itemId) => {
    if (typeof itemId !== 'string' || !uuid.test(itemId) || !agendaIds.has(itemId))
      throw new Error('Invalid personal preparation');
    return itemId;
  });
  if (
    new Set(ids).size !== ids.length ||
    ids.some((itemId, index) => index > 0 && ids[index - 1]!.localeCompare(itemId) >= 0)
  )
    throw new Error('Invalid personal preparation');
  const currentVersion = version(candidate.version);
  const updatedAt =
    candidate.updatedAt === null
      ? null
      : timestamp(candidate.updatedAt, 'Invalid personal preparation');
  if (
    (currentVersion === 0 && (updatedAt !== null || ids.length !== 0)) ||
    (currentVersion > 0 && updatedAt === null)
  )
    throw new Error('Invalid personal preparation');
  return { agendaVersion, version: currentVersion, preparedAgendaItemIds: ids, updatedAt };
}

function bound(result: unknown, meetingId: string): VideoMeetingPreparation {
  const candidate = record(result, 'Invalid preparation binding');
  if (
    candidate.meetingId !== meetingId ||
    !Array.isArray(candidate.agendaItems) ||
    candidate.agendaItems.length > 50 ||
    !Array.isArray(candidate.materials) ||
    !Array.isArray(candidate.invitationResponses) ||
    typeof candidate.canEditAgenda !== 'boolean' ||
    typeof candidate.canManageMaterials !== 'boolean' ||
    typeof candidate.canRespond !== 'boolean' ||
    typeof candidate.canPrepare !== 'boolean'
  )
    throw new Error('Invalid preparation binding');
  const meetingVersion = version(candidate.meetingVersion);
  const agendaVersion = version(candidate.agendaVersion);
  const materialsVersion = version(candidate.materialsVersion);
  const invitationRevision = version(candidate.invitationRevision);
  if (invitationRevision < 1) throw new Error('Invalid preparation binding');
  const observedAt = timestamp(candidate.observedAt, 'Invalid preparation observation');
  const agendaItems = candidate.agendaItems.map(parsedAgendaItem);
  const agendaIds = new Set(agendaItems.map(({ itemId }) => itemId));
  if (agendaIds.size !== agendaItems.length) throw new Error('Invalid preparation agenda');
  const materials = candidate.materials.map(parsedMaterial);
  if (
    new Set(materials.map(({ materialId }) => materialId)).size !== materials.length ||
    materials.some(({ retentionUntil }) => Date.parse(retentionUntil) <= Date.parse(observedAt))
  )
    throw new Error('Invalid preparation material');
  const invitationResponses = candidate.invitationResponses.map(parsedInvitation);
  if (
    new Set(invitationResponses.map(({ participantId }) => participantId)).size !==
      invitationResponses.length ||
    invitationResponses.filter(({ mine }) => mine).length > 1
  )
    throw new Error('Invalid preparation invitation');
  const myResponse = candidate.myResponse === null ? null : parsedInvitation(candidate.myResponse);
  const projectedMine = invitationResponses.find(({ mine }) => mine) ?? null;
  if (JSON.stringify(myResponse) !== JSON.stringify(projectedMine))
    throw new Error('Invalid preparation invitation binding');
  const counts = record(candidate.invitationCounts, 'Invalid preparation invitation counts');
  const invitationCounts = {
    accepted: version(counts.accepted),
    tentative: version(counts.tentative),
    declined: version(counts.declined),
    pending: version(counts.pending),
  };
  if (
    Object.values(invitationCounts).reduce((sum, count) => sum + count, 0) !==
    invitationResponses.length
  )
    throw new Error('Invalid preparation invitation counts');
  return {
    meetingId,
    meetingVersion,
    agendaVersion,
    materialsVersion,
    invitationRevision,
    agendaItems,
    materials,
    myResponse,
    invitationResponses,
    invitationCounts,
    myPreparation: parsedMyPreparation(candidate.myPreparation, agendaVersion, agendaIds),
    canEditAgenda: candidate.canEditAgenda,
    canManageMaterials: candidate.canManageMaterials,
    canRespond: candidate.canRespond,
    canPrepare: candidate.canPrepare,
    observedAt,
  };
}
function agendaItems(items: VideoMeetingAgendaInput[], creating: boolean) {
  if (!Array.isArray(items) || items.length > 50) throw new Error('Invalid agenda items');
  const seen = new Set<string>();
  return items.map((item) => {
    if (
      !item ||
      typeof item.title !== 'string' ||
      !item.title.trim() ||
      item.title.trim().length > 240 ||
      (item.objective != null &&
        (typeof item.objective !== 'string' || item.objective.trim().length > 2000)) ||
      (item.ownerUserId != null &&
        (!Number.isSafeInteger(item.ownerUserId) || item.ownerUserId <= 0)) ||
      (item.plannedMinutes != null &&
        (!Number.isInteger(item.plannedMinutes) ||
          item.plannedMinutes < 1 ||
          item.plannedMinutes > 1440)) ||
      (item.itemId != null && (creating || !uuid.test(item.itemId) || seen.has(item.itemId)))
    )
      throw new Error('Invalid agenda item');
    if (item.itemId) seen.add(item.itemId);
    return {
      ...(item.itemId ? { itemId: item.itemId } : {}),
      title: item.title.trim(),
      objective: item.objective?.trim() || null,
      ownerUserId: item.ownerUserId ?? null,
      plannedMinutes: item.plannedMinutes ?? null,
    };
  });
}

function material(input: RegisterVideoMeetingMaterialInput) {
  const displayName = input.displayName?.trim();
  const contentType = input.contentType?.trim().toLowerCase();
  const opaqueReference = input.opaqueReference?.trim();
  const sourceVersion = input.sourceVersion?.trim() || null;
  const contentSha256 = input.contentSha256?.trim() || null;
  if (
    !displayName ||
    displayName.length > 240 ||
    !contentType?.match(/^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/u) ||
    !['DWP_FILES', 'SHAREPOINT', 'CONFLUENCE'].includes(input.referenceProvider) ||
    !opaqueReference?.match(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/u) ||
    (sourceVersion !== null && !sourceVersion.match(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u)) ||
    !['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(input.classification) ||
    (input.sizeBytes != null &&
      (!Number.isSafeInteger(input.sizeBytes) ||
        input.sizeBytes < 0 ||
        input.sizeBytes > 10_737_418_240)) ||
    (contentSha256 !== null && !contentSha256.match(/^[0-9a-f]{64}$/u))
  )
    throw new Error('Invalid governed meeting material reference');
  return {
    displayName,
    contentType,
    referenceProvider: input.referenceProvider,
    opaqueReference,
    sourceVersion,
    classification: input.classification,
    sizeBytes: input.sizeBytes ?? null,
    contentSha256,
  };
}

/** Optional fields are omitted for existing clients; no old identity or content credentials transfer. */
export function serializeVideoMeetingPreparationSource(input: VideoMeetingPreparationSource) {
  const hasId = input.sourceTemplateId !== undefined;
  const hasVersion = input.sourceTemplateVersion !== undefined;
  if (hasId !== hasVersion || (hasId && !uuid.test(input.sourceTemplateId!)))
    throw new Error('Invalid template source binding');
  return {
    ...(input.agendaItems !== undefined
      ? { agendaItems: agendaItems(input.agendaItems, true) }
      : {}),
    ...(hasId
      ? {
          sourceTemplateId: input.sourceTemplateId,
          sourceTemplateVersion: validVersion(input.sourceTemplateVersion!),
        }
      : {}),
  };
}

export async function getVideoMeetingPreparation(meetingId: string, signal?: AbortSignal) {
  const result = (
    await axiosInstance.get<ApiResponse<VideoMeetingPreparation>>(
      path(meetingId) + '/preparation',
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  return bound(result, meetingId);
}

export async function replaceVideoMeetingAgenda(
  meetingId: string,
  items: VideoMeetingAgendaInput[],
  expectedAgendaVersion: number,
  key: string
) {
  const payload = {
    expectedAgendaVersion: validVersion(expectedAgendaVersion),
    items: agendaItems(items, false),
  };
  const result = (
    await axiosInstance.put<ApiResponse<VideoMeetingPreparation>, typeof payload>(
      path(meetingId) + '/agenda',
      payload,
      command(key)
    )
  ).data.data;
  return bound(result, meetingId);
}

export async function respondVideoMeetingInvitation(
  meetingId: string,
  response: 'ACCEPTED' | 'TENTATIVE' | 'DECLINED',
  expectedInvitationRevision: number,
  expectedVersion: number,
  key: string
) {
  if (
    !['ACCEPTED', 'TENTATIVE', 'DECLINED'].includes(response) ||
    validVersion(expectedInvitationRevision) < 1
  )
    throw new Error('Invalid invitation response');
  const payload = {
    response,
    expectedInvitationRevision,
    expectedVersion: validVersion(expectedVersion),
  };
  const result = (
    await axiosInstance.put<ApiResponse<VideoMeetingPreparation>, typeof payload>(
      path(meetingId) + '/invitation-response',
      payload,
      command(key)
    )
  ).data.data;
  return bound(result, meetingId);
}

/** Replaces only the current participant's private checklist; no aggregate is accepted or exposed. */
export async function replaceMyVideoMeetingPreparation(
  meetingId: string,
  preparedAgendaItemIds: string[],
  expectedAgendaVersion: number,
  expectedVersion: number,
  key: string
): Promise<VideoMeetingPreparation> {
  if (!Array.isArray(preparedAgendaItemIds) || preparedAgendaItemIds.length > 50)
    throw new Error('Invalid personal preparation');
  const canonicalIds = preparedAgendaItemIds.map((itemId) => {
    if (typeof itemId !== 'string' || !uuid.test(itemId))
      throw new Error('Invalid personal preparation');
    return itemId;
  });
  if (new Set(canonicalIds).size !== canonicalIds.length)
    throw new Error('Invalid personal preparation');
  canonicalIds.sort();
  const payload = {
    expectedAgendaVersion: validVersion(expectedAgendaVersion),
    expectedVersion: validVersion(expectedVersion),
    preparedAgendaItemIds: canonicalIds,
  };
  const result = (
    await axiosInstance.put<ApiResponse<unknown>, typeof payload>(
      path(meetingId) + '/my-preparation',
      payload,
      command(key)
    )
  ).data.data;
  return bound(result, meetingId);
}

export async function registerVideoMeetingMaterial(
  meetingId: string,
  input: RegisterVideoMeetingMaterialInput,
  expectedMaterialsVersion: number,
  key: string
) {
  const payload = {
    ...material(input),
    expectedMaterialsVersion: validVersion(expectedMaterialsVersion),
  };
  const result = (
    await axiosInstance.post<ApiResponse<VideoMeetingPreparation>, typeof payload>(
      path(meetingId) + '/materials',
      payload,
      command(key)
    )
  ).data.data;
  return bound(result, meetingId);
}

export async function removeVideoMeetingMaterial(
  meetingId: string,
  materialId: string,
  expectedMaterialsVersion: number,
  expectedVersion: number,
  key: string
) {
  if (!uuid.test(materialId)) throw new Error('Invalid material reference');
  const payload = {
    expectedMaterialsVersion: validVersion(expectedMaterialsVersion),
    expectedVersion: validVersion(expectedVersion),
  };
  const result = (
    await axiosInstance.post<ApiResponse<VideoMeetingPreparation>, typeof payload>(
      path(meetingId) + `/materials/${encodeURIComponent(materialId)}/remove`,
      payload,
      command(key)
    )
  ).data.data;
  return bound(result, meetingId);
}

export async function issueVideoMeetingMaterialAccessTicket(
  meetingId: string,
  materialId: string,
  expectedVersion: number
) {
  if (!uuid.test(materialId)) throw new Error('Invalid material reference');
  const payload = { expectedVersion: validVersion(expectedVersion) };
  const result = (
    await axiosInstance.post<ApiResponse<VideoMeetingMaterialAccessTicket>, typeof payload>(
      path(meetingId) + `/materials/${encodeURIComponent(materialId)}/access-ticket`,
      payload,
      { timeoutMs: 8_000 }
    )
  ).data.data;
  let accessUrl: URL;
  try {
    accessUrl = new URL(result.accessUrl);
  } catch {
    throw new Error('Invalid material access ticket');
  }
  if (
    result.meetingId !== meetingId ||
    result.materialId !== materialId ||
    validVersion(result.materialVersion) !== expectedVersion ||
    accessUrl.protocol !== 'https:' ||
    accessUrl.username ||
    accessUrl.password ||
    accessUrl.hash ||
    !Number.isFinite(Date.parse(result.expiresAt)) ||
    Date.parse(result.expiresAt) <= Date.now() ||
    typeof result.contentType !== 'string' ||
    !result.contentType ||
    typeof result.displayName !== 'string' ||
    !result.displayName
  )
    throw new Error('Invalid material access ticket');
  return result;
}
