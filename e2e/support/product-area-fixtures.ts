import type {
  ApprovalAdminPulse,
  ApprovalDelegation,
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormDetail,
  ApprovalHome,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalSignatureProvider,
  ApprovalTask,
  ApprovalTaskDetail,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
  CalendarAdminOverview,
  CalendarAvailability,
  CalendarBooking,
  CalendarEvent,
  CalendarHome,
  CalendarResource,
  CalendarSummary,
  HrAbsenceWorkspace,
  HrBenefitsWorkspace,
  HrDomainOperations,
  HrEmployeeContext,
  HrHomeOverview,
  HrPayWorkspace,
  HrTalentWorkspace,
  HrTimeWorkspace,
  ServiceCatalog,
  ServiceRequestSummary,
} from '@dwp-frontend/shared-utils';

const HR_SERVICE_DEFINITIONS = [
  [
    'people.personal-data-change',
    'Personal data change',
    'Update governed personal and contact information.',
  ],
  [
    'people.payroll-question',
    'Payroll question',
    'Ask a confidential question about a pay statement or cycle.',
  ],
  [
    'people.benefits-support',
    'Benefits support',
    'Get help with eligibility, coverage, or enrollment.',
  ],
  [
    'people.onboarding-support',
    'Onboarding support',
    'Resolve a new-hire or role-transition onboarding issue.',
  ],
  [
    'people.employment-certificate',
    'Employment certificate',
    'Request a verified employment certificate.',
  ],
  ['people.hr-general', 'General HR help', 'Route an HR question to the right specialist team.'],
] as const;

export const HR_SERVICE_CATALOG_FIXTURE = {
  categories: [
    {
      categoryKey: 'PEOPLE',
      name: 'People & HR',
      description: 'Personal, employment, pay, benefits, and lifecycle help.',
      iconKey: 'users-round',
      tone: 'teal',
      sortOrder: 20,
    },
  ],
  items: HR_SERVICE_DEFINITIONS.map(([serviceKey, name, description], index) => ({
    serviceKey,
    categoryKey: 'PEOPLE',
    name,
    description,
    ownerGroup: index === 1 ? 'PAYROLL_OPERATIONS' : 'PEOPLE_SERVICES',
    lifecycleState: 'ACTIVE' as const,
    requestSchema: {
      fields: [
        {
          key: 'detail',
          type: 'TEXTAREA' as const,
          labelKo: '요청 내용',
          labelEn: 'Request detail',
          required: true,
        },
      ],
    },
    schemaVersion: 1,
    slaHours: index === 1 ? 24 : 16,
    estimatedResolutionHours: index === 1 ? 24 : 12,
    dataClassification: index === 1 ? ('RESTRICTED' as const) : ('CONFIDENTIAL' as const),
    featured: index < 3,
    tags: ['HR', 'EMPLOYEE_SERVICE'],
    version: 1,
  })),
  activeCount: HR_SERVICE_DEFINITIONS.length,
  generatedAt: '2026-08-11T00:20:00Z',
} satisfies ServiceCatalog;

export const HR_SERVICE_REQUESTS_FIXTURE = [
  {
    requestId: 'service-request-people-001',
    requestNumber: 'HR-2026-0811-001',
    serviceKey: 'people.benefits-support',
    serviceNameKo: '복리후생 지원',
    serviceNameEn: 'Benefits support',
    summary: 'Confirm dependent enrollment evidence',
    dataClassification: 'CONFIDENTIAL',
    status: 'AWAITING_REQUESTER',
    priority: 'NORMAL',
    assignedGroup: 'People Services',
    assignedTo: null,
    submittedAt: '2026-08-10T02:00:00Z',
    slaDueAt: '2026-08-11T08:00:00Z',
    updatedAt: '2026-08-11T00:10:00Z',
    version: 2,
  },
] satisfies ServiceRequestSummary[];

export const HR_EMPLOYEE_FIXTURE = {
  personId: 'person-session-user',
  displayName: '박현우',
  businessTitle: 'Digital Platform lead',
  organizationName: 'Digital Workplace',
  managerDisplayName: '김민준',
  directReportCount: 2,
} satisfies HrEmployeeContext;

