// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { WorkHubAssistPanel, type WorkHubAssistPanelProps } from './work-hub-assist-dialog';
import { hubItem } from './work-hub.test-support';
import type { AskDwpResponse } from '@dwp-frontend/shared-utils/api/agent-runtime-api';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance', () => ({
  useShellAuxiliaryAvoidance: () => undefined,
}));
const answer = '업무 목적과 접속 대상 및 기간을 구체적으로 확인해 주세요.';
const response = {
  state: 'COMPLETED',
  answer,
  citations: [],
  sourceCount: 1,
  policy: { outcome: 'ALLOW', mutationAllowed: false },
  conversationId: 'cefaef98-4cf6-46ee-a057-984c5e9c6cc8',
  agentRegistry: { entryKey: 'DWP_APPROVAL_EXPERT' },
  modelRoute: { state: 'COMPLETED', totalTokens: 123, latencyMs: 42 },
} as unknown as AskDwpResponse;
let host: HTMLDivElement;
let root: Root;
const service = hubItem({
  reference: { sourceSystem: 'SERVICE_REQUEST', sourceReference: 'req-1' },
  sourceStatus: 'AWAITING_REQUESTER',
  title: 'VPN 보완 요청',
});
const verifiedAt = new Date().toISOString();
function CurrentRoute() {
  const location = useLocation();
  return (
    <output data-testid="current-route">
      {location.pathname}
      {location.search}
    </output>
  );
}
async function render(props: Partial<WorkHubAssistPanelProps> = {}) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <WorkHubAssistPanel
          item={service}
          verifiedAt={verifiedAt}
          onClose={vi.fn()}
          onSubmit={vi.fn().mockResolvedValue(response)}
          {...props}
        />
        <CurrentRoute />
      </MemoryRouter>
    )
  );
}
async function choosePromptAndSubmit() {
  const prompt = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes('work:workHub.assist.prompts.draft')
  )!;
  await act(async () => prompt.click());
  await act(async () =>
    host
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  );
}

