import {
  ApprovalAdminV2ContractError,
  adminV2Array,
  adminV2Boolean,
  adminV2Identifier,
  adminV2Instant,
  adminV2Number,
  adminV2Record,
  adminV2Text,
  adminV2Version,
  parseAdminV2Status,
} from './approval-admin-v2-contract-core';

import type {
  ApprovalAnalyticsInsightsSnapshot,
  ApprovalDeploymentSnapshot,
} from './approval-admin-v2-insights-contract';
import type { ApprovalAdminV2Fact, ApprovalAdminV2Status } from './approval-admin-v2-contract-core';

function optionalText(value: unknown, path: string, max = 500): string | undefined {
  return value == null ? undefined : adminV2Text(value, path, { max });
}

function optionalInstant(value: unknown, path: string): string | undefined {
  return value == null ? undefined : adminV2Instant(value, path);
}

function optionalNumber(value: unknown, path: string): number | undefined {
  return value == null ? undefined : adminV2Number(value, path);
}

function fact(id: string, label: string, value: string): ApprovalAdminV2Fact {
  return { id, label, value };
}

function duration(seconds: number | undefined): string {
  if (seconds === undefined) return 'NOT_REPORTED';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

type Metrics = Readonly<{
  suppressed: boolean;
  sampleBand: string;
  sampleSize?: number;
  cycleP50?: number;
  cycleP90?: number;
  stageP50?: number;
  stageP90?: number;
  slaCompliance?: number;
  routeConformance?: number;
}>;

function parseMetrics(value: unknown, path: string): Metrics {
  const record = adminV2Record(value, path);
  return {
    suppressed: adminV2Boolean(record.suppressed, `${path}.suppressed`),
    sampleBand: adminV2Text(record.sampleBand, `${path}.sampleBand`, { max: 80 }),
    sampleSize: optionalNumber(record.sampleSize, `${path}.sampleSize`),
    cycleP50: optionalNumber(record.cycleP50Seconds, `${path}.cycleP50Seconds`),
    cycleP90: optionalNumber(record.cycleP90Seconds, `${path}.cycleP90Seconds`),
    stageP50: optionalNumber(record.stageWaitP50Seconds, `${path}.stageWaitP50Seconds`),
    stageP90: optionalNumber(record.stageWaitP90Seconds, `${path}.stageWaitP90Seconds`),
    slaCompliance: optionalNumber(record.slaCompliancePercent, `${path}.slaCompliancePercent`),
    routeConformance: optionalNumber(
      record.routeConformancePercent,
      `${path}.routeConformancePercent`
    ),
  };
}

function metricStatus(metrics: Metrics): ApprovalAdminV2Status {
  return parseAdminV2Status(metrics.suppressed ? 'SUPPRESSED' : 'OBSERVED', 'metrics.status');
}

function metricFacts(metrics: Metrics): ApprovalAdminV2Fact[] {
  if (metrics.suppressed) return [];
  return [
    fact('cycleP90', 'Cycle p90', duration(metrics.cycleP90)),
    fact(
      'slaCompliance',
      'SLA compliance',
      metrics.slaCompliance === undefined ? 'NOT_REPORTED' : `${metrics.slaCompliance}%`
    ),
    fact(
      'routeConformance',
      'Route conformance',
      metrics.routeConformance === undefined ? 'NOT_REPORTED' : `${metrics.routeConformance}%`
    ),
  ];
}

function parseMetricDefinitions(value: unknown) {
  return adminV2Array(
    value,
    'metricDefinitions',
    (item, path) => {
      const record = adminV2Record(item, path);
      const key = adminV2Text(record.key, `${path}.key`, { max: 120 });
      const exclusions = adminV2Array(
        record.exclusions,
        `${path}.exclusions`,
        (exclusion, exclusionPath) => adminV2Text(exclusion, exclusionPath, { max: 300 }),
        100
      );
      return {
        key,
        label: adminV2Text(record.label, `${path}.label`, { max: 200 }),
        formula: adminV2Text(record.formula, `${path}.formula`, { max: 1000 }),
        unit: adminV2Text(record.unit, `${path}.unit`, { max: 80 }),
        exclusions,
      };
    },
    100
  );
}

function parseRepresentatives(value: unknown | undefined) {
  if (value === undefined) return [];
  return adminV2Array(
    value,
    'representatives',
    (item, path) => {
      const record = adminV2Record(item, path);
      return {
        requestId: adminV2Identifier(record.requestId, `${path}.requestId`),
        status: adminV2Text(record.requestStatus, `${path}.requestStatus`, { max: 80 }),
        submittedAt: adminV2Instant(record.submittedAt, `${path}.submittedAt`),
        completedAt: optionalInstant(record.completedAt, `${path}.completedAt`),
        cycleSeconds: optionalNumber(record.cycleSeconds, `${path}.cycleSeconds`),
        reworkCount: adminV2Number(record.reworkCount, `${path}.reworkCount`, {
          min: 0,
          integer: true,
        }),
        delegationCount: adminV2Number(record.delegationCount, `${path}.delegationCount`, {
          min: 0,
          integer: true,
        }),
        escalationCount: adminV2Number(record.escalationCount, `${path}.escalationCount`, {
          min: 0,
          integer: true,
        }),
        routeConformant: adminV2Boolean(record.routeConformant, `${path}.routeConformant`),
      };
    },
    100
  );
}

export function parseLiveAnalyticsDashboard(
  value: unknown,
  definitionsValue: unknown,
  representativesValue?: unknown,
  selectedCohortKey?: string
): ApprovalAnalyticsInsightsSnapshot {
  const dashboard = adminV2Record(value, 'analyticsDashboard');
  const generatedAt = adminV2Instant(dashboard.generatedAt, 'analyticsDashboard.generatedAt');
  const coverage = adminV2Record(dashboard.coverage, 'analyticsDashboard.coverage');
  const overall = parseMetrics(dashboard.overall, 'analyticsDashboard.overall');
  const definitions = parseMetricDefinitions(definitionsValue);
  const dashboardDefinitions = parseMetricDefinitions(dashboard.definitions);
  if (
    definitions.length !== dashboardDefinitions.length ||
    definitions.some((definition, index) => definition.key !== dashboardDefinitions[index]?.key)
  ) {
    throw new ApprovalAdminV2ContractError('analyticsDashboard.definitions');
  }
  const representatives = parseRepresentatives(representativesValue);
  const excluded = adminV2Record(coverage.excludedData, 'analyticsDashboard.coverage.excludedData');
  const coverageFacts: ApprovalAdminV2Fact[] = [
    fact(
      'candidate',
      'Candidate requests',
      String(
        adminV2Number(coverage.candidateRequests, 'analyticsDashboard.coverage.candidateRequests', {
          min: 0,
          integer: true,
        })
      )
    ),
    fact(
      'included',
      'Included requests',
      String(
        adminV2Number(coverage.includedRequests, 'analyticsDashboard.coverage.includedRequests', {
          min: 0,
          integer: true,
        })
      )
    ),
    fact(
      'includedPercent',
      'Included percent',
      `${adminV2Number(coverage.includedPercent, 'analyticsDashboard.coverage.includedPercent', { min: 0, max: 100 })}%`
    ),
    ...Object.entries(excluded).map(([key, count]) =>
      fact(
        `excluded-${key}`,
        `Excluded ${adminV2Text(key, `analyticsDashboard.coverage.excludedData.${key}.key`, { max: 120 })}`,
        String(
          adminV2Number(count, `analyticsDashboard.coverage.excludedData.${key}`, {
            min: 0,
            integer: true,
          })
        )
      )
    ),
  ];
  const cohorts = adminV2Array(dashboard.cohorts, 'analyticsDashboard.cohorts', (item, path) => {
    const record = adminV2Record(item, path);
    const key = adminV2Text(record.key, `${path}.key`, { max: 200 });
    const metrics = parseMetrics(record.metrics, `${path}.metrics`);
    return {
      id: key,
      label: key,
      sampleLabel: metrics.sampleBand,
      cycleTimeLabel: metrics.suppressed ? 'SUPPRESSED' : duration(metrics.cycleP50),
      slaLabel:
        metrics.suppressed || metrics.slaCompliance === undefined
          ? 'SUPPRESSED'
          : `${metrics.slaCompliance}%`,
      conformanceLabel:
        metrics.suppressed || metrics.routeConformance === undefined
          ? 'SUPPRESSED'
          : `${metrics.routeConformance}%`,
      suppressed: metrics.suppressed,
      status: metricStatus(metrics),
      facts: [
        ...metricFacts(metrics),
        ...(selectedCohortKey === key
          ? representatives.map((representative) =>
              fact(
                `representative-${representative.requestId}`,
                representative.requestId,
                `${representative.status} · ${duration(representative.cycleSeconds)} · ${representative.routeConformant ? 'ROUTE_CONFORMANT' : 'ROUTE_NON_CONFORMANT'}`
              )
            )
          : []),
      ],
    };
  });
  const stages = adminV2Array(
    dashboard.stageWaits,
    'analyticsDashboard.stageWaits',
    (item, path) => {
      const record = adminV2Record(item, path);
      const metrics = parseMetrics(record.metrics, `${path}.metrics`);
      const sequence = adminV2Number(record.sequence, `${path}.sequence`, {
        min: 0,
        integer: true,
      });
      return {
        id: `${sequence}-${adminV2Text(record.stepKey, `${path}.stepKey`, { max: 160 })}`,
        label: adminV2Text(record.stepKey, `${path}.stepKey`, { max: 160 }),
        sequenceLabel: String(sequence),
        p50Label: metrics.suppressed ? 'SUPPRESSED' : duration(metrics.stageP50),
        p90Label: metrics.suppressed ? 'SUPPRESSED' : duration(metrics.stageP90),
        sampleLabel: metrics.sampleBand,
        tone: metrics.suppressed ? ('warning' as const) : ('info' as const),
      };
    }
  );
  return {
    meta: { generatedAt, sourceRevision: null, objectVersion: 0 },
    metrics: [
      { id: 'sample', label: 'Sample', value: overall.sampleBand },
      {
        id: 'cycleP50',
        label: 'Cycle p50',
        value: overall.suppressed ? 'SUPPRESSED' : duration(overall.cycleP50),
      },
      {
        id: 'cycleP90',
        label: 'Cycle p90',
        value: overall.suppressed ? 'SUPPRESSED' : duration(overall.cycleP90),
      },
    ],
    coverageFacts: [
      ...coverageFacts,
      ...definitions.map((definition) =>
        fact(
          `metric-${definition.key}`,
          `${definition.label} (${definition.unit})`,
          `${definition.formula}${definition.exclusions.length ? ` · Excludes: ${definition.exclusions.join(', ')}` : ''}`
        )
      ),
    ],
    cohorts,
    stages,
    recommendations: [],
  };
}

function parsePackage(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  const id = adminV2Identifier(record.packageId, `${path}.packageId`);
  const packageVersion = adminV2Number(record.packageVersion, `${path}.packageVersion`, {
    min: 1,
    integer: true,
  });
  const rollback = adminV2Text(record.rollbackDisposition, `${path}.rollbackDisposition`, {
    max: 80,
  });
  const assets = adminV2Array(record.assets, `${path}.assets`, (item, itemPath) => {
    const source = adminV2Record(item, itemPath);
    return {
      key: adminV2Text(source.assetKey, `${itemPath}.assetKey`, { max: 200 }),
      type: adminV2Text(source.assetType, `${itemPath}.assetType`, { max: 80 }),
      version: adminV2Text(source.assetVersion, `${itemPath}.assetVersion`, { max: 120 }),
      sha: adminV2Text(source.contentSha256, `${itemPath}.contentSha256`, { max: 128 }),
    };
  });
  const dependencies = adminV2Array(
    record.dependencies,
    `${path}.dependencies`,
    (item, itemPath) => {
      const source = adminV2Record(item, itemPath);
      const assetKey = adminV2Text(source.assetKey, `${itemPath}.assetKey`, { max: 200 });
      return {
        id: `${assetKey}-${adminV2Text(source.dependsOnAssetKey, `${itemPath}.dependsOnAssetKey`, { max: 200 })}`,
        title: assetKey,
        detail: adminV2Text(source.dependsOnAssetKey, `${itemPath}.dependsOnAssetKey`, {
          max: 200,
        }),
        meta: adminV2Text(source.requiredSha256, `${itemPath}.requiredSha256`, { max: 128 }),
        status: parseAdminV2Status(
          adminV2Boolean(source.optional, `${itemPath}.optional`) ? 'OPTIONAL' : 'REQUIRED',
          `${itemPath}.status`
        ),
      };
    },
    500
  );
  return {
    id,
    name: adminV2Text(record.displayName, `${path}.displayName`, { max: 200 }),
    description: adminV2Text(record.manifestSha256, `${path}.manifestSha256`, { max: 128 }),
    versionLabel: `${adminV2Text(record.packageKey, `${path}.packageKey`, { max: 120 })} v${packageVersion}`,
    environmentLabel: 'PACKAGE',
    digestLabel: adminV2Text(record.manifestSha256, `${path}.manifestSha256`, { max: 128 }),
    assetCountLabel: String(assets.length),
    status: parseAdminV2Status('IMMUTABLE', `${path}.status`),
    validationStatus: parseAdminV2Status(rollback, `${path}.rollbackDisposition`),
    facts: assets.map((asset, index) =>
      fact(`asset-${index}`, `${asset.type} · ${asset.key}`, `${asset.version} · ${asset.sha}`)
    ),
    dependencies,
    command: { targetId: id, expectedVersion: packageVersion, commandReady: false },
  };
}

function parsePromotion(value: unknown, path: string) {
  const record = adminV2Record(value, path);
  return {
    id: adminV2Identifier(record.promotionId, `${path}.promotionId`),
    packageId: adminV2Identifier(record.packageId, `${path}.packageId`),
    source: adminV2Text(record.sourceEnvironment, `${path}.sourceEnvironment`, { max: 80 }),
    target: adminV2Text(record.targetEnvironment, `${path}.targetEnvironment`, { max: 80 }),
    status: adminV2Text(record.status, `${path}.status`, { max: 80 }),
    scheduledFor: optionalInstant(record.scheduledFor, `${path}.scheduledFor`),
    version: adminV2Version(record.version, `${path}.version`),
    updatedAt: adminV2Instant(record.updatedAt, `${path}.updatedAt`),
  };
}

function activationReady(
  promotion: ReturnType<typeof parsePromotion>,
  serverGeneratedAt: string
): boolean {
  if (promotion.version < 0) return false;
  if (promotion.status === 'APPROVED') return true;
  if (promotion.status !== 'SCHEDULED' || !promotion.scheduledFor) return false;
  return Date.parse(promotion.scheduledFor) <= Date.parse(serverGeneratedAt);
}

export function parseLiveDeployment(
  dashboardValue: unknown,
  packagesValue: unknown,
  promotionsValue: unknown,
  selectedDetailValue?: unknown,
  rollbackFeasibilityValue?: unknown
): ApprovalDeploymentSnapshot {
  const dashboard = adminV2Record(dashboardValue, 'deploymentDashboard');
  const generatedAt = adminV2Instant(dashboard.generatedAt, 'deploymentDashboard.generatedAt');
  const packages = adminV2Array(packagesValue, 'packages', parsePackage, 300);
  const promotions = adminV2Array(promotionsValue, 'promotions', parsePromotion, 300);
  const environmentHeads = adminV2Array(
    dashboard.environmentHeads,
    'deploymentDashboard.environmentHeads',
    (item, path) => {
      const record = adminV2Record(item, path);
      return {
        environment: adminV2Text(record.environment, `${path}.environment`, { max: 80 }),
        version: adminV2Version(record.version, `${path}.version`),
        updatedAt: adminV2Instant(record.updatedAt, `${path}.updatedAt`),
      };
    }
  );
  let promotionPlan: ApprovalDeploymentSnapshot['promotionPlan'] = null;
  let canaryEvidence: ApprovalDeploymentSnapshot['canaryEvidence'] = null;
  let rollbackAssessment: ApprovalDeploymentSnapshot['rollbackAssessment'] = null;
  if (selectedDetailValue !== undefined) {
    const detail = adminV2Record(selectedDetailValue, 'promotionDetail');
    const promotion = parsePromotion(detail.promotion, 'promotionDetail.promotion');
    const deploymentPackage = parsePackage(
      detail.deploymentPackage,
      'promotionDetail.deploymentPackage'
    );
    const evidence = adminV2Array(detail.evidence, 'promotionDetail.evidence', (item, path) => {
      const source = adminV2Record(item, path);
      const observed = adminV2Record(source.evidence, `${path}.evidence`);
      const evidenceId = adminV2Identifier(observed.evidenceId, `${path}.evidence.evidenceId`);
      const outcome = adminV2Text(observed.outcome, `${path}.evidence.outcome`, { max: 80 });
      return {
        id: evidenceId,
        title: adminV2Text(observed.evidenceType, `${path}.evidence.evidenceType`, { max: 120 }),
        detail: adminV2Text(observed.externalReference, `${path}.evidence.externalReference`, {
          max: 500,
        }),
        meta: adminV2Instant(observed.sourceGeneratedAt, `${path}.evidence.sourceGeneratedAt`),
        outcome,
        status: parseAdminV2Status(outcome, `${path}.evidence.outcome`),
      };
    });
    promotionPlan = {
      id: promotion.id,
      packageId: promotion.packageId,
      title: deploymentPackage.name,
      description: deploymentPackage.description,
      sourceEnvironmentLabel: promotion.source,
      targetEnvironmentLabel: promotion.target,
      scheduledLabel: promotion.scheduledFor ?? 'NOT_SCHEDULED',
      validationStatus: parseAdminV2Status(promotion.status, 'promotionDetail.validationStatus'),
      reviewStatus: parseAdminV2Status(promotion.status, 'promotionDetail.reviewStatus'),
      facts: [fact('updatedAt', 'Updated', promotion.updatedAt)],
      gates: evidence,
      command: {
        targetId: promotion.id,
        expectedVersion: promotion.version,
        commandReady: activationReady(promotion, generatedAt),
      },
    };
    const latest = evidence[0];
    if (latest) {
      canaryEvidence = {
        planId: promotion.id,
        status: latest.status,
        sampledAtLabel: latest.meta,
        sourceRevisionLabel: latest.id,
        evidenceWindowLabel: promotion.updatedAt,
        metrics: [],
        observations: evidence,
        command: {
          targetId: promotion.id,
          expectedVersion: promotion.version,
          commandReady: false,
        },
      };
    }
    const rollback = adminV2Record(
      rollbackFeasibilityValue ?? detail.rollbackFeasibility,
      'promotionDetail.rollbackFeasibility'
    );
    const conditions = adminV2Array(
      rollback.conditions,
      'promotionDetail.rollbackFeasibility.conditions',
      (item, path) => adminV2Text(item, path, { max: 500 }),
      100
    );
    const rollbackStatus = adminV2Text(
      rollback.status,
      'promotionDetail.rollbackFeasibility.status',
      { max: 80 }
    );
    rollbackAssessment = {
      planId: promotion.id,
      status: parseAdminV2Status(rollbackStatus, 'promotionDetail.rollbackFeasibility.status'),
      reversible: rollbackStatus === 'REVERSIBLE',
      assessedAtLabel: promotion.updatedAt,
      sourceRevisionLabel: deploymentPackage.digestLabel,
      summary:
        optionalText(
          rollback.externalSideEffectsStatus,
          'promotionDetail.rollbackFeasibility.externalSideEffectsStatus',
          500
        ) ?? rollbackStatus,
      facts: [],
      blockers: conditions.map((condition, index) => ({
        id: `condition-${index}`,
        title: condition,
        detail: condition,
        status: parseAdminV2Status('CONDITIONAL', `condition.${index}.status`),
      })),
      command: { targetId: promotion.id, expectedVersion: promotion.version, commandReady: false },
    };
  }
  return {
    meta: {
      generatedAt,
      sourceRevision: null,
      objectVersion: Math.max(0, ...environmentHeads.map((head) => head.version)),
    },
    metrics: [
      { id: 'packages', label: 'Packages', value: String(packages.length) },
      { id: 'promotions', label: 'Promotions', value: String(promotions.length) },
      { id: 'environments', label: 'Environments', value: String(environmentHeads.length) },
    ],
    packages,
    promotionPlan,
    canaryEvidence,
    rollbackAssessment,
  };
}
