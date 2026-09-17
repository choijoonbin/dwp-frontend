// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByText, waitFor, within } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const { getCandidates } = vi.hoisted(() => ({ getCandidates: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getMailSharedInboxMemberCandidates: getCandidates,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

import { MailSharedInboxMemberEditor } from './mail-admin-operations-a03';

import type { MailSharedInboxAccess } from './mail-admin-operations-model';

const access: MailSharedInboxAccess = {
  sharedInboxId: 'shared-1',
  version: 4,
  providerState: 'APPLIED',
  members: [
    {
      memberId: 'member-1',
      userId: 10,
      displayName: 'Existing Person',
      department: 'Finance',
      state: 'ACTIVE',
      permissions: { read: true, sendAs: false, sendOnBehalf: false, assign: false, manage: false },
      providerState: 'APPLIED',
      version: 1,
    },
  ],
};

describe('A03 tenant people member picker', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    getCandidates.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    document.body.replaceChildren();
  });

  async function renderEditor(onSave = vi.fn()) {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MailSharedInboxMemberEditor
            open
            access={access}
            member={null}
            busy={false}
            onClose={vi.fn()}
            onSave={onSave}
          />
        </QueryClientProvider>
      )
    );
    return { dialog: getByRole(document.body, 'dialog', { name: 'Add member' }), onSave };
  }

  it('shows delayed lookup, disables duplicates, and saves only a verified selection', async () => {
    let resolve!: (value: unknown[]) => void;
    getCandidates.mockReturnValue(
      new Promise((next) => {
        resolve = next;
      })
    );
    const { dialog, onSave } = await renderEditor();
    await act(async () =>
      fireEvent.change(
        within(dialog).getByRole('textbox', { name: 'Search people in this tenant' }),
        {
          target: { value: 'pe' },
        }
      )
    );
    expect(queryByText(dialog, 'Searching the tenant directory…')).not.toBeNull();

    await act(async () =>
      resolve([
        {
          userId: 10,
          displayName: 'Existing Person',
          department: 'Finance',
          email: 'existing@example.com',
        },
        { userId: 11, displayName: 'New Person', department: 'Legal', email: 'new@example.com' },
      ])
    );
    await waitFor(() =>
      expect(
        (within(dialog).getByRole('option', { name: /Existing Person/u }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    );
    const duplicate = within(dialog).getByRole('option', { name: /Existing Person/u });
    expect((duplicate as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('option', { name: /New Person/u }));
    fireEvent.click(
      within(dialog).getByRole('checkbox', {
        name: /I reviewed assignment, draft, pending command, and provider revocation impact/u,
      })
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'actions.save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 11, displayName: 'New Person', version: 4 })
    );
  });

  it('fails closed when tenant people lookup is denied', async () => {
    getCandidates.mockRejectedValue(new Error('403'));
    const { dialog, onSave } = await renderEditor();
    await act(async () =>
      fireEvent.change(
        within(dialog).getByRole('textbox', { name: 'Search people in this tenant' }),
        {
          target: { value: 'mi' },
        }
      )
    );
    await waitFor(() =>
      expect(
        queryByText(dialog, 'Verified people could not be loaded. Member changes remain blocked.')
      ).not.toBeNull()
    );
    expect(
      (within(dialog).getByRole('button', { name: 'actions.save' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
