#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

import prettierConfig from '../prettier.config.mjs';

const self = fileURLToPath(import.meta.url);

const SOURCE_DIRECTORY =
  'docs/06-delivery/hris/recovery/hris-porting-blueprint-2026-09-09/coding-readiness';
const TARGET_FILE =
  'apps/dwp/src/features/hris/shell/model/hris-information-architecture.generated.ts';

export const HRIS_IA_SOURCE_FILES = Object.freeze({
  nodes: `${SOURCE_DIRECTORY}/hris-information-architecture-register.csv`,
  shellEntries: `${SOURCE_DIRECTORY}/hris-shell-navigation-register.csv`,
  taskGroups: `${SOURCE_DIRECTORY}/hris-workbench-task-group-register.csv`,
});

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  nodes: 'ab506a2bb2f80c8ab81a4b9d575374d6bda83b312d11dce07495d4812bdf4686',
  shellEntries: 'f85ee40a66ce4100c5578fd3ca96bc89b652b0762e19d74cc7aeb76338009000',
  taskGroups: 'f0b1ebb316e4d5944aac90002e144f25d8c1318216b6733e674cdc8c5042872b',
});

const EXPECTED_NODE_HEADER = [
  'ia_node_id',
  'source_set',
  'source_node_key',
  'inventory_group',
  'navigation_surface',
  'owner_session',
  'runtime_owner',
  'personas',
  'source_lifecycle',
  'canonical_route',
  'workbench_tab',
  'source_family_refs',
  'api_contract_refs',
  'entry_query_refs',
  'visibility_capability_refs',
  'action_contract_refs',
  'action_capability_refs',
  'persona_access_profiles',
  'entry_contract_state',
  'authorization_refs',
  'authorization_source_refs',
  'deep_link_template',
  'implementation_state',
  'production_state',
  'source_ref',
  'source_digest_sha256',
  'compatibility_decision_ref',
];

const EXPECTED_SHELL_HEADER = [
  'sidebar_entry_id',
  'entry_kind',
  'display_order',
  'label_ko',
  'entry_route',
  'member_inventory_groups',
  'member_navigation_surfaces',
  'default_ia_node_id',
  'default_route',
  'owner_session',
  'runtime_owner',
  'required_entitlement',
  'visibility_capability_mode',
  'landing_policy',
  'content_contract',
  'field_policy',
  'implementation_state',
  'production_state',
];

const EXPECTED_TASK_GROUP_HEADER = [
  'task_group_id',
  'workbench_entry_id',
  'display_order',
  'label_ko',
  'default_ia_node_id',
  'member_ia_node_ids',
  'authorization_source',
  'visibility_rule',
  'landing_policy',
  'navigation_mode',
  'implementation_state',
  'production_state',
];

const EXPECTED_SHELL_IDS = [
  'HRIS-NAV-HOME',
  'HRIS-WB-MY-HR',
  'HRIS-WB-TEAM',
  'HRIS-WB-HR-OPERATIONS',
  'HRIS-WB-TIME',
  'HRIS-WB-PAYROLL',
  'HRIS-WB-PERFORMANCE',
  'HRIS-WB-SETTINGS',
  'HRIS-NAV-EXPLORE',
];

const WORKBENCH_INVENTORY = Object.freeze({
  'HRIS-WB-MY-HR': ['MY_HR'],
  'HRIS-WB-TEAM': ['TEAM'],
  'HRIS-WB-HR-OPERATIONS': ['HR_OPERATIONS'],
  'HRIS-WB-TIME': ['TIME'],
  'HRIS-WB-PAYROLL': ['PAYROLL'],
  'HRIS-WB-PERFORMANCE': ['PERFORMANCE'],
  'HRIS-WB-SETTINGS': ['SETTINGS', 'DWP_CONTROL'],
});

const WORKBENCH_GROUP_COUNTS = Object.freeze({
  'HRIS-WB-MY-HR': 6,
  'HRIS-WB-TEAM': 5,
  'HRIS-WB-HR-OPERATIONS': 7,
  'HRIS-WB-TIME': 6,
  'HRIS-WB-PAYROLL': 7,
  'HRIS-WB-PERFORMANCE': 7,
  'HRIS-WB-SETTINGS': 8,
});