export const HR_TIME_FIXTURE = {
  employee: HR_EMPLOYEE_FIXTURE,
  card: {
    timeCardId: 'time-card-2026-w33',
    periodStart: '2026-08-10',
    periodEnd: '2026-08-16',
    status: 'OPEN',
    scheduledMinutes: 2400,
    recordedMinutes: 1020,
    exceptionCount: 1,
    dataOrigin: 'DWP_HRIS',
    version: 3,
  },
  entries: [
    {
      timeEntryId: 'time-entry-2026-08-10',
      workDate: '2026-08-10',
      entryType: 'REGULAR',
      minutes: 510,
      workMode: 'OFFICE',
      note: 'Seoul HQ',
      version: 1,
    },
    {
      timeEntryId: 'time-entry-2026-08-11',
      workDate: '2026-08-11',
      entryType: 'REGULAR',
      minutes: 510,
      workMode: 'REMOTE',
      note: null,
      version: 1,
    },
  ],
  exceptions: [
    {
      exceptionId: 'time-exception-001',
      exceptionCode: 'MISSING_BREAK_CONFIRMATION',
      severity: 'WARNING',
      occurredOn: '2026-08-11',
      message: 'Confirm the recorded break before submission.',
      lifecycleState: 'OPEN',
      resolutionNote: null,
    },
  ],
  teamQueue: [
    {
      itemId: 'time-card-minseo-w33',
      domain: 'TIME',
      personId: 'person-minseo-kim',
      employeeName: 'Minseo Kim',
      employeeTitle: 'Product design lead',
      summary: 'Weekly time card · 40h',
      status: 'SUBMITTED',
      submittedAt: '2026-08-11T00:05:00Z',
      version: 1,
    },
  ],
} satisfies HrTimeWorkspace;

export const HR_ABSENCE_FIXTURE = {
  employee: HR_EMPLOYEE_FIXTURE,
  balances: [
    {
      planId: 'leave-plan-annual',
      planKey: 'ANNUAL_LEAVE',
      planName: 'Annual leave',
      grantedMinutes: 9600,
      usedMinutes: 3360,
      pendingMinutes: 480,
      availableMinutes: 5760,
      asOf: '2026-08-11',
      dataOrigin: 'DWP_HRIS',
    },
  ],
  requests: [
    {
      requestId: 'leave-request-001',
      planId: 'leave-plan-annual',
      planName: 'Annual leave',
      startAt: '2026-08-21T00:00:00Z',
      endAt: '2026-08-21T09:00:00Z',
      requestedMinutes: 480,
      status: 'SUBMITTED',
      reason: 'Personal appointment',
      submittedAt: '2026-08-10T07:00:00Z',
      decisionNote: null,
      cancelledAt: null,
      cancellationNote: null,
      version: 1,
    },
  ],
  teamQueue: [
    {
      itemId: 'leave-request-team-001',
      domain: 'ABSENCE',
      personId: 'person-minseo-kim',
      employeeName: 'Minseo Kim',
      employeeTitle: 'Product design lead',
      summary: 'Annual leave · Aug 24',
      status: 'SUBMITTED',
      submittedAt: '2026-08-10T08:30:00Z',
      version: 1,
    },
  ],
  teamCalendar: [
    {
      requestId: 'leave-request-calendar-001',
      personId: 'person-jinho-park',
      employeeName: 'Jinho Park',
      employeeTitle: 'Network automation engineer',
      planName: 'Annual leave',
      startAt: '2026-08-18T00:00:00Z',
      endAt: '2026-08-18T09:00:00Z',
      status: 'APPROVED',
    },
  ],
} satisfies HrAbsenceWorkspace;

export const HR_BENEFITS_FIXTURE = {
  employee: HR_EMPLOYEE_FIXTURE,
  plans: [
    {
      planId: 'benefit-health-core',
      planType: 'HEALTH',
      name: 'Core health coverage',
      providerName: 'Enterprise Benefits',
      coverageLevel: 'FAMILY',
      status: 'ACTIVE',
      effectiveStart: '2026-01-01',
      effectiveEnd: null,
    },
    {
      planId: 'benefit-learning',
      planType: 'LEARNING',
      name: 'Learning allowance',
      providerName: 'DWP People',
      coverageLevel: 'EMPLOYEE',
      status: 'ACTIVE',
      effectiveStart: '2026-01-01',
      effectiveEnd: null,
    },
  ],
  windows: [
    {
      windowId: 'benefit-window-2027',
      name: '2027 annual enrollment',
      windowType: 'OPEN_ENROLLMENT',
      opensAt: '2026-08-01T00:00:00Z',
      closesAt: '2026-08-23T09:00:00Z',
      lifecycleState: 'OPEN',
    },
  ],
  referenceData: true,
} satisfies HrBenefitsWorkspace;

