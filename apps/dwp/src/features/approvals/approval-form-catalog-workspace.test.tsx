// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalFormCatalogWorkspace,
  type ApprovalFormCatalogPanel,
} from './approval-form-catalog-workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

function Harness({ detailState }: { detailState: string }) {
  const [panel, setPanel] = useState<ApprovalFormCatalogPanel>('categories');
  return (
    <ApprovalFormCatalogWorkspace
      panel={panel}
      onPanelChange={setPanel}
      categories={
        <button role="treeitem" aria-selected="true" onClick={() => setPanel('forms')}>
          Finance
        </button>
      }
      forms={
        <ul>
          <li>
            <button aria-current="true" onClick={() => setPanel('inspector')}>
              Expense request
            </button>
          </li>
        </ul>
      }
      inspector={<div>{detailState}</div>}
    />
  );
}

describe('ApprovalFormCatalogWorkspace mobile focus', () => {
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

  it('moves forward through category, form and stable inspector then restores exact rows', async () => {
    await act(async () => root.render(<Harness detailState="success" />));

    await act(async () => fireEvent.click(getByRole(container, 'treeitem', { name: 'Finance' })));
    const form = getByRole<HTMLButtonElement>(container, 'button', { name: 'Expense request' });
    expect(document.activeElement).toBe(form);

    await act(async () => fireEvent.click(form));
    const inspector = getByRole<HTMLElement>(container, 'region', {
      name: 'admin.formCatalog.mobile.inspector',
    });
    expect(document.activeElement).toBe(inspector);

    await act(async () => root.render(<Harness detailState="403" />));
    expect(document.activeElement).toBe(inspector);
    await act(async () => root.render(<Harness detailState="503" />));
    expect(document.activeElement).toBe(inspector);

    await act(async () =>
      fireEvent.click(
        getByRole(container, 'button', { name: 'admin.formCatalog.mobile.backToForms' })
      )
    );
    expect(document.activeElement).toBe(form);

    await act(async () =>
      fireEvent.click(
        getByRole(container, 'button', { name: 'admin.formCatalog.categories.title' })
      )
    );
    expect(document.activeElement).toBe(getByRole(container, 'treeitem', { name: 'Finance' }));
  });
});
