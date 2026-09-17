import { axiosInstance } from '../axios-instance';
import {
  ApprovalAdminV2ContractError,
  adminV2Array,
  adminV2Identifier,
  adminV2Record,
} from './approval-admin-v2-contract-core';
import { APPROVAL_ADMIN_V2_ENDPOINTS } from './approval-admin-v2-endpoints';
import {
  parseLivePolicyAutomation,
  parseLiveRoutingDirectory,
} from './approval-admin-v2-live-design-contract';
import {
  parseLiveFormStudio,
  parseLiveTemplateLibrary,
} from './approval-admin-v2-live-form-contract';
import {
  parseLiveAnalyticsDashboard,
  parseLiveDeployment,
} from './approval-admin-v2-live-insights-contract';
import {
  parseLiveAuditEventDetail,
  parseLiveAuditEvents,
  parseLiveConnectors,
  parseLiveIncidentDetail,
  parseLiveIncidents,
} from './approval-admin-v2-live-operations-contract';

import type { ApiResponse } from '../types';
import type {
  ApprovalFormStudioV3Snapshot,
  ApprovalPolicyAutomationSnapshot,
  ApprovalRoutingDirectorySnapshot,
  ApprovalTemplateLibrarySnapshot,
} from './approval-admin-v2-design-contract';
import type { ApprovalAdminV2Locale } from './approval-admin-v2-live-form-contract';
import type {
  ApprovalAnalyticsInsightsSnapshot,
  ApprovalDeploymentSnapshot,
} from './approval-admin-v2-insights-contract';
import type {
  ApprovalAuditRecordsSnapshot,
  ApprovalConnectorAutomationSnapshot,
  ApprovalIncidentRecoverySnapshot,
} from './approval-admin-v2-operations-contract';

const ENDPOINTS = APPROVAL_ADMIN_V2_ENDPOINTS;

export const APPROVAL_ADMIN_V2_READ_PATHS = {
  templates: [ENDPOINTS.templates.catalog],
  formStudio: [ENDPOINTS.formStudio.workspaces],
  routing: [ENDPOINTS.routing.groups, ENDPOINTS.routing.resolvers],
  policies: [
    ENDPOINTS.policies.calendars,
    ENDPOINTS.policies.channels,
    ENDPOINTS.policies.rules,
    ENDPOINTS.policies.delegations,
  ],
  connectors: [ENDPOINTS.connectors.list],
  incidents: [ENDPOINTS.incidents.list],
  audit: [ENDPOINTS.audit.events, ENDPOINTS.audit.savedViews],
  analytics: [ENDPOINTS.analytics.metricDefinitions, ENDPOINTS.analytics.dashboard],
  deployments: [
    ENDPOINTS.deployments.dashboard,
    ENDPOINTS.deployments.packages,
    ENDPOINTS.deployments.promotions,
  ],
} as const;

export type ApprovalAdminV2ReadKind = keyof typeof APPROVAL_ADMIN_V2_READ_PATHS;

export type ApprovalAdminV2ReadResult = {
  templates: ApprovalTemplateLibrarySnapshot;
  formStudio: ApprovalFormStudioV3Snapshot;
  routing: ApprovalRoutingDirectorySnapshot;
  policies: ApprovalPolicyAutomationSnapshot;
  connectors: ApprovalConnectorAutomationSnapshot;
  incidents: ApprovalIncidentRecoverySnapshot;
  audit: ApprovalAuditRecordsSnapshot;
  analytics: ApprovalAnalyticsInsightsSnapshot;
  deployments: ApprovalDeploymentSnapshot;
};

type ReadContext = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
  locale: ApprovalAdminV2Locale;
}>;

function selectedScope(context: ReadContext) {
  return {
    ...(context.contextScopeKey ? { contextScopeKey: context.contextScopeKey } : {}),
    ...(context.signal ? { signal: context.signal } : {}),
    timeoutMs: 12_000,
  };
}

async function read(path: string, context: ReadContext): Promise<unknown> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(path, selectedScope(context));
  return response.data.data;
}

function withQuery(path: string, values: Record<string, string | number>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => query.set(key, String(value)));
  return `${path}?${query.toString()}`;
}

function currentWindow() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function firstListIdentifier(
  value: unknown,
  path: string,
  identifierKey: string
): string | undefined {
  const items = adminV2Array(
    value,
    path,
    (item, itemPath) => {
      const record = adminV2Record(item, itemPath);
      return adminV2Identifier(record[identifierKey], `${itemPath}.${identifierKey}`);
    },
    500
  );
  return items[0];
}

function firstPageIdentifier(
  value: unknown,
  path: string,
  identifierKey: string
): string | undefined {
  const page = adminV2Record(value, path);
  return firstListIdentifier(page.items, `${path}.items`, identifierKey);
}

async function templates(context: ReadContext) {
  const catalog = await read(ENDPOINTS.templates.catalog, context);
  return parseLiveTemplateLibrary(catalog, context.locale);
}

async function formStudio(context: ReadContext) {
  const page = await read(ENDPOINTS.formStudio.workspaces, context);
  const formId = firstPageIdentifier(page, 'formWorkspaces', 'formId');
  if (!formId) return parseLiveFormStudio(page, undefined, undefined, context.locale);
  const [detail, history] = await Promise.all([
    read(ENDPOINTS.formStudio.detail(formId), context),
    read(withQuery(ENDPOINTS.formStudio.versions(formId), { size: 50 }), context),
  ]);
  return parseLiveFormStudio(page, detail, history, context.locale);
}

