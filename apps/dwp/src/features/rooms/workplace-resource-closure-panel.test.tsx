// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { WorkplaceResourceClosurePanel } from './workplace-resource-closure-panel';

const api = vi.hoisted(() => ({
  resources: vi.fn(),
  closures: vi.fn(),
  detail: vi.fn(),
  impact: vi.fn(),
  roomImpact: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
}));
const state = vi.hoisted(() => ({
  read: true,
  manage: true,
  error: false,
  revision: 1,
  create: true,
}));
const controls = vi.hoisted(() => ({
  reason: (_event: { target: { value: string } }) => {},
  confirm: (_event: { target: { checked: boolean } }) => {},
  buttons: new Map<string, () => void>(),
}));
vi.mock('@dwp-frontend/shared-utils', async () => ({
  HttpError: (await import('@dwp-frontend/shared-utils/http-error')).HttpError,
  getWorkplaceAdminResources: api.resources,
  getWorkplaceResourceClosures: api.closures,
  getWorkplaceResourceClosure: api.detail,
  getWorkplaceFutureBookingImpact: api.impact,
  getWorkplaceRoomBookingImpact: api.roomImpact,
  createWorkplaceResourceClosure: api.create,
  cancelWorkplaceResourceClosure: api.cancel,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('./workplace-experience-authority', () => ({
  useWorkplaceExperienceAuthority: () => 'trusted-principal',
}));
vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canUpdateWorkplaceAdmin: true,
    canCreateWorkplaceAdmin: state.create,
    canViewRoomsAdmin: true,
    canUpdateRoomsAdmin: true,
  }),
  useWorkplaceGovernanceCapabilities: () => ({
    isLoaded: true,
    isError: state.error,
    globalAdministrator: false,
    effectiveScopes: [
      {
        delegationId: 'trusted-delegation',
        permissions: ['CATALOG_MANAGE'],
        floorIds: state.read ? ['20000000-0000-4000-8000-000000000001'] : [],
        version: state.revision,
      },
    ],
    hierarchy: { canManage: true },
    allowsTarget: (permission: string, siteId: string, floorId: string) =>
      siteId === '10000000-0000-4000-8000-000000000001' &&
      floorId === '20000000-0000-4000-8000-000000000001' &&
      (permission === 'CATALOG_VIEW' ? state.read : state.manage),
  }),
}));
vi.mock('./workplace-admin-experience-ui', () => ({
  WorkplaceAdminSection: ({ children }: { children: ReactNode }) =>
    createElement('section', null, children),
}));
vi.mock('./workplace-experience-booking-inspector', () => ({
  WorkplaceExperienceBookingInspector: () => null,
}));
vi.mock('./workplace-experience-format', () => ({
  formatWorkplaceExperienceInstant: (value: string) => value,
}));
vi.mock('./workplace-experience-ui', () => ({
  WorkplaceExperienceQueryError: ({ retry }: { retry: () => void }) =>
    createElement('button', { onClick: retry }, 'source-error'),
}));
vi.mock('./workplace-resource-closure-execution', () => ({
  WorkplaceResourceClosureExecution: ({
    canManage,
    sourceFresh,
  }: {
    canManage: boolean;
    sourceFresh: boolean;
  }) =>
    createElement(
      'button',
      { disabled: !canManage || !sourceFresh },
      'workplace.experience.closureExecution.preview'
    ),
}));
vi.mock('@mui/material/Checkbox', () => ({
  default: (props: { checked: boolean; disabled: boolean; onChange: typeof controls.confirm }) => {
    controls.confirm = props.onChange;
    return createElement('input', { type: 'checkbox', ...props });
  },
}));
vi.mock('@dwp-frontend/design-system', () => ({
  DwpDateTimeProvider: ({ children }: { children: ReactNode }) => children,
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) =>
    createElement('div', null, children, action),
  DateTimePickerField: ({
    value,
    label,
    disabled,
  }: {
    value: string | null;
    label: string;
    disabled: boolean;
  }) =>
    createElement('input', { value: value ?? '', 'aria-label': label, disabled, readOnly: true }),
  FormField: (props: {
    label: string;
    value: string;
    disabled: boolean;
    onChange: typeof controls.reason;
  }) => {
    controls.reason = props.onChange;
    return createElement('input', {
      'aria-label': props.label,
      value: props.value,
      disabled: props.disabled,
      onChange: props.onChange,
    });
  },
  ActionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick: () => void;
    disabled: boolean;
  }) => {
    if (typeof children === 'string') controls.buttons.set(children, onClick);
    return createElement('button', { onClick, disabled }, children);
  },
}));

