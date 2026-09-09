// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { WorkHubSourceOwnedDetail } from './work-hub-source-owned-detail';
import { hubItem } from './work-hub.test-support';
import type { WorkHubSourceDetailProjection } from './work-hub-source-owned-detail-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
const source = vi.hoisted(() => ({ result: {} as Record<string, unknown> }));
vi.mock('./use-work-hub-source-owned-detail', () => ({
  useWorkHubSourceOwnedDetail: () => source.result,
}));

const projection: WorkHubSourceDetailProjection = {
  kind: 'APPROVAL_TASK',
  fields: [],
  history: [
    {
      id: 'verified-event',
      event: 'approved',
      occurredAt: '2026-09-04T02:00:00Z',
      actor: 'USER',
      actorName: 'Mina Kim',
      stepName: 'Manager review',
      stepSequence: 2,
      delegated: true,
      outcome: 'SUCCESS',
      status: null,
      message: '<script>Private source note</script>\nA long explanation '.repeat(15),
    },
  ],
};
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
async function render(sourceSystem: 'APPROVAL_TASK' | 'APPROVAL_REQUEST' = 'APPROVAL_TASK') {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubSourceOwnedDetail
          item={hubItem({
            reference: { sourceSystem, sourceReference: 'approval-1' },
          })}
        />
      </QueryClientProvider>
    )
  );
}

describe('authorized source history', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    source.result = {
      isSuccess: true,
      isFetching: false,
      isError: false,
      isRefetchError: false,
      isLoading: false,
      error: null,
      data: projection,
    };
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
  });

  it('renders only recorded actors, past steps and results with semantic time and escaped plain text', async () => {
    await render();
    expect(host.querySelectorAll('ol > li')).toHaveLength(1);
    expect(host.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-04T02:00:00Z');
    expect(host.textContent).toContain('Mina Kim');
    expect(host.textContent).toContain('Manager review');
    expect(host.textContent).toContain('workHub.sourceOwned.history.delegated');
    expect(host.textContent).toContain('workHub.sourceOwned.history.outcomes.SUCCESS');
    expect(host.textContent).toContain(projection.history[0].message);
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('button, form, input, textarea')).toBeNull();
  });

  it('states that the source supplied no displayable history without inventing a route or events', async () => {
    source.result.data = { ...projection, history: [] };
    await render();
    expect(host.textContent).toContain('workHub.sourceOwned.history.empty');
    expect(host.querySelector('time, ol')).toBeNull();
    expect(host.textContent).not.toContain('Manager review');
  });

  it('renders the requester information note and submitted values as read-only source evidence', async () => {
    source.result.data = {
      kind: 'APPROVAL_REQUEST',
      requestedInformation: 'Provide the supplier comparison.',
      fields: [
        {
          key: 'purpose',
          labelKo: '구매 목적',
          labelEn: 'Purpose',
          value: 'Replace the equipment',
        },
      ],
      history: projection.history,
    } satisfies WorkHubSourceDetailProjection;
    await render('APPROVAL_REQUEST');
    expect(host.textContent).toContain('workHub.sourceOwned.request.requestedInformation');
    expect(host.textContent).toContain('Provide the supplier comparison.');
    expect(host.textContent).toContain('workHub.sourceOwned.request.fields');
    expect(host.textContent).toContain('Replace the equipment');
    expect(host.querySelector('form, input, textarea')).toBeNull();
    source.result.data = {
      kind: 'APPROVAL_REQUEST',
      fields: [],
      requestedInformation: null,
      history: [],
    } satisfies WorkHubSourceDetailProjection;
    await render('APPROVAL_REQUEST');
    expect(host.textContent).toContain('workHub.sourceOwned.request.noInformation');
    expect(host.textContent).toContain('workHub.sourceOwned.request.emptyFields');
    expect(host.textContent).not.toContain('Replace the equipment');
  });

  it.each([403, 503])(
    'removes cached private history during refetch and after a %s response',
    async (status) => {
      await render();
      expect(host.textContent).toContain('Private source note');
      source.result = { ...source.result, isFetching: true };
      await render();
      expect(host.textContent).not.toContain('Private source note');
      expect(host.querySelector('time')).toBeNull();
      source.result = {
        ...source.result,
        isFetching: false,
        isError: true,
        isRefetchError: true,
        error: new HttpError('Source unavailable', status),
      };
      await render();
      expect(host.textContent).not.toContain('Mina Kim');
      expect(host.textContent).not.toContain('Private source note');
      expect(host.querySelector('time')).toBeNull();
    }
  );
});
