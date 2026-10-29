import { parsePer004Action, parsePer004Projection, PER004_ROUTES } from './per004-contract';
import type { Per004Action, Per004Projection, Per004Variant } from './per004-contract';

/** Supplied only by the host's governed action/PEP flow, never derived from masked fields. */
export type Per004ActionGrant = Readonly<{
  actionKey: Per004Action['actionKey'];
  targetConfigurationId: string;
  targetVersion?: number;
  expectedObjectVersion?: number;
  idempotencyKey: string;
  expectedDecisionRevision: string;
  purposeCode: string;
  stepUpChallenge?: string;
  body: unknown;
}>;

export type Per004BrowserTransport = (
  path: string,
  init: Readonly<{
    method: 'GET' | 'POST';
    headers: Readonly<Record<string, string>>;
    body?: string;
  }>
) => Promise<Readonly<{ status: number; data: unknown }>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SAFE_HEADER = /^[\x20-\x7e]{1,256}$/;

function header(value: unknown): value is string {
  return typeof value === 'string' && SAFE_HEADER.test(value) && value.trim() === value;
}

/** A concrete, unbound browser adapter. Host transport supplies session/CSRF context. */
export function createPer004BrowserClient(transport: Per004BrowserTransport) {
  return {
    async load(variant: Per004Variant): Promise<Per004Projection> {
      const path =
        variant === 'FORMS_SCALES' ? PER004_ROUTES.formsScales : PER004_ROUTES.settingsPerformance;
      const response = await transport(path, { method: 'GET', headers: {} });
      if (response.status === 403) throw new Error('FORBIDDEN');
      if (response.status !== 200) throw new Error('PER004_UNAVAILABLE');
      return parsePer004Projection(response.data, variant);
    },
    async execute(
      action: Per004Action,
      grant: Per004ActionGrant
    ): Promise<'SUCCEEDED' | 'STEP_UP_REQUIRED'> {
      const checked = parsePer004Action(action, action.targetConfigurationId);
      if (
        !UUID.test(grant.targetConfigurationId) ||
        grant.actionKey !== checked.actionKey ||
        grant.targetConfigurationId !== checked.targetConfigurationId ||
        grant.targetVersion !== checked.targetVersion ||
        grant.expectedObjectVersion !== checked.expectedObjectVersion ||
        !header(grant.idempotencyKey) ||
        grant.idempotencyKey.length < 16 ||
        grant.idempotencyKey.length > 128 ||
        !header(grant.expectedDecisionRevision) ||
        !header(grant.purposeCode) ||
        grant.body === null ||
        typeof grant.body !== 'object' ||
        Array.isArray(grant.body) ||
        (grant.stepUpChallenge !== undefined && !header(grant.stepUpChallenge))
      ) {
        throw new Error('PER004_ACTION_GRANT_MISMATCH');
      }
      const response = await transport(checked.resolvedHref, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': grant.idempotencyKey,
          'X-DWP-Expected-Decision-Revision': grant.expectedDecisionRevision,
          'X-Purpose-Code': grant.purposeCode,
          ...(checked.expectedObjectVersion === undefined
            ? {}
            : {
                'X-DWP-Expected-Object-Version': String(checked.expectedObjectVersion),
              }),
          ...(grant.stepUpChallenge === undefined
            ? {}
            : {
                'X-DWP-Step-Up-Challenge': grant.stepUpChallenge,
              }),
        },
        body: JSON.stringify(grant.body),
      });
      if (response.status === 428) return 'STEP_UP_REQUIRED';
      if (response.status !== 202) throw new Error('PER004_ACTION_UNAVAILABLE');
      return 'SUCCEEDED';
    },
  };
}
