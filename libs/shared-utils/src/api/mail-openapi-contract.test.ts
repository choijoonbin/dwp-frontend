import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type OpenApiParameter = Readonly<{
  in?: string;
  name?: string;
  schema?: Readonly<{
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    type?: string;
  }>;
  'x-dwp-conditional-required'?: Readonly<{
    enforcement?: string;
    rolloutStates?: readonly string[];
  }>;
}>;

type OpenApiOperation = Readonly<{
  operationId?: string;
  parameters?: readonly OpenApiParameter[];
}>;

const gateway = JSON.parse(
  readFileSync(resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'), 'utf8')
) as {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
  };
};

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

function mailOperations() {
  return Object.entries(gateway.paths)
    .filter(([path]) => /^\/api\/platform\/v1\/(?:admin\/)?mail(?:\/|$)/u.test(path))
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => HTTP_METHODS.has(method))
        .map(([method, operation]) => ({ path, method, operation }))
    );
}

describe('generated Mail Gateway contract', () => {
  it('keeps the reviewed operation surface and critical operationIds stable', () => {
    const operations = mailOperations();
    expect(operations).toHaveLength(118);
    expect(new Set(operations.map(({ operation }) => operation.operationId)).size).toBe(118);

    const operationId = (method: string, path: string) =>
      gateway.paths[path]?.[method]?.operationId;
    expect(operationId('post', '/api/platform/v1/mail/messages')).toBe('platform_compose');
    expect(operationId('get', '/api/platform/v1/mail/threads')).toBe('platform_threads');
    expect(operationId('get', '/api/platform/v1/mail/events')).toBe(
      'platform_streamMailEvents'
    );
    expect(operationId('get', '/api/platform/v1/mail/events/catch-up')).toBe(
      'platform_catchUpMailEvents'
    );
    expect(operationId('put', '/api/platform/v1/admin/mail/policy')).toBe(
      'platform_updateAdminMailPolicy'
    );
    expect(
      operationId(
        'post',
        '/api/platform/v1/admin/mail/retention/hold-release-previews/{previewId}/execute'
      )
    ).toBe('platform_executeLegalHoldRelease');
  });

  it('requires opaque scope on every Mail call and a fail-closed revision on mutations', () => {
    for (const { path, method, operation } of mailOperations()) {
      const scope = operation.parameters?.find(
        (parameter) => parameter.in === 'query' && parameter.name === 'contextScopeKey'
      );
      expect(scope, `${method.toUpperCase()} ${path} scope`).toBeDefined();
      expect(scope?.schema, `${method.toUpperCase()} ${path} opaque scope`).toEqual({
        maxLength: 500,
        minLength: 1,
        pattern: '^[^\\u0000-\\u001F\\u007F]+$',
        type: 'string',
      });
    }
    for (const { path, method, operation } of mailOperations().filter(({ method }) =>
      MUTATION_METHODS.has(method)
    )) {
      const revision = operation.parameters?.find(
        (parameter) =>
          parameter.in === 'header' && parameter.name === 'X-DWP-Expected-Decision-Revision'
      );
      expect(
        revision?.['x-dwp-conditional-required'],
        `${method.toUpperCase()} ${path} revision`
      ).toEqual({ enforcement: 'FAIL_CLOSED', rolloutStates: ['110', '111'] });
    }
  });

  it('derives replay-safe bulk identities from the authoritative request schemas', () => {
    for (const schemaName of [
      'platform_ThreadActionRequest',
      'platform_LifecycleRequest',
    ]) {
      const properties = gateway.components.schemas[schemaName]?.properties;
      expect(properties, schemaName).toHaveProperty('bulkIntentId');
      expect(properties, schemaName).toHaveProperty('itemIdempotencyKey');
    }
  });

  it('routes every handwritten Mail client through the governed transport', () => {
    for (const file of [
      'mail-api.ts',
      'mail-address-book-api.ts',
      'mail-user-completion-api.ts',
      'mail-admin-completion-api.ts',
    ]) {
      const source = readFileSync(
        resolve(process.cwd(), 'libs/shared-utils/src/api', file),
        'utf8'
      );
      expect(source, file).toContain("from './mail-governed-transport'");
      expect(source, file).not.toContain("from '../axios-instance'");
    }
  });
});
