// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceDeviceOperations } from './workplace-navigation-device-operations';

const api = vi.hoisted(() => ({
  audit: vi.fn(),
  command: vi.fn(),
  commands: vi.fn(),
  devices: vi.fn(),
  providers: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/workplace-navigation-api', () => ({
  getWorkplaceDeviceAuditEvents: api.audit,
  getWorkplaceDeviceCommandReceipt: api.command,
  getWorkplaceDeviceCommands: api.commands,
  getWorkplaceDeviceProviders: api.providers,
  getWorkplaceDevices: api.devices,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) =>
    createElement('button', { onClick }, children),
  EmptyState: ({ title }: { title: ReactNode }) => createElement('div', null, title),
  InlineFeedback: ({
    children,
    'data-testid': testId,
  }: {
    children: ReactNode;
    'data-testid'?: string;
  }) => createElement('div', { 'data-testid': testId, role: 'alert' }, children),
  LoadingState: ({ label }: { label: ReactNode }) => createElement('div', null, label),
  PageCanvas: ({ children }: { children: ReactNode }) => createElement('main', null, children),
  foundationTokens: { radius: { control: 6 } },
}));

vi.mock('./workplace-member-surfaces', () => ({
  workplaceMemberCard: () => ({}),
  workplaceMemberSoftSurface: () => ({}),
}));

vi.mock('./workplace-navigation-device-ui', () => ({
  displayTime: () => '2026-10-28 20:00',
  stateChipSx: () => ({}),
  stateColor: () => 'default',
}));

vi.mock('./workplace-navigation-device-workflows', () => ({
  ApprovalWorkflow: () => null,
  BindingWorkflow: () => null,
  RemoteCommandWorkflow: () => null,
}));

const DEVICE_ID = '19000000-0000-4000-8000-000000000005';
const OTHER_DEVICE_ID = '19000000-0000-4000-8000-000000000006';
const COMMAND_ID = '19000000-0000-4000-8000-000000000007';
const MISSING_DEVICE_ID = '19000000-0000-4000-8000-000000000008';

const device = {
  deviceId: DEVICE_ID,
  displayName: 'Room panel 19A',
  deviceType: 'ROOM_PANEL',
  registrationState: 'BOUND',
  siteId: '19000000-0000-4000-8000-000000000001',
  floorId: '19000000-0000-4000-8000-000000000002',
  resourceId: '19000000-0000-4000-8000-000000000003',
  hardwareModel: 'Panel X',
  osVersion: '14.2',
  appVersion: '2.9.0',
  policyVersion: 'privacy-v4',
  heartbeatAt: '2026-10-28T11:00:00Z',
  connectivity: 'ONLINE',
  scheduleSourceAt: '2026-10-28T11:00:00Z',
  scheduleReceivedAt: '2026-10-28T11:00:00Z',
  scheduleFreshness: 'FRESH',
  recentErrorCode: null,
  safetyOfflineFallback: true,
  version: 4,
  updatedAt: '2026-10-28T11:00:00Z',
};

function command(deviceId = DEVICE_ID) {
  return {
    commandId: COMMAND_ID,
    deviceId,
    commandType: 'FORCE_SYNC',
    state: 'RESULT_UNKNOWN',
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

describe('Workplace device exception target', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    api.devices.mockResolvedValue([device]);
    api.providers.mockResolvedValue([]);
    api.commands.mockResolvedValue([]);
    api.audit.mockResolvedValue([]);
    api.command.mockResolvedValue(command());
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function renderEntry(
    initialEntry = `/workplace/admin/devices?device=${DEVICE_ID}&command=${COMMAND_ID}`
  ) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <WorkplaceDeviceOperations locale="en" canManage elevated />
            <LocationProbe />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    }
  }

  it('loads the exact command receipt and highlights it outside device history', async () => {
    await renderEntry();

    expect(api.command).toHaveBeenCalledWith(COMMAND_ID);
    expect(host.querySelector(`[data-testid="workplace-device-command-${COMMAND_ID}"]`)).not.toBe(
      null
    );
  });

  it('blocks a command receipt returned for a different parent device', async () => {
    api.command.mockResolvedValue(command(OTHER_DEVICE_ID));
    await renderEntry();

    expect(host.textContent).toContain(
      'The requested command receipt does not match this device authority record.'
    );
    expect(host.querySelector(`[data-testid="workplace-device-command-${COMMAND_ID}"]`)).toBe(null);
  });

  it('blocks the owner workflow when the exact receipt returns 404', async () => {
    api.command.mockRejectedValue(new Error('404'));
    await renderEntry();

    expect(host.textContent).toContain(
      'The requested command receipt does not match this device authority record.'
    );
    expect(host.querySelector(`[data-testid="workplace-device-command-${COMMAND_ID}"]`)).toBe(null);
  });

  it('keeps an unavailable explicit device target fail-closed without clearing its command', async () => {
    await renderEntry(`/workplace/admin/devices?device=${MISSING_DEVICE_ID}&command=${COMMAND_ID}`);

    expect(host.querySelector('[data-testid="workplace-device-target-error"]')).not.toBe(null);
    expect(api.command).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="location-search"]')?.textContent).toBe(
      `?device=${MISSING_DEVICE_ID}&command=${COMMAND_ID}`
    );
  });

  it('selects the first authorized device only for a queryless entry', async () => {
    await renderEntry('/workplace/admin/devices');

    expect(host.textContent).toContain(DEVICE_ID);
    expect(host.querySelector('[data-testid="workplace-device-target-error"]')).toBe(null);
    expect(host.querySelector('[data-testid="location-search"]')?.textContent).toBe(
      `?device=${DEVICE_ID}`
    );
  });
});
