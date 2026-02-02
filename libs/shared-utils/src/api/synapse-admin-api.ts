/**
 * SynapseX Admin API (barrel)
 * X-Tenant-ID 필수, X-User-ID 선택(감사용)
 * 분리: synapse-admin-tenant-scope-api.ts, synapse-admin-pii-api.ts
 */

export * from './synapse-admin-pii-api';
export * from './synapse-admin-tenant-scope-api';
