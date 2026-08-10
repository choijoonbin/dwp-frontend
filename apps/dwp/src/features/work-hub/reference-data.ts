export type Priority = 'high' | 'medium' | 'low';
export type WorkStatus = 'due-soon' | 'in-progress' | 'waiting' | 'completed';

export type TodayItem = {
  id: string;
  title: string;
  type: 'approval' | 'task' | 'service' | 'required';
  priority: Priority;
  reason: string;
  dueLabel: string;
  duration: string;
  source: string;
  actionRoute: string;
};

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  detail: string;
  kind: 'meeting' | 'focus' | 'deadline';
};

export type ReferenceWorkItem = {
  id: string;
  title: string;
  type: 'Approval' | 'Task' | 'Service' | 'Required';
  priority: Priority;
  status: WorkStatus;
  due: string;
  sourceSystem: string;
  owner: string;
};

export type ReferenceApp = {
  id: string;
  name: string;
  description: string;
  owner: string;
  type: 'productivity' | 'service' | 'people' | 'knowledge' | 'business' | 'legacy';
  launchMode: 'Native' | 'SSO' | 'Deep link';
  pinned: boolean;
  health: 'healthy' | 'managed' | 'attention';
  lastUsed: string;
};

export type ActivityActor = 'agent' | 'person' | 'system';
export type ActivityState = 'running' | 'needs-input' | 'completed' | 'policy-blocked';

export type ActivityEvent = {
  id: string;
  time: string;
  actor: ActivityActor;
  actorName: string;
  state: ActivityState;
  title: string;
  summary: string;
  objectLabel: string;
  source: string;
  tool?: string;
  auditId: string;
  progress?: number;
};

export type ReferenceTranslate = (key: string, options?: Record<string, string | number>) => string;

function localizeField(
  translate: ReferenceTranslate,
  collection: string,
  id: string,
  field: string,
  fallback: string
): string {
  return translate(`reference.${collection}.${id}.${field}`, { defaultValue: fallback });
}

export const todayItems: TodayItem[] = [
  {
    id: 'ref-today-approval',
    title: 'Approve software access request',
    type: 'approval',
    priority: 'high',
    reason: 'Blocks a new team member',
    dueLabel: 'Due in 45 min',
    duration: '2 min',
    source: 'IT Service',
    actionRoute: '/work?item=WK-1042',
  },
  {
    id: 'ref-today-briefing',
    title: 'Review customer briefing notes',
    type: 'task',
    priority: 'high',
    reason: 'Meeting starts at 11:00',
    dueLabel: 'Due at 10:40',
    duration: '12 min',
    source: 'Microsoft 365',
    actionRoute: '/work?item=WK-1045',
  },
  {
    id: 'ref-today-benefits',
    title: 'Confirm benefits enrollment',
    type: 'service',
    priority: 'medium',
    reason: 'Enrollment window closes today',
    dueLabel: 'Due today',
    duration: '5 min',
    source: 'People Service',
    actionRoute: '/work?item=WK-1043',
  },
  {
    id: 'ref-today-training',
    title: 'Complete security awareness module',
    type: 'required',
    priority: 'low',
    reason: 'Required policy acknowledgement',
    dueLabel: 'Due tomorrow',
    duration: '15 min',
    source: 'Learning',
    actionRoute: '/work?item=WK-1046',
  },
];

export const scheduleItems: ScheduleItem[] = [
  {
    id: 'ref-schedule-standup',
    time: '09:30',
    title: 'Product stand-up',
    detail: '25 min / Teams',
    kind: 'meeting',
  },
  {
    id: 'ref-schedule-customer',
    time: '11:00',
    title: 'Customer discovery',
    detail: '50 min / Meeting room 3',
    kind: 'meeting',
  },
  {
    id: 'ref-schedule-focus',
    time: '14:00',
    title: 'Focus time',
    detail: '90 min',
    kind: 'focus',
  },
  {
    id: 'ref-schedule-deadline',
    time: '17:00',
    title: 'Benefits enrollment closes',
    detail: 'People Service',
    kind: 'deadline',
  },
];