export const HR_PAY_FIXTURE = {
  employee: HR_EMPLOYEE_FIXTURE,
  nextCycle: {
    payCycleId: 'pay-cycle-2026-08',
    name: 'August payroll',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    payDate: '2026-08-25',
    status: 'VALIDATING',
    timeValidated: true,
    absenceValidated: true,
    sourceConfirmed: false,
    dataOrigin: 'REFERENCE',
  },
  statements: [
    {
      statementId: 'pay-statement-2026-07',
      periodLabel: 'July 2026',
      availabilityState: 'PUBLISHED',
      publishedAt: '2026-07-25T00:00:00Z',
      downloadable: false,
    },
  ],
  monetaryDataRedacted: true,
} satisfies HrPayWorkspace;

export const HR_TALENT_FIXTURE = {
  employee: HR_EMPLOYEE_FIXTURE,
  journeys: [
    {
      journeyId: 'journey-leadership',
      name: 'Leadership onboarding',
      journeyType: 'ROLE_TRANSITION',
      progressPercent: 68,
      targetDate: '2026-09-30',
      status: 'ACTIVE',
    },
  ],
  goals: [
    {
      goalId: 'goal-platform-reliability',
      title: 'Improve platform service reliability',
      goalType: 'PERFORMANCE',
      progressPercent: 72,
      dueDate: '2026-12-31',
      status: 'ON_TRACK',
      version: 2,
    },
  ],
  learning: [
    {
      learningId: 'learning-data-governance',
      title: 'Responsible data operations',
      providerName: 'DWP Academy',
      required: true,
      progressPercent: 40,
      dueDate: '2026-09-15',
      status: 'IN_PROGRESS',
    },
  ],
} satisfies HrTalentWorkspace;

export const HR_HOME_FIXTURE = {
  asOf: '2026-08-11',
  generatedAt: '2026-08-11T00:20:00Z',
  timeZone: 'Asia/Seoul',
  standardDayMinutes: 480,
  employee: HR_EMPLOYEE_FIXTURE,
  time: HR_TIME_FIXTURE.card,
  leaveBalances: HR_ABSENCE_FIXTURE.balances,
  pay: HR_PAY_FIXTURE.nextCycle,
  enrollmentWindows: HR_BENEFITS_FIXTURE.windows,
  journeys: HR_TALENT_FIXTURE.journeys,
  activeBenefitCount: HR_BENEFITS_FIXTURE.plans.length,
  openBenefitWindowCount: HR_BENEFITS_FIXTURE.windows.length,
  activeGoalCount: HR_TALENT_FIXTURE.goals.length,
  requiredLearningCount: HR_TALENT_FIXTURE.learning.filter((item) => item.required).length,
  teamPendingCount: 2,
  teamTimePendingCount: 1,
  teamAbsencePendingCount: 1,
  domainStates: {
    TIME: { availability: 'AVAILABLE', dataOrigin: 'REFERENCE', reasonCode: null },
    ABSENCE: { availability: 'AVAILABLE', dataOrigin: 'REFERENCE', reasonCode: null },
    BENEFITS: { availability: 'AVAILABLE', dataOrigin: 'REFERENCE', reasonCode: null },
    PAY: { availability: 'AVAILABLE', dataOrigin: 'REFERENCE', reasonCode: null },
    TALENT: { availability: 'AVAILABLE', dataOrigin: 'REFERENCE', reasonCode: null },
    TEAM: { availability: 'AVAILABLE', dataOrigin: 'UNKNOWN', reasonCode: null },
  },
  referenceDataPresent: true,
} satisfies HrHomeOverview;

