import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentDialog, type ContentDialogProps } from './content-dialog';

let container: HTMLDivElement;
let root: Root;

async function renderDialog(overrides: Partial<ContentDialogProps> = {}) {
  await act(async () => {
    root.render(
      <ContentDialog
        open
        title="Execution signals"
        description="Visible execution ledger scope"
        closeLabel="Close execution signals"
        onClose={vi.fn()}
        {...overrides}
      >
        <p>Current execution details</p>
      </ContentDialog>
    );
  });
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  return dialog!;
}

function referencedNodes(dialog: HTMLElement, attribute: string) {
  return (dialog.getAttribute(attribute) ?? '')
    .split(/\s+/u)
    .filter(Boolean)
    .map((id) => document.getElementById(id));
}

describe('ContentDialog accessible title and description contract', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('links the dialog name to one title without description or close-button text', async () => {
    const dialog = await renderDialog();
    const titles = referencedNodes(dialog, 'aria-labelledby');
    expect(titles).toHaveLength(1);
    expect(titles[0]?.tagName).toBe('H2');
    expect(titles[0]?.textContent).toBe('Execution signals');
    expect(titles[0]?.querySelector('button')).toBeNull();
    expect(dialog.querySelectorAll('h2')).toHaveLength(1);
    expect(dialog.querySelector('h2 h2')).toBeNull();
    expect(dialog.querySelector('.MuiDialogTitle-root')?.tagName).toBe('DIV');
    const ids = [...dialog.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links its optional description to a separate unique element', async () => {
    const dialog = await renderDialog();
    const descriptions = referencedNodes(dialog, 'aria-describedby');
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0]?.textContent).toBe('Visible execution ledger scope');
    expect(descriptions[0]?.id).not.toBe(referencedNodes(dialog, 'aria-labelledby')[0]?.id);
  });

  it('does not create a dangling description reference when no description is provided', async () => {
    const dialog = await renderDialog({ description: undefined });
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(referencedNodes(dialog, 'aria-labelledby')[0]?.textContent).toBe('Execution signals');
  });

  it('preserves a resolvable accessible name when the visible header is hidden', async () => {
    const dialog = await renderDialog({ hideHeader: true });
    expect(dialog.querySelector('.MuiDialogTitle-root')).toBeNull();
    expect(dialog.querySelector('h2')).toBeNull();
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(referencedNodes(dialog, 'aria-labelledby')).toHaveLength(1);
    expect(referencedNodes(dialog, 'aria-labelledby')[0]?.textContent).toBe('Execution signals');
    expect(dialog.textContent).toContain('Current execution details');
    const ids = [...dialog.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
