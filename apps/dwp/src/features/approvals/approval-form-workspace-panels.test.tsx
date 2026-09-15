// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByLabelText, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApprovalFormVersionHistory,
  ApprovalFormVersionBranchDialog,
} from './approval-form-version-history';
import { ApprovalFormVersionDiff } from './approval-form-version-diff';
import { ApprovalFormWorkspaceReviewDialog } from './approval-form-workspace-review-dialog';
import { ApprovalFormWorkspaceReadOnlyDraftDialog } from './approval-form-availability-dialog';
import { approvalFormWorkingDraftEditor } from './approval-form-workspace-model';
import {
  workspaceFixture,
  reviewFixture,
  diffFixture,
  publishedId,
} from './approval-form-workspace.test-support';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'ko', language: 'ko' },
  }),
}));
let root: Root;
let container: HTMLDivElement;
const render = async (node: ReactNode) => {
  await act(async () => {
    root.render(node);
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
};
describe('real DS form workspace views', () => {
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
  it('retains readonly truncated history and selects actual version UUIDs', async () => {
    const source = workspaceFixture();
    const select = vi.fn();
    const branch = vi.fn();
    await render(
      <ApprovalFormVersionHistory
        history={{ versions: [source.published!, source.workingDraft!], mayBeTruncated: true }}
        state="READY"
        selectedId={publishedId}
        onSelect={select}
        onReload={() => {}}
        onBranch={branch}
        branchReady={false}
      />
    );
    expect(container.textContent).toContain('admin.formWorkspace.historyPartial');
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(1);
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: /v2/u })));
    expect(select).toHaveBeenCalledWith(source.workingDraft!.formVersionId);
    expect(
      getByRole<HTMLButtonElement>(container, 'button', { name: 'admin.formWorkspace.branch' })
        .disabled
    ).toBe(true);
    expect(branch).not.toHaveBeenCalled();
  });
  it('masks denied retained version/hash and semantic diffs', async () => {
    const source = workspaceFixture();
    await render(
      <ApprovalFormVersionHistory
        history={{ versions: [source.published!], mayBeTruncated: false }}
        state="DENIED"
        selectedId={null}
        onSelect={() => {}}
        onReload={() => {}}
        onBranch={() => {}}
        branchReady={false}
      />
    );
    expect(container.textContent).not.toContain(source.published!.schemaSha256.slice(0, 12));
    await render(<ApprovalFormVersionDiff state="DENIED" diff={diffFixture()} />);
    expect(container.textContent).not.toContain('/metadata/nameEn');
  });
  it('renders actual deletions/provenance and incomplete comparisons without a fake affected summary', async () => {
    await render(
      <ApprovalFormVersionDiff
        state="READY"
        diff={{
          ...diffFixture(),
          complete: false,
          changes: [{ path: '/schema/fields/oldField', before: 'Old field', after: null }],
        }}
      />
    );
    expect(container.textContent).toContain('admin.formWorkspace.diffPartial');
    expect(container.textContent).toContain('admin.formWorkspace.unrecordedMetadata');
    expect(container.textContent).toContain('/schema/fields/oldField');
    expect(container.textContent).toContain('Old field');
    expect(container.querySelector('textarea')).toBeNull();
  });
  it('expired or denied reviews cannot publish and denied data is masked', async () => {
    const confirm = vi.fn();
    const props = {
      open: true,
      review: reviewFixture(),
      state: 'READY' as const,
      ready: false,
      expired: true,
      busy: false,
      onClose: () => {},
      onConfirm: confirm,
      onReject: vi.fn(),
    };
    await render(<ApprovalFormWorkspaceReviewDialog {...props} />);
    const dialog = getByRole(document.body, 'dialog', { name: 'admin.formWorkspace.review' });
    expect(dialog.textContent).toContain('admin.formWorkspace.reviewExpired');
    const submit = getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.publish' });
    expect(submit.disabled).toBe(true);
    await act(async () => fireEvent.click(submit));
    expect(confirm).not.toHaveBeenCalled();
    await render(<ApprovalFormWorkspaceReviewDialog {...props} state="DENIED" />);
    expect(getByRole(document.body, 'dialog').textContent).not.toContain(
      reviewFixture().reviewContentDigest
    );
  });
  it('source failures preserve disabled user input with actual reload and no JSON editor/save', async () => {
    const draft = approvalFormWorkingDraftEditor(workspaceFixture(), 'EXPENSE')!;
    const reload = vi.fn();
    await render(
      <ApprovalFormWorkspaceReadOnlyDraftDialog
        open
        draft={{ ...draft, nameEn: 'Preserved private edit' }}
        unknown
        onClose={() => {}}
        onReload={reload}
      />
    );
    const dialog = getByRole(document.body, 'dialog');
    const name = getByLabelText<HTMLInputElement>(dialog, 'admin.studio.nameEn');
    expect(name.value).toBe('Preserved private edit');
    expect(name.disabled).toBe(true);
    expect(getByRole<HTMLButtonElement>(dialog, 'button', { name: 'actions.save' }).disabled).toBe(
      true
    );
    await act(async () =>
      fireEvent.click(getByRole(dialog, 'button', { name: 'admin.formWorkspace.reload' }))
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(name.value).toBe('Preserved private edit');
  });
  it('branch confirmation shows the captured source hash and cannot proceed after source changes', async () => {
    const confirm = vi.fn();
    await render(
      <ApprovalFormVersionBranchDialog
        open
        version={workspaceFixture().published!}
        replacing
        busy={false}
        ready={false}
        onClose={() => {}}
        onConfirm={confirm}
      />
    );
    const dialog = getByRole(document.body, 'dialog');
    expect(dialog.textContent).toContain(workspaceFixture().published!.schemaSha256);
    expect(dialog.textContent).toContain('admin.formWorkspace.replaceWorkingDraft');
    expect(
      getByRole<HTMLButtonElement>(dialog, 'button', { name: 'admin.formWorkspace.branch' })
        .disabled
    ).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
