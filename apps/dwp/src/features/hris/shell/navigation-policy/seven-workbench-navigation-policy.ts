import { HRIS_RUNTIME_NAVIGATION_MANIFEST } from '../model/hris-runtime-navigation-manifest';

export const HRIS_WORKBENCH_IDS = [
  'HRIS-WB-MY-HR',
  'HRIS-WB-TEAM',
  'HRIS-WB-HR-OPERATIONS',
  'HRIS-WB-TIME',
  'HRIS-WB-PAYROLL',
  'HRIS-WB-PERFORMANCE',
  'HRIS-WB-SETTINGS',
] as const;

export type HrisWorkbenchId = (typeof HRIS_WORKBENCH_IDS)[number];

export type HrisTaskNavigationNode = Readonly<{
  nodeId: string;
  label: Readonly<{ ko: string; en: string }>;
  canonicalRoute: string;
  routeAliases: readonly string[];
  displayOrder: number;
}>;

export type HrisTaskNavigationGroup = Readonly<{
  groupId: string;
  label: Readonly<{ ko: string; en: string }>;
  displayOrder: number;
  defaultNodeId: string;
  nodes: readonly HrisTaskNavigationNode[];
}>;

export type HrisTaskNavigationWorkbench = Readonly<{
  workbenchId: HrisWorkbenchId;
  label: Readonly<{ ko: string; en: string }>;
  displayOrder: number;
  defaultNodeId: string;
  groups: readonly HrisTaskNavigationGroup[];
}>;

export const HRIS_WORKBENCH_VIEW_BY_ID: Readonly<Record<HrisWorkbenchId, string>> = Object.freeze({
  'HRIS-WB-MY-HR': 'workbench-my-hr',
  'HRIS-WB-TEAM': 'workbench-team',
  'HRIS-WB-HR-OPERATIONS': 'workbench-hr-operations',
  'HRIS-WB-TIME': 'workbench-time',
  'HRIS-WB-PAYROLL': 'workbench-payroll',
  'HRIS-WB-PERFORMANCE': 'workbench-performance',
  'HRIS-WB-SETTINGS': 'workbench-settings',
});

const EXPECTED_TOPOLOGY: Readonly<
  Record<HrisWorkbenchId, Readonly<{ groups: number; nodes: number }>>
> = Object.freeze({
  'HRIS-WB-MY-HR': { groups: 6, nodes: 14 },
  'HRIS-WB-TEAM': { groups: 5, nodes: 7 },
  'HRIS-WB-HR-OPERATIONS': { groups: 7, nodes: 17 },
  'HRIS-WB-TIME': { groups: 6, nodes: 11 },
  'HRIS-WB-PAYROLL': { groups: 7, nodes: 14 },
  'HRIS-WB-PERFORMANCE': { groups: 7, nodes: 12 },
  'HRIS-WB-SETTINGS': { groups: 8, nodes: 22 },
});

