import { axiosInstance } from '../axios-instance';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';
import { productSurfaceReadScopeConfig } from './product-surface-read-scope';

import type { ApiResponse } from '../types';
import type { ProductSurfaceGovernedMutationAuthority } from './product-surface-governed-mutation';

export type HrEmployeeContext = {
  personId: string;
  displayName: string;
  businessTitle?: string | null;
  organizationName?: string | null;
  managerDisplayName?: string | null;
  directReportCount: number;
};

export type HrTimeCard = {
  timeCardId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  scheduledMinutes: number;
  recordedMinutes: number;
  exceptionCount: number;
  dataOrigin: string;
  version: number;
};

export type HrTimeEntry = {
  timeEntryId: string;
  workDate: string;
  entryType: string;
  minutes: number;
  workMode?: string | null;
  note?: string | null;
  version: number;
};

export type HrTimeException = {
  exceptionId: string;
  exceptionCode: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  occurredOn: string;
  message: string;
  lifecycleState: 'OPEN' | 'RESOLVED' | 'WAIVED';
  resolutionNote?: string | null;
};

export type HrApprovalItem = {
  itemId: string;
  domain: 'TIME' | 'ABSENCE';
  personId: string;
  employeeName: string;
  employeeTitle?: string | null;
  summary: string;
  status: string;
  submittedAt?: string | null;
  version: number;
  evidence?: {
    periodStart?: string | null;
    periodEnd?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    scheduledMinutes?: number | null;
    recordedMinutes?: number | null;
    exceptionCount?: number | null;
    requestedMinutes?: number | null;
    availableMinutes?: number | null;
    reason?: string | null;
  } | null;
};

export type HrTimeWorkspace = {
  employee: HrEmployeeContext;
  card?: HrTimeCard | null;
  entries: HrTimeEntry[];
  exceptions: HrTimeException[];
  teamQueue: HrApprovalItem[];
};

export type HrLeaveBalance = {
  planId: string;
  planKey: string;
  planName: string;
  grantedMinutes: number;
  usedMinutes: number;
  pendingMinutes: number;
  availableMinutes: number;
  asOf: string;
  dataOrigin: string;
};

export type HrLeaveRequest = {
  requestId: string;
  planId: string;
  planName: string;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  status: string;
  reason?: string | null;
  submittedAt?: string | null;
  decisionNote?: string | null;
  cancelledAt?: string | null;
  cancellationNote?: string | null;
  version: number;
};

export type HrTeamAbsence = {
  requestId: string;
  personId: string;
  employeeName: string;
  employeeTitle?: string | null;
  planName: string;
  startAt: string;
  endAt: string;
  status: string;
};

export type HrAbsenceWorkspace = {
  employee: HrEmployeeContext;
  balances: HrLeaveBalance[];
  requests: HrLeaveRequest[];
  teamQueue: HrApprovalItem[];
  teamCalendar: HrTeamAbsence[];
};

export type HrTeamMember = {
  personId: string;
  displayName: string;
  businessTitle?: string | null;
  organizationName?: string | null;
  directReportCount: number;
};

export type HrTeamDataBoundary = 'TEAM' | 'ORGANIZATION_SET' | 'TEAM_AND_ORGANIZATION_SET';
export type HrOperationsDataBoundary = 'TENANT' | 'ORGANIZATION_SET';

export type HrTeamWorkspace = {
  manager: HrEmployeeContext;
  members: HrTeamMember[];
  timePendingCount: number;
  absencePendingCount: number;
  dataBoundary: HrTeamDataBoundary;
};

export type HrTeamTimeWorkspace = {
  manager: HrEmployeeContext;
  teamQueue: HrApprovalItem[];
  dataBoundary: HrTeamDataBoundary;
};

export type HrTeamAbsenceWorkspace = {
  manager: HrEmployeeContext;
  teamQueue: HrApprovalItem[];
  teamCalendar: HrTeamAbsence[];
  dataBoundary: HrTeamDataBoundary;
};

export type HrBenefitPlan = {
  planId: string;
  planType: string;
  name: string;
  providerName?: string | null;
  coverageLevel: string;
  status: string;
  effectiveStart: string;
  effectiveEnd?: string | null;
};

