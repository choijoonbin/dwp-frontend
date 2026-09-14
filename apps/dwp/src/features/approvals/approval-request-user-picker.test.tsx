// @vitest-environment jsdom
import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalRequestUserPicker } from './approval-request-user-picker';
import { useApprovalRequestUserSource } from './use-approval-request-user-source';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';

import type {
  ApprovalFormUserBinding,
  ApprovalFormUserCandidate,
} from '@dwp-frontend/shared-utils/api/approval-form-user-api';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';
import type { ApprovalRequestUserBinding } from './approval-request-user-picker';

const dependencies = vi.hoisted(() => ({
  search: vi.fn(),
  change: vi.fn(),
  scope: { actor: 'actor-a', revision: `psr-${'a'.repeat(64)}`, ready: true },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils/api/approval-form-user-api', () => ({
  searchApprovalFormUserCandidates: dependencies.search,
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: dependencies.scope.ready,
    governed: true,
    contextScopeKey: dependencies.scope.actor,
    cacheKey: [
      'tenant-a',
      dependencies.scope.actor,
      'NORMAL',
      'approvals.work',
      dependencies.scope.actor,
      dependencies.scope.revision,
    ],
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant-a',
      actorId: dependencies.scope.actor,
      accessMode: 'NORMAL',
      surfaceId: 'approvals.work',
      productId: 'approvals',
      contextScopeKey: dependencies.scope.actor,
      decisionRevision: dependencies.scope.revision,
    },
  }),
}));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionIconButton: ({
    label,
    disabled,
    onClick,
  }: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => <button aria-label={label} disabled={disabled} onClick={onClick} />,
  AutocompleteField: ({
    label,
    disabled,
    inputValue,
    options,
    value,
    onInputChange,
    onChange,
    errorMessage,
    supportingText,
  }: {
    label: string;
    disabled: boolean;
    inputValue: string;
    options: ApprovalFormUserCandidate[];
    value?: ApprovalFormUserCandidate;
    errorMessage?: ReactNode;
    supportingText?: ReactNode;
    onInputChange: (event: null, text: string, reason: string) => void;
    onChange: (event: null, value: ApprovalFormUserCandidate | null) => void;
  }) => (
    <div>
      <input
        aria-label={label}
        disabled={disabled}
        value={inputValue}
        onChange={(event) => onInputChange(null, event.target.value, 'input')}
      />
      <span>{value?.displayName}</span>
      <span>{supportingText}</span>
      {errorMessage && <div role="alert">{errorMessage}</div>}
      {options.map((person) => (
        <button
          disabled={disabled}
          key={person.personPublicId}
          onClick={() => onChange(null, person)}
        >
          {person.displayName}
        </button>
      ))}
    </div>
  ),
}));

const person = {
  personPublicId: '33333333-3333-4333-8333-333333333333',
  displayName: 'Current User',
};
const binding: ApprovalFormUserBinding = {
  formId: '11111111-1111-4111-8111-111111111111',
  formVersionId: '22222222-2222-4222-8222-222222222222',
  schemaSha256: 'a'.repeat(64),
  fieldKey: 'reviewer',
  surface: 'WORK',
};
let compiled: CompiledApprovalTypedForm;
let source: ReturnType<typeof useApprovalRequestUserSource>;
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
type HarnessProps = { disabled?: boolean; bound?: boolean; ownerVersion?: number };
const requestId = '44444444-4444-4444-8444-444444444444';
function Harness({ disabled = false, bound = true, ownerVersion }: HarnessProps) {
  const [value, setValue] = useState('');
  const currentBinding: ApprovalRequestUserBinding = {
    ...binding,
    ...(ownerVersion !== undefined ? { requestId, requestVersion: ownerVersion } : {}),
  };
  source = useApprovalRequestUserSource({
    identity: JSON.stringify(dependencies.scope),
    binding: bound ? currentBinding : undefined,
    compiled,
    values: { reviewer: value },
  });
  return (
    <ApprovalRequestUserPicker
      binding={bound ? currentBinding : undefined}
      label="Reviewer"
      value={value}
      disabled={disabled}
      onChange={(next) => {
        dependencies.change(next);
        setValue(next);
      }}
      onSourceReadyChange={(state) => source.report('reviewer', value, state)}
    />
  );
}
function render(props?: HarnessProps) {
  root.render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>
  );
}
async function search(text = 'Current') {
  await act(async () =>
    fireEvent.change(getByRole(container, 'textbox', { name: 'Reviewer' }), {
      target: { value: text },
    })
  );
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 400)));
}
async function select() {
  await search();
  const option = await vi.waitFor(() =>
    getByRole(container, 'button', { name: person.displayName })
  );
  await act(async () => fireEvent.click(option));
  await vi.waitFor(() => expect(source.ready).toBe(true));
}