const EXCLUDED_ROUTES = new Set(['/hr/explore', '/hr/benefits', '/hr/operations/benefits']);
const WORKBENCH_EN_LABELS: Readonly<Record<HrisWorkbenchId, string>> = Object.freeze({
  'HRIS-WB-MY-HR': 'My HR',
  'HRIS-WB-TEAM': 'Team',
  'HRIS-WB-HR-OPERATIONS': 'HR operations',
  'HRIS-WB-TIME': 'Time',
  'HRIS-WB-PAYROLL': 'Payroll',
  'HRIS-WB-PERFORMANCE': 'Performance',
  'HRIS-WB-SETTINGS': 'Settings',
});
const GROUP_EN_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'MY-01': 'My information',
  'MY-02': 'Employment & documents',
  'MY-03': 'Time & leave',
  'MY-04': 'Pay & benefits',
  'MY-05': 'Goals, growth & career',
  'MY-06': 'Requests, services & help',
  'TEAM-01': 'Team overview',
  'TEAM-02': 'Team time & leave',
  'TEAM-03': 'People changes',
  'TEAM-04': 'Goals & reviews',
  'TEAM-05': 'Delegated authority',
  'HROPS-01': 'Operations overview & people',
  'HROPS-02': 'Employment, appointments & contracts',
  'HROPS-03': 'Organization & workforce planning',
  'HROPS-04': 'Employee services & documents',
  'HROPS-05': 'Onboarding, mobility & exits',
  'HROPS-06': 'Recruiting & contingent workforce',
  'HROPS-07': 'Data quality & analytics',
  'TIME-01': 'Time operations overview',
  'TIME-02': 'Work plans & schedules',
  'TIME-03': 'Clock events & interpretation',
  'TIME-04': 'Exceptions & corrections',
  'TIME-05': 'Leave & accruals',
  'TIME-06': 'Close & reporting',
  'PAY-01': 'Payroll operations overview',
  'PAY-02': 'Inputs & calculation',
  'PAY-03': 'Validation & results',
  'PAY-04': 'Retro & corrections',
  'PAY-05': 'Payments & accounting',
  'PAY-06': 'Tax, insurance, retirement & year-end',
  'PAY-07': 'Statements & reports',
  'PERF-01': 'Performance operations, cycles & forms',
  'PERF-02': 'Review operations',
  'PERF-03': 'Multi-rater, feedback & conversations',
  'PERF-04': 'Calibration & results',
  'PERF-05': 'Learning operations',
  'PERF-06': 'Opportunities & succession',
  'PERF-07': 'Compensation planning',
  'SET-01': 'Enterprise, reference & people',
  'SET-02': 'Time & leave policies',
  'SET-03': 'Payroll & statutory policies',
  'SET-04': 'Performance, skills & listening',
  'SET-05': 'Workflow & documents',
  'SET-06': 'Integrations & connectors',
  'SET-07': 'Extensions & AI governance',
  'SET-08': 'DWP platform controls',
});
const MODERN_NODE_LABELS: Readonly<Record<string, Readonly<{ ko: string; en: string }>>> =
  Object.freeze({
    'MODERN:hcm.personal.growth': { ko: '성장 및 커리어', en: 'Growth & career' },
    'MODERN:hcm.settings.skills': { ko: '스킬 설정', en: 'Skills settings' },
    'MODERN:hcm.operations.recruiting': { ko: '채용', en: 'Recruiting' },
    'MODERN:hcm.personal.services': { ko: 'HR 서비스', en: 'HR services' },
    'MODERN:hcm.operations.onboarding': { ko: '온보딩 운영', en: 'Onboarding operations' },
    'MODERN:hcm.personal.learning': { ko: '내 학습', en: 'My learning' },
    'MODERN:hcm.operations.learning': { ko: '학습 운영', en: 'Learning operations' },
    'MODERN:hcm.personal.opportunities': { ko: '커리어 기회', en: 'Career opportunities' },
    'MODERN:hcm.operations.opportunities': { ko: '기회 마켓 운영', en: 'Opportunity marketplace' },
    'MODERN:hcm.operations.succession': { ko: '승계 계획', en: 'Succession planning' },
    'MODERN:hcm.operations.workforce-planning': { ko: '인력 계획', en: 'Workforce planning' },
    'MODERN:hcm.operations.compensation-planning': { ko: '보상 계획', en: 'Compensation planning' },
    'MODERN:hcm.personal.benefits': { ko: '내 복리후생', en: 'My benefits' },
    'MODERN:hcm.operations.benefits': { ko: '복리후생 운영', en: 'Benefits operations' },
    'MODERN:hcm.operations.hr-services': { ko: 'HR 서비스 운영', en: 'HR service operations' },
    'MODERN:hcm.personal.listening': { ko: '구성원 의견', en: 'Employee listening' },
    'MODERN:hcm.settings.listening': { ko: '의견 수렴 설정', en: 'Listening settings' },
    'MODERN:hcm.operations.workforce-management': {
      ko: '인력 운영',
      en: 'Workforce management',
    },
    'MODERN:hcm.operations.contingent-workforce': {
      ko: '외부 인력',
      en: 'Contingent workforce',
    },
    'MODERN:hcm.operations.people-analytics': { ko: '인사 분석', en: 'People analytics' },
    'MODERN:hcm.personal.assistant': { ko: 'HR 어시스턴트', en: 'HR assistant' },
    'MODERN:hcm.settings.ai-governance': { ko: 'AI 거버넌스', en: 'AI governance' },
  });
