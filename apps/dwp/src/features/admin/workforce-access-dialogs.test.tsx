// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkforceAccessPolicyDialog } from './workforce-access-dialogs';

import type { CreateWorkforceAccessPolicyRequest } from '@dwp-frontend/shared-utils';

const dialog = vi.hoisted(() => ({ submit: null as null | (() => Promise<void>) }));

vi.mock('@dwp-frontend/design-system', async () => {
  const { createElement } = await import('react');
  return {
    ActionButton: ({ children }: { children: ReactNode }) =>
      createElement('button', null, children),
    AutocompleteField: () => null,
    DateTimePickerField: () => null,
    FormDialog: ({
      children,
      onSubmit,
      open,
    }: {
      children: ReactNode;
      onSubmit: () => Promise<void>;
      open: boolean;
    }) => {
      dialog.submit = open ? onSubmit : null;
      return open ? createElement('div', { role: 'dialog' }, children) : null;
    },
    FormField: () => null,
    SelectField: () => null,
  };
});

vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'workforceAccess.fieldGroups.ORGANIZATION' ? '조직·포지션' : key),
  }),
}));

let container: HTMLDivElement;
let root: Root;

function fieldGroupCheckbox(label: string) {
  return Array.from(container.querySelectorAll('label'))
    .find((element) => element.textContent === label)
    ?.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  dialog.submit = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
});

describe('WorkforceAccessPolicyDialog field groups', () => {
  it('offers ORGANIZATION independently and serializes it without exceeding four groups', async () => {
    const onSave = vi.fn<(request: CreateWorkforceAccessPolicyRequest) => Promise<void>>();
    onSave.mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        createElement(WorkforceAccessPolicyDialog, {
          open: true,
          busy: false,
          organizationsLoading: false,
          organizationsError: false,
          usersLoading: false,
          usersError: false,
          users: [],
          userQuery: '',
          organizations: [],
          onUserQueryChange: vi.fn(),
          onRetryOrganizations: vi.fn(),
          onRetryUsers: vi.fn(),
          onClose: vi.fn(),
          onSave,
        })
      );
    });

    const organization = fieldGroupCheckbox('조직·포지션');
    expect(organization).toBeDefined();
    expect(organization?.disabled).toBe(false);

    await act(async () => organization?.click());
    await act(async () =>
      fieldGroupCheckbox('workforceAccess.fieldGroups.WORKER_IDENTIFIERS')?.click()
    );

    expect(fieldGroupCheckbox('workforceAccess.fieldGroups.JOB_GRADE')?.disabled).toBe(true);
    await act(async () => dialog.submit?.());

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldGroups: ['DIRECTORY', 'EMPLOYMENT', 'ORGANIZATION', 'WORKER_IDENTIFIERS'],
      })
    );
  });
});