export const hrDomainOperationsFixture = (domain: HrDomainOperations['domain']) =>
  ({
    domain,
    generatedAt: '2026-08-11T00:20:00Z',
    metrics: [
      {
        key: 'OPEN_WORK',
        value: domain === 'TIME' || domain === 'ABSENCE' ? 1 : 0,
        severity: 'INFO',
      },
      { key: 'DATA_QUALITY', value: 98, severity: 'HEALTHY' },
    ],
    workQueue:
      domain === 'TIME'
        ? HR_TIME_FIXTURE.teamQueue
        : domain === 'ABSENCE'
          ? HR_ABSENCE_FIXTURE.teamQueue
          : [],
    dataBoundary: 'TENANT',
  }) satisfies HrDomainOperations;

export const CALENDAR_EVENT_FIXTURE = {
  eventId: 'calendar-event-operating-review',
  calendarId: 'calendar-personal',
  calendarName: 'My calendar',
  calendarColor: '#2764C4',
  organizerUserId: 1,
  organizerName: '박현우',
  organizerEmail: 'hyunwoo.park@sk.com',
  title: 'Digital workplace operating review',
  description: 'Weekly decision and dependency review.',
  type: 'MEETING',
  startsAt: '2026-08-11T01:00:00Z',
  endsAt: '2026-08-11T01:45:00Z',
  timeZone: 'Asia/Seoul',
  allDay: false,
  location: 'Seoul HQ · Focus 08',
  conferenceUrl: 'https://meet.example.invalid/operating-review',
  status: 'CONFIRMED',
  visibility: 'DEFAULT',
  recurrence: 'WEEKLY',
  recurrenceInterval: 1,
  recurrenceUntil: null,
  responseRequired: true,
  myResponse: 'ACCEPTED',
  attendees: [
    {
      userId: 2,
      personPublicId: 'person-minseo-kim',
      email: 'minseo.kim@example.invalid',
      name: 'Minseo Kim',
      type: 'REQUIRED',
      response: 'ACCEPTED',
    },
  ],
  resource: null,
  conflict: false,
  version: 2,
} as const satisfies CalendarEvent;

export const CALENDAR_FOCUS_FIXTURE = {
  ...CALENDAR_EVENT_FIXTURE,
  eventId: 'calendar-event-focus',
  title: 'Protected focus time',
  type: 'FOCUS',
  startsAt: '2026-08-11T05:00:00Z',
  endsAt: '2026-08-11T06:30:00Z',
  location: null,
  conferenceUrl: null,
  responseRequired: false,
  myResponse: null,
  attendees: [],
  recurrence: 'NONE',
} as const satisfies CalendarEvent;

export const CALENDAR_RESOURCES_FIXTURE = [
  {
    resourceId: 'calendar-resource-focus-08',
    code: 'SEOUL-FOCUS-08',
    name: 'Focus 08',
    nameKo: '포커스 08',
    nameEn: 'Focus 08',
    type: 'ROOM',
    site: 'Seoul HQ',
    floor: '8F',
    capacity: 8,
    features: ['DISPLAY', 'VIDEO', 'WHITEBOARD'],
    timeZone: 'Asia/Seoul',
    approvalRequired: false,
    state: 'AVAILABLE',
    available: true,
    version: 1,
  },
  {
    resourceId: 'calendar-resource-studio-12',
    code: 'SEOUL-STUDIO-12',
    name: 'Collaboration studio 12',
    nameKo: '협업 스튜디오 12',
    nameEn: 'Collaboration studio 12',
    type: 'ROOM',
    site: 'Seoul HQ',
    floor: '12F',
    capacity: 20,
    features: ['DISPLAY', 'VIDEO', 'ACCESSIBLE'],
    timeZone: 'Asia/Seoul',
    approvalRequired: true,
    state: 'AVAILABLE',
    available: false,
    version: 3,
  },
] as const satisfies readonly CalendarResource[];

export const ROOM_BOOKING_EVENT_FIXTURE = {
  ...CALENDAR_EVENT_FIXTURE,
  eventId: 'room-booking-focus-08',
  title: 'Enterprise room booking review',
  description: 'Review the room booking workflow and operating policy.',
  startsAt: '2026-08-19T05:00:00Z',
  endsAt: '2026-08-19T06:00:00Z',
  location: CALENDAR_RESOURCES_FIXTURE[0].name,
  conferenceUrl: null,
  recurrence: 'NONE',
  resource: CALENDAR_RESOURCES_FIXTURE[0],
  version: 1,
} as const satisfies CalendarEvent;

