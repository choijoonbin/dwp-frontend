// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ServiceInformationResponse } from './service-information-response';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

const context = vi.hoisted(() => ({
  actorId: 11,
  scopeKey: 'scope:self',
  accessMode: 'NORMAL',
  getDetail: vi.fn(),
  respond: vi.fn(),
  confirm: vi.fn(),
  refresh: vi.fn(),
  changeMessage: null as null | ((event: { target: { value: string } }) => void),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { identityPlane: 'TENANT', tenantId: 1, userId: context.actorId },
  }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('../../components/product-surface-capability-access', () => ({
  useProductSurfaceCapabilityAccess: () => ({ governed: true, hasWritableCapability: () => true }),
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: context.scopeKey,
    queryMeta: { accessMode: context.accessMode },
  }),
}));
vi.mock('../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => (execute: (authority: object) => unknown) =>
    execute({ mode: 'TEST' }),
}));
vi.mock('@dwp-frontend/shared-utils/api/service-center-api', () => ({
  getMyServiceRequest: (...args: unknown[]) => context.getDetail(...args),
  respondToServiceInformationRequest: (...args: unknown[]) => context.respond(...args),
}));
vi.mock('./service-information-response-fields', () => ({
  ServiceInformationResponseFields: () => null,
}));
vi.mock('@dwp-frontend/design-system', async () => {
  const { createElement: element } = await import('react');
  return {
    ActionButton: ({
      children,
      onClick,
      disabled,
    }: {
      children: string;
      onClick: () => void;
      disabled: boolean;
    }) => element('button', { onClick, disabled }, children),
    InlineFeedback: ({ children }: { children: string }) => element('div', {}, children),
    FormField: ({ value, onChange }: { value: string; onChange: typeof context.changeMessage }) => {
      context.changeMessage = onChange;
      return element('output', { 'data-draft': true }, value);
    },
    ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
      open ? element('button', { 'data-confirm': true, onClick: onConfirm }, 'Confirm') : null,
  };
});

const detail = {
  request: {
    requestId: 'request-1',
    status: 'AWAITING_REQUESTER',
    version: 3,
    summary: 'VPN request',
  },
  values: { purpose: 'Support work' },
  requestSchema: { fields: [{ key: 'purpose', type: 'TEXT', required: true }] },
  timeline: [],
} as unknown as ServiceRequestDetail;
const draft = 'The customer support project needs the requested network access.';
let host: HTMLDivElement;
let root: Root;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
async function render(nextDetail = detail) {
  await act(async () =>
    root.render(
      createElement(ServiceInformationResponse, {
        detail: nextDetail,
        onConfirmed: context.confirm,
        onRefresh: context.refresh,
      })
    )
  );
}
async function write(value: string) {
  await act(async () => context.changeMessage?.({ target: { value } }));
}
async function submitPreview() {
  await write(draft);
  const review = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'informationResponse.review'
  )!;
  await act(async () => review.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[data-confirm]')!.click());
}
beforeEach(() => {
  vi.clearAllMocks();
  context.actorId = 11;
  context.scopeKey = 'scope:self';
  context.accessMode = 'NORMAL';
  context.getDetail.mockResolvedValue(detail);
  context.respond.mockResolvedValue({
    ...detail,
    request: { ...detail.request, version: 4, status: 'IN_PROGRESS' },
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
it('discards a private draft when access mode changes within the same actor and scope', async () => {
  await render();
  await write(draft);
  context.accessMode = 'SUPPORT';
  await render();
  expect(host.querySelector('[data-draft]')?.textContent).toBe('');
});
it('does not revive an old preflight after a scope leaves and returns', async () => {
  const read = deferred<ServiceRequestDetail>();
  context.getDetail.mockReturnValue(read.promise);
  await render();
  await submitPreview();
  context.scopeKey = 'scope:another';
  await render();
  context.scopeKey = 'scope:self';
  await render();
  await write('A new response drafted after returning to the original scope.');
  await act(async () => read.resolve(detail));
  expect(context.respond).not.toHaveBeenCalled();
  expect(context.confirm).not.toHaveBeenCalled();
  expect(host.querySelector('[data-draft]')?.textContent).toContain('A new response');
});
it('ignores a late receipt after the actor leaves and returns to the request', async () => {
  const receipt = deferred<ServiceRequestDetail>();
  context.respond.mockReturnValue(receipt.promise);
  await render();
  await submitPreview();
  expect(context.respond).toHaveBeenCalledTimes(1);
  context.actorId = 22;
  await render();
  context.actorId = 11;
  await render();
  await write('New actor session response that must remain untouched.');
  await act(async () =>
    receipt.resolve({
      ...detail,
      request: { ...detail.request, version: 4, status: 'IN_PROGRESS' },
    })
  );
  expect(context.confirm).not.toHaveBeenCalled();
  expect(host.querySelector('[data-draft]')?.textContent).toContain('New actor session');
});

it('starts a new response when the service team requests information again', async () => {
  await render();
  await submitPreview();
  const receipt = context.confirm.mock.calls[0][0] as ServiceRequestDetail;
  await render(receipt);
  const reopened = {
    ...detail,
    request: { ...detail.request, version: 5 },
    values: { purpose: 'New requested project scope' },
  };
  await render(reopened);
  expect(host.querySelector('[data-draft]')?.textContent).toBe('');
  context.getDetail.mockResolvedValue(reopened);
  context.respond.mockResolvedValue({
    ...reopened,
    request: { ...reopened.request, version: 6, status: 'IN_PROGRESS' },
  });
  await submitPreview();
  expect(context.respond).toHaveBeenCalledTimes(2);
  expect(context.respond.mock.calls[1][1]).toMatchObject({
    version: 5,
    values: { purpose: 'New requested project scope' },
  });
});
