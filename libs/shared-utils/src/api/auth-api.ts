import { API_URL } from '../env';
import { HttpError } from '../http-error';
import { getTenantId } from '../tenant-util';
import { axiosInstance, resetCsrfToken } from '../axios-instance';
import { safeReturnUrl } from '../auth/auth-redirect';
import { isProductSurfaceStepUpFlowId } from '../auth/product-surface-step-up-popup';

import type { ApiResponse } from '../types';

export type LoginRequest = {
  email: string;
  password: string;
  tenantId: string;
};

export type PermissionDTO = {
  resourceType: string;
  resourceKey: string;
  permissionCode: string;
  effect: 'ALLOW' | 'DENY';
};

export type ResourceRoleDTO = {
  responsibilityCode: string;
  resourceType: string;
  resourceKey: string;
  resourceSetId: string;
  resourceSetKey: string;
  validTo?: string | null;
};

export type LoginResponseData = {
  expiresIn?: number;
  userId?: string;
  tenantId?: string;
  permissions?: PermissionDTO[];
};

export type MeResponse = {
  userId: number;
  personPublicId?: string | null;
  displayName: string;
  jobTitle?: string | null;
  preferredLocale?: string | null;
  tenantDefaultLocale?: string | null;
  email?: string | null;
  tenantId: number;
  tenantCode: string;
  tenantName?: string | null;
  roles: string[];
  legacyRoleFallbackAllowed?: boolean;
  groups?: Array<{
    groupRef: string;
    groupKey?: string | null;
    displayName: string;
  }>;
  resourceRoles?: ResourceRoleDTO[];
};

export type AuthSessionData = {
  sessionId: string;
  current: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  startedAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  expiresAt: string;
};

export type SessionRotationData = {
  rotated: boolean;
  idleExpiresAt: string;
  expiresAt: string;
};

export type AccountActivation = {
  tenantId: number;
  tenantKey: string;
  tenantName: string;
  userId: number;
  displayName: string;
  email: string;
  expiresAt: string;
};

export type ActivatedAccount = {
  tenantId: number;
  tenantKey: string;
  email: string;
  lifecycleState: string;
};

export type ProductSurfaceAccessMode = 'NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT';
export type ProductSurfaceAccessSource = 'ENTITLEMENT' | 'RELATIONSHIP' | 'MANAGEMENT' | 'SUPPORT';
export type ProductSurfaceDecisionCode =
  | 'ALLOWED'
  | 'APP_DENIED'
  | 'SURFACE_DENIED'
  | 'ROUTE_DENIED'
  | 'SCOPE_SELECTION_REQUIRED'
  | 'SCOPE_INVALID'
  | 'EXPIRED'
  | 'ACTIVATION_REQUIRED'
  | 'STEP_UP_REQUIRED'
  | 'SOD_CONFLICT'
  | 'SUPPORT_SCOPE_DENIED'
  | 'AUTHORITY_UNAVAILABLE';
export type GovernedRouteDecisionCode =
  | 'ALLOWED'
  | 'ROUTE_DENIED'
  | 'EXPIRED'
  | 'STEP_UP_REQUIRED'
  | 'SOD_CONFLICT'
  | 'AUTHORITY_UNAVAILABLE';

export type ProductSurfaceEffectiveScope = {
  key: string;
  kind: string;
  displayName: string;
  isDefault: boolean;
  readOnly: boolean;
  validUntil?: string | null;
};

export type ProductSurfaceCapabilityGrant = {
  grantKind: 'CAPABILITY';
  capabilityContractKey: string;
  resolvedCapabilityCode: string;
  authorityMode: 'PERMISSION' | 'PERMISSION_AND_RELATIONSHIP' | 'PERMISSION_OR_RELATIONSHIP';
  predicatePolicyKeys: string[];
  responsibilityRequirement: 'REQUIRED' | 'NOT_REQUIRED' | 'LEGACY_OVERSIGHT';
  responsibility?: { code: string; resourceSetKey: string } | null;
  scopeKeys: string[];
  requiresProductEntitlement: boolean;
  readOnly: boolean;
  activationState: string;
  validUntil?: string | null;
};

