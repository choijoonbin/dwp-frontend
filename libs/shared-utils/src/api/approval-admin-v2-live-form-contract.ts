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
  ApprovalFormStudioV3Snapshot,
  ApprovalTemplateLibrarySnapshot,
} from './approval-admin-v2-design-contract';
import type { ApprovalAdminV2Fact } from './approval-admin-v2-contract-core';

export type ApprovalAdminV2Locale = 'ko' | 'en';

function optionalText(value: unknown, path: string, max = 500): string | undefined {
  return value == null ? undefined : adminV2Text(value, path, { max });
}

function optionalInstant(value: unknown, path: string): string | undefined {
  return value == null ? undefined : adminV2Instant(value, path);
}

function fact(id: string, label: string, value: string): ApprovalAdminV2Fact {
  return { id, label, value };
}

function jsonLabel(value: unknown, path: string, max = 2000): string {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new ApprovalAdminV2ContractError(path);
  }
  if (serialized === undefined) throw new ApprovalAdminV2ContractError(path);
  return adminV2Text(serialized, path, { max });
}

function localized(value: unknown, path: string, locale: ApprovalAdminV2Locale, max = 500): string {
  const record = adminV2Record(value, path);
  const ko = adminV2Text(record.ko, `${path}.ko`, { max });
  const en = adminV2Text(record.en, `${path}.en`, { max });
  return locale === 'ko' ? ko : en;
}

function localizedFields(
  record: Record<string, unknown>,
  path: string,
  locale: ApprovalAdminV2Locale,
  max = 1000
) {
  const ko = adminV2Text(record.nameKo, `${path}.nameKo`, { max });
  const en = adminV2Text(record.nameEn, `${path}.nameEn`, { max });
  const descriptionKo = adminV2Text(record.descriptionKo, `${path}.descriptionKo`, { max });
  const descriptionEn = adminV2Text(record.descriptionEn, `${path}.descriptionEn`, { max });
  return {
    name: locale === 'ko' ? ko : en,
    description: locale === 'ko' ? descriptionKo : descriptionEn,
  };
}

function parseTemplate(value: unknown, path: string, locale: ApprovalAdminV2Locale) {
  const record = adminV2Record(value, path);
  const current = adminV2Record(record.current, `${path}.current`);
  const id = adminV2Identifier(record.templateId, `${path}.templateId`);
  const version = adminV2Version(record.version, `${path}.version`);
  const currentVersion = adminV2Number(record.currentVersion, `${path}.currentVersion`, {
    min: 1,
    integer: true,
  });
  const categoryKey = adminV2Text(record.categoryKey, `${path}.categoryKey`, { max: 120 });
  const scopeKind = adminV2Text(record.scopeKind, `${path}.scopeKind`, { max: 80 });
  const lifecycle = adminV2Text(record.lifecycleState, `${path}.lifecycleState`, { max: 80 });
  const content = localizedFields(current, `${path}.current`, locale, 1600);
  const releasedAt = optionalInstant(current.releasedAt, `${path}.current.releasedAt`);
  const schemaSha = adminV2Text(current.schemaSha256, `${path}.current.schemaSha256`, {
    max: 128,
  });
  const dependencies = adminV2Array(
    current.dependencies,
    `${path}.current.dependencies`,
    (item, itemPath) => {
      const dependency = adminV2Record(item, itemPath);
      const kind = adminV2Text(dependency.kind, `${itemPath}.kind`, { max: 80 });
      const key = adminV2Text(dependency.key, `${itemPath}.key`, { max: 200 });
      const constraint = adminV2Text(
        dependency.versionConstraint,
        `${itemPath}.versionConstraint`,
        { max: 120 }
      );
      const required = adminV2Boolean(dependency.required, `${itemPath}.required`);
      return {
        id: `${kind}-${key}`,
        name: key,
        detail: constraint,
        status: parseAdminV2Status(required ? 'REQUIRED' : 'OPTIONAL', `${itemPath}.status`),
        meta: kind,
      };
    },
    200
  );
  const releaseNotes = [
    optionalText(
      locale === 'ko' ? current.changeSummaryKo : current.changeSummaryEn,
      `${path}.current.changeSummary`,
      1600
    ),
  ].filter((item): item is string => Boolean(item));
  return {
    id,
    categoryKey,
    version,
    releasedAt,
    schemaSha,
    view: {
      id,
      name: content.name,
      summary: content.description,
      categoryId: categoryKey,
      categoryLabel: categoryKey,
      ownerLabel: adminV2Text(record.ownerGroupRef, `${path}.ownerGroupRef`, { max: 200 }),
      versionLabel: `v${currentVersion}`,
      usageLabel: scopeKind,
      updatedLabel: releasedAt ?? lifecycle,
      status: parseAdminV2Status(lifecycle, `${path}.status`),
      featured: false,
      installed: false,
      facts: [
        fact(
          'templateKey',
          'Template key',
          adminV2Text(record.templateKey, `${path}.templateKey`, { max: 160 })
        ),
        fact('schemaSha256', 'Schema digest', schemaSha),
        fact('scope', 'Scope', scopeKind),
      ],
      dependencies,
      releaseNotes,
      command: {
        targetId: id,
        expectedVersion: version,
        commandReady: lifecycle === 'RELEASED',
      },
    },
  };
}

