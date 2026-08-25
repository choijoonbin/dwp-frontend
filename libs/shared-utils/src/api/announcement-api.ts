import { axiosInstance } from '../axios-instance';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type AnnouncementSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type AnnouncementLifecycle = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnnouncementAudienceType = 'ALL' | 'ROLE';
export type AnnouncementContentType = 'ANNOUNCEMENT' | 'NEWS' | 'EVENT' | 'POLICY_UPDATE';

export type AnnouncementDefinition = {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  audienceType: AnnouncementAudienceType;
  audienceValue?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  pinned: boolean;
  actionLabel?: string | null;
  actionUrl?: string | null;
  contentType?: AnnouncementContentType;
  categoryKey?: string;
  body?: string | null;
  coverImageUrl?: string | null;
  publisherName?: string;
  featured?: boolean;
  acknowledgementRequired?: boolean;
  acknowledgementDueAt?: string | null;
  dismissible?: boolean;
  readingMinutes?: number;
  sourceLocale?: string;
};

export type Announcement = AnnouncementDefinition & {
  announcementId: number;
  lifecycleState: AnnouncementLifecycle;
  publishedAt?: string | null;
  publishedBy?: number | null;
  uniqueViewerCount?: number;
  viewCount?: number;
  actionClickCount?: number;
  acknowledgementCount?: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export const COMMUNICATIONS_MANAGEMENT_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createAnnouncement',
    routeContractKey: 'route.communications.management.content-create.action',
    method: 'POST',
    path: '/api/platform/v1/admin/announcements',
  },
  {
    apiFunction: 'updateAnnouncement',
    routeContractKey: 'route.communications.management.content-update.action',
    method: 'PUT',
    path: '/api/platform/v1/admin/announcements/{announcementId}',
  },
  {
    apiFunction: 'publishAnnouncement',
    routeContractKey: 'route.communications.management.content-publish.action',
    method: 'POST',
    path: '/api/platform/v1/admin/announcements/{announcementId}/publish',
  },
  {
    apiFunction: 'archiveAnnouncement',
    routeContractKey: 'route.communications.management.content-archive.action',
    method: 'POST',
    path: '/api/platform/v1/admin/announcements/{announcementId}/archive',
  },
] as const;

export async function listAnnouncements(): Promise<Announcement[]> {
  const response = await axiosInstance.get<ApiResponse<Announcement[]>>(
    '/api/platform/v1/announcements'
  );
  return response.data.data;
}

export async function recordAnnouncementEngagement(
  announcementId: number,
  engagement: 'view' | 'action'
): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, undefined>(
    `/api/platform/v1/announcements/${announcementId}/engagements/${engagement}`,
    undefined
  );
}

export async function listAdminAnnouncements(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<Announcement[]> {
  const response = await axiosInstance.get<ApiResponse<Announcement[]>>(
    '/api/platform/v1/admin/announcements',
    contextScopeKey === undefined && signal === undefined
      ? undefined
      : {
          ...(contextScopeKey === undefined ? {} : { contextScopeKey }),
          ...(signal === undefined ? {} : { signal }),
        }
  );
  return response.data.data;
}

export async function createAnnouncement(
  definition: AnnouncementDefinition,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<Announcement> {
  const response = await axiosInstance.post<
    ApiResponse<Announcement>,
    { definition: AnnouncementDefinition }
  >(
    '/api/platform/v1/admin/announcements',
    { definition },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function updateAnnouncement(
  announcementId: number,
  definition: AnnouncementDefinition,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<Announcement> {
  const response = await axiosInstance.put<
    ApiResponse<Announcement>,
    { definition: AnnouncementDefinition; version: number }
  >(
    `/api/platform/v1/admin/announcements/${announcementId}`,
    { definition, version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function publishAnnouncement(
  announcementId: number,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<Announcement> {
  const response = await axiosInstance.post<ApiResponse<Announcement>, { version: number }>(
    `/api/platform/v1/admin/announcements/${announcementId}/publish`,
    { version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function archiveAnnouncement(
  announcementId: number,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<Announcement> {
  const response = await axiosInstance.post<ApiResponse<Announcement>, { version: number }>(
    `/api/platform/v1/admin/announcements/${announcementId}/archive`,
    { version },
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}
