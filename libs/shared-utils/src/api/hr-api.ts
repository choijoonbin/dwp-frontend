import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

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
  dataBoundary: string;
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

async function get<T>(path: string): Promise<T> {
  const response = await axiosInstance.get<ApiResponse<T>>(`${BASE}${path}`);
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
export const getHrBenefits = () => get<HrBenefitsWorkspace>('/benefits');
export const getHrPay = () => get<HrPayWorkspace>('/pay');
export const getHrTalent = () => get<HrTalentWorkspace>('/talent');
export const getHrDomainOperations = (domain: string) =>
  get<HrDomainOperations>(`/operations/${encodeURIComponent(domain)}`);

export async function saveHrTimeEntry(
  cardId: string,
  workDate: string,
  request: { minutes: number; workMode: string; note?: string; cardVersion: number }
): Promise<HrTimeWorkspace> {
  const response = await axiosInstance.put<ApiResponse<HrTimeWorkspace>, typeof request>(
    `${BASE}/time/${encodeURIComponent(cardId)}/entries/${encodeURIComponent(workDate)}`,
    request
  );
  return response.data.data;
}

export async function submitHrTimeCard(cardId: string, version: number): Promise<HrTimeWorkspace> {
  const response = await axiosInstance.post<ApiResponse<HrTimeWorkspace>, undefined>(
    `${BASE}/time/${encodeURIComponent(cardId)}/submit?version=${version}`,
    undefined
  );
  return response.data.data;
}

export async function createHrLeaveRequest(request: {
  planId: string;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  reason?: string;
}): Promise<HrLeaveRequest> {
  const response = await axiosInstance.post<ApiResponse<HrLeaveRequest>, typeof request>(
    `${BASE}/absence/requests`,
    request
  );
  return response.data.data;
}

export async function withdrawHrLeaveRequest(
  requestId: string,
  request: { note: string; version: number }
): Promise<HrAbsenceWorkspace> {
  const response = await axiosInstance.post<ApiResponse<HrAbsenceWorkspace>, typeof request>(
    `${BASE}/absence/requests/${encodeURIComponent(requestId)}/withdraw`,
    request
  );
  return response.data.data;
}

export async function decideHrRequest(
  domain: 'time' | 'absence',
  itemId: string,
  request: { decision: 'APPROVE' | 'REJECT'; note: string; version: number }
): Promise<HrApprovalItem> {
  const path =
    domain === 'time'
      ? `/time/${encodeURIComponent(itemId)}/decision`
      : `/absence/requests/${encodeURIComponent(itemId)}/decision`;
  const response = await axiosInstance.post<ApiResponse<HrApprovalItem>, typeof request>(
    `${BASE}${path}`,
    request
  );
  return response.data.data;
}

export async function updateHrGoal(
  goalId: string,
  request: { progressPercent: number; status: string; version: number }
): Promise<HrTalentWorkspace> {
  const response = await axiosInstance.put<ApiResponse<HrTalentWorkspace>, typeof request>(
    `${BASE}/talent/goals/${encodeURIComponent(goalId)}`,
    request
  );
  return response.data.data;
}
