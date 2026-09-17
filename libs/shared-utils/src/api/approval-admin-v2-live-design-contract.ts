import {
  adminV2Array,
  adminV2Identifier,
  adminV2Instant,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
  parseAdminV2Status,
} from './approval-admin-v2-contract-core';

import type {
  ApprovalPolicyAutomationSnapshot,
  ApprovalRoutingDirectorySnapshot,
} from './approval-admin-v2-design-contract';
import type {
  ApprovalAdminV2CommandTarget,
  ApprovalAdminV2Fact,
  ApprovalAdminV2SnapshotMeta,
} from './approval-admin-v2-contract-core';

function optionalText(value: unknown, path: string, max = 300): string | undefined {
  return value == null ? undefined : adminV2Text(value, path, { max });
}

function optionalInstant(value: unknown, path: string): string | undefined {
  return value == null ? undefined : adminV2Instant(value, path);
}

function command(targetId: string, expectedVersion: number): ApprovalAdminV2CommandTarget {
  return { targetId, expectedVersion, commandReady: false };
}

function fact(id: string, label: string, value: string): ApprovalAdminV2Fact {
  return { id, label, value };
}

function maxVersion(records: readonly Readonly<{ version: number }>[]): number {
  return records.reduce((maximum, record) => Math.max(maximum, record.version), 0);
}

function meta(
  records: readonly Readonly<{ version: number }>[],
  sourceRevisions: readonly string[] = []
): ApprovalAdminV2SnapshotMeta {
  const revisions = [...new Set(sourceRevisions.filter(Boolean))].sort();
  return {
    generatedAt: null,
    sourceRevision: revisions.length ? revisions.join(', ') : null,
    objectVersion: maxVersion(records),
  };
}

type Resolver = Readonly<{
  id: string;
  key: string;
  name: string;
  kind: string;
  lifecycle: string;
  sourceState: string;
  sourceRevision?: string;
  version: number;
}>;

function parseResolver(value: unknown, path: string): Resolver {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.resolverId, `${path}.resolverId`),
    key: adminV2Text(record.resolverKey, `${path}.resolverKey`, { max: 120 }),
    name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
    kind: adminV2Text(record.resolverKind, `${path}.resolverKind`, { max: 80 }),
    lifecycle: adminV2Text(record.lifecycle, `${path}.lifecycle`, { max: 80 }),
    sourceState: adminV2Text(record.sourceState, `${path}.sourceState`, { max: 80 }),
    sourceRevision: optionalText(record.sourceRevision, `${path}.sourceRevision`, 200),
    version: adminV2Version(record.version, `${path}.version`),
  };
}

function memberName(record: Record<string, unknown>, resolvers: ReadonlyMap<string, Resolver>) {
  const kind = adminV2Text(record.kind, 'member.kind', { max: 80 });
  if (kind === 'RESOLVER') {
    const resolverId = adminV2Identifier(record.resolverId, 'member.resolverId');
    return resolvers.get(resolverId)?.name ?? resolverId;
  }
  if (kind === 'GROUP') return adminV2Identifier(record.nestedGroupId, 'member.nestedGroupId');
  const person = optionalText(record.personPublicId, 'member.personPublicId', 200);
  const user = adminV2Number(record.userId, 'member.userId', { min: 1, integer: true });
  return person ?? String(user);
}

function parseGroup(
  value: unknown,
  path: string,
  resolvers: ReadonlyMap<string, Resolver>
): ApprovalRoutingDirectorySnapshot['groups'][number] {
  const record = adminV2Record(value, path);
  const id = adminV2Identifier(record.groupId, `${path}.groupId`);
  const version = adminV2Version(record.version, `${path}.version`);
  const lifecycle = adminV2Text(record.lifecycle, `${path}.lifecycle`, { max: 80 });
  const members = adminV2Array(
    record.members,
    `${path}.members`,
    (item, itemPath) => {
      const source = adminV2Record(item, itemPath);
      const memberId = adminV2Identifier(source.memberId, `${itemPath}.memberId`);
      const kind = adminV2Text(source.kind, `${itemPath}.kind`, { max: 80 });
      const resolverId =
        kind === 'RESOLVER'
          ? adminV2Identifier(source.resolverId, `${itemPath}.resolverId`)
          : undefined;
      const resolver = resolverId ? resolvers.get(resolverId) : undefined;
      return {
        id: memberId,
        name: memberName(source, resolvers),
        roleLabel: kind,
        sourceLabel: resolver?.key ?? kind,
        status: parseAdminV2Status(resolver?.sourceState ?? lifecycle, `${itemPath}.status`),
      };
    },
    500
  );
  const facts: ApprovalAdminV2Fact[] = [fact('version', 'Version', String(version))];
  const effectiveFrom = optionalInstant(record.effectiveFrom, `${path}.effectiveFrom`);
  const effectiveTo = optionalInstant(record.effectiveTo, `${path}.effectiveTo`);
  if (effectiveFrom) facts.push(fact('effectiveFrom', 'Effective from', effectiveFrom));
  if (effectiveTo) facts.push(fact('effectiveTo', 'Effective to', effectiveTo));
  return {
    id,
    name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
    description: adminV2Text(record.description, `${path}.description`, { max: 1200 }),
    ownerLabel: adminV2Text(record.groupKey, `${path}.groupKey`, { max: 120 }),
    scopeLabel: lifecycle,
    memberCountLabel: String(members.length),
    usageLabel: `v${version}`,
    status: parseAdminV2Status(lifecycle, `${path}.lifecycle`),
    facts,
    members,
    command: { targetId: id, expectedVersion: version, commandReady: lifecycle !== 'RETIRED' },
  };
}

