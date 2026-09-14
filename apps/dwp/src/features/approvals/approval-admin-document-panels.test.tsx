// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalAdminDocumentPolicy } from './approval-admin-document-policy';
import { ApprovalAdminDocumentHold } from './approval-admin-document-hold';
import type {
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
  ApprovalDocumentRules,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
const rules: ApprovalDocumentRules = {
  allowComments: true,
  allowPrint: false,
  allowJsonExport: false,
  allowArchiveExport: false,
  includeComments: false,
  includeEvidence: false,
  allowedClassifications: [],
  fields: [],
  maxBatchItems: 20,
  maxBytes: 1048576,
  snapshotTtlSeconds: 300,
  evidenceRetentionDays: 365,
};
const policy: ApprovalDocumentPolicy = {
  policyId: '11111111-1111-1111-1111-111111111111',
  version: 2,
  resourceSetKey: 'ALL',
  published: {
    revision: 0,
    rules,
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
};
const hold: ApprovalDocumentHold = {
  requestId: '22222222-2222-2222-2222-222222222222',
  version: 3,
  active: false,
  pending: null,
  journal: [],
  purgeState: 'PURGE_WORKER_NOT_IMPLEMENTED',
  retainUntil: '2027-09-14T00:00:00Z',
  preservationPending: false,
  purgeEligible: false,
};
let root: Root;
let container: HTMLDivElement;
const settle = async (callback: () => void) => {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};
const fill = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await settle(() => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    fireEvent.input(input, { bubbles: true });
  });
};

describe('actual document admin panels', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('uses actual DS binary and allowlist controls and API validation before save', async () => {
    const save = vi.fn();
    let currentRules = rules;
    function Editor() {
      const [value, setValue] = useState(rules);
      currentRules = value;
      return (
        <ApprovalAdminDocumentPolicy
          policy={policy}
          canEdit
          canPublish={false}
          makerBlocked
          busy={false}
          refreshing={false}
          draft={{
            policyId: policy.policyId,
            expectedVersion: 2,
            idempotencyKey: 'original',
            rules: value,
          }}
          draftReady
          onEdit={() => {}}
          onChange={setValue}
          onClose={() => {}}
          onSave={save}
          onPublish={() => false}
          onRefresh={() => {}}
        />
      );
    }
    await settle(() => root.render(<Editor />));
    const dialog = getByRole(document.body, 'dialog', { name: 'admin.document.edit' });
    const submit = getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.save' });
    expect(
      (getByLabelText(dialog, 'admin.document.allowJsonExport') as HTMLInputElement).checked
    ).toBe(false);
    await settle(() => fireEvent.click(getByLabelText(dialog, 'admin.document.allowJsonExport')));
    expect(submit.disabled).toBe(true);
    await settle(() => fireEvent.click(getByLabelText(dialog, 'classification.INTERNAL')));
    expect(submit.disabled).toBe(false);
    await settle(() =>
      fireEvent.click(getByRole(dialog, 'button', { name: 'admin.document.addField' }))
    );
    expect(currentRules.fields).toEqual([
      { key: 'field_1', type: 'STRING', maxLength: 1000, maxRows: null, children: [] },
    ]);
    await settle(() => fireEvent.click(submit));
    expect(save).toHaveBeenCalledTimes(1);
    expect(rules.fields).toEqual([]);
    expect(rules.allowJsonExport).toBe(false);
  });

  it('hold proposal preserves input through dispatch and source rejection, then closes only on verified completion', async () => {
    const propose = vi.fn(() => true);
    let canEdit = true;
    let completed = 0;
    const render = () =>
      root.render(
        <ApprovalAdminDocumentHold
          hold={hold}
          input={hold.requestId}
          selectedId={hold.requestId}
          loading={false}
          unavailable={false}
          busy={false}
          canRead
          canEdit={canEdit}
          canPublish={false}
          makerBlocked
          completedProposals={completed}
          onInput={() => {}}
          onLookup={() => {}}
          onRefresh={() => {}}
          onPropose={propose}
          onPublish={() => false}
        />
      );
    await settle(render);
    await settle(() =>
      fireEvent.click(getByRole(container, 'button', { name: 'admin.document.place' }))
    );
    const dialog = getByRole(document.body, 'dialog', { name: 'admin.document.place' });
    const input = getByLabelText<HTMLTextAreaElement>(dialog, 'admin.document.reason');
    await fill(input, 'Preserve this approval evidence');
    await settle(() => fireEvent.click(getByRole(dialog, 'button', { name: 'actions.save' })));
    expect(propose).toHaveBeenCalledWith('PLACE', 'Preserve this approval evidence', 3);
    expect(queryByRole(document.body, 'dialog', { name: 'admin.document.place' })).not.toBeNull();
    canEdit = false;
    await settle(render);
    expect(input.value).toBe('Preserve this approval evidence');
    expect(input.disabled).toBe(true);
    expect(getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.save' }).disabled).toBe(
      true
    );
    expect(propose).toHaveBeenCalledTimes(1);
    completed = 1;
    await settle(render);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(queryByRole(document.body, 'dialog', { name: 'admin.document.place' })).toBeNull();
  });
});
