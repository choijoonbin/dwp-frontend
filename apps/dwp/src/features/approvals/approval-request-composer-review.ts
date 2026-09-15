import type {
  ApprovalForm,
  ApprovalFormField,
  ApprovalTypedField,
} from '@dwp-frontend/shared-utils';

export type ApprovalRequestReviewIssue = Readonly<{
  path: string;
  label: string;
}>;

export type ApprovalRequestFormChangeImpact = Readonly<{
  source: Readonly<{ formId: string; label: string; version: number }>;
  target: Readonly<{ formId: string; label: string; version: number }>;
  excluded: readonly ApprovalRequestReviewIssue[];
}>;

function formLabel(form: ApprovalForm, korean: boolean): string {
  return korean ? form.nameKo : form.nameEn;
}

function typedLabel(
  fields: readonly ApprovalTypedField[],
  path: string,
  korean: boolean
): string | undefined {
  const match = /^([a-z][A-Za-z0-9_]*)(?:\[(\d+)\]\.([a-z][A-Za-z0-9_]*))?$/.exec(path);
  if (!match) return undefined;
  const root = fields.find((field) => field.key === match[1]);
  if (!root) return undefined;
  const rootLabel = korean ? root.labelKo : root.labelEn;
  if (root.type !== 'REPEATING_GROUP' || !match[3]) return rootLabel;
  const child = root.fields.find((field) => field.key === match[3]);
  if (!child) return rootLabel;
  return `${rootLabel} · ${korean ? child.labelKo : child.labelEn}`;
}

function legacyLabel(field: ApprovalFormField, korean: boolean): string {
  return (korean ? field.labelKo : field.labelEn) ?? field.key;
}

function meaningful(value: unknown): boolean {
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(meaningful);
  if (value && typeof value === 'object') return Object.values(value).some(meaningful);
  return value !== null && value !== undefined;
}

export function approvalRequestValidationIssues(input: {
  title: string;
  summary: string;
  titleLabel: string;
  summaryLabel: string;
  businessFieldsLabel: string;
  korean: boolean;
  legacyMissing: readonly ApprovalFormField[];
  typedFields?: readonly ApprovalTypedField[];
  typedMissingPaths: readonly string[];
  invalidPath?: string;
  userSourcePath?: string;
}): readonly ApprovalRequestReviewIssue[] {
  const issues: ApprovalRequestReviewIssue[] = [];
  const add = (path: string, label: string) => {
    if (!issues.some((issue) => issue.path === path)) issues.push({ path, label });
  };
  if (input.title.trim().length < 2) add('$title', input.titleLabel);
  if (input.summary.trim().length < 2) add('$summary', input.summaryLabel);
  for (const field of input.legacyMissing) add(field.key, legacyLabel(field, input.korean));
  for (const path of input.typedMissingPaths) {
    add(path, typedLabel(input.typedFields ?? [], path, input.korean) ?? path);
  }
  if (input.invalidPath) {
    add(
      input.invalidPath,
      typedLabel(input.typedFields ?? [], input.invalidPath, input.korean) ??
        input.businessFieldsLabel
    );
  }
  if (input.userSourcePath) {
    add(
      input.userSourcePath,
      typedLabel(input.typedFields ?? [], input.userSourcePath, input.korean) ??
        input.businessFieldsLabel
    );
  }
  return issues;
}

export function approvalRequestFormChangeImpact(input: {
  forms: readonly ApprovalForm[];
  sourceFormId: string;
  targetFormId: string;
  values: Readonly<Record<string, unknown>>;
  korean: boolean;
  legacyFields: readonly ApprovalFormField[];
  typedFields?: readonly ApprovalTypedField[];
}): ApprovalRequestFormChangeImpact | undefined {
  const source = input.forms.find((form) => form.formId === input.sourceFormId);
  const target = input.forms.find((form) => form.formId === input.targetFormId);
  if (!source || !target || source.formId === target.formId) return undefined;
  const excluded = Object.entries(input.values)
    .filter(([, value]) => meaningful(value))
    .map(([path]) => {
      const legacy = input.legacyFields.find((field) => field.key === path);
      return {
        path,
        label:
          typedLabel(input.typedFields ?? [], path, input.korean) ??
          (legacy ? legacyLabel(legacy, input.korean) : path),
      };
    });
  return {
    source: {
      formId: source.formId,
      label: formLabel(source, input.korean),
      version: source.currentVersion,
    },
    target: {
      formId: target.formId,
      label: formLabel(target, input.korean),
      version: target.currentVersion,
    },
    excluded,
  };
}
