import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type ApprovalFormUserBinding = Readonly<{
  formId: string;
  formVersionId: string;
  schemaSha256: string;
  fieldKey: string;
  groupKey?: string;
  surface: 'WORK' | 'ADMIN';
  requestId?: string;
}>;

export type ApprovalFormUserCandidate = Readonly<{
  personPublicId: string;
  displayName: string;
}>;

export type ApprovalFormUserCandidates = Readonly<{
  formVersionId: string;
  schemaSha256: string;
  fieldPath: string;
  decisionRevision: string;
  validUntil: string;
  people: readonly ApprovalFormUserCandidate[];
  mayBeTruncated: boolean;
  requestId: string | null;
  requestVersion: number | null;
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fieldKey = /^[a-z][A-Za-z0-9_]{1,79}$/;
const sha256 = /^[0-9a-f]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function invalid(): never {
  throw new Error('Invalid approval form user source binding');
}
function hasControl(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export async function searchApprovalFormUserCandidates(
  binding: ApprovalFormUserBinding,
  query: string,
  size = 10,
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<ApprovalFormUserCandidates> {
  if (
    !uuid.test(binding.formId) ||
    !uuid.test(binding.formVersionId) ||
    !sha256.test(binding.schemaSha256) ||
    !fieldKey.test(binding.fieldKey) ||
    (binding.groupKey !== undefined && !fieldKey.test(binding.groupKey)) ||
    !['WORK', 'ADMIN'].includes(binding.surface) ||
    (binding.requestId !== undefined &&
      (binding.surface !== 'WORK' || !uuid.test(binding.requestId))) ||
    typeof query !== 'string' ||
    query !== query.trim() ||
    query.length < 2 ||
    query.length > 100 ||
    hasControl(query) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 30
  )
    invalid();
  const params = new URLSearchParams({
    schemaSha256: binding.schemaSha256,
    fieldKey: binding.fieldKey,
    query,
    size: String(size),
    ...(binding.groupKey === undefined ? {} : { groupKey: binding.groupKey }),
    ...(binding.requestId === undefined ? {} : { requestId: binding.requestId }),
  });
  const prefix = binding.surface === 'ADMIN' ? 'admin' : 'catalog';
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/approvals/v1/${prefix}/forms/${binding.formId}/versions/${binding.formVersionId}/field-candidates?${params}`,
    { contextScopeKey, signal }
  );
  const data = response.data.data;
  const path =
    binding.groupKey === undefined ? binding.fieldKey : `${binding.groupKey}.${binding.fieldKey}`;
  if (
    !record(data) ||
    !exact(data, [
      'formVersionId',
      'schemaSha256',
      'fieldPath',
      'decisionRevision',
      'validUntil',
      'people',
      'mayBeTruncated',
      'requestId',
      'requestVersion',
    ]) ||
    data.formVersionId !== binding.formVersionId ||
    data.schemaSha256 !== binding.schemaSha256 ||
    data.fieldPath !== path ||
    data.requestId !== (binding.requestId ?? null) ||
    (binding.requestId === undefined
      ? data.requestVersion !== null
      : !Number.isSafeInteger(data.requestVersion) || (data.requestVersion as number) < 0) ||
    typeof data.decisionRevision !== 'string' ||
    !data.decisionRevision.trim() ||
    typeof data.validUntil !== 'string' ||
    !Number.isFinite(Date.parse(data.validUntil)) ||
    Date.parse(data.validUntil) <= Date.now() ||
    !Array.isArray(data.people) ||
    data.people.length > size ||
    typeof data.mayBeTruncated !== 'boolean' ||
    data.mayBeTruncated !== (data.people.length === size)
  )
    invalid();
  const people: ApprovalFormUserCandidate[] = [];
  const ids = new Set<string>();
  for (const person of data.people) {
    if (
      !record(person) ||
      !exact(person, ['personPublicId', 'displayName']) ||
      typeof person.personPublicId !== 'string' ||
      !uuid.test(person.personPublicId) ||
      ids.has(person.personPublicId) ||
      typeof person.displayName !== 'string' ||
      !person.displayName.trim() ||
      person.displayName.length > 200 ||
      hasControl(person.displayName)
    )
      invalid();
    ids.add(person.personPublicId);
    people.push(
      Object.freeze({ personPublicId: person.personPublicId, displayName: person.displayName })
    );
  }
  return Object.freeze({
    formVersionId: binding.formVersionId,
    schemaSha256: binding.schemaSha256,
    fieldPath: path,
    decisionRevision: data.decisionRevision,
    validUntil: data.validUntil,
    people: Object.freeze(people),
    mayBeTruncated: data.mayBeTruncated,
    requestId: binding.requestId ?? null,
    requestVersion: data.requestVersion as number | null,
  });
}
