// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useWorkHubServiceResponse } from './use-work-hub-service-response';

import type { WorkHubAssistDraft } from '../features/work-hub/work-hub-assist';
import type { WorkHubItem } from '../features/work-hub/work-hub-contracts';
import type { ServiceInformationResponseBinding } from '../features/services/service-information-response-bridge';

const bridge = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock('../features/services/service-information-response-bridge', () => ({
  ServiceInformationResponseBridge: (props: Record<string, unknown>) => {
    bridge.props = props;
    return createElement('div', { 'data-testid': 'bridge' });
  },
}));

const item = {
  key: 'SERVICE_REQUEST:request-1:',
  reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'request-1' },
  sourceStatus: 'AWAITING_REQUESTER',
  version: 3,
  sourceContext: { kind: 'SERVICE_REQUEST', serviceKey: 'vpn-access' },
  dataClassification: 'INTERNAL',
} as WorkHubItem;
const candidate = {
  workKey: item.key,
  sourceVersion: item.version,
  message: 'A reviewed answer draft with enough detail to apply.',
} as WorkHubAssistDraft;

let host: HTMLDivElement;
let root: Root;
let current: ReturnType<typeof useWorkHubServiceResponse> | null;

function Host({ selected = item }: { selected?: WorkHubItem | null }) {
  current = useWorkHubServiceResponse({
    owner: 'owner-a',
    item: selected ?? undefined,
    onConfirmed: vi.fn(),
  });
  return current.bridge;
}

beforeEach(() => {
  bridge.props = null;
  current = null;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('forgets an applied draft so a later bridge remount cannot apply it again', async () => {
  await act(async () => root.render(createElement(Host)));
  await act(async () =>
    (bridge.props?.onBindingChange as (value: ServiceInformationResponseBinding) => void)({
      requestId: 'request-1',
      version: 3,
      status: 'AWAITING_REQUESTER',
    })
  );
  await act(async () => expect(current?.applyDraft(candidate)).toBe(true));
  expect(bridge.props?.appliedDraft).toMatchObject({ message: candidate.message });

  await act(async () => (bridge.props?.onDraftApplied as () => void)());
  expect(bridge.props?.appliedDraft).toBeNull();

  await act(async () => root.render(createElement(Host, { selected: null })));
  await act(async () => root.render(createElement(Host)));
  expect(bridge.props?.appliedDraft).toBeNull();
});
