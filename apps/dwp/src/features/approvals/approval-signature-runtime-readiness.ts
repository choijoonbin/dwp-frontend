import type { ApprovalSignatureContext } from '@dwp-frontend/shared-utils/api/approval-signature-contract';
import type { SignatureProviderOverview } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import { approvalExternalSignatureProviderTarget } from './approval-external-signature-model';

const timestampCurrent = (checkedAt: string | null, validUntil: string | null, nowMs: number) => {
  const checked = checkedAt ? Date.parse(checkedAt) : Number.NaN;
  const valid = validUntil ? Date.parse(validUntil) : Number.NaN;
  return (
    Number.isFinite(nowMs) &&
    Number.isFinite(checked) &&
    checked <= nowMs + 5_000 &&
    Number.isFinite(valid) &&
    valid > nowMs
  );
};

export function approvalSignatureInternalRuntimeReady(
  context: ApprovalSignatureContext | undefined
): boolean {
  return Boolean(
    context?.signingReadiness === 'VERIFIED_INTERNAL_KEY' && context.source.signingKeySha256
  );
}

export function approvalSignatureProviderRuntimeReady(
  overview: SignatureProviderOverview | undefined,
  nowMs: number
): boolean {
  const requiredKinds = overview?.policy.requiredProviderKinds;
  const maxProbeAgeSeconds = overview?.policy.maxProbeAgeSeconds;
  if (
    !overview ||
    overview.policy.sourceState !== 'AVAILABLE' ||
    !requiredKinds?.length ||
    maxProbeAgeSeconds === null ||
    maxProbeAgeSeconds === undefined ||
    overview.kpis.requiredProviderCount !== requiredKinds.length ||
    !overview.kpis.requiredProviderKinds ||
    requiredKinds.some((kind) => !overview.kpis.requiredProviderKinds!.includes(kind)) ||
    overview.kpis.externalGateState !== 'ELIGIBLE' ||
    overview.kpis.gateReasonCodes.length > 0
  )
    return false;

  const providersReady = requiredKinds.every((kind) =>
    overview.providers.some((provider) => {
      const lastProbeAt = provider.lastProbeAt ? Date.parse(provider.lastProbeAt) : Number.NaN;
      return (
        provider.kind === kind &&
        provider.requiredByPolicy === true &&
        provider.adapterInstalled &&
        provider.configurationRegistered &&
        provider.credentialRegistered &&
        provider.credentialVerified &&
        Number.isFinite(lastProbeAt) &&
        lastProbeAt <= nowMs + 5_000 &&
        lastProbeAt > nowMs - maxProbeAgeSeconds * 1_000 &&
        approvalExternalSignatureProviderTarget(provider) !== null
      );
    })
  );
  const kmsReady =
    overview.kms.state === 'PASS' &&
    overview.kms.backend !== 'NONE' &&
    ['CONFIGURED_KMS', 'HARDWARE_TOKEN'].includes(overview.kms.verificationKind) &&
    overview.kms.reasonCodes.length === 0 &&
    Boolean(
      overview.kms.algorithm &&
      overview.kms.keySha256 &&
      overview.kms.evidenceId &&
      overview.kms.evidenceSha256
    ) &&
    timestampCurrent(overview.kms.checkedAt, overview.kms.validUntil, nowMs);
  const retainUntil = overview.worm.retainUntil
    ? Date.parse(overview.worm.retainUntil)
    : Number.NaN;
  const wormReady =
    overview.worm.state === 'PASS' &&
    overview.worm.objectLockMode === 'COMPLIANCE' &&
    overview.worm.reasonCodes.length === 0 &&
    overview.worm.policy !== null &&
    overview.worm.retentionFloorSeconds !== null &&
    overview.worm.legalHold !== null &&
    Boolean(
      overview.worm.storageLocatorSha256 &&
      overview.worm.objectVersionSha256 &&
      overview.worm.evidenceId &&
      overview.worm.evidenceSha256
    ) &&
    Number.isFinite(retainUntil) &&
    retainUntil > nowMs &&
    timestampCurrent(overview.worm.checkedAt, overview.worm.validUntil, nowMs);

  return providersReady && kmsReady && wormReady;
}
