import { createHash } from 'node:crypto';

import productPageRoutes from '../../architecture/product-page-routes.v1.json' with { type: 'json' };

export const HRIS_W1_AUTHORITY_EVALUATION_PATH = '/api/auth/product-surface-access/evaluate';
export const HRIS_W1_HOME_SHADOW_RECEIPT_PATH = '/api/platform/v2/home/shadow-receipts';
export const HRIS_W1_AUTHORITY_RESPONSE_MAX_BYTES = 256 * 1024;
export const HRIS_W1_SHADOW_RECEIPT_MAX_BYTES = 4 * 1024;

const SAFE_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SHA256 = /^[0-9a-f]{64}$/u;
const HOME_SHADOW_OUTCOMES = new Set(['MATCH', 'EXPECTED_TRANSIENT', 'MISMATCH', 'UNAVAILABLE']);
const HOME_SHADOW_REASONS = new Set([
  'MATCH',
  'EXPECTED_TRANSIENT',
  'STRUCTURE',
  'AUTHORITY',
  'MODE',
  'LAYOUT',
  'APP_DOCK',
  'WIDGET_STATE',
  'ROUTE_ACTION',
  'FRESHNESS',
  'UNAVAILABLE',
]);
const HOME_MODES = new Set(['CLASSIC', 'FLOW_V1', 'MZ_V1']);
const HOME_DEVICE_CLASSES = new Set([
  'DESKTOP_WIDE',
  'DESKTOP_STANDARD',
  'MOBILE_STANDARD',
  'MOBILE_COMPACT',
]);
const HOME_ROLLOUT_RINGS = new Set(['CONTROL', 'INTERNAL', 'PILOT', 'EARLY_ADOPTER', 'GA']);
const HOME_REVISION = /^[A-Za-z0-9._:-]{1,160}$/u;
const HOME_SHADOW_REQUEST_KEYS = Object.freeze([
  'schemaVersion',
  'outcome',
  'reasons',
  'mismatchCount',
  'homeMode',
  'deviceClass',
  'runtimeState',
  'rolloutRing',
  'rolloutRevision',
]);
const OFFICIAL_PAGE_KEYS = Object.freeze([
  'pattern',
  'productId',
  'routeContractKey',
  'routeId',
  'surfaceId',
]);

function fail(message) {
  throw new Error(`HRIS W1 browser firewall contract: ${message}`);
}

function valueRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasExactKeys(value, expected) {
  return value !== null && Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function officialHcmPageContracts(source) {
  if (
    !hasExactKeys(valueRecord(source), [
      'legacyRedirects',
      'pageRoutes',
      'schemaVersion',
      'sourceKey',
    ]) ||
    source.schemaVersion !== 1 ||
    source.sourceKey !== 'product-page-routes.v1' ||
    !Array.isArray(source.pageRoutes)
  ) {
    fail('official product PAGE source is not the exact v1 document');
  }
  const hcm = source.pageRoutes.filter((route) => route?.productId === 'hcm');
  if (hcm.length !== 26) fail(`official HCM PAGE count is ${hcm.length}, expected 26`);
  const seen = new Set();
  for (const route of hcm) {
    if (
      !hasExactKeys(valueRecord(route), OFFICIAL_PAGE_KEYS) ||
      typeof route.routeContractKey !== 'string' ||
      !/^route\.hcm\.(management|operations|personal|team)\.[a-z0-9-]+\.page$/u.test(
        route.routeContractKey
      ) ||
      typeof route.surfaceId !== 'string' ||
      !/^hcm\.(management|operations|personal|team)$/u.test(route.surfaceId) ||
      route.routeContractKey.split('.')[2] !== route.surfaceId.split('.')[1] ||
      route.routeId !== route.routeContractKey.slice('route.'.length, -'.page'.length) ||
      typeof route.pattern !== 'string' ||
      !/^\/hr(?:\/|$)/u.test(route.pattern) ||
      seen.has(route.routeContractKey)
    ) {
      fail('official HCM PAGE tuple is malformed or duplicated');
    }
    seen.add(route.routeContractKey);
  }
  return Object.freeze(
    hcm.map((route) =>
      Object.freeze({
        routeContractKey: route.routeContractKey,
        surfaceKey: route.surfaceId,
      })
    )
  );
}

export const HRIS_W1_OFFICIAL_HCM_PAGE_EVALUATION_CONTRACTS =
  officialHcmPageContracts(productPageRoutes);

const BACKGROUND_PAGE_TUPLES = new Set(
  HRIS_W1_OFFICIAL_HCM_PAGE_EVALUATION_CONTRACTS.map(
    ({ routeContractKey, surfaceKey }) => `${routeContractKey}\0${surfaceKey}`
  )
);

export function isHrisW1BackgroundPageEvaluationTuple(routeContractKey, surfaceKey) {
  return BACKGROUND_PAGE_TUPLES.has(`${routeContractKey}\0${surfaceKey}`);
}

export function exactHrisW1EvaluationShape(body, subject, contextScopeKey) {
  const bodyKeys =
    contextScopeKey === null
      ? ['routeContractKey', 'subject']
      : ['contextScopeKey', 'routeContractKey', 'subject'];
  return (
    hasExactKeys(body, bodyKeys) &&
    hasExactKeys(subject, ['productKey', 'surfaceKey', 'type']) &&
    body.contextKey === undefined
  );
}

export function buildHrisW1ActiveEvaluationContracts(routes, enabled = true) {
  if (!enabled) return [];
  return routes.flatMap((route) => {
    const page =
      route.outcome === 'redirected'
        ? []
        : [
            {
              kind: 'PAGE',
              routeContractKey: route.pageRouteContractKey,
              productKey: 'hcm',
              surfaceKey: `hcm.${route.pageRouteContractKey.split('.')[2]}`,
              contextScopeKey: route.expectedScopeKey ?? null,
            },
          ];
    const high = route.highRiskPreview
      ? [
          {
            kind: 'HIGH',
            routeContractKey: route.highRiskPreview.expectedRouteContractKey,
            productKey: route.highRiskPreview.expectedProductKey,
            surfaceKey: route.highRiskPreview.expectedSurfaceKey,
            contextScopeKey: route.expectedScopeKey ?? null,
          },
        ]
      : [];
    return [...page, ...high];
  });
}

export function classifyHrisW1AuthorityEvaluation({
  method,
  pathname,
  search,
  body: bodyValue,
  activeContracts,
}) {
  const body = valueRecord(bodyValue);
  const routeContractKey =
    typeof body?.routeContractKey === 'string' ? body.routeContractKey : null;
  const contextScopeKey = typeof body?.contextScopeKey === 'string' ? body.contextScopeKey : null;
  const subject = valueRecord(body?.subject);
  const subjectType = typeof subject?.type === 'string' ? subject.type : null;
  const subjectProductKey = typeof subject?.productKey === 'string' ? subject.productKey : null;
  const subjectSurfaceKey = typeof subject?.surfaceKey === 'string' ? subject.surfaceKey : null;
  const exactRequest =
    method === 'POST' &&
    pathname === HRIS_W1_AUTHORITY_EVALUATION_PATH &&
    search === '' &&
    exactHrisW1EvaluationShape(body, subject, contextScopeKey) &&
    subjectType === 'PRODUCT' &&
    subjectProductKey === 'hcm';
  const active = exactRequest
    ? activeContracts.find(
        (candidate) =>
          candidate.routeContractKey === routeContractKey &&
          candidate.contextScopeKey === contextScopeKey &&
          candidate.productKey === subjectProductKey &&
          candidate.surfaceKey === subjectSurfaceKey
      )
    : undefined;
  const background =
    exactRequest &&
    !active &&
    contextScopeKey === null &&
    isHrisW1BackgroundPageEvaluationTuple(routeContractKey, subjectSurfaceKey);
  const reason = active
    ? active.kind === 'PAGE'
      ? 'EXACT_PAGE_CONTRACT'
      : 'EXACT_HIGH_CONTRACT'
    : background
      ? 'EXACT_BACKGROUND_PAGE_CONTRACT'
      : 'OTHER_AUTHORITY_EVALUATION';
  return Object.freeze({
    allowed: Boolean(active || background),
    observation: {
      routeContractKey,
      contextScopeKey,
      subjectType,
      subjectProductKey,
      subjectSurfaceKey,
      action: active || background ? 'CONTINUED' : 'BLOCKED',
      reason,
    },
  });
}

export function isExactHrisW1AuthorityResponseEvidence(value) {
  const response = valueRecord(value);
  return Boolean(
    hasExactKeys(response, [
      'status',
      'bodyByteLength',
      'responseBodySha256',
      'fromServiceWorker',
    ]) &&
    response.status === 200 &&
    Number.isSafeInteger(response.bodyByteLength) &&
    response.bodyByteLength > 0 &&
    response.bodyByteLength <= HRIS_W1_AUTHORITY_RESPONSE_MAX_BYTES &&
    SHA256.test(response.responseBodySha256) &&
    response.fromServiceWorker === false
  );
}

function exactHomeShadowReceiptBody(body) {
  if (!hasExactKeys(body, HOME_SHADOW_REQUEST_KEYS)) return false;
  if (
    body.schemaVersion !== 1 ||
    !HOME_SHADOW_OUTCOMES.has(body.outcome) ||
    !Number.isSafeInteger(body.mismatchCount) ||
    body.mismatchCount < 0 ||
    body.mismatchCount > 100 ||
    !Array.isArray(body.reasons) ||
    body.reasons.length < 1 ||
    body.reasons.length > 10 ||
    new Set(body.reasons).size !== body.reasons.length ||
    body.reasons.some((reason) => !HOME_SHADOW_REASONS.has(reason)) ||
    !HOME_MODES.has(body.homeMode) ||
    !HOME_DEVICE_CLASSES.has(body.deviceClass) ||
    body.runtimeState !== 'SHADOW_COMPARE' ||
    !HOME_ROLLOUT_RINGS.has(body.rolloutRing) ||
    typeof body.rolloutRevision !== 'string' ||
    !HOME_REVISION.test(body.rolloutRevision)
  ) {
    return false;
  }
  return !(
    (body.outcome === 'MATCH' &&
      (body.mismatchCount !== 0 || body.reasons.length !== 1 || body.reasons[0] !== 'MATCH')) ||
    (body.outcome === 'EXPECTED_TRANSIENT' &&
      (body.mismatchCount === 0 ||
        body.reasons.length !== 2 ||
        !body.reasons.includes('EXPECTED_TRANSIENT') ||
        !body.reasons.includes('FRESHNESS'))) ||
    (body.outcome === 'MISMATCH' &&
      (body.mismatchCount === 0 ||
        body.reasons.some((reason) =>
          ['MATCH', 'EXPECTED_TRANSIENT', 'UNAVAILABLE'].includes(reason)
        ) ||
        body.reasons.every((reason) => reason === 'FRESHNESS'))) ||
    (body.outcome === 'UNAVAILABLE' &&
      (body.mismatchCount === 0 || body.reasons.length !== 1 || body.reasons[0] !== 'UNAVAILABLE'))
  );
}

export function classifyHrisW1ExpectedBlockedSideEffect({
  method,
  pathname,
  search,
  rawBody,
  body: bodyValue,
  decisionRevision,
}) {
  const body = valueRecord(bodyValue);
  const bodyBytes = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : null;
  const exactRevision =
    typeof decisionRevision === 'string' &&
    decisionRevision.length > 0 &&
    decisionRevision.length <= 200 &&
    decisionRevision === decisionRevision.trim() &&
    !/[\r\n,]/u.test(decisionRevision);
  const allowed = Boolean(
    method === 'POST' &&
    pathname === HRIS_W1_HOME_SHADOW_RECEIPT_PATH &&
    search === '' &&
    bodyBytes &&
    bodyBytes.byteLength > 0 &&
    bodyBytes.byteLength <= HRIS_W1_SHADOW_RECEIPT_MAX_BYTES &&
    rawBody === JSON.stringify(body) &&
    exactRevision &&
    exactHomeShadowReceiptBody(body)
  );
  return Object.freeze({
    allowed,
    evidence: allowed
      ? Object.freeze({
          method: 'POST',
          path: HRIS_W1_HOME_SHADOW_RECEIPT_PATH,
          query: '',
          reason: 'EXPECTED_BLOCKED_HOME_SHADOW_RECEIPT',
          runtimeState: 'SHADOW_COMPARE',
          bodyByteLength: bodyBytes.byteLength,
          requestBodySha256: sha256(bodyBytes),
          decisionRevisionSha256: sha256(Buffer.from(decisionRevision, 'utf8')),
        })
      : null,
  });
}

export function isExactHrisW1ExpectedBlockedSideEffect(value) {
  const evidence = valueRecord(value);
  return Boolean(
    hasExactKeys(evidence, [
      'method',
      'path',
      'query',
      'reason',
      'runtimeState',
      'bodyByteLength',
      'requestBodySha256',
      'decisionRevisionSha256',
    ]) &&
    evidence.method === 'POST' &&
    evidence.path === HRIS_W1_HOME_SHADOW_RECEIPT_PATH &&
    evidence.query === '' &&
    evidence.reason === 'EXPECTED_BLOCKED_HOME_SHADOW_RECEIPT' &&
    evidence.runtimeState === 'SHADOW_COMPARE' &&
    Number.isSafeInteger(evidence.bodyByteLength) &&
    evidence.bodyByteLength > 0 &&
    evidence.bodyByteLength <= HRIS_W1_SHADOW_RECEIPT_MAX_BYTES &&
    SHA256.test(evidence.requestBodySha256) &&
    SHA256.test(evidence.decisionRevisionSha256)
  );
}

function redactURL(value) {
  const url = new URL(value);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function authorityResponseEvidence(request) {
  try {
    const response = await request.response();
    if (!response) return null;
    const declaredLength = Number(await response.headerValue('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > HRIS_W1_AUTHORITY_RESPONSE_MAX_BYTES) {
      return null;
    }
    const bytes = await response.body();
    const evidence = {
      status: response.status(),
      bodyByteLength: bytes.byteLength,
      responseBodySha256: sha256(bytes),
      fromServiceWorker: response.fromServiceWorker(),
    };
    return isExactHrisW1AuthorityResponseEvidence(evidence) ? evidence : null;
  } catch {
    return null;
  }
}

export function newHrisW1FirewallObservation() {
  return {
    interceptedHttpRequests: 0,
    continuedHttpRequests: 0,
    continuedMutations: [],
    evaluationRequests: [],
    expectedBlockedSideEffects: [],
    blockedMutations: [],
    blockedExternalHttp: [],
    blockedExternalWebSockets: [],
  };
}

export async function installHrisW1BrowserFirewall({
  context,
  baseOrigin,
  baseURL,
  activeContracts,
  observation,
}) {
  const ownedBaseURL = new URL(baseURL);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    observation.interceptedHttpRequests += 1;

    if (['http:', 'https:'].includes(url.protocol) && url.origin !== baseOrigin) {
      observation.blockedExternalHttp.push({ method, url: redactURL(url.toString()) });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.origin === baseOrigin && !SAFE_READ_METHODS.has(method)) {
      if (url.pathname === HRIS_W1_AUTHORITY_EVALUATION_PATH) {
        let body = null;
        try {
          body = request.postDataJSON();
        } catch {
          body = null;
        }
        const classification = classifyHrisW1AuthorityEvaluation({
          method,
          pathname: url.pathname,
          search: url.search,
          body,
          activeContracts,
        });
        if (classification.allowed) {
          observation.continuedHttpRequests += 1;
          observation.continuedMutations.push({ method, path: url.pathname });
          await route.continue();
          observation.evaluationRequests.push({
            ...classification.observation,
            response: await authorityResponseEvidence(request),
          });
          return;
        }
        observation.evaluationRequests.push(classification.observation);
        observation.blockedMutations.push({
          method,
          path: url.pathname,
          reason: 'AUTHORITY_CONTRACT_MISMATCH',
        });
        await route.abort('blockedbyclient');
        return;
      }

      if (url.pathname === HRIS_W1_HOME_SHADOW_RECEIPT_PATH) {
        let body = null;
        try {
          body = request.postDataJSON();
        } catch {
          body = null;
        }
        const classification = classifyHrisW1ExpectedBlockedSideEffect({
          method,
          pathname: url.pathname,
          search: url.search,
          rawBody: request.postData(),
          body,
          decisionRevision: await request.headerValue('X-DWP-Expected-Decision-Revision'),
        });
        if (classification.allowed) {
          observation.expectedBlockedSideEffects.push(classification.evidence);
          await route.abort('aborted');
          return;
        }
        observation.blockedMutations.push({
          method,
          path: url.pathname,
          reason: 'EXPECTED_SIDE_EFFECT_CONTRACT_MISMATCH',
        });
        await route.abort('blockedbyclient');
        return;
      }

      observation.blockedMutations.push({
        method,
        path: url.pathname,
        reason: 'OWNER_MUTATION',
      });
      await route.abort('blockedbyclient');
      return;
    }

    observation.continuedHttpRequests += 1;
    await route.continue();
  });

  await context.routeWebSocket(
    (url) =>
      ['ws:', 'wss:'].includes(url.protocol) &&
      !(url.protocol === 'ws:' && url.host === ownedBaseURL.host),
    async (webSocket) => {
      observation.blockedExternalWebSockets.push(redactURL(webSocket.url()));
      await webSocket.close({ code: 1008, reason: 'HRIS W1 live localhost-only boundary' });
    }
  );
}
