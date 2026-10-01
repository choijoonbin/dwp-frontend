// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAIControlOverview, HttpError } from '@dwp-frontend/shared-utils';

import { DwaionAIRuntimeControl } from './dwaion-ai-runtime-control';

const translations: Record<string, string> = {
  'dwaionAdmin.aiRuntime.eyebrow': 'AI 실행 통제 · S19',
  'dwaionAdmin.aiRuntime.title': '모델·지식·사용량과 예산 집행',
  'dwaionAdmin.aiRuntime.description': '회사별 실행 경계를 관리합니다.',
  'dwaionAdmin.aiRuntime.loadError': 'AI 실행 통제를 불러오지 못했습니다',
  'dwaionAdmin.aiRuntime.loadErrorDescription': '연결과 권한을 확인하세요.',
  'dwaionAdmin.aiRuntime.rolloutUnavailable.title': 'DWAI·ON 롤아웃 미활성 · 사용 불가',
  'dwaionAdmin.aiRuntime.rolloutUnavailable.description':
    'Provider 운영자가 maker-checker 승인으로 롤아웃을 활성화한 뒤 Agent 권한 v21 준비 상태를 켜고 회사 AI 실행 정책을 초기화해야 합니다.',
  'dwaionAdmin.shared.retry': '다시 시도',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: { resolvedLanguage: 'ko', language: 'ko' },
  }),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAIControlOverview: vi.fn(),
  usePermissions: () => ({ hasPermission: () => true }),
}));

vi.mock('../../components/use-dwaion-governed-mutation', () => ({
  useDwaionGovernedMutation: () => vi.fn(),
}));

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

describe('DWAI-ON AI runtime control unavailable presentation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.mocked(getAIControlOverview).mockReset();
    client = new QueryClient();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('renders the governed rollout recovery instead of a generic load error', async () => {
    vi.mocked(getAIControlOverview).mockRejectedValue(
      new HttpError('Request failed: 503', 503, {
        detail: {
          errorCode: 'AI_CONTROL_ROLLOUT_UNAVAILABLE',
          message: 'Trusted AI control rollout evidence is missing or invalid.',
        },
      })
    );

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DwaionAIRuntimeControl />
        </QueryClientProvider>
      );
    });
    await act(async () => {
      await vi.waitFor(() =>
        expect(client.getQueryState(['dwaion', 'admin', 'ai-runtime-control'])?.status).toBe(
          'error'
        )
      );
    });

    const state = host.querySelector('[data-ai-runtime-control-state="rollout-unavailable"]');
    expect(state).not.toBeNull();
    expect(state?.getAttribute('role')).not.toBe('progressbar');
    expect(state?.textContent).toContain('DWAI·ON 롤아웃 미활성 · 사용 불가');
    expect(state?.textContent).toContain('maker-checker');
    expect(state?.textContent).toContain('v21');
    expect(state?.textContent).toContain('회사 AI 실행 정책을 초기화');
    expect(state?.textContent).not.toContain('AI 실행 통제를 불러오지 못했습니다');
    expect(getAIControlOverview).toHaveBeenCalledTimes(1);
  });
});