describe('embedded Work AI panel', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });
  it('keeps the result in the Work panel and applies only after an explicit draft action', async () => {
    const apply = vi.fn();
    const submit = vi.fn().mockResolvedValue(response);
    await render({ onDraftApply: apply, onSubmit: submit });
    await choosePromptAndSubmit();
    expect(submit).toHaveBeenCalledOnce();
    expect(host.textContent).toContain(answer);
    expect(apply).not.toHaveBeenCalled();
    const applyButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('work:workHub.assist.applyDraft')
    )!;
    await act(async () => applyButton.click());
    expect(apply).toHaveBeenCalledWith({
      workKey: service.key,
      sourceVersion: service.version,
      message: answer,
    });
    expect(applyButton.disabled).toBe(true);
  });
  it('aborts a previous request and discards its answer when the selected source changes', async () => {
    let resolve!: (response: AskDwpResponse) => void;
    const submit = vi.fn().mockImplementation(
      () =>
        new Promise<AskDwpResponse>((done) => {
          resolve = done;
        })
    );
    await render({ onSubmit: submit });
    await choosePromptAndSubmit();
    const signal = submit.mock.calls[0][1].signal as AbortSignal;
    await render({
      item: { ...service, key: 'another-work', title: '다른 업무' },
      onSubmit: submit,
    });
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response));
    expect(host.textContent).not.toContain(answer);
    expect(host.textContent).toContain('다른 업무');
  });

  it('states when a generated answer has no supplied citations', async () => {
    await render();
    await choosePromptAndSubmit();
    expect(host.textContent).toContain(answer);
    expect(host.textContent).toContain('work:workHub.assist.noCitations');
  });

  it('routes citation navigation through the owning Work handoff callback', async () => {
    const onOpenSource = vi.fn();
    await render({
      onOpenSource,
      onSubmit: vi.fn().mockResolvedValue({
        ...response,
        citations: [
          {
            sourceId: 'approval-evidence',
            sourceType: 'WORK_ITEM',
            title: 'Approval evidence',
            sourceSystem: 'APPROVAL_TASK',
            route: '/approvals/inbox?task=approval-1',
            occurredAt: null,
            excerpt: 'Verified approval evidence',
          },
        ],
      }),
    });
    await choosePromptAndSubmit();
    const citation = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Approval evidence')
    )!;
    await act(async () => citation.click());
    const openSource = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('askPage.citationPreview.openSource')
    )!;
    await act(async () => openSource.click());
    expect(onOpenSource).toHaveBeenCalledWith('/approvals/inbox?task=approval-1');
  });

  it('continues a second question in the persisted selected-work conversation', async () => {
    const submit = vi.fn().mockResolvedValue(response);
    await render({ onSubmit: submit });
    await choosePromptAndSubmit();
    await choosePromptAndSubmit();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[0]?.[1]).not.toHaveProperty('conversationId');
    expect(submit.mock.calls[1]?.[1]).toMatchObject({
      conversationId: response.conversationId,
    });
  });

  it('keeps the persisted conversation when a follow-up transport fails and is retried', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(response);
    await render({ onSubmit: submit });
    await choosePromptAndSubmit();
    await choosePromptAndSubmit();
    const retry = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('common:actions.retry')
    )!;
    await act(async () => retry.click());
    expect(submit).toHaveBeenCalledTimes(3);
    expect(submit.mock.calls[1]?.[1]).toMatchObject({ conversationId: response.conversationId });
    expect(submit.mock.calls[2]?.[1]).toMatchObject({ conversationId: response.conversationId });
  });

  it('keeps a retryable abstained question and exposes the connected input guidance', async () => {
    const abstained = {
      ...response,
      state: 'ABSTAINED',
      statusCode: 'SELECTED_WORK_UNAVAILABLE',
      answer: null,
      conversationId: null,
    } as AskDwpResponse;
    await render({ onSubmit: vi.fn().mockResolvedValue(abstained) });
    await choosePromptAndSubmit();
    expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'work:workHub.assist.prompts.draft'
    );
    expect(host.textContent).toContain('work:workHub.assist.help');
    expect(host.textContent).toContain('work:workHub.assist.outcomes.retryTitle');
    expect(host.textContent).toContain('work:workHub.assist.outcomes.retryDetail');
  });

  it('does not submit a composing IME value and submits it after composition ends', async () => {
    const submit = vi.fn().mockResolvedValue(response);
    await render({ onSubmit: submit });
    const textarea = host.querySelector<HTMLTextAreaElement>('textarea')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )!.set!;
    await act(async () => {
      valueSetter.call(textarea, '현재 업무 요약');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(submit).not.toHaveBeenCalled();
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(submit).toHaveBeenCalledOnce();
  });

  it('does not attach a failed prior conversation handoff to the new work selection', async () => {
    let reject!: (error: Error) => void;
    const onContinue = vi.fn().mockImplementation(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        })
    );
    await render({ onContinue });
    await choosePromptAndSubmit();
    const continueButton = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('work:workHub.assist.continueConversation')
    )!;
    await act(async () => continueButton.click());
    await render({ item: { ...service, key: 'next-work', title: '새로 선택한 업무' }, onContinue });
    await act(async () => reject(new Error('Previous handoff unavailable')));
    expect(host.textContent).toContain('새로 선택한 업무');
    expect(host.textContent).not.toContain('work:workHub.assist.failed');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes('work:workHub.assist.continueConversation')
      )?.disabled
    ).toBe(true);
  });
  it('opens only a persisted conversation and preserves its approval expert', async () => {
    await render();
    const continuation = () =>
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes('work:workHub.assist.continueConversation')
      )!;
    expect(continuation().disabled).toBe(true);
    await choosePromptAndSubmit();
    await act(async () => continuation().click());
    expect(host.querySelector('[data-testid="current-route"]')?.textContent).toBe(
      '/dwaion/conversations/cefaef98-4cf6-46ee-a057-984c5e9c6cc8?agent=DWP_APPROVAL_EXPERT'
    );
  });
  it('aborts and discards a late response when the owning page removes the panel', async () => {
    let resolve!: (response: AskDwpResponse) => void;
    const submit = vi.fn().mockImplementation(
      () =>
        new Promise<AskDwpResponse>((done) => {
          resolve = done;
        })
    );
    await render({ onSubmit: submit });
    await choosePromptAndSubmit();
    const { signal, onProgress } = submit.mock.calls[0][1];
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => {
      onProgress('GENERATING');
      resolve(response);
    });
    expect(host.textContent).not.toContain(answer);
  });
});
