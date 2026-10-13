import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { EmploymentOwnerRef } from '../../employment/assignment-proposal-model';

export const EMPLOYMENT_DOCUMENTS_PATH =
  '/api/people/v1/hris/workbench/self-service/employment-documents' as const;
export const EMPLOYMENT_ASSIGNMENTS_PATH =
  '/api/people/v1/hris/workbench/operations/employment/assignments' as const;

export type EmploymentDocument = Readonly<{
  workerPublicId: string;
  relationshipPublicId: string;
  assignmentPublicId: string;
  relationshipType: string;
  validFrom: string;
  validToExclusive: string | null;
  status: string;
  revision: number;
}>;

export type EmploymentDocumentsWorkbench = Readonly<{
  asOf: string;
  documents: readonly EmploymentDocument[];
}>;

export type EmploymentWorkbenchOwnerRef = EmploymentOwnerRef &
  Readonly<{ validFrom: string | null; validToExclusive: string | null }>;

export type EmploymentAssignment = Readonly<{
  personPublicId: string;
  workerPublicId: string;
  workerStatus: string;
  workerVersion: number;
  relationshipPublicId: string;
  relationshipType: string;
  relationshipStart: string;
  relationshipEnd: string | null;
  relationshipVersion: number;
  assignmentPublicId: string;
  assignmentStatus: string;
  validFrom: string;
  validToExclusive: string | null;
  primary: boolean;
  fte: string | null;
  assignmentVersion: number;
  legalEmployerRef: EmploymentWorkbenchOwnerRef;
  organizationRef: EmploymentWorkbenchOwnerRef | null;
  positionRef: EmploymentWorkbenchOwnerRef | null;
  jobRef: EmploymentWorkbenchOwnerRef | null;
  workLocationRef: EmploymentWorkbenchOwnerRef | null;
}>;

export type EmploymentAssignmentsWorkbench = Readonly<{
  asOf: string;
  assignments: readonly EmploymentAssignment[];
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FTE_PATTERN = /^(?:0(?:\.\d{1,12})?|1(?:\.0{1,12})?)$/u;
const DOCUMENT_KEYS = [
  'workerPublicId',
  'relationshipPublicId',
  'assignmentPublicId',
  'relationshipType',
  'validFrom',
  'validToExclusive',
  'status',
  'revision',
] as const;
const ASSIGNMENT_KEYS = [
  'personPublicId',
  'workerPublicId',
  'workerStatus',
  'workerVersion',
  'relationshipPublicId',
  'relationshipType',
  'relationshipStart',
  'relationshipEnd',
  'relationshipVersion',
  'assignmentPublicId',
  'assignmentStatus',
  'validFrom',
  'validToExclusive',
  'primary',
  'fte',
  'assignmentVersion',
  'legalEmployerRef',
  'organizationRef',
  'positionRef',
  'jobRef',
  'workLocationRef',
] as const;
const OWNER_REF_KEYS = [
  'owner',
  'schemaId',
  'publicId',
  'revision',
  'contentHash',
  'validFrom',
  'validToExclusive',
] as const;
const OWNER_SCHEMA_BY_FIELD = {
  legalEmployerRef: 'HRM.LegalEmployer.v1',
  organizationRef: 'HRM.Organization.v1',
  positionRef: 'HRM.Position.v1',
  jobRef: 'HRM.Job.v1',
  workLocationRef: 'HRM.WorkLocation.v1',
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(source: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(source).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const instant = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() + 1 === month &&
    instant.getUTCDate() === day
  );
}

function validCode(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 64
  );
}

