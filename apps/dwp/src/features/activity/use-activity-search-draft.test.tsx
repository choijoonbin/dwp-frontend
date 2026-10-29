// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVITY_SEARCH_DEBOUNCE_MS, useActivitySearchDraft } from './use-activity-search-draft';

let root: Root;
let host: HTMLDivElement;
let setDraft!: ReturnType<typeof useActivitySearchDraft>[1];
let draft = '';
let tooShort = false;
let committed = '';
const onCommit = vi.fn();

function Harness() {
  [draft, setDraft, tooShort] = useActivitySearchDraft(committed, onCommit);
  return null;
}

describe('Activity search draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    committed = '';
    onCommit.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it('keeps typing local and commits only the latest value after 300ms', () => {
    act(() => setDraft('r'));
    act(() => vi.advanceTimersByTime(ACTIVITY_SEARCH_DEBOUNCE_MS - 1));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => setDraft('review'));
    act(() => vi.advanceTimersByTime(ACTIVITY_SEARCH_DEBOUNCE_MS));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('review');
  });

  it('cancels a pending local commit when navigation supplies a new URL value', () => {
    act(() => setDraft('stale draft'));
    committed = 'saved view';
    act(() => root.render(<Harness />));
    act(() => vi.advanceTimersByTime(ACTIVITY_SEARCH_DEBOUNCE_MS));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('clears an older committed query immediately while retaining a 1-2 character draft', () => {
    committed = 'review';
    act(() => root.render(<Harness />));
    expect(draft).toBe('review');

    act(() => setDraft('re'));
    expect(onCommit).toHaveBeenCalledWith('');
    expect(draft).toBe('re');
    expect(tooShort).toBe(true);

    committed = '';
    act(() => root.render(<Harness />));
    act(() => vi.advanceTimersByTime(ACTIVITY_SEARCH_DEBOUNCE_MS));
    expect(draft).toBe('re');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('trims and commits a valid exact UUID after the debounce', () => {
    const id = 'aaaaaaaa-0000-4000-8000-000000000001';
    act(() => setDraft(` ${id} `));
    expect(tooShort).toBe(false);
    act(() => vi.advanceTimersByTime(ACTIVITY_SEARCH_DEBOUNCE_MS));
    expect(onCommit).toHaveBeenCalledWith(id);
  });
});