export const CALENDAR_SUMMARIES_FIXTURE = [
  {
    calendarId: 'calendar-personal',
    calendarKey: 'PERSONAL',
    name: 'My calendar',
    color: '#2764C4',
    type: 'PERSONAL',
    visibility: 'PRIVATE',
    selected: true,
  },
  {
    calendarId: 'calendar-team',
    calendarKey: 'TEAM_DIGITAL_WORKPLACE',
    name: 'Digital Workplace',
    color: '#008C95',
    type: 'TEAM',
    visibility: 'DEFAULT',
    selected: true,
  },
] as const satisfies readonly CalendarSummary[];

export const CALENDAR_HOME_FIXTURE = {
  date: '2026-08-11',
  timeZone: 'Asia/Seoul',
  nextEvent: CALENDAR_EVENT_FIXTURE,
  today: [CALENDAR_EVENT_FIXTURE, CALENDAR_FOCUS_FIXTURE],
  metrics: {
    eventCount: 4,
    meetingMinutes: 135,
    focusMinutes: 150,
    focusTargetMinutes: 240,
    conflictCount: 0,
    awaitingResponseCount: 1,
    availableRoomCount: 7,
  },
  weekLoad: [
    ['2026-08-10', 180, 90, 5, 0, 62],
    ['2026-08-11', 135, 150, 4, 0, 55],
    ['2026-08-12', 240, 60, 6, 1, 78],
    ['2026-08-13', 120, 180, 4, 0, 50],
    ['2026-08-14', 90, 120, 3, 0, 38],
  ].map(([date, meetingMinutes, focusMinutes, eventCount, conflictCount, loadPercent]) => ({
    date: String(date),
    meetingMinutes: Number(meetingMinutes),
    focusMinutes: Number(focusMinutes),
    eventCount: Number(eventCount),
    conflictCount: Number(conflictCount),
    loadPercent: Number(loadPercent),
  })),
  attention: [
    {
      key: 'calendar-response-needed',
      severity: 'MEDIUM',
      title: 'One invitation needs your response',
      description: 'Resolve it before the organizer finalizes the room.',
      eventId: CALENDAR_EVENT_FIXTURE.eventId,
      actionPath: '/calendar/schedule',
    },
  ],
  generatedAt: '2026-08-11T00:20:00Z',
} satisfies CalendarHome;

export const CALENDAR_ADMIN_FIXTURE = {
  activeResources: 18,
  resourcesInMaintenance: 1,
  bookingsThisWeek: 94,
  pendingBookings: 1,
  eventsThisWeek: 436,
  conflictedUsers: 3,
  policy: {
    weekStart: 1,
    workingDayStart: '09:00',
    workingDayEnd: '18:00',
    defaultEventMinutes: 30,
    minimumEventMinutes: 15,
    maximumEventMinutes: 480,
    maximumAdvanceDays: 180,
    defaultBufferMinutes: 10,
    weeklyFocusTargetMinutes: 240,
    dailyMeetingLimitMinutes: 300,
    enforceMeetingAgenda: true,
    allowExternalAttendees: true,
    version: 4,
  },
  resources: [...CALENDAR_RESOURCES_FIXTURE],
  generatedAt: '2026-08-11T00:20:00Z',
} satisfies CalendarAdminOverview;

export const CALENDAR_BOOKINGS_FIXTURE = [
  {
    bookingId: 'calendar-booking-studio-12',
    eventId: 'calendar-event-town-hall',
    resourceId: 'calendar-resource-studio-12',
    resourceName: 'Collaboration studio 12',
    eventTitle: 'Quarterly people town hall',
    startsAt: '2026-08-13T05:00:00Z',
    endsAt: '2026-08-13T07:00:00Z',
    organizerName: 'Minseo Kim',
    organizerEmail: 'minseo.kim@example.invalid',
    status: 'PENDING',
    requestedBy: 2,
    decisionNote: null,
    decidedAt: null,
    decidedBy: null,
    version: 1,
  },
] satisfies CalendarBooking[];

export const CALENDAR_AVAILABILITY_FIXTURE = {
  participants: [{ personPublicId: 'person-minseo-kim', busyMinutes: 180, availableSlotCount: 4 }],
  suggestions: [
    {
      startsAt: '2026-08-11T07:00:00Z',
      endsAt: '2026-08-11T07:30:00Z',
      score: 96,
      reason: 'All participants are available and focus time is preserved.',
    },
  ],
  generatedAt: '2026-08-11T00:20:00Z',
} satisfies CalendarAvailability;

