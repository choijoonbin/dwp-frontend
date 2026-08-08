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
};

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
  },
  {
    id: 'ref-app-collaboration',
    name: 'Collaboration',
    description: 'Chat, channels, and meetings',
    owner: 'Workplace Platform',
    type: 'productivity',
    launchMode: 'SSO',
    pinned: true,
  },
  {
    id: 'ref-app-service',
    name: 'Employee services',
    description: 'HR, IT, and workplace requests',
    owner: 'Shared Services',
    type: 'service',
    launchMode: 'Native',
    pinned: true,
  },
  {
    id: 'ref-app-people',
    name: 'People directory',
    description: 'Profiles, teams, roles, and contact details',
    owner: 'People Operations',
    type: 'people',
    launchMode: 'Native',
    pinned: false,
  },
  {
    id: 'ref-app-knowledge',
    name: 'Knowledge',
    description: 'Policies, guides, and verified answers',
    owner: 'Knowledge Office',
    type: 'knowledge',
    launchMode: 'Native',
    pinned: false,
  },
  {
    id: 'ref-app-erp',
    name: 'Business ERP',
    description: 'Finance and purchasing workspace',
    owner: 'Finance Systems',
    type: 'business',
    launchMode: 'Deep link',
    pinned: false,
  },
  {
    id: 'ref-app-legacy',
    name: 'Legacy operations',
    description: 'Existing operational system',
    owner: 'Enterprise Applications',
    type: 'legacy',
    launchMode: 'SSO',
    pinned: false,
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
