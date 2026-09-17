// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalFormBuilderDialog } from './approval-form-builder-dialog';
import { emptyFormDraft } from './approval-form-catalog-drafts';

import type { FormDraft } from './approval-form-catalog-drafts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

function Harness() {
  const [draft, setDraft] = useState<FormDraft>(emptyFormDraft());
  return (
    <ApprovalFormBuilderDialog
      open
      creating
      draft={draft}
      categories={[]}
      workflows={[]}
      valid={false}
      busy={false}
      sourceConflict={false}
      readRetrying={false}
      onRefresh={() => undefined}
      onChange={setDraft}
      onClose={() => undefined}
      onSave={() => undefined}
    />
  );
}

describe('ApprovalFormBuilderDialog legacy mobile focus', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('focuses the first editable property and restores the exact legacy field row', async () => {
    await act(async () => root.render(<Harness />));
    const dialog = getByRole(document.body, 'dialog');

    await act(async () =>
      fireEvent.click(getByRole(dialog, 'button', { name: /Request summary/u }))
    );
    expect(document.activeElement).toBe(
      dialog.querySelector('[data-approval-field-property="key"]')
    );

    await act(async () =>
      fireEvent.click(getByRole(dialog, 'button', { name: 'admin.studio.formFields' }))
    );
    expect(document.activeElement).toBe(dialog.querySelector('[data-approval-legacy-field="0"]'));

    await act(async () =>
      fireEvent.click(getByRole(dialog, 'button', { name: /Request summary/u }))
    );
    await act(async () =>
      fireEvent.click(getAllByRole(dialog, 'button', { name: 'admin.studio.addField' })[0])
    );
    expect(document.activeElement).toBe(
      dialog.querySelector('[data-approval-field-property="key"]')
    );
  });
});