export function parseLiveTemplateLibrary(
  catalogValue: unknown,
  locale: ApprovalAdminV2Locale
): ApprovalTemplateLibrarySnapshot {
  const page = adminV2Record(catalogValue, 'templateCatalog');
  const templates = adminV2Array(
    page.items,
    'templateCatalog.items',
    (item, path) => parseTemplate(item, path, locale),
    300
  );
  adminV2Boolean(page.mayHaveMore, 'templateCatalog.mayHaveMore');
  optionalText(page.nextTemplateKey, 'templateCatalog.nextTemplateKey', 160);
  const counts = new Map<string, number>();
  templates.forEach((template) => {
    counts.set(template.categoryKey, (counts.get(template.categoryKey) ?? 0) + 1);
  });
  return {
    meta: {
      generatedAt: null,
      sourceRevision: null,
      objectVersion: Math.max(0, ...templates.map((template) => template.version)),
    },
    metrics: [
      { id: 'templates', label: 'Templates', value: String(templates.length) },
      {
        id: 'released',
        label: 'Released',
        value: String(templates.filter((template) => template.releasedAt).length),
      },
    ],
    categories: [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, count]) => ({ id, label: id, count })),
    templates: templates.map((template) => template.view),
  };
}

function parseStringArray(value: unknown, path: string, max = 200): readonly string[] {
  return adminV2Array(
    value,
    path,
    (item, itemPath) => adminV2Text(item, itemPath, { max: 200 }),
    max
  );
}

function parseField(
  value: unknown,
  path: string,
  locale: ApprovalAdminV2Locale,
  lifecycle: string,
  parentKey?: string
): ApprovalFormStudioV3Snapshot['fields'][number][] {
  const record = adminV2Record(value, path);
  const key = adminV2Text(record.key, `${path}.key`, { max: 160 });
  const qualifiedKey = parentKey ? `${parentKey}.${key}` : key;
  const type = adminV2Text(record.type, `${path}.type`, { max: 80 });
  const control = adminV2Text(record.control, `${path}.control`, { max: 80 });
  const label = localized(record.label, `${path}.label`, locale, 300);
  const helpText =
    record.help == null ? undefined : localized(record.help, `${path}.help`, locale, 1000);
  const span = adminV2Record(record.span, `${path}.span`);
  const desktop = adminV2Number(span.desktop, `${path}.span.desktop`, {
    min: 1,
    max: 12,
    integer: true,
  });
  const tablet = adminV2Number(span.tablet, `${path}.span.tablet`, {
    min: 1,
    max: 12,
    integer: true,
  });
  const mobile = adminV2Number(span.mobile, `${path}.span.mobile`, {
    min: 1,
    max: 12,
    integer: true,
  });
  const retention = adminV2Record(record.retention, `${path}.retention`);
  const exportPolicy = adminV2Record(record.export, `${path}.export`);
  const viewRoles = parseStringArray(record.viewRoles, `${path}.viewRoles`);
  const editRoles = parseStringArray(record.editRoles, `${path}.editRoles`);
  const field = {
    id: qualifiedKey,
    key: qualifiedKey,
    label,
    typeLabel: `${type} · ${control}`,
    ...(helpText ? { helpText } : {}),
    required: adminV2Boolean(record.required, `${path}.required`),
    spanLabel: `${desktop}/${tablet}/${mobile}`,
    classificationLabel: adminV2Text(retention.classification, `${path}.retention.classification`, {
      max: 80,
    }),
    status: parseAdminV2Status(lifecycle, `${path}.status`),
    facts: [
      fact('viewRoles', 'View roles', viewRoles.join(', ') || 'NONE'),
      fact('editRoles', 'Edit roles', editRoles.join(', ') || 'NONE'),
      fact(
        'exportFormat',
        'Export format',
        adminV2Text(exportPolicy.format, `${path}.export.format`, { max: 80 })
      ),
    ],
  };
  const columns =
    record.columns == null
      ? []
      : adminV2Array(
          record.columns,
          `${path}.columns`,
          (item, itemPath) => ({ item, itemPath }),
          100
        ).flatMap(({ item, itemPath }) =>
          parseField(item, itemPath, locale, lifecycle, qualifiedKey)
        );
  return [field, ...columns];
}

