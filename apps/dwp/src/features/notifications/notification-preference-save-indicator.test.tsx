// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationPreferenceSaveIndicator } from './notification-preference-save-indicator';

const runtime = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  useToast: () => runtime.toast,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'preferences.save.error': 'Save failed',
        'actions.retry': 'Try again',
        'actions.copySupportId': 'Copy support ID',
        'support.idLabel': 'Support ID',
        'feedback.supportIdCopied': 'Support ID copied.',
        'feedback.supportIdCopyFailed': 'Support ID copy failed.',
      })[key] ?? key,
  }),
}));

const containers: HTMLElement[] = [];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  runtime.toast.success.mockReset();
  runtime.toast.error.mockReset();
});

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

describe('NotificationPreferenceSaveIndicator', () => {
  it('offers an explicit retry for a preserved failed draft and disables it offline', async () => {
    const container = document.createElement('div');
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);
    const onRetry = vi.fn();

    await act(async () => {
      root.render(
        <NotificationPreferenceSaveIndicator
          state="error"
          error={{ headers: new Headers({ 'X-Correlation-ID': 'save-correlation-123' }) }}
          onRetry={onRetry}
          retryDisabled={false}
        />
      );
    });
    const retry = getByRole(container, 'button', { name: 'Try again' });
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(getByRole(container, 'button', { name: 'Copy support ID' })).toBeTruthy();

    await act(async () => {
      root.render(
        <NotificationPreferenceSaveIndicator state="error" onRetry={onRetry} retryDisabled />
      );
    });
    expect(
      (getByRole(container, 'button', { name: 'Try again' }) as HTMLButtonElement).disabled
    ).toBe(true);

    await act(async () => root.unmount());
  });

  it('does not offer the profile retry for a row-level rule failure', async () => {
    const container = document.createElement('div');
    containers.push(container);
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <NotificationPreferenceSaveIndicator
          state="error"
          error={{ headers: new Headers({ 'X-Correlation-ID': 'rule-correlation-456' }) }}
          retryDisabled={false}
        />
      );
    });

    expect(queryByRole(container, 'button', { name: 'Try again' })).toBeNull();
    expect(getByRole(container, 'button', { name: 'Copy support ID' })).toBeTruthy();

    await act(async () => root.unmount());
  });
});