const INVENTORY_ROUTE_PREFIXES = Object.freeze({
  MY_HR: ['/hr/home', '/hr/me', '/hr/time', '/hr/pay', '/hr/talent'],
  TEAM: ['/hr/team'],
  HR_OPERATIONS: [
    '/hr/operations/home',
    '/hr/operations/people',
    '/hr/operations/recruiting',
    '/hr/operations/onboarding',
    '/hr/operations/workforce-planning',
    '/hr/operations/employee-services',
    '/hr/operations/hr-services',
    '/hr/operations/contingent-workforce',
    '/hr/operations/people-analytics',
  ],
  TIME: ['/hr/operations/time', '/hr/operations/workforce-management'],
  PAYROLL: ['/hr/operations/payroll'],
  PERFORMANCE: [
    '/hr/operations/performance',
    '/hr/operations/learning',
    '/hr/operations/opportunities',
    '/hr/operations/talent',
  ],
  SETTINGS: ['/hr/settings'],
  DWP_CONTROL: ['/admin'],
});

const MODULES = new Set(['SYS', 'HRM', 'TIM', 'PAY', 'PER']);
const SOURCE_SETS = new Set(['BASE76', 'MODERN22']);
const INVENTORY_GROUPS = new Set(Object.keys(INVENTORY_ROUTE_PREFIXES));
const NAVIGATION_SURFACES = new Set(['HOME', 'MY_HR', 'TEAM', 'OPERATIONS', 'SETTINGS']);
const SOURCE_LIFECYCLES = new Set([
  'PILOT',
  'PLANNED',
  'BLOCKED_EVIDENCE',
  'EXTERNAL',
  'PLANNED_REQUIRED_SCOPE',
]);
const PERSONAS = new Set([
  'EMPLOYEE',
  'MANAGER',
  'BUSINESS_OPERATOR',
  'SETTINGS_ADMIN',
  'ENTERPRISE_AUDITOR',
]);
const OLD_BENSK_PATHS = new Set(['/hr/benefits', '/hr/operations/benefits']);
const REQUIRED_HRIS_BENEFITS_PATHS = new Set([
  '/hr/me/benefits',
  '/hr/operations/employee-services/benefits',
]);

function fail(message) {
  throw new Error(`HRIS IA runtime manifest error: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalRoutePath(value) {
  const pathOnly = value.split(/[?#]/u, 1)[0];
  return pathOnly.length > 1 ? pathOnly.replace(/\/+$/u, '') : pathOnly;
}

function splitPipe(value, { allowNone = false } = {}) {
  if (allowNone && value === 'NONE') return [];
  if (!value) fail('pipe-delimited value must not be empty');
  const values = value.split('|');
  if (values.some((item) => !item || item === 'NONE') || new Set(values).size !== values.length) {
    fail(`invalid pipe-delimited value: ${value}`);
  }
  return values;
}

function integer(value, label) {
  if (!/^\d+$/u.test(value)) fail(`${label} must be a non-negative integer`);
  return Number(value);
}

function exactHeader(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} header drift`);
  }
}

function unique(records, key, label) {
  const values = records.map((record) => record[key]);
  if (values.some((value) => !value)) fail(`${label}.${key} must not be empty`);
  if (new Set(values).size !== values.length) fail(`${label}.${key} must be unique`);
}

function complete(records, label) {
  for (const [index, record] of records.entries()) {
    for (const [field, value] of Object.entries(record)) {
      if (typeof value !== 'string' || !value.trim()) {
        fail(`${label} row ${index + 2} has an empty ${field}`);
      }
    }
  }
}

function routeMatchesPrefix(route, prefix) {
  return route === prefix || route.startsWith(`${prefix}/`);
}

function contiguous(values, label) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.some((value, index) => value !== index)) {
    fail(`${label} display order must be contiguous from zero`);
  }
}