const SEALED_COMPATIBILITY_ROUTES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'BASE:hr-operations-home': ['/hr/operations'],
  'BASE:hr-employment-assignments': ['/hr/operations/assignments'],
  'BASE:hr-organization-positions': ['/hr/design/organization'],
});
const SEALED_COMPATIBILITY_OWNER_BY_PATH: Readonly<Record<string, string | null>> = Object.freeze({
  '/hr/me': 'BASE:my-hr-profile',
  '/hr/team': 'BASE:team-home',
  '/hr/data/integrations': null,
});
export const HRIS_POLICY_ONLY_COMPATIBILITY_PATHS = Object.freeze([
  '/hr/me',
  '/hr/time',
  '/hr/pay',
  '/hr/talent',
  '/hr/team',
  '/hr/absence',
  '/hr/services',
  '/hr/directory',
  '/hr/organization',
  '/hr/manage/system',
] as const);
const nodeById = new Map(
  HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes.map((node) => [node.iaNodeId, node])
);

function candidateRoutes(node: (typeof HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes)[number]) {
  return uniqueRoutes([
    node.currentCatalog?.href,
    ...(node.currentCatalog?.legacyPaths ?? []),
    node.canonicalRoute,
    ...(SEALED_COMPATIBILITY_ROUTES[node.iaNodeId] ?? []),
  ]);
}

const candidateOwnersByPath = new Map<string, Set<string>>();
for (const node of HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes) {
  for (const route of candidateRoutes(node)) {
    const path = routePath(route);
    const owners = candidateOwnersByPath.get(path) ?? new Set<string>();
    owners.add(node.iaNodeId);
    candidateOwnersByPath.set(path, owners);
  }
}

function fail(message: string): never {
  throw new Error(message);
}

function isWorkbenchId(value: string): value is HrisWorkbenchId {
  return (HRIS_WORKBENCH_IDS as readonly string[]).includes(value);
}

function uniqueRoutes(routes: readonly (string | null | undefined)[]) {
  return Object.freeze(
    [...new Set(routes.filter((route): route is string => Boolean(route?.startsWith('/'))))].filter(
      (route) => !EXCLUDED_ROUTES.has(route)
    )
  );
}