describe('Actual USER picker and request mutation-time source readiness', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    dependencies.scope = { actor: 'actor-a', revision: `psr-${'a'.repeat(64)}`, ready: true };
    dependencies.search.mockImplementation(async (input: ApprovalRequestUserBinding) => ({
      ...binding,
      fieldPath: 'reviewer',
      decisionRevision: dependencies.scope.revision,
      requestId: input.requestId ?? null,
      requestVersion: input.requestVersion ?? null,
      validUntil: new Date(Date.now() + 60_000).toISOString(),
      people: [person],
      mayBeTruncated: false,
    }));
    compiled = await compileApprovalTypedForm({
      schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
      schemaVersion: 2,
      fields: [
        { key: 'reviewer', type: 'USER', required: true, labelKo: '검토자', labelEn: 'Reviewer' },
      ],
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: 3 } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('uses only the fixed API binding and selected candidate UUID, never arbitrary name text as a reference', async () => {
    await act(async () => render());
    await search('unselected arbitrary text');
    await vi.waitFor(() => expect(dependencies.search).toHaveBeenCalledTimes(1));
    await select();
    expect(dependencies.search).toHaveBeenCalledWith(
      binding,
      'Current',
      10,
      'actor-a',
      expect.any(AbortSignal)
    );
    expect(source.isReady()).toBe(true);
  });
  it.each([403, 503])(
    'clears options and closes writes on the first %s, preserving the selected reference until explicit source recovery',
    async (status) => {
      await act(async () => render());
      await select();
      dependencies.search.mockRejectedValueOnce(new HttpError('Source unavailable', status));
      await search('Changed search');
      await vi.waitFor(() =>
        expect(getByRole(container, 'alert').textContent).toBe('requests.typed.userUnavailable')
      );
      expect(source.isReady()).toBe(false);
      expect(queryByRole(container, 'button', { name: person.displayName })).toBeNull();
      await search('Current recovery');
      const option = await vi.waitFor(() =>
        getByRole(container, 'button', { name: person.displayName })
      );
      expect(source.isReady()).toBe(false);
      await act(async () => fireEvent.click(option));
      await vi.waitFor(() => expect(source.isReady()).toBe(true));
    }
  );
  it('checks candidate expiry synchronously at mutation time even when the expiry timer has not run', async () => {
    await act(async () => render());
    await select();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    expect(source.isReady()).toBe(false);
  });
  it.each([
    { requestId, requestVersion: 1 },
    { requestId: person.personPublicId, requestVersion: 0 },
  ])(
    'rejects owner echo mismatch %j, including when the current database version is zero',
    async (echo) => {
      await act(async () => render({ ownerVersion: 0 }));
      await select();
      expect(dependencies.change).toHaveBeenCalledExactlyOnceWith(person.personPublicId);
      dependencies.search.mockResolvedValueOnce({
        ...binding,
        ...echo,
        fieldPath: 'reviewer',
        decisionRevision: dependencies.scope.revision,
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        people: [person],
        mayBeTruncated: false,
      });
      await search('Owner mismatch');
      await vi.waitFor(() => expect(queryByRole(container, 'alert')).not.toBeNull());
      expect(source.isReady()).toBe(false);
      expect(queryByRole(container, 'button', { name: person.displayName })).toBeNull();
      expect(dependencies.change).toHaveBeenCalledTimes(1);
    }
  );
  it('renews evidence after a committed owner version while busy, without replacing the stored UUID', async () => {
    await act(async () => render({ ownerVersion: 3 }));
    await select();
    let resolve!: (value: unknown) => void;
    dependencies.search.mockImplementationOnce(
      () =>
        new Promise((accept) => {
          resolve = accept;
        })
    );
    await act(async () => render({ ownerVersion: 4, disabled: true }));
    expect(source.isReady()).toBe(false);
    await vi.waitFor(() => expect(dependencies.search).toHaveBeenCalledTimes(2));
    expect(dependencies.search.mock.calls[1]![0]).toMatchObject({ requestId, requestVersion: 4 });
    await act(async () =>
      resolve({
        ...binding,
        requestId,
        requestVersion: 4,
        fieldPath: 'reviewer',
        decisionRevision: dependencies.scope.revision,
        validUntil: new Date(Date.now() + 60_000).toISOString(),
        people: [person],
        mayBeTruncated: false,
      })
    );
    await vi.waitFor(() => expect(source.isReady()).toBe(true));
    expect(dependencies.change).toHaveBeenCalledExactlyOnceWith(person.personPublicId);
  });
  it('aborts an old lookup and rejects A-to-B-to-A late candidates rather than retaining another identity', async () => {
    let resolve!: (value: unknown) => void;
    dependencies.search.mockImplementationOnce(
      () =>
        new Promise((accept) => {
          resolve = accept;
        })
    );
    await act(async () => render());
    await search();
    await vi.waitFor(() => expect(dependencies.search).toHaveBeenCalledTimes(1));
    const signal = dependencies.search.mock.calls[0]![4] as AbortSignal;
    dependencies.scope.actor = 'actor-b';
    await act(async () => render());
    dependencies.scope.actor = 'actor-a';
    await act(async () => render());
    expect(signal.aborted).toBe(true);
    await act(async () =>
      resolve({
        ...binding,
        fieldPath: 'reviewer',
        people: [person],
        decisionRevision: dependencies.scope.revision,
        requestId: null,
        requestVersion: null,
        validUntil: new Date(Date.now() + 60_000).toISOString(),
      })
    );
    expect(queryByRole(container, 'button', { name: person.displayName })).toBeNull();
    expect(getByRole(container, 'textbox', { name: 'Reviewer' })).toHaveProperty('value', '');
  });
  it.each([{ disabled: true }, { bound: false }])(
    'keeps unpublished or unverified source truthfully disabled with zero API calls: %j',
    async (props) => {
      await act(async () => render(props));
      expect(getByRole(container, 'textbox', { name: 'Reviewer' })).toHaveProperty(
        'disabled',
        true
      );
      expect(dependencies.search).not.toHaveBeenCalled();
    }
  );
});