export function parseCsv(text, expectedHeader, label) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/u, '');

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(value.replace(/\r$/u, ''));
      value = '';
      if (character === '\n') {
        rows.push(row);
        row = [];
      }
    } else {
      value += character;
    }
  }
  if (quoted) fail(`${label} contains an unterminated quoted value`);
  if (value || row.length) {
    row.push(value.replace(/\r$/u, ''));
    rows.push(row);
  }
  if (!rows.length) fail(`${label} is empty`);

  const header = rows.shift();
  exactHeader(header, expectedHeader, label);
  return rows
    .filter((cells) => cells.some(Boolean))
    .map((cells, index) => {
      if (cells.length !== header.length) {
        fail(`${label} row ${index + 2} column cardinality drift`);
      }
      return Object.fromEntries(header.map((key, column) => [key, cells[column]]));
    });
}

function projectNode(row) {
  const module = row.owner_session.replace(/^HRIS-/u, '');
  if (!MODULES.has(module)) fail(`${row.ia_node_id} has an unknown owner session`);
  const contractPersonas = splitPipe(row.personas);
  if (contractPersonas.some((persona) => !PERSONAS.has(persona))) {
    fail(`${row.ia_node_id} has an unknown persona`);
  }
  if (!SOURCE_SETS.has(row.source_set)) fail(`${row.ia_node_id} has an unknown source set`);
  const expectedIaNodeId = `${row.source_set === 'BASE76' ? 'BASE' : 'MODERN'}:${row.source_node_key}`;
  if (row.ia_node_id !== expectedIaNodeId) {
    fail(`${row.ia_node_id} does not match its source set and source node key`);
  }
  if (!INVENTORY_GROUPS.has(row.inventory_group)) {
    fail(`${row.ia_node_id} has an unknown inventory group`);
  }
  if (!NAVIGATION_SURFACES.has(row.navigation_surface)) {
    fail(`${row.ia_node_id} has an unknown navigation surface`);
  }
  if (!SOURCE_LIFECYCLES.has(row.source_lifecycle)) {
    fail(`${row.ia_node_id} has an unknown historical lifecycle`);
  }
  if (!row.canonical_route.startsWith('/')) {
    fail(`${row.ia_node_id} canonical route must be root-relative`);
  }
  const canonicalPath = canonicalRoutePath(row.canonical_route);
  const allowedPrefixes = INVENTORY_ROUTE_PREFIXES[row.inventory_group];
  if (!allowedPrefixes.some((prefix) => routeMatchesPrefix(canonicalPath, prefix))) {
    fail(`${row.ia_node_id} canonical route is outside its inventory namespace`);
  }
  if (canonicalRoutePath(row.deep_link_template) !== canonicalPath) {
    fail(`${row.ia_node_id} deep link must preserve its canonical route`);
  }
  if (!/^[a-f0-9]{64}$/u.test(row.source_digest_sha256)) {
    fail(`${row.ia_node_id} has an invalid historical source digest`);
  }
  if (!row.source_ref.endsWith(`#${row.source_node_key}`)) {
    fail(`${row.ia_node_id} historical source reference does not match its source node key`);
  }
  if (row.production_state !== 'NOT_AUTHORIZED_G6') {
    fail(`${row.ia_node_id} must remain NOT_AUTHORIZED_G6 in the recovered contract`);
  }
  return {
    iaNodeId: row.ia_node_id,
    sourceSet: row.source_set,
    sourceNodeKey: row.source_node_key,
    inventoryGroup: row.inventory_group,
    navigationSurface: row.navigation_surface,
    ownerSession: row.owner_session,
    runtimeOwners: splitPipe(row.runtime_owner),
    module,
    contractPersonas,
    contractSourceLifecycle: row.source_lifecycle,
    canonicalRoute: row.canonical_route,
    workbenchTab: row.workbench_tab,
    entryQueryRefs: splitPipe(row.entry_query_refs, { allowNone: true }),
    visibilityCapabilityRefs: splitPipe(row.visibility_capability_refs, { allowNone: true }),
    deepLinkTemplate: row.deep_link_template,
    contractEntryState: row.entry_contract_state,
    contractImplementationState: row.implementation_state,
    contractProductionState: row.production_state,
    compatibilityDecisionRef:
      row.compatibility_decision_ref === 'NONE' ? null : row.compatibility_decision_ref,
  };
}