function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function selectOwnerRef(value: unknown, schemaId: string): EmploymentWorkbenchOwnerRef {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, OWNER_REF_KEYS) ||
    source.owner !== 'HRM' ||
    source.schemaId !== schemaId ||
    typeof source.publicId !== 'string' ||
    !UUID_PATTERN.test(source.publicId) ||
    !validVersion(source.revision) ||
    typeof source.contentHash !== 'string' ||
    !SHA256_PATTERN.test(source.contentHash) ||
    (source.validFrom !== null && !validInstant(source.validFrom)) ||
    (source.validToExclusive !== null && !validInstant(source.validToExclusive)) ||
    (typeof source.validFrom === 'string' &&
      typeof source.validToExclusive === 'string' &&
      Date.parse(source.validToExclusive) <= Date.parse(source.validFrom))
  ) {
    throw new Error('Employment assignment owner evidence is invalid.');
  }
  return Object.freeze({
    owner: 'HRM',
    schemaId,
    publicId: source.publicId,
    revision: source.revision,
    contentHash: source.contentHash,
    validFrom: source.validFrom,
    validToExclusive: source.validToExclusive,
  });
}

function selectOptionalOwnerRef(
  value: unknown,
  schemaId: string
): EmploymentWorkbenchOwnerRef | null {
  return value === null ? null : selectOwnerRef(value, schemaId);
}

function selectEmploymentAssignment(value: unknown): EmploymentAssignment {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, ASSIGNMENT_KEYS) ||
    typeof source.personPublicId !== 'string' ||
    !UUID_PATTERN.test(source.personPublicId) ||
    typeof source.workerPublicId !== 'string' ||
    !UUID_PATTERN.test(source.workerPublicId) ||
    !validCode(source.workerStatus) ||
    !validVersion(source.workerVersion) ||
    typeof source.relationshipPublicId !== 'string' ||
    !UUID_PATTERN.test(source.relationshipPublicId) ||
    !validCode(source.relationshipType) ||
    !validCivilDate(source.relationshipStart) ||
    (source.relationshipEnd !== null && !validCivilDate(source.relationshipEnd)) ||
    (typeof source.relationshipEnd === 'string' &&
      source.relationshipEnd <= source.relationshipStart) ||
    !validVersion(source.relationshipVersion) ||
    typeof source.assignmentPublicId !== 'string' ||
    !UUID_PATTERN.test(source.assignmentPublicId) ||
    !validCode(source.assignmentStatus) ||
    !validCivilDate(source.validFrom) ||
    source.validFrom < source.relationshipStart ||
    (source.validToExclusive !== null && !validCivilDate(source.validToExclusive)) ||
    (typeof source.validToExclusive === 'string' && source.validToExclusive <= source.validFrom) ||
    typeof source.primary !== 'boolean' ||
    (source.fte !== null && (typeof source.fte !== 'string' || !FTE_PATTERN.test(source.fte))) ||
    !validVersion(source.assignmentVersion)
  ) {
    throw new Error('Employment assignment projection is invalid.');
  }
  return Object.freeze({
    personPublicId: source.personPublicId,
    workerPublicId: source.workerPublicId,
    workerStatus: source.workerStatus,
    workerVersion: source.workerVersion,
    relationshipPublicId: source.relationshipPublicId,
    relationshipType: source.relationshipType,
    relationshipStart: source.relationshipStart,
    relationshipEnd: source.relationshipEnd,
    relationshipVersion: source.relationshipVersion,
    assignmentPublicId: source.assignmentPublicId,
    assignmentStatus: source.assignmentStatus,
    validFrom: source.validFrom,
    validToExclusive: source.validToExclusive,
    primary: source.primary,
    fte: source.fte,
    assignmentVersion: source.assignmentVersion,
    legalEmployerRef: selectOwnerRef(
      source.legalEmployerRef,
      OWNER_SCHEMA_BY_FIELD.legalEmployerRef
    ),
    organizationRef: selectOptionalOwnerRef(
      source.organizationRef,
      OWNER_SCHEMA_BY_FIELD.organizationRef
    ),
    positionRef: selectOptionalOwnerRef(source.positionRef, OWNER_SCHEMA_BY_FIELD.positionRef),
    jobRef: selectOptionalOwnerRef(source.jobRef, OWNER_SCHEMA_BY_FIELD.jobRef),
    workLocationRef: selectOptionalOwnerRef(
      source.workLocationRef,
      OWNER_SCHEMA_BY_FIELD.workLocationRef
    ),
  });
}

