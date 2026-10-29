import { axiosInstance, getEventStream } from '../axios-instance';
import { PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER } from './product-surface-governed-mutation';

import type { EventStreamConfig, RequestConfig } from '../axios-instance';

export type MailProductSurfaceRolloutState = '000' | '100' | '110' | '111';

export type MailLegacyRequestAuthority = Readonly<{
  mode: 'LEGACY_COMPATIBILITY';
  rolloutState: '000' | '100';
}>;

/**
 * The optional fields are deliberate at this transport boundary. A secure route can render while
 * its authority is being renewed, but no Mail request may leave the browser until all fields are
 * present and current.
 */
export type MailSecureRequestAuthority = Readonly<{
  mode: 'SECURE';
  rolloutState: '110' | '111';
  contextScopeKey?: string;
  expectedDecisionRevision?: string;
  revalidateAt?: string;
  scopeValidUntil?: string | null;
  eligibleContextScopeKeys?: readonly string[];
}>;

export type MailGovernedRequestAuthority = MailLegacyRequestAuthority | MailSecureRequestAuthority;

export type MailGovernedAuthorityErrorCode =
  | 'AUTHORITY_MISSING'
  | 'AUTHORITY_CHANGED'
  | 'CONTEXT_SCOPE_INVALID'
  | 'DECISION_REVISION_MISSING'
  | 'AUTHORITY_EXPIRED';

export class MailGovernedAuthorityError extends Error {
  readonly code: MailGovernedAuthorityErrorCode;

  constructor(code: MailGovernedAuthorityErrorCode) {
    super(`Mail governed request authority is unavailable (${code}).`);
    this.name = 'MailGovernedAuthorityError';
    this.code = code;
  }
}

type AuthorityRegistration = Readonly<{
  id: symbol;
  authority: MailGovernedRequestAuthority;
}>;

const registrations: AuthorityRegistration[] = [];
const MAX_CONTEXT_SCOPE_KEY_LENGTH = 500;
const MAX_DECISION_REVISION_LENGTH = 200;

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function copyAuthority(authority: MailGovernedRequestAuthority): MailGovernedRequestAuthority {
  if (authority.mode === 'LEGACY_COMPATIBILITY') return Object.freeze({ ...authority });
  return Object.freeze({
    ...authority,
    ...(authority.eligibleContextScopeKeys
      ? { eligibleContextScopeKeys: Object.freeze([...authority.eligibleContextScopeKeys]) }
      : {}),
  });
}

/**
 * Registers the authority belonging to the currently mounted Mail Product Surface boundary.
 * Registrations are stack-safe so an exact-route boundary can temporarily override its parent and
 * cleanup restores the previous authority without leaking one scope into another route.
 */
export function registerMailGovernedRequestAuthority(
  authority: MailGovernedRequestAuthority
): () => void {
  const registration = {
    id: Symbol('mail-governed-authority'),
    authority: copyAuthority(authority),
  };
  registrations.push(registration);
  return () => {
    const index = registrations.findIndex((candidate) => candidate.id === registration.id);
    if (index >= 0) registrations.splice(index, 1);
  };
}

function activeRegistration(): AuthorityRegistration | undefined {
  return registrations.at(-1);
}

function validInstant(value: string | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : Number.NaN;
}

function resolveSecureAuthority(
  registration: AuthorityRegistration,
  now = Date.now()
): Readonly<{ contextScopeKey: string; expectedDecisionRevision: string }> {
  const authority = registration.authority;
  if (authority.mode !== 'SECURE') throw new MailGovernedAuthorityError('AUTHORITY_MISSING');

  const contextScopeKey = authority.contextScopeKey;
  if (
    typeof contextScopeKey !== 'string' ||
    !contextScopeKey ||
    contextScopeKey !== contextScopeKey.trim() ||
    contextScopeKey.length > MAX_CONTEXT_SCOPE_KEY_LENGTH ||
    hasControlCharacter(contextScopeKey)
  ) {
    throw new MailGovernedAuthorityError('CONTEXT_SCOPE_INVALID');
  }
  if (
    authority.eligibleContextScopeKeys &&
    (new Set(authority.eligibleContextScopeKeys).size !==
      authority.eligibleContextScopeKeys.length ||
      !authority.eligibleContextScopeKeys.includes(contextScopeKey))
  ) {
    throw new MailGovernedAuthorityError('CONTEXT_SCOPE_INVALID');
  }

  const expectedDecisionRevision = authority.expectedDecisionRevision;
  if (
    typeof expectedDecisionRevision !== 'string' ||
    !expectedDecisionRevision.trim() ||
    expectedDecisionRevision !== expectedDecisionRevision.trim() ||
    expectedDecisionRevision.length > MAX_DECISION_REVISION_LENGTH
  ) {
    throw new MailGovernedAuthorityError('DECISION_REVISION_MISSING');
  }

  const revalidateAt = validInstant(authority.revalidateAt);
  const scopeValidUntil = validInstant(authority.scopeValidUntil);
  if (
    revalidateAt === null ||
    Number.isNaN(revalidateAt) ||
    revalidateAt <= now ||
    Number.isNaN(scopeValidUntil) ||
    (scopeValidUntil !== null && scopeValidUntil <= now)
  ) {
    throw new MailGovernedAuthorityError('AUTHORITY_EXPIRED');
  }

  return { contextScopeKey, expectedDecisionRevision };
}