function parseSchemaFields(
  schema: Record<string, unknown>,
  locale: ApprovalAdminV2Locale,
  lifecycle: string
) {
  return adminV2Array(
    schema.pages,
    'form.schema.pages',
    (page, pagePath) => {
      const pageRecord = adminV2Record(page, pagePath);
      adminV2Text(pageRecord.key, `${pagePath}.key`, { max: 160 });
      localized(pageRecord.title, `${pagePath}.title`, locale, 300);
      return adminV2Array(pageRecord.sections, `${pagePath}.sections`, (section, sectionPath) => {
        const sectionRecord = adminV2Record(section, sectionPath);
        adminV2Text(sectionRecord.key, `${sectionPath}.key`, { max: 160 });
        localized(sectionRecord.title, `${sectionPath}.title`, locale, 300);
        return adminV2Array(
          sectionRecord.fields,
          `${sectionPath}.fields`,
          (fieldValue, fieldPath) => parseField(fieldValue, fieldPath, locale, lifecycle),
          300
        ).flat();
      }).flat();
    },
    50
  ).flat();
}

function parseRule(
  value: unknown,
  path: string,
  locale: ApprovalAdminV2Locale,
  lifecycle: string
): ApprovalFormStudioV3Snapshot['rules'][number] {
  const record = adminV2Record(value, path);
  const target = adminV2Text(record.target, `${path}.target`, { max: 160 });
  const effect = adminV2Text(record.effect, `${path}.effect`, { max: 80 });
  const message =
    record.message == null
      ? `${effect} · ${target}`
      : localized(record.message, `${path}.message`, locale, 1000);
  return {
    id: adminV2Identifier(record.key, `${path}.key`),
    name: adminV2Text(record.key, `${path}.key`, { max: 160 }),
    expression: jsonLabel(record.when, `${path}.when`),
    explanation: message,
    scopeLabel: target,
    status: parseAdminV2Status(lifecycle, `${path}.status`),
  };
}

