// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import { WorkHubSourceOwnedDetail } from './work-hub-source-owned-detail';
import { WorkHubSourceDetailMismatchError } from './work-hub-source-owned-detail-model';
import { hubItem } from './work-hub.test-support';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

const sourceDetail = vi.hoisted(() => ({
  result: {} as Record<string, unknown>,
}));

vi.mock('./use-work-hub-source-owned-detail', () => ({
  useWorkHubSourceOwnedDetail: () => sourceDetail.result,
}));

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

const emptyDetail = () => ({
  isSuccess: false,
  isFetching: false,
  isError: false,
  isRefetchError: false,
  isLoading: false,
  error: null,
  data: undefined,
});

async function renderDetail(
  item: Parameters<typeof WorkHubSourceOwnedDetail>[0]['item'],
  onSourceInvalid?: () => void
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubSourceOwnedDetail item={item} onSourceInvalid={onSourceInvalid} />
      </QueryClientProvider>
    )
  );
}

describe('WorkHubSourceOwnedDetail', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    sourceDetail.result = emptyDetail();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
  });

  it.each([
    ['APPROVAL_TASK', 'approval'],
    ['SERVICE_REQUEST', 'service'],
  ] as const)(
    'keeps %s detail read-only and hands execution back to its owner',
    async (sourceSystem, kind) => {
      await renderDetail(
        hubItem({
          reference: { sourceSystem, sourceReference: 'source-1' },
          sourceStatus: 'PENDING',
          waitingFor: 'ME',
        })
      );

      expect(document.body.textContent).toContain(`workHub.sourceDetail.${kind}.title`);
      expect(document.body.textContent).toContain(`workHub.sourceDetail.${kind}.handoffNotice`);
      expect(document.body.textContent).toContain(
        sourceSystem === 'APPROVAL_TASK'
          ? 'workHub.statusLabels.approvalPending'
          : 'workHub.lifecycle.OPEN'
      );
      expect(document.querySelector('button')).toBeNull();
      expect(document.querySelector('form')).toBeNull();
    }
  );

  it('shows the authorized approval list context needed to understand the decision', async () => {
    await renderDetail(
      hubItem({
        reference: { sourceSystem: 'APPROVAL_TASK', sourceReference: 'approval-1' },
        displayId: 'APR-031',
        sourceContext: {
          kind: 'APPROVAL_TASK',
          requestId: 'request-1',
          requesterName: '박서진',
          requesterOrgName: '고객지원본부',
          submittedAt: '2026-09-04T00:00:00Z',
          workflowNameKo: '프로젝트 데이터 접근',
          workflowNameEn: 'Project data access',
          currentStep: { key: 'SECURITY_REVIEW', name: '보안 검토', sequence: 2 },
          riskScore: 35,
        },
      })
    );

    expect(document.body.textContent).toContain('workHub.sourceDetail.approval.document');
    expect(document.body.textContent).toContain('workHub.sourceDetail.approval.contextDescription');
    expect(document.body.textContent).toContain('APR-031');
    expect(document.body.textContent).toContain('박서진');
    expect(document.body.textContent).toContain('고객지원본부');
    expect(document.body.textContent).toContain('프로젝트 데이터 접근');
    expect(document.body.textContent).toContain('보안 검토');
    expect(document.body.textContent).toContain('workHub.sourceDetail.approval.riskScoreValue');
  });

  it('shows service identity and assignment without inventing request fields', async () => {
    await renderDetail(
      hubItem({
        reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'service-1' },
        displayId: 'SR-088',
        sourceContext: {
          kind: 'SERVICE_REQUEST',
          serviceKey: 'vpn-access',
          serviceNameKo: '원격접속(VPN) 신청',
          serviceNameEn: 'VPN access request',
          assignedGroup: 'IT 인프라팀',
          assignedTo: '정다운',
          submittedAt: '2026-09-04T00:00:00Z',
        },
      })
    );

    expect(document.body.textContent).toContain('workHub.sourceDetail.service.request');
    expect(document.body.textContent).toContain('workHub.sourceDetail.service.contextDescription');
    expect(document.body.textContent).toContain('SR-088');
    expect(document.body.textContent).toContain('원격접속(VPN) 신청');
    expect(document.body.textContent).toContain('IT 인프라팀');
    expect(document.body.textContent).toContain('정다운');
  });

  it.each([new HttpError('denied', 403), new WorkHubSourceDetailMismatchError()])(
    'purges list-derived source context and requests reconciliation for %s',
    async (error) => {
      sourceDetail.result = {
        ...emptyDetail(),
        isError: true,
        error,
      };
      const onSourceInvalid = vi.fn();
      const invalidate = vi.spyOn(client, 'invalidateQueries');
      const selected = hubItem({
        reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'service-1' },
        displayId: 'SR-private',
        summary: 'Private request summary',
        sourceContext: {
          kind: 'SERVICE_REQUEST',
          serviceKey: 'restricted-service',
          serviceNameKo: '민감 서비스',
          serviceNameEn: 'Restricted service',
          assignedGroup: 'Restricted team',
          assignedTo: 'Private assignee',
          submittedAt: '2026-09-04T00:00:00Z',
        },
      });
      await renderDetail(selected, onSourceInvalid);

      await vi.waitFor(() => expect(onSourceInvalid).toHaveBeenCalledOnce());
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['workspace', 'work-hub', 'queue'],
      });
      expect(document.body.textContent).toContain('workHub.sourceDetail.accessRequired');
      expect(document.body.textContent).not.toContain('Private assignee');
      expect(document.body.textContent).not.toContain('Restricted team');
      expect(document.body.textContent).not.toContain('Private request summary');
      expect(document.body.textContent).not.toContain('SR-private');
      const replacementCallback = vi.fn();
      await renderDetail(selected, replacementCallback);
      expect(replacementCallback).not.toHaveBeenCalled();
      expect(invalidate).toHaveBeenCalledTimes(1);
    }
  );

  it('retains the last authorized list context while a transport failure hides fetched detail', async () => {
    sourceDetail.result = {
      ...emptyDetail(),
      isError: true,
      error: new HttpError('unavailable', 503),
      data: {
        kind: 'SERVICE_REQUEST',
        fields: [{ key: 'secret', labelKo: '민감 값', labelEn: 'Secret', value: 'hidden' }],
        requestedInformation: 'hidden note',
      },
    };
    const onSourceInvalid = vi.fn();
    await renderDetail(
      hubItem({
        reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'service-1' },
        displayId: 'SR-088',
        sourceContext: {
          kind: 'SERVICE_REQUEST',
          serviceKey: 'vpn-access',
          serviceNameKo: '원격접속 신청',
          serviceNameEn: 'VPN access',
          assignedGroup: 'IT Service',
          assignedTo: null,
          submittedAt: '2026-09-04T00:00:00Z',
        },
      }),
      onSourceInvalid
    );

    expect(document.body.textContent).toContain('SR-088');
    expect(document.body.textContent).toContain('IT Service');
    expect(document.body.textContent).not.toContain('hidden note');
    expect(document.body.textContent).not.toContain('hidden');
    expect(onSourceInvalid).not.toHaveBeenCalled();
  });
});