export const workItems: ReferenceWorkItem[] = [
  {
    id: 'WK-1042',
    title: 'Approve software access request',
    type: 'Approval',
    priority: 'high',
    status: 'due-soon',
    due: 'Today, 10:30',
    sourceSystem: 'IT Service',
    owner: 'You',
  },
  {
    id: 'WK-1045',
    title: 'Review customer briefing notes',
    type: 'Task',
    priority: 'high',
    status: 'in-progress',
    due: 'Today, 10:40',
    sourceSystem: 'Microsoft 365',
    owner: 'You',
  },
  {
    id: 'WK-1043',
    title: 'Confirm benefits enrollment',
    type: 'Service',
    priority: 'medium',
    status: 'waiting',
    due: 'Today, 17:00',
    sourceSystem: 'People Service',
    owner: 'You',
  },
  {
    id: 'WK-1046',
    title: 'Complete security awareness module',
    type: 'Required',
    priority: 'low',
    status: 'due-soon',
    due: 'Tomorrow',
    sourceSystem: 'Learning',
    owner: 'You',
  },
  {
    id: 'WK-1038',
    title: 'Review quarterly objectives',
    type: 'Task',
    priority: 'medium',
    status: 'in-progress',
    due: 'Aug 12',
    sourceSystem: 'People Service',
    owner: 'You',
  },
  {
    id: 'WK-1027',
    title: 'Travel expense follow-up',
    type: 'Service',
    priority: 'low',
    status: 'completed',
    due: 'Aug 7',
    sourceSystem: 'Finance',
    owner: 'Shared Services',
  },
];

export const referenceApps: ReferenceApp[] = [
  {
    id: 'ref-app-mail',
    name: 'Mail & calendar',
    description: 'Messages, calendar, and meeting actions',
    owner: 'Workplace Platform',
    type: 'productivity',
    launchMode: 'SSO',
    pinned: true,
    health: 'healthy',
    lastUsed: '8 min ago',
  },
  {
    id: 'ref-app-collaboration',
    name: 'Collaboration',
    description: 'Chat, channels, and meetings',
    owner: 'Workplace Platform',
    type: 'productivity',
    launchMode: 'SSO',
    pinned: true,
    health: 'healthy',
    lastUsed: '22 min ago',
  },
  {
    id: 'ref-app-service',
    name: 'Employee services',
    description: 'HR, IT, and workplace requests',
    owner: 'Shared Services',
    type: 'service',
    launchMode: 'Native',
    pinned: true,
    health: 'healthy',
    lastUsed: 'Yesterday',
  },
  {
    id: 'ref-app-people',
    name: 'People directory',
    description: 'Profiles, teams, roles, and contact details',
    owner: 'People Operations',
    type: 'people',
    launchMode: 'Native',
    pinned: false,
    health: 'managed',
    lastUsed: 'Aug 5',
  },
  {
    id: 'ref-app-knowledge',
    name: 'Knowledge',
    description: 'Policies, guides, and verified answers',
    owner: 'Knowledge Office',
    type: 'knowledge',
    launchMode: 'Native',
    pinned: false,
    health: 'healthy',
    lastUsed: '2 hours ago',
  },
  {
    id: 'ref-app-erp',
    name: 'Business ERP',
    description: 'Finance and purchasing workspace',
    owner: 'Finance Systems',
    type: 'business',
    launchMode: 'Deep link',
    pinned: false,
    health: 'managed',
    lastUsed: 'Jul 31',
  },
  {
    id: 'ref-app-legacy',
    name: 'Legacy operations',
    description: 'Existing operational system',
    owner: 'Enterprise Applications',
    type: 'legacy',
    launchMode: 'SSO',
    pinned: false,
    health: 'attention',
    lastUsed: 'Jul 28',
  },
];

export const activityEvents: ActivityEvent[] = [
  {
    id: 'ACT-2081',
    time: '09:12',
    actor: 'agent',
    actorName: 'Briefing agent',
    state: 'running',
    title: 'Building customer discovery context',
    summary: 'Comparing the meeting brief with six permitted workspace sources.',
    objectLabel: 'Customer discovery / 11:00',
    source: 'DWP Knowledge',
    tool: 'Enterprise search',
    auditId: 'AUD-20260808-2081',
    progress: 72,
  },
  {
    id: 'ACT-2079',
    time: '09:08',
    actor: 'system',
    actorName: 'Policy engine',
    state: 'needs-input',
    title: 'Software access request needs your approval',
    summary: 'Role and license checks passed. Manager approval is the remaining gate.',
    objectLabel: 'WK-1042 / Software access',
    source: 'IT Service',
    tool: 'Access policy',
    auditId: 'AUD-20260808-2079',
  },
  {
    id: 'ACT-2074',
    time: '08:54',
    actor: 'person',
    actorName: 'Mina Kim',
    state: 'completed',
    title: 'Added three questions to the customer brief',
    summary: 'The questions were linked to the discovery agenda and assigned to you.',
    objectLabel: 'Customer briefing notes',
    source: 'Microsoft 365',
    auditId: 'AUD-20260808-2074',
  },
  {
    id: 'ACT-2068',
    time: '08:41',
    actor: 'system',
    actorName: 'People connector',
    state: 'completed',
    title: 'Benefits enrollment deadline synchronized',
    summary: 'The 17:00 deadline was verified against the employee service calendar.',
    objectLabel: 'Benefits enrollment',
    source: 'People Service',
    tool: 'Calendar sync',
    auditId: 'AUD-20260808-2068',
  },
  {
    id: 'ACT-2051',
    time: '08:15',
    actor: 'agent',
    actorName: 'Service agent',
    state: 'policy-blocked',
    title: 'Restricted payroll query stopped by policy',
    summary: 'No payroll content was retrieved or sent to a model.',
    objectLabel: 'Private knowledge request',
    source: 'DWP Policy',
    tool: 'Retrieval guard',
    auditId: 'AUD-20260808-2051',
  },
];