export const APPROVAL_TASK_FIXTURE = {
  taskId: 'approval-task-001',
  requestId: 'approval-request-001',
  requestNumber: 'APR-2026-0811-001',
  title: 'Customer data access exception',
  summary: 'Temporary access for a governed production investigation.',
  workflowNameKo: '데이터 접근 예외',
  workflowNameEn: 'Data access exception',
  stepKey: 'SECURITY_REVIEW',
  stepName: 'Security review',
  stepSequence: 2,
  requesterName: 'Minseo Kim',
  requesterOrgName: 'Digital Workplace',
  status: 'PENDING',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  riskScore: 72,
  submittedAt: '2026-08-10T23:30:00Z',
  dueAt: '2026-08-11T08:00:00Z',
  version: 3,
} as const satisfies ApprovalTask;

export const APPROVAL_REQUEST_FIXTURE = {
  requestId: APPROVAL_TASK_FIXTURE.requestId,
  requestNumber: APPROVAL_TASK_FIXTURE.requestNumber,
  title: APPROVAL_TASK_FIXTURE.title,
  summary: APPROVAL_TASK_FIXTURE.summary,
  workflowNameKo: APPROVAL_TASK_FIXTURE.workflowNameKo,
  workflowNameEn: APPROVAL_TASK_FIXTURE.workflowNameEn,
  currentStepKey: APPROVAL_TASK_FIXTURE.stepKey,
  currentStepName: APPROVAL_TASK_FIXTURE.stepName,
  currentStepSequence: 2,
  totalSteps: 3,
  status: 'IN_REVIEW',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  latestInformationRequest: null,
  submittedAt: '2026-08-10T23:30:00Z',
  dueAt: '2026-08-11T08:00:00Z',
  completedAt: null,
  version: 3,
} as const satisfies ApprovalRequest;

export const APPROVAL_WORKFLOW_FIXTURE = {
  workflowId: 'approval-workflow-data-access',
  workflowKey: 'DATA_ACCESS_EXCEPTION',
  nameKo: '데이터 접근 예외',
  nameEn: 'Data access exception',
  descriptionKo: '민감 데이터 접근을 최소 권한과 기한 기준으로 검토합니다.',
  descriptionEn: 'Reviews sensitive-data access with least privilege and expiry controls.',
  category: 'SECURITY',
  dataClassification: 'CONFIDENTIAL',
  lifecycleState: 'PUBLISHED',
  currentVersion: 4,
  slaMinutes: 480,
  allowSelfApproval: false,
  ownerGroupRef: 'SECURITY_GOVERNANCE',
  version: 4,
  updatedAt: '2026-08-10T04:00:00Z',
} as const satisfies ApprovalWorkflow;

export const APPROVAL_WORKFLOW_DETAIL_FIXTURE = {
  workflow: APPROVAL_WORKFLOW_FIXTURE,
  definition: {
    schemaVersion: 2,
    steps: [
      {
        key: 'MANAGER_REVIEW',
        name: 'Manager review',
        mode: 'ANY',
        candidateRole: 'MANAGER',
        slaMinutes: 240,
      },
      {
        key: 'SECURITY_REVIEW',
        name: 'Security review',
        mode: 'ANY',
        candidateRole: 'SECURITY_APPROVER',
        slaMinutes: 480,
      },
    ],
    guardrails: { selfApproval: false, immutableEvidence: true },
  },
  definitionHash: 'fixture-workflow-hash',
} satisfies ApprovalWorkflowDetail;

export const APPROVAL_FORM_FIXTURE = {
  formId: 'approval-form-data-access',
  formKey: 'DATA_ACCESS_EXCEPTION',
  categoryId: 'approval-category-access',
  categoryKey: 'ACCESS',
  categoryNameKo: '접근·보안',
  categoryNameEn: 'Access and security',
  nameKo: '데이터 접근 예외 신청서',
  nameEn: 'Data access exception form',
  descriptionKo: '제한 데이터 접근에 필요한 예외 승인과 만료 조건을 관리합니다.',
  descriptionEn: 'Governs exception approval and expiry conditions for restricted data access.',
  ownerGroupRef: 'SECURITY_APPROVER',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 3,
  fieldCount: 4,
  routeCount: 1,
  usageCount: 7,
  version: 3,
  updatedAt: '2026-08-10T04:00:00Z',
} as const satisfies ApprovalForm;