async function routing(context: ReadContext) {
  const [groups, resolvers] = await Promise.all([
    read(ENDPOINTS.routing.groups, context),
    read(ENDPOINTS.routing.resolvers, context),
  ]);
  return parseLiveRoutingDirectory(groups, resolvers);
}

async function policies(context: ReadContext) {
  const [calendars, channels, rules, delegations] = await Promise.all([
    read(ENDPOINTS.policies.calendars, context),
    read(ENDPOINTS.policies.channels, context),
    read(ENDPOINTS.policies.rules, context),
    read(ENDPOINTS.policies.delegations, context),
  ]);
  return parseLivePolicyAutomation(calendars, channels, rules, delegations);
}

async function connectors(context: ReadContext) {
  const list = await read(ENDPOINTS.connectors.list, context);
  const connectorId = firstListIdentifier(list, 'connectors', 'connectorId');
  const detail = connectorId
    ? await read(ENDPOINTS.connectors.detail(connectorId), context)
    : undefined;
  return parseLiveConnectors(list, detail);
}

async function incidents(context: ReadContext) {
  const list = await read(ENDPOINTS.incidents.list, context);
  return parseLiveIncidents(list);
}

async function audit(context: ReadContext) {
  const range = currentWindow();
  const [events, savedViews] = await Promise.all([
    read(
      withQuery(ENDPOINTS.audit.events, {
        ...range,
        limit: 100,
        accessLevel: 'METADATA',
      }),
      context
    ),
    read(ENDPOINTS.audit.savedViews, context),
  ]);
  return parseLiveAuditEvents(events, savedViews);
}

async function analytics(context: ReadContext) {
  const range = currentWindow();
  const query = { ...range, cohortDimension: 'WORKFLOW', minimumCohortSize: 5 };
  const [definitions, dashboard] = await Promise.all([
    read(ENDPOINTS.analytics.metricDefinitions, context),
    read(withQuery(ENDPOINTS.analytics.dashboard, query), context),
  ]);
  const initial = parseLiveAnalyticsDashboard(dashboard, definitions);
  const cohort = initial.cohorts.find((item) => !item.suppressed);
  if (!cohort) return initial;
  const representatives = await read(
    withQuery(ENDPOINTS.analytics.representatives(cohort.id), { ...query, limit: 10 }),
    context
  );
  return parseLiveAnalyticsDashboard(dashboard, definitions, representatives, cohort.id);
}

async function deployments(context: ReadContext) {
  const [dashboard, packages, promotions] = await Promise.all([
    read(ENDPOINTS.deployments.dashboard, context),
    read(withQuery(ENDPOINTS.deployments.packages, { limit: 50 }), context),
    read(withQuery(ENDPOINTS.deployments.promotions, { limit: 50 }), context),
  ]);
  const promotionId = firstListIdentifier(promotions, 'promotions', 'promotionId');
  if (!promotionId) return parseLiveDeployment(dashboard, packages, promotions);
  const [detail, rollbackFeasibility] = await Promise.all([
    read(ENDPOINTS.deployments.promotion(promotionId), context),
    read(ENDPOINTS.deployments.rollbackFeasibility(promotionId), context),
  ]);
  return parseLiveDeployment(dashboard, packages, promotions, detail, rollbackFeasibility);
}

const LOADERS = {
  templates,
  formStudio,
  routing,
  policies,
  connectors,
  incidents,
  audit,
  analytics,
  deployments,
} satisfies {
  [K in ApprovalAdminV2ReadKind]: (context: ReadContext) => Promise<ApprovalAdminV2ReadResult[K]>;
};

export async function getApprovalAdminV2Workspace<K extends ApprovalAdminV2ReadKind>(
  kind: K,
  contextScopeKey?: string,
  signal?: AbortSignal,
  locale: ApprovalAdminV2Locale = 'ko'
): Promise<ApprovalAdminV2ReadResult[K]> {
  const loader = LOADERS[kind] as (context: ReadContext) => Promise<ApprovalAdminV2ReadResult[K]>;
  return loader({ contextScopeKey, signal, locale });
}

export async function getApprovalAdminV2IncidentDetail(
  incidentId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalIncidentRecoverySnapshot> {
  const context: ReadContext = { contextScopeKey, signal, locale: 'ko' };
  const detail = await read(ENDPOINTS.incidents.detail(incidentId), context);
  return parseLiveIncidentDetail(detail, incidentId);
}

export async function getApprovalAdminV2AuditEventDetail(
  eventId: string,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalAuditRecordsSnapshot> {
  const context: ReadContext = { contextScopeKey, signal, locale: 'ko' };
  const event = await read(
    withQuery(ENDPOINTS.audit.event(eventId), { accessLevel: 'METADATA' }),
    context
  );
  const eventRecord = adminV2Record(event, 'selectedEvent');
  if (adminV2Identifier(eventRecord.eventId, 'selectedEvent.eventId') !== eventId) {
    throw new ApprovalAdminV2ContractError('selectedEvent.eventId');
  }
  const requestId = adminV2Identifier(eventRecord.requestId, 'selectedEvent.requestId');
  const retention = await read(ENDPOINTS.audit.retentionLinkage(requestId), context);
  return parseLiveAuditEventDetail(event, retention, eventId);
}