export const askSources = [
  {
    id: 'ref-source-policy',
    title: 'Flexible work policy',
    sourceType: 'Policy library',
    detail: 'Owner: People Operations / Version 3.2 / Updated Jul 28',
    state: 'current' as const,
  },
  {
    id: 'ref-source-guide',
    title: 'Remote work request guide',
    sourceType: 'Employee services',
    detail: 'Owner: Shared Services / Updated Aug 2',
    state: 'current' as const,
  },
];

export const askPlanSteps = [
  {
    id: 'ref-step-review',
    title: 'Review request details',
    description: 'Confirm dates, work location, and manager.',
    tool: 'Preview only',
  },
  {
    id: 'ref-step-submit',
    title: 'Create a flexible work request',
    description: 'No request is created until you confirm in Employee services.',
    tool: 'Employee services',
  },
];

export function localizeTodayItems(translate: ReferenceTranslate): TodayItem[] {
  return todayItems.map((item) => ({
    ...item,
    title: localizeField(translate, 'today', item.id, 'title', item.title),
    reason: localizeField(translate, 'today', item.id, 'reason', item.reason),
    dueLabel: localizeField(translate, 'today', item.id, 'dueLabel', item.dueLabel),
    duration: localizeField(translate, 'today', item.id, 'duration', item.duration),
    source: localizeField(translate, 'today', item.id, 'source', item.source),
  }));
}

export function localizeScheduleItems(translate: ReferenceTranslate): ScheduleItem[] {
  return scheduleItems.map((item) => ({
    ...item,
    title: localizeField(translate, 'schedule', item.id, 'title', item.title),
    detail: localizeField(translate, 'schedule', item.id, 'detail', item.detail),
  }));
}

export function localizeWorkItems(translate: ReferenceTranslate): ReferenceWorkItem[] {
  return workItems.map((item) => ({
    ...item,
    title: localizeField(translate, 'work', item.id, 'title', item.title),
    due: localizeField(translate, 'work', item.id, 'due', item.due),
    sourceSystem: localizeField(translate, 'work', item.id, 'sourceSystem', item.sourceSystem),
    owner: localizeField(translate, 'work', item.id, 'owner', item.owner),
  }));
}

export function localizeReferenceApps(translate: ReferenceTranslate): ReferenceApp[] {
  return referenceApps.map((app) => ({
    ...app,
    name: localizeField(translate, 'apps', app.id, 'name', app.name),
    description: localizeField(translate, 'apps', app.id, 'description', app.description),
    owner: localizeField(translate, 'apps', app.id, 'owner', app.owner),
    lastUsed: localizeField(translate, 'apps', app.id, 'lastUsed', app.lastUsed),
  }));
}

export function localizeActivityEvents(translate: ReferenceTranslate): ActivityEvent[] {
  return activityEvents.map((event) => ({
    ...event,
    actorName: localizeField(translate, 'activity', event.id, 'actorName', event.actorName),
    title: localizeField(translate, 'activity', event.id, 'title', event.title),
    summary: localizeField(translate, 'activity', event.id, 'summary', event.summary),
    objectLabel: localizeField(translate, 'activity', event.id, 'objectLabel', event.objectLabel),
    source: localizeField(translate, 'activity', event.id, 'source', event.source),
    tool: event.tool
      ? localizeField(translate, 'activity', event.id, 'tool', event.tool)
      : undefined,
  }));
}

export function localizeAskSources(translate: ReferenceTranslate): typeof askSources {
  return askSources.map((source) => ({
    ...source,
    title: localizeField(translate, 'askSources', source.id, 'title', source.title),
    sourceType: localizeField(translate, 'askSources', source.id, 'sourceType', source.sourceType),
    detail: localizeField(translate, 'askSources', source.id, 'detail', source.detail),
  }));
}

export function localizeAskPlanSteps(translate: ReferenceTranslate): typeof askPlanSteps {
  return askPlanSteps.map((step) => ({
    ...step,
    title: localizeField(translate, 'askSteps', step.id, 'title', step.title),
    description: localizeField(translate, 'askSteps', step.id, 'description', step.description),
    tool: localizeField(translate, 'askSteps', step.id, 'tool', step.tool),
  }));
}
