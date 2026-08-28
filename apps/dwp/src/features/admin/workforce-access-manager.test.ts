// @vitest-environment jsdom

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { canRevokeWorkforceAccessPolicy, WorkforceAccessManager } from './workforce-access-manager';

import type { GridColDef } from '@mui/x-data-grid';
import type { WorkforceAccessPolicy } from '@dwp-frontend/shared-utils';

const workforceApi = vi.hoisted(() => ({
  createPolicy: vi.fn(),
  listOrganizations: vi.fn(),
  listPolicies: vi.fn(),
  listUsers: vi.fn(),
  revokePolicy: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  createWorkforceAccessPolicy: workforceApi.createPolicy,
  listIdentityUsers: workforceApi.listUsers,
  listWorkforceAccessPolicies: workforceApi.listPolicies,
  listWorkforcePolicyOrganizations: workforceApi.listOrganizations,
  revokeWorkforceAccessPolicy: workforceApi.revokePolicy,
  useAuth: () => ({ user: { userId: 999 } }),
  useToast: () => ({ error: workforceApi.toastError, success: workforceApi.toastSuccess }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'workforceAccess.create': '접근 정책 만들기',
        'workforceAccess.actions.READ': '데이터 열람',
        'workforceAccess.actions.EXPORT': '데이터 반출',
        'workforceAccess.fieldGroups.DIRECTORY': '기본 프로필',
        'workforceAccess.fieldGroups.WORKER_IDENTIFIERS': '사번·배치 식별정보',
        'workforceAccess.fieldGroups.EMPLOYMENT': '고용·배치 이력',
        'workforceAccess.fieldGroups.JOB_GRADE': '직급·등급',
        'workforceAccess.roles.ADMIN': '통합 관리자',
        'workforceAccess.roleDescriptions.ADMIN': '기존 통합 관리자 정책',
        'workforceAccess.subjectTypes.ROLE': '역할 기본',
        'workforceAccess.references.policyUsersTitle':
          '일부 정책 사용자의 신원을 확인하지 못했습니다',
        'workforceAccess.references.policyUsersError': '디렉터리 조회에 실패했습니다',
        'workforceAccess.references.policyUsersUnresolved': '사용자 정책 1건은 ID로 표시됩니다',
        'workforceAccess.references.retryPolicyUsers': '사용자 신원 다시 불러오기',
        'workforceAccess.noExpiry': '만료일 없음',
        'workforceAccess.error.title': '인력 데이터 접근 정책을 불러오지 못했습니다',
        'workforceAccess.error.description':
          '서비스 연결이 일시적으로 원활하지 않습니다. 기존 접근 정책은 변경되지 않았습니다.',
        'workforceAccess.error.retry': '다시 시도',
      };
      if (key === 'workforceAccess.filters.result') {
        return `${String(values?.total)}개 중 ${String(values?.count)}개`;
      }
      return labels[key] ?? key;
    },
  }),
}));

type ActionButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