export function parseLiveRoutingDirectory(
  groupsValue: unknown,
  resolversValue: unknown
): ApprovalRoutingDirectorySnapshot {
  const resolvers = adminV2Array(resolversValue, 'resolvers', parseResolver, 500);
  const resolverById = new Map(resolvers.map((resolver) => [resolver.id, resolver]));
  const groups = adminV2Array(
    groupsValue,
    'groups',
    (item, path) => parseGroup(item, path, resolverById),
    500
  );
  return {
    meta: meta(
      [...groups.map((group) => ({ version: group.command.expectedVersion })), ...resolvers],
      resolvers.flatMap((resolver) => (resolver.sourceRevision ? [resolver.sourceRevision] : []))
    ),
    metrics: [
      { id: 'groups', label: 'Groups', value: String(groups.length) },
      { id: 'resolvers', label: 'Resolvers', value: String(resolvers.length) },
    ],
    groups,
    simulation: null,
    exceptions: [],
  };
}

type Calendar = Readonly<{
  id: string;
  name: string;
  timeZone: string;
  lifecycle: string;
  workWeekCount: number;
  holidayCount: number;
  exceptionCount: number;
  version: number;
}>;

function parseCalendar(value: unknown, path: string): Calendar {
  const record = adminV2Record(value, path);
  const workWeek = adminV2Record(record.workWeek, `${path}.workWeek`);
  const holidays = adminV2Array(record.holidays, `${path}.holidays`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    adminV2Text(source.date, `${itemPath}.date`, { max: 40 });
    adminV2Text(source.label, `${itemPath}.label`, { max: 200 });
    return true;
  });
  const exceptions = adminV2Array(record.exceptions, `${path}.exceptions`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    adminV2Text(source.date, `${itemPath}.date`, { max: 40 });
    adminV2Text(source.reason, `${itemPath}.reason`, { max: 300 });
    return true;
  });
  return {
    id: adminV2Identifier(record.calendarId, `${path}.calendarId`),
    name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
    timeZone: adminV2Text(record.timeZone, `${path}.timeZone`, { max: 100 }),
    lifecycle: adminV2Text(record.lifecycle, `${path}.lifecycle`, { max: 80 }),
    workWeekCount: Object.keys(workWeek).length,
    holidayCount: holidays.length,
    exceptionCount: exceptions.length,
    version: adminV2Version(record.version, `${path}.version`),
  };
}

function parsePolicy(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const reminders = adminV2Array(record.reminders, `${path}.reminders`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    return {
      key: adminV2Text(source.reminderKey, `${itemPath}.reminderKey`, { max: 120 }),
      minutes: adminV2Number(source.businessMinutesBefore, `${itemPath}.businessMinutesBefore`, {
        min: 0,
        integer: true,
      }),
      template: adminV2Text(source.templateKey, `${itemPath}.templateKey`, { max: 160 }),
    };
  });
  const escalations = adminV2Array(record.escalations, `${path}.escalations`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    return {
      key: adminV2Text(source.escalationKey, `${itemPath}.escalationKey`, { max: 120 }),
      minutes: adminV2Number(source.businessMinutesAfter, `${itemPath}.businessMinutesAfter`, {
        min: 0,
        integer: true,
      }),
      action: adminV2Text(source.action, `${itemPath}.action`, { max: 120 }),
    };
  });
  return {
    id: adminV2Identifier(record.policyId, `${path}.policyId`),
    key: adminV2Text(record.policyKey, `${path}.policyKey`, { max: 120 }),
    name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
    lifecycle: adminV2Text(record.lifecycle, `${path}.lifecycle`, { max: 80 }),
    version: adminV2Version(record.version, `${path}.version`),
    calendarId: adminV2Identifier(record.calendarId, `${path}.calendarId`),
    definitionSha256: optionalText(record.definitionSha256, `${path}.definitionSha256`, 128),
    reminders,
    escalations,
  };
}

