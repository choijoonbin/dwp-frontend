// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkplaceResourceMediaEditor } from './workplace-resource-photo';
import { WorkplaceFacilityRequestDialog } from './workplace-facility-request';

const mocks = vi.hoisted(() => ({
  authority: 'tenant1:user7:permissionA',
  remove: vi.fn(),
  upload: vi.fn(),
  createRequest: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./workplace-experience-authority', () => ({
  useWorkplaceExperienceAuthority: () => mocks.authority,
}));
vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canCreateWorkplaceAdmin: true,
    canManageWorkplaceAdmin: true,
    canViewWorkplace: true,
    canCreateWorkplaceBooking: true,
  }),
  useWorkplaceGovernanceCapabilities: () => ({ isLoaded: true, hierarchy: { canManage: true } }),
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  getWorkplaceResourcePhotoMetadata: async (resourceId: string) => ({
    resourceId,
    version: 4,
    altText: 'Registered photo',
    sha256: 'registered-content-digest',
  }),
  getWorkplaceResourcePhoto: vi.fn(),
  uploadWorkplaceResourcePhoto: mocks.upload,
  deleteWorkplaceResourcePhoto: mocks.remove,
  createWorkplaceFacilityRequest: mocks.createRequest,
  HttpError: class extends Error {
    status = 500;
  },
}));
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
async function render(resourceId = 'resource-A') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkplaceResourceMediaEditor resourceId={resourceId} name={resourceId} />
      </QueryClientProvider>
    )
  );
  await flush();
}
function field(label: string) {
  const element = Array.from(document.querySelectorAll('label')).find((item) =>
    item.textContent?.startsWith(label)
  );
  const input = element && document.getElementById(element.htmlFor);
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing ${label}`);
  return input;
}
async function text(label: string, value: string) {
  await act(async () => {
    const input = field(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function file(name: string) {
  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='
    ),
    (char) => char.charCodeAt(0)
  );
  const chosen = new File([bytes], name, { type: 'image/png' });
  await act(async () => {
    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [chosen] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return chosen;
}
function button(key: string) {
  const item = Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent === key
  );
  if (!item) throw new Error(`Missing ${key}`);
  return item;
}
async function confirm() {
  await act(async () =>
    (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
  );
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function renderFacility(resourceId = 'resource-A') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkplaceFacilityRequestDialog
          resourceId={resourceId}
          resourceName={resourceId}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )
  );
  await flush();
}
async function requestDescription(value: string) {
  await act(async () => {
    const input = document.querySelector('textarea');
    if (!input) throw new Error('Missing facility request description');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      input,
      value
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.authority = 'tenant1:user7:permissionA';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

describe('facility request issued command dispatch', () => {
  it('ignores an orphan completion after the keyed dialog unmounts and resource A opens again', async () => {
    const pending = deferred();
    mocks.createRequest.mockReturnValueOnce(pending.promise);
    await renderFacility();
    await requestDescription('Original resource A repair request');
    await act(async () => button('workplace.experience.requestSubmit').click());
    await flush();
    expect(mocks.createRequest).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    await renderFacility();
    await requestDescription('New resource A repair draft');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => pending.resolve({ requestId: 'orphan-request-id' }));
    await flush();
    expect(document.querySelector('textarea')).toHaveProperty(
      'value',
      'New resource A repair draft'
    );
    expect(document.body.textContent).not.toContain('orphan-request-id');
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('dispatches one same-tick submission and retries an unknown outcome only with the identical native key', async () => {
    const pending = deferred();
    const retry = deferred();
    mocks.createRequest.mockReturnValueOnce(pending.promise).mockReturnValueOnce(retry.promise);
    await renderFacility();
    await requestDescription('The selected desk needs repair');
    expect(button('workplace.experience.requestSubmit').disabled).toBe(false);
    await act(async () => {
      const form = document.querySelector('form');
      if (!form) throw new Error('Missing facility request form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(mocks.createRequest).toHaveBeenCalledTimes(1);
    const original = mocks.createRequest.mock.calls[0];
    expect(original).toEqual([
      'resource-A',
      { category: 'REPAIR', description: 'The selected desk needs repair' },
      expect.any(String),
    ]);
    expect(original[2]).toMatch(/^[0-9a-f-]{36}$/);
    await act(async () => pending.reject(new Error('Server outcome unknown')));
    await flush();
    expect(mocks.createRequest).toHaveBeenCalledTimes(1);
    expect(button('workplace.experience.requestSubmit').disabled).toBe(true);
    expect(document.querySelector('textarea')).toHaveProperty('disabled', true);
    await act(async () => button('workplace.experience.sameRequestRetry').click());
    await flush();
    expect(mocks.createRequest).toHaveBeenCalledTimes(2);
    expect(mocks.createRequest.mock.calls[1]).toEqual(original);
    await act(async () => retry.resolve({ requestId: 'actual-request-id' }));
    await flush();
    expect(document.body.textContent).toContain('actual-request-id');
    expect(button('workplace.experience.requestSubmit').disabled).toBe(true);
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.clearAllMocks();
});

describe('resource photo issued command scope', () => {
  it('does not invalidate the reopened inspector when its previous keyed instance completes deletion', async () => {
    const pending = deferred();
    mocks.remove.mockReturnValueOnce(pending.promise);
    await render();
    await text('workplace.experience.reason', 'Original reviewed deletion');
    await confirm();
    await act(async () => button('workplace.experience.photoRemove').click());
    await flush();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null));
    await render();
    await text('workplace.experience.reason', 'New resource A inspector draft');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => pending.resolve({ removed: true }));
    await flush();
    expect(field('workplace.experience.reason').value).toBe('New resource A inspector draft');
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('keeps the reentered permission-A draft when its previous delete completes after A→B→A', async () => {
    const pending = deferred();
    mocks.remove.mockReturnValueOnce(pending.promise);
    await render();
    await text('workplace.experience.reason', 'Original reviewed deletion');
    await confirm();
    expect(button('workplace.experience.photoRemove').disabled).toBe(false);
    await act(async () => button('workplace.experience.photoRemove').click());
    await flush();
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(
      'resource-A',
      4,
      'Original reviewed deletion'
    );
    mocks.authority = 'tenant1:user7:permissionB';
    await render();
    mocks.authority = 'tenant1:user7:permissionA';
    await render();
    await text('workplace.experience.reason', 'New permission-A draft');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => pending.resolve({ removed: true }));
    await flush();
    expect(field('workplace.experience.reason').value).toBe('New permission-A draft');
    expect(field('workplace.experience.reason').disabled).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('does not lock or replace the new resource-A upload draft after an old A→B→A upload fails', async () => {
    const pending = deferred();
    mocks.upload.mockReturnValueOnce(pending.promise);
    await render();
    const originalFile = await file('original.png');
    await text('workplace.experience.photoAlt', 'Original approved description');
    await text('workplace.experience.reason', 'Original reviewed upload');
    await confirm();
    expect(button('workplace.experience.photoUpload').disabled).toBe(false);
    await act(async () => button('workplace.experience.photoUpload').click());
    await flush();
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
      'resource-A',
      originalFile,
      4,
      'Original reviewed upload',
      'Original approved description'
    );
    await render('resource-B');
    await render('resource-A');
    const newFile = await file('new.png');
    await text('workplace.experience.photoAlt', 'New approved description');
    await text('workplace.experience.reason', 'New reviewed upload');
    await confirm();
    await act(async () => pending.reject(new Error('Old upload outcome unknown')));
    await flush();
    expect(field('workplace.experience.reason').value).toBe('New reviewed upload');
    expect(field('workplace.experience.photoAlt').value).toBe('New approved description');
    expect(field('workplace.experience.reason').disabled).toBe(false);
    expect(button('workplace.experience.photoUpload').disabled).toBe(false);
    expect(document.querySelector('input[type="checkbox"]')).toHaveProperty('checked', true);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).files?.[0]).toBe(
      newFile
    );
  });
});