function routePath(route: string) {
  const path = route.split(/[?#]/u, 1)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/u, '') : path;
}

export function isHrisRuntimeEffectiveRouteAlias(route: string) {
  return !HRIS_POLICY_ONLY_COMPATIBILITY_PATHS.includes(
    routePath(route) as (typeof HRIS_POLICY_ONLY_COMPATIBILITY_PATHS)[number]
  );
}

function isSealedAliasOwner(nodeId: string, route: string) {
  const path = routePath(route);
  if (Object.hasOwn(SEALED_COMPATIBILITY_OWNER_BY_PATH, path)) {
    return SEALED_COMPATIBILITY_OWNER_BY_PATH[path] === nodeId;
  }
  return candidateOwnersByPath.get(path)?.size === 1;
}

function nodeLabel(node: (typeof HRIS_RUNTIME_NAVIGATION_MANIFEST.nodes)[number]) {
  const label = node.currentCatalog?.label ?? MODERN_NODE_LABELS[node.iaNodeId];
  if (!label) throw new Error(`Missing sealed HRIS navigation label: ${node.iaNodeId}`);
  return Object.freeze({ ...label });
}

function buildCatalog(): readonly HrisTaskNavigationWorkbench[] {
  const shellEntries = HRIS_RUNTIME_NAVIGATION_MANIFEST.shellEntries.filter(
    (entry) => entry.entryKind === 'WORKBENCH'
  );
  const workbenches = shellEntries.map((entry) => {
    if (!isWorkbenchId(entry.sidebarEntryId)) {
      throw new Error(`Unknown HRIS workbench entry: ${entry.sidebarEntryId}`);
    }
    const groups = HRIS_RUNTIME_NAVIGATION_MANIFEST.taskGroups
      .filter((group) => group.workbenchEntryId === entry.sidebarEntryId)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((group) => {
        const nodes = group.memberIaNodeIds.map((nodeId, displayOrder) => {
          const node = nodeById.get(nodeId);
          if (!node) throw new Error(`Unknown HRIS task navigation node: ${nodeId}`);
          const routeAliases = candidateRoutes(node).filter((route) =>
            isSealedAliasOwner(nodeId, route)
          );
          if (!routeAliases.length) {
            throw new Error(`HRIS task navigation node has no route: ${nodeId}`);
          }
          return Object.freeze({
            nodeId,
            label: nodeLabel(node),
            canonicalRoute: node.canonicalRoute,
            routeAliases,
            displayOrder,
          });
        });
        return Object.freeze({
          groupId: group.taskGroupId,
          label: Object.freeze({
            ko: group.contractLabelKo,
            en:
              GROUP_EN_LABELS[group.taskGroupId] ??
              fail(`Missing sealed HRIS task-group label: ${group.taskGroupId}`),
          }),
          displayOrder: group.displayOrder,
          defaultNodeId: group.defaultIaNodeId,
          nodes: Object.freeze(nodes),
        });
      });
    return Object.freeze({
      workbenchId: entry.sidebarEntryId,
      label: Object.freeze({
        ko: entry.contractLabelKo,
        en: WORKBENCH_EN_LABELS[entry.sidebarEntryId],
      }),
      displayOrder: entry.displayOrder,
      defaultNodeId: entry.defaultIaNodeId,
      groups: Object.freeze(groups),
    });
  });

  if (workbenches.length !== 7) throw new Error('HRIS task navigation must contain 7 workbenches.');
  const seenNodes = new Set<string>();
  const aliasOwnerByPath = new Map<string, string>();
  let groupCount = 0;
  for (const workbench of workbenches) {
    const expected = EXPECTED_TOPOLOGY[workbench.workbenchId];
    const nodeCount = workbench.groups.reduce((count, group) => count + group.nodes.length, 0);
    if (workbench.groups.length !== expected.groups || nodeCount !== expected.nodes) {
      throw new Error(`HRIS workbench topology drift: ${workbench.workbenchId}`);
    }
    groupCount += workbench.groups.length;
    for (const node of workbench.groups.flatMap((group) => group.nodes)) {
      if (seenNodes.has(node.nodeId)) throw new Error(`Duplicate HRIS task node: ${node.nodeId}`);
      seenNodes.add(node.nodeId);
      for (const alias of node.routeAliases) {
        const path = routePath(alias);
        const previousOwner = aliasOwnerByPath.get(path);
        if (previousOwner && previousOwner !== node.nodeId) {
          throw new Error(`Ambiguous HRIS task route alias: ${path}`);
        }
        aliasOwnerByPath.set(path, node.nodeId);
      }
    }
  }
  if (groupCount !== 46 || seenNodes.size !== 97) {
    throw new Error('HRIS task navigation must contain exactly 46 groups and 97 descendants.');
  }
  return Object.freeze(workbenches);
}

export const HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG = buildCatalog();

export const HRIS_TASK_NODE_IDS: ReadonlySet<string> = new Set(
  HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) =>
    workbench.groups.flatMap((group) => group.nodes.map((node) => node.nodeId))
  )
);

export function canonicalHrisWorkbench(workbenchId: string) {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.find(
    (workbench) => workbench.workbenchId === workbenchId
  );
}

export function canonicalHrisTaskNode(nodeId: string) {
  return HRIS_SEVEN_WORKBENCH_NAVIGATION_CATALOG.flatMap((workbench) => workbench.groups)
    .flatMap((group) => group.nodes)
    .find((node) => node.nodeId === nodeId);
}

export function hrisWorkbenchIdForView(view: string) {
  return HRIS_WORKBENCH_IDS.find((workbenchId) => HRIS_WORKBENCH_VIEW_BY_ID[workbenchId] === view);
}
