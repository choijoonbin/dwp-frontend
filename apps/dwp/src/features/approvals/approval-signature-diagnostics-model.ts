import type {
  SignatureProviderCheck,
  SignatureProviderKms,
  SignatureProviderWorm,
  SignatureProviderScope,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';

export type SignatureDiagnosticsReadState =
  'CURRENT' | 'CHECKING' | 'STALE' | 'DENIED' | 'UNAVAILABLE' | 'LOADING';
export function signatureDiagnosticsVisible(state: SignatureDiagnosticsReadState): boolean {
  return state === 'CURRENT' || state === 'CHECKING' || state === 'STALE';
}
export function signatureDiagnosticsObservation(
  observation: SignatureProviderCheck | SignatureProviderKms | SignatureProviderWorm,
  state: SignatureDiagnosticsReadState,
  now: number
) {
  if (state !== 'CURRENT' || !Number.isFinite(now)) return 'SOURCE_UNAVAILABLE';
  const observedAt = 'observedAt' in observation ? observation.observedAt : observation.checkedAt;
  if (observedAt !== null && Date.parse(observedAt) > now) return 'SOURCE_UNAVAILABLE';
  if (observation.validUntil !== null && Date.parse(observation.validUntil) <= now)
    return 'EXPIRED';
  return observation.state;
}
export function signatureDiagnosticsScopeMatches(
  source: SignatureProviderScope,
  expected: Pick<
    SignatureProviderScope,
    | 'resourceSetKey'
    | 'contextScopeKey'
    | 'decisionRevision'
    | 'registrySha256'
    | 'sourceRevision'
    | 'sourceSha256'
  >
): boolean {
  return (
    source.resourceSetKey === expected.resourceSetKey &&
    source.contextScopeKey === expected.contextScopeKey &&
    source.decisionRevision === expected.decisionRevision &&
    source.registrySha256 === expected.registrySha256 &&
    source.sourceRevision === expected.sourceRevision &&
    source.sourceSha256 === expected.sourceSha256
  );
}