function projectShellEntry(row) {
  return {
    sidebarEntryId: row.sidebar_entry_id,
    entryKind: row.entry_kind,
    displayOrder: integer(row.display_order, row.sidebar_entry_id),
    contractLabelKo: row.label_ko,
    entryRoute: row.entry_route,
    memberInventoryGroups: splitPipe(row.member_inventory_groups, { allowNone: true }),
    memberNavigationSurfaces: splitPipe(row.member_navigation_surfaces, { allowNone: true }),
    defaultIaNodeId: row.default_ia_node_id === 'NONE' ? null : row.default_ia_node_id,
    defaultRoute: row.default_route,
    requiredEntitlement: row.required_entitlement,
    visibilityCapabilityMode: row.visibility_capability_mode,
    landingPolicy: row.landing_policy,
    contentContract: row.content_contract,
    fieldPolicy: row.field_policy,
    contractImplementationState: row.implementation_state,
    contractProductionState: row.production_state,
  };
}

function projectTaskGroup(row) {
  return {
    taskGroupId: row.task_group_id,
    workbenchEntryId: row.workbench_entry_id,
    displayOrder: integer(row.display_order, row.task_group_id),
    contractLabelKo: row.label_ko,
    defaultIaNodeId: row.default_ia_node_id,
    memberIaNodeIds: splitPipe(row.member_ia_node_ids),
    visibilityRule: row.visibility_rule,
    landingPolicy: row.landing_policy,
    navigationMode: row.navigation_mode,
    contractImplementationState: row.implementation_state,
    contractProductionState: row.production_state,
  };
}

