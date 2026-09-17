// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DwaionResearchDeliveryDialog } from './dwaion-research-delivery-dialog';

let root: Root;
let host: HTMLDivElement;
type DeliverySubmit = (type: 'HANDOFF' | 'SHARE', parameters: Record<string, unknown>) => void;

describe('DwaionResearchDeliveryDialog', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it('requires approval target, request metadata, and reason before handoff', async () => {
    const submit = vi.fn<DeliverySubmit>();
    await renderDialog('HANDOFF', submit);

    expect(document.body.textContent).toContain('결재 대상 또는 승인 그룹');
    expect(document.body.textContent).toContain('결재 요청 제목');
    expect(document.body.textContent).toContain('인계 사유와 요청 내용');
    expect(document.body.textContent).toContain('요청 메타데이터');

    await clickButton('결재 인계 요청');
    expect(submit).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('필수 대상과 요청 정보를 올바르게 입력하세요.');
  });

  it('collects recipients, team, permission, and expiry for sharing', async () => {
    await renderDialog('SHARE', vi.fn<DeliverySubmit>());

    expect(document.body.textContent).toContain('수신자 ID');
    expect(document.body.textContent).toContain('팀 ID');
    expect(document.body.textContent).toContain('공유 권한');
    expect(document.body.textContent).toContain('공유 만료 시각');
    expect(document.body.textContent).toContain('90일 이내');
  });
});

async function renderDialog(type: 'HANDOFF' | 'SHARE', onSubmit: DeliverySubmit) {
  await act(async () => {
    root.render(
      <DwaionResearchDeliveryDialog
        open
        type={type}
        locale="ko"
        runId="00000000-0000-4000-8000-000000000901"
        suggestedTitle="시장 조사 결과 검토"
        busy={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
  });
}

async function clickButton(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button).toBeDefined();
  await act(async () => button?.click());
}
