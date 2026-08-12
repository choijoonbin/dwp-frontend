import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type AnnouncementSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type AnnouncementLifecycle = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AnnouncementAudienceType = 'ALL' | 'ROLE';

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
};

export type Announcement = AnnouncementDefinition & {
  announcementId: number;
  lifecycleState: AnnouncementLifecycle;
  publishedAt?: string | null;
  publishedBy?: number | null;
  uniqueViewerCount?: number;
  viewCount?: number;
  actionClickCount?: number;
  version: number;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

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

export async function listAdminAnnouncements(): Promise<Announcement[]> {
  const response = await axiosInstance.get<ApiResponse<Announcement[]>>(
    '/api/platform/v1/admin/announcements'
  );
  return response.data.data;
}

export async function createAnnouncement(
  definition: AnnouncementDefinition
): Promise<Announcement> {
  const response = await axiosInstance.post<
    ApiResponse<Announcement>,
    { definition: AnnouncementDefinition }
  >('/api/platform/v1/admin/announcements', { definition });
  return response.data.data;
}

export async function updateAnnouncement(
  announcementId: number,
  definition: AnnouncementDefinition,
  version: number
): Promise<Announcement> {
  const response = await axiosInstance.put<
    ApiResponse<Announcement>,
    { definition: AnnouncementDefinition; version: number }
  >(`/api/platform/v1/admin/announcements/${announcementId}`, { definition, version });
  return response.data.data;
}

export async function publishAnnouncement(
  announcementId: number,
  version: number
): Promise<Announcement> {
  const response = await axiosInstance.post<ApiResponse<Announcement>, { version: number }>(
    `/api/platform/v1/admin/announcements/${announcementId}/publish`,
    { version }
  );
  return response.data.data;
}

export async function archiveAnnouncement(
  announcementId: number,
  version: number
): Promise<Announcement> {
  const response = await axiosInstance.post<ApiResponse<Announcement>, { version: number }>(
    `/api/platform/v1/admin/announcements/${announcementId}/archive`,
    { version }
  );
  return response.data.data;
}