export function validateAndProjectHrisIa({ nodeRows, shellRows, taskGroupRows }) {
  if (nodeRows.length !== 98) fail(`expected 98 IA nodes, found ${nodeRows.length}`);
  if (shellRows.length !== 9) fail(`expected 9 shell entries, found ${shellRows.length}`);
  if (taskGroupRows.length !== 46) {
    fail(`expected 46 task groups, found ${taskGroupRows.length}`);
  }
  complete(nodeRows, 'IA nodes');
  complete(shellRows, 'shell entries');
  complete(taskGroupRows, 'task groups');
  unique(nodeRows, 'ia_node_id', 'IA nodes');
  unique(nodeRows, 'source_node_key', 'IA nodes');
  unique(shellRows, 'sidebar_entry_id', 'shell entries');
  unique(taskGroupRows, 'task_group_id', 'task groups');

  const nodes = nodeRows.map(projectNode);
  const shellEntries = shellRows.map(projectShellEntry);
  const taskGroups = taskGroupRows.map(projectTaskGroup);
  const nodeById = new Map(nodes.map((node) => [node.iaNodeId, node]));
  const sourceDigestByFile = new Map();
  for (const row of nodeRows) {
    const sourceFile = row.source_ref.split('#', 1)[0];
    const knownDigest = sourceDigestByFile.get(sourceFile);
    if (knownDigest && knownDigest !== row.source_digest_sha256) {
      fail(`${sourceFile} has conflicting historical source digests`);
    }
    sourceDigestByFile.set(sourceFile, row.source_digest_sha256);
  }
  const routePaths = nodes.map((node) => canonicalRoutePath(node.canonicalRoute));
  if (new Set(routePaths).size !== routePaths.length) fail('canonical route paths must be unique');
  if (routePaths.some((route) => OLD_BENSK_PATHS.has(route))) {
    fail('BENSK compatibility paths must remain outside the HRIS IA');
  }
  if ([...REQUIRED_HRIS_BENEFITS_PATHS].some((route) => !routePaths.includes(route))) {
    fail('generic HRIS benefits routes are missing');
  }
  if (routePaths.some((route) => route === '/hr/admin' || route.startsWith('/hr/admin/'))) {
    fail('/hr/admin namespace is forbidden');
  }

  const baseNodeCount = nodes.filter((node) => node.sourceSet === 'BASE76').length;
  const modernNodeCount = nodes.filter((node) => node.sourceSet === 'MODERN22').length;
  if (baseNodeCount !== 76 || modernNodeCount !== 22) {
    fail('source-set closure must remain BASE76 + MODERN22');
  }

  const homeNodes = nodes.filter((node) => node.navigationSurface === 'HOME');
  if (homeNodes.length !== 1 || homeNodes[0].iaNodeId !== 'BASE:my-hr-home') {
    fail('the IA must contain exactly one fixed home node');
  }
  const nonHomeNodeIds = new Set(
    nodes.filter((node) => node.navigationSurface !== 'HOME').map((node) => node.iaNodeId)
  );
  const coveredNodeIds = taskGroups.flatMap((group) => group.memberIaNodeIds);
  if (coveredNodeIds.length !== 97 || new Set(coveredNodeIds).size !== 97) {
    fail('task groups must cover 97 non-home nodes exactly once');
  }
  if (
    coveredNodeIds.some((nodeId) => !nonHomeNodeIds.has(nodeId)) ||
    [...nonHomeNodeIds].some((nodeId) => !coveredNodeIds.includes(nodeId))
  ) {
    fail('task-group membership differs from the non-home IA node set');
  }

  for (const group of taskGroups) {
    const expectedInventory = WORKBENCH_INVENTORY[group.workbenchEntryId];
    if (!expectedInventory) fail(`${group.taskGroupId} has an unknown workbench`);
    if (!group.memberIaNodeIds.includes(group.defaultIaNodeId)) {
      fail(`${group.taskGroupId} default node is not a member`);
    }
    if (
      taskGroupRows.find((row) => row.task_group_id === group.taskGroupId)?.authorization_source !==
        'MEMBER_IA_AUTHORIZATION_REFS' ||
      group.visibilityRule !== 'ANY_AUTHORIZED_MEMBER' ||
      group.landingPolicy !== 'DEFAULT_IF_AUTHORIZED_ELSE_FIRST_AUTHORIZED_MEMBER' ||
      group.navigationMode !== 'TASK_ORIENTED_PROGRESSIVE_DISCLOSURE' ||
      group.contractImplementationState !== 'NOT_STARTED_G3' ||
      group.contractProductionState !== 'NOT_AUTHORIZED_G6'
    ) {
      fail(`${group.taskGroupId} navigation or authorization policy drift`);
    }
    for (const nodeId of group.memberIaNodeIds) {
      const node = nodeById.get(nodeId);
      if (!node || !expectedInventory.includes(node.inventoryGroup)) {
        fail(`${group.taskGroupId} contains a node outside its workbench inventory`);
      }
    }
  }
  for (const workbenchEntryId of Object.keys(WORKBENCH_INVENTORY)) {
    const workbenchGroups = taskGroups.filter(
      (group) => group.workbenchEntryId === workbenchEntryId
    );
    if (workbenchGroups.length !== WORKBENCH_GROUP_COUNTS[workbenchEntryId]) {
      fail(`${workbenchEntryId} task-group count drift`);
    }
    const orders = workbenchGroups.map((group) => group.displayOrder);
    contiguous(orders, workbenchEntryId);
  }

  contiguous(
    shellEntries.map((entry) => entry.displayOrder),
    'shell entries'
  );
  if (
    JSON.stringify(shellEntries.map((entry) => entry.sidebarEntryId)) !==
    JSON.stringify(EXPECTED_SHELL_IDS)
  ) {
    fail('shell entry identity or order drift');
  }
  const shellById = new Map(shellEntries.map((entry) => [entry.sidebarEntryId, entry]));
  for (const [workbenchEntryId, expectedInventory] of Object.entries(WORKBENCH_INVENTORY)) {
    const entry = shellById.get(workbenchEntryId);
    if (
      !entry ||
      entry.entryKind !== 'WORKBENCH' ||
      JSON.stringify(entry.memberInventoryGroups) !== JSON.stringify(expectedInventory)
    ) {
      fail(`${workbenchEntryId} shell ownership drift`);
    }
  }
  for (const entry of shellEntries) {
    if (entry.requiredEntitlement !== 'APP.HCM') {
      fail(`${entry.sidebarEntryId} must require APP.HCM`);
    }
    if (entry.contractProductionState !== 'NOT_AUTHORIZED_G6') {
      fail(`${entry.sidebarEntryId} must remain NOT_AUTHORIZED_G6`);
    }
    if (entry.defaultIaNodeId) {
      const node = nodeById.get(entry.defaultIaNodeId);
      if (!node || node.canonicalRoute !== entry.defaultRoute) {
        fail(`${entry.sidebarEntryId} default node and route do not resolve together`);
      }
    }
  }
  if (shellById.get('HRIS-NAV-HOME')?.entryKind !== 'FIXED_HOME') {
    fail('fixed HRIS home entry is missing');
  }
  if (
    shellById.get('HRIS-NAV-EXPLORE')?.entryKind !== 'UTILITY_NOT_SIDEBAR' ||
    shellById.get('HRIS-NAV-EXPLORE')?.entryRoute !== '/hr/explore'
  ) {
    fail('non-sidebar HRIS explorer entry is missing');
  }

  return { nodes, shellEntries, taskGroups };
}

