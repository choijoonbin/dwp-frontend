import { axiosInstance } from '../axios-instance';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

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

export const COMMUNICATIONS_WORK_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'recordCommunicationEvent',
    routeContractKey: 'route.communications.work.event.action',
    method: 'POST',
    path: '/api/platform/v1/communications/{communicationId}/events/{eventType}',
  },
  {
    apiFunction: 'updateCommunicationReaderState',
    routeContractKey: 'route.communications.work.reader-state.action',
    method: 'PUT',
    path: '/api/platform/v1/communications/{communicationId}/reader-state',
  },
  {
    apiFunction: 'acknowledgeCommunication',
    routeContractKey: 'route.communications.work.acknowledgement.action',
    method: 'POST',
    path: '/api/platform/v1/communications/{communicationId}/acknowledgement',
  },
  {
    apiFunction: 'updateCommunicationReaction',
    routeContractKey: 'route.communications.work.reaction.action',
    method: 'PUT',
    path: '/api/platform/v1/communications/{communicationId}/reaction',
  },
] as const;

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
  event: 'impression' | 'open' | 'action',
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, undefined>(
    `/api/platform/v1/communications/${communicationId}/events/${event}`,
    undefined,
    productSurfaceGovernedMutationConfig(authority)
  );
}

export async function updateCommunicationReaderState(
  communicationId: number,
  state: { saved?: boolean; dismissed?: boolean },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CommunicationReaderState> {
  const response = await axiosInstance.put<
    ApiResponse<{ communicationId: number; readerState: CommunicationReaderState }>,
    { saved?: boolean; dismissed?: boolean }
  >(
    `/api/platform/v1/communications/${communicationId}/reader-state`,
    state,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data.readerState;
}

export async function acknowledgeCommunication(
  communicationId: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CommunicationReaderState> {
  const response = await axiosInstance.post<
    ApiResponse<{ communicationId: number; readerState: CommunicationReaderState }>,
    undefined
  >(
    `/api/platform/v1/communications/${communicationId}/acknowledgement`,
    undefined,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data.readerState;
}

export async function updateCommunicationReaction(
  communicationId: number,
  reaction: CommunicationReaction | null,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CommunicationReactionSummary> {
  const response = await axiosInstance.put<
    ApiResponse<CommunicationReactionSummary>,
    { reaction: CommunicationReaction | null }
  >(
    `/api/platform/v1/communications/${communicationId}/reaction`,
    { reaction },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}