export type HrEnrollmentWindow = {
  windowId: string;
  name: string;
  windowType: string;
  opensAt: string;
  closesAt: string;
  lifecycleState: 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
};

export type HrBenefitsWorkspace = {
  employee: HrEmployeeContext;
  plans: HrBenefitPlan[];
  windows: HrEnrollmentWindow[];
  referenceData: boolean;
};

export type HrPayCycle = {
  payCycleId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  timeValidated: boolean;
  absenceValidated: boolean;
  sourceConfirmed: boolean;
  dataOrigin: HrHomeDataOrigin;
};

export type HrPayStatement = {
  statementId: string;
  periodLabel: string;
  availabilityState: string;
  publishedAt?: string | null;
  downloadable: boolean;
};

export type HrPayWorkspace = {
  employee: HrEmployeeContext;
  nextCycle?: HrPayCycle | null;
  statements: HrPayStatement[];
  monetaryDataRedacted: boolean;
};

export type HrJourney = {
  journeyId: string;
  name: string;
  journeyType: string;
  progressPercent: number;
  targetDate?: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
};

export type HrGoal = {
  goalId: string;
  title: string;
  goalType: string;
  progressPercent: number;
  dueDate?: string | null;
  status: string;
  version: number;
};

export type HrLearning = {
  learningId: string;
  title: string;
  providerName?: string | null;
  required: boolean;
  progressPercent: number;
  dueDate?: string | null;
  status: string;
};

export type HrTalentWorkspace = {
  employee: HrEmployeeContext;
  journeys: HrJourney[];
  goals: HrGoal[];
  learning: HrLearning[];
};

export type HrDomainMetric = {
  key: string;
  value: number;
  severity: string;
};

export type HrDomainOperations = {
  domain: 'TIME' | 'ABSENCE' | 'BENEFITS' | 'PAY' | 'TALENT';
  generatedAt: string;
  metrics: HrDomainMetric[];
  workQueue: HrApprovalItem[];
  dataBoundary: HrOperationsDataBoundary;
};

export type HrDomainOperationsSummary = {
  domain: HrDomainOperations['domain'];
  metrics: HrDomainMetric[];
  pendingCount: number;
};

export type HrWorkforceOperationsOverview = {
  generatedAt: string;
  dataBoundary: HrOperationsDataBoundary;
  fieldGroups: string[];
  domains: HrDomainOperationsSummary[];
};

export type HrHomeDomain = 'TIME' | 'ABSENCE' | 'BENEFITS' | 'PAY' | 'TALENT' | 'TEAM';
export type HrHomeDataOrigin = 'SOURCE' | 'MANUAL' | 'REFERENCE' | 'MIXED' | 'NONE' | 'UNKNOWN';
export type HrHomeDomainState = {
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  dataOrigin: HrHomeDataOrigin;
  reasonCode?: string | null;
};

function normalizeHrHomeDataOrigin(value: string | null | undefined): HrHomeDataOrigin {
  if (value === 'LOCAL_SEED') return 'REFERENCE';
  if (
    value === 'SOURCE' ||
    value === 'MANUAL' ||
    value === 'REFERENCE' ||
    value === 'MIXED' ||
    value === 'NONE' ||
    value === 'UNKNOWN'
  ) {
    return value;
  }
  return 'UNKNOWN';
}

export type HrHomeOverview = {
  asOf: string;
  generatedAt: string | null;
  timeZone: string;
  standardDayMinutes: number | null;
  employee: HrEmployeeContext;
  time?: HrTimeCard | null;
  leaveBalances: HrLeaveBalance[];
  pay?: HrPayCycle | null;
  enrollmentWindows: HrEnrollmentWindow[];
  journeys: HrJourney[];
  activeBenefitCount: number;
  openBenefitWindowCount: number;
  activeGoalCount: number;
  requiredLearningCount: number;
  teamPendingCount: number;
  teamTimePendingCount: number | null;
  teamAbsencePendingCount: number | null;
  domainStates: Partial<Record<HrHomeDomain, HrHomeDomainState>>;
  referenceDataPresent: boolean;
};

