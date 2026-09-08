// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { VideoMeetingTemplate } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
const read = vi.hoisted(() => vi.fn());
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-templates-api', () => ({
  getVideoMeetingTemplate: read,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, args?: { version?: number }) =>
      args?.version !== undefined ? key + ':' + args.version : key,
  }),
}));
import { MeetingScheduleTemplateSelection } from './meeting-schedule-template-selection';
type Props = ComponentProps<typeof MeetingScheduleTemplateSelection>;
const template: VideoMeetingTemplate = {
  templateId: '82000000-0000-4000-8000-000000000011',
  version: 2,
  name: 'Verified decision template',
  purpose: 'Release approval and risk review',
  scope: 'ORGANIZATION',
  category: 'DECISION',
  favorite: false,
  canEdit: false,
  durationMinutes: 45,
  agendaItems: [],
  updatedAt: '2026-09-07T00:00:00Z',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let root: Root;
let mount: HTMLDivElement;
let props: Props;
let mounted: boolean;
async function render(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides };
  await act(async () => root.render(createElement(MeetingScheduleTemplateSelection, props)));
}
async function focus() {
  await act(async () => window.dispatchEvent(new Event('focus')));
}
describe('authorized applied-template presentation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    read.mockResolvedValue(template);
    props = {
      templateId: template.templateId,
      version: 2,
      busy: false,
      onChoose: vi.fn(),
      onRevoke: vi.fn(),
    };
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    mounted = true;
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    mount.remove();
    vi.restoreAllMocks();
  });
  it('renders the authorized source name, purpose and exact applied revision as a selection control', async () => {
    await render();
    expect(mount.textContent).toContain(template.name);
    expect(mount.textContent).toContain(template.purpose);
    expect(mount.textContent).toContain('templates.version:2');
    await act(async () => mount.querySelector('button')!.click());
    expect(props.onChoose).toHaveBeenCalledOnce();
  });
  it('does not fetch or claim an applied template when its reference has been cleared', async () => {
    await render({ templateId: undefined, version: undefined });
    expect(read).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(template.name);
  });
  it('withdraws old presentation while revalidating and rejects a changed source revision', async () => {
    await render();
    const pending = deferred<VideoMeetingTemplate>();
    read.mockReturnValue(pending.promise);
    await focus();
    expect(mount.textContent).not.toContain(template.name);
    await act(async () => pending.resolve({ ...template, version: 3, name: 'Changed name' }));
    expect(mount.textContent).not.toContain('Changed name');
    expect(mount.querySelector('[data-testid="schedule-template-selection"]')).toBeNull();
    expect(mount.textContent).toContain('scheduleWorkspace.design.sourceFailed');
  });
  it('revokes display on forbidden and rejects a late successful request from before the denial', async () => {
    const pending = deferred<VideoMeetingTemplate>();
    read.mockReturnValueOnce(pending.promise);
    await render();
    read.mockRejectedValue(new HttpError('Denied', 403));
    await focus();
    expect(props.onRevoke).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(template));
    expect(mount.textContent).not.toContain(template.name);
  });
  it('cannot expose the previous template after a new reference is selected', async () => {
    const pending = deferred<VideoMeetingTemplate>();
    read.mockReturnValueOnce(pending.promise);
    await render();
    const next = {
      ...template,
      templateId: '82000000-0000-4000-8000-000000000012',
      name: 'Current template',
    };
    read.mockResolvedValue(next);
    await render({ templateId: next.templateId });
    await act(async () => pending.resolve(template));
    expect(mount.textContent).toContain(next.name);
    expect(mount.textContent).not.toContain(template.name);
  });
  it('aborts the authorization read and ignores late completion after unmount', async () => {
    const pending = deferred<VideoMeetingTemplate>();
    read.mockReturnValueOnce(pending.promise);
    await render();
    const signal = read.mock.calls[0][1] as AbortSignal;
    await act(async () => root.unmount());
    mounted = false;
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(template));
    expect(mount.childElementCount).toBe(0);
    expect(props.onRevoke).not.toHaveBeenCalled();
  });
});
