// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOwnerScopedState } from './use-owner-scoped-state';

let host: HTMLDivElement;
let root: Root;
let setCount: ((value: number | null) => void) | undefined;

function Harness({ owner }: { owner: string }) {
  const [count, set] = useOwnerScopedState<number | null>(owner, null);
  useEffect(() => {
    setCount = set;
  }, [set]);
  return <output>{count}</output>;
}

describe('owner-scoped parent state', () => {
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

  it('hides the previous owner value on the transition render and rejects its stale setter', async () => {
    await act(async () => root.render(<Harness owner="A" />));
    const staleSetter = setCount!;
    await act(async () => staleSetter(6));
    expect(host.textContent).toBe('6');

    await act(async () => root.render(<Harness owner="B" />));
    expect(host.textContent).toBe('');
    await act(async () => staleSetter(9));
    expect(host.textContent).toBe('');

    await act(async () => setCount!(2));
    expect(host.textContent).toBe('2');
    await act(async () => staleSetter(10));
    expect(host.textContent).toBe('2');
  });
});
