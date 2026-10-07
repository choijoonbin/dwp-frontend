// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HCM_HOME_CLOCK_REFRESH_MS, useHcmHomeClock } from './use-hcm-home-clock';

let host!: HTMLDivElement;
let root!: Root;

function ClockProbe() {
  return createElement('output', { 'data-testid': 'clock' }, String(useHcmHomeClock()));
}

function value(): number {
  return Number(host.querySelector('[data-testid="clock"]')?.textContent);
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-17T01:00:00.000Z'));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('HRIS home clock', () => {
  it('advances freshness on its bounded interval', () => {
    act(() => root.render(createElement(ClockProbe)));
    const initial = value();

    act(() => vi.advanceTimersByTime(HCM_HOME_CLOCK_REFRESH_MS));

    expect(value()).toBe(initial + HCM_HOME_CLOCK_REFRESH_MS);
  });

  it('refreshes immediately when a suspended view regains focus', () => {
    act(() => root.render(createElement(ClockProbe)));
    vi.setSystemTime(new Date('2026-09-17T03:30:00.000Z'));

    act(() => window.dispatchEvent(new Event('focus')));

    expect(value()).toBe(Date.parse('2026-09-17T03:30:00.000Z'));
  });
});
