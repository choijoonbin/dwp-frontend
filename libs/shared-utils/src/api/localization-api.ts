import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type LocalizationRevisionState =
  'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUPERSEDED';

export type LocalizationBundleSummary = {
  bundleId: string;
  bundleKey: string;
  sourceLocale: string;
  targetLocale: string;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  currentPublishedRevisionId?: string | null;
  currentPublishedRevisionNumber?: number | null;
  openRevisionState?: LocalizationRevisionState | null;
  openRevisionNumber?: number | null;
  completeness: number;
  issueCount: number;
  version: number;
  updatedAt: string;
};

export type LocalizationDecision = {
  decisionId: string;
  previousState: LocalizationRevisionState;
  decision: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'RESTORED';
  reason: string;
  actorId: number;
  decidedAt: string;
};

export type LocalizationPlaceholderIssue = {
  key: string;
  expected: string[];
  actual: string[];
};

export type LocalizationPreview = {
  resolvedEntries: Record<string, string>;
  missingKeys: string[];
  fallbackKeys: string[];
  unknownKeys: string[];
  placeholderIssues: LocalizationPlaceholderIssue[];
  completeness: number;
  publishable: boolean;
};

export type LocalizationRevision = {
  revisionId: string;
  bundleId: string;
  bundleKey: string;
  sourceLocale: string;
  targetLocale: string;
  revisionNumber: number;
  basedOnRevisionId?: string | null;
  sourceEntries: Record<string, string>;
  entries: Record<string, string>;
  lifecycleState: LocalizationRevisionState;
  changeSummary: string;
  contentSha256: string;
  submittedBy?: number | null;
  submittedAt?: string | null;
  decidedBy?: number | null;
  decidedAt?: string | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  version: number;
  createdAt: string;
  createdBy?: number | null;
  updatedAt: string;
  decisions: LocalizationDecision[];
  preview: LocalizationPreview;
};

export type LocalizationWorkspace = {
  bundleCount: number;
  draftCount: number;
  reviewCount: number;
  publishedCount: number;
  issueCount: number;
  bundles: LocalizationBundleSummary[];
};

export type LocalizationDiffEntry = {
  key: string;
  changeType: 'ADDED' | 'UPDATED' | 'REMOVED' | 'UNCHANGED';
  sourceValue?: string | null;
  beforeValue?: string | null;
  afterValue?: string | null;
  fallback: boolean;
};

export type LocalizationDiff = {
  revisionId: string;
  comparedWithRevisionId?: string | null;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  entries: LocalizationDiffEntry[];
};

export type CreateLocalizationBundleRequest = {
  bundleKey: string;
  sourceLocale: string;
  targetLocale: string;
  sourceEntries: Record<string, string>;
  entries: Record<string, string>;
  changeSummary: string;
};

export type SaveLocalizationDraftRequest = Pick<
  LocalizationRevision,
  'sourceEntries' | 'entries' | 'changeSummary' | 'version'
>;

const BASE = '/api/platform/v1/admin/localization';

export async function getLocalizationWorkspace(): Promise<LocalizationWorkspace> {
  const response = await axiosInstance.get<ApiResponse<LocalizationWorkspace>>(BASE);
  return response.data.data;
}

export async function createLocalizationBundle(
  request: CreateLocalizationBundleRequest
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    CreateLocalizationBundleRequest
  >(`${BASE}/bundles`, request);
  return response.data.data;
}

export async function listLocalizationRevisions(bundleId: string): Promise<LocalizationRevision[]> {
  const response = await axiosInstance.get<ApiResponse<LocalizationRevision[]>>(
    `${BASE}/bundles/${bundleId}/revisions`
  );
  return response.data.data;
}

export async function createLocalizationDraft(
  bundleId: string,
  changeSummary: string
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    { changeSummary: string }
  >(`${BASE}/bundles/${bundleId}/drafts`, { changeSummary });
  return response.data.data;
}

export async function saveLocalizationDraft(
  revisionId: string,
  request: SaveLocalizationDraftRequest
): Promise<LocalizationRevision> {
  const response = await axiosInstance.put<
    ApiResponse<LocalizationRevision>,
    SaveLocalizationDraftRequest
  >(`${BASE}/revisions/${revisionId}`, request);
  return response.data.data;
}

export async function getLocalizationDiff(revisionId: string): Promise<LocalizationDiff> {
  const response = await axiosInstance.get<ApiResponse<LocalizationDiff>>(
    `${BASE}/revisions/${revisionId}/diff`
  );
  return response.data.data;
}

export async function submitLocalizationRevision(
  revisionId: string,
  reason: string,
  version: number
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    { reason: string; version: number }
  >(`${BASE}/revisions/${revisionId}/submit`, { reason, version });
  return response.data.data;
}

export async function decideLocalizationRevision(
  revisionId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
  version: number
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    { decision: 'APPROVED' | 'REJECTED'; reason: string; version: number }
  >(`${BASE}/revisions/${revisionId}/decision`, { decision, reason, version });
  return response.data.data;
}

export async function publishLocalizationRevision(
  revisionId: string,
  reason: string,
  version: number
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    { reason: string; version: number }
  >(`${BASE}/revisions/${revisionId}/publish`, { reason, version });
  return response.data.data;
}

export async function restoreLocalizationRevision(
  revisionId: string,
  changeSummary: string
): Promise<LocalizationRevision> {
  const response = await axiosInstance.post<
    ApiResponse<LocalizationRevision>,
    { changeSummary: string }
  >(`${BASE}/revisions/${revisionId}/restore`, { changeSummary });
  return response.data.data;
}