const siteId = '10000000-0000-4000-8000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000001';
const otherFloor = '20000000-0000-4000-8000-000000000002';
const resourceId = '30000000-0000-4000-8000-000000000001';
const closureId = '60000000-0000-4000-8000-000000000001';
const resource = {
  siteId,
  floorId,
  resourceId,
  name: 'Canonical desk',
  type: 'DESK',
  calendarResourceId: null,
  version: 5,
} as WorkplaceResource;
const page = <T,>(content: T[], index = 0) => ({
  content,
  page: index,
  size: 20,
  totalElements: content.length,
  totalPages: Math.ceil(content.length / 20),
  generatedAt: '2026-09-14T00:00:00Z',
  countsScope: 'FLOORS',
  allowedFloorIds: [floorId],
});
const closure = {
  closureId,
  siteId,
  floorId,
  resourceId,
  timeZone: 'Asia/Seoul',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-10-02T00:00:00Z',
  status: 'ACTIVE',
  version: 0,
  resourceVersionAtCreate: 5,
  reason: 'Verified saved closure',
};
const emptyImpact = (from: string, to: string, index = 0) => ({
  resourceId,
  siteId,
  from,
  to,
  metadata: { availability: 'EMPTY' },
  affectedBookings: page([], index),
});
let root: Root, container: HTMLDivElement, client: QueryClient;
const render = async (value = resource) => {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(WorkplaceResourceClosurePanel, { resource: value, timeZone: 'Asia/Seoul' })
      )
    );
  });
};
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};
const approve = async () => {
  await act(async () => controls.reason({ target: { value: 'Verified maintenance reason' } }));
  await act(async () => controls.confirm({ target: { checked: true } }));
};
const submit = () =>
  [...container.querySelectorAll('button')]
    .find((item) => item.textContent === 'workplace.experience.closureExecution.preview')
    ?.click();
const createButton = () =>
  [...container.querySelectorAll('button')].find(
    (item) => item.textContent === 'workplace.experience.closureExecution.preview'
  )!;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  controls.buttons.clear();
  Object.assign(state, { read: true, manage: true, error: false, revision: 1, create: true });
  api.resources.mockResolvedValue([resource]);
  api.closures.mockResolvedValue(page([]));
  api.detail.mockResolvedValue(closure);
  api.impact.mockImplementation(
    async (_site: string, _resource: string, from: string, to: string, index = 0) =>
      emptyImpact(from, to, index)
  );
  api.create.mockImplementation(
    async (_site: string, _resource: string, input: { version: number }) => ({
      ...closure,
      ...input,
      resourceVersionAtCreate: input.version,
    })
  );
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

it('uses canonical floor target authority before reads and never falls back to site-wide management', async () => {
  await render({ ...resource, floorId: otherFloor });
  await settle();
  expect(api.resources).not.toHaveBeenCalled();
  expect(api.closures).not.toHaveBeenCalled();
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
  expect(createButton()?.disabled ?? true).toBe(true);
});

it('preserves verified read-only facts while the exact target manage permission is denied', async () => {
  state.manage = false;
  api.closures.mockResolvedValue(page([closure]));
  await render();
  await settle();
  await settle();
  expect(container.textContent).toContain('Verified saved closure');
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
  expect(createButton()?.disabled ?? true).toBe(true);
});