type TestGridProps = {
  ariaLabel: string;
  rows: readonly WorkforceAccessPolicy[];
  columns: readonly GridColDef<WorkforceAccessPolicy>[];
};

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children, disabled, onClick, type = 'button' }: ActionButtonProps) =>
    React.createElement('button', { type, disabled, onClick }, children),
  EnterpriseDataGrid: ({ ariaLabel, rows, columns }: TestGridProps) =>
    React.createElement(
      'div',
      { role: 'grid', 'aria-label': ariaLabel },
      rows.map((row) =>
        React.createElement(
          'div',
          { role: 'row', key: row.policyId },
          columns.map((column) =>
            React.createElement(
              'div',
              { role: 'gridcell', key: `${row.policyId}-${column.field}` },
              column.renderCell?.({ row } as never) as React.ReactNode
            )
          )
        )
      )
    ),
  ErrorState: ({
    title,
    description,
    retryLabel,
    onRetry,
  }: {
    title: string;
    description: string;
    retryLabel: string;
    onRetry: () => void;
  }) =>
    React.createElement(
      'div',
      { role: 'alert' },
      React.createElement('h2', null, title),
      React.createElement('p', null, description),
      React.createElement('button', { type: 'button', onClick: onRetry }, retryLabel)
    ),
  FilterBar: ({
    ariaLabel,
    filters,
    resultLabel,
  }: {
    ariaLabel: string;
    filters: React.ReactNode;
    resultLabel: string;
  }) =>
    React.createElement(
      'section',
      { 'aria-label': ariaLabel },
      filters,
      React.createElement('span', null, resultLabel)
    ),
  GuidedEmptyState: ({ title }: { title: string }) => React.createElement('div', null, title),
  LoadingState: ({ label }: { label: string }) =>
    React.createElement('div', { role: 'status' }, label),
  SelectField: ({
    label,
    value,
    options,
    onValueChange,
  }: {
    label: string;
    value: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    onValueChange: (value: string) => void;
  }) =>
    React.createElement(
      'label',
      null,
      label,
      React.createElement(
        'select',
        {
          value,
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange(event.target.value),
        },
        options.map((option) =>
          React.createElement('option', { key: option.value, value: option.value }, option.label)
        )
      )
    ),
}));

vi.mock('./workforce-access-overview', () => ({
  WorkforceAccessOverview: () => null,
}));

vi.mock('./workforce-access-dialogs', () => ({
  WorkforceAccessPolicyDialog: ({ open }: { open: boolean }) =>
    open ? React.createElement('div', { role: 'dialog' }, 'policy-dialog') : null,
  WorkforceAccessRevokeDialog: () => null,
}));

function policy(overrides: Partial<WorkforceAccessPolicy> = {}): WorkforceAccessPolicy {
  return {
    policyId: 'policy-1',
    subjectType: 'ROLE',
    subjectRef: 'HR_ADMIN',
    populationType: 'TENANT',
    fieldGroups: ['DIRECTORY'],
    actionCodes: ['READ'],
    lifecycleState: 'ACTIVE',
    justification: 'Required for workforce administration',
    version: 1,
    ...overrides,
  };
}

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient;

async function mountManager() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await React.act(async () => {
    root?.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(WorkforceAccessManager)
      )
    );
  });
}

function findButton(label: string) {
  return Array.from(container?.querySelectorAll('button') ?? []).find(
    (button) => button.textContent === label
  );
}

