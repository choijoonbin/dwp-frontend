import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingDisconnectReceipt = {
  meetingId: string;
  participantId: string;
  commandId: string;
  state: 'PENDING' | 'DISCONNECTED';
  blockedForCurrentSession: true;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function disconnectVideoMeetingParticipant(
  meetingId: string,
  participantId: string,
  expectedVersion: number,
  idempotencyKey: string,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<VideoMeetingDisconnectReceipt> {
  if (
    ![meetingId, participantId, idempotencyKey].every((value) => uuid.test(value)) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  )
    throw new Error('Invalid meeting disconnect command');
  const governed = productSurfaceGovernedMutationConfig(authority);
  const response = await axiosInstance.post<ApiResponse<unknown>>(
    `${VIDEO_MEETING_API_BASE}/meetings/${meetingId}/participants/${participantId}/disconnect`,
    { expectedVersion },
    {
      contextScopeKey: governed.contextScopeKey,
      headers: { ...governed.headers, 'Idempotency-Key': idempotencyKey },
    }
  );
  const value = response.data.data as Partial<VideoMeetingDisconnectReceipt> | null;
  if (
    !value ||
    value.meetingId !== meetingId ||
    value.participantId !== participantId ||
    typeof value.commandId !== 'string' ||
    !uuid.test(value.commandId) ||
    !['PENDING', 'DISCONNECTED'].includes(value.state ?? '') ||
    value.blockedForCurrentSession !== true
  )
    throw new Error('Invalid meeting disconnect receipt');
  return value as VideoMeetingDisconnectReceipt;
}