export type ProductSurfacePolicyGrant = {
  grantKind: 'POLICY';
  accessPolicyKey: string;
  policyDecisionRef: string;
  authorityMode:
    'ENTITLEMENT' | 'RELATIONSHIP' | 'ENTITLEMENT_AND_RELATIONSHIP' | 'SUPPORT_SESSION';
  scopeKeys: string[];
  requiresProductEntitlement: boolean;
  readOnly: boolean;
  validUntil?: string | null;
};

export type ProductSurfaceEffectiveContext = {
  contextKey: string;
  productKey: string;
  surfaceKey: string;
  plane: string;
  accessMode: ProductSurfaceAccessMode;
  accessSource: ProductSurfaceAccessSource;
  appResourceKey: string;
  effectiveGrants: Array<ProductSurfaceCapabilityGrant | ProductSurfacePolicyGrant>;
  scopes: ProductSurfaceEffectiveScope[];
  revalidateAt: string;
};

export type ProductSurfaceRollout = {
  productKey: string;
  state: '000' | '100' | '110' | '111';
  flags: {
    contextShadow: boolean;
    capabilityEnforcement: boolean;
    surfaceUi: boolean;
  };
  cohort: string;
  opaqueRevision: string;
  authorityStatus: 'NOT_EVALUATED' | 'AVAILABLE' | 'UNAVAILABLE';
};

export type ProductSurfaceContextListData = {
  contractVersion: string;
  decisionRevision: string;
  sourceRevisions: {
    auth?: string | null;
    policy?: string | null;
    productRelationship?: string | null;
    targetPopulation?: string | null;
    support?: string | null;
  };
  activeAccessMode: ProductSurfaceAccessMode;
  generatedAt: string;
  contexts: ProductSurfaceEffectiveContext[];
  rollouts: ProductSurfaceRollout[];
};

export type ProductSurfaceEvaluationRequest = {
  subject: { type: 'PRODUCT'; productKey: string; surfaceKey: string };
  routeContractKey: string;
  contextKey?: string;
  contextScopeKey?: string;
};

export type ProductSurfaceEvaluationData = {
  decision: ProductSurfaceDecisionCode;
  reasonCode?: string | null;
  decisionRevision?: string | null;
  context?: ProductSurfaceEffectiveContext | null;
  routeGrantRef?: string | null;
  scope?: ProductSurfaceEffectiveScope | null;
  effectiveReadOnly?: boolean | null;
  validUntil?: string | null;
  expiredAt?: string | null;
  requiredAssurance?: string | null;
  requestPolicyRef?: string | null;
  revalidateAt?: string | null;
  correlationId?: string | null;
};

export type GovernedRouteEvaluationRequest = {
  subject: { type: 'GOVERNED_CONTEXT'; productKey?: never; surfaceKey?: never };
  navigationContextId: string;
  routeContractKey: string;
  target?: { opaqueTargetRef: string; expectedObjectVersion?: string };
  contextKey?: string;
};

export type GovernedRouteAccessContext = {
  contextKey: string;
  navigationContextId: string;
  accessSource: ProductSurfaceAccessSource;
  accessMode: ProductSurfaceAccessMode;
  routeGrantRef: string;
  effectiveReadOnly: boolean;
  decisionRevision: string;
  revalidateAt: string;
};

export type GovernedRouteEvaluationData = {
  decision: GovernedRouteDecisionCode;
  reasonCode?: string | null;
  decisionRevision?: string | null;
  context?: GovernedRouteAccessContext | null;
  validUntil?: string | null;
  expiredAt?: string | null;
  requiredAssurance?: string | null;
  requestPolicyRef?: string | null;
};

export type ProductSurfaceStepUpChallengeRequest = {
  commandMethod: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  commandPath: string;
  targetType: string;
  targetId: string;
  expectedObjectVersion: number;
  idempotencyKey: string;
  payload: Readonly<Record<string, unknown>>;
  contextKey?: string;
  contextScopeKey: string;
  providerKey?: string;
  returnTo?: string;
};

export type ProductSurfaceStepUpChallengeData = {
  state: 'ISSUED';
  challenge: string;
  challengeId: string;
  decisionRevision: string;
  expiresAt: string;
};