function parseDelegation(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const id = adminV2Identifier(record.delegationId, `${path}.delegationId`);
  const version = adminV2Version(record.version, `${path}.version`);
  const findings = adminV2Array(
    record.findings,
    `${path}.findings`,
    (item, itemPath) => adminV2Text(item, itemPath, { max: 300 }),
    100
  );
  const truthFields = [
    'scopeBindingTruth',
    'timeWindowTruth',
    'noSubDelegationTruth',
    'identitySeparationTruth',
    'roleSnapshotTruth',
    'roleSeparationOfDutiesTruth',
  ] as const;
  const facts = truthFields.map((key) =>
    fact(key, key, adminV2Text(record[key], `${path}.${key}`, { max: 80 }))
  );
  return {
    id,
    title: adminV2Text(record.delegateDisplayName, `${path}.delegateDisplayName`, { max: 200 }),
    description: adminV2Text(record.reason, `${path}.reason`, { max: 1000 }),
    scopeLabel: adminV2Text(record.scopeType, `${path}.scopeType`, { max: 80 }),
    effectiveLabel: `${adminV2Instant(record.startsAt, `${path}.startsAt`)} – ${adminV2Instant(record.endsAt, `${path}.endsAt`)}`,
    auditLabel: findings.length
      ? findings.join(' · ')
      : adminV2Text(record.lifecycleState, `${path}.lifecycleState`, { max: 80 }),
    status: parseAdminV2Status(record.effectiveState, `${path}.effectiveState`),
    facts,
    command: command(id, version),
  };
}

export function parseLivePolicyAutomation(
  calendarsValue: unknown,
  channelsValue: unknown,
  policiesValue: unknown,
  delegationsValue: unknown
): ApprovalPolicyAutomationSnapshot {
  const calendars = adminV2Array(calendarsValue, 'calendars', parseCalendar, 300);
  const channelRecords = adminV2Array(channelsValue, 'channels', (item, path) => {
    const record = adminV2Record(item, path);
    return {
      id: adminV2Identifier(record.channelId, `${path}.channelId`),
      key: adminV2Text(record.channelKey, `${path}.channelKey`, { max: 120 }),
      type: adminV2Text(record.channelType, `${path}.channelType`, { max: 80 }),
      readiness: adminV2Text(record.readiness, `${path}.readiness`, { max: 80 }),
      observedAt: optionalInstant(record.observedAt, `${path}.observedAt`),
      version: adminV2Version(record.version, `${path}.version`),
    };
  });
  const policyRecords = adminV2Array(policiesValue, 'policies', parsePolicy, 300);
  const delegations = adminV2Array(delegationsValue, 'delegations', parseDelegation, 300);
  const firstPolicy = policyRecords[0];
  const escalationSteps = firstPolicy
    ? [
        ...firstPolicy.reminders.map((item, index) => ({
          id: `reminder-${index}-${item.key}`,
          title: item.key,
          detail: `${item.minutes} minutes before · ${item.template}`,
          status: parseAdminV2Status(
            firstPolicy.lifecycle,
            `policies[0].reminders[${index}].status`
          ),
        })),
        ...firstPolicy.escalations.map((item, index) => ({
          id: `escalation-${index}-${item.key}`,
          title: item.key,
          detail: `${item.minutes} minutes after · ${item.action}`,
          status: parseAdminV2Status(
            firstPolicy.lifecycle,
            `policies[0].escalations[${index}].status`
          ),
        })),
      ]
    : [];
  return {
    meta: meta(
      [
        ...calendars,
        ...channelRecords,
        ...policyRecords,
        ...delegations.map((item) => ({ version: item.command.expectedVersion })),
      ],
      policyRecords.flatMap((item) => (item.definitionSha256 ? [item.definitionSha256] : []))
    ),
    metrics: [
      { id: 'policies', label: 'Policies', value: String(policyRecords.length) },
      { id: 'channels', label: 'Channels', value: String(channelRecords.length) },
      { id: 'delegations', label: 'Delegations', value: String(delegations.length) },
    ],
    policies: policyRecords.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.key,
      familyLabel: 'REMINDER_ESCALATION',
      scopeLabel: item.calendarId,
      versionLabel: `v${item.version}`,
      status: parseAdminV2Status(item.lifecycle, `policy.${item.id}.lifecycle`),
      facts: [fact('calendar', 'Calendar', item.calendarId)],
      impactFacts: [],
      highRisk: item.escalations.some((entry) => /AUTO_APPROVE|AUTO_REJECT/u.test(entry.action)),
      command: command(item.id, item.version),
    })),
    providers: channelRecords.map((item) => ({
      id: item.id,
      name: item.key,
      channelLabel: item.type,
      lastVerifiedLabel: item.observedAt ?? 'NOT_OBSERVED',
      status: parseAdminV2Status(item.readiness, `channel.${item.id}.readiness`),
    })),
    calendars: calendars.map((item) => ({
      id: item.id,
      name: item.name,
      timezoneLabel: item.timeZone,
      effectiveLabel: item.lifecycle,
      weekdaysLabel: String(item.workWeekCount),
      holidayCountLabel: String(item.holidayCount),
      exceptionCountLabel: String(item.exceptionCount),
      status: parseAdminV2Status(item.lifecycle, `calendar.${item.id}.lifecycle`),
      facts: [fact('version', 'Version', String(item.version))],
    })),
    deliveryPreview: null,
    escalationSteps,
    delegations,
    simulationCommand: command(calendars[0]?.id ?? 'unavailable', calendars[0]?.version ?? 0),
  };
}
