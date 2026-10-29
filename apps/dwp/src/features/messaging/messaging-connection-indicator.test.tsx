// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagingConnectionIndicator } from './messaging-connection-indicator';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MessagingConnectionIndicator', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it.each(['live', 'reconnecting', 'offline'] as const)(
    'keeps the %s state as visible text',
    async (state) => {
      await act(async () => root.render(<MessagingConnectionIndicator state={state} />));

      const indicator = host.querySelector('[data-testid="messaging-connection-indicator"]');
      expect(indicator?.textContent).toContain(`conversation.connection.${state}`);
      const label = indicator?.querySelector<HTMLElement>('.MuiChip-label');
      expect(label).not.toBeNull();
      expect(window.getComputedStyle(label!).maxWidth).not.toBe('0px');
    }
  );
});
