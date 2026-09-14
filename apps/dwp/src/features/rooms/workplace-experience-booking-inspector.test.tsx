// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { WorkplaceExperienceBookingInspector } from './workplace-experience-booking-inspector';

const api = vi.hoisted(() => ({ detail: vi.fn(), cancel: vi.fn(), impact: vi.fn() }));
const controls = vi.hoisted(() => ({
  submit: () => {},
  reason: (_event: { target: { value: string } }) => {},
  confirm: (_event: { target: { checked: boolean } }) => {},
}));
vi.mock('@dwp-frontend/shared-utils', async () => ({
  HttpError: (await import('@dwp-frontend/shared-utils/http-error')).HttpError,
  getWorkplaceExperienceBookingDetail: api.detail,
  getWorkplaceFutureBookingImpact: api.impact,
  forceCancelWorkplaceBooking: api.cancel,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./workplace-experience-authority', () => ({
  useWorkplaceExperienceAuthority: () => 'trusted-authority',
}));
vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canManageWorkplaceAdmin: true,
  }),
}));
vi.mock('./workplace-experience-format', () => ({
  formatWorkplaceExperienceInstant: (value: string) => value,
}));
vi.mock('./workplace-experience-ui', async () => {
  const { createElement: element } = await import('react');
  return {
    WorkplaceExperiencePanel: ({ children }: { children: ReactNode }) =>
      element('section', null, children),
    WorkplaceExperienceQueryError: () => element('div', null, 'read-error'),
  };
});
vi.mock('@mui/material/Checkbox', async () => {
  const { createElement: element } = await import('react');
  return {
    default: (props: {
      checked: boolean;
      disabled: boolean;
      onChange: typeof controls.confirm;
    }) => {
      controls.confirm = props.onChange;
      return element('input', {
        type: 'checkbox',
        checked: props.checked,
        disabled: props.disabled,
        onChange: props.onChange,
      });
    },
  };
});
vi.mock('@dwp-frontend/design-system', async () => {
  const { createElement: element } = await import('react');
  return {
    foundationTokens: { radius: { control: 8 } },
    LoadingState: () => element('div', null, 'loading'),
    EmptyState: () => element('div', null, 'empty'),
    InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) =>
      element('div', null, children, action),
    ActionButton: ({
      children,
      onClick,
      disabled,
    }: {
      children: ReactNode;
      onClick: () => void;
      disabled: boolean;
    }) => element('button', { onClick, disabled }, children),
    FormField: (props: {
      label: string;
      value: string;
      disabled: boolean;
      onChange: typeof controls.reason;
    }) => {
      controls.reason = props.onChange;
      return element('input', {
        'aria-label': props.label,
        value: props.value,
        disabled: props.disabled,
        onChange: props.onChange,
      });
    },
    FormDialog: (props: {
      open: boolean;
      children: ReactNode;
      showSubmit: boolean;
      submitDisabled: boolean;
      busy: boolean;
      onSubmit: () => void;
      submitLabel: string;
    }) => {
      controls.submit = props.onSubmit;
      return props.open
        ? element(
            'div',
            { role: 'dialog' },
            props.children,
            props.showSubmit
              ? element(
                  'button',
                  { disabled: props.busy || props.submitDisabled, onClick: props.onSubmit },
                  props.submitLabel
                )
              : null
          )
        : null;
    },
  };
});

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const onClose = vi.fn();
const bookingId = 'booking-original';
const detail = (version: number) => ({
  bookingId,
  resourceId: 'desk-original',
  resourceName: 'Authorized desk',
  floorName: 'Authorized floor',
  status: 'RESERVED',
  startsAt: '2026-09-14T00:00:00Z',
  endsAt: '2026-09-14T01:00:00Z',
  legalHold: false,
  version,
});
const render = async (id: string | null) => {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(WorkplaceExperienceBookingInspector, {
          siteId: 'site-original',
          bookingId: id,
          onClose,
        })
      )
    );
  });
};
const confirm = async (reason: string) => {
  await act(async () => {
    controls.reason({ target: { value: reason } });
  });
  await act(async () => {
    controls.confirm({ target: { checked: true } });
  });
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.detail.mockResolvedValue(detail(5));
  api.impact.mockResolvedValue({ affectedBookings: null });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

it('captures one original command and discards its late 409 after the same booking is reopened', async () => {
  let rejectOriginal!: (error: unknown) => void;
  api.cancel.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectOriginal = reject;
      })
  );
  await render(bookingId);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await confirm('Original approved reason');
  await act(async () => {
    controls.submit();
    controls.submit();
  });
  expect(api.cancel).toHaveBeenCalledTimes(1);
  expect(api.cancel).toHaveBeenNthCalledWith(1, bookingId, 5, 'Original approved reason');
  await render(null);
  api.detail.mockResolvedValue(detail(6));
  await render(bookingId);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector('input')?.value).toBe('');
  await confirm('Reopened approved reason');
  await act(async () => {
    controls.submit();
  });
  expect(api.cancel).toHaveBeenCalledTimes(1);
  await act(async () => {
    rejectOriginal(new HttpError('Original version changed', 409));
  });
  expect(container.textContent).not.toContain('workplace.experience.conflict');
  expect(container.querySelector('input')?.value).toBe('Reopened approved reason');
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  api.cancel.mockResolvedValueOnce(undefined);
  await act(async () => {
    controls.submit();
  });
  expect(api.cancel).toHaveBeenCalledTimes(2);
  expect(api.cancel).toHaveBeenNthCalledWith(2, bookingId, 6, 'Reopened approved reason');
  expect(onClose).toHaveBeenCalledTimes(1);
});
