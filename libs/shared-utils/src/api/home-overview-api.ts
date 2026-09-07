import { axiosInstance } from '../axios-instance';
import { normalizeWorkspaceActivityFeed, normalizeWorkspaceWorkQueue } from './workspace-api';
import { getActivityExecutionSummary } from './activity-source-api';

import type { ApiResponse } from '../types';
import type { CalendarHome } from './calendar-api';
import type { CommunicationFeed } from './communication-api';
import type {
  RawWorkspaceActivityFeed,
  RawWorkspaceWorkQueue,
  WorkspaceActivityFeed,
  WorkspaceWorkQueue,
} from './workspace-api';

export type HomeSectionStatus = 'AVAILABLE' | 'FORBIDDEN' | 'UNAVAILABLE';

export type HomeOverviewSection<T> = {
  status: HomeSectionStatus;
  source: string;
  generatedAt: string;
  data?: T | null;
  reason?: string | null;
};

export type HomeAudienceProfile = 'MEMBER' | 'MANAGER' | 'OPERATOR';

export type HomeAudienceContext = {
  profile: HomeAudienceProfile;
  ruleVersion: string;
  reasons: string[];
};

export type HomeRecommendation = {
  key: string;
  kind: 'ACTION' | 'SCHEDULE' | 'COMMUNICATION' | 'FOCUS';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionPath: string;
  source: string;
  evidenceCount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type HomeRecommendationFeedbackType = 'HELPFUL' | 'NOT_RELEVANT' | 'DISMISSED';

export type HomeRecommendationFeedback = {
  recommendationKey: string;
  feedbackType: HomeRecommendationFeedbackType;
  ruleVersion: string;
  recordedAt: string;
};

export type HomeOverview = {
  audience: HomeAudienceContext;
  work: HomeOverviewSection<WorkspaceWorkQueue>;
  calendar: HomeOverviewSection<CalendarHome>;
  communications: HomeOverviewSection<CommunicationFeed>;
  activity: HomeOverviewSection<WorkspaceActivityFeed>;
  recommendations: HomeOverviewSection<HomeRecommendation[]>;
  generatedAt: string;
};

type RawHomeOverview = Omit<HomeOverview, 'work' | 'activity' | 'recommendations'> & {
  work: HomeOverviewSection<RawWorkspaceWorkQueue>;
  activity: HomeOverviewSection<RawWorkspaceActivityFeed>;
  recommendations?: HomeRecommendation[] | HomeOverviewSection<HomeRecommendation[]>;
  recommendationSection?: HomeOverviewSection<HomeRecommendation[]>;
};

function normalizeSection<Raw, Normalized>(
  section: HomeOverviewSection<Raw>,
  normalize: (data: Raw) => Normalized
): HomeOverviewSection<Normalized> {
  return {
    ...section,
    data:
      section.data === undefined
        ? undefined
        : section.data === null
          ? null
          : normalize(section.data),
  };
}

export async function getHomeOverview(timeZone = 'Asia/Seoul'): Promise<HomeOverview> {
  const response = await axiosInstance.get<ApiResponse<RawHomeOverview>>(
    `/api/platform/v1/home/overview?timeZone=${encodeURIComponent(timeZone)}`,
    { timeoutMs: 8000 }
  );
  const overview = response.data.data;
  const { recommendationSection, recommendations, ...rest } = overview;
  const activity = normalizeSection(overview.activity, normalizeWorkspaceActivityFeed);
  if (activity.status === 'AVAILABLE' && activity.data) {
    try {
      activity.data.executionSummary = await getActivityExecutionSummary();
      activity.data.executionSummaryStatus = 'AVAILABLE';
    } catch {
      // Historical events remain readable, but never stand in for a failed current-state query.
      delete activity.data.executionSummary;
      activity.data.executionSummaryStatus = 'UNAVAILABLE';
    }
  }
  const normalizedRecommendations = recommendationSection ??
    (Array.isArray(recommendations)
      ? {
          status: 'AVAILABLE' as const,
          source: 'DWP_HOME_RECOMMENDATIONS',
          generatedAt: overview.generatedAt,
          data: recommendations,
          reason: null,
        }
      : recommendations) ?? {
      status: 'UNAVAILABLE' as const,
      source: 'DWP_HOME_RECOMMENDATIONS',
      generatedAt: overview.generatedAt,
      data: null,
      reason: 'MISSING_RECOMMENDATION_CONTRACT',
    };
  return {
    ...rest,
    work: normalizeSection(overview.work, normalizeWorkspaceWorkQueue),
    activity,
    recommendations: normalizedRecommendations,
  };
}

export async function recordHomeRecommendationFeedback(
  recommendationKey: string,
  feedbackType: HomeRecommendationFeedbackType
): Promise<HomeRecommendationFeedback> {
  const response = await axiosInstance.post<
    ApiResponse<HomeRecommendationFeedback>,
    { feedbackType: HomeRecommendationFeedbackType }
  >(`/api/platform/v1/home/recommendations/${encodeURIComponent(recommendationKey)}/feedback`, {
    feedbackType,
  });
  return response.data.data;
}