export type ProductSurfaceStepUpContinuationData = {
  state: 'CONTINUATION_REQUIRED';
  continuation:
    | {
        type: 'OIDC';
        authorizationUrl: string;
        expiresAt: string;
        flowRef: string;
        providerKeys?: never;
      }
    | {
        type: 'OIDC_PROVIDER_SELECTION';
        authorizationUrl: null;
        expiresAt: null;
        providerKeys: string[];
      };
};

export const PRODUCT_SURFACE_CONTEXTS_ENDPOINT = '/api/auth/product-surface-contexts' as const;
export const PRODUCT_SURFACE_EVALUATION_ENDPOINT =
  '/api/auth/product-surface-access/evaluate' as const;
export const GOVERNED_ROUTE_EVALUATION_ENDPOINT =
  '/api/auth/governed-route-access/evaluate' as const;
export const PRODUCT_SURFACE_STEP_UP_CHALLENGE_ENDPOINT =
  '/api/auth/product-surface-step-up-challenges' as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validInstant(value: unknown): value is string {
  return nonBlank(value) && Number.isFinite(Date.parse(value));
}

function jsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonValue);
  const valueRecord = record(value);
  return Boolean(valueRecord && Object.values(valueRecord).every(jsonValue));
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeStepUpAuthorizationUrl(value: unknown): value is string {
  if (!nonBlank(value)) return false;
  try {
    const url = new URL(value);
    const localHttp =
      url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.hash) {
      return false;
    }
    const forbidden = ['challenge', 'jwt', 'token', 'access_token', 'id_token'];
    return forbidden.every((key) => !url.searchParams.has(key));
  } catch {
    return false;
  }
}

const STEP_UP_REQUEST_KEYS = new Set([
  'commandMethod',
  'commandPath',
  'targetType',
  'targetId',
  'expectedObjectVersion',
  'idempotencyKey',
  'payload',
  'contextKey',
  'contextScopeKey',
  'providerKey',
  'returnTo',
]);