function removeHeaderCaseInsensitive(
  headers: Readonly<Record<string, string>> | undefined,
  name: string
): Record<string, string> {
  const lowered = name.toLowerCase();
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(([headerName]) => headerName.toLowerCase() !== lowered)
  );
}

export function mailGovernedRequestConfig(config: RequestConfig = {}): RequestConfig | undefined {
  const registration = activeRegistration();
  // Both legacy and secure rollout states must be registered by the mounted Mail boundary. Treating
  // absence as legacy would silently turn a missing 110/111 integration into an ungoverned request.
  if (!registration) throw new MailGovernedAuthorityError('AUTHORITY_MISSING');
  if (registration.authority.mode === 'LEGACY_COMPATIBILITY') {
    return Object.keys(config).length ? config : undefined;
  }

  const resolved = resolveSecureAuthority(registration);
  const callerBeforeDispatch = config.beforeDispatch;
  return {
    ...config,
    contextScopeKey: resolved.contextScopeKey,
    headers: {
      ...removeHeaderCaseInsensitive(
        config.headers,
        PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER
      ),
      [PRODUCT_SURFACE_EXPECTED_DECISION_REVISION_HEADER]: resolved.expectedDecisionRevision,
    },
    beforeDispatch: () => {
      callerBeforeDispatch?.();
      if (activeRegistration()?.id !== registration.id) {
        throw new MailGovernedAuthorityError('AUTHORITY_CHANGED');
      }
      const current = resolveSecureAuthority(registration);
      if (
        current.contextScopeKey !== resolved.contextScopeKey ||
        current.expectedDecisionRevision !== resolved.expectedDecisionRevision
      ) {
        throw new MailGovernedAuthorityError('AUTHORITY_CHANGED');
      }
    },
  };
}

type MailHttpResponse<T> = Promise<{ data: T; headers?: Headers }>;

/**
 * The only transport Mail API modules may use. It binds every read and mutation to the current
 * Product Surface scope and decision revision through the canonical axios-instance options.
 */
export const mailGovernedHttp = {
  get: <T>(url: string, config?: RequestConfig): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed ? axiosInstance.get<T>(url, governed) : axiosInstance.get<T>(url);
  },
  post: <T, B = unknown>(url: string, body: B, config?: RequestConfig): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed
      ? axiosInstance.post<T, B>(url, body, governed)
      : axiosInstance.post<T, B>(url, body);
  },
  put: <T, B = unknown>(url: string, body: B, config?: RequestConfig): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed
      ? axiosInstance.put<T, B>(url, body, governed)
      : axiosInstance.put<T, B>(url, body);
  },
  patch: <T, B = unknown>(url: string, body: B, config?: RequestConfig): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed
      ? axiosInstance.patch<T, B>(url, body, governed)
      : axiosInstance.patch<T, B>(url, body);
  },
  delete: <T>(url: string, config?: RequestConfig): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed ? axiosInstance.delete<T>(url, governed) : axiosInstance.delete<T>(url);
  },
  deleteWithBody: <T, B = unknown>(
    url: string,
    body: B,
    config?: RequestConfig
  ): MailHttpResponse<T> => {
    const governed = mailGovernedRequestConfig(config);
    return governed
      ? axiosInstance.deleteWithBody<T, B>(url, body, governed)
      : axiosInstance.deleteWithBody<T, B>(url, body);
  },
};

/**
 * Opens a Mail SSE request under the same fail-closed authority contract as normal Mail HTTP calls.
 * The current scope and expected decision revision are injected automatically and rechecked
 * immediately before the browser dispatches the stream request.
 */
export async function getMailGovernedEventStream(
  url: string,
  config: EventStreamConfig
): Promise<void> {
  const governed = mailGovernedRequestConfig({
    headers: config.headers,
    signal: config.signal,
    timeoutMs: config.timeoutMs,
    contextScopeKey: config.contextScopeKey,
    beforeDispatch: config.beforeDispatch,
  });
  return getEventStream(url, governed ? { ...config, ...governed } : config);
}
