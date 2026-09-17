import { act } from 'react';
import { createRoot } from 'react-dom/client';

import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export type AdminV2TestHarness = {
  node: HTMLDivElement;
  render: (content: ReactNode) => Promise<void>;
  destroy: () => Promise<void>;
};

export function createAdminV2TestHarness(): AdminV2TestHarness {
  const node = document.createElement('div');
  document.body.append(node);
  const root: Root = createRoot(node);
  return {
    node,
    render: async (content) => {
      await act(async () => root.render(content));
    },
    destroy: async () => {
      await act(async () => root.unmount());
      node.remove();
    },
  };
}
