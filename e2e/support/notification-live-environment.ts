import path from 'node:path';

const REQUIRED_ACKNOWLEDGEMENT = 'I_UNDERSTAND_THIS_WRITES_DISPOSABLE_LOCAL_NOTIFICATIONS';
const SAFE_RUN_ID = /^[a-z0-9][a-z0-9-]{7,63}$/u;
const GIT_REVISION = /^[0-9a-f]{40,64}$/u;

export type NotificationLiveEnvironment = Readonly<{
  baseURL: string;
  gatewayURL: string;
  notificationServiceURL: string;
  backendRoot: string;
  tenantId: string;
  email: string;
  password: string;
  producerSource: string;
  producerToken: string;
  redisPassword: string;
  frontendRevision: string;
  backendRevision: string;
  runId: string;
  evidenceTimeoutMs: number;
}>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Notification live vertical gate.`);
  return value;
}

function loopbackOrigin(name: string, value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be a loopback HTTP origin without credentials or path data.`);
  }
  return url.origin;
}

function positiveInteger(name: string, value: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return parsed;
}

function gitRevision(name: string): string {
  const value = required(name).toLowerCase();
  if (!GIT_REVISION.test(value)) {
    throw new Error(`${name} must be a 40-64 character hexadecimal Git revision.`);
  }
  return value;
}

export function loadNotificationLiveEnvironment(): NotificationLiveEnvironment {
  if (required('NOTIFICATION_LIVE_ACK') !== REQUIRED_ACKNOWLEDGEMENT) {
    throw new Error(`NOTIFICATION_LIVE_ACK must equal ${REQUIRED_ACKNOWLEDGEMENT}.`);
  }
  const backendRoot = path.resolve(required('NOTIFICATION_LIVE_BACKEND_ROOT'));
  const runId = process.env.NOTIFICATION_LIVE_RUN_ID?.trim() || crypto.randomUUID();
  if (!SAFE_RUN_ID.test(runId)) {
    throw new Error('NOTIFICATION_LIVE_RUN_ID must be 8-64 lowercase letters, digits, or hyphens.');
  }
  const tenantId = required('NOTIFICATION_LIVE_TENANT_ID');
  positiveInteger('NOTIFICATION_LIVE_TENANT_ID', tenantId, 1, Number.MAX_SAFE_INTEGER);
  const producerToken = required('NOTIFICATION_LIVE_PRODUCER_TOKEN');
  if (producerToken.length < 24) {
    throw new Error('NOTIFICATION_LIVE_PRODUCER_TOKEN must contain at least 24 characters.');
  }
  return Object.freeze({
    baseURL: loopbackOrigin('NOTIFICATION_LIVE_BASE_URL', required('NOTIFICATION_LIVE_BASE_URL')),
    gatewayURL: loopbackOrigin(
      'NOTIFICATION_LIVE_GATEWAY_URL',
      required('NOTIFICATION_LIVE_GATEWAY_URL')
    ),
    notificationServiceURL: loopbackOrigin(
      'NOTIFICATION_LIVE_SERVICE_URL',
      required('NOTIFICATION_LIVE_SERVICE_URL')
    ),
    backendRoot,
    tenantId,
    email: required('NOTIFICATION_LIVE_EMAIL'),
    password: required('NOTIFICATION_LIVE_PASSWORD'),
    producerSource: required('NOTIFICATION_LIVE_PRODUCER_SOURCE'),
    producerToken,
    redisPassword: required('NOTIFICATION_LIVE_REDIS_PASSWORD'),
    frontendRevision: gitRevision('NOTIFICATION_LIVE_FRONTEND_SHA'),
    backendRevision: gitRevision('NOTIFICATION_LIVE_BACKEND_SHA'),
    runId,
    evidenceTimeoutMs: positiveInteger(
      'NOTIFICATION_LIVE_EVIDENCE_TIMEOUT_MS',
      process.env.NOTIFICATION_LIVE_EVIDENCE_TIMEOUT_MS?.trim() || '45000',
      5_000,
      120_000
    ),
  });
}

export const NOTIFICATION_LIVE_ACKNOWLEDGEMENT = REQUIRED_ACKNOWLEDGEMENT;