export const APPROVAL_FORM_CATEGORY_FIXTURES = [
  {
    categoryId: 'approval-category-access',
    categoryKey: 'ACCESS',
    parentCategoryId: null,
    nameKo: '접근·보안',
    nameEn: 'Access and security',
    descriptionKo: '권한 요청과 보안 예외를 위한 제한 양식입니다.',
    descriptionEn: 'Restricted forms for access requests and security exceptions.',
    iconKey: 'shield-check',
    sortOrder: 50,
    lifecycleState: 'ACTIVE',
    formCount: 1,
    version: 0,
  },
] as const satisfies ApprovalFormCategory[];

export const APPROVAL_FORM_DETAIL_FIXTURE = {
  form: APPROVAL_FORM_FIXTURE,
  schema: {
    schemaVersion: 2,
    fields: [
      {
        key: 'businessReason',
        labelKo: '업무 사유',
        labelEn: 'Business reason',
        type: 'TEXTAREA',
        required: true,
      },
      { key: 'expiresOn', labelKo: '만료일', labelEn: 'Expiry date', type: 'DATE', required: true },
      {
        key: 'dataScope',
        labelKo: '데이터 범위',
        labelEn: 'Data scope',
        type: 'TEXT',
        required: true,
      },
      {
        key: 'riskLevel',
        labelKo: '위험 수준',
        labelEn: 'Risk level',
        type: 'SELECT',
        required: true,
        options: ['LOW', 'MEDIUM', 'HIGH'],
      },
    ],
  },
  schemaHash: 'fixture-form-hash',
  routes: [
    {
      bindingId: 'approval-binding-data-access',
      workflowId: 'approval-workflow-data-access',
      workflowKey: 'DATA_ACCESS_EXCEPTION',
      workflowNameKo: '데이터 접근 예외',
      workflowNameEn: 'Data access exception',
      workflowLifecycleState: 'PUBLISHED',
      workflowVersion: 4,
      slaMinutes: 480,
      bindingType: 'DEFAULT',
      priority: 100,
    },
  ],
} satisfies ApprovalFormDetail;

export const APPROVAL_HOME_FIXTURE = {
  generatedAt: '2026-08-11T00:20:00Z',
  metrics: {
    pending: 6,
    dueToday: 2,
    overdue: 1,
    needsInformation: 1,
    myRequestsInFlight: 4,
    averageCycleHours: 5.8,
    slaCompliancePercent: 94,
  },
  focusQueue: [APPROVAL_TASK_FIXTURE],
  recentRequests: [APPROVAL_REQUEST_FIXTURE],
  flow: [
    { stage: 'SUBMITTED', count: 8, atRisk: 0 },
    { stage: 'IN_REVIEW', count: 12, atRisk: 2 },
    { stage: 'COMPLETED', count: 31, atRisk: 0 },
  ],
  insights: [
    {
      key: 'approval-sla-risk',
      tone: 'WARNING',
      titleKo: '오늘 만료되는 결재 2건',
      titleEn: 'Two decisions are due today',
      detailKo: '위험도가 높은 항목부터 검토하세요.',
      detailEn: 'Review the highest-risk item first.',
      route: '/approvals/inbox',
    },
  ],
  administrator: true,
  adminPulse: {
    publishedWorkflows: 12,
    draftWorkflows: 3,
    activeRequests: 24,
    overdueTasks: 1,
    failedIntegrations: 0,
  },
} satisfies ApprovalHome;

export const APPROVAL_ADMIN_FIXTURE = {
  publishedWorkflows: 12,
  draftWorkflows: 3,
  activeRequests: 24,
  overdueTasks: 1,
  failedIntegrations: 0,
} satisfies ApprovalAdminPulse;

