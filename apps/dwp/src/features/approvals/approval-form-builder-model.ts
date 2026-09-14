import type { ApprovalFormField } from '@dwp-frontend/shared-utils';

export const SUPPORTED_APPROVAL_FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'USER',
] as const satisfies readonly ApprovalFormField['type'][];

export type ApprovalFormFieldIssue = Readonly<{
  index: number;
  key: string;
  issue: 'KEY' | 'DUPLICATE_KEY' | 'LABEL' | 'HELP' | 'OPTIONS' | 'TYPE';
}>;

export function createApprovalFormField(
  index: number,
  fields: readonly ApprovalFormField[] = []
): ApprovalFormField {
  let ordinal = index + 1;
  while (fields.some((field) => field.key === `field${ordinal}`)) ordinal += 1;
  return {
    key: `field${ordinal}`,
    labelKo: '',
    labelEn: '',
    helpKo: '',
    helpEn: '',
    type: 'TEXT',
    required: false,
    options: [],
  };
}

export function moveApprovalFormField(
  fields: readonly ApprovalFormField[],
  index: number,
  direction: -1 | 1
): ApprovalFormField[] {
  const target = index + direction;
  if (index < 0 || index >= fields.length || target < 0 || target >= fields.length) {
    return [...fields];
  }
  const next = fields.map((field) => ({ ...field, options: [...(field.options ?? [])] }));
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function approvalFormFieldIssues(
  fields: readonly ApprovalFormField[]
): ApprovalFormFieldIssue[] {
  const counts = new Map<string, number>();
  for (const field of fields) {
    const key = field.key.trim().toLocaleLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return fields.flatMap((field, index) => {
    const issues: ApprovalFormFieldIssue[] = [];
    const key = field.key.trim();
    if (!/^[a-z][A-Za-z0-9_]{1,79}$/u.test(field.key)) {
      issues.push({ index, key: field.key, issue: 'KEY' });
    } else if ((counts.get(key.toLocaleLowerCase()) ?? 0) > 1) {
      issues.push({ index, key: field.key, issue: 'DUPLICATE_KEY' });
    }
    if (
      !(field.labelKo ?? '').trim() ||
      !(field.labelEn ?? '').trim() ||
      (field.labelKo?.length ?? 0) > 160 ||
      (field.labelEn?.length ?? 0) > 160
    ) {
      issues.push({ index, key: field.key, issue: 'LABEL' });
    }
    if ((field.helpKo?.length ?? 0) > 500 || (field.helpEn?.length ?? 0) > 500) {
      issues.push({ index, key: field.key, issue: 'HELP' });
    }
    if (!SUPPORTED_APPROVAL_FORM_FIELD_TYPES.includes(field.type)) {
      issues.push({ index, key: field.key, issue: 'TYPE' });
    }
    if (
      (field.type !== 'SELECT' && (field.options?.length ?? 0) > 0) ||
      (field.type === 'SELECT' &&
        ((field.options?.length ?? 0) < 2 ||
          (field.options?.length ?? 0) > 50 ||
          new Set((field.options ?? []).map((option) => option.trim())).size !==
            field.options?.length ||
          (field.options ?? []).some((option) => !option.trim() || option.length > 160)))
    ) {
      issues.push({ index, key: field.key, issue: 'OPTIONS' });
    }
    return issues;
  });
}
