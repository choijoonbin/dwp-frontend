export type ApprovalAdminV2CommandResponse =
  | 'ROUTING_GROUP'
  | 'CONNECTOR'
  | 'CONNECTOR_PROBE'
  | 'POLICY_LIST'
  | 'POLICY_AUTOMATION'
  | 'INCIDENT_DIAGNOSTIC'
  | 'INCIDENT_PLAN'
  | 'INCIDENT_POSTMORTEM'
  | 'AUDIT_SAVED_VIEW'
  | 'AUDIT_EXPORT'
  | 'DEPLOYMENT_PACKAGE'
  | 'DEPLOYMENT_PROMOTION';

export type ApprovalAdminV2HighRiskCommand = Readonly<{
  routeContractKey: string;
  commandMethod: 'POST' | 'PUT';
  commandPath: string;
  targetType: string;
  targetId: string;
  responseTargetId?: string;
  expectedObjectVersion: number;
  proofPayload: unknown;
  requestBody?: Readonly<Record<string, unknown>>;
  response: ApprovalAdminV2CommandResponse;
  responseVersionPolicy?: 'AT_LEAST_EXPECTED' | 'NON_NEGATIVE' | 'OMITTED';
}>;

export type ApprovalAdminV2CommandReceipt = Readonly<{
  targetId: string;
  version?: number;
  status?: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[a-f0-9]{64}$/u;

export function invalidApprovalAdminV2Command(): never {
  throw new Error('Invalid Approval administration V2 command contract.');
}

export function approvalAdminV2Identifier(value: string): string {
  if (!UUID.test(value)) invalidApprovalAdminV2Command();
  return value.toLowerCase();
}

export function approvalAdminV2Version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) invalidApprovalAdminV2Command();
  return value;
}

export function approvalAdminV2Text(value: string, min: number, max: number): string {
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) invalidApprovalAdminV2Command();
  return normalized;
}

export function approvalAdminV2Sha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SHA256.test(normalized)) invalidApprovalAdminV2Command();
  return normalized;
}

export function approvalAdminV2IsoInstant(value: string): string {
  const normalized = value.trim();
  if (!normalized || !Number.isFinite(Date.parse(normalized))) invalidApprovalAdminV2Command();
  return normalized;
}

export function approvalAdminV2Enum<T extends string>(value: T, allowed: readonly T[]): T {
  if (!allowed.includes(value)) invalidApprovalAdminV2Command();
  return value;
}

export function approvalAdminV2Integer(value: number, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    invalidApprovalAdminV2Command();
  }
  return value;
}

export function approvalAdminV2Boolean(value: boolean): boolean {
  if (typeof value !== 'boolean') invalidApprovalAdminV2Command();
  return value;
}

export function approvalAdminV2Object(
  value: Readonly<Record<string, unknown>>,
  options: Readonly<{ allowEmpty?: boolean }> = {}
): Readonly<Record<string, unknown>> {
  if (
    value == null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (!options.allowEmpty && Object.keys(value).length === 0)
  ) {
    invalidApprovalAdminV2Command();
  }
  return Object.freeze(structuredClone(value));
}

export function approvalAdminV2Base64Url(value: string, min: number, max: number): string {
  const normalized = approvalAdminV2Text(value, min, max);
  if (!/^[A-Za-z0-9_-]+$/u.test(normalized)) invalidApprovalAdminV2Command();
  return normalized;
}

export function approvalAdminV2Command(
  input: Omit<ApprovalAdminV2HighRiskCommand, 'commandMethod'> & {
    commandMethod?: ApprovalAdminV2HighRiskCommand['commandMethod'];
  }
): ApprovalAdminV2HighRiskCommand {
  if (
    !input.routeContractKey.startsWith('route.approvals.admin.') ||
    !input.routeContractKey.endsWith('.action') ||
    !input.commandPath.startsWith('/api/approvals/v1/admin/') ||
    input.commandPath.includes('?') ||
    input.commandPath.includes('#') ||
    !input.targetType.trim()
  ) {
    invalidApprovalAdminV2Command();
  }
  const targetId = approvalAdminV2Identifier(input.targetId);
  const expectedObjectVersion = approvalAdminV2Version(input.expectedObjectVersion);
  return Object.freeze({
    ...input,
    commandMethod: input.commandMethod ?? 'POST',
    targetId,
    ...(input.responseTargetId
      ? { responseTargetId: approvalAdminV2Identifier(input.responseTargetId) }
      : {}),
    expectedObjectVersion,
    proofPayload: structuredClone(input.proofPayload),
    ...(input.requestBody
      ? { requestBody: Object.freeze(structuredClone(input.requestBody)) }
      : {}),
  });
}
