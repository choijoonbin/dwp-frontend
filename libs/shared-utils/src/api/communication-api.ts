import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type CommunicationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type CommunicationContentType = 'ANNOUNCEMENT' | 'NEWS' | 'EVENT' | 'POLICY_UPDATE';
export type CommunicationFeedScope = 'for-you' | 'all' | 'required' | 'saved';
export type CommunicationReaction = 'CELEBRATE' | 'INSIGHTFUL' | 'SUPPORT';

export type CommunicationReactionSummary = {
  counts: Partial<Record<CommunicationReaction, number>>;
  viewerReaction?: CommunicationReaction | null;
  total: number;
};

export type CommunicationReaderState = {
  unread: boolean;
  saved: boolean;
  acknowledged: boolean;
  dismissed: boolean;
  openedAt?: string | null;
  savedAt?: string | null;
  acknowledgedAt?: string | null;
};

export type CommunicationItem = {
  communicationId: number;
  title: string;
  summary: string;
  body?: string | null;
  severity: CommunicationSeverity;
  contentType: CommunicationContentType;
  categoryKey: string;
  publisherName: string;
  coverImageUrl?: string | null;
  featured: boolean;
  pinned: boolean;
  acknowledgementRequired: boolean;
  acknowledgementDueAt?: string | null;
  dismissible: boolean;
  readingMinutes: number;
  sourceLocale: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  publishedAt?: string | null;
  endsAt?: string | null;
  readerState: CommunicationReaderState;
  reactions: CommunicationReactionSummary;
};

export type CommunicationFeedSummary = {
  total: number;
  unread: number;
  required: number;
  saved: number;
  /** Additive server capability; omitted by pre-capability deployments. */
  criticalUnread?: number;
  /** Union of unacknowledged required and unread critical communications. */
  actionable?: number;
};

export type CommunicationFeed = {
  featured?: CommunicationItem | null;
  items: CommunicationItem[];
  /** Reader-wide action-first slice; intentionally independent of scope/query filters. */
  actionableItems?: CommunicationItem[];
  summary: CommunicationFeedSummary;
  generatedAt: string;
};

export type CommunicationFeedQuery = {
  scope?: CommunicationFeedScope;
  query?: string;
  type?: CommunicationContentType | 'ALL';
  size?: number;
};

export async function getCommunicationFeed(
  query: CommunicationFeedQuery = {}
): Promise<CommunicationFeed> {
  const search = new URLSearchParams();
  if (query.scope) search.set('scope', query.scope);
  if (query.query) search.set('query', query.query);
  if (query.type) search.set('type', query.type);
  if (query.size) search.set('size', String(query.size));
  const suffix = search.size ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<CommunicationFeed>>(
    `/api/platform/v1/communications${suffix}`
  );
  return response.data.data;
}

export async function getCommunication(communicationId: number): Promise<CommunicationItem> {
  const response = await axiosInstance.get<ApiResponse<CommunicationItem>>(
    `/api/platform/v1/communications/${communicationId}`
  );
  return response.data.data;
}

export async function recordCommunicationEvent(
  communicationId: number,
  event: 'impression' | 'open' | 'action'
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, undefined>(
    `/api/platform/v1/communications/${communicationId}/events/${event}`,
    undefined
  );
}

export async function updateCommunicationReaderState(
  communicationId: number,
  state: { saved?: boolean; dismissed?: boolean }
): Promise<CommunicationReaderState> {
  const response = await axiosInstance.put<
    ApiResponse<{ communicationId: number; readerState: CommunicationReaderState }>,
    { saved?: boolean; dismissed?: boolean }
  >(`/api/platform/v1/communications/${communicationId}/reader-state`, state);
  return response.data.data.readerState;
}

export async function acknowledgeCommunication(
  communicationId: number
): Promise<CommunicationReaderState> {
  const response = await axiosInstance.post<
    ApiResponse<{ communicationId: number; readerState: CommunicationReaderState }>,
    undefined
  >(`/api/platform/v1/communications/${communicationId}/acknowledgement`, undefined);
  return response.data.data.readerState;
}

export async function updateCommunicationReaction(
  communicationId: number,
  reaction: CommunicationReaction | null
): Promise<CommunicationReactionSummary> {
  const response = await axiosInstance.put<
    ApiResponse<CommunicationReactionSummary>,
    { reaction: CommunicationReaction | null }
  >(`/api/platform/v1/communications/${communicationId}/reaction`, { reaction });
  return response.data.data;
}