type HrHomeOverviewWire = Omit<
  HrHomeOverview,
  | 'generatedAt'
  | 'timeZone'
  | 'standardDayMinutes'
  | 'enrollmentWindows'
  | 'journeys'
  | 'teamTimePendingCount'
  | 'teamAbsencePendingCount'
  | 'domainStates'
> &
  Partial<
    Pick<
      HrHomeOverview,
      | 'generatedAt'
      | 'timeZone'
      | 'standardDayMinutes'
      | 'enrollmentWindows'
      | 'journeys'
      | 'teamTimePendingCount'
      | 'teamAbsencePendingCount'
      | 'domainStates'
    >
  >;

const BASE = '/api/people/v1/hr';

async function get<T>(path: string, contextScopeKey?: string, signal?: AbortSignal): Promise<T> {
  const response = await axiosInstance.get<ApiResponse<T>>(
    `${BASE}${path}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export const getHrHome = async (): Promise<HrHomeOverview> => {
  const value = await get<HrHomeOverviewWire>('/home');
  const legacyDomainState: HrHomeDomainState = {
    availability: 'AVAILABLE',
    dataOrigin: 'UNKNOWN',
    reasonCode: null,
  };
  const domains: HrHomeDomain[] = ['TIME', 'ABSENCE', 'BENEFITS', 'PAY', 'TALENT', 'TEAM'];
  const domainStates = Object.fromEntries(
    domains.map((domain) => {
      const state = value.domainStates?.[domain] ?? legacyDomainState;
      return [domain, { ...state, dataOrigin: normalizeHrHomeDataOrigin(state.dataOrigin) }];
    })
  ) as Record<HrHomeDomain, HrHomeDomainState>;
  return {
    ...value,
    generatedAt: value.generatedAt ?? null,
    timeZone: value.timeZone ?? 'UTC',
    standardDayMinutes: value.standardDayMinutes ?? null,
    enrollmentWindows: value.enrollmentWindows ?? [],
    journeys: value.journeys ?? [],
    teamTimePendingCount: value.teamTimePendingCount ?? null,
    teamAbsencePendingCount: value.teamAbsencePendingCount ?? null,
    domainStates,
    pay: value.pay
      ? {
          ...value.pay,
          dataOrigin: normalizeHrHomeDataOrigin(value.pay.dataOrigin),
        }
      : value.pay,
  };
};
export const getHrTime = () => get<HrTimeWorkspace>('/time');
export const getHrAbsence = () => get<HrAbsenceWorkspace>('/absence');
export const getHrTeam = (contextScopeKey?: string, signal?: AbortSignal) =>
  get<HrTeamWorkspace>('/team', contextScopeKey, signal);
export const getHrTeamTime = (contextScopeKey?: string, signal?: AbortSignal) =>
  get<HrTeamTimeWorkspace>('/team/time', contextScopeKey, signal);
export const getHrTeamAbsence = (contextScopeKey?: string, signal?: AbortSignal) =>
  get<HrTeamAbsenceWorkspace>('/team/absence', contextScopeKey, signal);
export const getHrBenefits = () => get<HrBenefitsWorkspace>('/benefits');
export const getHrPay = () => get<HrPayWorkspace>('/pay');
export const getHrTalent = () => get<HrTalentWorkspace>('/talent');
export const getHrDomainOperations = (
  domain: string,
  contextScopeKey?: string,
  signal?: AbortSignal
) => get<HrDomainOperations>(`/operations/${encodeURIComponent(domain)}`, contextScopeKey, signal);

export async function getHrWorkforceOperationsOverview(
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<HrWorkforceOperationsOverview> {
  const response = await axiosInstance.get<ApiResponse<HrWorkforceOperationsOverview>>(
    '/api/people/v1/workforce/operations/overview',
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export const HCM_HR_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'saveHrTimeEntry',
    routeContractKey: 'route.hcm.personal.time-entry-update.action',
    method: 'PUT',
    path: '/api/people/v1/hr/time/{cardId}/entries/{workDate}',
  },
  {
    apiFunction: 'submitHrTimeCard',
    routeContractKey: 'route.hcm.personal.time-submit.action',
    method: 'POST',
    path: '/api/people/v1/hr/time/{cardId}/submit',
  },
  {
    apiFunction: 'createHrLeaveRequest',
    routeContractKey: 'route.hcm.personal.absence-create.action',
    method: 'POST',
    path: '/api/people/v1/hr/absence/requests',
  },
  {
    apiFunction: 'withdrawHrLeaveRequest',
    routeContractKey: 'route.hcm.personal.absence-withdraw.action',
    method: 'POST',
    path: '/api/people/v1/hr/absence/requests/{requestId}/withdraw',
  },
  {
    apiFunction: 'decideHrRequest:time',
    routeContractKey: 'route.hcm.operations.time-approve.action',
    method: 'POST',
    path: '/api/people/v1/hr/time/{cardId}/decision',
  },
  {
    apiFunction: 'decideHrRequest:absence',
    routeContractKey: 'route.hcm.operations.absence-approve.action',
    method: 'POST',
    path: '/api/people/v1/hr/absence/requests/{requestId}/decision',
  },
  {
    apiFunction: 'decideHrTeamRequest:time',
    routeContractKey: 'route.hcm.team.time-decision.action',
    method: 'POST',
    path: '/api/people/v1/hr/team/time/{cardId}/decision',
  },
  {
    apiFunction: 'decideHrTeamRequest:absence',
    routeContractKey: 'route.hcm.team.absence-decision.action',
    method: 'POST',
    path: '/api/people/v1/hr/team/absence/{requestId}/decision',
  },
  {
    apiFunction: 'updateHrGoal',
    routeContractKey: 'route.hcm.personal.talent-goal-update.action',
    method: 'PUT',
    path: '/api/people/v1/hr/talent/goals/{goalId}',
  },
] as const;

export async function saveHrTimeEntry(
  cardId: string,
  workDate: string,
  request: { minutes: number; workMode: string; note?: string; cardVersion: number },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrTimeWorkspace> {
  const response = await axiosInstance.put<ApiResponse<HrTimeWorkspace>, typeof request>(
    `${BASE}/time/${encodeURIComponent(cardId)}/entries/${encodeURIComponent(workDate)}`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function submitHrTimeCard(
  cardId: string,
  version: number,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrTimeWorkspace> {
  const response = await axiosInstance.post<ApiResponse<HrTimeWorkspace>, undefined>(
    `${BASE}/time/${encodeURIComponent(cardId)}/submit?version=${version}`,
    undefined,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function createHrLeaveRequest(
  request: {
    planId: string;
    startAt: string;
    endAt: string;
    requestedMinutes: number;
    reason?: string;
  },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrLeaveRequest> {
  const response = await axiosInstance.post<ApiResponse<HrLeaveRequest>, typeof request>(
    `${BASE}/absence/requests`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function withdrawHrLeaveRequest(
  requestId: string,
  request: { note: string; version: number },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrAbsenceWorkspace> {
  const response = await axiosInstance.post<ApiResponse<HrAbsenceWorkspace>, typeof request>(
    `${BASE}/absence/requests/${encodeURIComponent(requestId)}/withdraw`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function decideHrRequest(
  domain: 'time' | 'absence',
  itemId: string,
  request: { decision: 'APPROVE' | 'REJECT'; note: string; version: number },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrApprovalItem> {
  const path =
    domain === 'time'
      ? `/time/${encodeURIComponent(itemId)}/decision`
      : `/absence/requests/${encodeURIComponent(itemId)}/decision`;
  const response = await axiosInstance.post<ApiResponse<HrApprovalItem>, typeof request>(
    `${BASE}${path}`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function decideHrTeamRequest(
  domain: 'time' | 'absence',
  itemId: string,
  request: { decision: 'APPROVE' | 'REJECT'; note: string; version: number },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrApprovalItem> {
  const response = await axiosInstance.post<ApiResponse<HrApprovalItem>, typeof request>(
    `${BASE}/team/${domain}/${encodeURIComponent(itemId)}/decision`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}

export async function updateHrGoal(
  goalId: string,
  request: { progressPercent: number; status: string; version: number },
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrTalentWorkspace> {
  const response = await axiosInstance.put<ApiResponse<HrTalentWorkspace>, typeof request>(
    `${BASE}/talent/goals/${encodeURIComponent(goalId)}`,
    request,
    productSurfaceGovernedMutationConfig(authority)
  );
  return response.data.data;
}