function readSources(root) {
  const sourceBytes = Object.fromEntries(
    Object.entries(HRIS_IA_SOURCE_FILES).map(([key, relativePath]) => {
      const absolutePath = path.join(root, relativePath);
      if (!fs.existsSync(absolutePath)) fail(`missing source: ${relativePath}`);
      const bytes = fs.readFileSync(absolutePath);
      if (sha256(bytes) !== EXPECTED_SOURCE_SHA256[key]) {
        fail(`${relativePath} differs from the reviewed source pin`);
      }
      return [key, bytes];
    })
  );
  const nodeRows = parseCsv(
    sourceBytes.nodes.toString('utf8'),
    EXPECTED_NODE_HEADER,
    HRIS_IA_SOURCE_FILES.nodes
  );
  const shellRows = parseCsv(
    sourceBytes.shellEntries.toString('utf8'),
    EXPECTED_SHELL_HEADER,
    HRIS_IA_SOURCE_FILES.shellEntries
  );
  const taskGroupRows = parseCsv(
    sourceBytes.taskGroups.toString('utf8'),
    EXPECTED_TASK_GROUP_HEADER,
    HRIS_IA_SOURCE_FILES.taskGroups
  );
  return {
    projected: validateAndProjectHrisIa({ nodeRows, shellRows, taskGroupRows }),
    sources: Object.entries(HRIS_IA_SOURCE_FILES).map(([key, relativePath]) => ({
      key,
      path: relativePath,
      sha256: sha256(sourceBytes[key]),
    })),
  };
}

export async function renderHrisIaRuntimeManifest(root) {
  const { projected, sources } = readSources(root);
  const topologySha256 = sha256(JSON.stringify(projected));
  const source = `/** @generated from HRIS 98-node IA registers. Do not edit manually. */

export const HRIS_IA_CONTRACT_REVISION = ${JSON.stringify(
    {
      schemaVersion: 1,
      topologySha256,
      counts: {
        nodes: projected.nodes.length,
        shellEntries: projected.shellEntries.length,
        taskGroups: projected.taskGroups.length,
      },
      sources,
    },
    null,
    2
  )} as const;

export const HRIS_IA_CONTRACT_NODES = ${JSON.stringify(projected.nodes, null, 2)} as const;

export const HRIS_IA_CONTRACT_SHELL_ENTRIES = ${JSON.stringify(
    projected.shellEntries,
    null,
    2
  )} as const;

export const HRIS_IA_CONTRACT_TASK_GROUPS = ${JSON.stringify(
    projected.taskGroups,
    null,
    2
  )} as const;
`;
  return prettier.format(source, { ...prettierConfig, parser: 'typescript' });
}

export async function syncHrisIaRuntimeManifest({
  mode,
  root = process.cwd(),
  target = path.join(root, TARGET_FILE),
}) {
  if (!['--sync', '--check'].includes(mode)) {
    fail('mode must be --sync or --check');
  }
  const generated = await renderHrisIaRuntimeManifest(root);
  if (mode === '--sync') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, generated, 'utf8');
    return { changed: true, target };
  }
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) {
    fail('generated manifest is stale; run corepack yarn hris:ia:sync');
  }
  return { changed: false, target };
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--sync', '--check'].includes(args[0])) {
    console.error('Usage: node scripts/sync-hris-ia-runtime-manifest.mjs --sync|--check');
    return 2;
  }
  const result = await syncHrisIaRuntimeManifest({ mode: args[0] });
  console.log(
    args[0] === '--sync'
      ? `Wrote ${path.relative(process.cwd(), result.target)}.`
      : 'PASS HRIS IA runtime manifest: 98 nodes, 9 shell entries, 46 task groups.'
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
