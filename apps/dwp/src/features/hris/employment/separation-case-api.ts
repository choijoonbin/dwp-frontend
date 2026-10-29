import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export const HCM_SEPARATION_CASE_MUTATION_API_CONTRACT = {
  apiFunction: 'createSeparationCase',
  routeContractKey: 'route.hcm.operations.separation-case.action',
  method: 'POST',
  path: '/api/people/v1/hris/separation-cases',
} as const;

export type SeparationCaseCreateCommand = Readonly<{
  relationshipPublicId: string;
  separationType: 'RESIGNATION' | 'TERMINATION' | 'RETIREMENT' | 'END_OF_CONTRACT';
  effectiveDate: string;
  reasonCode: string;
  lastWorkingDate: string;
}>;

export type SeparationCaseCommandReceipt = Readonly<{
  receiptId: string;
  commandType: string;
  status:
    | 'RECEIVED'
    | 'VALIDATING'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'REJECTED'
    | 'FAILED_RETRYABLE'
    | 'DEAD'
    | 'CANCELLED';
  requestHash: string;
  correlationId: string;
  receivedAt: string;
  originatingAction: string;
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: string;
  authorizationRevision: number;
  links: Readonly<{ self: string; result?: string; target?: string }>;
}>;

export type SeparationCaseCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion: number;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;

export class SeparationCaseCommandOutcomeUnknownError extends Error {
  readonly correlationId: string;

  constructor(correlationId: string, cause: unknown) {
    super(`Separation-case command outcome is unknown. Correlation: ${correlationId}`, { cause });
    this.name = 'SeparationCaseCommandOutcomeUnknownError';
    this.correlationId = correlationId;
  }
}

export async function createSeparationCase(
  command: SeparationCaseCreateCommand,
  authority: SeparationCaseCommandAuthority
): Promise<SeparationCaseCommandReceipt> {
  assertSeparationCaseCommand(command);
  assertSeparationCaseAuthority(authority);
  const governed = productSurfaceHighRiskMutationConfig(authority.governance, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<unknown, SeparationCaseCreateCommand>(
    HCM_SEPARATION_CASE_MUTATION_API_CONTRACT.path,
    command,
    {
      ...governed,
      headers: {
        ...governed.headers,
        'Idempotency-Key': authority.idempotencyKey,
        'If-Match': `"${authority.expectedObjectVersion}"`,
        'X-Correlation-ID': authority.correlationId,
        'X-Purpose-Code': 'SEPARATION_CASE',
      },
      csrfReplay: 'NEVER',
    }
  );
  try {
    const receipt = parseSeparationCaseReceipt(response.data);
    if (
      receipt.originatingAction !== 'hris.action.hrm.create-separation-case' ||
      receipt.correlationId !== authority.correlationId ||
      receipt.purposeCode !== 'SEPARATION_CASE'
    ) {
      throw new Error('Separation-case receipt does not match the submitted command.');
    }
    return receipt;
  } catch (error) {
    throw new SeparationCaseCommandOutcomeUnknownError(authority.correlationId, error);
  }
}

function assertSeparationCaseAuthority(authority: SeparationCaseCommandAuthority): void {
  const governance = authority.governance;
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !UUID.test(authority.correlationId) ||
    !Number.isSafeInteger(authority.expectedObjectVersion) ||
    authority.expectedObjectVersion < 0 ||
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    governance.idempotencyKey !== authority.idempotencyKey ||
    governance.objectVersion !== authority.expectedObjectVersion
  ) {
    throw new Error('Separation-case HIGH-risk authority does not match the command.');
  }
}

function assertSeparationCaseCommand(command: SeparationCaseCreateCommand): void {
  if (
    !UUID.test(command.relationshipPublicId) ||
    !['RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT'].includes(
      command.separationType
    ) ||
    !civilDate(command.effectiveDate) ||
    !civilDate(command.lastWorkingDate) ||
    command.lastWorkingDate > command.effectiveDate ||
    !/^[A-Z][A-Z0-9._-]{0,63}$/u.test(command.reasonCode)
  ) {
    throw new Error('Separation-case command is invalid.');
  }
}

function civilDate(value: string): boolean {
  return DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parseSeparationCaseReceipt(value: unknown): SeparationCaseCommandReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Separation-case receipt is invalid.');
  }
  const source = value as Record<string, unknown>;
  const links = source.links;
  if (
    !UUID.test(String(source.receiptId ?? '')) ||
    !UUID.test(String(source.correlationId ?? '')) ||
    !UUID.test(String(source.subjectPrincipalPublicId ?? '')) ||
    !DIGEST.test(String(source.requestHash ?? '')) ||
    !DIGEST.test(String(source.populationScopeDigest ?? '')) ||
    typeof source.commandType !== 'string' ||
    typeof source.originatingAction !== 'string' ||
    typeof source.purposeCode !== 'string' ||
    !Number.isSafeInteger(source.fieldPolicyRevision as number) ||
    Number(source.fieldPolicyRevision) < 1 ||
    !Number.isSafeInteger(source.authorizationRevision as number) ||
    Number(source.authorizationRevision) < 1 ||
    ![
      'RECEIVED',
      'VALIDATING',
      'RUNNING',
      'SUCCEEDED',
      'REJECTED',
      'FAILED_RETRYABLE',
      'DEAD',
      'CANCELLED',
    ].includes(String(source.status)) ||
    !Number.isFinite(Date.parse(String(source.receivedAt ?? ''))) ||
    !links ||
    typeof links !== 'object' ||
    Array.isArray(links) ||
    typeof (links as Record<string, unknown>).self !== 'string'
  ) {
    throw new Error('Separation-case receipt is invalid.');
  }
  return Object.freeze({
    ...source,
    links: Object.freeze({ ...(links as object) }),
  }) as SeparationCaseCommandReceipt;
}