export const APPROVAL_TASK_DETAIL_FIXTURE = {
  task: APPROVAL_TASK_FIXTURE,
  payload: {
    businessReason: 'Restore a customer-facing integration within the approved support window.',
    expiresOn: '2026-08-12',
    dataScope: 'Tenant-scoped diagnostic events',
  },
  formSchema: APPROVAL_FORM_DETAIL_FIXTURE.schema,
  timeline: [
    {
      eventId: 'approval-event-001',
      eventType: 'REQUEST_SUBMITTED',
      actorType: 'USER',
      actorId: '2',
      outcome: 'SUBMITTED',
      message: 'Submitted with an eight-hour support window.',
      occurredAt: '2026-08-10T23:30:00Z',
    },
  ],
  canClaim: false,
  canDecide: true,
  selfApprovalBlocked: false,
} satisfies ApprovalTaskDetail;

export const APPROVAL_REQUEST_DETAIL_FIXTURE = {
  request: APPROVAL_REQUEST_FIXTURE,
  workflowId: APPROVAL_WORKFLOW_FIXTURE.workflowId,
  formId: APPROVAL_FORM_FIXTURE.formId,
  payload: APPROVAL_TASK_DETAIL_FIXTURE.payload,
  formSchema: APPROVAL_FORM_DETAIL_FIXTURE.schema,
  timeline: APPROVAL_TASK_DETAIL_FIXTURE.timeline,
} satisfies ApprovalRequestDetail;

export const APPROVAL_POLICIES_FIXTURE = [
  {
    policyId: 'approval-policy-separation',
    policyKey: 'SEGREGATION_OF_DUTIES',
    nameKo: '요청자와 승인자 분리',
    nameEn: 'Requester and approver separation',
    policyType: 'SEGREGATION_OF_DUTIES',
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    lifecycleState: 'ACTIVE',
    rule: { requesterCannotApprove: true },
    version: 2,
  },
] satisfies ApprovalPolicy[];

export const APPROVAL_OPERATIONS_FIXTURE = {
  generatedAt: '2026-08-11T00:20:00Z',
  signals: [
    {
      key: 'delivery',
      state: 'HEALTHY',
      titleKo: '결재 전달',
      titleEn: 'Decision delivery',
      detailKo: '모든 전달 채널이 정상입니다.',
      detailEn: 'All delivery channels are healthy.',
      count: 0,
    },
    {
      key: 'sla',
      state: 'ATTENTION',
      titleKo: 'SLA 위험',
      titleEn: 'SLA at risk',
      detailKo: '1건이 운영자 확인을 기다립니다.',
      detailEn: 'One item is waiting for operator review.',
      count: 1,
    },
  ],
  breachedTasks: [APPROVAL_TASK_FIXTURE],
  integrationDeliveries: [
    {
      outboxId: 'approval-outbox-failed-001',
      eventId: 'approval-integration-event-001',
      requestId: APPROVAL_REQUEST_FIXTURE.requestId,
      eventType: 'approval.request.approved',
      status: 'FAILED',
      attemptCount: 3,
      manualRetryCount: 0,
      availableAt: '2026-08-11T00:15:00Z',
      publishedAt: null,
      lastError: 'Downstream endpoint returned 503',
      createdAt: '2026-08-11T00:10:00Z',
      lastRetriedAt: null,
      version: 7,
    },
  ],
} satisfies ApprovalOperations;

export const APPROVAL_SIGNATURE_FIXTURES = [
  {
    providerId: 'signature-provider-enterprise',
    providerKey: 'ENTERPRISE_SIGNATURE',
    displayName: 'Enterprise e-signature',
    providerType: 'REST',
    lifecycleState: 'PILOT',
    capabilities: { embeddedSigning: true, qualifiedCertificate: false },
    credentialConfigured: false,
    lastHealthCheckedAt: null,
    version: 1,
  },
] satisfies ApprovalSignatureProvider[];

export const APPROVAL_DELEGATIONS_FIXTURE = [
  {
    delegationId: 'approval-delegation-001',
    delegatorUserId: 1,
    delegateUserId: 2,
    scopeType: 'WORKFLOW',
    workflowId: APPROVAL_WORKFLOW_FIXTURE.workflowId,
    workflowKey: APPROVAL_WORKFLOW_FIXTURE.workflowKey,
    startsAt: '2026-08-17T00:00:00Z',
    endsAt: '2026-08-21T09:00:00Z',
    lifecycleState: 'SCHEDULED',
    reason: 'Planned leave coverage',
    version: 1,
  },
] satisfies ApprovalDelegation[];