describe('WorkforceAccessManager', () => {
  it('allows a scheduled policy to be revoked before it becomes effective', () => {
    expect(
      canRevokeWorkforceAccessPolicy(
        policy({
          validFrom: '2099-01-01T00:00:00Z',
        })
      )
    ).toBe(true);
    expect(canRevokeWorkforceAccessPolicy(policy({ lifecycleState: 'REVOKED' }))).toBe(false);
  });

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    container = null;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    workforceApi.listPolicies.mockReset();
    workforceApi.listOrganizations.mockReset().mockResolvedValue([]);
    workforceApi.listUsers.mockReset().mockResolvedValue({ content: [] });
  });

  afterEach(async () => {
    await React.act(async () => root?.unmount());
    container?.remove();
    queryClient.clear();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('loads references only after the create action opens the policy dialog', async () => {
    workforceApi.listPolicies.mockResolvedValue([policy()]);
    await mountManager();
    await vi.waitFor(() => expect(container?.textContent).toContain('데이터 열람'));

    expect(workforceApi.listPolicies).toHaveBeenCalledTimes(1);
    expect(workforceApi.listOrganizations).not.toHaveBeenCalled();
    expect(workforceApi.listUsers).not.toHaveBeenCalled();

    const createButton = findButton('접근 정책 만들기');
    expect(createButton).toBeDefined();
    await React.act(async () =>
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );

    await vi.waitFor(() => expect(workforceApi.listOrganizations).toHaveBeenCalledTimes(1));
    expect(workforceApi.listUsers).toHaveBeenCalledWith('');
    expect(container?.querySelector('[role="dialog"]')?.textContent).toBe('policy-dialog');
  });

  it('replaces a raw 503 failure with a safe message and recovers through retry', async () => {
    workforceApi.listPolicies
      .mockRejectedValueOnce(new Error('Request failed: 503'))
      .mockResolvedValueOnce([policy()]);
    await mountManager();
    await vi.waitFor(() =>
      expect(container?.textContent).toContain('인력 데이터 접근 정책을 불러오지 못했습니다')
    );

    expect(container?.textContent).toContain(
      '서비스 연결이 일시적으로 원활하지 않습니다. 기존 접근 정책은 변경되지 않았습니다.'
    );
    expect(container?.textContent).not.toContain('Request failed: 503');
    expect(findButton('다시 시도')).toBeDefined();
    expect(workforceApi.listOrganizations).not.toHaveBeenCalled();
    expect(workforceApi.listUsers).not.toHaveBeenCalled();

    await React.act(async () =>
      findButton('다시 시도')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    );
    await vi.waitFor(() => expect(workforceApi.listPolicies).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(container?.textContent).toContain('데이터 열람'));
    expect(container?.textContent).not.toContain('Request failed: 503');
  });

  it('explains read and export actions and labels an open-ended policy', async () => {
    workforceApi.listPolicies.mockResolvedValue([
      policy({ actionCodes: ['READ', 'EXPORT'], validTo: null }),
    ]);
    await mountManager();
    await vi.waitFor(() => expect(container?.textContent).toContain('데이터 반출'));

    expect(container?.textContent).toContain('데이터 열람');
    expect(container?.textContent).toContain('데이터 반출');
    expect(container?.textContent).toContain('만료일 없음');
  });

  it('shows all four permitted data groups without a hidden overflow count', async () => {
    workforceApi.listPolicies.mockResolvedValue([
      policy({
        fieldGroups: ['DIRECTORY', 'WORKER_IDENTIFIERS', 'EMPLOYMENT', 'JOB_GRADE'],
      }),
    ]);
    await mountManager();
    await vi.waitFor(() => expect(container?.textContent).toContain('직급·등급'));

    expect(container?.textContent).toContain('기본 프로필');
    expect(container?.textContent).toContain('사번·배치 식별정보');
    expect(container?.textContent).toContain('고용·배치 이력');
    expect(container?.textContent).toContain('직급·등급');
    expect(container?.textContent).not.toContain('+2');
  });

  it('renders the legacy ADMIN policy with a localized display-only explanation', async () => {
    workforceApi.listPolicies.mockResolvedValue([policy({ subjectRef: 'ADMIN' })]);
    await mountManager();
    await vi.waitFor(() => expect(container?.textContent).toContain('통합 관리자'));

    expect(container?.textContent).toContain('역할 기본 · 기존 통합 관리자 정책');
    expect(container?.textContent).not.toContain('ADMIN');
  });

  it('surfaces unresolved policy users and retries the list identity lookup', async () => {
    workforceApi.listPolicies.mockResolvedValue([
      policy({ subjectType: 'USER', subjectRef: '777' }),
    ]);
    workforceApi.listUsers
      .mockRejectedValueOnce(new Error('Request failed: 503'))
      .mockResolvedValueOnce({ content: [] });
    await mountManager();
    await vi.waitFor(() =>
      expect(container?.textContent).toContain('일부 정책 사용자의 신원을 확인하지 못했습니다')
    );
    expect(container?.textContent).toContain('디렉터리 조회에 실패했습니다');

    await React.act(async () =>
      findButton('사용자 신원 다시 불러오기')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    );
    await vi.waitFor(() => expect(workforceApi.listUsers).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(container?.textContent).toContain('사용자 정책 1건은 ID로 표시됩니다')
    );
  });
});