function validatedStepUpRequest(
  input: ProductSurfaceStepUpChallengeRequest
): ProductSurfaceStepUpChallengeRequest {
  const value = record(input);
  const payload = record(value?.payload);
  if (
    !value ||
    !exactKeys(value, STEP_UP_REQUEST_KEYS) ||
    !['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(value.commandMethod)) ||
    !nonBlank(value.commandPath) ||
    !value.commandPath.startsWith('/api/') ||
    value.commandPath.includes('?') ||
    value.commandPath.includes('#') ||
    value.commandPath.includes('://') ||
    !nonBlank(value.targetType) ||
    !nonBlank(value.targetId) ||
    !Number.isSafeInteger(value.expectedObjectVersion) ||
    Number(value.expectedObjectVersion) < 0 ||
    !nonBlank(value.idempotencyKey) ||
    !payload ||
    !jsonValue(payload) ||
    (value.contextKey !== undefined && !nonBlank(value.contextKey)) ||
    !nonBlank(value.contextScopeKey) ||
    (value.providerKey !== undefined && !nonBlank(value.providerKey)) ||
    (value.returnTo !== undefined &&
      (!nonBlank(value.returnTo) ||
        !value.returnTo.startsWith('/') ||
        value.returnTo.startsWith('//') ||
        value.returnTo.includes('://')))
  ) {
    throw new Error('Product surface step-up challenge request is invalid.');
  }
  return {
    commandMethod: value.commandMethod as ProductSurfaceStepUpChallengeRequest['commandMethod'],
    commandPath: value.commandPath,
    targetType: value.targetType,
    targetId: value.targetId,
    expectedObjectVersion: value.expectedObjectVersion as number,
    idempotencyKey: value.idempotencyKey,
    payload,
    contextScopeKey: value.contextScopeKey,
    ...(value.contextKey === undefined ? {} : { contextKey: value.contextKey as string }),
    ...(value.providerKey === undefined ? {} : { providerKey: value.providerKey as string }),
    ...(value.returnTo === undefined ? {} : { returnTo: value.returnTo as string }),
  };
}

function parseIssuedStepUpChallenge(value: unknown): ProductSurfaceStepUpChallengeData {
  const data = record(value);
  if (
    !data ||
    data.state !== 'ISSUED' ||
    !nonBlank(data.challenge) ||
    !nonBlank(data.challengeId) ||
    !nonBlank(data.decisionRevision) ||
    !validInstant(data.expiresAt)
  ) {
    throw new HttpError('Product surface step-up challenge response is invalid.', 502, value);
  }
  return data as ProductSurfaceStepUpChallengeData;
}

export function getProductSurfaceStepUpContinuation(
  error: unknown
): ProductSurfaceStepUpContinuationData | null {
  if (!(error instanceof HttpError) || error.status !== 403) return null;
  const envelope = record(error.details);
  const data = record(envelope?.data);
  const continuation = record(data?.continuation);
  const providerKeys = continuation?.providerKeys;
  const oidcContinuation =
    continuation?.type === 'OIDC' &&
    safeStepUpAuthorizationUrl(continuation.authorizationUrl) &&
    validInstant(continuation.expiresAt) &&
    isProductSurfaceStepUpFlowId(continuation.flowRef) &&
    providerKeys === undefined;
  const providerSelection =
    continuation?.type === 'OIDC_PROVIDER_SELECTION' &&
    continuation.authorizationUrl === null &&
    continuation.expiresAt === null &&
    Array.isArray(providerKeys) &&
    providerKeys.length > 0 &&
    providerKeys.every(nonBlank) &&
    new Set(providerKeys).size === providerKeys.length;
  if (
    envelope?.errorCode !== 'STEP_UP_REQUIRED' ||
    data?.state !== 'CONTINUATION_REQUIRED' ||
    (!oidcContinuation && !providerSelection)
  ) {
    return null;
  }
  return data as ProductSurfaceStepUpContinuationData;
}

export async function login(
  payload: Omit<LoginRequest, 'tenantId'> & { tenantId?: string }
): Promise<ApiResponse<LoginResponseData>> {
  const response = await axiosInstance.post<ApiResponse<LoginResponseData>, LoginRequest>(
    '/api/auth/login',
    {
      email: payload.email,
      password: payload.password,
      tenantId: payload.tenantId || getTenantId(),
    }
  );
  return response.data;
}

export async function getMe(): Promise<ApiResponse<MeResponse>> {
  return (await axiosInstance.get<ApiResponse<MeResponse>>('/api/auth/me')).data;
}

export async function updateMyPreferredLocale(locale: string): Promise<ApiResponse<MeResponse>> {
  return (
    await axiosInstance.patch<ApiResponse<MeResponse>, { locale: string }>('/api/auth/me/locale', {
      locale,
    })
  ).data;
}

export async function getPermissions(): Promise<ApiResponse<PermissionDTO[]>> {
  return (await axiosInstance.get<ApiResponse<PermissionDTO[]>>('/api/auth/permissions')).data;
}

export async function getProductSurfaceContexts(): Promise<ProductSurfaceContextListData> {
  const response = await axiosInstance.get<ApiResponse<ProductSurfaceContextListData>>(
    PRODUCT_SURFACE_CONTEXTS_ENDPOINT,
    { timeoutMs: 8_000 }
  );
  return response.data.data;
}

export async function evaluateProductSurfaceAccess(
  request: ProductSurfaceEvaluationRequest,
  options: { signal?: AbortSignal } = {}
): Promise<ProductSurfaceEvaluationData> {
  const response = await axiosInstance.post<
    ApiResponse<ProductSurfaceEvaluationData>,
    ProductSurfaceEvaluationRequest
  >(PRODUCT_SURFACE_EVALUATION_ENDPOINT, request, {
    timeoutMs: 8_000,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return {
    ...response.data.data,
    correlationId: response.data.data.correlationId ?? response.data.correlationId ?? undefined,
  };
}

export async function evaluateGovernedRouteAccess(
  request: GovernedRouteEvaluationRequest
): Promise<GovernedRouteEvaluationData> {
  const response = await axiosInstance.post<
    ApiResponse<GovernedRouteEvaluationData>,
    GovernedRouteEvaluationRequest
  >(GOVERNED_ROUTE_EVALUATION_ENDPOINT, request, { timeoutMs: 8_000 });
  return response.data.data;
}

export async function issueProductSurfaceStepUpChallenge(
  request: ProductSurfaceStepUpChallengeRequest,
  expectedDecisionRevision: string,
  options: { signal?: AbortSignal } = {}
): Promise<ProductSurfaceStepUpChallengeData> {
  if (!nonBlank(expectedDecisionRevision)) {
    throw new Error('Product surface expected decision revision is required.');
  }
  const body = validatedStepUpRequest(request);
  const response = await axiosInstance.post<
    ApiResponse<ProductSurfaceStepUpChallengeData>,
    ProductSurfaceStepUpChallengeRequest
  >(PRODUCT_SURFACE_STEP_UP_CHALLENGE_ENDPOINT, body, {
    timeoutMs: 8_000,
    headers: { 'X-DWP-Expected-Decision-Revision': expectedDecisionRevision },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  return parseIssuedStepUpChallenge(response.data.data);
}

export async function getAuthSessions(): Promise<ApiResponse<AuthSessionData[]>> {
  return (await axiosInstance.get<ApiResponse<AuthSessionData[]>>('/api/auth/sessions')).data;
}

export async function rotateBrowserSession(): Promise<ApiResponse<SessionRotationData>> {
  return (
    await axiosInstance.post<ApiResponse<SessionRotationData>, undefined>(
      '/api/auth/session/refresh',
      undefined
    )
  ).data;
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await axiosInstance.delete<ApiResponse<void>>('/api/auth/sessions/' + sessionId);
}

export async function logoutOtherSessions(): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, undefined>(
    '/api/auth/sessions/logout-others',
    undefined
  );
}

export async function logout(): Promise<void> {
  try {
    await axiosInstance.post<ApiResponse<void>, undefined>('/api/auth/logout', undefined);
  } finally {
    resetCsrfToken();
  }
}

export async function getAccountActivation(token: string): Promise<AccountActivation> {
  const response = await axiosInstance.get<ApiResponse<AccountActivation>>(
    `/api/auth/activations/${encodeURIComponent(token)}`
  );
  return response.data.data;
}

export async function activateAccount(token: string, password: string): Promise<ActivatedAccount> {
  const response = await axiosInstance.post<ApiResponse<ActivatedAccount>, { password: string }>(
    `/api/auth/activations/${encodeURIComponent(token)}`,
    { password }
  );
  return response.data.data;
}

export type OidcCallbackParams = {
  code: string;
  state: string;
  providerKey?: string;
  tenantId?: string;
};

export type OidcCallbackResult =
  | { purpose: 'LOGIN'; response: ApiResponse<LoginResponseData> }
  | {
      purpose: 'STEP_UP';
      response: ApiResponse<LoginResponseData>;
      flowId: string;
      returnTo: string;
    };

export const OIDC_STEP_UP_FLOW_ID_HEADER = 'X-DWP-Step-Up-Flow-ID' as const;
export const OIDC_STEP_UP_RETURN_TO_HEADER = 'X-DWP-Step-Up-Return-To' as const;
export async function getOidcCallback(params: OidcCallbackParams): Promise<OidcCallbackResult> {
  const search = new URLSearchParams({ code: params.code, state: params.state });
  if (params.providerKey) search.set('providerKey', params.providerKey);
  if (params.tenantId) search.set('tenantId', params.tenantId);
  const callback = await axiosInstance.get<ApiResponse<LoginResponseData>>(
    '/api/auth/oidc/callback?' + search.toString()
  );
  const flowId = callback.headers?.get(OIDC_STEP_UP_FLOW_ID_HEADER) ?? null;
  const rawReturnTo = callback.headers?.get(OIDC_STEP_UP_RETURN_TO_HEADER) ?? null;
  if (flowId === null && rawReturnTo === null) {
    return { purpose: 'LOGIN', response: callback.data };
  }
  const returnTo = safeReturnUrl(rawReturnTo);
  if (!isProductSurfaceStepUpFlowId(flowId) || !returnTo) {
    throw new HttpError('OIDC step-up callback metadata is invalid.', 502);
  }
  return { purpose: 'STEP_UP', response: callback.data, flowId, returnTo };
}

export function buildOidcLoginUrl(providerKey: string): string {
  const search = new URLSearchParams({
    providerKey,
    tenantId: getTenantId(),
  });
  return API_URL + '/api/auth/oidc/login?' + search.toString();
}