function selectEmploymentDocument(value: unknown): EmploymentDocument {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, DOCUMENT_KEYS) ||
    typeof source.workerPublicId !== 'string' ||
    !UUID_PATTERN.test(source.workerPublicId) ||
    typeof source.relationshipPublicId !== 'string' ||
    !UUID_PATTERN.test(source.relationshipPublicId) ||
    typeof source.assignmentPublicId !== 'string' ||
    !UUID_PATTERN.test(source.assignmentPublicId) ||
    !validCode(source.relationshipType) ||
    !validCivilDate(source.validFrom) ||
    (source.validToExclusive !== null && !validCivilDate(source.validToExclusive)) ||
    (typeof source.validToExclusive === 'string' && source.validToExclusive <= source.validFrom) ||
    !validCode(source.status) ||
    !validVersion(source.revision)
  ) {
    throw new Error('Employment document projection is invalid.');
  }
  return Object.freeze({
    workerPublicId: source.workerPublicId,
    relationshipPublicId: source.relationshipPublicId,
    assignmentPublicId: source.assignmentPublicId,
    relationshipType: source.relationshipType,
    validFrom: source.validFrom,
    validToExclusive: source.validToExclusive,
    status: source.status,
    revision: source.revision,
  });
}

export function selectEmploymentDocumentsWorkbench(value: unknown): EmploymentDocumentsWorkbench {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, ['asOf', 'documents']) ||
    !validInstant(source.asOf) ||
    !Array.isArray(source.documents) ||
    source.documents.length > 500
  ) {
    throw new Error('Employment documents workbench is invalid.');
  }
  const documents = source.documents.map(selectEmploymentDocument);
  const identities = new Set(
    documents.map((document) => `${document.assignmentPublicId}:${document.revision}`)
  );
  if (identities.size !== documents.length) {
    throw new Error('Employment documents workbench contains duplicate identities.');
  }
  return Object.freeze({ asOf: source.asOf, documents: Object.freeze(documents) });
}

export function selectEmploymentAssignmentsWorkbench(
  value: unknown
): EmploymentAssignmentsWorkbench {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, ['asOf', 'assignments']) ||
    !validInstant(source.asOf) ||
    !Array.isArray(source.assignments)
  ) {
    throw new Error('Employment assignments workbench is invalid.');
  }
  const assignments = source.assignments.map(selectEmploymentAssignment);
  const identities = new Set(assignments.map((assignment) => assignment.assignmentPublicId));
  if (identities.size !== assignments.length) {
    throw new Error('Employment assignments workbench contains duplicate identities.');
  }
  return Object.freeze({ asOf: source.asOf, assignments: Object.freeze(assignments) });
}

function workbenchPath(path: string, asOf?: string): string {
  return asOf ? `${path}?asOf=${encodeURIComponent(asOf)}` : path;
}

export async function getEmploymentDocumentsWorkbench(
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
): Promise<EmploymentDocumentsWorkbench> {
  const response = await axiosInstance.get<unknown>(
    workbenchPath(EMPLOYMENT_DOCUMENTS_PATH, asOf),
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectEmploymentDocumentsWorkbench(response.data);
}

export async function getEmploymentAssignmentsWorkbench(
  contextScopeKey?: string,
  asOf?: string,
  signal?: AbortSignal
): Promise<EmploymentAssignmentsWorkbench> {
  const response = await axiosInstance.get<unknown>(
    workbenchPath(EMPLOYMENT_ASSIGNMENTS_PATH, asOf),
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectEmploymentAssignmentsWorkbench(response.data);
}
