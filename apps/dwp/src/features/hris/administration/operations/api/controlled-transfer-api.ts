import type { components } from '@dwp-frontend/api-contracts';
import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export const HCM_CONTROLLED_TRANSFER_MUTATION_API_CONTRACT = {
  apiFunction: 'createControlledTransfer',
  routeContractKey: 'route.hcm.management.controlled-transfer-create.action',
  method: 'POST',
  path: '/api/platform/v1/admin/hris/file-transfers',
} as const;

export type ControlledTransferCommand =
  components['schemas']['platform_ControlledTransferCreateCommandV1'];
export type ControlledTransferCommandReceipt =
  components['schemas']['platform_HrisCommandReceiptV1'];

export type ControlledTransferCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[a-f0-9]{64}$/u;

export class ControlledTransferCommandOutcomeUnknownError extends Error {
  readonly correlationId: string;

  constructor(correlationId: string, cause: unknown) {
    super(`Controlled-transfer command outcome is unknown. Correlation: ${correlationId}`, {
      cause,
    });
    this.name = 'ControlledTransferCommandOutcomeUnknownError';
    this.correlationId = correlationId;
  }
}

export async function createControlledTransfer(
  command: ControlledTransferCommand,
  authority: ControlledTransferCommandAuthority
): Promise<ControlledTransferCommandReceipt> {
  assertControlledTransferCommand(command);
  assertControlledTransferAuthority(authority);
  const governed = productSurfaceHighRiskMutationConfig(authority.governance, {
    objectVersionHeader: false,
  });
  const response = await axiosInstance.post<unknown, ControlledTransferCommand>(
    HCM_CONTROLLED_TRANSFER_MUTATION_API_CONTRACT.path,
    command,
    {
      ...governed,
      headers: {
        ...governed.headers,
        'Idempotency-Key': authority.idempotencyKey,
        'X-Correlation-Id': authority.correlationId,
        'X-Purpose-Code': 'HRIS_INTEGRATION_ADMIN',
      },
      csrfReplay: 'NEVER',
    }
  );
  try {
    const receipt = parseControlledTransferReceipt(response.data);
    if (
      receipt.correlationId !== authority.correlationId ||
      receipt.originatingAction !== 'CONTROLLED_TRANSFER_CREATE' ||
      receipt.purposeCode !== 'HRIS_INTEGRATION_ADMIN'
    ) {
      throw new Error('Controlled-transfer receipt does not match the submitted command.');
    }
    return receipt;
  } catch (error) {
    throw new ControlledTransferCommandOutcomeUnknownError(authority.correlationId, error);
  }
}

function assertControlledTransferAuthority(authority: ControlledTransferCommandAuthority): void {
  const governance = authority.governance;
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !UUID.test(authority.correlationId) ||
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    governance.idempotencyKey !== authority.idempotencyKey
  ) {
    throw new Error('Controlled-transfer HIGH-risk authority does not match the command.');
  }
}

function assertControlledTransferCommand(command: ControlledTransferCommand): void {
  const scan = command.malwareScanSnapshot;
  const binding = command.toctouBinding;
  if (
    !command.objectRef.trim() ||
    command.objectRef.length > 512 ||
    !command.objectVersion.trim() ||
    command.objectVersion.length > 128 ||
    !DIGEST.test(command.objectDigest) ||
    !Number.isSafeInteger(command.byteSize) ||
    command.byteSize < 0 ||
    command.purposeCode !== 'HRIS_INTEGRATION_ADMIN' ||
    !Number.isFinite(Date.parse(command.expiresAt)) ||
    scan.verdict !== 'CLEAN' ||
    scan.objectDigest !== command.objectDigest ||
    scan.byteSize !== command.byteSize ||
    !Number.isFinite(Date.parse(scan.scannedAt)) ||
    binding.boundDigest !== command.objectDigest ||
    binding.boundByteSize !== command.byteSize ||
    binding.boundObjectVersion !== command.objectVersion ||
    !DIGEST.test(binding.snapshotDigest) ||
    !binding.storageETag.trim() ||
    !UUID.test(binding.uploadSessionId)
  ) {
    throw new Error('Controlled-transfer command is invalid.');
  }
}

function parseControlledTransferReceipt(value: unknown): ControlledTransferCommandReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Controlled-transfer receipt is invalid.');
  }
  const source = value as Record<string, unknown>;
  if (
    !UUID.test(String(source.receiptId ?? '')) ||
    !UUID.test(String(source.correlationId ?? '')) ||
    !UUID.test(String(source.subjectPrincipalPublicId ?? '')) ||
    !DIGEST.test(String(source.requestDigest ?? '')) ||
    !DIGEST.test(String(source.populationScopeDigest ?? '')) ||
    typeof source.commandType !== 'string' ||
    typeof source.originatingAction !== 'string' ||
    typeof source.purposeCode !== 'string' ||
    !Number.isSafeInteger(source.fieldPolicyRevision as number) ||
    Number(source.fieldPolicyRevision) < 1 ||
    !Number.isSafeInteger(source.authorizationRevision as number) ||
    Number(source.authorizationRevision) < 1 ||
    !['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'RESULT_UNKNOWN'].includes(
      String(source.status)
    ) ||
    !Number.isFinite(Date.parse(String(source.createdAt ?? '')))
  ) {
    throw new Error('Controlled-transfer receipt is invalid.');
  }
  return Object.freeze({ ...source }) as ControlledTransferCommandReceipt;
}