export function parseLiveFormStudio(
  pageValue: unknown,
  detailValue: unknown | undefined,
  historyValue: unknown | undefined,
  locale: ApprovalAdminV2Locale
): ApprovalFormStudioV3Snapshot {
  const page = adminV2Record(pageValue, 'formWorkspaces');
  const summaries = adminV2Array(
    page.items,
    'formWorkspaces.items',
    (item, path) => {
      const record = adminV2Record(item, path);
      return {
        id: adminV2Identifier(record.formId, `${path}.formId`),
        version: adminV2Version(record.workspaceVersion, `${path}.workspaceVersion`),
      };
    },
    300
  );
  adminV2Boolean(page.mayHaveMore, 'formWorkspaces.mayHaveMore');
  optionalText(page.nextFormKey, 'formWorkspaces.nextFormKey', 160);
  if (summaries.length === 0) {
    return {
      meta: { generatedAt: null, sourceRevision: null, objectVersion: 0 },
      metrics: [],
      formId: 'unavailable',
      formName: 'NOT_AVAILABLE',
      versionLabel: 'NOT_AVAILABLE',
      formStatus: parseAdminV2Status('UNAVAILABLE', 'form.status'),
      schemaFacts: [],
      fields: [],
      rules: [],
      validation: [],
      reviewChanges: [],
      validationScore: 0,
      validationScoreLabel: 'NOT_REPORTED',
      command: { targetId: 'unavailable', expectedVersion: 0, commandReady: false },
    };
  }
  if (detailValue === undefined) throw new ApprovalAdminV2ContractError('formWorkspaceDetail');
  const detail = adminV2Record(detailValue, 'formWorkspaceDetail');
  const formId = adminV2Identifier(detail.formId, 'formWorkspaceDetail.formId');
  if (formId !== summaries[0]?.id)
    throw new ApprovalAdminV2ContractError('formWorkspaceDetail.formId');
  const workspaceVersion = adminV2Version(
    detail.workspaceVersion,
    'formWorkspaceDetail.workspaceVersion'
  );
  const lifecycle = adminV2Text(detail.lifecycleState, 'formWorkspaceDetail.lifecycleState', {
    max: 80,
  });
  const content = localizedFields(detail, 'formWorkspaceDetail', locale, 1600);
  const current = adminV2Record(detail.current, 'formWorkspaceDetail.current');
  const schema = adminV2Record(current.schema, 'formWorkspaceDetail.current.schema');
  const schemaContract = adminV2Text(schema.schemaContract, 'form.schema.schemaContract', {
    max: 120,
  });
  const schemaVersion = adminV2Number(schema.schemaVersion, 'form.schema.schemaVersion', {
    min: 1,
    integer: true,
  });
  const compatibility = adminV2Record(schema.compatibility, 'form.schema.compatibility');
  const compatibilityMode = adminV2Text(compatibility.mode, 'form.schema.compatibility.mode', {
    max: 80,
  });
  const fields = parseSchemaFields(schema, locale, lifecycle);
  const rules = adminV2Array(
    schema.rules,
    'form.schema.rules',
    (item, path) => parseRule(item, path, locale, lifecycle),
    300
  );
  const history =
    historyValue === undefined
      ? []
      : adminV2Array(
          adminV2Record(historyValue, 'formHistory').versions,
          'formHistory.versions',
          (item, path) => {
            const record = adminV2Record(item, path);
            const version = adminV2Number(record.versionNumber, `${path}.versionNumber`, {
              min: 1,
              integer: true,
            });
            return {
              id: adminV2Identifier(record.formVersionId, `${path}.formVersionId`),
              label: `v${version}`,
              beforeValue:
                optionalText(record.baseSchemaSha256, `${path}.baseSchemaSha256`, 128) ?? 'INITIAL',
              afterValue: adminV2Text(record.schemaSha256, `${path}.schemaSha256`, { max: 128 }),
              status: parseAdminV2Status(record.compatibilityMode, `${path}.compatibilityMode`),
            };
          },
          100
        );
  const currentVersion = adminV2Number(
    current.versionNumber,
    'formWorkspaceDetail.current.versionNumber',
    {
      min: 1,
      integer: true,
    }
  );
  const schemaSha = adminV2Text(current.schemaSha256, 'formWorkspaceDetail.current.schemaSha256', {
    max: 128,
  });
  return {
    meta: {
      generatedAt: optionalInstant(detail.updatedAt, 'formWorkspaceDetail.updatedAt') ?? null,
      sourceRevision: schemaSha,
      objectVersion: workspaceVersion,
    },
    metrics: [
      { id: 'fields', label: 'Fields', value: String(fields.length) },
      { id: 'rules', label: 'Rules', value: String(rules.length) },
      { id: 'versions', label: 'Versions', value: String(history.length) },
    ],
    formId,
    formName: content.name,
    versionLabel: `v${currentVersion}`,
    formStatus: parseAdminV2Status(lifecycle, 'formWorkspaceDetail.status'),
    dirtyLabel: schemaSha,
    schemaFacts: [
      fact('description', 'Description', content.description),
      fact('contract', 'Schema contract', schemaContract),
      fact('schemaVersion', 'Schema version', String(schemaVersion)),
      fact('compatibility', 'Compatibility', compatibilityMode),
    ],
    fields,
    rules,
    validation: [],
    reviewChanges: history,
    validationScore: 0,
    validationScoreLabel: 'NOT_REPORTED',
    command: {
      targetId: formId,
      expectedVersion: workspaceVersion,
      commandReady: lifecycle === 'DRAFT',
    },
  };
}