it('closes before closure and impact reads when the native resource detail returns another floor', async () => {
  api.resources.mockResolvedValue([{ ...resource, floorId: otherFloor }]);
  await render();
  await settle();
  expect(api.closures).not.toHaveBeenCalled();
  expect(api.impact).not.toHaveBeenCalled();
  expect(container.textContent).toContain('source-error');
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
});

it.each(['site', 'range', 'page', 'booking-floor'])(
  'rejects an invalid impact %s echo before confirmation or command',
  async (kind) => {
    api.impact.mockImplementation(
      async (_site: string, _resource: string, from: string, to: string) => {
        const value = emptyImpact(from, to);
        if (kind === 'site') return { ...value, siteId: '10000000-0000-4000-8000-000000000002' };
        if (kind === 'range') return { ...value, to: '2027-01-01T00:00:00Z' };
        if (kind === 'page') return { ...value, affectedBookings: page([], 1) };
        return {
          ...value,
          affectedBookings: page([
            {
              bookingId: '40000000-0000-4000-8000-000000000001',
              resourceId,
              siteId,
              floorId: otherFloor,
            },
          ]),
        };
      }
    );
    await render();
    await settle();
    await settle();
    expect(container.textContent).toContain('source-error');
    await approve();
    await act(async () => submit());
    expect(api.create).not.toHaveBeenCalled();
    expect(createButton()?.disabled ?? true).toBe(true);
  }
);

it('rejects closure page foreign-floor rows and retains independently verified impact facts', async () => {
  api.closures.mockResolvedValue(page([{ ...closure, floorId: otherFloor }]));
  await render();
  await settle();
  await settle();
  expect(container.textContent).not.toContain('Verified saved closure');
  expect(container.textContent).toContain('workplace.experience.affectedCount');
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
});

it('closes on effective delegation read errors and rejects legacy whole-site page metadata for restricted reads', async () => {
  api.closures.mockResolvedValue({
    ...page([]),
    countsScope: undefined,
    allowedFloorIds: undefined,
  });
  await render();
  await settle();
  await settle();
  expect(container.textContent).toContain('source-error');
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
  state.error = true;
  await render();
  expect(container.textContent).toContain('workplace.experience.permissionChanged');
  expect(createButton()?.disabled ?? true).toBe(true);
});

it('closes an invalid native closure detail before cancellation while keeping the verified saved row', async () => {
  api.closures.mockResolvedValue(page([closure]));
  api.detail.mockResolvedValue({ ...closure, floorId: otherFloor });
  await render();
  await settle();
  await settle();
  const savedRow = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.includes('Verified saved closure')
  )!;
  await act(async () => savedRow.click());
  await settle();
  expect(api.detail).toHaveBeenCalledWith(siteId, closureId);
  expect(container.textContent).toContain('Verified saved closure');
  expect(container.textContent).not.toContain('workplace.experience.closureCancel');
  await approve();
  await act(async () => controls.buttons.get('workplace.experience.closureCancel')?.());
  expect(api.cancel).not.toHaveBeenCalled();
});

it('closes cached protected facts and commands when the canonical resource recheck returns403', async () => {
  api.closures.mockResolvedValue(page([closure]));
  await render();
  await settle();
  await settle();
  expect(container.textContent).toContain('Verified saved closure');
  api.resources.mockRejectedValue(new HttpError('Target authority revoked', 403));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['workplace', 'closures'] });
  });
  await settle();
  expect(container.textContent).not.toContain('Verified saved closure');
  expect(container.textContent).not.toContain('workplace.experience.affectedCount');
  await approve();
  await act(async () => submit());
  expect(api.create).not.toHaveBeenCalled();
  expect(createButton()?.disabled ?? true).toBe(true);
});
